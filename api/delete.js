// Vercel serverless function: removes a picture from ImgBB when someone deletes it on the site.
// ImgBB has no official delete endpoint, so this uses the picture's delete link (saved as "ID/HASH") on a best-effort basis.
// Only signed-in users can call it, and the hash acts as the secret: you can only delete pictures whose hash you know.
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDlqQYIPue53vx1tpm7-DYYKMZB4OatiDg'; // public web key, same as db.js

async function readJson(req) {
  let s = ''; for await (const c of req) { s += c; if (s.length > 2000) break; }
  try { return JSON.parse(s); } catch { return {}; }
}

module.exports = async (req, res) => {
  const fail = (code, error) => res.status(code).json({ ok: false, error });
  if (req.method !== 'POST') return fail(405, 'POST only');
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return fail(401, 'Sign in first.');
  try {
    const v = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token })
    });
    if (!v.ok) return fail(401, 'Login expired.');
  } catch { return fail(502, 'Could not check login.'); }

  const { d } = await readJson(req);
  if (typeof d !== 'string' || !/^[A-Za-z0-9]{4,16}\/[A-Za-z0-9]{16,64}$/.test(d)) return fail(400, 'Bad delete code.');
  const key = process.env.IMGBB_KEY || '';
  try {
    const r = await fetch('https://ibb.co/' + d + (key ? '?key=' + encodeURIComponent(key) : ''), { method: 'DELETE', headers: { Accept: 'application/json' } });
    const ok = r.ok;
    if (!ok) console.error('ImgBB delete answered', r.status, 'for', d.split('/')[0]);
    res.status(200).json({ ok, status: r.status });
  } catch (e) { console.error('ImgBB delete failed', e && e.message); fail(502, 'Could not reach ImgBB.'); }
};
