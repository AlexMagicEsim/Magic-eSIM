/* Guards for the static catalogue fallback.
 *
 * The fallback exists because Russian networks reach GitHub Pages reliably and
 * often cannot reach the API at all. That makes two things load-bearing:
 * the cache must never become authoritative for money, and a working cache must
 * never be replaced by a worse one. Everything below defends one of those.
 *
 * The loader is executed as the real file with fetch stubbed, so a test can only
 * pass if assets/catalog-loader.js actually behaves that way.
 *
 * Run: node seo/test-catalog-fallback.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateCatalog, normalizePackage, findForbiddenKeys,
  ALLOWED_PACKAGE_FIELDS, MIN_ABSOLUTE_PACKAGES, MIN_RATIO_OF_PREVIOUS, SCHEMA_VERSION,
} from '../scripts/update-catalog-cache.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const CACHE = JSON.parse(read('assets/catalog.json'));

/* ------------------------------------------------------------- loader harness */

const pkg = (over = {}) => ({
  package_id: 'p-' + Math.random().toString(36).slice(2, 10),
  name: 'Test 1 GB', country_code: 'TH', region: 'TH',
  coverage_country_codes: ['TH'], coverage_flags: '🇹🇭',
  data_gb: 1, validity_days: 7, price: 500,
  networks: [], network_technologies: ['4G'], speed: '',
  speed_note: '', fup_policy: '', hotspot_supported: null,
  activation_policy: 'unknown', topup_available: true, ...over,
});

const catalogDoc = (packages, over = {}) => ({
  schema_version: SCHEMA_VERSION,
  generated_at: new Date().toISOString(),
  source: 'production-public-api',
  package_count: packages.length,
  packages, ...over,
});

/** Loads the real loader with a scripted fetch. Returns window.MagicCatalog. */
function loadLoader(handler) {
  const src = read('assets/catalog-loader.js');
  const calls = [];
  const win = {};
  const fakeFetch = (url, opts) => {
    calls.push(String(url).split('?')[0]);
    return handler(String(url), opts, calls.length);
  };
  class FakeAC {
    constructor() { this.signal = { aborted: false }; }
    abort() { this.signal.aborted = true; if (this._onAbort) this._onAbort(); }
  }
  new Function('window', 'fetch', 'AbortController', 'setTimeout', 'clearTimeout', 'Math', 'Date', src)(
    win, fakeFetch, FakeAC, setTimeout, clearTimeout, Math, Date,
  );
  return { api: win.MagicCatalog, calls };
}

const ok = (body) => Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify(body)) });
const status = (code) => Promise.resolve({ status: code, text: () => Promise.resolve('') });
const netFail = () => Promise.reject(Object.assign(new Error('Failed to fetch'), { name: 'TypeError' }));
const abortFail = () => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
const isLive = (u) => u.includes('/api/v1/retail/packages');

/* =============================================================== A. LIVE API */

test('A1 live succeeds first try: cache is never requested, no warning', async () => {
  const { api, calls } = loadLoader((u) => (isLive(u) ? ok({ data: [pkg()] }) : status(500)));
  const r = await api.load();
  assert.equal(r.source, 'live');
  assert.equal(r.packages.length, 1);
  assert.equal(r.generatedAt, null);
  assert.ok(!calls.some((c) => c.includes('catalog.json')), 'cache must not be fetched');
});

test('A2 first attempt fails, second succeeds: still live', async () => {
  let n = 0;
  const { api } = loadLoader((u) => {
    if (!isLive(u)) return status(500);
    return ++n === 1 ? netFail() : ok({ data: [pkg(), pkg()] });
  });
  // The retry sleeps past the race deadline, so the loader probes the cache —
  // here it is broken (500), which must NOT stop the second live attempt from
  // winning. (With a healthy cache the deadline would legitimately win instead;
  // that path is H3.)
  const r = await api.load();
  assert.equal(r.source, 'live');
  assert.equal(r.packages.length, 2);
});

