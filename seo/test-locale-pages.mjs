/* The locale generator and the catalogue automation, ready for more languages
 * and publishing none (I18N-08).
 *
 *   1. ENGLISH DID NOT MOVE. The English pages built through the locale
 *      generator equal the committed ones byte for byte (also pinned by
 *      seo/test-en-pages.mjs and seo/test-one-pipeline.mjs, which rebuild in a
 *      sandbox), and both entry points produce the same pages.
 *   2. NOTHING ELSE CAN BE PUBLISHED BY ACCIDENT. The generator refuses every
 *      language that is not enabled, or has no page copy or guides; it carries
 *      no hard-coded route of one language.
 *   3. THE AUTOMATION READS THE REGISTRY. The refresh allowlist, the sitemap's
 *      language homes and the workflow's two path lists equal what
 *      seo/locales.mjs derives — and a REHEARSED registry with Spanish enabled
 *      produces Spanish paths, so turning a language on is one registry change
 *      plus the workflow line this test then demands.
 *
 * Run: node --test seo/test-locale-pages.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LOCALES, refreshStagePaths, refreshTreePaths, catalogueLocalePaths, indexablePrefixedHomes, prefixedSiteLocales, asPlanned } from './locales.mjs';
import { localeGenerator, cannotBuild, publishedLocales, GUIDES_BY_LOCALE } from './build-locale-pages.mjs';
import * as EN_ENTRY from './build-en-pages.mjs';
import { PAGE_COPY } from './page-copy.mjs';
import { FIXED_ALLOWED, allowedPaths } from './refresh-allowlist.mjs';
import { sitemapUrls } from './build-sitemap.mjs';
import { stampHtml } from './asset-version.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const NEW = [];   // planned, not published — none since KO-1 (ES-1, DE-1, FR-1, ZH-1, KO-1)

/** The registry with one language turned on — for rehearsal only, never written anywhere. */
const withEnabled = (code) => LOCALES.map((l) => (l.code === code
  ? { ...l, site: { enabled: true, indexableHome: true }, app: l.app }
  : l));

/* ===================================================================== *
 * 1. English did not move
 * ===================================================================== */

test('the generator publishes English, Spanish, German, French, Chinese and Korean, and nothing else', () => {
  assert.deepEqual(publishedLocales(), ['en', 'es', 'de', 'fr', 'zh-Hans', 'ko']);
  assert.deepEqual(Object.keys(PAGE_COPY), ['en', 'es', 'de', 'fr', 'zh-Hans', 'ko']);
  assert.deepEqual(Object.keys(GUIDES_BY_LOCALE), ['en', 'es', 'de', 'fr', 'zh-Hans', 'ko']);
});

test('Spanish built through the locale generator equals the committed pages, byte for byte — home, list, 198 countries, guides', () => {
  const G = localeGenerator('es');
  const list = G.countries();
  assert.equal(list.length, 198);
  const drift = [];
  const same = (html, rel) => stampHtml(html, join(ROOT, dirname(rel))) === read(rel);
  if (!same(G.homePage(list), 'es/index.html')) drift.push('es/');
  for (const c of list) if (!same(G.countryPage(c), `es/esim/${c.slug}/index.html`)) drift.push(c.slug);
  if (!same(G.hubPage(list), 'es/esim/index.html')) drift.push('es/esim/');
  for (const g of GUIDES_BY_LOCALE.es) if (!same(G.guidePage(g), `es/guides/${g.slug}/index.html`)) drift.push(`guide ${g.slug}`);
  if (!same(G.guidesHub(), 'es/guides/index.html')) drift.push('es/guides/');
  if (G.destinationsJs(list) !== read('es/destinations.js')) drift.push('es/destinations.js');
  assert.deepEqual(drift, []);
});

test('English built through the locale generator equals the committed pages, byte for byte', () => {
  // Stamped exactly as build() stamps them on write (content hashes of the
  // assets), so the comparison is the whole file, stamps included.
  const G = localeGenerator('en');
  const list = G.countries();
  assert.equal(list.length, 198);
  const drift = [];
  const same = (html, rel) => stampHtml(html, join(ROOT, dirname(rel))) === read(rel);
  for (const c of list) {
    if (!same(G.countryPage(c), `en/esim/${c.slug}/index.html`)) drift.push(c.slug);
  }
  if (!same(G.hubPage(list), 'en/esim/index.html')) drift.push('en/esim/');
  for (const g of GUIDES_BY_LOCALE.en) {
    if (!same(G.guidePage(g), `en/guides/${g.slug}/index.html`)) drift.push(`guide ${g.slug}`);
  }
  if (!same(G.guidesHub(), 'en/guides/index.html')) drift.push('en/guides/');
  if (G.destinationsJs(list) !== read('en/destinations.js')) drift.push('en/destinations.js');
  assert.deepEqual(drift, []);
});

