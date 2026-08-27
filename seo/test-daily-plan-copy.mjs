#!/usr/bin/env node
// What a daily tariff card is allowed to say.
//
// ONE module, loaded by the storefront, the SEO country pages and the Mini App
// — so unlike the tariff-display mappers there are no copies to pin together.
// What these tests pin instead is the PROMISE: the card may repeat what the
// provider published and may not complete the sentence for it.
//
// Run: node --test seo/test-daily-plan-copy.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets/daily-plan-copy.js');
const source = readFileSync(SRC, 'utf8');

// Loaded the way a browser loads it: as a script that hangs itself off a global.
const scope = { window: {} };
new Function('window', source)(scope.window);
const D = scope.window.MagicDailyPlan;

const perDay = (over = {}) => ({
  plan_type: 'DAILY', daily_term_mode: 'PER_DAY', daily_gb: 1,
  daily_throttle_label: '384 Kbps', daily_throttle_continues: false,
  daily_reset_confirmed: false, validity_days: null,
  sellable_days: [3, 5, 7, 10, 15, 30], ...over,
});
const fixedTerm = (over = {}) => ({
  plan_type: 'DAILY', daily_term_mode: 'FIXED_TERM', daily_gb: 3,
  daily_throttle_label: '1 Mbps', daily_throttle_continues: true,
  daily_reset_confirmed: true, validity_days: 10, sellable_days: [10], ...over,
});
const volume = (over = {}) => ({
  plan_type: 'FIXED_VOLUME', data_gb: 5, validity_days: 30, ...over,
});

const text = (pkg) => D.lines(pkg).map((l) => l.text);

// ---------------------------------------------------------------------------
// The promise
// ---------------------------------------------------------------------------

test('THE WORD "безлимит" APPEARS NOWHERE — not in the output, not in the source', () => {
  // The single property this whole feature exists to protect. eSIM Access
  // publishes a throttle speed and says nothing at all about whether traffic
  // keeps flowing; completing that sentence for it would be a claim we cannot
  // support, on a product a customer pays for.
  assert.ok(!/безлимит/i.test(source), 'the module must not contain the word');
  for (const pkg of [perDay(), fixedTerm(), perDay({ daily_gb: 10 })]) {
    assert.ok(!/безлимит/i.test(text(pkg).join(' ')));
  }
});

test('the allowance line is always present and states a per-day number', () => {
  assert.equal(text(perDay())[0], '1 ГБ в день на максимальной скорости');
  assert.equal(text(fixedTerm())[0], '3 ГБ в день на максимальной скорости');
});

test('the speed-after line says what the speed becomes, and nothing more', () => {
  assert.ok(text(perDay()).includes('Далее — до 384 Кбит/с'));
  assert.ok(text(fixedTerm()).includes('Далее — до 1 Мбит/с'));
});

test('no published throttle means no speed line, rather than a guess', () => {
  const lines = text(perDay({ daily_throttle_label: null }));
  assert.equal(lines.length, 1, 'only the allowance');
  assert.ok(!lines.join(' ').includes('Далее'));

  // An unparseable label is treated as absent: a speed we cannot read is not a
  // speed we may print.
  assert.equal(text(perDay({ daily_throttle_label: 'slow' })).length, 1);
});

test('the reset line appears ONLY where the provider states it', () => {
  // MobiMatter's «resets every 24 hours» earns it. Its other wording, «for the
  // remainder of the day», does not — and neither does eSIM Access, which says
  // nothing at all.
  assert.ok(text(fixedTerm()).includes('Лимит обновляется каждые 24 часа'));
  assert.ok(!text(perDay()).some((t) => t.includes('обновляется')));
  assert.ok(!text(fixedTerm({ daily_reset_confirmed: false })).some((t) => t.includes('обновляется')));
});

test('a throttle label alone never becomes a claim about continuation', () => {
  // daily_throttle_continues is false here and true in fixedTerm(); the card
  // says the same kind of thing either way. The flag guards the wording it is
  // never allowed to produce, and this pins that it produces none.
  const a = text(perDay({ daily_throttle_continues: false }));
  const b = text(perDay({ daily_throttle_continues: true }));
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------------------
// Shapes and units
// ---------------------------------------------------------------------------

test('sub-gigabyte allowances read as the provider names them', () => {
  // The API carries GB with two decimals, so «500MB/Day» arrives as 0.49 and
  // multiplies back to 501.76. Printing 502 would invent precision.
  assert.equal(D.formatAllowance(0.49), '500 МБ');
  assert.equal(D.formatAllowance(0.29), '300 МБ');
  assert.equal(D.formatAllowance(1), '1 ГБ');
  assert.equal(D.formatAllowance(1.5), '1,5 ГБ');
  assert.equal(D.formatAllowance(10), '10 ГБ');
  assert.equal(D.formatAllowance(0), '');
  assert.equal(D.formatAllowance(null), '');
});

test('provider speed units are rendered in Russian, and only if readable', () => {
  assert.equal(D.formatSpeed('384 Kbps'), '384 Кбит/с');
  assert.equal(D.formatSpeed('1 Mbps'), '1 Мбит/с');
  assert.equal(D.formatSpeed('1Mbps'), '1 Мбит/с');
  assert.equal(D.formatSpeed('Limited'), '');
  assert.equal(D.formatSpeed(''), '');
  assert.equal(D.formatSpeed(undefined), '');
});

test('a fixed-term plan states its term; a per-day plan does not', () => {
  assert.ok(text(fixedTerm()).includes('Срок: 10 дней'));
  assert.ok(!text(perDay()).some((t) => t.startsWith('Срок')));
  assert.ok(text(fixedTerm({ validity_days: 1 })).includes('Срок: 1 день'));
  assert.ok(text(fixedTerm({ validity_days: 3 })).includes('Срок: 3 дня'));
  assert.ok(text(fixedTerm({ validity_days: 15 })).includes('Срок: 15 дней'));
});

test('the offered terms are repeated from the API, never invented', () => {
  assert.deepEqual(D.terms(perDay()), [3, 5, 7, 10, 15, 30]);
  assert.deepEqual(D.terms(perDay({ sellable_days: [3, 7] })), [3, 7],
    'a shorter published ladder is shown as published');
  assert.deepEqual(D.terms(perDay({ sellable_days: null })), []);
  assert.deepEqual(D.terms(fixedTerm()), [], 'a fixed-term plan offers no choice');
  assert.deepEqual(D.terms(volume()), []);
});

// ---------------------------------------------------------------------------
// Keeping the two blocks apart
// ---------------------------------------------------------------------------

test('an ordinary package produces no daily copy at all', () => {
  assert.deepEqual(D.lines(volume()), []);
  assert.equal(D.isDaily(volume()), false);
  assert.equal(D.isDaily(null), false);
  assert.equal(D.isDaily({}), false);
});

test('a daily row with no allowance says nothing rather than something blank', () => {
  assert.deepEqual(D.lines(perDay({ daily_gb: null })), []);
  assert.deepEqual(D.lines(perDay({ daily_gb: 0 })), []);
});

test('partition keeps the two products in separate blocks', () => {
  const { daily, volume: vol } = D.partition([volume(), perDay(), fixedTerm(), volume()]);
  assert.equal(daily.length, 2);
  assert.equal(vol.length, 2);
  assert.deepEqual(D.partition(null), { daily: [], volume: [] });
});

test('the block has one name, and it is not about being unlimited', () => {
  assert.equal(D.BLOCK_TITLE, 'Трафик на каждый день');
});
