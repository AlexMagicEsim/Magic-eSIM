/* Guards for the Metrika goal layer.
 *
 * Everything here runs the real code taken out of the shipped files - the goal
 * wrapper, the payment-success analytics, the payment-failed script - rather
 * than a copy, so a test can only pass if the page itself behaves that way.
 *
 * Run: node seo/test-analytics.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
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
function successAnalytics({ token, session = {}, local = {}, search = '' } = {}) {
  const src = read('payment-success.html');
  const block = src.match(/var PAY_CTX_MAX_AGE_MS[\s\S]*?window\.magicMetrikaGoal\(name, payload\);\s*\n\s*\}/);
  assert.ok(block, 'payment-success.html: analytics block not found');
  const goals = [];
  const win = { magicMetrikaGoal: (name, params) => goals.push({ name, params }) };
  const sessionStorage = fakeStorage(session);
  const localStorage = fakeStorage(local);
  // `params` is injected for the same reason `token` is: the page derives both
  // from the query string above this block, and the block has since grown an
  // IIFE that reads `params.get('src')` for the Mini App deep link. Without it
  // the extracted code throws ReferenceError and every assertion below it fails
  // for a reason that has nothing to do with what it was testing — which is
  // exactly what had happened to eleven of these tests.
  const params = new URLSearchParams(search);
  const api = new Function(
    'window', 'sessionStorage', 'localStorage', 'token', 'params',
    `${block[0]}\nreturn {fireOrderGoal:fireOrderGoal, readPayCtx:readPayCtx, orderRef:orderRef, clearPayCtx:clearPayCtx};`,
  )(win, sessionStorage, localStorage, token, params);
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

// The landing is the only page with a checkout, so it is the only page that can
// fire a checkout goal. Everything else ships the generated wrapper.
const SHARED_PAGES = PAGES.filter((p) => p !== 'index.html');

test('every page but the landing ships the identical allowlist', () => {
  // 198 country pages + the hub + the two result pages get their wrapper from
  // one place (build-catalogue-pages.mjs bootstraps it from esim/thailand), and
  // drift between them would mean a goal silently dropped on some pages and not
  // others — the defect this file was written for.
  const seen = new Set(SHARED_PAGES.map((p) => JSON.stringify(Object.entries(wrapperOf(p).GOALS).sort())));
  assert.equal(seen.size, 1, 'allowlist has drifted between the generated pages');
});

test('the landing may extend the allowlist, but only with goals only it fires', () => {
  /*
   * WHY THIS IS NOT «identical everywhere».
   *
   * It was, and the cost showed up the first time a goal was added: the
   * allowlist is inline in every page, `seo/sitemap-lastmod.json` derives
   * lastmod from page CONTENT, so one new Metrika goal rewrote 201 files and
   * announced 154 freshly-modified URLs to Yandex — for a change no reader can
   * see, on a domain whose diagnosed problem is SQI 0 and a pending region
   * request. That is the mass re-date handoff §25.1 exists to end, arriving
   * through a different door.
   *
   * The invariant that actually matters is narrower and is asserted here: a
   * page may only carry an extra goal if that goal is fired NOWHERE ELSE. So
   * `payment_redirect` lives on the one page with a checkout, the country pages
   * are untouched, and a goal added to the landing that some other page fires
   * still fails — which is the regression the old test really guarded.
   */
  const landing = new Set(Object.keys(wrapperOf('index.html').GOALS));
  const shared = new Set(Object.keys(wrapperOf(SHARED_PAGES[0]).GOALS));

  for (const g of shared) {
    assert.ok(landing.has(g), `the landing dropped a shared goal: ${g}`);
  }

  const extra = [...landing].filter((g) => !shared.has(g));
  for (const g of extra) {
    for (const f of ['assets/country-tariffs.js', 'payment-success.html', 'payment-failed.html']) {
      assert.ok(!read(f).includes(`magicMetrikaGoal('${g}'`),
        `${g} is allowlisted only on the landing but ${f} fires it — it would be dropped there`);
    }
  }
});

