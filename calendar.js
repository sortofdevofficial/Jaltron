// ================= calendar =================
// JALTRON calendar: private events on u/<uid>.cal (see db.js), one dotted field per event so tabs never clobber each other.
// Month grid + a day panel. Open tasks with a due date show on their day; chips drag between days to reschedule.
// The Free plan keeps 20 events (Plan.limit('events')); Lite is unlimited.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const toast = (m) => window.Extras && Extras.toast(m);
  const COLORS = { blue: '#3b82f6', cyan: '#06b6d4', green: '#10b981', amber: '#f59e0b', red: '#ef4444', violet: '#a78bfa' };
  const PRIO_C = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
  const pad = (n) => String(n).padStart(2, '0');
  const key = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const dayOf = (k) => { const d = new Date(k + 'T00:00'); return d; };
  const keyOf = (d) => key(d.getFullYear(), d.getMonth(), d.getDate());
  const pack = (v) => ({ t: v.t, d: Habit.dayMs(v.day), m: v.tm, c: v.c, n: v.n, r: v.r || '' });

  let signedIn = false, ev = {};                 // ev: id -> { t, day, tm, c, n, r }
  let vy, vm, sel = '', editing = null, delTimer = 0;
  sel = Habit.today();
  const viewOf = (k) => { const d = dayOf(k); vy = d.getFullYear(); vm = d.getMonth(); };
  viewOf(sel);
  // Weekday header above the grid (the grid itself starts on Sunday)
  (() => {
    const wk = $('cal-week');
    if (!wk || wk.children.length) return;
    wk.innerHTML = Array.from({ length: 7 }, (_, i) => `<span>${new Date(2024, 0, 7 + i).toLocaleDateString(undefined, { weekday: 'short' })}</span>`).join('');
  })();

  const active = () => document.querySelector('.page.active')?.dataset.page === 'calendar';
  const REPS = { d: 'every day', w: 'every week', y: 'every year' };
  // Does event v (starting on v.day) appear on day key k? Recurring series expand forward forever.
  const occurs = (v, k) => v.r === 'd' ? v.day <= k
    : v.r === 'w' ? v.day <= k && dayOf(v.day).getDay() === dayOf(k).getDay()
    : v.r === 'y' ? v.day <= k && v.day.slice(5) === k.slice(5)
    : v.day === k;
  const evsOn = (k) => Object.entries(ev).filter(([, v]) => occurs(v, k))
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (!a.tm) - (!b.tm) || (a.tm || '').localeCompare(b.tm || '') || a.t.localeCompare(b.t));
  const tksOn = (k) => (window.Extras ? Extras.tasks() : []).filter(t => !t.done && t.due === k);

  // ---------- Month grid ----------
  const repBadge = (e) => e.r ? `<span class="cal-rep" title="Repeats ${REPS[e.r]}">↻</span>` : '';
  function chipHtml(e) {
    return `<button type="button" class="cal-ev" draggable="true" data-ev="${esc(e.id)}" style="--c:${COLORS[e.c]}" title="${esc(e.t)}${e.r ? ` (repeats ${REPS[e.r]})` : ''}">${e.tm ? `<b>${esc(e.tm)}</b>` : ''}<span>${esc(e.t)}</span>${repBadge(e)}</button>`;
  }
  function renderMonth() {
    $('cal-month').textContent = dayOf(`${vy}-${pad(vm + 1)}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const start = new Date(vy, vm, 1 - new Date(vy, vm, 1).getDay());
    const today = Habit.today();
    ensureHols(vy);
    ensureHols(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 41).getFullYear());
    let nEv = 0, nHol = 0, html = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const k = keyOf(d), evs = evsOn(k), tks = tksOn(k), hs = hol[k] || [];
      if (d.getMonth() === vm) { nEv += evs.length; nHol += hs.length; }
      html += `<div class="cal-cell${d.getMonth() !== vm ? ' out' : ''}${k === today ? ' today' : ''}${k === sel ? ' sel' : ''}" data-day="${k}">
        <span class="cal-dn">${d.getDate()}</span>
        ${hs.length ? `<span class="cal-hol" title="${esc(hs.join(' · '))}">${holEmoji(hs[0])} ${esc(hs[0])}</span>` : ''}
        ${evs.slice(0, 3).map(chipHtml).join('')}
        ${evs.length > 3 ? `<span class="cal-more">+${evs.length - 3} more</span>` : ''}
        ${tks.length ? `<span class="cal-td" title="${tks.length} task${tks.length > 1 ? 's' : ''} due">${tks.slice(0, 4).map(t => `<i style="--p:${PRIO_C[t.prio]}"></i>`).join('')}${tks.length > 4 ? `<em>+${tks.length - 4}</em>` : ''}</span>` : ''}
      </div>`;
    }
    $('cal-cells').innerHTML = html;
    const due = (window.Extras ? Extras.tasks() : []).filter(t => !t.done && t.due).length;
    const holTxt = nHol ? ` · ${nHol} public hol${nHol === 1 ? 'iday' : 'idays'}` : '';
    $('cal-foot').textContent = `${nEv} event${nEv === 1 ? '' : 's'} this month${holTxt} · ${due} open task${due === 1 ? '' : 's'} with due dates · Tip: drag an event onto another day to move it.`;
  }

  // ---------- Day panel ----------
  function rowHtml(e) {
    return `<div class="cal-row" data-ev="${esc(e.id)}" style="--c:${COLORS[e.c]}">
      <span class="cal-rt">${e.tm ? esc(e.tm) : 'All-day'}${e.r ? ` <span class="cal-rep" title="Repeats ${REPS[e.r]}">↻</span>` : ''}</span>
      <span class="cal-rn"><b>${esc(e.t)}</b>${e.n ? `<small>${esc(e.n)}</small>` : ''}${e.r ? `<small>Repeats ${REPS[e.r]}</small>` : ''}</span>
      <button type="button" class="cal-rm" data-rm="${esc(e.id)}" aria-label="Delete ${esc(e.t)}" title="Delete"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
  }
  function tkRow(t) {
    return `<div class="cal-tk"><button type="button" class="cal-tk-c" data-tk="${t.id}" aria-label="Complete ${esc(t.title)}"><i class="fa-solid fa-check"></i></button><span class="cal-tk-t" title="${esc(t.title)}">${esc(t.title)}</span><button type="button" class="cal-tk-f" data-tkf="${t.id}" aria-label="Focus on ${esc(t.title)}" title="Focus on this"><i class="fa-solid fa-bullseye"></i></button></div>`;
  }
  // Next occurrences after the selected day, repeating events expanded
  function upNext(fromK, count) {
    const out = [], d0 = dayOf(fromK);
    for (let i = 1; i <= 120 && out.length < count; i++) {
      const k = keyOf(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i));
      for (const e of evsOn(k)) if (out.length < count) out.push({ ...e, day: k });
    }
    return out;
  }
  function renderUp() {
    const up = upNext(sel, 4);
    $('cal-up').hidden = !up.length || !signedIn;
    $('cal-up-list').innerHTML = up.map(e => `<button type="button" class="cal-up-row" data-jump="${e.day}">
      <span class="cal-up-d">${dayOf(e.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
      <span class="cal-up-t" style="--c:${COLORS[e.c]}">${e.tm ? esc(e.tm) + ' · ' : ''}${esc(e.t)}${e.r ? ' ↻' : ''}</span>
    </button>`).join('');
  }
  function renderDay() {
    const d = dayOf(sel);
    $('cal-day-title').textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + (sel === Habit.today() ? ' · Today' : '');
    const evs = evsOn(sel), hs = hol[sel] || [];
    $('cal-day-list').innerHTML = (hs.length ? hs.map(n => `<div class="cal-holrow"><span class="cal-hol-img" data-hn="${esc(n)}">${holEmoji(n)}</span><span class="cal-hol-n"><b>${esc(n)}</b><small>Public holiday</small></span></div>`).join('') : '')
      + (evs.length ? evs.map(rowHtml).join('')
        : hs.length ? '' : '<div class="empty"><i class="fa-solid fa-calendar-day"></i><p>Nothing planned. Add an event, or give a task this due date.</p></div>');
    const tks = tksOn(sel);
    $('cal-tk-head').hidden = !tks.length;
    $('cal-day-tasks').innerHTML = tks.map(tkRow).join('');
    fillHolImages($('cal-day-list'));
    renderUp();
  }

  function paint() {
    $('cal-off').hidden = signedIn;
    $('cal-main').hidden = !signedIn;
    if (!signedIn || !active()) return;
    if (!ccInit) { ccInit = true; initCC(); }
    renderMonth(); renderDay();
    checkReminders();
  }

  // ---------- Event editor ----------
  $('cal-f-colors').innerHTML = Object.entries(COLORS).map(([k, v]) => `<button type="button" class="sw" data-c="${k}" style="--c:${v}" role="radio" aria-checked="false" aria-label="${k}"></button>`).join('');
  const pickColor = (k) => { if (!COLORS[k]) k = 'blue'; $('cal-f-colors').dataset.c = k; $('cal-f-colors').querySelectorAll('.sw').forEach(s => { const on = s.dataset.c === k; s.classList.toggle('on', on); s.setAttribute('aria-checked', String(on)); }); };
  const pickedColor = () => $('cal-f-colors').dataset.c || 'blue';
  $('cal-f-colors').addEventListener('click', (e) => { const s = e.target.closest('.sw'); if (s) pickColor(s.dataset.c); });

  function openEditor(id, day) {
    const v = id ? ev[id] : null;
    editing = id || null;
    $('cal-f-head').textContent = v ? (v.r ? `Edit event (repeats ${REPS[v.r]})` : 'Edit event') : 'New event';
    $('cal-f-title').value = v ? v.t : '';
    $('cal-f-date').value = v ? v.day : (day || sel);
    $('cal-f-time').value = v ? v.tm : '';
    $('cal-f-rep').value = v ? (v.r || '') : '';
    $('cal-f-note').value = v ? v.n : '';
    $('cal-f-msg').textContent = '';
    $('cal-f-del').hidden = !v;
    $('cal-f-del').classList.remove('sure');
    pickColor(v ? v.c : 'blue');
    $('cal-dlg').showModal();
    setTimeout(() => $('cal-f-title').focus(), 30);
  }
  $('cal-f').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!window.DB || !DB.user) return;
    const t = $('cal-f-title').value.trim(), day = $('cal-f-date').value;
    if (!t || !day) return;
    if (!editing && Object.keys(ev).length >= Plan.limit('events')) { $('cal-f-msg').textContent = Plan.msg('events'); return; }
    const id = editing || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const rep = $('cal-f-rep').value;
    ev[id] = { t: t.slice(0, 120), day, tm: $('cal-f-time').value || '', c: pickedColor(), n: $('cal-f-note').value.trim().slice(0, 240), r: REPS[rep] ? rep : '' };
    DB.calPut(id, pack(ev[id])).then(ok => { if (!ok) toast('Saved here, but the cloud write failed. Check your connection.'); });
    editing = null;
    $('cal-dlg').close();
    sel = day; viewOf(day);
    paint();
    toast('📅 Event saved' + (ev[id].r ? ` (repeats ${REPS[ev[id].r]})` : ''));
  });
  $('cal-f-del').addEventListener('click', () => {
    const b = $('cal-f-del');
    if (!editing) return;
    if (!b.classList.contains('sure')) {   // two clicks: arm, then delete
      b.classList.add('sure');
      clearTimeout(delTimer);
      delTimer = setTimeout(() => b.classList.remove('sure'), 2600);
      return;
    }
    const id = editing;
    delete ev[id];
    DB.calDel(id);
    editing = null;
    $('cal-dlg').close();
    paint();
    toast('Event deleted');
  });
  $('cal-f-x').addEventListener('click', () => $('cal-dlg').close());
  $('cal-f-cancel').addEventListener('click', () => $('cal-dlg').close());
  $('cal-dlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  // ---------- Grid and panel events ----------
  const cells = $('cal-cells');
  cells.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-ev]');
    if (chip && !e.target.closest('.cal-cell')?.contains(chip)) return;
    if (chip) return openEditor(chip.dataset.ev);
    const cell = e.target.closest('[data-day]');
    if (cell) { sel = cell.dataset.day; paint(); }
  });
  cells.addEventListener('dblclick', (e) => {
    const chip = e.target.closest('[data-ev]');
    if (chip) return;
    const cell = e.target.closest('[data-day]');
    if (cell && signedIn) openEditor(null, cell.dataset.day);
  });
  cells.addEventListener('dragstart', (e) => {
    const chip = e.target.closest('[data-ev]');
    if (!chip) return;
    e.dataTransfer.setData('text/plain', chip.dataset.ev);
    e.dataTransfer.effectAllowed = 'move';
  });
  cells.addEventListener('dragover', (e) => {
    if (![...e.dataTransfer.types].includes('text/plain')) return;
    const cell = e.target.closest('[data-day]');
    if (!cell) return;
    e.preventDefault();
    cells.querySelectorAll('.over').forEach(x => x.classList.remove('over'));
    cell.classList.add('over');
  });
  cells.addEventListener('dragleave', (e) => { const cell = e.target.closest('[data-day]'); if (cell && !cell.contains(e.relatedTarget)) cell.classList.remove('over'); });
  cells.addEventListener('drop', (e) => {
    const cell = e.target.closest('[data-day]');
    cells.querySelectorAll('.over').forEach(x => x.classList.remove('over'));
    if (!cell) return;
    const id = e.dataTransfer.getData('text/plain'), v = ev[id];
    e.preventDefault();
    if (!v || v.day === cell.dataset.day) return;
    v.day = cell.dataset.day;
    DB.calPut(id, pack(v));
    sel = v.day; viewOf(sel);
    paint();
    toast('📅 Moved to ' + dayOf(v.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  });
  $('cal-day-list').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      if (!rm.classList.contains('sure')) {
        rm.classList.add('sure');
        setTimeout(() => rm.classList.remove('sure'), 2600);
        return;
      }
      delete ev[rm.dataset.rm];
      DB.calDel(rm.dataset.rm);
      paint();
      toast('Event deleted (including its repeats)');
      return;
    }
    const row = e.target.closest('[data-ev]');
    if (row) openEditor(row.dataset.ev);
  });
  $('cal-day-tasks').addEventListener('click', (e) => {
    const tk = e.target.closest('[data-tk]'), fk = e.target.closest('[data-tkf]');
    if (tk) dispatchEvent(new CustomEvent('jaltron:toggle-task', { detail: tk.dataset.tk }));
    else if (fk) { const t = (window.Extras ? Extras.tasks() : []).find(x => x.id === Number(fk.dataset.tkf)); if (t && window.Extras) Extras.startFocus(t); }
  });
  $('cal-up-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-jump]');
    if (!b) return;
    sel = b.dataset.jump; viewOf(sel); paint();
  });
  $('cal-add').addEventListener('click', () => { if (signedIn) openEditor(null); });
  $('cal-prev').addEventListener('click', () => { vm--; if (vm < 0) { vm = 11; vy--; } paint(); });
  $('cal-next').addEventListener('click', () => { vm++; if (vm > 11) { vm = 0; vy++; } paint(); });
  $('cal-today').addEventListener('click', () => { sel = Habit.today(); viewOf(sel); paint(); });
  $('cal-signin').addEventListener('click', () => window.DB ? DB.signIn() : toast('Cloud is still loading, try again'));

  // Arrow keys walk the days while the Calendar page is open
  document.addEventListener('keydown', (e) => {
    if (!active() || !signedIn) return;
    if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const d = dayOf(sel);
    d.setDate(d.getDate() + step);
    sel = keyOf(d); viewOf(sel);
    paint();
  });

  // ---------- Account events ----------
  addEventListener('jaltron:user', (e) => {
    signedIn = !!e.detail.user;
    const c = e.detail.profile && e.detail.profile.cal;
    ev = {};
    if (c && typeof c === 'object') {
      for (const [id, v] of Object.entries(c)) {
        if (!v || typeof v.t !== 'string' || !v.d) continue;
        const day = typeof v.d === 'number' ? keyOf(new Date(v.d)) : '';
        if (!day) continue;
        ev[id] = { t: v.t, day, tm: typeof v.m === 'string' && /^\d{2}:\d{2}$/.test(v.m) ? v.m : '', c: COLORS[v.c] ? v.c : 'blue', n: typeof v.n === 'string' ? v.n : '', r: ['d', 'w', 'y'].includes(v.r) ? v.r : '' };
      }
    }
    sel = Habit.today(); viewOf(sel);
    paint();
  });

  // ---------- Public holidays (free Nager.Date API, no key needed) ----------
  let hol = {}, ccInit = false;                  // hol: 'YYYY-MM-DD' -> [names]
  const flag = (c) => [...c].map(ch => String.fromCodePoint(127397 + ch.charCodeAt(0))).join('');
  const ccSel = () => $('cal-cc').value;
  const holEmoji = (n) => {
    const s = String(n).toLowerCase();
    if (/christmas|noel|navidad|weihnacht|natal/.test(s)) return '🎄';
    if (/new year|hogmanay|silvester|nouvel an/.test(s)) return '🎉';
    if (/halloween|all hallows/.test(s)) return '🎃';
    if (/easter|pâques|ostern|pasqua/.test(s)) return '🐣';
    if (/valentine/.test(s)) return '💘';
    if (/thanksgiving/.test(s)) return '🦃';
    if (/independence|freedom|bastille|canada day|national day|republic day|unity/.test(s)) return '🎆';
    if (/labor|labout|labour|may day|workers/.test(s)) return '🛠️';
    if (/mother/.test(s)) return '💐';
    if (/father/.test(s)) return '👔';
    if (/wom[ae]n/.test(s)) return '🌸';
    if (/children/.test(s)) return '🧸';
    if (/patrick/.test(s)) return '🍀';
    if (/carnival|mardi gras/.test(s)) return '🎭';
    if (/eid|ramadan/.test(s)) return '🌙';
    if (/diwali/.test(s)) return '🪔';
    if (/hanukkah|chanukah/.test(s)) return '🕎';
    if (/lunar|spring festival|chinese new year/.test(s)) return '🧧';
    if (/harvest|grain/.test(s)) return '🌾';
    if (/saint|st\.?\s/.test(s)) return '⛪';
    return '🎉';
  };
  // Real pictures for holidays: Wikipedia thumbnails, cached for a month, emoji if offline/unknown
  const IMG_KEY = 'jt:holimg';
  let imgCache = {};
  try { imgCache = JSON.parse(localStorage.getItem(IMG_KEY) || '{}'); } catch {}
  const saveImg = () => { try { localStorage.setItem(IMG_KEY, JSON.stringify(imgCache)); } catch {} };
  async function holImage(name) {
    const c = imgCache[name];
    if (c && Date.now() - c.at < 30 * 864e5) return c.u;
    let u = null;
    try {
      const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(name.replace(/\s+/g, '_')) + '?redirect=true');
      if (r.ok) {
        const d = await r.json();
        if (d && d.thumbnail && d.thumbnail.source) u = String(d.thumbnail.source);
      }
    } catch {}
    imgCache[name] = { u, at: Date.now() };
    saveImg();
    return u;
  }
  function fillHolImages(box) {
    box.querySelectorAll('.cal-hol-img[data-hn]').forEach(async (el) => {
      const name = el.dataset.hn;
      const u = await holImage(name);
      if (!u || !el.isConnected) return;
      const im = document.createElement('img');
      im.className = 'cal-hol-ph'; im.src = u; im.alt = ''; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer';
      // A dead picture link: put the emoji back and stop caching that URL.
      im.addEventListener('error', () => {
        delete imgCache[name]; saveImg();
        if (el.isConnected) el.textContent = holEmoji(name);
      });
      el.textContent = '';
      el.appendChild(im);
    });
  }
  function applyHol(year, list) {
    for (const h of list) (hol[h.d] = hol[h.d] || []).push(h.n);
    if (active() && signedIn && dayOf(sel).getFullYear() === year) paint();
  }
  async function ensureHols(year) {
    const cc = ccSel();
    if (!cc || hol['yr' + year]) return;
    hol['yr' + year] = 1;
    const ck = `jt:hol:${cc}:${year}`;
    let c = null;
    try { c = JSON.parse(localStorage.getItem(ck) || 'null'); } catch {}
    if (c && c.list && Date.now() - c.at < 7 * 864e5) return applyHol(year, c.list);
    try {
      const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`);
      if (!r.ok) throw 0;
      const list = (await r.json()).map(x => ({ d: x.date, n: x.localName || x.name || 'Holiday' }));
      try { localStorage.setItem(ck, JSON.stringify({ at: Date.now(), list })); } catch {}
      applyHol(year, list);
    } catch { if (c && c.list) applyHol(year, c.list); }  // offline: stale cache still helps
  }
  async function initCC() {
    const sel = $('cal-cc');
    let list = null;
    try { list = JSON.parse(localStorage.getItem('jt:holccs') || 'null'); } catch {}
    if (!list || !Array.isArray(list.c) || !list.c.length || Date.now() - list.at > 30 * 864e5) {
      try {
        const r = await fetch('https://date.nager.at/api/v3/AvailableCountries');
        if (r.ok) { list = { at: Date.now(), c: (await r.json()).map(x => x.countryCode) }; try { localStorage.setItem('jt:holccs', JSON.stringify(list)); } catch {} }
      } catch {}
    }
    if (!list || !Array.isArray(list.c) || !list.c.length) list = { c: ['US', 'GB', 'CA', 'AU', 'IN', 'DE', 'FR', 'ES', 'IT', 'NL', 'BR', 'MX', 'ZA', 'NG', 'PH', 'PK'] };
    const codes = list.c;
    let cc = '';
    try { cc = localStorage.getItem('jt:holcc') || ''; } catch {}
    if (!cc) {
      const region = (navigator.language || '').split('-')[1];
      cc = codes.includes(region) ? region : codes.includes('US') ? 'US' : codes[0];
    }
    sel.innerHTML = '<option value="">No holidays</option>' + codes.map(c => `<option value="${c}">${flag(c)} ${c}</option>`).join('');
    sel.value = codes.includes(cc) ? cc : '';
    sel.addEventListener('change', () => {
      try { localStorage.setItem('jt:holcc', sel.value); } catch {}
      hol = {};
      paint();
    });
    paint();
  }

  // ---------- Event reminders (system notifications on this device) ----------
  const NOTIF_KEY = 'jt:calnotif';
  let fired = new Set();
  try { fired = new Set(JSON.parse(localStorage.getItem('jt:notifdone') || '[]')); } catch {}
  const saveFired = () => { try { localStorage.setItem('jt:notifdone', JSON.stringify([...fired].slice(-200))); } catch {} };
  const notifOn = () => { try { return localStorage.getItem(NOTIF_KEY) === '1'; } catch { return false; } };
  // Register once so phones that require a service worker can show notifications too
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname)))
    navigator.serviceWorker.register('sw.js').catch(() => {});
  function pushNotif(tag, title, body) {
    const opt = { body, tag, icon: 'favicon.png', badge: 'favicon.png' };
    try {
      if (navigator.serviceWorker) navigator.serviceWorker.ready.then(r => r.showNotification(title, opt)).catch(() => { try { new Notification(title, opt); } catch {} });
      else new Notification(title, opt);
    } catch {}
    fired.add(tag);
    saveFired();
  }
  function checkReminders() {
    if (!signedIn || !notifOn() || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date(), nowMs = now.getTime();
    for (const [id, v] of Object.entries(ev)) {
      for (let off = -1; off <= 1; off++) {
        const k = keyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + off));
        if (!occurs(v, k)) continue;
        const start = new Date(k + 'T' + (v.tm || '09:00') + ':00');
        const tag = `${id}:${k}`;
        if (fired.has(tag) || nowMs < start.getTime() - 6e5 || nowMs > start.getTime() + 3e5) continue;
        const inMin = Math.round((start.getTime() - nowMs) / 6e4);
        pushNotif(tag, `⏰ ${v.t}`, inMin > 0 ? `Starts at ${v.tm || '09:00'} (in ${inMin} min).` : `Starting now${v.tm ? ' (' + v.tm + ')' : ''}.`);
      }
    }
  }
  setInterval(checkReminders, 30000);
  function paintBell() {
    const b = $('cal-notif'), on = notifOn();
    b.innerHTML = `<i class="fa-solid ${on ? 'fa-bell' : 'fa-bell-slash'}"></i>`;
    b.classList.toggle('on', on);
    b.title = on ? 'Reminders are on — click to turn off' : 'Turn on event reminders (10 min before)';
  }
  $('cal-notif').addEventListener('click', async () => {
    if (!('Notification' in window)) return toast('This device does not support notifications.');
    if (notifOn()) {
      try { localStorage.removeItem(NOTIF_KEY); } catch {}
      paintBell();
      toast('Reminders off');
      return;
    }
    const p = await Notification.requestPermission();
    if (p !== 'granted') return toast('Notifications are blocked — allow them in your browser settings first.');
    try { localStorage.setItem(NOTIF_KEY, '1'); } catch {}
    paintBell();
    checkReminders();
    toast('⏰ Reminders on — 10 min before each timed event');
  });
  paintBell();

  window.Calendar = { pageChanged: paint, tasksChanged: () => { if (active()) paint(); } };
  paint();
})();
