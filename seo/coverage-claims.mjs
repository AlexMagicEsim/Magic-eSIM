#!/usr/bin/env node
// Coverage claims — the machine-checkable dependencies of authored prose.
//
// WHY THIS EXISTS
//
//   An authored /esim/<country>/ page says «Замбию на этой странице покрывает
//   только пакет на Африку на 5 ГБ» or «Кубу не покрывает ни один тариф». Those
//   sentences rest on the country lists of specific products, and a provider can
//   change a list on the same product id (it happened ten times in the last
//   eighty-six catalogue snapshots — LATAM 3–20 GB gained Paraguay). Prices were
//   gated against the catalogue; coverage was checked by hand.
//
//   Each profile now carries `coverage_claims`: small explicit assertions that a
//   person writes next to the sentence they guard. This module checks them
//   against assets/catalog.json — the snapshot of the public API that the
//   storefront serves and every other SEO gate reads — with the visibility and
//   block rules of seo/catalogue-facts.mjs, which is a port of the browser code
//   (and a test holds the port to it). It never parses Russian prose, never
//   calls a provider, never looks at a price.
//
// THE CLAIM
//
//   { id, anchors: [{ field: "faq[1].a", text: "verbatim fragment" }],
//     scope: "regional" | "daily" | "local" | "page" | "catalog",
//     page?: "<other slug>",            // evaluate a block of another country page
//     packages?: ["<package_id>", …],   // the basis: must exist, be shown, sit in scope
//     …checks }
//
//   Basis checks (every basis package):  must_cover, must_not_cover,
//     covers_exactly, coverage_count, basis_attrs, distinct_coverage
//   Scope checks (the whole block):      only, scope_is, all_in_scope,
//     none_in_scope, none_together, some_in_scope, not_all_in_scope,
//     max_countries, min_countries, max_coverage, expect_empty, only_attrs
//
//   family: "<regex on the provider name>" narrows the block to one family for
//     the scope checks — so «все пакеты на Африку…» is checked against every
//     Africa package that is or ever will be in the block, not against the ids
//     that existed when the sentence was written. A new member is checked; a
//     withdrawn one is not a false alarm. family_is_scope: every package in the
//     block belongs to the family («под заголовком стоят африканские пакеты»).
//   only_attrs: { data_gb: 5 } with some_in_scope: every package of the block
//     (family) that covers those countries has these attributes — «Замбию
//     покрывает только пакет на 5 ГБ» without pinning which 5 GB product.
//
//   where: { data_gb_min, data_gb_max } narrows the block by volume — «пакеты на
//     3–20 ГБ». attr_bounds: { daily_gb: [0.49, 10] } — the smallest and the
//     largest value in the (narrowed) block are exactly these: «от 500 МБ до 10
//     ГБ в день». Family regexes are case-insensitive, like the storefront's own
//     name matching («LATAM 3 GB» and «LatAm 50 GB» are one family on the card).
//
//   An anchor is a WHOLE sentence of its field (or the whole heading). A
//   fragment let a prose edit outside it — «не покрывает» → «тоже покрывает» —
//   pass unseen.
//
//   Ids, not names: a claim anchored by family title could pass on a look-alike
//   («Africa 3 GB» exists twice, 21 countries apart) and hide the disappearance
//   of the product the sentence was written about. An id that goes away is a red
//   test that names the likely successor — a minute to re-pin, never a silent
//   pass.
//
// FAIL CLOSED. An untrusted catalogue, an unknown key, an unknown country, a
// claim with nothing to check, an anchor no longer on the page, a basis product
// that is missing, hidden or in another block, an empty block asked to vouch for
// «all» or «none» — every one of these is a failure, never a pass.
//
//   node seo/coverage-claims.mjs --check [--catalog <file>] [--previous <file>]
//
// is what the catalogue refresh runs BEFORE it commits a new snapshot.

import { readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coverageCodes, isRussia, isRestricted, isGlobal, isMultiCountry, isDaily } from './catalogue-facts.mjs';
import { validateCatalog } from '../scripts/update-catalog-cache.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CATALOG_FILE = join(ROOT, 'assets', 'catalog.json');
export const PROFILE_DIR = join(ROOT, 'seo', 'content-profiles');

