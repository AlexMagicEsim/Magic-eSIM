/* The language switch keeps the reader on the same page (owner, D4 — I18N ES-0).
 *
 * header(pageTwin) in seo/build-locale-pages.mjs: every page names its twin in every language (`twin(ruPath, path)`).
 * While Russian is the only other language (the English site today) the switch is the one «Русский» link it always
 * was — byte for byte. With two or more it is a <details> list of every published language plus the page's own, by
 * endonym, the current one marked and not a link. This holds:
 *   - English today: exactly the old two «Русский» links (desktop + phone menu), each to the page's Russian twin;
 *   - a rehearsed planned language: the list on every page kind, in registry order, each entry linking to THIS page in
 *     that language — and every such link of a published language resolves to a file that exists;
 *   - the RU header is not part of this (RU pages, the SEO experiment's ten included, are untouched).
 *
 * Run: node --test seo/test-language-switch.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LOCALES, locale, asPlanned } from './locales.mjs';
import { rehearsalGenerator, localeGenerator, GUIDE_RU } from './build-locale-pages.mjs';
import { PAGE_COPY } from './page-copy.mjs';
import { EN_GUIDES } from './guides-en.mjs';
import { DICT } from './site-dictionary.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
/* KO-1: every registry language is published; a language is rehearsed «as if still planned» (seo/locales.mjs asPlanned)
 * so this check keeps a subject — Korean, on its real names, never written. */
const LIVE_PLANNED = LOCALES.filter((l) => l.prefix && !l.site.enabled);
const PLANNED = LIVE_PLANNED.length ? LIVE_PLANNED : [LOCALES.find((l) => l.code === 'ko')];
const registryFor = (code) => (LIVE_PLANNED.some((l) => l.code === code) ? LOCALES : asPlanned(code));
const PUBLISHED = LOCALES.filter((l) => l.site.enabled);

/** A URL path → the file the static site serves for it. */
const fileOf = (path) => join(ROOT, path.endsWith('/') ? `${path}index.html` : path);

/* Since ES-1 three languages are published, so every prefixed page carries the list: the single-link form (Russian the
 * only other language — the English site from #116 to ES-1) no longer occurs on a published page. */

test('every published prefixed page: the list of RU/EN/ES, current marked, each linking to the same page — and it exists', () => {
  const sample = (P) => [[`${P}/index.html`, '/', '/'], [`${P}/esim/index.html`, '/esim/', '/esim/'],
    [`${P}/esim/thailand/index.html`, '/esim/thailand/', '/esim/thailand/'], [`${P}/guides/index.html`, '/esim/', '/guides/'],
    ...EN_GUIDES.map((g) => [`${P}/guides/${g.slug}/index.html`, GUIDE_RU[g.slug], `/guides/${g.slug}/`])];
  for (const L of PUBLISHED.filter((l) => l.prefix)) {
    for (const [rel, ru, path] of sample(L.prefix)) {
      const page = read(rel);
      const menu = page.match(/<details class="langsw langmenu">([\s\S]*?)<\/details>/);
      assert.ok(menu, `${rel}: the list`);
      for (const l of PUBLISHED) {
        const href = l.prefix ? `/${l.prefix}${path}` : ru;
        if (l.code === L.code) assert.ok(menu[1].includes(`<span aria-current="true" lang="${l.htmlLang}">${l.endonym}</span>`), `${rel}: ${l.code} marked`);
        else {
          assert.ok(menu[1].includes(`<a href="${href}" hreflang="${l.hreflang}" lang="${l.htmlLang}">${l.endonym}</a>`), `${rel}: ${l.code} → ${href}`);
          assert.ok(existsSync(fileOf(href)), `${rel}: ${href} exists`);
        }
      }
    }
  }
});

