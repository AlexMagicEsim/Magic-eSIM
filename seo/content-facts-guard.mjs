/* AUTHORED CONTENT AGAINST A NEW PLAN-FACTS SNAPSHOT — the guard «Refresh static catalog cache» runs before it writes
 * seo/global-plan-facts.json (CI/SEO reliability, 2026-10-27).
 *
 * WHY. The catalogue bot refreshes the USD facts snapshot and pushes it to main with GITHUB_TOKEN, which starts no CI.
 * Authored country texts (seo/content-<prefix>/<slug>.json) pin every sentence about the plan blocks to that snapshot
 * through `plan_claims`, and seo/build-locale-pages.mjs THROWS on a claim the snapshot contradicts. Before this guard a
 * provider moving one plan published a snapshot that falsified a live sentence; main's `npm test` went red unseen and
 * the next SEO refresh died on the build — blocking the Russian page refresh too.
 *
 * WHAT IT DOES. checkFactsAgainstContent(previousDoc, nextDoc) runs every authored-content validator it finds against
 * the NEXT snapshot and keeps only the problems the next snapshot CAUSES (problems under the next facts minus problems
 * under the previous facts, per file) — so a defect that has nothing to do with the facts (a broken link, a date) is
 * not blamed on the catalogue, and is caught where it always was: the build and `npm test`.
 * scripts/update-global-plan-facts.mjs then HOLDS each conflicting country at its previous entry (holdConflicting,
 * recorded in the file's `held`) and publishes the rest, so the HTML never prints a fact a sentence on the same page
 * contradicts, and the report repeats on every run until a person rewrites the sentence (or the provider moves back).
 *
 * LANGUAGE-AGNOSTIC. A content validator is discovered per published prefixed language: `seo/content-<prefix>.mjs`
 * next to a folder `seo/content-<prefix>/`. The module contract is the one seo/content-en.mjs already has:
 *   contentSlugs(dir) → slugs        loadContent(slug, dir) → doc | null
 *   validateContent(doc, { facts, file, exists }) → problem strings ([] = passes)
 *   optional CONTENT_DIR (defaults to seo/content-<prefix>/).
 * A language whose content lives elsewhere (one shared module for several languages, say) adds its entry in
 * contentValidators() — nothing else in this file or in the update script needs to know.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LOCALES } from './locales.mjs';

const SEO = dirname(fileURLToPath(import.meta.url));

/** Every authored-content validator present in the tree: [{ lang, prefix, dir, folder, mod }]. */
export async function contentValidators({ seoDir = SEO } = {}) {
  const out = [];
  for (const L of LOCALES) {
    if (!L.prefix) continue; // RU pages have their own guards (coverage_claims, price_claims) — never this one
    const modFile = join(seoDir, `content-${L.prefix}.mjs`);
    const folder = `seo/content-${L.prefix}`;
    if (!existsSync(modFile)) continue;
    const mod = await import(pathToFileURL(modFile).href);
    if (typeof mod.contentSlugs !== 'function' || typeof mod.loadContent !== 'function' || typeof mod.validateContent !== 'function') {
      throw new Error(`${modFile}: a content validator exports contentSlugs, loadContent and validateContent`);
    }
    const dir = mod.CONTENT_DIR || join(seoDir, `content-${L.prefix}`);
    if (!existsSync(dir)) continue;
    out.push({ lang: L.code, prefix: L.prefix, dir, folder, mod });
  }
  return out;
}

/* Never trust a document's shape here: a malformed previous entry or a validator returning a non-string must not
 * throw on the way to a report (the caller would exit 1 and the RU commit after it would not run). */
const arr = (x) => (Array.isArray(x) ? x : []);
const asText = (x) => { try { return typeof x === 'string' ? x : JSON.stringify(x) ?? String(x); } catch { return '(unprintable problem)'; } };
const LIST_FIELDS = Object.freeze([['local.gb', (f) => f?.local?.gb], ['local.days', (f) => f?.local?.days], ['also', (f) => f?.also],
  ['daily.gb_per_day', (f) => f?.daily?.gb_per_day], ['daily.days', (f) => f?.daily?.days]]);

