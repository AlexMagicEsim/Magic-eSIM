#!/usr/bin/env node
// Price claims — the machine-checkable dependencies of authored price sentences.
//
// WHY THIS EXISTS
//
//   On 2026-10-14 the provider moved Saudi Arabia 50 GB from 8100 to 10050 ₽.
//   The page's title, description and H1 rested on «50 ГБ на месяц дешевле
//   посуточного» (8100 < 8900), and that relation became false with every gate
//   green. content-review's checkFacts asks only whether a ₽ figure exists
//   SOMEWHERE in the country's fact sheet — never on which package — and no gate
//   at all read a relation written in words («дешевле», «проигрывает»). Only
//   the five SEO-pilot pages had their relations pinned (seo/test-seo-pilot.mjs).
//   Israel (#22, 2026-10-02) was the same class.
//
//   Each profile may now carry `price_claims`: small explicit assertions a person
//   writes next to the sentence they guard, the way `coverage_claims` guard a
//   coverage sentence (seo/coverage-claims.mjs). This module checks them against
//   assets/catalog.json with the page's own block split (pageBlocks — the port
//   of the browser) and the purchasable price (catalogue-facts). It never parses
//   Russian prose and never calls a provider.
//
// THE CLAIM
//
//   { id, anchors: [{ field: "description", text: "<a whole sentence>" }],
//     terms: {
//       a:   { package: "<package_id>", block: "local"|"regional"|"daily",
//              days?: N,                 // the term the sentence prices
//              attrs?: { data_gb, daily_gb, validity_days } },
//       min: { min_of: "page"|"volume"|"local"|"regional"|"daily",   // volume = local + regional
//              days?: N,                 // the price of that term only
//              where?: { data_gb, daily_gb, validity_days, multi_country } } },
//     assert: [ { left: "a" | N, op: "<"|"<="|"="|">="|">", right: "min" | N,
//                 factor?: K } ],     // left × K op right — «в разы», «почти втрое»
//     note? }
//
//   A package term is the amount the customer pays for that card on that term:
//   a PER_DAY ladder's rung for `days` (required — the per-day rate is never a
//   price), else the package price (and `days`, when given, must be its
//   validity). It must still be on THIS page, in the named block — a sentence
//   that compares «местный» with «региональный» names blocks, and attribution is
//   what broke Malaysia, Brazil and Greece. A `min_of` term is the cheapest such
//   amount in the block (or on the whole page), optionally narrowed.
//
//   Ids, not descriptions: a vanished id is a red test that lists the likely
//   successors (same block, same volume and term) — a minute to re-pin.
//
// COMPLETENESS. Every sentence of the HEADLINE fields — title, description, h1,
// lead — that names a rouble amount or a price relation must be the anchor of a
// price claim or be waived in `price_claims_waived` with a reason. Those four
// fields are the search snippet and the page's premise; Saudi Arabia's broke in
// exactly those. The body is still covered by checkFacts only (a figure must
// exist in the country); anchoring it is allowed, not yet required.
//
// FAIL CLOSED. An unknown key, a claim with nothing to check, an anchor no longer
// on the page or not a whole sentence, a missing or moved package, a ladder with
// no such term, an empty `min_of` — every one is a failure, never a pass.
//
// WHERE IT RUNS. `npm test` (seo/test-price-claims.mjs): on `main`'s CI and
// inside the SEO-refresh job, which rebuilds over the bot's new catalogue and
// stops before opening a PR. NOT in the catalogue cache refresh: a price move is
// not something a gate can refuse — the provider has already made it, the
// backend already sells at it — and blocking the cache would freeze every price
// on the site over one sentence. The job of this check is to fail LOUDLY in the
// next refresh PR, naming the sentence.
//
//   node seo/price-claims.mjs --check [--catalog <file>]

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMultiCountry, purchasablePrice } from './catalogue-facts.mjs';
import { pageBlocks, isoOfSlug, fieldText, isWholeSentence, sentencesOf, loadCatalogDoc } from './coverage-claims.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CATALOG_FILE = join(ROOT, 'assets', 'catalog.json');
export const PROFILE_DIR = join(ROOT, 'seo', 'content-profiles');

