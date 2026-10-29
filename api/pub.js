// Vercel serverless function: serves the bot's PUBLIC data.
//   GET /api/pub?name=legit       the bot's live vouch feed, proxied from https://dbot.wisp.uno/api/legit
//   GET /api/pub?name=community   leaderboards, giveaways, server stats, proxied from https://dbot.wisp.uno/api/community
// Nothing here touches Firestore anymore: the bot is the single source and answers both feeds.
// Replies are cached by Vercel's CDN; a request that already has the current X-Pub-Version (or ETag)
// gets a 304 without even asking the bot.
// The bot's public address. Override with BOT_URL in Vercel only if the host ever changes.
const BOT_URL = String(process.env.BOT_URL || 'https://dbot.wisp.uno').replace(/\/+$/, '');
const FEEDS = new Set(['legit', 'community']);
const TIMEOUT_MS = 8000;

async function fromBot(req, res, name) {
  if (!BOT_URL) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'BOT_URL is not configured in Vercel' });
  }
  const headers = {};
  if (req.headers['if-none-match']) headers['if-none-match'] = req.headers['if-none-match'];
  if (req.headers['x-pub-version']) headers['x-pub-version'] = req.headers['x-pub-version'];
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${BOT_URL}/api/${name}`, { headers, signal: ctl.signal });
    if (r.status === 304) return res.status(304).end();
    if (!r.ok) throw new Error('Bot ' + r.status);
    const text = await r.text();
    for (const h of ['etag', 'x-pub-version']) { const v = r.headers.get(h); if (v) res.setHeader(h, v); }
    return res.status(200).setHeader('Content-Type', 'application/json').send(text);
  } finally { clearTimeout(timer); }
}

module.exports = async (req, res) => {
  const name = String(req.query.name || '');
  if (!FEEDS.has(name)) return res.status(400).json({ error: 'Unknown name' });
  // Stats refresh every 30s in the bot, so keep the edge cache short; stale copies still cover outages.
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=600, stale-if-error=86400');
  try { return await fromBot(req, res, name); }
  catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: name === 'legit' ? 'Bot unavailable' : 'Stats unavailable' });
  }
};
