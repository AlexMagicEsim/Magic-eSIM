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
import { ZH_GUIDES } from './guides-zh.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { LOCALES, locale, asPlanned } from './locales.mjs';
import { rehearsalGenerator, localeGenerator, listIndex, guideSectionId, ZH_READING } from './build-locale-pages.mjs';
import { PAGE_COPY } from './page-copy.mjs';
import { EN_GUIDES } from './guides-en.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';
import { countryName } from './country-names-i18n.mjs';
import { renderNames, namesFile, publishedNameLocales } from './build-country-dictionary-locale.mjs';
import { DICT } from './site-dictionary.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const LIVE_PLANNED = LOCALES.filter((l) => l.prefix && !l.site.enabled);
/* KO-1: every registry language is published, so the rehearsal runs on Korean «as if still planned» (asPlanned) — the
 * same in-memory machinery a new language would use, on real Korean names, with marked words. */
const PLANNED = LIVE_PLANNED.length ? LIVE_PLANNED : [locale('ko')];
const registryFor = (code) => (LIVE_PLANNED.some((l) => l.code === code) ? LOCALES : asPlanned(code));

/* ------------------------------------------------------------------ marked sources */

const mark = (code, key) => `⟦${code}:${key}⟧`;

function markedCopy(code) {
  const out = {};
  for (const [k, v] of Object.entries(PAGE_COPY.en)) {
    if (k === 'popular') out[k] = v.map((p) => ({ ...p, name: countryName(p.iso, code) }));
    else if (k === 'quick') out[k] = v.slice();   // ISO codes, not words
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
  return rehearsalGenerator(code, { copy: markedCopy(code), guides: markedGuides(code), words: markedWords(code), registry: registryFor(code) });
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

// «eSIM» alone is the technology's name (the home's decorative data pass) — the same word in every language.
const FIXED = ['© Magic eSIM', 'Magic eSIM', 'support@magicesim.store', 'eSIM'];
// …and the language switch's entries: every language by its own name (registry `endonym`), never translated. Taken out
// AFTER the country names, so «Deutsch» does not cut «Deutschland» into «land».
const ENDONYMS = LOCALES.map((l) => l.endonym);

// …and the data units of the language's own card table (assets/daily-plan-copy.js formatAllowance) — the «at a glance»
// facts print volumes through it (2026-10-27), as the live cards do; Korean writes them attached («1GB»). Derived from
// the table, never typed: a unit the table does not give is still a leak.
const AMOUNT = require('../assets/daily-plan-copy.js').formatAllowance;
const unitsOf = (code) => [AMOUNT(1, code), AMOUNT(0.5, code)].map((x) => x.replace(/[\d\s.,]/g, '')).filter(Boolean);

/** What is left of a run once every mark, country name and fixed token is taken out. */
function leftover(run, names, code) {
  let s = run.replace(/⟦[^⟧]*⟧(\([^)]*\))?/g, ' ');
  for (const f of FIXED) s = s.split(f).join(' ');
  for (const u of code ? unitsOf(code) : []) s = s.replace(new RegExp(`(\\d)${u}\\b`, 'g'), '$1 ');
  for (const n of names) if (n) s = s.split(n).join(' ');
  for (const e of ENDONYMS) s = s.split(e).join(' ');
  // Punctuation, digits, arrows and single letters (the A–Z jump letters of the list).
  return s.replace(/[\s\d.,:;!?·›×—–\-+/()|•%$'"«»#&*]+/g, ' ').trim().split(/\s+/).filter((w) => w && [...w].length > 1);
}

/* ===================================================================== */

test('every registry language is published (Korean by KO-1); the rehearsal runs on Korean «as if planned»', () => {
  assert.deepEqual(LIVE_PLANNED.map((l) => l.code), []);
  assert.deepEqual(PLANNED.map((l) => l.code), ['ko']);
  const reg = asPlanned('ko');
  assert.equal(reg.find((l) => l.code === 'ko').site.enabled, false, 'the copy has Korean unpublished');
  assert.equal(locale('ko').site.enabled, true, 'the real registry is untouched');
  assert.throws(() => asPlanned('ru'), /no prefixed locale/);
});

test('the rehearsal cannot publish: no build(), and it refuses the root, a published or an unknown language', () => {
  for (const l of PLANNED) assert.equal('build' in rehearse(l.code), false, l.code);
  assert.throws(() => rehearsalGenerator('en', { copy: PAGE_COPY.en, guides: EN_GUIDES, words: DICT.en }), /published/);
  assert.throws(() => rehearsalGenerator('ru', { copy: {}, guides: [], words: {} }), /no prefixed locale/);
  assert.throws(() => rehearsalGenerator('xx', { copy: {}, guides: [], words: {} }), /no prefixed locale/);
  assert.throws(() => rehearsalGenerator('ko', {}), /published/, 'Korean is published: a rehearsal needs the «as if planned» registry');
  assert.throws(() => rehearsalGenerator('ko', { registry: asPlanned('ko') }), /needs copy, guides and words/);
  assert.throws(() => rehearsalGenerator('fr', { copy: PAGE_COPY.fr, guides: EN_GUIDES, words: DICT.en }), /published/);
  assert.throws(() => rehearsalGenerator('de', { copy: PAGE_COPY.de, guides: EN_GUIDES, words: DICT.en }), /published/);
  assert.throws(() => rehearsalGenerator('es', { copy: PAGE_COPY.en, guides: EN_GUIDES, words: DICT.en }), /published/);
  assert.throws(() => rehearsalGenerator('zh-Hans', { copy: PAGE_COPY['zh-Hans'], guides: EN_GUIDES, words: DICT.en }), /published/);
  // …and the published generator still refuses every planned language (none is left in the registry since KO-1).
  for (const l of LIVE_PLANNED) assert.throws(() => localeGenerator(l.code), /refusing to publish/);
  assert.equal(typeof localeGenerator('ko').build, 'function', 'Korean is built by the published generator');
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
      [`${L.prefix}/`, G.homePage(list)],
      ...markedGuides(L.code).map((g) => [`${L.prefix}/guides/${g.slug}/`, G.guidePage(g)]),
      [`${L.prefix}/guides/`, G.guidesHub()],
    ];
    const leaks = [];
    for (const [where, html] of pages) {
      for (const run of readable(html)) {
        const left = leftover(run, names, L.code);
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
    assert.doesNotMatch(page, /<link rel="alternate"/, 'a language under review has no hreflang cluster');
    assert.ok(page.includes(`<script src="${namesFile(L.code).src}" defer></script>`));
    assert.ok(th.name === countryName('TH', L.code));
    for (const [where, html] of [['country', page], ['list', G.hubPage(list)], ['guides', G.guidesHub()],
      ['guide', G.guidePage(markedGuides(L.code)[0])]]) {
      // The language switch links each language to its twin of this page — by design; every other route stays home.
      const routes = [...html.replace(/<a href="[^"]*" hreflang="[^"]*"[^>]*>/g, '').matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
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
    // a really planned language has no public file yet; a published one rehearsed «as if planned» has its committed one,
    // which the rehearsal never rewrites (renderNames is the same text)
    if (LIVE_PLANNED.some((l) => l.code === L.code)) {
      assert.equal(existsSync(join(ROOT, F.rel)), false, `${F.rel} must not exist before ${L.code} is published`);
      assert.equal(existsSync(join(ROOT, L.prefix)), false, `/${L.prefix}/ must not exist`);
    } else assert.equal(readFileSync(join(ROOT, F.rel), 'utf8'), renderNames(L.code), `${F.rel} = what the generator renders`);
  });
}

for (const L of PLANNED) {
  test(`${L.code}: the destination list is indexed in its own script — every name under its group, every jump link lands, ASCII anchors`, () => {
    const G = rehearse(L.code);
    const list = G.countries();
    const index = listIndex(L.code);
    const html = G.hubPage(list);
    const sections = [...html.matchAll(/<section class="az-group" id="az-([^"]+)" aria-labelledby="azh-\1">\s*<h2 id="azh-\1">([^<]+)<\/h2>([\s\S]*?)<\/section>/g)]
      .map((m) => ({ id: m[1], label: m[2], names: [...m[3].matchAll(/<span>([^<]+)<\/span>/g)].map((x) => decode(x[1])) }));
    const jumps = [...html.matchAll(/<a href="#az-([^"]+)" data-letter="([^"]+)">/g)].map((m) => ({ id: m[1], label: m[2] }));
    assert.equal(sections.reduce((n, x) => n + x.names.length, 0), list.length, 'every destination is listed once');
    assert.deepEqual(jumps, sections.map(({ id, label }) => ({ id, label })), 'one jump link per group, in order');
    assert.equal(new Set(sections.map((x) => x.id)).size, sections.length);
    for (const x of sections) {
      assert.match(x.id, /^[a-z]+$/, `${L.code}: anchor az-${x.id} is ASCII`);
      for (const n of x.names) assert.equal(index.labelOf(n), x.label, `${L.code}: ${n} under ${x.label}`);
      assert.deepEqual(x.names, x.names.slice().sort(index.compare), `${L.code}: group ${x.label} is in order`);
    }
    const max = { Latn: 26, Hans: 23, Hang: 14 }[L.script];
    assert.ok(sections.length <= max && sections.length >= 10, `${L.code}: ${sections.length} groups (≤ ${max})`);
  });
}

test('Chinese is indexed by the pinyin initial, Korean by the initial consonant — on names a reader can check', () => {
  const zh = listIndex('zh-Hans');
  const ko = listIndex('ko');
  const zhName = (iso) => countryName(iso, 'zh-Hans');
  const koName = (iso) => countryName(iso, 'ko');
  const expectZh = { AR: 'A', AU: 'A', BR: 'B', PE: 'B', IS: 'B', DE: 'D', EG: 'A', FR: 'F', GE: 'G', KR: 'H', KH: 'J', CA: 'J',
    QA: 'K', LA: 'L', US: 'M', MA: 'M', NP: 'N', PT: 'P', JP: 'R', SA: 'S', TH: 'T', VN: 'Y', GB: 'Y', IT: 'Y', ES: 'X', SG: 'X',
    TD: 'Z', CN: 'Z', TR: 'T' };
  for (const [iso, l] of Object.entries(expectZh)) assert.equal(zh.labelOf(zhName(iso)), l, `${iso} ${zhName(iso)}`);
  assert.equal(zhName('PE'), '秘鲁', 'the polyphone the reading table exists for');
  assert.ok(Object.keys(ZH_READING).every((n) => Object.keys(COUNTRY_NAMES).some((iso) => zhName(iso) === n)), 'no stale reading');
  assert.ok(!['I', 'U', 'V'].some((l) => Object.keys(COUNTRY_NAMES).some((iso) => zh.labelOf(zhName(iso)) === l)), 'pinyin has no I, U, V initial');
  const expectKo = { KR: 'ㄷ', JP: 'ㅇ', TH: 'ㅌ', US: 'ㅁ', VN: 'ㅂ', DE: 'ㄷ', FR: 'ㅍ', TR: 'ㅌ', GR: 'ㄱ', CN: 'ㅈ', NP: 'ㄴ', RU: 'ㄹ' };
  for (const [iso, l] of Object.entries(expectKo)) assert.equal(ko.labelOf(koName(iso)), l, `${iso} ${koName(iso)}`);
  assert.equal(ko.labelOf('까'), 'ㄱ', 'a doubled consonant files under its single one');
  assert.throws(() => ko.labelOf('Korea'), /Hangul/);
  // The English list is untouched: the same letter rule, the same order.
  const en = listIndex('en');
  assert.equal(en.labelOf('Åland Islands'), 'A');
  assert.equal(en.compare('Réunion', 'Romania'), 'Réunion'.localeCompare('Romania', 'en'));
});

test('a guide section whose heading makes no anchor (Chinese, Korean) must name one — never «On this page» → #', () => {
  assert.equal(guideSectionId({ h2: 'Install on iPhone' }, 'iphone'), 'install-on-iphone');
  assert.equal(guideSectionId({ h2: '在 iPhone 上安装', id: 'install' }, 'iphone'), 'install');
  assert.throws(() => guideSectionId({ h2: '安装步骤' }, 'iphone'), /no usable anchor/);
  assert.throws(() => guideSectionId({ h2: '설치 방법' }, 'iphone'), /give it an `id`/);
  assert.throws(() => guideSectionId({ h2: 'x', id: 'Bad Id' }, 'iphone'), /no usable anchor/);
  // Chinese is published since ZH-1: its own generator and guide, with the ids taken away
  const G = localeGenerator('zh-Hans');
  const g = { ...ZH_GUIDES[0] };
  g.sections = g.sections.map((x, i) => ({ ...x, id: undefined, h2: `步骤${'一二三四五六七八九十'[i]}` }));
  assert.throws(() => G.guidePage(g), /no usable anchor/);
  g.sections = g.sections.map((x, i) => ({ ...x, id: `step-${i + 1}` }));
  assert.match(G.guidePage(g), /<li><a href="#step-1">步骤一<\/a><\/li>/);
});

test('English, Spanish, German, French, Chinese and Korean are what the generators publish, and their names files are byte-for-byte the committed ones', () => {
  assert.deepEqual(publishedNameLocales(), ['en', 'es', 'de', 'fr', 'zh-Hans', 'ko']);
  assert.equal(renderNames('ko'), readFileSync(join(ROOT, 'assets/country-names-ko.js'), 'utf8'));
  assert.equal(namesFile('ko').global, 'MagicCountryNamesKo');
  assert.equal(renderNames('zh-Hans'), readFileSync(join(ROOT, 'assets/country-names-zh.js'), 'utf8'));
  assert.equal(namesFile('zh-Hans').global, 'MagicCountryNamesZh');
  assert.equal(renderNames('fr'), readFileSync(join(ROOT, 'assets/country-names-fr.js'), 'utf8'));
  assert.equal(namesFile('fr').global, 'MagicCountryNamesFr');
  assert.equal(renderNames('de'), readFileSync(join(ROOT, 'assets/country-names-de.js'), 'utf8'));
  assert.equal(namesFile('de').global, 'MagicCountryNamesDe');
  assert.equal(renderNames('en'), readFileSync(join(ROOT, 'assets/country-names-en.js'), 'utf8'));
  assert.equal(renderNames('es'), readFileSync(join(ROOT, 'assets/country-names-es.js'), 'utf8'));
  assert.equal(namesFile('en').global, 'MagicCountryNamesEn');
  assert.equal(namesFile('es').global, 'MagicCountryNamesEs');
  assert.equal(namesFile('zh-Hans').rel, 'assets/country-names-zh.js');
});

test('the leak check can fire: an English word in a template is caught', () => {
  const names = ['Tailandia'];
  assert.deepEqual(leftover('⟦es:nav.how⟧', names), []);
  assert.deepEqual(leftover('Tailandia · ⟦es:countryLead⟧(Tailandia)', names), []);
  assert.deepEqual(leftover('Plans for Tailandia', names), ['Plans', 'for']);
  assert.deepEqual(leftover('Тарифы ⟦es:x⟧', names), ['Тарифы']);
  // a data unit counts only right after its number, and only the language's own: «Data» beside it still leaks
  assert.deepEqual(leftover('1GB⟦ko:glanceSep⟧500MB', names, 'ko'), []);
  assert.deepEqual(leftover('1GB Data', names, 'ko'), ['Data']);
  assert.deepEqual(leftover('GB', names, 'ko'), ['GB']);
  const G = rehearse('ko');
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
