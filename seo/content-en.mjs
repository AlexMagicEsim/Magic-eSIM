#!/usr/bin/env node
/* AUTHORED ENGLISH COUNTRY CONTENT — the loader and the validator (international SEO, 2026-10-27).
 *
 * Every English country page is one template (Thailand vs Japan 97 % alike). A country may carry an authored text in
 * seo/content-en/<slug>.json; seo/build-locale-pages.mjs then takes the page's <title>, description, share tags and
 * lead from it and renders its sections, its questions and its related destinations in the static HTML, after «Plans
 * at a glance» and before «Before you buy». A slug without a file keeps the template, byte for byte.
 *
 * THE FILE IS REFUSED, NOT REPAIRED. validateContent() lists every problem; the build throws on any, and
 * `node seo/content-en.mjs --check [slug…]` prints them and exits 1. The rules (seo/test-content-en.mjs proves each
 * one fires on a sentence written to break it):
 *   schema       the shape below, no unknown key, the slug = the file = a catalogue page, the ISO = that page's;
 *   title        ≤ 60 characters, ends « | Magic eSIM»;   description 120–160, ends « Online payment is not available yet.»;
 *   counts       2–4 sections (200–550 words of section prose), 4–6 questions, 3–6 related pages (existing, not itself);
 *   numbers      no plan figure in prose: a volume (GB, MB), a speed, a currency sign or a US-dollar amount, «from $»,
 *                «N plans / countries / destinations»; a day / week / month figure only in a sentence a source backs;
 *   guards       seo/claim-guards.mjs English patterns network, template, features, marketing, suppliers, money, delivery,
 *                devices, installEarly, reusableQr, cardRow — plus `tech` (the words the Playwright error check reads);
 *   plan claims  a sentence that speaks of a plan block (local / regional / daily / multi-country plans, «plans that
 *                cover …») is inside a plan_claims quote, and every quote is in the prose and holds against
 *                seo/global-plan-facts.json;
 *   countries    a sentence naming ANOTHER catalogue country is inside a plan_claims quote (which then lists its code)
 *                or is backed by a source (its `sentences`, or `supports` naming that country);
 *   sources      ≥ 1, https, a title, `checked` a real date not in the future, `supports`; no forum, no competitor;
 *                an optional `review_by` (a rule that changes — a regulator's, a rollout's): after `checked`, at most six
 *                months later, and once it has passed the file is refused until someone re-opens the source and moves
 *                both dates (the dated tripwire the Russian `network_facts` carry, seo/content-review.mjs);
 *   china        on CN, no promise to get past the restrictions (bypass, unblock, VPN-free, access Google / …);
 *   markup       plain text; the only markup is a link [text](/en/…/) to a page that exists;
 *   across files (checkAll) no shared title or description, no question, answer or paragraph that is another
 *                country's with the name swapped.
 *
 * PER LANGUAGE (2026-10-27, ES): the same schema and the same rules hold for every language in CONTENT_LANGS — a
 * language's files live in seo/content-<code>/<slug>.json (English stays in seo/content-en/) and are read only by
 * that language's pages. What differs is written once per language in its RULES entry: the head's suffix, the words
 * the page adds (faq / related headings), the block words of plan_claims, the plan-figure and day-figure patterns, the
 * names and aliases of countries (seo/country-names-i18n.mjs in that language), the claim guards (seo/claim-guards.mjs
 * table of that language), the link prefix (/<prefix>/…/) and the China words. English is the default everywhere, so
 * every English call and result is what it was. The cross-file check runs WITHIN one language: a Spanish file is the
 * English one's translation by design.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CLAIM_GUARDS } from './claim-guards.mjs';
import { countryName } from './country-names-i18n.mjs';
import { locale } from './locales.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** The folder of a language's content files: seo/content-<code>/. */
export const contentDir = (lang = 'en') => join(ROOT, `seo/content-${lang}`);
export const CONTENT_DIR = contentDir('en');

/* The English words the authored part of a page adds. */
export const CONTENT_COPY = Object.freeze({
  faqTitle: (name) => `Questions about ${name}`,
  relatedTitle: 'Related destinations',
});

export const LIMITS = Object.freeze({
  titleMax: 60, titleSuffix: ' | Magic eSIM',
  descriptionMin: 120, descriptionMax: 160, descriptionSuffix: ' Online payment is not available yet.',
  leadMax: 300,
  sections: [2, 4], sectionWords: [200, 550], paragraphs: [1, 5], list: [1, 8],
  faq: [4, 6], related: [3, 6], sources: 1,
});

export const KINDS = Object.freeze(['local', 'daily', 'regional_also', 'no_local', 'no_daily', 'no_regional']);
export const GUARD_IDS = Object.freeze(['network', 'template', 'features', 'marketing', 'suppliers', 'money', 'delivery',
  'devices', 'installEarly', 'reusableQr', 'cardRow']);

