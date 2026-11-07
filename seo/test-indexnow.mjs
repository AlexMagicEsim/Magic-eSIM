import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  ORIGIN, ENDPOINT, MAX_URLS, BATCH_SIZE, BATCH_PAUSE_MS, WAIT_BUDGET_MS, RETRY_DELAYS_MS, RETRY_AFTER_CAP_MS,
  FOREIGN_PREFIXES, KEY_FILE_RE,
  readKey, sitemapLocs, isRuSiteUrl, changedPages, robotsRules, robotsAllows, pageFacts, repoPath,
  selectUrls, liveCheck, buildBody, batches, submit, submitBatches, internalLinks,
} from './indexnow.mjs';
import { allowRule, directoryRules } from '../scripts/build-pages-artifact.mjs';
import { prefixedSiteLocales } from './locales.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : null);
const SITEMAP = read('sitemap.xml');
const ROBOTS = read('robots.txt');
const STATE = JSON.parse(read('seo/sitemap-lastmod.json'));
const { key: KEY, file: KEY_FILE } = readKey(ROOT);

/* ---------------------------------------------------------------- key file */

test('the key file: exactly one <32 hex>.txt in the root, holding exactly its own name, published in the Pages artifact', () => {
  const files = readdirSync(ROOT).filter((f) => KEY_FILE_RE.test(f));
  assert.equal(files.length, 1);
  const bytes = readFileSync(join(ROOT, KEY_FILE));
  assert.equal(bytes.length, 32, 'no newline, no BOM');
  assert.match(bytes.toString('utf8'), /^[0-9a-f]{32}$/);
  assert.ok(KEY.length >= 8 && KEY.length <= 128 && /^[A-Za-z0-9-]+$/.test(KEY), 'IndexNow / Yandex key rules');
  assert.equal(allowRule(KEY_FILE, directoryRules()), 'verification file');
  // negative controls: other text files in the root stay unpublished
  for (const f of ['notes.txt', `${KEY.slice(0, 31)}.txt`, `${KEY.toUpperCase()}.txt`, `${KEY}.txt.bak`, `x/${KEY}.txt`]) {
    assert.equal(allowRule(f, directoryRules()), null, f);
  }
});

test('readKey refuses a key file whose body differs from its name', async () => {
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const d = mkdtempSync(join(tmpdir(), 'indexnow-'));
  const k = 'a'.repeat(32);
  writeFileSync(join(d, `${k}.txt`), `${k}\n`);
  assert.throws(() => readKey(d), /exactly its own name/);
  writeFileSync(join(d, `${k}.txt`), k);
  assert.equal(readKey(d).key, k);
  writeFileSync(join(d, `${'b'.repeat(32)}.txt`), 'b'.repeat(32));
  assert.throws(() => readKey(d), /exactly one key file/);
});

/* ---------------------------------------------------------------- which URLs */

test('a RU-segment URL is https://magicesim.store/ru/… (or a Russian document at the root), without query or fragment', () => {
  for (const p of prefixedSiteLocales()) assert.ok(FOREIGN_PREFIXES.includes(p.prefix), p.prefix);
  assert.ok(!FOREIGN_PREFIXES.includes('ru'));
  for (const u of [`${ORIGIN}/ru/`, `${ORIGIN}/ru/esim/china/`, `${ORIGIN}/ru/iphone.html`, `${ORIGIN}/ru/esim/`, `${ORIGIN}/terms.html`, `${ORIGIN}/privacy.html`]) {
    assert.equal(isRuSiteUrl(u), true, u);
  }
  // EN-root migration: «/» is the English home and is NEVER a RU URL; nor is anything else at the root or an old path.
  for (const u of [`${ORIGIN}/`, `${ORIGIN}/destinations/china/`, `${ORIGIN}/guides/iphone/`, `${ORIGIN}/support/`, `${ORIGIN}/esim/china/`,
    `${ORIGIN}/iphone.html`, `${ORIGIN}/index.html`, `${ORIGIN}/rux/`, `${ORIGIN}/payment-success.html`,
    `${ORIGIN}/en/`, `${ORIGIN}/en/esim/china/`, `${ORIGIN}/es/esim/turkey/`, `${ORIGIN}/zh/`, `${ORIGIN}/ko/esim/japan/`,
    'http://magicesim.store/ru/esim/china/', 'https://www.magicesim.store/ru/esim/china/', 'https://magicesim.store.evil.example/esim/',
    'https://evil.example/https://magicesim.store/', `${ORIGIN}/ru/esim/china/?x=1`, `${ORIGIN}/ru/esim/china/#plans`,
    'https://user@magicesim.store/ru/esim/', 'https://MAGICESIM.store/esim/', 'not a url', '']) assert.equal(isRuSiteUrl(u), false, u);
});

