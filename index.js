/* JALTRON core - streaming AI, queued speech, instant "shut up" */
'use strict';

// ---------------------------------------------------------------- helpers
const $ = (id) => document.getElementById(id);
const synth = window.speechSynthesis || null;

const DEFAULTS = {
  provider: 'offline',
  apiKey: '',
  anthropicModel: 'claude-sonnet-5-5',
  openaiModel: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1',
  voiceURI: '',
  rate: 1.0,
  pitch: 0.85,
};

const S = {
  active: false,      // mic loop on
  muted: false,       // spoken replies off
  theme: 'cyan',
  settings: { ...DEFAULTS },
  voice: null,
  history: [],        // [{role, content}]
  abort: null,        // AbortController of the in-flight AI request
  hushed: false,      // true after "shut up": drop the rest of the current reply's speech
  speaking: false,
  lastSpeechEnd: 0,
  queue: [],          // sentences waiting to be spoken
  speechGen: 0,       // bumps on cancel so stale utterance callbacks are ignored
  sBuf: '',           // partial sentence buffer while streaming
  recognition: null,
  warnedNoKey: false,
};

// ---------------------------------------------------------------- UI state
function setState(state, text) {
  document.body.dataset.state = state;
  $('status-text').textContent = text || state.toUpperCase();
}
function idleState() {
  if (S.speaking) return setState('speaking', 'SPEAKING');
  if (S.abort) return setState('thinking', 'THINKING');
  if (S.active) return setState('listening', 'LISTENING');
  setState('standby', 'STANDBY');
}
function setLive(msg) { $('live-transcript').textContent = msg; }

// Terminal: built with textContent (no innerHTML), capped so the DOM never grows
const LOG_CAP = 60;
function log(tag, message, color = 'c-main') {
  const feed = $('terminal');
  const item = document.createElement('div');
  item.className = 'log';
  const meta = document.createElement('div');
  meta.className = 'meta';
  const t = document.createElement('span');
  t.className = 'tg ' + color;
  t.textContent = '[' + tag + ']';
  const time = document.createElement('span');
  time.textContent = new Date().toLocaleTimeString();
  meta.append(t, time);
  const body = document.createElement('div');
  body.className = 'body';
  body.textContent = message;
  item.append(meta, body);
  feed.appendChild(item);
  while (feed.childElementCount > LOG_CAP) feed.firstElementChild.remove();
  feed.scrollTop = feed.scrollHeight;
}

// Chat bubbles. Streaming text is flushed once per animation frame.
const CHAT_CAP = 80;
function addMsg(kind, text) {
  const chat = $('chat');
  const el = document.createElement('div');
  el.className = 'msg ' + kind;
  el.textContent = text;
  chat.appendChild(el);
  while (chat.childElementCount > CHAT_CAP) chat.firstElementChild.remove();
  chat.scrollTop = chat.scrollHeight;
  let pending = null, raf = 0;
  return {
    el,
    set(txt) {
      pending = txt;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        el.textContent = pending;
        chat.scrollTop = chat.scrollHeight;
      });
    },
    done() { el.classList.remove('live-msg'); },
  };
}

