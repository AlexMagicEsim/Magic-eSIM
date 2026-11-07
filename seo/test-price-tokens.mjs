// SEO stage B — {{price:<name>}} substitutions in authored texts
// (seo/price-tokens.mjs). The corpus: every reference is well formed, every
// token is printed as the catalogue amount or its sentence is left out
// (seo/page-claims.mjs), nothing raw reaches a page, a converted page stays
// converted, the pilot / control pages carry none. The unit tests pin each
// refusal on a fixture with its own published layout.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProfile } from './content-profile.mjs';
import { renderPriceTokens, readRefs, money, TOKEN_RE } from './price-tokens.mjs';
import { renderAuthored, readRawProfile, loadPublishedCatalogue, unitOf } from './page-claims.mjs';
import { layoutByCoverage } from './fixture-layout.mjs';
import { inventoryOf } from './price-inventory.mjs';
import { FROZEN_PAGES } from './frozen-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = loadPublishedCatalogue();
const SLUGS = readdirSync(join(ROOT, 'seo', 'content-profiles')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const WITH_REFS = SLUGS.filter((s) => readRefs(s) !== undefined);
const raw = (s) => JSON.parse(readFileSync(join(ROOT, 'seo', 'content-profiles', `${s}.json`), 'utf8'));
const pageText = (s) => readFileSync(join(ROOT, 'ru/esim', s, 'index.html'), 'utf8');

const CONVERTED = {
  1: ['australia', 'kazakhstan', 'sri-lanka'],
  2: ['kenya', 'tajikistan', 'brazil', 'cambodia'],
  3: ['greece', 'tanzania', 'laos', 'macau'],
  4: ['mexico', 'morocco', 'south-africa', 'japan'],
  5: ['montenegro', 'taiwan', 'costa-rica', 'dominican-republic'],
  6: ['israel', 'oman', 'malaysia', 'mauritius'],
  7: ['bahrain', 'seychelles', 'argentina', 'andorra'],
  8: ['armenia', 'colombia', 'portugal', 'qatar'],
  9: ['maldives', 'nepal', 'turkey', 'brunei', 'jordan', 'vietnam', 'germany', 'india', 'china', 'south-korea'],
  11: ['albania', 'cyprus', 'spain', 'usa', 'kyrgyzstan'],   // the former SEO control pages, 2026-10-24
  10: ['bosnia-and-herzegovina', 'indonesia', 'philippines', 'serbia', 'thailand', 'france', 'hong-kong', 'saudi-arabia',
    'singapore', 'united-kingdom', 'azerbaijan', 'bulgaria', 'switzerland', 'tunisia'],
};
for (const [batch, slugs] of Object.entries(CONVERTED)) {
  test(`batch ${batch} is converted: ${slugs.join(', ')} carry price_refs`, () => {
    for (const s of slugs) assert.ok(WITH_REFS.includes(s), s);
  });
}

test('every reference on every page is well formed, every token has one, every ref is used', () => {
  const problems = [];
  for (const s of SLUGS) {
    const { profile } = loadProfile(s);
    if (!profile) continue;
    problems.push(...renderAuthored(s, { text: profile, raw: readRawProfile(s), doc: DOC }).problems);
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('each reference is printed on its page as the catalogue amount (unless its sentence is left out), and no raw token reaches any page', () => {
  for (const s of WITH_REFS) {
    const { profile } = loadProfile(s);
    const { values } = renderPriceTokens(profile, readRefs(s), s, DOC);
    const { suppressed } = renderAuthored(s, { text: profile, raw: readRawProfile(s), doc: DOC });
    const gone = new Set(suppressed.map((x) => x.unit));
    const units = (name) => {
      const out = new Set();
      const visit = (field, v) => {
        if (typeof v === 'string') { if (v.includes(`{{price:${name}}}`)) out.add(unitOf(field)); }
        else if (Array.isArray(v)) v.forEach((x, i) => visit(`${field}[${i}]`, x));
        else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(`${field}.${k}`, x);
      };
      for (const [k, v] of Object.entries(profile)) visit(k, v);
      return [...out];
    };
    const html = pageText(s);
    for (const [name, v] of Object.entries(values)) {
      if (units(name).every((u) => gone.has(u))) continue;
      assert.ok(html.includes(money(v)), `${s}: {{price:${name}}} = ${money(v)} is on the page`);
    }
  }
  for (const d of readdirSync(join(ROOT, 'ru/esim'))) {
    const f = join(ROOT, 'ru/esim', d, 'index.html');
    if (existsSync(f)) assert.doesNotMatch(readFileSync(f, 'utf8'), /\{\{[^}]*\}\}/, `${d}: a raw {{…}} reached the page`);
  }
});

test('a converted page stays converted: no hand-typed rouble amount in its rendered text', () => {
  for (const s of WITH_REFS) {
    const literal = inventoryOf(s, raw(s));
    assert.deepEqual(literal.map((r) => `${r.field}: ${r.sentence}`), [], `${s}: write {{price:…}} with a price_refs entry instead`);
  }
});

test('the former SEO control pages are converted (the experiment ended 2026-10-24); the pilot pages type no ₽ at all', () => {
  for (const s of ['albania', 'cyprus', 'spain', 'usa', 'kyrgyzstan']) assert.ok(raw(s).price_refs, `${s}: price_refs`);
  for (const s of FROZEN_PAGES) {
    if (!existsSync(join(ROOT, 'seo', 'content-profiles', `${s}.json`))) continue;
    const literal = inventoryOf(s, raw(s));
    assert.deepEqual(literal.map((r) => `${r.field}: ${r.sentence}`), [], `${s}: no hand-typed ₽ left`);
  }
});

// ------------------------------------------------------------------ unit

// Australia as a fixture: the page's published blocks are what layoutByCoverage lays out.
const fx = (o) => ({ country_code: 'AU', coverage_country_codes: ['AU'], plan_type: 'FIXED_VOLUME', daily_gb: null, validity_days: 30, ...o });
const AU = () => [
  fx({ package_id: 'au3-ea', name: 'Australia 3GB 30Days', data_gb: 3, price: 700 }),
  fx({ package_id: 'au50', name: 'Australia 50GB 30Days', data_gb: 50, price: 4850 }),
  fx({ package_id: 'apac3', name: 'APAC 3 GB', data_gb: 3, price: 1100, coverage_country_codes: ['AU', 'NZ', 'SG'] }),
];
const DOC_AU = (pk = AU()) => layoutByCoverage(pk);
const LOCAL3 = { block: 'local', attrs: { data_gb: 3, validity_days: 30 } };
const text = (s) => ({ description: s, intro: ['Без цены.'], editor_notes: 'не печатается {{price:nope}}' });

test('unit: a token prints the catalogue amount of the card it names, formatted as the generator prints amounts', () => {
  const r = renderPriceTokens(text('Местные 3 ГБ — {{price:a}}.'), { a: LOCAL3 }, 'australia', DOC_AU());
  assert.deepEqual(r.problems, []);
  assert.equal(r.profile.description, `Местные 3 ГБ — ${money(700)}.`);
  assert.equal(r.profile.editor_notes, 'не печатается {{price:nope}}', 'bookkeeping keys are not rendered');
  const big = renderPriceTokens(text('{{price:m}}'), { m: { min_of: 'local', where: { data_gb: 50 } } }, 'australia', DOC_AU());
  assert.deepEqual(big.problems, []);
  assert.equal(big.profile.description, money(4850), 'thousands as the generator prints every amount');
  assert.match(big.profile.description, /^4\u00a0850 ₽$/);
});

test('unit: the refusals — unknown, unused, malformed, an id, no volume or term; a card that is not there is UNRESOLVED, not a failure', () => {
  const probs = (desc, refs, doc = DOC_AU()) => renderPriceTokens(text(desc), refs, 'australia', doc).problems.join('\n');
  assert.match(probs('{{price:x}}', { a: LOCAL3 }), /\{\{price:x\}\} — нет такого price_refs/);
  assert.match(probs('{{price:x}}', { a: LOCAL3 }), /price_refs\.a нигде не используется/);
  assert.match(probs('{{цена:a}} {{price:a}}', { a: LOCAL3 }), /«\{\{цена:a\}\}» — подстановка пишется \{\{price:имя\}\}/);
  assert.match(probs('{{price:a}}', { a: { package: 'au3-ea', block: 'local' } }), /id поставщика не допускается/);
  assert.match(probs('{{price:a}}', { a: { block: 'local' } }), /attrs обязателен/);
  assert.match(probs('{{price:a}}', { a: { block: 'local', attrs: { data_gb: 3 } } }), /нужен срок/);
  for (const [why, ref, doc] of [
    ['another block', { ...LOCAL3, block: 'regional', family: 'australia' }, DOC_AU()],
    ['another volume', { ...LOCAL3, attrs: { data_gb: 5, validity_days: 30 } }, DOC_AU()],
    ['withdrawn', LOCAL3, DOC_AU(AU().filter((p) => p.package_id !== 'au3-ea'))],
  ]) {
    const r = renderPriceTokens(text('{{price:a}}'), { a: ref }, 'australia', doc);
    assert.deepEqual(r.problems, [], why);
    assert.match(r.unresolved.a.join('\n'), /нет карточки/, why);
    assert.match(r.profile.description, /\{\{price:a\}\}/, `${why}: left raw here — seo/page-claims.mjs takes the sentence out`);
  }
});

test('unit: a fallback is printed only when the card is gone — and only where the author wrote one', () => {
  const ref = { ...LOCAL3, fallback: { min_of: 'local' } };
  assert.equal(renderPriceTokens(text('{{price:a}}'), { a: ref }, 'australia', DOC_AU()).profile.description, money(700));
  const gone = DOC_AU(AU().filter((p) => p.package_id !== 'au3-ea'));
  const r = renderPriceTokens(text('{{price:a}}'), { a: ref }, 'australia', gone);
  assert.deepEqual([r.problems, r.unresolved, r.profile.description], [[], {}, money(4850)]);
  assert.match(renderPriceTokens(text('{{price:a}}'), { a: { ...LOCAL3, fallback: { ...LOCAL3, fallback: { min_of: 'local' } } } }, 'australia', gone).problems.join('\n'), /без своего запасного/);
  assert.match(renderPriceTokens(text('{{price:a}}'), { a: { ...LOCAL3, fallback: { package: 'x', block: 'local' } } }, 'australia', gone).problems.join('\n'), /id поставщика не допускается/);
});

test('unit: no {{price:…}} survives renderAuthored — the sentence of an unresolved one is out of the page', () => {
  assert.equal(new RegExp(TOKEN_RE.source).test('{{price:a}}'), true);
  const gone = DOC_AU(AU().filter((p) => p.package_id !== 'au3-ea'));
  const r = renderAuthored('australia', { text: text('Местные 3 ГБ — {{price:a}}.'), raw: { price_refs: { a: LOCAL3 } }, doc: gone });
  assert.deepEqual(r.problems, []);
  assert.equal(r.profile.description, undefined, 'the description goes — the template prints its own');
  assert.deepEqual(r.suppressed.map((x) => [x.unit, x.source, x.id]), [['description', 'price_refs', 'a']]);
});
