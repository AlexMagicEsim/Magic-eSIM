// The first-visit language of «/» — the English home since the EN-root migration (owner, 2026-11-07; before it «/» was
// the Russian home) — (assets/lang-route.js) and the saved choice (assets/logo-once.js).
//   1. decide(): only «/», never after a same-origin arrival, the saved choice before the browser, the first published
//      browser language, else English (stay); a Russian browser goes to /ru/; ?country= always to /ru/?country=…;
//      the whole query kept, a hash only where the target has it;
//   2. its tables = the site's: PREFIX = assets/site-i18n.js PREFIX, HOME = seo/locales.mjs homes; every kept hash is a
//      section of every home;
//   3. only the English home index.html loads it, FIRST in <head>, before any other script;
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

test('browser languages → the home of the first language we publish; English (and anything unknown) stays on «/»', () => {
  const cases = [
    [['ru-RU'], '/ru/'], [['ru'], '/ru/'], [['en-US'], null], [['es-419'], '/es/'], [['fr-CA'], '/fr/'], [['de-AT'], '/de/'],
    [['zh-CN'], '/zh/'], [['zh-TW'], '/zh/'], [['zh-Hant-HK'], '/zh/'], [['ko-KR'], '/ko/'], [['ja-JP'], null],
    [['uk-UA'], null], [['pl-PL'], null], [['xx'], null], [['pt-BR', 'ru'], '/ru/'], [['ja', 'de-CH'], '/de/'], [['en_GB'], null],
    [[], null], [[undefined], null], [['EN-us'], null], [['RU-ru'], '/ru/'],
  ];
  for (const [languages, want] of cases) assert.equal(R.decide(env({ languages })), want, JSON.stringify(languages));
});

test('the saved choice wins; a saved English stays, a saved Russian moves', () => {
  assert.equal(R.decide(env({ stored: 'ko', languages: ['ru'] })), '/ko/');
  assert.equal(R.decide(env({ stored: 'zh-Hans' })), '/zh/');
  assert.equal(R.decide(env({ stored: 'en', languages: ['ru-RU'] })), null);
  assert.equal(R.decide(env({ stored: 'ru', languages: ['en-US'] })), '/ru/');
});

test('only «/», never after an arrival from this site; ?country= always to the Russian home that resolves it', () => {
  for (const pathname of ['/index.html', '/ru/', '/ru/esim/', '/ru/esim/turkey/', '/destinations/turkey/', '/es/', '/es/esim/japan/',
    '/ru/iphone.html', '/pay/x', '/en/', '']) {
    assert.equal(R.decide(env({ pathname, languages: ['ru'] })), null, pathname);
  }
  // `${O}/en/`: the old English home's client-side redirect page sends its visitor to «/» — never on to /ru/
  for (const referrer of [`${O}/`, `${O}/ru/`, `${O}/ru/esim/turkey/`, `${O}/es/`, `${O}/en/`, `${O}/esim/turkey/`, O]) {
    assert.equal(R.decide(env({ referrer, languages: ['ru'] })), null, referrer);
  }
  for (const referrer of ['https://www.google.com/', 'https://yandex.ru/search/?text=esim', 'https://magicesim.store.evil.com/', 'android-app://org.telegram.messenger/']) {
    assert.equal(R.decide(env({ referrer, languages: ['ru'] })), '/ru/', referrer);
  }
  for (const search of ['?country=TR', '?utm_source=a&country=TR']) {
    for (const o of [{}, { languages: ['ru'] }, { stored: 'en' }, { referrer: `${O}/` }]) {
      assert.equal(R.decide(env({ search, ...o })), `/ru/${search}`, `${search} ${JSON.stringify(o)}`);
    }
  }
  assert.equal(R.decide(env({ search: '?mycountry=TR' })), null);
  assert.equal(R.decide(env({ search: '?mycountry=TR', languages: ['ru'] })), '/ru/?mycountry=TR');
});

test('the whole query is kept (utm, click ids, partner marks); a hash only where the target has that section', () => {
  const q = '?utm_source=tg&utm_medium=post&utm_campaign=c1&utm_content=a%20b&gclid=G&yclid=Y&fbclid=F&ref=p7&promo=X';
  const ru = { languages: ['ru-RU'] };
  assert.equal(R.decide(env({ ...ru, search: q, hash: '#plans' })), `/ru/${q}#plans`);
  assert.equal(R.decide(env({ ...ru, hash: '#global-pricing' })), '/ru/#plans');
  assert.equal(R.decide(env({ ...ru, hash: '#solution' })), '/ru/#how');
  assert.equal(R.decide(env({ ...ru, hash: '#install-guides-section' })), '/ru/#guides');
  assert.equal(R.decide(env({ languages: ['es'], hash: '#compat' })), '/es/#compat');
  for (const hash of ['#faq', '#top', '#x', '#']) assert.equal(R.decide(env({ ...ru, hash })), '/ru/', hash);
});

