/* Authored English country content — QA regression guards on the RENDERED pages (en/esim/<slug>/index.html), written
 * independently of the validator (seo/content-en.mjs): what a reader and a crawler actually get. Every guard has a
 * negative control that proves it fires.
 *
 *   a. each of the 15 indexed countries (seo/indexing.mjs INDEXED_COUNTRIES) has a content file, and its sections,
 *      questions and related links are in the static HTML — not hidden, not in <template>/<noscript>, no script needed;
 *   b. the authored blocks are not one template: pairwise similarity of the `div.cp-about` text stays below
 *      SIMILARITY_MAX. The measure is the LCS ratio over lower-cased word sequences, 2·LCS(a,b) / (|a|+|b|) — the
 *      longest common subsequence, which is never below Python difflib's SequenceMatcher.ratio() on the same
 *      sequences (difflib finds matching blocks greedily, LCS finds the optimum), so it is the stricter of the two;
 *   c. no plan figure (GB/MB, speed, currency, plan/destination count) in the rendered authored text, and every
 *      country a rendered sentence names as covered is in that country's `also` list (seo/global-plan-facts.json);
 *   d. unique <title> and meta description on every English country page; the 15 indexed authored titles and descriptions
 *      also differ once the country's name is taken out;
 *   e. the checkout window and the page's scripts on an authored page are those of a page without a file (the
 *      country's name and flag normalised), and the authored block holds no script;
 *   f. no FAQPage JSON-LD on any English page, one BreadcrumbList on each English country page, and the Russian pages
 *      carry nothing of the English content. Byte-for-byte against a base ref runs only when CONTENT_EN_QA_BASE is set
 *      (e.g. CONTENT_EN_QA_BASE=origin/main) — a catalogue-refresh branch legitimately changes the Russian pages, so an
 *      unconditional diff against main would fail every refresh. The one difference it allows is the hreflang block the
 *      Russian twin of a slug NEWLY added to INDEXED_COUNTRIES gains (ruTwinChange; its negative controls always run).
 *
 * Run: node --test seo/test-content-en-quality.mjs
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INDEXED_COUNTRIES, ruAlternates } from './indexing.mjs';
import { enCountries } from './build-en-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const page = (slug) => read(`en/esim/${slug}/index.html`);
const contentOf = (slug) => {
  const f = join(ROOT, 'seo/content-en', `${slug}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
};
const FACTS = JSON.parse(read('seo/global-plan-facts.json')).countries;
const COUNTRIES = enCountries();
const BY_SLUG = new Map(COUNTRIES.map((c) => [c.slug, c]));
const WITH_FILE = COUNTRIES.filter((c) => contentOf(c.slug)).map((c) => c.slug);
const WITHOUT_FILE = COUNTRIES.filter((c) => !contentOf(c.slug)).map((c) => c.slug);

const decode = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const textOf = (html) => decode(html.replace(/<\/?(?:a|b|i|em|strong|span)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const plainMd = (s) => String(s).replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '$1');
const ABOUT = /<div class="cp-about">([\s\S]*?)\n {2}<\/div>\n/;
/** The authored block of a page (its inner HTML), or null. */
const aboutOf = (html) => (html.match(ABOUT) || [])[1] ?? null;
/** The authored block without the «Related destinations» list (link names are not sentences). */
const proseOf = (about) => about.replace(/<section class="cp-about-sec cp-related"[\s\S]*?<\/section>/, '');

/* ===================================================================== *
 * a. Every indexed country has a file, rendered in the static HTML
 * ===================================================================== */