/* The words test/e2e/en-recovery.spec.js reads as «a technical message leaked onto the page» (its TECH, minus
 * `provider`, which `suppliers` already refuses): authored prose on a page that spec opens must not trip it. */
// Whole words only (2026-10-27): as substrings they refused «Henan», «maintenance», «financial» — words, not leaks.
const TECH = /\b(4\d\d|5\d\d)\b|\b(error|stack|undefined|null|NaN|exception|esimaccess|mobimatter)\b/i;

/* Plan figures. A plan's volume, speed, price or count lives in «Plans at a glance» and the live cards, which the
 * catalogue keeps true — never in a sentence nobody refreshes. */
const SPELLED = 'two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|dozens? of|hundreds? of';
const NUMBER_RULES = Object.freeze([
  ['a data volume or speed', /\d[\d.,]*\s*(GB|MB|GiB|MiB|TB|gigabytes?|megabytes?|Gbps|Mbps|Kbps)(?![\p{L}])/iu],
  ['a currency sign', /[$€£¥₩₽฿₫₹]|US\$/u],
  ['a US-dollar amount', /\bUSD\s?\d|\d\s?USD\b|\d[\d.,]*\s*(US\s+)?dollars?\b/i],
  ['«from» a price', /\bfrom\s+\$/i],
  ['a count of plans or places', new RegExp(`\\d+\\s+(local\\s+|regional\\s+|daily\\s+)?(plans?|options?|countries|destinations?)\\b|\\b(${SPELLED})\\s+(local\\s+|regional\\s+|daily\\s+)?(plans|options|countries|destinations)\\b`, 'i')],
]);
const DAY_FIGURE = /\d+\s*(-|\s)?\s*(days?|nights?|weeks?|months?)\b/i;

/* A sentence that speaks of the page's plan blocks or of what a plan covers. */
export const BLOCK_MENTION = /\b(local|regional|daily|multi-country|country-only|single-country)\s+(e?SIM\s+)?(plans?|options?|eSIMs?|data|blocks?)\b|\bplans?\s+(that|which)\s+(also\s+)?covers?\b/i;

/* CN: an eSIM is not a way around the restrictions, and a page may never say it is (spec rule 8). */
const CHINA_PROMISE = /bypass|unblock|VPN-free|access (Google|WhatsApp|Facebook|Instagram)/i;

/* Sources that are never a source: forums, Q&A, and other eSIM sellers' blogs. */
const BANNED_HOSTS = /(^|\.)(reddit\.com|quora\.com|tripadvisor\.[a-z.]+|stackexchange\.com|facebook\.com|medium\.com|airalo\.com|holafly\.com|getnomad\.app|nomadesim\.com|saily\.com|ubigi\.com|yesim\.app|esimdb\.com|esim\.net|mobimatter\.com|esimaccess\.com|simoptions\.com|jetpacglobal\.com|maya\.net|truely\.com)$/i;

/* Other names a traveller writes for a catalogue country (the dictionary name stays the first). */
const ALIASES = Object.freeze({
  TR: ['Turkey'], GB: ['UK', 'Britain', 'Great Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland'],
  US: ['USA', 'America'], KR: ['Korea'], AE: ['UAE', 'Emirates'], CZ: ['Czech Republic'], CI: ["Côte d'Ivoire", 'Ivory Coast'],
  MO: ['Macao', 'Macau'], NL: ['Holland'],
});

/* ---------- the languages ---------- */

/* Spanish (neutral, «tú»; seo/claim-guards.mjs es). Spanish says the figure before the noun («tres planes locales»),
 * writes prices «USD 12.99» on the site (banned in prose like every price), and marks a question with «¿ … ?». */
const ES_SPELLED = 'dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|cincuenta|decenas de|cientos de|docenas de';
const ES_NOUNS = '(planes|opciones|países|destinos|eSIMs?|paquetes)';
const ES_KIND = '(\\s+(locales|regionales|diarios|de datos))?';
const ES_NUMBER_RULES = Object.freeze([
  ['un volumen de datos o una velocidad', /\d[\d.,]*\s*(GB|MB|GiB|MiB|TB|gigas?|gigabytes?|megas?|megabytes?|Gbps|Mbps|Kbps)(?![\p{L}])/iu],
  ['un signo de moneda', /[$€£¥₩₽฿₫₹]|US\$/u],
  ['un importe en dólares', /(?<![\p{L}])USD\s?\d|\d\s?USD(?![\p{L}])|\d[\d.,]*\s*(dólares?|centavos?|euros?)(?![\p{L}])/iu],
  ['«desde» un precio', /(?<![\p{L}])desde\s+(USD|US\$|\$|\d[\d.,]*\s*(dólares?|USD))/iu],
  ['un número de planes o destinos', new RegExp(`\\d+\\s+${ES_NOUNS}${ES_KIND}(?![\\p{L}])|(?<![\\p{L}])(${ES_SPELLED})\\s+${ES_NOUNS}${ES_KIND}(?![\\p{L}])`, 'iu')],
]);

