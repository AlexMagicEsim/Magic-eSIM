/* A DRESS REHEARSAL of every planned language's site — built in memory, never
 * written (I18N-08c).
 *
 * Enabling a language must be CONTENT only: its words, page copy, guides and a
 * native review. This proves the machinery is already there. For each of es,
 * de, fr, zh-Hans and ko the locale generator builds the whole site — 198
 * country pages, the list, the guides, the guides list and destinations.js —
 * from MARKED copy: every word the language would supply is «⟦code:key⟧», and
 * country names are the real CLDR ones of I18N-03. Then every visible text
 * and every human-readable attribute of every page must be one of those
 * marks, a country name in that language, or a fixed token (the brand, the
 * support address, punctuation). A single English or Russian word left in a
 * template fails here — before anyone writes a line of Spanish.
 *
 * It also pins what a published language gets that is not text: its prefix in
 * every route and canonical URL, <html lang>, og:locale, its own country-names
 * file and destinations global, noindex and no hreflang.
 *
 * NOTHING IS WRITTEN: the rehearsal generator has no build(), and the test
 * asserts no route directory or names file of an unpublished language exists.
 *
 * Run: node --test seo/test-locale-rehearsal.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { LOCALES, locale } from './locales.mjs';
import { rehearsalGenerator, localeGenerator } from './build-locale-pages.mjs';
import { PAGE_COPY } from './page-copy.mjs';
import { EN_GUIDES } from './guides-en.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';
import { countryName } from './country-names-i18n.mjs';
import { renderNames, namesFile, publishedNameLocales } from './build-country-dictionary-locale.mjs';
import { DICT } from './site-dictionary.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const PLANNED = LOCALES.filter((l) => l.prefix && !l.site.enabled);

/* ------------------------------------------------------------------ marked sources */

const mark = (code, key) => `⟦${code}:${key}⟧`;

function markedCopy(code) {
  const out = {};
  for (const [k, v] of Object.entries(PAGE_COPY.en)) {
    if (k === 'popular') out[k] = v.map((p) => ({ ...p, name: countryName(p.iso, code) }));
    else if (typeof v === 'function') out[k] = (x) => `${mark(code, k)}(${x})`;
    else if (Array.isArray(v)) out[k] = v.map((_, i) => mark(code, `${k}.${i}`));
    else out[k] = mark(code, k);
  }
  return out;
}

function markedGuides(code) {
  return EN_GUIDES.map((g) => ({
    slug: g.slug,
    related: g.related.slice(),
    nav: mark(code, `${g.slug}.nav`), title: mark(code, `${g.slug}.title`), description: mark(code, `${g.slug}.description`),
    h1: mark(code, `${g.slug}.h1`), blurb: mark(code, `${g.slug}.blurb`), lead: mark(code, `${g.slug}.lead`),
    sections: g.sections.map((s, i) => ({ h2: mark(code, `${g.slug}.s${i}`), html: `<p>${mark(code, `${g.slug}.s${i}.body`)}</p>` })),
    faq: g.faq.map((f, i) => ({ q: mark(code, `${g.slug}.q${i}`), a: mark(code, `${g.slug}.a${i}`) })),
  }));
}

function markedWords(code) {
  return Object.fromEntries(Object.keys(DICT.en).map((k) => [k, mark(code, k)]));
}

function rehearse(code) {
  return rehearsalGenerator(code, { copy: markedCopy(code), guides: markedGuides(code), words: markedWords(code) });
}

/* ------------------------------------------------------------------ what a reader sees */

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Visible text runs and human-readable attribute values of one page. */
function readable(html) {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ');
  const runs = [];
  for (const m of body.matchAll(/>([^<]+)</g)) runs.push(decode(m[1]));
  for (const m of body.matchAll(/\s(?:aria-label|placeholder|title|alt)="([^"]*)"/g)) runs.push(decode(m[1]));
  for (const m of body.matchAll(/<meta (?:name="description"|property="og:(?:title|description)") content="([^"]*)"/g)) runs.push(decode(m[1]));
  return runs.map((s) => s.trim()).filter(Boolean);
}

const FIXED = ['Magic eSIM', 'support@magicesim.store', '© Magic eSIM'];

