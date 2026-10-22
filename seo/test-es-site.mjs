/* The Spanish site, /es/ (I18N ES-1, 2026-10-21): complete, in Spanish, and the English design.
 *
 *   1. Every source has every key English has — the browser dictionary falls back to RUSSIAN for a missing key, the
 *      generator throws, the daily table is checked in seo/test-daily-copy-langs.mjs; the guides mirror the English
 *      ones section for section, question for question, link for link.
 *   2. The same design: every page kind's markup skeleton (tags and classes, in order) equals the English one.
 *   3. Spanish only: on all 206 pages no word that only English uses and no Russian (bar the language switch's
 *      «Русский») — brands and technical names excepted, by an explicit list.
 *   4. Prices and numbers the owner's way (D2): «USD 12.99» (es-419); data amounts with a decimal point.
 *   5. The guides name their sources (vendor pages read 2026-10-21) and quote only those labels.
 *
 * Run: node --test seo/test-es-site.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PAGE_COPY } from './page-copy.mjs';
import { EN_GUIDES } from './guides-en.mjs';
import { ES_GUIDES } from './guides-es.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';

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
const ES_PAGES = htmlUnder('es');

/* ------------------------------------------------------------------ 1. complete */

test('206 Spanish pages: the home, the list, 198 countries, the guides list and five guides', () => {
  assert.equal(ES_PAGES.length, 206);
  assert.equal(ES_PAGES.filter((p) => /^es\/esim\/[^/]+\/index\.html$/.test(p)).length, 198);
  assert.equal(htmlUnder('en').length, ES_PAGES.length, 'the same pages as English');
});

test('every source has every key English has, and no other', () => {
  assert.deepEqual(Object.keys(SITE.DICT.es).sort(), Object.keys(SITE.DICT.en).sort(), 'assets/site-i18n.js');
  assert.deepEqual(Object.keys(PAGE_COPY.es).sort(), Object.keys(PAGE_COPY.en).sort(), 'seo/page-copy.mjs');
  for (const [k, v] of Object.entries(SITE.DICT.en)) {
    const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(ph(SITE.DICT.es[k]), ph(v), `${k}: the same {placeholders}`);
  }
  assert.ok(DAILY.LANGS.includes('es'), 'the daily-plan table');
});

