// The catalogue is the source of truth for which countries exist.
//
// Before this, the site's country list lived in seo/countries.mjs — twenty-one
// hand-written entries. The catalogue now covers two hundred, and a hand-kept
// list is guaranteed to disagree with it: a country added to the catalogue
// stays invisible, and a country dropped keeps a page that sells nothing.
//
// So the list is FETCHED. Once, into a JSON file the other generators read, so
// a build makes exactly one API call however many pages it writes.
//
// A country with no sellable tariff gets no page. That is the whole rule for
// what exists, and it means a page can never outlive the offer behind it.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRY_NAMES, flagEmoji } from './country-names.mjs';
import { countryFacts } from './catalogue-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = join(ROOT, 'seo/catalogue-countries.json');
const API = process.env.CATALOG_API || 'https://origin.magicesim.store/api/v1/packages?limit=3000';

// Codes the catalogue can carry but that must never become a page.
//
// AN — Netherlands Antilles, a country dissolved in 2010. Two Caribbean daily
// packages still list the deprecated code in their coverage, so it arrives here
// looking like any other destination and would quietly gain /esim/netherlands-
// antilles/ on the next build. It stays in COUNTRY_NAMES on purpose: the runtime
// needs the Russian name so a package's coverage list does not print a bare
// "AN" at a customer. Naming a place and selling a page about it are different
// decisions, and this is the line between them.
const NO_PAGE = new Set(['AN']);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** LOCAL is a package whose own coverage is one country. Never its name. */
const coverage = (p) => (Array.isArray(p.coverage_country_codes) ? p.coverage_country_codes : [])
  .map((c) => String(c || '').trim().toUpperCase())
  .filter((c) => /^[A-Z]{2}$/.test(c));

export async function fetchCatalogueCountries() {
  const res = await fetch(API, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`catalogue API ${res.status}`);
  const body = await res.json();
  const packages = Array.isArray(body.data) ? body.data : [];

  const byCountry = new Map();
  for (const p of packages) {
    const cov = coverage(p);
    if (cov.length === 0) continue;
    // A package with no price is not an offer, and a page built on one would
    // show a country as available and then have nothing to sell.
    const retail = num(p.retail_price_rub);
    if (retail === null || retail <= 0) continue;

    for (const iso of cov) {
      if (!byCountry.has(iso)) {
        byCountry.set(iso, { iso, local: [], regional: [] });
      }
      const entry = { data_gb: num(p.data_gb), validity_days: num(p.validity_days), retail_price_rub: retail };
      byCountry.get(iso)[cov.length === 1 ? 'local' : 'regional'].push(entry);
    }
  }

  // EVERY number below comes from seo/catalogue-facts.mjs, which derives them
  // the way assets/country-tariffs.js does — not the way this file used to.
  //
  // What used to be here counted each package whose coverage array named the
  // country, and priced the country off the raw `retail_price_rub`. Both were
  // wrong, and wrong in ways that reached customers:
  //
  //   * the count included Russia rows, global rows and daily plans, none of
  //     which the grid puts in the local/regional blocks. 198 of 202 pages
  //     printed a hero that contradicted the grid underneath it;
  //   * the price took a PER_DAY rate as if it were purchasable. One day is not
  //     sold; the cheapest term is three. A refresh with the old rule would have
  //     advertised a bait price on 194 of 203 countries.
  //
  // Keep the derivation in ONE place. Two implementations of "what does this
  // country have" is exactly what produced the contradiction.
  const countries = [];
  const unnamed = [];
  for (const iso of [...byCountry.keys()].sort()) {
    if (NO_PAGE.has(iso)) continue;
    const meta = COUNTRY_NAMES[iso];
    if (!meta) { unnamed.push(iso); continue; }
    const f = countryFacts(packages, iso);
    countries.push({
      iso,
      slug: meta.slug,
      nameRu: meta.ru,
      flagEmoji: flagEmoji(iso),
      local_count: f.local_count,
      regional_count: f.regional_count,
      // Daily plans are counted, and counted SEPARATELY. They are half the
      // catalogue and the page renders them in a block of their own with its
      // own counter — folding them into local/regional would put a number in
      // the hero that disagrees with the number directly below it.
      daily_count: f.daily_count,
      total_count: f.total_shown,
      // The cheapest amount a customer can actually pay — min over term prices
      // for a daily plan, never the per-day rate. Null when the page would
      // render nothing at all, which is true of four countries today.
      min_price_rub: f.min_price_rub,
      volumes: f.volumes,
      // Per-day allowances, kept apart from `volumes` because «1 ГБ в день» and
      // «1 ГБ всего» are not two values of one quantity.
      daily_gb: f.daily_gb,
      strategy: f.strategy,
      renders_nothing: f.renders_nothing,
    });
  }
  countries.sort((a, b) => a.nameRu.localeCompare(b.nameRu, 'ru'));

  return { countries, unnamed: unnamed.sort(), fetched_at: new Date().toISOString(), source: API };
}

export function loadCached() {
  if (!existsSync(CACHE)) {
    throw new Error('seo/catalogue-countries.json is missing — run: node seo/fetch-catalogue.mjs');
  }
  return JSON.parse(readFileSync(CACHE, 'utf8'));
}

export function writeCache(data) {
  writeFileSync(CACHE, `${JSON.stringify(data, null, 2)}\n`);
}