/** What differs between the languages of the authored content. `en` is what the module always did. */
export const CONTENT_LANGS = Object.freeze({
  en: Object.freeze({
    copy: CONTENT_COPY,
    descriptionSuffix: LIMITS.descriptionSuffix,
    numberRules: NUMBER_RULES,
    dayFigure: DAY_FIGURE,
    blockMention: BLOCK_MENTION,
    aliases: ALIASES,
    chinaPromise: CHINA_PROMISE,
    // a sentence starts after . ? ! and a space, at a capital or a digit (an opening quote or bracket allowed)
    sentenceSplit: /(?<=[.?!])\s+(?=["“«(]?[A-Z0-9])/u,
    questionStart: null,
  }),
  es: Object.freeze({
    copy: Object.freeze({
      faqTitle: (name) => `Preguntas frecuentes: ${name}`,
      relatedTitle: 'Destinos relacionados',
    }),
    descriptionSuffix: ' El pago en línea aún no está disponible.',
    numberRules: ES_NUMBER_RULES,
    dayFigure: /\d+\s*(-|\s)?\s*(días?|noches?|semanas?|mes(es)?)(?![\p{L}])/iu,
    blockMention: /(?<![\p{L}])(planes?|opciones?|eSIMs?|datos|bloques?)\s+(de datos\s+)?(locales?|regionales?|diarios?|multipaís|de varios países|de un solo país|solo para)(?![\p{L}])|(?<![\p{L}])planes?\s+(que|los que|las que)\s+(también\s+)?(cubren?|incluyen?)(?![\p{L}])|(?<![\p{L}])(planes?|datos)\s+(de datos\s+)?(cada día|al día|por día)(?![\p{L}])/iu,
    aliases: Object.freeze({
      TR: ['Türkiye', 'Turquia'], GB: ['Gran Bretaña', 'Inglaterra', 'Escocia', 'Gales', 'Irlanda del Norte'],
      US: ['EE. UU.', 'EE.UU.', 'EUA'], KR: ['Corea'], AE: ['EAU', 'Emiratos'], CZ: ['República Checa'],
      MO: ['Macau'], NL: ['Holanda'],
    }),
    chinaPromise: /bypass|unblock|VPN-free|(?<![\p{L}])(eludir|evadir|saltarse|sortear|esquivar)(?![\p{L}])|desbloque|sin (necesidad de )?VPN|(acceder|acceso|entrar) a (Google|WhatsApp|Facebook|Instagram|YouTube)/iu,
    sentenceSplit: /(?<=[.?!])\s+(?=["“«(¿¡]?[\p{Lu}0-9])/u,
    questionStart: '¿',
  }),
});

/** The rules of one language (throws on a language with no authored content). */
export function contentLang(lang = 'en') {
  const R = CONTENT_LANGS[lang];
  if (!R) throw new Error(`content: no authored-content rules for «${lang}»`);
  return R;
}

const RESERVED_IDS = new Set(['main', 'checkout', 'status', 'retry', 'skeleton', 'faq', 'related', 'a-mark', 'a-word', 'me-lw-fade', 'me-lw-fadeg', 'me-lw-wave']);
const TOP_KEYS = ['slug', 'iso', 'title', 'description', 'lead', 'sections', 'faq', 'related', 'plan_claims', 'sources', 'reviewed'];
const REVIEW_KEYS = ['research', 'copy', 'language', 'facts'];

const cache = new Map();
function defaults(lang = 'en') {
  if (cache.has(lang)) return cache.get(lang);
  const facts = JSON.parse(readFileSync(join(ROOT, 'seo/global-plan-facts.json'), 'utf8'));
  const countries = JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8')).countries
    .map((c) => ({ iso: c.iso, slug: c.slug, name: countryName(c.iso, lang) }));
  cache.set(lang, { facts, countries });
  return cache.get(lang);
}

/** The content file of a slug, parsed — or null when the country has none. */
export function loadContent(slug, dir = CONTENT_DIR) {
  if (!/^[a-z0-9-]+$/.test(String(slug))) throw new Error(`content-en: «${slug}» is not a slug`);
  const file = join(dir, `${slug}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Every slug that has a content file. */
export function contentSlugs(dir = CONTENT_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
}

/* ---------- text helpers ---------- */

const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
/** Prose without its link markup: what the reader reads. */
export const plain = (s) => String(s).replace(LINK, '$1');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isStr = (v) => typeof v === 'string' && v.trim() !== '' && v === v.trim();

/** Sentences of a prose string (plain text). */
export function sentences(text, lang = 'en') {
  return plain(text).split(contentLang(lang).sentenceSplit).map((s) => s.trim()).filter(Boolean);
}

/** Every prose field of a document, as [where, raw text]. */
export function proseFields(doc) {
  const out = [];
  const add = (where, v) => { if (typeof v === 'string') out.push([where, v]); };
  add('title', doc.title); add('description', doc.description); add('lead', doc.lead);
  (Array.isArray(doc.sections) ? doc.sections : []).forEach((s, i) => {
    if (!s || typeof s !== 'object') return;
    add(`sections[${i}].h2`, s.h2);
    (Array.isArray(s.paragraphs) ? s.paragraphs : []).forEach((p, j) => add(`sections[${i}].paragraphs[${j}]`, p));
    (Array.isArray(s.list) ? s.list : []).forEach((p, j) => add(`sections[${i}].list[${j}]`, p));
  });
  (Array.isArray(doc.faq) ? doc.faq : []).forEach((f, i) => { if (f && typeof f === 'object') { add(`faq[${i}].q`, f.q); add(`faq[${i}].a`, f.a); } });
  return out;
}

/** The catalogue countries a text names, other than `ownIso`: [iso, the name as written]. Longest names first, so
 *  «Papua New Guinea» is not also «Guinea» and «Northern Ireland» not also «Ireland». */
export function namedCountries(text, ownIso, countries = defaults().countries, lang = 'en') {
  const aliases = contentLang(lang).aliases;
  const names = [];
  for (const c of countries) for (const n of [c.name, ...(aliases[c.iso] || [])]) if (n) names.push([c.iso, n]);
  names.sort((a, b) => b[1].length - a[1].length);
  let t = String(text).replace(/[’']/g, "'");
  const found = [];
  for (const [iso, n] of names) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escRe(n.replace(/[’']/g, "'"))}(?![\\p{L}\\p{N}])`, 'gu');
    if (!re.test(t)) continue;
    t = t.replace(re, (m) => ' '.repeat(m.length));
    if (iso !== ownIso) found.push([iso, n]);
  }
  return found;
}

/* ---------- the validator ---------- */

/**
 * Every problem of one content document, as strings ([] = it passes).
 * `facts` = seo/global-plan-facts.json, `countries` = [{ iso, slug, name }]; both default to the committed files.
 * `today` (YYYY-MM-DD) bounds a source's `checked` date; `exists(path)` says whether an /en/ link target exists.
 * `lang` (default 'en') picks the language's rules (CONTENT_LANGS); `countries` then carry that language's names.
 */
export function validateContent(doc, opts = {}) {
  const lang = opts.lang || 'en';
  const R = contentLang(lang);
  const prefix = locale(lang).prefix;
  const d = defaults(lang);
  const facts = opts.facts || d.facts;
  const countries = opts.countries || d.countries;
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const exists = opts.exists || ((path) => existsSync(join(ROOT, path, 'index.html')));
  const P = [];
  const bad = (msg) => P.push(msg);

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return ['schema: the file is not a JSON object'];
  for (const k of Object.keys(doc)) if (!TOP_KEYS.includes(k)) bad(`schema: unknown key «${k}»`);
  for (const k of TOP_KEYS) if (!(k in doc)) bad(`schema: «${k}» is missing`);

  // Identity.
  const page = countries.find((c) => c.slug === doc.slug);
  if (!isStr(doc.slug)) bad('schema: slug must be a string');
  else if (!page) bad(`slug: «${doc.slug}» has no catalogue page (seo/catalogue-countries.json)`);
  if (opts.file && doc.slug !== opts.file) bad(`slug: «${doc.slug}» is not the file name «${opts.file}.json»`);
  if (!isStr(doc.iso) || !/^[A-Z]{2}$/.test(doc.iso)) bad('schema: iso must be two capital letters');
  else if (page && page.iso !== doc.iso) bad(`iso: ${doc.iso} is not ${page.slug}'s code (${page.iso})`);
  const iso = page ? page.iso : doc.iso;
  const name = page ? page.name : '';

  // Head.
  if (!isStr(doc.title)) bad('schema: title must be a non-empty trimmed string');
  else {
    if (doc.title.length > LIMITS.titleMax) bad(`title: ${doc.title.length} characters, at most ${LIMITS.titleMax}`);
    if (!doc.title.endsWith(LIMITS.titleSuffix)) bad(`title: must end with «${LIMITS.titleSuffix}»`);
  }
  if (!isStr(doc.description)) bad('schema: description must be a non-empty trimmed string');
  else {
    const n = doc.description.length;
    if (n < LIMITS.descriptionMin || n > LIMITS.descriptionMax) bad(`description: ${n} characters, must be ${LIMITS.descriptionMin}–${LIMITS.descriptionMax}`);
    if (!doc.description.endsWith(R.descriptionSuffix)) bad(`description: must end with «${R.descriptionSuffix.trim()}»`);
  }
  if (!isStr(doc.lead)) bad('schema: lead must be a non-empty trimmed string');
  else {
    if (doc.lead.length > LIMITS.leadMax) bad(`lead: ${doc.lead.length} characters, at most ${LIMITS.leadMax}`);
    if (sentences(doc.lead, lang).length > 2) bad('lead: one or two sentences');
  }
  for (const k of ['title', 'description']) if (isStr(doc[k]) && /\[[^\]]*\]\(/.test(doc[k])) bad(`${k}: no link markup in the head`);

  // Sections.
  const ids = new Set();
  let words = 0;
  if (!Array.isArray(doc.sections)) bad('schema: sections must be an array');
  else {
    const [lo, hi] = LIMITS.sections;
    if (doc.sections.length < lo || doc.sections.length > hi) bad(`sections: ${doc.sections.length}, must be ${lo}–${hi}`);
    doc.sections.forEach((s, i) => {
      const at = `sections[${i}]`;
      if (!s || typeof s !== 'object' || Array.isArray(s)) { bad(`schema: ${at} must be an object`); return; }
      for (const k of Object.keys(s)) if (!['id', 'h2', 'paragraphs', 'list'].includes(k)) bad(`schema: ${at} unknown key «${k}»`);
      if (!isStr(s.id) || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s.id)) bad(`schema: ${at}.id must be a lower-case ascii anchor (a-z, 0-9, -)`);
      else if (RESERVED_IDS.has(s.id)) bad(`schema: ${at}.id «${s.id}» is taken by the page`);
      else if (ids.has(s.id)) bad(`schema: ${at}.id «${s.id}» is used twice`);
      else ids.add(s.id);
      if (!isStr(s.h2)) bad(`schema: ${at}.h2 must be a non-empty trimmed string`);
      if (!Array.isArray(s.paragraphs) || s.paragraphs.length < LIMITS.paragraphs[0] || s.paragraphs.length > LIMITS.paragraphs[1]) {
        bad(`schema: ${at}.paragraphs must be ${LIMITS.paragraphs.join('–')} strings`);
      } else s.paragraphs.forEach((p, j) => { if (!isStr(p)) bad(`schema: ${at}.paragraphs[${j}] must be a non-empty trimmed string`); });
      if ('list' in s) {
        if (!Array.isArray(s.list) || s.list.length < LIMITS.list[0] || s.list.length > LIMITS.list[1]) bad(`schema: ${at}.list must be ${LIMITS.list.join('–')} strings`);
        else s.list.forEach((p, j) => { if (!isStr(p)) bad(`schema: ${at}.list[${j}] must be a non-empty trimmed string`); });
      }
      for (const t of [s.h2, ...(s.paragraphs || []), ...(s.list || [])]) if (typeof t === 'string') words += plain(t).split(/\s+/).filter(Boolean).length;
    });
    const [wlo, whi] = LIMITS.sectionWords;
    if (doc.sections.length && (words < wlo || words > whi)) bad(`sections: ${words} words of section prose, must be ${wlo}–${whi}`);
  }

  // Questions.
  if (!Array.isArray(doc.faq)) bad('schema: faq must be an array');
  else {
    const [lo, hi] = LIMITS.faq;
    if (doc.faq.length < lo || doc.faq.length > hi) bad(`faq: ${doc.faq.length} questions, must be ${lo}–${hi}`);
    const qs = new Set();
    doc.faq.forEach((f, i) => {
      if (!f || typeof f !== 'object' || Array.isArray(f)) { bad(`schema: faq[${i}] must be an object`); return; }
      for (const k of Object.keys(f)) if (!['q', 'a'].includes(k)) bad(`schema: faq[${i}] unknown key «${k}»`);
      if (!isStr(f.q)) bad(`schema: faq[${i}].q must be a non-empty trimmed string`);
      else {
        if (!f.q.endsWith('?')) bad(`faq[${i}].q: a question ends with «?»`);
        if (R.questionStart && !f.q.startsWith(R.questionStart)) bad(`faq[${i}].q: a question starts with «${R.questionStart}»`);
        if (qs.has(f.q)) bad(`faq[${i}].q: asked twice`);
        qs.add(f.q);
      }
      if (!isStr(f.a)) bad(`schema: faq[${i}].a must be a non-empty trimmed string`);
    });
  }

  // Related pages.
  if (!Array.isArray(doc.related)) bad('schema: related must be an array');
  else {
    const [lo, hi] = LIMITS.related;
    if (doc.related.length < lo || doc.related.length > hi) bad(`related: ${doc.related.length} pages, must be ${lo}–${hi}`);
    if (new Set(doc.related).size !== doc.related.length) bad('related: a page is listed twice');
    for (const r of doc.related) {
      if (r === doc.slug) bad('related: a page does not relate to itself');
      else if (!countries.some((c) => c.slug === r)) bad(`related: «${r}» is not a catalogue page`);
    }
  }

  // Review record.
  if (!doc.reviewed || typeof doc.reviewed !== 'object' || Array.isArray(doc.reviewed)) bad('schema: reviewed must be an object');
  else {
    for (const k of Object.keys(doc.reviewed)) if (!REVIEW_KEYS.includes(k)) bad(`schema: reviewed has an unknown key «${k}»`);
    for (const k of REVIEW_KEYS) if (typeof doc.reviewed[k] !== 'string') bad(`schema: reviewed.${k} must be a string (empty until done)`);
  }

  // Sources.
  const sources = Array.isArray(doc.sources) ? doc.sources : [];
  if (!Array.isArray(doc.sources)) bad('schema: sources must be an array');
  else if (sources.length < LIMITS.sources) bad('sources: at least one source');
  sources.forEach((s, i) => {
    const at = `sources[${i}]`;
    if (!s || typeof s !== 'object' || Array.isArray(s)) { bad(`schema: ${at} must be an object`); return; }
    for (const k of Object.keys(s)) if (!['url', 'title', 'checked', 'supports', 'sentences', 'review_by'].includes(k)) bad(`schema: ${at} unknown key «${k}»`);
    let host = '';
    try {
      const u = new URL(s.url);
      if (u.protocol !== 'https:') bad(`${at}.url: https only`);
      host = u.hostname;
    } catch { bad(`${at}.url: not a URL`); }
    if (host && BANNED_HOSTS.test(host)) bad(`${at}.url: ${host} is a forum or another eSIM seller — not a source`);
    if (!isStr(s.title)) bad(`schema: ${at}.title must be a non-empty string`);
    if (!isStr(s.supports)) bad(`schema: ${at}.supports must say what it backs`);
    const date = typeof s.checked === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.checked) ? new Date(`${s.checked}T00:00:00Z`) : null;
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== s.checked) bad(`${at}.checked: a date YYYY-MM-DD`);
    else if (s.checked > today) bad(`${at}.checked: ${s.checked} is in the future`);
    if ('review_by' in s) {
      const r = typeof s.review_by === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.review_by) ? new Date(`${s.review_by}T00:00:00Z`) : null;
      if (!r || Number.isNaN(r.getTime()) || r.toISOString().slice(0, 10) !== s.review_by) bad(`${at}.review_by: a date YYYY-MM-DD`);
      else if (date && !Number.isNaN(date.getTime())) {
        const limit = new Date(date); limit.setUTCMonth(limit.getUTCMonth() + 6);
        if (s.review_by <= s.checked) bad(`${at}.review_by: ${s.review_by} is not after checked ${s.checked}`);
        else if (s.review_by > limit.toISOString().slice(0, 10)) bad(`${at}.review_by: at most six months after checked (${limit.toISOString().slice(0, 10)})`);
        if (s.review_by < today) bad(`${at}.review_by: ${s.review_by} has passed — re-open ${s.url}, re-check every sentence it backs, then move checked and review_by`);
      }
    }
    if ('sentences' in s && (!Array.isArray(s.sentences) || !s.sentences.every(isStr))) bad(`schema: ${at}.sentences must be strings`);
  });

  // Plan claims (shape).
  const claims = Array.isArray(doc.plan_claims) ? doc.plan_claims : [];
  if (!Array.isArray(doc.plan_claims)) bad('schema: plan_claims must be an array');
  claims.forEach((c, i) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) { bad(`schema: plan_claims[${i}] must be an object`); return; }
    for (const k of Object.keys(c)) if (!['quote', 'kind', 'codes'].includes(k)) bad(`schema: plan_claims[${i}] unknown key «${k}»`);
    if (!isStr(c.quote)) bad(`schema: plan_claims[${i}].quote must be a non-empty string`);
    if (!KINDS.includes(c.kind)) bad(`schema: plan_claims[${i}].kind must be one of ${KINDS.join(', ')}`);
    if ('codes' in c && (!Array.isArray(c.codes) || !c.codes.every((x) => typeof x === 'string' && /^[A-Z]{2}$/.test(x)))) bad(`schema: plan_claims[${i}].codes must be ISO codes`);
  });

  /* ---- the prose rules ---- */
  const fields = proseFields(doc);
  const plainFields = fields.map(([w, t]) => [w, plain(t)]);
  const allPlain = plainFields.map(([, t]) => t).join('\n');
  const sourced = new Set(sources.flatMap((s) => (s && Array.isArray(s.sentences) ? s.sentences.map((x) => plain(x)) : [])));
  for (const s of sourced) if (!allPlain.includes(s)) bad(`sources: the backed sentence «${s}» is not in the prose`);
  const supportText = sources.map((s) => (s && typeof s.supports === 'string' ? s.supports : '')).join('\n');
  const inQuote = (sentence) => claims.some((c) => c && typeof c.quote === 'string' && c.quote.includes(sentence));
  const backed = (sentence) => [...sourced].some((s) => s.includes(sentence) || sentence.includes(s));

  for (const [where, raw] of fields) {
    const text = plain(raw);
    // Markup.
    if (/[<>]/.test(raw)) bad(`${where}: no HTML — plain text only`);
    for (const m of String(raw).matchAll(LINK)) {
      const href = m[2];
      if (!new RegExp(`^/${prefix}/([a-z0-9-]+/)*$`).test(href)) bad(`${where}: a link goes only to an /${prefix}/ page path ending in «/» («${href}»)`);
      else if (!exists(href.slice(1))) bad(`${where}: the link target ${href} does not exist`);
    }
    if (/[[\]]/.test(String(raw).replace(LINK, ''))) bad(`${where}: broken link markup (a link is [text](/${prefix}/…/))`);
    // Guards.
    for (const id of GUARD_IDS) {
      const re = CLAIM_GUARDS[lang][id].re;
      const m = text.match(re);
      if (m) bad(`${where}: guard «${id}» refuses «${m[0]}»`);
    }
    const tm = text.match(TECH);
    if (tm) bad(`${where}: guard «tech» refuses «${tm[0]}» (the page's error check would read it as a leaked message)`);
    if (iso === 'CN') { const m = text.match(R.chinaPromise); if (m) bad(`${where}: China — never promise a way past the restrictions («${m[0]}»)`); }
    // Numbers.
    for (const [what, re] of R.numberRules) { const m = text.match(re); if (m) bad(`${where}: no plan figures in prose — ${what} («${m[0]}»)`); }
    for (const s of sentences(text, lang)) {
      const m = s.match(R.dayFigure);
      if (m && !backed(s)) bad(`${where}: «${m[0]}» — a day/week/month figure only in a sentence a source lists in its \`sentences\` («${s}»)`);
      // Plan blocks.
      if (R.blockMention.test(s) && !inQuote(s)) bad(`${where}: a sentence about the plan blocks must be a plan_claims quote («${s}»)`);
      // Other countries.
      for (const [oIso, n] of namedCountries(s, iso, countries, lang)) {
        if (inQuote(s)) continue;
        const sup = countries.find((c) => c.iso === oIso);
        const supNamed = [sup?.name, ...(R.aliases[oIso] || [])].filter(Boolean).some((x) => supportText.includes(x));
        if (!backed(s) && !supNamed) bad(`${where}: names ${n} (${oIso}) — only in a plan_claims quote or a sentence a source backs («${s}»)`);
      }
    }
  }

  /* ---- plan claims hold against the facts ---- */
  const f = facts && facts.countries ? facts.countries[iso] : null;
  claims.forEach((c, i) => {
    if (!c || typeof c.quote !== 'string') return;
    const at = `plan_claims[${i}]`;
    if (!plainFields.some(([, t]) => t.includes(c.quote))) bad(`${at}: the quote is not in the prose, word for word («${c.quote}»)`);
    if (!f) { bad(`${at}: ${iso} has no plan facts (seo/global-plan-facts.json)`); return; }
    const codes = Array.isArray(c.codes) ? c.codes : [];
    const has = { local: f.local.gb.length > 0, daily: f.daily.gb_per_day.length > 0, regional: f.also.length > 0 };
    if (c.kind === 'local' && !has.local) bad(`${at}: ${iso} has no local plans`);
    if (c.kind === 'daily' && !has.daily) bad(`${at}: ${iso} has no daily plans`);
    if (c.kind === 'no_local' && has.local) bad(`${at}: ${iso} HAS local plans`);
    if (c.kind === 'no_daily' && has.daily) bad(`${at}: ${iso} HAS daily plans`);
    if (c.kind === 'no_regional' && has.regional) bad(`${at}: ${iso}'s regional plans DO cover other destinations`);
    if (c.kind === 'regional_also') {
      if (!codes.length) bad(`${at}: regional_also lists the codes it names`);
      for (const code of codes) if (!f.also.includes(code)) bad(`${at}: ${code} is not among the destinations ${iso}'s regional plans also cover`);
    }
    for (const [oIso, n] of namedCountries(c.quote, iso, countries, lang)) {
      if (c.kind !== 'regional_also') bad(`${at}: a ${c.kind} claim names ${n} — only regional_also may name another destination`);
      else if (!codes.includes(oIso)) bad(`${at}: names ${n} but its codes do not list ${oIso}`);
    }
  });

  return P;
}