test('build-en-pages.mjs and the locale generator are the same English, export for export', () => {
  const G = localeGenerator('en');
  const c = G.countries().find((x) => x.slug === 'thailand');
  assert.equal(EN_ENTRY.countryPage(c), G.countryPage(c));
  assert.equal(EN_ENTRY.hubPage(EN_ENTRY.enCountries()), G.hubPage(G.countries()));
  assert.equal(EN_ENTRY.FOOTER, G.FOOTER);
  assert.equal(EN_ENTRY.PAYBAR, G.PAYBAR);
  assert.equal(EN_ENTRY.SKIP_LINK, '<a class="skip" href="#main">Skip to main content</a>');
  assert.deepEqual(EN_ENTRY.POPULAR, PAGE_COPY.en.popular);
});

test('the English pages sit at /en/ and say so', () => {
  const G = localeGenerator('en');
  const page = G.countryPage(G.countries().find((x) => x.slug === 'japan'));
  assert.match(page, /<html lang="en">/);
  assert.match(page, /<link rel="canonical" href="https:\/\/magicesim\.store\/en\/esim\/japan\/">/);
  assert.match(page, /<meta property="og:locale" content="en_US">/);
  assert.match(page, /<meta name="robots" content="index, follow">/, 'japan is in the I18N-09 stage');
  assert.match(page, /<link rel="alternate" hreflang="x-default" href="https:\/\/magicesim\.store\/en\/esim\/japan\/">/);
  const peru = G.countryPage(G.countries().find((x) => x.slug === 'peru'));
  assert.match(peru, /<meta name="robots" content="noindex, follow">/, 'a country outside the stage stays a noindex template');
  assert.doesNotMatch(peru, /<link rel="alternate"/, 'and has no hreflang cluster');
});

test('the Spanish pages sit at /es/ and say so; their indexing is seo/indexing.mjs\'s (I18N-09)', () => {
  const G = localeGenerator('es');
  const page = G.countryPage(G.countries().find((x) => x.slug === 'japan'));
  assert.match(page, /<html lang="es">/);
  assert.match(page, /<link rel="canonical" href="https:\/\/magicesim\.store\/es\/esim\/japan\/">/);
  assert.match(page, /<meta property="og:locale" content="es_ES">/);
  assert.match(page, /<meta name="robots" content="index, follow">/, 'japan is in the stage');
  const peru = G.countryPage(G.countries().find((x) => x.slug === 'peru'));
  assert.match(peru, /<meta name="robots" content="noindex, follow">/, 'peru is outside the stage');
  assert.doesNotMatch(peru, /<link rel="alternate"/);
  for (const rel of ['es/index.html', 'es/esim/index.html', 'es/guides/index.html', 'es/guides/iphone/index.html']) {
    const h = read(rel);
    assert.match(h, /<meta name="robots" content="index, follow">/, rel);
    assert.match(h, /<link rel="alternate" hreflang="es"/, rel);
    assert.ok(h.includes(`<link rel="canonical" href="https://magicesim.store/${rel.replace(/index\.html$/, '')}">`), `${rel}: canonical is itself`);
  }
  assert.ok(read('sitemap.xml').includes('<loc>https://magicesim.store/es/</loc>'), 'the Spanish home is in the sitemap');
});

/* ===================================================================== *
 * 2. Nothing else can be published by accident
 * ===================================================================== */

test('every language but English, Spanish, German, French, Chinese and Korean is refused, each for its stated reason', () => {
  assert.equal(cannotBuild('en'), null);
  assert.equal(cannotBuild('zh-Hans'), null);
  assert.equal(cannotBuild('ko'), null);
  assert.equal(cannotBuild('es'), null);
  assert.equal(cannotBuild('de'), null);
  assert.equal(cannotBuild('fr'), null);
  assert.match(cannotBuild('ru'), /root language/);
  for (const code of NEW) {
    assert.match(cannotBuild(code), /not enabled for the site/, code);
    assert.throws(() => localeGenerator(code), /refusing to publish/, code);
  }
  for (const code of ['xx', 'zh-CN', '', undefined, '__proto__']) assert.match(cannotBuild(code), /unknown locale/, String(code));
});

