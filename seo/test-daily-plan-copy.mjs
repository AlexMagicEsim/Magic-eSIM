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

// ---------------------------------------------------------------------------
// The NAME on the card.
//
// The provider's own product name is the thing the customer must never see:
// «Asia 15Areas(nonhkip) 500MB/Day», «Balkans_500MB/Day_USIP», «Japan
// 500MB/Day (IIJ)». It is English, it leaks routing internals, and it states
// the allowance in a format we use nowhere else. So the name is BUILT from the
// structured columns instead. These tests pin that it is built, not passed
// through — and they use the shape the live API actually returns
// (coverage_country_codes; daily_gb as GB with two decimals, so 0.49).

const RU = { IE: 'Ирландия', JP: 'Япония', KR: 'Южная Корея', SG: 'Сингапур',
  MY: 'Малайзия', TH: 'Таиланд', US: 'США', CA: 'Канада', MX: 'Мексика' };
// Same contract as the storefront's: unknown codes come back as the code.
const ruName = (code) => RU[String(code).toUpperCase()] || String(code).toUpperCase();

const daily = (over = {}) => ({
  plan_type: 'DAILY', daily_term_mode: 'PER_DAY', daily_gb: 0.49,
  country_code: 'EU-39', coverage_country_codes: [], name: 'RAW PROVIDER NAME', ...over,
});

test('a one-country plan is named by its country, not by the provider', () => {
  const p = daily({ country_code: 'JP', coverage_country_codes: ['JP'], name: 'Japan 500MB/Day (IIJ)' });
  assert.equal(D.displayName(p, ruName), 'Япония — 500 МБ в день');
});

test('a region we can name exactly is named exactly', () => {
  // «вариант 3»: known places are spelled out, not approximated to a continent.
  const cases = [
    ['Balkans_500MB/Day_USIP', 'Балканы'],
    ['Central Asia 5Areas 500MB/Day', 'Центральная Азия'],
    ['North America 3Areas 500MB/Day', 'Северная Америка'],
    ['Gulf Region 1GB/Day', 'Страны Персидского залива'],
    ['Global 120Areas 1GB/Day', 'Весь мир'],
    ['Europe 39Areas 300MB/Day', 'Европа'],
  ];
  for (const [raw, expected] of cases) {
    // Six unnamed codes: too many to list, so the name has to carry it.
    const p = daily({ name: raw, coverage_country_codes: ['XX', 'YY', 'ZZ', 'QQ', 'WW', 'RR'] });
    assert.equal(D.placeName(p, ruName), expected, raw);
  }
});

test('a short combination is listed, because a list beats a vague region', () => {
  // «Сингапур, Малайзия и Таиланд» is more use to a buyer than «Азия» —
  // but only while every code resolves to a Russian name.
  const p = daily({ name: 'SG MY TH 500MB/Day', coverage_country_codes: ['SG', 'MY', 'TH'], country_code: 'AS-3' });
  assert.equal(D.placeName(p, ruName), 'Сингапур, Малайзия и Таиланд');
});

test('an unrecognised place falls back to its region, never to English', () => {
  const p = daily({ name: 'ZZ9 Plural Z Alpha 12Areas 1GB/Day', country_code: 'AS-12',
    coverage_country_codes: Array(12).fill('XX') });
  const got = D.placeName(p, ruName);
  assert.equal(got, 'Азия');
  assert.doesNotMatch(got, /[A-Za-z]/);
});

test('and an unrecognised region still says something, in Russian', () => {
  // Last resort: a count. Never a blank, never the provider's own words.
  const p = daily({ name: 'Mystery 9Areas 1GB/Day', country_code: 'ZZ-9',
    coverage_country_codes: Array(9).fill('XX') });
  assert.equal(D.placeName(p, ruName), '9 стран');
});

