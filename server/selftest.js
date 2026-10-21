'use strict';
// Offline checks for the knowledge engine: node selftest.js
const assert = require('assert');
const k = require('./kb-server');
const tests = [];
const t = (name, fn) => tests.push([name, fn]);

t('route: structured facts', () => {
  const cases = [
    ['What is the capital of France?', 'capital', 'France'],
    ['What is the population of Tokyo?', 'population', 'Tokyo'],
    ['What currency does Japan use?', 'currency', 'Japan'],
    ["What's the area of Brazil?", 'area', 'Brazil'],
    ['When was Ada Lovelace born?', 'birth', 'Ada Lovelace'],
    ['Who wrote Dune?', 'author', 'Dune'],
    ['Who is the president of France?', 'leader', 'France'],
    ['country France', 'country', 'France']
  ];
  for (const [q, intent, a] of cases) {
    const r = k.route(q);
    assert.equal(r && r.intent, intent, q);
    assert.equal(r.a, a, q);
  }
});

t('route: utilities and reference', () => {
  const cases = [
    ['define serendipity', 'define', 'serendipity'],
    ['what is a synonym for happy', 'wordrel', 'synonym'],
    ['weather in London', 'weather', 'London'],
    ['time in Tokyo', 'time', 'Tokyo'],
    ['100 USD to EUR', 'fx', '100'],
    ['USD to EUR', 'fx2', 'USD'],
    ['compare France and Germany', 'compare', 'France'],
    ['tell me 3 facts about the moon', 'facts', '3'],
    ['quiz me on photosynthesis', 'quiz', 'photosynthesis'],
    ['book Dune', 'book', 'Dune'],
    ['paper on black holes', 'paper', 'black holes'],
    ['who is Alan Turing', 'wiki', 'Alan Turing'],
    ['France', 'wiki', 'France']
  ];
  for (const [q, intent, a] of cases) {
    const r = k.route(q);
    assert.equal(r && r.intent, intent, q);
    assert.equal(r.a, a, q);
  }
  assert.equal(k.route('100 usd in eur').intent, 'fx');
  assert.equal(k.route('how is the weather in Paris').intent, 'weather');
});

t('follow: what about and pronouns', () => {
  assert.equal(k.follow('what about Japan', { entity: 'France', intent: 'capital' }), 'capital of Japan');
  assert.equal(k.follow('When was he born?', { entity: 'Alan Turing', intent: 'birth' }), 'When was Alan Turing born?');
  assert.equal(k.follow('What about Ada Lovelace?', { entity: 'Alan Turing', intent: 'birth' }), 'when was Ada Lovelace born');
  assert.equal(k.follow('is it true', { entity: 'France', intent: 'wiki' }), 'is it true');
  assert.equal(k.follow('tell me about Mars', null), 'tell me about Mars');
});

t('text helpers', () => {
  assert.equal(k.clean('  <b>hi</b>   there '), 'hi there');
  assert.equal(k.ent('the United States'), 'United States');
  assert.equal(k.ent('uk'), 'United Kingdom');
  assert.equal(k.key('The quick brown foxes'), 'brown fox quick');
  assert.deepEqual(k.sentences('Dr. Smith left. It rained! Really?'), ['Dr. Smith left.', 'It rained!', 'Really?']);
});

t('pickSection', () => {
  const secs = [
    { line: 'References', toclevel: '2', index: '5' },
    { line: 'Causes', toclevel: '2', index: '2' },
    { line: 'History', toclevel: '2', index: '3' },
    { line: 'Mechanism', toclevel: '3', index: '4' }
  ];
  assert.equal(k.pickSection(secs, 'why is the sky blue').line, 'Causes');
  assert.equal(k.pickSection(secs, 'history of the sky').line, 'History');
  assert.equal(k.pickSection(secs, 'how does it work').line, 'Mechanism');
  assert.equal(k.pickSection(secs, 'zebra').line, 'History');
  assert.equal(k.pickSection([], 'x'), null);
});

t('pickSentences', () => {
  const text = 'The sky appears blue because of Rayleigh scattering. Short. ' +
    'Air molecules scatter shorter wavelengths of sunlight much more strongly than longer wavelengths. ' +
    'This scattering is what gives the sky its blue colour during the day. ' +
    '(See also: sunset.) ' + 'x'.repeat(400);
  const out = k.pickSentences(text, 'why is the sky blue');
  assert.ok(out.includes('Rayleigh'));
  assert.ok(!out.includes('x'.repeat(400)));
  assert.ok(out.length <= 900);
  assert.ok(!/\(\s*$/.test(out));
});

t('htmlToText', () => {
  const html = '<p>Hello <b>world</b>.</p><table><tr><td>Hidden</td></tr></table>' +
    '<sup class="reference">[1]</sup><p>Second &amp; last &lt;ok&gt;.</p>';
  const out = k.htmlToText(html);
  assert.ok(out.includes('Hello world'));
  assert.ok(out.includes('Second & last <ok>'));
  assert.ok(!out.includes('Hidden'));
  assert.ok(!out.includes('[1]'));
});

t('dateText', () => {
  assert.equal(k.dateText({ time: '+1955-02-24T00:00:00Z' }), '24 February 1955');
  assert.equal(k.dateText({}), '');
});

t('Wikidata claims', () => {
  const e = {
    claims: {
      P36: [{ mainsnak: { datavalue: { value: { id: 'Q90' } } }, rank: 'normal' }],
      P1082: [{ mainsnak: { datavalue: { value: { amount: '+1234567' } } }, rank: 'preferred' }],
      P2046: [{ mainsnak: { datavalue: { value: { amount: '+551695' } } }, rank: 'normal' }]
    }
  };
  assert.deepEqual(k.refs(e, 'P36'), ['Q90']);
  assert.equal(k.ref(e, 'P36'), 'Q90');
  assert.equal(k.dv(k.claim(e, 'P1082')).amount, '+1234567');
  assert.equal(k.claim(e, 'P999'), undefined);
});

t('cache TTLs', () => {
  k.store('capital', 'selftest:capital', { reply: 'a' });
  assert.equal(k.cached('capital', 'selftest:capital').reply, 'a');
  k.store('time', 'selftest:time', { reply: 'b' });
  assert.equal(k.cached('time', 'selftest:time'), null);
  assert.ok(k.TTL.fact > 0 && k.TTL.weather === 6e5);
});

t('rate limiter', () => {
  assert.equal(k.limit('selftest-rate', 2, 60000), true);
  assert.equal(k.limit('selftest-rate', 2, 60000), true);
  assert.equal(k.limit('selftest-rate', 2, 60000), false);
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ': ' + e.message); }
}
console.log(failed ? failed + ' failed' : 'all ' + tests.length + ' passed');
process.exitCode = failed ? 1 : 0;
