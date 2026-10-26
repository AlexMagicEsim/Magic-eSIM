/* The German site, /de/ (I18N DE-1, 2026-10-22): complete, in German, the English design, noindex.
 *
 *   1. Every source has every key English has — the browser dictionary falls back to RUSSIAN for a missing key, the
 *      generator throws, the daily table is checked in seo/test-daily-copy-langs.mjs; the guides mirror the English
 *      ones section for section, question for question, link for link. The generator's output is the committed tree.
 *   2. The same design: every page kind's markup skeleton (tags and classes, in order) equals the English one.
 *   3. German only: on all 206 pages no word that only English uses and no Russian (bar the language switch's
 *      «Русский») — brands and technical names excepted, by an explicit list.
 *   4. Prices and numbers the owner's way (D2, D3): «12,99 USD» (de-DE, currency as a code); data amounts with a decimal
 *      comma; English and Spanish prices exactly as before.
 *   5. Country names in sentences: after «für» in the accusative, with the article German needs (DE_FUER).
 *   6. Search engines (D11): every German page `noindex, follow`, canonical to itself, no hreflang, not in the sitemap;
 *      RU / EN / ES indexing untouched.
 *   7. The guides name their sources (vendor pages read 2026-10-22) and quote only those labels.
 *   8. Hyphenation (D6) is scoped to German.
 *
 * Run: node --test seo/test-de-site.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PAGE_COPY, DE_FUER, TITLE_MAX } from './page-copy.mjs';
import { EN_GUIDES } from './guides-en.mjs';
import { DE_GUIDES } from './guides-de.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';
import { countryName } from './country-names-i18n.mjs';
import { localeGenerator } from './build-locale-pages.mjs';
import { stampHtml } from './asset-version.mjs';
import { locale } from './locales.mjs';
import { INDEXED_COUNTRIES } from './indexing.mjs';
import { rulesFor } from './claim-guards.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const SITE = require(join(ROOT, 'assets/site-i18n.js'));
const DAILY = require(join(ROOT, 'assets/daily-plan-copy.js'));

function htmlUnder(dir) {
  const out = [];
  (function walk(d) {
    for (const n of readdirSync(join(ROOT, d))) {
      const p = join(d, n);
      if (statSync(join(ROOT, p)).isDirectory()) walk(p);
      else if (n === 'index.html') out.push(p);
    }
  }(dir));
  return out.sort();
}
// LEGAL-8: the permanent copies of the legal documents (/de/<kind>/v<n>/) are held by seo/test-legal-archive.mjs.
const DE_PAGES = htmlUnder('de').filter((rel) => !/\/v\d[\d.]*\/index\.html$/.test(rel));
// LEGAL-4: the three translated legal documents (/de/terms|refund|privacy/) are pages of this language too; their
// fidelity to the English — which keeps proper names, the seller's Latin address and foreign law titles in English —
// is held by seo/test-legal-i18n.mjs, so the «German only» word scan reads the 206 site pages without them.
const DE_LEGAL = /^de\/(terms|refund|privacy)\/index\.html$/;
const DE_SITE_PAGES = DE_PAGES.filter((rel) => !DE_LEGAL.test(rel));
const head = (html) => html.slice(0, html.indexOf('</head>'));

/* ------------------------------------------------------------------ 1. complete */

test('206 German pages: the home, the list, 198 countries, the guides list and five guides', () => {
  assert.equal(DE_SITE_PAGES.length, 206);
  assert.equal(DE_PAGES.length, 209, '+ the three legal documents (LEGAL-4)');
  assert.equal(DE_PAGES.filter((p) => /^de\/esim\/[^/]+\/index\.html$/.test(p)).length, 198);
  assert.equal(htmlUnder('en').filter((p) => !/\/v\d[\d.]*\/index\.html$/.test(p)).length, DE_PAGES.length, 'the same pages as English, the three legal documents included (LEGAL-4); the permanent copies of their versions are English only (LEGAL-5)');
});

test('every source has every key English has, and no other; the same {placeholders}', () => {
  assert.deepEqual(Object.keys(SITE.DICT.de).sort(), Object.keys(SITE.DICT.en).sort(), 'assets/site-i18n.js');
  assert.deepEqual(Object.keys(PAGE_COPY.de).sort(), Object.keys(PAGE_COPY.en).sort(), 'seo/page-copy.mjs');
  const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [k, v] of Object.entries(SITE.DICT.en)) assert.deepEqual(ph(SITE.DICT.de[k]), ph(v), `${k}: the same {placeholders}`);
  assert.ok(DAILY.LANGS.includes('de'), 'the daily-plan table');
  assert.equal(SITE.DICT.de['lang.ru'], 'Русский');
});