export const HEADLINE_FIELDS = Object.freeze(['title', 'description', 'h1', 'lead']);
const BLOCKS = ['local', 'regional', 'daily'];
const MIN_SCOPES = ['page', 'volume', ...BLOCKS];
const OPS = { '<': (a, b) => a < b, '<=': (a, b) => a <= b, '=': (a, b) => a === b, '>=': (a, b) => a >= b, '>': (a, b) => a > b };
const CLAIM_KEYS = new Set(['id', 'anchors', 'terms', 'assert', 'note']);
const PACKAGE_TERM_KEYS = new Set(['package', 'block', 'days', 'attrs']);
const MIN_TERM_KEYS = new Set(['min_of', 'days', 'where']);
const ATTR_KEYS = new Set(['data_gb', 'daily_gb', 'validity_days']);
const WHERE_KEYS = new Set([...ATTR_KEYS, 'multi_country']);
const ASSERT_KEYS = new Set(['left', 'op', 'right', 'factor']);

// A rouble amount, or a word that compares prices. Russian stems on purpose —
// never \b or \w here (ASCII-only in JavaScript; CLAUDE.md, third strike).
export const PRICE_SENTENCE_RE = /\d[\d  ]*₽|дешевл|дешёв|дороже|дорож|выгодн|проигрыва|выигрыва|вдвое|втрое|впятеро|переплат|экономи/i;

