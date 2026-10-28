/* Authored SPANISH country content (seo/content-es/<slug>.json) — the per-language half of seo/content-en.mjs.
 *
 *   1. the Spanish rules, each with a negative control that proves it fires on a sentence written to break it (the
 *      schema and the language-neutral rules are proved once, in seo/test-content-en.mjs);
 *   2. every committed Spanish file passes, adapts an English file of the same country, and every indexed country (the
 *      13 of stage 1, + malaysia and singapore since 2026-10-28) has one; the cross-file check runs among the Spanish files only;
 *   3. rendering, proved on a FIXTURE (test/fixtures/content-es-japan.json): head, lead, sections, questions and related
 *      destinations in the static HTML after «Resumen de planes» and before «Antes de comprar»; everything else is the
 *      template; no FAQPage; a page without a file is the template byte for byte;
 *   4. the committed Spanish pages: the block and /en/content.css exactly when a file exists; the authored blocks are
 *      not one template (LCS word ratio below SIMILARITY_MAX_ES); no plan figure in the rendered block; own titles and
 *      descriptions on all 198 Spanish country pages, the authored ones different beyond the country's name.
 *
 * Run: node --test seo/test-content-es.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateContent, crossProblems, checkAll, contentSlugs, contentDir, loadContent, namedCountries, sentences, GUARD_IDS,
  CONTENT_LANGS,
} from './content-en.mjs';
import { CLAIM_GUARDS } from './claim-guards.mjs';
import { localeGenerator } from './build-locale-pages.mjs';
import { INDEXED_COUNTRIES } from './indexing.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const ES_DIR = contentDir('es');
const FIXTURE = JSON.parse(read('test/fixtures/content-es-japan.json'));
const fx = () => structuredClone(FIXTURE);
const OPTS = { lang: 'es', file: 'japan', today: '2026-10-27' };
const problems = (doc, opts = {}) => validateContent(doc, { ...OPTS, ...opts });
const G = localeGenerator('es');
const COUNTRIES = G.countries();
const BY_SLUG = new Map(COUNTRIES.map((c) => [c.slug, c]));
const JAPAN = BY_SLUG.get('japan');
/* The 13 countries of the first indexing stage (2026-10-27) — each has a Spanish file. */
const STAGE_13 = ['china', 'france', 'greece', 'indonesia', 'japan', 'maldives', 'mexico', 'south-korea', 'sri-lanka', 'thailand', 'turkey', 'united-kingdom', 'vietnam'];
/* + malaysia and singapore (indexed in stage 2, 2026-10-27; Spanish text 2026-10-28) — every indexed country has a Spanish file. */
const AUTHORED = [...STAGE_13, 'malaysia', 'singapore'].sort();

function fires(mutate, re, opts = {}) {
  const doc = fx();
  mutate(doc);
  const p = problems(doc, opts);
  assert.ok(p.some((x) => re.test(x)), `expected ${re} in:\n${p.join('\n') || '(no problem)'}`);
}
const addParagraph = (text) => (d) => { d.sections[0].paragraphs.push(text); };

/* ===================================================================== *
 * 1. The Spanish rules
 * ===================================================================== */

test('the fixture passes every Spanish rule — and fails the English ones', () => {
  assert.deepEqual(problems(fx()), []);
  assert.ok(validateContent(fx(), { file: 'japan', today: '2026-10-27' }).some((x) => /Online payment is not available yet/.test(x)), 'an English check refuses it');
  assert.throws(() => validateContent(fx(), { ...OPTS, lang: 'de' }), /no authored-content rules for «de»/);
});

test('head: the Spanish description suffix; questions open with «¿»', () => {
  fires((d) => { d.description = d.description.replace(' El pago en línea aún no está disponible.', ' Online payment is not available yet.'); }, /must end with «El pago en línea aún no está disponible\.»/);
  fires((d) => { d.faq[0].q = d.faq[0].q.replace(/^¿/, ''); }, /a question starts with «¿»/);
});

test('numbers: Spanish volumes, prices, «desde USD», counts with digits or words; a day figure only when sourced', () => {
  for (const s of ['Muchos viajeros eligen 10 GB.', 'Un plan de 500 megas.', 'Velocidad de 20 Mbps.', 'Cuesta USD 12.99.', 'Unos 12 dólares.',
    'Precios desde USD 4.', 'Hay 12 planes para Japón.', 'Elige entre tres planes locales.', 'Más de veinte destinos.', 'Cuesta $5.']) {
    fires(addParagraph(s), /no plan figures in prose/);
  }
  fires(addParagraph('El formulario se abre 3 días antes del viaje.'), /a day\/week\/month figure/);
  for (const s of ['Japón usa 100 V en todo el país.', 'El código se combina desde el 25 de enero de 2024.', 'Seis aeropuertos tienen Wi-Fi.']) {
    const doc = fx(); addParagraph(s)(doc);
    assert.deepEqual(problems(doc).filter((x) => /plan figures|day\/week/.test(x)), [], s);
  }
});

