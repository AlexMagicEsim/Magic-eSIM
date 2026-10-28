/* Authored English country content (seo/content-en/<slug>.json): the validator's rules — each with a negative control
 * that proves it fires — every committed file, and how a page with a file renders (and a page without one does not).
 * The rendering is proved on a FIXTURE (test/fixtures/content-en-japan.json), never on a committed file.
 *
 * Run: node --test seo/test-content-en.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateContent, crossProblems, checkAll, contentSlugs, loadContent, namedCountries, sentences, GUARD_IDS, LIMITS,
  CONTENT_LANGS,
} from './content-en.mjs';
import { CLAIM_GUARDS } from './claim-guards.mjs';
import { countryPage, enCountries } from './build-en-pages.mjs';
import { localeGenerator } from './build-locale-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const FIXTURE = JSON.parse(read('test/fixtures/content-en-japan.json'));
const fx = () => structuredClone(FIXTURE);
const OPTS = { file: 'japan', today: '2026-10-27' };
const problems = (doc, opts = {}) => validateContent(doc, { ...OPTS, ...opts });
const JAPAN = enCountries().find((c) => c.slug === 'japan');

/** The doc must fail with a problem matching `re` (and the fixture itself must not). */
function fires(mutate, re, opts = {}) {
  const doc = fx();
  mutate(doc);
  const p = problems(doc, opts);
  assert.ok(p.some((x) => re.test(x)), `expected ${re} in:\n${p.join('\n') || '(no problem)'}`);
}
const addParagraph = (text) => (d) => { d.sections[0].paragraphs.push(text); };

/* ===================================================================== *
 * 1. The fixture is a valid file — every control below breaks ONE thing
 * ===================================================================== */

test('the fixture passes every rule', () => {
  assert.deepEqual(problems(fx()), []);
});

/* ===================================================================== *
 * 2. Schema
 * ===================================================================== */

