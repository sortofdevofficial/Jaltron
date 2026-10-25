// One HTTP API for the website (replaces the two old ports).
//   GET  /  /health          public health check
//   GET  /api/stats          bot uptime / ping / members / YouTube subs
//   GET  /api/community      leaderboards, invites, giveaways   (refreshed every 30s)
//   GET  /api/moderation     open+closed tickets, warns, stats
//   POST /api/logs/event     website activity (login, game launch...) -> Discord log channel
// Everything except health needs:  Authorization: Bearer <API_KEY>
const http = require('http');
const { EmbedBuilder, Events } = require('discord.js');
const { API_KEY, API_PORT, CH, log, getYT, limited, plain } = require('./core');
const leveling = require('./leveling');
const invites = require('./invites');
const giveaways = require('./giveaways');
const tickets = require('./tickets');
const warns = require('./warns');
const pub = require('./pub');

const pkg = require('./package.json');
const EXTRA_PORT = Number(pkg.config?.EXTRA_API_PORT || process.env.EXTRA_API_PORT || 0); // optional 2nd port (e.g. the old moderation port)

const EVENT_STYLES = {
  login: { title: '🔑 Website login', color: 0x2ECC71 },
  logout: { title: '🚪 Website logout', color: 0xE74C3C },
  username_change: { title: '📝 Username changed', color: 0x3498DB },
  game_launch: { title: '🎮 Game launched', color: 0xF1C40F },
  other: { title: '🌐 Website event', color: 0x95A5A6 },
};

// ── helpers ──
const json = (res, code, body, headers) => { res.writeHead(code, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(body)); };
const readJsonBody = req => new Promise(resolve => {
  let body = '';
  req.on('data', c => { body += c; if (body.length > 16384) { req.destroy(); resolve({}); } });
  req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  req.on('error', () => resolve({}));
});

// Display names are looked up live (never stored) and cached for 10 minutes.
const userCache = new Map();
async function resolveUser(client, id) {
  if (!id) return null;
  const m = client.guilds.cache.first()?.members.cache.get(id);
  if (m) return { id, username: m.displayName || m.user.username, avatar: m.user.displayAvatarURL({ size: 64 }) };
  const hit = userCache.get(id);
  if (hit && Date.now() - hit.at < 10 * 60000) return hit.v;
  const u = await client.users.fetch(id).catch(() => null);
  const v = { id, username: u?.username ?? 'Unknown User', avatar: u?.displayAvatarURL({ size: 64 }) ?? null };
  userCache.set(id, { v, at: Date.now() });
  return v;
}

// ── community snapshot (leaderboards etc.) ──
let snapshot = null;
const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

async function buildSnapshot(client) {
  const guild = client.guilds.cache.first();
  const ranked = (entries, fn) => Promise.all(entries.map(async ([uid, v], i) => ({ rank: i + 1, user: await resolveUser(client, uid), ...fn(uid, v) })));
  const inviteRows = Object.keys(invites.stats).filter(u => u !== '__vanity__').map(u => [u, invites.total(u)])
    .filter(([, t]) => t !== 0).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const gw = g => ({ gwId: g.gwId, prize: g.pz, winnersCount: g.w, host: g.h, startedAt: g.s, endsAt: g.e, endedAt: g.ea, entries: g.ent.length, done: g.d, winners: g.wn || [] });
  const all = Object.values(giveaways.giveaways).sort((a, b) => b.s - a.s);
  snapshot = {
    stats: { uptime: client.uptime, ping: client.ws.ping, members: guild?.memberCount ?? 0 },
    giveaways: { active: all.filter(g => !g.d).slice(0, 10).map(gw), recent: all.filter(g => g.d).slice(0, 10).map(gw) },
    leaderboard: {
      messages: await ranked(top(leveling.counts), (_, m) => ({ messages: m, level: leveling.getLvl(m) })),
      voice: await ranked(top(leveling.voice.counts), (_, s) => ({ seconds: s })),
    },
    invites: await ranked(inviteRows, (uid, total) => { const s = invites.stats[uid]; return { total, regular: s.r || 0, left: s.l || 0, fake: s.f || 0, rejoins: s.rj || 0, bonus: s.b || 0 }; }),
  };
  pub.publish('community', snapshot, 5 * 60000); // public leaderboards for the website
}