test('every Spanish guard fires on its own sentence in prose; tech words too', () => {
  for (const id of GUARD_IDS) {
    const sample = CLAIM_GUARDS.es[id].fires[0];
    fires(addParagraph(`${sample}.`), new RegExp(`guard «${id}»`));
  }
  fires(addParagraph('Un error de la red.'), /guard «tech»/);
});

test('China: no promise past the restrictions, in Spanish', () => {
  const cn = { ...OPTS, file: 'china' };
  const base = () => { const d = fx(); d.slug = 'china'; d.iso = 'CN'; d.plan_claims = []; return d; };
  for (const s of ['Con ella puedes eludir las restricciones.', 'Navega sin VPN.', 'Podrás acceder a Google sin problema.', 'Desbloquea tus aplicaciones.']) {
    const d = base(); d.sections[0].paragraphs.push(s);
    assert.ok(problems(d, cn).some((x) => /China — never promise/.test(x)), s);
  }
});

test('plan blocks: a Spanish sentence about local / regional / daily plans must be a plan_claims quote', () => {
  for (const s of ['Los planes locales sirven para Japón.', 'Hay planes regionales para el viaje.', 'Los datos cada día se renuevan.',
    'Elige planes que también cubren otros países.', 'Un plan de datos diario.']) {
    fires(addParagraph(s), /must be a plan_claims quote/);
  }
  const doc = fx(); addParagraph('El tren local sale cada hora.')(doc);
  assert.deepEqual(problems(doc).filter((x) => /plan_claims quote/.test(x)), [], 'a local train is not a plan block');
});

test('countries: Spanish names and aliases; another country only in a claim or a backed sentence', () => {
  fires(addParagraph('Muchos viajeros siguen hacia Corea del Sur.'), /names Corea del Sur \(KR\)/);
  fires(addParagraph('Muchos viajeros llegan desde EE.UU. cada año.'), /names EE\.UU\. \(US\)/);
  fires((d) => { d.plan_claims.push({ quote: 'Los planes locales sirven para Japón y Tailandia.', kind: 'local' }); }, /not in the prose/);
  fires((d) => { addParagraph('Los planes locales sirven para Japón y Tailandia.')(d); d.plan_claims.push({ quote: 'Los planes locales sirven para Japón y Tailandia.', kind: 'local' }); }, /a local claim names Tailandia/);
  const all = COUNTRIES.map((c) => ({ iso: c.iso, slug: c.slug, name: c.name }));
  assert.deepEqual(namedCountries('Papúa Nueva Guinea, no Guinea', 'JP', all, 'es').map(([i]) => i).sort(), ['GN', 'PG']);
  assert.deepEqual(namedCountries('Japón y Reino Unido', 'JP', all, 'es').map(([i]) => i), ['GB']);
  assert.deepEqual(sentences('Hola. ¿Funciona en Japón? Él dice que sí.', 'es'), ['Hola.', '¿Funciona en Japón?', 'Él dice que sí.']);
});

test('links: only /es/ pages that exist', () => {
  fires(addParagraph('Lee la [guía](/en/guides/compatibility/).'), /a link goes only to an \/es\/ page/);
  fires(addParagraph('Lee la [guía](/es/guides/nope/).'), /does not exist/);
  const doc = fx(); addParagraph('Lee la [guía de compatibilidad](/es/guides/compatibility/).')(doc);
  assert.deepEqual(problems(doc).filter((x) => /link/.test(x)), []);
});

