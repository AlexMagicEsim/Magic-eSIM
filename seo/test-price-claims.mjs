// Price claims (seo/price-claims.mjs) — the rule on fixed fixtures, then the corpus.
//
// Every rule test runs on the small catalogue below, never on today's prices: a
// test of the RULE must not depend on the provider (see test-profile-catalogue's
// header — 30 replayed snapshots went red on a pinned live value). Only the
// last tests read assets/catalog.json, and those are the ones the SEO-refresh
// job is supposed to stop on when a price move falsifies a sentence.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateProfile, validateClaimShape, unanchoredHeadlineSentences, waiverProblems, termPrice,
  checkCorpus, PRICE_SENTENCE_RE, formatProblem,
} from './price-claims.mjs';
import { loadProfile } from './content-profile.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Saudi Arabia as it stood on 2026-10-13 (2289 packages) and on 2026-10-14 (2285).
const ladder = (rate) => [3, 5, 7, 10, 15, 30].map((days) => ({ days, price: Math.round((rate * days) / 50) * 50 }));
const pkg = (o) => ({ country_code: 'SA', coverage_country_codes: ['SA'], plan_type: 'FIXED_VOLUME', daily_gb: null, ...o });
const CATALOGUE = (fiftyPrice = 8100) => [
  pkg({ package_id: 'sa-3', name: 'Saudi Arabia 3GB 30Days', data_gb: 3, validity_days: 30, price: 950 }),
  pkg({ package_id: 'sa-50', name: 'Saudi Arabia 50GB 30Days', data_gb: 50, validity_days: 30, price: fiftyPrice }),
  pkg({ package_id: 'sa-daily-1', name: 'Saudi Arabia 1GB/Day', data_gb: 0, daily_gb: 1, plan_type: 'DAILY', validity_days: null, price: 300,
    term_prices: [{ days: 3, price: 900 }, { days: 30, price: 8900 }] }),
  pkg({ package_id: 'gulf-5', name: 'Gulf Region 5GB', data_gb: 5, validity_days: 30, price: 650, coverage_country_codes: ['SA', 'AE', 'QA'] }),
  pkg({ package_id: 'gulf-daily', name: 'Gulf Region 500MB/Day', data_gb: 0, daily_gb: 0.49, plan_type: 'DAILY', validity_days: null, price: 200,
    coverage_country_codes: ['SA', 'AE'], term_prices: ladder(200) }),
];

// The four sentences of the page before storefront #70.
const STALE = {
  title: 'eSIM для Саудовской Аравии на месяц — 50 ГБ дешевле посуточного',
  description: 'eSIM для Саудовской Аравии: на месяц объёмный тариф на 50 ГБ выходит дешевле посуточного. Оплата российской картой или через СБП.',
  h1: 'Месяц в Саудовской Аравии: посуточный тариф проигрывает',
  intro: ['Объёмный тариф на 50 ГБ на 30 дней стоит 8100 ₽. Посуточный 1 ГБ в день на 30 дней — 8900 ₽.'],
};
const CLAIM = {
  id: 'fifty-cheaper-than-daily-month',
  anchors: [{ field: 'description', text: 'eSIM для Саудовской Аравии: на месяц объёмный тариф на 50 ГБ выходит дешевле посуточного.' },
    { field: 'intro[0]', text: 'Объёмный тариф на 50 ГБ на 30 дней стоит 8100 ₽.' }],
  terms: { fifty: { package: 'sa-50', block: 'local', attrs: { data_gb: 50, validity_days: 30 } },
    daily30: { package: 'sa-daily-1', block: 'daily', days: 30, attrs: { daily_gb: 1 } } },
  assert: [{ left: 'fifty', op: '<', right: 'daily30' }, { left: 'fifty', op: '=', right: 8100 }],
};
const profile = (claims, extra = {}) => ({ ...STALE, price_claims: claims, ...extra });
const run = (claims, cat = CATALOGUE(), extra) => evaluateProfile(profile(claims, extra), 'saudi-arabia', cat).map((x) => x.msg);
const clone = (o) => JSON.parse(JSON.stringify(o));

