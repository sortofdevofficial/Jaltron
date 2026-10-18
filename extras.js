'use strict';
// JALTRON extras: hero dashboard, focus timer, command palette, shortcuts, confetti, fake bank and workspace pots.
// Nothing here is saved anywhere.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
    const RING = 2 * Math.PI * 58, DOCK = 2 * Math.PI * 27;
  let tasks = [], ctx = {}, next3 = [];
  const toast = (m) => { $('toast').innerHTML = `<span>${esc(m)}</span>`; $('toast').classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => $('toast').classList.remove('show'), 3500); };

  // ---------- Hero, ring, level ----------
  function update(list, c) {
    tasks = list; ctx = c;
    const H = Habit, map = H.completions(list), day = H.today();
    const doneToday = map.get(day) || 0;
    const actionable = list.filter(t => !t.done && (t.r || (t.due && c.dayDiff(t.due) <= 0)));
    const goal = doneToday + actionable.length;
    const overdue = list.filter(t => !t.done && t.due && c.dayDiff(t.due) < 0).length;

    const h = new Date().getHours();
    const hello = h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    $('hero-hello').textContent = c.name ? `${hello}, @${c.name}` : hello;
    let title, sub;
    if (!list.length) { title = 'Your plan is empty'; sub = 'Add your first task on the left, press N, or tell the AI what you need.'; }
    else if (goal && !actionable.length) { title = 'Everything for today is done'; sub = `${doneToday} finished. Plan tomorrow, or pick something from your backlog.`; }
    else if (goal) { title = `${actionable.length} ${actionable.length === 1 ? 'task' : 'tasks'} left today`; sub = overdue ? `${overdue} ${overdue === 1 ? 'is' : 'are'} overdue. Start with those.` : `${doneToday} already done. Keep the momentum.`; }
    else { title = 'Nothing is due today'; sub = 'Give a task a due date, or start a focus session on your top item.'; }
    $('hero-title').textContent = title;
    $('hero-sub').textContent = sub;
    $('hero-signin').hidden = !!c.signedIn;

    const pct = goal ? doneToday / goal : 0;
    $('ring-fill').style.strokeDashoffset = String(RING * (1 - pct));
    $('ring-n').textContent = goal ? `${Math.round(pct * 100)}%` : '0%';
    $('ring-l').textContent = goal ? `${doneToday} of ${goal} today` : 'no plan today';

    next3 = list.filter(t => !t.done).sort((a, b) => c.score(b) - c.score(a)).slice(0, 3);
    $('next-list').innerHTML = next3.length
      ? next3.map(t => `<li class="p-${t.prio}" data-id="${t.id}"><span title="${esc(t.title)}">${esc(t.title)}</span>${t.due ? `<small>${esc(t.due.slice(5))}</small>` : ''}<button data-focus="${t.id}" aria-label="Focus on ${esc(t.title)}"><i class="fa-solid fa-bullseye"></i></button></li>`).join('')
      : '<li class="none" style="border:none;background:none">Nothing waiting. Nice.</li>';

    petUpdate(map, day, c);
    Focus.sync(list, c);
    const dn = list.filter(t => t.done && (t.z === day || t.l === day));
    $('done-box').hidden = !dn.length; $('dt-n').textContent = dn.length;
    $('dt-list').innerHTML = dn.map(t => `<li><i class="fa-solid fa-circle-check"></i><span title="${esc(t.title)}">${esc(t.title)}</span>${Habit.resetBadge(t) || '<small>one-time</small>'}</li>`).join('');
    const pending = list.filter(t => !t.done).length;
    $('nav-tasks-n').textContent = pending; $('nav-tasks-n').classList.toggle('hot', overdue > 0);
    // view counters
    const cnt = { all: list.length, today: list.filter(t => t.due && c.dayDiff(t.due) === 0).length, upcoming: list.filter(t => !t.done && t.due && c.dayDiff(t.due) > 0).length, overdue };
    document.querySelectorAll('.view-btn').forEach(b => { b.querySelector('b').textContent = cnt[b.dataset.view]; b.classList.toggle('has', b.dataset.view === 'overdue' && overdue > 0); });
  }
  $('next-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-focus]');
    if (b) startFocus(tasks.find(t => t.id === Number(b.dataset.focus)));
  });
  $('hero-focus').addEventListener('click', () => startFocus(next3[0] || null));
  $('hero-signin').addEventListener('click', () => window.DB ? DB.signIn() : toast('Cloud is still loading, try again'));
  $('hero-keys').addEventListener('click', () => $('keys-dlg').showModal());
  $('keys-close').addEventListener('click', () => $('keys-dlg').close());
  $('keys-dlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  // ---------- Pet: grows with your streak. The streak never resets, so the pet never shrinks ----------
  const STAGES = [['Egg', 0], ['Hatchling', 1], ['Sprout', 3], ['Explorer', 7], ['Guardian', 14], ['Champion', 30], ['Legend', 60]];
  const stageOf = (n) => STAGES.reduce((s, [, d], i) => (n >= d ? i : s), 0);
  let petN = 0, petAwake = false, petKey = '', lastP = {}, lastC = null;
  // A drawn pet: same growth stages, shown bigger as the streak grows
    const petImg = (src, stage, awake) => `<img class="pet-img${awake ? '' : ' sleepy'}" src="${esc(src)}" alt="Your pet">${awake ? '' : '<span class="zz-ov">z</span>'}`;
  function petUpdate(map, day, c) {
    const derived = [...map.values()].filter(v => v > 0).length, doneToday = (map.get(day) || 0) > 0;
    const before = JSON.stringify(c.pet || {});
    let p = { n: 0, d: '', r: 0, b: 0, ...(c.pet || {}) };
    if (c.canSavePet) {
      if (doneToday && p.d !== day) { p.r = p.d === Habit.addDays(day, -1) ? (p.r || 0) + 1 : 1; p.b = Math.max(p.b || 0, p.r); p.n += 1; p.d = day; }
      if (derived > p.n) p.n = derived;               // bring older history in the first time
      p.r = Math.max(p.r || 0, Habit.activeStreak(map)); p.b = Math.max(p.b || 0, Habit.bestActive(map), p.r);
      if (JSON.stringify(p) !== before) c.setPet(p);
    }
    const n = Math.max(p.n || 0, derived), st = stageOf(n);
    petN = n; petAwake = doneToday; lastP = p; lastC = c;
    $('sk-now').textContent = n; $('sk-best').textContent = Math.max(p.b || 0, p.r || 0);
    $('pet-side-n').textContent = n;
    const art = c.art || '', key = n + ':' + doneToday + ':' + art, nm = (p.m || '').trim();
    if (key !== petKey) {
      petKey = key;
      const html = art ? petImg(art, st, doneToday) : '';
      $('pet-art').innerHTML = html; $('pet-side-art').innerHTML = html;
      $('pet-art').classList.toggle('has-img', !!art); $('pet-side-art').classList.toggle('has-img', !!art);
    }
    // The pet keeps growing with the streak: 5rem at day 0, about 14rem after a year
    $('pet-btn').style.setProperty('--pet', (5 + 9 * (1 - Math.exp(-n / 60))).toFixed(2) + 'rem');
    ['pet-btn', 'pet-side', 'pet-name-form', 'pet-bar'].forEach(id => { $(id).hidden = !art; });
    $('pet-next').hidden = !art;
    $('pet-title').hidden = !art || !nm; $('pet-title').textContent = nm;
    if (document.activeElement !== $('pet-name')) $('pet-name').value = nm;
    const who = nm || 'Your pet';
    $('pet-msg').textContent = !art ? 'Draw a pet and it grows with your streak.' : doneToday ? `${n}-day streak. ${who} is happy!` : `${who} is sleepy. Finish a task today to wake it up.`;
    if (!art) return;
    if (st < STAGES.length - 1) {
      const [nx, d] = STAGES[st + 1], lo = STAGES[st][1];
      $('pet-fill').style.width = `${Math.round((n - lo) / (d - lo) * 100)}%`;
      $('pet-next').textContent = `${d - n} more ${d - n === 1 ? 'day' : 'days'} to become ${nx}. Your streak never resets.`;
    } else { $('pet-fill').style.width = '100%'; $('pet-next').textContent = 'Fully grown. Your streak never resets.'; }
  }
  $('pet-name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const m = $('pet-name').value.trim().slice(0, 20);
    if (lastC && lastC.canSavePet) { lastC.setPet({ ...lastP, m }); lastP = { ...lastP, m }; $('pet-title').textContent = m; $('pet-title').hidden = !m; toast(m ? `Pet named ${m}` : 'Pet name removed'); }
    else toast('Sign in to name your pet.');
  });
  const SAY = ['Let\'s get something done!', 'I believe in you.', 'Small steps count.', 'Your streak never resets. Take your time.', 'Ready when you are.'];
  $('pet-btn').addEventListener('click', () => {
    $('pet-btn').classList.remove('jump'); void $('pet-btn').offsetWidth; $('pet-btn').classList.add('jump');
    toast(`${(lastP.m || 'Pet')}: ${SAY[Math.floor(Math.random() * SAY.length)]}`);
    if (petAwake) burst($('pet-btn').getBoundingClientRect().left + 40, $('pet-btn').getBoundingClientRect().top + 30, 14);
  });
  $('pet-side').addEventListener('click', () => go('home'));

  $('dt-all').addEventListener('click', () => { go('tasks'); clickEl('[data-view="all"]'); clickEl('[data-filter="done"]'); });
  setInterval(() => Habit.tickResets(), 20000);

  // ---------- Navigation ----------
  const PAGES = { home: 'Home', tasks: 'Tasks', focus: 'Focus', insights: 'Insights', plans: 'Plans', bank: 'Bank', board: 'Leaderboard' };
  function go(p, quiet) {
    if (!PAGES[p]) p = 'home';
    document.querySelectorAll('.page').forEach(x => x.classList.toggle('active', x.dataset.page === p));
    document.querySelectorAll('[data-nav]').forEach(x => { const on = x.dataset.nav === p; x.classList.toggle('active', on); on ? x.setAttribute('aria-current', 'page') : x.removeAttribute('aria-current'); });
    $('page-title').textContent = PAGES[p];
    Focus.title(`${PAGES[p]} | JALTRON`); Focus.pageChanged();
    window.Bank && Bank.pageChanged();
    window.Board && Board.pageChanged();
    if (location.hash !== '#' + p) history.replaceState(null, '', '#' + p);
    if (!quiet) scrollTo({ top: 0 });
  }
  const clickEl = (q) => document.querySelector(q).click();
  const newTask = () => { go('tasks'); setTimeout(() => { $('task-title').scrollIntoView({ block: 'center', behavior: 'smooth' }); $('task-title').focus(); }, 30); };
  document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => go(b.dataset.nav)));
  addEventListener('hashchange', () => go(location.hash.slice(1), true));
  $('nav-ai').addEventListener('click', () => jaltron.openChat(true));
  $('nav-add').addEventListener('click', newTask);
  $('top-add').addEventListener('click', newTask);
  $('nav-keys').addEventListener('click', () => $('keys-dlg').showModal());
  // Stat cards jump to the matching filtered task list
  const jump = [
    () => { clickEl('[data-view="all"]'); clickEl('[data-filter="all"]'); },
    () => { clickEl('[data-view="all"]'); clickEl('[data-filter="pending"]'); },
    () => { clickEl('[data-view="all"]'); clickEl('[data-filter="done"]'); },
    () => { clickEl('[data-view="all"]'); clickEl('[data-filter="pending"]'); $('sort-mode').value = 'prio'; $('sort-mode').dispatchEvent(new Event('change')); },
    () => { clickEl('[data-filter="all"]'); clickEl('[data-view="overdue"]'); }
  ];
  document.querySelectorAll('.stats-grid .card').forEach((c, i) => {
    c.tabIndex = 0; c.setAttribute('role', 'button');
    const run = () => { go('tasks'); jump[i](); };
    c.addEventListener('click', run);
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); } });
  });

  // ---------- Quick due chips ----------
  $('due-chips').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const dow = new Date().getDay(), d = b.dataset.d;
    $('task-due').value = Habit.addDays(Habit.today(), d === 'we' ? (6 - dow + 7) % 7 : Number(d));
  });

  // ---------- Focus (the timer itself lives in lib.js) ----------
  const startFocus = (task) => { go('focus'); Focus.start(task || null); };

  // ---------- Confetti ----------
  const cv = $('fx'), cx = cv.getContext('2d');
  let parts = [], raf = 0;
  const fit = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; };
  fit(); addEventListener('resize', fit);
  function burst(x, y, n = 36) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cols = ['#22d3ee', '#3b82f6', '#34d399', '#e6f1ff', '#a78bfa'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 7;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, s: 3 + Math.random() * 4, c: cols[i % cols.length], life: 1, r: Math.random() * 6 });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function loop() {
    cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    cx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += .28; p.vx *= .985; p.life -= .014; p.r += .2;
      cx.globalAlpha = Math.max(p.life, 0); cx.fillStyle = p.c;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); cx.restore();
    }
    raf = parts.length ? requestAnimationFrame(loop) : 0;
    if (!raf) cx.clearRect(0, 0, innerWidth, innerHeight);
  }
  function celebrate(el, allDone) {
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, allDone ? 110 : 30);
    if (allDone) toast('Plan cleared. Everything is done.');
  }

  // ---------- Command palette ----------
  const pal = $('palette'), pin = $('pal-input'), plist = $('pal-list');
  let items = [], sel = 0;
  const click = (sel_) => () => document.querySelector(sel_).click();
  const COMMANDS = () => [
    { i: 'house', l: 'Go to Home', k: 'dashboard', run: () => go('home') },
    { i: 'list-check', l: 'Go to Tasks', k: 'board list', run: () => go('tasks') },
    { i: 'chart-pie', l: 'Go to Insights', k: 'charts streaks', run: () => go('insights') },
    { i: 'trophy', l: 'Go to Leaderboard', k: 'streak ranking top', run: () => go('board') },
    { i: 'piggy-bank', l: 'Go to Bank', k: 'money workspace pot', run: () => go('bank') },
    { i: 'plus', l: 'New task', k: 'add create', run: newTask },
    { i: 'comment-dots', l: 'Open AI chat', k: 'ask assistant', run: () => jaltron.openChat(true) },
    { i: 'stopwatch', l: 'Go to Focus timer', k: 'pomodoro timer', run: () => go('focus') },
    { i: 'bullseye', l: 'Start focus session', k: 'timer pomodoro start', run: () => startFocus(next3[0] || null) },
    { i: 'bolt', l: 'Smart sort my plan', k: 'optimize order', run: () => { go('tasks'); clickEl('#ai-sort-btn'); } },
    { i: 'sun', l: 'Show today', k: 'view', run: () => { go('tasks'); clickEl('[data-view="today"]'); } },
    { i: 'calendar', l: 'Show upcoming', k: 'view', run: () => { go('tasks'); clickEl('[data-view="upcoming"]'); } },
    { i: 'triangle-exclamation', l: 'Show overdue', k: 'view late', run: () => { go('tasks'); clickEl('[data-view="overdue"]'); } },
    { i: 'layer-group', l: 'Show everything', k: 'view all reset', run: () => { go('tasks'); clickEl('[data-view="all"]'); } },
    { i: 'chart-pie', l: 'Show or hide insights', k: 'charts stats', run: () => { go('insights'); clickEl('#insights-toggle'); } },
    { i: 'broom', l: 'Clear completed tasks', k: 'clean', run: click('#clear-done') },
    { i: 'circle-half-stroke', l: 'Switch theme', k: 'dark light', run: click('#theme-btn') },
    { i: 'user', l: window.DB && DB.user ? 'Open account' : 'Sign in with Google', k: 'login profile', run: click('#auth-btn') },
    { i: 'keyboard', l: 'Keyboard shortcuts', k: 'help keys', run: () => $('keys-dlg').showModal() }
  ];
  function build() {
    const q = pin.value.trim(), lq = q.toLowerCase();
    items = COMMANDS().filter(c => !lq || (c.l + ' ' + c.k).toLowerCase().includes(lq));
    if (lq) {
      tasks.filter(t => !t.done && t.title.toLowerCase().includes(lq)).slice(0, 4)
        .forEach(t => items.push({ i: 'bullseye', l: `Focus: ${t.title}`, run: () => startFocus(t) }));
      items.push({ i: 'magnifying-glass', l: `Search tasks for "${q}"`, run: () => { go('tasks'); $('search').value = q; $('search').dispatchEvent(new Event('input')); } });
      items.unshift({ i: 'plus', l: `Add task "${q}"`, run: () => { go('tasks'); $('task-title').value = q; $('task-form').requestSubmit(); } });
      items.push({ i: 'wand-magic-sparkles', l: `Ask AI: "${q}"`, run: () => { $('cmd-input').value = q; $('cmd-form').requestSubmit(); } });
    }
    sel = 0; paintList();
  }
  function paintList() {
    plist.innerHTML = items.length
      ? items.map((c, n) => `<li role="option" data-n="${n}" class="${n === sel ? 'on' : ''}"><i class="fa-solid fa-${c.i}"></i><span>${esc(c.l)}</span></li>`).join('')
      : '<li class="pal-none">No match</li>';
    const on = plist.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() { pin.value = ''; build(); if (!pal.open) pal.showModal(); pin.focus(); }
  function runItem(n) { const c = items[n]; if (!c) return; pal.close(); setTimeout(c.run, 0); }
  pin.addEventListener('input', build);
  pin.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(items.length, 1); paintList(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % Math.max(items.length, 1); paintList(); }
    else if (e.key === 'Enter') { e.preventDefault(); runItem(sel); }
  });
  plist.addEventListener('click', (e) => { const li = e.target.closest('li[data-n]'); if (li) runItem(Number(li.dataset.n)); });
  pal.addEventListener('click', (e) => { if (e.target === pal) pal.close(); });
  $('open-palette').addEventListener('click', openPalette);

  // ---------- Global shortcuts ----------
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); return pal.open ? pal.close() : openPalette(); }
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'n') { e.preventDefault(); newTask(); }
    else if (k === '1') go('home'); else if (k === '2') go('tasks'); else if (k === '3') go('focus'); else if (k === '4') go('insights');
    else if (k === 'c') { e.preventDefault(); jaltron.openChat(true); }
    else if (k === 'f') { e.preventDefault(); go('focus'); }
    else if (k === 't') $('theme-btn').click();
    else if (e.key === '?') $('keys-dlg').showModal();
  });

  go(location.hash.slice(1) || 'home', true);
  window.Extras = { go, update, startFocus, celebrate, focusId: () => Focus.taskId(), burst, toast };
})();
document.addEventListener('keydown', (e) => { if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) Extras.go('tasks', true); }, true);

