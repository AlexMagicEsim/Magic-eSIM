// Operator names in authored prose, checked against the BLOCK the sentence is about.
//
// WHY THIS EXISTS
//
//   Until 2026-10-29 no gate compared an operator name in a profile with the
//   catalogue at all. `checkNetworks` in content-review.mjs refused only «три
//   сети», and the one thing the fact sheet knew about operators — `networks` —
//   was ONE set merged from every package of the country, local, regional and
//   daily alike. A sentence «местные тарифы Чили — на сети WOM» would have been
//   fine by that set even after catalogue b493e787 moved all ten local Chilean
//   packages from WOM to movistar / CLARO CL: WOM was still listed by a
//   multi-country daily package. The UAE answer said «у тарифа на 1 ГБ на 7
//   дней — Etisalat» long after that package had become Du.
//
//   The fix has the shape of coverage_claims and price_claims: the person who
//   writes a sentence naming an operator writes, next to it, WHICH BLOCK it is
//   about, and this module checks that block.
//
// THE BLOCKS ARE THE PAGE'S, NOT A NEW DEFINITION
//
//   The country page draws exactly the lists of the backend layout the snapshot
//   carries: `assortment.countries[ISO].{local, regional, daily}` in
//   assets/catalog.json (lib/assortmentLayout.js on the backend;
//   assets/assortment-view.js in the browser, which decides nothing). A «global»
//   plan has no block of its own: where the layout shows one (Best World) it is
//   in `regional`, so it is checked there. No layout → nothing can be checked →
//   every operator sentence fails, never passes.
//
//   «Listed» means the package's own `networks` field in the catalogue. The RU
//   card does not print a full operator list (the «Сеть» row prints
//   generations; an operator appears only as a chip telling look-alike siblings
//   apart), so the authored sentences say «по данным каталога» — and the
//   catalogue field is what they are checked against.
//
// THE CLAIM (profile.network_claims)
//
//   { id, anchors: [{ field, text }],          // whole sentences, as everywhere
//     block: "local" | "regional" | "daily",   // the block the sentence is about
//     operators: ["Lao Telecom"],              // every one is listed in that block
//     packages?: ["<package_id>", …],          // narrower basis: each is IN the
//                                              //   block and lists every operator
//     every?: true,     // every package of the basis/block that names a network names all of them
//     only?: true,      // no package of the basis/block names an operator outside the list
//     all_listed?: true // every package of the basis/block names some network («все местные…»)
//     exclusive?: true  // no OTHER block of the page lists these operators («только в региональных»)
//     note? }
//
//   A sentence about two blocks («у местных — Du, у многострановых — Etisalat»)
//   carries two claims on the same anchor.
//
// A SENTENCE WITH NO BLOCK
//
//   Every sentence of a profile that names an operator must be covered: each
//   name it contains must be in the `operators` of a claim anchored on that very
//   sentence, or the sentence must be waived. Otherwise it FAILS — deliberately:
//   guessing the block from words («местн…», «регионал…») is the regex-on-prose
//   game every other gate here lost, and «accept if every block lists it» would
//   let a sentence go stale the day one block drops the name. A writer who cannot
//   say which block a sentence is about has written a sentence nobody can check.
//
// A WAIVER (profile.network_claims_waived) is for a sentence about the country's
//   operators that is NOT about our plans — a regulator's 5G licences, TfL's
//   Wi-Fi partners: { field, text, reason, source }, where `source` is an https
//   URL that the profile's own `sources` list. It never legalises a claim about
//   a block; such a claim needs `network_claims`.
//
// EN / ES authored content (seo/content-en, seo/content-es) and the six legacy
// pages have no claim format: an operator name there fails outright
// (seo/test-network-claims.mjs).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { proseFields, sentencesOf, isWholeSentence, fieldText, isoOfSlug } from './coverage-claims.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CATALOG_FILE = join(ROOT, 'assets', 'catalog.json');

export const BLOCKS = Object.freeze(['local', 'regional', 'daily']);
export const BLOCK_TITLE = Object.freeze({
  local: 'блок местных тарифов («Тарифы для …»)',
  regional: 'блок «Региональные тарифы»',
  daily: 'блок «Трафик на каждый день»',
});
const ALLOWED_KEYS = new Set(['id', 'anchors', 'block', 'operators', 'packages', 'every', 'only', 'all_listed', 'exclusive', 'note']);
const WAIVER_KEYS = new Set(['field', 'text', 'reason', 'source']);

