#!/usr/bin/env node
/**
 * Builds seo/global-plan-facts.json — what the international (USD) catalogue offers per country, as FACTS ONLY: the
 * data volumes and validity terms of the local plans, the destinations the regional plans also cover, and the daily
 * allowances and terms. It is what the prefixed-language country pages print in their HTML (seo/build-locale-pages.mjs
 * «at a glance»), so a crawler that runs no script still reads what a page is about (international SEO audit,
 * 2026-10-27: the EN/ES country pages were 98 % one template, and the plans existed only after a script ran).
 *
 * NO PRICE, NO COUNT, NO IDENTIFIER. Prices stay in the browser, from the GLOBAL catalogue (seo/test-en-pages.mjs: «no
 * English page carries a price, a currency figure or a plan count in its HTML»). A volume or a term changes when a
 * provider changes a plan; a price changes with every pricing decision — only the first belongs in a static page.
 *
 * WHY THE USD CATALOGUE AND NOT assets/catalog.json. The RUB snapshot is the Russian market's layout; the USD market
 * has its own (GLOBAL visibility, its own assortment). Measured 2026-10-27: 98 of 203 countries lay out differently.
 *
 * WHERE FROM. The Render origin only — GLOBAL never goes through the Yandex gateway (CLAUDE.md, D1). One public GET,
 * the same answer the English pages read; no credential exists on this path.
 *
 * NEVER WORSE. Fetch → derive → validate → write a temp file → re-validate → swap. A fetch or validation failure
 * keeps the committed file and exits 0 with a warning: this runs inside «Refresh static catalog cache», and a GLOBAL
 * hiccup must not stop the Russian catalogue from refreshing. A content-identical result keeps the old file — and
 * its `updated` date — so nothing is committed.
 *
 * NEVER AGAINST A PUBLISHED SENTENCE (2026-10-27). Authored country texts (seo/content-<prefix>/*.json) pin their
 * sentences about the plan blocks to this snapshot (`plan_claims`), and the page build throws on a contradiction. A
 * new snapshot is therefore checked against every authored text BEFORE it is written (seo/content-facts-guard.mjs).
 * A country whose page a new fact contradicts is HELD: it keeps its previous entry and is listed in `held`
 * ({ ISO: { since } }, `since` carried over, so the file changes only when the held set does); every other country
 * publishes. The conflict goes to the job summary and a `::warning::`; `--check` repeats the held list on every run;
 * the SEO refresh PR body lists it. Whatever happens — a conflict, a guard that throws — the script exits 0, so the
 * Russian catalogue commit goes ahead; if holding is not enough, the whole previous file is kept.
 *
 *   node scripts/update-global-plan-facts.mjs           refresh from the live API
 *   node scripts/update-global-plan-facts.mjs --check   validate what is on disk
 */

import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'seo', 'global-plan-facts.json');
const TMP = join(ROOT, 'seo', '.global-plan-facts.json.tmp');
const API = process.env.GLOBAL_CATALOG_API || 'https://origin.magicesim.store';
const FETCH_TIMEOUT_MS = 30_000;
const ATTEMPTS = 3;
const BACKOFF_MS = [1000, 3000];

export const SCHEMA_VERSION = 1;
export const MIN_COUNTRIES = 100;
export const MIN_RATIO_OF_PREVIOUS = 0.7;
/** The places no page names as covered (coverageCodes on server and storefront leave them out). */
export const LEFT_OUT = Object.freeze(['RU', 'UA', 'BY']);
/** The «also covers» ranking is kept this long — the page prints at most 8 that have a page of their own
 *  (seo/build-locale-pages.mjs GLANCE_ALSO), and a few top codes may have none (KT, AN …). */
export const ALSO_KEPT = 24;

const ISO = /^[A-Z]{2}$/;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const uniqSorted = (xs) => [...new Set(xs)].sort((a, b) => a - b);

