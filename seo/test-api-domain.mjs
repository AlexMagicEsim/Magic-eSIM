/* Guards for the single public API domain.
 *
 * The storefront must reach the backend only through https://api.magicesim.store.
 * That hostname is what DNS points at the Yandex Cloud gateway; a stray direct
 * call to the Render hostname would bypass the gateway and reintroduce exactly
 * the Russian-network failure this migration exists to fix.
 *
 * These tests do not need the gateway to exist — they pin the frontend side, so
 * the property holds before, during and after the DNS switch.
 *
 * Run: node seo/test-api-domain.mjs
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

test('no active frontend file mentions the Render hostname', () => {
  const offenders = ACTIVE_FRONTEND.filter((f) => RENDER_RE.test(read(f)));
  assert.deepEqual(offenders, [],
    `these would bypass the gateway: ${offenders.join(', ')}`);
});

test('the origin is named only in the proxy, never in anything a browser loads', () => {
  assert.equal(proxy.UPSTREAM, 'https://esim-backend-3wmu.onrender.com',
    'the proxy must pin the upstream explicitly');
  for (const f of ACTIVE_FRONTEND) {
    assert.ok(!RENDER_RE.test(read(f)), `${f} must not name the origin`);
  }
});

/* ------------------------------------------------------ every call is on-domain */

test('every API base constant is the public domain', () => {
  const bases = [];
  for (const f of ['index.html', 'assets/country-tariffs.js', 'payment-success.html', '404.html']) {
    for (const m of read(f).matchAll(/API_BASE\s*=\s*'([^']+)'/g)) bases.push({ f, url: m[1] });
  }
  assert.ok(bases.length >= 4, `expected at least 4 API_BASE declarations, found ${bases.length}`);
  for (const b of bases) assert.equal(b.url, API_DOMAIN, `${b.f} points at ${b.url}`);
});

test('the shared loader uses the public domain for live and a same-origin cache', () => {
  const s = read('assets/catalog-loader.js');
  assert.match(s, new RegExp(`API_BASE = '${API_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  // The cache must stay relative: it is served by Pages, which Russian networks reach.
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

test('the proxy forwards no credential-bearing header in either direction', () => {
  for (const h of ['authorization', 'cookie', 'x-api-key']) {
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
