'use strict';

const $ = (id) => document.getElementById(id);

// Signed out: tasks live only in memory. Signed in: they sync to the task map q on u/<uid> in Firestore (see db.js). Repeating tasks and streaks live in lib.js (habits).
let tasks = [];
let nextId = 1;
let currentFilter = 'all';
let currentCat = 'all';
let query = '';
let editingId = null;
// canSavePet (below) stays false until the cloud answers, so pet and focus numbers are never saved from an old offline copy
let bootName = '', syncing = false, fromCache = false; // fromCache: showing last visit's copy, the cloud has not answered yet // bootName: shown from the last visit before Firebase has loaded
let view = 'all', sortMode = 'manual';
let lastDeleted = null;
let toastTimer = null;
const DEFAULT_CATS = ['Dev', 'Bug', 'Study', 'General'];
let custom = [];
const catList = () => [...DEFAULT_CATS, ...custom];
window.CATS = catList;
window.catReply = () => `Categories group your tasks. Built in: ${DEFAULT_CATS.join(', ')}.` + (custom.length ? ` Yours: ${custom.join(', ')}.` : ' Create your own with the New button in Quick Add.');
window.jaltron = { complete: (id) => { const el = document.querySelector(`.task-item[data-id="${id}"] .check-btn`); if (el) el.click(); return !!el; }, openChat: () => openAI(), hasDeleted: () => !!lastDeleted, openAccount: () => $('auth-btn').click(), clearDone: () => $('clear-done').click() }; // ai.js reads this so the chat knows your own categories

const WEIGHT = { high: 3, medium: 2, low: 1 };
const PRIO_EMO = { high: '🔥', medium: '🌤️', low: '🌿' };
const REPS = ['d', 'wd', 'we', 'w'];
// One place that builds a task, so every field (including repeat and streak data) always exists
const mkTask = (o) => ({ id: nextId++, title: '', prio: 'medium', tag: 'General', due: '', done: false, r: '', s: 0, b: 0, l: '', h: [], z: '', i: [], ...o });
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
  const ico = d < 0 ? '⌛' : d === 0 ? '⏰' : '📅';
  return `<span class="badge due ${cls}"><span class="emo" aria-hidden="true">${ico}</span> ${label}</span>`;
}

function doneBadges(t) {
  const today = Habit.today();
  const doneToday = t.done && (t.z === today || t.l === today);
  return (doneToday ? '<span class="badge okd"><span class="emo" aria-hidden="true">✅</span> Done today</span>' : '') + Habit.resetBadge(t);
}
function repBadges(t) {
  if (!t.r) return '';
  const s = Habit.streak(t);
  return `<span class="badge rep"><span class="emo" aria-hidden="true">🔁</span> ${Habit.REP[t.r]}</span>`
    + (s ? `<span class="badge streak" title="Best streak: ${t.b || s}"><span class="emo" aria-hidden="true">🔥</span> ${s}</span>` : '');
}