for (const L of PLANNED) {
  test(`${L.code}: every page kind lists every language, current marked, each linking to the same page`, () => {
    const G = rehearsalGenerator(L.code, { copy: PAGE_COPY.en, guides: EN_GUIDES, words: DICT.en, registry: registryFor(L.code) });
    const list = G.countries();
    const th = list.find((c) => c.slug === 'thailand');
    const g = EN_GUIDES[0];
    const kinds = [
      ['home', G.homePage(list), (l) => (l.prefix ? `/${l.prefix}/` : '/')],
      ['list', G.hubPage(list), (l) => (l.prefix ? `/${l.prefix}/esim/` : '/esim/')],
      ['country', G.countryPage(th), (l) => (l.prefix ? `/${l.prefix}/esim/thailand/` : '/esim/thailand/')],
      ['guides', G.guidesHub(), (l) => (l.prefix ? `/${l.prefix}/guides/` : '/esim/')],
      ['guide', G.guidePage(g), (l) => (l.prefix ? `/${l.prefix}/guides/${g.slug}/` : GUIDE_RU[g.slug])],
    ];
    const order = LOCALES.filter((l) => l.site.enabled || l.code === L.code);
    for (const [kind, html, want] of kinds) {
      const menu = html.match(/<details class="langsw langmenu">([\s\S]*?)<\/details>/);
      assert.ok(menu, `${kind}: the desktop list`);
      assert.match(menu[1], new RegExp(`<summary aria-label="[^"]+">[\\s\\S]*<span lang="${L.htmlLang}">${L.endonym}</span></summary>`));
      const entries = [...menu[1].matchAll(/<li>(?:<a href="([^"]+)" hreflang="([^"]+)" lang="([^"]+)">|<span aria-current="true" lang="([^"]+)">)([^<]+)</g)]
        .map((m) => (m[1] ? { href: m[1], lang: m[3], name: m[5] } : { current: true, lang: m[4], name: m[5] }));
      assert.deepEqual(entries.map((e) => e.name), order.map((l) => l.endonym), `${kind}: every language, registry order`);
      for (const e of entries) {
        const l = LOCALES.find((x) => x.htmlLang === e.lang);
        if (l.code === L.code) { assert.equal(e.current, true, `${kind}: the page's own language is marked, not linked`); continue; }
        assert.equal(e.href, want(l), `${kind}: ${l.code} → the same page`);
        if (l.site.enabled) assert.ok(existsSync(fileOf(e.href)), `${kind}: ${e.href} exists`);
      }
      // the phone menu lists the other languages by the same links
      const phone = html.match(/<nav class="mnav-panel"[\s\S]*?<hr>([\s\S]*?)<\/nav>/)[1];
      const phoneLinks = [...phone.matchAll(/<a href="([^"]+)" hreflang="[^"]+" lang="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[1], m[3]]);
      assert.deepEqual(phoneLinks, order.filter((l) => l.code !== L.code).map((l) => [want(l), l.endonym]), `${kind}: phone menu`);
    }
  });
}

test('the switch never names a language the registry does not publish (besides the page\'s own)', () => {
  // KO-1: nothing in the real registry is unpublished, so the check runs on a copy where Chinese is unpublished too
  // (asPlanned twice): rehearsing Korean, the switch must offer every published language and its own — never Chinese.
  const reg = asPlanned('zh-Hans', asPlanned('ko'));
  const G = rehearsalGenerator('ko', { copy: PAGE_COPY.en, guides: EN_GUIDES, words: DICT.en, registry: reg });
  const html = G.hubPage(G.countries());
  for (const l of reg.filter((x) => !x.site.enabled && x.code !== 'ko')) {
    assert.ok(!html.includes(`>${l.endonym}<`), `${l.code} is not published and not offered`);
  }
  assert.ok(!html.includes('>简体中文<'), 'the check can fire: Chinese is unpublished in this copy');
  assert.ok(html.includes('>Français<') && html.includes('>한국어<'));
  assert.deepEqual(PUBLISHED.map((l) => l.code), ['ru', 'en', 'es', 'de', 'fr', 'zh-Hans', 'ko'], 'published since KO-1: RU, EN, ES, DE, FR, ZH-Hans, KO');
  assert.equal(locale('ko').site.enabled, true);
});

test('the RU pages are not part of the switch work: their header still links to /en/ only', () => {
  for (const rel of ['index.html', 'esim/thailand/index.html', 'esim/index.html', 'esim/uae/index.html']) {
    const page = read(rel);
    assert.doesNotMatch(page, /langmenu|href="\/es\//, rel);
  }
});
