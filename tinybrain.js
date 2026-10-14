// TinyBrain: a small neural network trained from scratch on characters.
// Text -> hashed character n-grams (letters, digits, special characters) -> hidden layer -> intent.
// No libraries, no downloads. It trains in your browser each time the page loads.
(function (root) {
  'use strict';
  const DIM = 4096, HID = 128, EPOCHS = 16;
  const BASE = ['add', 'complete', 'delete', 'reopen', 'prio', 'due', 'tag', 'search', 'breakdown', 'plan', 'first', 'summary', 'overdue', 'optimize', 'clear_done', 'complete_all', 'help', 'greet', 'thanks', 'motivate', 'chat', 'unknown'];
  let INTENTS = BASE.slice(), K = INTENTS.length;
  let W1, b1, W2, b2, ready = false, seed = 1;

  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const norm = (t) => ' ' + String(t).toLowerCase().replace(/\d+/g, '0').replace(/\s+/g, ' ').trim() + ' ';
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % DIM; }

  // Character n-grams (1 to 4) plus whole words, hashed into DIM slots
  function feats(text) {
    const s = norm(text), set = new Set();
    for (let n = 1; n <= 4; n++) for (let i = 0; i + n <= s.length; i++) set.add(hash(n + s.slice(i, i + n)));
    for (const w of s.split(' ')) if (w) set.add(hash('w' + w));
    return Array.from(set);
  }

  function init() {
    W1 = new Float32Array(DIM * HID).map(() => (rnd() - 0.5) * 0.2);
    W2 = new Float32Array(K * HID).map(() => (rnd() - 0.5) * 0.4);
    b1 = new Float32Array(HID); b2 = new Float32Array(K);
  }
  function forward(ix, T) {
    const sc = 1 / Math.sqrt(ix.length || 1), h = new Float32Array(HID), z = new Float32Array(K);
    for (const i of ix) { const o = i * HID; for (let j = 0; j < HID; j++) h[j] += W1[o + j] * sc; }
    for (let j = 0; j < HID; j++) h[j] = Math.tanh(h[j] + b1[j]);
    let mx = -1e9;
    for (let k = 0; k < K; k++) { let s = b2[k]; const o = k * HID; for (let j = 0; j < HID; j++) s += W2[o + j] * h[j]; s /= (T || 1); z[k] = s; if (s > mx) mx = s; }
    let sum = 0;
    for (let k = 0; k < K; k++) { z[k] = Math.exp(z[k] - mx); sum += z[k]; }
    for (let k = 0; k < K; k++) z[k] /= sum;
    return { h, p: z, sc };
  }
  function step(ix, y, lr) {
    const { h, p, sc } = forward(ix), dh = new Float32Array(HID);
    for (let k = 0; k < K; k++) {
      const g = p[k] - (k === y ? 1 : 0), o = k * HID;
      for (let j = 0; j < HID; j++) { dh[j] += W2[o + j] * g; W2[o + j] -= lr * g * h[j]; }
      b2[k] -= lr * g;
    }
    for (let j = 0; j < HID; j++) { dh[j] *= 1 - h[j] * h[j]; b1[j] -= lr * dh[j]; }
    for (const i of ix) { const o = i * HID; for (let j = 0; j < HID; j++) W1[o + j] -= lr * dh[j] * sc; }
  }

  // Make typos, slang and special characters so the net copes with messy text
  function noisy(s) {
    let t = s;
    const r = rnd();
    if (t.length > 4) {
      const i = 1 + Math.floor(rnd() * (t.length - 2));
      if (r < 0.25) t = t.slice(0, i) + t.slice(i + 1);
      else if (r < 0.5) t = t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2);
      else if (r < 0.7) t = t.slice(0, i) + t[i] + t.slice(i);
    }
    if (rnd() < 0.3) t = pick(['bro ', 'pls ', 'hey ', 'yo ', 'ok ', 'can you ']) + t;
    if (rnd() < 0.3) t += pick([' lol', ' pls', '!', '?!', ' asap', ' :)', '...']);
    return t;
  }

  function build(cfg, extra) {
    const out = [], fill = (t) => t.replace(/\{(\w+)\}/g, (_, k) => pick(cfg.slots[k] || ['thing']));
    for (const [intent, list] of Object.entries(cfg.templates)) for (const t of list) {
      const reps = t.includes('{') ? 3 : 1;
      for (let r = 0; r < reps; r++) out.push([fill(t), intent, false]);
    }
    for (const k of root.KNOWLEDGE || []) for (const ph of k.phrases) for (let r = 0; r < 4; r++) out.push([ph, 'k_' + k.id, false]);
    for (const [t, i] of cfg.examples || []) for (let r = 0; r < 4; r++) out.push([t, i, false]);
    for (const e of extra || []) for (let r = 0; r < 8; r++) out.push([e.text, e.intent, true]);
    // Gibberish and special-character noise teach the net to say "I don't know"
    const L = 'abcdefghijklmnopqrstuvwxyz', SP = '!?#@$%&*()-_=+[]{};:/<>~';
    for (let n = 0; n < 70; n++) {
      let g = ''; const len = 2 + Math.floor(rnd() * 12);
      for (let c = 0; c < len; c++) g += rnd() < 0.15 ? SP[Math.floor(rnd() * SP.length)] : L[Math.floor(rnd() * 26)];
      out.push([g, 'unknown', false]);
    }
    const aug = [];
    for (const [t, i, tg] of out) if (rnd() < 0.6) aug.push([noisy(t), i, tg]);
    return out.concat(aug);
  }

  async function train(extra, onProgress) {
    seed = 7; ready = false;
    INTENTS = BASE.concat((root.KNOWLEDGE || []).map(k => 'k_' + k.id)); K = INTENTS.length;
    init();
    const all = build(root.TRAIN, extra).map(([t, i, tg]) => ({ ix: feats(t), y: INTENTS.indexOf(i), tg })).filter(d => d.y >= 0);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const hold = [], tr = [];
    for (const d of all) (!d.tg && hold.length < all.length * 0.12 ? hold : tr).push(d);
    for (let ep = 0; ep < EPOCHS; ep++) {
      const lr = 0.6 * (1 - ep / (EPOCHS * 1.2));
      for (let i = tr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [tr[i], tr[j]] = [tr[j], tr[i]]; }
      for (const d of tr) step(d.ix, d.y, lr);
      if (onProgress) onProgress(ep + 1, EPOCHS);
      await new Promise(r => setTimeout(r, 0)); // keep the page responsive
    }
    let ok = 0;
    for (const d of hold) { const p = forward(d.ix).p; if (p.indexOf(Math.max(...p)) === d.y) ok++; }
    ready = true;
    return { examples: all.length, acc: hold.length ? ok / hold.length : 1 };
  }

  function predict(text) {
    if (!ready) return null;
    const p = forward(feats(text), 2.5).p; // temperature keeps confidence honest
    let b = 0; for (let k = 1; k < K; k++) if (p[k] > p[b]) b = k;
    return { intent: INTENTS[b], conf: p[b] };
  }

  const api = { get INTENTS() { return INTENTS; }, train, predict, get ready() { return ready; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TinyBrain = api;
})(typeof window !== 'undefined' ? window : globalThis);