// ---- Insights: streak cards, pie charts, weekly bars, heatmap, habit list ----
const setHtml = (id, html) => { const el = $(id); if (el._h !== html) { el.innerHTML = html; el._h = html; } };
function renderInsights() {
  if (!window.Habit) return;
  const H = Habit, map = H.completions(tasks), week = H.lastDays(map, 7);
  const done = tasks.filter(t => t.done).length;
  const overdue = tasks.filter(t => !t.done && t.due && dayDiff(t.due) < 0).length;
  $('sk-week').textContent = week.reduce((a, d) => a + d.count, 0);
  $('sk-habits').textContent = tasks.filter(t => t.r).length;
  setHtml('ch-cat', H.donut(H.group(tasks, 'tag'), 'tasks'));
  setHtml('ch-prio', H.donut(H.group(tasks, 'prio').map(x => ({ label: x.label[0].toUpperCase() + x.label.slice(1), value: x.value })), 'tasks', { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' }));
  setHtml('ch-status', H.donut([
    { label: 'Done', value: done, color: '#10b981' },
    { label: 'In progress', value: tasks.length - done - overdue, color: '#3b82f6' },
    { label: 'Overdue', value: overdue, color: '#ef4444' }], 'tasks'));
  setHtml('ch-week', H.bars(week));
  setHtml('ch-heat', H.heatmap(map, 12));
  const habits = tasks.filter(t => t.r).map(t => ({ t, s: H.streak(t) })).sort((a, b) => b.s - a.s);
  setHtml('habit-list', habits.length
    ? habits.map(({ t, s }) => `<div class="habit-row"><span class="h-name">${escapeHtml(t.title)}</span><span class="h-rep">${H.REP[t.r]}</span><span class="dots" title="Last 7 days">${H.week7(t)}</span><span class="h-st"><i class="fa-solid fa-fire"></i> ${s}<small>best ${Math.max(t.b || 0, s)}</small></span></div>`).join('')
    : '<p class="sub">No repeating tasks yet. Use the Repeat option when you add or edit a task, or tell the AI: "add gym daily".</p>');
}
$('insights-toggle').addEventListener('click', () => {
  const body = $('insights-body'), hide = !body.hidden;
  body.hidden = hide;
  $('insights-toggle').setAttribute('aria-expanded', String(!hide));
  $('insights-toggle').innerHTML = `<i class="fa-solid fa-chevron-${hide ? 'down' : 'up'}"></i> <span>${hide ? 'Show' : 'Hide'}</span>`;
});

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
  renderInsights();
  renderAI();
  applyCover();
  trackImages();
  if (window.Extras) Extras.update(tasks, { name: profile.n, signedIn: !!(window.DB && DB.user) || !!bootName, pet: profile.p || {}, art: profile.y && Plan.can('pet') ? Img.parts(profile.y).u : '', focus: profile.f || {}, setFocus: (f) => { profile.f = f; if (window.DB && DB.user && DB.setFocus) DB.setFocus(f); }, canSavePet: !syncing && !fromCache && !bootName, setPet: (p) => { profile.p = p; if (window.DB && DB.user && DB.setPet) DB.setPet(p); }, score, dayDiff, view });

  const q = query.toLowerCase();
  const filtered = tasks.filter(t => {
    if (currentFilter === 'pending' && t.done) return false;
    if (currentFilter === 'done' && !t.done) return false;
    if (currentCat !== 'all' && t.tag !== currentCat) return false;
    if (view === 'today' && !(t.due && dayDiff(t.due) === 0)) return false;
    if (view === 'upcoming' && !(!t.done && t.due && dayDiff(t.due) > 0)) return false;
    if (view === 'overdue' && !(!t.done && t.due && dayDiff(t.due) < 0)) return false;
    return !q || t.title.toLowerCase().includes(q);
  });
  if (sortMode !== 'manual') filtered.sort((a, b) => (a.done !== b.done) ? (a.done ? 1 : -1) : sortMode === 'smart' ? score(b) - score(a)
    : sortMode === 'due' ? (a.due || '9999').localeCompare(b.due || '9999') : sortMode === 'prio' ? WEIGHT[b.prio] - WEIGHT[a.prio] : a.title.localeCompare(b.title));

  const listEl = $('task-list');
  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty"><i class="fa-regular fa-clipboard"></i><p>${syncing ? 'Loading your tasks...' : total ? '🔍 No tasks match this view.' : '📝 Your plan is empty. Add a task to get started.'}</p></div>`;
    return;
  }

  const canDrag = currentFilter === 'all' && currentCat === 'all' && view === 'all' && sortMode === 'manual' && !q && !editingId;
  listEl.innerHTML = filtered.map(t => {
    const body = editingId === t.id
      ? `<input class="edit-input" data-edit="${t.id}" value="${escapeHtml(t.title)}" maxlength="140" aria-label="Edit task">`
      : `<div class="task-title">${escapeHtml(t.title)}</div>`;
    // The first picture is the card cover (cropped to fill); the rest stay as small thumbs underneath
    const cover = t.i && t.i.length ? Img.parts(t.i[0]).t : '';
    const extra = t.i ? t.i.length - 1 : 0;
    return `
    <div class="task-item p-${t.prio} ${t.done ? 'completed' : ''} ${window.Extras && Extras.focusId() === t.id ? 'focusing' : ''} ${cover ? 'has-img' : ''}" data-id="${t.id}" ${canDrag ? 'draggable="true"' : ''}>
      ${cover ? `<span class="task-bg" aria-hidden="true"><img src="${escapeHtml(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>` : ''}
      <div class="task-left">
        <button class="check-btn" data-act="toggle" aria-label="Toggle complete"><i class="fa-solid fa-check"></i></button>
        <div class="task-main">
          ${body}
          <div class="badges">
            <span class="badge ${t.prio}"><span class="emo" aria-hidden="true">${PRIO_EMO[t.prio] || '🌤️'}</span> ${t.prio}</span>
            <span class="badge tag" style="--h:${hue(t.tag)}"><i class="fa-solid fa-${CAT_ICON[t.tag] || 'tag'}"></i> ${escapeHtml(t.tag)}</span>
            ${dueBadge(t)}
            ${repBadges(t)}${doneBadges(t)}
            ${upBusy.has(t.id) ? '<span class="badge up"><i class="fa-solid fa-spinner fa-spin"></i> Uploading</span>' : ''}
          </div>
          ${picsHtml(t, cover ? 1 : 0)}
        </div>
        ${cover ? `<span class="pic-wrap task-cover-wrap"><button type="button" class="task-cover" data-pic="0" title="Open picture" aria-label="View image 1${extra ? ` of ${t.i.length}` : ''}"><img src="${escapeHtml(cover)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></button><button class="pic-x" data-picdel="0" title="Remove image" aria-label="Remove image 1"><i class="fa-solid fa-xmark"></i></button>${extra ? `<span class="task-cover-n" aria-hidden="true">📸 ${t.i.length}</span>` : ''}</span>` : ''}
      </div>
      <div class="task-actions">
        ${t.done ? '' : '<button class="del-btn" data-act="focus" title="Focus on this" aria-label="Focus on this"><i class="fa-solid fa-bullseye"></i></button>'}
        <button class="del-btn" data-act="attach" title="Add images" aria-label="Add images"><i class="fa-regular fa-image"></i></button>
        <button class="del-btn" data-act="edit" title="Edit" aria-label="Edit"><i class="fa-solid fa-${editingId === t.id ? 'floppy-disk' : 'pen'}"></i></button>
        <button class="del-btn danger" data-act="delete" title="Delete" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');

  const ed = listEl.querySelector('.edit-input');
  if (ed) { ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); }
}

// AI page side panel: a live snapshot of the plan with one-click next steps
function renderAI() {
  const open = tasks.filter(t => !t.done);
  const top = open.slice().sort((a, b) => score(b) - score(a)).slice(0, 3);
  const glance = [
    ['🗂️', open.length, 'open'],
    ['⏰', open.filter(t => t.due && dayDiff(t.due) === 0).length, 'due today'],
    ['⌛', open.filter(t => t.due && dayDiff(t.due) < 0).length, 'overdue'],
    ['🔥', open.filter(t => t.prio === 'high').length, 'high priority']
  ];
  $('ai-glance').innerHTML = glance.map(([emo, n, label]) => `<div class="ai-gl"><span class="emo" aria-hidden="true">${emo}</span><div><b>${n}</b><span>${label}</span></div></div>`).join('');
  $('ai-next').innerHTML = top.length ? top.map(t => {
    const d = t.due ? dayDiff(t.due) : null;
    const due = d === null ? '' : d < 0 ? `${-d}d late` : d === 0 ? 'today' : d === 1 ? 'tomorrow' : new Date(t.due + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `<li><button type="button" class="ai-next-item" data-focus-id="${t.id}" title="Start a focus session"><span class="emo" aria-hidden="true">${PRIO_EMO[t.prio] || '🌤️'}</span><span class="ai-next-t">${escapeHtml(t.title)}</span>${due ? `<span class="ai-next-d">${due}</span>` : ''}<i class="fa-solid fa-bullseye" aria-hidden="true"></i></button></li>`;
  }).join('') : '<li class="ai-empty">Nothing open. Add a task and it will show up here.</li>';
  $('ai-focus').disabled = !top.length;
}

// Each category gets its own steady color (same name, same hue)
const hue = (s) => ({ Dev: 210, Bug: 350, Study: 270, General: 165 }[s] ?? [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7));
const CAT_ICON = { Dev: 'code', Bug: 'bug', Study: 'book-open', General: 'layer-group' };
let lastImg = null;
function toast(msg, undo) {
  const el = $('toast');
  el.innerHTML = `<span>${escapeHtml(msg)}</span>${undo ? '<button id="undo-btn">Undo</button>' : ''}`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 5000);
  if (undo) $('undo-btn').onclick = () => {
    if (undo === 'img' && lastImg) {
      const L = lastImg; lastImg = null;
      tasks = tasks.map(x => { if (x.id !== L.id) return x; const i = [...(x.i || [])]; i.splice(Math.min(L.k, i.length), 0, L.s); return { ...x, i }; });
      render();
    } else if (lastDeleted) { tasks.splice(Math.min(lastDeleted.index, tasks.length), 0, lastDeleted.task); lastDeleted = null; render(); }
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
  const pdel = e.target.closest('[data-picdel]');
  if (pdel) { removeTaskImage(Number(pdel.closest('.task-item').dataset.id), Number(pdel.dataset.picdel)); return; }
  const pic = e.target.closest('[data-pic]');
  if (pic) { const tid = Number(pic.closest('.task-item').dataset.id), pt = tasks.find(x => x.id === tid); if (pt) Img.open(pt.i, Number(pic.dataset.pic), (n) => removeTaskImage(tid, n)); return; }
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = Number(btn.closest('.task-item').dataset.id);
  const act = btn.dataset.act;
  if (act === 'attach') { cardTarget = id; $('card-file').click(); return; }
  if (act === 'focus') { const ft = tasks.find(x => x.id === id); if (ft) Extras.startFocus(ft); return render(); }
  if (act === 'toggle') {
    tasks = tasks.map(t => t.id === id ? (t.done ? Habit.reopen(t) : Habit.complete(t)) : t);
    const t = tasks.find(x => x.id === id), st = t && t.done ? Habit.streak(t) : 0;
    if (t && t.done && window.Extras) Extras.celebrate(btn, tasks.every(x => x.done));
    if (t && t.r && st >= 2) toast(`🔥 ${st} in a row for "${t.title}". Keep it going!`);
  }
  else if (act === 'delete') {
    const index = tasks.findIndex(t => t.id === id);
    lastDeleted = { task: tasks[index], index };
    tasks.splice(index, 1);
    toast('🗑️ Task deleted', true);
  } else if (act === 'edit') {
    if (editingId === id) return commitEdit(id);
    return openEdit(id);
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
  if (tasks.length >= Plan.limit('tasks')) return toast(Plan.msg('tasks'));
  if (qa.busy) return toast('Wait for the images to finish uploading.');
  tasks.unshift(mkTask({ title, prio: $('task-prio').value, tag: $('task-tag').value, due: $('task-due').value || '', r: $('task-rep').value, i: qa.list.slice() }));
  $('task-title').value = '';
  $('task-due').value = '';
  $('task-rep').value = '';
  qa.list = []; qa.render();
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
$('views').addEventListener('click', (e) => {
  const b = e.target.closest('.view-btn');
  if (!b) return;
  view = b.dataset.view;
  document.querySelectorAll('.view-btn').forEach(x => x.classList.toggle('active', x === b));
  render();
});
$('sort-mode').addEventListener('change', (e) => { sortMode = e.target.value; render(); });
$('search').addEventListener('input', (e) => { query = e.target.value.trim(); render(); });
$('cat-filter').addEventListener('change', (e) => { currentCat = e.target.value; render(); });
$('clear-done').addEventListener('click', () => {
  const n = tasks.filter(t => t.done && !t.r).length;
  if (!n) return toast('No completed tasks to clear (repeating tasks are kept)');
  tasks = tasks.filter(t => !(t.done && !t.r));
  render();
  toast(`Cleared ${n} completed task${n > 1 ? 's' : ''}. Repeating tasks are kept.`);
});

// Theme: Light, Dark or System. The choice is saved in this browser (jt:theme) and applied before first paint by a tiny script in index.html.
const THEME_KEY = 'jt:theme', darkMq = matchMedia('(prefers-color-scheme: dark)');
let themePref = 'system';
try { const t = localStorage.getItem(THEME_KEY); if (t === 'light' || t === 'dark' || t === 'system') themePref = t; } catch {}
const isDark = () => themePref === 'dark' || (themePref === 'system' && darkMq.matches);
function applyTheme(animate) {
  const dark = isDark(), root = document.documentElement;
  if (animate) { root.classList.add('theming'); clearTimeout(applyTheme.t); applyTheme.t = setTimeout(() => root.classList.remove('theming'), 450); }
  root.dataset.theme = dark ? 'dark' : 'light';
  $('theme-btn').innerHTML = `<i class="fa-solid fa-${dark ? 'sun' : 'moon'}"></i><span class="lbl">${dark ? 'Light' : 'Dark'}</span>`;
  const m = $('theme-color'); if (m) m.content = dark ? '#04060f' : '#eef6fb';
  document.querySelectorAll('input[name="theme"]').forEach(r => { r.checked = r.value === themePref; });
  $('theme-state').textContent = themePref === 'system' ? `System (${dark ? 'dark' : 'light'} now)` : themePref === 'dark' ? 'Dark' : 'Light';
}
function setThemePref(p) {
  themePref = p;
  try { localStorage.setItem(THEME_KEY, p); } catch {}
  applyTheme(true);
}
applyTheme(false);
$('theme-btn').addEventListener('click', () => setThemePref(isDark() ? 'light' : 'dark'));
document.querySelectorAll('input[name="theme"]').forEach(r => r.addEventListener('change', () => r.checked && setThemePref(r.value)));
darkMq.addEventListener('change', () => { if (themePref === 'system') applyTheme(true); });
addEventListener('storage', (e) => { if (e.key === THEME_KEY && ['light', 'dark', 'system'].includes(e.newValue)) { themePref = e.newValue; applyTheme(false); } }); // another tab changed it
$('set-acct').addEventListener('click', () => $('auth-btn').click());
$('set-keys').addEventListener('click', () => $('keys-dlg').showModal());

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
const ready = () => setStatus('online', DB.user ? 'SYNCED' : 'ONLINE');
const setMsg = (text, ok) => { $('acct-msg').textContent = text; $('acct-msg').dataset.ok = ok ? '1' : ''; };

// Rebuild the category dropdowns (defaults + this user's own categories)
function fillCats() {
  const opts = catList().map(c => `<option>${escapeHtml(c)}</option>`).join('');
  const tv = $('task-tag').value, fv = $('cat-filter').value;
  $('task-tag').innerHTML = opts;
  $('ed-tag').innerHTML = opts;
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
  const src = profile.a ? Img.parts(profile.a).u : user.photoURL;
  return src ? `<img class="avatar ${cls}" src="${escapeHtml(src)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar ${cls}">${initial}</span>`;
}
function renderAccount() {
  const user = window.DB && DB.user;
  $('auth-btn').innerHTML = user ? `${avatar(user)}<span>@${escapeHtml(profile.n || '...')}</span>`
    : bootName ? `<span class="avatar">${escapeHtml(bootName[0].toUpperCase())}</span><span>@${escapeHtml(bootName)}</span>`
    : '<i class="fa-brands fa-google"></i><span>Sign in</span>';
  $('auth-btn').title = user ? (user.email || '') : '';
  if (!user) return;
  $('acct-avatar').outerHTML = avatar(user, 'lg').replace('class="avatar', 'id="acct-avatar" class="avatar');
  $('acct-email').textContent = user.email || user.displayName || '';
  $('acct-name').value = profile.n;
  $('av-reset').hidden = !profile.a;
  $('acct-lb').checked = !profile.o;
  renderCats();
}
addEventListener('jaltron:user', (e) => {
  const { user, tasks: saved, profile: p } = e.detail;
  bootName = ''; syncing = !!e.detail.loading; fromCache = !!e.detail.cached; imgPrev = null; // new data arrived: not a deletion
  tasks = Habit.rollover(saved).tasks; profile = p; custom = p.k; Plan.set(p.s); renderPlan();
  nextId = tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  fillCats(); renderAccount(); render();
  ready();
  if (user && !e.detail.cached) toast('Signed in 👋');
});
addEventListener('jaltron:error', (e) => toast(e.detail));
$('auth-btn').addEventListener('click', () => {
  if (!window.DB) return toast('Cloud is still loading, try again');
  if (!DB.user && bootName) return toast('Still connecting to your account...');
  if (!DB.user) { toast('Opening Google sign-in...'); return DB.signIn(); }
  setMsg(''); renderAccount(); $('acct').showModal();
});
$('acct-lb').addEventListener('change', (e) => { profile.o = !e.target.checked; DB.setLbOptOut(profile.o); setMsg(profile.o ? 'You are hidden from the leaderboard.' : 'You are on the leaderboard.', true); });
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
const saveCats = () => { if (window.DB && DB.user) DB.setCats(custom); };
// Shared by the account panel and the Quick Add "New" button. Returns an error text, or '' on success.
function addCategory(raw) {
  const v = String(raw).trim().replace(/\s+/g, ' ');
  if (!v) return 'Type a category name.';
  if (catList().some(c => c.toLowerCase() === v.toLowerCase())) return 'You already have that category.';
  if (custom.length >= Plan.limit('cats')) return Plan.can('img') ? 'You can create up to 12 categories.' : Plan.msg('cats');
  custom.push(v); saveCats();
  fillCats(); renderCats();
  return '';
}
$('cat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = addCategory($('cat-input').value);
  if (err) return setMsg(err);
  $('cat-input').value = '';
  setMsg('Category added.', true);
});
// Quick Add: the visible "New" button opens an inline creator and selects the new category
$('new-cat-btn').addEventListener('click', () => {
  const box = $('quick-cat-box');
  box.classList.toggle('open');
  if (box.classList.contains('open')) $('quick-cat').focus();
});
function quickAddCat() {
  const v = $('quick-cat').value.trim().replace(/\s+/g, ' ');
  const err = addCategory(v);
  if (err) return toast(err);
  $('task-tag').value = v;
  $('quick-cat').value = '';
  $('quick-cat-box').classList.remove('open');
  toast(`Category "${v}" created`);
}
$('quick-cat-add').addEventListener('click', quickAddCat);
$('quick-cat').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); quickAddCat(); } });
$('acct-cats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  const c = b.dataset.cat;
  custom = custom.filter(x => x !== c); saveCats();
  tasks = tasks.map(t => t.tag === c ? { ...t, tag: 'General' } : t); // its tasks move to General
  fillCats(); renderCats(); render(); setMsg(`Removed "${c}". Its tasks moved to General.`, true);
});