/** What moved per country between two snapshots: { ISO: { field: { removed: [...], added: [...] } } }. */
export function factsDiff(prev, next) {
  const a = (prev && typeof prev.countries === 'object' && prev.countries) || {};
  const b = (next && typeof next.countries === 'object' && next.countries) || {};
  const out = {};
  for (const iso of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const moved = {};
    for (const [name, get] of LIST_FIELDS) {
      const x = arr(get(a[iso]));
      const y = arr(get(b[iso]));
      const removed = x.filter((v) => !y.includes(v));
      const added = y.filter((v) => !x.includes(v));
      if (removed.length || added.length) moved[name] = { removed, added };
    }
    if (!(iso in a)) moved.country = { removed: [], added: ['(new in the snapshot)'] };
    if (!(iso in b)) moved.country = { removed: ['(gone from the snapshot)'], added: [] };
    if (Object.keys(moved).length) out[iso] = moved;
  }
  return out;
}

/**
 * The conflicts a NEXT snapshot causes in the authored content: [{ lang, file, slug, iso, problems: [{ problem, quote }] }].
 * `previous` may be null (no committed snapshot): then every plan-claim problem counts.
 * Throws only when a validator itself cannot run — the caller treats that as «not confirmed» and keeps the old file.
 */
export async function checkFactsAgainstContent(previous, next, { validators } = {}) {
  const list = validators || await contentValidators();
  const conflicts = [];
  for (const v of list) {
    for (const slug of v.mod.contentSlugs(v.dir)) {
      const doc = v.mod.loadContent(slug, v.dir);
      if (!doc) continue;
      const run = (facts) => v.mod.validateContent(doc, { facts, file: slug, exists: () => true });
      const after = run(next);
      if (!after.length) continue;
      const before = new Set(previous ? run(previous) : []);
      const caused = after.filter((p) => !before.has(p));
      if (!caused.length) continue;
      const claims = Array.isArray(doc.plan_claims) ? doc.plan_claims : [];
      conflicts.push({
        lang: v.lang, folder: v.folder, slug, iso: doc.iso, file: `${v.folder}/${slug}.json`,
        problems: caused.map((raw) => {
          const problem = asText(raw);
          const m = /^plan_claims\[(\d+)\]/.exec(problem);
          const c = m ? claims[Number(m[1])] : null;
          return { problem, quote: c && typeof c.quote === 'string' ? c.quote : null };
        }),
      });
    }
  }
  return conflicts;
}

/**
 * Hold per country, not the whole snapshot: the next facts for every country, except that each country whose authored
 * page the next facts contradict keeps its PREVIOUS entry (or stays absent if it had none). `held` records
 * { ISO: { since } } — `since` carried over from the previous file while the hold lasts, so the record changes only
 * when the held SET changes and a held state causes no daily commit.
 */
export function holdConflicting(previous, next, conflicts, today) {
  const isos = [...new Set(conflicts.map((c) => c.iso).filter((x) => typeof x === 'string'))].sort();
  const prevCountries = (previous && previous.countries) || {};
  const prevHeld = (previous && previous.held && typeof previous.held === 'object') ? previous.held : {};
  const countries = { ...next.countries };
  const held = {};
  for (const iso of isos) {
    if (iso in prevCountries) countries[iso] = prevCountries[iso];
    else delete countries[iso];
    const since = prevHeld[iso] && typeof prevHeld[iso].since === 'string' ? prevHeld[iso].since : today;
    held[iso] = { since };
  }
  const sorted = Object.fromEntries(Object.keys(countries).sort().map((k) => [k, countries[k]]));
  return { doc: { ...next, countries: sorted, ...(isos.length ? { held } : {}) }, isos };
}