test('the German guides mirror the English ones: slugs, sections, questions, related, internal links', () => {
  assert.deepEqual(DE_GUIDES.map((g) => g.slug), EN_GUIDES.map((g) => g.slug));
  const links = (g) => g.sections.flatMap((s) => [...s.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/^\/(en|de)\//, '/L/')));
  for (const [i, de] of DE_GUIDES.entries()) {
    const en = EN_GUIDES[i];
    assert.equal(de.sections.length, en.sections.length, `${de.slug}: sections`);
    assert.equal(de.faq.length, en.faq.length, `${de.slug}: questions`);
    assert.deepEqual(de.related, en.related, `${de.slug}: related`);
    assert.deepEqual(links(de), links(en), `${de.slug}: the same links, in German`);
    for (const [j, s] of de.sections.entries()) {
      const tags = (h) => [...h.matchAll(/<(ol|ul|li|p|strong|a)\b/g)].map((m) => m[1]).filter((t) => t !== 'strong').join(' ');
      assert.equal(tags(s.html), tags(en.sections[j].html), `${de.slug} §${j}: the same structure`);
    }
  }
});

test('German built through the locale generator equals the committed pages, byte for byte', () => {
  const G = localeGenerator('de');
  const list = G.countries();
  assert.equal(list.length, 198);
  const drift = [];
  const same = (html, rel) => stampHtml(html, join(ROOT, dirname(rel))) === read(rel);
  if (!same(G.homePage(list), 'de/index.html')) drift.push('de/');
  for (const c of list) if (!same(G.countryPage(c), `de/esim/${c.slug}/index.html`)) drift.push(c.slug);
  if (!same(G.hubPage(list), 'de/esim/index.html')) drift.push('de/esim/');
  for (const g of DE_GUIDES) if (!same(G.guidePage(g), `de/guides/${g.slug}/index.html`)) drift.push(`guide ${g.slug}`);
  if (!same(G.guidesHub(), 'de/guides/index.html')) drift.push('de/guides/');
  if (G.destinationsJs(list) !== read('de/destinations.js')) drift.push('de/destinations.js');
  assert.deepEqual(drift, []);
});

/* ------------------------------------------------------------------ 2. the same design */

/** Tags and classes in order — what the stylesheets see. Text, URLs, ids and labels left out. */
function skeleton(html) {
  const body = html.slice(html.indexOf('<body'))
    .replace(/<script[\s\S]*?<\/script>/g, '<script>')
    .replace(/<svg[\s\S]*?<\/svg>/g, '<svg>')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ul class="langmenu-list">[\s\S]*?<\/ul>/g, '<ul class="langmenu-list">')
    .replace(/(<nav class="hub-az"[^>]*>)[\s\S]*?<\/nav>/g, '$1</nav>')
    .replace(/(<div class="hub-list" id="hubList">)[\s\S]*?(<div class="hub-empty")/g, '$1</div>$2');
  return [...body.matchAll(/<([a-z0-9]+)\b([^>]*)>/g)].filter((m) => m[1] !== 'strong' && m[1] !== 'br').map((m) => {
    const cls = (m[2].match(/\sclass="([^"]*)"/) || [, ''])[1];
    return cls ? `${m[1]}.${cls.split(/\s+/).join('.')}` : m[1];
  }).join(' ');
}

test('the same design: every page kind has the English markup skeleton (tags and classes, in order)', () => {
  const kinds = ['index.html', 'esim/index.html', 'esim/thailand/index.html', 'esim/japan/index.html', 'esim/uae/index.html',
    'esim/peru/index.html', 'esim/turkey/index.html', 'guides/index.html', ...EN_GUIDES.map((g) => `guides/${g.slug}/index.html`)];
  for (const k of kinds) assert.equal(skeleton(read(`de/${k}`)), skeleton(read(`en/${k}`)), k);
  // …and the same stylesheets and scripts (Expressive and the logo included), the language's own data aside.
  const assets = (h) => [...h.matchAll(/(?:href|src)="(\/[^"?]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"/g)].map((m) => m[1].replace(/^\/(en|de)\/destinations\.js$/, 'DEST').replace(/country-names-(en|de)\.js$/, 'NAMES').replace(/site-i18n-(en|de)\.js$/, 'WORDS'));
  for (const k of ['index.html', 'esim/thailand/index.html', 'esim/index.html', 'guides/iphone/index.html']) {
    assert.deepEqual(assets(read(`de/${k}`)), assets(read(`en/${k}`)), `${k}: the same assets`);
  }
  assert.match(head(read('de/index.html')), /<meta property="og:locale" content="de_DE">/, 'the home names its locale');
  assert.match(read('de/index.html'), /data-motion-src="\/assets\/motion\.js\?v=[0-9a-f]+"/, 'Expressive on the home');
  assert.match(read('de/esim/thailand/index.html'), /data-motion-src="\/assets\/motion\.js\?v=[0-9a-f]+"/, 'Expressive on a country page');
  for (const k of ['index.html', 'esim/thailand/index.html', 'guides/iphone/index.html']) {
    assert.match(read(`de/${k}`), /<script src="\/assets\/logo-once\.js\?v=[0-9a-f]+"[^>]*><\/script>/, `${k}: the logo «Reveal + Wave»`);
    assert.equal(head(read(`de/${k}`)).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1],
      head(read(`en/${k}`)).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1], `${k}: the English CSP`);
  }
});

