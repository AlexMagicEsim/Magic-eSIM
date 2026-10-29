/**
 * I18N-10 (2026-10-22): the storefront's interface words, ONE file per language.
 *
 *   assets/i18n/<code>.js         the words of one language (source)
 *   assets/site-i18n.js           the engine, no words (source; in Node it reads every words file)
 *   assets/site-i18n-<prefix>.js  the bundle a page loads = its words + the engine (GENERATED, seo/site-i18n-bundle.mjs)
 *
 * What this file holds:
 *   1. no word changed in the move — every language equals the golden recorded from storefront 92110e04;
 *   2. the dictionaries are whole: each published prefixed language has the English keys (plus the extra plural
 *      forms its own Intl.PluralRules needs), every value a non-empty string with the English placeholders;
 *   3. the engine carries no word, each words file carries one language;
 *   4. every committed bundle is exactly bundleSource(), and only published prefixed languages have one;
 *   5. every page loads ONLY its own language's words — one bundle, deferred, where the old file stood; the
 *      Russian pages and the guides load none, nothing loads the bare engine or a words file directly;
 *   6. a bundle run as the browser runs it (no `module`) knows its language only, renders every key in it and
 *      never paints a key over a page whose words are missing;
 *   7. the sitemap's content hash reads a bundle URL as the old URL, so no `lastmod` moved;
 *   8. a planned language (ZH-Hans, KO) gets its own bundle URL and no file until it is published — adding it
 *      adds nothing to any other page.
 *
 * Run: node --test seo/test-site-i18n-split.mjs   (record a reviewed wording change: … --record)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { LOCALES, asPlanned } from './locales.mjs';
import { bundleSource, bundledLocales, siteI18nBundle, wordsFile } from './site-i18n-bundle.mjs';
import { contentHash, stripSiteI18nBundle } from './build-sitemap.mjs';
import { rehearsalGenerator } from './build-locale-pages.mjs';
import { PAGE_COPY } from './page-copy.mjs';
import { EN_GUIDES } from './guides-en.mjs';
import { COUNTRY_PAGES } from './catalogue-page-count.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const SITE = require(join(ROOT, 'assets/site-i18n.js'));
const GOLDEN_FILE = join(ROOT, 'test/fixtures/site-i18n-words-golden.json');
const pairsHash = (dict) => createHash('sha256').update(JSON.stringify(Object.entries(dict))).digest('hex');

const PUBLISHED = bundledLocales();                                   // en, es, de, fr today
/* KO-1: every registry language is published; a language is rehearsed «as if still planned» (seo/locales.mjs asPlanned)
 * so this check keeps a subject — Korean, on its real names, never written. */
const LIVE_PLANNED = LOCALES.filter((l) => l.prefix && !l.site.enabled);
const PLANNED = LIVE_PLANNED.length ? LIVE_PLANNED : [LOCALES.find((l) => l.code === 'ko')];
const registryFor = (code) => (LIVE_PLANNED.some((l) => l.code === code) ? LOCALES : asPlanned(code));

if (process.argv.includes('--record')) {
  const g = JSON.parse(readFileSync(GOLDEN_FILE, 'utf8'));
  g.languages = Object.fromEntries(SITE.LANGS.map((l) => [l, { keys: Object.keys(SITE.DICT[l]).length, sha256: pairsHash(SITE.DICT[l]) }]));
  writeFileSync(GOLDEN_FILE, JSON.stringify(g, null, 2) + '\n');
  console.log('recorded', GOLDEN_FILE);
}

/* ------------------------------------------------------------------ 1. no word changed */

test('no word changed: every language equals the golden recorded before the split (storefront 92110e04)', () => {
  const golden = JSON.parse(readFileSync(GOLDEN_FILE, 'utf8')).languages;
  assert.deepEqual(Object.keys(golden), SITE.LANGS);
  for (const l of SITE.LANGS) {
    assert.equal(Object.keys(SITE.DICT[l]).length, golden[l].keys, `${l}: key count`);
    assert.equal(pairsHash(SITE.DICT[l]), golden[l].sha256, `${l}: a key, a value or their order changed`);
  }
});

