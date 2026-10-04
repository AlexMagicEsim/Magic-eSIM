/* The GLOBAL checkout (en/checkout.js): one server quote, no order, no payment,
 * and an email that goes nowhere.
 *
 * Run: node --test seo/test-en-checkout.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const SRC = readFileSync(join(ROOT, 'en/checkout.js'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const CO = require(join(ROOT, 'en/checkout.js'));

const PKG = '0d504f79-eab1-40dc-891a-c1f60cf11f06';
const QID = '3fbced54-1111-4222-8333-444455556666';
const NOW = Date.parse('2026-10-04T12:00:00Z');
const ok = (over = {}) => ({ status: 200, body: { quote_id: QID, package_id: PKG, days: null, currency: 'USD',
  amount: 9.99, expires_at: '2026-10-04T12:30:00Z', ...over } });

/* ===================================================================== *
 * 1. The only request is the quote, and it carries no price and no email
 * ===================================================================== */

test('the checkout has exactly one network call — the quote POST through MagicNet — and nothing else', () => {
  assert.equal(CO.QUOTE_PATH, '/api/v1/global/quotes');
  assert.equal((CODE.match(/\.request\(/g) || []).length, 1, 'one request site');
  assert.match(CODE, /net\.request\(QUOTE_PATH, \{\s*method: 'POST',\s*kind: 'write'/);
  for (const [name, re] of [
    ['fetch(', /\bfetch\s*\(/], ['XMLHttpRequest', /\bXMLHttpRequest\b/], ['sendBeacon', /\bsendBeacon\b/],
    ['WebSocket', /\bWebSocket\b/], ['EventSource', /\bEventSource\b/], ['import(', /\bimport\s*\(/],
    ['form submit', /\.submit\s*\(/], ['localStorage', /localStorage/], ['sessionStorage', /sessionStorage/],
    ['indexedDB', /indexedDB/], ['cookie', /document\.cookie/], ['location', /location\.(href|assign|replace)/],
    ['retail-orders', /retail-orders/i], ['orders', /\/orders\b/i], ['platega', /platega/i], ['flitt', /flitt/i],
    ['fulfil', /fulfil/i], ['payments', /\/payments?\b/i],
    // A quote is a new database row every time: it must never be carried to
    // the fallback road as if it were idempotent.
    ['idempotent', /idempotent/], ['retry', /setTimeout\([^)]*getQuote|setInterval\([^)]*getQuote/],
  ]) assert.equal(re.test(CODE), false, `${name} must not appear in en/checkout.js`);
});

test('the quote body is the package and the days — never a price, never the email', async () => {
  assert.deepEqual(JSON.parse(CO.quoteBody(PKG, null)), { package_id: PKG, days: null });
  assert.deepEqual(JSON.parse(CO.quoteBody(PKG, 7)), { package_id: PKG, days: 7 });
  const sent = [];
  const net = { request: async (path, opts) => { sent.push({ path, opts }); return ok(); } };
  const r = await CO.requestQuote(net, PKG, null, () => NOW);
  assert.equal(r.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].path, '/api/v1/global/quotes');
  assert.equal(sent[0].opts.method, 'POST');
  assert.equal(sent[0].opts.idempotent, undefined, 'never failed over');
  assert.deepEqual(Object.keys(JSON.parse(sent[0].opts.body)).sort(), ['days', 'package_id']);
  assert.doesNotMatch(sent[0].opts.body, /@|email|price|amount/i);
});

test('the request body cannot reach the email: quoteBody reads its two arguments and nothing else', () => {
  // A unit run has no DOM, so a body that read the form would still serialise
  // clean here (undefined drops out of JSON). The source is the proof; the
  // browser suite proves the traffic.
  const fn = CODE.slice(CODE.indexOf('function quoteBody('), CODE.indexOf('}', CODE.indexOf('function quoteBody(')) + 1);
  assert.match(fn, /package_id: String\(packageId\), days: days == null \? null : Number\(days\)/);
  assert.doesNotMatch(fn, /email|document|getElementById|value|root\./i);
  // The email is read in one place, and written to one place: the review row.
  assert.equal((CODE.match(/\$\('coEmail'\)\.value\b(?!\s*=)/g) || []).length, 1, 'one read');
  assert.match(CODE, /\$\('rvEmail'\)\.textContent = email;/);
  assert.equal((CODE.match(/\bemail\b/g) || []).length, 3, 'declared, checked, shown — nothing else');
});

test('a malformed package id is never sent', async () => {
  let calls = 0;
  const net = { request: async () => { calls += 1; return ok(); } };
  for (const bad of ['', 'abc', '../../orders', null, undefined, `${PKG}x`]) {
    assert.deepEqual(await CO.requestQuote(net, bad, null, () => NOW), { ok: false, reason: 'unavailable' });
  }
  assert.equal(calls, 0);
});

test('a transport failure is «offline», and the quote is not repeated', async () => {
  let calls = 0;
  const net = { request: async () => { calls += 1; throw new Error('boom'); } };
  assert.deepEqual(await CO.requestQuote(net, PKG, null, () => NOW), { ok: false, reason: 'offline' });
  assert.equal(calls, 1);
  assert.deepEqual(await CO.requestQuote(null, PKG, null, () => NOW), { ok: false, reason: 'unavailable' });
});

/* ===================================================================== *
 * 2. The answer must be a quote for exactly what was asked
 * ===================================================================== */

test('a valid quote is accepted, and its amount is the server\'s', () => {
  const r = CO.validateQuote(ok(), { packageId: PKG, days: null }, NOW);
  assert.deepEqual(r, { ok: true, quote: { id: QID, amount: 9.99, days: null, expiresAt: Date.parse('2026-10-04T12:30:00Z') } });
  const d = CO.validateQuote(ok({ days: 7, amount: 15.99 }), { packageId: PKG, days: 7 }, NOW);
  assert.equal(d.ok, true);
  assert.equal(d.quote.amount, 15.99);
});

test('anything that is not exactly that quote is refused — never shown, never guessed', () => {
  const ask = { packageId: PKG, days: null };
  for (const [why, over] of [
    ['roubles', { currency: 'RUB' }], ['no currency', { currency: undefined }],
    ['another package', { package_id: '096d1bf0-282f-4e55-97da-d9ccccc57694' }],
    ['another term', { days: 3 }], ['zero', { amount: 0 }], ['negative', { amount: -9.99 }],
    ['not a number', { amount: 'nine' }], ['fractions of a cent', { amount: 9.999 }],
    ['expired', { expires_at: '2026-10-04T11:59:59Z' }], ['no expiry', { expires_at: null }],
    ['no quote id', { quote_id: undefined }], ['a bad quote id', { quote_id: 'x' }],
  ]) {
    assert.deepEqual(CO.validateQuote(ok(over), ask, NOW), { ok: false, reason: 'bad_quote' }, why);
  }
  // A per-day plan asked for 7 days must not accept a 3-day quote.
  assert.equal(CO.validateQuote(ok({ days: 3 }), { packageId: PKG, days: 7 }, NOW).ok, false);
});

test('each server refusal has its own honest message', () => {
  const ask = { packageId: PKG, days: null };
  const v = (status, error) => CO.validateQuote({ status, body: error ? { status: 'error', error } : null }, ask, NOW).reason;
  assert.equal(v(503, 'GLOBAL_PRICING_DISABLED'), 'unavailable');
  assert.equal(v(429, 'TOO_MANY_REQUESTS'), 'busy');
  assert.equal(v(404, 'GLOBAL_PACKAGE_UNAVAILABLE'), 'gone');
  assert.equal(v(409, 'GLOBAL_PACKAGE_UNAVAILABLE'), 'gone');
  assert.equal(v(400, 'GLOBAL_TERM_REQUIRED'), 'unavailable');
  assert.equal(v(500, 'internal_error'), 'unavailable');
  assert.equal(v(0, null), 'offline');
  const I18N = require(join(ROOT, 'assets/site-i18n.js')).DICT.en;
  for (const key of Object.values(CO.REASON_KEY)) assert.ok(I18N[key], `${key} has an English string`);
  assert.doesNotMatch(Object.values(CO.REASON_KEY).map((k) => I18N[k]).join(' '), /₽|rouble|RUB/i);
});

/* ===================================================================== *
 * 3. The term a per-day plan is quoted for, and the clock
 * ===================================================================== */

test('a per-day plan offers exactly its purchasable durations', () => {
  const p = { daily_term_mode: 'PER_DAY', term_prices: [{ days: 7, price: 10.99 }, { days: 3, price: 4.99 },
    { days: 0, price: 1 }, { days: 5, price: 0 }, { days: 3, price: 4.99 }, { days: 2.5, price: 3 }] };
  assert.deepEqual(CO.durations(p), [{ days: 3, price: 4.99 }, { days: 7, price: 10.99 }]);
  assert.equal(CO.isPerDay(p), true);
  assert.equal(CO.isPerDay({ daily_term_mode: 'FIXED_TERM' }), false, 'a fixed-term daily is quoted without days');
  assert.equal(CO.isPerDay({ plan_type: 'FIXED_VOLUME' }), false);
});

test('the hold is shown as minutes and seconds, and never goes negative', () => {
  assert.equal(CO.clock(30 * 60 * 1000), '30:00');
  assert.equal(CO.clock(61 * 1000), '1:01');
  assert.equal(CO.clock(-5), '0:00');
});

test('the email check catches a typo and nothing more', () => {
  for (const good of ['a@b.co', 'first.last+tag@example.com']) assert.equal(CO.EMAIL.test(good), true, good);
  for (const bad of ['', 'a', 'a@b', 'a b@c.com', '@b.com', 'a@b.c']) assert.equal(CO.EMAIL.test(bad), false, bad);
});
