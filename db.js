// JALTRON cloud: Google sign-in + Firestore. Email, photo, name and last login come from Auth, so none are stored.
//   u/<uid>      { v: 3 format mark, k: [custom categories], a: profile picture, c: home cover picture, p: pet and streak {n total days, d last day ms, r run, b best run}, f: focus timer {d day ms, m minutes today, s sessions today, t all-time minutes, c settings}, y: drawn pet picture, b: fake bank { m: balance, l: ["<day ms>|+N|<uid>|<ms>", ...] },
//                 q: task map { "<id>": { t: title, p: h|m|l, c: category, d: due ms, x: done, o: order, r/s/b/l/h: repeat, streak, best, last day ms, history ms, z: finished day ms, i: ["path|thumb"] pictures (ImgBB, host removed) } } }
//                 The whole account is one doc: one read loads it, one update saves only the tasks that changed ("q.<id>" field paths). Order comes from o, sorted in JS. Stored times are Unix ms; migrate() rewrites older docs in place.
//   u/<uid>/t/<id>  legacy one-doc-per-task layout, replaced by q. Kept readable while old accounts self-migrate (migrate() below); the rules block can go once they are all on v: 3.
//   s/<uid>      { p: 'lite', e: expiry ms }  the subscription, written only by staff (rules block clients)
//   lb/<uid>     { n: username, t: streak days, b: best run, d: last active ms }  the public streak leaderboard (a projection of your own streak; rules tie n to your own username claim; o: true on u/<uid> hides you)
//   w/<id>       { o: owner uid, nm: name, c: currency, m: [member uids, owner included], b: balance in minor units, l: log, v: 3 }  shared banks (any number per owner); members change only b and l; names are resolved from the claims below
//   u/<name>     { u: uid }   (same collection as the uid docs; the only place a username is stored; the doc ID is the name, which keeps it unique)
//   rv/<uid>     { s: 1-5 stars (int), tx: review text (string ≤200), n: username (string), t: timestamp ms (int) }  one review per user; readable by all, writable only by owner
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, orderBy, deleteField, writeBatch, runTransaction, query, where, limit, onSnapshot, increment, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyDlqQYIPue53vx1tpm7-DYYKMZB4OatiDg',
  authDomain: 'jaltron0.firebaseapp.com',
  projectId: 'jaltron0',
  storageBucket: 'jaltron0.firebasestorage.app',
  messagingSenderId: '934608488435',
  appId: '1:934608488435:web:6247557aea521bad96f486'
});
// initializeAuth without a popup resolver skips Google's auth iframe at startup, so the signed-in state is known much sooner.
const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
// Local IndexedDB cache: repeat visits and flaky networks don't block on the server
// Auto-detect long polling: on networks that stall the streaming connection, Firestore switches quickly instead of waiting
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

// Short paths: u() -> "u/<uid>", u('t', 5) -> "u/<uid>/t/5"
const u = (...p) => ['u', auth.currentUser.uid, ...p].join('/');
const ref = (...p) => doc(db, u(...p));
const col = (name) => collection(db, u(name));

