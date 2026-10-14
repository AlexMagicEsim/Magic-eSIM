// «Вернуться к тарифам» on /payment-failed.html returns the buyer to their OWN
// country page (/esim/<slug>/#tariffs), where the checkout has lived since
// 2026-10-10, instead of the home search. The country comes from magic_pay_ctx;
// the page from the generated assets/ru-destinations.js. Anything else → /#plans.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const PAGE = read('payment-failed.html');

const RETURN = PAGE.match(/\(function\(\)\{\s*\n\s*var a=document\.getElementById\('pfBack'\)[\s\S]*?\n\s*\}\)\(\);/);
const GOAL = PAGE.match(/\(function\(\)\{\s*\n\s*var MAX_AGE_MS[\s\S]*?\n\s*\}\)\(\);/);

function destinations() {
  const w = {};
  new Function('window', read('assets/ru-destinations.js'))(w);
  return w.MagicRuDestinations;
}
const DEST = destinations();

function storage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _map: m };
}
const ctx = (over = {}) => JSON.stringify({ payment_type: 'card', country_code: 'TH', package_id: 'pkg-1', order_ref: 'AbC123', _ts: Date.now(), ...over });

function run({ session = {}, list = DEST, withLink = true, thenGoal = false } = {}) {
  const link = { href: '/#plans' };
  const document = { getElementById: (id) => (withLink && id === 'pfBack' ? link : null) };
  const window = { MagicRuDestinations: list, magicMetrikaGoal: (n, p) => goals.push({ n, p }) };
  const goals = [];
  const ss = storage(session);
  new Function('window', 'document', 'sessionStorage', RETURN[0])(window, document, ss);
  if (thenGoal) new Function('window', 'sessionStorage', GOAL[0])(window, ss);
  return { href: link.href, goals, ss };
}

test('the scripts are where they must be: list → return link → goal (which clears the context)', () => {
  assert.ok(RETURN, 'return-link script not found');
  assert.ok(GOAL, 'payment_failed goal script not found');
  const iList = PAGE.search(/<script src="\/assets\/ru-destinations\.js\?v=[0-9a-f]{8}"><\/script>/);
  const iReturn = PAGE.indexOf(RETURN[0]);
  const iGoal = PAGE.indexOf(GOAL[0]);
  assert.ok(iList > 0 && iList < iReturn && iReturn < iGoal, `order list ${iList} < return ${iReturn} < goal ${iGoal}`);
  assert.doesNotMatch(RETURN[0], /removeItem|setItem/, 'the return link only reads the context');
});

test('without JavaScript (and as the static default) the button still goes to /#plans', () => {
  const btn = PAGE.match(/<a class="btn" id="pfBack" href="([^"]+)">Вернуться к тарифам<\/a>/);
  assert.ok(btn, 'the button keeps its label and gains only an id');
  assert.equal(btn[1], '/#plans');
});

test('a fresh payment context returns to that country page, both payment methods', () => {
  assert.equal(run({ session: { magic_pay_ctx: ctx() } }).href, '/esim/thailand/#tariffs');
  assert.equal(run({ session: { magic_pay_ctx: ctx({ payment_type: 'sbp', country_code: 'TR' }) } }).href, '/esim/turkey/#tariffs');
  assert.equal(run({ session: { magic_pay_ctx: ctx({ country_code: 'AE' }) } }).href, '/esim/uae/#tariffs');
});

test('anything not a fresh context of ours falls back to /#plans', () => {
  const cases = {
    'no context': {},
    'not json': { magic_pay_ctx: 'not json' },
    'empty object': { magic_pay_ctx: '{}' },
    'stale (7 h)': { magic_pay_ctx: ctx({ _ts: Date.now() - 7 * 3600 * 1000 }) },
    'future timestamp': { magic_pay_ctx: ctx({ _ts: Date.now() + 3600 * 1000 }) },
    'foreign method': { magic_pay_ctx: ctx({ payment_type: 'bitcoin' }) },
    'no country': { magic_pay_ctx: ctx({ country_code: undefined }) },
    'lower-case code': { magic_pay_ctx: ctx({ country_code: 'th' }) },
    'unknown code': { magic_pay_ctx: ctx({ country_code: 'XX' }) },
    'code without a RU page (RU)': { magic_pay_ctx: ctx({ country_code: 'RU' }) },
    'injection attempt': { magic_pay_ctx: ctx({ country_code: 'TH/../../evil' }) },
  };
  for (const [name, session] of Object.entries(cases)) assert.equal(run({ session }).href, '/#plans', name);
});

test('a missing or tampered destinations list falls back to /#plans', () => {
  assert.equal(run({ session: { magic_pay_ctx: ctx() }, list: null }).href, '/#plans');
  assert.equal(run({ session: { magic_pay_ctx: ctx() }, list: [{ iso: 'TH', slug: '//evil.example' }] }).href, '/#plans');
  assert.equal(run({ session: { magic_pay_ctx: ctx() }, list: [{ iso: 'TH', slug: 'javascript:alert(1)' }] }).href, '/#plans');
});

test('no button on the page: nothing happens, nothing throws', () => {
  assert.doesNotThrow(() => run({ session: { magic_pay_ctx: ctx() }, withLink: false }));
});

test('the goal still fires exactly once after the return link read the context, and a refresh falls back', () => {
  const first = run({ session: { magic_pay_ctx: ctx() }, thenGoal: true });
  assert.equal(first.href, '/esim/thailand/#tariffs');
  assert.equal(first.goals.length, 1);
  assert.equal(first.goals[0].n, 'payment_failed');
  assert.equal(first.ss.getItem('magic_pay_ctx'), null, 'the goal script still clears it');
  const refresh = run({ session: Object.fromEntries(first.ss._map), thenGoal: true });
  assert.equal(refresh.href, '/#plans');
  assert.equal(refresh.goals.length, 0);
});

test('every destination resolves to a real country page with a #tariffs section', () => {
  assert.ok(DEST.length >= 190, `only ${DEST.length} destinations`);
  const isos = new Set();
  for (const d of DEST) {
    assert.match(d.iso, /^[A-Z]{2}$/);
    assert.match(d.slug, /^[a-z0-9-]+$/);
    assert.ok(!isos.has(d.iso), `duplicate ${d.iso}`); isos.add(d.iso);
    const f = join(ROOT, 'esim', d.slug, 'index.html');
    assert.ok(existsSync(f), `no page for ${d.iso} → ${d.slug}`);
    assert.match(readFileSync(f, 'utf8'), /id="tariffs"/, `${d.slug} has no #tariffs`);
  }
});
