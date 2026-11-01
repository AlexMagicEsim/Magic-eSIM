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
import { isUncounted } from './coverage-only-territories.mjs';
import { publishedBlocks } from './plan-ref.mjs';

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
  // An uncounted territory (Northern Cyprus) does not make a plan multi-country:
  // «Turkey Premium» covering TR + KT is a Turkish plan (seo/coverage-only-territories.mjs).
  if (new Set(codes.filter((c) => !isUncounted(c))).size > 1) return true;
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
 * real form costs 450 ₽.
 *
 * THIS SENTENCE USED TO END «All 1298 PER_DAY packages differ on this; not one
 * is a coincidence», and on 2026-09-18 the provider disproved it. «Israel
 * 500MB/Day» kept its 450 ₽/day rate while its 3-day rung fell 1200 → 450, so
 * the rate and the cheapest purchasable price became the SAME NUMBER — one
 * package of 1293. Nothing about this function was wrong; what was wrong was a
 * gate that had encoded «the two numbers differ» as if it were an invariant.
 * The number they carry is a coincidence and may collide again; what never
 * changes is where the answer comes from — the ladder when there is one.
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

/** The whole snapshot — packages AND the backend's published layout — for countryFacts / countryOffers. */
export function loadCatalogueDoc(file = join(ROOT, 'assets/catalog.json')) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * The cards /esim/<iso>/ shows, by block — the backend's PUBLISHED layout
 * (assets/catalog.json `assortment.countries`, seo/plan-ref.mjs), exactly what
 * assets/country-tariffs.js draws (through assets/assortment-view.js).
 *
 * WHY (2026-11-01). countryFacts used to rebuild the page from coverage codes:
 * every visible package whose coverage named the country. Since the backend
 * decides the assortment (R1–R5, the regional cap of 8, the cheaper purchase
 * among look-alikes) that view is not the page: on 175 of 199 pages a generated
 * number disagreed with the grid — Seychelles' FAQ said «региональных … 9»
 * above five regional cards, Italy's description 42 regional plans above eight.
 * The numbers a page prints now count the cards it shows, and nothing else.
 *
 * A package list (no layout) is refused: there is no second way to say what a
 * page shows.
 */
export function shownBlocks(doc, iso) {
  if (!doc || Array.isArray(doc) || !doc.assortment) throw new Error('countryFacts / countryOffers: нужен снимок каталога с раскладкой assortment.countries (assets/catalog.json), а не список пакетов');
  return publishedBlocks(doc, String(iso || '').trim().toUpperCase()) || { local: [], regional: [], daily: [] };
}

/**
 * Whether /esim/<iso>/ exists at all — the storefront's page rule, NOT a count:
 * a country with a visible package that names it (Russia rows, RU/UA/BY and
 * worldwide plans dropped). Kept as it was, so the set of URLs does not move;
 * five countries the layout fills only with worldwide cards (AN, KT, LS, NC, TG
 * on 2026-11-01) have no page — an owner decision, not this file's.
 */
export function hasCountryPage(packages, iso) {
  const code = String(iso || '').trim().toUpperCase();
  return packages.some((p) => !isRussia(p) && !isRestricted(p) && Number(p.price) > 0 && coverageCodes(p).includes(code) && !isGlobal(p));
}

/**
 * What /esim/<slug>/ may claim about its assortment: counts, floor, volumes and
 * per-day allowances — of the cards the page shows (shownBlocks), block by block.
 * Daily cards are their own block, never folded into local / regional.
 */
export function countryFacts(doc, iso) {
  const code = String(iso || '').trim().toUpperCase();
  const b = shownBlocks(doc, code);
  const daily = b.daily;
  const local = b.local;
  const regional = b.regional;
  const volume = [...local, ...regional];
  const shown = [...local, ...regional, ...daily];

  const prices = shown.map(purchasablePrice).filter((n) => Number.isFinite(n) && n > 0);

  // Every number a page is allowed to print as a price, for the "does this
  // figure exist at all" check. Includes raw rates deliberately: a page quoting
  // one is wrong, but wrong in a different way than quoting an invented number.
  const allPrices = new Set(
    shown.flatMap((p) => [Number(p.price), ...(Array.isArray(p.term_prices) ? p.term_prices : []).map((t) => Number(t.price))])
      .filter((n) => Number.isFinite(n) && n > 0)
  );

  // Volume plans only. A daily plan's data_gb is 0 — its real allowance lives in
  // daily_gb and is a per-day figure, a different unit.
  const volumes = [...new Set(volume.map((p) => Number(p.data_gb)).filter((n) => Number.isFinite(n) && n > 0))]
    .sort((a, b) => a - b);
  // Per-day allowances, the daily block's own unit.
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
    // REGIONAL when nothing single-country is on offer.
    strategy: local.length > 0 ? 'LOCAL' : 'REGIONAL',
    renders_nothing: shown.length === 0,
  };
}

/**
 * The offers a country page shows, as rows — for the static price block of the
 * SEO-pilot pages (seo/build-catalogue-pages.mjs) and its Product/AggregateOffer.
 *
 * SAME BLOCKS as countryFacts(), on purpose: the cards the page shows
 * (shownBlocks — the published layout). The counts this returns
 * are asserted equal to countryFacts() by the caller, so the static block can
 * never describe a different set than the hero and the live grid do.
 *
 * Every price is purchasablePrice() — the lowest amount the customer can actually
 * pay for that package — never a per-day rate. No second source: the rows come
 * from assets/catalog.json's layout, the same cards every other number on the page counts.
 */
export function countryOffers(doc, iso) {
  const b = shownBlocks(doc, iso);
  const daily = b.daily;
  const local = b.local;
  const regional = b.regional;
  const shown = [...local, ...regional, ...daily];
  const range = (list) => {
    const v = list.map(purchasablePrice).filter((n) => Number.isFinite(n) && n > 0);
    return { count: list.length, min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null };
  };
  const localRows = local
    .map((p) => ({ gb: Number(p.data_gb), days: Number(p.validity_days), price: purchasablePrice(p) }))
    .filter((r) => Number.isFinite(r.price) && r.price > 0)
    .sort((a, b) => a.gb - b.gb || a.days - b.days || a.price - b.price);
  return { local: localRows, localRange: range(local), regional: range(regional), daily: range(daily), all: range(shown) };
}
