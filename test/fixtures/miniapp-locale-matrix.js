'use strict';

// The Mini App's language-dependent output, as one fingerprint per function.
//
// I18N-04 rewrote every «ru or en» branch in app/core.js into a lookup over a
// fallback chain. This walks each language-taking function over a fixed matrix
// — every server error code, every country code, a frozen catalogue sample,
// every provider phrase the tariff tables know — in Russian, English and the
// languages nobody speaks, and hashes what comes out. The fixture next to this
// file holds the hashes the code produced BEFORE the rewrite (storefront
// b33b77e6); app/core.test.js asserts the code produces them still.
//
// A hash, not the outputs: the outputs are megabytes, and the question is only
// «did a single character move». When one does, `describe()` names the function.

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const LANGS = ['ru', 'en', 'xx', undefined, null];
const NOW = Date.parse('2026-10-13T12:00:00Z');
const AGO = [null, '', 'not a date', '2026-10-13T12:05:00Z', '2026-10-13T11:59:30Z', '2026-10-13T11:59:00Z',
  '2026-10-13T11:58:00Z', '2026-10-13T11:55:00Z', '2026-10-13T11:39:00Z', '2026-10-13T11:00:00Z',
  '2026-10-13T10:00:00Z', '2026-10-13T07:00:00Z', '2026-10-12T12:00:00Z', '2026-10-11T12:00:00Z',
  '2026-10-08T12:00:00Z', '2026-09-23T12:00:00Z', '2026-07-01T12:00:00Z'];

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value, (k, v) => (v instanceof Map ? [...v] : v))).digest('hex');
}

function fingerprint(C) {
  // A FROZEN sample of the catalogue (miniapp-locale-catalogue.json), not the
  // live assets/catalog.json: the catalogue bot rewrites that file several times
  // a day, and a fingerprint over moving data would go red on every refresh.
  const { packages } = JSON.parse(readFileSync(join(__dirname, 'miniapp-locale-catalogue.json'), 'utf8'));
  if (packages.length < 500) throw new Error(`catalogue sample too small: ${packages.length}`);

  const codes = [...Object.keys(C.countryNames), ...Object.keys(C.countryNamesEn), 'ZZ', '', 'eu-39'];
  const errorCodes = [...Object.keys(C.SERVER_ERRORS), 'WIDGET_EXPLODED', '', null];
  const phrases = [
    ...Object.keys(C.TARIFF_TEXT_EN),
    'Speed reduced to 512 kbps', 'Speed reduced to 1 Mbps', '128kbps', '256 Kbps', '1Mbps', 'unknown provider phrase',
    'Скорость снижается', '', null,
  ];
  const daily = packages.filter((p) => String(p.plan_type || '') === 'DAILY');
  const byCode = new Map();
  for (const p of packages) {
    const k = String(p.country_code || '');
    if (!byCode.has(k)) byCode.set(k, []);
    byCode.get(k).push(p);
  }

  const out = {};
  const each = (name, fn) => { out[name] = digest(LANGS.map((lang) => fn(lang))); };

  each('errorText', (lang) => errorCodes.map((c) => C.errorText(c, lang)));
  each('countryLabel', (lang) => codes.map((c) => C.countryLabel(c, lang)));
  each('regionLabel', (lang) => packages.map((p) => C.regionLabel(p, lang)));
  each('coverageSummary', (lang) => packages.map((p) => C.coverageSummary(p, lang)));
  each('destinationTitle', (lang) => packages.map((p) => C.destinationTitle(p.name, p.country_code, p, lang)));
  each('tariffFacts', (lang) => packages.map((p) => C.tariffFacts(p, lang)));
  each('tariffText', (lang) => phrases.map((s) => C.tariffText(s, lang)));
  each('tariffActivation', (lang) => packages.map((p) => C.tariffActivation(p, lang)));
  each('tariffHotspot', (lang) => packages.map((p) => C.tariffHotspot(p, lang)));
  each('tariffIpLabel', (lang) => packages.map((p) => C.tariffIpLabel(p, lang)));
  each('syncedAgo', (lang) => AGO.map((iso) => C.syncedAgo(iso, NOW, lang)));
  // The catalogue is grouped FROM THE BACKEND'S LAYOUT since 2026-10-25 (the sample laid out as the backend lays out
  // an unfiltered list, test/helpers/assortment-layout.cjs); `byCountry`, the Mini App's own grouping, is gone.
  const MA = require('../../assets/assortment-view.js');
  const laid = MA.attach(packages.slice(), require('../helpers/assortment-layout.cjs').layoutOf(packages));
  each('groupCatalogue', (lang) => C.groupCatalogue(laid, lang));
  each('dailyDistinguishers', (lang) => [...byCode.values()].map((list) => C.dailyDistinguishers(list, lang)));
  out.tariffTextRu = digest(phrases.map((s) => C.tariffTextRu(s)));
  out.counts = digest([0, 1, 2, 3, 4, 5, 11, 12, 21, 22, 25, 101, 111].map((n) => [
    C.tariffWord(n), C.countryWord(n), C.tariffWordEn(n), C.countryWordEn(n),
    C.plural(n, 'a', 'b', 'c'), C.pluralEn(n, 'a', 'b'),
  ]));
  out.dailyCount = daily.length;
  return out;
}

module.exports = { fingerprint, digest };
