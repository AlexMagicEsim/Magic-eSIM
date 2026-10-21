/* Country names in seven languages — completeness and correctness (I18N-03).
 *
 * The data is `seo/country-names-i18n.mjs` (es, de, fr, zh-Hans, ko) beside
 * `seo/country-names.mjs` (ru, en). These tests make it impossible to:
 *   - add or lose a country in one table and not the other;
 *   - leave a language out of an entry, or ship an empty / padded / code-only name;
 *   - put a name in the wrong script (Latin in Korean, Cyrillic anywhere new,
 *     a Traditional-only Han character in Simplified Chinese);
 *   - give two countries the same name in one language;
 *   - silently undo an editorial decision (AN, HK, MO, MM, CD, CG, SX);
 *   - render the data before a stage enables a language (nothing may import it).
 *
 * Run: node --test seo/test-country-names-i18n.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { COUNTRY_NAMES } from './country-names.mjs';
import { COUNTRY_NAMES_I18N, I18N_COUNTRY_LANGS, countryName } from './country-names-i18n.mjs';
import { LOCALES } from './locales.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Per-language allowed shape. Pure, so the «can fire» test can feed it bad names. */
const SHAPE = {
  es: /^\p{Script=Latin}([\p{Script=Latin} .’-]*\p{Script=Latin}\.?)?$/u,
  de: /^\p{Script=Latin}([\p{Script=Latin} .’-]*\p{Script=Latin}\.?)?$/u,
  fr: /^\p{Script=Latin}([\p{Script=Latin} .’-]*\p{Script=Latin}\.?)?$/u,
  'zh-Hans': /^\p{Script=Han}+$/u,
  ko: /^\p{Script=Hangul}([\p{Script=Hangul} ]*\p{Script=Hangul})?$/u, // 괌 (Guam) is one syllable
};

/**
 * Han characters that exist only in TRADITIONAL writing, each with a different
 * Simplified form — taken from CLDR's zh-Hant country names (e.g. 國→国, 灣→湾,
 * 島→岛, 蘭→兰, 爾→尔). A Simplified page must contain none of them.
 */
const TRADITIONAL_ONLY = [...'國灣島蘭爾亞東聖薩維羅盧馬納屬聯與區門關開義澤買約韓賴脫紹頓緬諾紐賓蘇獅敘萬葉達奧魯萊剛麥倫賽愛濟喬幾內臘蓋別來烏庫貝時岡茲'];