export const SCOPES = Object.freeze(['regional', 'daily', 'local', 'page', 'catalog']);
const SCOPE_TITLE = {
  regional: 'блок «Региональные тарифы»', daily: 'блок «Трафик на каждый день»', local: 'блок местных тарифов',
  page: 'вся страница', catalog: 'все тарифы витрины',
};
const LIST_KEYS = ['must_cover', 'must_not_cover', 'covers_exactly', 'all_in_scope', 'none_in_scope', 'none_together', 'some_in_scope', 'not_all_in_scope'];
const NUM_KEYS = ['coverage_count', 'max_countries', 'min_countries', 'max_coverage'];
const BOOL_KEYS = ['only', 'scope_is', 'distinct_coverage', 'expect_empty'];
const CHECK_KEYS = [...LIST_KEYS, ...NUM_KEYS, ...BOOL_KEYS, 'basis_attrs', 'family_is_scope', 'only_attrs', 'attr_bounds'];
const ALLOWED_KEYS = new Set(['id', 'anchors', 'scope', 'page', 'packages', 'family', 'where', 'note', ...CHECK_KEYS]);
const WHERE_KEYS = new Set(['data_gb_min', 'data_gb_max']);
const BASIS_ATTRS = new Set(['data_gb', 'validity_days', 'topup_available', 'plan_type', 'daily_gb']);
const PROSE_FIELDS = ['title', 'description', 'h1', 'lead', 'intro', 'why', 'faq', 'dual_sim_note'];

const ISO_BY_SLUG = Object.fromEntries(Object.entries(COUNTRY_NAMES).map(([iso, e]) => [e.slug, iso]));
export const isoOfSlug = (slug) => ISO_BY_SLUG[slug] || null;
const knownIso = (c) => typeof c === 'string' && /^[A-Z]{2}$/.test(c) && Object.prototype.hasOwnProperty.call(COUNTRY_NAMES, c);

// ------------------------------------------------------------------ catalogue

/** The trusted snapshot, or a thrown error that names why it is not. */
export function loadCatalogDoc(file = CATALOG_FILE, { doc } = {}) {
  let d = doc;
  if (!d) {
    if (!existsSync(file)) throw new Error(`каталог не найден: ${file}`);
    try { d = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`каталог не разбирается: ${e.message}`); }
  }
  const errors = validateCatalog(d);
  if (errors.length) throw new Error(`каталог не прошёл проверку, покрытию верить нельзя: ${errors.slice(0, 5).join('; ')}`);
  return d;
}

/** Shown anywhere on the storefront: the browser's base filters plus the Global hiding. */
export const storefrontVisible = (p) => !isRussia(p) && !isRestricted(p) && Number(p.price || 0) > 0 && !isGlobal(p);

/** One country page, split the way the page splits it. */
export function pageBlocks(packages, iso) {
  const out = { daily: [], regional: [], local: [] };
  for (const p of packages) {
    if (!storefrontVisible(p) || !coverageCodes(p).includes(iso)) continue;
    if (isDaily(p)) out.daily.push(p);
    else if (isMultiCountry(p)) out.regional.push(p);
    else out.local.push(p);
  }
  return out;
}

const blockOf = (p, iso) => {
  if (!storefrontVisible(p) || !coverageCodes(p).includes(iso)) return null;
  return isDaily(p) ? 'daily' : isMultiCountry(p) ? 'regional' : 'local';
};

/** «Покрытие: N стран» as the card prints it: daily cards count raw codes, volume cards strip RU/UA/BY. */
export function printedCount(p) {
  if (isDaily(p)) return (Array.isArray(p.coverage_country_codes) ? p.coverage_country_codes : []).length;
  return new Set(coverageCodes(p)).size;
}

function scopeSet(scope, packages, iso) {
  if (scope === 'catalog') return packages.filter(storefrontVisible);
  const b = pageBlocks(packages, iso);
  if (scope === 'page') return [...b.daily, ...b.regional, ...b.local];
  return b[scope];
}

// ------------------------------------------------------------------ prose

