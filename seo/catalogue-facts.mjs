// What a country page is allowed to claim about the catalogue.
//
// WHY THIS FILE EXISTS
//
//   Two different pieces of code decided what a country "has", and they
//   disagreed on 198 of 202 pages. The generator counted every package whose
//   coverage array named the country; the browser counted what it would actually
//   render — which is a much smaller set, because it drops Russia rows, global
//   rows, and it lifts every daily plan out into a block of its own.
//
//   The result was a page whose own hero contradicted its own tariff grid, on
//   the same screen: «Локальных тарифов: 7. Региональных: 11» printed above a
//   grid that renders 7 and 6. Refreshing the stale snapshot would have made
//   that worse, not better — it would have said 20 and 18.
//
//   So the derivation lives here, once, and both the generator and the validator
//   import it. A claim and the check on that claim cannot drift apart if they are
//   computed by the same function.
//
// THE PORT IS THE POINT
//
//   isRussia / isRestricted / isGlobal / isMultiCountry / coverageCodes / isDaily
//   below are ports of assets/country-tariffs.js and assets/daily-plan-copy.js.
//   They must match the browser's behaviour exactly — not approximately. A page
//   that claims what the grid does not show is the bug this file closes, and a
//   sloppy port re-opens it silently. seo/test-catalogue-sync.mjs pins them.
//
// OFFLINE, DELIBERATELY
//
//   Reads assets/catalog.json from disk and nothing else. No fetch, no API, no
//   network — so it can gate CI, and so a check can never fail because a
//   provider was slow. The bot refreshes that file six times a day.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const RESTRICTED_COUNTRY_CODES = ['RU', 'UA', 'BY'];

/** assets/country-tariffs.js — packageCoverageCodes(). RU/UA/BY stripped LAST. */
export function coverageCodes(item) {
  const codes = Array.isArray(item.coverage_country_codes)
    ? item.coverage_country_codes.map((c) => String(c || '').trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c))
    : [];
  const direct = String(item.country_code || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(direct) && !codes.includes(direct)) codes.unshift(direct);
  String(item.region || '')
    .toUpperCase()
    .split(/[\s,;/|+]+/)
    .map((c) => c.trim())
    .filter((c) => /^[A-Z]{2}$/.test(c))
    .forEach((c) => { if (!codes.includes(c)) codes.push(c); });
  return codes.filter((c) => !RESTRICTED_COUNTRY_CODES.includes(c));
}

/** assets/country-tariffs.js — isRussiaPackage(). */
export const isRussia = (i) => {
  const code = String(i.country_code || '').toUpperCase();
  const region = String(i.region || '').toUpperCase();
  const name = String(i.name || '').toLowerCase();
  return code === 'RU' || region.split(/[\s,;/|+]+/).includes('RU')
    || name.includes('россия') || name.includes('russia');
};

/** assets/country-tariffs.js — isRestrictedPackage(). */
export const isRestricted = (i) => {
  const code = String(i.country_code || '').trim().toUpperCase();
  if (RESTRICTED_COUNTRY_CODES.includes(code)) return true;
  const name = String(i.name || '').toLowerCase();
  return name.includes('russia') || name.includes('россия')
    || name.includes('ukraine') || name.includes('украина');
};

/** assets/country-tariffs.js — isPublicGlobalPackage(). */
export const isGlobal = (i) =>
  String(i.country_code || '').toUpperCase().startsWith('GL-')
  || String(i.name || '').toLowerCase().includes('global');

/** assets/country-tariffs.js — isMultiCountryPackage(). The name list is load-bearing. */
const REGIONAL_WORDS = [
  'europe', 'global', 'world', 'asia', 'balkans', 'caribbean', 'latin america', 'middle east',
  'unlimited', 'euconnect', 'europe and usa', 'greater china', 'china korea japan',
  'singapore malaysia and thailand', 'spain and portugal', 'greece cyprus turkey',
  'vietnam plus',
];
export const isMultiCountry = (i) => {
  const codes = Array.isArray(i.coverage_country_codes)
    ? i.coverage_country_codes.map((c) => String(c || '').trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c))
    : [];
  if (new Set(codes).size > 1) return true;
  const name = String(i.name || '').toLowerCase();
  return REGIONAL_WORDS.some((w) => name.includes(w));
};

