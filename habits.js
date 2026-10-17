'use strict';
// JALTRON habits: repeating tasks, streaks, completion history and SVG charts.
// Task fields added by this file:  r repeat ('' | 'd' daily | 'wd' weekdays | 'w' weekly)
//   s current streak, b best streak, l last completed day, h completed days (last 90), z day a one-off task was finished
(function (root) {
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const dow = (s) => new Date(s + 'T00:00').getDay();
  const isWeekend = (s) => dow(s) === 0 || dow(s) === 6;
  const esc = (x) => String(x).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const REP = { d: 'Daily', wd: 'Weekdays', w: 'Weekly' };

  // The latest day that still keeps a streak alive when finishing on `day`
  function prevDay(r, day) {
    if (r === 'w') return addDays(day, -7);
    let p = addDays(day, -1);
    if (r === 'wd') while (isWeekend(p)) p = addDays(p, -1);
    return p;
  }

  function complete(t, day = today()) {
    if (!t.r) return { ...t, done: true, z: day };
    if (t.l === day) return { ...t, done: true };
    const s = (t.s || 0) + 1; // streaks never reset: a missed day just pauses them
    return { ...t, done: true, s, b: Math.max(t.b || 0, s), l: day, z: day, h: [...(t.h || []), day].slice(-90) };
  }

  function reopen(t, day = today()) {
    if (t.r && t.l === day) { // undo today's completion and give the streak back
      const h = [...(t.h || [])], i = h.lastIndexOf(day);
      if (i > -1) h.splice(i, 1);
      const s = Math.max(0, (t.s || 0) - 1);
      return { ...t, done: false, s, b: (t.b || 0) === (t.s || 0) ? s : t.b, l: h[h.length - 1] || '', h, z: '' };
    }
    return { ...t, done: false, z: '' };
  }

  // Streak as shown to the user. It never drops back to 0 when a day is missed.
  function streak(t) { return t.r && t.s ? t.s : 0; }

  // Has a finished repeating task started a new round?
  function needsReset(t, day) {
    if (!t.r || !t.done || !t.l) return false;
    if (t.r === 'w') return t.l <= addDays(day, -7);
    if (t.r === 'wd' && isWeekend(day)) return false;
    return t.l < day;
  }

  // Reopens finished repeating tasks for the new day and moves their due date forward
  function rollover(tasks, day = today()) {
    let changed = false;
    const out = tasks.map(t => {
      if (!needsReset(t, day)) return t;
      changed = true;
      let due = t.due;
      if (due) {
        if (t.r === 'w') { while (due < day) due = addDays(due, 7); } else due = day;
      }
      return { ...t, done: false, z: '', due };
    });
    return { tasks: out, changed };
  }

  // ---- numbers for the dashboard ----
  function completions(tasks) {
    const m = new Map();
    const add = (d) => m.set(d, (m.get(d) || 0) + 1);
    tasks.forEach(t => {
      if (t.r) (t.h || []).forEach(add);
      else if (t.done && t.z) add(t.z);
    });
    return m;
  }
  function lastDays(map, n = 7, end = today()) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = addDays(end, -i);
      out.push({ day: d, label: new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short' }), count: map.get(d) || 0 });
    }
    return out;
  }
  // Days in a row with at least one finished task (today may still be empty)
  function activeStreak(map, end = today()) {
    let d = map.get(end) ? end : addDays(end, -1), n = 0;
    while (map.get(d)) { n++; d = addDays(d, -1); }
    return n;
  }
  function bestActive(map) {
    const days = [...map.keys()].filter(d => map.get(d) > 0).sort();
    let best = 0, run = 0, prev = '';
    days.forEach(d => { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; });
    return best;
  }
  const group = (tasks, key) => {
    const m = new Map();
    tasks.forEach(t => m.set(t[key], (m.get(t[key]) || 0) + 1));
    return [...m].map(([label, value]) => ({ label, value }));
  };

  // ---- SVG charts (no libraries) ----
  const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b', '#14b8a6', '#a855f7', '#eab308'];

  function donut(slices, centerLabel = 'tasks', colors) {
    const items = slices.filter(s => s.value > 0);
    const total = items.reduce((a, s) => a + s.value, 0);
    const R = 50, C = 2 * Math.PI * R;
    let off = 0, rings = '';
    items.forEach((s, i) => {
      s.color = s.color || (colors && colors[s.label]) || PALETTE[i % PALETTE.length];
      const len = s.value / total * C;
      rings += `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${s.color}" stroke-width="22" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${esc(s.label)}: ${s.value}</title></circle>`;
      off += len;
    });
    const svg = `<svg viewBox="0 0 140 140" class="donut" role="img" aria-label="${esc(centerLabel)} chart"><circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--panel-3)" stroke-width="22"/>${rings}<text x="70" y="68" text-anchor="middle" class="donut-n">${total}</text><text x="70" y="84" text-anchor="middle" class="donut-l">${esc(centerLabel)}</text></svg>`;
    const legend = total
      ? items.map(s => `<li><i style="background:${s.color}"></i><span>${esc(s.label)}</span><b>${s.value}</b><em>${Math.round(s.value / total * 100)}%</em></li>`).join('')
      : '<li class="none">No data yet</li>';
    return `<div class="donut-wrap">${svg}<ul class="legend">${legend}</ul></div>`;
  }

  function bars(data) {
    const W = 280, H = 130, base = 104, max = Math.max(1, ...data.map(d => d.count));
    const bw = 24, gap = (W - data.length * bw) / (data.length + 1);
    const cols = data.map((d, i) => {
      const h = Math.round(d.count / max * 78), x = gap + i * (bw + gap);
      return `<g><rect x="${x}" y="${base - h}" width="${bw}" height="${Math.max(h, d.count ? 2 : 0)}" rx="4" class="bar${d.day === today() ? ' now' : ''}"><title>${d.day}: ${d.count} done</title></rect>`
        + `<text x="${x + bw / 2}" y="${base - h - 6}" text-anchor="middle" class="bar-v">${d.count || ''}</text>`
        + `<text x="${x + bw / 2}" y="${base + 16}" text-anchor="middle" class="bar-l">${esc(d.label)}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="bars" role="img" aria-label="Tasks completed in the last 7 days"><line x1="0" y1="${base}" x2="${W}" y2="${base}" class="axis"/>${cols}</svg>`;
  }

  function heatmap(map, weeks = 12, end = today()) {
    const start = addDays(end, -(weeks * 7 - 1) - dow(end)), cell = 14, gap = 3, W = weeks * (cell + gap), H = 7 * (cell + gap);
    let rects = '';
    for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
      const day = addDays(start, w * 7 + d);
      if (day > end) continue;
      const n = map.get(day) || 0, lvl = n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4;
      rects += `<rect x="${w * (cell + gap)}" y="${d * (cell + gap)}" width="${cell}" height="${cell}" rx="3" class="heat h${lvl}"><title>${day}: ${n} done</title></rect>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="heatmap" role="img" aria-label="Completed tasks in the last ${weeks} weeks">${rects}</svg>`;
  }

  function week7(t, end = today()) {
    const h = new Set(t.h || []);
    return Array.from({ length: 7 }, (_, i) => { const d = addDays(end, i - 6); return `<i class="dot${h.has(d) ? ' on' : ''}" title="${d}"></i>`; }).join('');
  }

  root.Habit = { REP, today, addDays, complete, reopen, streak, rollover, completions, lastDays, activeStreak, bestActive, group, donut, bars, heatmap, week7 };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Habit;
})(typeof window !== 'undefined' ? window : globalThis);