test('schema: unknown and missing keys, slug, file name, ISO, types', () => {
  fires((d) => { d.extra = 1; }, /unknown key «extra»/);
  fires((d) => { delete d.lead; }, /«lead» is missing/);
  fires((d) => { d.slug = 'atlantis'; }, /no catalogue page/);
  fires(() => {}, /is not the file name/, { file: 'thailand' });
  fires((d) => { d.iso = 'TH'; }, /not japan's code/);
  fires((d) => { d.sections[0].colour = 'red'; }, /sections\[0\] unknown key/);
  fires((d) => { d.faq[0].extra = 'x'; }, /faq\[0\] unknown key/);
  fires((d) => { d.sections[0].paragraphs = []; }, /paragraphs must be/);
  fires((d) => { d.sections[0].list = []; }, /list must be/);
  fires((d) => { d.reviewed = { research: 'a' }; }, /reviewed\.copy must be a string/);
  fires((d) => { d.plan_claims[0].kind = 'world'; }, /kind must be one of/);
  fires((d) => { d.plan_claims[0].codes = ['kr']; }, /codes must be ISO codes/);
  assert.deepEqual(validateContent(null), ['schema: the file is not a JSON object']);
});

test('title: at most 60 characters, ends « | Magic eSIM»', () => {
  fires((d) => { d.title = `${'Japan '.repeat(9)}| Magic eSIM`; }, /title: \d+ characters, at most 60/);
  fires((d) => { d.title = 'Japan eSIM data plans'; }, /title: must end with/);
  assert.equal(LIMITS.titleMax, 60);
});

/* 2026-10-28 (SEO stage 7, owner-gated D3 of SEO_STAGE6_GSC_AUDIT): the description used to have to END with «Online
 * payment is not available yet.». That pin is turned round on purpose: the payment state stays on the page (#previewNotice,
 * the payment bar, the disabled #coPay), never in a search snippet — and the old suffix is now the first sentence refused. */
test('description: 120–155 characters, names the country and «eSIM», says nothing about payment', () => {
  fires((d) => { d.description = 'Short Japan eSIM note.'; }, /description: \d+ characters, must be 120–155/);
  fires((d) => { d.description = `${'Japan eSIM data plans and travel notes. '.repeat(4)}`.trim(); }, /description: \d+ characters/);
  fires((d) => { d.description = d.description.replace('eSIM ', ''); }, /description: must say «eSIM»/);
  fires((d) => { d.description = d.description.replace('Japan', 'the country'); }, /description: must name Japan/);
  const pay = /no statement about payment/;
  fires((d) => { d.description = `${d.description.slice(0, 110)} Online payment is not available yet.`; }, pay);
  for (const s of ['Payment is available now.', 'Buy now in two taps.', 'Get it instantly.', 'Payments are open.', 'Order online today.']) {
    fires((d) => { d.description = `${d.description.slice(0, 120)} ${s}`.slice(0, 155); }, pay);
  }
  // the guard reads payment ABOUT THE SITE, not a sentence about paying in the country (China: «where you mostly pay by phone»)
  const doc = fx(); doc.description = 'Japan eSIM for mobile data where you mostly pay by phone: Visit Japan Web, 100 V sockets and charging on the shinkansen.';
  assert.deepEqual(problems(doc).filter((x) => /payment/.test(x)), []);
});

test('lead: one or two sentences, not too long', () => {
  fires((d) => { d.lead = 'Japan by train. Japan by ferry. Japan by air.'; }, /lead: one or two sentences/);
  fires((d) => { d.lead = 'Japan '.repeat(60).trim(); }, /lead: \d+ characters/);
});

test('sections: 2–4, enough words but not padding, anchors unique and free', () => {
  fires((d) => { d.sections = d.sections.slice(0, 1); }, /sections: 1, must be 2–4/);
  fires((d) => { d.sections = [...d.sections, ...d.sections, ...d.sections].map((s, i) => ({ ...s, id: `s${i}` })); }, /sections: 6, must be 2–4/);
  fires((d) => { d.sections.forEach((s) => { s.paragraphs = ['Japan is in Asia.']; delete s.list; }); }, /words of section prose/);
  fires((d) => { d.sections[1].id = d.sections[0].id; }, /used twice/);
  fires((d) => { d.sections[0].id = 'faq'; }, /taken by the page/);
  fires((d) => { d.sections[0].id = 'Before_You'; }, /lower-case ascii anchor/);
});

test('faq: 4–6 questions, each a question, none twice', () => {
  fires((d) => { d.faq = d.faq.slice(0, 3); }, /faq: 3 questions, must be 4–6/);
  fires((d) => { d.faq = [...d.faq, ...d.faq].map((f, i) => ({ q: `Question ${i} about Japan?`, a: f.a })); }, /faq: 10 questions/);
  fires((d) => { d.faq[0].q = 'Tell me about Japan.'; }, /ends with «\?»/);
  fires((d) => { d.faq[1].q = d.faq[0].q; }, /asked twice/);
});

test('related: 3–6 existing pages, never itself, never twice', () => {
  fires((d) => { d.related = ['china', 'taiwan']; }, /related: 2 pages, must be 3–6/);
  fires((d) => { d.related = ['japan', 'china', 'taiwan']; }, /does not relate to itself/);
  fires((d) => { d.related = ['atlantis', 'china', 'taiwan']; }, /«atlantis» is not a catalogue page/);
  fires((d) => { d.related = ['china', 'china', 'taiwan']; }, /listed twice/);
});

/* ===================================================================== *
 * 3. No plan numbers in prose
 * ===================================================================== */

test('numbers: no volume, speed, currency, «from $», count; a day figure only when sourced', () => {
  fires(addParagraph('Most visitors take 10 GB.'), /a data volume or speed/);
  fires(addParagraph('Speeds reach 20 Mbps in town.'), /a data volume or speed/);
  fires(addParagraph('A week costs $9.99 here.'), /a currency sign/);
  fires(addParagraph('A rail pass costs ¥50,000 in Japan.'), /a currency sign/);
  fires(addParagraph('Plans are 12 USD in Japan.'), /a US-dollar amount/);
  fires(addParagraph('There are 12 plans for Japan.'), /a count of plans or places/);
  fires(addParagraph('Japan has twenty destinations nearby.'), /a count of plans or places/);
  fires((d) => { d.faq[0].a = 'A stay of 90 days is allowed for many visitors.'; }, /day\/week\/month figure/);
  fires((d) => { d.sections[0].h2 = 'A 30-day trip to Japan'; }, /day\/week\/month figure/);
  // …and a sourced day figure passes.
  const d = fx();
  d.faq[0].a = 'A stay of 90 days is allowed for many visitors.';
  d.sources.push({ url: 'https://www.mofa.go.jp/j_info/visit/visa/', title: 'MOFA — Visa', checked: '2026-10-27', supports: 'visa-free stay length', sentences: ['A stay of 90 days is allowed for many visitors.'] });
  assert.deepEqual(problems(d), []);
  // Plain English that is not a figure passes.
  const ok = fx();
  ok.sections[0].paragraphs.push('Prices on this page are shown in US dollars, and one plan may suit a whole trip.');
  assert.deepEqual(problems(ok), []);
});

/* ===================================================================== *
 * 4. The claim guards of seo/claim-guards.mjs, plus `tech` and China
 * ===================================================================== */

test('every English guard the spec names fires on its own sentence in any prose field', () => {
  assert.deepEqual([...GUARD_IDS].sort(), ['cardRow', 'delivery', 'devices', 'features', 'installEarly', 'marketing', 'money', 'network', 'reusableQr', 'suppliers', 'template'].sort());
  for (const id of GUARD_IDS) {
    const sentence = CLAIM_GUARDS.en[id].fires[0];
    fires(addParagraph(`${sentence}.`), new RegExp(`guard «${id}»`));
    fires((d) => { d.faq[2].a = `${sentence}.`; }, new RegExp(`faq\\[2\\]\\.a: guard «${id}»`));
  }
  fires((d) => { d.title = 'Fast eSIM for Japan | Magic eSIM'; }, /title: guard «network»/);
  fires((d) => { d.sections[1].h2 = 'Is there a hotspot option?'; }, /h2: guard «features»/);
  fires((d) => { d.sections[0].list[0] = 'Ask a tour operator in Japan.'; }, /list\[0\]: guard «template»/);
});

test('tech: the words the browser error check reads as a leaked message', () => {
  fires(addParagraph('An error screen in Japan means the app needs a restart.'), /guard «tech»/);
  fires(addParagraph('Code 503 appears in Japan sometimes.'), /guard «tech»/);
});

test('China: never a promise past the restrictions', () => {
  const cn = { ...fx(), slug: 'china', iso: 'CN' };
  for (const s of ['An eSIM lets you bypass the firewall.', 'Use it to unblock apps.', 'A VPN-free connection.', 'You can access Google from China.']) {
    const d = structuredClone(cn);
    d.sections[0].paragraphs.push(s);
    assert.ok(problems(d, { file: 'china' }).some((x) => /China — never promise/.test(x)), s);
  }
  // The same sentence on Japan's page is not a China promise (the other rules still apply to it).
  const jp = fx();
  jp.sections[0].paragraphs.push('Use it to unblock apps.');
  assert.equal(problems(jp).some((x) => /China — never promise/.test(x)), false);
});

/* ===================================================================== *
 * 5. Plan claims and other countries
 * ===================================================================== */

const FACTS = JSON.parse(read('seo/global-plan-facts.json'));
const withFacts = (patch) => ({ ...FACTS, countries: { ...FACTS.countries, JP: { ...FACTS.countries.JP, ...patch } } });

test('a sentence about the plan blocks must be a plan_claims quote', () => {
  fires(addParagraph('Regional plans are handy for a longer trip.'), /must be a plan_claims quote/);
  fires(addParagraph('Daily data suits a short stay.'), /must be a plan_claims quote/);
  fires((d) => { d.faq[0].a = 'There are plans that cover Japan.'; }, /must be a plan_claims quote/);
  fires((d) => { d.plan_claims.splice(1, 1); }, /Local plans cover Japan alone.*must be a plan_claims quote|must be a plan_claims quote.*Local plans/);
});

test('every quote is in the prose word for word and holds against seo/global-plan-facts.json', () => {
  fires((d) => { d.plan_claims[1].quote = 'Local plans cover Japan only.'; }, /not in the prose, word for word/);
  fires(() => {}, /JP has no local plans/, { facts: withFacts({ local: { gb: [], days: [] } }) });
  fires(() => {}, /JP has no daily plans/, { facts: withFacts({ daily: { gb_per_day: [], days: [] } }) });
  fires(() => {}, /CN is not among the destinations/, { facts: withFacts({ also: ['KR'] }) });
  fires((d) => { d.plan_claims[2].codes = ['KR']; }, /names China but its codes do not list CN/);
  fires((d) => { d.plan_claims[2].codes = []; }, /regional_also lists the codes/);
  fires((d) => {
    d.sections[1].paragraphs[0] = d.sections[1].paragraphs[0].replace('stays in the country.', 'stays in the country, not Taiwan.');
    d.plan_claims[1].quote = 'Local plans cover Japan alone and suit a trip that stays in the country, not Taiwan.';
  }, /a local claim names Taiwan/);
  // The negative kinds: only where the facts agree.
  fires((d) => { d.sections[0].paragraphs.push('No regional plan covers more than Japan.'); d.plan_claims.push({ quote: 'No regional plan covers more than Japan.', kind: 'no_regional' }); }, /regional plans DO cover/);
  const d = fx();
  d.sections[0].paragraphs.push('No regional plan covers more than Japan.');
  d.plan_claims.push({ quote: 'No regional plan covers more than Japan.', kind: 'no_regional' });
  assert.equal(problems(d, { facts: withFacts({ also: [] }) }).some((x) => /DO cover/.test(x)), false);
});

test('the negative kinds no_local / no_daily fire when the country HAS that block', () => {
  for (const [kind, re] of [['no_local', /HAS local plans/], ['no_daily', /HAS daily plans/]]) {
    fires((d) => { d.sections[0].paragraphs.push('Japan is an island nation.'); d.plan_claims.push({ quote: 'Japan is an island nation.', kind }); }, re);
  }
});

test('a sentence naming another catalogue country needs a plan claim or a source', () => {
  fires(addParagraph('Many travellers continue to Thailand.'), /names Thailand \(TH\)/);
  fires(addParagraph('The ferry to Busan leaves from Fukuoka, and Korea is close.'), /names Korea \(KR\)/);
  fires((d) => { d.faq[0].a = 'Visitors from the UK need no visa for a short stay.'; }, /names UK \(GB\)/);
  // Backed by a source that names the country, or that lists the sentence: passes.
  const a = fx();
  a.sections[0].paragraphs.push('Many travellers continue to Thailand.');
  a.sources.push({ url: 'https://www.tourismthailand.org/', title: 'TAT', checked: '2026-10-26', supports: 'routes from Japan to Thailand' });
  assert.deepEqual(problems(a), []);
  const b = fx();
  b.sections[0].paragraphs.push('Many travellers continue to Thailand.');
  b.sources.push({ url: 'https://www.jnto.go.jp/', title: 'JNTO', checked: '2026-10-26', supports: 'onward routes', sentences: ['Many travellers continue to Thailand.'] });
  assert.deepEqual(problems(b), []);
});

test('names are matched whole, longest first, and the own country is not «another»', () => {
  const iso = (t, own = 'JP') => namedCountries(t, own).map(([x]) => x);
  assert.deepEqual(iso('Papua New Guinea'), ['PG']);
  assert.deepEqual(iso('Belfast is in Northern Ireland'), ['GB']);
  assert.deepEqual(iso('Guinea-Bissau'), ['GW']);
  assert.deepEqual(iso('Japan and Tokyo'), []);
  assert.deepEqual(iso('Chinatown'), []);
  assert.deepEqual(iso('Côte d’Ivoire'), ['CI']);
  assert.deepEqual(sentences('One. Two? Three!'), ['One.', 'Two?', 'Three!']);
});

/* ===================================================================== *
 * 6. Sources and markup
 * ===================================================================== */

test('sources: at least one; https; a title; a real past date; what it backs; no forum, no competitor', () => {
  fires((d) => { d.sources = []; }, /at least one source/);
  fires((d) => { d.sources[0].url = 'http://www.japan.travel/en/'; }, /https only/);
  fires((d) => { d.sources[0].url = 'not a url'; }, /not a URL/);
  fires((d) => { d.sources[0].checked = '2026-13-01'; }, /a date YYYY-MM-DD/);
  fires((d) => { d.sources[0].checked = '27.10.2026'; }, /a date YYYY-MM-DD/);
  fires((d) => { d.sources[0].checked = '2026-11-30'; }, /in the future/);
  fires((d) => { d.sources[0].url = 'https://www.reddit.com/r/JapanTravel/'; }, /forum or another eSIM seller/);
  fires((d) => { d.sources[0].url = 'https://www.airalo.com/blog/japan'; }, /forum or another eSIM seller/);
  fires((d) => { d.sources[0].supports = ''; }, /supports must say/);
  fires((d) => { delete d.sources[0].title; }, /title must be a non-empty string/);
  fires((d) => { d.sources[0].sentences = ['A sentence that is not on the page.']; }, /backed sentence .* is not in the prose/);
});

test('sources: an optional review_by is a dated tripwire — after checked, at most six months on, refused once passed', () => {
  const ok = fx(); ok.sources[0].checked = '2026-10-01'; ok.sources[0].review_by = '2027-04-01';
  assert.deepEqual(problems(ok), [], 'a review date in the window passes');
  assert.equal(problems(ok, { today: '2027-04-01' }).some((x) => /review_by/.test(x)), false, 'the review day itself still passes');
  assert.ok(problems(ok, { today: '2027-04-02' }).some((x) => /review_by: 2027-04-01 has passed/.test(x)), 'the day after it is refused');
  fires((d) => { d.sources[0].checked = '2026-10-01'; d.sources[0].review_by = '2027-04-02'; }, /at most six months after checked/);
  fires((d) => { d.sources[0].review_by = d.sources[0].checked; }, /is not after checked/);
  fires((d) => { d.sources[0].review_by = '1.4.2027'; }, /review_by: a date YYYY-MM-DD/);
  fires((d) => { d.sources[0].review_by = '2027-02-30'; }, /review_by: a date YYYY-MM-DD/);
});

/* The UAE calling-app rule rests on TDRA pages that change (the Internet Guidelines moved in 2026); the dated tripwire
 * must not be dropped quietly. Every source on tdra.gov.ae, and every UAE source backing the VoIP / calling-app section,
 * carries review_by — and the UAE text keeps at least one TDRA source. */
export function tdraTripwireProblems(doc) {
  const p = [];
  const isTdra = (u) => { try { const h = new URL(u).hostname; return h === 'tdra.gov.ae' || h.endsWith('.tdra.gov.ae'); } catch { return false; } };
  const voip = (s) => doc.slug === 'uae' && /VoIP|voice over internet|calling app|internet call/i.test(`${s.title} ${s.supports}`);
  const srcs = Array.isArray(doc.sources) ? doc.sources : [];
  if (doc.slug === 'uae' && !srcs.some((s) => isTdra(s.url))) p.push('uae: the calling-app section has no TDRA source');
  for (const s of srcs) if ((isTdra(s.url) || voip(s)) && !s.review_by) p.push(`${doc.slug}: ${s.url} backs a TDRA rule without review_by`);
  return p;
}

test('the UAE calling-app rule keeps its dated tripwire: every TDRA / VoIP source carries review_by', () => {
  for (const slug of contentSlugs()) assert.deepEqual(tdraTripwireProblems(loadContent(slug)), [], slug);
  const uae = loadContent('uae');
  assert.ok(uae, 'seo/content-en/uae.json exists');
  const cut = structuredClone(uae);
  delete cut.sources.find((x) => /tdra\.gov\.ae/.test(x.url)).review_by;
  assert.ok(tdraTripwireProblems(cut).some((x) => /without review_by/.test(x)), 'a TDRA source without review_by fails');
  const moved = structuredClone(uae);
  moved.sources = moved.sources.filter((x) => !/tdra\.gov\.ae/.test(x.url));
  assert.ok(tdraTripwireProblems(moved).some((x) => /no TDRA source/.test(x)), 'a UAE text without its TDRA source fails');
  const mirror = structuredClone(uae);
  mirror.sources.push({ url: 'https://u.ae/en/voip', title: 'VoIP in the UAE', checked: '2026-10-27', supports: 'calling apps allowed in the UAE' });
  assert.ok(tdraTripwireProblems(mirror).some((x) => /u\.ae\/en\/voip/.test(x)), 'a non-TDRA source backing the VoIP rule needs review_by too');
});

test('markup: plain text; links only to existing /en/ pages; none in the head', () => {
  fires(addParagraph('Japan is <b>busy</b>.'), /no HTML/);
  fires(addParagraph('See [the tourist board](https://www.japan.travel/).'), /a link goes only to an \/en\/ page/);
  fires(addParagraph('See [nothing](/en/guides/nowhere/).'), /does not exist/);
  fires(addParagraph('See [broken(/en/guides/).'), /broken link markup/);
  fires((d) => { d.title = '[Japan](/en/) eSIM | Magic eSIM'; }, /no link markup in the head/);
});

/* ===================================================================== *
 * 7. Across files
 * ===================================================================== */

test('across files: no title, description, question, answer or paragraph that is another country\'s with the name swapped', () => {
  const th = structuredClone(FIXTURE);
  th.slug = 'thailand';
  const swap = (s) => s.split('Japan').join('Thailand');
  th.faq[0].q = swap(FIXTURE.faq[0].q);
  const p = crossProblems([{ slug: 'japan', doc: FIXTURE }, { slug: 'thailand', doc: th }]);
  assert.ok(p.some((x) => /thailand: question repeats japan's/.test(x)), p.join('\n'));
  assert.ok(p.some((x) => /thailand: title repeats japan's word for word/.test(x)), 'a title copied as it is');
  assert.ok(p.some((x) => /thailand: answer repeats japan's word for word/.test(x)), 'an answer copied as it is');
  const own = structuredClone(FIXTURE);
  own.slug = 'thailand';
  own.title = 'Thailand: mobile data for islands and cities | Magic eSIM';
  own.description = 'x'; own.faq = []; own.sections = [];
  assert.deepEqual(crossProblems([{ slug: 'japan', doc: FIXTURE }, { slug: 'thailand', doc: own }]), []);
});

/* ===================================================================== *
 * 8. Every committed file passes
 * ===================================================================== */

test('every committed seo/content-en/*.json passes every rule (node seo/content-en.mjs --check)', () => {
  const slugs = contentSlugs();
  const res = checkAll(slugs);
  const bad = Object.entries(res).filter(([, p]) => p.length).map(([s, p]) => `${s}:\n  ${p.join('\n  ')}`);
  assert.deepEqual(bad, []);
  for (const s of slugs) assert.ok(enCountries().some((c) => c.slug === s), `${s}: a file for a page that does not exist`);
  assert.equal(loadContent('atlantis'), null, 'no file → null');
});

/* ===================================================================== *
 * 9. Rendering
 * ===================================================================== */

const html = countryPage(JAPAN, FIXTURE);
const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();

test('a page with a file: title, description, share tags and lead come from it', () => {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  assert.ok(html.includes(`<title>${esc(FIXTURE.title)}</title>`));
  assert.ok(html.includes(`<meta name="description" content="${esc(FIXTURE.description)}">`));
  assert.ok(html.includes(`<meta property="og:title" content="${esc(FIXTURE.title)}">`));
  assert.ok(html.includes(`<meta property="og:description" content="${esc(FIXTURE.description)}">`));
  assert.ok(html.includes(`<meta name="twitter:title" content="${esc(FIXTURE.title)}">`));
  assert.ok(html.includes(`<meta name="twitter:description" content="${esc(FIXTURE.description)}">`));
  assert.equal(text(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1]), FIXTURE.lead);
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.equal((html.match(/<meta name="description"/g) || []).length, 1);
  assert.ok(html.includes('<link rel="stylesheet" href="/en/content.css">'), 'its stylesheet');
});

test('a page with a file: sections, questions and related destinations sit after «Plans at a glance» and before «Before you buy», in order', () => {
  const at = (s) => { const i = html.indexOf(s); assert.ok(i >= 0, s); return i; };
  const order = [
    at('class="cp-help cp-glance"'),
    at('<div class="cp-about">'),
    ...FIXTURE.sections.map((s) => at(`<h2 id="${s.id}-h">${text(s.h2) === s.h2 ? s.h2.replace(/'/g, '&#39;') : s.h2}</h2>`)),
    at('<h2 id="cpFaqTitle">Questions about Japan</h2>'),
    at('<h2 id="cpRelatedTitle">Related destinations</h2>'),
    at('aria-labelledby="cpHelpTitle"'),
  ];
  assert.deepEqual(order, order.slice().sort((a, b) => a - b), 'glance → sections → questions → related → before you buy');
  const about = html.slice(at('<div class="cp-about">'), at('aria-labelledby="cpHelpTitle"'));
  // Sections: one h2 each, every paragraph a <p>, the list a <ul>.
  for (const s of FIXTURE.sections) {
    const sec = about.match(new RegExp(`<section class="cp-about-sec" id="${s.id}"[\\s\\S]*?</section>`))[0];
    assert.deepEqual([...sec.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => text(m[1])), s.paragraphs.map((p) => p.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')));
    assert.equal((sec.match(/<li>/g) || []).length, (s.list || []).length);
  }
  // Questions: <details><summary>q</summary><p>a</p></details>, in order.
  const faq = about.match(/<section class="cp-about-sec cp-faq" id="faq"[\s\S]*?<\/section>/)[0];
  assert.deepEqual([...faq.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => text(m[1])), FIXTURE.faq.map((f) => f.q));
  assert.equal((faq.match(/<details>/g) || []).length, FIXTURE.faq.length);
  // Related: one link each, English name, /en/esim/<slug>/.
  const rel = about.match(/<section class="cp-about-sec cp-related"[\s\S]*?<\/section>/)[0];
  const names = new Map(enCountries().map((c) => [c.slug, c.name]));
  assert.deepEqual([...rel.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]), FIXTURE.related.map((s) => [`/en/esim/${s}/`, names.get(s)]));
  // Links in prose: exactly the /en/ targets written.
  assert.ok(about.includes('<a href="/en/guides/compatibility/">compatibility guide</a>'));
});

test('a page with a file: no FAQPage markup — the one structured-data block stays the BreadcrumbList', () => {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]['@type'], 'BreadcrumbList');
  assert.equal(/FAQPage|"Question"|acceptedAnswer/.test(html), false);
  assert.deepEqual(blocks[0], JSON.parse(countryPage(JAPAN, null).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]), 'breadcrumb unchanged');
});

test('a page with a file: everything but the authored parts is the template', () => {
  const tpl = countryPage(JAPAN, null);
  const strip = (h) => h.replace(/<title>[\s\S]*?<\/title>/, '').replace(/<meta (name|property)="(description|og:title|og:description|twitter:title|twitter:description)" content="[^"]*">/g, '')
    .replace(/<p class="lead">[\s\S]*?<\/p>/, '').replace(/  <div class="cp-about">[\s\S]*?\n  <\/div>\n/, '').replace('\n<link rel="stylesheet" href="/en/content.css">', '');
  assert.equal(strip(html), strip(tpl));
});

test('a file that breaks a rule stops the build; text is escaped', () => {
  const broken = fx();
  broken.title = 'Fast 5G in Japan | Magic eSIM';
  assert.throws(() => countryPage(JAPAN, broken), /seo\/content-en\/japan\.json:[\s\S]*guard «network»/);
  const amp = fx();
  amp.sections[0].paragraphs.push('Trains & buses in Japan run to the minute, so "on time" means it.');
  const h = countryPage(JAPAN, amp);
  assert.ok(h.includes('Trains &amp; buses in Japan run to the minute, so &quot;on time&quot; means it.'));
});

test('a page without a file is the template, byte for byte; other languages never read the English file', () => {
  for (const c of enCountries().filter((x) => !contentSlugs().includes(x.slug)).slice(0, 25)) {
    const h = countryPage(c);
    assert.equal(h, countryPage(c, null), c.slug);
    assert.equal(/cp-about|content\.css/.test(h), false, c.slug);
  }
  for (const code of ['de', 'fr', 'zh-Hans', 'ko']) {
    assert.equal(CONTENT_LANGS[code], undefined, `${code}: no authored-content rules`);
    const g = localeGenerator(code);
    const c = g.countries().find((x) => x.slug === 'japan');
    assert.equal(g.countryPage(c, FIXTURE), g.countryPage(c), `${code}: the English file changes nothing`);
  }
  // Spanish has its own folder (seo/content-es/, seo/test-content-es.mjs): an English file handed to a Spanish page is
  // held to the Spanish rules, and refused.
  const es = localeGenerator('es');
  // 2026-10-28 (owner-gated D3): the Spanish suffix it used to miss is gone; it now misses the Spanish country name.
  assert.throws(() => es.countryPage(es.countries().find((x) => x.slug === 'japan'), FIXTURE), /seo\/content-es\/japan\.json:[\s\S]*description: must name Japón/);
});

test('committed English pages: a file renders, no file renders nothing; no FAQPage on any English country page', () => {
  const withFile = new Set(contentSlugs());
  for (const c of enCountries()) {
    const h = read(`en/esim/${c.slug}/index.html`);
    assert.equal(/FAQPage|acceptedAnswer/.test(h), false, `${c.slug}: no FAQPage`);
    assert.equal(h.includes('<div class="cp-about">'), withFile.has(c.slug), `${c.slug}: authored block exactly when a file exists`);
    assert.equal(/\/en\/content\.css/.test(h), withFile.has(c.slug), `${c.slug}: content.css exactly when a file exists`);
    if (withFile.has(c.slug)) {
      const doc = loadContent(c.slug);
      assert.equal(text(h.match(/<title>([\s\S]*?)<\/title>/)[1]), doc.title, c.slug);
      assert.ok(h.indexOf('cp-glance') < h.indexOf('cp-about') && h.indexOf('cp-about') < h.indexOf('cpHelpTitle'), `${c.slug}: position`);
    }
  }
});

test('en/content.css: linked only by pages with a file; no motion, no transform, nothing below 13 px', () => {
  const css = read('en/content.css');
  assert.equal(/animation|transition|transform|@keyframes/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), false);
  for (const m of css.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(Number(m[1]) >= 13, m[0]);
  // Spanish pages link it exactly when seo/content-es/<slug>.json exists (seo/test-content-es.mjs); every other language never.
  for (const dir of ['de', 'fr', 'zh', 'ko', 'esim']) {
    for (const slug of readdirSync(join(ROOT, dir, dir === 'esim' ? '' : 'esim'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).slice(0, 40)) {
      const f = join(ROOT, dir, dir === 'esim' ? '' : 'esim', slug, 'index.html');
      if (existsSync(f)) assert.equal(readFileSync(f, 'utf8').includes('content.css'), false, f);
    }
  }
});