// ---- Full task editor (title, priority, category, due date, repeat, streak) ----
let editTaskId = null;
function streakLine(t) { return t.r ? `Current streak: ${Habit.streak(t)}   Best: ${t.b || 0}   Times done: ${(t.h || []).length}` : ''; }
function openEdit(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  editTaskId = id;
  $('ed-title').value = t.title;
  $('ed-prio').value = t.prio;
  $('ed-tag').value = catList().includes(t.tag) ? t.tag : 'General';
  $('ed-due').value = t.due || '';
  $('ed-rep').value = t.r || '';
  $('ed-streak').textContent = streakLine(t);
  ed.list = (t.i || []).slice(); ed.busy = 0; ed.orig = new Set(ed.list); ed.saved = false; ed.render();
  $('ed-reset').style.display = t.r ? '' : 'none';
  $('edit-dlg').showModal();
  $('ed-title').focus();
}
$('edit-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('ed-title').value.trim();
  if (!title) return;
  if (ed.busy) return toast('Wait for the images to finish uploading.');
  tasks = tasks.map(t => {
    if (t.id !== editTaskId) return t;
    const r = $('ed-rep').disabled ? t.r : $('ed-rep').value; // Free accounts keep the repeat a task already has
    let n = { ...t, title, prio: $('ed-prio').value, tag: $('ed-tag').value || t.tag, due: $('ed-due').value || '', r, i: ed.list.slice() };
    ed.saved = true;
    if (r && !t.r) { const day = t.z || Habit.today(); n = { ...n, s: t.done ? 1 : 0, b: t.done ? 1 : 0, l: t.done ? day : '', h: t.done ? [day] : [] }; }
    if (!r) n = { ...n, s: 0, b: 0, l: '', h: [] };
    return n;
  });
  $('edit-dlg').close();
  render();
  toast('✅ Task updated');
});
$('ed-reset').addEventListener('click', () => {
  tasks = tasks.map(t => t.id === editTaskId ? { ...t, s: 0, b: 0 } : t);
  $('ed-streak').textContent = streakLine(tasks.find(t => t.id === editTaskId));
  render();
  toast('Streak reset');
});
$('ed-del').addEventListener('click', () => {
  const index = tasks.findIndex(t => t.id === editTaskId);
  if (index < 0) return;
  lastDeleted = { task: tasks[index], index };
  tasks.splice(index, 1);
  $('edit-dlg').close();
  render();
  toast('Task deleted', true);
});
$('ed-close').addEventListener('click', () => $('edit-dlg').close());
$('edit-dlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

// ---- AI chat ----
// Run actions the assistant returns (add, complete, delete, prio, clear, optimize, filter)
function applyActions(actions) {
  for (const a of actions) {
    if (a.type === 'add' && a.title && tasks.length < Plan.limit('tasks')) tasks.unshift(mkTask({ title: String(a.title).slice(0, 140), prio: WEIGHT[a.prio] ? a.prio : 'medium', tag: a.tag || 'General', due: a.due || '', r: REPS.includes(a.rep) ? a.rep : '' }));
    else if (a.type === 'add' && a.title) toast(Plan.msg('tasks'));
    else if (a.type === 'complete') tasks = tasks.map(t => t.id === a.id ? Habit.complete(t) : t);
    else if (a.type === 'delete') { const i = tasks.findIndex(t => t.id === a.id); if (i >= 0) { lastDeleted = { task: tasks[i], index: i }; tasks = tasks.filter(t => t.id !== a.id); } }
    else if (a.type === 'undo') {
      if (lastDeleted) { tasks.splice(Math.min(lastDeleted.index, tasks.length), 0, lastDeleted.task); lastDeleted = null; toast('♻️ Task restored'); }
    }
    else if (a.type === 'focus') { const ft = tasks.find(t => t.id === a.id); if (ft && window.Extras) setTimeout(() => Extras.startFocus(ft), 60); }
    else if (a.type === 'prio' && WEIGHT[a.prio]) tasks = tasks.map(t => t.id === a.id ? { ...t, prio: a.prio } : t);
    else if (a.type === 'clear_done') { tasks = tasks.filter(t => !(t.done && !t.r)); lastDeleted = null; }
    else if (a.type === 'complete_all') tasks = tasks.map(t => t.done ? t : Habit.complete(t));
    else if (a.type === 'clear_all') { tasks = []; lastDeleted = null; }
    else if (a.type === 'reopen') tasks = tasks.map(t => t.id === a.id ? Habit.reopen(t) : t);
    else if (a.type === 'rename' && a.title) tasks = tasks.map(t => t.id === a.id ? { ...t, title: String(a.title).slice(0, 140) } : t);
    else if (a.type === 'due') tasks = tasks.map(t => t.id === a.id ? { ...t, due: a.due || '' } : t);
    else if (a.type === 'tag' && catList().includes(a.tag)) tasks = tasks.map(t => t.id === a.id ? { ...t, tag: a.tag } : t);
    else if (a.type === 'search') { query = String(a.q || ''); $('search').value = query; }
    else if (a.type === 'deposit' && a.n && window.Bank) Bank.deposit(Number(a.n));
    else if (a.type === 'withdraw' && a.n && window.Bank) Bank.withdraw(Number(a.n));
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
// ---- AI page (everything lives in ai.js) ----
let aiBusy = false, aiSeq = 0;
async function ask(text) {
  if (aiBusy) return;
  addMsg('user', text);
  chatMsgs.push({ role: 'user', content: text });
  if (typeof JaltronAI === 'undefined') return addMsg('ai', 'ai.js did not load. Upload ai.js next to index.html and redeploy.');
  aiBusy = true;
  const seq = aiSeq;
  let typing = null;
  const timer = setTimeout(() => { if (seq === aiSeq) typing = addMsg('ai typing', 'Thinking…'); }, 250);
  try {
    const res = await JaltronAI.reply(text, tasks, chatMsgs);
    if (seq !== aiSeq) return; // a new chat started while this answer was on its way
    clearTimeout(timer);
    if (typing) typing.remove();
    addMsg('ai', res.reply);
    chatMsgs.push({ role: 'assistant', content: res.reply });
    if (res.actions && res.actions.length) applyActions(res.actions);
  } catch (err) {
    console.error(err);
    clearTimeout(timer);
    if (typing) typing.remove();
    if (seq === aiSeq) addMsg('ai', 'Something went wrong while answering. Try again.');
  } finally {
    if (seq === aiSeq) aiBusy = false;
  }
}
// The assistant has its own page; the FAB, sidebar bar and C shortcut all land here
function openAI() {
  const leaving = document.querySelector('.page.active')?.dataset.page !== 'ai';
  if (leaving) location.hash = '#ai';
  setTimeout(() => $('chat-input').focus(), leaving ? 80 : 0);
}
const AI_HELLO = 'Hi, I am JALTRON 👋. I run on this device and handle your tasks: add, complete, plan, focus, snooze, streaks, math and dates. Try: add fix login bug tomorrow high · plan my day · rescue my week · what am I forgetting?';
function newChat() {
  aiSeq++; aiBusy = false; // drop any answer still on its way from the old chat
  if (window.JaltronAI && JaltronAI.reset) JaltronAI.reset();
  chatMsgs.length = 0;
  log.innerHTML = '';
  addMsg('ai', AI_HELLO);
  $('chat-input').focus();
}
$('chat-fab').addEventListener('click', openAI);
$('chat-clear').addEventListener('click', newChat);
$('chips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) ask(b.dataset.ask || b.textContent); });
$('ai-asks').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) ask(b.dataset.ask || b.textContent); });
$('ai-next').addEventListener('click', (e) => {
  const b = e.target.closest('[data-focus-id]');
  if (!b) return;
  const t = tasks.find(x => x.id === Number(b.dataset.focusId));
  if (t && window.Extras) Extras.startFocus(t);
});
$('ai-focus').addEventListener('click', () => {
  const t = tasks.filter(x => !x.done).sort((a, b) => score(b) - score(a))[0];
  if (t && window.Extras) Extras.startFocus(t);
});
$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('chat-input').value.trim();
  if (v && !aiBusy) { $('chat-input').value = ''; ask(v); }
});
addMsg('ai', AI_HELLO);