test('the Saudi Arabia move of 2026-10-14 is refused, and the message names the sentence', () => {
  assert.deepEqual(run([CLAIM]), [], 'на каталоге 13.10 утверждение верно');
  const got = run([CLAIM], CATALOGUE(10050));
  assert.equal(got.length, 2, got.join('\n'));
  assert.match(got[0], /fifty < daily30 ложно: .*10050 ₽.*8900 ₽/);
  assert.match(got[0], /выходит дешевле посуточного/);
  assert.match(got[1], /fifty = 8100 ложно/);
});

test('a relation that holds both ways passes a price move — the check is not a price pin unless asked to be', () => {
  const c = clone(CLAIM); c.assert = [{ left: 'fifty', op: '<', right: 'daily30' }];
  assert.deepEqual(run([c], CATALOGUE(8500)), []);
});

test('a withdrawn package is a failure that lists the likely successors in the same block', () => {
  const cat = CATALOGUE().filter((p) => p.package_id !== 'sa-50');
  cat.push(pkg({ package_id: 'sa-50-new', name: 'Saudi Arabia 50 GB', data_gb: 50, validity_days: 30, price: 8100 }));
  const got = run([CLAIM], cat);
  assert.equal(got.length, 1, got.join('\n'));
  assert.match(got[0], /продукта sa-50 нет в каталоге.*sa-50-new/);
});

test('a package that left its block (or the page) is refused — attribution is the claim', () => {
  const moved = CATALOGUE().map((p) => (p.package_id === 'sa-50' ? { ...p, coverage_country_codes: ['SA', 'AE'] } : p));
  assert.match(run([CLAIM], moved).join('\n'), /sa-50.* не в блоке «local».*сейчас в «regional»/);
  const gone = CATALOGUE().map((p) => (p.package_id === 'sa-50' ? { ...p, coverage_country_codes: ['AE'], country_code: 'AE' } : p));
  assert.match(run([CLAIM], gone).join('\n'), /страница его не показывает/);
});

test('attrs pin what the sentence says about the package', () => {
  const cat = CATALOGUE().map((p) => (p.package_id === 'sa-50' ? { ...p, validity_days: 15 } : p));
  assert.match(run([CLAIM], cat).join('\n'), /validity_days сейчас 15, в утверждении 30/);
});

test('a PER_DAY price is a rung of the ladder: days are required, and a missing rung is refused', () => {
  const daily = CATALOGUE().find((p) => p.package_id === 'sa-daily-1');
  assert.deepEqual(termPrice(daily, 30), { price: 8900 });
  assert.match(termPrice(daily).error, /лестница сроков — укажите days/);
  assert.match(termPrice(daily, 7).error, /нет срока 7 дн\. \(есть: 3, 30\)/);
  // The per-day rate (300) is never a price — not even when it is the only number.
  assert.notEqual(termPrice(daily, 3).price, daily.price);
  const fixed = CATALOGUE().find((p) => p.package_id === 'sa-50');
  assert.deepEqual(termPrice(fixed, 30), { price: 8100 });
  assert.match(termPrice(fixed, 15).error, /действует 30 дн\., не 15/);
});

test('min_of: the cheapest amount in a block, the page, or the volume blocks — narrowed by where', () => {
  const claim = {
    id: 'floors', anchors: CLAIM.anchors.slice(0, 1),
    terms: { page: { min_of: 'page' }, volume: { min_of: 'volume' }, local: { min_of: 'local' }, daily: { min_of: 'daily' },
      single: { min_of: 'page', where: { multi_country: false } }, multi: { min_of: 'page', where: { multi_country: true } },
      d30: { min_of: 'daily', days: 30 } },
    assert: [{ left: 'page', op: '=', right: 600 }, { left: 'volume', op: '=', right: 650 }, { left: 'local', op: '=', right: 950 },
      { left: 'daily', op: '=', right: 600 }, { left: 'single', op: '=', right: 900 }, { left: 'multi', op: '=', right: 'page' },
      { left: 'd30', op: '=', right: 6000 }],
  };
  assert.deepEqual(run([claim]), []);
  const empty = { ...claim, terms: { x: { min_of: 'regional', where: { data_gb: 100 } } }, assert: [{ left: 'x', op: '<', right: 1 }] };
  assert.match(run([empty]).join('\n'), /min_of «regional».*пусто, сравнивать не с чем/);
});