const norm = (s) => String(s ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const describe = (p) => `${p.package_id} «${p.name}»`;

// ------------------------------------------------------------------ prices

/** The block a package occupies on this country page, or null when the page does not show it. */
export function blockOn(blocks, p) {
  for (const b of BLOCKS) if (blocks[b].includes(p)) return b;
  return null;
}

/**
 * What the customer pays for `p` on `days`, or { error }.
 * PER_DAY: the ladder's rung, never rate × days and never the rate itself.
 * Everything else: the package price; the term is the package's own validity.
 */
export function termPrice(p, days) {
  const ladder = Array.isArray(p.term_prices) ? p.term_prices : [];
  if (ladder.length) {
    if (days === undefined) return { error: `у ${describe(p)} лестница сроков — укажите days` };
    const rung = ladder.find((t) => Number(t.days) === days);
    const v = rung ? Number(rung.price) : NaN;
    if (!(v > 0)) return { error: `у ${describe(p)} нет срока ${days} дн. (есть: ${ladder.map((t) => t.days).join(', ')})` };
    return { price: v };
  }
  if (days !== undefined && Number(p.validity_days) !== days) return { error: `${describe(p)} действует ${p.validity_days} дн., не ${days}` };
  const v = Number(p.price);
  return v > 0 ? { price: v } : { error: `у ${describe(p)} нет цены` };
}

const inWhere = (p, where = {}) => Object.entries(where).every(([k, v]) =>
  (k === 'multi_country' ? isMultiCountry(p) === v : Number(p[k]) === v));

// ------------------------------------------------------------------ shape

/**
 * The shape of one term — a package on a named block (+ days for a ladder), or
 * the cheapest of a block. Shared by price_claims terms and price_refs
 * (seo/price-tokens.mjs). `where` names the key the messages print («terms»).
 */
export function validateTermShape(name, t, where = 'terms') {
  const p = [];
  if (!/^[a-z][a-z0-9_]*$/.test(name)) p.push(`${where}.${name}: имя — латиница, цифры, _`);
  if (!t || typeof t !== 'object') { p.push(`${where}.${name} не объект`); return p; }
  if (t.days !== undefined && !(Number.isInteger(t.days) && t.days > 0)) p.push(`${where}.${name}.days — целое число дней`);
  if ('package' in t) {
    for (const k of Object.keys(t)) if (!PACKAGE_TERM_KEYS.has(k)) p.push(`${where}.${name}: неизвестный ключ «${k}»`);
    if (typeof t.package !== 'string' || !t.package) p.push(`${where}.${name}.package — id продукта`);
    if (!BLOCKS.includes(t.block)) p.push(`${where}.${name}.block обязателен: ${BLOCKS.join(' | ')} — сравнение без блока и есть ошибка атрибуции`);
    for (const [k, v] of Object.entries(t.attrs || {})) if (!ATTR_KEYS.has(k) || !isNum(v)) p.push(`${where}.${name}.attrs.${k} — неизвестно или не число`);
  } else if ('min_of' in t) {
    for (const k of Object.keys(t)) if (!MIN_TERM_KEYS.has(k)) p.push(`${where}.${name}: неизвестный ключ «${k}»`);
    if (!MIN_SCOPES.includes(t.min_of)) p.push(`${where}.${name}.min_of: ${MIN_SCOPES.join(' | ')}`);
    for (const [k, v] of Object.entries(t.where || {})) {
      if (!WHERE_KEYS.has(k)) p.push(`${where}.${name}.where.${k} — неизвестный ключ`);
      else if (k === 'multi_country' ? typeof v !== 'boolean' : !isNum(v)) p.push(`${where}.${name}.where.${k} — неверный тип`);
    }
  } else p.push(`${where}.${name}: нужен package или min_of`);
  return p;
}

export function validateClaimShape(claim) {
  const p = [];
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) return ['утверждение не объект'];
  for (const k of Object.keys(claim)) if (!CLAIM_KEYS.has(k)) p.push(`неизвестный ключ «${k}»`);
  if (typeof claim.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(claim.id)) p.push('id обязателен: латиница, цифры, дефис');
  if (!Array.isArray(claim.anchors) || claim.anchors.length === 0) p.push('anchors обязательны: хотя бы одна цитата из текста страницы');
  else claim.anchors.forEach((a, i) => {
    if (!a || typeof a.field !== 'string' || typeof a.text !== 'string' || norm(a.text).length < 4) p.push(`anchors[${i}] — нужны field и text`);
  });
  const terms = claim.terms && typeof claim.terms === 'object' && !Array.isArray(claim.terms) ? claim.terms : null;
  if (!terms || !Object.keys(terms).length) p.push('terms обязательны: хотя бы один тариф или минимум блока');
  for (const [name, t] of Object.entries(terms || {})) p.push(...validateTermShape(name, t, 'terms'));
  if (!Array.isArray(claim.assert) || !claim.assert.length) p.push('assert обязателен: утверждение без проверки ничего не доказывает');
  else claim.assert.forEach((a, i) => {
    if (!a || typeof a !== 'object') { p.push(`assert[${i}] не объект`); return; }
    for (const k of Object.keys(a)) if (!ASSERT_KEYS.has(k)) p.push(`assert[${i}]: неизвестный ключ «${k}»`);
    if (!(a.op in OPS)) p.push(`assert[${i}].op: ${Object.keys(OPS).join(' ')}`);
    for (const side of ['left', 'right']) {
      const v = a[side];
      if (!(isNum(v) || (typeof v === 'string' && terms && v in terms))) p.push(`assert[${i}].${side}: имя из terms или число`);
    }
    if (isNum(a.left) && isNum(a.right)) p.push(`assert[${i}]: два числа — нечего проверять`);
    if (a.factor !== undefined && !(isNum(a.factor) && a.factor > 0)) p.push(`assert[${i}].factor — положительное число`);
  });
  return p;
}

// ------------------------------------------------------------------ evaluation

/**
 * The amount one term names on /esim/<slug>/ in this catalogue: { value: { price, what } | null, errors }.
 * The ONE place a term becomes a price — price_claims assert on it and price_refs
 * (seo/price-tokens.mjs) print it, so a printed amount and a checked amount
 * cannot come from two rules. ctx = { blocks: pageBlocks(packages, iso), byId, slug }.
 */