const emit = (type, detail) => dispatchEvent(new CustomEvent('jaltron:' + type, { detail }));
const P = { high: 'h', medium: 'm', low: 'l' }, PR = { h: 'high', m: 'medium', l: 'low' };
// Stored times are Unix ms (local midnight for day fields); these convert. dayMs returns 0 for anything that is not YYYY-MM-DD.
const pad = (n) => String(n).padStart(2, '0');
const dayMs = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? new Date(s + 'T00:00').getTime() : 0;
const msDay = (n) => { const d = new Date(Number(n) || 0); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// Bank log line "day|±N|uid|ms": bring the day segment to ms; already-ms lines pass through, so the conversion is idempotent
const toMsEntry = (e) => { const s = String(e), i = s.indexOf('|'), m = i > 0 ? dayMs(s.slice(0, i)) : 0; return m ? m + s.slice(i) : s; };
// Repeat and streak fields (r s b l h) are only stored for repeating tasks; z is the day a one-off task was finished
const pack = (t, o) => ({ t: t.title, p: P[t.prio] || 'm', c: t.tag, d: t.due ? dayMs(t.due) : '', x: !!t.done, o,
  ...(t.r ? { r: t.r, s: t.s || 0, b: t.b || 0, l: t.l ? dayMs(t.l) : '', h: (t.h || []).slice(-90).map(dayMs) } : {}),
  ...(t.z ? { z: dayMs(t.z) } : {}),
  ...(t.i && t.i.length ? { i: t.i.slice(0, 4) } : {}) });
const unpack = (id, d) => ({ id: Number(id), title: d.t, prio: PR[d.p] || 'medium', tag: d.c || 'General', due: typeof d.d === 'number' ? msDay(d.d) : (d.d || ''), done: !!d.x,
  r: d.r || '', s: d.s || 0, b: d.b || 0, l: typeof d.l === 'number' ? msDay(d.l) : (d.l || ''), h: Array.isArray(d.h) ? d.h.map((x) => typeof x === 'number' ? msDay(x) : x) : [], z: typeof d.z === 'number' ? msDay(d.z) : (d.z || ''), i: Array.isArray(d.i) ? d.i : [] });
let synced = new Map(), timer = null, loadedUid = null; // loadedUid: saving only starts once the cloud copy has been read

// Tiny local snapshot so the UI can paint instantly before the network answers
const CK = (uid) => 'jc:' + uid;
const readCache = (uid) => { try { return JSON.parse(localStorage.getItem(CK(uid))); } catch { return null; } };
const writeCache = (uid, tasks, profile) => { try { localStorage.setItem(CK(uid), JSON.stringify({ tasks, profile })); localStorage.setItem('jc:last', uid); } catch {} };

// Write only what changed (new, edited, reordered, deleted tasks), debounced.
// updateDoc takes "q.<id>" dotted field paths, so the whole diff lands on the one account doc.
function save(tasks) {
  const user = auth.currentUser;
  if (!user || loadedUid !== user.uid) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (auth.currentUser?.uid !== user.uid) return;
    const next = new Map(tasks.map((t, o) => [String(t.id), JSON.stringify(pack(t, o))]));
    const fields = {};
    next.forEach((json, id) => { if (synced.get(id) !== json) fields['q.' + id] = JSON.parse(json); });
    synced.forEach((_, id) => { if (!next.has(id)) fields['q.' + id] = deleteField(); });
    const keys = Object.keys(fields);
    try {
      for (let i = 0; i < keys.length; i += 400) {
        const part = {};
        for (const k of keys.slice(i, i + 400)) part[k] = fields[k];
        await updateDoc(ref(), part);
      }
      synced = next;
      const c = readCache(user.uid);
      writeCache(user.uid, tasks, c?.profile || { n: '', k: [] });
    } catch (err) { console.error(err); emit('error', 'Could not save to the cloud. Check your connection.'); }
  }, 500);
}

// Firestore turns "no such doc" into permission-denied when a rule checks a field (u/<name> needs 'u' in resource.data)
const isPerm = (e) => !!e && (e.code === 'permission-denied' || /permission/i.test(e.message || ''));
// Claim a username atomically: fails with "taken" if another account owns it
const NAME_RE = /^[a-z0-9_]{3,20}$/;
// Find the username this account owns (usernames live only in u/<name>; the uid doc has no 'u' field so it never matches)
async function mine() {
  const s = await getDocs(query(collection(db, 'u'), where('u', '==', auth.currentUser.uid), limit(1)));
  return s.empty ? '' : s.docs[0].id;
}
// Leaderboard entry for this account (skipped when hidden or empty; the last sent copy is remembered so unchanged data costs no write)
async function pushLb(profile) {
  const user = auth.currentUser, p = (profile && profile.p) || {};
  if (!user || !profile || !profile.n || profile.o || !p.n) return;
  const e = { n: profile.n, t: p.n, b: Math.max(p.b || 0, p.r || 0), d: p.d ? dayMs(p.d) : 0 }, j = JSON.stringify(e), k = 'jl:' + user.uid;
  try { if (localStorage.getItem(k) === j) return; } catch {}
  try { await setDoc(doc(db, 'lb', user.uid), e); try { localStorage.setItem(k, j); } catch {} } catch (err) { console.error(err); }
}
async function setLbOptOut(o) {
  const uid = auth.currentUser.uid, c = readCache(uid);
  try {
    await setDoc(ref(), { o }, { merge: true });
    if (c) writeCache(uid, c.tasks, { ...c.profile, o });
    if (o) { await deleteDoc(doc(db, 'lb', uid)); try { localStorage.removeItem('jl:' + uid); } catch {} }
    else pushLb({ ...(c && c.profile), o });
  } catch (err) { console.error(err); emit('error', 'Could not change the leaderboard setting.'); }
}
const lbTop = async (n = 25) => (await getDocs(query(collection(db, 'lb'), orderBy('t', 'desc'), limit(n)))).docs.map((x) => ({ id: x.id, ...x.data() }));

