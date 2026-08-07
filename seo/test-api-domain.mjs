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
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

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

test('the gateway spec is the only place the Render origin is named', () => {
  // The upstream belongs in server-side config, never in anything a browser loads.
  const spec = read('infra/yandex-api-gateway/retail-proxy.yaml');
  assert.match(spec, RENDER_RE, 'the spec must pin the upstream explicitly');
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

test('every endpoint the frontend calls is declared in the gateway allowlist', () => {
  const spec = read('infra/yandex-api-gateway/retail-proxy.yaml');
  const declared = [...spec.matchAll(/^ {2}(\/[^:\n]+):$/gm)].map((m) => m[1]);

  // Paths the storefront actually requests, with {token} normalised.
  const required = [
    '/api/v1/retail/packages',
    '/api/v1/retail/promo/quote',
    '/api/v1/public/retail-orders',
    '/api/v1/public/retail-orders/{token}/status',
  ];
  for (const r of required) {
    assert.ok(declared.includes(r), `gateway is missing ${r}, which the storefront calls`);
  }
});

test('the allowlist excludes admin, dealer, partner and the payment webhook', () => {
  const spec = read('infra/yandex-api-gateway/retail-proxy.yaml');
  const declared = [...spec.matchAll(/^ {2}(\/[^:\n]+):$/gm)].map((m) => m[1]);
  for (const forbidden of ['/api/v1/admin', '/api/v1/dealer', '/api/v1/partner', '/api/v1/payments']) {
    const leaked = declared.filter((d) => d.startsWith(forbidden));
    assert.deepEqual(leaked, [], `${forbidden} must not be proxied: ${leaked.join(', ')}`);
  }
});

test('the gateway pins its upstream and never derives it from the request', () => {
  const spec = read('infra/yandex-api-gateway/retail-proxy.yaml');
  const integrations = (spec.match(/x-yc-apigateway-integration:/g) || []).length;
  const pinned = (spec.match(/url: https:\/\/esim-backend-3wmu\.onrender\.com/g) || []).length;
  assert.equal(integrations, pinned, 'every integration must carry a literal upstream URL');
  assert.ok(integrations >= 6, `expected at least 6 routes, found ${integrations}`);
  // No templating that could let a client choose the target.
  assert.ok(!/url:\s*\{/.test(spec), 'the upstream must never be templated from input');
});

test('CORS on the gateway allows only the storefront origin', () => {
  const spec = read('infra/yandex-api-gateway/retail-proxy.yaml');
  assert.match(spec, /origin: "https:\/\/magicesim\.store"/);
  assert.ok(!/origin: ["']?\*/.test(spec), 'a wildcard origin would undo the backend policy');
  for (const m of ['GET', 'POST', 'OPTIONS']) {
    assert.match(spec, new RegExp(`- ${m}\\b`), `${m} must be allowed`);
  }
  assert.ok(!/- (PUT|DELETE|PATCH)\b/.test(spec), 'only GET/POST/OPTIONS belong here');
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
