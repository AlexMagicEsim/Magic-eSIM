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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = join(ROOT, 'seo/catalogue-countries.json');
const API = process.env.CATALOG_API || 'https://origin.magicesim.store/api/v1/packages?limit=3000';

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

  const countries = [];
  const unnamed = [];
  for (const [iso, e] of byCountry) {
    const meta = COUNTRY_NAMES[iso];
    if (!meta) { unnamed.push(iso); continue; }
    const all = [...e.local, ...e.regional];
    const prices = all.map((x) => x.retail_price_rub).filter((x) => x !== null);
    const volumes = [...new Set(all.map((x) => x.data_gb).filter((x) => x !== null))].sort((a, b) => a - b);
    countries.push({
      iso,
      slug: meta.slug,
      nameRu: meta.ru,
      flagEmoji: flagEmoji(iso),
      local_count: e.local.length,
      regional_count: e.regional.length,
      total_count: all.length,
      // "от N ₽" on the hub. Null when nothing has a price, which cannot
      // happen here but is stated rather than defaulted to zero.
      min_price_rub: prices.length ? Math.min(...prices) : null,
      volumes,
      // LOCAL when the country has at least one single-country tariff, and the
      // page leads with them. REGIONAL when it does not — the page says so in
      // as many words rather than showing an empty block.
      strategy: e.local.length > 0 ? 'LOCAL' : 'REGIONAL',
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