const norm = (s) => String(s ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
export const sentencesOf = (text) => norm(text).split(/(?<=[.!?…])\s+/).filter(Boolean);
/** True when `frag` is one whole sentence of `text`, or the whole of a one-line field. */
export const isWholeSentence = (text, frag) => {
  const f = norm(frag);
  return f === norm(text) || sentencesOf(text).includes(f);
};

/** «faq[1].a» → the string at that path of the profile, or undefined. */
export function fieldText(profile, field) {
  const m = String(field).match(/^([a-z_][a-z_0-9]*)(?:\[(\d+)\])?(?:\.([a-z]+))?$/);
  if (!m || !PROSE_FIELDS.includes(m[1])) return undefined;
  let v = profile[m[1]];
  if (m[2] !== undefined) v = Array.isArray(v) ? v[Number(m[2])] : undefined;
  if (m[3] !== undefined) v = v && typeof v === 'object' ? v[m[3]] : undefined;
  return typeof v === 'string' ? v : undefined;
}

/** Every customer-facing string of a profile with its locator. */
export function proseFields(profile) {
  const out = [];
  for (const k of ['title', 'description', 'h1', 'lead', 'dual_sim_note']) if (typeof profile[k] === 'string') out.push([k, profile[k]]);
  if (profile.dual_sim_note && typeof profile.dual_sim_note === 'object') {
    for (const k of ['text', 'anchor']) if (typeof profile.dual_sim_note[k] === 'string') out.push([`dual_sim_note.${k}`, profile.dual_sim_note[k]]);
  }
  (profile.intro || []).forEach((t, i) => typeof t === 'string' && out.push([`intro[${i}]`, t]));
  (profile.why || []).forEach((w, i) => { if (w) { if (w.h) out.push([`why[${i}].h`, w.h]); if (w.p) out.push([`why[${i}].p`, w.p]); } });
  (profile.faq || []).forEach((f, i) => { if (f) { if (f.q) out.push([`faq[${i}].q`, f.q]); if (f.a) out.push([`faq[${i}].a`, f.a]); } });
  return out;
}

// ------------------------------------------------------------------ shape

export function validateClaimShape(claim, slug) {
  const p = [];
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) return ['утверждение не объект'];
  for (const k of Object.keys(claim)) if (!ALLOWED_KEYS.has(k)) p.push(`неизвестный ключ «${k}»`);
  if (typeof claim.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(claim.id)) p.push('id обязателен: латиница, цифры, дефис');
  if (!Array.isArray(claim.anchors) || claim.anchors.length === 0) p.push('anchors обязательны: хотя бы одна цитата из текста страницы');
  else claim.anchors.forEach((a, i) => {
    if (!a || typeof a.field !== 'string' || typeof a.text !== 'string' || norm(a.text).length < 4) p.push(`anchors[${i}] — нужны field и text (не короче 4 символов)`);
  });
  if (!SCOPES.includes(claim.scope)) p.push(`scope «${claim.scope}» — допустимо: ${SCOPES.join(', ')}`);
  if (claim.page !== undefined && !isoOfSlug(claim.page)) p.push(`page «${claim.page}» — нет такой страны`);
  if (claim.page !== undefined && claim.scope === 'catalog') p.push('page не имеет смысла для scope «catalog»');
  if (claim.packages !== undefined) {
    if (!Array.isArray(claim.packages) || claim.packages.some((x) => typeof x !== 'string' || !x)) p.push('packages — список package_id');
    else if (new Set(claim.packages).size !== claim.packages.length) p.push('packages — повторяющийся package_id');
  }
  for (const k of LIST_KEYS) if (claim[k] !== undefined) {
    if (!Array.isArray(claim[k]) || claim[k].length === 0) p.push(`${k} — непустой список ISO-кодов`);
    else for (const c of claim[k]) if (!knownIso(c)) p.push(`${k}: «${c}» — неизвестный код страны`);
  }
  for (const k of NUM_KEYS) if (claim[k] !== undefined && !(Number.isInteger(claim[k]) && claim[k] >= 0)) p.push(`${k} — целое ≥ 0`);
  for (const k of BOOL_KEYS) if (claim[k] !== undefined && claim[k] !== true) p.push(`${k} — только true (или ключа нет)`);
  for (const key of ['basis_attrs', 'only_attrs']) if (claim[key] !== undefined) {
    if (!claim[key] || typeof claim[key] !== 'object' || Array.isArray(claim[key]) || !Object.keys(claim[key]).length) p.push(`${key} — непустой объект`);
    else for (const k of Object.keys(claim[key])) if (!BASIS_ATTRS.has(k)) p.push(`${key}.${k} — допустимо: ${[...BASIS_ATTRS].join(', ')}`);
  }
  if (claim.family !== undefined) {
    if (typeof claim.family !== 'string' || !claim.family) p.push('family — регулярное выражение по имени продукта');
    else { try { new RegExp(claim.family); } catch (e) { p.push(`family не компилируется: ${e.message}`); } }
  }
  if (claim.where !== undefined) {
    if (!claim.where || typeof claim.where !== 'object' || !Object.keys(claim.where).length) p.push('where — непустой объект');
    else for (const [k, v] of Object.entries(claim.where)) if (!WHERE_KEYS.has(k) || typeof v !== 'number') p.push(`where.${k} — допустимо: ${[...WHERE_KEYS].join(', ')} (числа)`);
  }
  if (claim.attr_bounds !== undefined) {
    if (!claim.attr_bounds || typeof claim.attr_bounds !== 'object' || !Object.keys(claim.attr_bounds).length) p.push('attr_bounds — непустой объект');
    else for (const [k, v] of Object.entries(claim.attr_bounds)) if (!BASIS_ATTRS.has(k) || !Array.isArray(v) || v.length !== 2 || v.some((x) => typeof x !== 'number')) p.push(`attr_bounds.${k} — [min, max]`);
  }
  if (claim.family_is_scope !== undefined && claim.family_is_scope !== true) p.push('family_is_scope — только true');
  if (claim.family_is_scope && !claim.family) p.push('family_is_scope требует family');
  if (claim.only_attrs && !claim.some_in_scope) p.push('only_attrs требует some_in_scope — какие страны покрывают «только» такие продукты');
  if (!CHECK_KEYS.some((k) => claim[k] !== undefined)) p.push('утверждение ничего не проверяет');
  const needsBasis = ['must_not_cover', 'covers_exactly', 'coverage_count', 'basis_attrs', 'distinct_coverage', 'scope_is'];
  if (claim.must_cover && !(Array.isArray(claim.packages) && claim.packages.length) && !claim.only) p.push('must_cover требует packages');
  if (claim.only && !(Array.isArray(claim.packages) && claim.packages.length) && !claim.family) p.push('only требует packages или family');
  for (const k of needsBasis) if (claim[k] !== undefined && !(Array.isArray(claim.packages) && claim.packages.length)) p.push(`${k} требует packages`);
  if (claim.only && !claim.must_cover) p.push('only требует must_cover — какую страну покрывают «только» эти продукты');
  if (claim.distinct_coverage && !(Array.isArray(claim.packages) && claim.packages.length >= 2)) p.push('distinct_coverage требует хотя бы двух продуктов');
  return p.map((x) => `${slug}/${claim && claim.id}: ${x}`);
}

