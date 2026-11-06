import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  ORIGIN, ENDPOINT, MAX_URLS, RETRY_DELAYS_MS, RETRY_AFTER_CAP_MS, FOREIGN_PREFIXES, KEY_FILE_RE,
  readKey, sitemapLocs, isRuSiteUrl, changedPages, robotsRules, robotsAllows, pageFacts, repoPath,
  selectUrls, liveCheck, buildBody, submit,
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

test('a RU-segment URL is https://magicesim.store/… outside every language prefix, without query or fragment', () => {
  for (const p of prefixedSiteLocales()) assert.ok(FOREIGN_PREFIXES.includes(p.prefix), p.prefix);
  for (const u of [`${ORIGIN}/`, `${ORIGIN}/esim/china/`, `${ORIGIN}/iphone.html`, `${ORIGIN}/esim/`]) assert.equal(isRuSiteUrl(u), true, u);
  for (const u of [`${ORIGIN}/en/`, `${ORIGIN}/en/esim/china/`, `${ORIGIN}/es/esim/turkey/`, `${ORIGIN}/zh/`, `${ORIGIN}/ko/esim/japan/`,
    'http://magicesim.store/esim/china/', 'https://www.magicesim.store/esim/china/', 'https://magicesim.store.evil.example/esim/',
    'https://evil.example/https://magicesim.store/', `${ORIGIN}/esim/china/?x=1`, `${ORIGIN}/esim/china/#plans`,
    'https://user@magicesim.store/esim/', 'https://MAGICESIM.store/esim/', 'not a url', '']) assert.equal(isRuSiteUrl(u), false, u);
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
  for (const u of [`${ORIGIN}/`, `${ORIGIN}/esim/china/`, `${ORIGIN}/iphone.html`]) assert.equal(robotsAllows(rules, u), true, u);
  for (const u of [`${ORIGIN}/app/`, `${ORIGIN}/app/index.html`, `${ORIGIN}/payment-success.html`, `${ORIGIN}/payment-failed.html`]) assert.equal(robotsAllows(rules, u), false, u);
  const t = 'User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nUser-agent: Yandex\nDisallow: /esim/\nAllow: /esim/china/\nDisallow: /*.pdf$\n';
  const y = robotsRules(t);
  assert.equal(robotsAllows(y, `${ORIGIN}/`), true, 'Yandex has its own group, * does not apply');
  assert.equal(robotsAllows(y, `${ORIGIN}/esim/turkey/`), false);
  assert.equal(robotsAllows(y, `${ORIGIN}/esim/china/`), true, 'longer Allow wins');
  assert.equal(robotsAllows(y, `${ORIGIN}/a/b.pdf`), false);
  assert.equal(robotsAllows(y, `${ORIGIN}/a/b.pdfx`), true, '$ anchors');
  assert.equal(robotsAllows(robotsRules('User-agent: *\nDisallow: /\n'), `${ORIGIN}/esim/`), false, 'falls back to *');
});

test('pageFacts and repoPath', () => {
  assert.deepEqual(pageFacts('<link rel="canonical" href="https://magicesim.store/esim/china/" /><meta name="robots" content="index, follow" />'),
    { canonical: 'https://magicesim.store/esim/china/', noindex: false });
  assert.equal(pageFacts('<meta name="robots" content="noindex, nofollow">').noindex, true);
  assert.equal(pageFacts('<meta name="yandex" content="none">').noindex, true);
  assert.equal(pageFacts('<p>no head</p>').canonical, null);
  assert.equal(repoPath(`${ORIGIN}/`), 'index.html');
  assert.equal(repoPath(`${ORIGIN}/esim/china/`), 'esim/china/index.html');
  assert.equal(repoPath(`${ORIGIN}/iphone.html`), 'iphone.html');
});