// ================= bank =================
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
    if (snap.metadata.fromCache && !pots.length) return renderPots(); // an empty cached answer is not proof: wait for the server before claiming "no pots"
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

// ================= leaderboard =================
// Streak leaderboard: lb/<uid> entries read through DB.lbTop (db.js). Ranked by streak days, the same number the pet and sidebar show.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  let rows = null, at = 0, busy = false;
  const note = (t) => { $('bd-list').innerHTML = `<li class="bd-note">${t}</li>`; };
  function paint() {
    const me = window.DB && DB.user ? DB.user.uid : '';
    if (!me) return note('Sign in to see the leaderboard.');
    if (!rows) return note(busy ? 'Loading...' : 'Could not load the leaderboard. Publish the latest firestore.rules, then press Refresh.');
    if (!rows.length) return note('Nobody is on the board yet. Finish a task today to be the first.');
    const live = (d) => d && d >= Habit.addDays(Habit.today(), -1);
    $('bd-list').innerHTML = rows.map((r, i) => `<li class="bd-row${r.id === me ? ' me' : ''}${i < 3 ? ' top' + (i + 1) : ''}">
      <span class="bd-rank">${i + 1}</span>
      <span class="bd-name"><span>@${esc(r.n)}${r.id === me ? ' <em>you</em>' : ''}</span><small>${live(r.d) ? '<i class="bd-on"></i>active' : r.d ? 'last active ' + esc(r.d.slice(5)) : ''}${r.b ? ` · best run ${r.b}` : ''}</small></span>
      <span class="bd-n"><i class="fa-solid fa-fire"></i> ${r.t}<small>days</small></span></li>`).join('');
  }
  async function load() {
    if (busy || !window.DB || !DB.user) return paint();
    busy = true; paint();
    try { rows = await DB.lbTop(25); at = Date.now(); } catch (e) { console.error(e); rows = null; }
    busy = false; paint();
  }
  $('bd-refresh').addEventListener('click', load);
  addEventListener('jaltron:user', () => { rows = null; at = 0; if (document.querySelector('.page.active')?.dataset.page === 'board') setTimeout(load, 400); });
  window.Board = { pageChanged: () => { if (document.querySelector('.page.active')?.dataset.page === 'board' && Date.now() - at > 30000) load(); else paint(); } };
})();