function badNames(table, langs) {
  const bad = [];
  for (const [code, entry] of Object.entries(table)) {
    for (const lang of langs) {
      const name = entry[lang];
      if (typeof name !== 'string' || !name) { bad.push(`${code}.${lang}: missing`); continue; }
      if (name !== name.trim() || /\s{2}/.test(name)) bad.push(`${code}.${lang}: whitespace «${name}»`);
      if (name.toUpperCase() === code) bad.push(`${code}.${lang}: the code itself`);
      if (/[\p{Script=Cyrillic}<>&"\d]/u.test(name)) bad.push(`${code}.${lang}: forbidden character «${name}»`);
      if (!SHAPE[lang].test(name)) bad.push(`${code}.${lang}: wrong script «${name}»`);
      if (lang === 'zh-Hans' && [...name].some((ch) => TRADITIONAL_ONLY.includes(ch))) bad.push(`${code}.${lang}: Traditional character «${name}»`);
    }
  }
  return bad;
}

/* ===================================================================== */

test('the table holds exactly the planned languages that country-names.mjs does not', () => {
  const planned = LOCALES.map((l) => l.code).filter((c) => c !== 'ru' && c !== 'en');
  assert.deepEqual([...I18N_COUNTRY_LANGS], planned);
});

test('the same countries, in the same order, as seo/country-names.mjs', () => {
  assert.deepEqual(Object.keys(COUNTRY_NAMES_I18N), Object.keys(COUNTRY_NAMES));
  assert.ok(Object.keys(COUNTRY_NAMES_I18N).length >= 230);
});

test('every entry has exactly the five languages', () => {
  for (const [code, entry] of Object.entries(COUNTRY_NAMES_I18N)) {
    assert.deepEqual(Object.keys(entry), [...I18N_COUNTRY_LANGS], code);
  }
});

test('every name is present, trimmed, not a code, and in its language\'s script', () => {
  assert.deepEqual(badNames(COUNTRY_NAMES_I18N, I18N_COUNTRY_LANGS), []);
});

test('the name checks can fire', () => {
  // §26.1: a gate that only reports «clean» is indistinguishable from one that never ran.
  const fake = {
    AE: { es: ' Emiratos', de: 'AE', fr: 'Émirats arabes unis', 'zh-Hans': '阿拉伯聯合酋長國', ko: 'UAE' },
    RU: { es: 'Россия', de: 'Russ1and', fr: '', 'zh-Hans': 'Russia', ko: '러시아' },
  };
  assert.deepEqual(badNames(fake, I18N_COUNTRY_LANGS), [
    'AE.es: whitespace « Emiratos»',
    'AE.es: wrong script « Emiratos»',
    'AE.de: the code itself',
    'AE.zh-Hans: Traditional character «阿拉伯聯合酋長國»',
    'AE.ko: wrong script «UAE»',
    'RU.es: forbidden character «Россия»',
    'RU.es: wrong script «Россия»',
    'RU.de: forbidden character «Russ1and»',
    'RU.de: wrong script «Russ1and»',
    'RU.fr: missing',
    'RU.zh-Hans: wrong script «Russia»',
  ]);
});

test('no two countries share a name in one language', () => {
  for (const lang of I18N_COUNTRY_LANGS) {
    const seen = new Map();
    for (const [code, entry] of Object.entries(COUNTRY_NAMES_I18N)) {
      const n = entry[lang];
      assert.equal(seen.has(n), false, `${lang}: «${n}» is both ${seen.get(n)} and ${code}`);
      seen.set(n, code);
    }
  }
});

test('the editorial decisions stay decided', () => {
  // Each overrides CLDR where CLDR contradicts our English name; see the file header.
  const T = COUNTRY_NAMES_I18N;
  assert.notEqual(T.AN.es, T.CW.es, 'AN is the Netherlands Antilles, not Curaçao');
  assert.equal(T.AN.de, 'Niederländische Antillen');
  assert.deepEqual([T.HK.es, T.HK.de, T.HK['zh-Hans'], T.HK.ko], ['Hong Kong', 'Hongkong', '中国香港', '홍콩']);
  assert.deepEqual([T.MO.de, T.MO['zh-Hans'], T.MO.ko], ['Macau', '中国澳门', '마카오']);
  assert.deepEqual([T.MM.es, T.MM.fr], ['Myanmar', 'Myanmar']);
  assert.equal(T.CD.fr, 'République démocratique du Congo');
  assert.equal(T.CG.de, 'Republik Kongo');
  assert.equal(T.SX.fr, 'Sint-Maarten');
  for (const lang of I18N_COUNTRY_LANGS) {
    for (const code of ['HK', 'MO']) assert.doesNotMatch(T[code][lang], /SAR|RAE|R\.A\.S|Sonderverwaltung|特别行政区|특별/, `${code}.${lang}`);
  }
});

test('countryName() serves all seven languages and refuses anything else', () => {
  assert.equal(countryName('AE', 'ru'), COUNTRY_NAMES.AE.ru);
  assert.equal(countryName('AE', 'en'), COUNTRY_NAMES.AE.en);
  assert.equal(countryName('AE', 'zh-Hans'), COUNTRY_NAMES_I18N.AE['zh-Hans']);
  for (const lang of LOCALES.map((l) => l.code)) assert.ok(countryName('TH', lang), lang);
  assert.throws(() => countryName('ZZ', 'es'), /unknown code ZZ/);
  assert.throws(() => countryName('AE', 'zh-CN'), /unknown language zh-CN/);
  assert.throws(() => countryName('AE', 'xx'), /unknown language xx/);
  assert.throws(() => countryName('__proto__', 'es'), /unknown code/);
});

test('the data cannot be rewritten at runtime', () => {
  assert.ok(Object.isFrozen(COUNTRY_NAMES_I18N) && Object.isFrozen(I18N_COUNTRY_LANGS));
  for (const v of Object.values(COUNTRY_NAMES_I18N)) assert.ok(Object.isFrozen(v));
});

test('only the generators read the table — no page or shipped script imports it', () => {
  // I18N-03 was data only. I18N-08c gave it to the two generators that build a
  // prefixed language (names file + pages), which write only PUBLISHED languages
  // (seo/test-locale-rehearsal.mjs proves nothing else is written). A page or a
  // shipped script reading it directly would still be wrong: the browser gets
  // the generated assets/country-names-<prefix>.js. The two rehearsal tests (pages; daily-plan words) read it for the
  // names a planned language's output may contain — tests, never shipped.
  const ALLOWED = new Set(['seo/country-names-i18n.mjs', 'seo/test-country-names-i18n.mjs',
    'seo/build-country-dictionary-locale.mjs', 'seo/build-locale-pages.mjs', 'seo/test-locale-rehearsal.mjs',
    'seo/test-daily-copy-langs.mjs']);
  const SKIP = new Set(['.git', 'node_modules', 'test-results', 'playwright-report']);
  const users = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(m?js|html|ya?ml|json)$/.test(name)) continue;
      const rel = relative(ROOT, p);
      if (!ALLOWED.has(rel) && readFileSync(p, 'utf8').includes('country-names-i18n')) users.push(rel);
    }
  }(ROOT));
  assert.deepEqual(users, []);
});