test('factor: left × K op right, compared in whole kopecks', () => {
  const claim = (factor, op) => ({ id: 'times', anchors: CLAIM.anchors.slice(0, 1),
    terms: { local: { package: 'sa-3', block: 'local' }, gulf: { package: 'gulf-5', block: 'regional' } },
    assert: [{ left: 'gulf', op, right: 'local', factor }] });
  assert.deepEqual(run([claim(1.4, '<')]), []); // 910 < 950
  assert.match(run([claim(1.5, '<')]).join('\n'), /gulf × 1\.5 < local ложно/); // 975
  assert.deepEqual(run([claim(1 / 3, '<')]), []);
});

test('an anchor must still be on the page, as a whole sentence', () => {
  const gone = clone(CLAIM); gone.anchors[0].text = 'Этой фразы на странице нет.';
  assert.match(run([gone]).join('\n'), /цитаты «Этой фразы на странице нет\.» нет в description/);
  const part = clone(CLAIM); part.anchors[0].text = 'объёмный тариф на 50 ГБ выходит дешевле посуточного';
  assert.match(run([part]).join('\n'), /не целое предложение description/);
  const field = clone(CLAIM); field.anchors[0].field = 'faq[3].a';
  assert.match(run([field]).join('\n'), /поля faq\[3\]\.a в профиле нет/);
});

test('the shape fails closed', () => {
  const bad = (mut, re) => {
    const c = clone(CLAIM); mut(c);
    const got = validateClaimShape(c);
    assert.ok(got.some((m) => re.test(m)), `ожидалось ${re}, получено:\n${got.join('\n')}`);
  };
  bad((c) => { c.price = 1; }, /неизвестный ключ «price»/);
  bad((c) => { delete c.terms.fifty.block; }, /block обязателен/);
  bad((c) => { c.terms.fifty.block = 'europe'; }, /block обязателен/);
  bad((c) => { c.terms.fifty.attrs = { name: 1 }; }, /attrs\.name/);
  bad((c) => { c.terms.x = { min_of: 'world' }; }, /min_of/);
  bad((c) => { c.terms.x = { min_of: 'page', where: { multi_country: 'yes' } }; }, /where\.multi_country — неверный тип/);
  bad((c) => { c.terms.x = { name: 'Saudi' }; }, /нужен package или min_of/);
  bad((c) => { c.assert = []; }, /assert обязателен/);
  bad((c) => { c.assert = [{ left: 'fifty', op: '≈', right: 1 }]; }, /op/);
  bad((c) => { c.assert = [{ left: 'nobody', op: '<', right: 1 }]; }, /left: имя из terms/);
  bad((c) => { c.assert = [{ left: 1, op: '<', right: 2 }]; }, /два числа/);
  bad((c) => { c.assert[0].factor = 0; }, /factor/);
  bad((c) => { c.anchors = []; }, /anchors обязательны/);
  bad((c) => { c.id = 'Цена'; }, /id обязателен/);
  bad((c) => { c.terms.fifty.days = 1.5; }, /days — целое/);
  assert.deepEqual(validateClaimShape(CLAIM), []);
  const dup = run([CLAIM, CLAIM]);
  assert.ok(dup.some((m) => /повторяется/.test(m)), dup.join('\n'));
});

test('the completeness rule fires on the four Saudi headline sentences that went false', () => {
  // The first assertion of a rule proves it fires on the exact sentences it exists for.
  for (const s of [STALE.title, STALE.description.split('. ')[0], STALE.h1]) assert.match(s, PRICE_SENTENCE_RE, s);
  const got = unanchoredHeadlineSentences({ ...STALE });
  assert.deepEqual(got.map((x) => x.field), ['title', 'description', 'h1']);
  // Anchored → not reported; the payment sentence of the description never was.
  const covered = unanchoredHeadlineSentences(profile([CLAIM]));
  assert.deepEqual(covered.map((x) => x.field), ['title', 'h1']);
});

