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
    const hello = h < 5 ? '🌙 Late night' : h < 12 ? '☀️ Good morning' : h < 18 ? '🌤️ Good afternoon' : '🌆 Good evening';
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
  const STAGES = [['Egg 🥚', 0], ['Hatchling 🐣', 1], ['Sprout 🌱', 3], ['Explorer 🧭', 7], ['Guardian 🛡️', 14], ['Champion 🏆', 30], ['Legend 👑', 60]];
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
    $('pet-msg').textContent = !art ? 'Draw a pet and it grows with your streak.' : doneToday ? `🔥 ${n}-day streak. ${who} is happy! 😄` : `😴 ${who} is sleepy. Finish a task today to wake it up.`;
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
    toast(`🐾 ${(lastP.m || 'Pet')}: ${SAY[Math.floor(Math.random() * SAY.length)]}`);
    if (petAwake) burst($('pet-btn').getBoundingClientRect().left + 40, $('pet-btn').getBoundingClientRect().top + 30, 14);
  });
  $('pet-side').addEventListener('click', () => go('home'));

  $('dt-all').addEventListener('click', () => { go('tasks'); clickEl('[data-view="all"]'); clickEl('[data-filter="done"]'); });
  setInterval(() => Habit.tickResets(), 20000);

  // ---------- Navigation ----------
  const PAGES = { home: 'Home', tasks: 'Tasks', focus: 'Focus', insights: 'Insights', plans: 'Plans', bank: 'Bank', links: 'Links', board: 'Leaderboard', reviews: 'Reviews', settings: 'Settings' };
  const EMO = { home: '🏠', tasks: '✅', focus: '⏱️', insights: '📊', plans: '⚡', bank: '🐷', links: '🔗', board: '🏆', reviews: '⭐', settings: '⚙️' };
  function go(p, quiet) {
    if (!PAGES[p]) p = 'home';
    document.querySelectorAll('.page').forEach(x => x.classList.toggle('active', x.dataset.page === p));
    document.querySelectorAll('[data-nav]').forEach(x => { const on = x.dataset.nav === p; x.classList.toggle('active', on); on ? x.setAttribute('aria-current', 'page') : x.removeAttribute('aria-current'); });
    $('page-title').textContent = EMO[p] ? `${EMO[p]} ${PAGES[p]}` : PAGES[p];
    Focus.title(`${PAGES[p]} | JALTRON`); Focus.pageChanged();
    window.Bank && Bank.pageChanged();
    window.Links && Links.pageChanged();
    window.Board && Board.pageChanged();
    window.Reviews && Reviews.pageChanged();
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
    if (allDone) toast('🎉 Plan cleared. Everything is done.');
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
    { i: 'up-right-from-square', l: 'Go to Links', k: 'bookmarks saved urls private', run: () => go('links') },
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
    { i: 'sliders', l: 'Go to Settings', k: 'appearance theme dark light system preferences', run: () => go('settings') },
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

// ================= leaderboard =================
// Streak leaderboard: lb/<uid> entries { t, b, d } read through DB.lbTop (db.js). Ranked by streak days, the same number the pet and sidebar show.
// Names are not stored on the board; every row resolves its uid through the nm claims, like the bank log.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const TOP = 10;
  let rows = null, mine = null, at = 0, busy = false;
  const note = (t) => { $('bd-list').innerHTML = `<li class="bd-note">${t}</li>`; };
  const fillNames = () => $('bd-list').querySelectorAll('[data-nm]').forEach(el => DB.nameOf(el.dataset.nm).then(n => { el.textContent = '@' + (n || 'someone'); }));
  function paint() {
    const me = window.DB && DB.user ? DB.user.uid : '';
    if (!me) return note('Sign in to see the leaderboard.');
    if (!rows) return note(busy ? 'Loading...' : 'Could not load the leaderboard. Publish the latest firestore.rules, then press Refresh.');
    if (!rows.length) return note('Nobody is on the board yet. Finish a task today to be the first.');
    const live = (d) => d && d >= Habit.dayMs(Habit.addDays(Habit.today(), -1));
    $('bd-list').innerHTML = rows.map((r, i) => `<li class="bd-row${r.id === me ? ' me' : ''}${i < 3 ? ' top' + (i + 1) : ''}">
      <span class="bd-rank">${['🥇', '🥈', '🥉'][i] || i + 1}</span>
      <span class="bd-name"><span><span data-nm="${esc(r.id)}">@…</span>${r.id === me ? ' <em>you</em>' : ''}</span><small>${live(r.d) ? '<i class="bd-on"></i>active' : r.d ? 'last active ' + esc(Habit.msDay(r.d).slice(5)) : ''}${r.b ? ` · best run ${r.b}` : ''}</small></span>
      <span class="bd-n"><i class="fa-solid fa-fire"></i> ${r.t}<small>days</small></span></li>`).join('')
      + (mine && !rows.some((r) => r.id === me) ? `<li class="bd-gap" aria-hidden="true">...</li><li class="bd-row me">
      <span class="bd-rank">${mine.rank}</span>
      <span class="bd-name"><span><span data-nm="${esc(mine.id)}">@…</span> <em>you</em></span><small>not in the top ${TOP} yet</small></span>
      <span class="bd-n"><i class="fa-solid fa-fire"></i> ${mine.t}<small>days</small></span></li>` : '');
    fillNames();
  }
  async function load() {
    if (busy || !window.DB || !DB.user) return paint();
    busy = true; paint();
    // d is Unix ms; each owner's entry self-migrates on their next visit, until then old ISO days are read fine
    try { rows = (await DB.lbTop(TOP)).slice(0, TOP).map((r) => ({ ...r, d: typeof r.d === 'string' ? Habit.dayMs(r.d) : (r.d || 0) })); at = Date.now(); } catch (e) { console.error(e); rows = null; }
    // Not in the top 10? Show where you stand, below the list
    mine = null;
    if (rows && DB.lbRank && !rows.some((r) => r.id === DB.user.uid)) { try { mine = await DB.lbRank(); } catch (e) { console.error(e); } }
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
