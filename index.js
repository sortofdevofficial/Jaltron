'use strict';

const $ = (id) => document.getElementById(id);

// Set this to your VPS address once the AI server is running, e.g. 'https://ai.yourdomain.com'.
// Left empty, the app runs in demo mode: no AI chat, tasks reset on refresh.
// Direct address of the Wispbyte server (plain HTTP). Works from http://, localhost or a local file.
// On an https:// site (Vercel, GitHub Pages) browsers block plain HTTP, so it calls /api on the same
// site instead, which vercel.json forwards to the server.
const DIRECT_API = 'http://78.154.103.47:11903';
const API_BASE = location.protocol === 'https:' ? location.origin : DIRECT_API;

// State lives in memory (and on your server when API_BASE is set). No localStorage.
let tasks = [];
let nextId = 1;
let currentFilter = 'all';
let currentCat = 'all';
let query = '';
let editingId = null;
let lastDeleted = null;
let toastTimer = null;

const WEIGHT = { high: 3, medium: 2, low: 1 };
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayDiff = (due) => Math.round((new Date(due + 'T00:00') - new Date(todayStr() + 'T00:00')) / 86400000);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

function dueBadge(t) {
  if (!t.due) return '';
  const d = dayDiff(t.due);
  let label, cls = '';
  if (d < 0) { label = `${-d}d overdue`; cls = t.done ? '' : 'overdue'; }
  else if (d === 0) { label = 'Due today'; cls = t.done ? '' : 'soon'; }
  else if (d === 1) { label = 'Due tomorrow'; cls = t.done ? '' : 'soon'; }
  else label = `Due ${new Date(t.due + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  return `<span class="badge due ${cls}"><i class="fa-regular fa-calendar"></i> ${label}</span>`;
}

function render() {
  scheduleSync();
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const overdue = tasks.filter(t => !t.done && t.due && dayDiff(t.due) < 0).length;
  setNum('stat-total', total);
  setNum('stat-pending', total - done);
  setNum('stat-done', done);
  setNum('stat-high', tasks.filter(t => !t.done && t.prio === 'high').length);
  setNum('stat-overdue', overdue);
  const pct = total ? Math.round(done / total * 100) : 0;
  $('progress-bar').style.width = pct + '%';
  $('progress-text').textContent = `${pct}% (${done}/${total})`;

  const q = query.toLowerCase();
  const filtered = tasks.filter(t => {
    if (currentFilter === 'pending' && t.done) return false;
    if (currentFilter === 'done' && !t.done) return false;
    if (currentCat !== 'all' && t.tag !== currentCat) return false;
    return !q || t.title.toLowerCase().includes(q);
  });

  const listEl = $('task-list');
  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty"><i class="fa-regular fa-clipboard"></i><p>${total ? 'No tasks match this view.' : 'Your plan is empty. Add a task to get started.'}</p></div>`;
    return;
  }

  const canDrag = currentFilter === 'all' && currentCat === 'all' && !q && !editingId;
  listEl.innerHTML = filtered.map(t => {
    const body = editingId === t.id
      ? `<input class="edit-input" data-edit="${t.id}" value="${escapeHtml(t.title)}" maxlength="140" aria-label="Edit task">`
      : `<div class="task-title">${escapeHtml(t.title)}</div>`;
    return `
    <div class="task-item p-${t.prio} ${t.done ? 'completed' : ''}" data-id="${t.id}" ${canDrag ? 'draggable="true"' : ''}>
      <div class="task-left">
        <button class="check-btn" data-act="toggle" aria-label="Toggle complete"><i class="fa-solid fa-check"></i></button>
        <div class="task-main">
          ${body}
          <div class="badges">
            <span class="badge ${t.prio}">${t.prio}</span>
            <span class="badge tag">${escapeHtml(t.tag)}</span>
            ${dueBadge(t)}
          </div>
        </div>
      </div>
      <div class="task-actions">
        <button class="del-btn" data-act="edit" title="Edit" aria-label="Edit"><i class="fa-solid fa-${editingId === t.id ? 'floppy-disk' : 'pen'}"></i></button>
        <button class="del-btn danger" data-act="delete" title="Delete" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');

  const ed = listEl.querySelector('.edit-input');
  if (ed) { ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); }
}

function toast(msg, undo) {
  const el = $('toast');
  el.innerHTML = `<span>${escapeHtml(msg)}</span>${undo ? '<button id="undo-btn">Undo</button>' : ''}`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 5000);
  if (undo) $('undo-btn').onclick = () => {
    if (lastDeleted) { tasks.splice(Math.min(lastDeleted.index, tasks.length), 0, lastDeleted.task); lastDeleted = null; render(); }
    el.classList.remove('show');
  };
}

function commitEdit(id) {
  const input = document.querySelector(`[data-edit="${id}"]`);
  if (input) {
    const v = input.value.trim();
    if (v) tasks = tasks.map(t => t.id === id ? { ...t, title: v } : t);
  }
  editingId = null;
  render();
}

// Task list actions (event delegation)
$('task-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = Number(btn.closest('.task-item').dataset.id);
  const act = btn.dataset.act;
  if (act === 'toggle') tasks = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
  else if (act === 'delete') {
    const index = tasks.findIndex(t => t.id === id);
    lastDeleted = { task: tasks[index], index };
    tasks.splice(index, 1);
    toast('Task deleted', true);
  } else if (act === 'edit') {
    if (editingId === id) return commitEdit(id);
    editingId = id;
  }
  render();
});
$('task-list').addEventListener('keydown', (e) => {
  if (!e.target.matches('.edit-input')) return;
  if (e.key === 'Enter') commitEdit(Number(e.target.dataset.edit));
  if (e.key === 'Escape') { editingId = null; render(); }
});
$('task-list').addEventListener('dblclick', (e) => {
  const title = e.target.closest('.task-title');
  if (title) { editingId = Number(title.closest('.task-item').dataset.id); render(); }
});

// Add task
$('task-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('task-title').value.trim();
  if (!title) return;
  tasks.unshift({ id: nextId++, title, prio: $('task-prio').value, tag: $('task-tag').value, due: $('task-due').value || '', done: false });
  $('task-title').value = '';
  $('task-due').value = '';
  render();
});

// AI optimizer: score = priority + deadline pressure + category bonus
function score(t) {
  let s = WEIGHT[t.prio] * 10;
  if (t.due) {
    const d = dayDiff(t.due);
    s += d < 0 ? 25 : d === 0 ? 20 : d <= 2 ? 14 : d <= 7 ? 7 : 2;
  }
  if (t.tag === 'Bug') s += 6;
  return s;
}
$('ai-sort-btn').addEventListener('click', () => {
  tasks.sort((a, b) => (a.done !== b.done) ? (a.done ? 1 : -1) : score(b) - score(a));
  currentFilter = 'all';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
  render();
  const top = tasks.find(t => !t.done);
  toast(top ? `Top priority: ${top.title} (${top.prio}${top.due ? ', due ' + top.due : ''})` : 'Plan optimized');
});

// Filters, search, category
$('filters').addEventListener('click', (e) => {
  const b = e.target.closest('.filter-btn');
  if (!b) return;
  document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  currentFilter = b.dataset.filter;
  render();
});
$('search').addEventListener('input', (e) => { query = e.target.value.trim(); render(); });
$('cat-filter').addEventListener('change', (e) => { currentCat = e.target.value; render(); });
$('clear-done').addEventListener('click', () => {
  const n = tasks.filter(t => t.done).length;
  if (!n) return toast('No completed tasks to clear');
  tasks = tasks.filter(t => !t.done);
  render();
  toast(`Cleared ${n} completed task${n > 1 ? 's' : ''}`);
});

// Theme (in-memory only; follows system preference on load)
function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('theme-btn').innerHTML = `<i class="fa-solid fa-${dark ? 'sun' : 'moon'}"></i>`;
}
setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
$('theme-btn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme !== 'dark'));

// "/" focuses search
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('search').focus(); }
});

// Animated counters
function setNum(id, n) {
  const el = $(id), from = Number(el.textContent) || 0;
  if (from === n) { el.textContent = n; return; }
  const t0 = performance.now();
  (function step(t) {
    const p = Math.min((t - t0) / 350, 1);
    el.textContent = Math.round(from + (n - from) * p);
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

// Drag to reorder (only in the unfiltered view)
let dragId = null;
const listEl = $('task-list');
listEl.addEventListener('dragstart', (e) => {
  const it = e.target.closest('.task-item');
  if (!it || !it.draggable) return;
  dragId = Number(it.dataset.id);
  it.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
});
listEl.addEventListener('dragover', (e) => {
  if (dragId === null) return;
  e.preventDefault();
  listEl.querySelectorAll('.drop-target').forEach(x => x.classList.remove('drop-target'));
  const it = e.target.closest('.task-item');
  if (it && Number(it.dataset.id) !== dragId) it.classList.add('drop-target');
});
listEl.addEventListener('drop', (e) => {
  e.preventDefault();
  const it = e.target.closest('.task-item');
  if (!it || dragId === null) return;
  const from = tasks.findIndex(t => t.id === dragId);
  const to = tasks.findIndex(t => t.id === Number(it.dataset.id));
  if (from > -1 && to > -1 && from !== to) { const [m] = tasks.splice(from, 1); tasks.splice(to, 0, m); }
  dragId = null;
  render();
});
listEl.addEventListener('dragend', () => { dragId = null; render(); });

// ---- Server connection (VPS) ----
let online = false, lastSynced = '', syncTimer = null;
function setStatus(state, text) {
  $('status').dataset.state = state;
  $('status-text').textContent = text;
}
function scheduleSync() {
  if (!online) return;
  const s = JSON.stringify(tasks);
  if (s === lastSynced) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      await fetch(API_BASE + '/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: s });
      lastSynced = s;
    } catch { online = false; setStatus('offline', 'SERVER LOST'); }
  }, 400);
}
async function connect() {
  if (!API_BASE) return setStatus('demo', 'DEMO MODE');
  try {
    const h = await fetch(API_BASE + '/api/health', { cache: 'no-store' });
    if (!h.ok) throw 0;
    const saved = await (await fetch(API_BASE + '/api/tasks')).json();
    tasks = Array.isArray(saved) ? saved : [];
    nextId = tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    lastSynced = JSON.stringify(tasks);
    online = true;
    setStatus('online', 'AI ONLINE');
    render();
  } catch { setStatus('offline', 'SERVER OFFLINE'); }
}

// ---- AI chat ----
// Run actions the assistant returns (add, complete, delete, prio, clear, optimize, filter)
function applyActions(actions) {
  for (const a of actions) {
    if (a.type === 'add' && a.title) tasks.unshift({ id: nextId++, title: String(a.title).slice(0, 140), prio: WEIGHT[a.prio] ? a.prio : 'medium', tag: a.tag || 'General', due: a.due || '', done: false });
    else if (a.type === 'complete') tasks = tasks.map(t => t.id === a.id ? { ...t, done: true } : t);
    else if (a.type === 'delete') tasks = tasks.filter(t => t.id !== a.id);
    else if (a.type === 'prio' && WEIGHT[a.prio]) tasks = tasks.map(t => t.id === a.id ? { ...t, prio: a.prio } : t);
    else if (a.type === 'clear_done') tasks = tasks.filter(t => !t.done);
    else if (a.type === 'complete_all') tasks = tasks.map(t => ({ ...t, done: true }));
    else if (a.type === 'clear_all') tasks = [];
    else if (a.type === 'reopen') tasks = tasks.map(t => t.id === a.id ? { ...t, done: false } : t);
    else if (a.type === 'rename' && a.title) tasks = tasks.map(t => t.id === a.id ? { ...t, title: String(a.title).slice(0, 140) } : t);
    else if (a.type === 'due') tasks = tasks.map(t => t.id === a.id ? { ...t, due: a.due || '' } : t);
    else if (a.type === 'tag' && ['Dev', 'Bug', 'Study', 'General'].includes(a.tag)) tasks = tasks.map(t => t.id === a.id ? { ...t, tag: a.tag } : t);
    else if (a.type === 'search') { query = String(a.q || ''); $('search').value = query; }
    else if (a.type === 'optimize') tasks.sort((x, y) => (x.done !== y.done) ? (x.done ? 1 : -1) : score(y) - score(x));
    else if (a.type === 'filter') {
      if (a.status) currentFilter = a.status;
      if (a.cat) currentCat = a.cat;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === currentFilter));
      $('cat-filter').value = currentCat;
    }
  }
  render();
}

const chatMsgs = [];
const log = $('chat-log');
function addMsg(cls, text) {
  const d = document.createElement('div');
  d.className = 'msg ' + cls;
  d.textContent = text;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}
// ---- On-device AI: Transformers.js + Qwen2.5-0.5B-Instruct, runs fully in the browser ----
const LLM_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2';
const LLM_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
let llm = null, llmState = 'off'; // off | loading | ready | error

function updateAiUi(text, frac) {
  $('ai-enable').hidden = !(llmState === 'off' || llmState === 'error');
  $('ai-prog').hidden = llmState !== 'loading';
  if (frac != null) $('ai-prog-fill').style.width = Math.round(frac * 100) + '%';
  $('ai-state').textContent = text;
}
async function loadLLM() {
  if (llmState === 'loading' || llmState === 'ready') return;
  llmState = 'loading';
  updateAiUi('Loading AI...', 0);
  try {
    const { pipeline } = await import(LLM_URL);
    const files = {};
    const progress = (p) => {
      if (p.status !== 'progress' || !p.total) return;
      files[p.file] = [p.loaded, p.total];
      const v = Object.values(files), l = v.reduce((s, f) => s + f[0], 0), t = v.reduce((s, f) => s + f[1], 0);
      updateAiUi(`Downloading AI model ${Math.round(l / t * 100)}%`, l / t);
    };
    const make = (device) => pipeline('text-generation', LLM_MODEL, { dtype: 'q4', device, progress_callback: progress });
    try { llm = await make(navigator.gpu ? 'webgpu' : 'wasm'); } catch { llm = await make('wasm'); }
    llmState = 'ready';
    updateAiUi('Real AI is on (runs in your browser)', 1);
    addMsg('ai', 'Real AI is ready. Ask me anything about your plan, or say things like "I have an exam tomorrow, remind me to revise biology".');
  } catch (err) {
    console.error(err);
    llmState = 'error';
    updateAiUi('Could not load the AI model. Built-in commands still work.');
  }
}

const VALID_TAGS = ['Dev', 'Bug', 'Study', 'General'];
function resolveActions(list) {
  const ok = []; let dropped = 0;
  for (const a of (Array.isArray(list) ? list : []).slice(0, 6)) {
    if (!a || typeof a !== 'object') { dropped++; continue; }
    if (a.type === 'add' && typeof a.title === 'string' && a.title.trim()) {
      ok.push({ type: 'add', title: a.title.trim().slice(0, 140), prio: WEIGHT[a.prio] ? a.prio : 'medium', tag: VALID_TAGS.includes(a.tag) ? a.tag : 'General', due: /^\d{4}-\d{2}-\d{2}$/.test(a.due || '') ? a.due : '' });
    } else if (['complete', 'prio', 'rename', 'due', 'tag'].includes(a.type)) {
      const t = Brain.find(tasks, String(a.target || ''));
      if (!t) { dropped++; continue; }
      if (a.type === 'prio' && !WEIGHT[a.prio]) { dropped++; continue; }
      if (a.type === 'tag' && !VALID_TAGS.includes(a.tag)) { dropped++; continue; }
      if (a.type === 'due' && !/^\d{4}-\d{2}-\d{2}$/.test(a.due || '')) { dropped++; continue; }
      if (a.type === 'rename' && !String(a.title || '').trim()) { dropped++; continue; }
      ok.push({ type: a.type, id: t.id, prio: a.prio, tag: a.tag, due: a.due, title: a.title });
    } else dropped++; // delete and bulk actions are never taken from the model: use the explicit commands
  }
  return { ok, dropped };
}
async function llmAsk() {
  const list = tasks.slice(0, 40).map(t => `- ${t.title} | ${t.prio} | ${t.tag} | ${t.due || 'no date'} | ${t.done ? 'done' : 'open'}`).join('\n') || '(no tasks)';
  const tmr = new Date(Date.now() + 864e5), tm = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`;
  const system = `You are JALTRON, a friendly task planner. Today is ${todayStr()}.
Tasks (title | priority | category | due | status):
${list}
Answer with ONE line of JSON only: {"reply":"short answer","actions":[]}
Action types: {"type":"add","title":"","prio":"high|medium|low","tag":"Dev|Bug|Study|General","due":"YYYY-MM-DD or empty"}, {"type":"complete","target":"task title"}, {"type":"prio","target":"","prio":""}, {"type":"rename","target":"","title":""}, {"type":"due","target":"","due":""}, {"type":"tag","target":"","tag":""}.
Use [] when nothing should change. Keep the reply under 40 words.`;
  const shots = [
    { role: 'user', content: 'remind me to revise biology tomorrow' },
    { role: 'assistant', content: JSON.stringify({ reply: 'Added a task to revise biology for tomorrow.', actions: [{ type: 'add', title: 'Revise biology', prio: 'medium', tag: 'Study', due: tm }] }) },
    { role: 'user', content: 'what should I focus on?' },
    { role: 'assistant', content: JSON.stringify({ reply: 'Start with your highest priority open task, then work down the list.', actions: [] }) }
  ];
  const out = await llm([{ role: 'system', content: system }, ...shots, ...chatMsgs.slice(-4).map(m => ({ role: m.role, content: m.content }))], { max_new_tokens: 200, do_sample: false });
  const raw = String(out[0].generated_text.at(-1).content || '').trim();
  let data = null;
  try { const m = raw.match(/\{[\s\S]*\}/); data = m && JSON.parse(m[0]); } catch { /* plain text answer */ }
  if (!data || typeof data.reply !== 'string') return { reply: raw.slice(0, 400) || 'I am not sure how to help with that.', actions: [] };
  const { ok, dropped } = resolveActions(data.actions);
  return { reply: data.reply.slice(0, 400) + (dropped ? '\n(I skipped some changes I could not match safely.)' : ''), actions: ok };
}

// Chat: exact commands run instantly; anything else goes to the on-device AI when it is on
async function ask(text) {
  addMsg('user', text);
  chatMsgs.push({ role: 'user', content: text });
  let res = Brain.respond(text, tasks, chatMsgs);
  if (res.unknown && llmState === 'ready') {
    const typing = addMsg('ai typing', 'Thinking...');
    try { res = await llmAsk(); } catch (err) { console.error(err); }
    typing.remove();
  } else if (res.unknown && llmState !== 'loading') {
    res = { ...res, reply: res.reply + '\n\nTip: tap "Enable real AI" above and I can understand free-form requests.' };
  }
  addMsg('ai', res.reply);
  chatMsgs.push({ role: 'assistant', content: res.reply });
  if (res.actions && res.actions.length) applyActions(res.actions);
}
$('ai-enable').addEventListener('click', loadLLM);
const toggleChat = (open) => { $('chat').hidden = !open; $('chat-fab').hidden = open; if (open) $('chat-input').focus(); };
$('chat-fab').addEventListener('click', () => toggleChat(true));
$('chat-close').addEventListener('click', () => toggleChat(false));
$('chips').addEventListener('click', (e) => { if (e.target.matches('button')) ask(e.target.textContent); });
$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('chat-input').value.trim();
  if (v) { $('chat-input').value = ''; ask(v); }
});
addMsg('ai', 'Hi, I am JALTRON. I can add, complete and delete tasks for you, plan your day, or explain the site. Try: add fix login bug tomorrow high');

// Keep due-date labels fresh
setInterval(render, 60000 * 30);
render();
// Sidebar AI command bar: opens the chat and runs the command
$('cmd-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('cmd-input').value.trim();
  if (!v) return;
  $('cmd-input').value = '';
  toggleChat(true);
  ask(v);
});
connect();