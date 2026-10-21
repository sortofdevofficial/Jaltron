'use strict';
// JALTRON knowledge engine: no model, no API key. Fetches public sources, composes cited answers.
const http = require('http');
const UA = 'JaltronKB/1.0 (self-hosted knowledge assistant)';
const PORT = +process.env.SERVER_PORT || +process.env.PORT || 11904;
const enc = encodeURIComponent;
const uniq = (a) => [...new Set(a)];
const num = (n) => Number(n).toLocaleString('en-US');
const STOP = new Set('a an the i me my you your it this that these those to on in for of and or is are was were be been do does did have has had can could would should will just please pls bro hey yo ok okay so if then than there here what which who how why when where all any some no not'.split(' '));
const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)).map((w) => (w.length > 4 ? w.replace(/(?:ing|ed|es|s)$/, '') : w));
const key = (s) => uniq(words(s)).sort().join(' ');
const clean = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
const ent = (s) => { let x = String(s || '').replace(/[?.!,;:]+$/, '').replace(/^the\s+/i, '').trim(); return ({ us: 'United States', usa: 'United States', 'u.s.': 'United States', uk: 'United Kingdom', uae: 'United Arab Emirates' })[x.toLowerCase()] || x; };

const ROUTES = [
  [/(?:^|\b)(?:what(?:'s| is) )?(?:the )?capital of (.+)$/i, 'capital'],
  [/^(.+?)'s capital$/i, 'capital'],
  [/^(.+?) capital$/i, 'capital'],
  [/(?:^|\b)(?:what(?:'s| is) )?(?:the )?population of (.+)$/i, 'population'],
  [/^how many people (?:live|are there) in (.+)$/i, 'population'],
  [/^(?:what(?:'s| is) )?(?:the )?(?:currency|money) (?:of|in) (.+)$/i, 'currency'],
  [/^what currency (?:does|do) (.+?) use$/i, 'currency'],
  [/^(?:what(?:'s| is) )?(?:the )?area of (.+)$/i, 'area'],
  [/^when (?:was|were) (.+?) born$/i, 'birth'],
  [/^where (?:was|were) (.+?) born$/i, 'birthplace'],
  [/^when did (.+?) die$/i, 'death'],
  [/^how (?:tall|high) is (.+)$/i, 'height'],
  [/^who (?:wrote|is the author of) (.+)$/i, 'author'],
  [/^who (?:directed|is the director of) (.+)$/i, 'director'],
  [/^who is the (?:president|prime minister) of (.+)$/i, 'leader'],
  [/^define (.+)$/i, 'define'],
  [/^(?:what (?:is|does) )?(?:the )?(?:meaning|definition) of (.+)$/i, 'define'],
  [/^(?:what(?:'s| is) )?(?:a |an )?(synonym|antonym|rhyme)s? (?:of|for) (.+)$/i, 'wordrel'],
  [/(?:^|\b)(?:the )?weather (?:in|for|at) (.+)$/i, 'weather'],
  [/^(?:what(?:'s| is) )?the weather(?: like)?(?: in| for| at)? ?(.*)$/i, 'weather'],
  [/^(?:what(?:'s| is) )?(?:the )?time (?:in|at) (.+)$/i, 'time'],
  [/(?:^|\b)(?:convert )?(-?\d[\d,.]*)\s*([a-z]{3})\s+(?:to|in|into)\s+([a-z]{3})\b/i, 'fx'],
  [/^(usd|eur|gbp|jpy|cad|aud|chf|cny|inr)\s+(?:to|in)\s+(usd|eur|gbp|jpy|cad|aud|chf|cny|inr)$/i, 'fx2'],
  [/^(?:what(?:'s| is) )?(?:the )?(?:price|worth|value) of (bitcoin|btc|ethereum|eth)\b/i, 'crypto'],
  [/\b(bitcoin|btc|ethereum|eth)\s+(?:price|worth|value)/i, 'crypto'],
  [/^(?:what(?:'s| is) )?(?:the )?difference between (.+?) (?:and|vs\.?|versus) (.+)$/i, 'compare'],
  [/^compare (.+?) (?:and|vs\.?|with|to) (.+)$/i, 'compare'],
  [/^(.+?) (?:vs\.?|versus) (.+)$/i, 'compare'],
  [/^(?:give me |tell me )?(\d+|a few|some)? ?facts about (.+)$/i, 'facts'],
  [/^quiz me (?:on|about) (.+)$/i, 'quiz'],
  [/^(?:book|novel)(?: about)? (.+)$/i, 'book'],
  [/^(?:paper|study|research) (?:on|about) (.+)$/i, 'paper'],
  [/^country (.+)$/i, 'country'],
  [/\b(?:error|exception|traceback|typeerror|syntaxerror|npm|webpack)\b/i, 'code'],
  [/\b(?:javascript|typescript|python|java|c\+\+|node\.?js|react|css|html|sql|regex)\b.*\b(?:fix|debug|not working|broken|fails?|error)\b/i, 'code'],
  [/^how (?:far|old|big|long|heavy|deep|fast) (?:is|are|was|were) (.+)$/i, 'wiki'],
  [/^(?:tell me about|what (?:is|was|are|were)|explain|describe) (.+)$/i, 'wiki'],
  [/^who (?:is|was) (.+)$/i, 'wiki'],
  [/^(?:why|how) (?:is|are|was|were|does|do|did|can|could|would) (.+)$/i, 'wiki'],
  [/^(?:why|how) (.+)$/i, 'wiki'],
  [/^(.+)$/i, 'wiki']
];

function route(q) {
  const s = String(q || '').trim().replace(/[?!.]+$/, '');
  for (const [re, intent] of ROUTES) {
    const m = s.match(re);
    if (m) return { intent, a: ent(m[1]), b: ent(m[2]), c: ent(m[3]), q: s };
  }
  return null;
}

function follow(text, ctx) {
  const t = String(text || '').trim();
  if (!ctx || !ctx.entity) {
    const m = t.match(/^what about (.+)$/i);
    return m ? 'tell me about ' + m[1] : t;
  }
  const m = t.match(/^(?:and )?what about (.+)$/i);
  if (m) {
    const e = ent(m[1]), i = ctx.intent;
    return { capital: `capital of ${e}`, population: `population of ${e}`, currency: `currency of ${e}`, area: `area of ${e}`, height: `how tall is ${e}`, birth: `when was ${e} born`, weather: `weather in ${e}`, time: `time in ${e}`, country: `country ${e}`, book: `book ${e}` }[i] || `who is ${e}`;
  }
  if (/\b(?:he|she|it|they|him|her|them|his|hers|its|their)\b/i.test(t))
    return t.replace(/\b(his|hers|its|their)\b/gi, ctx.entity + "'s").replace(/\bit\b(?!\s+(?:true|possible|likely|fair|good|bad|seem|rain|snow|cold|hot|worth|safe|legal)\b)/gi, ctx.entity).replace(/\b(he|she|they|him|her|them)\b/gi, ctx.entity);
  return t;
}

async function get(url, ms = 4000) {
  const c = new AbortController(), timer = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'user-agent': UA, accept: 'application/json' } });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}
const safe = (p) => Promise.resolve(p).catch(() => null);

const W = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2&utf8=1&origin=*';
const wSearch = async (q) => { const x = (await get(`${W}&action=query&list=search&srsearch=${enc(q)}&srlimit=4&srinfo=suggestion`)).query || {}; return { list: x.search || [], sug: (x.searchinfo && x.searchinfo.suggestion) || '' }; };
const wSuggest = async (q) => ((await get(`${W}&action=opensearch&search=${enc(q)}&limit=1`))[1] || [])[0] || '';
const wIntro = async (t) => { const p = ((await get(`${W}&action=query&prop=extracts&explaintext=1&exintro=1&titles=${enc(t)}&redirects=1`)).query || {}).pages || []; return (p[0] || {}).extract || ''; };
const wSections = async (t) => ((await get(`${W}&action=parse&page=${enc(t)}&prop=sections&redirects=1`)).parse || {}).sections || [];
const wSection = async (t, i) => { const x = ((await get(`${W}&action=parse&page=${enc(t)}&prop=text&section=${i}&redirects=1`)).parse || {}).text; return typeof x === 'string' ? x : (x && x['*']) || ''; };
const wUrl = (t) => 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(t).replace(/ /g, '_'));

const BAD = /^(references|see also|external links|notes|bibliography|further reading|citations|sources|footnotes)$/i;
const GOOD = /(overview|background|history|causes?|explanation|mechanism|operation|principle|working|science|description|examples?|uses|applications|effects?|significance|process|definition)/i;
function pickSection(secs, q) {
  const qw = new Set(words(q)), ql = String(q || '').toLowerCase();
  const wantsHow = /\b(?:work|works|working|happen|happens|operate|operates)\b/.test(ql);
  const wantsWhy = /\b(?:why|cause|causes|reason)\b/.test(ql);
  let best = null, bs = 0;
  for (const s of secs || []) {
    const title = s.line || '';
    if (!title || BAD.test(title)) continue;
    let score = 0;
    for (const w of words(title)) if (qw.has(w)) score += 3;
    if (GOOD.test(title)) score += 2;
    if (+s.toclevel === 2) score += 1;
    if (wantsHow && /mechanism|operation|working|process|principle/i.test(title)) score += 3;
    if (wantsWhy && /cause|reason|explanation|origin/i.test(title)) score += 3;
    if (score >= bs && score > 0) { bs = score; best = s; }
  }
  return best;
}
const ABBR = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e|U\.S|U\.K|No)\./g;
function sentences(text) {
  return String(text || '').replace(ABBR, (m) => m.replace(/\./g, '§')).split(/(?<=[.!?])\s+/).map((s) => s.replace(/§/g, '.').trim()).filter(Boolean);
}
function pickSentences(text, q, n = 4) {
  const qw = new Set(words(q)), seen = new Set(), all = [];
  sentences(text).forEach((s, i) => {
    if (s.length < 35 || s.length > 300) return;
    const k = key(s).split(' ').slice(0, 6).join(' ');
    if (seen.has(k)) return;
    seen.add(k);
    let x = 0;
    const sw = new Set(words(s));
    for (const t of qw) if (sw.has(t)) x += 2;
    if (i === 0) x += 1.5;
    if (s.length >= 50 && s.length <= 240) x += 1;
    if (/^\(|^\s*(?:==|\[)/.test(s)) x -= 2;
    if ((s.match(/\(/g) || []).length > 2) x -= 1;
    all.push({ s, i, x });
  });
  all.sort((a, b) => b.x - a.x);
  return all.slice(0, Math.max(1, n)).sort((a, b) => a.i - b.i).map((x) => x.s).join(' ').slice(0, 900);
}
function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<span class="mw-editsection"[\s\S]*?<\/span>/gi, ' ').replace(/<sup[^>]*class="[^"]*reference[^"]*"[\s\S]*?<\/sup>/gi, ' ')
    .replace(/<table[\s\S]*?<\/table>/gi, ' ').replace(/<\/(?:p|div|li|h\d|tr)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\n{2,}/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}
function dateText(v) {
  const m = /^\+?(-?\d{4,})-(\d{2})-(\d{2})/.exec((v && v.time) || '');
  if (!m) return '';
  const months = 'January February March April May June July August September October November December'.split(' ');
  return `${+m[3]} ${months[+m[2] - 1]} ${+m[1]}`;
}

const WD = 'https://www.wikidata.org/w/api.php?format=json&formatversion=2&origin=*';
const wdSearch = async (q) => ((await get(`${WD}&action=wbsearchentities&search=${enc(q)}&language=en&limit=3`)).search || []).map((x) => ({ id: x.id, label: x.label, desc: x.description || '' }));
const wdEntity = async (id) => ((await get(`${WD}&action=wbgetentities&ids=${id}&props=claims%7Clabels%7Cdescriptions&languages=en`)).entities || {})[id];
async function wdLabels(ids) {
  const out = {};
  if (!ids.length) return out;
  const j = await get(`${WD}&action=wbgetentities&ids=${ids.slice(0, 20).join('|')}&props=labels&languages=en&languagefallback=1`);
  for (const id in (j.entities || {})) { const e = j.entities[id]; out[id] = (e.labels && e.labels.en && e.labels.en.value) || id; }
  return out;
}
const claims = (e, p) => (e && e.claims && e.claims[p]) || [];
const claim = (e, p, all) => { const a = claims(e, p).filter((c) => c.mainsnak && c.mainsnak.datavalue); const live = a.filter((c) => c.rank !== 'deprecated'); const list = live.length ? live : a; return all ? list : list.find((c) => c.rank === 'preferred') || list[list.length - 1]; };
const dv = (c) => c && c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value;
const refs = (e, p) => claim(e, p, true).map(dv).filter((v) => v && v.id).map((v) => v.id);
// Historical values carry an end time (P582); sub-territory ones carry P518 (e.g. CFP franc in France)
const liveRefs = (e, p) => {
  const live = claim(e, p, true).filter((c) => !(c.qualifiers && c.qualifiers.P582));
  const whole = live.filter((c) => !(c.qualifiers && c.qualifiers.P518));
  return uniq((whole.length ? whole : live).map(dv).filter((v) => v && v.id).map((v) => v.id));
};
const ref = (e, p) => { const v = dv(claim(e, p)); return v && v.id; };

async function fact(intent, name) {
  if (!name) return null;
  const hit = (await wdSearch(name))[0];
  if (!hit) return null;
  const e = await wdEntity(hit.id);
  if (!e) return null;
  const need = new Set(), collect = (a) => a.forEach((x) => need.add(x));
  let make = null;
  if (intent === 'capital') { const a = liveRefs(e, 'P36'); collect(a); make = (L) => a.length ? `${hit.label} ${a.length > 1 ? 'has capitals' : 'has its capital in'} ${a.map(L).join(', ')}.` : ''; }
  else if (intent === 'population') { const c = claim(e, 'P1082'), v = dv(c); if (v && v.amount != null) { const q = c.qualifiers && c.qualifiers.P585 && c.qualifiers.P585[0]; const d = q && dateText(q.datavalue && q.datavalue.value); make = () => `${hit.label} has a population of about ${num(v.amount)}${d ? ` (${d})` : ''}.`; } }
  else if (intent === 'currency') { const a = liveRefs(e, 'P38'); collect(a); make = (L) => a.length ? `${hit.label} uses ${a.map(L).join(' and ')}.` : ''; }
  else if (intent === 'area') { const v = dv(claim(e, 'P2046')); if (v && v.amount != null) make = () => `${hit.label} covers about ${num(Math.round(+v.amount))} km².`; }
  else if (intent === 'height') { const v = dv(claim(e, 'P2048')); if (v && v.amount != null) { const m = +v.amount, ft = m * 3.28084; make = () => `${hit.label} is about ${m.toFixed(2)} m (${Math.floor(ft)} ft ${Math.round((ft % 1) * 12)} in).`; } }
  else if (intent === 'birth' || intent === 'birthplace') { const b = dv(claim(e, 'P569')), p = ref(e, 'P19'); if (p) collect([p]); const bd = b && dateText(b); make = (L) => intent === 'birth' ? `${hit.label} was born on ${bd || 'an unknown date'}${p ? ` in ${L(p)}` : ''}.` : `${hit.label} was born in ${p ? L(p) : 'an unknown place'}${bd ? `, on ${bd}` : ''}.`; }
  else if (intent === 'death') { const d = dv(claim(e, 'P570')), dd = d && dateText(d); make = () => dd ? `${hit.label} died on ${dd}.` : ''; }
  else if (intent === 'author' || intent === 'director') { const p = intent === 'author' ? 'P50' : 'P57', a = refs(e, p), who = intent === 'author' ? 'wrote' : 'directed'; collect(a); make = (L) => a.length ? `${hit.label} was ${who} by ${a.map(L).join(', ')}.` : ''; }
  else if (intent === 'leader') { const a = uniq([...liveRefs(e, 'P35'), ...liveRefs(e, 'P6')]); collect(a); make = (L) => a.length ? `The head of state or government of ${hit.label} is ${a.map(L).join(' / ')}.` : ''; }
  else if (intent === 'country') { const cap = liveRefs(e, 'P36'), cur = liveRefs(e, 'P38'), lang = refs(e, 'P37'); collect([...cap, ...cur, ...lang]); const ar = dv(claim(e, 'P2046')), po = dv(claim(e, 'P1082')), area = ar && ar.amount != null ? Math.round(+ar.amount) : 0, pop = po && po.amount != null ? Math.round(+po.amount) : 0; make = (L) => { const bits = []; if (cap.length) bits.push(`capital ${cap.map(L).join(', ')}`); if (pop) bits.push(`population about ${num(pop)}`); if (area) bits.push(`area ${num(area)} km²`); if (cur.length) bits.push(`currency ${cur.map(L).join(', ')}`); if (lang.length) bits.push(`languages ${lang.map(L).join(', ')}`); return bits.length ? `${hit.label}: ${bits.join('; ')}.` : ''; }; }
  if (!make) return null;
  const labels = await wdLabels([...need]), L = (x) => labels[x] || x;
  const reply = make(L);
  if (!reply) return null;
  return { reply, sources: [`https://www.wikidata.org/wiki/${hit.id}`, wUrl(hit.label)], entity: hit.label, intent };
}

async function wikiAnswer(q, mode) {
  const first = (await safe(wSearch(q))) || { list: [], sug: '' };
  let results = first.list, corrected = '';
  if (first.sug) {
    const s2 = await safe(wSearch(first.sug));
    if (s2 && s2.list.length) {
      results = s2.list; corrected = first.sug;
      // After a spelling fix, prefer pages whose title words all come from the question
      const qw = new Set(words(first.sug)), full = results.filter((r) => { const tw = words(r.title); return tw.length && tw.every((w) => qw.has(w)); });
      if (full.length) results = full;
    }
  } else if (!results.length) {
    const s = await safe(wSuggest(q));
    if (s && s.toLowerCase() !== q.toLowerCase()) {
      const s2 = await safe(wSearch(s));
      if (s2) { results = s2.list; corrected = s; }
    }
  }
  for (const r of results.slice(0, 3)) {
    if (!r.title || /disambiguation/i.test(r.title)) continue;
    const intro = await safe(wIntro(r.title));
    if (!intro) continue;
    let text = intro;
    if (mode === 'explain' || mode === 'facts' || mode === 'quiz') {
      const sec = pickSection(await safe(wSections(r.title)) || [], q);
      if (sec) { const body = htmlToText(await safe(wSection(r.title, sec.index)) || ''); if (body) text = intro + '\n' + body; }
    }
    const picked = pickSentences(text, q, mode === 'facts' ? 5 : mode === 'quiz' ? 3 : 4);
    if (picked) return { title: r.title, text: picked, url: wUrl(r.title), corrected };
  }
  return null;
}
async function wiki(q, mode) {
  if (!q) return null;
  const w = await wikiAnswer(q, mode);
  if (!w) return null;
  return { reply: (w.corrected ? `(Showing results for "${w.corrected}".)\n` : '') + w.text, sources: [w.url], entity: w.title, intent: mode === 'explain' ? 'wiki' : mode };
}
async function facts(q, n) {
  const w = await wikiAnswer(q, 'facts');
  if (!w) return null;
  const list = sentences(w.text).slice(0, Math.min(5, Math.max(2, n || 4)));
  return { reply: `${w.title}:\n${list.map((s, i) => `${i + 1}. ${s}`).join('\n')}`, sources: [w.url], entity: w.title, intent: 'facts' };
}
async function quiz(q) {
  const w = await wikiAnswer(q, 'quiz');
  if (!w) return null;
  const list = sentences(w.text).slice(0, 3);
  if (!list.length) return null;
  const qs = [], ans = [];
  for (const s of list) {
    const ws = s.split(/\s+/);
    let idx = -1, len = 0;
    ws.forEach((x, i) => { const w2 = x.replace(/[^A-Za-z0-9-]/g, ''); if (w2.length > len && w2.length > 4) { len = w2.length; idx = i; } });
    if (idx < 0) { qs.push(s); ans.push('—'); continue; }
    const raw = ws[idx].replace(/[^A-Za-z0-9-]/g, '');
    qs.push(ws.map((x, i) => (i === idx ? x.replace(raw, '_____') : x)).join(' '));
    ans.push(raw);
  }
  return { reply: `Quiz: ${w.title}\n${qs.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nAnswers: ${ans.map((a, i) => `${i + 1}) ${a}`).join(' ')}`, sources: [w.url], entity: w.title, intent: 'quiz' };
}
async function compare(a, b) {
  if (!a || !b) return null;
  const [fa, fb] = await Promise.all([safe(fact('country', a)), safe(fact('country', b))]);
  if (fa && fb) return { reply: `${fa.reply}\n${fb.reply}`, sources: uniq([...(fa.sources || []), ...(fb.sources || [])]).slice(0, 3), entity: `${fa.entity} / ${fb.entity}`, intent: 'compare' };
  const [wa, wb] = await Promise.all([safe(wiki(a, 'wiki')), safe(wiki(b, 'wiki'))]);
  if (wa && wb) return { reply: `${a}: ${wa.reply}\n\n${b}: ${wb.reply}`, sources: uniq([...(wa.sources || []), ...(wb.sources || [])]).slice(0, 3), entity: `${wa.entity} / ${wb.entity}`, intent: 'compare' };
  return null;
}
async function define(word) {
  const j = await get(`https://api.dictionaryapi.dev/api/v2/entries/en/${enc(word)}`);
  const e = Array.isArray(j) ? j[0] : null, m = e && e.meanings && e.meanings[0], d = m && m.definitions && m.definitions[0];
  if (!d) return null;
  return { reply: `${e.word} (${m.partOfSpeech}): ${d.definition}${d.example ? ` Example: ${d.example}` : ''}`, sources: [`https://en.wiktionary.org/wiki/${enc(word)}`], entity: e.word, intent: 'define' };
}
async function wordrel(type, word) {
  const rel = /^syn/i.test(type) ? 'rel_syn' : /^ant/i.test(type) ? 'rel_ant' : 'rel_rhy';
  const list = ((await get(`https://api.datamuse.com/words?${rel}=${enc(word)}&max=6`)) || []).map((x) => x.word).filter(Boolean);
  if (!list.length) return null;
  return { reply: `${rel === 'rel_syn' ? 'Synonyms' : rel === 'rel_ant' ? 'Antonyms' : 'Rhymes'} for "${word}": ${list.join(', ')}.`, sources: [`https://en.wiktionary.org/wiki/${enc(word)}`], entity: word, intent: 'wordrel' };
}
const WMO = { 0: 'clear', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'heavy freezing rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains', 80: 'rain showers', 81: 'rain showers', 82: 'heavy rain showers', 85: 'snow showers', 86: 'heavy snow showers', 95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with heavy hail' };
async function geo(place) { return ((await get(`https://geocoding-api.open-meteo.com/v1/search?name=${enc(place)}&count=1&language=en&format=json`)).results || [])[0]; }
async function weather(place) {
  if (!place) return { reply: 'Weather where? Try "weather in London".', sources: [], kind: 'weather' };
  const g = await geo(place);
  if (!g) return null;
  const w = await get(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`);
  const c = w.current || {}, d = w.daily || {}, max = d.temperature_2m_max && d.temperature_2m_max[0], min = d.temperature_2m_min && d.temperature_2m_min[0], rain = d.precipitation_probability_max && d.precipitation_probability_max[0];
  return { reply: `${g.name}: ${c.temperature_2m}°C, ${WMO[c.weather_code] || 'unknown'}, wind ${c.wind_speed_10m} km/h. Today ${min}–${max}°C${rain != null ? `, ${rain}% chance of rain` : ''}.`, sources: ['https://open-meteo.com/'], entity: g.name, intent: 'weather', kind: 'weather' };
}
async function time(place) {
  if (!place) return { reply: 'Time where? Try "time in Tokyo".', sources: [], kind: 'time' };
  const g = await geo(place);
  if (!g || !g.timezone) return null;
  const s = new Intl.DateTimeFormat('en-GB', { timeZone: g.timezone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  return { reply: `It is ${s} in ${g.name} (${g.timezone}).`, sources: ['https://open-meteo.com/'], entity: g.name, intent: 'time', kind: 'time' };
}
async function fx(amount, from, to) {
  const a = +String(amount || 1).replace(/,/g, '') || 1, f = String(from || '').toUpperCase(), t = String(to || '').toUpperCase();
  const j = await get(`https://api.frankfurter.dev/v1/latest?amount=${a}&from=${enc(f)}&to=${enc(t)}`);
  const v = j.rates && j.rates[t];
  if (v == null) return null;
  return { reply: `${num(a)} ${f} = ${num(v)} ${t} (ECB rate, ${j.date}).`, sources: ['https://frankfurter.dev/'], entity: `${f}/${t}`, intent: 'fx', kind: 'fx' };
}
async function crypto(q) {
  const id = /btc|bitcoin/i.test(q) ? 'bitcoin' : 'ethereum';
  const x = (await get(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,eur&include_24hr_change=true`))[id];
  if (!x) return null;
  const ch = x.usd_24h_change != null ? ` (${x.usd_24h_change >= 0 ? '+' : ''}${x.usd_24h_change.toFixed(2)}% 24h)` : '';
  return { reply: `${id[0].toUpperCase() + id.slice(1)} is $${num(Math.round(x.usd))} / €${num(Math.round(x.eur))}${ch}.`, sources: ['https://www.coingecko.com/'], entity: id, intent: 'crypto', kind: 'crypto' };
}
async function book(q) {
  const d = ((await get(`https://openlibrary.org/search.json?q=${enc(q)}&limit=1&fields=title,author_name,first_publish_year,key,subject`)).docs || [])[0];
  if (!d || !d.title) return null;
  const a = (d.author_name || []).slice(0, 2).join(', '), s = (d.subject || []).slice(0, 3).join(', ');
  return { reply: `${d.title}${a ? ` by ${a}` : ''}${d.first_publish_year ? ` (${d.first_publish_year})` : ''}.${s ? ` Subjects: ${s}.` : ''}`, sources: [`https://openlibrary.org${d.key}`], entity: d.title, intent: 'book' };
}
async function paper(q) {
  const it = ((await get(`https://api.crossref.org/works?query=${enc(q)}&rows=2&select=title,author,issued,DOI,container-title`)).message || {}).items[0];
  if (!it) return null;
  const t = (it.title && it.title[0]) || '';
  if (!t) return null;
  const a = (it.author || []).slice(0, 3).map((x) => x.family || x.name).filter(Boolean).join(', ');
  const y = it.issued && it.issued['date-parts'] && it.issued['date-parts'][0] && it.issued['date-parts'][0][0];
  const jr = (it['container-title'] || [])[0], doi = it.DOI;
  return { reply: `${t}${a ? ` — ${a}` : ''}${y ? ` (${y})` : ''}${jr ? `. ${jr}.` : ''}${doi ? ` DOI: ${doi}` : ''}`, sources: doi ? [`https://doi.org/${doi}`] : [], entity: t, intent: 'paper' };
}
async function code(q) {
  const s = String(q).replace(/\bhow (?:to|do i|can i) (?:fix|solve|debug|resolve)\s+/i, '').replace(/^(?:fix|debug|solve)\s+/i, '').replace(/:/g, ' ').trim() || q;
  const it = ((await get(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${enc(s)}&site=stackoverflow&pagesize=2&filter=withbody`)).items || [])[0];
  if (!it) return null;
  const body = htmlToText(it.body || '').slice(0, 500);
  return { reply: `${it.title}${body ? `\n${body}` : ''}`, sources: [it.link], entity: it.title, intent: 'code' };
}

const cache = new Map();
const TTL = { fact: 864e5, wiki: 864e5, define: 6048e5, wordrel: 6048e5, book: 6048e5, paper: 864e5, code: 36e5, compare: 864e5, facts: 864e5, quiz: 864e5, country: 864e5, leader: 6e5, weather: 6e5, fx: 3e5, crypto: 6e4, time: 0 };
function cached(kind, k) { const c = cache.get(k); if (!c) return null; if (c.exp < Date.now()) { cache.delete(k); return null; } return { ...c.v, cached: true }; }
function store(kind, k, v) { const ttl = kind in TTL ? TTL[kind] : TTL.fact; if (!ttl) return; if (cache.size >= 300) cache.delete(cache.keys().next().value); cache.set(k, { exp: Date.now() + ttl, v }); }
const routeKey = (r, q) => `${r.intent}|${key(q)}`;

async function ask(message, ctx) {
  const m = clean(message);
  if (!m) return { ok: false, error: 'empty' };
  const q = follow(m, ctx), r = route(q);
  if (!r) return { ok: false, error: 'not_found' };
  const ck = routeKey(r, q), hit = cached(r.intent, ck);
  if (hit) return { ok: true, ...hit };
  let out = null;
  try {
    switch (r.intent) {
      case 'capital': case 'population': case 'currency': case 'area': case 'height': case 'birth': case 'birthplace': case 'death': case 'leader': case 'country': out = await safe(fact(r.intent, r.a)); break;
      case 'author': out = (await safe(book(r.a))) || (await safe(fact('author', r.a))); break;
      case 'director': out = await safe(fact('director', r.a)); break;
      case 'define': out = (await safe(define(r.a))) || (await safe(wiki(r.a, 'wiki'))); break;
      case 'wordrel': out = await safe(wordrel(r.a, r.b)); break;
      case 'weather': out = await safe(weather(r.a)); break;
      case 'time': out = await safe(time(r.a)); break;
      case 'fx': out = await safe(fx(r.a, r.b, r.c)); break;
      case 'fx2': out = await safe(fx(1, r.a, r.b)); break;
      case 'crypto': out = await safe(crypto(q)); break;
      case 'compare': out = await safe(compare(r.a, r.b)); break;
      case 'facts': out = await safe(facts(r.b, parseInt(r.a, 10) || 4)); break;
      case 'quiz': out = await safe(quiz(r.a)); break;
      case 'book': out = await safe(book(r.a)); break;
      case 'paper': out = await safe(paper(r.a)); break;
      case 'code': out = await safe(code(q)); break;
      case 'wiki': out = await safe(wiki(q, /^(?:why|how)\b/i.test(q) ? 'explain' : 'wiki')); break;
    }
  } catch { out = null; }
  if (!out || !out.reply) return { ok: false, error: 'not_found' };
  const res = { ok: true, reply: out.reply.slice(0, 900), sources: (out.sources || []).filter((u) => /^https?:\/\//i.test(u)).slice(0, 3), kind: out.kind || r.intent, entity: out.entity || '', intent: out.intent || r.intent, cached: false };
  store(res.kind, ck, res);
  return res;
}

const hits = new Map();
function limit(id, n, ms) { const now = Date.now(); let a = hits.get(id); if (!a || a.reset < now) { a = { n: 0, reset: now + ms }; hits.set(id, a); } a.n++; return a.n <= n; }
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, 3e5).unref();
let active = 0; const queue = [];
function run(fn) { return new Promise((res, rej) => { const go = () => { active++; fn().then(res, rej).finally(() => { active--; const n = queue.shift(); if (n) n(); }); }; if (active < 4) go(); else if (queue.length < 20) queue.push(go); else rej(new Error('busy')); }); }
function withTimeout(p, ms) { return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); t.unref && t.unref(); p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); }); }); }

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  if (u.pathname === '/api/health') { res.end(JSON.stringify({ ok: true, service: 'jaltron-kb', version: 1 })); return; }
  if (u.pathname !== '/api/ask') { res.statusCode = 404; res.end('{"ok":false,"error":"not_found"}'); return; }
  const ip = (String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
  const cid = String(req.headers['x-client-id'] || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64) || ip;
  if (!limit('c:' + cid, 30, 6e5) || !limit('i:' + ip, 200, 36e5) || !limit('g:all', +process.env.DAILY_CAP || 3000, 864e5)) { res.statusCode = 429; res.end('{"ok":false,"error":"rate_limited"}'); return; }
  let body = '';
  if (req.method === 'GET') body = JSON.stringify({ message: u.searchParams.get('q') || '', context: {} });
  else if (req.method === 'POST') { for await (const chunk of req) { body += chunk; if (body.length > 32768) { res.statusCode = 413; res.end('{"ok":false,"error":"too_large"}'); return; } } }
  else { res.statusCode = 405; res.end('{"ok":false,"error":"method"}'); return; }
  let j = {};
  try { j = JSON.parse(body || '{}'); } catch { res.statusCode = 400; res.end('{"ok":false,"error":"bad_json"}'); return; }
  const msg = clean(j.message);
  if (!msg) { res.statusCode = 400; res.end('{"ok":false,"error":"empty"}'); return; }
  const ctx = j.context && typeof j.context === 'object' ? { entity: clean(j.context.entity).slice(0, 120), intent: clean(j.context.intent).slice(0, 30) } : {};
  const started = Date.now();
  try {
    const out = await run(() => withTimeout(ask(msg, ctx), 8000));
    if (!out.ok && out.error === 'busy') res.statusCode = 429;
    res.end(JSON.stringify(out));
    console.log(JSON.stringify({ status: out.ok ? 200 : 404, ms: Date.now() - started, kind: out.kind || '', chars: (out.reply || '').length }));
  } catch (e) {
    res.statusCode = e.message === 'busy' ? 429 : 502;
    res.end(JSON.stringify({ ok: false, error: e.message === 'busy' ? 'busy' : 'ai_unavailable' }));
    console.log(JSON.stringify({ status: res.statusCode, ms: Date.now() - started }));
  }
});
const start = () => server.listen(PORT, '0.0.0.0', () => console.log('jaltron-kb on ' + PORT + ' (node ' + process.version + ')'));
if (require.main === module) start();
module.exports = { route, follow, clean, ent, key, words, sentences, pickSentences, pickSection, htmlToText, dateText, claim, dv, refs, ref, fact, compare, define, wordrel, weather, time, fx, crypto, book, paper, code, ask, cached, store, limit, TTL, server, start };
