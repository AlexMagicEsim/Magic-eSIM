// A plan an authored sentence talks about — named by what the buyer sees, never
// by a provider's id.
//
// WHY
//
//   Authored RU pages pinned 602 provider package ids (price refs, price-claim
//   terms, coverage and operator claim bases). Since backend #124 (2026-10-31)
//   the backend shows, among look-alike plans, the one we BUY cheapest — so a
//   plan can change provider, and id, with the buyer seeing the same card. Two
//   pinned ids vanished that day and every «SEO refresh PR» run failed until a
//   person re-pinned them (storefront #198). An id says which ROW we buy; a
//   sentence is about the CARD: this page, this block, this volume, this term.
//
//   The checks also read the page through pageBlocks() — every package whose
//   coverage codes include the country — while the page draws the backend's
//   layout. On 2026-11-01 that view held 2611 package rows the pages do not show
//   (and missed 126 they do): Morocco printed the price of an «Africa 3 GB» card
//   it does not show, Seychelles and Tanzania described Africa packages their
//   regional blocks do not hold, and every check passed.
//
// THE ONE SOURCE
//
//   publishedBlocks(doc, iso) = assets/catalog.json `assortment.countries[ISO]`
//   — the backend's own layout (lib/assortmentLayout.js), the one the RU page,
//   every prefixed language and the Mini App draw (assets/assortment-view.js) —
//   resolved to the snapshot's packages, in the published order. Nothing here
//   ranks, filters or chooses a provider: the backend has already done that.
//
// THE SELECTOR
//
//   { block: local|regional|daily,
//     attrs: { data_gb | daily_gb, validity_days? },   // the card's volume (+ its fixed term)
//     days?: N,                                       // a ladder rung (PER_DAY), or a fixed term
//     family?: "<regex on the plan name>" }           // what a sentence names: «пакет на Африку»;
//                                                     // required in regional; without it only a
//                                                     // single-country card matches
//
//   It matches a plan of THAT block with the same volume and term (and family).
//   Several matches → the first in the published order (the backend's R1 leaves
//   one per volume and term in a block, so today there is never a second). None
//   → { plan: null }: the caller drops the sentence, never picks a look-alike.

import { isDaily, isMultiCountry } from './catalogue-facts.mjs';

export const BLOCKS = Object.freeze(['local', 'regional', 'daily']);
const ATTR_KEYS = new Set(['data_gb', 'daily_gb', 'validity_days']);
const SELECTOR_KEYS = new Set(['block', 'attrs', 'days', 'family', 'fallback']);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const ladderOf = (p) => (Array.isArray(p.term_prices) ? p.term_prices : []);

/**
 * The country page's three blocks as the backend published them: packages in
 * layout order, or null when the snapshot has no layout for the country (an old
 * snapshot, or a country the page does not exist for).
 */
export function publishedBlocks(doc, iso) {
  const entry = doc && doc.assortment && doc.assortment.countries && doc.assortment.countries[iso];
  if (!entry) return null;
  const byId = packageIndex(doc);
  const out = {};
  for (const b of BLOCKS) out[b] = (Array.isArray(entry[b]) ? entry[b] : []).map((id) => byId.get(id)).filter(Boolean);
  return out;
}

const INDEX = new WeakMap();
function packageIndex(doc) {
  let m = INDEX.get(doc);
  if (!m) { m = new Map((doc.packages || []).map((p) => [p.package_id, p])); INDEX.set(doc, m); }
  return m;
}

/**
 * Layout ids the snapshot cannot resolve — a catalogue that names a card it
 * does not carry is incomplete, and nothing may be read from it.
 */
export function unresolvedLayoutIds(doc) {
  const countries = doc && doc.assortment && doc.assortment.countries;
  if (!countries || typeof countries !== 'object') return null;
  const byId = packageIndex(doc);
  const out = [];
  for (const [iso, entry] of Object.entries(countries)) {
    for (const b of BLOCKS) for (const id of (entry && entry[b]) || []) if (!byId.has(id)) out.push(`${iso}.${b}: ${id}`);
  }
  return out;
}

export const isSelector = (t) => !!t && typeof t === 'object' && !Array.isArray(t) && 'block' in t && !('package' in t) && !('min_of' in t);

