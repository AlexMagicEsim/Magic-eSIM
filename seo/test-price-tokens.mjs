// SEO stage B — {{price:<name>}} substitutions in authored texts
// (seo/price-tokens.mjs). The corpus: every reference resolves, every token is
// printed as the catalogue amount, nothing raw reaches a page, a converted page
// stays converted, the pilot / control pages carry none. The unit tests pin
// each refusal.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalogue } from './catalogue-facts.mjs';
import { loadProfile } from './content-profile.mjs';
import { renderPriceTokens, readRefs, money } from './price-tokens.mjs';
import { inventoryOf } from './price-inventory.mjs';
import { FROZEN_PAGES } from './frozen-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PK = loadCatalogue();
const SLUGS = readdirSync(join(ROOT, 'seo', 'content-profiles')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const WITH_REFS = SLUGS.filter((s) => readRefs(s) !== undefined);
const raw = (s) => JSON.parse(readFileSync(join(ROOT, 'seo', 'content-profiles', `${s}.json`), 'utf8'));
const pageText = (s) => readFileSync(join(ROOT, 'esim', s, 'index.html'), 'utf8');

const CONVERTED = {
  1: ['australia', 'kazakhstan', 'sri-lanka'],
  2: ['kenya', 'tajikistan', 'brazil', 'cambodia'],
  3: ['greece', 'tanzania', 'laos', 'macau'],
  4: ['mexico', 'morocco', 'south-africa', 'japan'],
  5: ['montenegro', 'taiwan', 'costa-rica', 'dominican-republic'],
  6: ['israel', 'oman', 'malaysia', 'mauritius'],
  7: ['bahrain', 'seychelles', 'argentina', 'andorra'],
  8: ['armenia', 'colombia', 'portugal', 'qatar'],
};
for (const [batch, slugs] of Object.entries(CONVERTED)) {
  test(`batch ${batch} is converted: ${slugs.join(', ')} carry price_refs`, () => {
    for (const s of slugs) assert.ok(WITH_REFS.includes(s), s);
  });
}

test('every reference on every page resolves against assets/catalog.json, every token has one, every ref is used', () => {
  const problems = [];
  for (const s of SLUGS) {
    const { profile } = loadProfile(s);
    if (!profile) continue;
    problems.push(...renderPriceTokens(profile, readRefs(s), s, PK).problems);
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('each reference is printed on its page as the catalogue amount, and no raw token reaches any page', () => {
  for (const s of WITH_REFS) {
    const { profile } = loadProfile(s);
    const { values } = renderPriceTokens(profile, readRefs(s), s, PK);
    const html = pageText(s);
    for (const [name, v] of Object.entries(values)) assert.ok(html.includes(money(v)), `${s}: {{price:${name}}} = ${money(v)} is on the page`);
  }
  for (const d of readdirSync(join(ROOT, 'esim'))) {
    const f = join(ROOT, 'esim', d, 'index.html');
    if (existsSync(f)) assert.doesNotMatch(readFileSync(f, 'utf8'), /\{\{[^}]*\}\}/, `${d}: a raw {{…}} reached the page`);
  }
});

test('a converted page stays converted: no hand-typed rouble amount in its rendered text', () => {
  for (const s of WITH_REFS) {
    const literal = inventoryOf(s, raw(s));
    assert.deepEqual(literal.map((r) => `${r.field}: ${r.sentence}`), [], `${s}: write {{price:…}} with a price_refs entry instead`);
  }
});

test('the SEO pilot / control pages carry no references or tokens', () => {
  for (const s of FROZEN_PAGES) {
    if (!existsSync(join(ROOT, 'seo', 'content-profiles', `${s}.json`))) continue;
    assert.equal(raw(s).price_refs, undefined, s);
    assert.doesNotMatch(JSON.stringify(raw(s)), /\{\{price:/, s);
  }
});

// ------------------------------------------------------------------ unit

const AU_LOCAL_3 = '7b0ecf91-99ea-411a-8438-d436cd74ae29';
const text = (s) => ({ description: s, intro: ['Без цены.'], editor_notes: 'не печатается {{price:nope}}' });

test('unit: a token prints the catalogue amount, formatted as the generator prints amounts', () => {
  const r = renderPriceTokens(text('Местные 3 ГБ — {{price:a}}.'), { a: { package: AU_LOCAL_3, block: 'local', attrs: { data_gb: 3 } } }, 'australia', PK);
  assert.deepEqual(r.problems, []);
  const p = PK.find((x) => x.package_id === AU_LOCAL_3).price;
  assert.equal(r.profile.description, `Местные 3 ГБ — ${money(p)}.`);
  assert.equal(r.profile.editor_notes, 'не печатается {{price:nope}}', 'bookkeeping keys are not rendered');
  const big = renderPriceTokens(text('{{price:m}}'), { m: { min_of: 'local', where: { data_gb: 50 } } }, 'australia', PK);
  assert.deepEqual(big.problems, []);
  assert.match(big.profile.description, /^\d{1,3}(?: \d{3})+ ₽$/, 'thousands with a no-break space, like every generated amount');
});

test('unit: the refusals — unknown, unused, malformed, wrong block, changed attrs, withdrawn (with successors), frozen page', () => {
  const ref = { package: AU_LOCAL_3, block: 'local' };
  const probs = (desc, refs, slug = 'australia', pk = PK) => renderPriceTokens(text(desc), refs, slug, pk).problems.join('\n');
  assert.match(probs('{{price:x}}', { a: ref }), /\{\{price:x\}\} — нет такого price_refs/);
  assert.match(probs('{{price:x}}', { a: ref }), /price_refs\.a нигде не используется/);
  assert.match(probs('{{цена:a}} {{price:a}}', { a: ref }), /«\{\{цена:a\}\}» — подстановка пишется \{\{price:имя\}\}/);
  assert.match(probs('{{price:a}}', { a: { ...ref, block: 'daily' } }), /не в блоке «daily»/);
  assert.match(probs('{{price:a}}', { a: { ...ref, attrs: { data_gb: 5 } } }), /data_gb сейчас 3, в утверждении 5/);
  const withdrawn = PK.filter((p) => p.package_id !== AU_LOCAL_3);
  assert.match(probs('{{price:a}}', { a: { ...ref, attrs: { data_gb: 3 } } }, 'australia', withdrawn),
    /нет в каталоге — исчез или снят с витрины; кандидаты в блоке «local»: .* — подстановка \{\{price:a\}\} не может быть напечатана; перепривяжите её к тарифу-преемнику/);
  assert.match(probs('{{price:a}}', { a: ref }, 'uae'), /страница пилота или контроля SEO/);
  assert.match(probs('{{price:a}}', { a: { block: 'local' } }), /нужен package или min_of/);
  assert.match(renderPriceTokens(text('{{price:a}}'), { a: ref }, 'australia', withdrawn).profile.description, /\{\{price:a\}\}/, 'an unprintable token is left raw — and the generator refuses the page');
});
