// Self-serve payment page (/pay/s/<secret>) — structure, neutrality and the
// one behaviour that costs money if it regresses: a refresh must never create a
// second payment.
//
// Run: node --test seo/test-pay-page.mjs
// (NEVER `node --test seo/*.mjs` — seo/ also holds generators, and that glob
//  rewrites the generated pages as a side effect.)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const PAGE = read('404.html');

// The page's own script block (the last inline <script>).
function payScript() {
  const blocks = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  return blocks[blocks.length - 1];
}

// --------------------------------------------------------------------------
// Neutrality — the hard requirement. This page must not be attributable.
// --------------------------------------------------------------------------

test('the page carries no trace of the shop in anything a payer reads', () => {
  // Scope: what is rendered. CSS identifiers and the redirect allowlist are
  // checked separately below — a `.card` class is not a payment card, and a
  // hostname in a security allowlist is not a byline.
  const visible = PAGE
    .replace(/<style>[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');
  const strings = [...payScript().matchAll(/'([^'\\]{3,})'/g)].map((m) => m[1]).join('\n');

  for (const needle of ['Magic eSIM', 'MagicESIM', 'Magic-eSIM', 'магик', 'мэджик']) {
    const re = new RegExp(needle.replace(/[-]/g, '\\-'), 'i');
    assert.ok(!re.test(visible), `markup must not contain "${needle}"`);
    assert.ok(!re.test(strings), `no rendered string may contain "${needle}"`);
  }
  for (const needle of ['тариф', 'каталог', 'гигабайт', 'трафик', 'роуминг', 'сим-карт']) {
    const re = new RegExp(needle, 'i');
    assert.ok(!re.test(visible) && !re.test(strings), `must not mention "${needle}"`);
  }
});

test('the shop domain appears ONLY as a redirect allowlist entry', () => {
  // Two brand surfaces are outside this page's control and are recorded here so
  // a future reader does not mistake them for oversights:
  //
  //   1. The address bar. The page is served from GitHub Pages on
  //      magicesim.store, so the host is visible to anyone who looks at the URL.
  //      Removing it means a different domain, not a different page.
  //   2. The provider's own payform, reached by "Открыть оплату", shows the
  //      merchant name registered with Platega.
  //
  // What this page CAN guarantee is that it never writes the name itself. The
  // single occurrence below is a security control — the host allowlist that
  // stops the page from following a redirect anywhere else — and it is a
  // hostname in a regular expression, not a label.
  const s = payScript();
  const hits = [...s.matchAll(/magicesim/gi)];
  assert.equal(hits.length, 1, 'exactly one occurrence, and it is the allowlist');
  const around = s.slice(Math.max(0, hits[0].index - 200), hits[0].index + 60);
  assert.ok(around.includes('function allowedRedirect'), 'the occurrence is the redirect guard');
});

test('"esim" appears only inside the API hostname, never as words on the page', () => {
  // The backend origin is esim-backend-*.onrender.com and reaches this file via
  // assets/magic-net.js, not as text. Anything else would be a leak.
  const withoutScriptSrc = PAGE.replace(/<script[^>]*src="[^"]*"[^>]*>\s*<\/script>/g, '');
  const visible = withoutScriptSrc
    .replace(/<style>[\s\S]*?<\/style>/g, '')
    .replace(/<script>[\s\S]*?<\/script>/g, '');
  assert.ok(!/esim/i.test(visible), 'no eSIM wording in the page markup');
});

test('nothing links back to the shop from a payment branch', () => {
  const s = payScript();
  // The only href to "/" in this file belongs to the genuine not-found screen.
  const homeLinks = [...s.matchAll(/href="\/"/g)];
  assert.equal(homeLinks.length, 1, 'exactly one home link, and it is the 404 screen');
  const notFound = s.slice(s.indexOf('function showNotFound('));
  assert.ok(notFound.slice(0, 400).includes('href="/"'), 'the home link lives on showNotFound');

  // No payment renderer offers navigation back into the site.
  for (const fn of ['renderAmountForm', 'showCharge', 'renderPaid', 'renderClosed']) {
    const at = s.indexOf(`function ${fn}(`);
    assert.ok(at > 0, `${fn} exists`);
    const rest = s.slice(at + 1);
    const next = rest.indexOf('\n    function ');
    const body = next < 0 ? rest : rest.slice(0, next);
    assert.ok(!/href="\//.test(body), `${fn} must not link into the site`);
    assert.ok(!/support@|t\.me\/|telegram/i.test(body), `${fn} must not expose contacts`);
  }
});

test('the page is not indexable and leaks no referrer', () => {
  assert.match(PAGE, /<meta name="robots" content="noindex, nofollow, noarchive"/);
  assert.match(PAGE, /<meta name="referrer" content="no-referrer"/);
  assert.match(PAGE, /<title>Оплата<\/title>/, 'a neutral title, not a shop name');
});

test('no payment path is advertised in the sitemap or robots.txt', () => {
  if (existsSync(join(ROOT, 'sitemap.xml'))) {
    assert.ok(!/\/pay\//.test(read('sitemap.xml')), '/pay/ must not be in the sitemap');
  }
  // Deliberately NOT in robots.txt either: a Disallow line would advertise that
  // the section exists. noindex on the page is what keeps it out of an index.
  assert.ok(!/\/pay\//.test(read('robots.txt')), '/pay/ must not be named in robots.txt');
});

// --------------------------------------------------------------------------
// The form
// --------------------------------------------------------------------------

test('screen 1 offers exactly two methods and creates nothing', () => {
  const body = payScript();
  const fn = body.slice(body.indexOf('function renderMethodChoice('), body.indexOf('function renderAmountForm('));
  assert.match(fn, /Оплата по СБП/);
  assert.match(fn, /Оплата картой/);
  assert.match(fn, /data-method="/, 'each control carries the word the API expects');
  // The choice screen must not be able to create anything: no write call at all.
  assert.ok(!/pay-link\/.*charge/.test(fn), 'the choice screen never calls the create endpoint');
  assert.ok(!/method:'POST'/.test(fn));
  // Choosing hands off to the amount screen with the chosen method.
  assert.match(fn, /renderAmountForm\(secret, bounds, b\.getAttribute\('data-method'\)\)/);
});

test('screen 2 is the amount for the chosen method, and can go back', () => {
  const body = payScript();
  assert.match(body, /function renderAmountForm\(secret, bounds, method\)/, 'the method reaches screen 2');
  assert.match(body, /METHOD_CTA = \{ sbp:'Оплатить через СБП', card:'Оплатить картой' \}/);
  assert.match(body, /id="backBtn"/, 'a way back to the choice');
  assert.match(body, /backBtn.*renderMethodChoice\(secret, bounds\)/s, 'back returns to screen 1');
  // Still one amount field, integer, numeric.
  assert.match(body, /Сумма, ₽/);
  assert.match(body, /type="number"/);
  assert.match(body, /step="1"/);
});

test('going back mints a FRESH idempotency key — the method cannot be crossed', () => {
  // The hazard this closes: the key wins on the server and every other field of
  // a repeat is ignored, so reusing it after switching method would send the
  // payer to the OTHER method's checkout, silently. The key is minted inside
  // renderAmountForm, which back-then-choose re-enters.
  const body = payScript();
  const fn = body.slice(body.indexOf('function renderAmountForm('), body.indexOf('function renderPaid('));
  assert.match(fn, /var idemKey = newIdemKey\(\);/, 'the key is minted per entry to this screen');
  const mint = (fn.match(/newIdemKey\(\)/g) || []).length;
  assert.equal(mint, 1, 'exactly once per entry — not per submit, not per page');
  // And the server-side half is expected too.
  assert.match(fn, /r\.status===409/, 'a method mismatch from the server is handled');
});

test('the chosen method travels with the request', () => {
  const body = payScript();
  assert.match(body, /body: JSON\.stringify\(\{ amountRub: amount, method: method, idempotencyKey: idemKey \}\)/);
});

test('a created payment goes STRAIGHT to the provider — no screen of ours between', () => {
  const body = payScript();
  const fn = body.slice(body.indexOf('function renderAmountForm('), body.indexOf('function renderPaid('));
  const ok = fn.slice(fn.indexOf('r.body.chargeToken'));
  assert.match(ok, /window\.location\.href = r\.body\.paymentUrl/, 'redirect, not render');
  assert.match(ok, /allowedRedirect\(r\.body\.paymentUrl\)/, 'and only to an allowlisted host');
  // history is REPLACED before leaving, so Back from the provider lands on the
  // charge and never on a form that would re-offer a submit.
  const replaceAt = ok.indexOf('history.replaceState');
  const goAt = ok.indexOf('window.location.href');
  assert.ok(replaceAt > 0 && replaceAt < goAt, 'the URL is replaced before navigating away');
  assert.ok(!/showCharge\(/.test(ok), 'the old intermediate screen is not on this path');
});

test('showCharge survives only as a RECOVERY screen, never on the happy path', () => {
  // Reachable when someone lands on /pay/s/r/<token> for a charge that is still
  // pending — Back from the provider, or a bookmark. Leaving them a blank page
  // would be worse than showing the amount and a way to resume.
  const body = payScript();
  const callers = [...body.matchAll(/([A-Za-z]+)\([^)]*\)\s*;?[^\n]*\n?[^\n]*showCharge\(/g)];
  const load = body.slice(body.indexOf('function loadCharge('), body.indexOf('function loadPayLink('));
  assert.match(load, /st === 'pending'.*showCharge\(token, r\.body\)/s, 'only from a pending read');
  const submit = body.slice(body.indexOf("form.addEventListener('submit'"), body.indexOf('function renderPaid('));
  assert.ok(!/showCharge\(/.test(submit), 'never from the submit path');
});

test('the client checks the amount but never decides it', () => {
  const s = payScript();
  // A client-side check exists (courtesy), and the amount still travels to the
  // server, which validates it again.
  assert.match(s, /\/\^\\d\{1,9\}\$\//, 'integer-only client check');
  assert.match(s, /amountRub: amount/, 'the amount is sent for server validation');
  // Bounds are taken from the server response, not hardcoded as the authority.
  assert.match(s, /bounds && bounds\.minRub/);
  assert.match(s, /bounds && bounds\.maxRub/);
});

// --------------------------------------------------------------------------
// The behaviour that costs money
// --------------------------------------------------------------------------

test('a refresh can never create a second payment', () => {
  const s = payScript();
  // Creating a charge replaces the history entry with the per-charge URL, so a
  // reload lands on loadCharge (a GET) instead of the form.
  assert.match(s, /history\.replaceState\(null,'','\/pay\/s\/r\/'/);
  assert.ok(!/history\.pushState/.test(s), 'push would leave the form reachable by Back');

  // The ONLY caller of the create endpoint is the submit handler.
  const creates = [...s.matchAll(/pay-link\/'\+encodeURIComponent\(secret\)\+'\/charge/g)];
  assert.equal(creates.length, 1, 'exactly one place creates a payment');

  // Neither of the two load-on-arrival paths can create anything.
  for (const fn of ['loadCharge', 'loadPayLink']) {
    const at = s.indexOf(`function ${fn}(`);
    const rest = s.slice(at + 1);
    const next = rest.indexOf('\n    function ');
    const body = next < 0 ? rest : rest.slice(0, next);
    assert.ok(!/charge'/.test(body), `${fn} must not call the create endpoint`);
    assert.ok(!/method:'POST'/.test(body), `${fn} must be read-only`);
  }
});

test('the submit is idempotent and cannot double-fire', () => {
  const s = payScript();
  assert.match(s, /idempotencyKey: idemKey/, 'an idempotency key is sent');
  assert.match(s, /var idemKey = newIdemKey\(\);/, 'one key per filled-in form');
  assert.match(s, /crypto\.getRandomValues/, 'the key is random, not a timestamp alone');
  assert.match(s, /if\(busy\) return;/, 'a second click while in flight is ignored');
  assert.match(s, /btn\.disabled = true; input\.disabled = true;/);
  // A retry after a transport error reuses the SAME key rather than minting one.
  const submit = s.slice(s.indexOf("form.addEventListener('submit'"));
  assert.ok(!submit.slice(0, 2600).includes('newIdemKey()'), 'a retry must not mint a new key');
});

test('the result screen is read from the server, never from the query string', () => {
  const s = payScript();
  const at = s.indexOf('if(mCharge){');
  const branch = s.slice(at, at + 400);
  assert.ok(branch.includes('loadCharge('), 'the charge branch always re-reads status');
  assert.ok(!branch.includes("result==='success'"), 'the provider hint is not evidence of payment');
});

// --------------------------------------------------------------------------
// Routing and redirect safety
// --------------------------------------------------------------------------

test('routing: the two-segment self-serve paths are matched before the old link route', () => {
  const s = payScript();
  const routing = s.slice(s.indexOf('// --- routing'));
  const iCharge = routing.indexOf('if(mCharge){');
  const iSelf = routing.indexOf('} else if(mSelf){');
  const iLink = routing.indexOf('} else if(m){');
  assert.ok(iCharge > 0 && iSelf > iCharge && iLink > iSelf,
    'charge, then link secret, then the older single-segment token route');

  // The secret pattern demands real length; a bare /pay/s is not a payment page.
  assert.match(routing, /\/\^\\\/pay\\\/s\\\/\(\[A-Za-z0-9_-\]\{16,\}\)\\\/\?\$\//);
  assert.match(routing, /\/\^\\\/pay\\\/s\\\/r\\\/\(\[A-Za-z0-9_-\]\{20,\}\)\\\/\?\$\//);
});

test('the page only ever navigates to the provider or to itself', () => {
  const s = payScript();
  assert.match(s, /platega\\\.io\$/, 'the provider host is allowlisted');
  // "Открыть оплату" is rendered only for a URL that passes allowedRedirect.
  assert.match(s, /payUrl && allowedRedirect\(payUrl\)/);
  assert.match(s, /Открыть оплату/);
});

// Helper: the body of one top-level function in the page script, found by
// structure (next same-indent `function `) rather than by a byte offset — a
// fixed-length window silently stops asserting the moment the code around it
// moves, which has already happened once in this file's history.
function fnBody(src, name) {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at > 0, `${name} exists`);
  const rest = src.slice(at + 1);
  const next = rest.indexOf('\n    function ');
  return next < 0 ? rest : rest.slice(0, next);
}

// Strings the page actually renders, taken from the ONE function that renders
// the created-payment screen. Comments are stripped first: the file documents
// what was removed, and a comment must never satisfy — or break — an assertion
// about what is drawn.
function renderedText(body) {
  const code = body.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  return code;
}

test('the created-payment screen is the amount and ONE action, nothing else', () => {
  const body = renderedText(fnBody(payScript(), 'showCharge'));

  // Present: the amount, and the single action that pays it.
  assert.match(body, /money\(data\.amountRub\)/, 'the amount is rendered');
  assert.match(body, /Открыть оплату/, 'the one action is present');
  assert.match(body, /class="btn-primary"/, 'and it is the PRIMARY control, not a secondary link');

  // Absent, deliberately (owner decision 2026-08-29). Each of these was on the
  // screen before and must not drift back without a decision.
  for (const gone of [
    ['a QR image', /<img|qr\.png|class="qr/],
    ['a scan instruction', /Отсканируйте/],
    ['the «К оплате» label', /К оплате/],
    ['a status row', /Ожидаем оплату|class="status"|class="dot"/],
    ['a secondary button', /btn-alt/],
  ]) {
    assert.ok(!gone[1].test(body), `${gone[0]} must not be on this screen`);
  }

  // Exactly one clickable thing.
  assert.equal((body.match(/<a /g) || []).length, 1, 'exactly one link element');
  assert.equal((body.match(/<button/g) || []).length, 0, 'no button element besides it');
});

test('that one action opens the provider URL for THIS payment', () => {
  const body = renderedText(fnBody(payScript(), 'showCharge'));
  assert.match(body, /data\.paymentUrl/, 'the href comes from the charge, not a constant');
  assert.match(body, /allowedRedirect\(payUrl\)/, 'and only after the host allowlist accepts it');
  assert.match(body, /rel="noopener noreferrer"/);
  // A charge whose URL is missing or refused must not render a bare amount with
  // no way forward.
  assert.match(body, /canOpen\s*\?/, 'the no-URL case is handled');
});

test('removing the status ROW did not remove the status FLOW', () => {
  // The owner removed a visible element, not the mechanism: polling is what
  // carries this screen to «Оплата получена» once the webhook confirms, and the
  // status flow was explicitly out of scope for that change.
  const body = fnBody(payScript(), 'showCharge');
  assert.match(body, /pollCharge\(token\)/, 'the screen still starts polling');

  const poll = fnBody(payScript(), 'pollCharge');
  assert.match(poll, /pay-charge\/'\+encodeURIComponent\(token\)/, 'it reads the charge status');
  assert.match(poll, /st === 'paid'/);
  assert.match(poll, /renderPaid\(r\.body\)/, 'paid still switches the screen');
  assert.match(poll, /renderClosed\(r\.body\)/, 'terminal states still switch the screen');
  assert.ok(!/method:'POST'/.test(poll), 'polling stays read-only');
  // The QR refresh went with the QR: it made the server call the provider for
  // something no screen displays.
  assert.ok(!/refreshQr/.test(renderedText(poll)), 'no QR refresh is requested any more');
});

test('the paid and closed screens still say what the owner specified', () => {
  const paid = renderedText(fnBody(payScript(), 'renderPaid'));
  assert.match(paid, /Оплата получена/);
  assert.match(paid, /money\(data\.amountRub\)/, 'the paid screen shows the amount');

  const closed = renderedText(fnBody(payScript(), 'renderClosed'));
  assert.match(closed, /Создать новый платёж/, 'a failed payment can be retried by hand');
});

test('nothing anywhere on the page renders a QR any more', () => {
  const s = payScript();
  const code = s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  assert.ok(!/qr\.png/.test(code), 'the QR image endpoint is no longer called');
  assert.ok(!/<img/.test(code), 'no image element is rendered at all');
  assert.ok(!/qrKind|qrUrl/.test(code), 'the QR fields are no longer read');
});
