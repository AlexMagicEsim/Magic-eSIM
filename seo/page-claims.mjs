// What an authored RU country page publishes on THIS catalogue — the one place
// that decides it, for the generator and for every test that reads a page.
//
// WHY
//
//   An authored sentence rests on cards: «20 ГБ на 30 дней за {{price:g20}}»,
//   «дешевле, чем …», «Замбию покрывают только …», «у местных — Altice». When a
//   card the sentence is about leaves the page — the plan is withdrawn, or the
//   backend now shows a look-alike from another provider with a different volume
//   or term — the sentence is no longer about anything on the page. Until
//   2026-11-01 that stopped the whole SEO refresh (storefront #198): no page of
//   any country could be rebuilt over one sentence. A price or a relation the new
//   catalogue makes false did the same.
//
//   Now such a sentence is LEFT OUT: the smallest piece of the page that carries
//   it — the title, the description, the H1, the lead, one intro paragraph, one
//   «why» card, one FAQ question with its answer, the dual-SIM note — is not
//   rendered, and the template's own factual text takes its place where it has
//   one (title, description, H1, lead). Nothing is guessed (no look-alike card,
//   no stale amount), nothing false is published, every other page refreshes.
//   seo/suppressed-claims.json lists what is left out and why — the refresh PR
//   carries it, and a person rewrites the sentence.
//
// WHAT IS LEFT OUT, AND WHAT STILL FAILS
//
//   left out  a {{price:…}} whose card is gone (and no fallback)      price_refs
//             a price relation with a card gone, or now false          price_claims
//             a coverage claim the published cards no longer bear out   coverage_claims
//             (a basis card gone, another country list, «все» on an
//             empty block)
//             an operator claim the cards no longer bear out           network_claims
//   fails     any AUTHORING error (an id, a bad shape, an anchor not in the
//             text, an unused ref, an operator named without a claim) —
//             the build stops, as before
//
//   Until 2026-11-01 a coverage contradiction blocked the catalogue refresh and
//   an operator contradiction failed the SEO refresh. Both were decided before
//   a sentence could be left out; with a provider choosing itself per card
//   (#124) either would stop the site over one sentence, and leaving it out
//   publishes nothing false. A person still rewrites it — the record says which.
//
//   Only RU pages carry amounts. The prefixed languages (USD) print no price in
//   their HTML — their plan facts come from seo/global-plan-facts.json and hold a
//   contradicted country back on their own (seo/content-facts-guard.mjs).

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderPriceTokens, RENDER_KEYS, TOKEN_RE } from './price-tokens.mjs';
import { evaluateProfile as priceClaimProblems } from './price-claims.mjs';
import { evaluateProfile as coverageClaimProblems, loadCatalogDoc, PROFILE_DIR, CATALOG_FILE } from './coverage-claims.mjs';
import { evaluateNetworkClaims } from './network-claims.mjs';
import { unresolvedLayoutIds, BLOCKS } from './plan-ref.mjs';

/**
 * The snapshot a page may be built from: trusted (scripts/update-catalog-cache.mjs
 * validateCatalog) AND carrying the backend's layout, every id of which it holds.
 * A snapshot without it is INCOMPLETE — not a provider switch: leaving out every
 * sentence «because no card is there» would gut the site over a broken answer,
 * so the build refuses it and the pages stay as they are.
 */
