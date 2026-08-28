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

test('the form is one amount field and one SBP button — no method choice', () => {
  const s = payScript();
  assert.match(s, /Сумма, ₽/, 'the field is labelled in roubles');
  assert.match(s, /Оплатить через СБП/, 'the button names SBP');

  // No card option anywhere a payer can see it.
  //
  // Two scopes, each chosen so the assertion cannot be satisfied by accident:
  //   * page TEXT (tags stripped) for the generic word "карт", which would be a
  //     label if it appeared at all;
  //   * the WHOLE file for terms that cannot be an identifier in this codebase —
  //     a scheme name or a method-picker phrase.
  // English `card` is deliberately NOT checked: `class="card"` and
  // getElementById('card') name the panel this page draws itself on, and a
  // regex over source cannot tell that apart from prose without lying.
  const text = PAGE
    .replace(/<style>[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ');
  for (const needle of ['карт', 'банковск', '\\bмир\\b']) {
    assert.ok(!new RegExp(needle, 'i').test(text), `page text must not offer "${needle}"`);
  }
  for (const needle of ['visa', 'mastercard', 'банковская карта', 'способ оплаты', 'выберите способ', 'оплатить картой']) {
    assert.ok(!new RegExp(needle, 'i').test(PAGE), `nothing may offer "${needle}"`);
  }

  // And there is exactly one submit control on the form.
  assert.equal((s.match(/type="submit"/g) || []).length, 1);

  assert.match(s, /type="number"/);
  assert.match(s, /step="1"/);
  assert.match(s, /inputmode="numeric"/);
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

test('the QR is captioned for what it actually is', () => {
  const s = payScript();
  // Measured: the provider returns qr:null before payment, so unless the server
  // reports qrKind === 'sbp', the code is a link and must not be called an SBP
  // code. Both captions must exist and the SBP one must be conditional.
  assert.match(s, /qrKind === 'sbp'/);
  assert.match(s, /Отсканируйте код в приложении банка/);
  assert.match(s, /Отсканируйте камерой телефона, чтобы открыть оплату/);
  // The image comes from our own backend, never a third-party QR service.
  assert.match(s, /MagicNet\.primaryBase/);
  assert.match(s, /pay-charge\/' \+ encodeURIComponent\(token\) \+ '\/qr\.png/);
  for (const svc of ['api.qrserver', 'chart.googleapis', 'quickchart', 'qrcode.show']) {
    assert.ok(!PAGE.includes(svc), `no third-party QR service (${svc})`);
  }
});

test('the status wording matches the two states the owner specified', () => {
  const s = payScript();
  assert.match(s, /Ожидаем оплату/);
  assert.match(s, /Оплата получена/);
});
