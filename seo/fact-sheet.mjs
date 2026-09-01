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
import { purchasablePrice, isRussia, isRestricted, isGlobal, isDaily, RESTRICTED_COUNTRY_CODES, loadCatalogue } from './catalogue-facts.mjs';

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
  // FROM THE COMMITTED SNAPSHOT, not the live API.
  //
  //   This file used to fetch, on the reasoning that the sheet should describe
  //   «the SAME API call the pages are built from». That stopped being true: the
  //   pages render from assets/catalog.json (refreshed by a bot and committed),
  //   catalogue-facts.mjs reads that file, and every gate and test compares
  //   against it. Fetching made the sheet describe a THIRD catalogue — on
  //   2026-09-01 a sheet built at 11:35 blessed an Egyptian price of 1250 ₽ that
  //   does not exist in the 05:19 snapshot the pages and the tests use, and
  //   test-fact-floor caught it.
  //
  //   A gate has to describe the catalogue the pages describe. Same file, same
  //   loader, no third opinion. CATALOG_API is kept only so a deliberate
  //   experiment can still point elsewhere.
  const packages = process.env.CATALOG_API
    ? ((await (await fetch(API, { signal: AbortSignal.timeout(120000) })).json()).data || [])
    : loadCatalogue();

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
      topup: p.topup_available === true ? 'yes' : p.topup_available === false ? 'no' : null,
      speed: String(p.speed || '').trim(),
      networks: (Array.isArray(p.networks) ? p.networks : []).map((x) => String(x && x.operator || '').trim()).filter(Boolean),
      fup: String(p.fup_policy || '').trim(),
      activation: String(p.activation_policy || '').trim().toLowerCase(),
      activation_label: activationLabel(p.activation_policy),
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
    const dailies = all.filter((t) => t.daily);
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
        // The three fields a page can read wrong while every price it quotes is
        // right. Each cost a rewrite on 2026-09-01: a Kazakhstan page said «не за
        // скорость» about two families that differ 3G/4G vs 3G/4G/5G; a Taiwan
        // page recommended installing before departure a package whose validity
        // starts at installation; a Georgia page called a 512 Kbps plan «без
        // оговорок» while comparing it to a 1 Mbps one — it had read the package
        // NAME instead of the field. Now a page may only name a value that some
        // package of that country actually carries.
        speeds: [...new Set(all.map((t) => t.speed).filter(Boolean))].sort(),
        // Operator names a page may print. `networks` is filled on a minority of
        // rows, and country-tariffs.js prints at most TWO of them — so «три сети»
        // was unprintable even where three exist. The Israel page said it anyway.
        networks: [...new Set(all.flatMap((t) => t.networks))].sort(),
        networks_rows: all.filter((t) => t.networks.length).length,
        rows_total: all.length,
        fup_policies: [...new Set(all.map((t) => t.fup).filter(Boolean))].sort(),
        activation_policies: [...new Set(all.map((t) => t.activation).filter(Boolean))].sort(),
        // What the CARD prints, which is what a page may repeat. A raw policy is
        // not enough: «unknown» is the commonest value in the catalogue and the
        // renderer maps it to the fallback «с первого подключения к сети», so a
        // gate that knew only the raw values called a true sentence invented.
        // Ported from TARIFF_ACTIVATION_LABELS in assets/country-tariffs.js.
        activation_labels: [...new Set(all.map((t) => t.activation_label))].sort(),
        // Per-package, because pages made opposite categorical claims about it.
        topup_yes: all.filter((t) => t.topup === 'yes').length,
        topup_no: all.filter((t) => t.topup === 'no').length,
        // ALL, not SOME. As `some` this licensed a claim about every daily plan
        // in a country from a single confirming package: Oman's nightly reset is
        // confirmed only for its four FIXED_TERM «Unlimited N Days» rows, and the
        // page said «лимит обновляется каждые сутки» about the six PER_DAY ones.
        // A blanket claim needs blanket evidence.
        daily_reset_confirmed: dailies.length > 0 && dailies.every((t) => t.reset_confirmed),
        daily_reset_partial: dailies.some((t) => t.reset_confirmed) && !dailies.every((t) => t.reset_confirmed),
        daily_throttle_continues: dailies.length > 0 && dailies.every((t) => t.throttle_continues),
        min_volume_price_rub: floorOf(all.filter((t) => !t.daily)),
        min_daily_price_rub: floorOf(all.filter((t) => t.daily)),
    };
  }
  return { fetched_at: new Date().toISOString(), source: process.env.CATALOG_API ? API : 'assets/catalog.json', countries: Object.keys(sheets).length, sheets };
}

// Port of TARIFF_ACTIVATION_LABELS / TARIFF_ACTIVATION_FALLBACK in
// assets/country-tariffs.js. Kept a port rather than a second opinion, for the
// same reason catalogue-facts.mjs is one (§21): two notions of the same fact
// drift, and the page must be checked against what the customer is shown.
const ACTIVATION_LABELS = {
  first_data_usage: 'с первого использования интернета',
  first_network_connection: 'с первого подключения к сети',
  network_connection: 'с первого подключения к сети',
  upon_installation: 'после установки eSIM',
  installation: 'после установки eSIM',
  upon_purchase: 'после покупки',
  purchase: 'после покупки',
};
const ACTIVATION_FALLBACK = 'с первого подключения к сети';
function activationLabel(policy) {
  const k = String(policy || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ACTIVATION_LABELS, k) ? ACTIVATION_LABELS[k] : ACTIVATION_FALLBACK;
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