// New day: reopen finished repeating tasks, refresh due labels and streaks
let lastDay = Habit.today();
function dayCheck() {
  const d = Habit.today();
  if (d === lastDay) return;
  lastDay = d;
  tasks = Habit.rollover(tasks).tasks;
  render();
}
setInterval(dayCheck, 60000);
setInterval(() => Habit.tickResets(), 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) dayCheck(); });

// ---- Images (ImgBB, see lib.js). Stored as short "path|thumb|delete code" strings in task.i ----
// When a picture disappears from every task and from your profile, its ImgBB copy is deleted too.
// The 7 second wait keeps "Undo" working: undoing puts the picture back before anything is deleted.
let imgPrev = null, imgNow = new Set();
function trackImages() {
  const cur = new Set(), add = (s) => { const d = s && Img.delId(s); if (d) cur.add(d); };
  tasks.forEach(t => (t.i || []).forEach(add));
  add(profile.a); add(profile.c); add(profile.y);
  (window.Links ? Links.pics() : []).forEach(add);
  imgNow = cur;
  if (imgPrev) imgPrev.forEach(d => { if (!cur.has(d)) setTimeout(() => { if (!imgNow.has(d)) Img.remove(d); }, 7000); });
  imgPrev = cur;
}
let cardTarget = null;
const upBusy = new Map(); // task id -> pictures still uploading
const picsHtml = (t, from = 0) => (t.i && t.i.length > from
  ? `<div class="pics">${t.i.slice(from).map((p, k) => { const i = k + from; return `<span class="pic-wrap"><button class="pic" data-pic="${i}" aria-label="View image ${i + 1}"><img src="${escapeHtml(Img.parts(p).t)}" alt="" loading="lazy"></button><button class="pic-x" data-picdel="${i}" title="Remove image" aria-label="Remove image ${i + 1}"><i class="fa-solid fa-xmark"></i></button></span>`; }).join('')}</div>` : '');