/** Problems of a page's static HTML against its content file ([] = every part is there, visible without JS). */
function staticProblems(html, doc) {
  const p = [];
  const about = aboutOf(html);
  if (about === null) return ['no <div class="cp-about"> in the static HTML'];
  const before = html.slice(0, html.indexOf('<div class="cp-about">'));
  const open = (tag) => (before.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length - (before.match(new RegExp(`</${tag}>`, 'g')) || []).length;
  for (const tag of ['template', 'noscript', 'script']) if (open(tag) > 0) p.push(`the authored block sits inside <${tag}>`);
  if (!before.includes('<main')) p.push('the authored block is outside <main>');
  if (/\shidden(?=[\s>=])|display:\s*none|aria-hidden="true"/.test(about)) p.push('something in the authored block is hidden');
  for (const s of doc.sections) {
    if (!about.includes(`>${esc(s.h2)}</h2>`)) p.push(`h2 «${s.h2}» missing`);
    for (const para of s.paragraphs) if (!textOf(about).includes(plainMd(para).replace(/\s+/g, ' '))) p.push(`paragraph «${para.slice(0, 40)}…» missing`);
  }
  const faqHtml = (about.match(/<section class="cp-about-sec cp-faq"[\s\S]*?<\/section>/) || [''])[0];
  const qs = [...faqHtml.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)];
  doc.faq.forEach((f, i) => {
    if (!qs[i] || decode(qs[i][1]) !== f.q) p.push(`question ${i + 1} «${f.q}» missing or out of order`);
    else if (textOf(qs[i][2]) !== plainMd(f.a).replace(/\s+/g, ' ')) p.push(`answer ${i + 1} differs from the file`);
  });
  if (qs.length !== doc.faq.length) p.push(`${qs.length} questions rendered, ${doc.faq.length} in the file`);
  const rel = (about.match(/<section class="cp-about-sec cp-related"[\s\S]*?<\/section>/) || [''])[0];
  for (const slug of doc.related) if (!rel.includes(`<a href="/en/esim/${slug}/">`)) p.push(`related link /en/esim/${slug}/ missing`);
  for (const slug of doc.related) if (!existsSync(join(ROOT, 'en/esim', slug, 'index.html'))) p.push(`related /en/esim/${slug}/ has no page`);
  return p;
}

test('a: each of the 15 indexed countries has a content file and renders it in the static HTML', () => {
  assert.equal(INDEXED_COUNTRIES.length, 15);
  for (const slug of INDEXED_COUNTRIES) {
    const doc = contentOf(slug);
    assert.ok(doc, `${slug}: no seo/content-en/${slug}.json`);
    const html = page(slug);
    assert.deepEqual(staticProblems(html, doc), [], slug);
    assert.match(html, /<meta name="robots" content="index, follow">/, `${slug}: indexed`);
  }
});

test('a: negative controls — a template page, a hidden block, a block in <template>, a dropped question all fail', () => {
  const doc = contentOf('japan');
  const html = page('japan');
  assert.ok(staticProblems(page(WITHOUT_FILE[0]), doc).length, 'a page without the block');
  assert.ok(staticProblems(html.replace('<div class="cp-about">', '<template><div class="cp-about">'), doc).some((x) => /inside <template>/.test(x)));
  assert.ok(staticProblems(html.replace('<div class="cp-about">', '<noscript><div class="cp-about">'), doc).some((x) => /inside <noscript>/.test(x)));
  assert.ok(staticProblems(html.replace('<section class="cp-about-sec"', '<section hidden class="cp-about-sec"'), doc).some((x) => /hidden/.test(x)));
  assert.ok(staticProblems(html.replace(/<details>[\s\S]*?<\/details>/, ''), doc).some((x) => /question 1/.test(x)));
  const about = aboutOf(html);
  const noRel = html.replace(about, about.replace(`<a href="/en/esim/${doc.related[0]}/">`, '<a href="/en/">'));
  assert.ok(staticProblems(noRel, doc).some((x) => /related link/.test(x)));
  assert.ok(staticProblems(html.replace(`>${esc(doc.sections[0].h2)}</h2>`, '>Something else</h2>'), doc).some((x) => /h2 «/.test(x)));
});

/* ===================================================================== *
 * b. The authored blocks are not one template
 * ===================================================================== */

