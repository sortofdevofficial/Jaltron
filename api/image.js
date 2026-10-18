// Vercel serverless function for pictures. One endpoint, two jobs (it replaces the old upload.js and delete.js):
//   POST /api/image   with a picture (Content-Type image/*)       -> uploads it to ImgBB, answers { url, thumb, del }
//   POST /api/image   with JSON {"d":"ID/HASH"} (application/json) -> removes that picture from ImgBB (best effort)
// The ImgBB key lives only in the Vercel environment variable IMGBB_KEY, never in the browser.
// Only signed-in users can call it: the Firebase login token is checked on every request.
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDlqQYIPue53vx1tpm7-DYYKMZB4OatiDg'; // public web key, same as db.js
const MAX_BYTES = 4.4e6; // Vercel functions accept bodies up to 4.5 MB

// Reads the request body, or returns null when it is bigger than max
async function readBody(req, max) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > max) return null;
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

module.exports = async (req, res) => {
  const fail = (code, error) => res.status(code).json({ ok: false, error });
  if (req.method !== 'POST') return fail(405, 'POST only');

  const type = String(req.headers['content-type'] || '').split(';')[0].trim();
  const isDelete = type === 'application/json';
  if (!isDelete && !/^image\/(jpeg|png|gif|webp|bmp)$/.test(type)) return fail(415, 'Only JPG, PNG, GIF, WebP or BMP pictures are allowed.');
  const key = process.env.IMGBB_KEY || '';
  if (!isDelete && !key) return fail(500, 'The server is missing the IMGBB_KEY setting.');

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return fail(401, isDelete ? 'Sign in first.' : 'Sign in to upload images.');
  try {
    const v = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token })
    });
    if (!v.ok) return fail(401, 'Your login expired. Refresh the page and try again.');
  } catch { return fail(502, 'Could not check your login. Try again.'); }

  // ---- delete ----
  if (isDelete) {
    const raw = await readBody(req, 2000);
    let d; try { d = JSON.parse(raw ? raw.toString() : '').d; } catch {}
    // ImgBB has no official delete endpoint: the picture's delete link ("ID/HASH") is the secret, so you can only delete pictures whose code you know
    if (typeof d !== 'string' || !/^[A-Za-z0-9]{4,16}\/[A-Za-z0-9]{16,64}$/.test(d)) return fail(400, 'Bad delete code.');
    try {
      const r = await fetch('https://ibb.co/' + d + (key ? '?key=' + encodeURIComponent(key) : ''), { method: 'DELETE', headers: { Accept: 'application/json' } });
      if (!r.ok) console.error('ImgBB delete answered', r.status, 'for', d.split('/')[0]);
      return res.status(200).json({ ok: r.ok, status: r.status });
    } catch (e) { console.error('ImgBB delete failed', e && e.message); return fail(502, 'Could not reach ImgBB.'); }
  }

  // ---- upload ----
  const body = await readBody(req, MAX_BYTES);
  if (!body) return fail(413, 'That picture is too big (max 4 MB).');
  if (!body.length) return fail(400, 'Empty upload.');
  try {
    const fd = new FormData();
    fd.append('image', new Blob([body], { type }), 'image');
    const r = await fetch('https://api.imgbb.com/1/upload?key=' + key, { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) return fail(502, (j.error && j.error.message) || 'ImgBB rejected the upload.');
    res.status(200).json({ url: j.data.url, thumb: (j.data.thumb && j.data.thumb.url) || '', del: j.data.delete_url || '' });
  } catch { fail(502, 'Could not reach ImgBB. Try again.'); }
};
module.exports.config = { api: { bodyParser: false } };