// The bug this whole file exists to prevent: three promo goals were called for
// months and dropped by the wrapper because nobody added them to the allowlist.
test('every goal called anywhere in the code is allowlisted', () => {
  const allow = new Set(Object.keys(wrapperOf('index.html').GOALS));
  const called = new Set();
  for (const f of ['index.html', 'assets/country-tariffs.js', 'payment-success.html', 'payment-failed.html']) {
    const s = read(f);
    for (const m of s.matchAll(/magicMetrikaGoal\(\s*['"]([\w]+)['"]/g)) called.add(m[1]);
    // A ternary counts only when it IS the first argument — anchored right after
    // the opening paren. Matching any ternary inside the call also picked up ones
    // in the params object (e.g. error_type: cond ? 'a' : 'b') and reported those
    // values as undeclared goal names.
    for (const m of s.matchAll(/magicMetrikaGoal\(\s*[^,()]*\?\s*['"](\w+)['"]\s*:\s*['"](\w+)['"]\s*,/g)) { called.add(m[1]); called.add(m[2]); }
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
  // Structural, not a fixed-length window. The previous form sliced between
  // `if(m){` and the first `} else if`, which silently inverted (end before
  // start) the moment a branch was added ahead of it and asserted nothing at
  // all from then on. The invariant is stronger and simpler than the window
  // was: NO payment branch may reach the counter, because on these routes the
  // URL path IS the capability. So the single permitted call must sit on the
  // not-found branch, and no line that dispatches a /pay/ route may carry it.
  const routing = s.slice(s.indexOf('// --- routing'));
  assert.ok(routing.length > 0, 'routing block not found');
  for (const line of routing.split('\n')) {
    if (!line.includes('loadMetrika')) continue;
    assert.ok(
      !/\bload(PayLink|Charge|Link)\s*\(|verifySuccess\s*\(|showCharge\s*\(/.test(line),
      `counter shares a line with a payment dispatch: ${line.trim()}`
    );
  }
  for (const fn of ['loadLink', 'loadPayLink', 'loadCharge', 'verifySuccess', 'showCharge', 'renderAmountForm']) {
    const at = s.indexOf(`function ${fn}(`);
    if (at < 0) continue;
    // Body = from the signature to the next top-level `\n    function ` at the
    // same indentation, found by structure rather than by a byte offset.
    const rest = s.slice(at + 1);
    const nextFn = rest.indexOf('\n    function ');
    const body = nextFn < 0 ? rest : rest.slice(0, nextFn);
    assert.ok(!body.includes('loadMetrika'), `${fn} must not load the counter`);
  }
  // and the counter must not be in <head>, where it would run before routing
  assert.ok(!/<head>[\s\S]*mc\.yandex\.ru\/metrika\/tag\.js[\s\S]*<\/head>/.test(s),
    'a head-level counter would send the payment URL to Metrika');
});

test('a MALFORMED /pay/ path is a 404 that still never reaches the counter', () => {
  // The gap this closes, found 2026-08-31. The counter was kept off every
  // branch that PARSES as a payment route, but a /pay/ URL whose token does not
  // parse — autocorrected, truncated, mistyped — fell through to the plain
  // not-found branch and took the full URL to Metrika with it. One real URL did
  // exactly that (a hyphen turned into U+2013, one substitution from valid) and
  // reached Yandex's crawler through counter-based crawling.
  //
  // So the guard is the PREFIX, not the parse.
  const s = read('404.html');
  const routing = s.slice(s.indexOf('// --- routing'));

  // There must be a branch that matches the /pay/ prefix generically and shows
  // a 404 without the counter, and it must come BEFORE the final else.
  const guard = routing.indexOf("/^\\/pay\\//.test(path)");
  assert.ok(guard > 0, 'no generic /pay/ prefix branch guards the counter');

  const finalElse = routing.lastIndexOf('loadMetrika();');
  assert.ok(guard < finalElse, 'the /pay/ guard must precede the counting branch');

  // And nothing between the guard and the final else may load the counter.
  const between = routing.slice(guard, finalElse);
  assert.equal((between.match(/loadMetrika\(/g) || []).length, 0,
    'the /pay/ guard branch must not load the counter');
});

// ---------------------------------------------------------------------------
// Страница «Оплата рублями»: подтверждение региона для Яндекс Вебмастера
// ---------------------------------------------------------------------------
//
// Регион подтверждается ВИДИМЫМ текстом страницы. Формулировка ушла в прод как
// основание регионального признака, поэтому она пинится: правка, которая уберёт
// упоминание России или рублей, обязана уронить тест, а не тихо снять основание.

test('страница оплаты рублями существует и канонична сама на себя', () => {
  const p = join(ROOT, 'esim/payment-rubles/index.html');
  assert.ok(existsSync(p), 'esim/payment-rubles/index.html должен быть собран');
  const h = readFileSync(p, 'utf8');
  assert.match(h, /<link rel="canonical" href="https:\/\/magicesim\.store\/esim\/payment-rubles\/"/);
  assert.match(h, /<h1[^>]*>Оплата eSIM рублями/);
  assert.ok(!/noindex/.test(h), 'страница обязана быть индексируемой');
});

test('видимый текст называет Россию, рубли и СБП', () => {
  const h = readFileSync(join(ROOT, 'esim/payment-rubles/index.html'), 'utf8');
  const visible = h
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  assert.match(visible, /путешественникам из России|путешественников из России/,
    'основание регионального признака — упоминание России в видимом тексте');
  assert.match(visible, /цены указаны в рублях/);
  assert.match(visible, /СБП/);
});

test('страница в sitemap и в блоке «Перед покупкой» на хабе', () => {
  assert.match(readFileSync(join(ROOT, 'sitemap.xml'), 'utf8'),
    /<loc>https:\/\/magicesim\.store\/esim\/payment-rubles\/<\/loc>/);
  assert.match(readFileSync(join(ROOT, 'esim/index.html'), 'utf8'),
    /href="\/esim\/payment-rubles\/"/);
});

// ---------------------------------------------------------------------------
// Карта: страница обязана называть ограничение, а не намекать на него
// ---------------------------------------------------------------------------
//
// Предыдущая версия этого блока пинила ХЕДЖ: «Какие именно карты примет
// платёжная страница, зависит от платёжного провайдера; если оплата картой не
// проходит, воспользуйтесь СБП». Он был написан, когда карточная ветка вообще
// не проходила у провайдера (§6.8) и честным ответом было «мы не знаем».
//
// Ветка работает с 31.08.2026, и её предел ИЗВЕСТЕН: карты российских банков.
// С этого момента тот же хедж читается наоборот — как приглашение попробовать
// иностранную карту. Тест теперь пинит правило, а не формулировку.

const CARD_WORD = /карт/i;
// Платёжный контекст. Без него сюда попадали бы «карты, мессенджеры и такси»
// (это про навигацию) и «на карточке тарифа» (это про карточку товара).
const PAY_CONTEXT = /(оплат|плат[ёеи]|СБП|способ)/i;
// Квалификатор, который снимает двусмысленность. «за пределами России» — тоже
// квалификатор: он называет ту же границу с другой стороны.
const QUALIFIER = /(росси[йи]ск|за пределами России|иностранн)/i;

function unescapeHtml(t) {
  return t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/** Пары «вопрос — ответ» из ВИДИМОЙ разметки. */
function visibleFaq(html) {
  return [...html.matchAll(
    /<div class="faq-item"><p class="faq-q">([\s\S]*?)<\/p><p class="faq-a">([\s\S]*?)<\/p><\/div>/g)]
    .map((m) => ({ q: unescapeHtml(m[1]).trim(), a: unescapeHtml(m[2]).trim() }));
}

/** Те же пары из FAQPage-разметки. */
function schemaFaq(html) {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    if (!m[1].includes('"FAQPage"')) continue;
    const json = JSON.parse(m[1]);
    return (json.mainEntity || []).map((e) => ({ q: e.name, a: e.acceptedAnswer.text }));
  }
  return null;
}

function unqualifiedCardSentences(text) {
  return sentences(text).filter((sent) =>
    CARD_WORD.test(sent) && PAY_CONTEXT.test(sent) && !QUALIFIER.test(sent));
}

function pageProse(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // FAQ проверяется отдельно и целыми парами: вопрос «Можно ли оплатить
    // банковской картой?» квалификатора не несёт и нести не должен — его несёт
    // ответ, который стоит следом.
    .replace(/<div class="faq-item">[\s\S]*?<\/div>/g, ' ');
}

function sentences(text) {
  return unescapeHtml(text.replace(/<[^>]+>/g, ' '))
    .split(/(?<=[.!?])\s+|\n/)
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

test('правило теста срабатывает на формулировках, которые эта правка убрала', () => {
  // ПЕРВЫМ, до корпуса: правило, которое не может упасть, хуже отсутствия
  // правила — оно вечно зелёное. §26.1.
  const mustFire = [
    'В оформлении доступны СБП и банковская карта.',
    'Оплата eSIM рублями: СБП и карта',
    'Какие именно карты примет платёжная страница, зависит от платёжного провайдера.',
    'тариф оплачивается через СБП или банковской картой',
  ];
  for (const bad of mustFire) {
    assert.equal(unqualifiedCardSentences(bad).length, 1,
      `правило не срабатывает на том, ради чего написано: ${bad}`);
  }
  const mustNotFire = [
    'В оформлении доступны СБП и российская банковская карта.',
    'Оплатить можно двумя способами: через СБП или картой российского банка.',
    'Карту, выпущенную за пределами России, платёжная страница не примет.',
    'Ориентир: карты, мессенджеры и такси расходуют немного.',
    'Цена, которую вы видите на карточке тарифа, — это итоговая сумма в рублях.',
  ];
  for (const fine of mustNotFire) {
    assert.deepEqual(unqualifiedCardSentences(fine), [],
      `правило срабатывает на корректном тексте: ${fine}`);
  }
});

test('ни одно место страницы не называет карту без квалификатора', () => {
  const h = readFileSync(join(ROOT, 'esim/payment-rubles/index.html'), 'utf8');

  const bad = unqualifiedCardSentences(pageProse(h));
  assert.deepEqual(bad, [], `текст называет карту без квалификатора: ${JSON.stringify(bad)}`);

  // FAQ — парами, и в видимом виде, и в разметке. Пара, а не предложение:
  // вопрос «Можно ли оплатить банковской картой?» квалификатора не несёт и не
  // должен — так его и задают, — но ответ обязан начинаться с ограничения.
  for (const [where, pairs] of [['видимый FAQ', visibleFaq(h)], ['FAQPage', schemaFaq(h)]]) {
    assert.ok(pairs && pairs.length, `${where}: пары не разобрались`);
    for (const { q, a } of pairs) {
      const inAnswer = unqualifiedCardSentences(a);
      assert.deepEqual(inAnswer, [],
        `${where}: ответ «${q}» называет карту без квалификатора: ${JSON.stringify(inAnswer)}`);
      if (CARD_WORD.test(q) && PAY_CONTEXT.test(q)) {
        assert.match(a, QUALIFIER,
          `${where}: вопрос «${q}» спрашивает про карту, а ответ границу не называет`);
      }
    }
  }
});

test('страница прямо говорит, что иностранные карты не принимаются', () => {
  const h = readFileSync(join(ROOT, 'esim/payment-rubles/index.html'), 'utf8');
  const visible = sentences(pageProse(h)).join(' ') + ' ' +
    visibleFaq(h).map((f) => f.q + ' ' + f.a).join(' ');
  const schema = schemaFaq(h).map((f) => f.q + ' ' + f.a).join(' ');

  // И в видимом тексте, и в разметке: в выдачу может попасть либо то, либо это.
  for (const [where, text] of [['видимый текст', visible], ['FAQPage', schema]]) {
    assert.match(text, /(иностранн[а-яё]+ (карт|банк)|за пределами России)[\s\S]{0,80}(не приним|не примет)/i,
      `${where} не называет ограничение прямо`);
  }

  // И нигде не предлагает попробовать. Хедж был именно таким приглашением.
  assert.ok(!/зависит от платёжного провайдера/i.test(h),
    'хедж вернулся: страница снова перекладывает ответ на провайдера');
  for (const invite of ['попробуйте оплатить картой', 'попробуйте другую карту',
    'если оплата картой не проходит', 'любой картой', 'любая карта',
    'иностранной картой можно', 'международной картой']) {
    assert.ok(!h.toLowerCase().includes(invite.toLowerCase()),
      `страница приглашает попробовать: «${invite}»`);
  }
});

test('шаги называют только те кнопки, которые действительно существуют', () => {
  // Дефект был КОНТЕКСТНЫМ, и это важно для того, что здесь проверяется.
  // Страница говорила «Нажмите „Купить“ на выбранном тарифе», а абзац выше
  // отправлял читателя на страницу СТРАНЫ, где нет ни «Купить», ни оформления
  // заказа: там «Выбрать тариф» — диплинк на лендинг
  // (assets/country-tariffs.js:267, и комментарий на :250 — «Country pages do
  // NOT run checkout locally»). Подпись «Купить» в репозитории ЕСТЬ, на
  // лендинге, поэтому одна лишь проверка существования этот дефект не ловила бы
  // и не ловит. Проверок две: существование (ловит выдуманную подпись) и
  // маршрут (ловит подпись с другого экрана).
  const h = readFileSync(join(ROOT, 'esim/payment-rubles/index.html'), 'utf8');
  const steps = h.match(/<ol class="ol-steps">[\s\S]*?<\/ol>/);
  assert.ok(steps, 'блок шагов не найден');

  const ui = readFileSync(join(ROOT, 'index.html'), 'utf8')
    + readFileSync(join(ROOT, 'assets/country-tariffs.js'), 'utf8');

  const named = [...steps[0].matchAll(/«([^»]{2,40})»/g)].map((m) => m[1]);
  assert.ok(named.length >= 5, `в шагах названо всего ${named.length} контролов`);
  for (const label of named) {
    assert.ok(ui.includes(label),
      `шаги называют «${label}», но такой подписи нет ни на лендинге, ни на странице страны`);
  }

  // Маршрут. Читатель приходит сюда со страницы страны, поэтому первый шаг
  // обязан назвать контрол ТОЙ страницы, а не лендинга.
  assert.match(steps[0], /Выбрать тариф/,
    'шаги не называют «Выбрать тариф» — контрол страницы страны, откуда идёт читатель');
  assert.ok(!/Нажмите «Купить» на выбранном тарифе/.test(steps[0]),
    'вернулась инструкция нажать «Купить» там, где этой кнопки нет');
});

test('видимый FAQ и FAQPage совпадают дословно на всех гайдах', () => {
  // Одна и та же страница может показывать человеку одно, а отдавать поисковику
  // другое — и расхождение видно только если сравнить. Сегодня разъехаться
  // нечему (build-guides рендерит оба из одного массива `g.faq`), и этот тест
  // существует, чтобы так и осталось: он упадёт в тот день, когда кто-нибудь
  // соберёт разметку из отдельного источника.
  const guides = ['compatibility', 'activation-before-travel', 'not-working',
    'dual-sim-sms', 'payment-rubles'];
  for (const slug of guides) {
    const h = readFileSync(join(ROOT, `esim/${slug}/index.html`), 'utf8');
    const seen = visibleFaq(h);
    const ld = schemaFaq(h);
    assert.ok(seen.length > 0, `${slug}: видимый FAQ пуст`);
    assert.deepEqual(ld, seen, `${slug}: FAQPage разошёлся с видимым FAQ`);
  }
});