/* ---------- across files ---------- */

/** Problems between documents: a shared title / description, or a question, answer or paragraph that is another
 *  country's with the name swapped. `docs` = [{ slug, doc }]. */
export function crossProblems(docs, countries, lang = 'en') {
  countries = countries || defaults(lang).countries;
  const aliases = contentLang(lang).aliases;
  const P = [];
  const seen = new Map();
  const key = (doc, s) => {
    const page = countries.find((c) => c.slug === doc.slug);
    let t = plain(s).toLowerCase();
    for (const n of [page?.name, ...(aliases[page?.iso] || [])].filter(Boolean)) t = t.split(n.toLowerCase()).join('«x»');
    return t.replace(/\s+/g, ' ').trim();
  };
  const once = (id, slug, msg) => {
    if (seen.has(id) && seen.get(id) !== slug) { P.push(msg(seen.get(id))); return false; }
    seen.set(id, slug);
    return true;
  };
  const note = (kind, k, slug, raw) => {
    if (!once(`=${kind}:${plain(raw).toLowerCase().replace(/\s+/g, ' ').trim()}`, slug, (o) => `${slug}: ${kind} repeats ${o}'s word for word («${plain(raw).slice(0, 80)}»)`)) return;
    once(`${kind}:${k}`, slug, (o) => `${slug}: ${kind} repeats ${o}'s with the name swapped («${k.slice(0, 80)}»)`);
  };
  for (const { slug, doc } of docs) {
    if (!doc || typeof doc !== 'object') continue;
    if (typeof doc.title === 'string') note('title', key(doc, doc.title), slug, doc.title);
    if (typeof doc.description === 'string') note('description', key(doc, doc.description), slug, doc.description);
    for (const f of Array.isArray(doc.faq) ? doc.faq : []) {
      if (f && typeof f.q === 'string') note('question', key(doc, f.q), slug, f.q);
      if (f && typeof f.a === 'string') note('answer', key(doc, f.a), slug, f.a);
    }
    for (const s of Array.isArray(doc.sections) ? doc.sections : []) {
      for (const p of s && Array.isArray(s.paragraphs) ? s.paragraphs : []) if (typeof p === 'string') note('paragraph', key(doc, p), slug, p);
    }
  }
  return P;
}

