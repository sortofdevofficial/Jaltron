'use strict';
// JALTRON Litecoin payments (Vercel function, no npm packages).  Pays for Lite and switches it on by itself.
//
// HOW IT WORKS (works on BlockCypher's FREE plan)
//   1. Everyone pays the SAME Litecoin address (yours, LTC_ADDRESS). Each order gets its own exact amount, e.g. 0.00125432 LTC:
//      the last digits are a tiny unique tag, so the amount tells us who paid.
//   2. BlockCypher tells this function when money arrives (a webhook, set up once from admin.html). The browser also
//      asks for the order status now and then, which runs a throttled check as a backup.
//   3. When the payment has LTC_CONFIRMATIONS confirmations the function extends s/<uid> (the plan doc the site already reads)
//      using a Firebase service account. A marker doc per payment output makes sure one payment is only ever credited once.
//
// ENDPOINTS (all /api/pay)
//   GET  ?action=plans                       prices, Litecoin rate (public)
//   POST {action:'create', plan:'1m'}        new order, or the open one for this user and plan   (login needed)
//   POST {action:'status', o:'<order>'}      order state, also checks the chain                  (login needed)
//   POST ?hook=<secret>                      BlockCypher webhook
//   POST {action:'setup'}                    registers the webhooks, shows setup state           (admins only)
//
// SETTINGS (Vercel environment variables)
//   LTC_ADDRESS               your Litecoin address that receives the money
//   FIREBASE_SERVICE_ACCOUNT  the service account JSON (Firebase console > Project settings > Service accounts), or that JSON in base64
//     ...or, if Google blocks key creation: PAY_BOT_EMAIL + PAY_BOT_PASSWORD, a Firebase email/password user that is listed in admins/<uid>
//   PAY_SECRET                any long random text; it protects the webhook URL
//   BLOCKCYPHER_TOKEN         your free BlockCypher token (needed to create webhooks, raises rate limits)
//   optional: LTC_CONFIRMATIONS (default 2), LITE_MONTH_USD (default 0.10), SITE_URL, FIREBASE_PROJECT, FIREBASE_API_KEY
const crypto = require('crypto');

const cfg = () => {
  const E = process.env, usd = Number(E.LITE_MONTH_USD);
  return {
    project: E.FIREBASE_PROJECT || 'jaltron0',
    apiKey: E.FIREBASE_API_KEY || 'AIzaSyDlqQYIPue53vx1tpm7-DYYKMZB4OatiDg', // public web key, same as db.js
    address: String(E.LTC_ADDRESS || '').trim(),
    bcToken: E.BLOCKCYPHER_TOKEN || '',
    secret: E.PAY_SECRET || '',
    conf: Math.min(6, Math.max(1, Math.round(Number(E.LTC_CONFIRMATIONS)) || 2)),
    site: String(E.SITE_URL || '').replace(/\/+$/, ''),
    monthUsd: usd > 0 ? usd : 0.10
  };
};
const plans = (c) => [1, 3, 6, 12].map(m => ({ id: m + 'm', months: m, days: m === 12 ? 365 : m * 30, usd: Math.round(c.monthUsd * m * 1e4) / 1e4 }));

const BC = 'https://api.blockcypher.com/v1/ltc/main';
const TTL = 2 * 3600e3;          // an order's exact amount is held for 2 hours
const GRACE = 24 * 3600e3;       // a payment that arrives late (up to a day) is still matched
const LIT = 1e8;                 // litoshis per LTC

// ---------- small helpers ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function readText(req, max) {
  let n = 0; const b = [];
  for await (const c of req) { n += c.length; if (n > max) break; b.push(c); }
  return Buffer.concat(b).toString();
}
const hookKey = (c) => crypto.createHmac('sha256', c.secret).update('ltc-hook').digest('hex').slice(0, 40);
const same = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const dayKey = (ts) => 'o' + new Date(ts).toISOString().slice(0, 10).replace(/-/g, '');
const money = (n) => (n / LIT).toFixed(8);

