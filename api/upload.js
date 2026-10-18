// Vercel serverless function: receives a picture from the site and forwards it to ImgBB.
// The ImgBB key lives only in the Vercel environment variable IMGBB_KEY, never in the browser.
// Only signed-in users can upload: the Firebase login token is checked on every request.
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDlqQYIPue53vx1tpm7-DYYKMZB4OatiDg'; // public web key, same as db.js
const MAX_BYTES = 4.4e6; // Vercel functions accept bodies up to 4.5 MB

module.exports = async (req, res) => {
  const fail = (code, error) => res.status(code).json({ error });
  if (req.method !== 'POST') return fail(405, 'POST only');
  const key = process.env.IMGBB_KEY;
  if (!key) return fail(500, 'The server is missing the IMGBB_KEY setting.');

  const type = String(req.headers['content-type'] || '').split(';')[0].trim();
  if (!/^image\/(jpeg|png|gif|webp|bmp)$/.test(type)) return fail(415, 'Only JPG, PNG, GIF, WebP or BMP pictures are allowed.');

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return fail(401, 'Sign in to upload images.');
  try {
    const v = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token })
    });
    if (!v.ok) return fail(401, 'Your login expired. Refresh the page and try again.');
  } catch { return fail(502, 'Could not check your login. Try again.'); }

  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BYTES) return fail(413, 'That picture is too big (max 4 MB).');
    chunks.push(c);
  }
  if (!size) return fail(400, 'Empty upload.');

  try {
    const fd = new FormData();
    fd.append('image', new Blob([Buffer.concat(chunks)], { type }), 'image');
    const r = await fetch('https://api.imgbb.com/1/upload?key=' + key, { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) return fail(502, (j.error && j.error.message) || 'ImgBB rejected the upload.');
    res.status(200).json({ url: j.data.url, thumb: (j.data.thumb && j.data.thumb.url) || '', del: j.data.delete_url || '' });
  } catch { fail(502, 'Could not reach ImgBB. Try again.'); }
};
module.exports.config = { api: { bodyParser: false } };