// ---------------------------------------------------------------- speech output
function cleanForSpeech(t) {
  return t
    .replace(/```[\s\S]*?```/g, ' code block. ')
    .replace(/https?:\/\/\S+/g, ' link ')
    .replace(/[*_`#>~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function enqueue(text) {
  if (!synth || S.muted || S.hushed) return;
  const clean = cleanForSpeech(text);
  if (!clean) return;
  S.queue.push(clean);
  pump();
}

function pump() {
  if (!synth || S.speaking || !S.queue.length) return;
  const gen = S.speechGen;
  const u = new SpeechSynthesisUtterance(S.queue.shift());
  if (S.voice) { u.voice = S.voice; u.lang = S.voice.lang; }
  u.rate = S.settings.rate;
  u.pitch = S.theme === 'ultron' ? Math.max(0.4, S.settings.pitch - 0.15) : S.settings.pitch;
  const finish = () => {
    if (gen !== S.speechGen) return; // cancelled: ignore stale event
    S.speaking = false;
    S.lastSpeechEnd = performance.now();
    if (S.queue.length) pump(); else idleState();
  };
  u.onstart = () => { if (gen === S.speechGen) { S.speaking = true; setState('speaking', 'SPEAKING'); } };
  u.onend = finish;
  u.onerror = finish;
  S.speaking = true; // claim the slot immediately so we never double-start
  synth.speak(u);
}

function cancelSpeech() {
  S.speechGen++;
  S.queue.length = 0;
  S.sBuf = '';
  S.speaking = false;
  if (synth) synth.cancel();
}

// Streaming: speak each finished sentence while the rest is still arriving
function feedSpeech(chunk) {
  if (S.hushed || S.muted) return;
  S.sBuf += chunk;
  let m;
  while ((m = S.sBuf.match(/^([\s\S]*?[.!?:;\n])\s+/))) {
    enqueue(m[1]);
    S.sBuf = S.sBuf.slice(m[0].length);
  }
  if (S.sBuf.length > 180) { // very long sentence: cut at the last comma/space
    const cut = Math.max(S.sBuf.lastIndexOf(', '), S.sBuf.lastIndexOf(' '));
    if (cut > 60) { enqueue(S.sBuf.slice(0, cut + 1)); S.sBuf = S.sBuf.slice(cut + 1); }
  }
}
function flushSpeech() {
  if (S.sBuf.trim()) enqueue(S.sBuf);
  S.sBuf = '';
}

// Say something fixed (local command replies)
function say(text) {
  cancelSpeech();
  S.hushed = false;
  enqueue(text);
}

// ---------------------------------------------------------------- SHUT UP
const SHUT_RE = /\b(shut\s?up|be quiet|stop talking|stop speaking|shush|hush|silence|quiet down|zip it|that's enough|that is enough)\b/;
const SHUT_EXACT = /^(?:ok(?:ay)?\s+|hey\s+|jaltron\s+|please\s+)*(stop|enough|quiet|cancel|stop it|stop please)(?:\s+(?:please|now|jaltron))?$/;
function isShutUp(raw) {
  const t = raw.toLowerCase().replace(/[.,!?]/g, '').trim();
  if (!t) return false;
  if (SHUT_EXACT.test(t)) return true;
  return t.split(/\s+/).length <= 6 && SHUT_RE.test(t);
}

function shutUp(source = 'command') {
  const wasBusy = S.speaking || S.queue.length || S.abort;
  S.hushed = true;
  if (S.abort) { S.abort.abort(); S.abort = null; }
  cancelSpeech();
  document.querySelectorAll('.msg.live-msg').forEach((n) => n.classList.remove('live-msg'));
  idleState();
  setLive('Silenced.');
  if (wasBusy) log('SILENCED', 'Stopped speaking (' + source + ').', 'c-warn');
}

// ---------------------------------------------------------------- AI
function systemPrompt() {
  return [
    'You are JALTRON, a sharp, calm AI voice assistant inside a cyberpunk HUD.',
    'Your replies are spoken aloud, so keep them short: usually one to three sentences.',
    'Use plain sentences only: no markdown, no bullet points, no emojis, no code blocks unless the user asks for code.',
    'Be direct, friendly and a little dry. If you do not know something, say so.',
    'Current local date and time: ' + new Date().toLocaleString() + '.',
  ].join(' ');
}

async function errorText(res) {
  let msg = res.status + ' ' + res.statusText;
  try {
    const j = await res.json();
    msg = (j.error && (j.error.message || j.error)) || j.message || msg;
  } catch (e) {}
  if (res.status === 401) msg += ' (check your API key in Settings)';
  return typeof msg === 'string' ? msg : JSON.stringify(msg);
}

// Minimal SSE reader shared by both providers
async function readSSE(res, onData) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try { onData(JSON.parse(data)); } catch (e) {}
    }
  }
}

async function streamAnthropic(messages, signal, onChunk) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': S.settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: S.settings.anthropicModel,
      max_tokens: 500,
      stream: true,
      system: systemPrompt(),
      messages,
    }),
  });
  if (!res.ok) throw new Error(await errorText(res));
  await readSSE(res, (d) => {
    if (d.type === 'content_block_delta' && d.delta && d.delta.text) onChunk(d.delta.text);
    else if (d.type === 'error') throw new Error(d.error && d.error.message || 'Stream error');
  });
}

async function streamOpenAI(messages, signal, onChunk) {
  const base = S.settings.baseUrl.replace(/\/+$/, '');
  const res = await fetch(base + '/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + S.settings.apiKey },
    body: JSON.stringify({
      model: S.settings.openaiModel,
      max_tokens: 500,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt() }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(await errorText(res));
  await readSSE(res, (d) => {
    const c = d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content;
    if (c) onChunk(c);
  });
}

function onlineReady() {
  const p = S.settings.provider;
  return (p === 'anthropic' || p === 'openai') && S.settings.apiKey.trim().length > 0;
}

async function askAI(text) {
  if (S.abort) S.abort.abort();
  cancelSpeech();
  S.hushed = false;

  addMsg('user', text);
  const bubble = addMsg('ai', '');
  bubble.el.classList.add('live-msg');

  // Offline brain: instant, no network
  if (!onlineReady()) {
    if (S.settings.provider !== 'offline' && !S.warnedNoKey) {
      S.warnedNoKey = true;
      log('AI', 'No API key set, using the offline brain. Open Settings to add one.', 'c-warn');
    }
    const reply = await offlineBrain(text);
    bubble.set(reply); bubble.done();
    S.history.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
    trimHistory();
    enqueue(reply);
    return;
  }

  const ctrl = new AbortController();
  S.abort = ctrl;
  setState('thinking', 'THINKING');
  S.history.push({ role: 'user', content: text });
  trimHistory(true);

  let full = '';
  try {
    const onChunk = (c) => { full += c; bubble.set(full); feedSpeech(c); };
    if (S.settings.provider === 'anthropic') await streamAnthropic(S.history.slice(), ctrl.signal, onChunk);
    else await streamOpenAI(S.history.slice(), ctrl.signal, onChunk);
    flushSpeech();
  } catch (e) {
    if (e.name !== 'AbortError') {
      bubble.el.remove();
      const msg = e instanceof TypeError ? 'Network error. Check your connection, base URL and that the provider allows browser requests.' : e.message;
      const err = addMsg('err', 'AI error: ' + msg);
      err.done();
      log('AI ERROR', msg, 'c-err');
      setState('error', 'ERROR');
      if (!full) S.history.pop(); // drop the unanswered user turn
    }
  } finally {
    bubble.done();
    if (S.abort === ctrl) S.abort = null;
    if (full) {
      // keep partial answers too so roles keep alternating
      if (S.history[S.history.length - 1].role === 'user') S.history.push({ role: 'assistant', content: full });
    } else if (S.history.length && S.history[S.history.length - 1].role === 'user' && ctrl.signal.aborted) {
      S.history.pop();
    }
    trimHistory();
    if (document.body.dataset.state !== 'error') idleState();
  }
}

function trimHistory(keepLastUser) {
  while (S.history.length > 20) S.history.shift();
  while (S.history.length && S.history[0].role !== 'user') S.history.shift();
}

// ---------------------------------------------------------------- offline brain
const JOKES = [
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  'There are ten kinds of people: those who understand binary and those who do not.',
  'I would tell you a UDP joke, but you might not get it.',
  'A SQL query walks into a bar, sees two tables and asks: can I join you?',
];

function safeMath(expr) {
  // Recursive-descent parser: numbers, + - * / % ^, parentheses. No eval.
  const s = expr.replace(/\s+/g, '').replace(/x/g, '*').replace(/×/g, '*').replace(/÷/g, '/');
  let i = 0;
  const peek = () => s[i];
  function num() {
    if (peek() === '(') { i++; const v = add(); if (peek() !== ')') throw 0; i++; return v; }
    if (peek() === '-') { i++; return -num(); }
    const m = s.slice(i).match(/^\d*\.?\d+/);
    if (!m) throw 0;
    i += m[0].length;
    return parseFloat(m[0]);
  }
  function pow() { let v = num(); while (peek() === '^') { i++; v = Math.pow(v, num()); } return v; }
  function mul() {
    let v = pow();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const o = s[i++]; const r = pow();
      v = o === '*' ? v * r : o === '/' ? v / r : v % r;
    }
    return v;
  }
  function add() {
    let v = mul();
    while (peek() === '+' || peek() === '-') { const o = s[i++]; const r = mul(); v = o === '+' ? v + r : v - r; }
    return v;
  }
  const v = add();
  if (i !== s.length || !isFinite(v)) throw 0;
  return v;
}

async function offlineBrain(text) {
  const t = text.toLowerCase().replace(/[?!.]+$/g, '').trim();
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  if (/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))\b/.test(t)) return pick(['Hello. JALTRON online.', 'Hey. What do you need?', 'At your service.']);
  if (/how are you/.test(t)) return 'All systems nominal. Thanks for asking.';
  if (/(who are you|your name|what are you)/.test(t)) return 'I am JALTRON, a voice assistant. Add an API key in Settings and I can answer almost anything.';
  if (/what can you do|help me|^help$/.test(t)) return 'Offline I can open sites, search, tell the time, do maths, flip coins, roll dice and tell jokes. With an API key I can hold a full conversation.';
  if (/\b(thanks|thank you)\b/.test(t)) return 'Anytime.';
  if (/joke/.test(t)) return pick(JOKES);
  if (/flip a coin|coin flip/.test(t)) return Math.random() < 0.5 ? 'Heads.' : 'Tails.';
  if (/roll (a |the )?(dice|die)/.test(t)) return 'You rolled a ' + (1 + Math.floor(Math.random() * 6)) + '.';
  if (/battery/.test(t) && navigator.getBattery) {
    try { const b = await navigator.getBattery(); return 'Battery is at ' + Math.round(b.level * 100) + ' percent' + (b.charging ? ' and charging.' : '.'); } catch (e) {}
  }

  const mathPart = t.replace(/^(what is|what's|calculate|compute|solve|how much is)\s+/, '').replace(/\b(plus)\b/g, '+').replace(/\b(minus)\b/g, '-').replace(/\b(times|multiplied by)\b/g, '*').replace(/\b(divided by|over)\b/g, '/').replace(/\bto the power of\b/g, '^').replace(/[=]/g, '');
  if (/^[\d\s+\-*/%^().x×÷]+$/.test(mathPart) && /\d/.test(mathPart) && /[+\-*/%^x×÷]/.test(mathPart)) {
    try { return mathPart.trim() + ' equals ' + +safeMath(mathPart).toFixed(6); } catch (e) {}
  }

  return 'I am running on my offline brain, so I can only handle simple things. Open Settings and add an API key for full AI answers.';
}

// ---------------------------------------------------------------- command router
const SITES = {
  youtube: 'https://youtube.com', google: 'https://google.com', github: 'https://github.com',
  discord: 'https://discord.com', whatsapp: 'https://web.whatsapp.com', spotify: 'https://open.spotify.com',
  reddit: 'https://reddit.com', chatgpt: 'https://chatgpt.com', twitter: 'https://x.com', x: 'https://x.com',
  gmail: 'https://mail.google.com', maps: 'https://maps.google.com', netflix: 'https://netflix.com',
  twitch: 'https://twitch.tv', claude: 'https://claude.ai',
};

function openUrl(url, label) {
  log('LAUNCH', 'Opening ' + label, 'c-ok');
  const w = window.open(url, '_blank', 'noopener');
  if (!w) log('POPUP BLOCKED', 'Allow pop-ups for this page so voice commands can open tabs.', 'c-warn');
}

function runCommand(raw) {
  const text = raw.replace(/^\s*(hey |ok |okay )?jaltron[,:]?\s*/i, '').trim();
  if (!text) return;
  const cmd = text.toLowerCase().replace(/[.!?]+$/g, '').trim();

  if (isShutUp(cmd)) return shutUp('voice/text');

  if (/^(mute|be silent|voice off|stop voice|text only)$/.test(cmd)) { setMuted(true); return; }
  if (/^(unmute|voice on|speak|start talking|speak again|talk to me)$/.test(cmd)) { setMuted(false); say('Voice restored.'); return; }

  if (/^(new chat|forget (everything|this|the conversation)|reset( conversation| chat)?|clear (memory|history|conversation))$/.test(cmd)) {
    S.history = [];
    $('chat').textContent = '';
    log('MEMORY', 'Conversation history cleared.', 'c-warn');
    return say('Conversation cleared.');
  }

  let m = cmd.match(/^open\s+([a-z0-9 -]{1,40})$/);
  if (m) {
    const name = m[1].trim();
    if (SITES[name]) { say('Opening ' + name); return openUrl(SITES[name], name); }
    if (/^[a-z0-9-]+$/.test(name)) { say('Opening ' + name); return openUrl('https://' + name + '.com', name + '.com'); }
  }
  m = cmd.match(/^(?:search(?: for| google for)?|google|look up)\s+(.{1,200})$/);
  if (m) {
    say('Searching for ' + m[1]);
    log('SEARCH', m[1], 'c-main');
    return openUrl('https://www.google.com/search?q=' + encodeURIComponent(m[1]), 'search');
  }

  if (/^(system status|status|diagnostics|run diagnostics)$/.test(cmd)) {
    const online = onlineReady() ? S.settings.provider : 'offline brain';
    const msg = 'All systems operational. AI engine: ' + online + '. Voice: ' + (S.muted ? 'off' : 'on') + '.';
    log('STATUS', msg, 'c-main');
    return say(msg);
  }

  if (/^(what('s| is) )?(the )?(current )?(time|date)( now| today| right now)?$|^what time is it$|^what('s| is) today'?s date$|^what day is it$/.test(cmd)) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    log('CHRONO', timeStr + ' | ' + dateStr, 'c-main');
    return say('It is ' + timeStr + ' on ' + dateStr + '.');
  }

  if (/^(ultron( mode| theme)?|red mode|crimson mode)$/.test(cmd)) { setTheme('ultron'); return say('Ultron protocol engaged.'); }
  if (/^(cyan( mode| theme)?|jarvis( mode)?|blue mode|default theme)$/.test(cmd)) { setTheme('cyan'); return say('Cyan mode restored.'); }
  if (/^(switch|change|toggle) (the )?theme$/.test(cmd)) { setTheme(S.theme === 'cyan' ? 'ultron' : 'cyan'); return; }

  if (/^(clear|clean)( the)?( logs?| terminal| feed)$/.test(cmd)) { $('terminal').textContent = ''; return say('Logs cleared.'); }
  if (/^(open )?settings$/.test(cmd)) { openSettings(); return; }

  askAI(text);
}

// ---------------------------------------------------------------- speech input
function initRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    log('MIC', 'Speech recognition is not supported in this browser (use Chrome or Edge). Typing still works.', 'c-err');
    setLive('Voice input unsupported. Use the text box.');
    return null;
  }
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';

  rec.onstart = () => { $('rec').classList.remove('hidden'); if (!S.speaking && !S.abort) setState('listening', 'LISTENING'); };

  rec.onresult = (e) => {
    // While JALTRON is talking (or just finished) ignore everything except the shut-up command,
    // so it never hears and answers its own voice.
    const deaf = S.speaking || S.queue.length > 0 || performance.now() - S.lastSpeechEnd < 700;
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const tr = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += tr; else interim += tr;
    }
    const heard = (final || interim).trim();
    if (!heard) return;

    if (isShutUp(heard)) { shutUp('voice'); return; } // reacts on interim text for instant response
    if (deaf) return;

    if (!final) { setLive('Heard: "' + interim.trim() + '"'); return; }
    setLive('Executing: "' + final.trim() + '"');
    log('VOICE', '"' + final.trim() + '"', 'c-main');
    runCommand(final.trim());
  };

  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      log('MIC BLOCKED', 'Microphone permission denied.', 'c-err');
      S.active = false; syncCore(); setState('error', 'MIC ERROR'); setLive('Microphone access blocked');
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      log('MIC', 'Recognition error: ' + e.error, 'c-warn');
    }
  };

  rec.onend = () => {
    $('rec').classList.add('hidden');
    if (S.active) setTimeout(() => { if (S.active) { try { rec.start(); } catch (err) {} } }, 250);
    else idleState();
  };
  return rec;
}

function toggleCore() {
  S.active = !S.active;
  syncCore();
  if (S.active) {
    log('CORE', 'JALTRON activated.', 'c-ok');
    if (!S.recognition) S.recognition = initRecognition();
    if (S.recognition) { try { S.recognition.start(); } catch (e) {} setLive('Listening... speak now.'); say('JALTRON online.'); }
    else S.active = false, syncCore();
  } else {
    if (S.recognition) { try { S.recognition.stop(); } catch (e) {} }
    shutUp('power down');
    log('CORE', 'Powered down.', 'c-warn');
    setLive('Press activate, then speak. Say "shut up" any time.');
    idleState();
  }
}
function syncCore() {
  $('core-label').textContent = S.active ? 'ONLINE' : 'ACTIVATE';
  $('core-icon').className = 'fa-solid ' + (S.active ? 'fa-microphone' : 'fa-power-off');
}

// ---------------------------------------------------------------- theme / mute
function setTheme(t) {
  S.theme = t;
  document.body.dataset.theme = t;
  $('theme-label').textContent = t.toUpperCase();
  log('THEME', 'Theme set to ' + t.toUpperCase(), 'c-warn');
}
function setMuted(m) {
  S.muted = m;
  $('mute-label').textContent = m ? 'VOICE OFF' : 'VOICE ON';
  $('mute-icon').className = 'fa-solid ' + (m ? 'fa-volume-xmark' : 'fa-volume-high');
  if (m) cancelSpeech();
  log('VOICE', m ? 'Spoken replies off.' : 'Spoken replies on.', 'c-warn');
}

// ---------------------------------------------------------------- voices + settings
function pickVoice() {
  if (!synth) return;
  const voices = synth.getVoices();
  if (!voices.length) return;
  let v = voices.find((x) => x.voiceURI === S.settings.voiceURI);
  if (!v) {
    const prefs = ['Google UK English Male', 'Daniel', 'Microsoft Ryan', 'Microsoft David', 'Alex', 'Google US English'];
    for (const p of prefs) { v = voices.find((x) => x.name.includes(p)); if (v) break; }
  }
  S.voice = v || voices.find((x) => x.lang.startsWith('en')) || voices[0];
  $('voice-name').textContent = S.voice.name + ' (' + S.voice.lang + ')';
}

function fillVoiceSelect() {
  const sel = $('s-voice');
  sel.textContent = '';
  const voices = synth ? synth.getVoices() : [];
  const sorted = voices.slice().sort((a, b) => (b.lang.startsWith('en') - a.lang.startsWith('en')) || a.name.localeCompare(b.name));
  for (const v of sorted) {
    const o = document.createElement('option');
    o.value = v.voiceURI;
    o.textContent = v.name + ' (' + v.lang + ')';
    sel.appendChild(o);
  }
  if (S.voice) sel.value = S.voice.voiceURI;
}

function refreshEngineLabel() {
  const p = S.settings.provider;
  let label = 'Offline brain';
  if (onlineReady()) label = p === 'anthropic' ? 'Claude: ' + S.settings.anthropicModel : 'OpenAI-compatible: ' + S.settings.openaiModel;
  else if (p !== 'offline') label = 'Offline brain (no key set)';
  $('engine-name').textContent = label;
}

function loadSettings() {
  // Nothing is persisted: settings live in memory for this page session only.
  document.body.dataset.theme = S.theme;
  $('theme-label').textContent = S.theme.toUpperCase();
  $('mute-label').textContent = S.muted ? 'VOICE OFF' : 'VOICE ON';
  $('mute-icon').className = 'fa-solid ' + (S.muted ? 'fa-volume-xmark' : 'fa-volume-high');
}

function openSettings() {
  const d = $('settings'), s = S.settings;
  $('s-provider').value = s.provider;
  $('s-key').value = s.apiKey;
  $('s-model-anthropic').value = s.anthropicModel;
  $('s-model-openai').value = s.openaiModel;
  $('s-base').value = s.baseUrl;
  $('s-rate').value = s.rate; $('o-rate').textContent = s.rate + 'x';
  $('s-pitch').value = s.pitch; $('o-pitch').textContent = s.pitch;
  fillVoiceSelect();
  d.dataset.provider = s.provider;
  if (!d.open) d.showModal();
}

function saveSettings() {
  const s = S.settings;
  s.provider = $('s-provider').value;
  s.apiKey = $('s-key').value.trim();
  s.anthropicModel = $('s-model-anthropic').value.trim() || DEFAULTS.anthropicModel;
  s.openaiModel = $('s-model-openai').value.trim() || DEFAULTS.openaiModel;
  s.baseUrl = $('s-base').value.trim() || DEFAULTS.baseUrl;
  s.voiceURI = $('s-voice').value;
  s.rate = parseFloat($('s-rate').value);
  s.pitch = parseFloat($('s-pitch').value);
  S.warnedNoKey = false;
  pickVoice();
  refreshEngineLabel();
  log('SETTINGS', 'Saved. Engine: ' + $('engine-name').textContent, 'c-ok');
}

// ---------------------------------------------------------------- wiring
function init() {
  loadSettings();
  refreshEngineLabel();

  if (synth) {
    pickVoice();
    synth.onvoiceschanged = pickVoice;
  } else {
    $('voice-name').textContent = 'Speech output unsupported';
  }

  $('core-btn').addEventListener('click', toggleCore);
  $('shut-btn').addEventListener('click', () => shutUp('button'));
  $('mute-btn').addEventListener('click', () => setMuted(!S.muted));
  $('theme-btn').addEventListener('click', () => setTheme(S.theme === 'cyan' ? 'ultron' : 'cyan'));
  $('settings-btn').addEventListener('click', openSettings);
  $('clear-log').addEventListener('click', () => { $('terminal').textContent = ''; });

  $('cmd-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-cmd]');
    if (b) { log('CLICK', b.dataset.cmd, 'c-main'); runCommand(b.dataset.cmd); }
  });

  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('text-input').value.trim();
    if (!v) return;
    $('text-input').value = '';
    log('TEXT', v, 'c-main');
    runCommand(v);
  });

  // Settings dialog
  $('s-provider').addEventListener('change', (e) => { $('settings').dataset.provider = e.target.value; });
  $('s-rate').addEventListener('input', (e) => { $('o-rate').textContent = e.target.value + 'x'; });
  $('s-pitch').addEventListener('input', (e) => { $('o-pitch').textContent = e.target.value; });
  $('s-cancel').addEventListener('click', () => $('settings').close());
  $('settings-form').addEventListener('submit', saveSettings);
  $('s-test').addEventListener('click', () => {
    const keep = { ...S.settings };
    S.settings.voiceURI = $('s-voice').value;
    S.settings.rate = parseFloat($('s-rate').value);
    S.settings.pitch = parseFloat($('s-pitch').value);
    pickVoice();
    say('JALTRON online. Voice test complete.');
    Object.assign(S.settings, keep);
  });

  // Escape = instant shut up (unless a dialog is open, where Esc closes it)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('settings').open) shutUp('Esc key');
  });

  // Stop burning frames when the tab is hidden
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

  window.addEventListener('beforeunload', () => { if (synth) synth.cancel(); });

  log('SYSTEM', 'Ready. Press ACTIVATE to use the mic, or type below. Say "shut up" or press Esc to silence me.', 'c-ok');
  if (!onlineReady()) addMsg('sys', 'Running on the offline brain. Open Settings and add an API key for full AI conversation.');
}

init();