function removeTaskImage(id, k) {
  const t = tasks.find(x => x.id === id);
  if (!t || !t.i || !t.i[k]) return t ? t.i : [];
  lastImg = { id, k, s: t.i[k] };
  const list = t.i.filter((_, n) => n !== k);
  tasks = tasks.map(x => x.id === id ? { ...x, i: list } : x);
  toast('Image removed', 'img'); render();
  return list;
}
const thumbsHtml = (list, busy) => list.map((p, k) =>
  `<div class="thumb"><button type="button" class="pv" data-pv="${k}" aria-label="View image ${k + 1}"><img src="${escapeHtml(Img.parts(p).t)}" alt=""></button><button type="button" class="x" data-rm="${k}" aria-label="Remove image ${k + 1}"><i class="fa-solid fa-xmark"></i></button></div>`).join('')
  + '<div class="thumb busy" aria-label="Uploading"><i class="fa-solid fa-spinner fa-spin"></i></div>'.repeat(busy);
const mkStore = (thumbsId, dropId) => ({ list: [], busy: 0,
  render() { $(thumbsId).innerHTML = thumbsHtml(this.list, this.busy); $(dropId).disabled = this.list.length + this.busy >= Img.MAX; } });
const qa = mkStore('qa-thumbs', 'qa-drop'), ed = mkStore('ed-thumbs', 'ed-drop');
ed.orig = new Set(); ed.saved = true;