async function setUsername(name) {
  name = String(name).trim().toLowerCase();
  if (!NAME_RE.test(name)) throw new Error('invalid');
  const uid = auth.currentUser.uid, nref = doc(db, 'u', name), old = await mine();
  if (old === name) return name;
  // Reading a free name can be refused by the rules (no doc, so no 'u' field to check): that just means it is free.
  const owner = await getDoc(nref).then((s) => (s.exists() ? s.data().u : null)).catch((e) => { if (isPerm(e)) return null; throw e; });
  if (owner && owner !== uid) throw new Error('taken');
  // The rules only allow creating a claim, never overwriting one, so a race for the same name fails here instead of stealing it
  const b = writeBatch(db);
  if (old) b.delete(doc(db, 'u', old));
  b.set(nref, { u: uid });
  try { await b.commit(); } catch (e) { throw new Error(isPerm(e) ? 'taken' : e.message || 'failed'); }
  const c = readCache(uid);
  if (c) { writeCache(uid, c.tasks, { ...c.profile, n: name }); pushLb({ ...c.profile, n: name }); }
  return name;
}

async function setCats(k) {
  try {
    await setDoc(ref(), { k }, { merge: true });
    const uid = auth.currentUser.uid, c = readCache(uid);
    if (c) writeCache(uid, c.tasks, { ...c.profile, k });
  } catch (err) { console.error(err); emit('error', 'Could not save categories.'); }
}

async function setAvatar(a) {
  try {
    await setDoc(ref(), { a }, { merge: true });
    const uid = auth.currentUser.uid, c = readCache(uid);
    if (c) writeCache(uid, c.tasks, { ...c.profile, a });
  } catch (err) { console.error(err); emit('error', 'Could not save your picture.'); }
}

async function setCover(c) {
  try {
    await setDoc(ref(), { c }, { merge: true });
    const uid = auth.currentUser.uid, cc = readCache(uid);
    if (cc) writeCache(uid, cc.tasks, { ...cc.profile, c });
  } catch (err) { console.error(err); emit('error', 'Could not save your cover picture.'); }
}

async function setPet(p) {
  try {
    await setDoc(ref(), { p: p && p.d ? { ...p, d: dayMs(p.d) } : p }, { merge: true });
    const uid = auth.currentUser.uid, cc = readCache(uid);
    if (cc) { writeCache(uid, cc.tasks, { ...cc.profile, p }); pushLb({ ...cc.profile, p }); }
  } catch (err) { console.error(err); }
}

async function setFocus(f) {
  try {
    await setDoc(ref(), { f: f && f.d ? { ...f, d: dayMs(f.d) } : f }, { merge: true });
    const uid = auth.currentUser.uid, cc = readCache(uid);
    if (cc) writeCache(uid, cc.tasks, { ...cc.profile, f });
  } catch (err) { console.error(err); }
}

async function setPetArt(y) {
  try {
    await setDoc(ref(), { y }, { merge: true });
    const uid = auth.currentUser.uid, cc = readCache(uid);
    if (cc) writeCache(uid, cc.tasks, { ...cc.profile, y });
  } catch (err) { console.error(err); emit('error', 'Could not save your pet.'); }
}

