#!/usr/bin/env node
// Generates the runtime country dictionary that the storefront renders with.
//
// WHY THIS EXISTS
//
// The landing has no bundler, so `countryNames` was a hand-typed object literal
// duplicated verbatim in index.html and assets/country-tariffs.js. Meanwhile new
// destinations arrive fully automatically: the provider sync writes a package,
// /api/v1/retail/packages serves it, and refresh-catalog-cache.yml commits it to
// assets/catalog.json six times a day, unreviewed. The dictionary was the one
// link in that chain that only a human could extend — last widened by hand on
// 2026-05-18 — and `countryName()` fails soft, returning the code itself when it
// misses. The result was 130 of 959 cards titled with a raw ISO code: "BN 10 GB"
// instead of "Бруней 10 ГБ", plus 34 headings, chips and "not found" messages.
//
// So the names now come from one place — seo/country-names.mjs, which the page
// generator has always used and which already carried a correct Russian name for
// every missing code — and both copies are written by this script rather than by
// hand. The duplication remains (no bundler) but it is now generated, and
// `--check` fails CI if either copy drifts from the source.
//
//   node seo/build-country-dictionary.mjs           # rewrite both copies
//   node seo/build-country-dictionary.mjs --check   # fail if either is stale
//
// This script writes NOTHING except the two marked blocks. It does not touch
// prices, availability, provider ids, sync behaviour, the API DTO, the admin
// XLSX dictionary, or the slugs in seo/country-names.mjs (those are URLs).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRY_NAMES } from './country-names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const TARGETS = [
  join(ROOT, 'index.html'),
  join(ROOT, 'assets', 'country-tariffs.js'),
  // The Telegram Mini App. Added 2026-08-18: it shipped a country list of raw
  // ISO codes — "AD · AE · AF · AF-29" — because the catalogue DTO carries no
  // readable name and the app had no dictionary at all. It is a third copy for
  // the same reason the first two exist (no bundler), and it is generated for
  // the same reason: a hand-maintained copy is the link in the chain that goes
  // stale the moment a new destination appears.
  join(ROOT, 'app', 'core.js'),
];

export const BLOCK_RE =
  /\/\* --- COUNTRY NAMES[\s\S]*?END COUNTRY NAMES -+ \*\//;

// Two further blocks, written ONLY into the Mini App because only it needs
// them. Both are derived, never authored:
//
//   COUNTRY LATIN    code -> the Latin slug seo/country-names.mjs already keeps
//                    for URLs. The Mini App's list is in Russian, so without
//                    this "thailand" and "uae" match nothing — and a Russian
//                    keyboard is not a safe assumption for somebody already
//                    abroad.
//   POPULAR COUNTRIES the sixteen destinations the storefront shows, in the
//                    storefront's order, PARSED OUT OF index.html rather than
//                    retyped. Retyping it is how the Mini App would come to
//                    show a different "popular" than the site, silently, the
//                    first time marketing reorders the tiles.
export const APP_ONLY = join(ROOT, 'app', 'core.js');
export const LATIN_BLOCK_RE =
  /\/\* --- COUNTRY LATIN[\s\S]*?END COUNTRY LATIN -+ \*\//;
export const POPULAR_BLOCK_RE =
  /\/\* --- POPULAR COUNTRIES[\s\S]*?END POPULAR COUNTRIES -+ \*\//;
//   TARIFF WORDING   the Russian the storefront already renders for provider
//                    free-text: activation policies, speed and FUP sentences.
//                    Blueprint P8 says the Mini App reuses the site's content
//                    rather than rewriting it, and the failure mode of a second
//                    copy is not a missing string but a DIFFERENT promise about
//                    the same tariff on two screens of the same shop. Parsed out
//                    of assets/country-tariffs.js, which is where these have
//                    always been maintained.
export const TARIFF_BLOCK_RE =
  /\/\* --- TARIFF WORDING[\s\S]*?END TARIFF WORDING -+ \*\//;