/** One country's facts from its layout ({ local, regional, daily: [id…] }) and the packages by id. */
export function factsFor(iso, layout, byId) {
  const pick = (ids) => (Array.isArray(ids) ? ids.map((id) => byId.get(id)).filter(Boolean) : []);
  const local = pick(layout.local).filter((p) => (num(p.data_gb) || 0) > 0 && (num(p.validity_days) || 0) > 0);
  const daily = pick(layout.daily).filter((p) => (num(p.daily_gb) || 0) > 0);
  const regional = pick(layout.regional);

  // «Also covers»: every destination a regional plan of this page covers, ranked by how many of them cover it, then
  // by code (deterministic). This country and the left-out three never appear.
  const tally = new Map();
  for (const p of regional) {
    for (const code of new Set((p.coverage_country_codes || []).filter((c) => ISO.test(c)))) {
      if (code === iso || LEFT_OUT.includes(code)) continue;
      tally.set(code, (tally.get(code) || 0) + 1);
    }
  }
  const also = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, ALSO_KEPT).map(([c]) => c);

  const dailyDays = [];
  for (const p of daily) {
    if (Array.isArray(p.sellable_days) && p.sellable_days.length) dailyDays.push(...p.sellable_days.filter((d) => Number.isInteger(d) && d > 0));
    else if (Number.isInteger(p.validity_days) && p.validity_days > 0) dailyDays.push(p.validity_days);
  }
  return {
    local: { gb: uniqSorted(local.map((p) => p.data_gb)), days: uniqSorted(local.map((p) => p.validity_days)) },
    also,
    daily: { gb_per_day: uniqSorted(daily.map((p) => p.daily_gb)), days: uniqSorted(dailyDays) },
  };
}

/** The whole document from one catalogue answer ({ data: [...], assortment: { countries } }). */
export function buildFacts(answer) {
  if (!answer || !Array.isArray(answer.data) || !answer.assortment || typeof answer.assortment.countries !== 'object') {
    throw new Error('the answer has no data array or no assortment layout');
  }
  if (answer.currency !== 'USD') throw new Error(`expected the USD catalogue, got currency ${answer.currency}`);
  const byId = new Map(answer.data.map((p) => [p.package_id, p]));
  const countries = {};
  for (const iso of Object.keys(answer.assortment.countries).sort()) {
    if (!ISO.test(iso) || LEFT_OUT.includes(iso)) continue;
    countries[iso] = factsFor(iso, answer.assortment.countries[iso] || {}, byId);
  }
  return { schema_version: SCHEMA_VERSION, source: 'production-public-api?market=global', countries };
}

