/* Guards for where the storefront is allowed to send a request.
 *
 * THIS FILE ONCE ASSERTED THE OPPOSITE, and the reversal is the point.
 *
 * It used to require that the backend be reached ONLY through
 * https://api.magicesim.store, on the grounds that naming Render directly
 * «would bypass the gateway and reintroduce exactly the Russian-network failure
 * this migration exists to fix». That premise was measured and found to be
 * backwards. From assets/magic-net.js, 126 cold samples per host on 2026-08-22:
 *
 *              success   p50      p95       502   timeouts
 *   gateway     48.4%   1983ms   20844ms    16      49
 *   render      97.6%    422ms    3247ms     0       3
 *
 * The gateway is the road that fails (TD-55), so the storefront now does what
 * the Mini App always did: Render first, gateway as the second road. Four tests
 * here went red the day that landed and stayed red, because they were pinning a
 * hostname rather than the property that hostname was standing in for.
 *
 * WHAT IS PINNED NOW is stricter than what was pinned before:
 *
 *   * no page declares an API base of its own — every one goes through MagicNet,
 *     where the old rule merely required every scattered declaration to agree;
 *   * exactly two files name a backend host, and both name the SAME canonical
 *     pair in the SAME order;
 *   * the order is Render first. Reversing it silently would reintroduce TD-55,
 *     which is the failure the original rule was actually about;
 *   * no third host appears anywhere a browser loads;
 *   * the catalogue cache stays same-origin.
 *
 * Run: node --test seo/test-api-domain.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// The allowlist and CORS policy live in the proxy's code, so exercise them
// rather than pattern-matching the file.
const proxy = createRequire(import.meta.url)(
  join(ROOT, 'infra/yandex-api-gateway/proxy-function/index.js'),
)._internal;

const { handler } = createRequire(import.meta.url)(
  join(ROOT, 'infra/yandex-api-gateway/proxy-function/index.js'),
);

const API_DOMAIN = 'https://api.magicesim.store';
const RENDER_RE = /[a-z0-9-]+\.onrender\.com/i;

/** Everything the browser actually downloads. Backups and vendored copies excluded. */
const ACTIVE_FRONTEND = [
  'index.html',
  'assets/catalog-loader.js',
  'assets/country-tariffs.js',
  'payment-success.html',
  'payment-failed.html',
  '404.html',
  ...readdirSync(join(ROOT, 'esim'))
    .filter((d) => !d.includes('.'))
    .map((d) => `esim/${d}/index.html`),
];

/* ------------------------------------------------- no Render in the frontend */

// The two files allowed to name a backend host: the strategy itself, and the
// loader whose literals are its documented last-resort copy.
const ENDPOINT_OWNERS = ['assets/magic-net.js', 'assets/catalog-loader.js'];

/**
 * A backend host named where a REQUEST could be built from it.
 *
 * `<link rel="preconnect">` is excluded deliberately: it opens a socket, it
 * cannot send anything, and every country page carries one. Including it made
 * this test report 190 pages as if each had grown its own endpoint.
 */
function namesHostInCode(source) {
  const withoutLinkTags = source.replace(/<link\b[^>]*>/gi, '');
  return RENDER_RE.test(withoutLinkTags) || withoutLinkTags.includes(API_DOMAIN);
}

test('only the network strategy and its fallback copy name a backend host', () => {
  const offenders = ACTIVE_FRONTEND
    .filter((f) => !ENDPOINT_OWNERS.includes(f))
    .filter((f) => namesHostInCode(read(f)));

  assert.deepEqual(offenders, [],
    `a host named outside the strategy is a road nobody is measuring: ${offenders.join(', ')}`);
});

