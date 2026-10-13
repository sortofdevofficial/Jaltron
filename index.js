'use strict';

// --- ROTATING FAVICON GENERATOR ---
const canvas = document.createElement('canvas');
canvas.width = 64; canvas.height = 64;
const ctx = canvas.getContext('2d');
let angle = 0;

function updateFavicon() {
  ctx.clearRect(0, 0, 64, 64);
  ctx.save();
  ctx.translate(32, 32);
  ctx.rotate((angle * Math.PI) / 180);

  // Outer ring
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.strokeStyle = '#00f3ff';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Core teeth
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 1.5);
  ctx.strokeStyle = '#ff0055';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();

  // Center dot
  ctx.beginPath();
  ctx.arc(32, 32, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#00f3ff';
  ctx.fill();

  const favicon = document.getElementById('favicon');
  if (favicon) favicon.href = canvas.toDataURL('image/png');

  angle = (angle + 6) % 360;
}
setInterval(updateFavicon, 100);

// --- APP STATE & DOM ---
const $ = (id) => document.getElementById(id);
let tasks = JSON.parse(localStorage.getItem('jaltron_tasks') || '[]');
let currentFilter = 'all';
let theme = 'cyan';

// --- RENDER & STATS ---
function saveAndRender() {
  localStorage.setItem('jaltron_tasks', JSON.stringify(tasks));
  
  // Stats
  $('stat-total').textContent = tasks.length;
  $('stat-pending').textContent = tasks.filter(t => !t.done).length;
  $('stat-done').textContent = tasks.filter(t => t.done).length;
  $('stat-high').textContent = tasks.filter(t => !t.done && t.prio === 'high').length;

  // Filter List
  const listEl = $('task-list');
  listEl.innerHTML = '';

  const filtered = tasks.filter(t => {
    if (currentFilter === 'pending') return !t.done;
    if (currentFilter === 'done') return t.done;
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="text-align:center; padding:20px; color:var(--muted);">No tasks found.</div>`;
    return;
  }

  filtered.forEach(task => {
    const item = document.createElement('div');
    item.className = `task-item ${task.done ? 'completed' : ''}`;
    item.innerHTML = `
      <div class="task-left">
        <button class="check-btn" onclick="toggleTask(${task.id})">
          ${task.done ? '<i class="fa-solid fa-check"></i>' : ''}
        </button>
        <div>
          <div>${escapeHtml(task.title)}</div>
          <div style="margin-top: 4px; display: flex; gap: 4px;">
            <span class="badge ${task.prio}">${task.prio}</span>
            <span class="badge tag">${task.tag}</span>
          </div>
        </div>
      </div>
      <button class="del-btn" onclick="deleteTask(${task.id})"><i class="fa-solid fa-trash"></i></button>
    `;
    listEl.appendChild(item);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

// --- ACTIONS ---
window.toggleTask = (id) => {
  tasks = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
  saveAndRender();
};

window.deleteTask = (id) => {
  tasks = tasks.filter(t => t.id !== id);
  saveAndRender();
};

$('task-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('task-title').value.trim();
  if (!title) return;

  tasks.unshift({
    id: Date.now(),
    title,
    prio: $('task-prio').value,
    tag: $('task-tag').value,
    done: false
  });

  $('task-title').value = '';
  saveAndRender();
});

// AI Prioritize Sort
$('ai-sort-btn').addEventListener('click', () => {
  const prioWeight = { high: 3, medium: 2, low: 1 };
  tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return prioWeight[b.prio] - prioWeight[a.prio];
  });
  saveAndRender();
});

// Filters
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.filter;
    saveAndRender();
  });
});

// Theme Switcher
$('theme-btn').addEventListener('click', () => {
  theme = theme === 'cyan' ? 'ultron' : 'cyan';
  document.body.dataset.theme = theme;
  $('theme-label').textContent = theme.toUpperCase();
});

// Initial load
saveAndRender();