test('A3 live returns an empty array: treated as failure, cache used', async () => {
  const { api } = loadLoader((u) => (isLive(u) ? ok({ data: [] }) : ok(catalogDoc([pkg()]))));
  const r = await api.load();
  assert.equal(r.source, 'cache');
});

test('A4 live returns malformed JSON: cache used', async () => {
  const { api } = loadLoader((u) => (isLive(u)
    ? Promise.resolve({ status: 200, text: () => Promise.resolve('{not json') })
    : ok(catalogDoc([pkg()]))));
  assert.equal((await api.load()).source, 'cache');
});

test('A5 live returns 5xx: cache used', async () => {
  const { api } = loadLoader((u) => (isLive(u) ? status(503) : ok(catalogDoc([pkg()]))));
  assert.equal((await api.load()).source, 'cache');
});

test('A6 live times out (AbortError): cache used, real error type recorded', async () => {
  // deadlineMs pushed out so the DEFINITIVE live failure is what triggers the
  // fallback — this guards the error-type plumbing, not the race (that is H*).
  const { api } = loadLoader((u) => (isLive(u) ? abortFail() : ok(catalogDoc([pkg()]))));
  const r = await api.load({ deadlineMs: 60000 });
  assert.equal(r.source, 'cache');
  assert.equal(r.liveError, 'timeout');
  assert.equal(r.stale, false);
  assert.equal(await r.whenLive, null, 'live already failed — no late data can arrive');
});

test('A7 network/CORS rejection: cache used, error type recorded', async () => {
  const { api } = loadLoader((u) => (isLive(u) ? netFail() : ok(catalogDoc([pkg()]))));
  const r = await api.load({ deadlineMs: 60000 });
  assert.equal(r.source, 'cache');
  assert.equal(r.liveError, 'network');
});

test('A8 live is attempted exactly twice, never more', async () => {
  const { api, calls } = loadLoader((u) => (isLive(u) ? netFail() : ok(catalogDoc([pkg()]))));
  const r = await api.load();
  await r.whenLive; // the losing live request finishes its bounded retries first
  assert.equal(calls.filter(isLive).length, 2, 'must not retry indefinitely');
});

/* =================================================================== B. CACHE */

test('B1 valid cache: source=cache, packages present, generated_at exposed', async () => {
  const doc = catalogDoc([pkg(), pkg()]);
  const { api } = loadLoader((u) => (isLive(u) ? netFail() : ok(doc)));
  const r = await api.load();
  assert.equal(r.source, 'cache');
  assert.equal(r.packages.length, 2);
  assert.equal(r.generatedAt, doc.generated_at);
});

test('B2 cache 404: structured final error, never a silent empty page', async () => {
  const { api } = loadLoader((u) => (isLive(u) ? netFail() : status(404)));
  await assert.rejects(() => api.load(), (e) => {
    assert.equal(e.source, 'none');
    assert.equal(e.liveError, 'network');
    assert.match(String(e.cacheError), /cache_http_404/);
    return true;
  });
});

test('B3 cache is malformed JSON: final error', async () => {
  const { api } = loadLoader((u) => (isLive(u) ? netFail()
    : Promise.resolve({ status: 200, text: () => Promise.resolve('<html>oops') })));
  await assert.rejects(() => api.load(), (e) => e.cacheError === 'cache_bad_json');
});

test('B4 cache with an empty package array is rejected', async () => {
  const { api } = loadLoader((u) => (isLive(u) ? netFail() : ok(catalogDoc([]))));
  await assert.rejects(() => api.load(), (e) => e.cacheError === 'cache_invalid');
});

test('B5 package_count disagreeing with the array is rejected', async () => {
  const { api } = loadLoader((u) => (isLive(u) ? netFail() : ok(catalogDoc([pkg()], { package_count: 99 }))));
  await assert.rejects(() => api.load(), (e) => e.cacheError === 'cache_invalid');
});

