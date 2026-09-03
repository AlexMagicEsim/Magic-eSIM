// Website attribution: capturing where a visit came from, and keeping it.
//
// WHAT WAS BROKEN, AND WHY A TEST IS THE RIGHT ANSWER
//
//   The storefront collected `utm_*` into sessionStorage under `magic_utm` and
//   never read the key back. It was written on one page, consumed by nothing,
//   and shipped that way for months. The read-only audit of 2026-09-01 found it
//   by grepping for the key and finding exactly one occurrence.
//
//   A capture with no reader is invisible to every other kind of check: the
//   page works, the console is clean, the order succeeds. Only an assertion
//   that the value REACHES THE ORDER can fail when the wire is cut, which is
//   what this file is.
//
// THE OTHER HALF: TWO COPIES OF THE SAME SNIPPET
//
//   The capture has to run on the landing AND on the 198 country pages, because
//   search traffic lands on a country page and the buy button hands it to the
//   landing — by which point document.referrer is our own origin and the utm
//   has fallen off the URL. Country pages have no inline script of their own,
//   and giving them one would rewrite 198 files, so the copy lives in
//   assets/country-tariffs.js, which they already load.
//
//   Two copies drift. This file pins them byte for byte, the same way
//   test-topup-scope.mjs pins the backend's duplicated regexes.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const LANDING = read('index.html');
const TARIFFS = read('assets/country-tariffs.js');

// The capture block, delimited by its own banner and the closing catch.
function captureBlock(src) {
  const start = src.indexOf('/* ── FIRST-TOUCH ACQUISITION');
  assert.notEqual(start, -1, 'the capture block is missing');
  const end = src.indexOf('}catch(e){}', start);
  assert.notEqual(end, -1, 'the capture block has no closing catch');
  return src.slice(start, end + '}catch(e){}'.length);
}

test('the capture exists on the landing and on the country pages', () => {
  assert.ok(LANDING.includes('FIRST-TOUCH ACQUISITION'), 'index.html lost the capture');
  assert.ok(TARIFFS.includes('FIRST-TOUCH ACQUISITION'), 'country-tariffs.js lost the capture');
});

test('the two copies are byte-identical', () => {
  // Not «equivalent» — identical. Two behaviours that must agree are cheapest
  // to keep agreeing when they are the same characters.
  assert.equal(captureBlock(LANDING), captureBlock(TARIFFS),
    'the capture has drifted between index.html and assets/country-tariffs.js');
});

test('the dead keys are gone from the two files that capture, and stay gone', () => {
  // `magic_utm` was written and never read. `mesim_attr` — the OTHER dead key,
  // found in review, still sitting inline on 198 country pages — is the same
  // defect one generation older. Neither name may appear in the two files that
  // now do the capturing, so a future edit cannot resurrect either here.
  //
  // The 198 pre-existing copies are deliberately left alone: removing them
  // rewrites 198 files and moves 198 sitemap dates for dead code that harms
  // nothing. It rides along with the next content wave.
  // Matched as a STORAGE ACCESS, not as a substring: the comment above the
  // capture names mesim_attr on purpose, and explaining a dead key is not the
  // same as writing one. A test that cannot tell those apart would push the
  // next author into deleting the explanation.
  const touches = (src, key) =>
    new RegExp(`(?:get|set|remove)Item\\(\\s*['"]${key}['"]`).test(src);

  for (const [name, src] of [['index.html', LANDING], ['country-tariffs.js', TARIFFS]]) {
    for (const key of ['magic_utm', 'mesim_attr']) {
      assert.ok(!touches(src, key), `${name} reads or writes the dead key ${key}`);
    }
  }
  // And the ban has teeth: the live key IS matched by the same rule.
  assert.ok(touches(LANDING, 'magic_attr'), 'the matcher no longer detects a storage access at all');
});

// ---------------------------------------------------------------------------
// Behaviour. The capture is plain browser JS, so it is executed here against a
// small DOM stub rather than reasoned about.
// ---------------------------------------------------------------------------

function runCapture({ search = '', referrer = '', pathname = '/', store = {} } = {}) {
  const sessionStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  const body = captureBlock(LANDING);
  const fn = new Function('sessionStorage', 'location', 'document', 'URLSearchParams', body);
  fn(sessionStorage,
    { search, pathname, origin: 'https://magicesim.store' },
    { referrer },
    URLSearchParams);
  return store.magic_attr ? JSON.parse(store.magic_attr) : null;
}