test('both of them name the same pair, in the same order, and no third host', () => {
  // Render first. The order is the whole finding of TD-55, and a silent swap
  // would put every Russian visitor back on the road that answered 48% of the
  // time — while every other test in this file still passed.
  const CANONICAL = ['https://esim-backend-3wmu.onrender.com', 'https://api.magicesim.store'];

  // Read from the ENDPOINT LIST, not from the file. Both files open with a
  // comment recounting the measurement that put Render first, and that prose
  // names the gateway before it names Render — so scanning the whole text
  // reported the order as reversed while the array was perfectly correct. The
  // same trap as reading a script tag's position from a comment about it.
  for (const f of ENDPOINT_OWNERS) {
    const src = read(f);
    const listStart = Math.max(src.indexOf('ENDPOINTS = ['), src.indexOf('BASES = ('));
    assert.ok(listStart > 0, `${f}: no endpoint list found`);
    const list = src.slice(listStart, listStart + 400);

    const hosts = [...list.matchAll(/https:\/\/[a-z0-9.-]+\.(?:onrender\.com|magicesim\.store)/gi)]
      .map((m) => m[0].toLowerCase());
    const unique = [...new Set(hosts)];
    assert.deepEqual(unique, CANONICAL,
      `${f} must name exactly the canonical pair, primary first — found ${unique.join(', ')}`);
  }

  // And the proxy still pins its upstream explicitly: it is the one thing that
  // legitimately talks to the origin from outside a browser.
  assert.equal(proxy.UPSTREAM, CANONICAL[0], 'the proxy must pin the upstream explicitly');
});

/* ------------------------------------------------------ every call is on-domain */