/** Shape problems of one selector (messages name `where.name`). */
export function validateSelector(name, t, where = 'terms') {
  const p = [];
  const at = `${where}.${name}`;
  if (!t || typeof t !== 'object' || Array.isArray(t)) return [`${at} не объект`];
  for (const k of Object.keys(t)) if (!SELECTOR_KEYS.has(k)) p.push(`${at}: неизвестный ключ «${k}»`);
  if (!BLOCKS.includes(t.block)) p.push(`${at}.block обязателен: ${BLOCKS.join(' | ')}`);
  const attrs = t.attrs && typeof t.attrs === 'object' && !Array.isArray(t.attrs) ? t.attrs : null;
  if (!attrs) p.push(`${at}.attrs обязателен: объём (data_gb или daily_gb) и срок`);
  else {
    for (const [k, v] of Object.entries(attrs)) if (!ATTR_KEYS.has(k) || !isNum(v)) p.push(`${at}.attrs.${k} — неизвестно или не число`);
    const vols = ['data_gb', 'daily_gb'].filter((k) => k in attrs);
    if (vols.length !== 1) p.push(`${at}.attrs: ровно один объём — data_gb (обычный тариф) или daily_gb (дневной)`);
    if (t.block === 'daily' && 'data_gb' in attrs) p.push(`${at}: в блоке daily объём — daily_gb`);
    if (t.block !== 'daily' && 'daily_gb' in attrs) p.push(`${at}: daily_gb — только в блоке daily`);
    if (!('validity_days' in attrs) && t.days === undefined) p.push(`${at}: нужен срок — attrs.validity_days или days`);
  }
  if (t.days !== undefined && !(Number.isInteger(t.days) && t.days > 0)) p.push(`${at}.days — целое число дней`);
  if (t.block === 'regional' && t.family === undefined) p.push(`${at}: в блоке regional нужен family — какой пакет фраза называет («пакет на Африку»)`);
  if (t.family !== undefined) {
    if (typeof t.family !== 'string' || !t.family) p.push(`${at}.family — регулярное выражение по названию`);
    else { try { new RegExp(t.family, 'i'); } catch (e) { p.push(`${at}.family — не регулярное выражение: ${e.message}`); } }
  }
  return p;
}

/** True when `p` is the card the selector describes (block membership is the caller's). */
export function matches(p, t) {
  const attrs = t.attrs || {};
  // No family named → the page's own country only: a daily «1 ГБ в день» sentence is never the price of a
  // multi-country card that happens to share the volume and term.
  if (!t.family && isMultiCountry(p)) return false;
  if (('daily_gb' in attrs) !== isDaily(p)) return false;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'validity_days') continue;
    if (Number(p[k]) !== v) return false;
  }
  const ladder = ladderOf(p);
  if ('validity_days' in attrs) {
    if (ladder.length || Number(p.validity_days) !== attrs.validity_days) return false;
  }
  if (t.days !== undefined) {
    const ok = ladder.length ? ladder.some((r) => Number(r.days) === t.days && Number(r.price) > 0) : Number(p.validity_days) === t.days;
    if (!ok) return false;
  }
  if (t.family && !new RegExp(t.family, 'i').test(String(p.name || ''))) return false;
  return true;
}

/** { plan, candidates } — the first match in the published order of the block, or plan: null. */
export function selectPlan(blocks, t) {
  const candidates = ((blocks && blocks[t.block]) || []).filter((p) => matches(p, t));
  return { plan: candidates[0] || null, candidates };
}

/** What a selector says, for messages: «local 20 ГБ / 30 дн.». */
export function describeSelector(t) {
  const a = t.attrs || {};
  const vol = 'daily_gb' in a ? `${a.daily_gb} ГБ/день` : `${a.data_gb} ГБ`;
  const term = t.days !== undefined ? `${t.days} дн.` : `${a.validity_days} дн.`;
  return `${t.block} ${vol} / ${term}${t.family ? ` /${t.family}/` : ''}`;
}

// ------------------------------------------------------------------ migration helper

// Variant markers a provider appends to the same card («(nonhkip)», «(USIP)»,
// «Premium»): not a family. Volume and term tokens are the card's own fields.
const NAME_NOISE = [
  /\([^)]*\)/g,
  /\d+(?:[.,]\d+)?\s*(?:GB|MB|ГБ|МБ)(?:\s*\/\s*Day)?/gi,
  /\d+\s*(?:Days?|дн\.?|дней|дня)/gi,
  /\b(?:Unlimited|Yearly|Premium|FUP\S*|Plus)\b/gi,
];

/**
 * The family regex of a multi-country plan, from its name: «Africa 3GB 30Days»
 * and «Africa 3 GB» → "africa". Used once, to move id pins to selectors; an
 * author may narrow or widen it. A single-country plan needs none — the page is
 * the country.
 */
export function familyOf(name) {
  let s = String(name || '');
  for (const re of NAME_NOISE) s = s.replace(re, ' ');
  const words = s.replace(/[^\p{L}\p{N}&+-]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return words.map((w) => w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
}