test('the German destination list: 198 destinations, each under its initial (Ä → A, Ö → O, Å → A), every jump letter lands', () => {
  const html = read('de/esim/index.html');
  const sections = [...html.matchAll(/<section class="az-group" id="az-([a-z]+)"[\s\S]*?<h2 id="azh-\1">([^<]+)<\/h2>([\s\S]*?)<\/section>/g)];
  const names = sections.flatMap((m) => [...m[3].matchAll(/<span>([^<]+)<\/span>/g)].map((x) => [m[2], decode(x[1])]));
  assert.equal(names.length, 198);
  for (const [letter, name] of names) assert.equal(name.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase(), letter, name);
  const jumps = [...html.matchAll(/<a href="#az-([a-z]+)" data-letter="([A-Z])">/g)].map((m) => m[1]);
  assert.deepEqual(jumps, sections.map((m) => m[1]));
  for (const l of sections.map((m) => m[2])) {
    const group = names.filter(([x]) => x === l).map(([, n]) => n);
    assert.deepEqual(group, group.slice().sort((a, b) => a.localeCompare(b, 'de')), `${l}: in German order`);
  }
  const at = (n) => names.find(([, x]) => x === n)?.[0];
  assert.equal(at('Ägypten'), 'A'); assert.equal(at('Österreich'), 'O'); assert.equal(at('Ålandinseln'), 'A');
  assert.equal(at('Türkei'), 'T'); assert.equal(at('Vereinigte Staaten'), 'V');
});

test('the skeleton check can fire', () => {
  assert.notEqual(skeleton('<body><div class="a"><p>x</p></div>'), skeleton('<body><div class="b"><p>x</p></div>'));
});

/* ------------------------------------------------------------------ 3. German only */

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function readable(html) {
  const body = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<a [^>]*hreflang="[^"]*"[^>]*>[^<]*<\/a>/g, ' ').replace(/<span aria-current="true"[^>]*>[^<]*<\/span>/g, ' ')
    .replace(/<summary aria-label="[^"]*">[\s\S]*?<\/summary>/g, ' ');
  const runs = [];
  for (const m of body.matchAll(/>([^<]+)</g)) runs.push(decode(m[1]));
  for (const m of body.matchAll(/\s(?:aria-label|placeholder|title|alt)="([^"]*)"/g)) runs.push(decode(m[1]));
  for (const m of body.matchAll(/<meta (?:name="description"|property="og:(?:title|description)") content="([^"]*)"/g)) runs.push(decode(m[1]));
  return runs.map((s) => s.trim()).filter(Boolean);
}

// Names that are the same in every language: the brand, products, platforms, technical terms and units.
const KEEP = new Set(['magic', 'esim', 'sim', 'sims', 'iphone', 'ios', 'android', 'google', 'pixel', 'samsung', 'galaxy',
  'apple', 'wi', 'fi', 'qr', 'apn', 'apns', 'eid', 'usd', 'gb', 'mb', 'kbps', 'mbps', 'gbps', 'ip', 'support', 'magicesim', 'store']);
const words = (s) => (String(s).toLowerCase().match(/\p{L}+/gu) || []);