/** Problems with a document; [] when valid. Shape only — and no field may look like money or an identifier. */
export function validateFacts(doc, { previousCountries = null } = {}) {
  const out = [];
  if (!doc || doc.schema_version !== SCHEMA_VERSION) out.push('schema_version');
  if (doc && doc.updated != null && !/^\d{4}-\d{2}-\d{2}$/.test(doc.updated)) out.push('updated is not YYYY-MM-DD');
  const text = JSON.stringify(doc || {});
  if (/price|cost|margin|amount|usd|rub|package_id|"name"/i.test(text.replace(/"source":"[^"]*"/, ''))) out.push('a price, an amount or an identifier reached the facts');
  const entries = Object.entries((doc && doc.countries) || {});
  if (entries.length < MIN_COUNTRIES) out.push(`only ${entries.length} countries (minimum ${MIN_COUNTRIES})`);
  if (previousCountries && entries.length < previousCountries * MIN_RATIO_OF_PREVIOUS) out.push(`${entries.length} countries against ${previousCountries} before`);
  const nums = (xs, int) => Array.isArray(xs) && xs.every((x) => typeof x === 'number' && x > 0 && (!int || Number.isInteger(x)))
    && xs.every((x, i) => i === 0 || xs[i - 1] < x);
  for (const [iso, f] of entries) {
    if (!ISO.test(iso) || LEFT_OUT.includes(iso)) { out.push(`${iso}: not a listed code`); continue; }
    if (!f || !f.local || !nums(f.local.gb) || !nums(f.local.days, true)) out.push(`${iso}: local`);
    if (!f || !f.daily || !nums(f.daily.gb_per_day) || !nums(f.daily.days, true)) out.push(`${iso}: daily`);
    if (!f || !Array.isArray(f.also) || f.also.length > ALSO_KEPT || f.also.some((c) => !ISO.test(c) || c === iso || LEFT_OUT.includes(c))) out.push(`${iso}: also`);
  }
  if (doc && doc.held != null) {
    if (typeof doc.held !== 'object' || Array.isArray(doc.held)) out.push('held is not an object');
    else for (const [iso, h] of Object.entries(doc.held)) {
      if (!ISO.test(iso) || LEFT_OUT.includes(iso) || !h || typeof h !== 'object' || Object.keys(h).join() !== 'since'
        || !/^\d{4}-\d{2}-\d{2}$/.test(h.since)) out.push(`held.${iso}: { since: YYYY-MM-DD }`);
    }
  }
  return out;
}

/** Everything but the date: two runs a day apart compare equal when the catalogue did not move (and the held set,
 *  with its `since` dates, did not change either). */
const fingerprint = (doc) => JSON.stringify({ schema_version: doc.schema_version, source: doc.source, countries: doc.countries, held: doc.held || null });

export function readExisting(file = OUT) {
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

async function fetchOnce(fetchImpl) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${API}/api/v1/retail/packages?market=global`, { signal: ac.signal, headers: { Accept: 'application/json' } });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(await res.text());
  } finally { clearTimeout(timer); }
}

export async function fetchAnswer({ fetchImpl = globalThis.fetch, log = console.error } = {}) {
  const failures = [];
  for (let i = 1; i <= ATTEMPTS; i += 1) {
    try { return await fetchOnce(fetchImpl); } catch (e) {
      failures.push(`#${i}: ${e.message}`);
      log(`  ✗ попытка ${i}/${ATTEMPTS}: ${e.message}`);
      if (i < ATTEMPTS) await new Promise((r) => setTimeout(r, BACKOFF_MS[i - 1]));
    }
  }
  throw new Error(`каталог USD недоступен (${failures.join('; ')})`);
}

const keep = (why) => {
  // A warning, not a failure: see «NEVER WORSE» above. The committed facts stay; the next run tries again.
  console.log(`::warning::global-plan-facts: ${why} — seo/global-plan-facts.json НЕ ТРОНУТ`);
  try { if (existsSync(TMP)) unlinkSync(TMP); } catch { /* nothing to do */ }
  return 0;
};

const summarise = (summaryFile, text) => {
  if (!summaryFile) return;
  try { appendFileSync(summaryFile, text); } catch { /* the annotation still carries it */ }
};