// ---------- Menu drawer (tablet and phone), tab bar and back to top ----------
(function () {
  const $ = (id) => document.getElementById(id), side = $('side'), scrim = $('scrim');
  const isDrawer = () => matchMedia('(max-width: 1000px)').matches;
  const isOpen = () => side.classList.contains('open');
  function setOpen(on) {
    side.classList.toggle('open', on); scrim.hidden = !on; document.body.classList.toggle('menu-open', on);
    ['menu-btn', 'tab-more'].forEach((id) => $(id).setAttribute('aria-expanded', on));
    side.inert = isDrawer() && !on;   // keep keyboard users out of the hidden drawer
    if (on) { const a = side.querySelector('.nav-item.active') || side.querySelector('.nav-item'); if (a) a.focus({ preventScroll: true }); }
  }
  $('menu-btn').addEventListener('click', () => setOpen(!isOpen()));
  $('tab-more').addEventListener('click', () => setOpen(true));
  $('side-close').addEventListener('click', () => setOpen(false));
  scrim.addEventListener('click', () => setOpen(false));
  side.addEventListener('click', (e) => { if (isDrawer() && e.target.closest('.nav-item, .side-pet')) setTimeout(() => setOpen(false), 0); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) setOpen(false); });
  addEventListener('resize', () => { if (!isDrawer() && isOpen()) setOpen(false); side.inert = isDrawer() && !isOpen(); });
  $('tab-add').addEventListener('click', () => $('top-add').click());
  side.inert = isDrawer();

  const up = document.createElement('button');
  up.className = 'to-top'; up.id = 'to-top'; up.hidden = true; up.setAttribute('aria-label', 'Back to top'); up.title = 'Back to top';
  up.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
  up.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(up);
  let tick = false;
  addEventListener('scroll', () => { if (tick) return; tick = true; requestAnimationFrame(() => { tick = false; up.hidden = scrollY < 700; }); }, { passive: true });
})();
