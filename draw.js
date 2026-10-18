'use strict';
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