// ---------- Fake banks ----------
// Money is stored as whole minor units (cents) with a currency code. Entries: "<day ms>|+N|<uid>|<ms>" (N in minor units).
// This code adds the uid, so nobody can spend under someone else's name; the ms tail keeps same-day entries from merging in arrayUnion.
// Moves use increment/arrayUnion (no read, they also work offline); once the log is full one plain write lands that also trims it.
// Old accounts stored whole dollars with no v mark; extras.js converts those on read and the first write here upgrades them.
const isoDay = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const BANK_CAP = 90; // the rules allow 100; 90 matches the history caps elsewhere in the app
const bankEntry = (delta) => `${dayMs(isoDay())}|${delta > 0 ? '+' : ''}${delta}|${auth.currentUser.uid}|${Date.now()}`;
const nextBank = (cur, delta, e) => ({ m: (cur?.m || 0) + delta, l: [...(cur?.l || []).slice(-(BANK_CAP - 1)), e], c: cur?.c || 'USD', v: 3 });
const cacheBank = (b) => { const c = readCache(auth.currentUser.uid); if (c) writeCache(auth.currentUser.uid, c.tasks, { ...c.profile, b }); };

// My (private) bank. stored: the saved copy is already v: 3, so increments are safe
async function bankMoney(delta, cur, stored) {
  const e = bankEntry(delta), next = nextBank(cur, delta, e);
  await updateDoc(ref(), stored && (cur?.l || []).length < BANK_CAP ? { 'b.m': increment(delta), 'b.l': arrayUnion(e) } : { b: next });
  cacheBank(next);
  return next;
}
// Delete one history line (balance stays as it is). Saved v: 3 copies can use arrayRemove; old copies are rewritten whole.
async function bankLogDel(entry, cur, stored) {
  const next = { ...cur, l: cur.l.filter((x) => x !== entry) };
  await (stored ? updateDoc(ref(), { 'b.l': arrayRemove(entry) }) : updateDoc(ref(), { b: next }));
  cacheBank(next);
  return next;
}
async function bankPut(b) { await updateDoc(ref(), { b }); cacheBank(b); return b; }

// Shared banks: w/<autoId> { o: owner uid, nm: name, c: currency, m: [member uids, owner included], b: balance, l: log, v: 3 }.
// The owner edits everything; members may only move money (b, l) or remove themselves. Names are never stored here (resolved from the claims).
// Old docs upgrade in two steps: no-v pots (whole dollars, w/<ownerUid>) are converted on read; v: 2 banks only need their log day-segments moved to ms (wsUpgrade).
const wsDoc = (id) => doc(db, 'w', id);
const wsCreate = (nm, c) => addDoc(collection(db, 'w'), { o: auth.currentUser.uid, nm, c, m: [auth.currentUser.uid], b: 0, l: [], v: 3 });
const wsEdit = (id, nm, c) => updateDoc(wsDoc(id), { nm, c });
const wsLogDel = (id, entry) => updateDoc(wsDoc(id), { l: arrayRemove(entry) });
const wsRemove = (id) => deleteDoc(wsDoc(id));
const wsLeave = (id) => updateDoc(wsDoc(id), { m: arrayRemove(auth.currentUser.uid) });
// A claim read failing with permission-denied just means the username is unknown.
async function wsAdd(id, name) {
  name = String(name).trim().toLowerCase();
  if (!NAME_RE.test(name)) throw new Error('invalid');
  const c = await getDoc(doc(db, 'u', name)).catch((e) => { if (isPerm(e)) throw new Error('unknown'); throw e; });
  if (!c.exists() || !c.data().u) throw new Error('unknown');
  if (c.data().u === auth.currentUser.uid) throw new Error('me');
  await updateDoc(wsDoc(id), { m: arrayUnion(c.data().u) });
}
const wsDel = (id, uid) => updateDoc(wsDoc(id), { m: arrayRemove(uid) });
async function wsMoney(id, delta, cur) {
  const e = bankEntry(delta), next = nextBank(cur, delta, e);
  await updateDoc(wsDoc(id), (cur?.l || []).length < BANK_CAP ? { b: increment(delta), l: arrayUnion(e) } : { b: next.m, l: next.l });
  return next;
}
const wsUpgrade = (id, b, l) => updateDoc(wsDoc(id), { o: id, nm: 'Shared bank', c: 'USD', v: 3, b, l: (l || []).map(toMsEntry) });
// Every bank whose member list contains you, live (member add/remove shows up here too). Returns the unsubscribe.
// includeMetadataChanges: the cache-to-server confirmation must fire even when nothing changed.
const wsWatch = (onNext, onErr) => onSnapshot(query(collection(db, 'w'), where('m', 'array-contains', auth.currentUser.uid)), { includeMetadataChanges: true }, onNext, onErr);

