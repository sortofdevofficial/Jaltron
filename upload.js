'use strict';
// JALTRON images: upload to ImgBB through /api/upload (the key stays on the server), keep Firestore small, and view pictures in a lightbox.
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
      await fetch('/api/delete', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ d }), keepalive: true });
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

  // The picture goes to our own /api/upload (Vercel), which holds the ImgBB key and checks the login
  async function send(blob) {
    const token = root.DB && (await root.DB.token());
    if (!token) throw new Error('Sign in to upload images.');
    if (blob.size > 4.4e6) throw new Error('That picture is too big (max 4 MB). Try a smaller one.');
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open('POST', '/api/upload');
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