export async function runUpdate({ fetchImpl = globalThis.fetch, today = new Date().toISOString().slice(0, 10), file = OUT,
  validators = undefined, summaryFile = process.env.GITHUB_STEP_SUMMARY } = {}) {
  const previous = readExisting(file);
  const previousCountries = previous && previous.countries ? Object.keys(previous.countries).length : null;
  let doc;
  try { doc = buildFacts(await fetchAnswer({ fetchImpl })); } catch (e) { return keep(e.message); }
  if (previous && fingerprint(previous) === fingerprint(doc)) {
    console.log('  факты не изменились — файл оставлен как есть');
    return 0;
  }
  doc = { schema_version: doc.schema_version, updated: today, source: doc.source, countries: doc.countries };
  const errors = validateFacts(doc, { previousCountries });
  if (errors.length) return keep(`новые факты не прошли проверку: ${errors.slice(0, 5).join('; ')}`);
  // The authored content must still hold against the new facts. A country whose page a new fact contradicts keeps its
  // previous entry (held); every other country publishes. Everything below runs inside one guard: whatever throws,
  // the committed file stays and the script still exits 0 (the RU commit after this step must run).
  try {
    const guard = await import('../seo/content-facts-guard.mjs');
    const found = validators || await guard.contentValidators();
    const missing = guard.missingRequired(found);
    if (missing.length) {
      console.log(`::warning::global-plan-facts: no authored-content validator found for ${missing.join(', ')} — its plan_claims are NOT checked against the new facts`);
      summarise(summaryFile, `## ⚠️ global-plan-facts: no content validator for ${missing.join(', ')}\n\nExpected seo/content-<prefix>.mjs + seo/content-<prefix>/ — its sentences are not protected.\n`);
    }
    const conflicts = await guard.checkFactsAgainstContent(previous, doc, { validators: found });
    if (conflicts.length) {
      for (const c of conflicts) for (const p of c.problems) console.log(`  ✗ ${c.file}: ${p.problem}${p.quote ? ` — «${p.quote}»` : ''}`);
      const { doc: merged } = guard.holdConflicting(previous, doc, conflicts, today);
      const still = await guard.checkFactsAgainstContent(previous, merged, { validators: found });
      const mergedErrors = validateFacts(merged, { previousCountries });
      if (still.length || mergedErrors.length) {
        // Holding the conflicting countries was not enough (or broke the shape): keep the whole previous file.
        summarise(summaryFile, guard.conflictReport(conflicts, { previous, next: doc, today }));
        return keep(`${guard.conflictAnnotation(conflicts, { previous })}${mergedErrors.length ? ` (held merge invalid: ${mergedErrors[0]})` : ''}`);
      }
      summarise(summaryFile, guard.conflictReport(conflicts, { previous, next: doc, today, held: merged.held }));
      console.log(`::warning::global-plan-facts: ${guard.conflictAnnotation(conflicts, { previous, held: merged.held })}`);
      if (previous && fingerprint(previous) === fingerprint(merged)) {
        console.log('  кроме удержанных стран факты не изменились — файл оставлен как есть');
        return 0;
      }
      doc = merged;
    }
  } catch (e) {
    summarise(summaryFile, `## ⚠️ global-plan-facts: the authored-content check could not run — snapshot NOT published\n\n\`${String(e && e.message)}\`\n`);
    return keep(`проверка авторских текстов не выполнилась (${String(e && e.message)})`);
  }
  const tmp = file === OUT ? TMP : `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(doc, null, 1)}\n`, 'utf8');
  const back = JSON.parse(readFileSync(tmp, 'utf8'));
  const backErrors = validateFacts(back, { previousCountries });
  if (backErrors.length) return keep(`временный файл не прошёл проверку: ${backErrors[0]}`);
  renameSync(tmp, file);
  console.log(`✓ global-plan-facts: ${Object.keys(doc.countries).length} стран, обновлено ${today}${doc.held ? `, удержаны: ${Object.keys(doc.held).join(', ')}` : ''}`);
  return 0;
}

export function runCheck(file = OUT) {
  const doc = readExisting(file);
  if (!doc) { console.error('✗ seo/global-plan-facts.json отсутствует или не JSON'); return 1; }
  const errors = validateFacts(doc);
  if (errors.length) { console.error(`✗ невалиден: ${errors.slice(0, 10).join('; ')}`); return 1; }
  console.log(`✓ global-plan-facts: ${Object.keys(doc.countries).length} стран, обновлено ${doc.updated}`);
  // A held country is visible on every run (the SEO refresh PR body says it too — scripts/seo-refresh-summary.mjs).
  for (const [iso, h] of Object.entries(doc.held || {})) console.log(`::warning::global-plan-facts: facts held for ${iso} since ${h.since} — an authored sentence contradicts the live catalogue`);
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) process.exit(process.argv.includes('--check') ? runCheck() : await runUpdate());
