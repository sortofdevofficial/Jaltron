'use strict';
// JALTRON lib: the small scripts in one file (plan limits, habits and streaks, image upload and viewer, pet drawing pad, focus timer, Discord card).
// Each part is its own self-contained block, in the same order they used to load.

// ================= plan =================
// JALTRON plans. Staff activate Lite by creating the Firestore doc s/<uid> = { p: 'lite', e: <expiry in ms, optional> } (clients can only read it).
(function (root) {
  const PLANS = {
    free: { name: 'Free', tasks: 25, cats: 3, repeat: false, img: false, pet: false, insights: false },
    lite: { name: 'Lite', tasks: Infinity, cats: 12, repeat: true, img: true, pet: true, insights: true }
  };
  const NEED = { tasks: 'The Free plan holds 25 tasks.', cats: 'The Free plan allows 3 categories.', repeat: 'Repeating tasks and streaks', img: 'Pictures', pet: 'The growing pet', insights: 'Insights' };
  let id = 'free', until = 0;
  function set(s) {
    until = (s && s.e) || 0;
    id = s && s.p === 'lite' && (!until || until > Date.now()) ? 'lite' : 'free';
    document.documentElement.dataset.plan = id;
  }
  const limit = (f) => PLANS[id][f];
  const can = (f) => !!PLANS[id][f];
  // Message shown when a Free account hits a Lite feature
  const msg = (f) => `${NEED[f]}${f === 'tasks' || f === 'cats' ? '' : ' is a Lite feature.'} Talk to staff on Discord to get Lite.`;
  root.Plan = { set, limit, can, msg, get id() { return id; }, get name() { return PLANS[id].name; }, get until() { return until; } };
  set(null);
})(window);

