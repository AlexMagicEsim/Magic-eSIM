// {{price:<name>}} in an authored country text — the amount comes from the
// catalogue when the page is built (SEO stage B).
//
// WHY
//
//   A hand-typed «400 ₽» goes false the day the provider moves that plan, and
//   the SEO refresh stops until a person rewrites the sentence (#70, #72, #78).
//   A token cannot go false: the generator prints whatever the catalogue holds
//   for the card and term it names, on every rebuild, so the refresh carries
//   the new amount through on its own. The REFERENCE names the card, not a
//   provider row: { block, attrs: { volume, term }, days?, family? } on THIS
//   page's published layout (seo/plan-ref.mjs) — the backend chooses the
//   provider (#124), and the token follows whichever row stands behind the card.
//   When no card of that block, volume and term is left, the token is printed
//   neither with a guess nor stale: the sentence holding it is left out of the
//   page (seo/page-claims.mjs) and recorded. seo/price-claims.mjs resolveTerm is
//   the ONE rule for printed and checked amounts.
//
// SHAPE
//
//   profile.price_refs = { <name>: <term> } — a term exactly as in price_claims:
//     { block: local|regional|daily, attrs: { data_gb | daily_gb, validity_days? },
//       days? (a ladder rung), family?, fallback? } or
//     { min_of: page|volume|local|regional|daily, where?, days? }.
//   `fallback` is another term, printed only when the card is gone — write one
//   only where the sentence stays true with it («от N ₽» → min_of).
//   Rendered text: «… 3 ГБ на 15 дней — {{price:local_3gb_15d}}.» →
//   «… 3 ГБ на 15 дней — 400 ₽.» (money as the generator prints every amount).
//   Relations between amounts («дороже», «вдвое») are still price_claims.
//   Every ref must be used, every token must have a ref. (The SEO pilot / control pages were excluded until the
//   experiment ended, 2026-10-24; their amounts are tokens since then.)

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTerm, validateTermShape } from './price-claims.mjs';
import { isoOfSlug } from './coverage-claims.mjs';
import { publishedBlocks } from './plan-ref.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PROFILE_DIR = join(ROOT, 'seo', 'content-profiles');

export const TOKEN_RE = /\{\{price:([a-z][a-z0-9_]*)\}\}/g;
const ANY_TOKEN_RE = /\{\{[^}]*\}\}/g;
// The rendered fields — the only place a token may stand (seo/price-inventory.mjs renderedFields).
export const RENDER_KEYS = Object.freeze(['title', 'description', 'h1', 'lead', 'intro', 'why', 'faq', 'dual_sim_note']);
export const money = (v) => `${Math.round(Number(v)).toLocaleString('ru-RU')} ₽`;

export function readRefs(slug, dir = PROFILE_DIR) {
  const f = join(dir, `${slug}.json`);
  if (!existsSync(f)) return undefined;
  return JSON.parse(readFileSync(f, 'utf8')).price_refs;
}

function strings(value, visit) {
  if (typeof value === 'string') return visit(value);
  if (Array.isArray(value)) return value.map((v) => strings(v, visit));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, strings(v, visit)]));
  return value;
}

/**
 * @param {object} text   the profile's rendered fields (loadProfile().profile)
 * @param {object|undefined} refs  profile.price_refs
 * @param {object} doc    the catalogue snapshot (packages + the published layout)
 * @returns {{ profile: object, problems: string[], values: Record<string, number>, unresolved: Record<string, string[]> }}
 *   problems — AUTHORING errors (fail the build); unresolved — refs the catalogue
 *   cannot print now (their tokens stay in `profile`; seo/page-claims.mjs removes
 *   the sentences before anything is written).
 */
export function renderPriceTokens(text, refs, slug, doc) {
  const problems = [];
  const values = {};
  const unresolved = {};
  const used = new Set();
  const tokensIn = [];
  for (const k of RENDER_KEYS) strings(text && text[k], (s) => { for (const m of s.matchAll(ANY_TOKEN_RE)) tokensIn.push(m[0]); return s; });
  const hasRefs = refs !== undefined;
  if (!hasRefs && !tokensIn.length) return { profile: text, problems, values, unresolved };
  if (hasRefs && (!refs || typeof refs !== 'object' || Array.isArray(refs))) { problems.push(`${slug}: price_refs — не объект`); return { profile: text, problems, values, unresolved }; }
  for (const t of tokensIn) if (!/^\{\{price:[a-z][a-z0-9_]*\}\}$/.test(t)) problems.push(`${slug}: «${t}» — подстановка пишется {{price:имя}}`);

  const iso = isoOfSlug(slug);
  const blocks = iso ? publishedBlocks(doc, iso) : null;
  for (const [name, term] of Object.entries(refs || {})) {
    const shape = validateTermShape(name, term, 'price_refs');
    if (shape.length) { problems.push(...shape.map((m) => `${slug}: ${m}`)); continue; }
    if (!iso) { problems.push(`${slug}: страна для /esim/${slug}/ неизвестна`); continue; }
    if (!blocks) { unresolved[name] = [`в снимке нет опубликованного ассортимента для ${iso}`]; continue; }
    const r = resolveTerm(name, term, { blocks, slug });
    if (r.value) values[name] = r.value.price;
    else unresolved[name] = r.errors;
  }

  const rendered = {};
  for (const [k, v] of Object.entries(text || {})) {
    rendered[k] = RENDER_KEYS.includes(k) ? strings(v, (s) => s.replace(TOKEN_RE, (all, name) => {
      used.add(name);
      if (!(refs && name in refs)) { problems.push(`${slug}: {{price:${name}}} — нет такого price_refs`); return all; }
      return name in values ? money(values[name]) : all;
    })) : v;
  }
  for (const name of Object.keys(refs || {})) if (!used.has(name)) problems.push(`${slug}: price_refs.${name} нигде не используется — удалите`);
  return { profile: rendered, problems: [...new Set(problems)], values, unresolved };
}