test('the completeness rule stays quiet on headlines with no price, and reads only the four headline fields', () => {
  const quiet = {
    title: 'eSIM для Греции — интернет в Афинах и на островах',
    description: 'eSIM для Саудовской Аравии на месяц: 50 ГБ на 30 дней без дневного лимита или посуточный тариф 1 ГБ в день. Оплата российской картой или через СБП.',
    h1: 'Месяц в Саудовской Аравии: 50 ГБ сразу или 1 ГБ в день',
    lead: 'Посуточный тариф выглядит удобным: платишь за дни, сколько нужно.',
    intro: ['Объёмный тариф на 50 ГБ стоит 8100 ₽ — тело страницы проверяет checkFacts, а не это правило.'],
  };
  assert.deepEqual(unanchoredHeadlineSentences(quiet), []);
});

test('a waiver needs a reason and must still quote a whole headline sentence', () => {
  const p = { lead: 'Обычно чем меньше берёшь, тем дешевле. В сетке иначе.' };
  const ok = { ...p, price_claims_waived: [{ field: 'lead', text: 'Обычно чем меньше берёшь, тем дешевле.', reason: 'Общее правило, не утверждение о сетке этой страны.' }] };
  assert.deepEqual(waiverProblems(ok), []);
  assert.deepEqual(unanchoredHeadlineSentences(ok), []);
  assert.match(waiverProblems({ ...p, price_claims_waived: [{ field: 'lead', text: 'Обычно чем меньше берёшь, тем дешевле.', reason: 'так' }] }).join('\n'), /reason обязателен/);
  assert.match(waiverProblems({ ...p, price_claims_waived: [{ field: 'lead', text: 'Этой фразы больше нет.', reason: 'Общее правило, не утверждение о сетке.' }] }).join('\n'), /больше не целое предложение/);
  assert.match(waiverProblems({ ...p, price_claims_waived: [{ field: 'intro[0]', text: 'x', reason: 'Общее правило, не утверждение о сетке.' }] }).join('\n'), /нужны field/);
});

test('price_claims are bookkeeping: accepted by the profile loader and never rendered', () => {
  const src = readFileSync(join(ROOT, 'seo/content-profile.mjs'), 'utf8');
  assert.match(src, /'price_claims', 'price_claims_waived'/);
  const { profile: p, warnings } = loadProfile('qatar');
  assert.ok(p && !('price_claims' in p) && !('price_claims_waived' in p));
  assert.deepEqual(warnings.filter((w) => /price_claims/.test(w)), []);
});

test('the guard is NOT part of the catalogue cache refresh — a price move must never freeze the cache', () => {
  // The refresh can only refuse a snapshot; it cannot refuse the provider's price.
  // Its job is coverage (seo/coverage-claims.mjs). This check fails the SEO-refresh
  // PR instead, through `npm test`.
  const wf = readFileSync(join(ROOT, '.github/workflows/refresh-catalog-cache.yml'), 'utf8');
  assert.doesNotMatch(wf, /price-claims/);
  const pkgJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkgJson.scripts.test, /seo\/test-\*\.mjs/);
});

// ------------------------------------------------------------------ the corpus, on the live snapshot

test('every price claim holds on assets/catalog.json and every headline price sentence is anchored or waived', () => {
  const { problems, claims } = checkCorpus();
  assert.ok(claims >= 39, `price_claims: ${claims}`);
  assert.deepEqual(problems.map(formatProblem), []);
});

test('the pages whose premise is a price relation carry a claim on it', () => {
  // The headline relations the 2026-10-14 audit found (Saudi Arabia's own is gone with #70).
  for (const slug of ['nepal', 'qatar', 'taiwan', 'tajikistan', 'tanzania', 'sri-lanka', 'montenegro', 'dominican-republic']) {
    const p = JSON.parse(readFileSync(join(ROOT, 'seo/content-profiles', `${slug}.json`), 'utf8'));
    assert.ok(Array.isArray(p.price_claims) && p.price_claims.some((c) => c.assert.some((a) => typeof a.right === 'string' && typeof a.left === 'string')),
      `${slug}: нет утверждения-сравнения`);
  }
});
