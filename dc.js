(() => {
  const q0 = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById('dc-' + id);
  const fmt = (n) => Number(n || 0).toLocaleString();
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const clear = (e) => { e.textContent = ''; return e; };
  const MEDAL = ['🥇', '🥈', '🥉'];
  let M = {}, V = [], U = {}, C = null, page = 0, view = [], picked = null;

  const toast = (t) => { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 1600); };
  const copy = (text, what) => { try { navigator.clipboard.writeText(text).then(() => toast((what || 'Copied') + ' copied')); } catch { toast(text); } };

  // Everything comes through /api/pub (cached by Vercel), never straight from Firestore.
  // The last payload is kept in localStorage with its version: an unchanged reply is a 304 with no body.
  const CACHE = 'jt:pub:v1:';
  const get = async (name) => {
    let hit = null;
    try { hit = JSON.parse(localStorage.getItem(CACHE + name) || 'null'); } catch {}
    // Never hang on a slow upstream: after 9s fall back to the cached copy, if there is one.
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch('/api/pub?name=' + name, { headers: hit && hit.v ? { 'X-Pub-Version': hit.v } : {}, signal: ctl.signal });
      if (r.status === 304) return hit && hit.d;
      if (!r.ok) return hit && hit.d;
      const d = await r.json(), v = r.headers.get('X-Pub-Version') || '';
      try { localStorage.setItem(CACHE + name, JSON.stringify({ v, d })); } catch {}
      return d;
    } catch { return hit && hit.d; }
    finally { clearTimeout(timer); }
  };

  // ── saved format: a vouch is [id in base 36, giver #, receiver #, item #, comment?]; the time is inside the Discord message id ──
  const unb36 = (s) => [...s].reduce((n, c) => n * 36n + BigInt(parseInt(c, 36)), 0n).toString();
  const idTime = (id) => Number((BigInt(id) >> 22n) + 1420070400000n);
  function expand(D) {
    const rows = [], users = {};
    const Gu = Array.isArray(D.u) ? D.u : null, Gitems = Array.isArray(D.i) ? D.i : null;
    if (Gu) for (const [id, n, v] of Gu) users[id] = [n || 'User', v || null];
    for (const ch of D.chunks || []) {
      const items = Gitems || ch.i || [];
      if (ch.v === 2 && Gu) {
        for (const [m, gi, ri, wi, c] of ch.r || []) {
          const id = unb36(m), a = Gu[gi] && Gu[gi][0], r = Gu[ri] && Gu[ri][0];
          if (a && r) rows.push({ i: id, a, r, w: items[wi] || '', t: idTime(id), c: c || '' });
        }
      } else if (Array.isArray(ch.u)) {
        ch.u.forEach(([id, n, v]) => { users[id] = [n || 'User', v || null]; });
        for (const [m, g, r, w, c] of ch.r || []) { const id = unb36(m); rows.push({ i: id, a: ch.u[g][0], r: ch.u[r][0], w: items[w] || '', t: idTime(id), c: c || '' }); }
      } else { // first saved format (ids and times in every row)
        for (const [id, u] of Object.entries(ch.u || {})) users[id] = u;
        for (const [i, a, r, w, t, c] of ch.r || []) rows.push({ i, a, r, w: items[w] || '', t: t || idTime(i), c: c || '' });
      }
    }
    rows.sort((a, b) => a.t - b.t);
    return { rows, users };
  }
  const name = (id) => (U[id] && U[id][0]) || 'Unknown';
  const isWeb = (id) => String(id).startsWith('w:');
  function avatar(id, big) {
    const v = U[id] && U[id][1];
    if (isWeb(id)) return el('div', 'dc-av', name(id).slice(0, 1).toUpperCase());
    const i = el('img'); i.loading = 'lazy'; i.alt = '';
    i.src = v ? `https://cdn.discordapp.com/avatars/${id}/${v}.png?size=${big ? 128 : 64}` : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(id) >> 22n) % 6n)}.png`;
    return i;
  }
  const ago = (ms) => { const s = Math.max(1, (Date.now() - ms) / 1000); for (const [n, l] of [[31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']]) if (s >= n) return Math.floor(s / n) + l + ' ago'; return 'just now'; };
  const dur = (s) => { const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${fmt(h)}h ${m}m` : `${m}m`; };
  const tally = (key) => { const m = new Map(); V.forEach((v) => { const k = key(v); m.set(k, (m.get(k) || 0) + 1); }); return [...m].sort((a, b) => b[1] - a[1]); };
  const place = (n) => MEDAL[n - 1] || '#' + n;
  const stat = (box, icon, v, l) => { const c = el('div', 'hud dc-stat'); c.appendChild(el('em', '', icon)); const d = el('div'); d.appendChild(el('b', '', v)); d.appendChild(el('span', '', l)); c.appendChild(d); box.appendChild(c); };

  // ── Overview ──
  function paintOverview() {
    const box = clear($('ov')), s = (C && C.stats) || {};
    if (!C || !s.members) {
      const n = el('div', 'hud dc-empty', 'Server stats are not available right now. ');
      const a = el('a', '', 'Try again');
      a.href = '#'; a.onclick = (e) => { e.preventDefault(); retry(); };
      n.appendChild(a); box.appendChild(n); return;
    }
    stat(box, '👥', fmt(s.members), 'Members');
    const tier = s.tier || 0, need = { 0: 2, 1: 7, 2: 14 }[tier];
    stat(box, '💎', fmt(s.boosts) + (tier ? ` · Tier ${tier}` : ''), need ? `${Math.max(0, need - (s.boosts || 0))} boosts to Tier ${tier + 1}` : 'Server boosts');
    if (s.youtube != null) stat(box, '📺', fmt(s.youtube), 'YouTube subscribers');
    stat(box, '💬', fmt(s.messages), 'Messages counted');
    stat(box, '⚡', fmt(s.msgHour || 0), 'Messages past hour');
    stat(box, '📈', fmt(s.msgToday || 0), 'Messages today');
    stat(box, '🎙️', fmt(Math.floor((s.voiceSec || 0) / 3600)) + 'h', 'Voice time');
    stat(box, '🔊', fmt(s.voiceNow || 0), 'In voice now');
    stat(box, '🎤', fmt(Math.floor((s.voiceTodaySec || 0) / 3600)) + 'h', 'Voice today');
    stat(box, '✅', fmt(V.length), 'Vouches');
    stat(box, '🎉', fmt(((C.giveaways && C.giveaways.active) || []).length), 'Active giveaways');
    if (s.counting != null) stat(box, '🔢', fmt(s.counting), 'Counting channel');
    stat(box, '⚠️', fmt(s.warns), 'Active warns');
    stat(box, '🎫', fmt(s.tickets), 'Open tickets');
    stat(box, '⏱️', dur((s.uptime || 0) / 1000), 'Bot uptime');
    stat(box, '📡', (s.ping || 0) + ' ms', 'Bot ping');
    if (s.created) stat(box, '📅', new Date(s.created).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }), 'Server created');
    // Hourly message activity chart
    const hourly = Array.isArray(s.hourlyMsg) && s.hourlyMsg.length ? s.hourlyMsg : new Array(24).fill(0);
    const max = Math.max(1, ...hourly), vals = hourly.slice(-24), step = 300 / vals.length;
    const label = (i) => { const h = (new Date().getHours() - (vals.length - 1 - i) + 24) % 24; return String(h).padStart(2, '0') + ':00'; };
    $('act-chart').innerHTML = gradient('dcg1', '#22d3ee', '#8b5cf6') + vals.map((v, i) =>
      `<rect class="bar" x="${i * step + 1}" y="${58 - (v / max) * 54}" width="${Math.max(step - 2, 1)}" height="${(v / max) * 54 + 2}" rx="2" fill="url(#dcg1)"><title>${label(i)} — ${v} message${v === 1 ? '' : 's'}</title></rect>`).join('');
    $('sub').textContent = C.updatedAt ? `Live from our Discord bot · updated ${ago(C.updatedAt)}` : 'Live from our Discord bot';
  }
  // Bars are drawn as an SVG gradient: no theme-specific colours needed.
  const gradient = (id, from, to) => `<defs><linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>`;

  // ── Vouches ──
  function paintVouchStats() {
    const cut = Date.now() - 30 * 864e5, box = clear($('stats'));
    stat(box, '✅', fmt(V.length), 'Total vouches'); stat(box, '🤝', fmt(new Set(V.map((v) => v.a)).size), 'People who vouched');
    stat(box, '🔥', fmt(V.filter((v) => v.t >= cut).length), 'Last 30 days'); stat(box, '📅', V.length ? new Date(V[0].t).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '-', 'Vouching since');
    if (!V.length) { const n = el('div', 'hud dc-empty', 'Vouches are still syncing from Discord. '); const a = el('a', '', 'Refresh'); a.href = location.href; n.appendChild(a); box.appendChild(n); }
    const days = [...Array(30)].map((_, i) => new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10)), per = {};
    V.forEach((v) => { if (v.t >= cut - 864e5) { const k = new Date(v.t).toISOString().slice(0, 10); per[k] = (per[k] || 0) + 1; } });
    const vals = days.map((k) => per[k] || 0), max = Math.max(1, ...vals);
    $('chart').innerHTML = gradient('dcg2', '#34d399', '#f59e0b') + vals.map((v, i) => `<rect class="bar" x="${i * 10 + 1}" y="${58 - (v / max) * 54}" width="8" height="${(v / max) * 54 + 2}" rx="2" fill="url(#dcg2)"><title>${days[i]} — ${v} vouch${v === 1 ? '' : 'es'}</title></rect>`).join('');
  }
  function filtered() {
    const q = $('q').value.trim().toLowerCase(), p = $('who').value.trim().toLowerCase(), role = $('role').value;
    let rows = V.filter((v) => {
      if (q && !(v.w + ' ' + v.c).toLowerCase().includes(q)) return false;
      if (!p) return true;
      if (picked && p === name(picked).toLowerCase()) return role === 'got' ? v.r === picked : role === 'gave' ? v.a === picked : v.a === picked || v.r === picked; // exact person
      const a = name(v.a).toLowerCase().includes(p), r = name(v.r).toLowerCase().includes(p);
      return role === 'got' ? r : role === 'gave' ? a : a || r;
    });
    if ($('sort').value === 'new') rows = [...rows].reverse();
    return rows;
  }
  function pick(id, role) { picked = id; $('who').value = name(id); $('role').value = role || 'any'; page = 0; show('vouches'); sub('wall'); paintWall(); }
  function clearPick() { picked = null; $('who').value = ''; $('role').value = 'any'; page = 0; paintWall(); }

  // ── profile: avatar, user ID and the person's places ──
  function paintProfile() {
    const box = $('prof');
    if (!picked || $('who').value.trim().toLowerCase() !== name(picked).toLowerCase()) { box.hidden = true; return; }
    const id = picked, got = tally((v) => v.r), gave = tally((v) => v.a);
    const gi = got.findIndex(([x]) => x === id), ga = gave.findIndex(([x]) => x === id);
    clear($('pf-av')).appendChild(avatar(id, true)); $('pf-name').textContent = name(id);
    const pid = $('pf-id'); pid.textContent = isWeb(id) ? 'Website user' : 'ID ' + id; pid.onclick = () => !isWeb(id) && copy(id, 'User ID');
    const b = clear($('pf-badges')), badge = (t) => b.appendChild(el('span', '', t));
    const own = V.filter((v) => v.r === id || v.a === id).map((v) => v.t);
    badge(`📥 ${fmt(gi < 0 ? 0 : got[gi][1])} received`); badge(`📤 ${fmt(ga < 0 ? 0 : gave[ga][1])} given`);
    if (gi >= 0) badge(`${place(gi + 1)} most vouched`);
    if (ga >= 0) badge(`${place(ga + 1)} top voucher`);
    const lb = C && C.leaderboard; // places in the bot's leaderboards (top 50)
    [['💬 chatter', lb && lb.messages], ['🎙️ voice', lb && lb.voice]].forEach(([l, rows]) => { const i = (rows || []).findIndex((x) => x.user && x.user.id === id); if (i >= 0) badge(`${place(i + 1)} ${l}`); });
    const ii = ((C && C.invites) || []).findIndex((x) => x.user && x.user.id === id); if (ii >= 0) badge(`${place(ii + 1)} inviter`);
    if (own.length) badge(`First: ${new Date(Math.min(...own)).toLocaleDateString()}`);
    box.hidden = false;
  }
  function paintWall() {
    view = filtered(); paintProfile();
    const size = Number($('size').value) || view.length || 1, pages = Math.max(1, Math.ceil(view.length / size));
    page = Math.min(page, pages - 1);
    const from = page * size, rows = view.slice(from, from + size), box = clear($('wall'));
    $('count').textContent = view.length ? `Showing ${fmt(from + 1)}-${fmt(from + rows.length)} of ${fmt(view.length)}` : 'No vouches match';
    $('pg').textContent = `${page + 1} / ${pages}`; $('prev').disabled = page === 0; $('next').disabled = page >= pages - 1;
    if (!rows.length) box.appendChild(el('div', 'hud dc-empty', 'No vouches match your filters.'));
    rows.forEach((v) => {
      const c = el('div', 'hud dc-card'), tx = el('div', 'tx');
      c.appendChild(avatar(v.a));
      const by = el('b', '', name(v.a)); by.onclick = () => pick(v.a, 'gave');
      const to = el('b', '', name(v.r)); to.onclick = () => pick(v.r, 'got');
      tx.appendChild(by); if (isWeb(v.a)) tx.appendChild(el('span', 'web', '🌐 website'));
      tx.appendChild(document.createTextNode(' vouched for ')); tx.appendChild(to);
      tx.appendChild(document.createElement('br')); tx.appendChild(el('span', 'it', v.w || 'Not specified'));
      if (v.c) tx.appendChild(el('q', '', v.c));
      tx.appendChild(el('small', '', new Date(v.t).toLocaleString() + ' · ' + ago(v.t)));
      const ids = el('span', 'ids'); // user IDs (click to copy)
      const idTag = (id) => { const s = el('span', '', isWeb(id) ? 'website' : id); if (!isWeb(id)) s.onclick = () => copy(id, 'User ID'); return s; };
      ids.appendChild(document.createTextNode('from ')); ids.appendChild(idTag(v.a)); ids.appendChild(document.createTextNode(' → ')); ids.appendChild(idTag(v.r));
      tx.appendChild(ids); c.appendChild(tx);
      if (M.gid) { const a = el('a', '', 'Proof ↗'); a.href = `https://discord.com/channels/${M.gid}/${M.ch}/${v.i}`; a.target = '_blank'; a.rel = 'noopener'; a.title = 'Open the original message in Discord (members only)'; c.appendChild(a); }
      box.appendChild(c);
    });
  }
  function exportCsv() {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const csv = ['date,from,from_id,to,to_id,item,comment,discord_message_id', ...view.map((v) => [new Date(v.t).toISOString(), q(name(v.a)), v.a, q(name(v.r)), v.r, q(v.w), q(v.c), v.i].join(','))].join('\n');
    const a = el('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'vouches.csv'; a.click(); URL.revokeObjectURL(a.href);
  }
  function paintTopList() {
    const box = clear($('top')), rows = tally((v) => v.r).slice(0, 100), max = (rows[0] && rows[0][1]) || 1;
    rows.forEach(([id, c], i) => {
      const r = el('div', 'hud dc-row click'); r.appendChild(el('b', 'rk', place(i + 1))); r.appendChild(avatar(id));
      const nm = el('span', 'nm', name(id)); if (!isWeb(id)) nm.appendChild(el('small', '', id)); r.appendChild(nm);
      const bar = el('div', 'bar'), fill = el('i'); fill.style.width = (c / max * 100) + '%'; bar.appendChild(fill); r.appendChild(bar); r.appendChild(el('span', 'n', fmt(c)));
      r.onclick = () => pick(id, 'got'); box.appendChild(r);
    });
  }
  function paintItems() {
    const box = clear($('items')), m = new Map();
    V.forEach((v) => { const k = (v.w || 'Not specified').toLowerCase(), e = m.get(k) || { n: v.w || 'Not specified', c: 0 }; e.c++; m.set(k, e); });
    [...m.values()].sort((a, b) => b.c - a.c).slice(0, 200).forEach((e) => {
      const b = el('button', '', e.n); b.appendChild(el('b', '', e.c));
      b.onclick = () => { $('q').value = e.n; picked = null; $('who').value = ''; page = 0; show('vouches'); sub('wall'); paintWall(); }; box.appendChild(b);
    });
  }
  function fillNames() {
    const dl = clear($('names')), seen = new Set();
    tally((v) => v.r).concat(tally((v) => v.a)).forEach(([id]) => { const n = name(id); if (seen.has(n) || seen.size > 3000) return; seen.add(n); const o = el('option'); o.value = n; dl.appendChild(o); });
  }

  // ── Leaderboards and giveaways (from the bot) ──
  function paintBoards() {
    const box = clear($('boards'));
    if (!C || !C.leaderboard) { box.appendChild(el('div', 'hud dc-empty', 'Leaderboards are not available yet.')); return; }
    const nm = (x) => (x.user && x.user.username) || 'Unknown';
    const board = (title, rows) => {
      const b = el('div', 'hud dc-box'); b.appendChild(el('h3', '', title));
      const sc = el('div', 'dc-scroll'); b.appendChild(sc);
      if (!rows.length) sc.appendChild(el('div', 'dc-empty', 'Nothing yet.'));
      rows.forEach(([n, val, img, id], i) => {
        const r = el('div', 'dc-row' + (id ? ' click' : '')); r.appendChild(el('span', 'rk', place(i + 1)));
        if (img) { const im = el('img'); im.src = img; im.loading = 'lazy'; im.alt = ''; r.appendChild(im); }
        const nme = el('span', 'nm', n); if (id) nme.appendChild(el('small', '', id)); r.appendChild(nme); r.appendChild(el('span', 'n', val));
        if (id) { r.title = 'Click to copy the user ID'; r.onclick = () => copy(id, 'User ID'); }
        sc.appendChild(r);
      });
      box.appendChild(b);
    };
    board('💬 Top chatters', (C.leaderboard.messages || []).map((x) => [nm(x), 'Lv ' + x.level + ' · ' + fmt(x.messages), x.user && x.user.avatar, x.user && x.user.id]));
    board('🎙️ Voice time', (C.leaderboard.voice || []).map((x) => [nm(x), dur(x.seconds), x.user && x.user.avatar, x.user && x.user.id]));
    board('📨 Top inviters', (C.invites || []).map((x) => [nm(x), fmt(x.total), x.user && x.user.avatar, x.user && x.user.id]));
  }
  function paintGiveaways() {
    const box = clear($('gws')), gw = (C && C.giveaways) || { active: [], recent: [] };
    const group = (title, rows, live) => {
      const b = el('div', 'dc-box hud'); b.appendChild(el('h3', '', title));
      if (!rows.length) b.appendChild(el('div', 'dc-empty', 'None right now.'));
      rows.forEach((g) => {
        const c = el('div', 'dc-gw'), t = el('b', '', '🎉 ' + g.prize); t.appendChild(el('span', 'dc-chip' + (live ? '' : ' end'), live ? 'LIVE' : 'ENDED')); c.appendChild(t);
        const host = (g.host && (g.host.username || g.host.t)) || 'staff';
        c.appendChild(el('div', '', `#${g.gwId} · ${fmt(g.entries)} entries · ${g.winnersCount} winner${g.winnersCount > 1 ? 's' : ''} · host ${host}`));
        const r = g.requirements, req = r ? [r.level ? `Level ${r.level}+` : '', r.invites ? `${r.invites}+ invites` : '', r.role ? 'role required' : ''].filter(Boolean).join(' · ') : '';
        if (req) c.appendChild(el('div', '', '🔒 Requirements: ' + req));
        if (g.bonusRoles) c.appendChild(el('div', '', `🎁 Bonus entries: ${g.bonusRoles} role${g.bonusRoles > 1 ? 's' : ''} get extra weight`));
        if (g.ping) c.appendChild(el('div', '', '🔔 Pinged: ' + (g.ping === 'everyone' ? '@everyone' : 'a role')));
        c.appendChild(el('div', '', live ? 'Ends ' + new Date(g.endsAt).toLocaleString() + ' (' + dur(Math.max(0, (g.endsAt - Date.now()) / 1000)) + ' left)' : 'Ended ' + new Date(g.endedAt || g.endsAt).toLocaleString() + ' · winners: ' + (g.winners && g.winners.length ? g.winners.map((w) => w.username || w.t).join(', ') : 'none')));
        b.appendChild(c);
      });
      box.appendChild(b);
    };
    group('Active giveaways', gw.active, true); group('Recent giveaways', gw.recent, false);
  }

  // ── Live chat: mirrored from the bot's Discord channel, and posts back into it ──
  let chatMsgs = [], chatStamp = 0, chatBusy = false, chatTick = null, chatStarted = false;

  // Identity comes from the signed-in JALTRON account: picture, @username and a short account ID.
  // The local snapshot (jc:<uid>) is read first so the details show up even if the sign-in event fired before this file loaded.
  function chatProfile() {
    const user = window.DB && DB.user;
    if (!user) return null;
    let p = {};
    try { p = (JSON.parse(localStorage.getItem('jc:' + user.uid) || 'null') || {}).profile || {}; } catch {}
    const pic = p.a ? (window.Img ? Img.parts(p.a).u : '') : (user.photoURL || '');
    const nick = String(p.n || user.displayName || String(user.email || '').split('@')[0] || 'Member').trim();
    return { uid: user.uid, n: nick.slice(0, 24), pic };
  }
  function paintMe() {
    const av = $('chat-av'), who = $('chat-who'), id = $('chat-uid'), form = $('chat-form'), lock = $('chat-lock');
    if (!av || !who) return;
    const me = chatProfile(), label = me ? me.n : 'Guest';
    const initial = el('div', 'dc-av', label.slice(0, 1).toUpperCase());
    initial.style.width = initial.style.height = '2.4rem';
    if (!window.DB) { who.textContent = 'Checking your account…'; if (id) id.hidden = true; if (form) form.hidden = true; if (lock) lock.hidden = true; return; }
    clear(av);
    if (me && me.pic) {
      const im = el('img'); im.src = me.pic; im.alt = ''; im.referrerPolicy = 'no-referrer';
      im.onerror = () => { if (im.parentNode) im.replaceWith(initial); };
      av.appendChild(im);
    } else av.appendChild(initial);
    who.textContent = me ? '@' + me.n : '🔒 Not signed in';
    if (id) {
      id.hidden = !me;
      if (me) {
        id.textContent = '🆔 ' + me.uid.slice(0, 8).toUpperCase();
        id.title = 'Your account ID · click to copy';
        id.onclick = () => copy(me.uid, 'Account ID');
      }
    }
    if (form) form.hidden = !me;
    if (lock) lock.hidden = !!me;
    if ($('chat-text')) $('chat-text').disabled = !me;
  }

  const chatTime = (t) => { const d = new Date(t), now = new Date(); const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); return d.toDateString() === now.toDateString() ? hm : d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + hm; };
  function paintChat() {
    const box = $('chat-log');
    if (!box) return;
    const stick = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    clear(box);
    if (!chatMsgs.length) { box.appendChild(el('div', 'dc-empty', chatStamp ? 'No messages yet — say hello! 👋' : 'Connecting to Discord…')); return; }
    chatMsgs.forEach((m) => {
      const row = el('div', 'dc-cm' + (m.w ? ' web' : '') + (m.b && !m.w ? ' bot' : ''));
      const fallback = () => { const d = el('div', 'dc-av', String(m.n || '?').slice(0, 1).toUpperCase()); d.style.width = d.style.height = '2.2rem'; return d; };
      const av = el('img'); av.src = m.a || ''; av.alt = ''; av.loading = 'lazy'; av.referrerPolicy = 'no-referrer';
      av.onerror = () => { const d = fallback(); if (av.parentNode) av.replaceWith(d); };
      row.appendChild(av);
      const body = el('div', 'body'), head = el('div', 'head');
      head.appendChild(el('b', '', m.n || 'User'));
      if (m.w) head.appendChild(el('span', 'tag web', '🌐 website'));
      if (m.b && !m.w) head.appendChild(el('span', 'tag bot', '🤖 bot'));
      head.appendChild(el('span', 'at', chatTime(m.t)));
      body.appendChild(head);
      if (m.x) body.appendChild(el('div', 'text', m.x));
      (m.f || []).forEach((f) => {
        if (f.k === 'image' && f.u) { const im = el('img', 'att'); im.src = f.u; im.alt = f.n || ''; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; body.appendChild(im); }
        else { const a = el('a', 'att-file', '📎 ' + (f.n || 'attachment')); a.href = f.u; a.target = '_blank'; a.rel = 'noopener'; a.download = ''; body.appendChild(a); }
      });
      row.appendChild(body);
      box.appendChild(row);
    });
    if (stick) box.scrollTop = box.scrollHeight;
  }
  async function loadChat(force) {
    const box = $('chat-log');
    if (!box) return;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch('/api/chat', { cache: 'no-store', signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (!d || !Array.isArray(d.msgs)) throw new Error('bad payload');
      const before = chatMsgs.length ? chatMsgs[chatMsgs.length - 1].id : '';
      const after = d.msgs.length ? d.msgs[d.msgs.length - 1].id : '';
      const seen = chatStamp === 0;
      chatMsgs = d.msgs; chatStamp = d.v || chatStamp || Date.now();
      if (force || before !== after || seen) paintChat();
      // Keep the "Sent" confirmation; only clear a stale error.
      if ($('chat-state').className.indexOf('bad') >= 0) { $('chat-state').className = 'dc-chat-note'; $('chat-state').textContent = ''; }
    } catch {
      if (!chatMsgs.length) { clear(box).appendChild(el('div', 'dc-empty', '💤 Chat is offline right now.')); }
      $('chat-state').textContent = '⚠️ Live chat is unavailable right now — try again shortly.';
    } finally { clearTimeout(timer); }
  }
  async function sendChat(e) {
    if (e) e.preventDefault();
    if (chatBusy) return;
    const box = $('chat-text'), me = chatProfile();
    if (!me) { paintMe(); return; }
    const text = box.value.trim();
    if (!text) { box.focus(); return; }
    chatBusy = true; $('chat-send').disabled = true; $('chat-state').className = 'dc-chat-note'; $('chat-state').textContent = 'Sending…';
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ n: me.n, t: text, a: me.pic }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not send that message');
      box.value = '';
      $('chat-state').className = 'dc-chat-note ok'; $('chat-state').textContent = '✅ Sent to Discord';
      if (d.msg && d.msg.id) { if (!chatMsgs.some((m) => m.id === d.msg.id)) chatMsgs.push(d.msg); paintChat(); $('chat-log').scrollTop = $('chat-log').scrollHeight; }
      loadChat();
    } catch (err) {
      $('chat-state').className = 'dc-chat-note bad'; $('chat-state').textContent = '⚠️ ' + err.message;
    } finally { chatBusy = false; $('chat-send').disabled = false; }
  }
  function chatPoll() {
    clearInterval(chatTick);
    chatTick = setInterval(() => {
      if (document.hidden || document.querySelector('.page.active')?.dataset.page !== 'chat') return;
      loadChat();
    }, 12000);
  }
  function initChat() {
    paintMe();
    loadChat();
    if (!chatStarted) { chatStarted = true; chatPoll(); }
  }

  function show(t) {
    document.querySelectorAll('#dc-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    ['overview', 'vouches', 'boards', 'giveaways'].forEach((k) => { $('p-' + k).hidden = k !== t; });
  }
  function sub(t) {
    document.querySelectorAll('#dc-subtabs button').forEach((b) => b.classList.toggle('on', b.dataset.s === t));
    ['wall', 'top', 'items'].forEach((k) => { $('s-' + k).hidden = k !== t; });
  }
  document.querySelectorAll('#dc-tabs button').forEach((b) => b.onclick = () => show(b.dataset.t));
  document.querySelectorAll('#dc-subtabs button').forEach((b) => b.onclick = () => sub(b.dataset.s));
  $('q').addEventListener('input', () => { page = 0; paintWall(); });
  $('who').addEventListener('input', () => { if (picked && $('who').value.trim().toLowerCase() !== name(picked).toLowerCase()) picked = null; page = 0; paintWall(); });
  ['role', 'sort', 'size'].forEach((id) => $(id).addEventListener('change', () => { page = 0; paintWall(); }));
  $('prev').onclick = () => { page--; paintWall(); $('wall').scrollIntoView({ block: 'start' }); };
  $('next').onclick = () => { page++; paintWall(); $('wall').scrollIntoView({ block: 'start' }); };
  $('csv').onclick = exportCsv;
  $('pf-clear').onclick = clearPick;
  $('pf-link').onclick = () => picked && copy(`${location.origin}/discord?u=${encodeURIComponent(picked)}`, 'Link');
  $('chat-form').onsubmit = sendChat;
  $('chat-refresh').onclick = () => loadChat(true);
  $('chat-signin').onclick = () => (window.DB ? DB.signIn() : toast('Still connecting to your account…'));
  addEventListener('jaltron:user', () => paintMe());
  paintMe();

  let busy = false, loaded = false;
  async function load() {
    if (busy) return;
    busy = true;
    $('sub').textContent = 'Loading live data…';
    try {
      let D; [D, C] = await Promise.all([get('legit'), get('community')]);
      if (D && D.chunks) { M = D; ({ rows: V, users: U } = expand(D)); }
      loaded = !!(D && D.chunks) || !!(C && C.stats);
      $('sub').textContent = C && C.stats ? (C.updatedAt ? `Live · updated ${ago(C.updatedAt)}` : 'Live from our Discord bot')
        : 'Live data is not available right now. Please try again later.';
      paintOverview(); paintVouchStats(); fillNames(); paintWall(); paintTopList(); paintItems(); paintBoards(); paintGiveaways();
      const u = q0.get('u');
      if (u && U[u]) pick(u, 'any');
    } finally { busy = false; }
  }
  const retry = () => load();
  window.initDiscordPage = () => { if (!loaded) load(); };
  window.initChatPage = initChat;
  window.reloadDiscordPage = retry;
  // Open /discord or /chat directly: the router already ran before this file loaded, so start it here.
  const opened = document.querySelector('.page.active')?.dataset.page;
  if (opened === 'discord') load();
  if (opened === 'chat') initChat();
})();