// ---------- Firestore over REST, as the service account ----------
let tok = { t: '', exp: 0 };
function account() {
  let v = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!v) return null;
  try { if (!/^\s*\{/.test(v)) v = Buffer.from(v, 'base64').toString(); const a = JSON.parse(v); return a.client_email && a.private_key ? a : null; } catch { return null; }
}
// No-key option: a normal Firebase login (email and password) listed in admins/<uid>. The rules let admins write s/ and pay/.
const bot = () => { const E = process.env; return E.PAY_BOT_EMAIL && E.PAY_BOT_PASSWORD ? { email: E.PAY_BOT_EMAIL, password: E.PAY_BOT_PASSWORD } : null; };
const ready = () => !!(account() || bot());
async function accessToken() {
  if (tok.t && Date.now() < tok.exp - 60e3) return tok.t;
  const sa = account();
  if (!sa) {
    const b = bot(); if (!b) throw new Error('no service account');
    const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + cfg().apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: b.email, password: b.password, returnSecureToken: true }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.idToken) throw new Error('bot sign-in failed: ' + ((j.error && j.error.message) || r.status));
    tok = { t: j.idToken, exp: Date.now() + (Number(j.expiresIn) || 3600) * 1000 };
    return tok.t;
  }
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'), now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' }), claim = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claim + '.' + sig }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('service account sign-in failed: ' + (j.error_description || j.error || r.status));
  tok = { t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return tok.t;
}
const enc = (v) => typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } : v === null ? { nullValue: null }
  : Number.isInteger(v) ? { integerValue: String(v) } : typeof v === 'number' ? { doubleValue: v }
  : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
const dec = (f) => 'stringValue' in f ? f.stringValue : 'integerValue' in f ? Number(f.integerValue) : 'doubleValue' in f ? f.doubleValue : 'booleanValue' in f ? f.booleanValue
  : 'nullValue' in f ? null : 'arrayValue' in f ? (f.arrayValue.values || []).map(dec) : 'mapValue' in f ? Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, x]) => [k, dec(x)])) : undefined;
const encObj = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
const decDoc = (d) => ({ d: Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, dec(v)])), t: d.updateTime });

async function fs(path, body) {
  const c = cfg(), base = `https://firestore.googleapis.com/v1/projects/${c.project}/databases/(default)/documents`;
  const r = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + await accessToken(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
async function getDoc(path) {
  const r = await fs('/' + path);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Firestore read ' + r.status);
  return decDoc(r.j);
}
async function runQuery(where, limit) {
  const r = await fs(':runQuery', { structuredQuery: { from: [{ collectionId: 'pay' }], where, limit } });
  if (!r.ok) throw new Error('Firestore query ' + r.status);
  return (Array.isArray(r.j) ? r.j : []).filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), ...decDoc(x.document) }));
}
const eq = (field, v) => ({ fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: enc(v) } });
const isIn = (field, vs) => ({ fieldFilter: { field: { fieldPath: field }, op: 'IN', value: { arrayValue: { values: vs.map(enc) } } } });
const name = (path) => `projects/${cfg().project}/databases/(default)/documents/${path}`;
const wCreate = (path, data) => ({ update: { name: name(path), fields: encObj(data) }, currentDocument: { exists: false } });
const wPatch = (path, data, pre) => ({ update: { name: name(path), fields: encObj(data) }, updateMask: { fieldPaths: Object.keys(data) }, ...(pre ? { currentDocument: pre } : {}) });
const commit = async (writes) => { const r = await fs(':commit', { writes }); return { ok: r.ok, code: r.j && r.j.error && r.j.error.status }; };

