// JALTRON cloud: Google sign-in + Firestore. Each user's data lives under users/<uid>/...
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, collection, getDocs, setDoc, writeBatch, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

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
let synced = new Map(), timer = null;

// Write only what changed (new/edited/reordered tasks, deletions), debounced
function save(tasks) {
  const user = auth.currentUser;
  if (!user) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (auth.currentUser?.uid !== user.uid) return;
    const next = new Map(tasks.map((t, pos) => [String(t.id), JSON.stringify({ ...t, pos })]));
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

async function load(user) {
  await setDoc(ref(), { name: user.displayName || '', email: user.email || '', photo: user.photoURL || '', lastLogin: serverTimestamp() }, { merge: true });
  const snap = await getDocs(query(col('tasks'), orderBy('pos')));
  const tasks = snap.docs.map(d => { const { pos, ...t } = d.data(); return t; });
  synced = new Map(tasks.map((t, pos) => [String(t.id), JSON.stringify({ ...t, pos })]));
  return tasks;
}

onAuthStateChanged(auth, async (user) => {
  synced = new Map();
  if (!user) return emit('user', { user: null, tasks: [] });
  try { emit('user', { user, tasks: await load(user) }); }
  catch (err) { console.error(err); emit('user', { user, tasks: [] }); emit('error', 'Could not load your tasks. Check Firestore rules.'); }
});

window.DB = {
  save, u,
  get user() { return auth.currentUser; },
  signIn: () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => { if (e.code !== 'auth/popup-closed-by-user') emit('error', 'Sign-in failed: ' + e.code); }),
  signOut: () => signOut(auth)
};
emit('ready', {});