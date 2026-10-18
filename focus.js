'use strict';
// JALTRON focus: a Pomodoro-style timer with its own page, a mini timer for other pages, stats and settings.
// Saved in Firestore as one short field on your user doc: f { d: day, m: minutes today, s: sessions today, t: all-time minutes, c: [focus, short, long, every, auto, sound] }
(function (root) {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };
  const RING = 2 * Math.PI * 98, DOCK = 2 * Math.PI * 27;
  const cfg = { focus: 25, short: 5, long: 15, every: 4, auto: false, sound: true, notify: false };
  const st = { mode: 'focus', total: 1500, left: 1500, end: 0, running: false, id: null, taskId: null, cycle: 0 };
  let stats = { d: '', m: 0, s: 0, t: 0 }, log = [], tasks = [], pickSig = '', lastApplied = '', saver = null, saveT = null, base = document.title;
  const today = () => Habit.today();
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const dur = (m) => cfg[m] * 60;
  const left = () => st.running ? Math.max(0, Math.ceil((st.end - Date.now()) / 1000)) : st.left;
  const active = () => st.running || st.left < st.total;
  const page = () => (document.querySelector('.page.active') || {}).dataset.page;
  const toast = (m) => root.Extras && Extras.toast(m);
  const hm = (m) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  const taskOf = () => tasks.find(t => t.id === st.taskId) || null;

  function beep() {
    if (!cfg.sound) return;
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      [660, 880, 1040].forEach((f, i) => {
        const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + i * .2;
        o.frequency.value = f; o.connect(g); g.connect(a.destination);
        g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.25, t0 + .03); g.gain.exponentialRampToValueAtTime(.0001, t0 + .28);
        o.start(t0); o.stop(t0 + .3);
      });
    } catch {}
  }

  // ---- saving (short, debounced) ----
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const f = { d: stats.d, m: stats.m, s: stats.s, t: stats.t, c: [cfg.focus, cfg.short, cfg.long, cfg.every, +cfg.auto, +cfg.sound] };
      lastApplied = JSON.stringify(f);
      if (saver) saver(f);
    }, 1200);
  }
  function addStats(min, sessions) {
    if (stats.d !== today()) stats = { d: today(), m: 0, s: 0, t: stats.t };
    stats.m += min; stats.s += sessions; stats.t += min;
    save(); renderStats();
  }
  // Credit minutes you actually focused when you stop or skip early
  function creditPartial() {
    if (st.mode !== 'focus') return;
    const mins = Math.floor((st.total - left()) / 60);
    if (mins >= 1 && left() > 0) { addStats(mins, 0); log.unshift({ at: new Date(), m: mins, task: taskOf() ? taskOf().title : '', part: true }); renderStats(); }
  }

  // ---- engine ----
  function setMode(mode) {
    clearInterval(st.id); st.running = false;
    st.mode = mode; st.total = st.left = dur(mode);
    paint();
  }
  function start(task) {
    if (task) st.taskId = task.id;
    if (!st.running) {
      if (st.left <= 0) st.left = st.total;
      st.end = Date.now() + st.left * 1000; st.running = true;
      clearInterval(st.id); st.id = setInterval(tick, 250);
    }
    paint();
    if (task && root.Extras) Extras.refreshCards && Extras.refreshCards();
  }
  function pause() { if (!st.running) return; st.left = left(); st.running = false; clearInterval(st.id); paint(); }
  const toggle = () => (st.running ? pause() : start());
  function reset() { creditPartial(); setMode(st.mode); }
  function skip() {
    creditPartial();
    const wasOn = st.running, next = st.mode === 'focus' ? 'short' : 'focus';
    setMode(next);
    if (wasOn || cfg.auto) start();
  }
  function tick() { if (left() <= 0) complete(); else paint(true); }
  function complete() {
    clearInterval(st.id); st.running = false;
    let msg, next;
    if (st.mode === 'focus') {
      st.cycle++; addStats(cfg.focus, 1);
      log.unshift({ at: new Date(), m: cfg.focus, task: taskOf() ? taskOf().title : '' });
      next = st.cycle % cfg.every === 0 ? 'long' : 'short';
      msg = `Focus session done${taskOf() ? ': ' + taskOf().title : ''}. Time for a ${next === 'long' ? 'long' : 'short'} break.`;
    } else {
      if (st.mode === 'long') st.cycle = 0;
      next = 'focus'; msg = 'Break is over. Ready for the next focus session?';
    }
    beep(); toast(msg);
    if (root.Extras) Extras.burst(innerWidth / 2, innerHeight / 3, st.mode === 'focus' ? 70 : 20);
    if (cfg.notify && 'Notification' in window && Notification.permission === 'granted') { try { new Notification('JALTRON', { body: msg, icon: 'favicon.png' }); } catch {} }
    setMode(next);
    if (cfg.auto) start();
  }

  // ---- drawing ----
  function paint(fast) {
    const l = left(), on = st.running, act = active(), pg = page(), t = taskOf();
    $('fp-time').textContent = fmt(l);
    $('fp-prog').style.strokeDashoffset = String(RING * (1 - l / st.total));
    $('fd-time').textContent = fmt(l);
    $('fd-fill').style.strokeDashoffset = String(DOCK * (1 - l / st.total));
    $('focus-dock').hidden = !act || pg === 'focus';
    const nb = $('nav-focus-t'); nb.hidden = !act; nb.textContent = fmt(l);
    document.title = on ? `${fmt(l)} ${LABEL[st.mode]} | JALTRON` : base;
    if (fast === true) return;
    $('fp-main-card').dataset.mode = st.mode;
    document.querySelectorAll('.fp-mode').forEach(b => { const o = b.dataset.mode === st.mode; b.classList.toggle('active', o); b.setAttribute('aria-selected', o); });
    $('fp-state').textContent = on ? (st.mode === 'focus' ? 'Stay with it' : 'Rest and breathe') : act ? 'Paused' : st.mode === 'focus' ? 'Ready to focus' : 'Ready for a break';
    const label = on ? 'Pause' : act ? 'Resume' : 'Start', icon = on ? 'pause' : 'play';
    if ($('fp-main').dataset.s !== label) { $('fp-main').dataset.s = label; $('fp-main').innerHTML = `<i class="fa-solid fa-${icon}"></i><span>${label}</span>`; }
    $('fp-task').textContent = t ? t.title : 'Free focus';
    $('fp-complete').hidden = !t;
    if ($('fp-pick').value !== String(st.taskId || '')) $('fp-pick').value = st.taskId || '';
    const filled = st.mode === 'long' && st.cycle > 0 ? cfg.every : st.cycle % cfg.every;
    $('fp-dots').innerHTML = Array.from({ length: cfg.every }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');
    document.querySelectorAll('#fp-presets [data-min]').forEach(b => b.classList.toggle('on', st.mode === 'focus' && Number(b.dataset.min) === cfg.focus));
    $('fd-task').textContent = t ? t.title : LABEL[st.mode];
    $('fd-toggle').innerHTML = `<i class="fa-solid fa-${on ? 'pause' : 'play'}"></i>`;
    $('fd-toggle').setAttribute('aria-label', on ? 'Pause' : 'Resume');
  }
  function renderStats() {
    const d = stats.d === today() ? stats : { m: 0, s: 0 };
    $('fp-s-n').textContent = d.s; $('fp-s-m').textContent = hm(d.m); $('fp-s-t').textContent = hm(stats.t);
    $('fp-log').innerHTML = log.length
      ? log.slice(0, 8).map(e => `<li><i class="fa-solid fa-${e.part ? 'hourglass-half' : 'circle-check'}"></i><span>${esc(e.task || 'Free focus')}</span><small>${e.m}m, ${e.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></li>`).join('')
      : '<li class="none">Finished sessions show up here.</li>';
  }
  function renderPick() {
    const sig = tasks.filter(t => !t.done).map(t => t.id + t.title).join('|');
    if (sig === pickSig) return;
    pickSig = sig;
    $('fp-pick').innerHTML = '<option value="">Free focus (no task)</option>' + tasks.filter(t => !t.done).map(t => `<option value="${t.id}">${esc(t.title.length > 60 ? t.title.slice(0, 57) + '...' : t.title)}</option>`).join('');
    $('fp-pick').value = st.taskId || '';
  }
  function fillCfg() {
    $('cf-focus').value = cfg.focus; $('cf-short').value = cfg.short; $('cf-long').value = cfg.long; $('cf-every').value = cfg.every;
    $('cf-auto').checked = cfg.auto; $('cf-sound').checked = cfg.sound; $('cf-notify').checked = cfg.notify;
    $('fp-custom').value = cfg.focus;
  }

  // ---- controls ----
  $('fp-main').addEventListener('click', toggle);
  $('fp-reset').addEventListener('click', reset);
  $('fp-skip').addEventListener('click', skip);
  document.querySelectorAll('.fp-mode').forEach(b => b.addEventListener('click', () => { creditPartial(); setMode(b.dataset.mode); }));
  $('fp-pick').addEventListener('change', (e) => { st.taskId = e.target.value ? Number(e.target.value) : null; paint(); });
  $('fp-complete').addEventListener('click', () => {
    const t = taskOf();
    if (!t) return;
    if (root.jaltron && jaltron.complete(t.id)) { st.taskId = null; toast(`Done: ${t.title}`); paint(); }
    else toast('Open the Tasks page and tick it there.');
  });
  function setFocusMins(n) {
    n = Math.max(1, Math.min(180, Math.round(Number(n)) || cfg.focus));
    cfg.focus = n; fillCfg();
    if (st.mode === 'focus' && !active()) { st.total = st.left = dur('focus'); }
    paint(); save();
  }
  $('fp-presets').addEventListener('click', (e) => { const b = e.target.closest('[data-min]'); if (b) { if (st.mode !== 'focus' && !active()) setMode('focus'); setFocusMins(b.dataset.min); } });
  $('fp-custom').addEventListener('change', (e) => setFocusMins(e.target.value));
  ['focus', 'short', 'long', 'every'].forEach(k => $('cf-' + k).addEventListener('change', (e) => {
    const v = Math.max(1, Math.min(k === 'every' ? 12 : 180, Math.round(Number(e.target.value)) || cfg[k]));
    cfg[k] = v; fillCfg();
    if (!active() && (k === st.mode)) { st.total = st.left = dur(st.mode); }
    paint(); save();
  }));
  $('cf-auto').addEventListener('change', (e) => { cfg.auto = e.target.checked; save(); });
  $('cf-sound').addEventListener('change', (e) => { cfg.sound = e.target.checked; if (cfg.sound) beep(); save(); });
  $('cf-notify').addEventListener('change', async (e) => {
    if (!e.target.checked) { cfg.notify = false; return; }
    if (!('Notification' in window)) { e.target.checked = false; return toast('This browser has no notifications.'); }
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    cfg.notify = p === 'granted'; e.target.checked = cfg.notify;
    if (!cfg.notify) toast('Notifications are blocked for this site.');
  });
  // Zen mode: just the timer, full screen
  function zen(on) {
    document.body.classList.toggle('zen', on);
    $('fp-zen').innerHTML = on ? '<i class="fa-solid fa-compress"></i> Leave zen' : '<i class="fa-solid fa-expand"></i> Zen mode';
    try { on ? document.documentElement.requestFullscreen && document.documentElement.requestFullscreen() : document.fullscreenElement && document.exitFullscreen(); } catch {}
  }
  $('fp-zen').addEventListener('click', () => zen(!document.body.classList.contains('zen')));
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('zen')) zen(false); });
  // Mini timer
  $('fd-toggle').addEventListener('click', toggle);
  $('fd-open').addEventListener('click', () => Extras.go('focus'));
  $('fd-close').addEventListener('click', reset);
  // Keys on the Focus page
  document.addEventListener('keydown', (e) => {
    if (page() !== 'focus' || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (k === 'r') reset(); else if (k === 's') skip(); else if (k === 'z') $('fp-zen').click();
  });

  // ---- hooks used by extras.js ----
  function sync(list, c) {
    tasks = list;
    if (st.taskId && !list.some(t => t.id === st.taskId && !t.done)) st.taskId = null;
    saver = c.setFocus;
    if (c.canSavePet) {
      const f = c.focus || {}, js = JSON.stringify(f);
      if (js !== lastApplied) {
        lastApplied = js;
        const day = today(), same = f.d === day;
        stats = { d: day, m: same ? f.m || 0 : 0, s: same ? f.s || 0 : 0, t: f.t || 0 };
        if (Array.isArray(f.c) && !active()) {
          [cfg.focus, cfg.short, cfg.long, cfg.every] = f.c.slice(0, 4).map((n, i) => Math.max(1, Number(n) || [25, 5, 15, 4][i]));
          cfg.auto = !!f.c[4]; cfg.sound = f.c[5] === undefined ? true : !!f.c[5];
          st.total = st.left = dur(st.mode); fillCfg();
        }
        renderStats();
      }
    }
    renderPick(); paint();
  }
  root.Focus = {
    start, pause, toggle, reset, sync,
    taskId: () => (active() ? st.taskId : null),
    title: (t) => { base = t; if (!st.running) document.title = t; },
    pageChanged: paint
  };
  fillCfg(); renderStats(); renderPick(); paint();
})(window);