const norm = (s) => String(s ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
const key = (s) => norm(s).toLowerCase();

// ------------------------------------------------------------------ catalogue

let docCache = null;
export function loadCatalogDoc(file = CATALOG_FILE) {
  if (file === CATALOG_FILE && docCache) return docCache;
  const d = JSON.parse(readFileSync(file, 'utf8'));
  if (file === CATALOG_FILE) docCache = d;
  return d;
}

export const operatorsOf = (p) => [...new Set((Array.isArray(p && p.networks) ? p.networks : [])
  .map((n) => norm(n && n.operator)).filter(Boolean))];

/**
 * One country page's blocks as the layout draws them: { local, regional, daily }
 * of { id, name, operators }, or null when the snapshot has no layout for it.
 */
export function blockRows(doc, iso) {
  const entry = doc && doc.assortment && doc.assortment.countries && doc.assortment.countries[iso];
  if (!entry) return null;
  const byId = new Map((doc.packages || []).map((p) => [p.package_id, p]));
  const out = {};
  for (const b of BLOCKS) {
    out[b] = (Array.isArray(entry[b]) ? entry[b] : []).map((id) => byId.get(id)).filter(Boolean)
      .map((p) => ({ id: p.package_id, name: p.name, operators: operatorsOf(p) }));
  }
  return out;
}

/** The fact sheet's view: per block, the sorted set of operators its packages list. */
export function networksByBlock(doc, iso) {
  const rows = blockRows(doc, iso);
  if (!rows) return null;
  const out = {};
  for (const b of BLOCKS) out[b] = [...new Set(rows[b].flatMap((r) => r.operators))].sort();
  return out;
}

// ------------------------------------------------------------------ detection

// Operator names that are not in today's catalogue but a page could still name —
// so that a name the provider dropped (Digicel on Curaçao) is detected, not
// silently ignored because the lexicon forgot it. Cyrillic spellings included.
export const EXTRA_OPERATORS = Object.freeze([
  'Digicel', 'Etisalat', 'WOM', 'Vodafone', 'Movistar', 'Claro', 'Entel', 'Telcel', 'AT&T', 'Verizon', 'T-Mobile',
  'Turk Telekom', 'Türk Telekom', 'Turkcell', 'NTT Docomo', 'Docomo', 'Rakuten', 'SoftBank', 'KDDI', 'SK Telecom', 'SKT',
  'LG U+', 'Chunghwa', 'FarEasTone', 'Taiwan Mobile', 'China Mobile', 'China Unicom', 'China Telecom', 'SmarTone', 'CMHK',
  'Singtel', 'StarHub', 'Maxis', 'CelcomDigi', 'U Mobile', 'Telkomsel', 'Indosat', 'Viettel', 'Vinaphone', 'MobiFone',
  'AIS', 'DTAC', 'TrueMove', 'Dialog', 'Mobitel', 'Ncell', 'Grameenphone', 'Robi', 'Jio', 'Airtel', 'Dhiraagu', 'Ooredoo',
  'Zain', 'Mobily', 'Omantel', 'Batelco', 'Asiacell', 'Korek', 'Umniah', 'Cellcom', 'Pelephone', 'Partner', 'Cosmote',
  'Swisscom', 'Sunrise', 'Telekom', 'Magenta', 'Telenor', 'Telia', 'Yettel', 'Bouygues', 'SFR', 'Iliad', 'Proximus',
  'Kyivstar', 'Beeline', 'Kcell', 'Activ', 'Altel', 'Ucell', 'Ucom', 'Vivacell', 'Magti', 'Geocell', 'Silknet', 'Azercell',
  'Bakcell', 'MegaFon', 'Megafon', 'Tele2', 'Inwi', 'Maroc Telecom', 'Djezzy', 'Mobilis', 'Tunisie Telecom', 'Safaricom',
  'Vodacom', 'MTN', 'Telstra', 'Optus', 'Chippie', 'FLOW', 'Flow', 'Liberty', 'Cable & Wireless', 'Three', 'DIGI',
  'Билайн', 'МТС', 'МегаФон', 'Мегафон', 'Теле2', 'Водафон', 'Этисалат', 'Магти', 'Билайн', 'Кселл', 'Актив', 'Алтел',
]);

// Names that are also ordinary words («Free Wi-Fi», «Brunei Plus», «One for…»),
// numbers («3») or two letters. They count only in a sentence that talks about
// networks or operators; «3» and lower-case-only spellings never count.
const AMBIGUOUS = new Set([
  'One', 'Free', 'Plus', 'Play', 'Base', 'POST', 'Sure', 'Epic', 'Salt', 'Nova', 'Personal', 'Liberty', 'Tango',
  'Wind', 'Vala', 'VIP', 'SMART', 'Smart', 'Three', 'Hot', 'IDEA', 'Glo', 'Vivo', 'VIVA', 'Viva', 'Orange', 'Claro',
  'Spark', 'Digi', 'Flow', 'FLOW', 'Partner', 'Activ', 'Telekom', 'Magenta', 'Sunrise', 'GO', 'DS', 'JT', 'EE', 'O2',
  'M1', 'XL', 'Du', 'MEO', 'NOS', 'Mobilis', 'Robi', 'Hutch', 'Vini', 'Telma', 'Emtel', 'Dialog', 'Jazz', 'Elisa',
  'Bite', 'Free Mobile', 'Hot Mobile', 'Madar',
]);
// The same, compared without case: «IDEA» / «Idea», «SMART» / «Smart», «free».
const AMBIGUOUS_LOWER = new Set([...AMBIGUOUS].map((n) => n.toLowerCase()).concat(['free', 'bob', 'vip', 'my.t']));
const NEVER = new Set(['3']);
const CUE = /(?<![\p{L}])(?:оператор\p{L}*|сет(?:ь|и|ей|ях|ям|ью)|operators?|carriers?|networks?|operador(?:es)?|red(?:es)?)(?![\p{L}])/iu;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Every operator name the catalogue lists plus EXTRA_OPERATORS — the detector's vocabulary.
 * Unambiguous names match in any case («movistar» / «Movistar» are both catalogue
 * spellings); ambiguous ones match only as written and only beside a network word.
 */
export function operatorLexicon(packages) {
  const names = new Set(EXTRA_OPERATORS);
  for (const p of packages || []) for (const n of operatorsOf(p)) names.add(n);
  const ambiguous = [];
  const plain = [];
  for (const n of names) {
    if (n.length < 2 || NEVER.has(n)) continue;
    if (AMBIGUOUS.has(n) || AMBIGUOUS_LOWER.has(n.toLowerCase())) {
      if (/^[\p{Lu}\d]/u.test(n)) ambiguous.push(n); // a lower-case «free» / «bob» is a word, never a name
    } else plain.push(n);
  }
  const alt = (list) => list.sort((a, b) => b.length - a.length).map(escapeRe).join('|');
  const edge = (body, flags) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, flags);
  return {
    names: [...plain, ...ambiguous].sort(),
    plain: edge(alt(plain), 'giu'),
    ambiguous: ambiguous.length ? edge(alt(ambiguous), 'gu') : null,
  };
}

