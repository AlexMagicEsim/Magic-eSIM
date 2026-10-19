// The ratchet on unanchored rouble amounts in authored country texts
// (seo/price-inventory.mjs). The set may only SHRINK.
//
//   * a NEW unanchored amount fails: anchor it with price_claims, write it as a
//     relation, or (stage B) as a catalogue substitution;
//   * a baseline line that no longer exists fails: regenerate the baseline
//     (node seo/price-inventory.mjs --write-baseline) and lower MAX_UNANCHORED;
//   * the baseline may never hold more than MAX_UNANCHORED lines — raising it is
//     a visible edit of this file, never a side effect of regenerating.

import test from 'node:test';
import assert from 'node:assert/strict';
import { inventory, inventoryOf, loadBaseline, keyOf, summary, renderedFields } from './price-inventory.mjs';
import { loadProfiles } from './price-claims.mjs';

// 2026-10-18 (stage A): 188 sentences. Stage B batch 1 (australia, kazakhstan,
// sri-lanka → {{price:…}}): 180 sentences / 331 amounts (enumerations counted).
// Stage B batch 2 (kenya, tajikistan, brazil, cambodia): 150 sentences.
// Stage B batch 3 (greece, tanzania, laos, macau): 127 sentences.
// Stage B batch 4 (mexico, morocco, south-africa, japan): 108 sentences.
// Stage B batch 5 (montenegro, taiwan, costa-rica, dominican-republic): 88 sentences.
const MAX_UNANCHORED = 13;

const ROWS = inventory();
const BASE = loadBaseline();

test('the inventory reads the corpus', () => {
  // Stage B converts amounts to {{price:…}}, so the counts SHRINK by design
  // (to zero at the end); what must hold is that every published profile was
  // read. Recognition itself is pinned by the classification test below.
  const published = loadProfiles();
  assert.ok(published.length >= 60, `published profiles: ${published.length}`);
  const s = summary(ROWS);
  assert.equal(s.sentences, ROWS.length);
  assert.ok(ROWS.every((r) => published.some((p) => p.slug === r.slug)), 'rows only from published profiles');
});

test('no NEW unanchored rouble amount in an authored text', () => {
  const base = new Set(BASE.unanchored);
  const fresh = ROWS.filter((r) => r.status === 'unanchored' && !base.has(keyOf(r)));
  assert.deepEqual(fresh.map(keyOf), [],
    'Новая сумма в ₽ без price_claims — привяжите фразу утверждением (seo/price-claims.mjs), перепишите её отношением или подстановкой из каталога:\n'
    + fresh.map(keyOf).join('\n'));
});

test('the baseline holds no line that is gone (it only shrinks)', () => {
  const now = new Set(ROWS.filter((r) => r.status === 'unanchored').map(keyOf));
  const stale = BASE.unanchored.filter((k) => !now.has(k));
  assert.deepEqual(stale, [],
    'Эти строки больше не непривязанные — удалите их: node seo/price-inventory.mjs --write-baseline, и понизьте MAX_UNANCHORED в seo/test-price-inventory.mjs:\n'
    + stale.join('\n'));
});

test('the baseline never grows past the ceiling', () => {
  assert.ok(BASE.unanchored.length <= MAX_UNANCHORED, `baseline ${BASE.unanchored.length} > MAX_UNANCHORED ${MAX_UNANCHORED}`);
  assert.equal(new Set(BASE.unanchored).size, BASE.unanchored.length, 'no duplicate lines');
});

test('classification: anchored, waived, unanchored; bookkeeping keys never count; thousands are one amount', () => {
  const profile = {
    title: 'eSIM для Тестляндии от 1 650 ₽',
    description: 'Обычно дешевле, чем роуминг. Местные 3 ГБ — 400 ₽.',
    intro: ['Без цены здесь. Пакет на 10 ГБ стоит 2 400 ₽, а 20 ГБ — 3 100 ₽.'],
    why: [{ h: 'Заголовок', p: 'Вход — 350 ₽.' }],
    faq: [{ q: 'Сколько стоит?', a: 'От 350 ₽ за три дня.' }],
    dual_sim_note: { text: 'Вторая линия {link} за 0 ₽ не платится.', anchor: 'x' },
    price_claims: [{ id: 'c1', anchors: [{ field: 'why[0].p', text: 'Вход — 350 ₽.' }], terms: {}, assert: [] }],
    price_claims_waived: [{ field: 'title', text: 'eSIM для Тестляндии от 1 650 ₽', reason: 'test waiver of a headline' }],
    editor_notes: 'Было 999 ₽ — не печатается.',
    coverage_claims: [{ quote: 'Стоит 777 ₽.' }],
  };
  const rows = inventoryOf('testland', profile);
  const st = Object.fromEntries(rows.map((r) => [`${r.field}|${r.sentence}`, r]));
  assert.equal(st['why[0].p|Вход — 350 ₽.'].status, 'anchored');
  assert.equal(st['why[0].p|Вход — 350 ₽.'].claim, 'c1');
  assert.equal(st['title|eSIM для Тестляндии от 1 650 ₽'].status, 'waived');
  assert.deepEqual(st['title|eSIM для Тестляндии от 1 650 ₽'].amounts, [1650]);
  assert.equal(st['description|Местные 3 ГБ — 400 ₽.'].status, 'unanchored');
  assert.equal(st['description|Обычно дешевле, чем роуминг.'], undefined, 'a relation with no amount is not an amount sentence');
  assert.deepEqual(st['intro[0]|Пакет на 10 ГБ стоит 2 400 ₽, а 20 ГБ — 3 100 ₽.'].amounts, [2400, 3100]);
  assert.equal(st['faq[0].a|От 350 ₽ за три дня.'].status, 'unanchored');
  assert.ok(st['dual_sim_note.text|Вторая линия {link} за 0 ₽ не платится.']);
  assert.ok(!rows.some((r) => /999|777/.test(r.sentence)), 'bookkeeping keys are not rendered text');
  assert.deepEqual(renderedFields(profile).map(([f]) => f),
    ['title', 'description', 'intro[0]', 'why[0].h', 'why[0].p', 'faq[0].q', 'faq[0].a', 'dual_sim_note.text']);
});

test('MUTATION: a new amount sentence added to a real profile fails the ratchet', () => {
  const base = new Set(BASE.unanchored);
  const real = ROWS.find((r) => r.status === 'anchored');
  const added = inventoryOf(real.slug, { faq: [{ q: 'Q', a: 'Новый тариф стоит 123 ₽.' }] });
  assert.equal(added[0].status, 'unanchored');
  assert.ok(!base.has(keyOf(added[0])), 'it is not in the baseline, so the ratchet test would name it');
});
