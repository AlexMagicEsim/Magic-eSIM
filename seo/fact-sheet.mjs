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
import { purchasablePrice, isRussia, isRestricted, isGlobal, isDaily, RESTRICTED_COUNTRY_CODES } from './catalogue-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SHEET = join(ROOT, 'seo/fact-sheets.json');
const API = process.env.CATALOG_API || 'https://origin.magicesim.store/api/v1/packages?limit=3000';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const iso2 = (c) => String(c || '').trim().toUpperCase();
// The same codes the renderer strikes out. Without this the sheet published a
// full справка for Ukraine — 17 tariffs, from 450 ₽ — for a country whose grid
// renders nothing and whose page was deleted in 35b31d3. The file's own comment
// promises «the same visibility rules the grid renders by»; for exactly three
// codes it was not true.
const coverage = (p) => (Array.isArray(p.coverage_country_codes) ? p.coverage_country_codes : [])
  .map(iso2).filter((c) => /^[A-Z]{2}$/.test(c))
  .filter((c) => !RESTRICTED_COUNTRY_CODES.includes(c));

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
    // Every rung of a term ladder is a real purchase, and the sheet has to know
    // all of them. `offers` deliberately keeps ONE price per volume — the
    // cheapest — which is right for "what does 5 ГБ cost here". But a DAILY plan
    // has data_gb = 0, so every daily in a country collapses into that single
    // bucket: of 1345 daily packages the sheet could vouch for exactly one price
    // per country. A page comparing two daily plans — the most natural thing to
    // write about a country whose grid is mostly daily — had every figure but
    // one reported as invented.
    const ladder = (Array.isArray(p.term_prices) ? p.term_prices : [])
      .map((x) => Number(x.price)).filter((v) => Number.isFinite(v) && v > 0);
    const t = {
      data_gb: num(p.data_gb),
      validity_days: num(p.validity_days),
      price_rub: retail,
      purchasable_prices: ladder.length ? ladder : [retail],
      daily_gb: Number(p.daily_gb) > 0 ? Number(p.daily_gb) : null,
      reset_confirmed: p.daily_reset_confirmed === true,
      throttle_continues: p.daily_throttle_continues === true,
      term_days: (Array.isArray(p.term_prices) ? p.term_prices : [])
        .map((x) => Number(x.days)).filter((v) => Number.isFinite(v) && v > 0),
      daily: isDaily(p),
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
        // Every price a customer of this country can actually pay, ladder rungs
        // included. Widening the reviewer to this set does not weaken it — an
        // invented number is still rejected — and it is paired with the «от N ₽»
        // rule, which this file's header had always claimed and the checker had
        // never actually had.
        all_purchasable_prices: [...new Set(all.flatMap((t) => t.purchasable_prices))].sort((a, b) => a - b),
        // The three floors a sentence may legitimately say «от N ₽» about. A
        // page writing «объёмы от 450 ₽, дневные — от 350 ₽» is being MORE
        // precise than one quoting a single number, and a rule that demanded the
        // country floor everywhere would have punished exactly that.
        // The terms a daily plan is actually sold in. Without them a page could
        // not write «минимальный срок покупки — три дня» — the one sentence the
        // pricing rules REQUIRE, since a PER_DAY rate is not the price of one
        // day — because 3 was not a number the checker had ever heard of.
        term_days: [...new Set(all.flatMap((t) => t.term_days))].sort((a, b) => a - b),
        // Per-day allowances. `volumes_gb` is the volume plans' ladder and a
        // DAILY plan's data_gb is 0, so «1 ГБ в день» — a phrase any page about
        // a mostly-daily country has to write — read as a figure from nowhere.
        // Kept separate from volumes because it is a different unit, exactly as
        // catalogue-facts.mjs keeps them apart for the renderer.
        daily_gb: [...new Set(all.map((t) => t.daily_gb).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b),
        // What a page is allowed to SAY about how a daily plan behaves. Of 1329
        // daily packages only 22 confirm a reset and 31 confirm the traffic
        // keeps flowing after the throttle — the provider simply does not
        // publish it for the rest. assets/daily-plan-copy.js is built entirely
        // around not completing that sentence; a country page must not complete
        // it either, and prose is where the discipline kept slipping.
        daily_reset_confirmed: all.some((t) => t.reset_confirmed),
        daily_throttle_continues: all.some((t) => t.throttle_continues),
        min_volume_price_rub: floorOf(all.filter((t) => !t.daily)),
        min_daily_price_rub: floorOf(all.filter((t) => t.daily)),
    };
  }
  return { fetched_at: new Date().toISOString(), source: API, countries: Object.keys(sheets).length, sheets };
}

function floorOf(rows) {
  const v = rows.flatMap((t) => t.purchasable_prices).filter((n) => Number.isFinite(n) && n > 0);
  return v.length ? Math.min(...v) : null;
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