//   COUNTRY NAMES ENGLISH  the same countries in English, for Phase 2's language
//                    switch. Generated from the same single source, so the two
//                    languages cannot drift apart the way two hand-kept lists
//                    would.
export const EN_BLOCK_RE =
  /\/\* --- COUNTRY NAMES ENGLISH[\s\S]*?END COUNTRY NAMES ENGLISH -+ \*\//;

/** The storefront's popular tiles, in the order they are rendered. */
export function readPopularFromStorefront() {
  const src = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const section = src.match(/<section id="popular"[\s\S]*?<\/section>/);
  if (!section) throw new Error('no <section id="popular"> in index.html');

  const out = [];
  const re = /data-country="([A-Z]{2})"[\s\S]*?class="dest-name">([^<]+)</g;
  let m;
  while ((m = re.exec(section[0])) !== null) out.push({ code: m[1], name: m[2].trim() });
  if (!out.length) throw new Error('popular section matched but yielded no tiles');

  return out;
}

/**
 * Wording the storefront already showed, kept deliberately.
 *
 * seo/country-names.mjs is the source, but five of its names are worded
 * differently from what the tariff cards have been rendering, and one key —
 * OTHER — is not a country at all: `countryCode()` returns it as a bucket for
 * packages with no usable ISO code. Generating blindly would have silently
 * reworded five live destinations, which is an editorial change and has no place
 * in a fix for missing names. Each entry below is a decision, not an accident.
 */
export const STOREFRONT_WORDING = Object.freeze({
  // Not a country: the bucket countryCode() falls back to.
  OTHER: 'Другие страны',
  // The storefront's existing, longer wording wins over the SEO short form.
  BQ: 'Бонэйр, Синт-Эстатиус и Саба', // seo: "Бонайре"
  CF: 'Центральноафриканская Республика', // seo: "ЦАР"
  CG: 'Республика Конго', // seo: "Конго"
  TC: 'Теркс и Кайкос', // seo: "Тёркс и Кайкос"
  VI: 'Виргинские острова США', // seo: "Американские Виргинские острова"
});

/**
 * The same six decisions, in English, for the Mini App only.
 *
 * A SEPARATE table rather than an `en` field on STOREFRONT_WORDING above,
 * because that one feeds all three targets and the two storefront copies must
 * not move by a byte. This one is read only by buildDictionaryEn().
 *
 * OTHER is not a country — it is the bucket countryCode() falls back to — so it
 * has no ISO name in either language and must be worded by hand. The other five
 * mirror the Russian overrides' INTENT: each picks the longer, plainer wording
 * over the short form, which is the whole reason those five exist.
 */
export const STOREFRONT_WORDING_EN = Object.freeze({
  OTHER: 'Other countries',
  BQ: 'Bonaire, Sint Eustatius and Saba', // CLDR: "Caribbean Netherlands"
  CF: 'Central African Republic',
  CG: 'Republic of the Congo',
  TC: 'Turks and Caicos Islands',
  VI: 'U.S. Virgin Islands',
});