const words = (html) => textOf(html).toLowerCase().split(/\s+/).filter(Boolean);
/** 2·LCS / (|a|+|b|) over word sequences (two-row dynamic programme). */
export function lcsRatio(a, b) {
  if (!a.length && !b.length) return 1;
  let prev = new Uint32Array(b.length + 1);
  let cur = new Uint32Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    [prev, cur] = [cur, prev];
  }
  return (2 * prev[b.length]) / (a.length + b.length);
}
/* Measured 2026-10-27 on the 13 authored blocks (78 pairs): mean 0.177, max 0.271 (france / united-kingdom) — the floor
 * two unrelated English texts share through function words. Threshold = measured max + 0.10, rounded up; well below
 * the 0.5 cap. A name-swapped copy scores ≈ 1, a page that reuses half of another's block ≈ 0.6 (controls below).
 * Re-measured 2026-10-27 on the 15 indexed blocks (+ malaysia, singapore; 105 pairs): mean 0.170, max 0.254 (france /
 * united-kingdom); malaysia / singapore 0.167; uae (written, not indexed) ≤ 0.178 against any of them. Below the
 * threshold, so it stays — it is never raised to let a page through. */
export const SIMILARITY_MAX = 0.38;

test('b: authored blocks of the 15 indexed pages are pairwise below SIMILARITY_MAX (LCS word ratio)', () => {
  const w = Object.fromEntries(INDEXED_COUNTRIES.map((s) => [s, words(aboutOf(page(s)))]));
  const over = [];
  for (let i = 0; i < INDEXED_COUNTRIES.length; i += 1) {
    for (let j = i + 1; j < INDEXED_COUNTRIES.length; j += 1) {
      const [a, b] = [INDEXED_COUNTRIES[i], INDEXED_COUNTRIES[j]];
      const r = lcsRatio(w[a], w[b]);
      if (r >= SIMILARITY_MAX) over.push(`${a} / ${b}: ${r.toFixed(3)}`);
    }
  }
  assert.deepEqual(over, [], `authored blocks too alike (≥ ${SIMILARITY_MAX})`);
  assert.ok(SIMILARITY_MAX <= 0.5);
});

test('b: negative controls — a name-swapped copy and a half-copied block exceed the threshold; the ratio is exact on small cases', () => {
  assert.equal(lcsRatio(['a', 'b', 'c'], ['a', 'b', 'c']), 1);
  assert.equal(lcsRatio(['a', 'b'], ['c', 'd']), 0);
  assert.equal(lcsRatio(['a', 'x', 'b', 'c'], ['a', 'b', 'y', 'c']), 0.75);
  const jp = aboutOf(page('japan'));
  const th = aboutOf(page('thailand'));
  const swapped = jp.split('Japan').join('Thailand').split('Japanese').join('Thai');
  assert.ok(lcsRatio(words(jp), words(swapped)) > 0.9, 'name swap');
  const secs = (h) => [...h.matchAll(/<section class="cp-about-sec" id[\s\S]*?<\/section>/g)].map((m) => m[0]);
  const jpSecs = secs(jp).map((s) => s.split('Japan').join('Thailand'));
  const thSecs = secs(th);
  const half = [...jpSecs.slice(0, Math.ceil(jpSecs.length / 2)), ...thSecs.slice(Math.ceil(thSecs.length / 2))].join('\n');
  const r = lcsRatio(words(jp), words(half));
  assert.ok(r >= SIMILARITY_MAX, `half copy scores ${r.toFixed(3)}`);
});

/* ===================================================================== *
 * c. No plan figure in rendered prose; covered countries are in `also`
 * ===================================================================== */