// Username for a uid: claims store only name -> uid, so run the reverse query once per uid and keep the answer
const names = new Map();
function nameOf(uid) {
  if (!names.has(uid)) names.set(uid, getDocs(query(collection(db, 'u'), where('u', '==', uid), limit(1))).then((s) => (s.empty ? '' : s.docs[0].id)).catch(() => ''));
  return names.get(uid);
}

// First login: pick a free username from the Google name or email
async function claim(user) {
  const base = (user.displayName || user.email?.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14).padEnd(3, '0');
  for (let i = 0; i < 8; i++) {
    try { return await setUsername(i ? base + (100 + Math.floor(Math.random() * 900)) : base); }
    catch (err) { if (err.message !== 'taken') throw err; }
  }
  throw new Error('no free username');
}

// One-time move onto the v: 3 layout: old accounts get their tasks pulled from u/<uid>/t into q,
// and every stored day (task d/l/h/z, pet p.d, focus f.d, bank log day-segments) becomes Unix ms.
// The v: 3 write is transactional, so two tabs or a racing save can never push stale data over fresh tasks.
// The subcollection is read unfiltered (no orderBy) so no doc can be skipped, whatever shape it is in.
async function migrate() {
  const me = (await getDoc(ref())).data() || {};
  const from = me.v || 0;
  if (from >= 3) return;
  const q = { ...(me.q || {}) };
  let legacy = null;
  if (from < 2) {
    legacy = await getDocs(col('t'));
    legacy.forEach(x => { q[x.id] = x.data(); });
  }
  const toMs = (v) => dayMs(v) || v; // day strings become ms; numbers and empty values pass through
  for (const id in q) {
    const t = { ...q[id] };
    if (t.d) t.d = toMs(t.d);
    if (t.l) t.l = toMs(t.l);
    if (t.z) t.z = toMs(t.z);
    if (Array.isArray(t.h)) t.h = t.h.map(toMs);
    q[id] = t;
  }
  const set = { v: 3, q };
  if (me.p && typeof me.p === 'object' && me.p.d) set.p = { ...me.p, d: typeof me.p.d === 'number' ? me.p.d : dayMs(me.p.d) };
  if (me.f && typeof me.f === 'object' && me.f.d) set.f = { ...me.f, d: typeof me.f.d === 'number' ? me.f.d : dayMs(me.f.d) };
  if (me.b && typeof me.b === 'object') set.b = { ...me.b, l: (me.b.l || []).map(toMsEntry), v: 3 };
  await runTransaction(db, async (tx) => {
    const cur = await tx.get(ref());
    if ((cur.data() || {}).v !== 3) tx.set(ref(), set, { merge: true });
  });
  if (legacy) { // leftover old docs are never read again; clear them best effort so the account stays tidy
    for (let i = 0; i < legacy.size; i += 400) {
      const b = writeBatch(db);
      legacy.docs.slice(i, i + 400).forEach(x => b.delete(x.ref));
      await b.commit().catch(() => {});
    }
  }
}

async function load(user) {
  // The whole account is one doc, so a single read covers profile and tasks
  // The username is remembered from the last visit, which skips an extra server query on every load
  const known = readCache(user.uid)?.profile?.n || '';
  const [snap, name, plan] = await Promise.all([getDoc(ref()), known || mine(), getDoc(doc(db, 's', user.uid)).catch(() => null)]);
  let d = snap.exists() ? snap.data() : {};
  if (d.v !== 3) { await migrate(); d = (await getDoc(ref())).data() || {}; }
  const s = plan && plan.exists() ? { p: plan.data().p, e: plan.data().e || 0 } : null;
  const profile = { s, n: name || await claim(user), k: Array.isArray(d.k) ? d.k : [], a: typeof d.a === 'string' ? d.a : '', c: typeof d.c === 'string' ? d.c : '', p: d.p && typeof d.p === 'object' ? { ...d.p, d: d.p.d ? msDay(d.p.d) : (d.p.d || '') } : {}, f: d.f && typeof d.f === 'object' ? { ...d.f, d: d.f.d ? msDay(d.f.d) : (d.f.d || '') } : {}, y: typeof d.y === 'string' ? d.y : '', o: !!d.o, b: d.b && typeof d.b === 'object' ? d.b : { m: 0, l: [] } };
  const tasks = Object.entries(d.q || {}).sort((a, b) => (a[1].o || 0) - (b[1].o || 0)).map(([id, td]) => unpack(id, td));
  synced = new Map(tasks.map((t, o) => [String(t.id), JSON.stringify(pack(t, o))]));
  writeCache(user.uid, tasks, profile);
  loadedUid = user.uid;
  pushLb(profile);
  return { tasks, profile };
}

