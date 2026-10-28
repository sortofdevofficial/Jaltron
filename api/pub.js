// Vercel serverless function: serves the bot's PUBLIC data (vouches, community stats) from Firestore.
//   GET /api/pub?name=legit       all vouches (shared people/items + compact chunks)
//   GET /api/pub?name=community   leaderboards, giveaways, server stats
// Replies are cached by Vercel's CDN, so visitors never touch the Firestore free quota. A request that
// already has the current X-Pub-Version (or ETag) gets a 304 without the chunk reads or the JSON body.
const KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDlqQYIPue53vx1tpm7-DYYKMZB4OatiDg'; // public web key, same as db.js
const PROJECT = process.env.FIREBASE_PROJECT || 'jaltron0';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/pub/`;

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

module.exports = async (req, res) => {
  const name = String(req.query.name || '');
  if (name !== 'legit' && name !== 'community') return res.status(400).json({ error: 'Unknown name' });
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400');
  try {
    const meta = await doc(name);
    const body = meta && json(meta);
    const v = version(meta || {}, body);
    if (v) { res.setHeader('ETag', `W/"${name}-${v}"`); res.setHeader('X-Pub-Version', v); }
    if (body && unchanged(req, name, v)) return res.status(304).end();
    if (body && name === 'legit') {
      const shared = await doc('legit_u'); // people and item names, stored once
      const g = shared && json(shared);
      if (g) { body.u = g.u; body.i = g.i; }
      const k = Math.min(Number(body.k) || 1, 50);
      body.chunks = (await Promise.all(Array.from({ length: k }, (_, i) => doc('legit_' + i).then((f) => f && json(f))))).filter(Boolean);
    }
    return res.status(200).json(body || {});
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Data unavailable' });
  }
};