const NUM_WORDS = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|dozens?|hundreds';
const FIGURES = [
  ['a data volume', /\d\s*(?:[.,]\d+)?\s*(?:GB|MB|TB|GiB|MiB|gigabytes?|megabytes?)(?![\p{L}])/iu],
  ['a speed', /\d\s*(?:kbps|Mbps|Gbps|Mb\/s|Kb\/s)/i],
  ['a currency amount', /[$€£¥₩₫฿₺₹]|\b(?:USD|EUR|GBP|US\$)\b|\d\s*(?:dollars?|euros?|cents?)\b/i],
  ['a plan or place count', new RegExp(`\\b(?:\\d+|${NUM_WORDS})\\+?\\s+(?:(?:local|regional|daily|data|eSIM|different|more|other)\\s+)?(?:plans|packages|options|eSIMs|destinations|countries)\\b`, 'i')],
  // «from 4», «from just 9.99» — a price floor; a sourced time or date («from 72 hours before arrival», «From 25 May») is not.
  ['«from N»', /\bfrom\s+(?:just\s+|only\s+)?\d[\d.,]*(?![\d.,]|\s*(?:hours?|minutes?|days?|weeks?|months?|years?|a\.m\.|p\.m\.|am\b|pm\b|:|(?:January|February|March|April|May|June|July|August|September|October|November|December)\b))/i],
];
const figureProblems = (text) => FIGURES.filter(([, re]) => re.test(text)).map(([what]) => `${what}: «${text.match(FIGURES.find(([w]) => w === what)[1])[0]}»`);

test('c: no plan figure (volume, speed, currency, count, «from N») anywhere in the rendered authored block', () => {
  for (const slug of INDEXED_COUNTRIES) assert.deepEqual(figureProblems(textOf(aboutOf(page(slug)))), [], slug);
});

test('c: negative controls — each figure kind fires; sourced country facts with numbers do not', () => {
  for (const s of ['Most visitors take 10 GB.', 'A 500MB top-up.', 'Speeds of 20 Mbps.', 'It costs $9.99.', 'About 12 USD.', 'Pay 5 euros.',
    '¥3,000 for a pass.', 'There are 12 plans for Japan.', 'Choose from twenty destinations.', 'Plans from 4 a week.', 'Five daily plans exist.']) {
    assert.ok(figureProblems(s).length, s);
  }
  for (const s of ['The form opens 3 days before your travel date.', 'Call 1155, which runs 24 hours.', 'The supply is 230 V at 50 Hz.',
    'Free Wi-Fi at its six airports.', 'One plan may suit the whole trip.',
    'It is submitted online from 72 hours before arrival.', 'From 25 May 2026, the rule changes.']) {
    assert.deepEqual(figureProblems(s), [], s);
  }
});

/* An independent name matcher: the English page names plus the short forms travellers write. Longest first; a match
 * is blanked so «Northern Ireland» is not also «Ireland». */
const ALIASES = { GB: ['UK', 'Britain', 'Great Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland'], KR: ['Korea'], TR: ['Turkey'],
  MO: ['Macau'], US: ['USA', 'United States', 'America'], AE: ['UAE'], CZ: ['Czech Republic'], VN: ['Viet Nam'], NL: ['Holland'] };
