// {{price:<name>}} in an authored country text — the amount comes from the
// catalogue when the page is built (SEO stage B).
//
// WHY
//
//   A hand-typed «400 ₽» goes false the day the provider moves that plan, and
//   the SEO refresh stops until a person rewrites the sentence (#70, #72, #78).
//   A token cannot go false: the generator prints whatever the catalogue holds
//   for the package and term it names, on every rebuild, so the refresh carries
//   the new amount through on its own. What can still go wrong is the REFERENCE —
//   the package withdrawn, moved to another block, changing its volume — and
//   that fails the build with the same message and successor candidates as a
//   price claim (seo/price-claims.mjs resolveTerm is the ONE rule for both).
//
// SHAPE
//
//   profile.price_refs = { <name>: <term> } — a term exactly as in price_claims:
//     { package, block: local|regional|daily, days? (a ladder), attrs? } or
//     { min_of: page|volume|local|regional|daily, where?, days? }.
//   Rendered text: «… 3 ГБ на 15 дней — {{price:local_3gb_15d}}.» →
//   «… 3 ГБ на 15 дней — 400 ₽.» (money as the generator prints every amount).
//   Relations between amounts («дороже», «вдвое») are still price_claims.
//   Every ref must be used, every token must have a ref. (The SEO pilot / control pages were excluded until the
//   experiment ended, 2026-10-24; their amounts are tokens since then.)

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTerm, validateTermShape } from './price-claims.mjs';
import { pageBlocks, isoOfSlug } from './coverage-claims.mjs';

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
 * @returns {{ profile: object, problems: string[], values: Record<string, number> }}
 */
export function renderPriceTokens(text, refs, slug, packages) {
  const problems = [];
  const values = {};
  const used = new Set();
  const tokensIn = [];
  for (const k of RENDER_KEYS) strings(text && text[k], (s) => { for (const m of s.matchAll(ANY_TOKEN_RE)) tokensIn.push(m[0]); return s; });
  const hasRefs = refs !== undefined;
  if (!hasRefs && !tokensIn.length) return { profile: text, problems, values };
  if (hasRefs && (!refs || typeof refs !== 'object' || Array.isArray(refs))) { problems.push(`${slug}: price_refs — не объект`); return { profile: text, problems, values }; }
  for (const t of tokensIn) if (!/^\{\{price:[a-z][a-z0-9_]*\}\}$/.test(t)) problems.push(`${slug}: «${t}» — подстановка пишется {{price:имя}}`);

  const iso = isoOfSlug(slug);
  const blocks = iso ? pageBlocks(packages, iso) : null;
  const byId = new Map(packages.map((p) => [p.package_id, p]));
  for (const [name, term] of Object.entries(refs || {})) {
    const shape = validateTermShape(name, term, 'price_refs');
    if (shape.length) { problems.push(...shape.map((m) => `${slug}: ${m}`)); continue; }
    if (!blocks) { problems.push(`${slug}: страна для /esim/${slug}/ неизвестна`); continue; }
    const r = resolveTerm(name, term, { blocks, byId, slug });
    for (const m of r.errors) problems.push(`${slug}: price_refs.${m} — подстановка {{price:${name}}} не может быть напечатана; перепривяжите её к тарифу-преемнику`);
    if (r.value) values[name] = r.value.price;
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
  return { profile: rendered, problems: [...new Set(problems)], values };
}
