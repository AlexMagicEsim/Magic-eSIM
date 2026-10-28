// Speed audit 2026-10-19 (owner's items 1, 2, 5) — the plans request starts in
// <head> on the RU country pages outside the SEO experiment, the snapshot is
// fetched only on a stall or a failure, and the EN pages load their scripts
// with defer.
//
// The loader runs as the real file with fetch stubbed (the harness of
// seo/test-catalog-fallback.mjs), plus the early request a page would hand it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFrozenPage } from './frozen-pages.mjs';
import { REGION_SLUGS } from './regions.mjs'; // static region pages (seo/regions.mjs) request nothing

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* ------------------------------------------------------------ the pages */

const countryPages = (dir) => readdirSync(join(ROOT, dir))
  .filter((s) => existsSync(join(ROOT, dir, s, 'index.html')))
  .map((s) => ({ slug: s, html: read(`${dir}/${s}/index.html`) }))
  .filter((p) => /data-country-page=/.test(p.html) || (dir === 'en/esim' && !REGION_SLUGS.includes(p.slug)));

test('RU outside the experiment: MagicNet then the early request in <head>, before the stylesheets; MagicNet loaded once', () => {
  let n = 0;
  for (const { slug, html } of countryPages('esim')) {
    n += 1;
    const head = html.slice(0, html.indexOf('</head>'));
    const net = head.indexOf('<script src="/assets/magic-net.js?v=');
    const early = head.indexOf('<script>window.__magicCatalogEarly=');
    const css = head.indexOf('<link rel="stylesheet"');
    assert.ok(net > 0 && early > net && css > early, `${slug}: magic-net.js → early request → stylesheets`);
    assert.doesNotMatch(head.slice(net, early), /defer|async/, `${slug}: MagicNet must run before the early request`);
    assert.equal((html.match(/<script src="\/assets\/magic-net\.js\?v=/g) || []).length, 1, `${slug}: MagicNet loaded once`);
    const snippet = head.slice(early, head.indexOf('</script>', early));
    // The address lives in MagicNet only (seo/test-api-domain.mjs): no host here.
    assert.doesNotMatch(snippet, /https?:\/\//, `${slug}: no host in the early request`);
    assert.match(snippet, /N\.ENDPOINTS\[0\]\.base/);
    assert.match(snippet, /'\/api\/v1\/retail\/packages\?t='/);
    assert.match(snippet, /r\.catch\(function\(\)\{\}\)/, `${slug}: an early failure is observed`);
  }
  assert.ok(n >= 180, `pages checked: ${n}`);
});

test('the ten former SEO-experiment pages make the early request too since 2026-10-24, MagicNet in <head>', () => {
  const frozen = countryPages('esim').filter((p) => isFrozenPage(p.slug));
  assert.equal(frozen.length, 10);
  for (const { slug, html } of frozen) {
    assert.match(html, /__magicCatalogEarly/, slug);
    const net = html.indexOf('<script src="/assets/magic-net.js?v=');
    assert.ok(net > -1 && net < html.indexOf('</head>'), `${slug}: MagicNet in <head>`);
  }
});

test('EN country pages, the hub and the home load their scripts with defer, in the old order', () => {
  // assortment-view (2026-10-25): the one reader of the backend's country-page layout, before the catalogue client.
  const order = ['magic-net', 'assortment-view', 'global-catalog', 'daily-plan-copy', 'country-names-en', 'site-i18n-en', 'plans', 'checkout', 'country'];
  let n = 0;
  for (const { slug, html } of countryPages('en/esim')) {
    // The ONE script without defer: assets/logo-once.js, in <head>, synchronous on purpose — it starts the logo's
    // «Reveal + Wave» before first paint (owner, 2026-10-20; a deferred start would flash the logo away and back).
    assert.equal((html.match(/<script src="\/assets\/logo-once\.js\?v=[0-9a-f]{8}"(?: data-motion-src="\/assets\/motion\.js\?v=[0-9a-f]{8}")?><\/script>/g) || []).length, 1, `${slug}: logo-once (it may name assets/motion.js, nothing else)`);
    assert.ok(html.indexOf('logo-once.js') < html.indexOf('</head>'), `${slug}: logo-once in <head>`);
    const tags = [...html.matchAll(/<script src="([^"]+)"([^>]*)><\/script>/g)].filter((t) => !t[1].startsWith('/assets/logo-once.js'));
    if (!tags.length) continue;
    n += 1;
    for (const t of tags) assert.match(t[2], /\bdefer\b/, `${slug}: ${t[1]}`);
    assert.deepEqual(tags.map((t) => t[1].replace(/^.*\/([a-z0-9-]+)\.js.*$/, '$1')), order, slug);
  }
  assert.ok(n >= 190, `EN pages checked: ${n}`);
  for (const f of ['en/esim/index.html', 'en/index.html']) {
    for (const t of read(f).matchAll(/<script src="([^"]+)"([^>]*)><\/script>/g)) {
      if (t[1].startsWith('/assets/logo-once.js')) continue;   // the logo's start — see above
      assert.match(t[2], /\bdefer\b/, `${f}: ${t[1]}`);
    }
  }
});

/* ------------------------------------------------------------ the loader */

const pkg = (over = {}) => ({
  package_id: 'p-' + Math.random().toString(36).slice(2, 10), name: 'Test 1 GB', country_code: 'TH', region: 'TH',
  coverage_country_codes: ['TH'], data_gb: 1, validity_days: 7, price: 500, ...over,
});
const doc = (packages) => ({ schema_version: 1, generated_at: new Date().toISOString(), source: 'production-public-api', package_count: packages.length, packages });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LIVE = [pkg({ name: 'Live 1 GB' })];
const SNAP = [pkg({ name: 'Snapshot 1 GB' })];
const okBody = (body, bodyDelay = 0) => ({ status: 200, text: () => sleep(bodyDelay).then(() => JSON.stringify(body)) });

/** The real loader; `early` is what the page's <head> would have handed it. */
function loaderWith({ early = null, live = () => Promise.resolve(okBody({ data: LIVE })) } = {}) {
  const src = read('assets/catalog-loader.js');
  const calls = [];
  const win = { __magicCatalogEarly: early };
  const fakeFetch = (url) => {
    const u = String(url);
    calls.push(/catalog\.json/.test(u) ? 'snapshot' : (/onrender/.test(u) ? 'api-primary' : 'api-fallback'));
    if (/catalog\.json/.test(u)) return Promise.resolve(okBody(doc(SNAP)));
    return live(u);
  };
  class FakeAC { constructor() { this.signal = { aborted: false }; } abort() { this.signal.aborted = true; } }
  new Function('window', 'fetch', 'AbortController', 'setTimeout', 'clearTimeout', 'Math', 'Date', src)(win, fakeFetch, FakeAC, setTimeout, clearTimeout, Math, Date);
  return { api: win.MagicCatalog, calls, win };
}
/** An early request whose headers come at `headersAt` ms and body `bodyAfter` ms later. */
function earlyReq({ headersAt = 0, bodyAfter = 0, fail = null, startedAgo = 0 } = {}) {
  let reject;
  const e = { startedAt: Date.now() - startedAgo, used: false, aborted: false };
  e.ac = { abort() { e.aborted = true; reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); } };
  e.response = new Promise((res, rej) => {
    reject = rej;
    if (fail) setTimeout(() => rej(fail), headersAt);
    else if (headersAt !== Infinity) setTimeout(() => res(okBody({ data: LIVE }, bodyAfter)), headersAt);
  });
  e.response.catch(() => {});
  return e;
}

test('the loader TAKES the early request: one API request, not two', async () => {
  const early = earlyReq({ headersAt: 20 });
  const { api, calls } = loaderWith({ early });
  const r = await api.load();
  assert.equal(r.source, 'live');
  assert.equal(r.packages[0].name, 'Live 1 GB');
  assert.equal(early.used, true);
  assert.deepEqual(calls, [], 'no request of its own, no snapshot');
});

test('headers in time, a slow body: no snapshot is fetched beside the answer', async () => {
  const early = earlyReq({ headersAt: 30, bodyAfter: 250 });
  const { api, calls } = loaderWith({ early });
  const r = await api.load({ deadlineMs: 100 });
  assert.equal(r.source, 'live');
  assert.deepEqual(calls, [], 'the snapshot would only have competed for bandwidth');
});

test('a stall (no headers by the deadline): the snapshot is fetched and shown, the live request is not repeated', async () => {
  const early = earlyReq({ headersAt: 600 });
  const { api, calls } = loaderWith({ early });
  const r = await api.load({ deadlineMs: 100 });
  assert.equal(r.source, 'cache');
  assert.equal(r.packages[0].name, 'Snapshot 1 GB');
  assert.equal(r.liveError, 'race_deadline');
  assert.deepEqual(calls, ['snapshot']);
  const late = await r.whenLive;                     // the early request lands: the page re-renders from it
  assert.equal(late.packages[0].name, 'Live 1 GB');
  assert.deepEqual(calls, ['snapshot'], 'still one API request');
});

test('the early request fails: the old retry, the fallback road, then the snapshot — nothing lost', async () => {
  const early = earlyReq({ headersAt: 10, fail: Object.assign(new Error('Failed to fetch'), { name: 'TypeError' }) });
  const { api, calls } = loaderWith({ early, live: () => Promise.reject(Object.assign(new Error('Failed to fetch'), { name: 'TypeError' })) });
  const r = await api.load({ deadlineMs: 60000 });
  assert.equal(r.source, 'cache');
  assert.equal(r.liveError, 'network');
  assert.deepEqual(calls, ['api-primary', 'api-fallback', 'snapshot'], 'attempt 2 on the primary, one on the fallback, then the snapshot');
});

test('the 7 s live timeout counts from the moment the early request started', async () => {
  const early = earlyReq({ headersAt: Infinity, startedAgo: 7000 - 30 });
  const { api, calls } = loaderWith({ early, live: () => Promise.resolve(okBody({ data: LIVE })) });
  const r = await api.load({ deadlineMs: 60000 });
  assert.equal(early.aborted, true, 'aborted at 7 s from its start');
  assert.equal(r.source, 'live', 'the retry answered');
  assert.deepEqual(calls, ['api-primary']);
});

test('a page without the early request (the SEO experiment) keeps the old race: the snapshot is fetched at the deadline even with headers in', async () => {
  let n = 0;
  const { api, calls } = loaderWith({ live: () => { n += 1; return sleep(30).then(() => okBody({ data: LIVE }, 250)); } });
  await api.load({ deadlineMs: 100 });
  assert.equal(n, 1);
  assert.deepEqual(calls, ['api-primary', 'snapshot']);
});

test('after the early request, retry and the pre-checkout price check make their own request', async () => {
  const early = earlyReq({ headersAt: 10 });
  const { api, calls } = loaderWith({ early });
  await api.load();
  const list = await api.loadLive();
  assert.equal(list[0].name, 'Live 1 GB');
  const check = await api.revalidatePackage(LIVE[0].package_id, 500);
  assert.equal(check.ok, true);
  assert.deepEqual(calls, ['api-primary', 'api-primary']);
});