test('the Spanish guides mirror the English ones: slugs, sections, questions, related, internal links', () => {
  assert.deepEqual(ES_GUIDES.map((g) => g.slug), EN_GUIDES.map((g) => g.slug));
  const links = (g) => g.sections.flatMap((s) => [...s.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/^\/(en|es)\//, '/L/')));
  for (const [i, es] of ES_GUIDES.entries()) {
    const en = EN_GUIDES[i];
    assert.equal(es.sections.length, en.sections.length, `${es.slug}: sections`);
    assert.equal(es.faq.length, en.faq.length, `${es.slug}: questions`);
    assert.deepEqual(es.related, en.related, `${es.slug}: related`);
    assert.deepEqual(links(es), links(en), `${es.slug}: the same links, in Spanish`);
    for (const [j, s] of es.sections.entries()) {
      const tags = (h) => [...h.matchAll(/<(ol|ul|li|p|strong|a)\b/g)].map((m) => m[1]).filter((t) => t !== 'strong').join(' ');
      assert.equal(tags(s.html), tags(en.sections[j].html), `${es.slug} §${j}: the same structure`);
    }
  }
});

/* ------------------------------------------------------------------ 2. the same design */

/** Tags and classes in order — what the stylesheets see. Text, URLs, ids and labels left out. */
function skeleton(html) {
  const body = html.slice(html.indexOf('<body'))
    .replace(/<script[\s\S]*?<\/script>/g, '<script>')
    .replace(/<svg[\s\S]*?<\/svg>/g, '<svg>')
    .replace(/<!--[\s\S]*?-->/g, '')
    // the language list marks the page's own language, which sits at a different place in each language — its entries
    // are checked by seo/test-language-switch.mjs
    .replace(/<ul class="langmenu-list">[\s\S]*?<\/ul>/g, '<ul class="langmenu-list">')
    // the destination list's letters and groups come from the names in each language (Spanish has 22 initials,
    // English 23) — data, not design; the Spanish list is checked on its own below
    .replace(/(<nav class="hub-az"[^>]*>)[\s\S]*?<\/nav>/g, '$1</nav>')
    .replace(/(<div class="hub-list" id="hubList">)[\s\S]*?(<div class="hub-empty")/g, '$1</div>$2');
  // <strong> is emphasis inside a sentence — the Spanish guides bold both regional names of a setting.
  return [...body.matchAll(/<([a-z0-9]+)\b([^>]*)>/g)].filter((m) => m[1] !== 'strong').map((m) => {
    const cls = (m[2].match(/\sclass="([^"]*)"/) || [, ''])[1];
    return cls ? `${m[1]}.${cls.split(/\s+/).join('.')}` : m[1];
  }).join(' ');
}

test('the same design: every page kind has the English markup skeleton (tags and classes, in order)', () => {
  const kinds = ['index.html', 'esim/index.html', 'esim/thailand/index.html', 'esim/japan/index.html', 'esim/uae/index.html',
    'esim/peru/index.html', 'guides/index.html', ...EN_GUIDES.map((g) => `guides/${g.slug}/index.html`)];
  for (const k of kinds) assert.equal(skeleton(read(`es/${k}`)), skeleton(read(`en/${k}`)), k);
  // …and the head loads the same stylesheets and scripts (Expressive included), the language's own data aside.
  const assets = (h) => [...h.matchAll(/(?:href|src)="(\/[^"?]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"/g)].map((m) => m[1].replace(/^\/(en|es)\/destinations\.js$/, 'DEST').replace(/country-names-(en|es)\.js$/, 'NAMES').replace(/site-i18n-(en|es)\.js$/, 'WORDS'));
  for (const k of ['index.html', 'esim/thailand/index.html', 'esim/index.html', 'guides/iphone/index.html']) {
    assert.deepEqual(assets(read(`es/${k}`)), assets(read(`en/${k}`)), `${k}: the same assets`);
  }
  assert.match(read('es/index.html'), /data-motion-src="\/assets\/motion\.js\?v=[0-9a-f]+"/, 'Expressive on the home');
  assert.match(read('es/esim/thailand/index.html'), /data-motion-src="\/assets\/motion\.js\?v=[0-9a-f]+"/, 'Expressive on a country page');
});

test('the Spanish destination list: 198 destinations, each under its Spanish initial, every jump letter lands', () => {
  const html = read('es/esim/index.html');
  const sections = [...html.matchAll(/<section class="az-group" id="az-([a-z]+)"[\s\S]*?<h2 id="azh-\1">([^<]+)<\/h2>([\s\S]*?)<\/section>/g)];
  const names = sections.flatMap((m) => [...m[3].matchAll(/<span>([^<]+)<\/span>/g)].map((x) => [m[2], decode(x[1])]));
  assert.equal(names.length, 198);
  for (const [letter, name] of names) {
    assert.equal(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase(), letter, name);
  }
  const jumps = [...html.matchAll(/<a href="#az-([a-z]+)" data-letter="([A-Z])">/g)].map((m) => m[1]);
  assert.deepEqual(jumps, sections.map((m) => m[1]));
  const order = names.map(([, n]) => n);
  for (const [l] of sections.map((m) => [m[2]])) {
    const group = names.filter(([x]) => x === l).map(([, n]) => n);
    assert.deepEqual(group, group.slice().sort((a, b) => a.localeCompare(b, 'es')), `${l}: in Spanish order`);
  }
  assert.ok(order.includes('Japón') && order.includes('España') && order.includes('Estados Unidos'));
});

test('the skeleton check can fire', () => {
  assert.notEqual(skeleton('<body><div class="a"><p>x</p></div>'), skeleton('<body><div class="b"><p>x</p></div>'));
});

/* ------------------------------------------------------------------ 3. Spanish only */

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function readable(html) {
  const body = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    // the language switch: every language by its own name
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
  'apple', 'wi', 'fi', 'qr', 'apn', 'eid', 'usd', 'gb', 'mb', 'kbps', 'mbps', 'gbps', 'ip', 'support', 'magicesim', 'store']);
const words = (s) => (String(s).toLowerCase().match(/\p{L}+/gu) || []);

function englishOnlyWords() {
  const en = new Set();
  const es = new Set();
  const add = (set, v) => { for (const w of words(typeof v === 'function' ? v('X') : Array.isArray(v) ? JSON.stringify(v) : v)) set.add(w); };
  for (const v of Object.values(SITE.DICT.en)) add(en, v);
  for (const v of Object.values(PAGE_COPY.en)) add(en, v);
  for (const g of EN_GUIDES) add(en, JSON.stringify(g).replace(/<[^>]+>/g, ' '));
  for (const v of Object.values(SITE.DICT.es)) add(es, v);
  for (const v of Object.values(PAGE_COPY.es)) add(es, v);
  for (const g of ES_GUIDES) add(es, JSON.stringify(g).replace(/<[^>]+>/g, ' '));
  return new Set([...en].filter((w) => w.length >= 3 && !es.has(w) && !KEEP.has(w)));
}

test('Spanish only: no English-only word and no Russian on any of the 206 pages', () => {
  const EN_ONLY = englishOnlyWords();
  assert.ok(EN_ONLY.size > 300 && EN_ONLY.has('plans') && EN_ONLY.has('destinations'), 'the English word list is real');
  const esNames = new Set(Object.keys(COUNTRY_NAMES).flatMap((iso) => words(readFileSync(join(ROOT, 'assets/country-names-es.js'), 'utf8').match(new RegExp(`"${iso}": "([^"]+)"`))?.[1] || '')));
  const hits = new Set();
  for (const rel of ES_PAGES) {
    for (const run of readable(read(rel))) {
      if (/[А-Яа-яЁё]/.test(run)) hits.add(`${rel}: Russian «${run.slice(0, 60)}»`);
      for (const w of words(run)) if (EN_ONLY.has(w) && !esNames.has(w)) hits.add(`${rel}: «${w}» in «${run.slice(0, 60)}»`);
    }
  }
  assert.deepEqual([...hits].slice(0, 20), []);
});

test('the Spanish-only check can fire', () => {
  const EN_ONLY = englishOnlyWords();
  const runs = readable('<body><p>Ver planes</p><p>Show all plans</p><p>Тарифы</p></body>');
  assert.ok(runs.some((r) => words(r).some((w) => EN_ONLY.has(w))), 'an English phrase is caught');
  assert.ok(runs.some((r) => /[А-Яа-яЁё]/.test(r)), 'a Russian one too');
});

/* ------------------------------------------------------------------ 4. numbers */

test('prices are «USD 12.99» (es-419, owner D2); data amounts use a decimal point; plurals by Spanish rules', () => {
  const I = SITE.createI18n('es');
  assert.equal(I.t('fmt.numberLocale'), 'es-419');
  assert.equal(new Intl.NumberFormat(I.t('fmt.numberLocale'), { style: 'currency', currency: 'USD' }).format(12.99).replace(/\s/g, ' '), 'USD 12.99');
  assert.equal(DAILY.formatAllowance(1.5, 'es'), '1.5 GB');
  assert.equal(DAILY.formatAllowance(0.49, 'es'), '500 MB');
  assert.equal(I.plural('plan.dayCount', 1, { n: 1 }), '1 día');
  assert.equal(I.plural('plan.dayCount', 7, { n: 7 }), '7 días');
  assert.equal(I.plural('hub.matches', 1, { n: 1 }), '1 destino coincide');
  assert.equal(SITE.pathPrefix('es'), '/es');
});

test('«y» becomes «e» before an /i/ sound in a joined list of countries', () => {
  const names = { FR: 'Francia', IT: 'Italia', HT: 'Haití', IS: 'Islandia', ES: 'España' };
  const place = (codes) => DAILY.placeName({ coverage_country_codes: codes, name: '', country_code: 'XX' }, (c) => names[c] || c, 'es');
  assert.equal(place(['FR', 'IT']), 'Francia e Italia');
  assert.equal(place(['ES', 'FR', 'IS']), 'España, Francia e Islandia');
  assert.equal(place(['FR', 'HT']), 'Francia y Haití');
  assert.equal(place(['IT', 'ES']), 'Italia y España');
});

/* ------------------------------------------------------------------ 5. sources */

test('the Spanish guides name their vendor sources and their date', () => {
  const src = read('seo/guides-es.mjs');
  for (const s of ['support.apple.com/es-es/118669', 'support.apple.com/es-mx/118669', 'pixelphone/answer/16115470',
    'samsung.com/es/support/mobile-devices/esim-de-galaxy', '2026-10-21']) assert.ok(src.includes(s), s);
  // Every bolded menu label of the Android guide is one the sources list.
  const quoted = new Set([...src.slice(0, src.indexOf('export const')).matchAll(/«([^»]+)»/g)].map((m) => m[1]));
  const android = ES_GUIDES.find((g) => g.slug === 'android');
  const bold = android.sections.flatMap((s) => [...s.html.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1]))
    .filter((b) => !/^(Google Pixel|Samsung Galaxy|Otras marcas|Samsung|Pixel|datos móviles|roaming|No borres la eSIM):?$/.test(b));
  for (const b of bold) assert.ok(quoted.has(b), `«${b}» is not among the sourced labels`);
});