/** code → Russian name, the single canonical map the storefront renders with. */
export function buildDictionary() {
  const out = {};
  for (const [code, entry] of Object.entries(COUNTRY_NAMES)) {
    const name = typeof entry === 'string' ? entry : entry && entry.ru;
    if (name) out[code] = name;
  }
  for (const [code, name] of Object.entries(STOREFRONT_WORDING)) out[code] = name;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * code → English name. Mini App only.
 *
 * Same shape and same sort as buildDictionary(), so the two blocks stay
 * comparable by eye. A code with no English name is SKIPPED rather than
 * defaulted to its ISO code: countryLabel() already falls back to the Russian
 * map, and a bare "BN" is worse than «Бруней» for an English reader.
 */
export function buildDictionaryEn() {
  const out = {};
  for (const [code, entry] of Object.entries(COUNTRY_NAMES)) {
    const name = entry && entry.en;
    if (name) out[code] = name;
  }
  for (const [code, name] of Object.entries(STOREFRONT_WORDING_EN)) out[code] = name;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** The literal, packed the way the hand-written one was: this ships to every visitor. */
function renderBlock(dict) {
  const entries = Object.entries(dict).map(([code, name]) => `${code}:'${name.replace(/'/g, "\\'")}'`);
  const lines = [];
  let line = '';
  for (const entry of entries) {
    if (line && line.length + entry.length + 1 > 96) { lines.push(line); line = ''; }
    line += (line ? ',' : '') + entry;
  }
  if (line) lines.push(line);

  return [
    '/* --- COUNTRY NAMES ------------------------------------------------------',
    ' * GENERATED by seo/build-country-dictionary.mjs from seo/country-names.mjs.',
    ' * Do not edit by hand: both copies are rewritten from that source, and CI',
    ' * fails when a code in the live catalogue has no name here, so a new',
    ' * destination can no longer reach the storefront as a bare ISO code.',
    ' * --------------------------------------------------------------------- */',
    'const countryNames={',
    ...lines.map((l) => `  ${l},`),
    '};',
    '/* --- END COUNTRY NAMES --- */',
  ].join('\n');
}

/**
 * The English block, written ONLY into app/core.js.
 *
 * Its markers say ENGLISH rather than EN, and it is emitted AFTER the Russian
 * block, both on purpose: BLOCK_RE is a non-greedy match from "COUNTRY NAMES"
 * to "END COUNTRY NAMES ---", so a block whose header also began "COUNTRY
 * NAMES" and which sat BEFORE the Russian one would be swallowed together with
 * it on the next regeneration. Order and naming are load-bearing here.
 */
function renderEnBlock(dict) {
  const entries = Object.entries(dict).map(([code, name]) => `${code}:'${name.replace(/'/g, "\\'")}'`);
  const lines = [];
  let line = '';
  for (const entry of entries) {
    if (line && line.length + entry.length + 1 > 96) { lines.push(line); line = ''; }
    line += (line ? ',' : '') + entry;
  }
  if (line) lines.push(line);

  return [
    '/* --- COUNTRY NAMES ENGLISH ----------------------------------------------',
    ' * GENERATED by seo/build-country-dictionary.mjs from seo/country-names.mjs.',
    ' * The Mini App only: the storefront is Russian and never reads this.',
    ' * Derived once from CLDR via Intl.DisplayNames and reviewed as data — NOT',
    ' * resolved at runtime, because ICU differs across the WebViews this app',
    ' * runs in, which is the same reason app/i18n.js formats dates by hand.',
    ' * --------------------------------------------------------------------- */',
    'const countryNamesEn={',
    ...lines.map((l) => `  ${l},`),
    '};',
    '/* --- END COUNTRY NAMES ENGLISH --- */',
  ].join('\n');
}

function renderLatinBlock() {
  const pairs = Object.entries(COUNTRY_NAMES)
    .map(([code, e]) => [code, e && e.slug])
    .filter(([, slug]) => slug)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, slug]) => `${code}:'${slug}'`);

  const lines = [];
  let line = '';
  for (const p of pairs) {
    if (line && line.length + p.length + 1 > 96) { lines.push(line); line = ''; }
    line += (line ? ',' : '') + p;
  }
  if (line) lines.push(line);

  return [
    '/* --- COUNTRY LATIN ------------------------------------------------------',
    ' * GENERATED by seo/build-country-dictionary.mjs from seo/country-names.mjs.',
    ' * The Latin slug per country, so search finds "thailand" and "uae" as well',
    ' * as "Таиланд" and "ОАЭ". Same source as the URLs, so the two cannot part.',
    ' * --------------------------------------------------------------------- */',
    'const countryLatin={',
    ...lines.map((l) => `  ${l},`),
    '};',
    '/* --- END COUNTRY LATIN --- */',
  ].join('\n');
}

/** One `var NAME = <literal>;` out of the storefront's tariff mappers. */
export function readTariffLiteral(name) {
  const src = readFileSync(join(ROOT, 'assets', 'country-tariffs.js'), 'utf8');
  const m = src.match(new RegExp(`var ${name}=([\\s\\S]*?);\\n`));
  if (!m) throw new Error(`no ${name} in assets/country-tariffs.js`);

  return m[1];
}

