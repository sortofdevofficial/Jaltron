// JALTRON cloud: Google sign-in + Firestore. Email, photo, name and last login come from Auth, so none are stored.
//   u/<uid>      { k: [custom categories], a: profile picture, c: home cover picture (short ImgBB paths), p: pet and streak {n total days, d last day, r run, b best run}, f: focus timer {d day, m minutes today, s sessions today, t all-time minutes, c settings}, y: drawn pet picture }
//   u/<uid>/t/<id> { t: title, p: h|m|l, c: category, d: due, x: done, o: order, r/s/b/l/h: repeat, streak, best, last day, history, z: finished day, i: ["path|thumb"] pictures (ImgBB, host removed) }
//   u/<name>     { u: uid }   (same collection as the uid docs; the only place a username is stored; the doc ID is the name, which keeps it unique)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, getDoc, getDocs, setDoc, writeBatch, runTransaction, query, orderBy, where, limit } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

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
// Repeat and streak fields (r s b l h) are only stored for repeating tasks; z is the day a one-off task was finished
const pack = (t, o) => ({ t: t.title, p: P[t.prio] || 'm', c: t.tag, d: t.due || '', x: !!t.done, o,
  ...(t.r ? { r: t.r, s: t.s || 0, b: t.b || 0, l: t.l || '', h: (t.h || []).slice(-90) } : {}),
  ...(t.z ? { z: t.z } : {}),
  ...(t.i && t.i.length ? { i: t.i.slice(0, 4) } : {}) });
const unpack = (id, d) => ({ id: Number(id), title: d.t, prio: PR[d.p] || 'medium', tag: d.c || 'General', due: d.d || '', done: !!d.x,
  r: d.r || '', s: d.s || 0, b: d.b || 0, l: d.l || '', h: Array.isArray(d.h) ? d.h : [], z: d.z || '', i: Array.isArray(d.i) ? d.i : [] });
let synced = new Map(), timer = null, loadedUid = null; // loadedUid: saving only starts once the cloud copy has been read

// Tiny local snapshot so the UI can paint instantly before the network answers
const CK = (uid) => 'jc:' + uid;
const readCache = (uid) => { try { return JSON.parse(localStorage.getItem(CK(uid))); } catch { return null; } };
const writeCache = (uid, tasks, profile) => { try { localStorage.setItem(CK(uid), JSON.stringify({ tasks, profile })); localStorage.setItem('jc:last', uid); } catch {} };

// Write only what changed (new, edited, reordered, deleted tasks), debounced
function save(tasks) {
  const user = auth.currentUser;
  if (!user || loadedUid !== user.uid) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (auth.currentUser?.uid !== user.uid) return;
    const next = new Map(tasks.map((t, o) => [String(t.id), JSON.stringify(pack(t, o))]));
    const ops = [];
    next.forEach((json, id) => { if (synced.get(id) !== json) ops.push(['set', id, JSON.parse(json)]); });
    synced.forEach((_, id) => { if (!next.has(id)) ops.push(['del', id]); });
    try {
      for (let i = 0; i < ops.length; i += 400) {
        const b = writeBatch(db);
        for (const [k, id, data] of ops.slice(i, i + 400)) k === 'set' ? b.set(ref('t', id), data) : b.delete(ref('t', id));
        await b.commit();
      }
      synced = next;
      const c = readCache(user.uid);
      writeCache(user.uid, tasks, c?.profile || { n: '', k: [] });
    } catch (err) { console.error(err); emit('error', 'Could not save to the cloud. Check your connection.'); }
  }, 500);
}