export function loadPublishedCatalogue(file = CATALOG_FILE, { doc, pages = pageCountries() } = {}) {
  const d = loadCatalogDoc(file, { doc });
  const bad = unresolvedLayoutIds(d);
  if (bad === null) throw new Error('в снимке каталога нет раскладки assortment.countries — каталог неполный, страницы из него не собираются');
  if (bad.length) throw new Error(`раскладка каталога ссылается на тарифы, которых в снимке нет (${bad.length}): ${bad.slice(0, 3).join('; ')} — каталог неполный`);
  // Every country with a page must be laid out with at least one card: the backend never empties a country that
  // sells plans, so an empty, partial or collapsed layout is a broken answer — never «these cards are gone».
  const countries = d.assortment.countries;
  // A card listed twice on one page is a broken answer: the backend deduplicates look-alikes before it lays a page
  // out, and the browser would draw the repeat as a second card — never count it, never publish from it.
  const repeated = Object.entries(countries).filter(([, e]) => { const ids = BLOCKS.flatMap((b) => (e && e[b]) || []); return new Set(ids).size !== ids.length; }).map(([iso]) => iso);
  if (repeated.length) throw new Error(`раскладка каталога повторяет карточку на странице (${repeated.slice(0, 5).join(', ')}) — каталог повреждён`);
  const empty = pages.filter((iso) => !countries[iso] || !BLOCKS.some((b) => (countries[iso][b] || []).length));
  if (empty.length) throw new Error(`раскладка каталога без карточек для ${empty.length} стран со страницами (${empty.slice(0, 5).join(', ')}${empty.length > 5 ? ', …' : ''}) — каталог неполный`);
  return d;
}

/** ISO codes of the RU country pages — seo/catalogue-countries.json, rebuilt from the same snapshot first. */
export function pageCountries(file = join(PROFILE_DIR, '..', 'catalogue-countries.json')) {
  if (!existsSync(file)) return [];
  const j = JSON.parse(readFileSync(file, 'utf8'));
  return (Array.isArray(j.countries) ? j.countries : []).map((c) => c && c.iso).filter((x) => typeof x === 'string');
}

/** The piece of the page a field path belongs to: «faq[2].a» → «faq[2]», «why[0].h» → «why[0]». */
export function unitOf(field) {
  const m = /^(intro|why|faq)\[(\d+)\]/.exec(field);
  if (m) return `${m[1]}[${m[2]}]`;
  const top = String(field).split('.')[0];
  return top;
}

/** Every rendered string of a profile with the field path it stands at. */
function renderedStrings(text) {
  const out = [];
  for (const k of RENDER_KEYS) {
    const v = text && text[k];
    if (typeof v === 'string') out.push([k, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => {
      if (typeof x === 'string') out.push([`${k}[${i}]`, x]);
      else if (x && typeof x === 'object') for (const [kk, vv] of Object.entries(x)) if (typeof vv === 'string') out.push([`${k}[${i}].${kk}`, vv]);
    });
    else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) if (typeof vv === 'string') out.push([`${k}.${kk}`, vv]);
  }
  return out;
}

/**
 * A copy of `p` without the units: scalar fields dropped; array items removed
 * (the page) or, with keepPositions, replaced by null so every other field path
 * — «intro[1]», «faq[3].a» — still names the same text (the prose gates).
 */
export function withoutUnits(p, units, { keepPositions = false } = {}) {
  if (!units.size) return p;
  const out = { ...p };
  for (const k of Object.keys(out)) {
    if (Array.isArray(out[k]) && ['intro', 'why', 'faq'].includes(k)) {
      out[k] = keepPositions ? out[k].map((x, i) => (units.has(`${k}[${i}]`) ? null : x)) : out[k].filter((_, i) => !units.has(`${k}[${i}]`));
      if (!out[k].some((x) => x !== null)) delete out[k];
    } else if (units.has(k)) delete out[k];
  }
  return out;
}

// A claim keeps the anchors that are still on the page; one with none left goes.
function keepClaims(list, units) {
  if (!Array.isArray(list)) return list;
  return list.map((c) => (c && Array.isArray(c.anchors) ? { ...c, anchors: c.anchors.filter((a) => !units.has(unitOf(a.field))) } : c))
    .filter((c) => !(c && Array.isArray(c.anchors)) || c.anchors.length);
}