/** The operator names one sentence contains (as written), ambiguous ones only beside a network word. */
export function operatorMentions(sentence, lexicon) {
  const s = String(sentence);
  const out = [];
  const push = (n) => { if (!out.some((x) => x.toLowerCase() === n.toLowerCase())) out.push(n); };
  for (const m of s.matchAll(lexicon.plain)) push(m[0]);
  if (lexicon.ambiguous && CUE.test(s)) for (const m of s.matchAll(lexicon.ambiguous)) push(m[0]);
  return out;
}

// ------------------------------------------------------------------ evaluation

function shapeProblems(c) {
  const p = [];
  if (!c || typeof c !== 'object' || Array.isArray(c)) return ['утверждение не объект'];
  for (const k of Object.keys(c)) if (!ALLOWED_KEYS.has(k)) p.push(`неизвестный ключ «${k}»`);
  if (typeof c.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(c.id)) p.push('id обязателен: латиница, цифры, дефис');
  if (!Array.isArray(c.anchors) || !c.anchors.length) p.push('anchors обязательны');
  else c.anchors.forEach((a, i) => { if (!a || typeof a.field !== 'string' || typeof a.text !== 'string') p.push(`anchors[${i}] — нужны field и text`); });
  if (!BLOCKS.includes(c.block)) p.push(`block «${c.block}» — допустимо: ${BLOCKS.join(', ')}`);
  if (!Array.isArray(c.operators) || !c.operators.length || c.operators.some((x) => typeof x !== 'string' || !norm(x))) p.push('operators — непустой список имён');
  if (c.packages !== undefined && (!Array.isArray(c.packages) || !c.packages.length || c.packages.some((x) => typeof x !== 'string' || !x))) p.push('packages — список package_id');
  for (const k of ['every', 'only', 'all_listed', 'exclusive']) if (c[k] !== undefined && c[k] !== true) p.push(`${k} — только true (или ключа нет)`);
  return p;
}

