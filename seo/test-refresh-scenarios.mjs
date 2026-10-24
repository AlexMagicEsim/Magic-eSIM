// What the SEO refresh does when the catalogue moves — each move run for real
// (seo/refresh-scenarios.mjs: temp copy → catalogue change → build-all → the
// corpus gates). The outcome of every scenario is pinned: a move that only
// touches generated numbers must rebuild green with the new numbers; a move
// that falsifies authored text, withdraws a named package or empties a country
// must stop the refresh with a message that says what to do.

import test from 'node:test';
import assert from 'node:assert/strict';
import { runScenario, runAll } from './refresh-scenarios.mjs';
import { cases, templateFixture } from './refresh-scenario-cases.mjs';

const PRICE = 'every price claim holds on assets/catalog.json and every headline price sentence is anchored or waived';
const COVERAGE = 'every authored page agrees with the current catalogue on coverage';
const FACTS = 'every authored page agrees with the current catalogue';
const GENERATED = 'every generated «от N ₽» (meta, og/twitter, JSON-LD, template FAQ, FAQPage) is the catalogue floor';

const CASES = cases();
const TPL = templateFixture();
const RESULTS = new Map();
const results = runAll(CASES.map((c) => async () => { RESULTS.set(c.name, await runScenario(c.mutate, { inspect: c.inspect })); }), 3);

const get = async (name) => { await results; const r = RESULTS.get(name); assert.ok(r, `scenario ran: ${name}`); return r; };
const detail = (r, testName) => (r.tests.find((t) => t.name === testName) || { detail: '' }).detail;
const metaFloor = (html) => Number(((html || '').match(/от ([\d  ]+) ₽\. Оплата рублями/) || [])[1]?.replace(/\D/g, ''));
const baseline = (r) => {
  assert.equal(r.build.code, 0, `build-all failed: ${r.build.stderr}`);
  assert.ok(r.gatesRan >= 18, `gates ran: ${r.gatesRan}`);
};

test('control: an unchanged catalogue rebuilds green', async () => {
  const r = await get('control: the catalogue does not move');
  baseline(r);
  assert.deepEqual(r.failing, []);
});

for (const [name, dir] of [['prices DOWN on a template page (no authored text quotes them)', 'down'], ['prices UP on a template page', 'up']]) {
  test(`prices ${dir} where only generated numbers quote them: green, and the page prints the new floor`, async () => {
    const r = await get(name);
    baseline(r);
    assert.deepEqual(r.failing, []);
    assert.notEqual(r.inspected.floor, TPL.floor, 'the floor moved');
    assert.equal(metaFloor(r.inspected.html), r.inspected.floor, `${TPL.slug}: the rebuilt meta prints the new floor`);
    assert.match(r.inspected.html, new RegExp(`Цены начинаются от ${String(r.inspected.floor).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽\\.`));
  });
}

test('a new offer below the floor: green, the floor follows it', async () => {
  const r = await get('a NEW offer below the floor on a template page');
  baseline(r);
  assert.deepEqual(r.failing, []);
  assert.equal(r.inspected.floor, TPL.floor - 100);
  assert.equal(metaFloor(r.inspected.html), TPL.floor - 100);
});

test('stage B: a package a {{price}} token prints moves — GREEN, and the rebuilt page prints the new amount', async () => {
  const r = await get('a package a {{price}} TOKEN prints moves (australia · au_daily_500mb_3d)');
  baseline(r);
  assert.deepEqual(r.failing, []);
  const amount = `${Math.round(r.inspected.price).toLocaleString('ru-RU')} ₽`;
  assert.ok(r.inspected.html.includes(`500 МБ в день на три дня — ${amount}.`), `australia prints ${amount}`);
});

// (the hand-typed-amount scenario was retired 2026-10-24 — no hand-typed amount is left; seo/refresh-scenario-cases.mjs)