function germanWords() {
  const de = new Set();
  const add = (v) => { for (const w of words(typeof v === 'function' ? v('X') : Array.isArray(v) ? JSON.stringify(v) : v)) de.add(w); };
  for (const v of Object.values(SITE.DICT.de)) add(v);
  for (const v of Object.values(PAGE_COPY.de)) add(v);
  for (const g of DE_GUIDES) add(JSON.stringify(g).replace(/<[^>]+>/g, ' '));
  return de;
}

function englishOnlyWords() {
  const en = new Set();
  const de = new Set();
  const add = (set, v) => { for (const w of words(typeof v === 'function' ? v('X') : Array.isArray(v) ? JSON.stringify(v) : v)) set.add(w); };
  for (const v of Object.values(SITE.DICT.en)) add(en, v);
  for (const v of Object.values(PAGE_COPY.en)) add(en, v);
  for (const g of EN_GUIDES) add(en, JSON.stringify(g).replace(/<[^>]+>/g, ' '));
  for (const v of Object.values(SITE.DICT.de)) add(de, v);
  for (const v of Object.values(PAGE_COPY.de)) add(de, v);
  for (const g of DE_GUIDES) add(de, JSON.stringify(g).replace(/<[^>]+>/g, ' '));
  return new Set([...en].filter((w) => w.length >= 3 && !de.has(w) && !KEEP.has(w)));
}

test('German only: no English-only word and no Russian on any of the 206 pages', () => {
  const EN_ONLY = englishOnlyWords();
  assert.ok(EN_ONLY.size > 300 && EN_ONLY.has('plans') && EN_ONLY.has('destinations'), 'the English word list is real');
  const namesSrc = read('assets/country-names-de.js');
  const deNames = new Set(Object.keys(COUNTRY_NAMES).flatMap((iso) => words(namesSrc.match(new RegExp(`"${iso}": "([^"]+)"`))?.[1] || '')));
  const hits = new Set();
  for (const rel of DE_SITE_PAGES) {
    for (const run of readable(read(rel))) {
      if (/[А-Яа-яЁё]/.test(run)) hits.add(`${rel}: Russian «${run.slice(0, 60)}»`);
      for (const w of words(run)) if (EN_ONLY.has(w) && !deNames.has(w)) hits.add(`${rel}: «${w}» in «${run.slice(0, 60)}»`);
    }
  }
  assert.deepEqual([...hits].slice(0, 20), []);
});

test('no Spanish word on a German page either (the template must not borrow the other copy)', () => {
  const es = new Set();
  for (const v of Object.values(SITE.DICT.es)) for (const w of words(v)) es.add(w);
  const de = germanWords();
  const esOnly = new Set([...es].filter((w) => w.length >= 5 && !de.has(w) && !KEEP.has(w)));
  const hits = new Set();
  for (const rel of ['de/index.html', 'de/esim/index.html', 'de/esim/thailand/index.html', 'de/guides/index.html']) {
    for (const run of readable(read(rel))) for (const w of words(run)) if (esOnly.has(w)) hits.add(`${rel}: «${w}»`);
  }
  assert.deepEqual([...hits], []);
});

test('the German-only check can fire', () => {
  const EN_ONLY = englishOnlyWords();
  const runs = readable('<body><p>Tarife ansehen</p><p>Show all plans</p><p>Тарифы</p></body>');
  assert.ok(runs.some((r) => words(r).some((w) => EN_ONLY.has(w))), 'an English phrase is caught');
  assert.ok(runs.some((r) => /[А-Яа-яЁё]/.test(r)), 'a Russian one too');
});

test('the claim rules (seo/claim-guards.mjs, de) hold on every German page of their kind', () => {
  const kindOf = (rel) => (rel === 'de/index.html' ? 'home' : /^de\/guides\/[^/]+\/index\.html$/.test(rel) ? 'guide'
    : /^de\/esim\/[^/]+\/index\.html$/.test(rel) ? 'country' : null);
  const hits = [];
  for (const rel of DE_PAGES) {
    const kind = kindOf(rel); if (!kind) continue;
    const text = readable(read(rel)).join('\n');
    for (const [id, re] of rulesFor('de', kind)) { const m = text.match(re); if (m) hits.push(`${rel}: ${id} «${m[0]}»`); }
  }
  assert.deepEqual(hits, []);
});

/* ------------------------------------------------------------------ 4. numbers */