const NAMES = COUNTRIES.flatMap((c) => [c.name, ...(ALIASES[c.iso] || [])].map((n) => [c.iso, n])).sort((a, b) => b[1].length - a[1].length);
function named(text) {
  let t = text.replace(/[’']/g, "'");
  const out = new Set();
  for (const [iso, n] of NAMES) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}-])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}-])`, 'gu');
    if (re.test(t)) { out.add(iso); t = t.replace(re, (m) => ' '.repeat(m.length)); }
  }
  return out;
}
const COVER = /\b(?:cover(?:s|ed|ing)?|includ(?:e|es|ed|ing))\b/i;
const sentencesOf = (text) => text.split(/(?<=[.?!])\s+(?=[A-Z0-9"“(])/).map((s) => s.trim()).filter(Boolean);
/** Countries a rendered sentence names as covered by a plan that are not in the country's `also` list. */
let coverageSentencesSeen = 0;
function coverageProblems(iso, aboutHtml, facts = FACTS) {
  const also = new Set([iso, ...((facts[iso] && facts[iso].also) || [])]);
  const p = [];
  const blocks = [...proseOf(aboutHtml).matchAll(/<(p|li|summary|h2)>([\s\S]*?)<\/\1>/g)].map((m) => textOf(m[2]));
  for (const s of blocks.flatMap(sentencesOf)) {
    if (!COVER.test(s) || !/\bplans?\b/i.test(s)) continue;
    if (named(s).size > 1) coverageSentencesSeen += 1;
    for (const c of named(s)) if (!also.has(c)) p.push(`${c} named as covered in «${s}»`);
  }
  return p;
}

test('c: every country a rendered sentence says a plan covers is in that country\'s `also` list', () => {
  for (const slug of INDEXED_COUNTRIES) {
    const { iso } = BY_SLUG.get(slug);
    assert.deepEqual(coverageProblems(iso, aboutOf(page(slug))), [], slug);
  }
  assert.ok(coverageSentencesSeen >= 10, `the scan read only ${coverageSentencesSeen} coverage sentences naming another country — is it blind?`);
});

test('c: every regional_also claim is rendered word for word and its codes are in `also`', () => {
  for (const slug of INDEXED_COUNTRIES) {
    const doc = contentOf(slug);
    const html = page(slug);
    const text = [textOf(proseOf(aboutOf(html))), textOf(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1]), titleOf(html), descOf(html)].join(' ');
    const also = new Set(FACTS[doc.iso].also || []);
    for (const c of doc.plan_claims) {
      assert.ok(text.includes(plainMd(c.quote)), `${slug}: claim not on the page «${c.quote}»`);
      if (c.kind === 'regional_also') for (const code of c.codes) assert.ok(also.has(code), `${slug}: ${code} not in also («${c.quote}»)`);
      if (c.kind === 'local') assert.ok(FACTS[doc.iso].local && FACTS[doc.iso].local.gb.length, `${slug}: local claim without local plans`);
      if (c.kind === 'daily') assert.ok(FACTS[doc.iso].daily && FACTS[doc.iso].daily.gb_per_day.length, `${slug}: daily claim without daily plans`);
    }
  }
});

test('c: negative controls — a country outside `also`, an alias, and a shrunk `also` list fire', () => {
  const th = aboutOf(page('thailand'));
  const add = (s) => th.replace('<section class="cp-about-sec cp-faq"', `<p>${s}</p>\n<section class="cp-about-sec cp-faq"`);
  assert.ok(coverageProblems('TH', add('Regional plans that include Thailand also cover France.')).some((x) => /^FR /.test(x)));
  assert.ok(coverageProblems('TH', add('Plans covering Thailand include the UK.')).some((x) => /^GB /.test(x)));
  assert.ok(coverageProblems('TH', th, { ...FACTS, TH: { ...FACTS.TH, also: [] } }).length, 'with an empty also list every named neighbour fires');
  assert.deepEqual(coverageProblems('TH', add('Many visitors fly on to France.')), [], 'a country named without a coverage verb is not a coverage claim');
  assert.deepEqual([...named('Belfast, Northern Ireland, and Papua New Guinea')].sort(), ['GB', 'PG']);
});

/* ===================================================================== *
 * d. Unique titles and descriptions
 * ===================================================================== */

const titleOf = (html) => decode(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
const descOf = (html) => decode(html.match(/<meta name="description" content="([^"]*)">/)[1]);
const dupes = (list) => list.filter((x, i) => list.indexOf(x) !== i);
/** A title or description with the country's names (page name, aliases, the file's own spellings) taken out. */
function generic(s, slug) {
  const c = BY_SLUG.get(slug);
  const names = [c.name, ...(ALIASES[c.iso] || []), ...slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1))];
  let t = s;
  for (const n of names.sort((a, b) => b.length - a.length)) t = t.split(`the ${n}`).join('·').split(n).join('·');   // «eSIM for the Maldives» (EN_THE)
  return t.replace(/·(\s*·)+/g, '·').toLowerCase().replace(/\s+/g, ' ').trim();
}

test('d: every English country page has its own <title> and meta description', () => {
  const titles = COUNTRIES.map((c) => titleOf(page(c.slug)));
  const descs = COUNTRIES.map((c) => descOf(page(c.slug)));
  assert.equal(titles.length, 198);
  assert.deepEqual(dupes(titles), []);
  assert.deepEqual(dupes(descs), []);
  for (const slug of WITH_FILE) {
    assert.equal(titleOf(page(slug)), contentOf(slug).title, slug);
    assert.equal(descOf(page(slug)), contentOf(slug).description, slug);
  }
});

test('d: the authored titles and descriptions differ beyond the country name', () => {
  const t = INDEXED_COUNTRIES.map((s) => generic(titleOf(page(s)), s));
  const d = INDEXED_COUNTRIES.map((s) => generic(descOf(page(s)), s));
  assert.deepEqual(dupes(t), [], 'titles that are one title with the name swapped');
  assert.deepEqual(dupes(d), [], 'descriptions that are one with the name swapped');
  // The template titles, by contrast, ARE one title with the name swapped (negative control).
  const tpl = WITHOUT_FILE.slice(0, 20).map((s) => generic(titleOf(page(s)), s));
  assert.ok(new Set(tpl).size <= 2, `template titles: ${[...new Set(tpl)].join(' | ')}`);
  assert.equal(generic('Japan eSIM: data | Magic eSIM', 'japan'), generic('Thailand eSIM: data | Magic eSIM', 'thailand'));
  assert.equal(generic('UK eSIM: data | Magic eSIM', 'united-kingdom'), generic('Greece eSIM: data | Magic eSIM', 'greece'));
});

/* ===================================================================== *
 * e. Checkout untouched
 * ===================================================================== */

const CHECKOUT = /<div class="overlay" id="checkout"[\s\S]*?\n<\/div>\n(?=\n<footer)/;
function normalise(s, slug) {
  const c = BY_SLUG.get(slug);
  return s.split(`the ${esc(c.name)}`).join('{NAME}').split(`the ${c.name}`).join('{NAME}').split(esc(c.name)).join('{NAME}').split(c.name).join('{NAME}')
    .split(`/assets/flags/${c.iso.toLowerCase()}.svg`).join('/assets/flags/{iso}.svg').split(`/en/esim/${slug}/`).join('/en/esim/{slug}/');
}
const checkoutOf = (html, slug) => { const m = html.match(CHECKOUT); return m ? normalise(m[0], slug) : null; };
const scriptsOf = (html, slug) => [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map((m) => normalise(m[0], slug));
const REFERENCE = WITHOUT_FILE.includes('italy') ? 'italy' : WITHOUT_FILE[0];

test('e: the checkout window and the scripts of an authored page are those of a page without a file', () => {
  const refCheckout = checkoutOf(page(REFERENCE), REFERENCE);
  const refScripts = scriptsOf(page(REFERENCE), REFERENCE);
  assert.ok(refCheckout && refCheckout.includes('id="coPay" disabled'), 'reference checkout found, pay disabled');
  for (const slug of WITH_FILE) {
    const html = page(slug);
    assert.equal(checkoutOf(html, slug), refCheckout, `${slug}: checkout window`);
    assert.deepEqual(scriptsOf(html, slug), refScripts, `${slug}: scripts`);
    assert.equal(/<script|\son[a-z]+=/i.test(aboutOf(html)), false, `${slug}: no script or handler in the authored block`);
  }
});

test('e: negative controls — a changed checkout, an added script, a script in the block are seen', () => {
  const slug = WITH_FILE[0];
  const html = page(slug);
  const ref = checkoutOf(page(REFERENCE), REFERENCE);
  assert.notEqual(checkoutOf(html.replace('id="coPay" disabled', 'id="coPay"'), slug), ref);
  assert.notEqual(checkoutOf(html.replace('<div class="co-head">', '<div class="co-head"><p>Buy now</p>'), slug), ref);
  assert.equal(checkoutOf(html.replace('id="checkout"', 'id="checkout2"'), slug), null);
  assert.notDeepEqual(scriptsOf(html.replace('</body>', '<script src="/x.js"></script></body>'), slug), scriptsOf(page(REFERENCE), REFERENCE));
  assert.equal(/<script/i.test(aboutOf(html.replace('<div class="cp-about">', '<div class="cp-about"><script>1</script>'))), true);
});

/* ===================================================================== *
 * f. Structured data, and the Russian pages
 * ===================================================================== */

function htmlFiles(dir) {
  const out = [];
  for (const e of readdirSync(join(ROOT, dir))) {
    const p = `${dir}/${e}`;
    if (statSync(join(ROOT, p)).isDirectory()) out.push(...htmlFiles(p));
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
}
const ldBlocks = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const hasFaqLd = (html) => ldBlocks(html).some((b) => JSON.stringify(b).includes('"FAQPage"')) || /"@type"\s*:\s*"(FAQPage|Question)"|acceptedAnswer|itemtype="[^"]*FAQPage/.test(html);

test('f: no FAQPage on any English page; one BreadcrumbList, and only that, on every English country page', () => {
  const files = htmlFiles('en');
  assert.ok(files.length > 200);
  assert.deepEqual(files.filter((f) => hasFaqLd(read(f))), []);
  for (const c of COUNTRIES) {
    const b = ldBlocks(page(c.slug));
    assert.deepEqual(b.map((x) => x['@type']), ['BreadcrumbList'], c.slug);
    assert.equal(b[0].itemListElement.at(-1).item, `https://magicesim.store/en/esim/${c.slug}/`, c.slug);
  }
  // Negative controls.
  assert.equal(hasFaqLd('<script type="application/ld+json">{"@type":"FAQPage","mainEntity":[]}</script>'), true);
  assert.equal(hasFaqLd('<div itemscope itemtype="https://schema.org/FAQPage"></div>'), true);
  assert.equal(hasFaqLd(page('japan')), false);
});