test('no page declares an API base of its own', () => {
  // Stricter than the rule this replaces. That one accepted any number of
  // scattered API_BASE constants so long as they agreed; agreement between
  // copies is a thing that holds until it does not. There is now one definition
  // of where the API lives, and the pages go through it.
  const declarers = ['index.html', 'assets/country-tariffs.js', 'payment-success.html', '404.html']
    .filter((f) => /API_BASE\s*=\s*'/.test(read(f)));

  assert.deepEqual(declarers, [],
    `these carry their own endpoint instead of using MagicNet: ${declarers.join(', ')}`);
});

test('the loader derives its endpoints from the strategy, and keeps the cache same-origin', () => {
  const s = read('assets/catalog-loader.js');

  // One definition, taken at runtime; the literals beside it are the documented
  // fallback for a page that forgot the script tag, not a second opinion.
  assert.match(s, /window\.MagicNet && window\.MagicNet\.ENDPOINTS/,
    'the loader must take the endpoint list from MagicNet');
  assert.match(s, /var API_BASE = BASES\[0\]/, 'and treat the first as primary');

  // The cache must stay relative: it is served by Pages, which Russian networks
  // reach even when both API roads are having a bad day.
  assert.match(s, /CACHE_URL = '\/assets\/catalog\.json'/);
  assert.ok(!/https?:\/\/[^'"]*catalog\.json/.test(s), 'the cache must not be fetched cross-origin');
});

test('no absolute API URL in the frontend points anywhere but the public domain', () => {
  const bad = [];
  for (const f of ACTIVE_FRONTEND) {
    for (const m of read(f).matchAll(/https:\/\/[a-z0-9.-]+\/api\/v[0-9]/gi)) {
      if (!m[0].startsWith(API_DOMAIN)) bad.push(`${f}: ${m[0]}`);
    }
  }
  assert.deepEqual(bad, [], `off-domain API calls: ${bad.join(', ')}`);
});

/* --------------------------------------------------- retry stays on the domain */

test('retry and revalidation go through the public domain, never a fallback host', () => {
  const s = read('assets/catalog-loader.js');
  // loadLive is what retry and pre-checkout revalidation both call.
  const start = s.indexOf('function loadLive');
  assert.ok(start > 0, 'loadLive not found');
  const body = s.slice(start, start + 200);
  assert.match(body, /fetchLive\(\)/);
  assert.ok(!RENDER_RE.test(body));
  // and it must not silently fall back to the cache — no backend, no checkout
  assert.ok(!/fetchCache/.test(body), 'a revalidation satisfied by cache would allow an unsafe checkout');
});

test('both pages wire retry to the shared loader rather than their own URL', () => {
  for (const f of ['index.html', 'assets/country-tariffs.js']) {
    const s = read(f);
    assert.match(s, /MagicCatalog\.loadLive\(\)/, `${f} must retry through the loader`);
    assert.ok(!RENDER_RE.test(s), `${f} must not name the origin`);
  }
});

/* ------------------------------------------------- allowlist matches real calls */

test('every endpoint the frontend calls is accepted by the proxy', () => {
  const required = [
    ['GET', '/api/v1/retail/packages'],
    ['POST', '/api/v1/retail/promo/quote'],
    ['POST', '/api/v1/public/retail-orders'],
    ['POST', '/api/v1/public/retail-orders/abc123/pay'],
    ['GET', '/api/v1/public/retail-orders/abc123/status'],
  ];
  for (const [method, path] of required) {
    assert.ok(proxy.matchRoute(method, path), `the storefront calls ${method} ${path}`);
  }
});

test('the QR path baked into past order emails still matches the allowlist', () => {
  // lib/retailEmail.js builds this URL against api.magicesim.store and the token
  // never expires, so every eSIM email already delivered depends on it. The
  // token charset is the backend's own: /^[A-Za-z0-9_-]{16,64}$/.
  const samples = ['a'.repeat(16), 'b'.repeat(64), 'Aa0_-Zz9' + 'x'.repeat(12)];
  for (const token of samples) {
    assert.ok(proxy.matchRoute('GET', `/api/v1/public/retail-esim/${token}/qr.png`),
      `a delivered email links to this token shape`);
  }
  // and it stays a read: nothing else on that prefix is exposed
  assert.equal(proxy.matchRoute('POST', '/api/v1/public/retail-esim/' + 'a'.repeat(16) + '/qr.png'), null);
  assert.equal(proxy.matchRoute('GET', '/api/v1/public/retail-esim/' + 'a'.repeat(16)), null);
});

test('the QR response can survive being proxied at all', () => {
  // The image is PNG, so the body must never be treated as text, and the
  // backend's anti-caching headers must come back intact: that response is the
  // eSIM install secret itself.
  for (const h of ['cache-control', 'pragma', 'expires', 'content-type']) {
    assert.ok(proxy.RESPONSE_HEADERS.includes(h), `${h} must be forwarded for the QR route`);
  }
});

test('the proxy refuses admin, dealer, partner and both webhooks', () => {
  const forbidden = [
    ['GET', '/api/v1/admin/packages'],
    ['POST', '/api/v1/admin/providers/sync'],
    ['GET', '/api/v1/admin/private-payment-links'],
    ['POST', '/api/v1/admin/private-payment-links/1/disable'],
    ['GET', '/api/v1/dealer/balance'],
    ['GET', '/api/v1/partner/orders'],
    // Both webhooks stay direct-to-Render on origin.magicesim.store: a payment
    // confirmation should not depend on one more hop.
    ['POST', '/api/v1/payments/platega/callback'],
    ['POST', '/api/v1/telegram/client-webhook'],
    ['GET', '/'],
  ];
  for (const [method, path] of forbidden) {
    assert.equal(proxy.matchRoute(method, path), null, `${method} ${path} must not be proxied`);
  }
});

test('the public side of private payment links is proxied, the admin side is not', () => {
  // 404.html serves /pay/ and calls these from the browser, so they hit the same
  // Russian unreachability as the storefront.
  assert.ok(proxy.matchRoute('GET', '/api/v1/public/private-payments/tok123'));
  assert.ok(proxy.matchRoute('POST', '/api/v1/public/private-payments/tok123/start'));
  // Creating, listing and disabling links is admin work and must stay off.
  assert.equal(proxy.matchRoute('POST', '/api/v1/admin/private-payment-links'), null);
  assert.equal(proxy.matchRoute('POST', '/api/v1/public/private-payments/tok123/disable'), null);
  assert.equal(proxy.matchRoute('POST', '/api/v1/public/private-payments/tok123'), null);
});

test('an allowed path is not reachable with a method it does not declare', () => {
  for (const m of ['DELETE', 'PUT', 'PATCH', 'POST']) {
    assert.equal(proxy.matchRoute(m, '/api/v1/retail/packages'), null,
      `${m} on the catalogue must be refused`);
  }
  assert.equal(proxy.matchRoute('GET', '/api/v1/public/retail-orders'), null);
});

test('a path parameter cannot escape its segment or smuggle a new one', () => {
  const hostile = [
    '/api/v1/public/retail-orders/../../admin/packages/status',
    '/api/v1/public/retail-orders/a/b/status',
    '/api/v1/public/retail-orders//status',
    '/api/v1/public/retail-orders/tok%2Fadmin/status',
    `/api/v1/public/retail-orders/${'x'.repeat(200)}/status`,
  ];
  for (const path of hostile) {
    assert.equal(proxy.matchRoute('GET', path), null, `${path} must not match`);
  }
});

test('the proxy forwards no credential-bearing header except the Mini App bearer', () => {
  // B-6 adds exactly ONE credential header: `authorization`, the Mini App
  // session bearer — deliberate, measured, and pinned by the proxy's own
  // suite. Cookies and API keys still cannot travel in either direction, and
  // set-cookie still cannot come back, so a cookie session stays impossible.
  assert.ok(proxy.REQUEST_HEADERS.includes('authorization'), 'the session bearer must travel');
  for (const h of ['cookie', 'x-api-key', 'x-telegram-init-data']) {
    assert.ok(!proxy.REQUEST_HEADERS.includes(h), `${h} must not travel upstream`);
  }
  assert.ok(!proxy.RESPONSE_HEADERS.includes('set-cookie'), 'set-cookie must not come back');
});

test('CORS names the storefront and nothing else', () => {
  const h = proxy.corsHeaders();
  assert.equal(h['Access-Control-Allow-Origin'], 'https://magicesim.store');
  assert.equal(h['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS');
  assert.ok(!/[*]/.test(JSON.stringify(h)), 'a wildcard would undo the backend policy');
  assert.ok(!('Access-Control-Allow-Credentials' in h), 'the storefront sends no credentials');
});

test('the gateway spec hands everything to the function and pins nothing itself', () => {
  // The security boundary must be the code, not the YAML: if the spec ever grows
  // its own http integration, requests would bypass the allowlist above.
  const spec = read('infra/yandex-api-gateway/retail-proxy.yaml');
  assert.ok(!/type:\s*http\b/.test(spec), 'the spec must not proxy directly to any host');
  assert.match(spec, /type: cloud_functions/);
  assert.ok(!RENDER_RE.test(spec), 'the upstream belongs in the function, not the spec');
});

/* ------------------------------------------------------------- no secrets leak */

test('the frontend carries no credentials of any kind', () => {
  const PATTERNS = [
    /Authorization\s*:\s*['"]Bearer\s+\S/i,
    /gh[pous]_[A-Za-z0-9]{20,}/,
    /api[_-]?key\s*[:=]\s*['"][^'"]{12,}/i,
    /secret\s*[:=]\s*['"][^'"]{12,}/i,
    /postgres(ql)?:\/\//i,
  ];
  for (const f of ACTIVE_FRONTEND) {
    const s = read(f);
    for (const re of PATTERNS) {
      assert.ok(!re.test(s), `${f} appears to contain a credential (${re})`);
    }
  }
});

test('the gateway spec stores no credentials either', () => {
  const spec = read('infra/yandex-api-gateway/retail-proxy.yaml');
  // Comments discuss secrets by name, which is fine — what must not exist is a
  // credential being *assigned* to something. So look at YAML values only.
  const values = spec
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n');
  const ASSIGNMENTS = [
    /api[_-]?key\s*:/i,
    /\bsecret\w*\s*:/i,
    /\btoken\s*:/i,
    /password\s*:/i,
    /authorization\s*:/i,
    /bearer\s+\S/i,
  ];
  for (const re of ASSIGNMENTS) {
    assert.ok(!re.test(values), `the spec must hold no credential (${re})`);
  }
});

/* ------------------------------------------------ a retry must never charge twice */

test('a POST is never retried once any byte reached the upstream', () => {
  // /retail-orders creates an order and /pay starts a payment; repeating one the
  // backend already received would bill a customer twice for one checkout.
  assert.equal(proxy.isRetrySafe('POST', true), false);
  assert.equal(proxy.isRetrySafe('POST', false), true, 'a failed connect is safe to retry');
  assert.equal(proxy.isRetrySafe('GET', true), true, 'reads are idempotent');
});

/* ------------------------------------------- tokens must not reach the logs */

test('a real token never survives into a log line', () => {
  // /retail-esim/{token}/qr.png is the eSIM install secret and does not expire;
  // the other two identify an order and a payment link. Cloud Logging has its
  // own retention and its own readers, so none of them belong there.
  const REAL = 'Kx7bQ2mNp9vT4wY8sL1cR6dF3hJ0zA5e';
  const paths = [
    `/api/v1/public/retail-esim/${REAL}/qr.png`,
    `/api/v1/public/retail-orders/${REAL}/status`,
    `/api/v1/public/private-payments/${REAL}`,
  ];
  for (const path of paths) {
    const route = proxy.matchRoute('GET', path);
    assert.ok(route, `${path} should be a live route`);
    const logged = proxy.logPath(path, route);
    assert.ok(!logged.includes(REAL), `${path} leaked its token as "${logged}"`);
    assert.match(logged, /\{token\}/);
  }
});

test('the masked path still identifies which route was hit', () => {
  const t = 'a'.repeat(32);
  const cases = [
    ['GET', `/api/v1/public/retail-esim/${t}/qr.png`, '/api/v1/public/retail-esim/{token}/qr.png'],
    ['GET', `/api/v1/public/retail-orders/${t}/status`, '/api/v1/public/retail-orders/{token}/status'],
    ['GET', `/api/v1/public/private-payments/${t}`, '/api/v1/public/private-payments/{token}'],
    ['POST', `/api/v1/public/private-payments/${t}/start`, '/api/v1/public/private-payments/{token}/start'],
    ['POST', `/api/v1/public/retail-orders/${t}/pay`, '/api/v1/public/retail-orders/{token}/pay'],
  ];
  for (const [method, path, expected] of cases) {
    assert.equal(proxy.logPath(path, proxy.matchRoute(method, path)), expected);
  }
});

test('token-free routes are logged exactly as they are', () => {
  for (const [method, path] of [['GET', '/health'], ['GET', '/api/v1/retail/packages'],
                                ['POST', '/api/v1/retail/promo/quote'], ['POST', '/api/v1/public/retail-orders']]) {
    assert.equal(proxy.logPath(path, proxy.matchRoute(method, path)), path);
  }
});

test('a rejected path is masked too, since it is arbitrary client input', () => {
  const REAL = 'Zq8wE3rT7yU1iO5pA9sD2fG6hJ4kL0mN';
  // A refused request can still carry a live token — a wrong method on a real
  // link, or a route that has since been removed. This is the branch where the
  // allowlist pattern is not available to fall back on.
  //
  // The mask is now an ALLOWLIST: a segment survives only if it appears
  // literally in ROUTES, everything else becomes {}. The denylist it replaced
  // was walked around three ways — a case change, a percent-encoded hyphen, and
  // simply adding a tenth route without extending the regex — and that last one
  // needs no attacker at all. The cost is accepted and asserted below: an
  // unrelated path is no longer readable in the log.
  const refused = [
    [`/api/v1/public/retail-esim/${REAL}/qr.png/extra`, '/api/v1/public/retail-esim/{}/qr.png/{}'],
    [`/api/v1/public/retail-orders/${REAL}/refund`, '/api/v1/public/retail-orders/{}/{}'],
    [`/api/v1/public/private-payments/${REAL}/disable`, '/api/v1/public/private-payments/{}/{}'],
    // the three bypasses of the old denylist
    [`/api/v1/public/RETAIL-ESIM/${REAL}/qr.png`, '/api/v1/public/{}/{}/qr.png'],
    [`/api/v1/public/retail%2Desim/${REAL}/qr.png`, '/api/v1/public/{}/{}/qr.png'],
    [`/api/v1/public/esim-install/${REAL}`, '/api/v1/public/{}/{}'],
  ];
  for (const [path, expected] of refused) {
    const logged = proxy.logPath(path, null);
    assert.ok(!logged.includes(REAL), `${path} leaked its token`);
    assert.equal(logged, expected);
  }
  // The accepted cost: an unknown path keeps its shape, not its words.
  assert.equal(proxy.logPath('/totally/unknown', null), '/{}/{}');
  // And it cannot be used to flood one log record.
  assert.ok(proxy.logPath('/' + 'x'.repeat(100000), null).length <= 260);
});

test('the handler logs the masked path, not the raw one', async () => {
  // Exercised through the real handler: a test that only calls logPath() would
  // still pass if a call site went back to logging `path` directly. The refused
  // branch returns before any network call, so this stays offline.
  const REAL = 'L1veT0ken9876543210abcdefABCDEF';
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try {
    await handler({
      httpMethod: 'GET',
      url: `/api/v1/public/retail-esim/${REAL}/qr.png/nope`,
      headers: {},
    });
  } finally {
    console.log = original;
  }
  assert.ok(lines.length, 'the handler logged nothing at all');
  const blob = lines.join('\n');
  assert.ok(!blob.includes(REAL), `the token reached the log: ${blob}`);
  assert.match(blob, /\{\}/, 'the unmatched segments must be masked');
});

test('every logging site goes through logPath', () => {
  // Belt and braces for the call sites the offline handler test cannot reach —
  // `proxied` and `error` both need a live upstream to fire.
  const src = read('infra/yandex-api-gateway/proxy-function/index.js');
  // Extracted by matching braces rather than by a length bound: the previous
  // bound was 220 characters and silently stopped seeing four of the five call
  // sites the moment the log lines grew, which is the one failure mode a guard
  // like this must not have.
  const sites = [];
  const OPEN = 'console.log(JSON.stringify({';
  for (let at = src.indexOf(OPEN); at !== -1; at = src.indexOf(OPEN, at + 1)) {
    let depth = 0;
    for (let i = src.indexOf('{', at); i < src.length; i++) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) { sites.push(src.slice(at, i + 1)); break; }
      }
    }
  }
  assert.ok(sites.length >= 4, `expected at least 4 logging sites, found ${sites.length}`);
  // One site logs the masked path indirectly, through the per-request context,
  // because it runs per upstream ATTEMPT and no longer has the matched route in
  // scope. That is allowed only because the context field is provably the output
  // of logPath and of nothing else — asserted here rather than assumed, so the
  // indirection cannot become a hole.
  const ctxAssignments = [...src.matchAll(/path: ([^,\n]+)/g)]
    .map((m) => m[1].trim())
    .filter((value) => !value.startsWith('ctx.'));
  assert.ok(ctxAssignments.length > 0, 'no direct path assignment found at all');
  for (const value of ctxAssignments) {
    assert.match(value, /^logPath\(/,
      `a path value reaches a log without masking: ${value}`);
  }

  for (const site of sites) {
    if (!/\bpath\b/.test(site)) continue;
    assert.match(site, /path: (logPath\(|ctx\.path\b)/,
      `a logging site writes path without masking it:\n${site}`);
    assert.ok(!/[,{]\s*path\s*[,}]/.test(site),
      `a logging site passes bare path via shorthand:\n${site}`);
  }
});

test('masking is driven by the allowlist, so the two cannot drift apart', () => {
  // Any route whose pattern carries {token} must log that pattern verbatim.
  const withToken = proxy.ROUTES.filter((r) => r.pattern.includes('{token}'));
  assert.ok(withToken.length >= 3, 'expected the token-bearing routes to still exist');
  for (const r of withToken) {
    const concrete = r.pattern.replace('{token}', 'S3cr3tT0k3nValue1234567890');
    const logged = proxy.logPath(concrete, proxy.matchRoute(r.method, concrete));
    assert.equal(logged, r.pattern);
    assert.ok(!logged.includes('S3cr3t'));
  }
});
