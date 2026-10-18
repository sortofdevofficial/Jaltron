'use strict';
// JALTRON bank: a fake personal balance + shared workspace pots (w/<ownerUid>).
// All cloud access goes through DB (db.js): bankMoney, wsCreate/wsAdd/wsDel/wsMoney/wsWatch, nameOf.
// Log entries come back as "YYYY-MM-DD|+N|<uid>|<ms>" — the uid is added server-side by db.js,
// names are only resolved here for display, never trusted from other members.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const toast = (m) => window.Extras && Extras.toast(m);
  const fmt = (n) => (n < 0 ? `-$${Math.abs(n).toLocaleString()}` : `$${(n || 0).toLocaleString()}`);
  const amount = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 1e6 ? n : 0; };
  const dayShort = (iso) => new Date(iso + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const AMT_MSG = 'Enter a whole number from 1 to 1,000,000';
  const ADD_ERR = { invalid: 'Usernames are 3 to 20 letters, numbers or _.', unknown: 'No account with that name.', me: 'That is you — you already run this pot.' };
  // The w collection is only reachable once the updated firestore.rules are published; say so instead of blaming the network
  const isPerm = (e) => !!e && (e.code === 'permission-denied' || /permission/i.test(e.message || ''));
  const why = (e) => isPerm(e) ? 'Firestore rules are missing the workspace block — publish the updated firestore.rules in the Firebase console, then reload.' : 'Check your connection.';

  let signedIn = false, mine = { m: 0, l: [] }, pots = [], potsReady = false, potErr = false;
  let unwatch = null, watchUid = null, busy = false, creating = false;
  const potBusy = new Set();

  function rowHtml(e) {
    const [day, amt, who] = String(e).split('|');
    const n = Number(amt);
    return `<div class="bk-row"><span class="d">${esc(dayShort(day))}</span><b class="${n >= 0 ? 'pos' : 'neg'}">${n >= 0 ? '+' : '-'}$${Math.abs(n).toLocaleString()}</b><span class="w" data-nm="${esc(who)}"></span></div>`;
  }

  function fillNames(scope) {
    scope.querySelectorAll('[data-nm]').forEach(el => DB.nameOf(el.dataset.nm).then(n => { el.textContent = n || 'someone'; }));
  }

  // ---------- My bank ----------
  function renderMine() {
    const b = $('bk-mine');
    b.textContent = fmt(mine.m || 0);
    b.classList.toggle('neg', (mine.m || 0) < 0);
    const rows = (mine.l || []).slice().reverse().map(rowHtml).join('');
    $('bk-log').innerHTML = rows || '<div class="empty"><i class="fa-solid fa-piggy-bank"></i>No moves yet. Add or remove money and the log starts here.</div>';
    fillNames($('bk-log'));
  }

  async function money(delta, inp) {
    if (busy) return;
    if (!window.DB || !DB.user) return toast('Sign in to use the bank.');
    busy = true;
    try {
      mine = await DB.bankMoney(delta, mine);
      if (inp) inp.value = '';
      paint();
      toast(`${delta > 0 ? 'Added' : 'Removed'} ${fmt(Math.abs(delta))} — balance ${fmt(mine.m)}`);
    } catch (err) { toast('Could not save. ' + why(err)); }
    busy = false;
  }

  // ---------- Workspace pots ----------
  function potCard(p, uid) {
    const own = p.id === uid;
    const chips = (p.m || []).map(m => m === uid
      ? '<span class="chip mine">You</span>'
      : `<span class="chip"><span data-nm="${esc(m)}"></span>${own ? `<button data-ws-del="${esc(m)}" aria-label="Remove member"><i class="fa-solid fa-xmark"></i></button>` : ''}</span>`).join('');
    const rows = (p.l || []).slice().reverse().map(rowHtml).join('');
    return `<div class="bk-pot" data-pot="${esc(p.id)}">
      <div class="bk-pot-head"><span class="sub">${own ? 'Your pot — members can move money too' : `<span data-nm="${esc(p.id)}">…</span>'s pot`}</span><b class="${(p.b || 0) < 0 ? 'neg' : ''}">${fmt(p.b || 0)}</b></div>
      <div class="bk-controls">
        <input type="number" min="1" max="1000000" inputmode="numeric" placeholder="Amount" aria-label="Amount">
        <button class="btn primary" data-madd><i class="fa-solid fa-plus"></i> Add</button>
        <button class="btn" data-mtake><i class="fa-solid fa-minus"></i> Remove</button>
      </div>
      <div class="cat-chips">${chips}</div>
      ${own ? '<form class="cmd-form" data-ws-add><input maxlength="20" placeholder="Add member by username" autocomplete="off" aria-label="Add member by username"><button class="btn">Add</button></form>' : ''}
      <div class="bk-log">${rows || '<p class="sub">No moves yet.</p>'}</div>
    </div>`;
  }

  function renderPots() {
    const uid = window.DB && DB.user ? DB.user.uid : '';
    const own = pots.find(p => p.id === uid);
    $('bk-ws-new').hidden = !(signedIn && potsReady && !own && !potErr);
    if (!signedIn) { $('bk-ws').innerHTML = ''; return; }
    if (potErr === 'rules') { $('bk-ws').innerHTML = '<p class="sub">Workspace pots are blocked by Firestore rules. Publish the updated firestore.rules in the Firebase console, then reload this page.</p>'; return; }
    if (potErr) { $('bk-ws').innerHTML = '<p class="sub">Could not load pots. Check your connection.</p>'; return; }
    if (!potsReady) { $('bk-ws').innerHTML = '<p class="sub">Looking for pots…</p>'; return; }
    const cards = [own, ...pots.filter(p => p.id !== uid)].filter(Boolean).map(p => potCard(p, uid)).join('');
    $('bk-ws').innerHTML = cards || '<div class="empty"><i class="fa-solid fa-users"></i>No pot yet. Create one, then add people by their username.</div>';
    fillNames($('bk-ws'));
  }

  function onPots(snap) {
    const prev = new Set(pots.map(p => p.id));
    pots = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (snap.metadata.fromCache) return renderPots(); // wait for the server before claiming "no pots"
    const gone = [...prev].filter(id => !pots.some(p => p.id === id));
    potsReady = true; potErr = false;
    renderPots();
    if (gone.length) toast('A workspace pot you were in is gone');
  }

  function syncWatch(user) {
    const uid = user ? user.uid : null;
    if (uid === watchUid) return;
    if (unwatch) { unwatch(); unwatch = null; }
    watchUid = uid; pots = []; potsReady = false; potErr = false;
    if (uid) unwatch = DB.wsWatch(onPots, (err) => { potErr = isPerm(err) ? 'rules' : 'net'; renderPots(); });
  }

  // ---------- Whole page ----------
  function paint() {
    $('bk-off').hidden = signedIn;
    $('bk-main').hidden = !signedIn;
    if (signedIn) { renderMine(); renderPots(); }
  }

  addEventListener('jaltron:user', (e) => {
    const { user, profile } = e.detail;
    signedIn = !!user;
    if (user) {
      mine = profile && typeof profile.b?.m === 'number' ? profile.b : { m: 0, l: [] };
      syncWatch(user);
    } else {
      mine = { m: 0, l: [] };
      syncWatch(null);
    }
    paint();
  });

  $('bk-signin').addEventListener('click', () => window.DB ? DB.signIn() : toast('Cloud is still loading, try again'));
  $('bk-add').addEventListener('click', () => { const n = amount($('bk-amt').value); if (!n) return toast(AMT_MSG); money(n, $('bk-amt')); });
  $('bk-take').addEventListener('click', () => { const n = amount($('bk-amt').value); if (!n) return toast(AMT_MSG); money(-n, $('bk-amt')); });
  $('bk-amt').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('bk-add').click(); } });
  $('bk-chips').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const n = amount(b.textContent.replace(/[^\d]/g, ''));
    if (n) money(b.textContent.trim().startsWith('-') ? -n : n);
  });
  $('bk-ws-new').addEventListener('click', () => {
    if (creating) return;
    creating = true;
    DB.wsCreate().then(() => toast('Pot created. Add members by username.'))
      .catch((err) => toast('Could not create the pot. ' + why(err)))
      .finally(() => { creating = false; });
  });

  $('bk-ws').addEventListener('click', (e) => {
    const del = e.target.closest('[data-ws-del]');
    if (del) {
      DB.wsDel(del.dataset.wsDel).then(() => toast('Member removed'))
        .catch((err) => toast('Could not remove. ' + why(err)));
      return;
    }
    const card = e.target.closest('[data-pot]');
    const add = e.target.closest('[data-madd]'), take = e.target.closest('[data-mtake]');
    if (!card || (!add && !take) || potBusy.has(card.dataset.pot)) return;
    const pot = pots.find(p => p.id === card.dataset.pot);
    const inp = card.querySelector('.bk-controls input');
    const n = amount(inp.value);
    if (!pot) return;
    if (!n) return toast(AMT_MSG);
    const delta = add ? n : -n;
    potBusy.add(pot.id);
    DB.wsMoney(pot.id, delta, { m: pot.b || 0, l: pot.l || [] }).then((next) => {
      pot.b = next.m; pot.l = next.l; inp.value = '';
      renderPots();
      toast(`${delta > 0 ? 'Added' : 'Removed'} ${fmt(n)} — pot ${fmt(pot.b)}`);
    }).catch((err) => toast('Could not move money. ' + why(err)))
      .finally(() => potBusy.delete(pot.id));
  });
  $('bk-ws').addEventListener('submit', (e) => {
    const f = e.target.closest('[data-ws-add]'); if (!f) return;
    e.preventDefault();
    const inp = f.querySelector('input'), name = inp.value.trim().toLowerCase();
    DB.wsAdd(name).then(() => { inp.value = ''; toast(`Added @${name}`); })
      .catch(err => toast(ADD_ERR[err.message] || why(err)));
  });
  $('bk-ws').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.closest('.bk-controls')) return;
    e.preventDefault();
    e.target.closest('[data-pot]').querySelector('[data-madd]').click();
  });

  function snapshot() {
    const uid = window.DB && DB.user ? DB.user.uid : '';
    const pot = pots.find(p => p.id === uid) || pots[0] || null;
    return { mine: fmt(mine.m || 0), pot: pot ? fmt(pot.b || 0) : null };
  }

  window.Bank = {
    pageChanged: () => { if (document.querySelector('.page.active')?.dataset.page === 'bank') paint(); },
    snapshot,
    deposit: (n) => amount(n) ? money(amount(n)) : toast(AMT_MSG),
    withdraw: (n) => amount(n) ? money(-amount(n)) : toast(AMT_MSG)
  };
  paint();
})();