test('the golden can fire: one changed character in one language moves exactly that language', () => {
  const golden = JSON.parse(readFileSync(GOLDEN_FILE, 'utf8')).languages;
  const changed = { ...SITE.DICT.de, 'nav.how': `${SITE.DICT.de['nav.how']}.` };
  assert.notEqual(pairsHash(changed), golden.de.sha256);
  for (const l of ['ru', 'en', 'es', 'fr']) assert.equal(pairsHash(SITE.DICT[l]), golden[l].sha256, l);
});

/* ------------------------------------------------------------------ 2. whole dictionaries */

const placeholders = (s) => [...String(s).matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]).sort();
const PLURAL_CATS = ['zero', 'one', 'two', 'few', 'many', 'other'];

for (const code of PUBLISHED) {
  test(`${code}: the English keys, the plural forms its language needs, nothing else; placeholders kept`, () => {
    const en = SITE.DICT.en;
    const d = SITE.DICT[code];
    for (const k of Object.keys(en)) assert.ok(Object.prototype.hasOwnProperty.call(d, k), `${code}: no ${k}`);
    for (const k of Object.keys(d)) {
      if (Object.prototype.hasOwnProperty.call(en, k)) continue;
      // an extra key is only a plural category of a base English pluralises (French `.many`), and one this
      // language's own rules can select
      const m = k.match(/^(.*)\.([a-z]+)$/);
      assert.ok(m && PLURAL_CATS.includes(m[2]) && Object.prototype.hasOwnProperty.call(en, `${m[1]}.other`), `${code}: unexpected key ${k}`);
      assert.ok(new Intl.PluralRules(code).resolvedOptions().pluralCategories.includes(m[2]), `${code}: ${k} — a category ${code} never selects`);
    }
    for (const [k, v] of Object.entries(d)) {
      assert.equal(typeof v, 'string', `${code}.${k}`);
      assert.ok(v.trim().length > 0, `${code}.${k} is empty`);
      const base = Object.prototype.hasOwnProperty.call(en, k) ? k : k.replace(/\.[a-z]+$/, '.other');
      assert.deepEqual(placeholders(v), placeholders(en[base]), `${code}.${k}: placeholders differ from en.${base}`);
    }
  });
}

test('every key a browser script names in a literal exists in every published language', () => {
  const keys = new Set();
  for (const f of readdirSync(join(ROOT, 'en')).filter((n) => n.endsWith('.js'))) {
    for (const m of read(`en/${f}`).matchAll(/\b(t|plural)\('([a-zA-Z0-9_.]+)'/g)) keys.add(m[1] === 'plural' ? `${m[2]}.other` : m[2]);
  }
  assert.ok(keys.size >= 20, `literal keys found: ${keys.size}`);
  for (const code of PUBLISHED) for (const k of keys) assert.ok(Object.prototype.hasOwnProperty.call(SITE.DICT[code], k), `${code}: ${k}`);
});

/* ------------------------------------------------------------------ 3. engine and words files */

test('the engine carries no word; each words file is one language, and every language of the engine has one', () => {
  const engine = read('assets/site-i18n.js');
  for (const k of ['nav.destinations', 'checkout.title', 'hub.noMatches', 'fmt.numberLocale']) {
    assert.ok(!engine.includes(`'${k}'`), `assets/site-i18n.js still holds ${k}`);
  }
  const files = readdirSync(join(ROOT, 'assets/i18n')).sort();
  assert.deepEqual(files, SITE.LANGS.map((l) => `${l}.js`).sort(), 'assets/i18n/ = one file per language of the engine, no more');
  for (const l of SITE.LANGS) {
    const src = read(wordsFile(l));
    assert.match(src, new RegExp(`\\(root\\.MagicSiteWords = root\\.MagicSiteWords \\|\\| \\{\\}\\)\\['${l}'\\] = WORDS;`), `${l}: registers under its own code`);
    assert.equal((src.match(/MagicSiteWords/g) || []).length, 2, `${l}: one registration`);
    const words = require(join(ROOT, wordsFile(l)));
    assert.ok(Object.isFrozen(SITE.DICT[l]), `${l}: frozen`);
    assert.equal(words, SITE.DICT[l], `${l}: the engine serves the file's own table`);
  }
  assert.deepEqual(Object.keys(SITE.PREFIX), SITE.LANGS);
});

/* ------------------------------------------------------------------ 4. bundles */

test('every committed bundle is exactly its words + the engine; only published prefixed languages have one', () => {
  assert.deepEqual(PUBLISHED, LOCALES.filter((l) => l.prefix && l.site.enabled).map((l) => l.code));
  for (const code of PUBLISHED) {
    const { path } = siteI18nBundle(code);
    assert.equal(read(path), bundleSource(code), `${path} is stale — run node seo/build-locale-pages.mjs`);
    assert.ok(read(path).startsWith(`/* ${path} — GENERATED`), path);
  }
  const bundles = readdirSync(join(ROOT, 'assets')).filter((n) => /^site-i18n-.+\.js$/.test(n)).sort();
  assert.deepEqual(bundles, PUBLISHED.map((c) => siteI18nBundle(c).path.slice('assets/'.length)).sort(), 'no bundle of an unpublished language');
  assert.throws(() => siteI18nBundle('ru'), /root language/);
});

test('a bundle holds one language: smaller than the old shared file, and no other language’s words file inside', () => {
  const OLD_SHARED_BYTES = 45991; // assets/site-i18n.js at 92110e04: engine + ru, en, es, de, fr
  for (const code of PUBLISHED) {
    const src = read(siteI18nBundle(code).path);
    assert.ok(Buffer.byteLength(src) < OLD_SHARED_BYTES / 2, `${code}: ${Buffer.byteLength(src)} bytes`);
    for (const other of SITE.LANGS.filter((l) => l !== code)) {
      assert.ok(!src.includes(`['${other}'] = WORDS`), `${code} bundle carries ${other}`);
    }
  }
});

/* ------------------------------------------------------------------ 5. pages */

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', '.claude', 'test', 'seo', 'scripts', 'infra'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) htmlFiles(full, out);
    else if (name.endsWith('.html')) out.push(relative(ROOT, full));
  }
  return out;
}

