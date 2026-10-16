'use strict';

const $ = (id) => document.getElementById(id);

// Signed out: tasks live only in memory. Signed in: they sync to Firestore at users/<uid>/tasks (see db.js).
let tasks = [];
let nextId = 1;
let currentFilter = 'all';
let currentCat = 'all';
let query = '';
let editingId = null;
let lastDeleted = null;
let toastTimer = null;
const DEFAULT_CATS = ['Dev', 'Bug', 'Study', 'General'];
let custom = [];
const catList = () => [...DEFAULT_CATS, ...custom];
window.CATS = catList; // ai.js reads this so the chat knows your own categories

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
  if (window.DB) DB.save(tasks);
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

function setStatus(state, text) {
  $('status').dataset.state = state;
  $('status-text').textContent = text;
}

// ---- Cloud account (db.js) ----
let aiReady = false, profile = { n: '', k: [] };
const ready = () => setStatus('online', DB.user ? 'SYNCED' : 'AI READY');
const setMsg = (text, ok) => { $('acct-msg').textContent = text; $('acct-msg').dataset.ok = ok ? '1' : ''; };

// Rebuild the category dropdowns (defaults + this user's own categories)
function fillCats() {
  const opts = catList().map(c => `<option>${escapeHtml(c)}</option>`).join('');
  const tv = $('task-tag').value, fv = $('cat-filter').value;
  $('task-tag').innerHTML = opts;
  $('cat-filter').innerHTML = '<option value="all">All categories</option>' + opts;
  $('task-tag').value = catList().includes(tv) ? tv : 'General';
  $('cat-filter').value = catList().includes(fv) ? fv : 'all';
  currentCat = $('cat-filter').value;
}
function renderCats() {
  $('acct-cats').innerHTML = DEFAULT_CATS.map(c => `<span class="chip">${c}</span>`).join('')
    + custom.map(c => `<span class="chip mine">${escapeHtml(c)}<button data-cat="${escapeHtml(c)}" aria-label="Remove ${escapeHtml(c)}"><i class="fa-solid fa-xmark"></i></button></span>`).join('');
}
// Profile icon, email and name come straight from Google sign-in; only the username is ours
function avatar(user, cls = '') {
  const initial = escapeHtml((profile.n || user.email || '?')[0].toUpperCase());
  return user.photoURL ? `<img class="avatar ${cls}" src="${escapeHtml(user.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar ${cls}">${initial}</span>`;
}
function renderAccount() {
  const user = window.DB && DB.user;
  $('auth-btn').innerHTML = user ? `${avatar(user)}<span>@${escapeHtml(profile.n)}</span>` : '<i class="fa-brands fa-google"></i><span>Sign in</span>';
  $('auth-btn').title = user ? (user.email || '') : '';
  if (!user) return;
  $('acct-avatar').outerHTML = avatar(user, 'lg').replace('class="avatar', 'id="acct-avatar" class="avatar');
  $('acct-email').textContent = user.email || user.displayName || '';
  $('acct-name').value = profile.n;
  renderCats();
}
addEventListener('jaltron:user', (e) => {
  const { user, tasks: saved, profile: p } = e.detail;
  tasks = saved; profile = p; custom = p.k;
  nextId = tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  $('notice-text').textContent = user ? `Signed in as @${p.n}. Your tasks sync to your account.` : 'Sign in with Google to save your tasks. Until then they only live in this page and refreshing clears them.';
  fillCats(); renderAccount(); render();
  if (aiReady) ready();
  if (user) toast('Signed in');
});
addEventListener('jaltron:error', (e) => toast(e.detail));
$('auth-btn').addEventListener('click', () => {
  if (!window.DB) return toast('Cloud is still loading, try again');
  if (!DB.user) return DB.signIn();
  setMsg(''); renderAccount(); $('acct').showModal();
});
$('acct-close').addEventListener('click', () => $('acct').close());
$('acct').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$('acct-signout').addEventListener('click', () => { $('acct').close(); DB.signOut(); });
$('name-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = $('acct-name').value.trim().toLowerCase().replace(/^@/, '');
  if (!/^[a-z0-9_]{3,20}$/.test(v)) return setMsg('Use 3 to 20 letters, numbers or underscores.');
  if (v === profile.n) return setMsg('That is already your username.');
  try { profile.n = await DB.setUsername(v); renderAccount(); setMsg('Username changed.', true); }
  catch (err) { setMsg(err.message === 'taken' ? 'That username is already taken.' : 'Could not change the username. Try again.'); }
});
$('cat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('cat-input').value.trim().replace(/\s+/g, ' ');
  if (!v) return;
  if (catList().some(c => c.toLowerCase() === v.toLowerCase())) return setMsg('You already have that category.');
  if (custom.length >= 12) return setMsg('You can create up to 12 categories.');
  custom.push(v); DB.setCats(custom);
  $('cat-input').value = '';
  fillCats(); renderCats(); setMsg('Category added.', true);
});
$('acct-cats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  const c = b.dataset.cat;
  custom = custom.filter(x => x !== c); DB.setCats(custom);
  tasks = tasks.map(t => t.tag === c ? { ...t, tag: 'General' } : t); // its tasks move to General
  fillCats(); renderCats(); render(); setMsg(`Removed "${c}". Its tasks moved to General.`, true);
});

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
    else if (a.type === 'tag' && catList().includes(a.tag)) tasks = tasks.map(t => t.id === a.id ? { ...t, tag: a.tag } : t);
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
// ---- AI (everything lives in ai.js) ----
function setNn(text) { const el = $('nn-state'); if (el) el.textContent = text; }
async function trainAI() {
  if (typeof JaltronAI === 'undefined') return setNn('ai.js did not load. Upload ai.js next to index.html.');
  setNn('Training neural AI...');
  try {
    const r = await JaltronAI.init((ep, total) => setNn(`Training neural AI... ${Math.round(ep / total * 100)}%`));
    setNn(`Neural AI ready: ${r.examples} examples, ${Math.round(r.acc * 100)}% accuracy on unseen phrases`);
  } catch (err) { console.error(err); setNn('Neural AI failed to train. Built-in commands still work.'); }
}
async function ask(text) {
  addMsg('user', text);
  chatMsgs.push({ role: 'user', content: text });
  if (typeof JaltronAI === 'undefined') return addMsg('ai', 'ai.js did not load. Upload ai.js next to index.html and redeploy.');
  const res = JaltronAI.reply(text, tasks, chatMsgs);
  addMsg('ai', res.reply);
  chatMsgs.push({ role: 'assistant', content: res.reply });
  if (res.actions && res.actions.length) applyActions(res.actions);
}
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
setStatus('demo', 'TRAINING');
trainAI().then(() => { aiReady = true; if (window.DB) ready(); else setStatus('online', 'AI READY'); });