test('B6 unknown schema_version is rejected', async () => {
  const { api } = loadLoader((u) => (isLive(u) ? netFail() : ok(catalogDoc([pkg()], { schema_version: 2 }))));
  await assert.rejects(() => api.load(), (e) => e.cacheError === 'cache_invalid');
});

test('B7 duplicate package_id in the cache is rejected', async () => {
  const dup = pkg({ package_id: 'same' });
  const { api } = loadLoader((u) => (isLive(u) ? netFail() : ok(catalogDoc([dup, { ...dup }]))));
  await assert.rejects(() => api.load(), (e) => e.cacheError === 'cache_invalid');
});

test('B8 cache entry with a non-positive price is rejected', async () => {
  const { api } = loadLoader((u) => (isLive(u) ? netFail() : ok(catalogDoc([pkg({ price: 0 })]))));
  await assert.rejects(() => api.load(), (e) => e.cacheError === 'cache_invalid');
});

/* ===================================================== C. RETRY / REVALIDATE */

test('C1 loadLive never falls back to the cache', async () => {
  const { api, calls } = loadLoader((u) => (isLive(u) ? netFail() : ok(catalogDoc([pkg()]))));
  await assert.rejects(() => api.loadLive());
  assert.equal(calls.filter((c) => c.includes('catalog.json')).length, 0,
    'a retry/revalidate must not be satisfied by the cache');
});

test('C2 revalidatePackage returns the live price when it moved', async () => {
  const p = pkg({ package_id: 'x1', price: 2800 });
  const { api } = loadLoader((u) => (isLive(u) ? ok({ data: [p] }) : status(500)));
  const r = await api.revalidatePackage('x1', 2500);
  assert.equal(r.ok, true);
  assert.equal(r.priceChanged, true);
  assert.equal(r.previousPrice, 2500);
  assert.equal(r.pkg.price, 2800);
});

test('C3 revalidatePackage reports an unchanged price as unchanged', async () => {
  const p = pkg({ package_id: 'x2', price: 900 });
  const { api } = loadLoader((u) => (isLive(u) ? ok({ data: [p] }) : status(500)));
  const r = await api.revalidatePackage('x2', 900);
  assert.equal(r.priceChanged, false);
});

test('C4 package missing from the live catalogue -> gone', async () => {
  const { api } = loadLoader((u) => (isLive(u) ? ok({ data: [pkg({ package_id: 'other' })] }) : status(500)));
  const r = await api.revalidatePackage('deactivated-id', 500);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'gone');
});

test('C5 backend unreachable -> unreachable, so checkout can refuse', async () => {
  const { api } = loadLoader((u) => (isLive(u) ? netFail() : ok(catalogDoc([pkg()]))));
  const r = await api.revalidatePackage('anything', 500);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unreachable');
});

/* ============================================== D. CHECKOUT SAFETY (sources) */

test('D1 the order request carries package_id and no price', () => {
  const s = read('index.html');
  const at = s.indexOf('/api/v1/public/retail-orders');
  assert.ok(at > 0, 'order endpoint call not found');
  const start = s.indexOf('body:JSON.stringify({', at);
  assert.ok(start > 0, 'order payload not found');
  // Take the object literal by brace balance rather than guessing at whitespace.
  let depth = 0, end = start;
  for (let i = s.indexOf('{', start); i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (!depth) { end = i + 1; break; } }
  }
  const payload = s.slice(start, end);
  assert.ok(payload.length > 20, 'payload extraction failed');
  assert.match(payload, /package_id:/);
  for (const banned of ['price', 'amount', 'retail_price', 'total', 'sum']) {
    assert.ok(!new RegExp(`\\b${banned}\\s*:`).test(payload),
      `checkout must not send ${banned} — the server decides the amount`);
  }
});