/** What is left of a run once every mark, country name and fixed token is taken out. */
function leftover(run, names) {
  let s = run.replace(/⟦[^⟧]*⟧(\([^)]*\))?/g, ' ');
  for (const f of FIXED) s = s.split(f).join(' ');
  for (const n of names) if (n) s = s.split(n).join(' ');
  // Punctuation, digits, arrows and single letters (the A–Z jump letters of the list).
  return s.replace(/[\s\d.,:;!?·›×—–\-+/()|•%$'"«»#&*]+/g, ' ').trim().split(/\s+/).filter((w) => w && [...w].length > 1);
}

/* ===================================================================== */

test('there are five planned languages to rehearse, and none is published', () => {
  assert.deepEqual(PLANNED.map((l) => l.code), ['es', 'de', 'fr', 'zh-Hans', 'ko']);
});

test('the rehearsal cannot publish: no build(), and it refuses the root, a published or an unknown language', () => {
  for (const l of PLANNED) assert.equal('build' in rehearse(l.code), false, l.code);
  assert.throws(() => rehearsalGenerator('en', { copy: PAGE_COPY.en, guides: EN_GUIDES, words: DICT.en }), /published/);
  assert.throws(() => rehearsalGenerator('ru', { copy: {}, guides: [], words: {} }), /no prefixed locale/);
  assert.throws(() => rehearsalGenerator('xx', { copy: {}, guides: [], words: {} }), /no prefixed locale/);
  assert.throws(() => rehearsalGenerator('es', {}), /needs copy, guides and words/);
  // …and the published generator still refuses every planned language.
  for (const l of PLANNED) assert.throws(() => localeGenerator(l.code), /refusing to publish/);
});

for (const L of PLANNED) {
  test(`${L.code}: every page of the rehearsed site speaks only ${L.code} — no English or Russian word left in a template`, () => {
    const G = rehearse(L.code);
    const list = G.countries();
    assert.equal(list.length, JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8')).countries.length);
    const names = Object.keys(COUNTRY_NAMES).map((iso) => countryName(iso, L.code)).sort((a, b) => b.length - a.length);
    const pages = [
      ...list.map((c) => [`${L.prefix}/esim/${c.slug}/`, G.countryPage(c)]),
      [`${L.prefix}/esim/`, G.hubPage(list)],
      ...markedGuides(L.code).map((g) => [`${L.prefix}/guides/${g.slug}/`, G.guidePage(g)]),
      [`${L.prefix}/guides/`, G.guidesHub()],
    ];
    const leaks = [];
    for (const [where, html] of pages) {
      for (const run of readable(html)) {
        const left = leftover(run, names);
        if (left.length) leaks.push(`${where}: ${JSON.stringify(run).slice(0, 120)} → ${left.join(' ')}`);
      }
    }
    assert.deepEqual([...new Set(leaks)].slice(0, 20), []);
  });

  test(`${L.code}: routes, <head> and scripts belong to /${L.prefix}/ — prefix, lang, og:locale, names file, noindex, no hreflang`, () => {
    const G = rehearse(L.code);
    const list = G.countries();
    const th = list.find((c) => c.slug === 'thailand');
    const page = G.countryPage(th);
    assert.match(page, new RegExp(`<html lang="${L.htmlLang}">`));
    assert.match(page, new RegExp(`<link rel="canonical" href="https://magicesim\\.store/${L.prefix}/esim/thailand/">`));
    assert.match(page, new RegExp(`<meta property="og:locale" content="${L.ogLocale}">`));
    assert.match(page, /<meta name="robots" content="noindex, follow">/);
    assert.doesNotMatch(page, /hreflang="(?!ru")/, 'only the switch to Russian carries hreflang');
    assert.ok(page.includes(`<script src="${namesFile(L.code).src}" defer></script>`));
    assert.ok(th.name === countryName('TH', L.code));
    for (const [where, html] of [['country', page], ['list', G.hubPage(list)], ['guides', G.guidesHub()],
      ['guide', G.guidePage(markedGuides(L.code)[0])]]) {
      const routes = [...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
      const foreign = routes.filter((r) => /^\/en(\/|$)/.test(r)
        && !/^\/en\/(en\.css|checkout\.css|noscript\.css|plans\.js|checkout\.js|country\.js|hub\.js)$/.test(r));
      assert.deepEqual(foreign, [], `${L.code} ${where}: a route into the English site`);
      assert.ok(routes.some((r) => r.startsWith(`/${L.prefix}/`)), `${L.code} ${where}: no route of its own`);
    }
    const dest = G.destinationsJs(list);
    const ctx = {}; ctx.window = ctx;
    vm.runInNewContext(dest, ctx);
    const global = `Magic${L.prefix.charAt(0).toUpperCase()}${L.prefix.slice(1)}Destinations`;
    assert.equal(ctx[global].length, list.length, global);
    assert.match(dest, new RegExp(`\\(/${L.prefix}/esim/<slug>/\\)`));
  });

  test(`${L.code}: its country-names file renders whole, under its own global, in its own names — and is not written`, () => {
    const F = namesFile(L.code);
    const ctx = {}; ctx.window = ctx;
    vm.runInNewContext(renderNames(L.code), ctx);
    const api = ctx[F.global];
    assert.ok(api, F.global);
    const all = api.all();
    assert.equal(Object.keys(all).length, Object.keys(COUNTRY_NAMES).length);
    for (const iso of Object.keys(COUNTRY_NAMES)) assert.equal(api.of(iso), countryName(iso, L.code), `${L.code} ${iso}`);
    assert.equal(api.of('zz'), 'ZZ');
    assert.equal(existsSync(join(ROOT, F.rel)), false, `${F.rel} must not exist before ${L.code} is published`);
    assert.equal(existsSync(join(ROOT, L.prefix)), false, `/${L.prefix}/ must not exist`);
  });
}

test('English is what the generators publish, and its names file is byte-for-byte the committed one', () => {
  assert.deepEqual(publishedNameLocales(), ['en']);
  assert.equal(renderNames('en'), readFileSync(join(ROOT, 'assets/country-names-en.js'), 'utf8'));
  assert.equal(namesFile('en').global, 'MagicCountryNamesEn');
  assert.equal(namesFile('zh-Hans').rel, 'assets/country-names-zh.js');
});

test('the leak check can fire: an English word in a template is caught', () => {
  const names = ['Tailandia'];
  assert.deepEqual(leftover('⟦es:nav.how⟧', names), []);
  assert.deepEqual(leftover('Tailandia · ⟦es:countryLead⟧(Tailandia)', names), []);
  assert.deepEqual(leftover('Plans for Tailandia', names), ['Plans', 'for']);
  assert.deepEqual(leftover('Тарифы ⟦es:x⟧', names), ['Тарифы']);
  const G = rehearse('es');
  const html = G.countryPage(G.countries()[0]).replace('<main', '<p>Show all plans</p><main');
  assert.ok(readable(html).some((r) => leftover(r, []).includes('Show')));
});

test('the browser scripts pick the names and destinations of the page language, by the generator\'s naming', () => {
  const country = readFileSync(join(ROOT, 'en/country.js'), 'utf8');
  const app = readFileSync(join(ROOT, 'en/app.js'), 'utf8');
  assert.match(country, /window\['MagicCountryNames' \+ SUFFIX\.charAt\(0\)\.toUpperCase\(\) \+ SUFFIX\.slice\(1\)\]/);
  assert.match(app, /window\['Magic\{P\}Destinations'\.replace\('\{P\}', SUFFIX\.charAt\(0\)\.toUpperCase\(\) \+ SUFFIX\.slice\(1\)\)\]/);
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const src of [country, app]) assert.doesNotMatch(code(src), /MagicCountryNamesEn|MagicEnDestinations/);
  // The generator's and the browser's names agree for every published language.
  const SITE = require(join(ROOT, 'assets/site-i18n.js'));
  for (const code of publishedNameLocales()) {
    const sfx = SITE.pathPrefix(code).slice(1);
    assert.equal(`MagicCountryNames${sfx.charAt(0).toUpperCase()}${sfx.slice(1)}`, namesFile(code).global);
    assert.equal(locale(code).prefix, sfx);
  }
});