/** The languages whose content validator must exist; a missing one is reported loudly (it protects nothing). */
export const REQUIRED_LANGS = Object.freeze(['en']);
export const missingRequired = (validators) => REQUIRED_LANGS.filter((l) => !arr(validators).some((v) => v && v.lang === l));

const fmt = (xs) => (xs.length ? xs.map(asText).join(', ') : '—');
const ageDays = (from, to) => (from && to ? Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) : null);

/**
 * The Markdown report for the job summary. Repeats on every run while the conflict lasts — by design.
 * `held` = { ISO: { since } } when the rest was published; null when the whole previous snapshot was kept.
 */
export function conflictReport(conflicts, { previous, next, today, held = null }) {
  const diff = factsDiff(previous, next);
  const L = [];
  if (held) {
    const list = Object.entries(held).map(([iso, h]) => `**${iso}** since ${h.since} (${ageDays(h.since, today)} day(s))`).join(', ');
    L.push('## ⚠️ global-plan-facts: new USD facts contradict authored content — those countries HELD');
    L.push('');
    L.push(`Facts held at their previous entry for: ${list}. Every other country's new facts were published. `
      + 'The page of a held country keeps facts its sentences agree with; the Russian catalogue commit is not affected.');
  } else {
    const kept = previous && previous.updated ? previous.updated : null;
    const age = ageDays(kept, today);
    L.push('## ⚠️ global-plan-facts: the new USD snapshot contradicts authored content — NOT published');
    L.push('');
    L.push(`The previous snapshot stays in place${kept ? ` (dated **${kept}**${age != null ? `, **${age} day(s) old**` : ''})` : ''}. The Russian catalogue commit is not affected.`);
  }
  L.push('');
  L.push('This report repeats on every run until a person rewrites or re-pins the sentence(s) below (`node seo/content-<prefix>.mjs --check <slug>`). '
    + '**A fix must hold under BOTH the old facts (what is committed now) and the new ones** — otherwise the build breaks today or the hold never ends. '
    + 'The facts then publish on the next run by themselves. Never loosen the check.');
  L.push('');
  for (const c of conflicts) {
    L.push(`### \`${asText(c.file)}\` (${asText(c.lang)}, ${asText(c.iso)})`);
    for (const p of arr(c.problems)) L.push(`- ${p.quote ? `«${asText(p.quote)}» — ` : ''}\`${asText(p.problem)}\``);
    const isos = new Set([c.iso]);
    for (const p of arr(c.problems)) for (const m of asText(p.problem).matchAll(/\b([A-Z]{2})\b/g)) if (diff[m[1]]) isos.add(m[1]);
    for (const iso of isos) {
      for (const [field, { removed, added }] of Object.entries(diff[iso] || {})) {
        L.push(`  - ${iso} \`${field}\`: dropped ${fmt(removed)}; added ${fmt(added)}`);
      }
    }
    L.push('');
  }
  const changed = Object.keys(diff);
  L.push(`Countries whose facts moved in this snapshot (${changed.length}): ${changed.slice(0, 60).join(', ')}${changed.length > 60 ? ' …' : ''}.`);
  L.push('The snapshot carries no package id by design (validateFacts); the packages behind a move are in the public USD answer '
    + '`/api/v1/retail/packages?market=global` → `assortment.countries.<ISO>`.');
  return `${L.join('\n')}\n`;
}

/** One line, for a `::warning::` annotation (no newlines allowed there). */
export function conflictAnnotation(conflicts, { previous, held = null }) {
  const files = arr(conflicts).map((c) => `${asText(c.file)}: ${arr(c.problems).length} claim(s)`).join('; ');
  if (held) {
    const list = Object.entries(held).map(([iso, h]) => `${iso} since ${h.since}`).join(', ');
    return `new USD facts contradict authored plan_claims — facts HELD for ${list}, the rest published; ${files}. See the job summary.`;
  }
  const kept = previous && previous.updated ? ` (kept snapshot dated ${previous.updated})` : '';
  return `new USD facts contradict authored plan_claims — snapshot NOT published${kept}; ${files}. See the job summary.`;
}