export function resolveTerm(name, t, { blocks, byId, slug }) {
  const errors = [];
  if ('package' in t) {
    const p = byId.get(t.package);
    if (!p) {
      const twins = blocks[t.block].filter((q) => Object.entries(t.attrs || {}).every(([k, v]) => Number(q[k]) === v)
        && (t.days === undefined || !termPrice(q, t.days).error));
      errors.push(`${name}: продукта ${t.package} нет в каталоге — исчез или снят с витрины`
        + `; кандидаты в блоке «${t.block}»: ${twins.map(describe).join('; ') || 'нет'}`);
      return { value: null, errors };
    }
    const blk = blockOn(blocks, p);
    if (blk !== t.block) { errors.push(`${name}: ${describe(p)} не в блоке «${t.block}» страницы /esim/${slug}/: ${blk ? `сейчас в «${blk}»` : 'страница его не показывает'}`); return { value: null, errors }; }
    for (const [k, v] of Object.entries(t.attrs || {})) {
      if (Number(p[k]) !== v) errors.push(`${name}: ${describe(p)} — ${k} сейчас ${p[k]}, в утверждении ${v}`);
    }
    const r = termPrice(p, t.days);
    if (r.error) { errors.push(`${name}: ${r.error}`); return { value: null, errors }; }
    return { value: { price: r.price, what: `${describe(p)}${t.days ? ` на ${t.days} дн.` : ''}` }, errors };
  }
  const pool = (t.min_of === 'page' ? [...blocks.daily, ...blocks.regional, ...blocks.local]
    : t.min_of === 'volume' ? [...blocks.regional, ...blocks.local] : blocks[t.min_of])
    .filter((p) => inWhere(p, t.where));
  const priced = pool.map((p) => {
    if (t.days !== undefined) { const r = termPrice(p, t.days); return r.error ? null : { p, price: r.price }; }
    const v = purchasablePrice(p);
    return v > 0 ? { p, price: v } : null;
  }).filter(Boolean);
  if (!priced.length) { errors.push(`${name}: min_of «${t.min_of}»${t.where ? ` ${JSON.stringify(t.where)}` : ''}${t.days ? ` на ${t.days} дн.` : ''} — пусто, сравнивать не с чем`); return { value: null, errors }; }
  const best = priced.reduce((m, x) => (x.price < m.price ? x : m));
  return { value: { price: best.price, what: `минимум «${t.min_of}»${t.days ? ` на ${t.days} дн.` : ''} — ${describe(best.p)}` }, errors };
}

/** Problems of one profile's price claims against `packages` (one catalogue snapshot). */
export function evaluateProfile(profile, slug, packages) {
  const out = [];
  const add = (claim, msg) => out.push({ slug, claim: claim && claim.id, msg });
  const claims = profile.price_claims;
  if (claims === undefined) return out;
  if (!Array.isArray(claims)) { add(null, 'price_claims — не массив'); return out; }
  const iso = isoOfSlug(slug);
  if (!iso) { add(null, `страна для /esim/${slug}/ неизвестна`); return out; }
  const blocks = pageBlocks(packages, iso);
  const byId = new Map(packages.map((p) => [p.package_id, p]));
  const ids = new Set();

  for (const claim of claims) {
    const shape = validateClaimShape(claim);
    if (shape.length) { shape.forEach((m) => add(claim, m)); continue; }
    if (ids.has(claim.id)) add(claim, `id «${claim.id}» повторяется`);
    ids.add(claim.id);

    for (const a of claim.anchors) {
      const t = fieldText(profile, a.field);
      if (t === undefined) add(claim, `поля ${a.field} в профиле нет — утверждение осиротело`);
      else if (!norm(t).includes(norm(a.text))) add(claim, `цитаты «${a.text}» нет в ${a.field} — текст изменился; поправьте anchors или удалите утверждение вместе с фразой`);
      else if (!isWholeSentence(t, a.text)) add(claim, `«${a.text}» — не целое предложение ${a.field}`);
    }

    const value = {};
    for (const [name, t] of Object.entries(claim.terms)) {
      const r = resolveTerm(name, t, { blocks, byId, slug });
      for (const m of r.errors) add(claim, m);
      if (r.value) value[name] = r.value;
    }

    claim.assert.forEach((a, i) => {
      const side = (v) => (isNum(v) ? { price: v, what: String(v) } : value[v]);
      const l = side(a.left); const r = side(a.right);
      if (!l || !r) return; // the missing term was already reported
      const k = a.factor ?? 1;
      if (!OPS[a.op](Math.round(l.price * k * 100), Math.round(r.price * 100))) {
        add(claim, `assert[${i}] ${a.left}${k !== 1 ? ` × ${k}` : ''} ${a.op} ${a.right} ложно: ${l.what} = ${l.price} ₽, ${r.what} = ${r.price} ₽ — перепишите фразу (а не утверждение), см. «${claim.anchors[0].text}»`);
      }
    });
  }
  return out;
}

