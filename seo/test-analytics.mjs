/* Guards for the Metrika goal layer.
 *
 * Everything here runs the real code taken out of the shipped files - the goal
 * wrapper, the payment-success analytics, the payment-failed script - rather
 * than a copy, so a test can only pass if the page itself behaves that way.
 *
 * Run: node seo/test-analytics.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* ---------- harnesses ---------------------------------------------------- */

// Lifts the wrapper (allowlist + validators + magicMetrikaGoal) out of a page
// and gives back a recording ym plus the internals, so both the goals that get
// through and the params that survive validation can be asserted on.
function wrapperOf(file) {
  const src = read(file);
  const block = src.match(/var CID=110393848;[\s\S]*?window\.magicMetrikaGoal=function[\s\S]*?\n\s{4,}\};/);
  assert.ok(block, `${file}: goal wrapper not found`);
  const sent = [];
  const win = { ym: (id, action, name, params) => sent.push({ id, action, name, params }) };
  const api = new Function('window', `${block[0]}\nreturn {GOALS:GOALS, safe:safe};`)(win);
  return { sent, GOALS: api.GOALS, safe: api.safe, fire: (n, p) => win.magicMetrikaGoal(n, p) };
}

function fakeStorage(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

// payment-success.html: the analytics helpers, wired to fake storage and a
// recording goal sink. `token` is injected the way the page derives it from the
// query string.
function successAnalytics({ token, session = {}, local = {} } = {}) {
  const src = read('payment-success.html');
  const block = src.match(/var PAY_CTX_MAX_AGE_MS[\s\S]*?window\.magicMetrikaGoal\(name, payload\);\s*\n\s*\}/);
  assert.ok(block, 'payment-success.html: analytics block not found');
  const goals = [];
  const win = { magicMetrikaGoal: (name, params) => goals.push({ name, params }) };
  const sessionStorage = fakeStorage(session);
  const localStorage = fakeStorage(local);
  const api = new Function(
    'window', 'sessionStorage', 'localStorage', 'token',
    `${block[0]}\nreturn {fireOrderGoal:fireOrderGoal, readPayCtx:readPayCtx, orderRef:orderRef, clearPayCtx:clearPayCtx};`,
  )(win, sessionStorage, localStorage, token);
  return { ...api, goals, sessionStorage, localStorage };
}

// payment-failed.html: a self-contained IIFE, so it is simply executed.
function runFailedPage({ session = {} } = {}) {
  const src = read('payment-failed.html');
  const block = src.match(/\(function\(\)\{\s*\n\s*var MAX_AGE_MS[\s\S]*?\n\s*\}\)\(\);/);
  assert.ok(block, 'payment-failed.html: script not found');
  const goals = [];
  const win = { magicMetrikaGoal: (name, params) => goals.push({ name, params }) };
  const sessionStorage = fakeStorage(session);
  new Function('window', 'sessionStorage', block[0])(win, sessionStorage);
  return { goals, sessionStorage };
}

const ctx = (over = {}) => JSON.stringify({
  payment_type: 'sbp', country_code: 'TH', package_id: 'pkg-1',
  promo_code: 'SUMMER10', discount_amount: 100, order_ref: 'AbC123',
  _ts: Date.now(), ...over,
});

/* ---------- allowlist is one canonical list ------------------------------ */

const PAGES = ['index.html', 'payment-success.html', 'payment-failed.html',
  'esim/thailand/index.html', 'esim/turkey/index.html', 'esim/china/index.html',
  'esim/uae/index.html', 'esim/vietnam/index.html', 'esim/france/index.html',
  'esim/japan/index.html'];

test('every page ships the identical allowlist', () => {
  const seen = new Set(PAGES.map((p) => JSON.stringify(Object.entries(wrapperOf(p).GOALS).sort())));
  assert.equal(seen.size, 1, 'allowlist has drifted between pages');
});