// Claim a username atomically: fails with "taken" if another account owns it
const NAME_RE = /^[a-z0-9_]{3,20}$/;
// Find the username this account owns (usernames live only in u/<name>; the uid doc has no 'u' field so it never matches)
async function mine() {
  const s = await getDocs(query(collection(db, 'u'), where('u', '==', auth.currentUser.uid), limit(1)));
  return s.empty ? '' : s.docs[0].id;
}
async function setUsername(name) {
  name = String(name).trim().toLowerCase();
  if (!NAME_RE.test(name)) throw new Error('invalid');
  const uid = auth.currentUser.uid, nref = doc(db, 'u', name), old = await mine();
  await runTransaction(db, async (tx) => {
    const n = await tx.get(nref);
    if (n.exists() && n.data().u !== uid) throw new Error('taken');
    if (old && old !== name) tx.delete(doc(db, 'u', old));
    tx.set(nref, { u: uid });
  });
  const c = readCache(uid);
  if (c) writeCache(uid, c.tasks, { ...c.profile, n: name });
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
    await setDoc(ref(), { p }, { merge: true });
    const uid = auth.currentUser.uid, cc = readCache(uid);
    if (cc) writeCache(uid, cc.tasks, { ...cc.profile, p });
  } catch (err) { console.error(err); }
}

async function setFocus(f) {
  try {
    await setDoc(ref(), { f }, { merge: true });
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

// First login: pick a free username from the Google name or email
async function claim(user) {
  const base = (user.displayName || user.email?.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14).padEnd(3, '0');
  for (let i = 0; i < 8; i++) {
    try { return await setUsername(i ? base + (100 + Math.floor(Math.random() * 900)) : base); }
    catch (err) { if (err.message !== 'taken') throw err; }
  }
  throw new Error('no free username');
}

async function load(user) {
  // Profile and tasks are fetched at the same time instead of one after the other
  // The username is remembered from the last visit, which skips an extra server query on every load
  const known = readCache(user.uid)?.profile?.n || '';
  const [snap, docs, name] = await Promise.all([getDoc(ref()), getDocs(query(col('t'), orderBy('o'))), known || mine()]);
  const d = snap.exists() ? snap.data() : {};
  const profile = { n: name || await claim(user), k: Array.isArray(d.k) ? d.k : [], a: typeof d.a === 'string' ? d.a : '', c: typeof d.c === 'string' ? d.c : '', p: d.p && typeof d.p === 'object' ? d.p : {}, f: d.f && typeof d.f === 'object' ? d.f : {}, y: typeof d.y === 'string' ? d.y : '' };
  const tasks = docs.docs.map(x => unpack(x.id, x.data()));
  synced = new Map(tasks.map((t, o) => [String(t.id), JSON.stringify(pack(t, o))]));
  writeCache(user.uid, tasks, profile);
  loadedUid = user.uid;
  return { tasks, profile };
}

onAuthStateChanged(auth, async (user) => {
  synced = new Map(); loadedUid = null;
  if (!user) { try { localStorage.removeItem('jc:last'); } catch {} return emit('user', { user: null, tasks: [], profile: { n: '', k: [] } }); }
  // Paint from the local snapshot right away, then refresh from Firestore
  const cached = readCache(user.uid);
  // Show the signed-in state at once; the tasks follow when Firestore answers
  emit('user', cached ? { user, ...cached, cached: true } : { user, tasks: [], profile: { n: '', k: [] }, cached: true, loading: true });
  try { emit('user', { user, ...await load(user) }); }
  catch (err) {
    console.error(err);
    if (!cached) emit('user', { user, tasks: [], profile: { n: '', k: [] } });
    loadedUid = null;
    emit('error', 'Could not load your data. Check Firestore rules.');
  }
});

window.DB = {
  save, u, setUsername, setCats, setAvatar, setCover, setPet, setFocus, setPetArt,
  token: () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
  get user() { return auth.currentUser; },
  signIn: () => signInWithPopup(auth, new GoogleAuthProvider(), browserPopupRedirectResolver).catch(e => { if (e.code !== 'auth/popup-closed-by-user') emit('error', 'Sign-in failed: ' + e.code); }),
  signOut: () => signOut(auth)
};
emit('ready', {});
// Warm up the sign-in popup helper while the browser is idle, so clicking Sign in opens the window instantly
(window.requestIdleCallback || setTimeout)(() => { try { browserPopupRedirectResolver._initialize(auth); } catch {} }, 2500);