test('across Spanish files: a name-swapped paragraph or question is refused; the English twin is not compared', () => {
  const jp = fx();
  const th = structuredClone(jp); th.slug = 'thailand'; th.iso = 'TH';
  th.faq[0].q = jp.faq[0].q.split('Japón').join('Tailandia');
  const p = crossProblems([{ slug: 'japan', doc: jp }, { slug: 'thailand', doc: th }], undefined, 'es');
  assert.ok(p.some((x) => /question repeats japan's/.test(x)), p.join('\n'));
  assert.deepEqual(crossProblems([{ slug: 'japan', doc: jp }], undefined, 'es'), []);
});

/* ===================================================================== *
 * 2. The committed Spanish files
 * ===================================================================== */

test('every committed seo/content-es/*.json passes (node seo/content-en.mjs --check --lang es); each adapts an English file', () => {
  const slugs = contentSlugs(ES_DIR);
  const res = checkAll(slugs, { lang: 'es' });
  const bad = Object.entries(res).filter(([, p]) => p.length).map(([s, p]) => `${s}:\n  ${p.join('\n  ')}`);
  assert.deepEqual(bad, []);
  for (const s of AUTHORED) assert.ok(slugs.includes(s), `${s}: no seo/content-es/${s}.json`);
  assert.deepEqual(AUTHORED, [...INDEXED_COUNTRIES].sort(), 'every indexed country has a Spanish file');
  for (const s of slugs) {
    const es = loadContent(s, ES_DIR);
    const en = loadContent(s);
    assert.ok(en, `${s}: a Spanish file adapts an English one (seo/content-en/${s}.json)`);
    assert.ok(INDEXED_COUNTRIES.includes(s), `${s}: authored Spanish only for an indexed country`);
    assert.equal(es.iso, en.iso, s);
    assert.deepEqual(es.related, en.related, `${s}: the same related destinations as English`);
    assert.equal(es.sections.length, en.sections.length, `${s}: the same sections as English`);
    assert.equal(es.faq.length, en.faq.length, `${s}: the same questions as English`);
    // the same plan facts as English: the kinds claimed and the destinations named (a Spanish quote may split or
    // repeat a sentence differently, so it is compared as a set, not one quote per quote)
    const kinds = (d) => [...new Set(d.plan_claims.map((c) => c.kind))].sort();
    const codes = (d) => [...new Set(d.plan_claims.flatMap((c) => c.codes || []))].sort();
    assert.deepEqual(kinds(es), kinds(en), `${s}: the same plan-claim kinds as English`);
    assert.deepEqual(codes(es), codes(en), `${s}: the same destinations named in plan claims as English`);
  }
});

/* ===================================================================== *
 * 3. Rendering (fixture)
 * ===================================================================== */

const html = G.countryPage(JAPAN, FIXTURE);
const decode = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (s) => decode(s.replace(/<[^>]+>/g, '')).trim();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const plainMd = (s) => String(s).replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '$1');

test('a Spanish page with a file: title, description, share tags and lead come from it', () => {
  for (const tag of [`<title>${esc(FIXTURE.title)}</title>`, `<meta name="description" content="${esc(FIXTURE.description)}">`,
    `<meta property="og:title" content="${esc(FIXTURE.title)}">`, `<meta property="og:description" content="${esc(FIXTURE.description)}">`,
    `<meta name="twitter:title" content="${esc(FIXTURE.title)}">`, `<meta name="twitter:description" content="${esc(FIXTURE.description)}">`]) {
    assert.ok(html.includes(tag), tag);
  }
  assert.equal(text(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1]), plainMd(FIXTURE.lead));
  assert.ok(html.includes('<link rel="stylesheet" href="/en/content.css">'));
  assert.match(html, /<html lang="es">/);
});

test('a Spanish page with a file: the block sits after «Resumen de planes», before «Antes de comprar», in Spanish', () => {
  const at = (s) => { const i = html.indexOf(s); assert.ok(i >= 0, s); return i; };
  const order = [at('class="cp-help cp-glance"'), at('<div class="cp-about">'),
    ...FIXTURE.sections.map((s) => at(`<h2 id="${s.id}-h">${esc(s.h2)}</h2>`)),
    at('<h2 id="cpFaqTitle">Preguntas frecuentes: Japón</h2>'), at('<h2 id="cpRelatedTitle">Destinos relacionados</h2>'),
    at('aria-labelledby="cpHelpTitle"')];
  assert.deepEqual(order, order.slice().sort((a, b) => a - b));
  const about = html.slice(at('<div class="cp-about">'), at('aria-labelledby="cpHelpTitle"'));
  const faq = about.match(/<section class="cp-about-sec cp-faq" id="faq"[\s\S]*?<\/section>/)[0];
  assert.deepEqual([...faq.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => text(m[1])), FIXTURE.faq.map((f) => f.q));
  const rel = about.match(/<section class="cp-about-sec cp-related"[\s\S]*?<\/section>/)[0];
  assert.deepEqual([...rel.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[1], decode(m[2])]),
    FIXTURE.related.map((s) => [`/es/esim/${s}/`, BY_SLUG.get(s).name]), 'related: Spanish names, /es/ links');
  assert.equal(/href="\/en\//.test(about), false, 'no English link in the Spanish block');
  assert.equal(/FAQPage|acceptedAnswer|"Question"/.test(html), false, 'no FAQPage');
});