// ------------------------------------------------------------------ evaluation

const describe = (p) => {
  const vol = isDaily(p) ? `${p.daily_gb} ГБ/день` : `${p.data_gb} ГБ`;
  const term = p.validity_days ? ` · ${p.validity_days} дн.` : '';
  return `${p.package_id} «${p.name}» · ${vol}${term} · покрытие: ${coverageCodes(p).join(', ') || '—'}`;
};
const sameSet = (a, b) => a.length === b.length && [...new Set(a)].every((x) => b.includes(x));

/**
 * @returns {Array<{slug, claim, quote, expected, packages, message}>}
 */
export function evaluateProfile(profile, slug, packages, { previous = null } = {}) {
  const claims = profile && profile.coverage_claims;
  if (claims === undefined) return [];
  const problems = [];
  const iso = isoOfSlug(slug);
  const add = (claim, expected, message, extra = {}) => problems.push({
    slug, claim: claim.id, quote: (claim.anchors || []).map((a) => a.text).join(' … '),
    scope: claim.scope, page: claim.page || slug, expected, message, ...extra,
  });
  if (!Array.isArray(claims)) return [{ slug, claim: '—', quote: '', expected: 'coverage_claims — список', message: 'coverage_claims должен быть списком' }];
  if (!iso) return [{ slug, claim: '—', quote: '', expected: 'страница страны', message: `«${slug}» — нет такой страны в seo/country-names.mjs` }];

  const byId = new Map(packages.map((p) => [p.package_id, p]));
  const prevById = previous ? new Map(previous.map((p) => [p.package_id, p])) : null;
  const seen = new Set();

  for (const claim of claims) {
    const shape = validateClaimShape(claim, slug);
    if (shape.length) { add(claim || {}, 'корректная схема', shape.join('; ')); continue; }
    if (seen.has(claim.id)) { add(claim, 'уникальный id', `повтор id «${claim.id}» на странице`); continue; }
    seen.add(claim.id);

    for (const a of claim.anchors) {
      const t = fieldText(profile, a.field);
      if (t === undefined) add(claim, `текст в поле ${a.field}`, `поля ${a.field} в профиле нет — утверждение осиротело`);
      else if (!norm(t).includes(norm(a.text))) add(claim, `«${a.text}» в ${a.field}`, `цитаты нет в ${a.field} — текст изменился, утверждение осиротело; поправьте anchors или удалите утверждение вместе с фразой`);
      else if (!isWholeSentence(t, a.text)) add(claim, `целое предложение в ${a.field}`, `цитата «${a.text}» — не целое предложение ${a.field}: правка вне фрагмента могла бы изменить смысл незаметно`);
    }

    const pageIso = claim.page ? isoOfSlug(claim.page) : iso;
    const S0 = scopeSet(claim.scope, packages, pageIso);
    const fam = claim.family ? new RegExp(claim.family, 'i') : null;
    const w = claim.where || {};
    const inWhere = (p) => (w.data_gb_min === undefined || Number(p.data_gb) >= w.data_gb_min) && (w.data_gb_max === undefined || Number(p.data_gb) <= w.data_gb_max);
    const S = S0.filter((p) => (!fam || fam.test(p.name)) && inWhere(p));
    const where = (claim.scope === 'catalog' ? SCOPE_TITLE.catalog : `${SCOPE_TITLE[claim.scope]} страницы /esim/${claim.page || slug}/`)
      + (fam ? `, семейство /${claim.family}/` : '') + (claim.where ? `, ${JSON.stringify(claim.where)}` : '');
    const sIds = S0.map((p) => p.package_id);
    if (claim.family_is_scope) {
      const out = S0.filter((p) => !fam.test(p.name));
      if (out.length) add(claim, `family_is_scope: в блоке только /${claim.family}/`, `в ${where} есть продукты другого семейства: ${out.map(describe).join('; ')}`);
      if (!S0.length) add(claim, 'family_is_scope', `${where} пуст`);
    }

    // ---- basis
    const basis = [];
    for (const id of claim.packages || []) {
      const p = byId.get(id);
      if (!p) {
        const prev = prevById && prevById.get(id);
        const ref = prev || null;
        const successors = packages.filter((q) => storefrontVisible(q) && ref
          && (q.name === ref.name || sameSet(coverageCodes(q), coverageCodes(ref))));
        add(claim, `продукт ${id} в каталоге`, `продукта ${id}${ref ? ` «${ref.name}»` : ''} нет в каталоге — исчез, деактивирован или перестал быть публичным`
          + (successors.length ? `; вероятный преемник: ${successors.map(describe).join('; ')}` : '')
          + (!ref ? `; кандидаты в ${where}: ${S.filter((q) => (claim.must_cover || []).every((c) => coverageCodes(q).includes(c))).map(describe).join('; ') || 'нет'}` : ''),
        { packages: [id] });
        continue;
      }
      basis.push(p);
      const blk = blockOf(p, pageIso);
      if (!storefrontVisible(p)) add(claim, `продукт показывается на витрине`, `продукт ${describe(p)} не показывается на витрине (нулевая цена, Россия, RU/UA/BY или глобальный)`, { packages: [id] });
      else if (claim.scope !== 'catalog' && !sIds.includes(id)) add(claim, `продукт в ${where}`, `продукт ${describe(p)} не стоит в ${where}: ${blk ? `сейчас он в блоке «${blk}»` : 'страница его не показывает'}`, { packages: [id] });
    }
    const change = (p) => {
      const prev = prevById && prevById.get(p.package_id);
      if (!prev) return '';
      const a = coverageCodes(prev); const b = coverageCodes(p);
      const lost = a.filter((x) => !b.includes(x)); const got = b.filter((x) => !a.includes(x));
      return lost.length || got.length ? ` [изменение у того же id: ${lost.length ? `убрано ${lost.join(', ')}` : ''}${lost.length && got.length ? '; ' : ''}${got.length ? `добавлено ${got.join(', ')}` : ''}]` : '';
    };
    for (const p of basis) {
      const cov = coverageCodes(p);
      const miss = (claim.must_cover || []).filter((c) => !cov.includes(c));
      if (miss.length) add(claim, `must_cover ${claim.must_cover.join(', ')}`, `${describe(p)} больше не покрывает ${miss.join(', ')}${change(p)}`, { packages: [p.package_id] });
      const extra = (claim.must_not_cover || []).filter((c) => cov.includes(c));
      if (extra.length) add(claim, `must_not_cover ${claim.must_not_cover.join(', ')}`, `${describe(p)} теперь покрывает ${extra.join(', ')}${change(p)}`, { packages: [p.package_id] });
      if (claim.covers_exactly && !sameSet(cov, claim.covers_exactly)) add(claim, `covers_exactly ${claim.covers_exactly.join(', ')}`, `${describe(p)} — состав стран другой${change(p)}`, { packages: [p.package_id] });
      if (claim.coverage_count !== undefined && printedCount(p) !== claim.coverage_count) add(claim, `coverage_count ${claim.coverage_count}`, `${describe(p)} — карточка печатает ${printedCount(p)} стран`, { packages: [p.package_id] });
      for (const [k, v] of Object.entries(claim.basis_attrs || {})) {
        if (p[k] !== v) add(claim, `basis_attrs.${k} = ${JSON.stringify(v)}`, `${describe(p)} — ${k} сейчас ${JSON.stringify(p[k])}`, { packages: [p.package_id] });
      }
    }
    if (claim.distinct_coverage && basis.length >= 2) {
      const keys = basis.map((p) => [...new Set(coverageCodes(p))].sort().join(','));
      if (new Set(keys).size !== keys.length) add(claim, 'distinct_coverage', `у продуктов совпал состав стран: ${basis.map(describe).join('; ')}`);
    }

    // ---- scope
    const covers = (p, list) => list.every((c) => coverageCodes(p).includes(c));
    const needNonEmpty = ['attr_bounds', 'all_in_scope', 'none_in_scope', 'none_together', 'not_all_in_scope', 'max_countries', 'min_countries', 'max_coverage']
      .filter((k) => claim[k] !== undefined);
    if (needNonEmpty.length && S.length === 0) {
      add(claim, needNonEmpty.join(', '), `${where} пуст — утверждение «про все/ни один» не может быть подтверждено на пустом блоке`);
    } else {
      if (claim.only && claim.packages) {
        const holders = S.filter((p) => covers(p, claim.must_cover)).map((p) => p.package_id);
        const extra = holders.filter((x) => !claim.packages.includes(x));
        if (extra.length) add(claim, `only: ${claim.must_cover.join(', ')} покрывают только ${claim.packages.join(', ')}`, `в ${where} ${claim.must_cover.join(', ')} покрывают ещё: ${extra.map((x) => describe(byId.get(x))).join('; ')}`);
      } else if (claim.only && fam) {
        // «… покрывают только карточки семейства»: every package of the WHOLE
        // block that covers the countries must belong to the family, and one must.
        const holders = S0.filter((p) => covers(p, claim.must_cover));
        const extra = holders.filter((p) => !fam.test(p.name));
        if (!holders.length) add(claim, `only: ${claim.must_cover.join(', ')} покрывает семейство /${claim.family}/`, `в ${where} ${claim.must_cover.join(', ')} не покрывает ни один продукт`);
        if (extra.length) add(claim, `only: ${claim.must_cover.join(', ')} покрывают только /${claim.family}/`, `в ${where} ${claim.must_cover.join(', ')} покрывают и продукты другого семейства: ${extra.map(describe).join('; ')}`);
      }
      if (claim.scope_is) {
        const extra = sIds.filter((x) => !claim.packages.includes(x));
        if (extra.length) add(claim, 'scope_is: блок состоит ровно из basis', `в ${where} есть ещё: ${extra.map((x) => describe(byId.get(x))).join('; ')}`);
      }
      if (claim.all_in_scope) {
        const off = S.filter((p) => !covers(p, claim.all_in_scope));
        if (off.length) add(claim, `all_in_scope ${claim.all_in_scope.join(', ')}`, `в ${where} не покрывают ${claim.all_in_scope.join(', ')}: ${off.map(describe).join('; ')}`);
      }
      if (claim.none_in_scope) {
        const off = S.filter((p) => claim.none_in_scope.some((c) => coverageCodes(p).includes(c)));
        if (off.length) add(claim, `none_in_scope ${claim.none_in_scope.join(', ')}`, `в ${where} ${claim.none_in_scope.join(', ')} теперь покрывают: ${off.map((p) => describe(p) + change(p)).join('; ')}`);
      }
      if (claim.none_together) {
        const off = S.filter((p) => covers(p, claim.none_together));
        if (off.length) add(claim, `none_together ${claim.none_together.join('+')}`, `в ${where} ${claim.none_together.join(' и ')} вместе покрывают: ${off.map(describe).join('; ')}`);
      }
      if (claim.not_all_in_scope && S.every((p) => covers(p, claim.not_all_in_scope))) {
        add(claim, `not_all_in_scope ${claim.not_all_in_scope.join(', ')}`, `в ${where} ${claim.not_all_in_scope.join(', ')} теперь покрывают все продукты — «только часть» больше не верно`);
      }
      if (claim.max_countries !== undefined) {
        const off = S.filter((p) => printedCount(p) > claim.max_countries);
        if (off.length) add(claim, `max_countries ${claim.max_countries}`, `в ${where} есть продукты шире: ${off.map(describe).join('; ')}`);
      }
      if (claim.min_countries !== undefined) {
        const off = S.filter((p) => printedCount(p) < claim.min_countries);
        if (off.length) add(claim, `min_countries ${claim.min_countries}`, `в ${where} есть продукты уже: ${off.map(describe).join('; ')}`);
      }
      for (const [k, [lo, hi]] of Object.entries(claim.attr_bounds || {})) {
        const vals = S.map((p) => Number(p[k]));
        const mn = Math.min(...vals); const mx = Math.max(...vals);
        if (mn !== lo || mx !== hi) add(claim, `attr_bounds.${k} от ${lo} до ${hi}`, `в ${where} ${k} сейчас от ${mn} до ${mx}`);
      }
      if (claim.max_coverage !== undefined) {
        const max = Math.max(...S.map(printedCount));
        if (max !== claim.max_coverage) add(claim, `max_coverage ${claim.max_coverage}`, `в ${where} самый широкий продукт печатает ${max} стран`);
      }
    }
    if (claim.some_in_scope && !S.some((p) => covers(p, claim.some_in_scope))) {
      add(claim, `some_in_scope ${claim.some_in_scope.join('+')}`, `в ${where} больше нет продукта, покрывающего ${claim.some_in_scope.join(' и ')}`);
    }
    if (claim.only_attrs && claim.some_in_scope) {
      const off = S.filter((p) => covers(p, claim.some_in_scope) && Object.entries(claim.only_attrs).some(([k, v]) => p[k] !== v));
      if (off.length) add(claim, `only_attrs ${JSON.stringify(claim.only_attrs)} для ${claim.some_in_scope.join('+')}`, `в ${where} ${claim.some_in_scope.join(' и ')} покрывают и продукты с другими параметрами: ${off.map((p) => `${describe(p)} [${Object.keys(claim.only_attrs).map((k) => `${k}=${JSON.stringify(p[k])}`).join(', ')}]`).join('; ')}`);
    }
    if (claim.expect_empty && S.length) add(claim, 'expect_empty', `${where} больше не пуст: ${S.map(describe).join('; ')}`);
  }
  return problems;
}