// ---------- who is calling ----------
const who = new Map();
async function uidOf(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return '';
  const hit = who.get(token); if (hit && hit.exp > Date.now()) return hit.uid;
  try {
    const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + cfg().apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) });
    if (!r.ok) return '';
    const uid = (((await r.json()).users || [])[0] || {}).localId || '';
    if (uid) { who.set(token, { uid, exp: Date.now() + 300e3 }); if (who.size > 500) who.clear(); }
    return uid;
  } catch { return ''; }
}

// ---------- Litecoin price (USD) ----------
let rate = { v: 0, t: 0 };
async function ltcUsd() {
  if (rate.v && Date.now() - rate.t < 60e3) return rate.v;
  const tries = [
    async () => Number((await (await fetch('https://api.coinbase.com/v2/prices/LTC-USD/spot')).json()).data.amount),
    async () => Number((await (await fetch('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd')).json()).litecoin.usd)
  ];
  for (const t of tries) { try { const v = await t(); if (v > 0 && isFinite(v)) { rate = { v, t: Date.now() }; return v; } } catch {} }
  if (rate.v && Date.now() - rate.t < 6 * 3600e3) return rate.v; // an old price is better than none
  throw new Error('no price');
}

// ---------- BlockCypher ----------
async function bc(path, opt = {}) {
  const c = cfg(), tk = c.bcToken ? (path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(c.bcToken) : '';
  const r = await fetch(BC + path + tk, { method: opt.body ? 'POST' : 'GET', headers: opt.body ? { 'Content-Type': 'application/json' } : undefined, body: opt.body ? JSON.stringify(opt.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 429) throw new Error('BlockCypher rate limit reached');
  if (!r.ok) throw new Error('BlockCypher ' + r.status + ' ' + (j.error || ''));
  return j;
}

// Looks at the newest payments to our address and credits every confirmed one. Safe to run any time, as often as you like.
const scanState = { at: 0, run: null };
function scan(minGap) {
  if (scanState.run) return scanState.run;
  if (Date.now() - scanState.at < minGap) return Promise.resolve(0);
  scanState.at = Date.now();
  scanState.run = (async () => {
    const c = cfg(), r = await bc(`/addrs/${c.address}?limit=50`), cutoff = Date.now() - 3 * 864e5;
    const outs = [...(r.unconfirmed_txrefs || []), ...(r.txrefs || [])]
      .filter(x => Number(x.tx_output_n) >= 0 && !(Number(x.tx_input_n) >= 0) && Number(x.value) > 0 && !x.double_spend)
      .filter(x => { const ts = Date.parse(x.confirmed || x.received || ''); return !ts || ts >= cutoff; })
      .map(x => ({ hash: String(x.tx_hash), n: Number(x.tx_output_n), v: Number(x.value), conf: Number(x.confirmations) || 0 }));
    for (const o of outs) await handleOutput(o, c);
    return outs.length;
  })().finally(() => { scanState.run = null; });
  return scanState.run;
}

// ---------- matching a payment to an order ----------
async function matchOrder(v, now) {
  const exact = await getDoc('pay/' + v);
  if (exact && exact.d.st === 'open' && now < exact.d.e + GRACE) return { id: String(v), ...exact };
  // Not the exact amount (an exchange took a fee, say): accept it if exactly one open order is close
  const rows = await runQuery(isIn('b', [0, 1, 2, 3].map(i => dayKey(now - i * 864e5))), 100);
  const near = rows.filter(r => r.d.st === 'open' && now < r.d.e + GRACE && v >= 0.9 * r.d.a && v <= 1.5 * r.d.a);
  return near.length === 1 ? near[0] : null;
}

async function handleOutput(o, c) {
  const mid = `pay/tx_${o.hash}_${o.n}`, now = Date.now();
  if (await getDoc(mid)) return 'done';
  const order = await matchOrder(o.v, now);
  if (!order) {
    if (o.conf >= c.conf) await commit([wCreate(mid, { st: 'orphan', v: o.v, h: o.hash, n: o.n, t: now })]); // keep it for staff
    return 'orphan';
  }
  if (o.conf < c.conf) { // seen, waiting for confirmations
    if (order.d.x !== o.hash || order.d.n !== o.conf) await commit([wPatch('pay/' + order.id, { x: o.hash, n: o.conf })]);
    return 'seen';
  }
  for (let i = 0; i < 4; i++) {
    const cur = i ? await getDoc('pay/' + order.id) : order;
    if (!cur || cur.d.st !== 'open') return 'done';
    const days = Math.min(Math.floor(cur.d.d * o.v / cur.d.a), Math.floor(cur.d.d * 1.5)); // an underpayment gives fewer days, a big overpayment is capped
    if (days < 1) { await commit([wCreate(mid, { st: 'orphan', v: o.v, h: o.hash, n: o.n, t: now })]); return 'orphan'; }
    const s = await getDoc('s/' + cur.d.u), forever = !!s && s.d.p === 'lite' && !s.d.e;
    const from = s && s.d.p === 'lite' && s.d.e > now ? s.d.e : now, until = forever ? 0 : from + days * 864e5;
    const writes = [
      wCreate(mid, { st: 'credited', o: order.id, u: cur.d.u, v: o.v, h: o.hash, d: days, t: now }),
      wPatch('pay/' + order.id, { st: 'paid', b: '', x: o.hash, n: o.conf, k: days, pv: o.v, pt: now }, { updateTime: cur.t })
    ];
    if (!forever) writes.push(wPatch('s/' + cur.d.u, { p: 'lite', e: until }, s ? { updateTime: s.t } : { exists: false }));
    const r = await commit(writes);
    if (r.ok) return 'credited';
    if (await getDoc(mid)) return 'done'; // someone else credited it first
    await sleep(80);
  }
  throw new Error('could not credit ' + o.hash);
}

// ---------- orders ----------
async function createOrder(uid, planId, c) {
  const plan = plans(c).find(p => p.id === planId);
  if (!plan) return { code: 400, error: 'Pick a plan.' };
  const now = Date.now(), mine = (await runQuery(eq('u', uid), 50)).filter(r => r.d.st === 'open');
  const live = mine.find(r => r.d.p === plan.id && r.d.e > now);
  const show = (r) => ({ ok: true, o: r.id, ...describe(r.d, c) });
  if (live) return { code: 200, body: show(live) };
  for (const r of mine.filter(r => r.d.e <= now)) await commit([wPatch('pay/' + r.id, { st: 'expired', b: '' })]); // tidy this user's old unpaid orders
  if (mine.filter(r => r.d.e > now).length >= 4) return { code: 429, error: 'You have too many open orders. Finish one or wait for it to expire.' };
  let r; try { r = await ltcUsd(); } catch { return { code: 503, error: 'Could not get the Litecoin price. Try again in a minute.' }; }
  const base = Math.ceil(plan.usd / r * LIT);
  for (let i = 0; i < 30; i++) {
    const range = i < 12 ? 999 : i < 24 ? 9999 : 99999, amount = base + 1 + Math.floor(Math.random() * range);
    const d = { u: uid, p: plan.id, d: plan.days, c: plan.usd, a: amount, r, t: now, e: now + TTL, st: 'open', b: dayKey(now) };
    const w = await commit([wCreate('pay/' + amount, d)]);
    if (w.ok) return { code: 200, body: { ok: true, o: String(amount), ...describe(d, c) } };
    if (w.code && w.code !== 'ALREADY_EXISTS' && w.code !== 'ABORTED') return { code: 500, error: 'Could not create the order. Try again.' };
  }
  return { code: 503, error: 'Busy right now. Try again in a minute.' };
}
function describe(d, c) {
  return { plan: d.p, days: d.d, usd: d.c, addr: c.address, amt: money(d.a), exp: d.e, need: c.conf,
    uri: `litecoin:${c.address}?amount=${money(d.a)}&label=JALTRON%20Lite` };
}

async function orderStatus(uid, id, c) {
  if (!/^\d{1,12}$/.test(id)) return { code: 400, error: 'Unknown order.' };
  let o = await getDoc('pay/' + id);
  if (!o || o.d.u !== uid) return { code: 404, error: 'Unknown order.' };
  if (o.d.st === 'open' && Date.now() < o.d.e + GRACE) {
    // a quick look at the chain, at most once a minute for the first 10 minutes and every 5 minutes after that
    const young = Date.now() - o.d.t < 600e3;
    try { await scan(young ? 45e3 : 300e3); } catch (e) { console.error('scan', e.message); }
    o = (await getDoc('pay/' + id)) || o;
  }
  const out = { ok: true, need: c.conf, exp: o.d.e, n: o.d.n || 0 };
  if (o.d.st === 'paid') { const s = await getDoc('s/' + uid); return { code: 200, body: { ...out, st: 'paid', days: o.d.k, until: s && s.d.p === 'lite' ? s.d.e || 0 : 0 } }; }
  if (o.d.x) return { code: 200, body: { ...out, st: 'seen' } };
  return { code: 200, body: { ...out, st: Date.now() > o.d.e ? 'expired' : 'open' } };
}

// ---------- admin setup ----------
// Is the caller listed in admins/<uid>? Asked with the caller's OWN login: the rules let you read your own admins doc, and it works
// for both the service account and the bot login (the bot is a different user, so it can never read someone else's admins doc).
async function isAdminCaller(req, uid) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!uid || !token) return false;
  try { const r = await fetch(`https://firestore.googleapis.com/v1/projects/${cfg().project}/databases/(default)/documents/admins/${uid}`, { headers: { Authorization: 'Bearer ' + token } }); return r.ok; } catch { return false; }
}

// Tests every setting and every outside service, and says in plain words what is wrong
async function diagnose(c) {
  const out = [], add = (name, ok, note) => out.push({ name, ok: !!ok, note: note || '' }), E = process.env, sa = account();
  add('LTC_ADDRESS', c.address, c.address || 'Missing: the Litecoin address that receives the money.');
  add('PAY_SECRET', c.secret, c.secret ? 'set' : 'Missing: any long random text. It protects the webhook link.');
  add('BLOCKCYPHER_TOKEN', c.bcToken, c.bcToken ? 'set' : 'Missing: your free BlockCypher token (needed to create webhooks).');
  if (E.FIREBASE_SERVICE_ACCOUNT && !sa) add('FIREBASE_SERVICE_ACCOUNT', false, 'It is set but cannot be read. Paste the whole service account JSON (it must contain client_email and private_key), or that JSON in base64.');
  else if (!sa && !bot()) add('Firebase access', false, 'Missing: set FIREBASE_SERVICE_ACCOUNT, or PAY_BOT_EMAIL and PAY_BOT_PASSWORD.');
  else {
    try {
      await accessToken(); const r = await fs('/pay/_ping'), good = r.ok || r.status === 404;
      add('Firebase access', good, (sa ? 'service account' : 'bot login') + (good ? ' works' : ` signed in, but Firestore answered ${r.status}${r.status === 403 ? ' (the service account needs the Cloud Datastore User role; a bot must be listed in admins/<its uid>)' : ''}`));
    } catch (e) { add('Firebase access', false, e.message); }
  }
  try { add('Litecoin price', true, '1 LTC = $' + await ltcUsd()); } catch { add('Litecoin price', false, 'Could not get the price from Coinbase or CoinGecko.'); }
  if (c.address) { try { const r = await bc(`/addrs/${c.address}/balance`); add('BlockCypher', true, 'address found, ' + (r.n_tx || 0) + ' transactions so far'); } catch (e) { add('BlockCypher', false, e.message + ' (check the token, and that this is a Litecoin address)'); } }
  return out;
}

async function setup(uid, req, c) {
  const site = c.site || `https://${req.headers['x-forwarded-host'] || req.headers.host}`, url = `${site}/api/pay?hook=${hookKey(c)}`;
  const have = await bc('/hooks'), list = Array.isArray(have) ? have : [], hooks = [];
  for (const w of [{ event: 'unconfirmed-tx' }, { event: 'tx-confirmation', confirmations: c.conf }]) {
    const f = list.find(h => h.event === w.event && h.address === c.address && h.url === url);
    if (f) { hooks.push({ event: w.event, id: f.id, status: 'exists' }); continue; }
    const made = await bc('/hooks', { body: { ...w, address: c.address, url } });
    hooks.push({ event: w.event, id: made.id, status: 'created' });
  }
  const orphans = (await runQuery(eq('st', 'orphan'), 10)).map(r => ({ ltc: money(r.d.v), tx: r.d.h, at: r.d.t }));
  const open = (await runQuery(eq('st', 'open'), 100)).length;
  let usd = 0; try { usd = await ltcUsd(); } catch {}
  return { code: 200, body: { ok: true, address: c.address, site, confirmations: c.conf, rate: usd, hooks, openOrders: open, orphans } };
}

// ---------- the function ----------
module.exports = async (req, res) => {
  const send = (code, body) => res.status(code).json(body);
  const fail = (code, error) => send(code, { ok: false, error });
  try {
    const c = cfg(), q = new URL(req.url || '/', 'http://x').searchParams;
    // Admin tools run before the "is it set up" gate, so they can explain what is missing
    let body = {};
    if (req.method === 'POST' && !q.has('hook')) { try { body = JSON.parse(await readText(req, 4000) || '{}'); } catch { return fail(400, 'Bad request.'); } }
    if (body.action === 'setup' || body.action === 'check') {
      const uid = await uidOf(req);
      if (!uid) return fail(401, 'Sign in first.');
      if (!(await isAdminCaller(req, uid))) return fail(403, 'Admins only. Add a document with your account ID as its name to the admins collection in Firestore.');
      const checks = await diagnose(c), good = checks.every(x => x.ok);
      if (body.action === 'check' || !good) return send(200, { ok: true, ready: good, checks });
      const r = await setup(uid, req, c); return r.body ? send(r.code, { ...r.body, ready: true, checks }) : fail(r.code, r.error);
    }
    if (!c.address || !c.secret || !ready()) return fail(503, 'Litecoin payments are not set up yet.');

    if (q.has('hook')) { // BlockCypher webhook. The payload is ignored: it only triggers a look at the chain, so it cannot be faked into crediting anyone.
      if (req.method !== 'POST' || !same(q.get('hook'), hookKey(c))) return fail(403, 'Not allowed.');
      await readText(req, 2e6);
      await scan(0);
      return send(200, { ok: true });
    }
    if (req.method === 'GET') {
      if (q.get('action') !== 'plans') return fail(404, 'Not found.');
      let r = 0; try { r = await ltcUsd(); } catch {}
      return send(200, { ok: true, rate: r, need: c.conf, address: c.address, plans: plans(c) });
    }
    if (req.method !== 'POST') return fail(405, 'POST only');
    const uid = await uidOf(req);
    if (!uid) return fail(401, 'Sign in to pay with Litecoin.');
    const r = body.action === 'create' ? await createOrder(uid, String(body.plan || ''), c)
      : body.action === 'status' ? await orderStatus(uid, String(body.o || ''), c) : { code: 400, error: 'Unknown action.' };
    return r.body ? send(r.code, r.body) : fail(r.code, r.error);
  } catch (e) {
    console.error('pay', e && e.stack || e);
    return fail(500, 'Something went wrong. Your money is safe; try again in a minute.');
  }
};
module.exports.config = { api: { bodyParser: false } };
module.exports._t = { plans, cfg, scan, dayKey, hookKey, handleOutput };
