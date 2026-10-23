// ================= links =================
// Private saved links: u/<uid>.l (see db.js), one dotted field per link so two tabs never clobber each other.
// Each link can carry one cover picture, uploaded through the same cropper as every other picture.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const toast = (m) => window.Extras && Extras.toast(m);
  const MAX = 100;

  let uid = '', signedIn = false, links = {};
  let editingId = '', pendingImg = '', savedImg = '', busy = false, imgBusy = false;
  let delArm = '', delTimer = 0;

  const cleanTitle = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const safeHref = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
  function normalizeUrl(raw) {
    let s = String(raw || '').trim();
    if (!s) return { err: 'Paste a link first.' };
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
    let u;
    try { u = new URL(s); } catch { return { err: 'That does not look like a link.' }; }
    if (!/^https?:$/.test(u.protocol)) return { err: 'Only http and https links work.' };
    if (u.username || u.password) return { err: 'Links with a username and password are not allowed.' };
    if (!u.hostname || u.hostname.indexOf('.') < 0) return { err: 'That link is missing a site name.' };
    if (u.href.length > 500) return { err: 'That link is too long (max 500 characters).' };
    return { url: u.href, host: u.hostname.replace(/^www\./, '') };
  }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const nextOrder = () => Object.values(links).reduce((m, v) => Math.max(m, +v.o || 0), 0) + 1;

  function msg(t, ok) { const m = $('lk-msg'); m.textContent = t || ''; m.classList.toggle('ok', !!ok); }
  function paintBusy() { $('lk-save').disabled = busy || imgBusy; $('lk-pick').disabled = busy || imgBusy; }
  function paintCover() {
    const s = pendingImg || savedImg;
    $('lk-prev').hidden = !s;
    if (s) $('lk-prev-img').src = Img.parts(s).t;
    $('lk-pick-l').textContent = s ? 'Replace cover' : 'Add cover';
  }

  function renderCards() {
    const list = Object.entries(links)
      .filter(([, v]) => v && typeof v === 'object')
      .sort((a, b) => (+a[1].o || 0) - (+b[1].o || 0));
    $('lk-count').textContent = list.length ? `${list.length} of ${MAX}` : '';
    $('lk-empty').hidden = !!list.length;
    $('lk-cards').innerHTML = list.map(([id, v]) => {
      const href = safeHref(typeof v.u === 'string' ? v.u : '');
      let host = '';
      if (href) { try { host = new URL(href).hostname.replace(/^www\./, ''); } catch {} }
      const title = cleanTitle(v.t) || host || 'Untitled link';
      const pic = typeof v.i === 'string' && v.i ? Img.parts(v.i).t : '';
      const cover = `<div class="lk-cover"><span class="lk-ph"><i class="fa-solid fa-link"></i></span>${pic ? `<img src="${esc(pic)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</div>`;
      const body = `<div class="lk-body"><span class="lk-title" title="${esc(title)}">${esc(title)}</span><span class="lk-host">${esc(host)}</span></div>`;
      const main = href
        ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="${esc(href)}">${cover}${body}</a>`
        : `${cover}${body}`;
      return `<article class="lk-card" data-id="${esc(id)}">${main}<div class="lk-acts"><button type="button" data-edit aria-label="Edit ${esc(title)}"><i class="fa-solid fa-pen"></i></button><button type="button" class="del${delArm === id ? ' sure' : ''}" data-del aria-label="Delete ${esc(title)}"><i class="fa-regular fa-trash-can"></i></button></div></article>`;
    }).join('');
  }

  function paint() {
    $('lk-off').hidden = signedIn;
    $('lk-main').hidden = !signedIn;
    if (document.querySelector('.page.active')?.dataset.page === 'links') renderCards();
  }

  function resetForm() {
    if (pendingImg && pendingImg !== savedImg) Img.remove(Img.delId(pendingImg));   // never saved, so free it now
    editingId = ''; pendingImg = ''; savedImg = '';
    $('lk-url').value = ''; $('lk-title').value = '';
    $('lk-cancel').hidden = true; $('lk-editing').textContent = '';
    $('lk-save').innerHTML = '<i class="fa-solid fa-plus"></i> Save link';
    busy = false; paintBusy(); paintCover(); msg('');
  }

  function startEdit(id) {
    const v = links[id];
    if (!v) return;
    editingId = id; pendingImg = '';
    savedImg = typeof v.i === 'string' ? v.i : '';
    $('lk-url').value = typeof v.u === 'string' ? v.u : '';
    $('lk-title').value = typeof v.t === 'string' ? v.t : '';
    $('lk-cancel').hidden = false; $('lk-editing').textContent = 'Editing';
    $('lk-save').innerHTML = '<i class="fa-solid fa-check"></i> Save changes';
    msg(''); paintCover(); paintBusy();
  }

  async function save() {
    if (busy || imgBusy) return;
    if (!window.DB) return msg('Cloud is still loading, try again.');
    const n = normalizeUrl($('lk-url').value);
    if (n.err) return msg(n.err);
    if (!editingId && Object.keys(links).length >= MAX) return msg(`You can save up to ${MAX} links.`);
    const prev = editingId ? links[editingId] : null;
    const id = editingId || newId();
    const v = { t: cleanTitle($('lk-title').value) || n.host, u: n.url, o: prev ? (+prev.o || 0) : nextOrder() };
    if (pendingImg) v.i = pendingImg;
    busy = true; paintBusy(); msg(prev ? 'Saving changes...' : 'Saving...', true);
    try {
      if (!(await DB.linkPut(id, v))) throw new Error('save failed');
      const old = prev && typeof prev.i === 'string' && prev.i !== pendingImg ? prev.i : '';
      links = { ...links, [id]: v };
      pendingImg = ''; savedImg = '';
      resetForm();
      if (old) Img.remove(Img.delId(old));   // the write landed, so the replaced picture is safe to delete
      toast(prev ? 'Link updated' : 'Link saved');
    } catch {
      msg('Could not save. Check your connection and try again.');
      busy = false; paintBusy();
    }
  }

  function arm(btn, id) {
    delArm = id;
    $('lk-cards').querySelectorAll('.del.sure').forEach(x => x.classList.remove('sure'));
    btn.classList.add('sure');
    clearTimeout(delTimer);
    delTimer = setTimeout(() => { delArm = ''; if (btn.isConnected) btn.classList.remove('sure'); }, 3000);
  }

  async function remove(id, btn) {
    if (busy) return;
    if (delArm !== id) return arm(btn, id);
    if (!window.DB) return toast('Cloud is still loading, try again.');
    delArm = ''; clearTimeout(delTimer);
    const v = links[id];
    busy = true; paintBusy();
    try {
      if (!(await DB.linkDel(id))) throw new Error('delete failed');
      delete links[id];
      if (editingId === id) resetForm();
      if (v && typeof v.i === 'string' && v.i) Img.remove(Img.delId(v.i));
      paint(); toast('Link deleted');
    } catch {
      toast('Could not delete. Check your connection.');
    }
    busy = false; paintBusy();
  }

  // ---- form ----
  $('lk-form').addEventListener('submit', (e) => { e.preventDefault(); save(); });
  $('lk-cancel').addEventListener('click', () => resetForm());
  $('lk-signin').addEventListener('click', () => window.DB ? DB.signIn() : toast('Cloud is still loading, try again'));
  $('lk-pick').addEventListener('click', () => {
    if (!Plan.can('img')) return toast(Plan.msg('img'));
    $('lk-file').click();
  });
  $('lk-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    imgBusy = true; paintBusy(); msg('Uploading cover...', true);
    try {
      const s = await Img.upload(f, { crop: { preset: '16:9' } });
      if (s) {
        const old = pendingImg;
        pendingImg = s; paintCover();
        if (old && old !== savedImg) Img.remove(Img.delId(old));
      }
      msg('');
    } catch (err) { msg(err.message || 'Upload failed. Try again.'); }
    imgBusy = false; paintBusy();
  });
  $('lk-prev-x').addEventListener('click', () => {
    if (pendingImg && pendingImg !== savedImg) Img.remove(Img.delId(pendingImg));
    pendingImg = ''; savedImg = '';
    paintCover();
  });

  $('lk-cards').addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    if (e.target.closest('[data-edit]')) return startEdit(card.dataset.id);
    const del = e.target.closest('[data-del]');
    if (del) remove(card.dataset.id, del);
  });
  // A cover that no longer loads shows the placeholder instead of a broken icon
  $('lk-cards').addEventListener('error', (e) => { if (e.target && e.target.tagName === 'IMG') e.target.remove(); }, true);

  addEventListener('jaltron:user', (e) => {
    const { user, profile } = e.detail;
    const nextUid = user ? user.uid : '';
    if (nextUid !== uid) { uid = nextUid; resetForm(); }
    signedIn = !!user;
    links = profile && profile.l && typeof profile.l === 'object' && !Array.isArray(profile.l) ? profile.l : {};
    if (editingId && !links[editingId]) resetForm();   // removed in another tab
    paint();
  });

  window.Links = {
    pageChanged: () => { if (document.querySelector('.page.active')?.dataset.page === 'links') paint(); },
    pics: () => {
      const out = [];
      if (pendingImg) out.push(pendingImg);
      Object.values(links).forEach(v => { if (v && typeof v.i === 'string' && v.i) out.push(v.i); });
      return out;
    }
  };
  paint();
})();