async function attachFiles(files, store) {
  files = [...files].filter(f => f.type.startsWith('image/'));
  if (!files.length) return toast('Choose image files (JPG, PNG, GIF or WebP).');
  const room = Img.MAX - store.list.length - store.busy;
  if (room <= 0) return toast(`A task can hold up to ${Img.MAX} images.`);
  if (files.length > room) toast(`Only ${room} more fit. The rest were skipped.`);
  await Promise.all(files.slice(0, room).map(async (f) => {
    store.busy++; store.render();
    try { const s = await Img.upload(f); if (s) store.list.push(s); } catch (err) { toast(err.message || 'Upload failed. Try again.'); }
    store.busy--; store.render();
  }));
}
async function attachToTask(id, files) {
  files = [...files].filter(f => f.type.startsWith('image/'));
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  if (!files.length) return toast('Choose image files (JPG, PNG, GIF or WebP).');
  const room = Img.MAX - (t.i || []).length - (upBusy.get(id) || 0);
  if (room <= 0) return toast(`A task can hold up to ${Img.MAX} images.`);
  files = files.slice(0, room);
  upBusy.set(id, (upBusy.get(id) || 0) + files.length); render();
  const got = [];
  await Promise.all(files.map(async (f) => { try { const s = await Img.upload(f); if (s) got.push(s); } catch (err) { toast(err.message || 'Upload failed. Try again.'); } }));
  const left = (upBusy.get(id) || 0) - files.length;
  left > 0 ? upBusy.set(id, left) : upBusy.delete(id);
  if (got.length) { tasks = tasks.map(x => x.id === id ? { ...x, i: [...(x.i || []), ...got].slice(0, Img.MAX) } : x); toast(`${got.length} image${got.length > 1 ? 's' : ''} added`); }
  render();
}
function bindStore(store, dropId, fileId, thumbsId) {
  $(dropId).addEventListener('click', () => $(fileId).click());
  $(fileId).addEventListener('change', (e) => { const f = [...e.target.files]; e.target.value = ''; attachFiles(f, store); });
  const dz = $(dropId);
  dz.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); dz.classList.add('over'); } });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); attachFiles(e.dataTransfer.files, store); });
  $(thumbsId).addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]'), pv = e.target.closest('[data-pv]');
    if (rm) {
      const [gone] = store.list.splice(Number(rm.dataset.rm), 1);
      if (!store.orig || !store.orig.has(gone)) Img.remove(Img.delId(gone)); // never saved on a task, so delete it right away
      store.render();
    }
    else if (pv) Img.open(store.list, Number(pv.dataset.pv), (n) => { store.list.splice(n, 1); store.render(); return store.list; });
  });
}
bindStore(qa, 'qa-drop', 'qa-file', 'qa-thumbs');
bindStore(ed, 'ed-drop', 'ed-file', 'ed-thumbs');
$('card-file').addEventListener('change', (e) => { const f = [...e.target.files], id = cardTarget; e.target.value = ''; if (id != null) attachToTask(id, f); });
// Drop pictures straight onto a task card
$('task-list').addEventListener('dragover', (e) => {
  const it = e.target.closest('.task-item');
  if (!it || ![...e.dataTransfer.types].includes('Files')) return;
  e.preventDefault();
  $('task-list').querySelectorAll('.file-over').forEach(x => x.classList.remove('file-over'));
  it.classList.add('file-over');
});
$('task-list').addEventListener('dragleave', (e) => { const it = e.target.closest('.task-item'); if (it && !it.contains(e.relatedTarget)) it.classList.remove('file-over'); });
$('task-list').addEventListener('drop', (e) => {
  const it = e.target.closest('.task-item');
  $('task-list').querySelectorAll('.file-over').forEach(x => x.classList.remove('file-over'));
  if (!it || !e.dataTransfer.files.length) return;
  e.preventDefault();
  attachToTask(Number(it.dataset.id), e.dataTransfer.files);
});
// Paste a screenshot or copied picture
document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData ? e.clipboardData.files : [])].filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  if ($('edit-dlg').open) { e.preventDefault(); attachFiles(files, ed); }
  else if (document.activeElement === $('task-title')) { e.preventDefault(); attachFiles(files, qa); }
});
// Closing the editor without saving: pictures added just now were never kept, so delete them
$('edit-dlg').addEventListener('close', () => { if (!ed.saved) ed.list.forEach(s => { if (!ed.orig.has(s)) Img.remove(Img.delId(s)); }); ed.saved = true; });
// Draw your pet
$('pet-draw').addEventListener('click', () => {
  if (!(window.DB && DB.user)) return toast('Sign in to draw and save your pet.');
  if (!Plan.can('pet')) return toast(Plan.msg('pet'));
  Draw.open({
    src: profile.y ? Img.parts(profile.y).u : '',
    onSave: async (file) => { const s = await Img.upload(file, { crop: false }); if (!s) return; profile.y = s; DB.setPetArt(s); render(); toast('Your pet is saved'); },
    onReset: () => { profile.y = ''; DB.setPetArt(''); render(); toast('Pet removed'); }
  });
});
// Home cover picture
function applyCover() {
  const hero = $('hero'), c = profile && profile.c ? Img.parts(profile.c).u : '';
  hero.style.setProperty('--cover', c ? `url("${encodeURI(c)}")` : 'none');
  hero.classList.toggle('has-cover', !!c);
  $('cover-reset').hidden = !c;
}
$('cover-btn').addEventListener('click', () => { if (!(window.DB && DB.user)) return toast('Sign in to set a cover picture.'); $('cover-file').click(); });
$('cover-file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  toast('Uploading cover...');
  try { const s = await Img.upload(f, { crop: { preset: '16:9' } }); if (!s) return; profile.c = s; DB.setCover(profile.c); applyCover(); toast('Cover updated'); }
  catch (err) { toast(err.message || 'Upload failed. Try again.'); }
});
$('cover-reset').addEventListener('click', () => { profile.c = ''; DB.setCover(''); applyCover(); toast('Cover removed'); });
// Profile picture (square, 256 px)
$('av-change').addEventListener('click', () => $('av-file').click());
$('av-file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  setMsg('Uploading picture...', true);
  try { const s = await Img.upload(f, { square: 256, crop: { preset: '1:1', w: 256, h: 256 } }); if (!s) return; profile.a = s; DB.setAvatar(profile.a); renderAccount(); setMsg('Picture updated.', true); }
  catch (err) { setMsg(err.message || 'Upload failed. Try again.'); }
});
$('av-reset').addEventListener('click', () => { profile.a = ''; DB.setAvatar(''); renderAccount(); setMsg('Using your Google photo.', true); });

