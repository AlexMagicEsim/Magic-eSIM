// What the SEO refresh does when the catalogue moves — each move run for real
// (seo/refresh-scenarios.mjs: temp copy → catalogue change → build-all → the
// corpus gates). The outcome of every scenario is pinned: a move that only
// touches generated numbers must rebuild green with the new numbers; a move
// that withdraws a card an authored sentence is about, or makes it false, must
// rebuild green WITHOUT that sentence and record it in seo/suppressed-claims.json
// (seo/page-claims.mjs, 2026-11-01); a move that switches the provider behind a
// card must rebuild green with the card's new amount; a move that empties a
// country must stop the refresh with a message that says what to do.

import test from 'node:test';
import assert from 'node:assert/strict';
import { runScenario, runAll } from './refresh-scenarios.mjs';
import { cases, templateFixture } from './refresh-scenario-cases.mjs';

const PRICE = 'every price claim is well formed and every headline price sentence is anchored or waived; one the catalogue no longer bears out is left out of its page';
const COVERAGE = 'every authored page agrees with the current catalogue on coverage; a sentence about a card that is gone is left out of its page';
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
// What the scenario added to seo/suppressed-claims.json (the live snapshot already leaves some sentences out).
const CONTROL = 'control: the catalogue does not move';
const added = async (r) => {
  const base = new Set((await get(CONTROL)).suppressed.map((x) => `${x.slug}|${x.unit}|${x.source}|${x.id}`));
  return r.suppressed.filter((x) => !base.has(`${x.slug}|${x.unit}|${x.source}|${x.id}`));
};
const leftOut = async (r, slug, source, id) => {
  const got = (await added(r)).filter((x) => x.slug === slug && x.source === source && x.id === id);
  assert.ok(got.length, `${slug} · ${source}/${id} is left out — added: ${JSON.stringify(await added(r))}`);
  return got;
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

test('stage B: the card a {{price}} token names is withdrawn — GREEN, the sentence is left out and recorded, nothing raw or stale is printed', async () => {
  const r = await get('a card a {{price}} TOKEN names is WITHDRAWN (australia · aunz_5gb)');
  baseline(r);
  assert.deepEqual(r.failing, []);
  const [x] = await leftOut(r, 'australia', 'price_refs', 'aunz_5gb');
  assert.match(x.reason, /нет карточки regional 5 ГБ/);
  assert.doesNotMatch(r.inspected.html, /\{\{price:/);
});

test('backend #124: the provider behind a {{price}} card switches (new id, same card, new price) — GREEN, the page prints the new amount, nothing is left out', async () => {
  const r = await get('the backend SWITCHES the provider behind a {{price}} card (australia · au_daily_500mb_3d: new id, same card, new price)');
  baseline(r);
  assert.deepEqual(r.failing, []);
  assert.deepEqual(await added(r), []);
  const amount = `${Math.round(r.inspected.price).toLocaleString('ru-RU')} ₽`;
  assert.ok(r.inspected.html.includes(`500 МБ в день на три дня — ${amount}.`), `australia prints ${amount}`);
});

test('a stated relation flips: GREEN, the relation\'s sentences are left out (montenegro prints its amounts through tokens, so only the relation goes)', async () => {
  const r = await get('a stated relation FLIPS (montenegro · local-20gb-below-regional-18gb: the local plan becomes dearer)');
  baseline(r);
  assert.deepEqual(r.failing, []);
  const got = await leftOut(r, 'montenegro', 'price_claims', 'local-20gb-below-regional-18gb');
  assert.match(got[0].reason, /assert\[0\] local < regional ложно/);
});

test('the card a price claim names is withdrawn: GREEN, the claim\'s sentences are left out', async () => {
  const r = await get('a card a PRICE claim names is WITHDRAWN (sri-lanka · faq-3gb-30-dearer-than-1gb-14 · g14)');
  baseline(r);
  assert.deepEqual(r.failing, []);
  const got = await leftOut(r, 'sri-lanka', 'price_claims', 'faq-3gb-30-dearer-than-1gb-14');
  assert.match(got[0].reason, /нет карточки local 1 ГБ \/ 14 дн\./);
});

// 2026-10-25: until the assortment the withdrawn package was also a price-claim term and the case expected [COVERAGE, PRICE];
// no such package is left (seo/refresh-scenario-cases.mjs) — the price half is the sri-lanka withdrawal case above.
test('the card a coverage claim names is withdrawn: GREEN, the claim\'s sentence is left out', async () => {
  const r = await get('a card a COVERAGE claim names is WITHDRAWN (usa · north-america-daily)');
  baseline(r);
  assert.deepEqual(r.failing, []);
  await leftOut(r, 'usa', 'coverage_claims', 'north-america-daily');
});

test('a new offer makes a «cheapest» sentence false: GREEN, that claim\'s sentence is left out', async () => {
  const r = await get('a new offer makes a «cheapest» sentence false (greece: a local plan below the 1 GB / 7 days entry)');
  baseline(r);
  assert.deepEqual(r.failing, []);
  const got = await leftOut(r, 'greece', 'price_claims', 'cheapest-entry-1gb');
  assert.match(got[0].reason, /cheapest-entry-1gb|assert\[0\] local = g1 ложно/);
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
  // It also counts as one more country on the cards, so «до 41 страны» is false: left out, not published.
  assert.ok(!r.failing.includes(COVERAGE), r.failing.join('\n'));
  assert.ok((await added(r)).some((x) => x.source === 'coverage_claims'), 'a coverage sentence the new code falsifies is left out');
});