const RU_FILES = () => [...readdirSync(join(ROOT, 'esim'), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(ROOT, 'esim', d.name, 'index.html')))
  .map((d) => `esim/${d.name}/index.html`), 'esim/index.html', 'index.html'];
/** What of the English authored content a Russian page must never carry. */
const ruLeak = (html) => /cp-about|\/en\/content\.css|cpFaqTitle|cpRelatedTitle/.test(html);

test('f: the Russian pages carry nothing of the English authored content', () => {
  const files = RU_FILES();
  assert.ok(files.length >= 190);
  assert.deepEqual(files.filter((f) => ruLeak(read(f))), []);
  assert.equal(ruLeak(page('japan')), true, 'negative control: an authored English page is seen');
});

/** The ONE Russian change a wider indexing stage may bring (2026-10-27): the twin of a slug NEWLY added to
 *  INDEXED_COUNTRIES gains exactly its hreflang block — ruAlternates(), right where the generator puts it — and
 *  nothing else. Strip exactly that block once and the file must be the base's byte for byte. Problems ([] = allowed). */
export function ruTwinChange(file, now, old, newly) {
  const m = String(file).match(/^esim\/([a-z0-9-]+)\/index\.html$/);
  if (!m || !newly.includes(m[1])) return [`${file}: a Russian file differs, and it is not the twin of a newly indexed slug`];
  const block = ruAlternates(`/esim/${m[1]}/`);
  if (!block) return [`${file}: ${m[1]} has no cluster, so no hreflang block may appear`];
  if (/hreflang=/.test(old)) return [`${file}: the base already carried alternates`];
  const i = now.indexOf(block);
  if (i < 0 || now.indexOf(block, i + 1) >= 0) return [`${file}: the hreflang block is not there exactly once`];
  return now.slice(0, i) + now.slice(i + block.length) === old ? [] : [`${file}: differs beyond the added hreflang block`];
}