test('D2 buying from a cached card revalidates first and can refuse to open', () => {
  const s = read('index.html');
  assert.match(s, /catalogSource!=='cache'/, 'live cards must skip the extra round-trip');
  assert.match(s, /MagicCatalog\.revalidatePackage/);
  assert.match(s, /showCheckoutBlocked/);
  // the refusal path must not open checkout
  const handler = s.slice(s.indexOf("closest('.js-buy')"), s.indexOf("closest('.js-buy')") + 1800);
  const blocked = handler.slice(handler.indexOf('if(!check.ok)'), handler.indexOf('if(!check.ok)') + 140);
  assert.ok(!/openCheckout/.test(blocked), 'a failed revalidation must not open checkout');
});

test('D3 a changed price is shown before payment', () => {
  const s = read('index.html');
  assert.match(s, /d\.price=String\(check\.pkg\.price\)/, 'checkout must use the live price');
  assert.match(s, /showPriceChanged/);
  assert.match(s, /Цена этого тарифа изменилась/);
});

test('D4 country pages have no checkout at all', () => {
  const s = read('assets/country-tariffs.js');
  for (const marker of ['retail-orders', 'openCheckout', 'coPay']) {
    assert.ok(!s.includes(marker), `country pages must not contain ${marker}`);
  }
});

/* ================================================== E. GENERATOR / DATA SAFETY */

test('E1 the shipped cache exposes only allowlisted fields', () => {
  const seen = new Set();
  for (const p of CACHE.packages) Object.keys(p).forEach((k) => seen.add(k));
  const extra = [...seen].filter((k) => !ALLOWED_PACKAGE_FIELDS.includes(k));
  assert.deepEqual(extra, [], `unexpected fields in catalog.json: ${extra.join(', ')}`);
});

test('E2 the shipped cache carries no cost, margin, provider ids or PII keys', () => {
  assert.deepEqual(findForbiddenKeys(CACHE), []);
  const raw = read('assets/catalog.json');
  assert.ok(!raw.includes('@'), 'no address-like strings');
  for (const k of ['purchase_price', 'dealer_price', 'provider_product_id', 'provider_payload', 'is_active']) {
    assert.ok(!raw.includes(`"${k}"`), `${k} must not appear as a key`);
  }
});

test('E3 normalizePackage drops everything outside the allowlist', () => {
  const out = normalizePackage({
    package_id: 'a', name: 'n', price: 1, data_gb: 1, validity_days: 1,
    dealer_price_rub: 999, purchase_price_usd: 12.5, provider_product_id: 'secret',
    provider_payload: { deep: { api_key: 'x' } }, is_active: true, internal_note: 'x',
  });
  assert.deepEqual(Object.keys(out).sort(), ['data_gb', 'name', 'package_id', 'price', 'validity_days']);
  assert.deepEqual(findForbiddenKeys(out), []);
});

test('E4 the shipped cache passes the generator validator', () => {
  assert.deepEqual(validateCatalog(CACHE), []);
});

test('E5 a suspiciously small catalogue is rejected against the previous count', () => {
  const small = catalogDoc(Array.from({ length: 120 }, () => pkg()));
  assert.deepEqual(validateCatalog(small, { previousCount: 120 }), [], 'stable count is fine');
  const errs = validateCatalog(small, { previousCount: 240 });
  assert.ok(errs.some((e) => /under 70%/.test(e)), `expected a ratio failure, got: ${errs.join('; ')}`);
});

test('E6 a catalogue under the absolute floor is rejected even with no previous', () => {
  const tiny = catalogDoc(Array.from({ length: MIN_ABSOLUTE_PACKAGES - 1 }, () => pkg()));
  assert.ok(validateCatalog(tiny).some((e) => new RegExp(`below the ${MIN_ABSOLUTE_PACKAGES} floor`).test(e)));
});

test('E7 duplicate ids and bad prices are rejected by the generator too', () => {
  const dup = pkg({ package_id: 'same' });
  assert.ok(validateCatalog(catalogDoc([dup, { ...dup }])).some((e) => /duplicated/.test(e)));
  assert.ok(validateCatalog(catalogDoc([pkg({ price: -5 })])).some((e) => /price/.test(e)));
});