test('no display name may contain a Latin letter or a provider artefact', () => {
  const raws = [
    'Asia 15Areas(nonhkip) 500MB/Day', 'Europe 39Areas 300MB/Day_USIP',
    'Global 120Areas 1GB/Day IIJ', 'Japan 1GB/Day FUP 384Kbps',
    'Balkans_500MB/Day_USIP',
  ];
  for (const raw of raws) {
    const out = D.displayName(daily({ name: raw, coverage_country_codes: Array(9).fill('XX') }), ruName);
    assert.doesNotMatch(out, /[A-Za-z]/, raw);
    assert.doesNotMatch(out, /MB\/Day|GB\/Day|Areas|nonhkip|USIP|IIJ|FUP/i, raw);
    assert.ok(out.trim().length > 0, raw);
  }
});

test('the allowance in the name uses the same Russian units as the card body', () => {
  assert.match(D.displayName(daily({ daily_gb: 0.49 }), ruName), /500 МБ в день$/);
  assert.match(D.displayName(daily({ daily_gb: 0.29 }), ruName), /300 МБ в день$/);
  assert.match(D.displayName(daily({ daily_gb: 1 }), ruName), /1 ГБ в день$/);
  assert.match(D.displayName(daily({ daily_gb: 3 }), ruName), /3 ГБ в день$/);
  // 0.49 is a provider rounding artefact; it must never surface as «0.49 GB».
  assert.doesNotMatch(D.displayName(daily({ daily_gb: 0.49 }), ruName), /0[.,]49/);
});

test('an ordinary package has no built name — it keeps its own', () => {
  assert.equal(D.displayName({ plan_type: 'ORDINARY', data_gb: 5, name: 'Japan 5GB' }, ruName), '');
});

test('coverage counts countries in Russian, and names the single one', () => {
  assert.equal(D.coverageLine(daily({ coverage_country_codes: ['JP'] }), ruName), 'Япония');
  assert.equal(D.coverageLine(daily({ coverage_country_codes: Array(34).fill('XX') }), ruName), '34 страны');
  assert.equal(D.coverageLine(daily({ coverage_country_codes: Array(21).fill('XX') }), ruName), '21 страна');
  assert.equal(D.coverageLine(daily({ coverage_country_codes: Array(15).fill('XX') }), ruName), '15 стран');
  assert.equal(D.coverageLine(daily({ coverage_country_codes: Array(11).fill('XX') }), ruName), '11 стран');
});

test('fixed-term plans that differ only by length get different names', () => {
  // «Dubai Unlimited 1/3/5/7/10/15 Days» is six products, identical but for
  // the term. Building the name from daily_gb alone gave the UAE page six
  // cards with one title, which reads as a duplicate listing.
  const seen = new Set();
  for (const days of [1, 3, 5, 7, 10, 15]) {
    const p = daily({ daily_term_mode: 'FIXED_TERM', daily_gb: 1, validity_days: days,
      country_code: 'AE', coverage_country_codes: ['AE'], name: `Dubai Unlimited ${days} Days` });
    const out = D.displayName(p, (c) => (c === 'AE' ? 'ОАЭ' : c));
    seen.add(out);
    assert.doesNotMatch(out, /[A-Za-z]/);
  }
  assert.equal(seen.size, 6, 'six products must not share one title');
  assert.ok(seen.has('ОАЭ — 1 ГБ в день, 3 дня'));
  assert.ok(seen.has('ОАЭ — 1 ГБ в день, 1 день'));
});

test('a per-day plan carries no term, because the buyer picks it', () => {
  const p = daily({ daily_term_mode: 'PER_DAY', validity_days: null,
    country_code: 'JP', coverage_country_codes: ['JP'] });
  assert.equal(D.displayName(p, ruName), 'Япония — 500 МБ в день');
});

test('an underscore in a provider name does not send the plan to Europe', () => {
  // «_» is a word character, so /\bbalkans\b/ misses «Balkans_500MB/Day» and
  // the EU- prefix fallback would call it «Европа» — a wrong country, not a
  // vague one. Today's feed uses spaces; the guard costs one replace.
  const p = daily({ name: 'Balkans_500MB/Day_USIP', country_code: 'EU-7',
    coverage_country_codes: ['RS', 'AL', 'ME', 'MK', 'BA', 'XK'] });
  assert.equal(D.placeName(p, ruName), 'Балканы');
});