test('no route directory of an unpublished language exists', () => {
  for (const l of LOCALES.filter((x) => !x.site.enabled)) {
    assert.equal(existsSync(join(ROOT, l.prefix)), false, `/${l.prefix}/`);
  }
});

test('the generator carries no route of one language — only the shared intl assets under /en/', () => {
  const src = read('seo/build-locale-pages.mjs').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const routes = [...src.matchAll(/["'`(]\/en\/[^"'`)\s]*/g)].map((m) => m[0].slice(1))
    .filter((p) => !/^\/en\/(en\.css|checkout\.css|noscript\.css|content\.css|plans\.js|checkout\.js|country\.js|hub\.js)$/.test(p))
    .filter((p) => p !== '/en/esim/<slug>/')
    .filter((p) => !/^\/en\/(privacy|terms|refund)\/$/.test(p)); // the English-only legal documents (LEGAL-1, LEGAL-3), built for English only
  assert.deepEqual(routes, []);
  assert.doesNotMatch(src, /lang="en"|content="en_US"|text\('en'|attr\('en'/);
});

test('the route check can fire', () => {
  const bad = 'x href="/en/esim/" y';
  assert.equal([...bad.matchAll(/["'`(]\/en\/[^"'`)\s]*/g)].length, 1);
});

/* ===================================================================== *
 * 3. The automation reads the registry
 * ===================================================================== */

/* The region pages every refresh may rewrite (seo/regions.mjs), typed here on purpose: widening the allowlist is a decision. */
const REGION_PATHS = ['en/esim/europe/index.html', 'en/esim/asia/index.html', 'en/esim/global/index.html', 'es/esim/europe/index.html', 'es/esim/asia/index.html', 'es/esim/global/index.html', 'de/esim/europe/index.html', 'de/esim/asia/index.html', 'de/esim/global/index.html', 'fr/esim/europe/index.html', 'fr/esim/asia/index.html', 'fr/esim/global/index.html', 'zh/esim/europe/index.html', 'zh/esim/asia/index.html', 'zh/esim/global/index.html', 'ko/esim/europe/index.html', 'ko/esim/asia/index.html', 'ko/esim/global/index.html'];

test('the refresh allowlist is what it was — derived now, not typed', () => {
  assert.deepEqual([...FIXED_ALLOWED], [
    'esim/index.html', 'sitemap.xml', 'seo/catalogue-countries.json', 'seo/fact-sheets.json',
    'seo/sitemap-lastmod.json', 'en/esim/index.html', 'en/destinations.js', 'es/esim/index.html', 'es/destinations.js',
    'de/esim/index.html', 'de/destinations.js', 'fr/esim/index.html', 'fr/destinations.js', 'zh/esim/index.html', 'zh/destinations.js', 'ko/esim/index.html', 'ko/destinations.js',
    'assets/ru-destinations.js',
  ]);
  assert.deepEqual([...allowedPaths(['thailand'])].sort(),
    [...FIXED_ALLOWED, 'esim/thailand/index.html', 'en/esim/thailand/index.html', 'es/esim/thailand/index.html', 'de/esim/thailand/index.html', 'fr/esim/thailand/index.html', 'zh/esim/thailand/index.html', 'ko/esim/thailand/index.html', ...REGION_PATHS].sort());
});

test('the sitemap lists the indexed prefixed pages (I18N-09) — English and Spanish, no planned language', () => {
  const locs = sitemapUrls([]).map((u) => u.loc);
  assert.deepEqual(indexablePrefixedHomes(), ['en', 'es']);
  for (const p of ['en', 'es']) for (const path of ['/', '/esim/', '/guides/', '/guides/iphone/', '/esim/japan/']) assert.ok(locs.includes(`https://magicesim.store/${p}${path}`), `${p}${path}`);
  assert.ok(!locs.includes('https://magicesim.store/en/esim/peru/'), 'a country outside the stage');
  assert.equal(locs.filter((l) => /magicesim\.store\/(de|fr|zh|ko)\//.test(l)).length, 0);
});

test('the workflow stages and hashes exactly the registry\'s paths', () => {
  // The workflow keeps LITERAL path lists on purpose — it holds contents:write
  // and a reviewer must be able to read what it stages. This is what keeps the
  // literals and the registry the same list: enabling a language without
  // updating the workflow in the same change fails here.
  const wf = read('.github/workflows/seo-refresh-pr.yml');
  const add = wf.match(/^\s*git add -- (.+)$/m);
  assert.ok(add, 'the git add line');
  assert.deepEqual(add[1].trim().split(/\s+/), refreshStagePaths());
  const tree = wf.match(/tree\(\) \{ find (.+?) -type f/);
  assert.ok(tree, 'the reproducibility hash');
  assert.deepEqual(tree[1].trim().split(/\s+/), refreshTreePaths());
});

test('REHEARSAL: enabling a language is the registry flip — Korean «as if planned» carries no path, published it does; nothing is written', () => {
  // KO-1 published Korean; the rehearsal now runs from a copy of the registry in which it is still planned (asPlanned).
  const before = asPlanned('ko');
  assert.deepEqual(prefixedSiteLocales(before).map((l) => l.code), ['en', 'es', 'de', 'fr', 'zh-Hans']);
  assert.equal(refreshStagePaths(before).some((p) => p.startsWith('ko/')), false);
  assert.equal(catalogueLocalePaths(['peru'], before).perCountry.includes('ko/esim/peru/index.html'), false);
  // …and the live registry, with Korean published, carries its paths
  assert.deepEqual(prefixedSiteLocales().map((l) => l.code), ['en', 'es', 'de', 'fr', 'zh-Hans', 'ko']);
  assert.deepEqual(refreshStagePaths(), ['esim', 'en/esim', 'en/destinations.js', 'es/esim', 'es/destinations.js',
    'de/esim', 'de/destinations.js', 'fr/esim', 'fr/destinations.js', 'zh/esim', 'zh/destinations.js', 'ko/esim', 'ko/destinations.js',
    'seo/catalogue-countries.json', 'seo/fact-sheets.json', 'seo/sitemap-lastmod.json', 'sitemap.xml']);
  assert.deepEqual(refreshTreePaths(), ['esim', 'en/esim', 'en/destinations.js', 'es/esim', 'es/destinations.js',
    'de/esim', 'de/destinations.js', 'fr/esim', 'fr/destinations.js', 'zh/esim', 'zh/destinations.js', 'ko/esim', 'ko/destinations.js', 'seo', 'sitemap.xml']);
  assert.deepEqual(catalogueLocalePaths(['peru']), {
    fixed: ['en/esim/index.html', 'en/destinations.js', 'es/esim/index.html', 'es/destinations.js', 'de/esim/index.html', 'de/destinations.js',
      'fr/esim/index.html', 'fr/destinations.js', 'zh/esim/index.html', 'zh/destinations.js', 'ko/esim/index.html', 'ko/destinations.js'],
    perCountry: ['en/esim/peru/index.html', 'es/esim/peru/index.html', 'de/esim/peru/index.html', 'fr/esim/peru/index.html', 'zh/esim/peru/index.html', 'ko/esim/peru/index.html'],
    // The region pages (seo/regions.mjs, stage 4, 2026-10-27): they print seo/global-plan-facts.json, so a refresh may
    // rewrite them — accepted deliberately, three per published language, never a country slug.
    perRegion: REGION_PATHS,
  });
  // Opening Korean to search engines is a separate flip, rehearsed only: an indexable Korean home would join EN and ES.
  assert.deepEqual(indexablePrefixedHomes(), ['en', 'es'], 'Korean is published under noindex (owner D11)');
  assert.deepEqual(indexablePrefixedHomes(withEnabled('ko')), ['en', 'es', 'ko'], 'an indexable Korean home would join English and Spanish');
});

test('the page copy is complete for every language it has', () => {
  for (const [code, copy] of Object.entries(PAGE_COPY)) {
    for (const [k, v] of Object.entries(copy)) {
      const sample = typeof v === 'function' ? v('X') : v;
      assert.ok(Array.isArray(sample) ? sample.length : String(sample).trim(), `${code}.${k}`);
    }
    const slugs = new Set(JSON.parse(read('seo/catalogue-countries.json')).countries.map((c) => c.slug));
    for (const p of copy.popular) assert.ok(slugs.has(p.slug), `${code}: popular ${p.slug} has no page`);
  }
});
