// Vercel serverless function: festival and faith-day calendars.
//   GET /api/festivals  -> { ok, at, events: [{ d: 'YYYY-MM-DD', n, p, k }] }
// Google Calendar publishes public ICS calendars (Holidays in India has the Hindu, Muslim, Sikh, Jain, Buddhist
// and Parsi festivals; there are separate Jewish and Christian ones). Those endpoints do not send CORS headers,
// so the browser cannot read them directly. This function fetches and parses them server-side and caches the
// answer for a week at the edge. No API key, no user input, so nothing here can be pointed at another host.
const FEEDS = [
  { k: 'fest', id: 'en.indian#holiday@group.v.calendar.google.com' },
  { k: 'jewish', id: 'en.jewish#holiday@group.v.calendar.google.com' },
  { k: 'christian', id: 'en.christian#holiday@group.v.calendar.google.com' }
];
const MAX_BYTES = 1.5e6;   // a public holiday feed is a few hundred KB; anything gigantic is not ours
const MAX_EVENTS = 4000;
const TIMEOUT_MS = 7000;

// Faith label for an event name. Google's Israel calendar mixes Jewish, Christian, Muslim and civic days,
// so names are classified rather than trusting the feed. Returns null for entries that are not celebrations.
function labelFor(name, feed) {
  const s = name.toLowerCase();
  if (/ramadan|ramzan|bakrid|muharram|ashura|milad|jamat|hazarat ali|eid|al isra|miraj|sabalan|shuaib|prophet/.test(s)) return 'Muslim holiday';
  if (/christmas|epiphany|annunciation|ascension|easter|maundy|palm sunday|pentecost|boxing day|good friday|holy saturday|shrove|ash wednesday|corpus|trinity|all saints|all souls|assumption|immaculate|feast of|saint|orthodox new year/.test(s)) return 'Christian holiday';
  if (feed.k === 'jewish') {
    if (/election|women's day|may day|school year|victory day|new year/i.test(s)) return null;
    if (/haatzmaut|hazikaron|hashoah|jerusalem day|herzl|aliyah|memorial day/i.test(s)) return 'Israeli holiday';
    return 'Jewish holiday';
  }
  if (feed.k === 'christian') return 'Christian holiday';
  // The multi-faith India feed: keep the faith days, drop the national days (the country menu covers those)
  if (/parsi/.test(s)) return 'Parsi festival';
  if (/republic day|independence day|gandhi jayanti|ambedkar|rabindranath|new year/.test(s)) return null;
  if (/guru|vaisakhi|nanak/.test(s)) return 'Sikh festival';
  if (/buddha/.test(s)) return 'Buddhist festival';
  if (/mahavir/.test(s)) return 'Jain festival';
  return 'Hindu festival';
}

// ICS: lines are folded with a leading space, dates are YYYYMMDD, text escapes commas/semicolons/newlines.
function parseIcs(text, feed, lo, hi) {
  const out = [];
  for (const block of text.replace(/\r?\n[ \t]/g, '').split('BEGIN:VEVENT').slice(1)) {
    const m = block.match(/DTSTART[^:\r\n]*:(\d{4})(\d{2})(\d{2})/);
    const s = block.match(/SUMMARY[^:\r\n]*:(.*)/);
    if (!m || !s) continue;
    const year = Number(m[1]);
    if (year < lo || year > hi) continue;
    const n = s[1].trim()
      .replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
      .replace(/\s*\((?:tentative|observed)\)\s*$/i, '')
      .slice(0, 120);
    if (!n) continue;
    const p = labelFor(n, feed);
    if (!p) continue;
    out.push({ d: `${m[1]}-${m[2]}-${m[3]}`, n, p, k: feed.k });
    if (out.length >= MAX_EVENTS) break;
  }
  return out;
}

async function readFeed(feed, lo, hi) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(feed.id)}/public/basic.ics`;
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'Jaltron/1.0 (+https://jaltron.vercel.app)' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text();
    if (text.length > MAX_BYTES) throw new Error('feed too large');
    return parseIcs(text, feed, lo, hi);
  } finally {
    clearTimeout(timer);
  }
}

// "Catholic/Protestant Christmas Day", "Orthodox Christmas Holiday" and plain "Christmas" are one holiday.
function baseName(n) {
  return n.toLowerCase()
    .replace(/^(?:catholic\/protestant|armenian\/orthodox|orthodox|catholic|protestant|armenian)\s+/, '')
    .replace(/\b(holiday|observance|day)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });
  const now = new Date().getUTCFullYear(), lo = now - 2, hi = now + 8;
  const results = await Promise.allSettled(FEEDS.map((f) => readFeed(f, lo, hi)));
  const events = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (!events.length) return res.status(502).json({ ok: false, error: 'Festival calendars are unavailable right now.' });

  // Same day + same holiday under two names can arrive from several feeds; keep the first label.
  const seen = new Set();
  const unique = events.filter((e) => { const k = e.d + '|' + baseName(e.n); if (seen.has(k)) return false; seen.add(k); return true; });
  unique.sort((a, b) => a.d.localeCompare(b.d) || a.n.localeCompare(b.n));
  res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=2592000');
  res.status(200).json({ ok: true, at: Date.now(), events: unique });
};