// ================= habits =================
// JALTRON habits: repeating tasks, streaks, completion history and SVG charts.
// Task fields added by this file:  r repeat ('' | 'd' daily | 'wd' weekdays | 'we' weekends | 'w' weekly)
//   s current streak, b best streak, l last completed day, h completed days (last 90), z day a one-off task was finished
(function (root) {
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const dow = (s) => new Date(s + 'T00:00').getDay();
  const isWeekend = (s) => dow(s) === 0 || dow(s) === 6;
  const esc = (x) => String(x).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const REP = { d: 'Daily', wd: 'Weekdays', we: 'Weekends', w: 'Weekly' };

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
    if (t.r === 'we' && !isWeekend(day)) return false;
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

  // ---- reset timer: when does a finished repeating task come back? ----
  function nextReset(t) {
    if (!t.r || !t.l) return '';
    if (t.r === 'w') return addDays(t.l, 7);
    let n = addDays(t.l, 1);
    if (t.r === 'wd') while (isWeekend(n)) n = addDays(n, 1);
    if (t.r === 'we') while (!isWeekend(n)) n = addDays(n, 1);
    return n;
  }
  function fmtLeft(ms) {
    if (ms <= 0) return 'now';
    const m = Math.ceil(ms / 60000), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m}m`;
  }
  // Badge that counts down to the reset (index.js and extras.js keep it ticking through data-reset)
  function resetBadge(t) {
    const n = nextReset(t);
    if (!t.r || !t.done || !n) return '';
    const when = new Date(n + 'T00:00').toLocaleDateString(undefined, { weekday: 'long' });
    return `<span class="badge reset" data-reset="${n}" title="Comes back ${when} at 00:00"><i class="fa-solid fa-rotate"></i> Resets in <b>${fmtLeft(new Date(n + 'T00:00') - new Date())}</b></span>`;
  }
  function tickResets(root = document) {
    root.querySelectorAll('[data-reset]').forEach(el => { const b = el.querySelector('b'); if (b) b.textContent = fmtLeft(new Date(el.dataset.reset + 'T00:00') - new Date()); });
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

  root.Habit = { REP, nextReset, fmtLeft, resetBadge, tickResets, today, addDays, complete, reopen, streak, rollover, completions, lastDays, activeStreak, bestActive, group, donut, bars, heatmap, week7 };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Habit;
})(typeof window !== 'undefined' ? window : globalThis);

// ================= upload (browser image tools) =================
// JALTRON images: upload to ImgBB through /api/image (the key stays on the server), keep Firestore small, and view pictures in a lightbox.
// Stored form (one short string per picture): "<path>|<thumb path>|<delete code>", e.g. "Ab3dEf/photo.jpg|Gh5jKl/photo.jpg|Xy12/9f8e..."
// The common "https://i.ibb.co/" start is removed when saving and added back when showing.
(function (root) {
  const MAX = 4;                                   // pictures per task
  const HOST = 'https://i.ibb.co/';
  const short = (u) => (u && u.startsWith(HOST) ? u.slice(HOST.length) : u || '');
  const full = (s) => (!s ? '' : /^https?:/.test(s) ? s : HOST + s);
  const parts = (s) => { const [u, t, d] = String(s).split('|'); return { u: full(u), t: full(t || u), d: d || '' }; };
  const delId = (s) => (s ? String(s).split('|')[2] || '' : '');
  // Remove the picture from ImgBB too (best effort: it never blocks the person using the site)
  async function remove(d) {
    try {
      const token = root.DB && (await root.DB.token());
      if (!token || !d) return;
      await fetch('/api/image', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ d }), keepalive: true });
    } catch {}
  }

  // Shrink big photos in the browser: faster upload, less data. GIFs keep their animation.
  async function shrink(file, square) {
    if (file.type === 'image/gif' && !square) return file;
    let bmp;
    try { bmp = await createImageBitmap(file); }
    catch { if (file.size > 8e6) throw new Error('This picture could not be read. Try a JPG or PNG.'); return file; }
    let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height, w, h;
    if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; w = h = square; }
    else { const k = Math.min(1, 1600 / Math.max(sw, sh)); w = Math.round(sw * k); h = Math.round(sh * k); if (k === 1 && file.size < 1.5e6) return file; }
    const png = file.type === 'image/png', c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (!png) { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
    x.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
    const blob = await new Promise(r => c.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.85));
    return blob && (square || blob.size < file.size) ? blob : file;
  }

  // The picture goes to our own /api/image (Vercel), which holds the ImgBB key and checks the login
  async function send(blob) {
    const token = root.DB && (await root.DB.token());
    if (!token) throw new Error('Sign in to upload images.');
    if (blob.size > 4.4e6) throw new Error('That picture is too big (max 4 MB). Try a smaller one.');
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open('POST', '/api/image');
      x.setRequestHeader('Authorization', 'Bearer ' + token);
      x.setRequestHeader('Content-Type', blob.type || 'image/jpeg');
      x.timeout = 60000;
      x.onload = () => {
        let j = {};
        try { j = JSON.parse(x.responseText); } catch {}
        x.status < 300 && j.url ? res(j) : rej(new Error(j.error || 'Upload failed. Try again.'));
      };
      x.onerror = () => rej(new Error('No connection. Check your internet and try again.'));
      x.ontimeout = () => rej(new Error('The upload took too long. Try a smaller picture.'));
      x.send(blob);
    });
  }

  // upload(file, { square: 256 }) -> short string to store
  async function upload(file, opt = {}) {
    if (!root.Plan.can('img')) throw new Error(root.Plan.msg('img'));
    if (!file || !/^image\//.test(file.type)) throw new Error('Choose an image file (JPG, PNG, GIF or WebP).');
    if (file.size > 25e6) throw new Error('That picture is over 25 MB.');
    const data = await send(await shrink(file, opt.square));
    const u = short(data.url), t = data.thumb ? short(data.thumb) : '', d = (data.del || '').replace(/^https?:\/\/(?:www\.)?ibb\.co\//, '');
    if (d) return `${u}|${t !== u ? t : ''}|${d}`;
    return t && t !== u ? `${u}|${t}` : u;
  }

  // ---- Lightbox ----
  const $ = (id) => document.getElementById(id);
  const LB = { list: [], i: 0, onDel: null };
  let delTimer;
  const resetDel = () => { clearTimeout(delTimer); const b = $('lb-del'); b.classList.remove('sure'); b.innerHTML = '<i class="fa-regular fa-trash-can"></i> Remove image'; };
  function show() {
    const p = parts(LB.list[LB.i]);
    $('lb-img').src = p.u;
    $('lb-open').href = p.u;
    $('lb-count').textContent = `${LB.i + 1} of ${LB.list.length}`;
    $('lb-prev').hidden = $('lb-next').hidden = LB.list.length < 2;
  }
  const step = (d) => { LB.i = (LB.i + d + LB.list.length) % LB.list.length; show(); };
  // open(list, index, onRemove): pass onRemove(index) -> the new list, to show a Remove button
  function open(list, i = 0, onDel = null) { if (!list.length) return; LB.list = list; LB.i = i; LB.onDel = onDel; $('lb-del').hidden = !onDel; resetDel(); show(); $('lightbox').showModal(); }
  $('lb-del').addEventListener('click', () => {
    const b = $('lb-del');
    if (!b.classList.contains('sure')) { b.classList.add('sure'); b.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Click again to confirm'; delTimer = setTimeout(resetDel, 3000); return; }
    resetDel();
    const next = LB.onDel(LB.i);
    if (!next || !next.length) return $('lightbox').close();
    LB.list = next; LB.i = Math.min(LB.i, next.length - 1); show();
  });
  $('lb-close').addEventListener('click', () => $('lightbox').close());
  $('lb-prev').addEventListener('click', () => step(-1));
  $('lb-next').addEventListener('click', () => step(1));
  $('lightbox').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  $('lightbox').addEventListener('keydown', (e) => { if (LB.list.length > 1 && e.key === 'ArrowLeft') step(-1); if (LB.list.length > 1 && e.key === 'ArrowRight') step(1); });
  $('lightbox').addEventListener('close', () => { $('lb-img').removeAttribute('src'); });

  root.Img = { MAX, upload, parts, short, full, open, delId, remove };
})(window);

// ================= draw =================
// JALTRON pet drawing pad: draw with mouse, finger or pen, then save. The drawing is cropped, shrunk to 256 px and uploaded like any other picture.
(function (root) {
  const $ = (id) => document.getElementById(id);
  const COLORS = ['#0b1b33', '#ffffff', '#22d3ee', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#fbbf24', '#34d399', '#84cc16', '#92400e', '#94a3b8', '#f9a8d4'];
  const cv = $('dr-canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  let color = COLORS[2], erase = false, drawing = false, last = null, undo = [], hooks = null, busy = false;

  // palette
  $('dr-colors').innerHTML = COLORS.map(c => `<button type="button" class="dr-sw" role="radio" aria-label="Color ${c}" data-c="${c}" style="background:${c}"></button>`).join('');
  function pickColor(c) {
    color = c; setTool(false);
    document.querySelectorAll('.dr-sw').forEach(b => { const on = b.dataset.c === c; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  }
  $('dr-colors').addEventListener('click', (e) => { const b = e.target.closest('.dr-sw'); if (b) pickColor(b.dataset.c); });
  $('dr-custom').addEventListener('input', (e) => pickColor(e.target.value));
  function setTool(er) { erase = er; $('dr-pen').classList.toggle('on', !er); $('dr-erase').classList.toggle('on', er); }
  $('dr-pen').addEventListener('click', () => setTool(false));
  $('dr-erase').addEventListener('click', () => setTool(true));

  // drawing
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
  function snap() { undo.push(cx.getImageData(0, 0, cv.width, cv.height)); if (undo.length > 15) undo.shift(); }
  function dot(p) {
    cx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    cx.fillStyle = color; cx.beginPath(); cx.arc(p.x, p.y, Number($('dr-size').value) / 2, 0, Math.PI * 2); cx.fill();
  }
  function line(a, b) {
    cx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    cx.strokeStyle = color; cx.lineWidth = Number($('dr-size').value); cx.lineCap = cx.lineJoin = 'round';
    cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
  }
  cv.addEventListener('pointerdown', (e) => {
    if (busy) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    snap(); drawing = true; last = pos(e); dot(last);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs.length ? evs : [e]) { const p = pos(ev); line(last, p); last = p; }
  });
  const stop = () => { drawing = false; last = null; };
  cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);
  function doUndo() { const s = undo.pop(); if (s) cx.putImageData(s, 0, 0); }
  $('dr-undo').addEventListener('click', doUndo);
  $('dr-clear').addEventListener('click', () => { snap(); cx.clearRect(0, 0, cv.width, cv.height); });
  $('draw-dlg').addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); } });
  const msg = (t, ok) => { const m = $('dr-msg'); m.textContent = t || ''; m.dataset.ok = ok ? '1' : ''; };

  // Crop to the drawing, then fit into a 256 px square so every pet looks the same size
  function exportBlob() {
    const { width: w, height: h } = cv, d = cx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return Promise.resolve(null);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = 256, pad = 12, k = Math.min((side - pad * 2) / bw, (side - pad * 2) / bh, 1.6);
    const out = document.createElement('canvas'); out.width = out.height = side;
    const ox = out.getContext('2d');
    ox.imageSmoothingQuality = 'high';
    ox.drawImage(cv, x0, y0, bw, bh, (side - bw * k) / 2, side - pad - bh * k, bw * k, bh * k);   // stands on the ground line
    return new Promise(r => out.toBlob(r, 'image/png'));
  }
  $('dr-save').addEventListener('click', async () => {
    if (busy || !hooks) return;
    const blob = await exportBlob();
    if (!blob) return msg('Draw something first.');
    busy = true; $('dr-save').disabled = true; msg('Saving your pet...', true);
    try { await hooks.onSave(new File([blob], 'pet.png', { type: 'image/png' })); $('draw-dlg').close(); }
    catch (err) { msg(err.message || 'Could not save. Try again.'); }
    busy = false; $('dr-save').disabled = false;
  });
  $('dr-reset').addEventListener('click', () => { if (hooks && hooks.onReset) hooks.onReset(); $('draw-dlg').close(); });
  $('dr-close').addEventListener('click', () => $('draw-dlg').close());
  $('draw-dlg').addEventListener('click', (e) => { if (e.target === e.currentTarget && !busy) e.currentTarget.close(); });

  // open({ src, onSave(file), onReset() })
  function open(h) {
    hooks = h; undo = []; msg('');
    cx.clearRect(0, 0, cv.width, cv.height);
    pickColor(color); setTool(false);
    $('dr-reset').hidden = !h.src;
    if (h.src) {   // edit the current drawing (if the picture host blocks reading it, you simply start fresh)
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { const k = Math.min(cv.width / im.width, cv.height / im.height) * 0.9; cx.drawImage(im, (cv.width - im.width * k) / 2, cv.height - 24 - im.height * k, im.width * k, im.height * k); };
      im.src = h.src;
    }
    $('draw-dlg').showModal();
  }
  root.Draw = { open };
})(window);

// ================= focus =================
// JALTRON focus: a Pomodoro-style timer with its own page, a mini timer for other pages, stats and settings.
// Saved in Firestore as one short field on your user doc: f { d: day, m: minutes today, s: sessions today, t: all-time minutes, c: [focus, short, long, every, auto, sound] }
(function (root) {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };
  const RING = 2 * Math.PI * 98, DOCK = 2 * Math.PI * 27;
  const cfg = { focus: 25, short: 5, long: 15, every: 4, auto: false, sound: true, notify: false };
  const st = { mode: 'focus', total: 1500, left: 1500, end: 0, running: false, id: null, taskId: null, cycle: 0 };
  let stats = { d: '', m: 0, s: 0, t: 0 }, log = [], tasks = [], pickSig = '', lastApplied = '', saver = null, saveT = null, base = document.title;
  const today = () => Habit.today();
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const dur = (m) => cfg[m] * 60;
  const left = () => st.running ? Math.max(0, Math.ceil((st.end - Date.now()) / 1000)) : st.left;
  const active = () => st.running || st.left < st.total;
  const page = () => (document.querySelector('.page.active') || {}).dataset.page;
  const toast = (m) => root.Extras && Extras.toast(m);
  const hm = (m) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  const taskOf = () => tasks.find(t => t.id === st.taskId) || null;

  function beep() {
    if (!cfg.sound) return;
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      [660, 880, 1040].forEach((f, i) => {
        const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + i * .2;
        o.frequency.value = f; o.connect(g); g.connect(a.destination);
        g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.25, t0 + .03); g.gain.exponentialRampToValueAtTime(.0001, t0 + .28);
        o.start(t0); o.stop(t0 + .3);
      });
    } catch {}
  }

  // ---- saving (short, debounced) ----
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const f = { d: stats.d, m: stats.m, s: stats.s, t: stats.t, c: [cfg.focus, cfg.short, cfg.long, cfg.every, +cfg.auto, +cfg.sound] };
      lastApplied = JSON.stringify(f);
      if (saver) saver(f);
    }, 1200);
  }
  function addStats(min, sessions) {
    if (stats.d !== today()) stats = { d: today(), m: 0, s: 0, t: stats.t };
    stats.m += min; stats.s += sessions; stats.t += min;
    save(); renderStats();
  }
  // Credit minutes you actually focused when you stop or skip early
  function creditPartial() {
    if (st.mode !== 'focus') return;
    const mins = Math.floor((st.total - left()) / 60);
    if (mins >= 1 && left() > 0) { addStats(mins, 0); log.unshift({ at: new Date(), m: mins, task: taskOf() ? taskOf().title : '', part: true }); renderStats(); }
  }

  // ---- engine ----
  function setMode(mode) {
    clearInterval(st.id); st.running = false;
    st.mode = mode; st.total = st.left = dur(mode);
    paint();
  }
  function start(task) {
    if (task) st.taskId = task.id;
    if (!st.running) {
      if (st.left <= 0) st.left = st.total;
      st.end = Date.now() + st.left * 1000; st.running = true;
      clearInterval(st.id); st.id = setInterval(tick, 250);
    }
    paint();
    if (task && root.Extras) Extras.refreshCards && Extras.refreshCards();
  }
  function pause() { if (!st.running) return; st.left = left(); st.running = false; clearInterval(st.id); paint(); }
  const toggle = () => (st.running ? pause() : start());
  function reset() { creditPartial(); setMode(st.mode); }
  function skip() {
    creditPartial();
    const wasOn = st.running, next = st.mode === 'focus' ? 'short' : 'focus';
    setMode(next);
    if (wasOn || cfg.auto) start();
  }
  function tick() { if (left() <= 0) complete(); else paint(true); }
  function complete() {
    clearInterval(st.id); st.running = false;
    let msg, next;
    if (st.mode === 'focus') {
      st.cycle++; addStats(cfg.focus, 1);
      log.unshift({ at: new Date(), m: cfg.focus, task: taskOf() ? taskOf().title : '' });
      next = st.cycle % cfg.every === 0 ? 'long' : 'short';
      msg = `Focus session done${taskOf() ? ': ' + taskOf().title : ''}. Time for a ${next === 'long' ? 'long' : 'short'} break.`;
    } else {
      if (st.mode === 'long') st.cycle = 0;
      next = 'focus'; msg = 'Break is over. Ready for the next focus session?';
    }
    beep(); toast(msg);
    if (root.Extras) Extras.burst(innerWidth / 2, innerHeight / 3, st.mode === 'focus' ? 70 : 20);
    if (cfg.notify && 'Notification' in window && Notification.permission === 'granted') { try { new Notification('JALTRON', { body: msg, icon: 'favicon.png' }); } catch {} }
    setMode(next);
    if (cfg.auto) start();
  }

  // ---- drawing ----
  function paint(fast) {
    const l = left(), on = st.running, act = active(), pg = page(), t = taskOf();
    $('fp-time').textContent = fmt(l);
    $('fp-prog').style.strokeDashoffset = String(RING * (1 - l / st.total));
    $('fd-time').textContent = fmt(l);
    $('fd-fill').style.strokeDashoffset = String(DOCK * (1 - l / st.total));
    $('focus-dock').hidden = !act || pg === 'focus';
    const nb = $('nav-focus-t'); nb.hidden = !act; nb.textContent = fmt(l);
    document.title = on ? `${fmt(l)} ${LABEL[st.mode]} | JALTRON` : base;
    if (fast === true) return;
    $('fp-main-card').dataset.mode = st.mode;
    document.querySelectorAll('.fp-mode').forEach(b => { const o = b.dataset.mode === st.mode; b.classList.toggle('active', o); b.setAttribute('aria-selected', o); });
    $('fp-state').textContent = on ? (st.mode === 'focus' ? 'Stay with it' : 'Rest and breathe') : act ? 'Paused' : st.mode === 'focus' ? 'Ready to focus' : 'Ready for a break';
    const label = on ? 'Pause' : act ? 'Resume' : 'Start', icon = on ? 'pause' : 'play';
    if ($('fp-main').dataset.s !== label) { $('fp-main').dataset.s = label; $('fp-main').innerHTML = `<i class="fa-solid fa-${icon}"></i><span>${label}</span>`; }
    $('fp-task').textContent = t ? t.title : 'Free focus';
    $('fp-complete').hidden = !t;
    if ($('fp-pick').value !== String(st.taskId || '')) $('fp-pick').value = st.taskId || '';
    const filled = st.mode === 'long' && st.cycle > 0 ? cfg.every : st.cycle % cfg.every;
    $('fp-dots').innerHTML = Array.from({ length: cfg.every }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');
    document.querySelectorAll('#fp-presets [data-min]').forEach(b => b.classList.toggle('on', st.mode === 'focus' && Number(b.dataset.min) === cfg.focus));
    $('fd-task').textContent = t ? t.title : LABEL[st.mode];
    $('fd-toggle').innerHTML = `<i class="fa-solid fa-${on ? 'pause' : 'play'}"></i>`;
    $('fd-toggle').setAttribute('aria-label', on ? 'Pause' : 'Resume');
  }
  function renderStats() {
    const d = stats.d === today() ? stats : { m: 0, s: 0 };
    $('fp-s-n').textContent = d.s; $('fp-s-m').textContent = hm(d.m); $('fp-s-t').textContent = hm(stats.t);
    $('fp-log').innerHTML = log.length
      ? log.slice(0, 8).map(e => `<li><i class="fa-solid fa-${e.part ? 'hourglass-half' : 'circle-check'}"></i><span>${esc(e.task || 'Free focus')}</span><small>${e.m}m, ${e.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></li>`).join('')
      : '<li class="none">Finished sessions show up here.</li>';
  }
  function renderPick() {
    const sig = tasks.filter(t => !t.done).map(t => t.id + t.title).join('|');
    if (sig === pickSig) return;
    pickSig = sig;
    $('fp-pick').innerHTML = '<option value="">Free focus (no task)</option>' + tasks.filter(t => !t.done).map(t => `<option value="${t.id}">${esc(t.title.length > 60 ? t.title.slice(0, 57) + '...' : t.title)}</option>`).join('');
    $('fp-pick').value = st.taskId || '';
  }
  function fillCfg() {
    $('cf-focus').value = cfg.focus; $('cf-short').value = cfg.short; $('cf-long').value = cfg.long; $('cf-every').value = cfg.every;
    $('cf-auto').checked = cfg.auto; $('cf-sound').checked = cfg.sound; $('cf-notify').checked = cfg.notify;
    $('fp-custom').value = cfg.focus;
  }

  // ---- controls ----
  $('fp-main').addEventListener('click', toggle);
  $('fp-reset').addEventListener('click', reset);
  $('fp-skip').addEventListener('click', skip);
  document.querySelectorAll('.fp-mode').forEach(b => b.addEventListener('click', () => { creditPartial(); setMode(b.dataset.mode); }));
  $('fp-pick').addEventListener('change', (e) => { st.taskId = e.target.value ? Number(e.target.value) : null; paint(); });
  $('fp-complete').addEventListener('click', () => {
    const t = taskOf();
    if (!t) return;
    if (root.jaltron && jaltron.complete(t.id)) { st.taskId = null; toast(`Done: ${t.title}`); paint(); }
    else toast('Open the Tasks page and tick it there.');
  });
  function setFocusMins(n) {
    n = Math.max(1, Math.min(180, Math.round(Number(n)) || cfg.focus));
    cfg.focus = n; fillCfg();
    if (st.mode === 'focus' && !active()) { st.total = st.left = dur('focus'); }
    paint(); save();
  }
  $('fp-presets').addEventListener('click', (e) => { const b = e.target.closest('[data-min]'); if (b) { if (st.mode !== 'focus' && !active()) setMode('focus'); setFocusMins(b.dataset.min); } });
  $('fp-custom').addEventListener('change', (e) => setFocusMins(e.target.value));
  ['focus', 'short', 'long', 'every'].forEach(k => $('cf-' + k).addEventListener('change', (e) => {
    const v = Math.max(1, Math.min(k === 'every' ? 12 : 180, Math.round(Number(e.target.value)) || cfg[k]));
    cfg[k] = v; fillCfg();
    if (!active() && (k === st.mode)) { st.total = st.left = dur(st.mode); }
    paint(); save();
  }));
  $('cf-auto').addEventListener('change', (e) => { cfg.auto = e.target.checked; save(); });
  $('cf-sound').addEventListener('change', (e) => { cfg.sound = e.target.checked; if (cfg.sound) beep(); save(); });
  $('cf-notify').addEventListener('change', async (e) => {
    if (!e.target.checked) { cfg.notify = false; return; }
    if (!('Notification' in window)) { e.target.checked = false; return toast('This browser has no notifications.'); }
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    cfg.notify = p === 'granted'; e.target.checked = cfg.notify;
    if (!cfg.notify) toast('Notifications are blocked for this site.');
  });
  // Zen mode: just the timer, full screen
  function zen(on) {
    document.body.classList.toggle('zen', on);
    $('fp-zen').innerHTML = on ? '<i class="fa-solid fa-compress"></i> Leave zen' : '<i class="fa-solid fa-expand"></i> Zen mode';
    try { on ? document.documentElement.requestFullscreen && document.documentElement.requestFullscreen() : document.fullscreenElement && document.exitFullscreen(); } catch {}
  }
  $('fp-zen').addEventListener('click', () => zen(!document.body.classList.contains('zen')));
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('zen')) zen(false); });
  // Mini timer
  $('fd-toggle').addEventListener('click', toggle);
  $('fd-open').addEventListener('click', () => Extras.go('focus'));
  $('fd-close').addEventListener('click', reset);
  // Keys on the Focus page
  document.addEventListener('keydown', (e) => {
    if (page() !== 'focus' || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (k === 'r') reset(); else if (k === 's') skip(); else if (k === 'z') $('fp-zen').click();
  });

  // ---- hooks used by extras.js ----
  function sync(list, c) {
    tasks = list;
    if (st.taskId && !list.some(t => t.id === st.taskId && !t.done)) st.taskId = null;
    saver = c.setFocus;
    if (c.canSavePet) {
      const f = c.focus || {}, js = JSON.stringify(f);
      if (js !== lastApplied) {
        lastApplied = js;
        const day = today(), same = f.d === day;
        stats = { d: day, m: same ? f.m || 0 : 0, s: same ? f.s || 0 : 0, t: f.t || 0 };
        if (Array.isArray(f.c) && !active()) {
          [cfg.focus, cfg.short, cfg.long, cfg.every] = f.c.slice(0, 4).map((n, i) => Math.max(1, Number(n) || [25, 5, 15, 4][i]));
          cfg.auto = !!f.c[4]; cfg.sound = f.c[5] === undefined ? true : !!f.c[5];
          st.total = st.left = dur(st.mode); fillCfg();
        }
        renderStats();
      }
    }
    renderPick(); paint();
  }
  root.Focus = {
    start, pause, toggle, reset, sync,
    taskId: () => (active() ? st.taskId : null),
    title: (t) => { base = t; if (!st.running) document.title = t; },
    pageChanged: paint
  };
  fillCfg(); renderStats(); renderPick(); paint();
})(window);

// ================= discord =================
// JALTRON Discord: "talk to staff for a subscription" banner + live server card built from the public guild widget JSON.
// Needs "Server Settings > Widget > Enable server widget" in Discord, otherwise the card falls back to a plain join card.
(function () {
  const GUILD = '1503297362246897694';
  const API = `https://discord.com/api/guilds/${GUILD}/widget.json`;
  const FALLBACK = `https://discord.com/channels/${GUILD}`;
  const LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>';
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const safeUrl = (u, fb) => /^https:\/\/(cdn\.discordapp\.com|discord\.gg|discord\.com|[\w-]+\.discordapp\.(com|net))\//.test(u || '') ? u : fb;

  document.querySelectorAll('.dc-logo').forEach(el => { el.innerHTML = LOGO; });

  const box = document.getElementById('dc-embed');
  if (!box) return;
  const state = { invite: FALLBACK };

  function render(d) {
    const invite = safeUrl(d && d.instant_invite, FALLBACK);
    state.invite = invite;
    const members = ((d && d.members) || []).slice(0, 12);
    const online = d && d.presence_count != null ? d.presence_count : null;
    const chans = ((d && d.channels) || []).slice(0, 3);
    const avatars = members.map(m => `<span class="dc-av ${esc(m.status || 'online')}" title="${esc(m.username)}"><img src="${esc(safeUrl(m.avatar_url, ''))}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`).join('');
    box.innerHTML = `
      <div class="dc-top">
        <span class="dc-badge dc-logo">${LOGO}</span>
        <div class="dc-name"><strong>${esc((d && d.name) || 'JALTRON Discord')}</strong>
          <span class="sub">${online != null ? `<i class="dc-dot"></i>${online} online` : 'Official community and staff'}</span></div>
        <a class="btn primary dc-join" href="${esc(invite)}" target="_blank" rel="noopener noreferrer">Join</a>
      </div>
      ${avatars ? `<div class="dc-avs" aria-label="Members online">${avatars}</div>` : ''}
      ${chans.length ? `<ul class="dc-chans">${chans.map(c => `<li># ${esc(c.name)}</li>`).join('')}</ul>` : ''}
      <p class="dc-foot sub">Open a ticket or message staff to get your subscription.</p>`;
    document.querySelectorAll('[data-dc-link]').forEach(a => { a.href = invite; });
  }

  // Static card first (instant), then upgrade it with live data
  render(null);
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), 8000);
  fetch(API, { signal: ctl.signal, cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status)))
    .then(render)
    .catch(() => { /* widget disabled or offline: keep the static card */ });
})();