test('the tables are the site\'s: PREFIX = assets/site-i18n.js, HOME = the registry; every kept hash is a section of every home', async () => {
  const { LOCALES, homePath } = await import('./locales.mjs');
  assert.deepEqual(R.PREFIX, SITE.PREFIX);
  assert.deepEqual({ ...R.HOME }, Object.fromEntries(LOCALES.filter((l) => l.site.enabled).map((l) => [l.code, homePath(l.code)])));
  assert.equal(R.KEY, 'mesim.site.lang');
  assert.match(read('assets/site-i18n.js'), /var STORAGE_KEY = 'mesim\.site\.lang';/);
  for (const home of Object.values(R.HOME)) {
    const h = read(`${home.slice(1)}index.html`);
    for (const target of new Set(Object.values(R.HASHES))) assert.ok(h.includes(` id="${target.slice(1)}"`), `${home} has ${target}`);
  }
});

test('only the English home index.html loads it, first in <head>, before any other script', () => {
  const h = read('index.html');
  const head = h.slice(0, h.indexOf('</head>'));
  const first = head.search(/<script\b/);
  assert.match(head.slice(first), /^<script src="\/assets\/lang-route\.js\?v=[0-9a-f]{8}"><\/script>/);
  assert.ok(first < head.indexOf('<title>'), 'before the title, so nothing of the English page paints first');
  assert.ok(!head.includes('mc.yandex'), 'the English home loads no counter');
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

test('canonical and hreflang of «/» (the English home) and /ru/ are their own, x-default = «/»', () => {
  const h = read('index.html');
  assert.ok(h.includes('<link rel="canonical" href="https://magicesim.store/">'));
  assert.ok(h.includes('<link rel="alternate" hreflang="x-default" href="https://magicesim.store/">'));
  assert.ok(h.includes('<link rel="alternate" hreflang="ru" href="https://magicesim.store/ru/">'));
  const r = read('ru/index.html');
  assert.ok(r.includes('<link rel="canonical" href="https://magicesim.store/ru/" />'));
  assert.ok(r.includes('<link rel="alternate" hreflang="x-default" href="https://magicesim.store/" />'));
  assert.ok(!r.includes('lang-route'), '/ru/ never moves anyone');
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

// 6. The browser tests of «/» run in WebKit's `webkit-lang-route` project, ONE at a time, and intercept NOTHING: every
//    intermittent WebKit failure in CI (2026-10-23 … 10-27, 23 of 23) was a moving visit to «/» run with page.route on,
//    in a worker that shared the runner with another WebKit worker moving a visit at the same moment. landed() tolerates
//    nothing: no engine-drop annotation, no recovery navigation (a dead tab never recovered anyway).
export function langRouteSpecProblems(spec, config) {
  const out = [];
  if (/\b(?:page|context)\.(?:route|routeFromHAR|routeWebSocket)\(/.test(spec)) out.push('the spec intercepts requests');
  if (/webkit-navigation-stall|engineDropped|browserType\(\)\.name\(\)/.test(spec)) out.push('landed() tolerates an engine drop');
  if (!/proxy: \{ server: 'http:\/\/127\.0\.0\.1:9', bypass: '127\.0\.0\.1,localhost' \}/.test(spec)) out.push('off-site requests are not kept off the network');
  const block = config.match(/name: 'webkit-lang-route',[\s\S]*?\n {4}\},/);
  if (!block) out.push('no webkit-lang-route project');
  else {
    if (!/testMatch: \/\(\?:\^\|\[\\\\\/\]\)lang-route\\\.spec\\\.js\$\//.test(block[0])) out.push('webkit-lang-route does not run lang-route.spec.js');
    if (!/\n {6}workers: 1,\n/.test(block[0])) out.push('webkit-lang-route is not one worker');
    if (!/devices\['Desktop Safari'\]/.test(block[0])) out.push('webkit-lang-route is not WebKit');
  }
  const flags = config.match(/name: 'webkit-flags',[\s\S]*?\n {4}\},/);
  if (flags && /lang-route/.test(flags[0].replace(/^\s*\/\/.*$/gm, ''))) out.push('lang-route.spec.js also runs in webkit-flags');
  return out;
}

test('lang-route browser tests: own WebKit project, one worker, no interception, no tolerance', () => {
  assert.deepEqual(langRouteSpecProblems(read('test/e2e/lang-route.spec.js'), read('playwright.config.js')), []);
});

test('negative controls: interception, a tolerance, a shared or parallel WebKit project are caught', () => {
  const spec = read('test/e2e/lang-route.spec.js'), config = read('playwright.config.js');
  const bad = (s, c) => assert.notDeepEqual(langRouteSpecProblems(s, c), []);
  bad(spec + "\nawait page.route(/x/, (r) => r.abort());\n", config);
  bad(spec + "\nawait context.route('**', (r) => r.continue());\n", config);
  bad(spec + "\ntest.info().annotations.push({ type: 'webkit-navigation-stall' });\n", config);
  bad(spec.replace("server: 'http://127.0.0.1:9'", "server: 'http://proxy:3128'"), config);
  bad(spec, config.replace(/(name: 'webkit-lang-route',[\s\S]*?)\n {6}workers: 1,\n/, '$1\n'));
  bad(spec, config.replace("name: 'webkit-lang-route'", "name: 'webkit-other'"));
  bad(spec, config.replace('miniapp-catalogue-races|no-horizontal-scroll', 'miniapp-catalogue-races|lang-route|no-horizontal-scroll'));
});
