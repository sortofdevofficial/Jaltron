'use strict';
// JALTRON extras: hero dashboard, level system, focus timer, command palette, shortcuts, confetti.
// Nothing here is saved anywhere. Levels come from your completed-task history (habits.js), so they follow your account.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const RANKS = ['Rookie', 'Operator', 'Planner', 'Strategist', 'Architect', 'Specialist', 'Mastermind', 'Legend'];
  const RING = 2 * Math.PI * 58, DOCK = 2 * Math.PI * 27;
  let tasks = [], ctx = {}, prevLevel = 0, next3 = [];
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

    // Level: 10 XP per finished task, 5 per day of your best streak
    const total = [...map.values()].reduce((a, n) => a + n, 0);
    const xp = total * 10 + H.bestActive(map) * 5;
    const lv = Math.floor(Math.sqrt(xp / 60)) + 1, lo = 60 * (lv - 1) ** 2, hi = 60 * lv ** 2;
    $('lv-badge').textContent = `Level ${lv} ${RANKS[Math.min(lv - 1, RANKS.length - 1)]}`;
    $('lv-fill').style.width = `${Math.round((xp - lo) / (hi - lo) * 100)}%`;
    $('lv-xp').textContent = `${xp - lo} / ${hi - lo} XP`;
    if (prevLevel && lv > prevLevel) { toast(`Level up! You are now ${RANKS[Math.min(lv - 1, RANKS.length - 1)]}.`); burst(innerWidth / 2, 160, 90); }
    prevLevel = lv;

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
    { i: 'plus', l: 'New task', k: 'add create', run: () => { $('task-title').scrollIntoView({ block: 'center', behavior: 'smooth' }); $('task-title').focus(); } },
    { i: 'comment-dots', l: 'Open AI chat', k: 'ask assistant', run: () => jaltron.openChat(true) },
    { i: 'bullseye', l: 'Start focus session', k: 'timer pomodoro', run: () => startFocus(next3[0] || null) },
    { i: 'bolt', l: 'Smart sort my plan', k: 'optimize order', run: click('#ai-sort-btn') },
    { i: 'sun', l: 'Show today', k: 'view', run: click('[data-view="today"]') },
    { i: 'calendar', l: 'Show upcoming', k: 'view', run: click('[data-view="upcoming"]') },
    { i: 'triangle-exclamation', l: 'Show overdue', k: 'view late', run: click('[data-view="overdue"]') },
    { i: 'layer-group', l: 'Show everything', k: 'view all reset', run: click('[data-view="all"]') },
    { i: 'chart-pie', l: 'Show or hide insights', k: 'charts stats', run: click('#insights-toggle') },
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
      items.push({ i: 'magnifying-glass', l: `Search tasks for "${q}"`, run: () => { $('search').value = q; $('search').dispatchEvent(new Event('input')); } });
      items.unshift({ i: 'plus', l: `Add task "${q}"`, run: () => { $('task-title').value = q; $('task-form').requestSubmit(); } });
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
    if (k === 'n') { e.preventDefault(); $('task-title').scrollIntoView({ block: 'center', behavior: 'smooth' }); $('task-title').focus(); }
    else if (k === 'c') { e.preventDefault(); jaltron.openChat(true); }
    else if (k === 'f') { e.preventDefault(); startFocus(next3[0] || null); }
    else if (k === 't') $('theme-btn').click();
    else if (e.key === '?') $('keys-dlg').showModal();
  });

  window.Extras = { update, startFocus, celebrate, focusId: () => (F.task && !$('focus-dock').hidden ? F.task.id : null) };
})();