test('a Spanish page with a file: everything else is the template; a page without a file IS the template', () => {
  const tpl = G.countryPage(JAPAN, null);
  const strip = (h) => h.replace(/<title>[\s\S]*?<\/title>/, '').replace(/<meta (name|property)="(description|og:title|og:description|twitter:title|twitter:description)" content="[^"]*">/g, '')
    .replace(/<p class="lead">[\s\S]*?<\/p>/, '').replace(/  <div class="cp-about">[\s\S]*?\n  <\/div>\n/, '').replace('\n<link rel="stylesheet" href="/en/content.css">', '');
  assert.equal(strip(html), strip(tpl));
  const withFile = new Set(contentSlugs(ES_DIR));
  for (const c of COUNTRIES.filter((x) => !withFile.has(x.slug)).slice(0, 25)) {
    const h = G.countryPage(c);
    assert.equal(h, G.countryPage(c, null), c.slug);
    assert.equal(/cp-about|content\.css/.test(h), false, c.slug);
  }
  const broken = fx(); broken.title = 'Internet rápido en Japón | Magic eSIM';
  assert.throws(() => G.countryPage(JAPAN, broken), /seo\/content-es\/japan\.json:[\s\S]*guard «network»[\s\S]*--lang es japan/);
});

/* ===================================================================== *
 * 4. The committed Spanish pages
 * ===================================================================== */