/** One human-readable block per problem — what CI prints. */
export function formatProblem(x) {
  return [
    `[coverage] /esim/${x.slug}/ · ${x.claim}`,
    `  текст: «${x.quote}»`,
    `  ожидалось: ${x.expected}${x.scope ? ` (scope: ${x.scope}${x.page && x.page !== x.slug ? `, страница ${x.page}` : ''})` : ''}`,
    `  в каталоге сейчас: ${x.message}`,
  ].join('\n');
}

// ------------------------------------------------------------------ completeness

const COVERAGE_RE = /покрыва|покрыти|покро[ею]т|покрыл|не входит|не входят|входит в|входят в|включа[ею]т|включ[ёе]н|закрыва[ею]т|закро[ею]т|закрыть|действует только|работает только|работать не будет|не работает|в н[её]м нет|в ней нет|в них нет|рассчитан[аоы]? (?:только )?на/i;
/** Accusative and prepositional by the regular endings — enough to notice «Кубу», «Новую Зеландию», «в Камбодже». */
function caseForms(name) {
  if (!name || /^[А-ЯЁ]{2,}/.test(name)) return [];
  const word = (w, kind) => {
    if (!/^[А-ЯЁ]/.test(w)) return w;
    if (/ая$/.test(w)) return w.replace(/ая$/, kind === 'acc' ? 'ую' : 'ой');
    if (/ия$/.test(w)) return w.replace(/ия$/, kind === 'acc' ? 'ию' : 'ии');
    if (/а$/.test(w)) return w.replace(/а$/, kind === 'acc' ? 'у' : 'е');
    if (/я$/.test(w)) return w.replace(/я$/, kind === 'acc' ? 'ю' : 'е');
    if (/[бвгджзклмнпрстфхцчшщ]$/.test(w)) return kind === 'acc' ? w : `${w}е`;
    return w;
  };
  return ['acc', 'prep'].map((k) => name.split(' ').map((w) => word(w, k)).join(' '));
}

