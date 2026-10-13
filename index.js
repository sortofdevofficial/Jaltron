'use strict';

const $ = (id) => document.getElementById(id);

// State lives in memory only (no localStorage / cookies).
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
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const overdue = tasks.filter(t => !t.done && t.due && dayDiff(t.due) < 0).length;
  $('stat-total').textContent = total;
  $('stat-pending').textContent = total - done;
  $('stat-done').textContent = done;
  $('stat-high').textContent = tasks.filter(t => !t.done && t.prio === 'high').length;
  $('stat-overdue').textContent = overdue;
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

  listEl.innerHTML = filtered.map(t => {
    const body = editingId === t.id
      ? `<input class="edit-input" data-edit="${t.id}" value="${escapeHtml(t.title)}" maxlength="140" aria-label="Edit task">`
      : `<div class="task-title">${escapeHtml(t.title)}</div>`;
    return `
    <div class="task-item p-${t.prio} ${t.done ? 'completed' : ''}" data-id="${t.id}">
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
  toast('Plan optimized by impact score');
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

// Export / Import (file-based backup, no browser storage)
$('export-btn').addEventListener('click', () => {
  if (!tasks.length) return toast('Nothing to export yet');
  const blob = new Blob([JSON.stringify({ app: 'jaltron', tasks }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `jaltron-plan-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('import-btn').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.tasks;
    if (!Array.isArray(list)) throw new Error('bad');
    tasks = list.filter(t => t && typeof t.title === 'string').map(t => ({
      id: nextId++,
      title: t.title.slice(0, 140),
      prio: WEIGHT[t.prio] ? t.prio : 'medium',
      tag: ['Dev', 'Bug', 'Study', 'General'].includes(t.tag) ? t.tag : 'General',
      due: /^\d{4}-\d{2}-\d{2}$/.test(t.due || '') ? t.due : '',
      done: !!t.done
    }));
    render();
    toast(`Imported ${tasks.length} tasks`);
  } catch { toast('Import failed: not a valid JALTRON file'); }
});

// Theme (in-memory only; follows system preference on load)
function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('theme-btn').innerHTML = `<i class="fa-solid fa-${dark ? 'sun' : 'moon'}"></i>`;
}
setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
$('theme-btn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme !== 'dark'));
$('notice-close').addEventListener('click', () => $('notice').remove());

// "/" focuses search
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('search').focus(); }
});

// Keep due-date labels fresh
setInterval(render, 60000 * 30);
render();