test('stage B: a package a {{price}} token names is withdrawn — the BUILD stops, naming the reference and successor candidates', async () => {
  const r = await get('a package a {{price}} TOKEN names is WITHDRAWN (australia · aunz_5gb)');
  assert.notEqual(r.build.code, 0, 'build-all refuses the page');
  assert.match(r.build.stderr, /подстановки цен на \/esim\/australia\//);
  assert.match(r.build.stderr, /price_refs\.aunz_5gb: продукта .* нет в каталоге — исчез или снят с витрины; кандидаты в блоке «regional»/);
  assert.match(r.build.stderr, /перепривяжите её к тарифу-преемнику/);
});

test('a stated relation flips: red on the relation itself (montenegro prints its amounts through tokens, so only the relation fails)', async () => {
  const r = await get('a stated relation FLIPS (montenegro · local-vs-balkans-daily: the local plan becomes dearer)');
  baseline(r);
  assert.deepEqual(r.failing, [PRICE]);
  assert.match(detail(r, PRICE), /local-vs-balkans-daily: assert\[0\] local < balkans ложно/);
});

test('a package a price claim names is withdrawn: red, with successor candidates in the same block', async () => {
  const r = await get('a package a PRICE claim names is WITHDRAWN (sri-lanka · why-entry-vs-local · local)');
  baseline(r);
  assert.deepEqual(r.failing, [PRICE]);
  assert.match(detail(r, PRICE), /нет в каталоге — исчез или снят с витрины; кандидаты в блоке «daily»/);
});

test('a package a coverage claim names is withdrawn: red on coverage (and on the price claim that names it too)', async () => {
  const r = await get('a package a COVERAGE claim names is WITHDRAWN (australia · au-nz-daily-500mb)');
  baseline(r);
  assert.deepEqual(r.failing, [COVERAGE, PRICE].sort());
  assert.match(detail(r, COVERAGE), /\/esim\/australia\//);
  assert.match(detail(r, PRICE), /faq-daily-au-and-au-nz: aunz: продукта .* нет в каталоге/);
});

test('a new offer makes a «cheapest» sentence false: red on that claim', async () => {
  const r = await get('a new offer makes a «cheapest» sentence false (sri-lanka: a local plan below the multi-country entry)');
  baseline(r);
  assert.deepEqual(r.failing, [PRICE]);
  assert.match(detail(r, PRICE), /cheapest-is-not-local: assert\[0\] multi = cheapest ложно/);
});

test('a country loses every plan: the generators keep the page, and the gates demand its explicit removal', async () => {
  const r = await get('a template country LOSES every plan (its page must be removed by a person)');
  baseline(r);
  assert.equal(r.inspected.pageStillThere, true, 'no generator deletes a page');
  for (const t of [
    'C4b: no page exists for a country whose grid would render nothing',
    'C5: no orphaned country directory survives a removal',
    'C3: no page advertises tariffs it no longer has',
    GENERATED,
  ]) assert.ok(r.failing.includes(t), `${t} — failing: ${r.failing.join(' | ')}`);
  assert.match(detail(r, 'C4b: no page exists for a country whose grid would render nothing'), new RegExp(`${TPL.slug} \\(${TPL.iso}\\): page exists but its grid would be empty`));
  assert.ok(!r.failing.includes(PRICE) && !r.failing.includes(COVERAGE), 'no authored page is involved');
});

test('the provider adds a named coverage-only code (KT): the refresh guard and every gate stay green, and no page appears', async () => {
  const r = await get('the provider adds a NAMED coverage-only code (KT, Northern Cyprus) to a package family');
  baseline(r);
  assert.ok(r.info.packages >= 3);
  assert.deepEqual(r.failing, []);
  assert.equal(r.inspected.guard.code, 0, r.inspected.guard.out);
  assert.equal(r.inspected.ktPage, false);
});

test('the provider adds an UNKNOWN code: the refresh guard stops it and names the code', async () => {
  const r = await get('the provider adds an UNKNOWN code to a package family');
  assert.equal(r.build.code, 0, r.build.stderr);
  assert.equal(r.inspected.guard.code, 1, r.inspected.guard.out);
  assert.match(r.inspected.guard.out, /XQ/);
  // It also counts as one more country on the cards, so «до 41 страны» goes red.
  assert.ok(r.failing.includes(COVERAGE), r.failing.join('\n'));
});