test('every RU sitemap URL of this commit passes selection; no international, payment or app URL ever does', () => {
  const all = selectUrls({ baseState: { pages: {} }, headState: STATE, sitemapXml: SITEMAP, robotsTxt: ROBOTS, read });
  const ruLocs = sitemapLocs(SITEMAP).filter(isRuSiteUrl);
  assert.ok(ruLocs.length > 150, `RU sitemap URLs: ${ruLocs.length}`);
  assert.deepEqual(all.send, [...ruLocs].filter((u) => STATE.pages[u]).sort(), 'every RU page has a self canonical, no noindex, robots allows it');
  assert.ok(all.send.every(isRuSiteUrl));
  assert.ok(all.skipped.every((s) => !isRuSiteUrl(s.url) || !ruLocs.includes(s.url)), JSON.stringify(all.skipped.slice(0, 3)));
  assert.ok(all.skipped.some((s) => s.url.startsWith(`${ORIGIN}/en/`)), 'the English pages are seen and skipped');
  assert.ok(all.send.length <= MAX_URLS, 'the whole RU segment fits under the cap');
});

test('a real-looking deployment: only the changed RU page is sent; its English twin, a stray and a noindex page are skipped', () => {
  const head = structuredClone(STATE);
  const base = structuredClone(STATE);
  base.pages[`${ORIGIN}/esim/china/`].lastmod = '2000-01-01';
  base.pages[`${ORIGIN}/en/esim/china/`].lastmod = '2000-01-01';
  head.pages[`${ORIGIN}/payment-success.html`] = { hash: 'x', lastmod: '2026-11-06' };
  head.pages[`${ORIGIN}/esim/not-a-page/`] = { hash: 'x', lastmod: '2026-11-06' };
  const r = selectUrls({ baseState: base, headState: head, sitemapXml: SITEMAP, robotsTxt: ROBOTS, read });
  assert.deepEqual(r.send, [`${ORIGIN}/esim/china/`]);
  const why = Object.fromEntries(r.skipped.map((s) => [s.url, s.why]));
  assert.equal(why[`${ORIGIN}/en/esim/china/`], 'not a RU-segment URL of the site');
  assert.equal(why[`${ORIGIN}/esim/not-a-page/`], 'not in sitemap.xml');
  assert.equal(why[`${ORIGIN}/payment-success.html`], 'not in sitemap.xml');
  // a page whose committed canonical points elsewhere, or that says noindex, is not sent
  const html = read('esim/china/index.html');
  const moved = selectUrls({ baseState: base, headState: head, sitemapXml: SITEMAP, robotsTxt: ROBOTS,
    read: (rel) => (rel === 'esim/china/index.html' ? html.replace(/rel="canonical" href="[^"]+"/, 'rel="canonical" href="https://magicesim.store/esim/"') : read(rel)) });
  assert.deepEqual(moved.send, []);
  const hidden = selectUrls({ baseState: base, headState: head, sitemapXml: SITEMAP, robotsTxt: ROBOTS,
    read: (rel) => (rel === 'esim/china/index.html' ? html.replace(/content="index, follow"/, 'content="noindex, follow"') : read(rel)) });
  assert.deepEqual(hidden.skipped.find((s) => s.url === `${ORIGIN}/esim/china/`)?.why, 'noindex');
  // nothing moved → nothing sent
  assert.deepEqual(selectUrls({ baseState: STATE, headState: STATE, sitemapXml: SITEMAP, robotsTxt: ROBOTS, read }).send, []);
});

/* ---------------------------------------------------------------- live check */

const res = (status, body = '', headers = {}) => ({ status, text: async () => body, headers: { get: (n) => headers[n.toLowerCase()] ?? null } });

test('liveCheck: 200 + self canonical passes; a redirect, an error, another canonical, noindex (meta or header) do not', async () => {
  const u = `${ORIGIN}/esim/china/`;
  const good = `<link rel="canonical" href="${u}" />`;
  assert.equal(await liveCheck(u, { fetchImpl: async (_, o) => { assert.equal(o.redirect, 'manual'); return res(200, good); } }), null);
  assert.equal(await liveCheck(u, { fetchImpl: async () => res(301) }), 'HTTP 301');
  assert.equal(await liveCheck(u, { fetchImpl: async () => res(404) }), 'HTTP 404');
  assert.match(await liveCheck(u, { fetchImpl: async () => res(200, '<link rel="canonical" href="https://magicesim.store/esim/" />') }), /canonical is/);
  assert.equal(await liveCheck(u, { fetchImpl: async () => res(200, good + '<meta name="robots" content="noindex">') }), 'noindex');
  assert.equal(await liveCheck(u, { fetchImpl: async () => res(200, good, { 'x-robots-tag': 'noindex' }) }), 'X-Robots-Tag noindex');
  assert.match(await liveCheck(u, { fetchImpl: async () => { throw Object.assign(new Error('x'), { code: 'ECONNRESET' }); } }), /network error \(ECONNRESET\)/);
});

/* ---------------------------------------------------------------- submission */

const URLS = [`${ORIGIN}/esim/china/`, `${ORIGIN}/esim/turkey/`];

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

test('buildBody: our host, the root key location, validated RU URLs only, never empty, never over the cap', () => {
  const b = buildBody(KEY, URLS);
  assert.deepEqual(Object.keys(b), ['host', 'key', 'keyLocation', 'urlList']);
  assert.equal(b.host, 'magicesim.store');
  assert.equal(b.keyLocation, `${ORIGIN}/${KEY}.txt`);
  assert.throws(() => buildBody(KEY, [...URLS, `${ORIGIN}/en/esim/china/`]), /outside the RU segment/);
  assert.throws(() => buildBody(KEY, ['https://evil.example/']), /outside the RU segment/);
  assert.throws(() => buildBody(KEY, []), /nothing to send/);
  assert.throws(() => buildBody(KEY, Array.from({ length: MAX_URLS + 1 }, () => URLS[0])), /MAX_URLS/);
});

test('submit: 200 accepted / 202 key pending in one POST to the fixed Yandex endpoint', async () => {
  assert.equal(ENDPOINT, 'https://yandex.com/indexnow');
  for (const [status, outcome] of [[200, 'accepted'], [202, 'pending_key']]) {
    const h = harness([{ status }]);
    const r = await submit(KEY, URLS, h.opts);
    assert.deepEqual(r, { outcome, status, attempts: 1 });
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
    assert.deepEqual(await submit(KEY, URLS, h.opts), { outcome: 'rejected', status, attempts: 1 });
    assert.equal(h.calls.length, 1);
  }
});

test('submit: 429 / 5xx / network errors are retried a bounded number of times, Retry-After honoured and capped', async () => {
  let h = harness([{ status: 429 }, { status: 200 }]);
  assert.deepEqual(await submit(KEY, URLS, h.opts), { outcome: 'accepted', status: 200, attempts: 2 });
  assert.deepEqual(h.sleeps, [RETRY_DELAYS_MS[0]]);

  h = harness([{ status: 429, headers: { 'retry-after': '90' } }, { status: 200 }]);
  await submit(KEY, URLS, h.opts);
  assert.deepEqual(h.sleeps, [90_000]);

  h = harness([{ status: 429, headers: { 'retry-after': '99999' } }, { status: 200 }]);
  await submit(KEY, URLS, h.opts);
  assert.deepEqual(h.sleeps, [RETRY_AFTER_CAP_MS]);

  h = harness([{ status: 504 }]);
  assert.deepEqual(await submit(KEY, URLS, h.opts), { outcome: 'gave_up', status: 504, attempts: RETRY_DELAYS_MS.length + 1 });
  assert.deepEqual(h.sleeps, [...RETRY_DELAYS_MS]);
  assert.equal(h.calls.length, RETRY_DELAYS_MS.length + 1, 'bounded — never an endless loop');

  h = harness([Object.assign(new Error('reset'), { code: 'ECONNRESET' })]);
  assert.deepEqual(await submit(KEY, URLS, h.opts), { outcome: 'gave_up', status: null, attempts: RETRY_DELAYS_MS.length + 1 });
});

test('the key never reaches a log line', async () => {
  for (const answers of [[{ status: 200 }], [{ status: 202 }], [{ status: 403 }], [{ status: 503 }], [new Error('x')]]) {
    const h = harness(answers);
    await submit(KEY, URLS, h.opts);
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
  assert.match(code, /timeout-minutes: 20/);
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