onAuthStateChanged(auth, async (user) => {
  synced = new Map(); loadedUid = null;
  if (!user) { try { localStorage.removeItem('jc:last'); } catch {} return emit('user', { user: null, tasks: [], profile: { n: '', k: [] } }); }
  // Paint from the local snapshot right away, then refresh from Firestore
  const cached = readCache(user.uid);
  // Show the signed-in state at once; the tasks follow when Firestore answers
  emit('user', cached ? { user, ...cached, cached: true } : { user, tasks: [], profile: { n: '', k: [] }, cached: true, loading: true });
  for (let tries = 0; ; tries++) {
    try { emit('user', { user, ...await load(user) }); break; }
    catch (err) {
      console.error(err);
      if (auth.currentUser?.uid !== user.uid) break;           // signed out or switched account meanwhile
      loadedUid = null;
      if (tries >= 2) {
        if (!cached) emit('user', { user, tasks: [], profile: { n: '', k: [] } });
        emit('error', isPerm(err) ? 'Could not load your data. Publish the latest firestore.rules in the Firebase console.' : 'Could not load your data. Check your connection.');
        break;
      }
      await new Promise((r) => setTimeout(r, 2500 * (tries + 1))); // try again a couple of times before giving up
    }
  }
});

// Admin tools (the rules only let accounts listed in admins/<uid> write s/<uid>)
const isAdmin = async () => !!auth.currentUser && (await getDoc(doc(db, 'admins', auth.currentUser.uid))).exists();
async function adminFind(q) {
  q = String(q).trim();
  const n = q.toLowerCase(), byName = NAME_RE.test(n) ? await getDoc(doc(db, 'u', n)).catch((e) => { if (isPerm(e)) return null; throw e; }) : null;
  const uid = byName && byName.exists() && byName.data().u ? byName.data().u : q;
  const [plan, nm] = await Promise.all([getDoc(doc(db, 's', uid)), getDocs(query(collection(db, 'u'), where('u', '==', uid), limit(1)))]);
  return { uid, name: nm.empty ? '' : nm.docs[0].id, plan: plan.exists() ? plan.data() : null };
}
const adminSet = (uid, days) => setDoc(doc(db, 's', uid), days === 0 ? { p: 'free' } : { p: 'lite', e: days < 0 ? 0 : Date.now() + days * 864e5 });

// Re-reads the plan doc (used right after a Litecoin payment is confirmed)
const refreshPlan = async () => { const s = await getDoc(doc(db, 's', auth.currentUser.uid)); return s.exists() ? { p: s.data().p, e: s.data().e || 0 } : null; };

window.DB = {
  refreshPlan,
  isAdmin, adminFind, adminSet, lbTop, setLbOptOut,
  save, u, setUsername, setCats, setAvatar, setCover, setPet, setFocus, setPetArt,
  bankMoney, bankPut, bankLogDel, wsLogDel, wsCreate, wsEdit, wsRemove, wsLeave, wsAdd, wsDel, wsMoney, wsUpgrade, wsWatch, nameOf,
  token: () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
  get user() { return auth.currentUser; },
  signIn: () => signInWithPopup(auth, new GoogleAuthProvider(), browserPopupRedirectResolver).catch(e => { if (e.code !== 'auth/popup-closed-by-user') emit('error', 'Sign-in failed: ' + e.code); }),
  signOut: () => signOut(auth)
};
emit('ready', {});
// Warm up the sign-in popup helper while the browser is idle, so clicking Sign in opens the window instantly
const warm = () => { try { browserPopupRedirectResolver._initialize(auth); } catch {} };
if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 2500);