test('every page loads only its own language’s words: one bundle, deferred; Russian pages and guides none', () => {
  const PREFIXED = new Map(LOCALES.filter((l) => l.prefix).map((l) => [l.prefix, l.code]));
  let withWords = 0;
  for (const rel of htmlFiles(ROOT)) {
    const html = read(rel);
    assert.doesNotMatch(html, /\/assets\/site-i18n\.js|\/assets\/i18n\//, `${rel}: loads the engine or a words file directly`);
    const tags = [...html.matchAll(/<script src="(\/assets\/site-i18n-[^"?]+\.js)(?:\?v=[0-9a-f]{8})?"([^>]*)><\/script>/g)];
    const top = rel.split('/')[0];
    const code = PREFIXED.get(top);
    if (!code || rel.startsWith(`${top}/guides/`) || /^[a-z]+\/(privacy|terms|refund)\/(v\d[\d.]*\/)?index\.html$/.test(rel)) { // the legal documents (every language, LEGAL-4) have no script but the logo's, as the guides
      assert.equal(tags.length, 0, `${rel}: loads a words bundle`);
      continue;
    }
    assert.equal(tags.length, 1, `${rel}: exactly one words bundle`);
    assert.equal(tags[0][1], siteI18nBundle(code).src, `${rel}: another language's words`);
    assert.match(tags[0][2], /^ defer$/, `${rel}: the bundle is deferred (never render-blocking)`);
    assert.match(html, new RegExp(`${siteI18nBundle(code).src.replace(/[.]/g, '\\.')}\\?v=[0-9a-f]{8}"`), `${rel}: stamped`);
    withWords += 1;
  }
  assert.equal(withWords, PUBLISHED.length * (COUNTRY_PAGES + 5), 'home + list + one page per catalogue country + 3 region pages per published language');
});

/* ------------------------------------------------------------------ 6. the bundle in a browser */

function browserRun(code, { html = 'x', withWords = true } = {}) {
  const els = [];
  const document = {
    documentElement: { getAttribute: () => html },
    querySelectorAll: (sel) => els.filter((e) => (sel === '[data-i18n]' ? e.k : e.a)),
  };
  const ctx = { document, Intl, Object, String, Number };
  ctx.window = ctx;
  vm.createContext(ctx);
  const src = withWords ? read(siteI18nBundle(code).path) : read('assets/site-i18n.js');
  vm.runInContext(src, ctx, { filename: `site-i18n-${code}.js` });
  return { ctx, els };
}

for (const code of PUBLISHED) {
  test(`${code}: the bundle, run as the browser runs it, knows ${code} only and renders every key in it`, () => {
    const { ctx, els } = browserRun(code, { html: code });
    const S = ctx.MagicSiteI18n;
    assert.deepEqual(Object.keys(S.DICT), [code], 'only its own language is loaded');
    assert.equal(S.pageLang(ctx.document), code);
    const I = S.createI18n(code);
    for (const [k, v] of Object.entries(SITE.DICT[code])) assert.equal(I.t(k), v, `${code}.${k}`);
    assert.equal(I.plural('hub.matches', 1, { n: 1 }), SITE.createI18n(code).plural('hub.matches', 1, { n: 1 }));
    // apply() fills data-i18n and the three allowed attributes from the page's language
    const el = { k: 1, getAttribute: () => 'nav.how', textContent: 'static' };
    const at = { a: 1, getAttribute: () => 'placeholder:home.searchPlaceholder', setAttribute(n, v) { this[n] = v; } };
    els.push(el, at);
    I.apply(ctx.document);
    assert.equal(el.textContent, SITE.DICT[code]['nav.how']);
    assert.equal(at.placeholder, SITE.DICT[code]['home.searchPlaceholder']);
    assert.equal(S.pathPrefix(code), `/${LOCALES.find((l) => l.code === code).prefix}`);
  });
}

test('a page whose words are missing keeps its static text — the engine never paints keys over it', () => {
  const { ctx, els } = browserRun('en', { html: 'en', withWords: false });
  assert.deepEqual(Object.keys(ctx.MagicSiteI18n.DICT), []);
  const el = { k: 1, getAttribute: () => 'nav.how', textContent: 'How it works' };
  els.push(el);
  ctx.MagicSiteI18n.createI18n('en').apply(ctx.document);
  assert.equal(el.textContent, 'How it works');
});

test('Node reads every language through the engine (generators, tests, the localization-qa skill)', () => {
  assert.deepEqual(Object.keys(SITE.DICT), SITE.LANGS);
  assert.equal(SITE.createI18n('es').t('nav.how'), SITE.DICT.es['nav.how']);
  assert.equal(SITE.createI18n('pl').t('nav.how'), SITE.DICT.ru['nav.how'], 'unknown → Russian, as before');
});

/* ------------------------------------------------------------------ 7. sitemap */

test('the sitemap hash reads the bundle URL as the old shared URL — no lastmod moved', () => {
  for (const rel of ['en/index.html', 'es/esim/japan/index.html', 'en/esim/index.html']) {
    const html = read(rel);
    const old = html.replace(/\/assets\/site-i18n-[a-z]+\.js/, '/assets/site-i18n.js');
    assert.notEqual(old, html, rel);
    assert.equal(stripSiteI18nBundle(html), old, `${rel}: round trip`);
    assert.equal(contentHash(html), contentHash(old), rel);
  }
  // the strip touches only that one script tag
  assert.equal(stripSiteI18nBundle('<a href="/assets/site-i18n-en.js">x</a>'), '<a href="/assets/site-i18n-en.js">x</a>');
});

/* ------------------------------------------------------------------ 8. ZH-Hans / KO */

for (const L of PLANNED) {
  test(`${L.code}: a planned language gets its own bundle URL and no file — it adds nothing to another page`, () => {
    const G = rehearsalGenerator(L.code, { copy: PAGE_COPY.en, guides: EN_GUIDES, words: SITE.DICT.en, registry: registryFor(L.code) });
    const list = G.countries();
    for (const html of [G.homePage(list), G.hubPage(list), G.countryPage(list[0])]) {
      const words = [...html.matchAll(/\/assets\/site-i18n[a-z-]*\.js/g)].map((m) => m[0]);
      assert.deepEqual(words, [`/assets/site-i18n-${L.prefix}.js`]);
    }
    if (LIVE_PLANNED.some((l) => l.code === L.code)) {
      assert.ok(!existsSync(join(ROOT, `assets/site-i18n-${L.prefix}.js`)), 'no public bundle before it is published');
      assert.ok(!existsSync(join(ROOT, `assets/i18n/${L.code}.js`)), 'no words file before the language stage');
      assert.ok(!SITE.LANGS.includes(L.code));
    } else {
      // rehearsed «as if planned» (KO-1): its bundle is its own, published, and holds only its own words
      assert.ok(SITE.LANGS.includes(L.code));
      assert.ok(!read(`assets/site-i18n-${L.prefix}.js`).includes("['en'] = WORDS"), 'no other language inside');
    }
  });
}
