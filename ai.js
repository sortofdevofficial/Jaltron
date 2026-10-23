// JALTRON AI: task assistant. Everything runs locally by default: no model, no training, no network.
//   1. BRAIN      task commands and messy sentence parsing
//   2. JALTRONAI  exact commands, offline skills (math, units, dates, randomness, world clock)
//                 plus optional Universal mode: the user adds their own OpenAI-compatible API
//                 key on the AI page and anything the offline skills cannot answer is sent to
//                 that model. The key lives only in this browser's localStorage, never on a server.
// ---------------------------------------------------------------------------------------
// Offline calculator used by the math skill.
(function (root) {
  function evalExpr(src) {
    let i = 0; const s = src.replace(/\s+/g, '');
    const num = () => { if (s[i] === '(') { i++; const v = add(); if (s[i] !== ')') throw 0; i++; return v; } const m = s.slice(i).match(/^\d+(?:\.\d+)?/); if (!m) throw 0; i += m[0].length; return +m[0]; };
    const un = () => { if (s[i] === '-') { i++; return -un(); } return num(); };
    const pow = () => { const b = un(); if (s[i] === '^') { i++; return Math.pow(b, pow()); } return b; };
    const mul = () => { let v = pow(); while (s[i] === '*' || s[i] === '/') { const o = s[i++], r = pow(); v = o === '*' ? v * r : v / r; } return v; };
    const add = () => { let v = mul(); while (s[i] === '+' || s[i] === '-') { const o = s[i++], r = mul(); v = o === '+' ? v + r : v - r; } return v; };
    const v = add(); if (i !== s.length) throw 0; return v;
  }
  function calc(text) {
    const s = text.toLowerCase().replace(/,/g, '')
      .replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/g, '($1/100*$2)')
      .replace(/\bto the power of\b/g, '^').replace(/\bsquared\b/g, '^2')
      .replace(/\b(?:plus|add)\b/g, '+').replace(/\b(?:minus|subtract|less)\b/g, '-')
      .replace(/\b(?:times|multiplied by|multiply|x)\b/g, '*').replace(/\b(?:divided by|over|divide)\b/g, '/');
    const parts = (s.match(/[\d.+\-*/^()\s]+/g) || []).map(x => x.trim()).filter(x => /\d/.test(x) && /[+\-*/^]/.test(x.replace(/^-/, '')));
    parts.sort((a, b) => b.length - a.length);
    try {
      const v = evalExpr(parts[0]);
      if (!isFinite(v)) return 'That is not a number I can show, for example dividing by zero.';
      return 'Answer: ' + Math.round(v * 1e10) / 1e10;
    } catch { return 'I could not read that calculation. Try "12 * 5", "15% of 200" or "2^10".'; }
  }
  root.calcReply = calc;
})(typeof window !== 'undefined' ? window : globalThis);