test('f: the one allowed Russian change — negative controls (run always)', () => {
  const slug = INDEXED_COUNTRIES.find((s) => existsSync(join(ROOT, 'esim', s, 'index.html')) && ruAlternates(`/esim/${s}/`));
  const f = `esim/${slug}/index.html`;
  const now = read(f);
  const block = ruAlternates(`/esim/${slug}/`);
  const old = now.replace(block, '');
  assert.deepEqual(ruTwinChange(f, now, old, [slug]), [], 'the block added to a newly indexed twin is allowed');
  assert.ok(ruTwinChange(f, now, old, []).length, 'the same change on a slug that was already indexed fails');
  assert.ok(ruTwinChange(f, now.replace('<title>', '<title>x'), old, [slug]).some((x) => /beyond the added hreflang/.test(x)), 'any other byte fails');
  assert.ok(ruTwinChange(f, now.replace(block, block + block), old, [slug]).some((x) => /exactly once/.test(x)), 'a doubled block fails');
  assert.ok(ruTwinChange(f, now.replace(block, block.replace('hreflang="es"', 'hreflang="de"')), old, [slug]).length, 'a different block fails');
  assert.ok(ruTwinChange(f, now, now, [slug]).some((x) => /already carried/.test(x)), 'a base that already had alternates fails');
  assert.ok(ruTwinChange('index.html', now, old, [slug]).length, 'a non-country Russian file never qualifies');
  assert.ok(ruTwinChange('seo/content-profiles/japan.json', now, old, [slug]).length, 'a profile never qualifies');
});

