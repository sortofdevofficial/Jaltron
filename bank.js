// ================= bank =================
// JALTRON bank: your private fake bank plus any number of named shared banks (w/<id>), each with its own currency and members.
// All cloud access goes through DB (db.js). Money is whole minor units (cents); old whole-dollar data is converted on read.
// Log entries "YYYY-MM-DD|+N|<uid>|<ms>": the uid is added by db.js, names are only resolved here for display.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const toast = (m) => window.Extras && Extras.toast(m);
  const CURS = { USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', INR: 'Indian rupee', JPY: 'Japanese yen', AUD: 'Australian dollar', CAD: 'Canadian dollar', CHF: 'Swiss franc', CNY: 'Chinese yuan', BRL: 'Brazilian real', MXN: 'Mexican peso', AED: 'UAE dirham' };
  const curOpts = (sel) => Object.entries(CURS).map(([c, n]) => `<option value="${c}"${c === sel ? ' selected' : ''}>${c} - ${n}</option>`).join('');
  const nf = {}, exp = (c) => (nf[c] || (nf[c] = new Intl.NumberFormat(undefined, { style: 'currency', currency: c })), nf[c].resolvedOptions().maximumFractionDigits);
  const fmt = (n, c = 'USD') => { const e = exp(c); return nf[c].format((n || 0) / 10 ** e); };
  // "12.5" -> minor units, or 0 when it is not a valid amount for this currency (1 up to 1,000,000 whole units)
  const toMinor = (v, c) => {
    const s = String(v).trim().replace(',', '.'), e = exp(c);
    if (!/^\d+(\.\d+)?$/.test(s) || (s.split('.')[1] || '').length > e) return 0;
    const n = Math.round(Number(s) * 10 ** e);
    return n >= 1 && n <= 1e6 * 10 ** e ? n : 0;
  };
  // Log day segment is Unix ms since v: 3 (a string after split('|')); old ISO-string days still render until the owner upgrades the bank
  const dayNum = (x) => typeof x === 'number' ? x : (/^\d{4}-\d{2}-\d{2}$/.test(x) ? Habit.dayMs(x) : +x || 0);
  const dayShort = (x) => new Date(dayNum(x)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const AMT_MSG = (c) => exp(c) ? 'Enter an amount like 12.50 (up to 1,000,000)' : 'Enter a whole amount (up to 1,000,000)';
  const ADD_ERR = { invalid: 'Usernames are 3 to 20 letters, numbers or _.', unknown: 'No account with that name.', me: 'That is you, you are already in this bank.' };
  // The w collection is only reachable once the updated firestore.rules are published; say so instead of blaming the network
  const isPerm = (e) => !!e && (e.code === 'permission-denied' || /permission/i.test(e.message || ''));
  const why = (e) => isPerm(e) ? 'Firestore rules block this: publish the latest firestore.rules in the Firebase console, then reload.' : 'Check your connection.';
  // Old data: whole dollars, no v mark. View it as cents.
  const scaleLog = (l) => (l || []).map(e => { const p = String(e).split('|'); const n = Number(p[1]) * 100; p[1] = (n > 0 ? '+' : '') + n; return p.join('|'); });
  const norm = (b, legacy) => legacy ? { m: Math.round((b.m || 0) * 100), l: scaleLog(b.l), c: 'USD', v: 3 } : { m: b.m || 0, l: b.l || [], c: b.c || 'USD', v: 3 };

  let signedIn = false, mine = { m: 0, l: [], c: 'USD', v: 3 }, mineStored = false, banks = [], banksReady = false, banksErr = false;
  let unwatch = null, watchUid = null, busy = false, creating = false;
  const potBusy = new Set(), upgrading = new Set(), deleting = new Set();
  let delArm = '', delTimer = 0;

  // can: this person may delete the line (mine: always; shared: the owner, or the author of that line)
  function rowHtml(e, c, can) {
    const [day, amt, who] = String(e).split('|'), n = Number(amt);
    return `<div class="bk-row"><span class="d">${esc(dayShort(day))}</span><b class="${n >= 0 ? 'pos' : 'neg'}">${n >= 0 ? '+' : '-'}${esc(fmt(Math.abs(n), c))}</b><span class="w" data-nm="${esc(who)}"></span>${can ? `<button type="button" class="bk-x" data-del-log="${esc(e)}" title="Delete this entry" aria-label="Delete this entry"><i class="fa-solid fa-xmark"></i></button>` : ''}</div>`;
  }
  // First click arms the button for 3 seconds, the second click confirms
  let armedBtn = null, armTimer = 0;
  function confirmed(btn) {
    if (armedBtn === btn) { clearTimeout(armTimer); armedBtn = null; return true; }
    if (armedBtn) armedBtn.classList.remove('sure');
    armedBtn = btn; btn.classList.add('sure'); btn.title = 'Click again to delete';
    clearTimeout(armTimer); armTimer = setTimeout(() => { btn.classList.remove('sure'); armedBtn = null; }, 3000);
    return false;
  }
  const fillNames = (scope) => scope.querySelectorAll('[data-nm]').forEach(el => DB.nameOf(el.dataset.nm).then(n => { el.textContent = n || 'someone'; }));

  // ---------- My bank ----------
  function renderMine() {
    const b = $('bk-mine');
    b.textContent = fmt(mine.m, mine.c);
    b.classList.toggle('neg', mine.m < 0);
    if ($('bk-cur').value !== mine.c) $('bk-cur').value = mine.c;
    $('bk-log').innerHTML = mine.l.slice().reverse().map(e => rowHtml(e, mine.c, true)).join('') || '<div class="empty"><i class="fa-solid fa-piggy-bank"></i>No moves yet. Add or remove money and the log starts here.</div>';
    fillNames($('bk-log'));
  }
  async function money(delta, inp) {
    if (busy) return;
    if (!window.DB || !DB.user) return toast('Sign in to use the bank.');
    busy = true;
    try {
      mine = await DB.bankMoney(delta, mine, mineStored); mineStored = true;
      if (inp) inp.value = '';
      paint();
      toast(`${delta > 0 ? 'Added' : 'Removed'} ${fmt(Math.abs(delta), mine.c)}. Balance ${fmt(mine.m, mine.c)}`);
    } catch (err) { toast('Could not save. ' + why(err)); }
    busy = false;
  }

  // ---------- Shared banks ----------
  const view = (p) => { const v = norm({ m: p.b, l: p.l, c: p.c }, !p.v); return { ...v, nm: p.nm || 'Shared bank', owner: p.o || p.id, legacy: !p.v }; };
  function bankCard(p, uid) {
    const v = view(p), own = v.owner === uid;
    const chips = (p.m || []).map(m => m === uid ? '<span class="chip mine">You</span>'
      : `<span class="chip"><span data-nm="${esc(m)}"></span>${m === v.owner ? ' <em class="own">owner</em>' : ''}${own ? `<button data-ws-del="${esc(m)}" aria-label="Remove member"><i class="fa-solid fa-xmark"></i></button>` : ''}</span>`).join('');
    return `<div class="bk-pot" data-pot="${esc(p.id)}" data-cur="${esc(v.c)}">
      <div class="bk-pot-head"><div class="bk-pot-name"><strong>${esc(v.nm)}</strong><span class="sub">${own ? 'Your bank' : `<span data-nm="${esc(v.owner)}">...</span>'s bank`} · ${esc(v.c)} · ${(p.m || []).length} member${(p.m || []).length === 1 ? '' : 's'}</span></div><b class="${v.m < 0 ? 'neg' : ''}">${esc(fmt(v.m, v.c))}</b></div>
      <div class="bk-controls">
        <input type="text" inputmode="decimal" placeholder="Amount" aria-label="Amount" autocomplete="off">
        <button class="btn primary" data-madd><i class="fa-solid fa-plus"></i> Add</button>
        <button class="btn" data-mtake><i class="fa-solid fa-minus"></i> Remove</button>
      </div>
      <div class="cat-chips">${chips}</div>
      ${own ? `<form class="cmd-form" data-ws-add><input maxlength="20" placeholder="Add member by username" autocomplete="off" aria-label="Add member by username"><button class="btn">Add member</button></form>
      <form class="bk-edit" data-ws-edit><input maxlength="30" value="${esc(v.nm)}" aria-label="Bank name" required><select aria-label="Currency">${curOpts(v.c)}</select><button class="btn">Save</button><button type="button" class="btn danger" data-ws-remove>${delArm === p.id ? 'Click again to delete' : 'Delete bank'}</button></form>`
        : '<button class="btn" data-ws-leave><i class="fa-solid fa-right-from-bracket"></i> Leave this bank</button>'}
      <div class="bk-log">${v.l.slice().reverse().map(e => rowHtml(e, v.c, own || String(e).split('|')[2] === uid)).join('') || '<p class="sub">No moves yet.</p>'}</div>
    </div>`;
  }
  // Keep what someone is typing (and where the cursor is) when a snapshot redraws the banks
  function keepInputs(draw) {
    const box = $('bk-ws'), saved = [...box.querySelectorAll('[data-pot]')].map(c => [c.dataset.pot, [...c.querySelectorAll('input,select')].map(i => i.value)]);
    const a = document.activeElement, focus = a && box.contains(a) ? { id: a.closest('[data-pot]')?.dataset.pot, i: [...a.closest('[data-pot]').querySelectorAll('input,select')].indexOf(a), s: a.selectionStart } : null;
    draw();
    saved.forEach(([id, vals]) => { const c = box.querySelector(`[data-pot="${CSS.escape(id)}"]`); if (c) c.querySelectorAll('input,select').forEach((el, n) => { if (vals[n] !== undefined && (el.type === 'text' || el.tagName === 'SELECT')) el.value = vals[n]; }); });
    if (focus && focus.id) { const el = box.querySelector(`[data-pot="${CSS.escape(focus.id)}"]`)?.querySelectorAll('input,select')[focus.i]; if (el) { el.focus(); try { el.setSelectionRange(focus.s, focus.s); } catch {} } }
  }
  function renderBanks() {
    const uid = window.DB && DB.user ? DB.user.uid : '';
    if (!signedIn) { $('bk-ws').innerHTML = ''; return; }
    if (banksErr === 'rules') { $('bk-ws').innerHTML = '<p class="sub">Shared banks are blocked by Firestore rules. Publish the latest firestore.rules in the Firebase console, then reload this page.</p>'; return; }
    if (banksErr) { $('bk-ws').innerHTML = '<p class="sub">Could not load your banks. Check your connection.</p>'; return; }
    if (!banksReady) { $('bk-ws').innerHTML = '<p class="sub">Looking for your banks...</p>'; return; }
    const sorted = banks.slice().sort((a, b) => (view(a).owner === uid ? 0 : 1) - (view(b).owner === uid ? 0 : 1) || view(a).nm.localeCompare(view(b).nm));
    keepInputs(() => { $('bk-ws').innerHTML = sorted.map(p => bankCard(p, uid)).join('') || '<div class="empty"><i class="fa-solid fa-users"></i>No shared bank yet. Name one above, then add people by their username.</div>'; });
    fillNames($('bk-ws'));
  }
  function onBanks(snap) {
    const prev = new Set(banks.map(p => p.id));
    banks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (snap.metadata.fromCache && !banks.length) return renderBanks(); // an empty cached answer is not proof: wait for the server before claiming "no banks"
    banksReady = true; banksErr = false;
    const uid = DB.user.uid;
    const own = (p) => (p.o || p.id) === uid;
    const stale = (p) => !p.v || p.v < 3 || (p.l || []).some((e) => /^\d{4}-/.test(String(e))); // old shape or old day format
    banks.filter(p => own(p) && stale(p) && !upgrading.has(p.id)).forEach(p => {   // my outdated bank: convert it once
      upgrading.add(p.id);
      const v = view(p);
      DB.wsUpgrade(p.id, v.m, v.l).catch((e) => { upgrading.delete(p.id); console.error(e); });
    });
    renderBanks();
    const gone = [...prev].filter(id => !banks.some(p => p.id === id) && !deleting.has(id));
    if (gone.length) toast('A shared bank you were in is gone');
  }
  function syncWatch(user) {
    const uid = user ? user.uid : null;
    if (uid === watchUid) return;
    if (unwatch) { unwatch(); unwatch = null; }
    watchUid = uid; banks = []; banksReady = false; banksErr = false; upgrading.clear();
    if (uid) unwatch = DB.wsWatch(onBanks, (err) => { banksErr = isPerm(err) ? 'rules' : 'net'; renderBanks(); });
  }

  // ---------- Whole page ----------
  function paint() {
    $('bk-off').hidden = signedIn;
    $('bk-main').hidden = !signedIn;
    if (signedIn) { renderMine(); renderBanks(); }
  }
  $('bk-cur').innerHTML = curOpts('USD'); $('bk-new-cur').innerHTML = curOpts('USD');

  addEventListener('jaltron:user', (e) => {
    const { user, profile } = e.detail, b = profile && profile.b;
    signedIn = !!user;
    if (user) {
      const raw = b && typeof b.m === 'number' ? b : { m: 0, l: [] };
      mineStored = raw.v >= 2; mine = norm(raw, raw.v !== 2);
      syncWatch(user);
    } else { mine = { m: 0, l: [], c: 'USD', v: 3 }; mineStored = false; syncWatch(null); }
    paint();
  });

  $('bk-signin').addEventListener('click', () => window.DB ? DB.signIn() : toast('Cloud is still loading, try again'));
  $('bk-log').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del-log]');
    if (!b || !confirmed(b) || busy) return;
    busy = true;
    try { mine = await DB.bankLogDel(b.dataset.delLog, mine, mineStored); mineStored = true; paint(); toast('History entry deleted. The balance is unchanged.'); }
    catch (err) { toast('Could not delete. ' + why(err)); }
    busy = false;
  });
  $('bk-cur').addEventListener('change', async (e) => {
    const c = e.target.value;
    try { mine = await DB.bankPut({ ...mine, c }); mineStored = true; paint(); toast(`Your bank now shows ${c}. Amounts are not converted.`); }
    catch (err) { toast('Could not change the currency. ' + why(err)); renderMine(); }
  });
  const amtOf = () => { const n = toMinor($('bk-amt').value, mine.c); if (!n) toast(AMT_MSG(mine.c)); return n; };
  $('bk-add').addEventListener('click', () => { const n = amtOf(); if (n) money(n, $('bk-amt')); });
  $('bk-take').addEventListener('click', () => { const n = amtOf(); if (n) money(-n, $('bk-amt')); });
  $('bk-amt').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('bk-add').click(); } });
  $('bk-chips').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const t = b.textContent.trim(), n = toMinor(t.replace(/[^\d.]/g, ''), mine.c);
    if (n) money(t.startsWith('-') ? -n : n);
  });
  $('bk-new-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const uid = DB.user && DB.user.uid, name = $('bk-new-name').value.trim().replace(/\s+/g, ' ');
    if (!uid || creating || !name) return;
    if (banks.filter(p => view(p).owner === uid).length >= 10) return toast('You can own up to 10 banks.');
    creating = true;
    DB.wsCreate(name, $('bk-new-cur').value).then(() => { $('bk-new-name').value = ''; toast(`Bank "${name}" created. Add members by username.`); })
      .catch((err) => toast('Could not create the bank. ' + why(err))).finally(() => { creating = false; });
  });

  const potOf = (el) => { const card = el.closest('[data-pot]'); return card && { card, id: card.dataset.pot, pot: banks.find(p => p.id === card.dataset.pot) }; };
  $('bk-ws').addEventListener('click', (e) => {
    const dl = e.target.closest('[data-del-log]');
    if (dl) {
      const t0 = potOf(dl);
      if (!t0 || !t0.pot || !confirmed(dl)) return;
      if (!t0.pot.v) return toast('This old bank is still upgrading, try again in a moment.');
      return void DB.wsLogDel(t0.id, dl.dataset.delLog).then(() => toast('History entry deleted. The balance is unchanged.')).catch((err) => toast('Could not delete. ' + why(err)));
    }
    const del = e.target.closest('[data-ws-del]'), add = e.target.closest('[data-madd]'), take = e.target.closest('[data-mtake]'), rm = e.target.closest('[data-ws-remove]'), leave = e.target.closest('[data-ws-leave]');
    const t = potOf(e.target); if (!t || !t.pot) return;
    if (del) return void DB.wsDel(t.id, del.dataset.wsDel).then(() => toast('Member removed')).catch((err) => toast('Could not remove. ' + why(err)));
    if (leave) return void DB.wsLeave(t.id).then(() => toast('You left the bank')).catch((err) => toast('Could not leave. ' + why(err)));
    if (rm) {   // two clicks to delete
      if (delArm !== t.id) { delArm = t.id; clearTimeout(delTimer); delTimer = setTimeout(() => { delArm = ''; renderBanks(); }, 3000); return renderBanks(); }
      delArm = ''; deleting.add(t.id);
      return void DB.wsRemove(t.id).then(() => toast('Bank deleted')).catch((err) => { deleting.delete(t.id); toast('Could not delete. ' + why(err)); });
    }
    if ((!add && !take) || potBusy.has(t.id)) return;
    const v = view(t.pot), inp = t.card.querySelector('.bk-controls input'), n = toMinor(inp.value, v.c);
    if (v.legacy) return toast(v.owner === DB.user.uid ? 'Upgrading this bank, try again in a moment.' : 'The owner needs to open the Bank page once to upgrade this old bank.');
    if (!n) return toast(AMT_MSG(v.c));
    const delta = add ? n : -n;
    potBusy.add(t.id);
    DB.wsMoney(t.id, delta, { m: v.m, l: v.l, c: v.c }).then(() => { inp.value = ''; toast(`${delta > 0 ? 'Added' : 'Removed'} ${fmt(n, v.c)}`); })
      .catch((err) => toast('Could not move money. ' + why(err))).finally(() => potBusy.delete(t.id));
  });
  $('bk-ws').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = potOf(e.target); if (!t) return;
    if (e.target.matches('[data-ws-add]')) {
      const inp = e.target.querySelector('input'), name = inp.value.trim().toLowerCase();
      DB.wsAdd(t.id, name).then(() => { inp.value = ''; toast(`Added @${name}`); }).catch(err => toast(ADD_ERR[err.message] || why(err)));
    } else if (e.target.matches('[data-ws-edit]')) {
      const nm = e.target.querySelector('input').value.trim().replace(/\s+/g, ' '), c = e.target.querySelector('select').value;
      if (nm) DB.wsEdit(t.id, nm, c).then(() => toast('Bank updated')).catch(err => toast('Could not save. ' + why(err)));
    }
  });
  $('bk-ws').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.closest('.bk-controls')) return;
    e.preventDefault();
    e.target.closest('[data-pot]').querySelector('[data-madd]').click();
  });

  // For the AI chat: formatted balances (amounts it moves are whole units of your bank's currency)
  function snapshot() {
    const uid = window.DB && DB.user ? DB.user.uid : '', p = banks.find(x => view(x).owner === uid) || banks[0], v = p && view(p);
    return { mine: fmt(mine.m, mine.c), pot: v ? `${v.nm} (${fmt(v.m, v.c)})` : null };
  }
  const whole = (n) => { n = Math.floor(Number(n)); return n >= 1 && n <= 1e6 ? n * 10 ** exp(mine.c) : 0; };
  window.Bank = {
    pageChanged: () => { if (document.querySelector('.page.active')?.dataset.page === 'bank') paint(); },
    snapshot,
    deposit: (n) => whole(n) ? money(whole(n)) : toast(AMT_MSG(mine.c)),
    withdraw: (n) => whole(n) ? money(-whole(n)) : toast(AMT_MSG(mine.c))
  };
  paint();
})();
