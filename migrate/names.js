'use strict';
// One-time migration: username claims move from the account collection (u/<name> = { u: <uid> }) into their own
// collection nm/<name> = { u: <uid> }. The app also does this per account on login (mine() in db.js) — this script
// just does everyone at once so the TEMP claim branch can leave firestore.rules sooner. Safe to run twice: claims
// already in nm/ only get their old copy deleted, nm/ docs are only ever created (never overwritten), and a name
// whose nm/ owner disagrees with the old claim is reported and left alone instead of guessed.
//
// RUN (no npm packages; uses the same service account as the payment function):
//   1. Firebase console > Project settings > Service accounts > Generate new private key -> save as sa.json
//   2. Windows PowerShell:  $env:FIREBASE_SERVICE_ACCOUNT = Get-Content sa.json -Raw ; node migrate/names.js
//      cmd:                 set FIREBASE_SERVICE_ACCOUNT=<contents of sa.json> && node migrate/names.js
//      or just:             node migrate/names.js sa.json
//   3. Add --dry to only print what would happen. Delete sa.json when you are done.
const crypto = require('crypto');
const fs = require('fs');
const PROJECT = 'jaltron0';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const NAME_RE = /^[a-z0-9_]{3,20}$/;
const dry = process.argv.includes('--dry');

let sa = null;
try {
  const file = process.argv.find((a) => a.endsWith('.json'));
  let v = file ? fs.readFileSync(file, 'utf8') : process.env.FIREBASE_SERVICE_ACCOUNT;
  if (v && !/^\s*\{/.test(v)) v = Buffer.from(v, 'base64').toString();
  sa = JSON.parse(v);
} catch {}
if (!sa || !sa.client_email || !sa.private_key) { console.error('No service account: set FIREBASE_SERVICE_ACCOUNT (JSON or base64) or pass the .json file.'); process.exit(1); }

async function token() {
  const now = Math.floor(Date.now() / 1000), b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'RS256', typ: 'JWT' }), claim = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${head}.${claim}.${sig}` });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('service account sign-in failed: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}
const api = async (method, url, body, tok) => {
  const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + tok, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) };
};

(async () => {
  const tok = await token();
  const owner = async (name) => {
    const g = await api('GET', `${BASE}/nm/${name}`, null, tok);
    if (g.status === 404) return null;
    if (!g.ok) throw new Error(`reading nm/${name} failed: ${g.status}`);
    return (g.j.fields && g.j.fields.u && g.j.fields.u.stringValue) || '';
  };
  const delOld = async (name) => {
    const d = await api('DELETE', `${BASE}/u/${encodeURIComponent(name)}`, null, tok);
    if (!d.ok) console.log(`  note: deleting u/${name} returned ${d.status} — harmless, remove it in the console`);
  };

  // Collect the old claims: doc id looks like a name AND the doc carries a 'u' (uid) field
  const claims = [];
  let page = '';
  for (;;) {
    const { ok, status, j } = await api('GET', BASE + '/u?pageSize=999' + (page ? '&pageToken=' + encodeURIComponent(page) : ''), null, tok);
    if (!ok) throw new Error(`listing u failed: ${status} ${JSON.stringify(j.error || {}).slice(0, 200)}`);
    for (const d of j.documents || []) {
      const id = d.name.split('/').pop();
      if (NAME_RE.test(id) && d.fields && d.fields.u && d.fields.u.stringValue) claims.push({ name: id, uid: d.fields.u.stringValue });
    }
    if (!j.nextPageToken) break;
    page = j.nextPageToken;
  }
  console.log(`found ${claims.length} old claim${claims.length === 1 ? '' : 's'} in u/` + (dry ? ' (dry run — nothing will be written)' : ''));

  let moved = 0, had = 0, bad = 0;
  for (const c of claims) {
    const cur = await owner(c.name);
    if (cur === c.uid) { // already migrated, just tidy up the old copy
      had++;
      if (!dry) await delOld(c.name);
      console.log(`already in nm/: ${c.name} (old copy ${dry ? 'kept (dry)' : 'deleted'})`);
      continue;
    }
    if (cur) { bad++; console.log(`CONFLICT: nm/${c.name} belongs to ${cur}, old claim says ${c.uid} — left alone, fix by hand`); continue; }
    if (!dry) {
      const made = await api('POST', `${BASE}/nm?documentId=${c.name}`, { fields: { u: { stringValue: c.uid } } }, tok);
      if (made.status === 409) { bad++; console.log(`nm/${c.name} appeared meanwhile — rerun to finish`); continue; }
      if (!made.ok) { bad++; console.log(`could not create nm/${c.name}: ${made.status} — old claim kept`); continue; }
      await delOld(c.name);
    }
    moved++;
    console.log(`${dry ? 'would move' : 'moved'} ${c.name} -> nm/ (${c.uid})`);
  }
  console.log(`done: ${dry ? 'would move' : 'moved'} ${moved}, already migrated ${had}, problem(s) ${bad}${bad ? ' — see above' : ''}`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
