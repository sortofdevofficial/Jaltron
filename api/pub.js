// Vercel serverless function: serves the bot's PUBLIC data (vouches, community stats) from Firestore.
//   GET /api/pub?name=legit       all vouches (metadata + compact chunks)
//   GET /api/pub?name=community   leaderboards, giveaways, server stats
// The answer is cached by Vercel's CDN (5 min, and kept for up to a day if Firestore is down), so visitors never
// touch the Firestore free quota: Firestore is only read when the cached copy is refreshed.
const KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDlqQYIPue53vx1tpm7-DYYKMZB4OatiDg'; // public web key, same as db.js
const PROJECT = process.env.FIREBASE_PROJECT || 'jaltron0';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/pub/`;

async function read(name) {
  const r = await fetch(`${BASE}${name}?key=${KEY}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Firestore ' + r.status);
  const f = (await r.json()).fields || {};
  try { return JSON.parse(f.d.stringValue); } catch { return null; }
}

module.exports = async (req, res) => {
  const name = String(req.query.name || '');
  if (name !== 'legit' && name !== 'community') return res.status(400).json({ error: 'Unknown name' });
  try {
    let body = await read(name);
    if (body && name === 'legit') {
      const k = Math.min(Number(body.k) || 1, 50);
      body.chunks = (await Promise.all(Array.from({ length: k }, (_, i) => read('legit_' + i)))).filter(Boolean);
    }
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600, stale-if-error=86400');
    return res.status(200).json(body || {});
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Data unavailable' });
  }
};
