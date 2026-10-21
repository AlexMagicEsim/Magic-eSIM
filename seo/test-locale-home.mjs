/* The home of every prefixed language comes from ONE template (seo/home-page.mjs, I18N ES-0).
 *
 *   - English: the committed en/index.html is exactly what the generator builds (it was the one hand-written page of
 *     the English site; the generator reproduced it byte for byte on 2026-10-21 and now owns it);
 *   - every planned language: its rehearsed home is complete, in its own routes, under review (noindex, no hreflang
 *     cluster), with the shared assets at their one address and its own destinations;
 *   - the indexing block follows the registry: the English home keeps the RU+EN cluster and x-default it had.
 *
 * Run: node --test seo/test-locale-home.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LOCALES, homeUrl, X_DEFAULT_CURRENT } from './locales.mjs';
import { localeGenerator, rehearsalGenerator } from './build-locale-pages.mjs';
import { stampHtml } from './asset-version.mjs';
import { PAGE_COPY } from './page-copy.mjs';
import { EN_GUIDES } from './guides-en.mjs';
import { DICT } from './site-dictionary.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const PLANNED = LOCALES.filter((l) => l.prefix && !l.site.enabled);

test('the English home is the generator\'s, byte for byte', () => {
  const G = localeGenerator('en');
  assert.equal(stampHtml(G.homePage(), join(ROOT, 'en')), read('en/index.html'));
});

test('build() writes the home of a published language; nothing else writes it', () => {
  const gen = read('seo/build-locale-pages.mjs');
  assert.match(gen, /write\(`\$\{base\}\/index\.html`, stampHtml\(homePage\(list\), join\(ROOT, base\)\)\);/);
  assert.match(read('seo/build-en-pages.mjs'), /localeGenerator\('en'\)|localeGenerator\("en"\)/);
});

test('the English home keeps the cluster it had: RU + EN, x-default as the registry says, index', () => {
  const home = read('en/index.html');
  const alts = [...home.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(alts, [['ru', homeUrl('ru')], ['en', homeUrl('en')], ['x-default', homeUrl(X_DEFAULT_CURRENT)]]);
  assert.match(home, /<meta name="robots" content="index, follow">/);
  assert.match(home, /<meta property="og:locale:alternate" content="ru_RU">/);
});

for (const L of PLANNED) {
  test(`${L.code}: the rehearsed home is whole, in /${L.prefix}/, under review — and uses the shared assets`, () => {
    const G = rehearsalGenerator(L.code, { copy: { ...PAGE_COPY.en, popular: PAGE_COPY.en.popular }, guides: EN_GUIDES, words: DICT.en });
    const list = G.countries();
    const home = G.homePage(list);
    const P = `/${L.prefix}`;
    assert.match(home, new RegExp(`<html lang="${L.htmlLang}">`));
    assert.ok(home.includes(`<link rel="canonical" href="${homeUrl(L.code)}">`));
    assert.ok(home.includes(`<meta property="og:locale" content="${L.ogLocale}">`));
    assert.match(home, /<meta name="robots" content="noindex, follow">/, 'published for review first (owner, D5)');
    assert.doesNotMatch(home, /<link rel="alternate"|og:locale:alternate/, 'no hreflang cluster while under review');
    assert.ok(home.includes(`"inLanguage":"${L.htmlLang}"`));
    // shared assets keep their one address; the language's own data is under its prefix
    for (const shared of ['/en/en.css', '/en/app.js', '/assets/site.css', '/assets/page-home.css', '/assets/site-i18n.js']) {
      assert.ok(home.includes(`"${shared}"`), shared);
    }
    assert.ok(home.includes(`<script src="${P}/destinations.js" defer></script>`));
    const slugs = new Set(list.map((c) => c.slug));
    const own = [...home.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1])
      .filter((h) => !/^\/(en\/(en\.css|app\.js)|assets\/|favicon|apple-touch|site\.webmanifest|terms\.html|privacy\.html)/.test(h));
    const outside = own.filter((h) => !h.startsWith(`${P}/`) && !/^\/(esim\/|$)|^\/en\//.test(h));
    assert.deepEqual(outside, [], 'every other link stays in the language');
    for (const h of own.filter((x) => x.startsWith(`${P}/esim/`) && x !== `${P}/esim/`)) {
      assert.ok(slugs.has(h.split('/')[3]), `${h}: a destination with a page`);
    }
    assert.equal((home.match(/class="dest-tile"/g) || []).length, 8, 'eight popular tiles');
    assert.equal((home.match(/class="guide-card"/g) || []).length, EN_GUIDES.length, 'one card per guide');
    assert.equal((home.match(/<a href="[^"]*"><img class="flag"[^>]*width="22"/g) || []).length, 6, 'six quick links');
  });
}

test('a quick link without a page in the language stops the build', () => {
  const G = rehearsalGenerator('es', { copy: { ...PAGE_COPY.en, quick: ['TH', 'XX'] }, guides: EN_GUIDES, words: DICT.en });
  assert.throws(() => G.homePage(), /quick link XX has no es page/);
});
