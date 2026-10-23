// The first-visit language of «/» (assets/lang-route.js; owner, 2026-10-23) and the saved choice (assets/logo-once.js).
//   1. decide(): only «/», never after a same-origin arrival, never with ?country=, the saved choice before the browser,
//      the first published browser language, else English; the whole query kept, a hash only where the target has it;
//   2. its tables = the site's: PREFIX = assets/site-i18n.js PREFIX; every kept hash is a section of all six homes;
//   3. only index.html loads it, FIRST in <head>, before any other script (the counter included);
//   4. no URL / canonical / hreflang / sitemap change: «/» hashes the same with and without the route lines;
//   5. no robot detection: no User-Agent, no bot names, no IP / geo lookup in either file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { contentHash, stripLangRoute } from './build-sitemap.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const R = require(join(ROOT, 'assets/lang-route.js'));
const SITE = require(join(ROOT, 'assets/site-i18n.js'));
const O = 'https://magicesim.store';
const env = (o) => ({ pathname: '/', search: '', hash: '', referrer: '', origin: O, languages: ['en-US'], stored: null, ...o });

test('browser languages → the home of the first language we publish, else English', () => {
  const cases = [
    [['ru-RU'], null], [['ru'], null], [['en-US'], '/en/'], [['es-419'], '/es/'], [['fr-CA'], '/fr/'], [['de-AT'], '/de/'],
    [['zh-CN'], '/zh/'], [['zh-TW'], '/zh/'], [['zh-Hant-HK'], '/zh/'], [['ko-KR'], '/ko/'], [['ja-JP'], '/en/'],
    [['uk-UA'], '/en/'], [['pt-BR', 'ru'], null], [['ja', 'de-CH'], '/de/'], [['en_GB'], '/en/'], [[], '/en/'],
    [[undefined], '/en/'], [['EN-us'], '/en/'],
  ];
  for (const [languages, want] of cases) assert.equal(R.decide(env({ languages })), want, JSON.stringify(languages));
});

test('the saved choice wins; a saved Russian stays', () => {
  assert.equal(R.decide(env({ stored: 'ko', languages: ['ru'] })), '/ko/');
  assert.equal(R.decide(env({ stored: 'zh-Hans' })), '/zh/');
  assert.equal(R.decide(env({ stored: 'ru', languages: ['en-US'] })), null);
});

test('only «/», never after an arrival from this site, never with ?country=', () => {
  for (const pathname of ['/index.html', '/esim/', '/esim/turkey/', '/en/', '/es/esim/japan/', '/iphone.html', '/pay/x', '']) {
    assert.equal(R.decide(env({ pathname })), null, pathname);
  }
  for (const referrer of [`${O}/`, `${O}/en/`, `${O}/esim/turkey/`, O]) assert.equal(R.decide(env({ referrer })), null, referrer);
  for (const referrer of ['https://www.google.com/', 'https://yandex.ru/search/?text=esim', 'https://magicesim.store.evil.com/', 'android-app://org.telegram.messenger/']) {
    assert.equal(R.decide(env({ referrer })), '/en/', referrer);
  }
  for (const search of ['?country=TR', '?utm_source=a&country=TR']) assert.equal(R.decide(env({ search })), null, search);
  assert.equal(R.decide(env({ search: '?mycountry=TR' })), '/en/?mycountry=TR');
});

test('the whole query is kept (utm, click ids, partner marks); a hash only where the target has that section', () => {
  const q = '?utm_source=tg&utm_medium=post&utm_campaign=c1&utm_content=a%20b&gclid=G&yclid=Y&fbclid=F&ref=p7&promo=X';
  assert.equal(R.decide(env({ search: q, hash: '#plans' })), `/en/${q}#plans`);
  assert.equal(R.decide(env({ hash: '#global-pricing' })), '/en/#plans');
  assert.equal(R.decide(env({ hash: '#solution' })), '/en/#how');
  assert.equal(R.decide(env({ hash: '#install-guides-section' })), '/en/#guides');
  for (const hash of ['#faq', '#top', '#x', '#']) assert.equal(R.decide(env({ hash })), '/en/', hash);
});

test('the tables are the site\'s: PREFIX = assets/site-i18n.js; every kept hash is a section of every prefixed home', () => {
  assert.deepEqual(R.PREFIX, SITE.PREFIX);
  assert.equal(R.KEY, 'mesim.site.lang');
  assert.match(read('assets/site-i18n.js'), /var STORAGE_KEY = 'mesim\.site\.lang';/);
  for (const p of Object.values(SITE.PREFIX).filter(Boolean)) {
    const h = read(`${p}/index.html`);
    for (const target of new Set(Object.values(R.HASHES))) assert.ok(h.includes(` id="${target.slice(1)}"`), `/${p}/ has ${target}`);
  }
});

test('only index.html loads it, first in <head>, before any other script — the counter included', () => {
  const h = read('index.html');
  const head = h.slice(0, h.indexOf('</head>'));
  const first = head.search(/<script\b/);
  assert.match(head.slice(first), /^<script src="\/assets\/lang-route\.js\?v=[0-9a-f]{8}"><\/script>/);
  assert.ok(head.indexOf('mc.yandex') > first, 'the counter comes after');
  const all = [];
  (function walk(dir) {
    for (const n of readdirSync(dir)) {
      if (['node_modules', '.git', 'test', 'test-results', 'playwright-report', 'Magic-eSIM-github-2'].includes(n)) continue;
      const f = join(dir, n);
      if (statSync(f).isDirectory()) walk(f); else if (n.endsWith('.html') && readFileSync(f, 'utf8').includes('lang-route.js')) all.push(f.slice(ROOT.length + 1));
    }
  })(ROOT);
  assert.deepEqual(all, ['index.html']);
});

test('«/» hashes the same with and without the route lines: no sitemap date moves', () => {
  const h = read('index.html');
  const without = stripLangRoute(h);
  assert.ok(!without.includes('lang-route'));
  assert.equal(contentHash(h), contentHash(without));
  assert.notEqual(contentHash(h), contentHash(h.replace('<title>', '<title>x')), 'the hash still sees content');
  const sm = read('sitemap.xml');
  assert.ok(!/lang-route/.test(sm));
});

test('canonical and hreflang of «/» are untouched', () => {
  const h = read('index.html');
  assert.ok(h.includes('<link rel="canonical" href="https://magicesim.store/" />'));
  assert.ok(h.includes('<link rel="alternate" hreflang="x-default" href="https://magicesim.store/en/" />'));
});

test('no robot detection, no User-Agent, no IP / geo in either file', () => {
  for (const f of ['assets/lang-route.js', 'assets/logo-once.js']) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /userAgent|bot|crawler|spider|geolocation|ipapi|ipinfo|fetch\(|XMLHttpRequest/i, f);
  }
});

test('logo-once.js saves a switch click and an arrival from a Russian page, never an automatic move', () => {
  const s = read('assets/logo-once.js');
  assert.match(s, /closest\('a\[hreflang\]'\)/);
  assert.match(s, /\.langsw, \.langmenu, \.mnav-panel/);
  assert.match(s, /mesim\.lang\.auto/);
  assert.match(s, /'mesim\.site\.lang'/);
});