// ===== 1. BRAIN =====
(function () {
// JALTRON's built-in assistant: no API, no LLM. Task commands run locally and return { reply, actions }
// that the web UI executes (add, complete, delete, priority, clear, optimize, filter).

const W = { high: 3, medium: 2, low: 1 };
const pad = (n) => String(n).padStart(2, '0');
const dateStr = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const days = (d) => Math.round((new Date(d + 'T00:00') - new Date(dateStr() + 'T00:00')) / 864e5);
const nextDay = (n) => { const i = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(n.toLowerCase()); return dateStr(((i - new Date().getDay() + 7) % 7) || 7); };
const addMonths = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dowOff = (n) => (n - new Date().getDay() + 7) % 7; // days until weekday n (0 = sun, today counts as 0)
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
const cats = () => (window.CATS ? CATS() : ['Dev', 'Bug', 'Study', 'General']);
const catOf = (s) => { const x = String(s).trim().toLowerCase(); return cats().find(c => c.toLowerCase() === x || c.toLowerCase() + 's' === x) || null; };
const customIn = (s) => cats().slice(4).find(c => (' ' + s.toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ').includes(' ' + c.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ')) || '';

const clean = (t) => ({
  id: Number(t.id) || 0, title: String(t.title || '').slice(0, 140),
  prio: W[t.prio] ? t.prio : 'medium',
  tag: (window.CATS ? CATS() : ['Dev', 'Bug', 'Study', 'General']).includes(t.tag) ? t.tag : 'General',
  due: /^\d{4}-\d{2}-\d{2}$/.test(t.due || '') ? t.due : '', done: !!t.done,
  r: ['d', 'wd', 'we', 'w'].includes(t.r) ? t.r : '', s: Number(t.s) || 0, b: Number(t.b) || 0, l: /^\d{4}-\d{2}-\d{2}$/.test(t.l || '') ? t.l : '',
  z: /^\d{4}-\d{2}-\d{2}$/.test(t.z || '') ? t.z : ''
});

function score(t) {
  let s = W[t.prio] * 10;
  if (t.due) { const d = days(t.due); s += d < 0 ? 25 : d === 0 ? 20 : d <= 2 ? 14 : d <= 7 ? 7 : 2; }
  return s + (t.tag === 'Bug' ? 6 : 0);
}
function why(t) {
  const b = [`${t.prio} priority`];
  if (t.due) { const d = days(t.due); b.push(d < 0 ? `${-d}d overdue` : d === 0 ? 'due today' : `due in ${d}d`); }
  if (t.tag === 'Bug') b.push('bugs block other work');
  return b.join(', ');
}
// Is a repeating task scheduled for today (its repeat pattern says it is due)?
function scheduled(t) {
  const d = new Date().getDay();
  return t.r === 'd' || (t.r === 'wd' && d > 0 && d < 6) || (t.r === 'we' && (d === 0 || d === 6)) || (t.r === 'w' && (!t.l || days(t.l) >= 7));
}
const STEPS = {
  Bug: ['Reproduce it and note the exact steps', 'Find the cause in logs or code', 'Fix it', 'Test the fix and nearby features'],
  Dev: ['Define what "done" looks like', 'Build the smallest working version', 'Test it', 'Clean up and ship'],
  Study: ['Pick one topic to cover', 'Study it for 25 focused minutes', 'Write a summary from memory', 'Test yourself'],
  General: ['Write down the exact outcome', 'List what you need first', 'Do the first small step now', 'Review and finish']
};

const STOP = new Set(['the', 'a', 'an', 'to', 'my', 'task', 'tasks', 'please', 'it', 'that', 'this', 'as', 'is', 'for', 'of', 'on', 'priority', 'one', 'called']);
const words = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
function find(list, text) {
  const q = words(text);
  if (!q.length) return null;
  let best = null, bs = 0;
  for (const t of list) {
    const tw = words(t.title);
    const s = q.filter(w => tw.some(x => x === w || (w.length > 3 && x.startsWith(w)))).length;
    if (s > bs) { bs = s; best = t; }
  }
  return best;
}

function stripLead(s) {
  let t = String(s).trim(), prev;
  const re = /^(?:hey\s+jaltron|hey|hi|hello|yo|bro|bruh|dude|man|mate|buddy|ok(?:ay)?|so|well|also|and|then|pls|plz|please|kindly|jaltron|can you|could you|would you|will you|can u|could u|i want you to|i need you to|go ahead and|just)\b[\s,.:!-]*/i;
  do { prev = t; t = t.replace(re, ''); } while (t !== prev);
  return t;
}
const TAG_WORDS = {
  Bug: /\b(bug|bugs|crash|crashes|error|errors|broken|glitch|exception|lag|laggy|issue|issues|fix|fixes)\b/i,
  Study: /\b(study|studying|exam|exams|quiz|homework|assignment|revise|revision|chapter|lecture|class|essay|learn|read|physics|chemistry|biology|math|maths|history|geography|science|english|syllabus|notes)\b/i,
  Dev: /\b(code|coding|build|implement|deploy|feature|plugin|plugins|api|script|server|website|bot|database|refactor|css|html|javascript|python|github|git|commit|minecraft|discord|update|test)\b/i
};
const GEN = { study: ['Study session', 'Study'], studies: ['Study session', 'Study'], studying: ['Study session', 'Study'], homework: ['Do homework', 'Study'], exam: ['Exam prep', 'Study'], exams: ['Exam prep', 'Study'], bug: ['Fix a bug', 'Bug'], bugs: ['Fix bugs', 'Bug'], coding: ['Coding session', 'Dev'], code: ['Coding session', 'Dev'], dev: ['Dev work', 'Dev'], work: ['Work task', 'General'] };

// Turns messy text like "bro pls add for physics exam its urgent" into { title, prio, tag, due }
function parseTask(raw) {
  let s = ' ' + stripLead(raw) + ' ', due = '', prio = 'medium', tag = '', m;
  s = s.replace(/^\s*(?:(?:add|create|make|put|new task|todo|note down|schedule|remind me to|remind me|i need to|i have to|i must|i should|i gotta|i want to|i wanna|lets|let's|dont forget to|don't forget to|dont let me forget to)\b\s*)+/i, ' ');
  s = s.replace(/^\s*(?:(?:a|an|new|the)\s+)?(?:task|todo|reminder|item)\b\s*/i, ' ');
  s = s.replace(/^\s*(?:to|for|about|on|called|named|:)\s+/i, ' ');
  s = ' ' + stripLead(s.trim()) + ' ';
  let rep = '';
  if ((m = s.match(/\b(?:every|each)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i))) { rep = 'w'; due = nextDay(m[1]); s = s.replace(m[0], ' '); }
  else if (/\b(?:every\s*day|each\s*day|everyday|daily)\b/i.test(s)) { rep = 'd'; s = s.replace(/\b(?:every\s*day|each\s*day|everyday|daily)\b/ig, ' '); }
  else if (/\b(?:every\s+weekend|on\s+weekends?)\b/i.test(s)) { rep = 'we'; s = s.replace(/\b(?:every\s+weekend|on\s+weekends?)\b/ig, ' '); }
  else if (/\b(?:every\s+week\s*day|on\s+weekdays|week\s*days?)\b/i.test(s)) { rep = 'wd'; s = s.replace(/\b(?:every\s+week\s*day|on\s+weekdays|week\s*days?)\b/ig, ' '); }
  else if (/\b(?:every\s+week|each\s+week|weekly)\b/i.test(s)) { rep = 'w'; s = s.replace(/\b(?:every\s+week|each\s+week|weekly)\b/ig, ' '); }
  const pre = '(?:by|due|before|until|till|for|on)?\\s*';
  if ((m = s.match(/\b(\d{4}-\d{2}-\d{2})\b/))) { due = m[1]; s = s.replace(m[0], ' '); }
  else if (/\b(?:tomorrow|tmrw|tmr|tmw)\b/i.test(s)) { due = dateStr(1); s = s.replace(new RegExp('\\b' + pre + '(?:tomorrow|tmrw|tmr|tmw)\\b', 'i'), ' '); }
  else if (/\b(?:today|tonight)\b/i.test(s)) { due = dateStr(0); s = s.replace(new RegExp('\\b' + pre + '(?:today|tonight)\\b', 'i'), ' '); }
  else if ((m = s.match(/\b(?:in|within)\s+(\d{1,2})\s+months?\b/i))) { due = addMonths(+m[1]); s = s.replace(m[0], ' '); }
  else if ((m = s.match(/\b(?:in|within)\s+(\d{1,2})\s+weeks?\b/i))) { due = dateStr(+m[1] * 7); s = s.replace(m[0], ' '); }
  else if ((m = s.match(/\b(?:in|within)\s+(\d{1,3})\s+days?\b/i))) { due = dateStr(+m[1]); s = s.replace(m[0], ' '); }
  else if (/\bnext month\b/i.test(s)) { due = addMonths(1); s = s.replace(/\bnext month\b/i, ' '); }
  else if (/\b(?:end of week|eow)\b/i.test(s)) { due = dateStr(dowOff(5)); s = s.replace(/\b(?:end of week|eow)\b/ig, ' '); }
  else if (/\b(?:this |the )?weekend\b/i.test(s)) { due = dateStr(dowOff(6)); s = s.replace(/\b(?:this |the )?weekend\b/ig, ' '); }
  else if (/\bnext week\b/i.test(s)) { due = dateStr(7); s = s.replace(/\bnext week\b/i, ' '); }
  else if ((m = s.match(/\b(?:by|due|before|until|till|on|next|this)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i))) { due = nextDay(m[1]); s = s.replace(m[0], ' '); }
  s = s.replace(/[!?]+/g, ' ');
  const low = /\b(?:not urgent|not important|low priority|no rush|whenever|chill)\b|\s(?:low)\s*$/i;
  const high = /\b(?:urgent|urgently|asap|critical|top priority|high priority|(?:very|super|really|extremely)\s+important|important)\b|\s(?:high)\s*$/i;
  if (low.test(s)) prio = 'low'; else if (high.test(s)) prio = 'high';
  s = s.replace(/\b(?:(?:its|it's|it is|this is|thats|that's|is|very|super|really|so|extremely|quite)\s+)*(?:not urgent|not important|low priority|no rush|whenever|chill|top priority|high priority|medium priority|urgently|urgent|asap|critical|(?:very|super|really|extremely)\s+important|important)\b/gi, ' ').replace(/\s(?:high|low|medium)\s*$/i, ' ');
  if ((m = s.match(/(?:category|tag|#)\s*([\w-]+)/i)) && catOf(m[1])) { tag = catOf(m[1]); s = s.replace(m[0], ' '); }
  else if (customIn(s)) tag = customIn(s);
  else if (TAG_WORDS.Bug.test(s)) tag = 'Bug';
  else if (TAG_WORDS.Study.test(s)) tag = 'Study';
  else if (TAG_WORDS.Dev.test(s)) tag = 'Dev';
  let t = s.replace(/\s+/g, ' ').trim(), prev;
  do { prev = t; t = t.replace(/\b(?:its|it's|it is|this is|thats|that's|is|and|but|because|so|by|due|on|for|at|as|with|before|until|till|to)\s*$/i, '').trim(); } while (t !== prev);
  t = t.replace(/^(?:a\s+|new\s+)?(?:task\s+)?(?:for|about|on|regarding)\s+(?:my\s+|the\s+)?/i, '').replace(/^my\s+/i, '').replace(/\s+tasks?$/i, '').replace(/^[^\w]+|[^\w)]+$/g, '').trim();
  const g = GEN[t.toLowerCase()];
  if (g) { t = g[0]; tag = g[1]; }
  return { title: cap(t).slice(0, 140), prio, tag: tag || 'General', due, rep };
}

const FAQ = [
  [/on-?device|real ai|llm|language model|which model/, 'I run entirely in this app: no model download, no training and no external AI. Task commands and math run locally, so your tasks never leave the page.'],
  [/drag|reorder|move (a )?task/, 'Drag a task up or down in the All view to reorder it. Dragging is off while a search or filter is active.'],
  [/edit|rename|change (the )?(name|title)/, 'Double-click a task title, or press the pencil button. Enter saves and Esc cancels.'],
  [/undo|restore|deleted by mistake/, 'After you delete a task, an Undo button appears for a few seconds at the bottom, or say "undo" in chat.'],
  [/search|shortcut|keyboard|hotkey/, 'Press / anywhere to jump to the search box. You can also filter by category next to it.'],
  [/optimi[sz]|score|rank/, 'The optimizer ranks open tasks by priority, deadline pressure (overdue counts most) and category (bugs get a boost), then puts completed tasks last.'],
  [/dark|light|theme|mode/, 'Open Settings and pick Light, Dark or System, or use the moon or sun button in the header. Your choice is saved.'],
  [/save|persist|lost|refresh|storage|backup/, 'Sign in with Google and tasks save to your account. Signed out, they reset on refresh.'],
  [/status|online|offline|demo/, 'Header status: SYNCED means you are signed in and tasks save to your account. ONLINE means the app is connected but signed out. OFFLINE means no connection; the task assistant still works locally.'],
  [/repeat|recurring|habit|streak/, 'Pick Repeat (Daily, Weekdays or Weekly) when you add or edit a task, or say "add gym daily". Finish it each scheduled day to grow its streak; it reopens by itself for the next round, and missing a day resets the streak. Charts and streaks are in Insights.'],
  [/categor|tag/, () => window.catReply()],
  [/due|deadline|date/, 'Set a due date when adding a task. Badges show Due today, Due tomorrow or how many days overdue. You can tell me too: "add pay hosting tomorrow".']
];

const ADD_RE = /^(?:please\s+|pls\s+|can you\s+|could you\s+)?(?:add|create|put|new task|todo|remind me to|i need to|i have to|i must|i should|i gotta|lets|let's)\b\s*(?:a\s+|an\s+|new\s+)?(?:task\s*)?(?:to\s+|called\s+|named\s+|:)?\s*(.+)$/i;
const SPLIT_RE = /\s*(?:,|;|\bthen\b|\balso\b)\s*|\s+and\s+(?=(?:add|fix|study|read|learn|finish|write|build|call|buy|do|make|clean|review|prepare|practice)\b)/i;
const LIST_TAIL = /\s+(?:to|on|in|into)\s+(?:my\s+)?(?:list|plan|tasks?|to-?do(?: list)?)$/i;
const ASK_TITLE = 'What should the task say? Try "add fix login bug tomorrow high".';
// Fake bank phrases. "add N to bank" must die here, or ADD_RE turns it into a task.
const BANK_DEP_RE = /^(?:deposit\s+\$?\s*([\d,]+)|(?:add|put)\s+\$?\s*([\d,]+)\s*(?:dollars?|bucks?)?\s*(?:(?:to|into|in)\s+(?:the\s+|my\s+)?)?(?:bank|account|wallet))\s*$/i;
const BANK_WD_RE = /^(?:withdraw\s+\$?\s*([\d,]+)\s*(?:dollars?|bucks?)?\s*(?:(?:from|of)\s+(?:the\s+|my\s+)?)?(?:bank|account|wallet)?|(?:take(?:\s+out)?|remove|subtract)\s+\$?\s*([\d,]+)(?:\s+out)?\s*(?:dollars?|bucks?)?\s*(?:from|of)\s+(?:the\s+|my\s+)?(?:bank|account|wallet))\s*$/i;
const say = (reply, actions = []) => ({ reply, actions });
const GREET_RE = /^(?:(?:well|hey|hi|oh|ok|okay|so)\s+)*(?:hi+|hello+|hullo|ello|hey+(?: (?:hey|there|bro|man|buddy|dude|jaltron|whats up|what's up))?|heya|hiya|yo+(?: yo)?|ayo+|ay+|oi|sup|wsp|wsup|wsg|wassup|wazzup|whaddup|whats up|what's up|what is up|whats good|whats going on|howdy(?: partner)?|hola|ciao|bonjour|namaste|namaskar|salaam|greetings|salutations|g'day|gm|morning|evening|afternoon|good (?:morning|afternoon|evening|night)|how (?:are|r) (?:you|u)(?: doing)?|hru|how you doing|how is it going|hows it going|wyd|what are you up to|long time no see|nice to meet you|anyone there|(?:are )?you there|ping)(?: (?:there|bro|man|buddy|dude|mate|jaltron|partner|everyone|all|today))*$/;

function respond(msg, tasksIn, history) {
  const tasks = (Array.isArray(tasksIn) ? tasksIn : []).slice(0, 500).map(clean).filter(t => t.title);
  const open = tasks.filter(t => !t.done).sort((a, b) => score(b) - score(a));
  const raw0 = String(msg || '').trim().replace(/[.!?]+$/, ''), l0 = raw0.toLowerCase();
  let m = stripLead(raw0) || raw0;
  let l = m.toLowerCase();
  let r;

  if (!m) return say('Ask me something, for example "plan my day".');
  const hist = Array.isArray(history) ? history : [];
  let lastAi = '';
  for (let i = hist.length - 2; i >= 0; i--) if (hist[i] && hist[i].role === 'assistant') { lastAi = String(hist[i].content); break; }
  if (/^(?:cancel|never ?mind|forget it|no)$/.test(l) && /^(What should the task|This will delete all)/.test(lastAi)) return say('Okay, cancelled.');
  if (/^(?:yes|y|confirm|do it|sure)$/.test(l) && /^This will delete all/.test(lastAi)) return say('All tasks deleted.', [{ type: 'clear_all' }]);
  const pendingAdd = /^What should the task/.test(lastAi) && l.split(/\s+/).length <= 10 && !/^(plan|show|what|how|summary|help|overdue|break|optimi|complete|delete)/.test(l);
  // Follow-up: "what about friday?" reuses the previous question when it was about due/plan
  const fm = l.match(/^(?:ok(?:ay)?\s+)?(?:and\s+)?(?:what|how) about\s+(.+)$/) || l.match(/^(?:ok(?:ay)?\s+)?and\s+(.+)$/);
  if (fm && !ADD_RE.test(m) && /^(tomorrow|today|tonight|this week|next week|next month|this weekend|the weekend|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/.test(fm[1].trim())) {
    const lastUser = [...hist].reverse().find(h => h && h.role === 'user' && String(h.content).trim() !== raw0);
    if (lastUser && /\b(?:due|overdue|plan|streak|summary|first|what should|what about|and)\b/.test(String(lastUser.content).toLowerCase())) {
      m = 'what is due ' + fm[1].trim(); l = m;
    }
  }
  if (GREET_RE.test(l0.replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim()) && l0.split(/\s+/).length <= 6) {
    const open1 = open[0] ? ` You have ${open.length} open task${open.length > 1 ? 's' : ''}, and "${open[0].title}" is up first.` : ' Your plan is empty, so tell me what to add.';
    if (/how (are|r) (you|u)|hru|how is it going|hows it going|how you doing/.test(l0)) return say('Doing great, thanks for asking!' + open1);
    if (/what are you up to|wyd/.test(l0)) return say('Just keeping your plan in order.' + open1);
    if (/(anyone|you|are you) there|ping/.test(l0)) return say('I am here.' + open1);
    if (/good night/.test(l0)) return say('Good night! Rest well, your plan will be here tomorrow.');
    const hr = new Date().getHours(), part = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const g = [part + '!', 'Hey!', 'Yo!', 'Howdy!', 'Hey there!', 'Hello!'];
    return say(g[Math.floor(Math.random() * g.length)] + open1 + ' Say "what can you do" for the full list.');
  }

  // Fake bank: matched before the task verbs so "add 50 to bank" moves money, not a new task
  if (window.Bank && (BANK_DEP_RE.test(m) || BANK_WD_RE.test(m) || /\bbalance\b|\bhow much money\b|\bmy money\b/.test(l))) {
    if (!window.DB || !DB.user) return say('The fake bank needs an account. Sign in with Google first.');
    const dep = m.match(BANK_DEP_RE), wd = dep ? null : m.match(BANK_WD_RE);
    if (dep || wd) {
      const n = Number(((dep || wd)[1] || (dep || wd)[2] || '').replace(/,/g, ''));
      if (!n || n > 1e6) return say('Give me a whole number from 1 to 1,000,000, like "add 50 to bank".');
      return say(`${dep ? 'Added' : 'Withdrew'} $${n.toLocaleString()} ${dep ? 'to' : 'from'} your fake bank.`, [{ type: dep ? 'deposit' : 'withdraw', n }]);
    }
    const s = Bank.snapshot();
    return say(`Your fake bank holds ${s.mine}.${s.pot ? ` A workspace pot you are in holds ${s.pot}.` : ''} Say "add 50 to bank" or "withdraw 20" to move money.`);
  }

  if (/\b(clear|remove|delete)\b.*\b(completed|done|finished)\b/.test(l)) {
    const n = tasks.filter(t => t.done && !t.r).length;
    return n ? say(`Cleared ${n} completed task${n > 1 ? 's' : ''}. Repeating tasks are kept.`, [{ type: 'clear_done' }]) : say('There are no completed tasks to clear.');
  }
  if ((r = m.match(/^(?:please\s+)?(?:make|set|change|mark)\s+(.+?)\s+(?:as\s+|to\s+)?(high|medium|low)(?:\s+priority)?$/i))) {
    const t = find(tasks, r[1]);
    return t ? say(`Set "${t.title}" to ${r[2].toLowerCase()} priority.`, [{ type: 'prio', id: t.id, prio: r[2].toLowerCase() }]) : say(`I could not find a task matching "${r[1]}".`);
  }
  if (/^(?:complete|finish|mark)\s+(?:all|everything)(?:\s+tasks?)?(?:\s+(?:as\s+)?(?:done|complete|completed))?$/.test(l))
    return open.length ? say(`Marked all ${open.length} open tasks as done.`, [{ type: 'complete_all' }]) : say('Nothing is open right now.');
  if ((r = m.match(/^(?:complete|finish|check off|mark)\s+(?:all|every)\s+(.+)$/i)) && catOf(r[1].replace(/\s*(?:open\s+)?tasks?$/, ''))) {
    const c = catOf(r[1].replace(/\s*(?:open\s+)?tasks?$/, ''));
    const list = open.filter(t => t.tag === c);
    return list.length ? say(`Marked ${list.length} ${c} task${list.length > 1 ? 's' : ''} as done.`, list.map(t => ({ type: 'complete', id: t.id }))) : say(`No open ${c} tasks.`);
  }
  if (/^(?:delete|remove|clear|wipe)\s+(?:all|everything)(?:\s+(?:my\s+)?tasks?)?$/.test(l))
    return tasks.length ? say(`This will delete all ${tasks.length} tasks. Reply "yes" to confirm.`) : say('Your plan is already empty.');
  if (/^(?:undo(?: that| this| the (?:last )?(?:delete|deletion|removal))?|bring back (?:the |my )?(?:last )?deleted task|restore (?:the |my )?deleted task|put (?:it|that) back)$/.test(l)
    || (/\bundo\b/.test(l) && /\b(?:delete|deleted|removal|removed)\b/.test(l))) {
    if (window.jaltron && jaltron.hasDeleted && !jaltron.hasDeleted()) return say('There is nothing to undo right now.');
    return say('Put your last deleted task back.', [{ type: 'undo' }]);
  }
  if ((r = m.match(/^(?:reopen|uncheck|restore)\s+(.+)$/i))) {
    const t = find(tasks.filter(x => x.done), r[1]);
    return t ? say(`Reopened "${t.title}".`, [{ type: 'reopen', id: t.id }]) : say(`I could not find a completed task matching "${r[1]}".`);
  }
  if ((r = m.match(/^(?:rename|change)\s+(.+?)\s+to\s+(.+)$/i))) {
    const t = find(tasks, r[1]);
    return t ? say(`Renamed "${t.title}" to "${cap(r[2].trim())}".`, [{ type: 'rename', id: t.id, title: cap(r[2].trim()) }]) : say(`I could not find a task matching "${r[1]}".`);
  }
  if ((r = m.match(/^(?:tag|categori[sz]e|move|set)\s+(.+?)\s+(?:as|to|under|category)\s+(.+)$/i)) && catOf(r[2])) {
    const t = find(tasks, r[1]), c = catOf(r[2]);
    return t ? say(`Moved "${t.title}" to ${c}.`, [{ type: 'tag', id: t.id, tag: c }]) : say(`I could not find a task matching "${r[1]}".`);
  }
  if ((r = m.match(/^(?:snooze|postpone|push)\s+(.+?)(?:\s+(?:to|until|till|on)\s+(.+))?$/i)) && (!r[2] || !catOf(r[2]))) {
    const t = find(open, r[1]) || find(tasks, r[1]);
    if (!t) return say(`I could not find a task matching "${r[1]}".`);
    if (r[2]) {
      const due = parseTask(r[2]).due;
      return due ? say(`"${t.title}" moved to ${due}.`, [{ type: 'due', id: t.id, due }]) : say('I could not read that date. Try "snooze login to friday".');
    }
    return say(`Snoozed "${t.title}" by 3 days (now ${dateStr(3)}).`, [{ type: 'due', id: t.id, due: dateStr(3) }]);
  }
  if ((r = m.match(/^(?:move|reschedule|delay)\s+(.+?)\s+(?:to|until|till|for|by|on)\s+(.+)$/i))) {
    const t = find(tasks, r[1]), due = parseTask(r[2]).due;
    if (!t) return say(`I could not find a task matching "${r[1]}".`);
    return due ? say(`"${t.title}" is now due ${due}.`, [{ type: 'due', id: t.id, due }]) : say('I could not read that date. Try "tomorrow", "friday", "in 3 days" or 2026-10-20.');
  }
  if ((r = m.match(/^(?:find|search(?:\s+for)?|look\s+for)\s+(.+)$/i))) return say(`Showing tasks matching "${r[1]}".`, [{ type: 'search', q: r[1] }]);
  if (/^(?:clear|reset)\s+(?:the\s+)?(?:filters?|search)$/.test(l)) return say('Filters cleared.', [{ type: 'filter', status: 'all', cat: 'all' }, { type: 'search', q: '' }]);
  if (/^(thanks|thank you|thx|ty)\b/.test(l)) return say('Anytime. Tell me when you want the next step.');

  if (/\b(?:streaks?|habits?)\b/.test(l) && !/\b(?:how|explain|what is|why)\b/.test(l) && !ADD_RE.test(m)) {
    const hs = tasks.filter(t => t.r).map(t => ({ t, s: window.Habit ? Habit.streak(t) : t.s })).sort((a, b) => b.s - a.s);
    if (!hs.length) return say('You have no repeating tasks yet. Try \"add gym daily\" or \"add read every weekday\".');
    return say('Your streaks:\n' + hs.slice(0, 6).map(x => `- ${x.t.title}: ${x.s} in a row (best ${Math.max(x.t.b, x.s)})`).join('\n'));
  }
  // Focus must win over the greedy add pattern ("lets focus on math" is not a new task).
  if ((r = m.match(/^(?:please\s+)?(?:(?:lets|let'?s)\s+|(?:i'?m|i\s+will|i'?ll)\s+(?:going\s+to\s+)?)?(?:start\s+(?:a\s+)?focus(?:\s+session)?(?:\s+(?:on|for|with))?|start\s+(?:working|focusing)\s+on|focus(?:\s+(?:on|for))?|work\s+on|begin\s+(?:working|focusing)\s+on)\s+(.+)$/i))) {
    const t = find(open, r[1]);
    return t ? say(`Focus mode: "${t.title}". The timer is ready on the Focus page.`, [{ type: 'focus', id: t.id }]) : say(`I could not find an open task matching "${r[1]}".`);
  }
  if ((r = m.match(ADD_RE)) || pendingAdd) {
    const text = (r ? r[1] : m).replace(LIST_TAIL, '').trim();
    if (!text || /^(?:a\s+|new\s+)?tasks?$/i.test(text)) return say(ASK_TITLE);
    const added = text.split(SPLIT_RE).filter(x => x && x.trim().length > 1).slice(0, 8).map(parseTask).filter(p => p.title);
    if (!added.length) return say(ASK_TITLE);
    const REPW = { d: 'daily', wd: 'on weekdays', we: 'on weekends', w: 'weekly' };
    const fmt = (p) => `"${p.title}" (${p.prio}, ${p.tag}${p.due ? ', due ' + p.due : ''}${p.rep ? ', repeats ' + REPW[p.rep] : ''})`;
    return say(added.length === 1 ? `Added ${fmt(added[0])}.` : `Added ${added.length} tasks:\n` + added.map(p => '- ' + fmt(p)).join('\n'), added.map(p => ({ type: 'add', ...p })));
  }
  if ((r = m.match(/^(?:please\s+)?(?:i\s+)?(?:complete|completed|finish|finished|done with|check off|tick off|mark)\s+(.+?)(?:\s+(?:as\s+)?(?:done|complete|completed|finished))?$/i))) {
    const t = find(open, r[1]) || find(tasks, r[1]);
    if (!t) return say(`I could not find a task matching "${r[1]}".`);
    if (t.done) return say(`"${t.title}" is already done.`);
    const st = t.r && window.Habit ? Habit.streak(t) : 0;
    const cheer = t.r ? (t.l === dateStr(0) ? ` Streak holding at ${st}.` : st ? ` That makes ${st + 1} in a row.` : ' First one — streak started.') : '';
    return say(`Marked "${t.title}" as done. Nice work.${cheer}`, [{ type: 'complete', id: t.id }]);
  }
  if ((r = m.match(/^(?:please\s+)?(?:delete|remove|drop|cancel)\s+(.+)$/i))) {
    const t = find(tasks, r[1]);
    return t ? say(`Deleted "${t.title}".`, [{ type: 'delete', id: t.id }]) : say(`I could not find a task matching "${r[1]}".`);
  }
  if (/^(?:please\s+|can you\s+|go\s+)?(?:optimi[sz]e|re-?order|re-?sort|organi[sz]e|sort)\b/.test(l))
    return say('Optimized your plan by priority, deadlines and category.', [{ type: 'optimize' }]);
  if ((r = l.match(/^(?:show|filter)\s+(?:me\s+)?(?:only\s+)?(?:the\s+)?(.+?)(?:\s+tasks?)?$/)) && catOf(r[1]))
    return say('Done. Filter updated.', [{ type: 'filter', cat: catOf(r[1]) }]);
  if ((r = l.match(/^show\s+(?:me\s+)?(?:only\s+)?(?:the\s+)?(all|everything|pending|active|open|completed|done|finished|bugs?|dev|study|general)\b/))) {
    const k = r[1];
    const a = /^(all|everything)$/.test(k) ? { type: 'filter', status: 'all', cat: 'all' }
      : /^(pending|active|open)$/.test(k) ? { type: 'filter', status: 'pending' }
      : /^(completed|done|finished)$/.test(k) ? { type: 'filter', status: 'done' }
      : { type: 'filter', cat: k.startsWith('bug') ? 'Bug' : cap(k) };
    return say('Done. Filter updated.', [a]);
  }

  if (/^(?:summary|stats|overview|status)\b/.test(l) || /\b(?:progress|status of my|my (?:progress|status|tasks|stats)|how am i doing|how'?s my day|how r we doing|where do i stand|how many (?:tasks?|are (?:left|done))|how much have i done|am i making progress)\b/.test(l)) {
    const done = tasks.filter(t => t.done).length, late = open.filter(t => t.due && days(t.due) < 0).length;
    return say(`You have ${tasks.length} tasks: ${open.length} open, ${done} done (${tasks.length ? Math.round(done / tasks.length * 100) : 0}%). ${open.filter(t => t.prio === 'high').length} high priority, ${late} overdue.` + (open[0] ? ` Next up: "${open[0].title}".` : ''));
  }
  if (/\bdue\b/.test(l) && /^(?:what|which|anything|any|show|list|tasks)/.test(l)) {
    const winM = l.match(/\b(tomorrow|today|tonight|this week|next week|next month|this weekend|the weekend|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (winM) {
      const w = winM[1], dow = new Date().getDay();
      const within = (t) => { const d = days(t.due); if (/tomorrow/.test(w)) return d === 1; if (/today|tonight/.test(w)) return d <= 0; if (/weekend/.test(w)) return d >= 0 && d <= dowOff(6); const i = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(w); if (i >= 0) { const off = ((i - dow + 7) % 7) || 7; return d >= 0 && d <= off; } return d <= 7; };
      const lst = open.filter(t => t.due && within(t));
      return say(lst.length ? 'Due:\n' + lst.map(t => `- ${t.title} (${t.due})`).join('\n') : 'Nothing is due in that window.');
    }
  }
  if (/\b(overdue|late|behind)\b/.test(l)) {
    const late = open.filter(t => t.due && days(t.due) < 0);
    return say(late.length ? 'Overdue:\n' + late.map(t => `- ${t.title} (${-days(t.due)}d late)`).join('\n') : 'Nothing is overdue. Nice.');
  }
  // What got finished in the last 7 days
  if (/\b(?:week recap|last 7 days|past 7 days|past week)\b/.test(l) || /^(?:what did i|what have i)\s+(?:done|finish|get done|accomplish|complete)/.test(l)) {
    const since = dateStr(-6);
    const done7 = tasks.filter(t => t.done && ((t.z && t.z >= since) || (t.l && t.l >= since)));
    if (!done7.length) return say('No completions in the last 7 days. Want to change that? Say "rescue my week".');
    const byTag = {};
    done7.forEach(t => byTag[t.tag] = (byTag[t.tag] || 0) + 1);
    const top = Object.entries(byTag).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ');
    return say(`Last 7 days: ${done7.length} done (${top}).\n` + done7.slice(0, 8).map(t => `- ${t.title}`).join('\n'));
  }
  // Overwhelmed / behind: concrete rescue plan with a focus jump to the first target
  if (/\b(?:rescue my week|help me catch up|so behind|i'?m drowning|drowning in tasks)\b/.test(l)) {
    if (!open.length) return say('Your plan is empty, so there is nothing to rescue. Add the 1-3 things that matter most this week.');
    const late = open.filter(t => t.due && days(t.due) < 0);
    const highs = open.filter(t => t.prio === 'high' && !late.includes(t));
    const lines = [];
    if (late.length) lines.push(`1. Stop the bleeding: ${late.length} overdue — start "${late[0].title}" (${why(late[0])}).`);
    if (highs.length) lines.push(`${lines.length + 1}. Protect your highs: ${highs.slice(0, 3).map(t => `"${t.title}"`).join(', ')}.`);
    lines.push(`${lines.length + 1}. Push or drop the rest: "snooze X to friday" or "delete X".`);
    const first = late[0] || highs[0];
    return say('Rescue plan:\n' + lines.join('\n'), first ? [{ type: 'focus', id: first.id }] : []);
  }
  // Radar: habits due today that are not done + overdue one-offs
  if (/\b(?:what am i forgetting|anything i missed|what needs attention|what am i missing)\b/.test(l)) {
    const today = dateStr(0);
    const habits = open.filter(t => t.r && scheduled(t) && t.l !== today).sort((a, b) => b.s - a.s);
    const late = open.filter(t => !t.r && t.due && days(t.due) < 0);
    if (!habits.length && !late.length) return say('All clear: nothing overdue and every habit is done for today.');
    const lines = [...habits.map(t => `- "${t.title}" keeps your ${Math.max(t.s, 1)}-day streak`), ...late.map(t => `- "${t.title}" is ${-days(t.due)}d overdue`)];
    return say('Heads up:\n' + lines.join('\n'));
  }
  // Explain the ranking of one task (falls through when no task matches, so general why-questions still redirect)
  if ((r = m.match(/^(?:why(?: is| was)?|how come)\s+(.+?)(?:\s+(?:is |was )?(?:first|next|up first|ranked so high|so important))?\??$/i)) || (r = m.match(/^(?:why did you|how did you)\s+(?:pick|choose|rank)\s+(.+?)\??$/i))) {
    const t = find(open, r[1]);
    if (t) return say(`"${t.title}" ranks #${open.indexOf(t) + 1} of ${open.length} because: ${why(t)}. I score priority x10, then deadline pressure (overdue weighs most), plus a bug bonus.`);
  }
  if ((r = m.match(/^(?:show|list)\s+(?:me\s+)?(?:all\s+)?(high|medium|low)(?:\s+priority)?\s*(?:tasks?)?$/)) || (r = l.match(/^what(?:'s| is)\s+(?:my\s+)?(high|medium|low)\s+priority\b/))) {
    const list = open.filter(t => t.prio === r[1]);
    return say(list.length ? `${cap(r[1])} priority:\n` + list.map(t => `- ${t.title}${t.due ? ` (${t.due})` : ''}`).join('\n') : `No open ${r[1]} priority tasks.`);
  }
  const TIPS = [
    [/procrastinat|keep putting off|can'?t start|cant start|avoiding/, 'Start absurdly small: open the task and work on it for 5 minutes. Starting is the hard part — momentum handles the rest.'],
    [/overwhelm|too much|so much to do/, 'Shrink today to 3 must-dos. Say "plan my day" and I will pick them for you.'],
    [/can'?t focus|distracted|concentrat/, 'One task, one timer: say "focus on <task>" and stay on it until the timer ends.'],
    [/tired|exhausted|no energy|burn(?:ed|t)? ?out/, 'Take the easiest open task first to bank a win, then reassess. The plan keeps; protect your energy.'],
    [/motivat|inspire|encourage|give up|quitting|a tip|advice/, 'You have cleared tasks before — this list is beatable. One task now keeps the streak alive; small daily wins compound.']
  ];
  if (TIPS.some(([re]) => re.test(l)) && /^(?:i|i'?m|im|i feel|help|i need|motivate|give|can'?t|cant|so)\b/.test(l))
    return say(TIPS.find(([re]) => re.test(l))[1]);
  if (/\b(break|split|steps|how (do|to) i (finish|do))\b/.test(l)) {
    const named = find(open, l.replace(/.*?\b(?:break down|break|split|steps (?:for|to))\b/, ''));
    const t = named || open[0];
    return t ? say(`To finish "${t.title}":\n` + (STEPS[t.tag] || STEPS.General).map((s, i) => `${i + 1}. ${s}`).join('\n')) : say('Add a task first and I will break it down.');
  }
  if (/^(?:start|begin)\s+(?:a\s+)?focus(?:\s+session)?$/.test(l)) {
    return open.length ? say(`Focus mode: "${open[0].title}". The timer is ready on the Focus page.`, [{ type: 'focus', id: open[0].id }]) : say('Add a task first and I will start a focus session on it.');
  }
  if (/^(?:what(?:'s| is)?(?: the| today'?s)? (?:date|day)(?: today)?|what day is (?:it|today)|whats todays date)$/.test(l))
    return say('Today is ' + new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.');
  if (/^(?:plan|schedule|organi[sz]e|todo|to-do)\b/.test(l)
    || /\b(?:my (?:day|plan|agenda|tasks|schedule|list|plate)|the plan|game plan|best order)\b/.test(l)
    || /^(?:what should i (?:do|get done) today|how should i spend (?:today|my day)|what do i have to do|help me get organised|make me a schedule|map out (?:my day|tomorrow))\b/.test(l))
    return open.length ? say('Suggested order:\n' + open.slice(0, 5).map((t, i) => `${i + 1}. ${t.title} (${why(t)})`).join('\n')) : say('Your plan is empty. Add a task and I will plan around it.');
  if (/^(?:do|what should i do|what do i|what to do|what'?s next|what is next|what is most important|what is my next|which (?:task|one)|where (?:do|should) i|top priority|pick a task|tell me what to work on|what deserves my attention|what should i focus on)\b/.test(l)
    || /\b(?:do first|first task|next task|highest priority|most urgent thing|attention first)\b/.test(l))
    return open.length ? say(`Do this first: "${open[0].title}" (${why(open[0])}).` + (open[1] ? `\nThen: "${open[1].title}".` : '')) : say('Your plan is empty. Add a task and I will tell you what to do first.');
  if (/\b(help|what can you|commands|features|how do you work)\b/.test(l))
    return say('I can:\n- add tasks: "add fix login bug tomorrow high", "add exam prep friday urgent", or several at once with commas\n- complete / reopen / delete: "complete login", "complete all", "complete all study", "delete old task"\n- undo a delete: "undo"\n- edit: "rename login to fix auth", "move login to friday", "snooze login" (3 days), "make login low", "tag docs as study"\n- focus: "focus on login" (opens the Focus page with that task ready)\n- find and filter: "find login", "show pending", "show high priority", "clear filters"\n- plan and think: "plan my day", "what\'s due today", "what about friday?", "summary", "overdue"\n- dig deeper: "break down login", "why is login first", "what did I finish this week", "what am I forgetting", "rescue my week", "show my streaks"\n- calculate offline: "15% of 200", "5 km to miles", "days until 2026-12-25", "tip on 42.50", "bmi 70 1.75", "what time is it"\n- general offline: "flip a coin", "roll 2d6", "pick pizza or sushi", "average 4 8 15 16", "sqrt 144", "is 2028 a leap year", "what day is 2026-12-25", "time in tokyo", "tell me a joke", "random fact", "how many words in: ..."\n- repeat: "add gym daily", "add read every weekday"\n- stuck? "motivate me"\n- explain the site: drag, edit, themes, saving, status\n- anything else: turn on Universal mode in the sidebar with your own API key');
  // A general question must not borrow a loose FAQ keyword ("dark matter" is not the theme setting)
  const siteWord = /\b(?:jaltron|task|tasks|todo|to-do|list|plan|schedule|overdue|priority|balance|streak|habit|repeat|recurring|theme|dark mode|light mode|save|storage|sync|sign in|account|status|online|offline|drag|edit|rename|search|shortcut|keyboard|undo|delete|category|tags?|due date|deadline|timer|focus|summary)\b/;
  const worldQ = (/^(?:who|what|where|when|why|which)\b/.test(l) || /^how (?:tall|far|old|big|long|heavy|deep|high|many|much|does|did|was|were|is)\b/.test(l))
    && !siteWord.test(l)
    && !/^(?:what (?:can|do) you|who are you|how are you|what is your|whats your|what'?s your|who is your|who'?s your|what is my|what is jaltron|what are you|how do you work|how old are you)\b/.test(l);
  if (worldQ) {
    const uni = window.JaltronAI && JaltronAI.universal && JaltronAI.universal();
    return Object.assign(say(uni
      ? 'Universal mode is on, but the model did not answer. Check the URL and key in Universal mode settings, or try an offline skill: "15% of 200", "time in tokyo", "flip a coin".'
      : 'I do tasks, math, units, dates and random picks offline. For everything else, turn on Universal mode in the AI page sidebar with your own API key and ask me anything.'), { unknown: true });
  }
  for (const [re, ans] of FAQ) if (re.test(l)) return say(typeof ans === 'function' ? ans() : ans);

  return Object.assign(say(window.JaltronAI && JaltronAI.universal && JaltronAI.universal()
    ? 'Universal mode could not answer that and my offline skills do not cover it either. Check your URL and key in the Universal mode panel, or try "help".'
    : 'I did not get that. I handle tasks, math, units, dates and random picks: try "add physics exam tomorrow urgent", "plan my day", "summary" or "15% of 200". You can also turn on Universal mode (AI page sidebar) to ask anything.'), { unknown: true });
}

const api = { respond, clean, parseTask, find };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else window.Brain = api;
})();

// ===== 2. JALTRONAI =====
(function (root) {
  'use strict';
  // ---- Local skills: units, dates, money and health, all offline ----
  const U = {
    mm: ['length', 0.001], cm: ['length', 0.01], m: ['length', 1], km: ['length', 1000], in: ['length', 0.0254], ft: ['length', 0.3048], yd: ['length', 0.9144], mi: ['length', 1609.344],
    mg: ['mass', 1e-6], g: ['mass', 0.001], kg: ['mass', 1], lb: ['mass', 0.45359237], oz: ['mass', 0.028349523125], t: ['mass', 1000],
    ml: ['volume', 0.001], l: ['volume', 1], cup: ['volume', 0.2365882365], pt: ['volume', 0.473176473], qt: ['volume', 0.946352946], gal: ['volume', 3.785411784],
    kb: ['data', 1024], mb: ['data', 1048576], gb: ['data', 1073741824], tb: ['data', 1099511627776],
    m2: ['area', 1], km2: ['area', 1e6], ft2: ['area', 0.09290304], acre: ['area', 4046.8564224], ha: ['area', 10000],
    mph: ['speed', 0.44704], kmh: ['speed', 1 / 3.6], 'm/s': ['speed', 1],
    s: ['time', 1], min: ['time', 60], h: ['time', 3600], day: ['time', 86400], week: ['time', 604800]
  };
  const UALIAS = { kilometer: 'km', kilometre: 'km', kilometers: 'km', kilometres: 'km', meter: 'm', metre: 'm', meters: 'm', metres: 'm', centimeter: 'cm', centimetre: 'cm', centimeters: 'cm', centimetres: 'cm', millimeter: 'mm', millimetre: 'mm', millimeters: 'mm', millimetres: 'mm', mile: 'mi', miles: 'mi', foot: 'ft', feet: 'ft', inch: 'in', inches: 'in', yard: 'yd', yards: 'yd', pound: 'lb', pounds: 'lb', ounce: 'oz', ounces: 'oz', gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg', tonne: 't', tonnes: 't', liter: 'l', litre: 'l', liters: 'l', litres: 'l', milliliter: 'ml', millilitre: 'ml', milliliters: 'ml', millilitres: 'ml', gallon: 'gal', gallons: 'gal', quart: 'qt', quarts: 'qt', pint: 'pt', pints: 'pt', cup: 'cup', cups: 'cup', kilobyte: 'kb', kilobytes: 'kb', megabyte: 'mb', megabytes: 'mb', gigabyte: 'gb', gigabytes: 'gb', terabyte: 'tb', terabytes: 'tb', acre: 'acre', acres: 'acre', hectare: 'ha', hectares: 'ha', kph: 'kmh' };
  const unit = (x) => { x = String(x || '').toLowerCase().replace(/\s+/g, '').replace('²', '2'); return UALIAS[x] || x; };
  const rnd = (x) => { const a = Math.abs(x); return a >= 1e6 || (a > 0 && a < 0.001) ? +x.toExponential(3) : Math.round(x * 1e4) / 1e4; };
  const money = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const DAY = 864e5;
  const isoDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3]); return isNaN(d) ? null : d; };
  const dayDiff = (a, b) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / DAY);
  const fmtDate = (d) => d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  function localSkill(text) {
    const t = String(text || '').trim(), l = t.toLowerCase();
    let m;
    if (/^(?:what(?:'s| is)?(?: the)?(?: current)? time(?: is it| now)?|current time|time now)$/.test(l))
      return { reply: 'It is ' + new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) + '.', actions: [] };
    if ((m = l.match(/^(?:what(?:'s| is) )?(?:a )?(\d+(?:\.\d+)?)\s*%?\s*tip(?: on)?\s*\$?(\d+(?:\.\d+)?)$/))) {
      const p = +m[1], a = +m[2], tip = a * p / 100;
      return { reply: `A ${p}% tip on ${money(a)} is ${money(tip)}, total ${money(a + tip)}.`, actions: [] };
    }
    if ((m = l.match(/^tip\s*(\d+(?:\.\d+)?)\s*%\s*on\s*\$?(\d+(?:\.\d+)?)$/))) {
      const p = +m[1], a = +m[2], tip = a * p / 100;
      return { reply: `A ${p}% tip on ${money(a)} is ${money(tip)}, total ${money(a + tip)}.`, actions: [] };
    }
    if ((m = l.match(/^tip(?: on)?\s*\$?(\d+(?:\.\d+)?)(?:\s+at\s+(\d+(?:\.\d+)?)%)?$/))) {
      const a = +m[1], p = m[2] ? +m[2] : 15, tip = a * p / 100;
      return { reply: `A ${p}% tip on ${money(a)} is ${money(tip)}, total ${money(a + tip)}.`, actions: [] };
    }
    if ((m = l.match(/^(?:what(?:'s| is) )?(\d+(?:\.\d+)?)\s*%?\s*off\s*\$?(\d+(?:\.\d+)?)$/))) {
      const p = +m[1], a = +m[2], d = a * p / 100;
      return { reply: `${p}% off ${money(a)} is ${money(d)} off, so ${money(a - d)}.`, actions: [] };
    }
    if ((m = l.match(/^(?:loan|mortgage)\s*\$?(\d+(?:\.\d+)?)\s*(?:at\s*)?(\d+(?:\.\d+)?)\s*%\s*(?:for\s*)?(\d+)\s*(?:years?|yrs?)$/))) {
      const P = +m[1], r = +m[2] / 1200, n = +m[3] * 12;
      const pay = r ? P * r / (1 - Math.pow(1 + r, -n)) : P / n;
      return { reply: `Loan ${money(P)} at ${m[2]}% for ${m[3]} years: ${money(pay)}/month, total ${money(pay * n)} (${money(pay * n - P)} interest).`, actions: [] };
    }
    if ((m = l.match(/^compound\s*\$?(\d+(?:\.\d+)?)\s*(?:at\s*)?(\d+(?:\.\d+)?)\s*%\s*(?:for\s*)?(\d+)\s*(?:years?|yrs?)$/))) {
      const P = +m[1], A = P * Math.pow(1 + +m[2] / 100, +m[3]);
      return { reply: `${money(P)} at ${m[2]}% compounded yearly is ${money(A)} after ${m[3]} years (${money(A - P)} interest).`, actions: [] };
    }
    if ((m = l.match(/^bmi\s*(\d+(?:\.\d+)?)\s*(?:kg)?\s+(\d+(?:\.\d+)?)\s*(cm|m)?$/))) {
      const kg = +m[1], h = m[3] === 'cm' ? +m[2] / 100 : +m[2];
      if (kg && h) {
        const b = kg / (h * h), c = b < 18.5 ? 'underweight' : b < 25 ? 'normal' : b < 30 ? 'overweight' : 'obese';
        return { reply: `BMI: ${b.toFixed(1)} (${c}).`, actions: [] };
      }
    }
    if ((m = l.match(/^(?:how many )?days (?:until|till|to) (\d{4}-\d{2}-\d{2})$/))) {
      const d = isoDate(m[1]);
      if (d) return { reply: `${dayDiff(new Date(), d)} days until ${fmtDate(d)}.`, actions: [] };
    }
    if ((m = l.match(/^(?:how many )?days (?:since|between) (\d{4}-\d{2}-\d{2})(?: and (\d{4}-\d{2}-\d{2}))?$/))) {
      const a = isoDate(m[1]), b = m[2] ? isoDate(m[2]) : new Date();
      if (a && b) return { reply: `${Math.abs(dayDiff(a, b))} days ${m[2] ? 'between those dates' : 'since ' + fmtDate(a)}.`, actions: [] };
    }
    if ((m = l.match(/^(?:what(?:'s| is) )?(?:the )?date (?:in|after) (\d+) (day|week|month)s?$/)) || (m = l.match(/^(?:what(?:'s| is) )?(?:the )?date (\d+) (day|week|month)s? (?:from now|from today)$/)) || (m = l.match(/^(\d+) (day|week|month)s? from now$/))) {
      const d = new Date(), n = +m[1], u = m[2];
      if (u === 'day') d.setDate(d.getDate() + n); else if (u === 'week') d.setDate(d.getDate() + n * 7); else d.setMonth(d.getMonth() + n);
      return { reply: `${n} ${u}${n === 1 ? '' : 's'} from now is ${fmtDate(d)}.`, actions: [] };
    }
    if ((m = l.match(/^(\d+) (day|week|month)s? ago$/))) {
      const d = new Date(), n = +m[1], u = m[2];
      if (u === 'day') d.setDate(d.getDate() - n); else if (u === 'week') d.setDate(d.getDate() - n * 7); else d.setMonth(d.getMonth() - n);
      return { reply: `${n} ${u}${n === 1 ? '' : 's'} ago was ${fmtDate(d)}.`, actions: [] };
    }
    if ((m = l.match(/^(?:convert\s+)?(-?\d+(?:\.\d+)?)\s*(?:degrees?\s*)?(c|°c|celsius|f|°f|fahrenheit|k|kelvin)\s*(?:to|in|into)\s*(?:degrees?\s*)?(c|°c|celsius|f|°f|fahrenheit|k|kelvin)$/))) {
      const v = +m[1], f = m[2].replace('°', '')[0], to = m[3].replace('°', '')[0];
      const C = f === 'c' ? v : f === 'f' ? (v - 32) * 5 / 9 : v - 273.15;
      const out = to === 'c' ? C : to === 'f' ? C * 9 / 5 + 32 : C + 273.15;
      return { reply: `${v}°${f.toUpperCase()} = ${rnd(out)}°${to.toUpperCase()}.`, actions: [] };
    }
    if ((m = l.match(/^(?:convert\s+)?(-?\d+(?:\.\d+)?)\s*([a-z°/]+)\s*(?:to|in|into)\s*([a-z°/]+)$/))) {
      const u1 = unit(m[2]), u2 = unit(m[3]), a = U[u1], b = U[u2];
      if (a && b && a[0] === b[0]) return { reply: `${+m[1]} ${u1} = ${rnd(+m[1] * a[1] / b[1])} ${u2}.`, actions: [] };
    }
    if (/\d/.test(l) && /[+\-*/^%]|\b(?:times|plus|minus|divided|squared|percent)\b/.test(l) && root.calcReply) {
      const r = root.calcReply(t);
      if (/^Answer: /.test(r)) return { reply: r, actions: [] };
    }
    return null;
  }

  // ---- Universal offline skills: randomness, quick math, dates, jokes and world clocks ----
  const capW = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  const ZONES = { tokyo: 'Asia/Tokyo', osaka: 'Asia/Tokyo', kyoto: 'Asia/Tokyo', seoul: 'Asia/Seoul', beijing: 'Asia/Shanghai', shanghai: 'Asia/Shanghai', 'hong kong': 'Asia/Hong_Kong', taipei: 'Asia/Taipei', singapore: 'Asia/Singapore', bangkok: 'Asia/Bangkok', jakarta: 'Asia/Jakarta', manila: 'Asia/Manila', 'kuala lumpur': 'Asia/Kuala_Lumpur', delhi: 'Asia/Kolkata', mumbai: 'Asia/Kolkata', kolkata: 'Asia/Kolkata', karachi: 'Asia/Karachi', dhaka: 'Asia/Dhaka', kathmandu: 'Asia/Kathmandu', dubai: 'Asia/Dubai', 'abu dhabi': 'Asia/Dubai', riyadh: 'Asia/Riyadh', doha: 'Asia/Qatar', tehran: 'Asia/Tehran', istanbul: 'Europe/Istanbul', jerusalem: 'Asia/Jerusalem', moscow: 'Europe/Moscow', kyiv: 'Europe/Kyiv', kiev: 'Europe/Kyiv', athens: 'Europe/Athens', helsinki: 'Europe/Helsinki', stockholm: 'Europe/Stockholm', oslo: 'Europe/Oslo', copenhagen: 'Europe/Copenhagen', berlin: 'Europe/Berlin', munich: 'Europe/Berlin', frankfurt: 'Europe/Berlin', paris: 'Europe/Paris', madrid: 'Europe/Madrid', barcelona: 'Europe/Madrid', rome: 'Europe/Rome', milan: 'Europe/Rome', amsterdam: 'Europe/Amsterdam', brussels: 'Europe/Brussels', vienna: 'Europe/Vienna', zurich: 'Europe/Zurich', geneva: 'Europe/Zurich', warsaw: 'Europe/Warsaw', prague: 'Europe/Prague', budapest: 'Europe/Budapest', lisbon: 'Europe/Lisbon', dublin: 'Europe/Dublin', london: 'Europe/London', manchester: 'Europe/London', edinburgh: 'Europe/London', reykjavik: 'Atlantic/Reykjavik', lagos: 'Africa/Lagos', cairo: 'Africa/Cairo', nairobi: 'Africa/Nairobi', johannesburg: 'Africa/Johannesburg', casablanca: 'Africa/Casablanca', 'new york': 'America/New_York', nyc: 'America/New_York', boston: 'America/New_York', washington: 'America/New_York', toronto: 'America/Toronto', montreal: 'America/Toronto', chicago: 'America/Chicago', dallas: 'America/Chicago', houston: 'America/Chicago', denver: 'America/Denver', phoenix: 'America/Phoenix', 'los angeles': 'America/Los_Angeles', seattle: 'America/Los_Angeles', 'san francisco': 'America/Los_Angeles', vancouver: 'America/Vancouver', anchorage: 'America/Anchorage', honolulu: 'Pacific/Honolulu', 'mexico city': 'America/Mexico_City', bogota: 'America/Bogota', lima: 'America/Lima', caracas: 'America/Caracas', santiago: 'America/Santiago', 'sao paulo': 'America/Sao_Paulo', 'buenos aires': 'America/Argentina/Buenos_Aires', montevideo: 'America/Montevideo', sydney: 'Australia/Sydney', melbourne: 'Australia/Melbourne', brisbane: 'Australia/Brisbane', perth: 'Australia/Perth', adelaide: 'Australia/Adelaide', auckland: 'Pacific/Auckland', fiji: 'Pacific/Fiji' };
  const JOKES = [
    'Why do programmers prefer dark mode? Because light attracts bugs.',
    'I told my computer I needed a break, and it said: "No problem, I\'ll go to sleep."',
    'Why did the developer go broke? He used up all his cache.',
    'There are 10 types of people: those who understand binary and those who don\'t.',
    'I would tell you a UDP joke, but you might not get it.',
    'Why did the scarecrow win an award? He was outstanding in his field.'
  ];
  const FACTS = [
    'Honey never spoils — archaeologists have tasted 3,000-year-old honey from Egyptian tombs.',
    'Octopuses have three hearts and blue blood.',
    'A day on Venus is longer than its year: it spins once every 243 Earth days but orbits the Sun in 225.',
    'Bananas are berries; strawberries are not.',
    'The Eiffel Tower can grow about 15 cm taller on hot summer days.',
    'Sharks existed before trees, by roughly 50 million years.',
    'Lightning can heat the air around it to about five times hotter than the Sun\'s surface.',
    'Wombats produce cube-shaped poop so it does not roll away.'
  ];
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
  function universal(text) {
    const t = String(text || '').trim(), l = t.toLowerCase();
    let m;
    if (/^(?:flip|toss)(?:\s+a|\s+the)?\s*coin\??$/.test(l) || /^heads or tails\??$/.test(l))
      return { reply: pickOne(['Heads.', 'Tails.']), actions: [] };
    if ((m = l.match(/^roll\s+(?:a\s+|the\s+)?(?:(\d{0,2})d(\d{1,3})|die|dice)(?:\s*(\d{1,2})\s*times?)?\??$/)) && !/\bor\b/.test(l)) {
      const n = Math.min(m[1] ? +m[1] || 1 : m[3] ? +m[3] : 1, 20), sides = Math.min(m[1] ? +m[2] : 6, 1000);
      const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
      return { reply: `🎲 ${rolls.join(' + ')} = ${rolls.reduce((a, b) => a + b, 0)}${n > 1 ? ` (${n}d${sides})` : ''}`, actions: [] };
    }
    if ((m = l.match(/^(?:random|pick a) number between\s+(-?\d+)\s+(?:and|to)\s+(-?\d+)\??$/)) || (m = l.match(/^(?:give me a )?random number\??$/))) {
      let a = 1, b = 100;
      if (m[1] !== undefined) { a = +m[1]; b = +m[2]; }
      if (a > b) [a, b] = [b, a];
      return { reply: `${a + Math.floor(Math.random() * (b - a + 1))} (between ${a} and ${b}).`, actions: [] };
    }
    if ((m = l.match(/^(?:pick|choose)(?:\s+one)?(?:\s+between)?[:\s]\s*(.+?)\??$/)) || (m = l.match(/^should i\s+(.+?)\??$/))) {
      const opts = m[1].split(/\s*(?:,|\bor\b)\s*/).map(s => s.trim()).filter(s => s && s.length <= 60);
      if (opts.length >= 2) return { reply: `I pick: ${pickOne(opts)}.`, actions: [] };
    }
    if ((m = t.match(/^count\s+(words|characters|letters|chars)\s*[:\-]\s*(.+)$/i))) {
      const k = m[1].toLowerCase(), s = m[2].trim();
      if (k === 'words') { const w = s.split(/\s+/).filter(Boolean).length; return { reply: `${w} word${w === 1 ? '' : 's'}.`, actions: [] }; }
      const c = [...s].length, ns = s.replace(/\s/g, '').length;
      return { reply: `${c} character${c === 1 ? '' : 's'}${ns !== c ? ` (${ns} without spaces)` : ''}.`, actions: [] };
    }
    if ((m = l.match(/^(?:what\s+)?percent(?:age)?\s+of\s+(-?[\d.]+)\s+is\s+(-?[\d.]+)\??$/)))
      return { reply: `${rnd(+m[2] / +m[1] * 100)}%`, actions: [] };
    if ((m = l.match(/^(-?[\d.]+)\s+is\s+what\s+percent(?:age)?\s+of\s+(-?[\d.]+)\??$/)))
      return { reply: `${rnd(+m[1] / +m[2] * 100)}%`, actions: [] };
    if ((m = l.match(/^percent(?:age)?\s+(?:change|difference)\s+(?:from\s+)?(-?[\d.]+)\s+to\s+(-?[\d.]+)\??$/))) {
      const a = +m[1], b = +m[2];
      if (!a) return { reply: 'Percent change from zero is undefined.', actions: [] };
      const p = (b - a) / Math.abs(a) * 100;
      return { reply: `${p >= 0 ? '+' : ''}${rnd(p)}% (${a} → ${b}).`, actions: [] };
    }
    if ((m = l.match(/^(?:average|mean)(?:\s+of)?[:\s]\s*(.+)$/)) || (m = l.match(/^what(?:'s| is) the (?:average|mean) of\s+(.+?)\??$/))) {
      const nums = (m[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      if (nums.length >= 2) {
        const sum = nums.reduce((a, b) => a + b, 0);
        return { reply: `Average of ${nums.length} numbers: ${rnd(sum / nums.length)} (sum ${rnd(sum)}).`, actions: [] };
      }
    }
    if ((m = l.match(/^(?:sqrt|square root of)\s*([\d.]+)\??$/))) return { reply: `√${m[1]} = ${rnd(Math.sqrt(+m[1]))}`, actions: [] };
    if ((m = l.match(/^(?:cbrt|cube root of)\s*(-?[\d.]+)\??$/))) return { reply: `∛${m[1]} = ${rnd(Math.cbrt(+m[1]))}`, actions: [] };
    if ((m = l.match(/^(?:factorial of\s*)?(\d{1,3})!\??$/)) || (m = l.match(/^factorial(?: of)?\s*(\d{1,3})\??$/))) {
      let f = 1; for (let i = 2; i <= +m[1]; i++) f *= i;
      return { reply: `${+m[1]}! = ${f}`, actions: [] };
    }
    if ((m = l.match(/^is\s+(\d{1,6})\s+(?:a\s+)?prime(?:\s+number)?\??$/))) {
      const n = +m[1]; let p = n > 1;
      for (let i = 2; i * i <= n; i++) if (n % i === 0) { p = false; break; }
      return { reply: `${n} is ${p ? '' : 'not '}prime.`, actions: [] };
    }
    if ((m = l.match(/^is\s+(\d{4})\s+(?:a\s+)?leap\s+year\??$/))) {
      const y = +m[1], leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      return { reply: `${y} is ${leap ? '' : 'not '}a leap year.`, actions: [] };
    }
    if ((m = l.match(/^(?:what\s+)?(?:day|weekday)\s+(?:is|was|will be)\s+(\d{4}-\d{2}-\d{2})\??$/)) || (m = l.match(/^what day of the week (?:is|was)\s+(\d{4}-\d{2}-\d{2})\??$/))) {
      const d = isoDate(m[1]);
      if (d) return { reply: `${m[1]} is a ${d.toLocaleDateString(undefined, { weekday: 'long' })}.`, actions: [] };
    }
    if ((m = l.match(/^(?:what(?:'s| is)? (?:the )?time (?:is it )?in|what time is it in|current time in|time in)\s+([a-z' ]+?)\s*\??$/))) {
      const z = ZONES[m[1].trim()];
      if (z) return { reply: `It is ${new Date().toLocaleTimeString(undefined, { timeZone: z, hour: '2-digit', minute: '2-digit' })} in ${capW(m[1].trim())}.`, actions: [] };
    }
    if (/^(?:tell me a |another |a )?joke\??$/.test(l) || /^make me laugh$/.test(l) || /^say something funny$/.test(l))
      return { reply: pickOne(JOKES), actions: [] };
    if (/^(?:tell me a |random |a )?fun? ?fact\??$/.test(l) || /^random fact$/.test(l) || /^tell me something (?:interesting|cool)$/.test(l))
      return { reply: pickOne(FACTS), actions: [] };
    return null;
  }

  // ---- Universal mode: bring your own OpenAI-compatible key. Stored only in this browser. ----
  const AI_STORE = 'jt:ai';
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem(AI_STORE) || 'null'); } catch { cfg = null; }
  const cfgOn = () => !!(cfg && cfg.url && cfg.key);
  function saveAI(next) {
    cfg = next && /^https:\/\/.+/i.test(next.url) && String(next.key || '').trim()
      ? { url: String(next.url).trim().replace(/\/+$/, ''), key: String(next.key).trim(), model: String(next.model || 'gpt-4o-mini').trim() || 'gpt-4o-mini' }
      : null;
    try { if (cfg) localStorage.setItem(AI_STORE, JSON.stringify(cfg)); else localStorage.removeItem(AI_STORE); } catch {}
  }
  async function cloud(text, tasks, history, fallback) {
    if (!cfgOn()) return null;
    const open = (Array.isArray(tasks) ? tasks : []).filter(x => x && !x.done).slice(0, 8)
      .map(x => `- ${x.title}${x.due ? ' (due ' + x.due + ')' : ''} [${x.prio}]`).join('\n');
    const msgs = [{
      role: 'system',
      content: 'You are JALTRON, the built-in assistant of a personal task-planner web app. Answer any question clearly and concisely in plain text (no markdown headings; short "-" lists are fine). You also help the user plan their day. Their open tasks:\n' + (open || '(none yet)')
    }];
    // ask() already pushed the current message into history, so drop that duplicate
    const hist = (Array.isArray(history) ? history : []).filter(h => h && (h.role === 'user' || h.role === 'assistant') && h.content);
    if (hist.length && hist[hist.length - 1].role === 'user' && String(hist[hist.length - 1].content).trim() === String(text).trim()) hist.pop();
    for (const h of hist.slice(-8)) msgs.push({ role: h.role, content: String(h.content).slice(0, 600) });
    msgs.push({ role: 'user', content: String(text).slice(0, 2000) });
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 30000) : null;
    try {
      const res = await fetch(cfg.url + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key },
        body: JSON.stringify({ model: cfg.model, messages: msgs, temperature: 0.7, max_tokens: 500 }),
        signal: ctl ? ctl.signal : undefined
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      const out = d && d.choices && d.choices[0] && d.choices[0].message && String(d.choices[0].message.content || '').trim();
      return out ? { reply: out, actions: [] } : null;
    } catch (e) {
      const why = e && e.name === 'AbortError' ? 'timed out' : (e && e.message) || 'network error';
      return { reply: `Universal mode could not reach the model (${why}), so here is my offline answer:\n\n` + fallback.reply, actions: fallback.actions || [] };
    } finally { if (timer) clearTimeout(timer); }
  }

  // Main entry: task commands first, then offline skills, then Universal mode if a key is set.
  async function reply(text, tasks, history) {
    const msg = String(text || '').trim();
    const exact = root.Brain.respond(msg, tasks, history);
    if (!exact.unknown) return exact;
    const local = universal(msg) || localSkill(msg);
    if (local) return local;
    return cfgOn() ? cloud(msg, tasks, history, exact) : exact;
  }
  root.JaltronAI = {
    reply, reset: () => {}, get ready() { return true; },
    saveAI, universal: cfgOn,
    aiConfig: () => (cfg ? { url: cfg.url, model: cfg.model, on: cfgOn() } : null)
  };
})(typeof window !== 'undefined' ? window : globalThis);