test('changedPages: a moved lastmod or hash, or a new URL — and nothing without a base', () => {
  const base = { pages: { a: { hash: '1', lastmod: '2026-11-01' }, b: { hash: '2', lastmod: '2026-11-01' }, c: { hash: '3', lastmod: '2026-11-01' } } };
  const head = { pages: { a: { hash: '1', lastmod: '2026-11-01' }, b: { hash: '9', lastmod: '2026-11-01' }, c: { hash: '3', lastmod: '2026-11-06' }, d: { hash: '4', lastmod: '2026-11-06' } } };
  assert.deepEqual(changedPages(base, head), ['b', 'c', 'd']);
  assert.deepEqual(changedPages(head, head), []);
  for (const bad of [null, undefined, {}, { pages: null }]) assert.throws(() => changedPages(bad, head), /refusing to guess/);
});

test('robots.txt: the site file allows the RU pages and blocks /app/ and the payment pages; Yandex group, longest match, * and $', () => {
  const rules = robotsRules(ROBOTS);
  for (const u of [`${ORIGIN}/ru/`, `${ORIGIN}/ru/esim/china/`, `${ORIGIN}/ru/iphone.html`]) assert.equal(robotsAllows(rules, u), true, u);
  for (const u of [`${ORIGIN}/app/`, `${ORIGIN}/app/index.html`, `${ORIGIN}/payment-success.html`, `${ORIGIN}/payment-failed.html`]) assert.equal(robotsAllows(rules, u), false, u);
  const t = 'User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nUser-agent: Yandex\nDisallow: /ru/esim/\nAllow: /ru/esim/china/\nDisallow: /*.pdf$\n';
  const y = robotsRules(t);
  assert.equal(robotsAllows(y, `${ORIGIN}/`), true, 'Yandex has its own group, * does not apply');
  assert.equal(robotsAllows(y, `${ORIGIN}/ru/esim/turkey/`), false);
  assert.equal(robotsAllows(y, `${ORIGIN}/ru/esim/china/`), true, 'longer Allow wins');
  assert.equal(robotsAllows(y, `${ORIGIN}/a/b.pdf`), false);
  assert.equal(robotsAllows(y, `${ORIGIN}/a/b.pdfx`), true, '$ anchors');
  assert.equal(robotsAllows(robotsRules('User-agent: *\nDisallow: /\n'), `${ORIGIN}/ru/esim/`), false, 'falls back to *');
});

test('pageFacts and repoPath', () => {
  assert.deepEqual(pageFacts('<link rel="canonical" href="https://magicesim.store/ru/esim/china/" /><meta name="robots" content="index, follow" />'),
    { canonical: 'https://magicesim.store/ru/esim/china/', noindex: false });
  assert.equal(pageFacts('<meta name="robots" content="noindex, nofollow">').noindex, true);
  assert.equal(pageFacts('<meta name="yandex" content="none">').noindex, true);
  assert.equal(pageFacts('<p>no head</p>').canonical, null);
  assert.equal(repoPath(`${ORIGIN}/`), 'index.html');
  assert.equal(repoPath(`${ORIGIN}/ru/esim/china/`), 'ru/esim/china/index.html');
  assert.equal(repoPath(`${ORIGIN}/ru/iphone.html`), 'ru/iphone.html');
});