const page = (slug) => read(`es/esim/${slug}/index.html`);
const ABOUT = /<div class="cp-about">([\s\S]*?)\n {2}<\/div>\n/;
const aboutOf = (h) => (h.match(ABOUT) || [])[1] ?? null;
const titleOf = (h) => decode(h.match(/<title>([\s\S]*?)<\/title>/)[1]);
const descOf = (h) => decode(h.match(/<meta name="description" content="([^"]*)">/)[1]);
const textOf = (h) => decode(h.replace(/<\/?(?:a|b|i|em|strong|span)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

test('committed Spanish pages: the block (static, inside <main>, not hidden) and content.css exactly when a file exists; robots unchanged', () => {
  const withFile = new Set(contentSlugs(ES_DIR));
  for (const c of COUNTRIES) {
    const h = page(c.slug);
    assert.equal(h.includes('<div class="cp-about">'), withFile.has(c.slug), `${c.slug}: block`);
    assert.equal(h.includes('/en/content.css'), withFile.has(c.slug), `${c.slug}: content.css`);
    assert.equal(/<meta name="robots" content="index, follow">/.test(h), INDEXED_COUNTRIES.includes(c.slug), `${c.slug}: robots follow seo/indexing.mjs`);
    if (!withFile.has(c.slug)) continue;
    const doc = loadContent(c.slug, ES_DIR);
    const about = aboutOf(h);
    const before = h.slice(0, h.indexOf('<div class="cp-about">'));
    for (const tag of ['template', 'noscript', 'script']) {
      assert.ok((before.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length <= (before.match(new RegExp(`</${tag}>`, 'g')) || []).length, `${c.slug}: not inside <${tag}>`);
    }
    assert.ok(before.includes('<main'), c.slug);
    assert.equal(/\shidden(?=[\s>=])|display:\s*none|aria-hidden="true"/.test(about), false, c.slug);
    for (const s of doc.sections) for (const p of s.paragraphs) assert.ok(textOf(about).includes(plainMd(p)), `${c.slug}: «${p.slice(0, 40)}…»`);
    assert.equal(titleOf(h), doc.title, c.slug);
    assert.equal(descOf(h), doc.description, c.slug);
  }
});

const words = (h) => textOf(h).toLowerCase().split(/\s+/).filter(Boolean);
function lcsRatio(a, b) {
  if (!a.length && !b.length) return 1;
  let prev = new Uint32Array(b.length + 1);
  let cur = new Uint32Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    [prev, cur] = [cur, prev];
  }
  return (2 * prev[b.length]) / (a.length + b.length);
}
/* Measured 2026-10-27 on the 13 Spanish authored blocks (78 pairs): mean 0.203, max 0.277 (france / united-kingdom);
 * re-measured 2026-10-28 on 15 (+ malaysia, singapore; 105 pairs): mean 0.199, max 0.278 (france / united-kingdom);
 * the two new blocks at most 0.212 (singapore / thailand), malaysia / singapore 0.208.
 * English on the same day: 0.174 / 0.254 — Spanish function words (de, la, el, que, en) raise the floor a little.
 * Threshold = measured max + 0.10, rounded up (as for English, seo/test-content-en-quality.mjs). A name-swapped copy
 * scores ≈ 1. */
export const SIMILARITY_MAX_ES = 0.38;

test('the 15 Spanish authored blocks are pairwise below SIMILARITY_MAX_ES (LCS word ratio); a name swap is caught', () => {
  const w = Object.fromEntries(AUTHORED.map((s) => [s, words(aboutOf(page(s)))]));
  const over = [];
  for (let i = 0; i < AUTHORED.length; i += 1) {
    for (let j = i + 1; j < AUTHORED.length; j += 1) {
      const r = lcsRatio(w[AUTHORED[i]], w[AUTHORED[j]]);
      if (r >= SIMILARITY_MAX_ES) over.push(`${AUTHORED[i]} / ${AUTHORED[j]}: ${r.toFixed(3)}`);
    }
  }
  assert.deepEqual(over, []);
  assert.ok(SIMILARITY_MAX_ES <= 0.5);
  const jp = aboutOf(page('japan'));
  assert.ok(lcsRatio(words(jp), words(jp.split('Japón').join('Tailandia'))) > 0.9);
});

const FIGURES = [
  ['a data volume', /\d\s*(?:[.,]\d+)?\s*(?:GB|MB|TB|gigas?|megas?|gigabytes?|megabytes?)(?![\p{L}])/iu],
  ['a speed', /\d\s*(?:kbps|Mbps|Gbps|Mb\/s|Kb\/s)/i],
  ['a currency amount', /[$€£¥₩₫฿₺₹]|(?<![\p{L}])(?:USD|EUR|US\$)(?![\p{L}])|\d\s*(?:dólares?|euros?|centavos?)(?![\p{L}])/iu],
  ['a plan or place count', /(?<![\p{L}])(?:\d+|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|quince|veinte|treinta|cien|decenas|cientos)\s+(?:planes|paquetes|opciones|destinos|países)(?![\p{L}])/iu],
];
test('no plan figure (volume, speed, currency, count) anywhere in a rendered Spanish block', () => {
  for (const s of AUTHORED) {
    const t = textOf(aboutOf(page(s)));
    assert.deepEqual(FIGURES.filter(([, re]) => re.test(t)).map(([w]) => w), [], s);
  }
  for (const s of ['Elige 10 GB.', 'A 20 Mbps.', 'Por USD 9.99.', 'Hay 12 planes.', 'Más de veinte destinos.']) assert.ok(FIGURES.some(([, re]) => re.test(s)), s);
  for (const s of ['La red funciona a 230 V.', 'Desde el 25 de enero de 2024.']) assert.equal(FIGURES.some(([, re]) => re.test(s)), false, s);
});

test('own <title> and description on all 198 Spanish country pages; the authored ones differ beyond the name', () => {
  const titles = COUNTRIES.map((c) => titleOf(page(c.slug)));
  const descs = COUNTRIES.map((c) => descOf(page(c.slug)));
  const dupes = (l) => l.filter((x, i) => l.indexOf(x) !== i);
  assert.equal(titles.length, 198);
  assert.deepEqual(dupes(titles), []);
  assert.deepEqual(dupes(descs), []);
  const generic = (s, slug) => s.split(BY_SLUG.get(slug).name).join('·').toLowerCase();
  assert.deepEqual(dupes(AUTHORED.map((s) => generic(titleOf(page(s)), s))), [], 'titles that are one with the name swapped');
  assert.deepEqual(dupes(AUTHORED.map((s) => generic(descOf(page(s)), s))), [], 'descriptions that are one with the name swapped');
  for (const s of AUTHORED) assert.ok(titleOf(page(s)).length <= 60, s);
});

test('CONTENT_LANGS: English is what the module always did; Spanish words are its own', () => {
  assert.equal(CONTENT_LANGS.en.copy.faqTitle('Japan'), 'Questions about Japan');
  assert.equal(CONTENT_LANGS.es.copy.faqTitle('Japón'), 'Preguntas frecuentes: Japón');
  assert.equal(CONTENT_LANGS.es.descriptionSuffix, ' El pago en línea aún no está disponible.');
  assert.ok(existsSync(ES_DIR));
});
