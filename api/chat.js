// Vercel serverless function: the website <-> Discord chat bridge.
//   GET  /api/chat   -> the bot's mirror of the channel (last 40 messages)
//   POST /api/chat   -> { n: name, t: text } posted into the channel as a webhook
// The bot is the only thing that talks to Discord, so no token ever reaches the browser.
const BOT_URL = String(process.env.BOT_URL || 'https://dbot.wisp.uno').replace(/\/+$/, '');
const TIMEOUT_MS = 8000;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const clientIp = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || String(req.socket?.remoteAddress || '');
  const headers = { 'x-client-ip': clientIp };
  const init = { method: req.method, headers };
  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify({ n: String(body.n || '').slice(0, 24), t: String(body.t || '').slice(0, 500), a: String(body.a || '').slice(0, 300) });
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BOT_URL}/api/chat`, { ...init, signal: ctl.signal });
    const text = await r.text();
    return res.status(r.status).setHeader('Content-Type', 'application/json').send(text);
  } catch {
    return res.status(502).json({ error: 'Chat is unavailable right now' });
  } finally { clearTimeout(timer); }
};