// The bug this whole file exists to prevent: three promo goals were called for
// months and dropped by the wrapper because nobody added them to the allowlist.
test('every goal called anywhere in the code is allowlisted', () => {
  const allow = new Set(Object.keys(wrapperOf('index.html').GOALS));
  const called = new Set();
  for (const f of ['index.html', 'assets/country-tariffs.js', 'payment-success.html', 'payment-failed.html']) {
    const s = read(f);
    for (const m of s.matchAll(/magicMetrikaGoal\(\s*['"]([\w]+)['"]/g)) called.add(m[1]);
    for (const m of s.matchAll(/magicMetrikaGoal\([^)]*\?\s*['"](\w+)['"]\s*:\s*['"](\w+)['"]/g)) { called.add(m[1]); called.add(m[2]); }
  }
  // fireOrderGoal passes the name through a variable; assert those explicitly.
  for (const n of ['payment_success', 'payment_tech_error', 'payment_canceled']) called.add(n);
  const orphans = [...called].filter((g) => !allow.has(g));
  assert.deepEqual(orphans, [], `called but not allowlisted: ${orphans.join(', ')}`);
});

test('a goal outside the allowlist is dropped, not forwarded', () => {
  const w = wrapperOf('index.html');
  w.fire('definitely_not_a_goal', { country_code: 'TH' });
  assert.equal(w.sent.length, 0);
});

/* ---------- validators --------------------------------------------------- */

test('order_id takes the short order reference and never the full token', () => {
  const { safe } = wrapperOf('payment-success.html');
  assert.equal(safe('order_id', 'AbC123'), 'AbC123');
  // public_order_token is randomBytes(32).base64url -> 43 chars
  assert.equal(safe('order_id', 'Xk9_2mQvR7pLs4TgYnWzB8cHdFjEuAoIvNmKlPqRsTu'), undefined);
});

test('currency accepts RUB only', () => {
  const { safe } = wrapperOf('payment-success.html');
  assert.equal(safe('currency', 'rub'), 'RUB');
  assert.equal(safe('currency', 'USD'), undefined);
});

test('money values reject negatives, junk and absurd amounts', () => {
  const { safe } = wrapperOf('payment-success.html');
  assert.equal(safe('order_price', 1500), 1500);
  assert.equal(safe('order_price', -1), undefined);
  assert.equal(safe('order_price', 'free'), undefined);
  assert.equal(safe('order_price', 1e9), undefined);
  assert.equal(safe('discount_amount', 250), 250);
});

test('payment_method accepts the two methods we offer', () => {
  const { safe } = wrapperOf('payment-success.html');
  assert.equal(safe('payment_method', 'sbp'), 'sbp');
  assert.equal(safe('payment_method', 'card'), 'card');
  assert.equal(safe('payment_method', 'paypal'), undefined);
});

/* ---------- payment_success --------------------------------------------- */

const VIEW_PAID = { status: 'paid', country: 'TH', amountRub: 1490, currency: 'RUB' };

test('payment_success reports order_price from the order, not from the page', () => {
  const a = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwAbC123', session: { magic_pay_ctx: ctx() } });
  a.fireOrderGoal('payment_success', VIEW_PAID);
  assert.equal(a.goals.length, 1);
  const p = a.goals[0].params;
  assert.equal(p.order_price, 1490);
  assert.equal(p.currency, 'RUB');
  assert.equal(p.order_id, 'AbC123');
  assert.equal(p.country_code, 'TH');
  assert.equal(p.package_id, 'pkg-1');
  assert.equal(p.promo_code, 'SUMMER10');
  assert.equal(p.discount_amount, 100);
  assert.equal(p.payment_method, 'sbp');
});

test('order_price follows the order even when the checkout expected another price', () => {
  // ctx carries a stale 999; the server says 1490. The server wins.
  const a = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwAbC123', session: { magic_pay_ctx: ctx({ price_rub: 999 }) } });
  a.fireOrderGoal('payment_success', VIEW_PAID);
  assert.equal(a.goals[0].params.order_price, 1490);
});

test('payment_success is not repeated within the page', () => {
  const a = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwAbC123', session: { magic_pay_ctx: ctx() } });
  a.fireOrderGoal('payment_success', VIEW_PAID);
  a.fireOrderGoal('payment_success', VIEW_PAID);
  a.fireOrderGoal('payment_success', VIEW_PAID);
  assert.equal(a.goals.length, 1);
});

test('payment_success is not repeated after a reload or in a second tab', () => {
  const local = {};
  const first = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwAbC123', session: { magic_pay_ctx: ctx() }, local });
  first.fireOrderGoal('payment_success', VIEW_PAID);
  assert.equal(first.goals.length, 1);
  // a fresh page object, carrying over what localStorage kept
  const carried = Object.fromEntries(first.localStorage._map);
  const second = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwAbC123', session: { magic_pay_ctx: ctx() }, local: carried });
  second.fireOrderGoal('payment_success', VIEW_PAID);
  assert.equal(second.goals.length, 0, 'reload produced a second conversion');
});

test('a different order still books its own conversion', () => {
  const first = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwAbC123', session: { magic_pay_ctx: ctx() } });
  first.fireOrderGoal('payment_success', VIEW_PAID);
  const carried = Object.fromEntries(first.localStorage._map);
  const other = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwZZZ999', session: { magic_pay_ctx: ctx({ order_ref: 'ZZZ999' }) }, local: carried });
  other.fireOrderGoal('payment_success', { ...VIEW_PAID, amountRub: 500 });
  assert.equal(other.goals.length, 1);
  assert.equal(other.goals[0].params.order_price, 500);
});

test('a context belonging to another order is ignored, the order data is not', () => {
  const a = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwAbC123', session: { magic_pay_ctx: ctx({ order_ref: 'OTHER1' }) } });
  a.fireOrderGoal('payment_success', VIEW_PAID);
  const p = a.goals[0].params;
  assert.equal(p.order_price, 1490, 'authoritative order data must survive');
  assert.equal(p.order_id, 'AbC123');
  assert.equal(p.package_id, undefined, 'foreign context must not leak into the goal');
  assert.equal(p.promo_code, undefined);
});

test('a context older than six hours is ignored', () => {
  const stale = ctx({ _ts: Date.now() - 7 * 60 * 60 * 1000 });
  const a = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwAbC123', session: { magic_pay_ctx: stale } });
  a.fireOrderGoal('payment_success', VIEW_PAID);
  assert.equal(a.goals[0].params.package_id, undefined);
  assert.equal(a.goals[0].params.order_price, 1490);
});

test('payment_success survives blocked storage', () => {
  const a = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwAbC123', session: { magic_pay_ctx: ctx() } });
  a.localStorage.getItem = () => { throw new Error('blocked'); };
  a.localStorage.setItem = () => { throw new Error('blocked'); };
  a.fireOrderGoal('payment_success', VIEW_PAID);
  assert.equal(a.goals.length, 1);
});

/* ---------- tech_error / canceled ---------------------------------------- */

test('payment_tech_error carries no revenue, payment_success does', () => {
  const a = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwAbC123', session: { magic_pay_ctx: ctx() } });
  const view = { status: 'provider_failed', country: 'TH', amountRub: 1490, currency: 'RUB' };
  a.fireOrderGoal('payment_success', view);
  a.fireOrderGoal('payment_tech_error', view);
  const success = a.goals.find((g) => g.name === 'payment_success');
  const tech = a.goals.find((g) => g.name === 'payment_tech_error');
  assert.equal(success.params.order_price, 1490, 'provider_failed still took the money');
  assert.equal(tech.params.order_price, undefined);
  assert.equal(tech.params.order_id, 'AbC123');
});

test('payment_canceled reports the order without booking revenue', () => {
  const a = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwAbC123', session: { magic_pay_ctx: ctx() } });
  a.fireOrderGoal('payment_canceled', { status: 'canceled', country: 'TH', amountRub: 1490, currency: 'RUB' });
  assert.equal(a.goals.length, 1);
  assert.equal(a.goals[0].name, 'payment_canceled');
  assert.equal(a.goals[0].params.order_price, undefined);
  assert.equal(a.goals[0].params.country_code, 'TH');
});

test('payment_canceled is not repeated on reload', () => {
  const first = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwAbC123', session: { magic_pay_ctx: ctx() } });
  first.fireOrderGoal('payment_canceled', { status: 'canceled', country: 'TH' });
  const carried = Object.fromEntries(first.localStorage._map);
  const second = successAnalytics({ token: 'tok_wwwwwwwwwwwwwwwAbC123', session: { magic_pay_ctx: ctx() }, local: carried });
  second.fireOrderGoal('payment_canceled', { status: 'canceled', country: 'TH' });
  assert.equal(second.goals.length, 0);
});

/* ---------- payment_failed ----------------------------------------------- */

test('payment_failed does not fire on a bare visit', () => {
  assert.equal(runFailedPage({ session: {} }).goals.length, 0);
});

test('payment_failed does not fire on junk or a foreign context', () => {
  assert.equal(runFailedPage({ session: { magic_pay_ctx: 'not json' } }).goals.length, 0);
  assert.equal(runFailedPage({ session: { magic_pay_ctx: '{}' } }).goals.length, 0);
  assert.equal(runFailedPage({ session: { magic_pay_ctx: JSON.stringify({ payment_type: 'bitcoin', _ts: Date.now() }) } }).goals.length, 0);
});

test('payment_failed does not fire on a stale context', () => {
  const stale = ctx({ _ts: Date.now() - 7 * 60 * 60 * 1000 });
  assert.equal(runFailedPage({ session: { magic_pay_ctx: stale } }).goals.length, 0);
});

test('payment_failed fires once for a real attempt and reports it', () => {
  const r = runFailedPage({ session: { magic_pay_ctx: ctx() } });
  assert.equal(r.goals.length, 1);
  const p = r.goals[0].params;
  assert.equal(p.payment_method, 'sbp');
  assert.equal(p.country_code, 'TH');
  assert.equal(p.package_id, 'pkg-1');
  assert.equal(p.order_id, 'AbC123');
});

test('payment_failed clears its context, so a refresh fires nothing', () => {
  const r = runFailedPage({ session: { magic_pay_ctx: ctx() } });
  assert.equal(r.sessionStorage.getItem('magic_pay_ctx'), null);
  const again = runFailedPage({ session: Object.fromEntries(r.sessionStorage._map) });
  assert.equal(again.goals.length, 0);
});

/* ---------- catalogue goals ---------------------------------------------- */

test('coverage_modal_open fires from a click, on both landing and country pages', () => {
  for (const f of ['index.html', 'assets/country-tariffs.js']) {
    const s = read(f);
    assert.match(s, /magicMetrikaGoal\('coverage_modal_open'/, `${f}: goal missing`);
    assert.match(s, /js-coverage" data-package-id=/, `${f}: coverage button has no package id`);
    const handler = s.slice(s.indexOf(".js-coverage'"), s.indexOf(".js-coverage'") + 700);
    assert.match(handler, /addEventListener\('click'/, `${f}: goal is not click-driven`);
  }
});

test('coverage_modal_open passes validation with real values', () => {
  const w = wrapperOf('index.html');
  w.fire('coverage_modal_open', { country_code: 'th', package_id: 'abc-123' });
  assert.equal(w.sent.length, 1);
  assert.deepEqual(w.sent[0].params, { country_code: 'TH', package_id: 'abc-123' });
});

test('country pages raise country_tariff_click, never tariff_buy_click', () => {
  const s = read('assets/country-tariffs.js');
  assert.match(s, /magicMetrikaGoal\('country_tariff_click'/);
  assert.doesNotMatch(s, /magicMetrikaGoal\('tariff_buy_click'/,
    'a country page deep link must not count as intent to buy');
});

test('tariff_buy_click stays on the landing and keeps its params', () => {
  const s = read('index.html');
  assert.match(s, /magicMetrikaGoal\('tariff_buy_click'/);
  const w = wrapperOf('index.html');
  w.fire('tariff_buy_click', { country_code: 'TH', package_id: 'p1', price_rub: 500, data_gb: 3, validity_days: 15, tariff_type: 'local' });
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].params.tariff_type, 'local');
  assert.equal(w.sent[0].params.price_rub, 500);
});

test('promo goals reach Metrika and carry their context', () => {
  const w = wrapperOf('index.html');
  w.fire('promo_apply_success', { country_code: 'TH', package_id: 'p1', promo_code: 'summer10', discount_amount: 100 });
  w.fire('promo_apply_error', { country_code: 'TH', package_id: 'p1' });
  w.fire('promo_removed', { country_code: 'TH', package_id: 'p1' });
  assert.deepEqual(w.sent.map((s) => s.name), ['promo_apply_success', 'promo_apply_error', 'promo_removed']);
  assert.equal(w.sent[0].params.promo_code, 'SUMMER10');
  assert.equal(w.sent[0].params.discount_amount, 100);
});

test('promo goals are wired to real outcomes, not fired blind', () => {
  const s = read('index.html');
  assert.match(s, /data\.valid[\s\S]{0,400}magicMetrikaGoal\('promo_apply_success'/);
  assert.match(s, /coPromoRemove[\s\S]{0,200}magicMetrikaGoal\('promo_removed'/);
});

/* ---------- no PII ------------------------------------------------------- */

const PII_KEYS = ['email', 'e_mail', 'mail', 'phone', 'tel', 'name', 'contact', 'iccid',
  'activation', 'activation_code', 'qr', 'qr_code', 'lpa', 'token', 'public_order_token'];

test('no allowlisted param can carry personal data', () => {
  const { GOALS } = wrapperOf('index.html');
  const params = new Set(Object.values(GOALS).flat());
  for (const k of params) {
    assert.ok(!PII_KEYS.includes(k), `param "${k}" is personal data`);
  }
});

test('unlisted params are stripped even when explicitly passed', () => {
  const w = wrapperOf('payment-success.html');
  w.fire('payment_success', {
    order_id: 'AbC123', order_price: 1490, currency: 'RUB',
    email: 'user@example.com', phone: '+79001234567', name: 'Иван',
    iccid: '8901260852290000000', qr: 'LPA:1$rsp$token', token: 'full-token-here',
  });
  assert.equal(w.sent.length, 1);
  const keys = Object.keys(w.sent[0].params);
  assert.deepEqual(keys.sort(), ['currency', 'order_id', 'order_price']);
  const blob = JSON.stringify(w.sent[0].params);
  for (const bad of ['user@example.com', '79001234567', 'Иван', '8901260852290000000', 'LPA:', 'full-token-here']) {
    assert.ok(!blob.includes(bad), `payload leaked ${bad}`);
  }
});

test('the payment bridge stores no personal data', () => {
  const s = read('index.html');
  const write = s.match(/sessionStorage\.setItem\('magic_pay_ctx',JSON\.stringify\(\{[\s\S]*?\}\)\);/);
  assert.ok(write, 'payment bridge write not found');
  for (const bad of ['email', 'contact', 'phone', 'iccid', 'qr']) {
    assert.ok(!write[0].includes(bad), `bridge stores ${bad}`);
  }
  assert.match(write[0], /order_ref|package_id/);
});

test('the order reference stored for the bridge is never the whole token', () => {
  const s = read('index.html');
  assert.match(s, /_c\.order_ref=_tok\.slice\(-6\);/);
  assert.doesNotMatch(s, /order_ref\s*[:=]\s*_tok\s*[,;}]/);
});

/* ---------- 404 ---------------------------------------------------------- */

test('404.html counts not-found but never a private payment link', () => {
  const s = read('404.html');
  assert.match(s, /function loadMetrika/);
  assert.match(s, /ym\(110393848,"init"/);
  assert.equal((s.match(/loadMetrika\(\);/g) || []).length, 1, 'counter must load from exactly one branch');
  assert.match(s, /showNotFound\(\);\s*\n\s*loadMetrika\(\);/, 'counter must sit on the not-found branch');
  const routing = s.slice(s.indexOf('// --- routing'));
  const payBranch = routing.slice(routing.indexOf('if(m){'), routing.indexOf('} else if'));
  assert.ok(!payBranch.includes('loadMetrika'), '/pay/<token> must stay untracked');
  // and the counter must not be in <head>, where it would run before routing
  assert.ok(!/<head>[\s\S]*mc\.yandex\.ru\/metrika\/tag\.js[\s\S]*<\/head>/.test(s),
    'a head-level counter would send the payment URL to Metrika');
});
