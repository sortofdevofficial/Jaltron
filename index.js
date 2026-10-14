'use strict';

const $ = (id) => document.getElementById(id);

const DIRECT_API = 'http://78.154.103.47:11903';
const API_BASE = location.protocol === 'https:' ? location.origin : DIRECT_API;

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
  $('progress-bar').style.width = pct + '\%';$('progress-text').textContent = `${pct}% (${done}/${total})`;

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

$('task-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('task-title').value.trim();
  if (!title) return;
  tasks.unshift({ id: nextId++, title, prio: $('task-prio').value, tag: $('task-tag').value, due:$('task-due').value || '', done: false });
  $('task-title').value = '';$('task-due').value = '';
  render();
});

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

$('filters').addEventListener('click', (e) => {
  const b = e.target.closest('.filter-btn');
  if (!b) return;
  document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  currentFilter = b.dataset.filter;
  render();
});

$('search').addEventListener('input', (e) => { query = e.target.value.trim(); render(); });
$('cat-filter').addEventListener('change', (e) => { currentCat = e.target.value; render(); });$('clear-done').addEventListener('click', () => {
  const n = tasks.filter(t => t.done).length;
  if (!n) return toast('No completed tasks to clear');
  tasks = tasks.filter(t => !t.done);
  render();
  toast(`Cleared ${n} completed task${n > 1 ? 's' : ''}`);
});

function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('theme-btn').innerHTML = `<i class="fa-solid fa-${dark ? 'sun' : 'moon'}"></i>`;
}
setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
$('theme-btn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme !== 'dark'));

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('search').focus(); }
});

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

function setNn(text) { const el = $('nn-state'); if (el) el.textContent = text; }
async function trainAI() {
  if (typeof TinyBrain === 'undefined' || !window.TRAIN) return setNn('Neural AI files missing.');
  setNn('Training neural AI...');
  try {
    const r = await TinyBrain.train([], (ep, total) => setNn(`Training neural AI... ${Math.round(ep / total * 100)}%`));
    setNn(`Neural AI ready (${Math.round(r.acc * 100)}% accuracy)`);
  } catch (err) { console.error(err); setNn('Neural AI failed to train.'); }
}