const BASE = process.env.CONTENT_EN_QA_BASE;
test('f: the Russian pages are byte-identical to CONTENT_EN_QA_BASE, but for the hreflang block of newly indexed twins (only when that variable is set)', { skip: BASE ? false : 'set CONTENT_EN_QA_BASE=origin/main to run' }, () => {
  const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 });
  git('rev-parse', '--verify', `${BASE}^{commit}`);
  const changed = (paths) => git('diff', '--name-only', BASE, '--', ...paths).split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard', '--', 'esim', 'index.html').split('\n').filter(Boolean);
  const baseStage = (git('show', `${BASE}:seo/indexing.mjs`).match(/INDEXED_COUNTRIES = Object\.freeze\(\[([\s\S]*?)\]\)/) || [])[1];
  assert.ok(baseStage !== undefined, `${BASE}: INDEXED_COUNTRIES not found`);
  const before = [...baseStage.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
  const newly = INDEXED_COUNTRIES.filter((s) => !before.includes(s));
  assert.deepEqual(untracked, [], `untracked Russian files against ${BASE}`);
  const bad = changed(['esim', 'index.html', 'seo/content-profiles'])
    .flatMap((f) => ruTwinChange(f, read(f), git('show', `${BASE}:${f}`), newly));
  assert.deepEqual(bad, [], `Russian files differ from ${BASE}`);
  // Byte-for-byte on a sample through git show, as a second route to the same answer; and a negative control.
  for (const f of ['index.html', 'esim/index.html', 'esim/japan/index.html', 'esim/thailand/index.html']) {
    assert.equal(read(f), git('show', `${BASE}:${f}`), f);
  }
  assert.notEqual(read('esim/japan/index.html') + ' ', git('show', `${BASE}:esim/japan/index.html`));
  // The authored English pages against the base: the same scripts, the same checkout window.
  // The words bundle's content stamp is the one version left out: its content IS the dictionary, pinned word for word by
  // test/fixtures/site-i18n-words-golden.json (re-recorded only on purpose) — the same reason the sitemap hash strips it
  // (stripSiteI18nBundle). Every other script keeps its stamp, so a changed script is still seen.
  const scriptSet = (html, slug) => scriptsOf(html, slug).filter((s) => !s.includes('ld+json'))
    .map((s) => s.replace(/(\/assets\/site-i18n-[a-z]+\.js)\?v=[0-9a-f]+/, '$1'));
  for (const slug of WITH_FILE) {
    const old = git('show', `${BASE}:en/esim/${slug}/index.html`);
    assert.equal(checkoutOf(page(slug), slug), checkoutOf(old, slug), `${slug}: checkout vs ${BASE}`);
    assert.deepEqual(scriptSet(page(slug), slug), scriptSet(old, slug), `${slug}: scripts vs ${BASE}`);
  }
});
