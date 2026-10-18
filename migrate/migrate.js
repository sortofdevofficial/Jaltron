// JALTRON one-time migration (run locally, never deployed):
//   moves each account's old task docs u/<uid>/t/<id> into the task map q on u/<uid>,
//   marks the account v: 2, then deletes the old docs. Accounts already on v: 2 are only
//   swept for leftover old docs, so the script is safe to run any number of times.
//
// Setup (once): Firebase console > Project settings > Service accounts > Generate new private key,
//   save it as migrate/key.json
//
// Run:
//   cd migrate
//   npm install
//   GOOGLE_APPLICATION_CREDENTIALS=key.json node migrate.js --dry-run   (report only)
//   GOOGLE_APPLICATION_CREDENTIALS=key.json node migrate.js             (real run)
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const dry = process.argv.includes('--dry-run');
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service-account key file (see the header of this file).');
  process.exit(1);
}

const db = getFirestore(initializeApp({ credential: applicationDefault() }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const counts = { accounts: 0, migrated: 0, cleaned: 0, marked: 0, claims: 0, skipped: 0, errors: 0 };

// Firestore batches allow 500 writes; stay under it
async function deleteAll(docs) {
  for (let i = 0; i < docs.length; i += 400) {
    const b = db.batch();
    docs.slice(i, i + 400).forEach((t) => b.delete(t.ref));
    if (!dry) await b.commit();
  }
}

let cursor = null;
while (true) {
  const page = await (cursor ? db.collection('u').startAfter(cursor).limit(500).get() : db.collection('u').limit(500).get());
  if (page.empty) break;
  for (const d of page.docs) {
    cursor = d;
    counts.accounts++;
    const data = d.data() || {};
    if ('u' in data) { counts.claims++; continue; } // username claim doc, not an account
    try {
      const old = await d.ref.collection('t').get();
      if (data.v === 2) { // already migrated: just sweep docs a stale old tab may have left behind
        if (old.size) {
          console.log(`${dry ? 'would sweep' : 'swept'} ${d.id}: ${old.size} leftover old task docs`);
          await deleteAll(old.docs);
          counts.cleaned++;
        }
        continue;
      }
      const q = {};
      old.docs.forEach((t) => { q[t.id] = t.data(); }); // already in packed form
      const kb = JSON.stringify(q).length / 1024;
      if (kb > 900) { // a Firestore doc cannot pass 1 MB; skip instead of corrupting the account
        console.log(`SKIP ${d.id}: q would be ${kb.toFixed(0)} KB. Split this account by hand.`);
        counts.skipped++;
        continue;
      }
      console.log(`${dry ? 'would migrate' : 'migrated'} ${d.id}: ${old.size} tasks, ${kb.toFixed(1)} KB`);
      if (!dry) {
        await d.ref.set({ v: 2, q }, { merge: true });
        await deleteAll(old.docs);
        await sleep(50); // stay well under Firestore write quotas
      }
      old.size ? counts.migrated++ : counts.marked++;
    } catch (err) {
      counts.errors++;
      console.error(`ERROR ${d.id}:`, err.message);
    }
  }
}

console.log(`\n${dry ? 'Dry run: ' : 'Done. '}${counts.accounts} docs in u | ${counts.migrated} migrated | ${counts.marked} marked fresh | ${counts.cleaned} swept | ${counts.claims} username claims | ${counts.skipped} skipped | ${counts.errors} errors`);
