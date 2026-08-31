// The writer's only permitted source of facts.
//
// A person writing a country page needs more than the hub needs: not just "7
// local tariffs" but which volumes, for how many days, at what price, and
// whether the local ones are actually better than the regional ones. If the
// writer has to go looking for that, they will find it on a competitor's page
// and it will be wrong.
//
// So this builds a per-country sheet from the SAME API call the pages are
// built from, writes it next to the profiles, and the reviewer later checks
// every number in the prose against it. Anything not in the sheet is, by
// definition, invented.
//
//   node seo/fact-sheet.mjs                собрать по всему каталогу
//   node seo/fact-sheet.mjs thailand ...   показать конкретные

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRY_NAMES } from './country-names.mjs';
import { purchasablePrice, isRussia, isRestricted, isGlobal } from './catalogue-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SHEET = join(ROOT, 'seo/fact-sheets.json');
const API = process.env.CATALOG_API || 'https://origin.magicesim.store/api/v1/packages?limit=3000';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const iso2 = (c) => String(c || '').trim().toUpperCase();
const coverage = (p) => (Array.isArray(p.coverage_country_codes) ? p.coverage_country_codes : [])
  .map(iso2).filter((c) => /^[A-Z]{2}$/.test(c));

export async function buildFactSheets() {
  const res = await fetch(API, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`catalogue API ${res.status}`);
  const packages = (await res.json()).data || [];

  const byCountry = new Map();
  for (const p of packages) {
    const cov = coverage(p);
    // The PURCHASABLE price, not the raw field. For a PER_DAY plan
    // retail_price_rub is a per-day RATE and one day is not sold — the cheapest
    // term is three days. Building the sheet from rates made it disagree with
    // the pages: a description quoting the real daily floor was reported as
    // «факт вне каталога», because that floor could not exist in a sheet made of
    // rates. Same bug catalogue-source.mjs carried until 497f3de, same fix, same
    // shared helper — so the checker and the page now agree by construction.
    const retail = purchasablePrice(p);
    // And the same visibility rules the grid renders by, so the sheet cannot
    // bless a number no customer will ever be shown.
    if (isRussia(p) || isRestricted(p) || isGlobal(p)) continue;
    if (!cov.length || retail === null || retail <= 0) continue;
    const t = {
      data_gb: num(p.data_gb),
      validity_days: num(p.validity_days),
      price_rub: retail,
      unlimited: p.unlimited === true || /unlimited|безлим/i.test(p.name || ''),
      countries_covered: cov.length,
    };
    for (const c of cov) {
      if (!byCountry.has(c)) byCountry.set(c, { local: [], regional: [] });
      byCountry.get(c)[cov.length === 1 ? 'local' : 'regional'].push(t);
    }
  }

  const sheets = {};
  for (const [iso, e] of byCountry) {
    const meta = COUNTRY_NAMES[iso];
    if (!meta) continue;
    const all = [...e.local, ...e.regional];
    // The cheapest offer at each volume, which is what a reader is actually
    // choosing between. Local wins ties: it is the catalogue's own preference
    // and the page must not contradict it.
    const byVolume = new Map();
    for (const kind of ['local', 'regional']) {
      for (const t of e[kind]) {
        if (t.data_gb === null) continue;
        const cur = byVolume.get(t.data_gb);
        if (!cur || t.price_rub < cur.price_rub) byVolume.set(t.data_gb, { ...t, kind });
      }
    }
    const rows = [...byVolume.entries()].sort((a, b) => a[0] - b[0])
      .map(([gb, t]) => ({ data_gb: gb, price_rub: t.price_rub, validity_days: t.validity_days, kind: t.kind }));
    const days = all.map((t) => t.validity_days).filter((d) => d !== null);
    const prices = all.map((t) => t.price_rub);

    sheets[meta.slug] = {
      iso,
      name_ru: meta.ru,
      strategy: e.local.length ? 'LOCAL' : 'REGIONAL',
      local_count: e.local.length,
      regional_count: e.regional.length,
      total_count: all.length,
      min_price_rub: Math.min(...prices),
      max_price_rub: Math.max(...prices),
      validity_days_min: days.length ? Math.min(...days) : null,
      validity_days_max: days.length ? Math.max(...days) : null,
      volumes_gb: rows.map((r) => r.data_gb),
      has_unlimited: all.some((t) => t.unlimited),
      // How wide the regional plans reach — a fact a reader planning two
      // countries needs, and one nobody can guess.
      regional_reach_max: e.regional.length ? Math.max(...e.regional.map((t) => t.countries_covered)) : 0,
      offers: rows,
    };
  }
  return { fetched_at: new Date().toISOString(), source: API, countries: Object.keys(sheets).length, sheets };
}

export function loadSheets() {
  if (!existsSync(SHEET)) throw new Error('seo/fact-sheets.json отсутствует — запусти: node seo/fact-sheet.mjs');
  return JSON.parse(readFileSync(SHEET, 'utf8'));
}

// Only when this file is what node was pointed at — importing it must not
// re-fetch the catalogue.
if ((process.argv[1] || '').endsWith('fact-sheet.mjs')) {
  const args = process.argv.slice(2);
  const data = await buildFactSheets();
  writeFileSync(SHEET, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`seo/fact-sheets.json: ${data.countries} стран`);
  for (const slug of args) {
    const s = data.sheets[slug];
    if (!s) { console.log(`\n${slug}: нет в каталоге`); continue; }
    console.log(`\n── ${s.name_ru} (${s.iso}) ${s.strategy} — local ${s.local_count} / regional ${s.regional_count}`);
    console.log(`   ${s.min_price_rub}–${s.max_price_rub} ₽, срок ${s.validity_days_min}–${s.validity_days_max} дн., регион до ${s.regional_reach_max} стран`);
    for (const o of s.offers) console.log(`   ${String(o.data_gb).padStart(5)} ГБ  ${String(o.price_rub).padStart(6)} ₽  ${String(o.validity_days).padStart(3)} дн.  ${o.kind}`);
  }
}