test('every RU sitemap URL of this commit passes selection; no international, payment or app URL ever does', () => {
  const all = selectUrls({ baseState: { pages: {} }, headState: STATE, sitemapXml: SITEMAP, robotsTxt: ROBOTS, read });
  const ruLocs = sitemapLocs(SITEMAP).filter(isRuSiteUrl);
  assert.ok(ruLocs.length > 150, `RU sitemap URLs: ${ruLocs.length}`);
  assert.deepEqual(all.send, [...ruLocs].filter((u) => STATE.pages[u]).sort(), 'every RU page has a self canonical, no noindex, robots allows it');
  assert.ok(all.send.every(isRuSiteUrl));
  assert.ok(all.skipped.every((s) => !isRuSiteUrl(s.url) || !ruLocs.includes(s.url)), JSON.stringify(all.skipped.slice(0, 3)));
  assert.ok(all.skipped.some((s) => s.url.startsWith(`${ORIGIN}/destinations/`)), 'the English pages are seen and skipped');
  assert.ok(all.skipped.some((s) => s.url === `${ORIGIN}/`), 'the English home «/» is seen and skipped');
  assert.ok(!all.send.includes(`${ORIGIN}/`), '«/» is never sent');
  assert.ok(all.send.length <= MAX_URLS, 'the whole RU segment fits under the cap');
});

