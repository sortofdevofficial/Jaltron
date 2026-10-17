'use strict';
// JALTRON extras: hero dashboard, focus timer, command palette, shortcuts, confetti.
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
  let petN = 0, petAwake = false, petKey = '', petUid = 0;
  function petSvg(stage, awake) {
    const id = 'pg' + (++petUid);
    const defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#3b82f6"/></linearGradient><radialGradient id="${id}e" cx=".4" cy=".35"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#cfe9f7"/></radialGradient></defs>`;
    const shadow = '<ellipse cx="50" cy="90" rx="22" ry="3.5" fill="rgba(0,0,0,.14)"/>';
    if (stage === 0) {
      return `<svg viewBox="0 0 100 100" class="pet-svg" aria-hidden="true">${defs}${shadow}<g class="bob"><ellipse cx="50" cy="62" rx="22" ry="28" fill="url(#${id}e)" stroke="#7cc4e6" stroke-width="2"/><path d="M34 56 l7 -6 l6 7 l7 -7 l6 7 l7 -6" fill="none" stroke="#22d3ee" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="42" cy="73" r="3" fill="#bfe3f5"/><circle cx="58" cy="69" r="2.4" fill="#bfe3f5"/></g>${awake ? '' : '<text x="76" y="26" class="zz">z</text>'}</svg>`;
    }
    const R = [0, 17, 21, 24, 27, 30, 32][stage], ry = R * 0.92, cy = 86 - ry, top = cy - ry;
    const ex = R * 0.4, ey = cy - R * 0.08, er = Math.max(2.4, R * 0.14), m = R * 0.12, my = ey + er * 2.5;
    const eye = (x) => awake
      ? `<circle cx="${x}" cy="${ey}" r="${er}" fill="#0b1b33"/><circle cx="${x + er * .35}" cy="${ey - er * .35}" r="${er * .38}" fill="#fff"/>`
      : `<path d="M${x - er} ${ey} Q${x} ${ey + er * 1.2} ${x + er} ${ey}" fill="none" stroke="#0b1b33" stroke-width="2" stroke-linecap="round"/>`;
    let back = '', front = '';
    if (stage >= 4) {
      const w = `<path d="M${50 - R * .85} ${cy + R * .1} Q${50 - R * 1.7} ${cy - R * .5} ${50 - R * 1.25} ${cy - R * 1.05} Q${50 - R * .75} ${cy - R * .7} ${50 - R * .6} ${cy - R * .2} Z" fill="#7dd3fc" opacity=".9"/>`;
      back += w + `<g transform="translate(100 0) scale(-1 1)">${w}</g>`;
    }
    if (stage >= 2) front += `<ellipse cx="${50 - R * .45}" cy="86" rx="${R * .22}" ry="${R * .11}" fill="#2f7fe0"/><ellipse cx="${50 + R * .45}" cy="86" rx="${R * .22}" ry="${R * .11}" fill="#2f7fe0"/>`;
    const body = `<ellipse cx="50" cy="${cy}" rx="${R}" ry="${ry}" fill="url(#${id})"/>`
      + (stage >= 2 ? `<ellipse cx="50" cy="${cy + R * .3}" rx="${R * .55}" ry="${R * .45}" fill="rgba(255,255,255,.28)"/>` : '')
      + (stage >= 4 ? `<ellipse cx="${50 - R * .98}" cy="${cy + R * .2}" rx="${R * .15}" ry="${R * .22}" fill="url(#${id})"/><ellipse cx="${50 + R * .98}" cy="${cy + R * .2}" rx="${R * .15}" ry="${R * .22}" fill="url(#${id})"/>` : '')
      + `<g class="eyes">${eye(50 - ex)}${eye(50 + ex)}</g>`
      + (stage >= 2 ? `<ellipse cx="${50 - R * .64}" cy="${ey + er * 2}" rx="${R * .12}" ry="${R * .07}" fill="#f9a8d4" opacity=".65"/><ellipse cx="${50 + R * .64}" cy="${ey + er * 2}" rx="${R * .12}" ry="${R * .07}" fill="#f9a8d4" opacity=".65"/>` : '')
      + (awake ? `<path d="M${50 - m} ${my} Q50 ${my + m * 1.2} ${50 + m} ${my}" fill="none" stroke="#0b1b33" stroke-width="2" stroke-linecap="round"/>` : `<ellipse cx="50" cy="${my + 1}" rx="${m * .45}" ry="${m * .35}" fill="#0b1b33" opacity=".75"/>`);
    let extra = '';
    if (stage >= 5) extra += `<path d="M${50 - R * .72} ${cy + R * .5} Q50 ${cy + R * .78} ${50 + R * .72} ${cy + R * .5} L${50 + R * .72} ${cy + R * .66} Q50 ${cy + R * .94} ${50 - R * .72} ${cy + R * .66} Z" fill="#f43f5e"/>`;
    if (stage === 6) extra += `<path d="M${50 - R * .4} ${top + 3} L${50 - R * .4} ${top - 8} L${50 - R * .2} ${top - 2} L50 ${top - 11} L${50 + R * .2} ${top - 2} L${50 + R * .4} ${top - 8} L${50 + R * .4} ${top + 3} Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.4" stroke-linejoin="round"/><path class="tw" d="M16 30 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="#fde047"/><path class="tw" d="M84 22 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 l4 -1.6 z" fill="#fde047"/>`;
    else if (stage >= 3) extra += `<line x1="50" y1="${top + 1}" x2="50" y2="${top - 9}" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round"/><circle class="tip" cx="50" cy="${top - 11}" r="3.4" fill="#fde047"/>`;
    return `<svg viewBox="0 0 100 100" class="pet-svg" aria-hidden="true">${defs}${shadow}<g class="bob">${back}${front}${body}${extra}</g>${awake ? '' : '<text x="78" y="26" class="zz">z</text>'}</svg>`;
  }
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
    petN = n; petAwake = doneToday;
    $('sk-now').textContent = n; $('sk-best').textContent = Math.max(p.b || 0, p.r || 0);
    $('pet-side-n').textContent = n;
    const key = st + ':' + doneToday;
    if (key !== petKey) { petKey = key; $('pet-art').innerHTML = petSvg(st, doneToday); $('pet-side-art').innerHTML = petSvg(st, doneToday); }
    $('pet-title').textContent = `Jalty the ${STAGES[st][0]}`;
    $('pet-msg').textContent = doneToday ? `${n}-day streak. Jalty is happy!` : n === 0 ? 'Finish a task to hatch your pet.' : 'Jalty is sleepy. Finish a task today to wake it up.';
    if (st < STAGES.length - 1) {
      const [nm, d] = STAGES[st + 1], lo = STAGES[st][1];
      $('pet-fill').style.width = `${Math.round((n - lo) / (d - lo) * 100)}%`;
      $('pet-next').textContent = `${d - n} more ${d - n === 1 ? 'day' : 'days'} to become ${nm}. Your streak never resets.`;
    } else { $('pet-fill').style.width = '100%'; $('pet-next').textContent = 'Fully grown. Your streak never resets.'; }
  }
  const SAY = ['Let\'s get something done!', 'I believe in you.', 'Small steps count.', 'Your streak never resets. Take your time.', 'Ready when you are.'];
  $('pet-btn').addEventListener('click', () => {
    $('pet-btn').classList.remove('jump'); void $('pet-btn').offsetWidth; $('pet-btn').classList.add('jump');
    toast(`Jalty: ${SAY[Math.floor(Math.random() * SAY.length)]}`);
    if (petAwake) burst($('pet-btn').getBoundingClientRect().left + 40, $('pet-btn').getBoundingClientRect().top + 30, 14);
  });
  $('pet-side').addEventListener('click', () => go('home'));

  // ---------- Navigation ----------
  const PAGES = { home: 'Home', tasks: 'Tasks', insights: 'Insights' };
  function go(p, quiet) {
    if (!PAGES[p]) p = 'home';
    document.querySelectorAll('.page').forEach(x => x.classList.toggle('active', x.dataset.page === p));
    document.querySelectorAll('[data-nav]').forEach(x => { const on = x.dataset.nav === p; x.classList.toggle('active', on); on ? x.setAttribute('aria-current', 'page') : x.removeAttribute('aria-current'); });
    $('page-title').textContent = PAGES[p];
    F.orig = `${PAGES[p]} | JALTRON`; if (!F.running) document.title = F.orig;
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
  $('nav-focus').addEventListener('click', () => startFocus(next3[0] || null));
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

  // ---------- Focus timer ----------
  const F = { task: null, total: 25 * 60, end: 0, left: 25 * 60, running: false, id: null, orig: document.title };
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function paint() {
    const s = Math.max(0, F.running ? Math.ceil((F.end - Date.now()) / 1000) : F.left);
    $('fd-time').textContent = fmt(s);
    $('fd-fill').style.strokeDashoffset = String(DOCK * (1 - s / F.total));
    document.title = F.running ? `${fmt(s)} Focus | JALTRON` : F.orig;
    $('fd-toggle').innerHTML = `<i class="fa-solid fa-${F.running ? 'pause' : 'play'}"></i>`;
    return s;
  }
  function tick() {
    if (paint() > 0) return;
    stop(false);
    $('fd-time').textContent = 'Done';
    beep();
    toast(F.task ? `Focus session finished: ${F.task.title}` : 'Focus session finished');
    burst(innerWidth / 2, innerHeight - 100, 60);
  }
  function startFocus(task, mins = 25) {
    clearInterval(F.id);
    F.task = task || null; F.total = F.left = mins * 60; F.end = Date.now() + F.left * 1000; F.running = true;
    $('fd-task').textContent = task ? task.title : 'Free focus';
    $('fd-done').hidden = !task;
    $('focus-dock').hidden = false;
    F.id = setInterval(tick, 250); paint();
    window.dispatchEvent(new Event('jaltron:focus'));
  }
  function stop(hide) {
    clearInterval(F.id); F.running = false;
    document.title = F.orig;
    if (hide) $('focus-dock').hidden = true;
    paint();
  }
  $('fd-toggle').addEventListener('click', () => {
    if (F.running) { F.left = Math.max(0, Math.ceil((F.end - Date.now()) / 1000)); stop(false); }
    else if (F.left > 0) { F.end = Date.now() + F.left * 1000; F.running = true; F.id = setInterval(tick, 250); paint(); }
    else startFocus(F.task);
  });
  $('fd-add').addEventListener('click', () => { F.total += 300; if (F.running) F.end += 300000; else F.left += 300; paint(); });
  $('fd-close').addEventListener('click', () => { stop(true); F.task = null; document.querySelectorAll('.focusing').forEach(x => x.classList.remove('focusing')); });
  $('fd-done').addEventListener('click', () => {
    const el = document.querySelector(`.task-item[data-id="${F.task && F.task.id}"] .check-btn`);
    stop(true);
    if (el) el.click();
    F.task = null;
  });
  function beep() {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      [660, 880].forEach((f, i) => {
        const o = a.createOscillator(), g = a.createGain();
        o.frequency.value = f; o.connect(g); g.connect(a.destination);
        g.gain.setValueAtTime(.0001, a.currentTime + i * .22); g.gain.exponentialRampToValueAtTime(.25, a.currentTime + i * .22 + .03); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + i * .22 + .3);
        o.start(a.currentTime + i * .22); o.stop(a.currentTime + i * .22 + .32);
      });
    } catch {}
  }

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
    { i: 'plus', l: 'New task', k: 'add create', run: newTask },
    { i: 'comment-dots', l: 'Open AI chat', k: 'ask assistant', run: () => jaltron.openChat(true) },
    { i: 'bullseye', l: 'Start focus session', k: 'timer pomodoro', run: () => startFocus(next3[0] || null) },
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
    else if (k === '1') go('home'); else if (k === '2') go('tasks'); else if (k === '3') go('insights');
    else if (k === 'c') { e.preventDefault(); jaltron.openChat(true); }
    else if (k === 'f') { e.preventDefault(); startFocus(next3[0] || null); }
    else if (k === 't') $('theme-btn').click();
    else if (e.key === '?') $('keys-dlg').showModal();
  });

  go(location.hash.slice(1) || 'home', true);
  window.Extras = { go, update, startFocus, celebrate, focusId: () => (F.task && !$('focus-dock').hidden ? F.task.id : null) };
})();
document.addEventListener('keydown', (e) => { if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) Extras.go('tasks', true); }, true);