/** Validate committed files: { slug: problems[] } plus `_cross`. */
export function checkAll(slugs, opts = {}) {
  const lang = opts.lang || 'en';
  const dir = opts.dir || contentDir(lang);
  slugs = slugs || contentSlugs(dir);
  const out = {};
  const docs = [];
  for (const slug of slugs) {
    let doc;
    try { doc = loadContent(slug, dir); } catch (e) { out[slug] = [`file: ${e.message}`]; continue; }
    if (!doc) { out[slug] = [`file: seo/content-${lang}/${slug}.json does not exist`]; continue; }
    out[slug] = validateContent(doc, { ...opts, lang, file: slug });
    docs.push({ slug, doc });
  }
  const all = slugs.length === contentSlugs(dir).length ? docs
    : contentSlugs(dir).map((slug) => ({ slug, doc: (() => { try { return loadContent(slug, dir); } catch { return null; } })() }));
  out._cross = crossProblems(all, opts.countries, lang).filter((p) => slugs.some((s) => p.startsWith(`${s}:`)));
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let args = process.argv.slice(2);
  let lang = 'en';
  const li = args.indexOf('--lang');
  if (li >= 0) { lang = args[li + 1]; args = args.filter((_, i) => i !== li && i !== li + 1); }
  if (args[0] !== '--check' || !CONTENT_LANGS[lang]) {
    console.error(`usage: node seo/content-en.mjs --check [--lang ${Object.keys(CONTENT_LANGS).join('|')}] [slug…]`);
    process.exit(2);
  }
  const slugs = args.slice(1).length ? args.slice(1) : contentSlugs(contentDir(lang));
  const res = checkAll(slugs, { lang });
  let n = 0;
  for (const [slug, problems] of Object.entries(res)) {
    if (!problems.length) { if (slug !== '_cross') console.log(`ok   ${slug}`); continue; }
    n += problems.length;
    console.log(`FAIL ${slug === '_cross' ? 'across files' : slug}`);
    for (const p of problems) console.log(`     - ${p}`);
  }
  if (!slugs.length) console.log(`no content files (seo/content-${lang}/*.json)`);
  process.exit(n ? 1 : 0);
}