// Paint the last session's tasks immediately, before Firebase has even finished loading
try {
  const last = localStorage.getItem('jc:last'), c = last && JSON.parse(localStorage.getItem('jc:' + last));
  if (c && Array.isArray(c.tasks)) {
    tasks = Habit.rollover(c.tasks).tasks; profile = c.profile || profile; custom = profile.k || []; bootName = profile.n || '';
    nextId = tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    fillCats(); renderAccount();
  }
} catch {}
render();
// Sidebar AI command bar: opens the AI page and runs the command
$('cmd-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('cmd-input').value.trim();
  if (!v) return;
  $('cmd-input').value = '';
  openAI();
  ask(v);
});
setStatus('demo', 'CONNECTING');
setTimeout(() => { if (!window.DB) setStatus('offline', 'OFFLINE'); }, 8000);
// Plans page: current plan and expiry
function renderPlan() {
  $('nav-plan').textContent = Plan.name;
  $('plan-state').textContent = Plan.id === 'lite' ? (Plan.until ? `Lite until ${new Date(Plan.until).toLocaleDateString()}` : 'Lite is active') : 'Free plan';
  ['task-rep', 'ed-rep'].forEach(id => { const el = $(id); el.disabled = !Plan.can('repeat'); el.title = Plan.can('repeat') ? '' : 'Repeating tasks need Lite'; if (el.disabled) el.value = ''; });
}
$('plan-copy-msg').addEventListener('click', () => {
  const uid = window.DB && DB.user ? DB.user.uid : '';
  if (!uid) return toast('Sign in first, so your account ID is in the message.');
  const msg = `Hi! I want to get JALTRON Lite. My account ID: ${uid}`;
  navigator.clipboard.writeText(msg).then(() => toast('Message copied. Paste it to staff on Discord.'), () => toast('Could not copy. Try again.'));
});
renderPlan();
