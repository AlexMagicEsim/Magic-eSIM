/* Internal links of the prefixed languages (international SEO stage 4, 2026-10-27; TECH.md T1).
 *
 * Before: the footer of every prefixed page linked the first six of the home's popular list — three indexed pages
 * (Thailand, Türkiye, Japan) and three noindex ones (the UAE, the United States, Italy). Each of those six got a link
 * from all 197 other English country pages; France and the Maldives got one, Mexico two.
 *
 * Now the footer's «Destinations» column is ONE A–Z list: the indexing stage (seo/indexing.mjs INDEXED_COUNTRIES) plus
 * the commercially important destinations the owner keeps in the navigation (COMMERCIAL_FOOTER: the UAE, the United
 * States, Italy, Spain), capped at FOOTER_MAX entries. The home's tiles are unchanged.
 *
 * Run: node --test seo/test-internal-links-intl.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INDEXED_COUNTRIES, isIndexed } from './indexing.mjs';
import { localeGenerator, publishedLocales, listIndex, COMMERCIAL_FOOTER, FOOTER_MAX } from './build-locale-pages.mjs';
import { PAGE_COPY } from './page-copy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const footerOf = (html) => {
  const m = html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/);
  assert.ok(m, 'a footer');
  return m[0];
};
const destinationColumn = (footer) => {
  const m = footer.match(/<h2 data-i18n="nav\.destinations">[^<]*<\/h2>\s*<ul>([\s\S]*?)<\/ul>/);
  assert.ok(m, 'the destinations column');
  return m[1];
};
const countrySlugs = (html, prefix) => [...html.matchAll(new RegExp(`href="/${prefix}/esim/([a-z0-9-]+)/"`, 'g'))].map((m) => m[1]);

test('the footer lists the indexed and the commercial destinations, one A–Z list per language, then «All destinations»', () => {
  const expected = [...new Set([...INDEXED_COUNTRIES, ...COMMERCIAL_FOOTER])].sort();
  assert.ok(expected.length <= FOOTER_MAX, `${expected.length} entries, cap ${FOOTER_MAX}`);
  assert.ok(FOOTER_MAX <= 20, 'the cap itself stays at most 20');
  assert.deepEqual([...COMMERCIAL_FOOTER], ['uae', 'usa', 'italy', 'spain'], 'the owner\'s four');
  for (const code of publishedLocales()) {
    const G = localeGenerator(code);
    const P = G.locale.prefix;
    const pages = new Map(G.countries().map((c) => [c.slug, c]));
    const col = destinationColumn(G.FOOTER);
    const slugs = countrySlugs(col, P);
    assert.equal(slugs.length, new Set(slugs).size, `${code}: no destination twice`);
    assert.deepEqual([...slugs].sort(), expected, `${code}: INDEXED_COUNTRIES ∪ COMMERCIAL_FOOTER, nothing else`);
    assert.ok(slugs.length <= FOOTER_MAX, `${code}: at most ${FOOTER_MAX}`);
    for (const s of slugs) assert.ok(pages.has(s), `${code}: ${s} has a page`);
    const names = G.FOOTER_DESTINATIONS.map((c) => c.name);
    assert.deepEqual(names, [...names].sort(listIndex(code).compare), `${code}: A–Z in the language's own order`);
    assert.deepEqual(G.FOOTER_DESTINATIONS.map((c) => c.slug), slugs, `${code}: the markup follows that order`);
    for (const c of G.FOOTER_DESTINATIONS) assert.equal(c.name, pages.get(c.slug).name, `${code}: ${c.slug} named as its page`);
    assert.match(col, new RegExp(`<li><a href="/${P}/esim/" data-i18n="site\\.allDestinations">[^<]+</a></li>\\s*$`), `${code}: «All destinations» last`);
  }
});

test('the built pages carry that footer: every indexed English country page is linked from every other English country page', () => {
  const dirs = readdirSync(join(ROOT, 'en/esim'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  assert.ok(dirs.length >= 190, `${dirs.length} English country pages`);
  const inbound = Object.fromEntries(INDEXED_COUNTRIES.map((s) => [s, 0]));
  for (const d of dirs) {
    const linked = new Set(countrySlugs(read(`en/esim/${d}/index.html`), 'en'));
    for (const s of INDEXED_COUNTRIES) if (s !== d && linked.has(s)) inbound[s] += 1;
  }
  for (const s of INDEXED_COUNTRIES) assert.equal(inbound[s], dirs.length - 1, `${s}: linked from ${inbound[s]} of ${dirs.length - 1}`);
});

test('every built English page carries that footer: the commercial four are linked from every other country page too', () => {
  const dirs = readdirSync(join(ROOT, 'en/esim'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const s of COMMERCIAL_FOOTER) {
    let n = 0;
    for (const d of dirs) if (d !== s && read(`en/esim/${d}/index.html`).includes(`href="/en/esim/${s}/"`)) n += 1;
    assert.equal(n, dirs.length - 1, s);
  }
  // every home link to a country is a real page
  const home = read('en/index.html');
  const pages = new Set(localeGenerator('en').countries().map((c) => c.slug));
  for (const s of new Set(countrySlugs(home, 'en'))) assert.ok(pages.has(s), `home links ${s}, which has a page`);
  assert.equal(PAGE_COPY.en.popular.length, 8, 'eight home tiles');
});
