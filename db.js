// JALTRON cloud: Google sign-in + Firestore. Profile icon, email and name come from Auth, so they are not stored.
//   users/<uid>            { n: username, k: [custom categories] }
//   users/<uid>/tasks/<id> { t: title, p: h|m|l, c: category, d: due, x: done, o: order }
//   usernames/<name>       { u: uid }   (one doc per username, which is what keeps names unique)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, collection, getDoc, getDocs, setDoc, writeBatch, runTransaction, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyDlqQYIPue53vx1tpm7-DYYKMZB4OatiDg',
  authDomain: 'jaltron0.firebaseapp.com',
  projectId: 'jaltron0',
  storageBucket: 'jaltron0.firebasestorage.app',
  messagingSenderId: '934608488435',
  appId: '1:934608488435:web:6247557aea521bad96f486'
});
const auth = getAuth(app), db = getFirestore(app);

// Shortcut: u('tasks', 5) -> "users/<uid>/tasks/5", u() -> "users/<uid>"
const u = (...p) => ['users', auth.currentUser.uid, ...p].join('/');
const ref = (...p) => doc(db, u(...p));
const col = (name) => collection(db, u(name));

const emit = (type, detail) => dispatchEvent(new CustomEvent('jaltron:' + type, { detail }));
const P = { high: 'h', medium: 'm', low: 'l' }, PR = { h: 'high', m: 'medium', l: 'low' };
const pack = (t, o) => ({ t: t.title, p: P[t.prio] || 'm', c: t.tag, d: t.due || '', x: !!t.done, o });
const unpack = (id, d) => ({ id: Number(id), title: d.t, prio: PR[d.p] || 'medium', tag: d.c || 'General', due: d.d || '', done: !!d.x });
let synced = new Map(), timer = null;

// Write only what changed (new, edited, reordered, deleted tasks), debounced
function save(tasks) {
  const user = auth.currentUser;
  if (!user) return;
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
        for (const [k, id, data] of ops.slice(i, i + 400)) k === 'set' ? b.set(ref('tasks', id), data) : b.delete(ref('tasks', id));
        await b.commit();
      }
      synced = next;
    } catch (err) { console.error(err); emit('error', 'Could not save to the cloud. Check your connection.'); }
  }, 500);
}

// Claim a username atomically: fails with "taken" if another account owns it
const NAME_RE = /^[a-z0-9_]{3,20}$/;
async function setUsername(name) {
  name = String(name).trim().toLowerCase();
  if (!NAME_RE.test(name)) throw new Error('invalid');
  const uid = auth.currentUser.uid, nref = doc(db, 'usernames', name), me = ref();
  await runTransaction(db, async (tx) => {
    const [n, m] = await Promise.all([tx.get(nref), tx.get(me)]);
    if (n.exists() && n.data().u !== uid) throw new Error('taken');
    const old = m.exists() ? m.data().n : '';
    if (old && old !== name) tx.delete(doc(db, 'usernames', old));
    tx.set(nref, { u: uid });
    tx.set(me, { n: name }, { merge: true });
  });
  return name;
}

async function setCats(k) {
  try { await setDoc(ref(), { k }, { merge: true }); }
  catch (err) { console.error(err); emit('error', 'Could not save categories.'); }
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
  const snap = await getDoc(ref());
  const d = snap.exists() ? snap.data() : {};
  const profile = { n: d.n || await claim(user), k: Array.isArray(d.k) ? d.k : [] };
  const docs = await getDocs(query(col('tasks'), orderBy('o')));
  const tasks = docs.docs.map(x => unpack(x.id, x.data()));
  synced = new Map(tasks.map((t, o) => [String(t.id), JSON.stringify(pack(t, o))]));
  return { tasks, profile };
}

onAuthStateChanged(auth, async (user) => {
  synced = new Map();
  if (!user) return emit('user', { user: null, tasks: [], profile: { n: '', k: [] } });
  try { emit('user', { user, ...await load(user) }); }
  catch (err) { console.error(err); emit('user', { user, tasks: [], profile: { n: '', k: [] } }); emit('error', 'Could not load your data. Check Firestore rules.'); }
});

window.DB = {
  save, u, setUsername, setCats,
  get user() { return auth.currentUser; },
  signIn: () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => { if (e.code !== 'auth/popup-closed-by-user') emit('error', 'Sign-in failed: ' + e.code); }),
  signOut: () => signOut(auth)
};
emit('ready', {});