function renderTariffBlock() {
  const activation = readTariffLiteral('TARIFF_ACTIVATION_LABELS');
  const fallback = readTariffLiteral('TARIFF_ACTIVATION_FALLBACK');
  const textRu = readTariffLiteral('TARIFF_TEXT_RU');
  const units = readTariffLiteral('TARIFF_SPEED_UNITS_RU');

  return [
    '/* --- TARIFF WORDING -----------------------------------------------------',
    ' * GENERATED by seo/build-country-dictionary.mjs from',
    ' * assets/country-tariffs.js, where this wording has always been kept.',
    ' *',
    ' * Blueprint P8: the Mini App reuses the site\'s content instead of writing',
    ' * its own. The risk of a hand copy here is not a missing string — it is the',
    ' * same tariff described two different ways on two screens of one shop.',
    ' * --------------------------------------------------------------------- */',
    `const TARIFF_ACTIVATION_LABELS = ${activation};`,
    `const TARIFF_ACTIVATION_FALLBACK = ${fallback};`,
    `const TARIFF_TEXT_RU = ${textRu};`,
    `const TARIFF_SPEED_UNITS_RU = ${units};`,
    '/* --- END TARIFF WORDING --- */',
  ].join('\n');
}

function renderPopularBlock(popular) {
  return [
    '/* --- POPULAR COUNTRIES --------------------------------------------------',
    ' * GENERATED by seo/build-country-dictionary.mjs by PARSING index.html.',
    ' * These are the storefront\'s own tiles, in the storefront\'s own order —',
    ' * not a second opinion about what is popular. Reorder the tiles on the',
    ' * site and re-run the script; never edit this list by hand.',
    ' * --------------------------------------------------------------------- */',
    `const popularCountries=[${popular.map((p) => `'${p.code}'`).join(',')}];`,
    '/* --- END POPULAR COUNTRIES --- */',
  ].join('\n');
}

function main() {
  const check = process.argv.includes('--check');
  const block = renderBlock(buildDictionary());
  const popular = readPopularFromStorefront();
  const extras = [
    { re: LATIN_BLOCK_RE, block: renderLatinBlock(), label: 'COUNTRY LATIN' },
    { re: POPULAR_BLOCK_RE, block: renderPopularBlock(popular), label: 'POPULAR COUNTRIES' },
    { re: TARIFF_BLOCK_RE, block: renderTariffBlock(), label: 'TARIFF WORDING' },
    { re: EN_BLOCK_RE, block: renderEnBlock(buildDictionaryEn()), label: 'COUNTRY NAMES ENGLISH' },
  ];
  let stale = 0;

  for (const file of TARGETS) {
    const src = readFileSync(file, 'utf8');
    if (!BLOCK_RE.test(src)) {
      console.error(`no COUNTRY NAMES block in ${file} — add the markers first`);
      process.exit(2);
    }
    let next = src.replace(BLOCK_RE, block);

    if (file === APP_ONLY) {
      for (const extra of extras) {
        if (!extra.re.test(next)) {
          console.error(`no ${extra.label} block in ${file} — add the markers first`);
          process.exit(2);
        }
        next = next.replace(extra.re, extra.block);
      }
    }

    if (next === src) continue;
    stale += 1;
    if (check) console.error(`stale country dictionary: ${file}`);
    else { writeFileSync(file, next); console.log(`updated ${file}`); }
  }

  const size = Object.keys(buildDictionary()).length;
  if (check && stale) {
    console.error('run: node seo/build-country-dictionary.mjs');
    process.exit(1);
  }
  console.log(check ? `country dictionary up to date (${size} entries)` : `country dictionary: ${size} entries`);
}

// Compared as real paths, not as strings: this repository lives under a
// directory with spaces in its name, and `import.meta.url` percent-encodes them
// while argv[1] does not — so the usual `file://${argv[1]}` comparison is false
// here and the script would exit silently having done nothing.
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) main();