test('a tagged arrival records the campaign', () => {
  const rec = runCapture({ search: '?utm_source=ig&utm_medium=cpc&utm_campaign=autumn', pathname: '/' });
  assert.equal(rec.utm_source, 'ig');
  assert.equal(rec.utm_medium, 'cpc');
  assert.equal(rec.utm_campaign, 'autumn');
  assert.equal(rec.entry, '/');
});

test('an untagged arrival still records the entry page and the referrer', () => {
  const rec = runCapture({ referrer: 'https://yandex.ru/search/?text=esim', pathname: '/esim/turkey/' });
  assert.equal(rec.referrer, 'https://yandex.ru/search/?text=esim');
  assert.equal(rec.entry, '/esim/turkey/');
  assert.equal(rec.utm_source, undefined);
});

test('OUR OWN referrer is not recorded — this is the bug the whole design is for', () => {
  // The country page -> landing hop. If this were recorded, every real visitor
  // would be filed as a referral from ourselves and the actual source lost.
  const rec = runCapture({ referrer: 'https://magicesim.store/esim/turkey/', pathname: '/' });
  assert.equal(rec.referrer, undefined);
  assert.equal(rec.entry, '/');

  // The origin itself, with no path, is also ours.
  assert.equal(runCapture({ referrer: 'https://magicesim.store' }).referrer, undefined);
});

test('a lookalike origin is NOT treated as ours', () => {
  // `indexOf(origin) === 0` swallowed this: somebody else's host that merely
  // starts with our origin string. Attribution from it was silently dropped.
  const rec = runCapture({ referrer: 'https://magicesim.store.evil.com/landing' });
  assert.equal(rec.referrer, 'https://magicesim.store.evil.com/landing');
});

test('FIRST touch wins: the internal hop cannot overwrite the campaign', () => {
  // The exact journey the audit measured: a tagged arrival on a country page,
  // then the buy button to the landing with no parameters at all.
  const store = {};
  runCapture({ search: '?utm_source=ig', pathname: '/esim/turkey/', store });
  runCapture({ search: '', referrer: 'https://magicesim.store/esim/turkey/', pathname: '/', store });

  const rec = JSON.parse(store.magic_attr);
  assert.equal(rec.utm_source, 'ig', 'the second page overwrote the first — first touch is not first');
  assert.equal(rec.entry, '/esim/turkey/', 'the entry page must stay the page they actually entered on');
});

test('a second tagged arrival in the same session also does not overwrite', () => {
  const store = {};
  runCapture({ search: '?utm_source=first', pathname: '/', store });
  runCapture({ search: '?utm_source=second', pathname: '/', store });
  assert.equal(JSON.parse(store.magic_attr).utm_source, 'first');
});

test('values are capped, so a hostile URL cannot fill storage or the column', () => {
  const rec = runCapture({
    search: '?utm_source=' + 'x'.repeat(5000),
    referrer: 'https://evil.example/' + 'y'.repeat(5000),
    pathname: '/' + 'z'.repeat(5000),
  });
  assert.equal(rec.utm_source.length, 200);
  assert.equal(rec.referrer.length, 500);
  assert.equal(rec.entry.length, 128);
});

test('a blocked sessionStorage is survivable — analytics never breaks a page', () => {
  const body = captureBlock(LANDING);
  const fn = new Function('sessionStorage', 'location', 'document', 'URLSearchParams', body);
  const hostile = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  assert.doesNotThrow(() => fn(hostile,
    { search: '?utm_source=ig', pathname: '/', origin: 'https://magicesim.store' },
    { referrer: '' }, URLSearchParams));
});

// ---------------------------------------------------------------------------
// The reader, and the wire to the order
// ---------------------------------------------------------------------------