test('a real-looking deployment: only the changed RU page is sent; its English twin, a stray and a noindex page are skipped', () => {
  const head = structuredClone(STATE);
  const base = structuredClone(STATE);
  base.pages[`${ORIGIN}/ru/esim/china/`].lastmod = '2000-01-01';
  base.pages[`${ORIGIN}/destinations/china/`].lastmod = '2000-01-01';
  head.pages[`${ORIGIN}/payment-success.html`] = { hash: 'x', lastmod: '2026-11-06' };
  head.pages[`${ORIGIN}/ru/esim/not-a-page/`] = { hash: 'x', lastmod: '2026-11-06' };
  const r = selectUrls({ baseState: base, headState: head, sitemapXml: SITEMAP, robotsTxt: ROBOTS, read });
  assert.deepEqual(r.send, [`${ORIGIN}/ru/esim/china/`]);
  const why = Object.fromEntries(r.skipped.map((s) => [s.url, s.why]));
  assert.equal(why[`${ORIGIN}/destinations/china/`], 'not a RU-segment URL of the site');
  assert.equal(why[`${ORIGIN}/ru/esim/not-a-page/`], 'not in sitemap.xml');
  assert.equal(why[`${ORIGIN}/payment-success.html`], 'not a RU-segment URL of the site'); // a Russian root page outside RU_ROOT_DOCUMENTS
  // a page whose committed canonical points elsewhere, or that says noindex, is not sent
  const html = read('ru/esim/china/index.html');
  const moved = selectUrls({ baseState: base, headState: head, sitemapXml: SITEMAP, robotsTxt: ROBOTS,
    read: (rel) => (rel === 'ru/esim/china/index.html' ? html.replace(/rel="canonical" href="[^"]+"/, 'rel="canonical" href="https://magicesim.store/ru/esim/"') : read(rel)) });
  assert.deepEqual(moved.send, []);
  const hidden = selectUrls({ baseState: base, headState: head, sitemapXml: SITEMAP, robotsTxt: ROBOTS,
    read: (rel) => (rel === 'ru/esim/china/index.html' ? html.replace(/content="index, follow"/, 'content="noindex, follow"') : read(rel)) });
  assert.deepEqual(hidden.skipped.find((s) => s.url === `${ORIGIN}/ru/esim/china/`)?.why, 'noindex');
  // nothing moved → nothing sent
  assert.deepEqual(selectUrls({ baseState: STATE, headState: STATE, sitemapXml: SITEMAP, robotsTxt: ROBOTS, read }).send, []);
});

test('internalLinks: <a href> inside the site, resolved, without the fragment; scripts, assets and other hosts do not count', () => {
  const html = `<a href="../china/">x</a><a href="/ru/esim/turkey/#plans">y</a><a href="https://magicesim.store/ru/iphone.html">z</a>
    <a href="https://t.me/magicesim">t</a><a href="mailto:support@magicesim.store">m</a><link rel="stylesheet" href="/assets/site.css?v=1">
    <script>var s='<a href="/ru/esim/hidden/">';</script><a class="x" href="/ru/esim/turkey/">again</a>`;
  assert.deepEqual(internalLinks(html, `${ORIGIN}/ru/esim/vietnam/`), ['/ru/esim/china/', '/ru/esim/turkey/', '/ru/iphone.html']);
  // an asset stamp or a stylesheet change is not a link change
  const real = read('ru/esim/turkey/index.html');
  assert.deepEqual(internalLinks(real.replace(/\?v=[0-9a-f]{8}/g, '?v=00000000'), `${ORIGIN}/ru/esim/turkey/`), internalLinks(real, `${ORIGIN}/ru/esim/turkey/`));
  assert.ok(internalLinks(real, `${ORIGIN}/ru/esim/turkey/`).includes('/ru/esim/'), 'the footer «Все направления» is seen');
});

test('a site-wide footer link change: every RU page carrying it is sent once (lastmod untouched), no international page, nothing else', () => {
  // the footer is chrome: its change moves no lastmod (seo/test-sitemap-lastmod.mjs R4) — so base and head states are equal
  const ruLocs = sitemapLocs(SITEMAP).filter(isRuSiteUrl);
  // a link no page carries yet (the real footer changes over time — Kazakhstan joined it in #219), so the rule is tested
  // on a change that is a change on every page
  const PROBE = '/ru/esim/indexnow-footer-probe/';
  const addLink = (h) => h.replace(/(<footer class="site-footer">[\s\S]*?<h2>Направления<\/h2>\s*<ul>)/, `$1\n          <li><a href="${PROBE}">Проба</a></li>`);
  const carriers = ruLocs.filter((u) => { const h = read(repoPath(u)); return h && addLink(h) !== h && !internalLinks(h, u).includes(PROBE); });
  assert.ok(carriers.length > 150, `RU pages carrying the footer: ${carriers.length}`);
  const r = selectUrls({ baseState: STATE, headState: STATE, sitemapXml: SITEMAP, robotsTxt: ROBOTS,
    readBase: read, read: (rel) => { const h = read(rel); return h && !rel.match(/^(en|es|de|fr|zh|ko)\//) ? addLink(h) : h; } });
  assert.deepEqual(r.send, [...carriers].sort());
  assert.ok(r.send.every((u) => r.reason[u] === 'links'));
  assert.ok(r.send.every(isRuSiteUrl), 'no international URL');
  assert.ok(r.send.length <= MAX_URLS, 'a site-wide link change fits under the cap');
  // the SAME change in the international footer only sends nothing: those URLs are never RU
  const intl = selectUrls({ baseState: STATE, headState: STATE, sitemapXml: SITEMAP, robotsTxt: ROBOTS, readBase: read,
    read: (rel) => { const h = read(rel); return h && rel.startsWith('en/') ? h.replace('<footer class="site-footer">', `<footer class="site-footer"><a href="/en${PROBE}">probe</a>`) : h; } });
  assert.deepEqual(intl.send, []);
  // the next deployment compares with THIS one: nothing left to send — no repeats
  const again = selectUrls({ baseState: STATE, headState: STATE, sitemapXml: SITEMAP, robotsTxt: ROBOTS, readBase: (rel) => { const h = read(rel); return h && !rel.match(/^(en|es|de|fr|zh|ko)\//) ? addLink(h) : h; }, read: (rel) => { const h = read(rel); return h && !rel.match(/^(en|es|de|fr|zh|ko)\//) ? addLink(h) : h; } });
  assert.deepEqual(again.send, []);
});

test('only HTML that is not a link moves: asset stamps on every page send nothing; a content change stays «content»', () => {
  const stamp = (h) => (h ? h.replace(/\?v=[0-9a-f]{8}/g, '?v=ffffffff') : h);
  const r = selectUrls({ baseState: STATE, headState: STATE, sitemapXml: SITEMAP, robotsTxt: ROBOTS, readBase: read, read: (rel) => stamp(read(rel)) });
  assert.deepEqual(r.send, []);
  const base = structuredClone(STATE);
  base.pages[`${ORIGIN}/ru/esim/china/`].hash = 'old';
  const c = selectUrls({ baseState: base, headState: STATE, sitemapXml: SITEMAP, robotsTxt: ROBOTS, readBase: read, read });
  assert.deepEqual(c.send, [`${ORIGIN}/ru/esim/china/`]);
  assert.equal(c.reason[`${ORIGIN}/ru/esim/china/`], 'content');
});

test('the CLI hands the previous deployed commit to the link rule', () => {
  const cli = read('scripts/indexnow-submit.mjs');
  assert.match(cli, /readBase: \(rel\) => show\(base, rel\)/);
  assert.match(cli, /read: \(rel\) => show\(head, rel\)/);
});

/* ---------------------------------------------------------------- live check */

const res = (status, body = '', headers = {}) => ({ status, text: async () => body, headers: { get: (n) => headers[n.toLowerCase()] ?? null } });

test('liveCheck: 200 + self canonical passes; a redirect, an error, another canonical, noindex (meta or header) do not', async () => {
  const u = `${ORIGIN}/ru/esim/china/`;
  const good = `<link rel="canonical" href="${u}" />`;
  assert.equal(await liveCheck(u, { fetchImpl: async (_, o) => { assert.equal(o.redirect, 'manual'); return res(200, good); } }), null);
  assert.equal(await liveCheck(u, { fetchImpl: async () => res(301) }), 'HTTP 301');
  assert.equal(await liveCheck(u, { fetchImpl: async () => res(404) }), 'HTTP 404');
  assert.match(await liveCheck(u, { fetchImpl: async () => res(200, '<link rel="canonical" href="https://magicesim.store/ru/esim/" />') }), /canonical is/);
  assert.equal(await liveCheck(u, { fetchImpl: async () => res(200, good + '<meta name="robots" content="noindex">') }), 'noindex');
  assert.equal(await liveCheck(u, { fetchImpl: async () => res(200, good, { 'x-robots-tag': 'noindex' }) }), 'X-Robots-Tag noindex');
  assert.match(await liveCheck(u, { fetchImpl: async () => { throw Object.assign(new Error('x'), { code: 'ECONNRESET' }); } }), /network error \(ECONNRESET\)/);
});

/* ---------------------------------------------------------------- submission */

const URLS = [`${ORIGIN}/ru/esim/china/`, `${ORIGIN}/ru/esim/turkey/`];

function harness(answers) {
  const calls = [];
  const sleeps = [];
  const logs = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    const a = answers[Math.min(calls.length - 1, answers.length - 1)];
    if (a instanceof Error) throw a;
    return res(a.status, '', a.headers || {});
  };
  return { calls, sleeps, logs, opts: { fetchImpl, sleep: async (ms) => { sleeps.push(ms); }, log: (m) => logs.push(m) } };
}

test('buildBody: our host, the root key location, validated RU URLs only, never empty, never over one batch', () => {
  const b = buildBody(KEY, URLS);
  assert.deepEqual(Object.keys(b), ['host', 'key', 'keyLocation', 'urlList']);
  assert.equal(b.host, 'magicesim.store');
  assert.equal(b.keyLocation, `${ORIGIN}/${KEY}.txt`);
  assert.throws(() => buildBody(KEY, [...URLS, `${ORIGIN}/en/esim/china/`]), /outside the RU segment/);
  assert.throws(() => buildBody(KEY, ['https://evil.example/']), /outside the RU segment/);
  assert.throws(() => buildBody(KEY, []), /nothing to send/);
  assert.throws(() => buildBody(KEY, Array.from({ length: BATCH_SIZE + 1 }, () => URLS[0])), /BATCH_SIZE/);
});

test('submit: 200 accepted / 202 key pending in one POST to the fixed Yandex endpoint', async () => {
  assert.equal(ENDPOINT, 'https://yandex.com/indexnow');
  for (const [status, outcome] of [[200, 'accepted'], [202, 'pending_key']]) {
    const h = harness([{ status }]);
    const r = await submit(KEY, URLS, h.opts);
    assert.deepEqual(r, { outcome, status, attempts: 1, waitedMs: 0 });
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].url, ENDPOINT);
    assert.equal(h.calls[0].opts.method, 'POST');
    assert.deepEqual(JSON.parse(h.calls[0].opts.body).urlList, URLS);
    assert.deepEqual(h.sleeps, []);
  }
});

test('submit: 400/403/422 are rejected at once, never retried', async () => {
  for (const status of [400, 403, 405, 422]) {
    const h = harness([{ status }, { status: 200 }]);
    assert.deepEqual(await submit(KEY, URLS, h.opts), { outcome: 'rejected', status, attempts: 1, waitedMs: 0 });
    assert.equal(h.calls.length, 1);
  }
});

test('submit: 429 / 5xx / network errors are retried a bounded number of times, Retry-After honoured and capped', async () => {
  let h = harness([{ status: 429 }, { status: 200 }]);
  assert.deepEqual(await submit(KEY, URLS, h.opts), { outcome: 'accepted', status: 200, attempts: 2, waitedMs: RETRY_DELAYS_MS[0] });
  assert.deepEqual(h.sleeps, [RETRY_DELAYS_MS[0]]);

  h = harness([{ status: 429, headers: { 'retry-after': '90' } }, { status: 200 }]);
  await submit(KEY, URLS, h.opts);
  assert.deepEqual(h.sleeps, [90_000]);

  h = harness([{ status: 429, headers: { 'retry-after': '99999' } }, { status: 200 }]);
  await submit(KEY, URLS, h.opts);
  assert.deepEqual(h.sleeps, [RETRY_AFTER_CAP_MS]);

  h = harness([{ status: 504 }]);
  assert.deepEqual(await submit(KEY, URLS, h.opts), { outcome: 'gave_up', status: 504, attempts: RETRY_DELAYS_MS.length + 1, waitedMs: RETRY_DELAYS_MS.reduce((a, b) => a + b, 0) });
  assert.deepEqual(h.sleeps, [...RETRY_DELAYS_MS]);
  assert.equal(h.calls.length, RETRY_DELAYS_MS.length + 1, 'bounded — never an endless loop');

  h = harness([Object.assign(new Error('reset'), { code: 'ECONNRESET' })]);
  assert.deepEqual(await submit(KEY, URLS, h.opts), { outcome: 'gave_up', status: null, attempts: RETRY_DELAYS_MS.length + 1, waitedMs: RETRY_DELAYS_MS.reduce((a, b) => a + b, 0) });
});

/* ---------------------------------------------------------------- batches */

const many = (n) => Array.from({ length: n }, (_, i) => `${ORIGIN}/ru/esim/page-${String(i).padStart(3, '0')}/`);
const bodies = (h) => h.calls.map((c) => JSON.parse(c.opts.body).urlList);

test('batches: at most BATCH_SIZE (100) per POST, in order, nothing lost or repeated — 198, 250 and 300 URLs', () => {
  assert.equal(BATCH_SIZE, 100);
  for (const [n, sizes] of [[1, [1]], [100, [100]], [101, [100, 1]], [198, [100, 98]], [250, [100, 100, 50]], [300, [100, 100, 100]]]) {
    const urls = many(n);
    const parts = batches(urls);
    assert.deepEqual(parts.map((p) => p.length), sizes, String(n));
    assert.deepEqual(parts.flat(), urls, `${n}: order kept, nothing lost or repeated`);
  }
  assert.deepEqual(batches([]), []);
  assert.ok(MAX_URLS >= 300 && MAX_URLS <= 10_000, 'a sanity ceiling well above the RU segment');
  assert.throws(() => batches(many(MAX_URLS + 1)), /MAX_URLS/);
});

test('submitBatches: 198 / 250 / 300 URLs go as 2 / 3 / 3 sequential POSTs with a pause between them, every URL once', async () => {
  for (const [n, posts] of [[198, 2], [250, 3], [300, 3]]) {
    const urls = many(n);
    const h = harness([{ status: 202 }]);
    const r = await submitBatches(KEY, urls, h.opts);
    assert.equal(h.calls.length, posts, `${n} URLs`);
    assert.deepEqual(bodies(h).flat(), urls, `${n}: every URL once, in order`);
    assert.ok(bodies(h).every((b) => b.length <= BATCH_SIZE));
    assert.deepEqual(h.sleeps, Array(posts - 1).fill(BATCH_PAUSE_MS), 'one pause between batches, none before the first');
    assert.deepEqual(r.batches.map((b) => [b.n, b.urls.length, b.status, b.outcome, b.attempts]),
      bodies(h).map((b, i) => [i + 1, b.length, 202, 'pending_key', 1]));
    assert.deepEqual([r.sent, r.failed, r.notSent], [n, 0, 0]);
  }
});

test('submitBatches: a failed batch is recorded and the next batches are still sent (200, 202, 429, 5xx, 4xx, network)', async () => {
  // batch 1: 503 three times → gave up; batch 2: 429 then 200; batch 3: 403 → rejected, not retried
  const answers = [{ status: 503 }, { status: 503 }, { status: 503 }, { status: 429 }, { status: 200 }, { status: 403 }];
  const h = harness(answers);
  const r = await submitBatches(KEY, many(250), h.opts);
  assert.deepEqual(r.batches.map((b) => [b.n, b.urls.length, b.status, b.outcome, b.attempts]),
    [[1, 100, 503, 'gave_up', 3], [2, 100, 200, 'accepted', 2], [3, 50, 403, 'rejected', 1]]);
  assert.equal(h.calls.length, answers.length, 'bounded: 3 + 2 + 1 POSTs');
  assert.deepEqual([r.sent, r.failed, r.notSent], [100, 150, 0]);
  assert.deepEqual(r.batches[0].urls, many(250).slice(0, 100), 'the URLs of the failed batch are kept in the result');
  // a network error on one batch does not stop the next
  const net = harness([Object.assign(new Error('reset'), { code: 'ECONNRESET' }), new Error('x'), new Error('x'), { status: 200 }]);
  const r2 = await submitBatches(KEY, many(198), net.opts);
  assert.deepEqual(r2.batches.map((b) => b.outcome), ['gave_up', 'accepted']);
});

test('submitBatches: the run\'s waiting is bounded — past WAIT_BUDGET_MS a retry is not taken and later batches are recorded as not sent', async () => {
  // every POST 429 with Retry-After at the cap: the budget runs out; the total number of POSTs stays small
  const h = harness([{ status: 429, headers: { 'retry-after': '99999' } }]);
  const r = await submitBatches(KEY, many(300), h.opts);
  const waited = h.sleeps.reduce((a, b) => a + b, 0);
  assert.ok(waited <= WAIT_BUDGET_MS, `slept ${waited} ms`);
  assert.ok(h.calls.length <= 3 * (RETRY_DELAYS_MS.length + 1), `${h.calls.length} POSTs`);
  assert.ok(r.batches.every((b) => b.outcome === 'gave_up' || b.outcome === 'not_sent'));
  assert.deepEqual(r.batches.flatMap((b) => b.urls), many(300), 'every URL is accounted for in a batch result');
  assert.equal(r.sent, 0);
  assert.equal(r.failed + r.notSent, 300);
  // a tiny budget: the first batch is still tried once, the rest are not started
  const t = harness([{ status: 503 }]);
  const r3 = await submitBatches(KEY, many(300), { ...t.opts, waitBudgetMs: 1 });
  assert.deepEqual(r3.batches.map((b) => [b.outcome, b.attempts]), [['gave_up', 1], ['not_sent', 0], ['not_sent', 0]]);
  assert.equal(t.calls.length, 1);
});

test('submitBatches: over MAX_URLS nothing is sent at all; international URLs are refused before any POST', async () => {
  const h = harness([{ status: 200 }]);
  await assert.rejects(submitBatches(KEY, many(MAX_URLS + 1), h.opts), /MAX_URLS/);
  await assert.rejects(submitBatches(KEY, [...many(150), `${ORIGIN}/en/esim/china/`], h.opts), /outside the RU segment/);
  assert.equal(h.calls.length, 0, 'every batch is validated before the first POST');
});

test('the key never reaches a log line', async () => {
  for (const answers of [[{ status: 200 }], [{ status: 202 }], [{ status: 403 }], [{ status: 503 }], [new Error('x')]]) {
    const h = harness(answers);
    await submit(KEY, URLS, h.opts);
    await submitBatches(KEY, many(250), h.opts);
    assert.ok(h.logs.length > 0);
    for (const l of h.logs) assert.ok(!l.includes(KEY), l);
  }
});

test('the CLI, offline, on this commit: nothing changed → nothing sent, exit 0, no key in the output; bad arguments → exit 1', () => {
  let head;
  try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return; }
  const run = (args) => spawnSync(process.execPath, [join(ROOT, 'scripts', 'indexnow-submit.mjs'), ...args], { cwd: ROOT, encoding: 'utf8' });
  const ok = run(['--base', head, '--head', head, '--offline']);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /nothing to send/);
  assert.ok(!(ok.stdout + ok.stderr).includes(KEY));
  const bad = run(['--base', 'HEAD', '--head', head, '--offline']);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /40-hex/);
});

/* ---------------------------------------------------------------- the workflow */

test('the IndexNow workflow: after Deploy Pages only, read-only, no secret, no URL input, masked key, bounded', () => {
  const wf = readFileSync(join(ROOT, '.github', 'workflows', 'indexnow.yml'), 'utf8');
  const code = wf.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const on = /\non:\n([\s\S]*?)\n(?=\S)/.exec(code)[1];
  assert.match(on, /workflow_run:\n\s+workflows: \["Deploy Pages"\]\n\s+types: \[completed\]/);
  assert.doesNotMatch(on, /\b(push|pull_request|pull_request_target|schedule|repository_dispatch)\b/);
  assert.match(code, /\npermissions:\n {2}contents: read\n {2}actions: read\n\n/);
  assert.doesNotMatch(code, /:\s*write\b|write-all/);
  assert.doesNotMatch(code, /secrets\./, 'no repository secret');
  assert.doesNotMatch(code, /\burls?\s*:/i, 'no URL input');
  assert.match(code, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(code, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(code, /select\(\.name == "deploy to GitHub Pages"\)/, 'only a run whose deploy job succeeded');
  assert.match(code, /cancel-in-progress: false/);
  assert.match(code, /runs-on: ubuntu-24\.04/);
  // room for the 10-minute pause, the live checks and the run's whole wait budget
  const timeout = Number(/timeout-minutes: (\d+)/.exec(code)[1]);
  assert.ok(timeout * 60_000 >= 10 * 60_000 + WAIT_BUDGET_MS + 5 * 60_000 && timeout <= 60, `timeout-minutes ${timeout}`);
  assert.match(code, /::add-mask::/);
  assert.match(code, /persist-credentials: false/);
  assert.match(code, /node scripts\/indexnow-submit\.mjs --base "\$BASE" --head "\$HEAD_SHA"/);
  // inputs reach the shell through env, never through ${{ }} inside a run: block
  for (const block of code.split(/\n\s+run: \|?/).slice(1)) {
    const body = block.split(/\n\s{6}- /)[0];
    assert.doesNotMatch(body, /\$\{\{\s*(inputs|github\.event)\./, 'no expression injection in a run block');
  }
  // the Deploy Pages job name this workflow keys on exists
  assert.match(readFileSync(join(ROOT, '.github', 'workflows', 'deploy-pages.yml'), 'utf8'), /name: deploy to GitHub Pages/);
});