test('prices are «12,99 USD» (de-DE, the currency as a code — owner D2); English and Spanish unchanged', () => {
  const fmt = (lang, n) => {
    const I = SITE.createI18n(lang);
    return new Intl.NumberFormat(I.t('fmt.numberLocale'), { style: 'currency', currency: 'USD', currencyDisplay: I.t('fmt.currencyDisplay'),
      minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n).replace(/\s/g, ' ');
  };
  assert.equal(fmt('de', 12.99), '12,99 USD');
  assert.equal(fmt('de', 1234.5), '1.234,50 USD');
  assert.equal(fmt('en', 12.99), '$12.99', 'English as before');
  assert.equal(fmt('es', 12.99), 'USD 12.99', 'Spanish as before');
  // en/plans.js reads both keys from the dictionary — the one place a price is written.
  assert.match(read('en/plans.js'), /currencyDisplay: I18N\.t\('fmt\.currencyDisplay'\)/);
  for (const l of ['en', 'es', 'de']) assert.ok(['symbol', 'code'].includes(SITE.DICT[l]['fmt.currencyDisplay']), l);
});

test('data amounts use a decimal comma; plurals and units by German rules', () => {
  const I = SITE.createI18n('de');
  assert.equal(DAILY.formatAllowance(1.5, 'de'), '1,5 GB');
  assert.equal(DAILY.formatAllowance(0.49, 'de'), '500 MB');
  assert.equal(I.plural('plan.dayCount', 1, { n: 1 }), '1 Tag');
  assert.equal(I.plural('plan.dayCount', 7, { n: 7 }), '7 Tage');
  assert.equal(I.plural('hub.matches', 1, { n: 1 }), '1 Reiseziel gefunden');
  assert.equal(I.plural('hub.matches', 3, { n: 3 }), '3 Reiseziele gefunden');
  const sample = { plan_type: 'DAILY', daily_gb: 1.5, daily_throttle_label: '512 Kbps', daily_reset_confirmed: true, daily_term_mode: 'FIXED_TERM', validity_days: 3 };
  assert.equal(DAILY.lines(sample, 'de').map((l) => l.text).join(' | '),
    '1,5 GB pro Tag mit voller Geschwindigkeit | Danach bis zu 512 kbit/s | Das Volumen wird alle 24 Stunden zurückgesetzt | Laufzeit: 3 Tage');
  assert.equal(SITE.pathPrefix('de'), '/de');
});

/* ------------------------------------------------------------------ 5. country names in sentences */

test('every DE_FUER key is a German name the site prints; the accusative appears where the templates put it', () => {
  const names = new Set(Object.keys(COUNTRY_NAMES).map((iso) => { try { return countryName(iso, 'de'); } catch { return null; } }));
  for (const [k, v] of Object.entries(DE_FUER)) {
    assert.ok(names.has(k), `«${k}» is not a German name of seo/country-names-i18n.mjs`);
    assert.match(v, /^(die|das|den) /, `«${v}»: an article`);
  }
  const C = PAGE_COPY.de;
  assert.equal(C.esimFor('Türkei'), 'eSIM für die Türkei');
  assert.equal(C.esimFor('Vereinigte Staaten'), 'eSIM für die Vereinigten Staaten');
  assert.equal(C.esimFor('Irak'), 'eSIM für den Irak');
  assert.equal(C.esimFor('Vereinigtes Königreich'), 'eSIM für das Vereinigte Königreich');
  assert.equal(C.esimFor('Thailand'), 'eSIM für Thailand');
  assert.match(read('de/esim/turkey/index.html'), /<h1>eSIM für die Türkei<\/h1>/);
  assert.match(read('de/esim/usa/index.html'), /<h1>eSIM für die Vereinigten Staaten<\/h1>/);
  // no bare article-less form of a listed name after «für» anywhere on the German pages
  const bare = Object.keys(DE_FUER).map((k) => [k, new RegExp(`für ${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u')]);
  const hits = new Set();
  for (const rel of DE_PAGES) for (const run of readable(read(rel))) for (const [k, re] of bare) if (re.test(run)) hits.add(`${rel}: «für ${k}»`);
  assert.ok(bare.find(([k]) => k === 'Niger')[1].test('Tarife für Niger') && !bare.find(([k]) => k === 'Niger')[1].test('Tarife für Nigeria'), 'the check can fire, and only on the whole name');
  assert.deepEqual([...hits], []);
});

test('every German title fits 60 characters; country pages say «eSIM für …»', () => {
  for (const rel of DE_PAGES) {
    const title = decode(read(rel).match(/<title>([^<]*)<\/title>/)[1]);
    assert.ok([...title].length <= TITLE_MAX, `${rel}: ${[...title].length} «${title}»`);
    const desc = decode(read(rel).match(/<meta name="description" content="([^"]*)"/)[1]);
    assert.ok([...desc].length <= 160 && [...desc].length >= 70, `${rel}: description ${[...desc].length}`);
  }
  assert.match(read('de/esim/thailand/index.html'), /<title>eSIM für Thailand: Tarife in US-Dollar \| Magic eSIM<\/title>/);
});

/* ------------------------------------------------------------------ 6. search engines */

test('noindex until the owner opens German (D11): every page noindex, self-canonical, no hreflang, out of the sitemap', () => {
  assert.equal(locale('de').site.enabled, true);
  assert.equal(locale('de').site.indexableHome, false);
  const sitemap = read('sitemap.xml');
  assert.doesNotMatch(sitemap, /magicesim\.store\/de\//);
  for (const rel of DE_PAGES) {
    const h = head(read(rel));
    const url = `https://magicesim.store/${rel.replace(/index\.html$/, '')}`;
    assert.match(h, /<meta name="robots" content="noindex, follow">/, rel);
    assert.ok(h.includes(`<link rel="canonical" href="${url}">`), `${rel}: canonical`);
    assert.doesNotMatch(h, /rel="alternate"[^>]*hreflang/, `${rel}: an hreflang alternate`);
    assert.match(read(rel), /<html lang="de"/, rel);
    const og = h.match(/<meta property="og:locale" content="([^"]+)">/);
    if (og) assert.equal(og[1], 'de_DE', rel);
  }
  assert.doesNotMatch(read('robots.txt'), /^Disallow:\s*\/de\//m);
});

test('no RU / EN / ES page lists German as an hreflang alternate; the stage is unchanged', () => {
  assert.deepEqual([...INDEXED_COUNTRIES], ['china', 'france', 'greece', 'indonesia', 'japan', 'maldives', 'mexico', 'south-korea',
    'sri-lanka', 'thailand', 'turkey', 'united-kingdom', 'vietnam']);
  for (const rel of ['index.html', 'esim/thailand/index.html', 'en/index.html', 'en/esim/thailand/index.html', 'es/index.html',
    'es/esim/japan/index.html', 'en/guides/iphone/index.html', 'iphone.html']) {
    assert.doesNotMatch(head(read(rel)), /hreflang="de"/, rel);
  }
});

/* ------------------------------------------------------------------ 7. sources */

test('the German guides name their vendor sources and their date; Android quotes only sourced labels', () => {
  const src = read('seo/guides-de.mjs');
  for (const s of ['support.apple.com/de-de/118669', '/de-de/118227', '/de-de/109317', 'pixelphone/answer/16115470',
    'samsung.com/de/support/mobile-devices/so-verwendest-du-dein-galaxy-smartphone-mit-esim', '2026-10-22']) assert.ok(src.includes(s), s);
  const quoted = new Set([...src.slice(0, src.indexOf('export const')).matchAll(/«([^»]+)»/g)].map((m) => m[1]));
  for (const g of DE_GUIDES.filter((x) => ['iphone', 'android', 'compatibility'].includes(x.slug))) {
    const bold = g.sections.flatMap((s) => [...s.html.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1]))
      .filter((b) => !/^(Google Pixel|Samsung Galaxy|Andere Marken|Samsung|Pixel|iPhone|Android|mobile Daten|Roaming|EID|Lösche die eSIM nicht|Kamera):?$/.test(b))
      .flatMap((b) => b.split(' → '));
    for (const b of bold) assert.ok(quoted.has(b) || ['Einstellungen', 'Allgemein', 'Info', 'Mobilfunk'].includes(b), `${g.slug}: «${b}» is not among the sourced labels`);
  }
});

/* ------------------------------------------------------------------ 8. hyphenation */

test('hyphenation is German-only (D6): one rule under html:lang(de) in the prefixed-language layer', () => {
  const css = read('en/en.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]*)\{[^}]*hyphens:\s*auto[^}]*\}/g)].map((m) => m[1].trim());
  assert.ok(rules.length >= 1);
  for (const sel of rules) for (const part of sel.split(',')) assert.match(part.trim().replace(/^\/\*[\s\S]*?\*\/\s*/, ''), /^html:lang\(de\)/, part);
  for (const f of ['assets/site.css', 'assets/ru.css']) assert.doesNotMatch(read(f), /hyphens:\s*auto/, f);
});