const KSTOP = new Set('a an the i me my you is are do does how what to of and or it in on for can we be this that with'.split(' '));
const kw = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && !KSTOP.has(w));
const kOverlap = (k, q) => { const toks = new Set(k.phrases.flatMap(kw)); let s = 0; q.forEach(w => { if (toks.has(w)) s++; }); return s; };
function kAnswer(k, text) {
  const a = typeof k.answer === 'function' ? k.answer(text, tasks) : Array.isArray(k.answer) ? k.answer[Math.floor(Math.random() * k.answer.length)] : k.answer;
  return { reply: a, actions: [] };
}
function neuralRespond(text) {
  const p = TinyBrain.predict(text);
  if (!p) return null;
  const KB = window.KNOWLEDGE || [], q = new Set(kw(text));
  if (/\d/.test(text) && /[+\-*/^%]|\b(?:times|plus|minus|divided|squared)\b/i.test(text)) { const m = KB.find(x => x.id === 'util_math'); if (m) return kAnswer(m, text); }
  let bk = null, bs = 0;
  for (const k of KB) { const s = kOverlap(k, q); if (s > bs) { bs = s; bk = k; } }
  if (p.intent === 'unknown' || p.conf < 0.5) return bk && bs >= 2 ? kAnswer(bk, text) : null;
  if (p.intent.startsWith('k_')) {
    const nk = KB.find(x => 'k_' + x.id === p.intent);
    if (!nk) return null;
    return kAnswer(bk && bk !== nk && bs > kOverlap(nk, q) ? bk : nk, text);
  }
  let intent = p.intent;
  if (intent === 'reopen' && /\b(finished|finish|done|completed)\b/i.test(text) && !/\b(not|didnt|did not|never|still|yet)\b/i.test(text)) intent = 'complete';
  const canned = { plan: 'plan my day', first: 'what should i do first', summary: 'summary', overdue: "what's overdue", help: 'what can you do', greet: 'hi', thanks: 'thanks', optimize: 'optimize', clear_done: 'clear completed', complete_all: 'complete all' };
  const strip = (s, extra) => s.replace(extra, ' ').replace(/\b(?:bro|pls|please|can you|could you|i|im|just|already|the|my|a|an|task|tasks|is|are|was|now|lol|from|list|on|it|me|to|of)\b/gi, ' ').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const known = (t) => t && Brain.find(tasks, t);
  let cmd = canned[intent] || null, res = null, t;
  switch (intent) {
    case 'motivate': res = { reply: 'Small steps count. Pick one task and give it 10 focused minutes.\n' + Brain.respond('what should i do first', tasks, []).reply, actions: [] }; break;
    case 'chat': res = { reply: 'I can help with your tasks, planning, studying, debugging, and quick calculations or jokes.', actions: [] }; break;
    case 'add': cmd = 'add ' + (text.replace(/^(?:bro\s+|hey\s+|please\s+|pls\s+|can you\s+|could you\s+)?(?:i\s+(?:need|have|want|gotta|must|should)\s+to\s+|remind me to\s+|(?:add|create|put|new task|make)\s+(?:a\s+)?(?:new\s+)?(?:task\s+)?(?:to\s+|for\s+)?)/i, '').trim() || text); break;
    case 'complete': t = strip(text, /\b(?:finished|finish|done|completed|complete|check off|tick off|mark|with|did)\b/gi); if (!known(t)) return null; cmd = 'complete ' + t; break;
    case 'delete': t = strip(text, /\b(?:delete|remove|cancel|drop|get rid|dont need|anymore|trash|erase)\b/gi); if (!known(t)) return null; cmd = 'delete ' + t; break;
    case 'reopen': t = strip(text, /\b(?:reopen|undo|complete|not done|yet|did not|didnt|finish|finished|uncheck|bring back)\b/gi); if (!known(t)) return null; cmd = 'reopen ' + t; break;
    case 'search': t = strip(text, /\b(?:find|search|where|show|look|for|do have)\b/gi); if (!t) return null; cmd = 'find ' + t; break;
    case 'prio': {
      const level = /not important|\b(low|later|wait|unimportant|lower)\b/i.test(text) ? 'low' : /\b(urgent|important|asap|high|critical|raise)\b/i.test(text) ? 'high' : 'medium';
      t = strip(text, /\b(?:make|set|priority|urgent|important|asap|high|critical|raise|low|later|wait|lower|unimportant|not|super|very|medium|can)\b/gi);
      if (!known(t)) return null; cmd = `make ${t} ${level} priority`; break;
    }
    case 'due': {
      const d = Brain.parseTask(text).due;
      if (!d) return { reply: 'Which date? Try "tomorrow", "friday" or YYYY-MM-DD.', actions: [] };
      t = strip(text, /\b(?:move|postpone|push|delay|reschedule|change|deadline|due|until|tomorrow|tmrw|tmr|today|next week|in \d+ days?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b/gi);
      if (!known(t)) return null; cmd = `move ${t} to ${d}`; break;
    }
    case 'tag': {
      const c = (text.match(/\b(dev|bugs?|study|general)\b/i) || [])[1];
      t = strip(text, /\b(?:tag|put|under|as|mark|category|change|dev|bugs?|study|general|thing)\b/gi);
      if (!c || !known(t)) return null; cmd = `tag ${t} as ${c.toLowerCase().replace(/^bugs$/, 'bug')}`; break;
    }
    case 'breakdown': t = strip(text, /\b(?:break down|split|steps|how do finish|how should approach|help start|into|how)\b/gi); cmd = 'break down' + (t ? ' ' + t : ''); break;
  }
  if (!res) { if (!cmd) return null; res = Brain.respond(cmd, tasks, []); if (res.unknown) return null; }
  return { ...res, reply: res.reply };
}

async function ask(text) {
  addMsg('user', text);
  chatMsgs.push({ role: 'user', content: text });
  if (typeof Brain === 'undefined') {
    return addMsg('ai', 'brain.js did not load.');
  }
  let res = Brain.respond(text, tasks, chatMsgs);
  if (res.unknown && typeof TinyBrain !== 'undefined' && TinyBrain.ready) { const n = neuralRespond(text); if (n) res = n; }
  addMsg('ai', res.reply);
  chatMsgs.push({ role: 'assistant', content: res.reply });
  if (res.actions && res.actions.length) applyActions(res.actions);
}

const toggleChat = (open) => { $('chat').hidden = !open; $('chat-fab').hidden = open; if (open)$('chat-input').focus(); };
$('chat-fab').addEventListener('click', () => toggleChat(true));$('chat-close').addEventListener('click', () => toggleChat(false));
$('chips').addEventListener('click', (e) => { if (e.target.matches('button')) ask(e.target.textContent); });$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('chat-input').value.trim();
  if (v) { $('chat-input').value = ''; ask(v); }
});

addMsg('ai', 'Hi, I am JALTRON. I can manage your plan, answer questions, or sort priorities. Try: add fix login bug tomorrow high');

setInterval(render, 60000 * 30);
render();

$('cmd-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('cmd-input').value.trim();
  if (!v) return;
  $('cmd-input').value = '';
  toggleChat(true);
  ask(v);
});

connect().then(() => trainAI());