test('the checkout reads the record and sends it with the order', () => {
  assert.match(LANDING, /function _coAttribution\(\)/, 'the reader is missing');
  assert.match(LANDING, /attribution:_coAttribution\(\)/,
    'the order body does not carry the attribution — this is exactly how magic_utm died');

  // The reader is inside the order body, which is inside coStartPayment.
  // Searched FORWARD from the body, not from the top of the file: an earlier
  // MagicNet.request (the promo quote) sits above this one, and slicing to it
  // produced a negative range that silently contained nothing.
  const from = LANDING.indexOf('const orderBody=JSON.stringify(');
  const body = LANDING.slice(from, LANDING.indexOf('MagicNet.request', from));
  assert.ok(body.includes('attribution:_coAttribution()'),
    'the attribution must be in the SAME body the order is created from');
});

test('the reader is total: a blocked or junk record yields an empty envelope', () => {
  const src = LANDING.slice(LANDING.indexOf('function _coAttribution()'));
  const fnBody = src.slice(src.indexOf('{'), src.indexOf('\n  }') + 4);
  const make = (store) => {
    const fn = new Function('sessionStorage', `return (function _coAttribution()${fnBody})()`);
    return fn({ getItem: () => store });
  };

  assert.deepEqual(Object.values(make(null)).filter(Boolean), []);
  assert.deepEqual(Object.values(make('not json')).filter(Boolean), []);
  assert.deepEqual(Object.values(make('[]')).filter(Boolean), []);
  assert.equal(make('{"utm_source":"ig"}').utm_source, 'ig');
});

test('the envelope carries no personal data, and cannot grow one by accident', () => {
  // The keys are listed literally in the reader. Anything not on this list is
  // not sent, so a future field added to the capture cannot leak into the order
  // body without somebody editing this list and this assertion.
  const src = LANDING.slice(LANDING.indexOf('function _coAttribution()'),
    LANDING.indexOf('async function coStartPayment('));
  const keys = [...src.matchAll(/(\w+):a\.\w+/g)].map((m) => m[1]).sort();
  assert.deepEqual(keys,
    ['entry', 'referrer', 'utm_campaign', 'utm_medium', 'utm_source']);
  for (const forbidden of ['email', 'token', 'iccid', 'order', 'phone']) {
    assert.ok(!keys.includes(forbidden), `the envelope carries ${forbidden}`);
  }
});

// ---------------------------------------------------------------------------
// The Platega handoff
// ---------------------------------------------------------------------------

test('payment_redirect fires immediately before the handoff, and after nothing', () => {
  const i = LANDING.indexOf("magicMetrikaGoal('payment_redirect'");
  const j = LANDING.indexOf('window.location.assign(data.redirect_url)');
  assert.notEqual(i, -1, 'the outbound event is missing');
  assert.ok(i < j, 'the event must fire BEFORE the navigation, or it never fires at all');

  // Nothing awaited between the two: a customer must never wait on a counter.
  const between = LANDING.slice(i, j);
  assert.ok(!between.includes('await'), 'something is awaited between the event and the payment page');
});

