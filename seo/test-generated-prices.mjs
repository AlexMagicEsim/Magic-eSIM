// The generated «от N ₽» outside the facts block equals the catalogue floor on
// every country page (seo/generated-prices.mjs).

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalogue, countryFacts } from './catalogue-facts.mjs';
import { countryPages, generatedPriceProblems } from './generated-prices.mjs';

const PK = loadCatalogue();
const PAGES = countryPages();

test('every generated «от N ₽» (meta, og/twitter, JSON-LD, template FAQ, FAQPage) is the catalogue floor', () => {
  const { problems } = generatedPriceProblems(PAGES, PK);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('the check is not vacuous: the patterns are found on most pages', () => {
  const { seen } = generatedPriceProblems(PAGES, PK);
  assert.ok(PAGES.length >= 190, `country pages: ${PAGES.length}`);
  // Authored pages (66) carry their own description and FAQ; the template is on
  // the rest — 132 pages on 2026-10-18.
  for (const k of ['meta', 'ldMeta', 'faq', 'ldFaq']) assert.ok(seen[k] >= 120, `${k}: ${seen[k]}`);
});

test('MUTATION: a page whose meta copy kept an old floor is caught, in every place', () => {
  const page = PAGES.find((p) => /Оплата рублями, QR-код на почту\./.test(p.html) && /Цены начинаются от/.test(p.html));
  assert.ok(page, 'a template page exists');
  const min = countryFacts(PK, page.iso).min_price_rub;
  const stale = min + 50;
  const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const html = page.html.split(`от ${fmt(min)} ₽. Оплата рублями`).join(`от ${fmt(stale)} ₽. Оплата рублями`)
    .split(`Цены начинаются от ${fmt(min)} ₽.`).join(`Цены начинаются от ${fmt(stale)} ₽.`);
  const { problems } = generatedPriceProblems([{ ...page, html }], PK);
  for (const where of ['meta description', 'JSON-LD description', 'FAQ', 'FAQPage JSON-LD']) {
    assert.ok(problems.some((p) => p.includes(`${page.slug}: ${where} says «от ${stale} ₽»`)), `${where}: ${problems.join(' | ')}`);
  }
});

test('MUTATION: a catalogue move without a rebuild is caught (the page keeps the old floor)', () => {
  const page = PAGES.find((p) => /Цены начинаются от/.test(p.html));
  const f = countryFacts(PK, page.iso);
  // Make every package of this country 10 % cheaper: the floor moves, the HTML does not.
  const moved = PK.map((p) => {
    const codes = Array.isArray(p.coverage_country_codes) ? p.coverage_country_codes : [];
    if (!codes.includes(page.iso) && p.country_code !== page.iso) return p;
    const q = { ...p, price: Math.round(Number(p.price) * 0.9) };
    if (Array.isArray(p.term_prices)) q.term_prices = p.term_prices.map((t) => ({ ...t, price: Math.round(t.price * 0.9) }));
    return q;
  });
  const after = countryFacts(moved, page.iso).min_price_rub;
  assert.notEqual(after, f.min_price_rub, 'the floor moved');
  const { problems } = generatedPriceProblems([page], moved);
  assert.ok(problems.some((p) => p.includes(`catalogue floor is ${after} ₽`)), problems.join(' | '));
});