// ------------------------------------------------------------------ completeness

/** Headline sentences that name a price or a price relation and are neither claimed nor waived. */
export function unanchoredHeadlineSentences(profile) {
  const anchored = [
    ...(Array.isArray(profile.price_claims) ? profile.price_claims : []).flatMap((c) => (c && Array.isArray(c.anchors) ? c.anchors : [])),
    ...(Array.isArray(profile.price_claims_waived) ? profile.price_claims_waived : []),
  ];
  const out = [];
  for (const field of HEADLINE_FIELDS) {
    const text = profile[field];
    if (typeof text !== 'string') continue;
    for (const sentence of sentencesOf(text)) {
      if (!PRICE_SENTENCE_RE.test(sentence)) continue;
      if (!anchored.some((a) => a && a.field === field && norm(a.text) === sentence)) out.push({ field, sentence });
    }
  }
  return out;
}

/** A waiver must quote a whole sentence of a headline field and say why. */
export function waiverProblems(profile) {
  const out = [];
  const w = profile.price_claims_waived;
  if (w === undefined) return out;
  if (!Array.isArray(w)) return ['price_claims_waived — не массив'];
  w.forEach((x, i) => {
    if (!x || !HEADLINE_FIELDS.includes(x.field) || typeof x.text !== 'string') { out.push(`price_claims_waived[${i}] — нужны field (${HEADLINE_FIELDS.join(', ')}) и text`); return; }
    if (typeof x.reason !== 'string' || norm(x.reason).length < 20) out.push(`price_claims_waived[${i}] — reason обязателен: почему эту фразу нельзя проверить по каталогу`);
    const t = profile[x.field];
    if (typeof t !== 'string' || !isWholeSentence(t, x.text)) out.push(`price_claims_waived[${i}] — «${x.text}» больше не целое предложение ${x.field}; удалите исключение`);
    for (const k of Object.keys(x)) if (!['field', 'text', 'reason'].includes(k)) out.push(`price_claims_waived[${i}]: неизвестный ключ «${k}»`);
  });
  return out;
}

// ------------------------------------------------------------------ corpus

export function loadProfiles(dir = PROFILE_DIR) {
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ slug: f.slice(0, -5), profile: JSON.parse(readFileSync(join(dir, f), 'utf8')) }))
    .filter((x) => x.profile.status === 'published');
}

/** Every problem of every published profile against one catalogue. */
export function checkCorpus({ catalogFile = CATALOG_FILE, profileDir = PROFILE_DIR, doc } = {}) {
  const packages = loadCatalogDoc(catalogFile, { doc }).packages;
  const problems = [];
  let claims = 0;
  for (const { slug, profile } of loadProfiles(profileDir)) {
    claims += Array.isArray(profile.price_claims) ? profile.price_claims.length : 0;
    problems.push(...evaluateProfile(profile, slug, packages));
    for (const m of waiverProblems(profile)) problems.push({ slug, claim: null, msg: m });
    for (const u of unanchoredHeadlineSentences(profile)) {
      problems.push({ slug, claim: null, msg: `${u.field}: «${u.sentence}» — цена или ценовое сравнение в заголовочном поле без price_claims и без price_claims_waived` });
    }
  }
  return { problems, claims };
}

export const formatProblem = (x) => `/esim/${x.slug}/${x.claim ? ` · ${x.claim}` : ''}: ${x.msg}`;

// ------------------------------------------------------------------ CLI

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--catalog');
  const catalogFile = i >= 0 ? resolve(args[i + 1]) : CATALOG_FILE;
  if (!args.includes('--check')) { console.error('usage: node seo/price-claims.mjs --check [--catalog <file>]'); process.exit(2); }
  const { problems, claims } = checkCorpus({ catalogFile });
  if (problems.length) {
    console.error(`ЦЕНОВЫЕ УТВЕРЖДЕНИЯ РАСХОДЯТСЯ С КАТАЛОГОМ (${problems.length}):`);
    for (const x of problems) console.error(`  ${formatProblem(x)}`);
    process.exit(1);
  }
  console.log(`✓ ${claims} ценовых утверждений держатся на ${catalogFile}`);
}