// ── routes ──
function makeHandler(client) {
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/' || pathname === '/health') return json(res, 200, { ok: true, ready: client.isReady() });
    if (req.headers.authorization !== `Bearer ${API_KEY}`) return json(res, 401, { error: 'Unauthorized' });
    const guild = client.guilds.cache.first();

    try {
      if (req.method === 'GET' && pathname === '/api/stats') {
        return json(res, 200, { uptime: client.uptime, ping: client.ws.ping, guilds: client.guilds.cache.size, members: guild?.memberCount ?? 0, youtube: await getYT() });
      }

      if (req.method === 'GET' && pathname === '/api/community') {
        return json(res, 200, snapshot || { stats: {}, giveaways: { active: [], recent: [] }, leaderboard: { messages: [], voice: [] }, invites: [] });
      }

      if (req.method === 'GET' && pathname === '/api/moderation') {
        const snap = tickets.snapshot(20);
        const shape = async t => ({
          ...t,
          opener: await resolveUser(client, t.openerId),
          claimedBy: await resolveUser(client, t.claimedById),
          closedBy: await resolveUser(client, t.closedById),
        });
        const [open, closed, recentWarns] = await Promise.all([
          Promise.all(snap.open.map(shape)),
          Promise.all(snap.closed.map(shape)),
          Promise.all(warns.allWarns(20).map(async w => ({
            id: w.id, user: await resolveUser(client, w.uid), moderator: await resolveUser(client, w.modId), reason: w.reason, at: w.at, active: w.active,
            expiresAt: warns.expiresAt(w), removedAt: w.removedAt ?? null, removedBy: await resolveUser(client, w.removedBy),
          }))),
        ]);
        return json(res, 200, {
          stats: { uptime: client.uptime, ping: client.ws.ping, members: guild?.memberCount ?? 0, openTicketCount: open.length, activeWarnCount: warns.totalActive() },
          tickets: { open, closed }, warns: recentWarns, warnStats: warns.stats(),
        });
      }

      if (req.method === 'POST' && pathname === '/api/logs/event') {
        const body = await readJsonBody(req);
        const type = String(body.type || '').toLowerCase().slice(0, 24);
        const style = EVENT_STYLES[type] || EVENT_STYLES.other;
        const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
        const wait = limited(`ev:${ip}:${type}`, 1000, 15, 60000);
        if (wait) return json(res, 429, { error: 'Slow down.', retryAfter: wait }, { 'Retry-After': String(wait) });

        const name = plain(body.name, 32) || 'Player';
        const detail = plain(body.game || body.details || body.action, 80);
        const from = plain(body.oldName, 32), to = plain(body.newName, 32);
        const text =
          type === 'username_change' ? `${from || name} changed their username to ${to || name}`
          : type === 'login' ? `${name} signed in to PlayStash`
          : type === 'logout' ? `${name} signed out of PlayStash`
          : type === 'game_launch' ? `${name} launched ${detail || 'a game'}`
          : `${name}: ${detail || 'website event'}`;

        const embed = new EmbedBuilder().setTitle(style.title).setDescription(text).setColor(style.color).setTimestamp();
        const uid = /^\d{17,20}$/.test(String(body.userId ?? '')) ? String(body.userId) : null;
        if (uid) embed.setFooter({ text: `Website user ID: ${uid}` });

        const ch = await client.channels.fetch(CH.website).catch(() => null);
        if (!ch?.isTextBased()) return json(res, 503, { error: 'Log channel unavailable' });
        await ch.send({ embeds: [embed], allowedMentions: { parse: [] } });
        return json(res, 200, { success: true });
      }
    } catch (err) {
      log('ERROR', `API ${pathname} failed: ${err.message}`);
      return json(res, 500, { error: 'Server error' });
    }
    return json(res, 404, { error: 'Endpoint not found' });
  };
}

function start(client) {
  const handler = makeHandler(client);
  for (const port of new Set([API_PORT, EXTRA_PORT].filter(Boolean))) {
    http.createServer(handler)
      .on('error', err => log('ERROR', `API could not listen on port ${port}: ${err.message}`))
      .listen(port, '0.0.0.0', () => log('SYS', `API server running on port ${port}`));
  }
  client.once(Events.ClientReady, () => {
    const run = () => buildSnapshot(client).catch(err => log('ERROR', `Community snapshot failed: ${err.message}`));
    run();
    setInterval(run, 30000);
  });
}

module.exports = { start };