test('E8 a forbidden key anywhere fails validation', () => {
  const bad = catalogDoc([{ ...pkg(), dealer_price_rub: 100 }]);
  const errs = validateCatalog(bad);
  assert.ok(errs.some((e) => /forbidden keys/.test(e) || /not in the allowlist/.test(e)));
});

test('E9 the generator never overwrites a good cache on failure', () => {
  // The failure paths all return before renameSync; assert that structurally.
  const src = read('scripts/update-catalog-cache.mjs');
  const update = src.slice(src.indexOf('async function runUpdate'));
  const renameIdx = update.indexOf('renameSync(TMP, OUT)');
  assert.ok(renameIdx > 0, 'atomic rename must exist');
  const before = update.slice(0, renameIdx);
  assert.ok(before.includes('НЕ ТРОНУТ'), 'failure paths must say the file was left alone');
  // every early return on failure happens before the rename
  assert.ok((before.match(/return 1;/g) || []).length >= 2, 'failures must return before the rename');
});

test('E10 an unchanged catalogue produces no write and no commit', () => {
  const src = read('scripts/update-catalog-cache.mjs');
  assert.match(src, /contentFingerprint\(previous\) === contentFingerprint\(doc\)/);
  assert.match(src, /коммит не нужен/);
  // the fingerprint must exclude generated_at, or every run would look changed
  const fp = src.slice(src.indexOf('function contentFingerprint'), src.indexOf('function contentFingerprint') + 260);
  assert.ok(!fp.includes('generated_at'), 'generated_at must not be part of the fingerprint');
});

/* ============================================================== F. WORKFLOW */

test('F1 the refresh workflow cannot retrigger itself and needs no secret', () => {
  const wf = read('.github/workflows/refresh-catalog-cache.yml');
  assert.ok(!/^\s+push:/m.test(wf), 'a push trigger would let its own commit restart it');
  assert.ok(!/secrets\./.test(wf), 'the job must need no secret');
  assert.match(wf, /permissions:\s*\n\s*contents:\s*write/);
  assert.equal((wf.match(/- cron:/g) || []).length, 6, 'six runs a day, matching the provider sync');
  assert.match(wf, /git add assets\/catalog\.json/);
  assert.ok(!/git add \.\s/.test(wf), 'never stage everything');
  assert.match(wf, /git diff --quiet -- assets\/catalog\.json/, 'commit only when it changed');
  assert.match(wf, /--check/, 'the committed file must be re-validated');
});

/* ================================================== G. PAGES WIRED CORRECTLY */

test('G1 landing and every country page load the shared loader', () => {
  assert.match(read('index.html'), /<script src="\/assets\/catalog-loader\.js" defer><\/script>/);
  for (const slug of ['thailand', 'turkey', 'china', 'uae', 'vietnam', 'france', 'egypt', 'japan']) {
    assert.match(read(`esim/${slug}/index.html`), /catalog-loader\.js/, `${slug} must load the loader`);
  }
  assert.match(read('seo/build-country-pages.mjs'), /catalog-loader\.js/, 'generator must keep emitting it');
});