test('payment_redirect fires ONLY on a real payment URL, never on an error', () => {
  // The half the earlier tests did not cover: that the event is unreachable
  // from every failure path. Asserted structurally, because that is what a
  // static gate can actually prove — the call must sit INSIDE the success
  // branch, which returns before any error handling begins.
  const calls = LANDING.split("magicMetrikaGoal('payment_redirect'").length - 1;
  assert.equal(calls, 1, 'more than one call site: one of them is not the guarded path');

  const guard = LANDING.indexOf('if(resp.ok&&data.redirect_url&&allowedRedirect(data.redirect_url))');
  const goal = LANDING.indexOf("magicMetrikaGoal('payment_redirect'");
  const assign = LANDING.indexOf('window.location.assign(data.redirect_url)');
  const errors = LANDING.indexOf("data.error.indexOf('PROMO')");

  assert.notEqual(guard, -1, 'the success guard changed shape — re-read this path before trusting the goal');
  assert.ok(guard < goal, 'the goal fires before the success check: a backend error would count as a redirect');
  assert.ok(goal < assign, 'the goal must fire before the navigation');
  assert.ok(assign < errors, 'the error branches must come after the success branch returns');

  // A validation failure returns long before the request is even sent, so the
  // goal cannot be reached from it either.
  const send = LANDING.indexOf("MagicNet.request('/api/v1/public/retail-orders'");
  const emailCheck = LANDING.indexOf('Укажите корректный email');
  assert.ok(emailCheck < send, 'form validation must reject before the order is created');

  // And a second click cannot re-fire it: the submitting flag is raised before
  // the request and lowered only when the redirect did NOT happen.
  const submitTrue = LANDING.indexOf('submitting=true;');
  assert.ok(submitTrue < send, 'the double-click guard is set after the request goes out');
  assert.match(LANDING, /if\(!redirected\)\{submitting=false;/,
    'the guard is released unconditionally, so a double click could fire the goal twice');
});

test('the outbound event carries the method and nothing sensitive', () => {
  const call = LANDING.slice(LANDING.indexOf("magicMetrikaGoal('payment_redirect'"));
  const args = call.slice(0, call.indexOf('}'));
  assert.ok(args.includes('payment_method:paymentType'), 'the method is the whole point of the event');
  for (const forbidden of ['price', 'amount', 'email', 'token', 'order_id']) {
    assert.ok(!args.includes(forbidden), `payment_redirect sends ${forbidden} to a third party`);
  }
});

// ---------------------------------------------------------------------------
// The one wording change
// ---------------------------------------------------------------------------

test('the checkout says the card must be Russian, on every surface a buyer reads', () => {
  // CLAUDE.md: the only correct phrasing is «российской банковской картой или
  // через СБП». The landing was the one page that never said it — and it is the
  // only page that can take money.
  const checkout = LANDING.slice(LANDING.indexOf('id="coMethodSbp"'), LANDING.indexOf('id="coPay"') + 4000);
  assert.match(checkout, /Российская карта/, 'the card chip does not say the card must be Russian');
  assert.match(LANDING, /СБП или российская банковская карта/, 'the note under the button still says «банковская карта»');
  assert.match(LANDING, /Оплатить российской картой/, 'the pay button label still says «Оплатить картой»');
});

test('and it never claims a foreign card works', () => {
  for (const forbidden of ['любой картой', 'любая карта', 'карта любого банка',
    'иностранной картой', 'международной картой', 'зарубежной картой']) {
    assert.ok(!LANDING.toLowerCase().includes(forbidden.toLowerCase()),
      `the landing says «${forbidden}»`);
  }
});

test('СБП wording is untouched', () => {
  // The brief was explicit: only the card method changes.
  assert.match(LANDING, /Оплатить по СБП/);
  assert.match(LANDING, /id="coMethodSbp"[^>]*>[\s\S]{0,200}?СБП/);
});

// ---------------------------------------------------------------------------
// The Mini App call sites
// ---------------------------------------------------------------------------

const UI = read('app/ui.js');

/** Every event name app/ui.js can emit, including through a ternary. */
function uiEventNames() {
  const names = new Set();
  for (const m of UI.matchAll(/api\.track\(\s*'(\w+)'/g)) names.add(m[1]);
  // `api.track(name === 'country' ? 'country_view' : 'checkout_open', …)` —
  // the coalesced call. Anchored to the opening paren so a ternary sitting in
  // the PARAMS object cannot be mistaken for an event name.
  for (const m of UI.matchAll(/api\.track\(\s*[^,()]*\?\s*'(\w+)'\s*:\s*'(\w+)'/g)) {
    names.add(m[1]); names.add(m[2]);
  }
  return [...names].sort();
}

test('every Mini App event call is guarded against a null api', () => {
  // `let api = null` until boot() constructs it, and show() — the most-called
  // function in the app — is reachable from event handlers and error paths
  // before that. An unguarded `api.track(...)` there throws «Cannot read
  // properties of null», which would make the one thing that must never break
  // the app the thing that breaks it.
  const calls = [...UI.matchAll(/(.{0,12})api\.track\(/g)].map((m) => m[1]);
  assert.ok(calls.length >= 4, 'the events have disappeared');
  for (const prefix of calls) {
    assert.ok(prefix.includes('api && '), `an unguarded api.track(: «${prefix}api.track(»`);
  }
});

test('the Mini App emits exactly the whitelisted events, and no others', () => {
  // Hand-maintained on purpose: an event the backend has not agreed to is
  // dropped and logged there, so adding a name here is the moment somebody has
  // to check that lib/acquisition.js TMA_EVENTS carries it too. `channel_click`
  // (2026-09-03) is the first entry that is not a funnel step — it counts the
  // tap through to the public channel from the home screen.
  assert.deepEqual(uiEventNames(),
    ['channel_click', 'channel_subscription_check', 'channel_subscription_verified',
      'checkout_open', 'country_view', 'miniapp_open', 'payment_click', 'tariff_select']);
});

test('the channel invitation points at the channel, and opens it the app\'s own way', () => {
  // Three separate claims, because each has its own failure:
  //   * the URL is the CHANNEL — @magicesim, not either bot. Two of the four
  //     Telegram entities differ by a single underscore.
  //   * it goes through openExternal, the helper that prefers tg.openLink and
  //     therefore leaves the Mini App RUNNING. openTelegramLink closes it on
  //     several clients, which would drop the customer's session and screen.
  //   * the event fires BEFORE the handoff, or there may be no page left.
  assert.match(UI, /const CHANNEL_URL = 'https:\/\/t\.me\/magicesim';/,
    'the channel URL is gone or no longer exact');
  const handler = UI.slice(UI.indexOf("$('#promo-channel')"), UI.indexOf("$('#promo-channel')") + 400);
  assert.ok(handler.includes('openExternal(CHANNEL_URL)'), 'the channel is not opened by the app helper');
  assert.ok(!handler.includes('openTelegramLink'), 'openTelegramLink closes the Mini App on some clients');
  assert.ok(handler.indexOf("track('channel_click')") < handler.indexOf('openExternal'),
    'the event must fire before the handoff');
  // THE PROMO CODE IS NOT IN ANYTHING THE BROWSER DOWNLOADS. Markup, comments,
  // attributes, and the three scripts the app loads — the code arrives from the
  // server after it has confirmed the membership, and from nowhere else. A
  // build that shipped it and merely hid it would pass every visual test.
  const CODE = 'WELCOME' + '10';
  for (const f of [['app', 'index.html'], ['app', 'ui.js'], ['app', 'core.js'], ['app', 'locales.js']]) {
    assert.ok(!readFileSync(join(ROOT, ...f), 'utf8').includes(CODE),
      `${f.join('/')} ships the promo code to the browser`);
  }
  // And the reward node starts empty.
  const html = readFileSync(join(ROOT, 'app', 'index.html'), 'utf8');
  assert.match(html, /<p class="promo__code" id="promo-reward" hidden><\/p>/,
    'the reward node is not empty in the markup');
});

test('the Mini App records no client-side purchase', () => {
  // A purchase is what the Platega webhook says it is. The app may report
  // intent to pay; it may not report success.
  assert.ok(!uiEventNames().includes('payment_success'));
  assert.ok(!UI.includes("'payment_success'"), 'the name must not appear in the app at all');
});

test('repeat screen views are coalesced, so the funnel counts views and not fidgeting', () => {
  // show() is re-entered by goBack() and by the sort toggle. Without the guard
  // tariff -> back -> country counted a second country_view, and every re-sort
  // counted another — and each repeat was also a request.
  assert.match(UI, /let lastScreenEvent = null;/, 'the coalescing state is gone');
  assert.match(UI, /key !== lastScreenEvent/, 'the coalescing check is gone');
  assert.match(UI, /lastScreenEvent = key;/, 'the key is never remembered, so nothing coalesces');
});

test('miniapp_open is counted where a session is minted, not in one caller', () => {
  // It lived in boot(), which is one of three call sites: the «проверить ещё
  // раз» recovery and the re-auth path both mint a session without passing
  // through it. A customer whose first attempt failed on a cold gateway was
  // never counted as an open while still being counted at every later step —
  // a denominator smaller than its own numerators, which reads as a conversion
  // rate and is not one.
  assert.equal((UI.match(/miniapp_open/g) || []).length, 1,
    'there must be exactly one place that counts a launch');
  const authFn = UI.slice(UI.indexOf('async function authenticate()'),
    UI.indexOf('async function boot()'));
  assert.match(authFn, /api\.openSession\(initData\)/);
  assert.match(authFn, /miniapp_open/, 'the launch must be counted where the session is minted');
  assert.match(UI, /let opened = false;/, 'a re-auth mid-session must not count as a second launch');
});

test('the Mini App beacon has the same timeout as every other request', () => {
  // Bypassing once() was right about retries and wrong about the abort timer
  // that lives in the same function — this was the one request in the app with
  // no cap, on a surface whose customers are by definition roaming.
  const core = read('app/core.js');
  const fn = core.slice(core.indexOf('function track(event, props)'),
    core.indexOf('function track(event, props)') + 2500);
  assert.match(fn, /AbortController/, 'the beacon can hang forever');
  assert.match(fn, /REQUEST_TIMEOUT_MS/, 'the beacon uses its own timeout instead of the shared one');
  assert.match(fn, /clearTimeout\(timer\)/, 'the timer is never cleared');
  assert.match(fn, /keepalive: true/, 'the beacon must survive the payment redirect');
});

// ---------------------------------------------------------------------------
// The payment-method rule, on every surface that can take money
//
// CLAUDE.md states it once and it applies everywhere: «оплата российской
// банковской картой или через СБП», and nothing may imply a foreign card works.
// It was true on the 46 authored country pages and false on all three surfaces
// where somebody actually pays — the public checkout, the Mini App and /pay/ —
// which is the wrong way round. This asserts the rule where the money is.
// ---------------------------------------------------------------------------

const PAYING_SURFACES = [
  ['public checkout', 'index.html'],
  ['Mini App markup', 'app/index.html'],
  ['Mini App locales', 'app/locales.js'],
  ['private pay', '404.html'],
];

/**
 * A card label a buyer reads, qualified or not.
 *
 * Extracted rather than eyeballed, because the thing that regresses here is not
 * an exotic phrase — it is the plain word. `Карта`, `Банковская карта`, `Card`,
 * `Bank card`: every one of them was live on some paying surface this morning,
 * and none of them contains anything a forbidden-phrase list would catch.
 */
function unqualifiedCardLabels(src) {
  const candidates = [
    // Quoted strings: locales, the pay page's label maps.
    ...[...src.matchAll(/'([^'\n]{1,60})'/g)].map((m) => m[1]),
    // Element text: the checkout chips and the static Mini App markup.
    ...[...src.matchAll(/>([^<>\n]{1,60})</g)].map((m) => m[1]),
  ].map((t) => t.trim());

  return candidates.filter((t) => {
    // A payment LABEL, not prose that happens to contain the word. Russian
    // «карта» also means map and chart — «карты, мессенджеры и сервисы» is about
    // maps — so a label is short and is about paying or is the word itself.
    if (!/^[^.!?]{1,40}$/.test(t)) return false;
    if (!/(карт|card)/i.test(t)) return false;
    if (/sim|покрыт|coverage/i.test(t)) return false;
    // Identifiers are not labels. `card`, `coMethodCard`, `payment_card_click`
    // and `data-method="card"` all contain the word and none of them is read by
    // a human: a code token starts lowercase and has no space, while a label is
    // either Cyrillic, capitalised, or several words.
    if (/^[a-z][A-Za-z0-9_-]*$/.test(t)) return false;
    if (!/(оплат|pay|карта$|картой|card$)/i.test(t)) return false;
    return !/(росси[йи]ск|russian)/i.test(t);
  });
}

test('the rule can fail — it fires on every label this change removed', () => {
  // FIRST, before the corpus is checked, because a rule that cannot fail is
  // worse than no rule: it reports clean forever. The previous version of this
  // test banned eight phrases — «любой картой», «any card» and friends — not one
  // of which has ever appeared in this repo. It passed vacuously while the
  // actual defect sat on three surfaces.
  for (const removed of ["'Карта'", "'Банковская карта'", "'Card'", "'Bank card'",
    "card:'Оплата картой'", "card:'Оплатить картой'", '>Карта<']) {
    assert.ok(unqualifiedCardLabels(removed).length > 0,
      `the rule does not fire on a label it exists to catch: ${removed}`);
  }
  // And it does not fire on the corrected forms, or on prose about maps.
  for (const fine of ["'Российская карта'", "'Russian card'", "'СБП'", "'SBP'",
    '>Российская карта<', 'оплатите тариф — карты, мессенджеры и сервисы под рукой']) {
    assert.deepEqual(unqualifiedCardLabels(fine), [],
      `the rule fires on something correct: ${fine}`);
  }
});

test('no paying surface carries an unqualified card label', () => {
  for (const [name, file] of PAYING_SURFACES) {
    const bad = unqualifiedCardLabels(read(file));
    assert.deepEqual(bad, [], `${name} has card labels without the qualifier: ${JSON.stringify(bad)}`);
  }
});

test('and none of them implies a foreign card works', () => {
  // Kept as a second, narrower net. It has never caught anything and is not
  // expected to; it exists because «любой картой» is the one phrasing CLAUDE.md
  // names explicitly, and a rule the project states by name should be asserted
  // by name even when nothing violates it today.
  for (const [name, file] of PAYING_SURFACES) {
    const src = read(file).toLowerCase();
    for (const forbidden of ['любой картой', 'любая карта', 'карта любого банка',
      'иностранной картой', 'международной картой', 'зарубежной картой',
      'any card', 'any bank card']) {
      assert.ok(!src.includes(forbidden), `${name} says «${forbidden}»`);
    }
  }
});

test('every surface that takes money names the restriction', () => {
  /*
   * Positive assertions on the actual strings, rather than a scan.
   *
   * The scan was tried first and produced a false positive that is worth
   * recording: «Выберите страну, оплатите тариф … — карты, мессенджеры и
   * сервисы» is about MAPS. Russian «карта» means map, card and chart, and any
   * heuristic over prose will keep tripping on that. The labels are few and
   * they are known, so naming them is both honest and stable — and a new
   * payment label added without the qualifier is caught by the forbidden-phrase
   * test above plus review, which is the right division of labour.
   */
  const landing = read('index.html');
  assert.match(landing, /Российская карта/, 'public checkout: the method chip');
  assert.match(landing, /Оплатить российской картой/, 'public checkout: the pay button');
  assert.match(landing, /СБП или российская банковская карта/, 'public checkout: the note');

  const miniMarkup = read('app/index.html');
  assert.match(miniMarkup, /data-i18n="checkout\.card">Российская карта</,
    'Mini App: the chip the FIRST PAINT shows, before i18n runs');
  assert.match(miniMarkup, /Оплата через СБП или российской банковской картой/,
    'Mini App: the home note at first paint');

  const locales = read('app/locales.js');
  assert.match(locales, /'checkout\.card': 'Российская карта'/, 'Mini App RU: purchase');
  assert.match(locales, /'topup\.card': 'Российская карта'/, 'Mini App RU: top-up');
  assert.match(locales, /'checkout\.card': 'Russian card'/, 'Mini App EN: purchase');
  assert.match(locales, /'topup\.card': 'Russian card'/, 'Mini App EN: top-up');
  assert.match(locales, /Оплата через СБП или российской банковской картой/, 'Mini App RU: home note');
  assert.match(locales, /Pay via SBP or with a Russian bank card/, 'Mini App EN: home note');

  const pay = read('404.html');
  assert.match(pay, /label:'Российская карта'/, '/pay/: the fallback method list');
  assert.match(pay, /card:'Оплата российской картой'/, '/pay/: the method label');
  assert.match(pay, /card:'Оплатить российской картой'/, '/pay/: the CTA');
});

test('the Mini App has TWO pickers and both were corrected', () => {
  // Easy to miss: the purchase checkout reads checkout.card, the top-up reads
  // topup.card, and they had different wording («Карта» against «Банковская
  // карта»). Fixing one and not the other would leave a buyer told different
  // things about the same rail depending on which screen they reached.
  const ui = read('app/ui.js');
  assert.match(ui, /methodButton\('card', t\('topup\.card'\)\)/, 'the top-up picker still reads topup.card');
  assert.match(read('app/index.html'), /data-i18n="checkout\.card"/, 'the purchase picker still reads checkout.card');

  const locales = read('app/locales.js');
  const ruCard = [...locales.matchAll(/'(?:checkout|topup)\.card': '([^']+)'/g)].map((m) => m[1]);
  assert.equal(ruCard.length, 4, 'expected two keys in two languages');
  for (const label of ruCard) {
    assert.match(label, /росси[йи]ск|Russian/i, `a picker label without the qualifier: «${label}»`);
  }
});

test('SBP wording is untouched on every surface', () => {
  // The brief was explicit: only the card method changes.
  assert.match(read('index.html'), /Оплатить по СБП/);
  assert.match(read('app/locales.js'), /'checkout\.sbp': 'СБП'/);
  assert.match(read('app/locales.js'), /'checkout\.sbp': 'SBP'/);
  assert.match(read('404.html'), /Оплатить через СБП/);
});
