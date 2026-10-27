// I18N-09: every built page against seo/indexing.mjs — robots, canonical, hreflang clusters (reciprocal, x-default →
// English), the sitemap, the frozen ten, title/description budgets of indexed pages. Reads the committed HTML.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INDEXED_COUNTRIES, GUIDE_RU, cluster, isIndexed, ruAlternates, ruPage, indexedPrefixedPages, pathIn, indexedLocales } from './indexing.mjs';
import { FROZEN_PAGES } from './frozen-pages.mjs';
import { LOCALES, SITE, X_DEFAULT_CURRENT, X_DEFAULT_DECIDED, locale } from './locales.mjs';
import { EN_GUIDES } from './guides-en.mjs';
import { TITLE_MAX } from './page-copy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const fileOf = (path) => (path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1));
const head = (html) => html.slice(0, html.indexOf('</head>'));
const alts = (html) => [...head(html).matchAll(/<link\b(?=[^>]*\brel="alternate")[^>]*\bhreflang="([^"]+)"[^>]*\bhref="([^"]+)"/g)].map((m) => [m[1], m[2]]);
const robots = (html) => (head(html).match(/<meta name="robots" content="([^"]+)"/) || [])[1];
const canonical = (html) => (head(html).match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
const sitemap = new Set([...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
const GUIDES = EN_GUIDES.map((g) => g.slug);
const slugsOf = (prefix) => readdirSync(join(ROOT, prefix, 'esim')).filter((d) => existsSync(join(ROOT, prefix, 'esim', d, 'index.html')));

test('the registry: ES indexable, x-default English, the stage without the ten former experiment pages (owner, not yet) and present in every language', () => {
  assert.deepEqual(indexedLocales().map((l) => l.code), ['ru', 'en', 'es']);
  assert.equal(X_DEFAULT_CURRENT, X_DEFAULT_DECIDED);
  assert.equal(X_DEFAULT_CURRENT, 'en');
  for (const s of INDEXED_COUNTRIES) {
    // the experiment ended 2026-10-24; adding its ten pages to a stage is the owner's separate decision (deferred 2026-10-24)
    assert.ok(!FROZEN_PAGES.has(s), `${s}: a former experiment page — adding it to the stage needs the owner's word`);
    for (const p of ['', 'en/', 'es/']) assert.ok(existsSync(join(ROOT, `${p}esim/${s}/index.html`)), `${p}esim/${s}/ is missing`);
  }
  assert.equal(new Set(INDEXED_COUNTRIES).size, INDEXED_COUNTRIES.length);
  assert.deepEqual(Object.keys(GUIDE_RU).sort(), [...GUIDES].sort());
});

test('every EN/ES page: indexed → index, self-canonical, its exact cluster, in the sitemap; else noindex, no alternate, out', () => {
  let indexed = 0;
  for (const code of ['en', 'es']) {
    const P = `/${locale(code).prefix}`;
    const pages = [{ kind: 'home' }, { kind: 'hub' }, { kind: 'guides' }, ...GUIDES.map((slug) => ({ kind: 'guide', slug })),
      ...slugsOf(P.slice(1)).map((slug) => ({ kind: 'country', slug }))];
    for (const page of pages) {
      const path = pathIn(locale(code), page); const html = read(fileOf(path)); const url = SITE + path;
      assert.equal(canonical(html), url, `${path}: canonical`);
      if (isIndexed(code, page)) {
        indexed++;
        assert.equal(robots(html), 'index, follow', path);
        assert.deepEqual(alts(html), cluster(page).map((a) => [a.hreflang, a.href]), `${path}: cluster`);
        assert.ok(sitemap.has(url), `${path} not in the sitemap`);
      } else {
        assert.equal(robots(html), 'noindex, follow', path);
        assert.deepEqual(alts(html), [], `${path}: an alternate on a noindex page`);
        assert.ok(!sitemap.has(url), `${path}: a noindex page in the sitemap`);
      }
    }
  }
  assert.equal(indexed, 2 * (3 + GUIDES.length + INDEXED_COUNTRIES.length));
});

test('the Russian pages: twins carry exactly ruAlternates(); every other Russian page, the frozen ten included, none', () => {
  const ruPaths = [...new Set(['/', '/esim/', ...Object.values(GUIDE_RU), ...slugsOf('').map((s) => `/esim/${s}/`)])];
  let withCluster = 0;
  for (const path of ruPaths) {
    const html = read(fileOf(path));
    const want = cluster(ruPage(path)).map((a) => [a.hreflang, a.href]);
    assert.deepEqual(alts(html), want, `${path}: cluster`);
    if (want.length) { withCluster++; assert.ok(head(html).includes(ruAlternates(path)), `${path}: not the exact ruAlternates() text`); }
  }
  for (const s of FROZEN_PAGES) assert.deepEqual(alts(read(`esim/${s}/index.html`)), [], `${s}: not in the stage, so no hreflang`);
  assert.equal(withCluster, 2 + GUIDES.length + INDEXED_COUNTRIES.length);
});

test('every cluster is reciprocal: each member lists the same set, and x-default is the English member', () => {
  const pages = [{ kind: 'home' }, { kind: 'hub' }, { kind: 'guides' }, ...GUIDES.map((slug) => ({ kind: 'guide', slug })),
    ...INDEXED_COUNTRIES.map((slug) => ({ kind: 'country', slug }))];
  for (const page of pages) {
    const c = cluster(page); const members = c.filter((a) => a.hreflang !== 'x-default');
    assert.ok(members.length >= 2, JSON.stringify(page));
    assert.equal(c.find((a) => a.hreflang === 'x-default').href, members.find((a) => a.hreflang === 'en').href);
    for (const m of members) {
      const html = read(fileOf(m.href.slice(SITE.length)));
      assert.deepEqual(new Set(alts(html).map((a) => a.join(' '))), new Set(c.map((a) => `${a.hreflang} ${a.href}`)), `${m.href} disagrees`);
      assert.match(html, new RegExp(`<html[^>]*\\blang="${LOCALES.find((l) => l.hreflang === m.hreflang).htmlLang}"`), `${m.href}: lang ≠ hreflang`);
    }
  }
});

test('the sitemap: every URL is a built, indexable page; the prefixed part is exactly indexedPrefixedPages()', () => {
  for (const u of sitemap) {
    const html = read(fileOf(u.slice(SITE.length)));
    assert.doesNotMatch(robots(html) || '', /noindex/, `${u} is noindex`);
    assert.equal(canonical(html), u, `${u}: canonical`);
  }
  const prefixed = [...sitemap].filter((u) => /^https:\/\/magicesim\.store\/(en|es)\//.test(u)).sort();
  assert.deepEqual(prefixed, indexedPrefixedPages(GUIDES).map((p) => p.loc).sort());
});

test('indexed EN/ES pages: title ≤ 60, description ≤ 160, one H1, the page language', () => {
  for (const { code, page, loc } of indexedPrefixedPages(GUIDES)) {
    const html = read(fileOf(loc.slice(SITE.length)));
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1].replace(/&amp;/g, '&');
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    assert.ok([...title].length <= TITLE_MAX, `${loc}: title ${[...title].length} «${title}»`);
    assert.ok([...desc].length <= 160 && [...desc].length >= 70, `${loc}: description ${[...desc].length}`);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${loc}: H1`);
    assert.match(html, new RegExp(`<html lang="${locale(code).htmlLang}"`), `${loc}: lang (${page.kind})`);
  }
});

test('every EN/ES country title fits the budget (the full template, else the short one)', () => {
  for (const p of ['en', 'es']) for (const s of slugsOf(p)) {
    const title = read(`${p}/esim/${s}/index.html`).match(/<title>([^<]*)<\/title>/)[1].replace(/&amp;/g, '&');
    assert.ok([...title].length <= TITLE_MAX, `${p}/${s}: ${[...title].length} «${title}»`);
  }
  assert.match(read('es/esim/dr-congo/index.html'), /<title>eSIM para República Democrática del Congo \| Magic eSIM<\/title>/);
});

test('robots.txt keeps the prefixed languages crawlable and names the sitemap', () => {
  const r = read('robots.txt');
  assert.doesNotMatch(r, /^Disallow:\s*\/(en|es)\//m);
  assert.match(r, /^Sitemap: https:\/\/magicesim\.store\/sitemap\.xml$/m);
});
