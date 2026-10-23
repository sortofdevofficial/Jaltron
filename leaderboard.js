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