/** assets/daily-plan-copy.js — isDaily(). */
export const isDaily = (p) => !!p && String(p.plan_type || '') === 'DAILY';

/**
 * The cheapest amount a customer can actually hand over for this package.
 *
 * NOT `price`. For a PER_DAY plan `price` is a PER-DAY RATE and buying one day
 * is not on offer: `sellable_days` starts at 3 everywhere in today's catalogue.
 * Advertising the rate is a bait price — «от 150 ₽» for something whose cheapest
 * real form costs 450 ₽. All 1298 PER_DAY packages differ on this; not one is a
 * coincidence.
 *
 * The 31 FIXED_TERM dailies carry no term_prices — the package IS the term — so
 * they fall back to `price`, which is what assets/country-tariffs.js:1006 does.
 *
 * Never reconstruct a term price as rate × days. The ladders are discounted and
 * 44 packages deviate by more than a third.
 */
export function purchasablePrice(p) {
  const terms = Array.isArray(p.term_prices) ? p.term_prices : [];
  const v = terms.map((t) => Number(t.price)).filter((n) => Number.isFinite(n) && n > 0);
  if (v.length) return Math.min(...v);
  const raw = Number(p.price);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export function loadCatalogue(file = join(ROOT, 'assets/catalog.json')) {
  const d = JSON.parse(readFileSync(file, 'utf8'));
  return Array.isArray(d.packages) ? d.packages : [];
}

/**
 * What /esim/<slug>/ may claim, derived the way the browser derives it.
 *
 * The order matters and mirrors renderCountrySplit(): drop the packages the page
 * will never show, THEN lift the dailies out, THEN split what is left into local
 * and regional. Counting before the lift is how the old numbers came to describe
 * a grid nobody renders.
 */
export function countryFacts(packages, iso) {
  const code = String(iso || '').trim().toUpperCase();
  const shown = packages
    .filter((p) => !isRussia(p) && !isRestricted(p) && Number(p.price) > 0)
    .filter((p) => coverageCodes(p).includes(code))
    .filter((p) => !isGlobal(p));

  const daily = shown.filter(isDaily);
  const volume = shown.filter((p) => !isDaily(p));
  const local = volume.filter((p) => !isMultiCountry(p));
  const regional = volume.filter((p) => isMultiCountry(p));

  const prices = shown.map(purchasablePrice).filter((n) => Number.isFinite(n) && n > 0);

  // Every number a page is allowed to print as a price, for the "does this
  // figure exist at all" check. Includes raw rates deliberately: a page quoting
  // one is wrong, but wrong in a different way than quoting an invented number.
  const allPrices = new Set(
    shown.flatMap((p) => [Number(p.price), ...(Array.isArray(p.term_prices) ? p.term_prices : []).map((t) => Number(t.price))])
      .filter((n) => Number.isFinite(n) && n > 0)
  );

  // Volume plans only. A daily plan's data_gb is 0 — its real allowance lives in
  // daily_gb and is a per-day figure, a different unit. Letting 0 into this list
  // is what a naive refresh would do, and 194 pages would have offered «тарифы
  // на 0 ГБ».
  const volumes = [...new Set(volume.map((p) => Number(p.data_gb)).filter((n) => Number.isFinite(n) && n > 0))]
    .sort((a, b) => a - b);

  // Per-day allowances, the daily block's own unit. Kept separate for the same
  // reason the renderer keeps the blocks separate.
  const dailyGb = [...new Set(daily.map((p) => Number(p.daily_gb)).filter((n) => Number.isFinite(n) && n > 0))]
    .sort((a, b) => a - b);

  return {
    iso: code,
    local_count: local.length,
    regional_count: regional.length,
    daily_count: daily.length,
    total_shown: shown.length,
    min_price_rub: prices.length ? Math.min(...prices) : null,
    volumes,
    daily_gb: dailyGb,
    all_prices: allPrices,
    // REGIONAL when nothing single-country is on offer; the page says so in as
    // many words rather than rendering an empty block.
    strategy: local.length > 0 ? 'LOCAL' : 'REGIONAL',
    // Nothing at all would render. Four pages are in this state today and each
    // is live, indexable and in the sitemap.
    renders_nothing: shown.length === 0,
  };
}