export function readRawProfile(slug, dir = PROFILE_DIR) {
  const f = join(dir, `${slug}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

/**
 * @param slug  the country page
 * @param text  loadProfile(slug).profile — the editorial fields (null: no profile)
 * @param raw   the whole profile file (refs and claims)
 * @param doc   the catalogue snapshot: packages + the published layout
 * @returns {{ profile, filtered, problems: string[], suppressed: object[] }}
 *   profile    what the page renders: units left out, every remaining token printed
 *   filtered   the raw profile without those units (tokens kept, claims on them dropped)
 *              — what the prose gates read
 *   problems   AUTHORING errors — the build stops on any
 *   suppressed { slug, unit, source, id, reason } sorted — seo/suppressed-claims.json
 */
export function renderAuthored(slug, { text, raw, doc }) {
  if (!text) return { profile: text, filtered: raw, problems: [], suppressed: [] };
  const problems = [];
  const left = [];
  const tokens = renderPriceTokens(text, raw && raw.price_refs, slug, doc);
  problems.push(...tokens.problems);

  for (const [field, s] of renderedStrings(text)) {
    for (const m of s.matchAll(TOKEN_RE)) {
      const name = m[1];
      if (name in tokens.unresolved) left.push({ unit: unitOf(field), source: 'price_refs', id: name, reason: tokens.unresolved[name].join('; ') });
    }
  }

  const fromClaims = (source, list) => {
    const byClaim = new Map();
    for (const x of list) {
      if (x.kind === 'authoring') { const m = x.msg || x.message; problems.push(m.startsWith(`${source}`) ? `${slug}: ${m}` : `${slug}: ${source}${x.claim ? `/${x.claim}` : ''}: ${m}`); continue; }
      if (x.kind !== 'catalogue') continue;
      if (!byClaim.has(x.claim)) byClaim.set(x.claim, []);
      byClaim.get(x.claim).push(x.msg || x.message);
    }
    for (const [id, reasons] of byClaim) {
      const claim = (raw[source] || []).find((c) => c && c.id === id);
      for (const a of (claim && claim.anchors) || []) left.push({ unit: unitOf(a.field), source, id, reason: reasons.join('; ') });
    }
  };
  if (raw) {
    fromClaims('price_claims', priceClaimProblems(raw, slug, doc));
    // A coverage contradiction is the catalogue's word on the sentence too.
    fromClaims('coverage_claims', coverageClaimProblems(raw, slug, doc).map((x) => (x.kind === 'content' ? { ...x, kind: 'catalogue' } : x)));
    fromClaims('network_claims', evaluateNetworkClaims(raw, slug, { doc }));
  }

  const units = new Set(left.map((x) => x.unit));
  const seen = new Set();
  const suppressed = left.map((x) => ({ slug, ...x }))
    .filter((x) => { const k = `${x.unit}|${x.source}|${x.id}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (a.unit < b.unit ? -1 : a.unit > b.unit ? 1 : a.source < b.source ? -1 : a.source > b.source ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const profile = withoutUnits(tokens.profile, units);
  // Nothing unprinted may reach the page: a token still standing here is a bug of this module.
  for (const [field, s] of renderedStrings(profile)) if (/\{\{price:/.test(s)) problems.push(`${slug}: ${field} — подстановка осталась ненапечатанной`);
  const filtered = raw ? {
    ...withoutUnits(raw, units, { keepPositions: true }),
    price_claims: keepClaims(raw.price_claims, units),
    coverage_claims: keepClaims(raw.coverage_claims, units),
    network_claims: keepClaims(raw.network_claims, units),
    network_claims_waived: Array.isArray(raw.network_claims_waived) ? raw.network_claims_waived.filter((w) => !units.has(unitOf(w.field))) : raw.network_claims_waived,
    price_claims_waived: Array.isArray(raw.price_claims_waived) ? raw.price_claims_waived.filter((w) => !units.has(unitOf(w.field))) : raw.price_claims_waived,
  } : raw;
  for (const k of ['price_claims', 'coverage_claims', 'network_claims', 'network_claims_waived', 'price_claims_waived']) if (filtered && filtered[k] === undefined) delete filtered[k];
  return { profile, filtered, problems: [...new Set(problems)], suppressed };
}