const listing = (rows) => BLOCKS.map((b) => `${b}: ${[...new Set(rows[b].flatMap((r) => r.operators))].sort().join(', ') || '—'}`).join('; ');
const where = (rows, name) => BLOCKS.filter((b) => rows[b].some((r) => r.operators.some((o) => key(o) === key(name))));

/**
 * @param profile  a content profile
 * @param slug     its country slug
 * @param opts.doc      the catalogue snapshot (packages + assortment); default assets/catalog.json
 * @param opts.lexicon  operatorLexicon(...) — default from the same snapshot
 * @returns {string[]} problems, Russian, one line each
 */
export function checkNetworkClaims(profile, slug, { doc = loadCatalogDoc(), lexicon } = {}) {
  const lex = lexicon || operatorLexicon(doc.packages);
  const problems = [];
  const iso = isoOfSlug(slug);
  const rows = iso ? blockRows(doc, iso) : null;
  const claims = profile.network_claims === undefined ? [] : profile.network_claims;
  const waivers = profile.network_claims_waived === undefined ? [] : profile.network_claims_waived;
  if (!Array.isArray(claims)) return ['network_claims должен быть списком'];
  if (!Array.isArray(waivers)) return ['network_claims_waived должен быть списком'];

  // Which names each anchored sentence is vouched for.
  const vouched = new Map();      // `${field}|${sentence}` → Set(lower-case names)
  const waived = new Set();
  const seen = new Set();
  for (const c of claims) {
    const shape = shapeProblems(c);
    if (shape.length) { problems.push(`network_claims/${c && c.id}: ${shape.join('; ')}`); continue; }
    if (seen.has(c.id)) { problems.push(`network_claims: повтор id «${c.id}»`); continue; }
    seen.add(c.id);
    for (const a of c.anchors) {
      const t = fieldText(profile, a.field);
      if (t === undefined) { problems.push(`network_claims/${c.id}: поля ${a.field} нет — утверждение осиротело`); continue; }
      if (!isWholeSentence(t, a.text)) { problems.push(`network_claims/${c.id}: «${norm(a.text).slice(0, 80)}» — не целое предложение ${a.field} (или текст изменился)`); continue; }
      const k = `${a.field}|${norm(a.text)}`;
      if (!vouched.has(k)) vouched.set(k, new Set());
      for (const o of c.operators) vouched.get(k).add(key(o));
      const named = operatorMentions(a.text, lex).map(key);
      for (const o of c.operators) if (!named.includes(key(o))) problems.push(`network_claims/${c.id}: оператора «${o}» нет в цитате ${a.field} — утверждение не о той фразе`);
    }
    if (!rows) { problems.push(`network_claims/${c.id}: в снимке нет раскладки страницы ${slug} — блок «${c.block}» проверить нельзя`); continue; }
    const block = rows[c.block];
    let scope = block;
    if (c.packages) {
      scope = [];
      for (const id of c.packages) {
        const r = block.find((x) => x.id === id);
        if (!r) {
          const elsewhere = BLOCKS.filter((b) => rows[b].some((x) => x.id === id));
          problems.push(`network_claims/${c.id}: продукт ${id} не стоит в ${BLOCK_TITLE[c.block]}${elsewhere.length ? ` (сейчас: ${elsewhere.join(', ')})` : ' — страница его не показывает'}`);
        } else scope.push(r);
      }
    }
    for (const o of c.operators) {
      if (!block.some((r) => r.operators.some((x) => key(x) === key(o)))) {
        const other = where(rows, o);
        problems.push(`network_claims/${c.id}: «${o}» не указан ни у одного тарифа в ${BLOCK_TITLE[c.block]} страницы ${slug}`
          + (other.length ? ` — он есть только в: ${other.map((b) => BLOCK_TITLE[b]).join(', ')}` : ' — ни в одном блоке страницы')
          + `; операторы по блокам — ${listing(rows)}`);
      }
      for (const r of c.packages ? scope : []) {
        if (!r.operators.some((x) => key(x) === key(o))) problems.push(`network_claims/${c.id}: у продукта ${r.id} «${r.name}» оператор «${o}» не указан (сейчас: ${r.operators.join(', ') || '—'})`);
      }
    }
    if (c.every) for (const r of scope) {
      if (r.operators.length && c.operators.some((o) => !r.operators.some((x) => key(x) === key(o)))) problems.push(`network_claims/${c.id}: every — у ${r.id} «${r.name}» указаны ${r.operators.join(', ')}`);
    }
    if (c.only) for (const r of scope) {
      const extra = r.operators.filter((x) => !c.operators.some((o) => key(o) === key(x)));
      if (extra.length) problems.push(`network_claims/${c.id}: only — у ${r.id} «${r.name}» указан ещё ${extra.join(', ')}`);
    }
    if (c.all_listed) for (const r of scope) {
      if (!r.operators.length) problems.push(`network_claims/${c.id}: all_listed — у ${r.id} «${r.name}» оператор не указан вовсе`);
    }
    if (c.exclusive) for (const o of c.operators) {
      const other = where(rows, o).filter((b) => b !== c.block);
      if (other.length) problems.push(`network_claims/${c.id}: exclusive — «${o}» указан и в: ${other.map((b) => BLOCK_TITLE[b]).join(', ')}`);
    }
    if ((c.every || c.only || c.all_listed) && !scope.length) problems.push(`network_claims/${c.id}: ${BLOCK_TITLE[c.block]} пуст — «все/только» подтвердить нечем`);
  }

  const sources = (profile.sources || []).map((s) => String(s));
  for (const [i, w] of waivers.entries()) {
    const bad = [];
    if (!w || typeof w !== 'object') { problems.push(`network_claims_waived[${i}]: не объект`); continue; }
    for (const k of Object.keys(w)) if (!WAIVER_KEYS.has(k)) bad.push(`неизвестный ключ «${k}»`);
    if (typeof w.reason !== 'string' || norm(w.reason).length < 20) bad.push('reason — зачем фраза не о тарифах (≥ 20 символов)');
    let url = null;
    try { url = new URL(String(w.source)); } catch { /* reported below */ }
    if (!url || url.protocol !== 'https:') bad.push('source — https-ссылка на первоисточник');
    else if (!sources.some((s) => s.startsWith(w.source) || s.includes(` ${w.source}`) || s.includes(`; ${w.source}`))) bad.push(`source ${w.source} не указан в sources профиля`);
    const t = fieldText(profile, w.field);
    if (t === undefined) bad.push(`поля ${w.field} нет`);
    else if (!isWholeSentence(t, w.text)) bad.push(`«${norm(w.text).slice(0, 80)}» — не целое предложение ${w.field} (или текст изменился)`);
    else if (!operatorMentions(w.text, lex).length) bad.push('во фразе нет имени оператора — исключение устарело, удалите его');
    if (bad.length) problems.push(`network_claims_waived[${i}]: ${bad.join('; ')}`);
    else waived.add(`${w.field}|${norm(w.text)}`);
  }

  // Completeness: no operator name without a block.
  for (const [field, text] of proseFields(profile)) {
    for (const sentence of sentencesOf(text)) {
      const names = operatorMentions(sentence, lex);
      if (!names.length) continue;
      const k = `${field}|${sentence}`;
      if (waived.has(k)) continue;
      const ok = vouched.get(k) || new Set();
      const missing = names.filter((n) => !ok.has(key(n)));
      if (missing.length) {
        const hint = rows ? missing.map((n) => `${n}: ${where(rows, n).join(', ') || 'ни в одном блоке'}`).join('; ') : 'раскладки нет';
        problems.push(`оператор ${missing.map((n) => `«${n}»`).join(', ')} в ${field} без network_claims — о каком блоке фраза (local / regional / daily)? `
          + `Сейчас указан в блоках — ${hint}. Фраза: «${sentence.slice(0, 160)}»`);
      }
    }
  }
  return [...new Set(problems)];
}

/** Plain text (legacy HTML, EN/ES content): any operator name is a failure — there is no claim format there. */
export function bareMentions(texts, lexicon) {
  const out = [];
  for (const t of texts) for (const s of sentencesOf(t)) for (const n of operatorMentions(s, lexicon)) out.push({ name: n, sentence: s });
  return out;
}