test('G2 the fallback logic lives in one place only', () => {
  // Neither page may reimplement the cache path; they must call the shared module.
  for (const f of ['index.html', 'assets/country-tariffs.js']) {
    const s = read(f);
    assert.match(s, /MagicCatalog\.load\(/, `${f} must use the shared loader`);
    assert.ok(!s.includes('catalog.json'), `${f} must not fetch the cache itself`);
  }
});

test('G3 both pages surface the stale notice and a retry control', () => {
  for (const f of ['index.html', 'assets/country-tariffs.js']) {
    const s = read(f);
    assert.match(s, /Показаны ранее сохранённые тарифы/, `${f} missing the stale-cache notice`);
    assert.match(s, /Не удалось загрузить тарифы\. Это может быть связано с временными ограничениями сети/, `${f} missing the final message`);
    assert.match(s, /catalogRetryInFlight/, `${f} must guard against repeated retry clicks`);
    // A FRESH snapshot renders with no banner at all — the notice must be
    // reachable only through the stale branch.
    assert.match(s, /result\.stale/, `${f} must gate the notice on staleness`);
  }
});

test('G4 the notice never claims there are no tariffs', () => {
  for (const f of ['index.html', 'assets/country-tariffs.js']) {
    const s = read(f);
    assert.ok(!/тарифов нет|нет доступных тарифов|тарифы отсутствуют/i.test(s), `${f} must not claim the catalogue is empty`);
  }
});

/* ================================================= H. FAIL-FAST DEADLINE RACE
 *
 * The race exists so a TD-55 connection stall (5-12s) never translates into an
 * empty tariff list. These tests use REAL timers with small injected deadlines,
 * so every claim about ordering is a claim about actual asynchrony.
 */

const delayed = (ms, make) => new Promise((res) => setTimeout(() => res(make()), ms));
const now = () => Date.now();

test('H1 fast API (~30ms) wins the race; the cache is never even requested', async () => {
  const { api, calls } = loadLoader((u) =>
    (isLive(u) ? delayed(30, () => ok({ data: [pkg()] })) : ok(catalogDoc([pkg()]))).then((x) => x));
  const r = await api.load({ deadlineMs: 300 });
  assert.equal(r.source, 'live');
  assert.equal(r.metrics.fallbackTriggered, false);
  assert.ok(r.metrics.apiLatencyMs >= 20, 'latency is measured');
  assert.equal(calls.filter((c) => c.includes('catalog.json')).length, 0, 'no cache probe on a fast win');
  assert.equal(await r.whenLive, null);
});

test('H2 API slower but inside the deadline still wins', async () => {
  const { api } = loadLoader((u) =>
    (isLive(u) ? delayed(150, () => ok({ data: [pkg(), pkg()] })) : ok(catalogDoc([pkg()]))));
  const r = await api.load({ deadlineMs: 400 });
  assert.equal(r.source, 'live');
  assert.equal(r.packages.length, 2);
});

test('H3 API slower than the deadline: fresh snapshot renders at ~deadline, live continues', async () => {
  const livePkgs = [pkg(), pkg(), pkg()];
  const { api } = loadLoader((u) =>
    (isLive(u) ? delayed(600, () => ok({ data: livePkgs })) : ok(catalogDoc([pkg()]))));
  const t0 = now();
  const r = await api.load({ deadlineMs: 120 });
  const elapsed = now() - t0;
  assert.equal(r.source, 'cache');
  assert.equal(r.liveError, 'race_deadline');
  assert.equal(r.stale, false);
  assert.equal(r.metrics.fallbackTriggered, true);
  assert.ok(elapsed < 450, `cards must appear near the deadline, took ${elapsed}ms`);
  const late = await r.whenLive;
  assert.ok(late && late.packages.length === 3, 'the losing live request still delivers for the next render');
  assert.ok(late.latencyMs >= 550, 'late latency is the real one');
});

test('H4 a stale snapshot never wins the race — the page waits for the live API', async () => {
  const staleDoc = catalogDoc([pkg()], { generated_at: new Date(now() - 60 * 3600000).toISOString() });
  const { api } = loadLoader((u) =>
    (isLive(u) ? delayed(300, () => ok({ data: [pkg(), pkg()] })) : ok(staleDoc)));
  const r = await api.load({ deadlineMs: 60, staleMaxHours: 48 });
  assert.equal(r.source, 'live', 'stale cache must not pre-empt a running live request');
  assert.equal(r.packages.length, 2);
});

test('H5 a stale snapshot IS used when the live API definitively fails, and says so', async () => {
  const staleDoc = catalogDoc([pkg()], { generated_at: new Date(now() - 60 * 3600000).toISOString() });
  const { api } = loadLoader((u) => (isLive(u) ? status(502) : ok(staleDoc)));
  const r = await api.load({ deadlineMs: 60, staleMaxHours: 48 });
  assert.equal(r.source, 'cache');
  assert.equal(r.stale, true, 'the caller must be told the snapshot is old');
  assert.equal(r.liveError, 'http_5xx');
});

test('H6 broken cache at the deadline: the live request stays the only hope and wins late', async () => {
  const { api } = loadLoader((u) =>
    (isLive(u) ? delayed(300, () => ok({ data: [pkg()] })) : status(404)));
  const r = await api.load({ deadlineMs: 60 });
  assert.equal(r.source, 'live');
});

test('H7 whenLive resolves null when the late live request also fails — it never rejects', async () => {
  let liveCalls = 0;
  const { api } = loadLoader((u) => {
    if (!isLive(u)) return ok(catalogDoc([pkg()]));
    liveCalls++;
    return delayed(200, () => null).then(() => netFail());
  });
  const r = await api.load({ deadlineMs: 60 });
  assert.equal(r.source, 'cache');
  assert.equal(await r.whenLive, null, 'a failed late request surfaces as null, never as an unhandled rejection');
  assert.ok(liveCalls >= 1);
});

test('H8 the race result exposes the metrics the pages report', async () => {
  const { api } = loadLoader((u) =>
    (isLive(u) ? delayed(400, () => ok({ data: [pkg()] })) : ok(catalogDoc([pkg()]))));
  const r = await api.load({ deadlineMs: 100 });
  assert.equal(typeof r.metrics.deadlineMs, 'number');
  assert.equal(typeof r.metrics.staticAgeMs, 'number');
  assert.equal(r.metrics.apiLatencyMs, null, 'live has not settled at render time');
  await r.whenLive;
});

test('H9 late live data must feed the NEXT render only: no re-render, no source flip', () => {
  for (const f of ['index.html', 'assets/country-tariffs.js']) {
    const s = read(f);
    const i = s.indexOf('whenLive.then');
    assert.ok(i > 0, `${f} must consume whenLive`);
    // The handler body ends at the callback's closing `});` — bound the window
    // there so surrounding page code cannot leak into the assertion.
    const end = s.indexOf('});', i);
    assert.ok(end > i, `${f}: whenLive handler must be a bounded callback`);
    const body = s.slice(i, end);
    assert.ok(!/renderPackages\s*\(|renderCountrySplit\s*\(|renderCountryChips\s*\(/.test(body),
      `${f}: the late-live handler must not re-render (flicker, card swaps)`);
    assert.ok(!/catalogSource\s*=/.test(body),
      `${f}: the late-live handler must not flip catalogSource — a snapshot-rendered card must keep revalidating at checkout`);
  }
});

test('H10 the production deadline stays in the measured sweet spot', () => {
  const src = read('assets/catalog-loader.js');
  const m = src.match(/RACE_DEADLINE_MS\s*=\s*(\d+)/);
  assert.ok(m, 'deadline constant must exist');
  const v = Number(m[1]);
  assert.ok(v >= 800 && v <= 2000,
    `deadline ${v}ms: below 800ms healthy cold responses (~1.1s p50) lose en masse; above 2000ms the fallback stops feeling fast`);
});

test('H11 cache slower than deadline while live fails meanwhile: the REAL live error is reported', async () => {
  // Interleaving: deadline fires at 50ms and starts the cache fetch (2.5s);
  // live fails definitively at ~1.2-1.6s (two instant failures + retry sleep);
  // cache then resolves fresh. The result must carry the live verdict, not the
  // deadline that merely started the fetch — and whenLive must be settled null.
  const { api } = loadLoader((u) =>
    (isLive(u) ? netFail() : delayed(2500, () => ok(catalogDoc([pkg()]))).then((x) => x)));
  const r = await api.load({ deadlineMs: 50 });
  assert.equal(r.source, 'cache');
  assert.equal(r.liveError, 'network', 'the deadline must not mask a definitive live failure');
  assert.equal(await r.whenLive, null);
  assert.equal(typeof r.metrics.apiLatencyMs, 'number', 'live settled — latency is known');
});