const COUNTRY_RE = (() => {
  const forms = new Set();
  for (const e of Object.values(COUNTRY_NAMES)) {
    for (const f of [e.ru, e.gen, ...caseForms(e.ru)]) if (f) forms.add(f);
    if (e.ru && e.gen) {
      let i = 0; while (i < e.ru.length && e.ru[i] === e.gen[i]) i += 1;
      const stem = e.ru.slice(0, i);
      if (stem.length >= 4 && /^[А-ЯЁ]/.test(stem)) forms.add(stem);
    }
  }
  const alt = [...forms].sort((a, b) => b.length - a.length).map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(?<![А-Яа-яЁё])(?:${alt})`);
})();

/** Sentences that read as a coverage statement about a named country but are neither claimed nor waived. */
export function unanchoredCoverageSentences(profile) {
  const anchors = [...(profile.coverage_claims || []).flatMap((c) => (c.anchors || [])),
    ...(profile.coverage_claims_waived || [])];
  const out = [];
  for (const [field, text] of proseFields(profile)) {
    for (const sentence of norm(text).split(/(?<=[.!?…])\s+/)) {
      if (!COVERAGE_RE.test(sentence) || !COUNTRY_RE.test(sentence)) continue;
      const ok = anchors.some((a) => a.field === field && norm(a.text) === sentence);
      if (!ok) out.push({ field, sentence });
    }
  }
  return out;
}

// ------------------------------------------------------------------ corpus

export function loadProfiles(dir = PROFILE_DIR) {
  return Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => [f.slice(0, -5), JSON.parse(readFileSync(join(dir, f), 'utf8'))]));
}

export function checkCorpus({ catalogFile = CATALOG_FILE, previousFile = null, profileDir = PROFILE_DIR } = {}) {
  let doc;
  try { doc = loadCatalogDoc(catalogFile); } catch (e) {
    return { problems: [{ slug: '—', claim: 'catalogue', quote: '', expected: 'доверенный снимок каталога', message: e.message }], stats: { pages: 0, claims: 0 } };
  }
  let previous = null;
  if (previousFile && existsSync(previousFile)) {
    try { previous = JSON.parse(readFileSync(previousFile, 'utf8')).packages || null; } catch { previous = null; }
  }
  const problems = []; let pages = 0; let claims = 0;
  for (const [slug, profile] of Object.entries(loadProfiles(profileDir))) {
    if (profile.status !== 'published' || profile.coverage_claims === undefined) continue;
    pages += 1; claims += Array.isArray(profile.coverage_claims) ? profile.coverage_claims.length : 0;
    problems.push(...evaluateProfile(profile, slug, doc.packages, { previous }));
  }
  return { problems, stats: { pages, claims, generated_at: doc.generated_at } };
}

// ------------------------------------------------------------------ CLI

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invoked) {
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
  const catalogFile = arg('--catalog') ? resolve(arg('--catalog')) : CATALOG_FILE;
  const previousFile = arg('--previous') ? resolve(arg('--previous')) : null;
  const { problems, stats } = checkCorpus({ catalogFile, previousFile });
  if (!problems.length) {
    console.log(`✓ coverage claims: ${stats.claims} утверждений на ${stats.pages} страницах верны (снимок ${stats.generated_at})`);
    process.exit(0);
  }
  const head = 'ОБНОВЛЕНИЕ КАТАЛОГА ЗАБЛОКИРОВАНО: новый каталог опровергает SEO-утверждение о покрытии.\n'
    + 'Это не сбой автоматизации — нужно ручное решение: поправить фразу на странице (и её coverage_claims) '
    + 'или перепривязать утверждение к новому продукту. Пока это не сделано, витрина остаётся на прежнем снимке каталога, '
    + 'и каждый запуск по расписанию будет падать с этим же сообщением.';
  console.error(`\n${head}\n`);
  for (const x of problems) console.error(formatProblem(x) + '\n');
  console.error(`Итого: ${problems.length} ${problems.length === 1 ? 'проблема' : 'проблем(ы)'}; проверено ${stats.claims} утверждений на ${stats.pages} страницах.`);
  if (process.env.GITHUB_ACTIONS) {
    for (const x of problems) {
      const msg = `/esim/${x.slug}/ · ${x.claim}: ${x.message}`.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
      console.log(`::error title=SEO coverage fact is stale — catalogue refresh blocked::${msg}`);
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ⛔ ${head.split('\n')[0]}\n\n${head.split('\n').slice(1).join(' ')}\n\n`
        + problems.map((x) => `\`\`\`\n${formatProblem(x)}\n\`\`\``).join('\n\n') + '\n');
    }
  }
  process.exit(1);
}
