// Vercel serverless function: serves the bot's PUBLIC data.
//   GET /api/pub?name=legit       the bot's live vouch feed, proxied from https://dbot.wisp.uno/api/legit
//   GET /api/pub?name=community   leaderboards, giveaways, server stats (still from Firestore)
// Vouch documents are no longer written to Firebase: the bot keeps them on disk and serves them itself.
// Replies are cached by Vercel's CDN; a request that already has the current X-Pub-Version (or ETag)
// gets a 304 without even asking the bot.
const KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDlqQYIPue53vx1tpm7-DYYKMZB4OatiDg'; // public web key, same as db.js
const PROJECT = process.env.FIREBASE_PROJECT || 'jaltron0';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/pub/`;
// The bot's public address. Override with BOT_URL in Vercel only if the host ever changes.
const BOT_URL = String(process.env.BOT_URL || 'https://dbot.wisp.uno').replace(/\/+$/, '');

async function doc(name) {
  const r = await fetch(`${BASE}${name}?key=${KEY}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Firestore ' + r.status);
  return (await r.json()).fields || {};
}
const json = (f) => { try { return JSON.parse(f.d.stringValue); } catch { return null; } };
const version = (f, data) => String(data?.h || f?.t?.integerValue || '');
const clean = (s) => String(s || '').replace(/^W\//, '').replace(/"/g, '');
const unchanged = (req, name, v) => {
  if (!v) return false;
  const tag = `${name}-${v}`;
  const inm = String(req.headers['if-none-match'] || '').split(',').some((x) => { const t = clean(x.trim()); return t === tag || t === v; });
  return inm || String(req.headers['x-pub-version'] || '') === v;
};

// The bot answers with { h, u, i, chunks } and the same ETag rules as before.
async function fromBot(req, res) {
  if (!BOT_URL) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'BOT_URL is not configured in Vercel' });
  }
  const headers = {};
  if (req.headers['if-none-match']) headers['if-none-match'] = req.headers['if-none-match'];
  if (req.headers['x-pub-version']) headers['x-pub-version'] = req.headers['x-pub-version'];
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`${BOT_URL}/api/legit`, { headers, signal: ctl.signal });
    if (r.status === 304) return res.status(304).end();
    if (!r.ok) throw new Error('Bot ' + r.status);
    const text = await r.text();
    for (const h of ['etag', 'x-pub-version']) { const v = r.headers.get(h); if (v) res.setHeader(h, v); }
    return res.status(200).setHeader('Content-Type', 'application/json').send(text);
  } finally { clearTimeout(timer); }
}

module.exports = async (req, res) => {
  const name = String(req.query.name || '');
  if (name !== 'legit' && name !== 'community') return res.status(400).json({ error: 'Unknown name' });
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400');
  if (name === 'legit') {
    try { return await fromBot(req, res); }
    catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ error: 'Bot unavailable' });
    }
  }
  try {
    const meta = await doc(name);
    const body = meta && json(meta);
    const v = version(meta || {}, body);
    if (v) { res.setHeader('ETag', `W/"${name}-${v}"`); res.setHeader('X-Pub-Version', v); }
    if (body && unchanged(req, name, v)) return res.status(304).end();
    return res.status(200).json(body || {});
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Data unavailable' });
  }
};
