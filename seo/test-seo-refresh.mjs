// The automation that rebuilds the SEO pages after the catalogue moves.
//
// WHAT IS ACTUALLY UNDER TEST HERE, AND WHAT IS NOT. Two different things, kept
// apart on purpose:
//
//   * the decisions — what counts as an unexpected file, what the summary says,
//     how risky a change is — are pure functions and are tested by calling them;
//   * the ORDER of the workflow's steps and the guards inside them are tested as
//     text, because that is the only honest level at which a test file can hold a
//     GitHub Actions workflow. These assertions catch the regression that
//     actually happens: someone moves the pull-request step above the validation,
//     or drops a gate, and nothing else in the repository would notice.
//
// A shape test that merely greps for a word is worthless, so each one below
// pins a RELATION — this step before that one, this step gated on that output —
// rather than the presence of a string.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePorcelain, unexpectedPaths, allowedPaths, FIXED_ALLOWED } from './refresh-allowlist.mjs';
import { classify, riskOf, renderMarkdown, CLAIM_FIELDS } from './refresh-summary.mjs';
import { pushDecision } from './refresh-noop.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WF = readFileSync(join(ROOT, '.github/workflows/seo-refresh-pr.yml'), 'utf8');

// The workflow with its comment lines removed. Every «this must NOT appear»
// assertion below runs against THIS, because twice already a rule matched the
// prose explaining why the thing is forbidden — the comment «Never `git add .`»
// is not a `git add .`, and a test that cannot tell them apart forces the
// explanation out of the file. Same lesson as §26.1: assert on the thing.
const WF_CODE = WF.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const SYNC = readFileSync(join(ROOT, '.github/workflows/refresh-catalog-cache.yml'), 'utf8');

/* ------------------------------------------------------------------ *
 * Fixtures — two states of the same small catalogue.
 * ------------------------------------------------------------------ */

const country = (slug, over = {}) => ({
  iso: slug.slice(0, 2).toUpperCase(), slug, nameRu: slug, flagEmoji: '🏳',
  local_count: 4, regional_count: 1, daily_count: 9, total_count: 14,
  min_price_rub: 300, volumes: [3, 5], daily_gb: [1], strategy: 'LOCAL',
  renders_nothing: false, ...over,
});

// A REAL sheet, taken from the shipped file, with the two floors pinned so the
// price cases stay readable. Hand-writing this is what let four field names be
// wrong for as long as the rule existed.
const REAL_SHEET = JSON.parse(readFileSync(join(ROOT, 'seo/fact-sheets.json'), 'utf8')).sheets;
const sheet = (over = {}) => ({
  ...Object.values(REAL_SHEET)[0],
  min_volume_price_rub: 400,
  min_daily_price_rub: 300,
  ...over,
});

const pkg = (id, over = {}) => ({
  package_id: id, name: id, price: 100, plan_type: 'DAILY',
  daily_term_mode: 'PER_DAY', coverage_country_codes: ['JE'], ...over,
});

const state = (over = {}) => ({
  cacheBefore: { countries: [country('jersey')] },
  cacheAfter: { countries: [country('jersey')] },
  sheetsBefore: { sheets: { jersey: sheet() } },
  sheetsAfter: { sheets: { jersey: sheet() } },
  catalogueBefore: [pkg('a'), pkg('b')],
  catalogueAfter: [pkg('a'), pkg('b')],
  urlsBefore: ['https://magicesim.store/esim/jersey/'],
  urlsAfter: ['https://magicesim.store/esim/jersey/'],
  ...over,
});

/* ------------------------------------------------------------------ *
 * A small step parser, because grepping YAML proved too weak.
 *
 * An independent review mutated the workflow seven ways that broke its safety
 * and kept every assertion in the first version of this file green: an extra
 * step pushing to main AFTER the PR step; permissions widened; the success guard
 * demoted to a comment; the allowlist step gutted while keeping its name and
 * position; an unconditional force via a `+refspec`; a second `git add` for
 * assets/; and a single-line `run:` carrying an expression, which the block
 * scanner never opened. Every one of those is a hole in the ASSERTION, not in
 * the workflow — the tests pinned names and relative order and nothing else.
 *
 * So the steps are parsed, and what is asserted is the exact list of them, what
 * each one runs, and properties of the file as a whole.
 * ------------------------------------------------------------------ */

function parseSteps(yaml) {
  const out = [];
  const lines = yaml.split('\n');
  let cur = null;
  let runIndent = null;
  for (const line of lines) {
    const step = line.match(/^ {6}- (\w[\w-]*):\s*(.*)$/);
    if (step) {
      if (cur) out.push(cur);
      cur = { name: null, uses: null, id: null, if: null, run: '' };
      if (step[1] === 'uses') cur.uses = step[2].trim();
      if (step[1] === 'name') cur.name = step[2].trim();
      runIndent = null;
      continue;
    }
    if (!cur) continue;
    const key = line.match(/^ {8}(\w[\w-]*):\s*(.*)$/);
    if (key) {
      runIndent = null;
      const [, k, v] = key;
      if (k === 'name') cur.name = v.trim();
      if (k === 'uses') cur.uses = v.trim();
      if (k === 'id') cur.id = v.trim();
      if (k === 'if') cur.if = v.trim();
      if (k === 'run') {
        // Both shapes: a block scalar and a one-liner. The one-liner is the form
        // the review slipped an expression through.
        if (v.trim() === '|' || v.trim() === '>') runIndent = 8;
        else cur.run += `${v}\n`;
      }
      continue;
    }
    if (runIndent !== null && (line.trim() === '' || line.startsWith(' '.repeat(runIndent + 2)))) {
      cur.run += `${line}\n`;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * A step's run body with its comments removed.
 *
 * Three assertions in a row have now matched the prose explaining why a thing is
 * forbidden instead of the thing: «Never `git add .`» is not a `git add .`, and
 * the comment «No PAT» is not a PAT. Counting or forbidding is done on code.
 */
const code = (run) => String(run || '').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

const STEPS = parseSteps(WF);
const named = STEPS.filter((s) => s.name).map((s) => s.name);
const stepByName = (n) => STEPS.find((s) => s.name === n);

/* ================================================================== *
 * A and B. Nothing to publish
 * ================================================================== */

test('A/B: an unchanged tree yields no paths, so nothing downstream can fire', () => {
  // Both «the catalogue did not move» and «it moved but no page changed» reach
  // the workflow as the same fact: an empty `git status`. There is deliberately
  // no separate branch for them — one emptiness check covers both, and a second
  // path would be a second thing to get wrong.
  assert.deepEqual(parsePorcelain(''), []);
  assert.deepEqual(parsePorcelain('\n\n'), []);
  assert.deepEqual(unexpectedPaths([], ['jersey']), []);

  const s = classify(state());
  assert.equal(s.countries.length, 0);
  assert.equal(s.totals.countries_affected, 0);
  assert.equal(riskOf(s).level, 'LOW');
});

test('A/B: the PR steps are gated on there being a change at all', () => {
  for (const step of ['Ветка', 'Pull request', 'Воспроизводимость', 'Проверки — гейты витрины']) {
    const at = WF.indexOf(`- name: ${step}`);
    assert.ok(at > 0, `шаг «${step}» отсутствует`);
    const block = WF.slice(at, at + 400);
    assert.match(block, /if:\s*steps\.diff\.outputs\.changed == 'true'/, `шаг «${step}» не огорожен`);
  }
});

/* ================================================================== *
 * C, D. What the summary says
 * ================================================================== */

test('C: a moved price floor is reported with both numbers and the country', () => {
  const s = classify(state({
    cacheAfter: { countries: [country('jersey', { min_price_rub: 400, daily_count: 8, total_count: 13 })] },
    sheetsAfter: { sheets: { jersey: sheet({ min_daily_price_rub: 400 }) } },
  }));

  const j = s.countries.find((c) => c.slug === 'jersey');
  assert.ok(j, 'страна не попала в сводку');
  assert.deepEqual(j.changes.min_price_rub, { before: 300, after: 400 });
  assert.deepEqual(j.changes.min_daily_price_rub, { before: 300, after: 400 });
  assert.deepEqual(j.changes.daily_count, { before: 9, after: 8 });
  assert.equal(s.totals.floors_changed, 1);
  assert.equal(s.totals.counts_changed, 1);

  // And it survives into the body a person reads, with the units.
  const md = renderMarkdown(s, {});
  assert.match(md, /Price floors changed:\s+1/);
  assert.match(md, /минимальная цена: 300 ₽ → 400 ₽/);
});

test('D: a withdrawn plan is counted and named, with its price and coverage', () => {
  const s = classify(state({ catalogueAfter: [pkg('a')] }));
  assert.equal(s.totals.plans_removed, 1);
  assert.equal(s.totals.plans_added, 0);
  assert.equal(s.plans.removed[0].id, 'b');
  assert.deepEqual(s.plans.removed[0].coverage, ['JE']);
  assert.match(renderMarkdown(s, {}), /снят: `b` — 100 ₽, DAILY\/PER_DAY, покрытие JE/);
});

test('D: «not determined» is never rendered as zero', () => {
  // The previous snapshot is found by provenance and can genuinely be missing.
  // Printing 0 there would be a claim that nothing was withdrawn — the exact
  // fabricated-zero mistake `Number(null) === 0` produced in the top-up reader.
  const s = classify(state({ catalogueBefore: null, catalogueAfter: null }));
  assert.equal(s.totals.plans_removed, null);
  assert.equal(s.plans, null);
  const md = renderMarkdown(s, {});
  assert.match(md, /Plans removed:\s+не определено/);
  assert.match(md, /определить не удалось/);
  assert.doesNotMatch(md, /Plans removed:\s+0/);
});

/* ================================================================== *
 * E. Risk
 * ================================================================== */

test('every claim field exists in the real fact sheet, not only in a fixture', () => {
  // THE DEFECT THIS REPLACES. Four of the eight original names — topup_available,
  // activation_policy, speed, fup_policy — are not fields of seo/fact-sheets.json;
  // the sheet stores topup_yes/topup_no, activation_policies, speeds,
  // fup_policies. Both sides of every comparison read `undefined`, so «claim
  // changed → HIGH» could never fire, and the three of them are exactly the
  // fields CLAUDE.md records as added and gated after WAVE 3. The test did not
  // notice because its own fixture invented the same wrong names: §26.1 one level
  // down. Read the shipped file, and the fixture cannot drift from it again.
  const real = JSON.parse(readFileSync(join(ROOT, 'seo/fact-sheets.json'), 'utf8')).sheets;
  const one = Object.values(real)[0];
  assert.ok(one, 'лист фактов пуст');

  const missing = CLAIM_FIELDS.filter((f) => !(f in one));
  assert.deepEqual(missing, [], `поля нет в листе: ${missing.join(', ')}`);

  // And the fixture this file uses everywhere else is a real sheet, so a rename
  // upstream breaks the tests instead of silently disarming the rule.
  for (const f of CLAIM_FIELDS) assert.ok(f in sheet(), `фикстура не несёт ${f}`);
});

test('a count-shaped claim moves only when it crosses zero', () => {
  // `topup_yes`/`topup_no` are package counts, and content-review.mjs decides on
  // zero-ness: `if (!yes && !no) return []`, then `if (yes && …)`. Comparing the
  // raw number made every ordinary withdrawal read as «a factual claim changed»
  // — six countries on the 2026-09-14 case, one of them real — and a risk level
  // that is HIGH every time tells a reviewer nothing.
  const c = { countries: [country('jersey')] };
  const withYes = (n) => ({ sheets: { jersey: sheet({ topup_yes: n }) } });

  const shrunk = classify({ cacheBefore: c, cacheAfter: c, sheetsBefore: withYes(34), sheetsAfter: withYes(33) });
  assert.equal(shrunk.totals.claims_changed, 0, '34 → 33 не меняет того, что можно утверждать');

  const gone = classify({ cacheBefore: c, cacheAfter: c, sheetsBefore: withYes(1), sheetsAfter: withYes(0) });
  assert.equal(gone.totals.claims_changed, 1, '1 → 0 меняет полностью');
  assert.equal(riskOf(gone).level, 'HIGH');
});

test('a real claim change on a real field is HIGH', () => {
  // Driven from the shipped sheet rather than from invented values.
  const real = JSON.parse(readFileSync(join(ROOT, 'seo/fact-sheets.json'), 'utf8')).sheets;
  const slug = Object.keys(real)[0];
  const before = { sheets: { [slug]: real[slug] } };
  const after = { sheets: { [slug]: { ...real[slug], speeds: ['2G'] } } };
  const c = { countries: [country(slug)] };

  const s = classify({ cacheBefore: c, cacheAfter: c, sheetsBefore: before, sheetsAfter: after });
  assert.equal(s.totals.claims_changed, 1);
  assert.equal(riskOf(s).level, 'HIGH');
});

test('E: a removed URL is HIGH, and says which one', () => {
  const s = classify(state({ urlsAfter: [] }));
  const r = riskOf(s);
  assert.equal(r.level, 'HIGH');
  assert.ok(r.why.some((w) => w.includes('удалён адрес')), r.why.join(' / '));
  assert.match(renderMarkdown(s, {}), /\*\*удалён:\*\* https:\/\/magicesim\.store\/esim\/jersey\//);
});

test('E: a country leaving the catalogue is HIGH', () => {
  const s = classify(state({ cacheAfter: { countries: [] } }));
  assert.equal(riskOf(s).level, 'HIGH');
  assert.deepEqual(s.disappeared, ['jersey']);
});

test('E: a changed factual claim is HIGH even when no price moved', () => {
  const s = classify(state({
    sheetsAfter: { sheets: { jersey: sheet({ daily_reset_confirmed: true }) } },
  }));
  assert.equal(s.totals.floors_changed, 0);
  assert.equal(riskOf(s).level, 'HIGH');
  assert.match(renderMarkdown(s, {}), /\*\*утверждение `daily_reset_confirmed`\*\*: false → true/);
});

test('the body stays inside GitHub\'s limit on the worst change the catalogue can make', () => {
  // A pull request body is capped at 65 536 characters and nothing here was
  // bounded. Measured before this test existed: 198 countries plus 300 withdrawn
  // plans rendered 55 901 — inside, but at 85 % — and withdrawing the whole daily
  // family, 1340 rows, rendered 106 946. `gh pr create` answers 422 there, so the
  // automation would have gone SILENT on the single most dangerous change the
  // provider can make. Driven from the real catalogue, not from a made-up shape.
  const cache = JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8')).countries;
  const pk = JSON.parse(readFileSync(join(ROOT, 'assets/catalog.json'), 'utf8')).packages;
  assert.ok(cache.length > 150 && pk.length > 2000, 'фикстура должна быть настоящим каталогом');

  for (const drop of [300, 1340, pk.length - 1]) {
    const s = classify({
      cacheBefore: { countries: cache },
      cacheAfter: { countries: cache.map((c) => ({ ...c, min_price_rub: (c.min_price_rub || 100) + 50 })) },
      catalogueBefore: pk,
      catalogueAfter: pk.slice(0, pk.length - drop),
      urlsBefore: ['u'], urlsAfter: ['u'],
    });
    const md = renderMarkdown(s, { changed_files: ['a'] });
    assert.ok(md.length < 65536, `снято ${drop}: тело ${md.length} символов — PR не создастся`);

    // The numbers a decision rests on survive the capping, and the reader is
    // told what was left out rather than being shown a list that quietly ends.
    assert.match(md, new RegExp(`Plans removed:\\s+${drop}`));
    assert.match(md, /RISK: HIGH/);
    assert.match(md, /и ещё \d+/);
  }
});

test('the last-line-of-defence truncation actually works, and keeps the head', () => {
  // The list caps make this unreachable on any realistic change — which is
  // exactly why it needs its own test: «unreachable» is what the unbounded
  // version was too. A claim value is rendered with JSON.stringify, so sixty
  // countries whose `networks` list is enormous blows past the caps without
  // adding a single list entry.
  const huge = Array.from({ length: 300 }, (_, i) => `Оператор с довольно длинным именем ${i}`);
  const countries = Array.from({ length: 60 }, (_, i) => country(`c${i}`));
  const sheetsFor = (nets) => ({
    sheets: Object.fromEntries(countries.map((c) => [c.slug, sheet({ networks: nets })])),
  });

  const s = classify({
    cacheBefore: { countries },
    cacheAfter: { countries },
    sheetsBefore: sheetsFor([]),
    sheetsAfter: sheetsFor(huge),
  });
  const md = renderMarkdown(s, {});

  assert.ok(md.length < 65536, `тело ${md.length} символов — всё ещё больше предела GitHub`);
  assert.match(md, /Тело обрезано/);
  // The HEAD is what survives: the seven numbers and the risk block are what a
  // decision rests on, and truncating from the wrong end would drop exactly them.
  assert.match(md, /CATALOGUE SEO REFRESH/);
  assert.match(md, /RISK: HIGH/);
  assert.match(md, /Factual claims changed:\s+60/);
});

test('E: a withdrawal on its own is never LOW, even with every number steady', () => {
  // `riskOf` used to read only urls, counts, floors and claims — never `plans`.
  // A plan can leave the catalogue without moving any of those, and the summary
  // then said «ни одна цифра не сдвинулась» about a page that lost a tariff.
  const s = classify(state({ catalogueAfter: [pkg('a')] }));
  assert.equal(s.totals.plans_removed, 1);
  assert.equal(s.countries.length, 0, 'ни одна страновая цифра не двинулась — в этом весь случай');
  const r = riskOf(s);
  assert.notEqual(r.level, 'LOW');
  assert.ok(r.why.some((w) => w.includes('тарифов снято')), r.why.join(' / '));
});

test('E: a one-for-one swap changes the ladder, and that is not «nothing moved»', () => {
  // 20 GB withdrawn, 30 GB added at the same price: no count moves, no floor
  // moves, no claim moves — and every volume ladder on the page is different.
  const s = classify(state({
    cacheAfter: { countries: [country('jersey', { volumes: [3, 30] })] },
    catalogueAfter: [pkg('a'), pkg('c')],
  }));
  assert.ok(s.countries[0].changes.volumes, 'смена состава не замечена');
  assert.equal(riskOf(s).level, 'HIGH');
});

test('E: a sharp price move is HIGH, a modest one is only MEDIUM', () => {
  const sharp = classify(state({
    cacheAfter: { countries: [country('jersey', { min_price_rub: 900 })] },
  }));
  assert.equal(riskOf(sharp).level, 'HIGH');

  const modest = classify(state({
    cacheAfter: { countries: [country('jersey', { min_price_rub: 350 })] },
  }));
  assert.equal(riskOf(modest).level, 'MEDIUM');

  // A floor that stops existing is not a ratio at all, and must not be judged
  // as one — it is the page losing its ability to quote a price.
  const gone = classify(state({
    cacheAfter: { countries: [country('jersey', { min_price_rub: null })] },
  }));
  assert.equal(riskOf(gone).level, 'HIGH');
});

test('E: losing a third of a country\'s assortment is HIGH even at a steady price', () => {
  const s = classify(state({
    cacheAfter: { countries: [country('jersey', { total_count: 9, daily_count: 4 })] },
  }));
  assert.equal(riskOf(s).level, 'HIGH');
});

/* ================================================================== *
 * F, G. A failure never reaches the pull request
 * ================================================================== */

test('F/G: build, allowlist and validation all precede the branch and the PR', () => {
  const at = (name) => {
    const i = WF.indexOf(`- name: ${name}`);
    assert.ok(i > 0, `нет шага «${name}»`);
    return i;
  };
  const branch = at('Ветка');
  const pr = at('Pull request');
  for (const earlier of ['Пересборка', 'Только ожидаемые файлы', 'Воспроизводимость',
    'Проверки — гейты витрины', 'Проверки — браузер', 'Сводка изменений']) {
    assert.ok(at(earlier) < branch, `«${earlier}» должен идти до создания ветки`);
    assert.ok(at(earlier) < pr, `«${earlier}» должен идти до PR`);
  }
  assert.ok(branch < pr, 'ветка должна пушиться до открытия PR');

  // No step may resurrect a failed run. `continue-on-error` anywhere here would
  // let a red gate reach a reviewer wearing a green badge.
  assert.doesNotMatch(WF_CODE, /continue-on-error/);
  // `|| true` after the one place it is correct (a branch that may not exist)
  // would silently swallow a failure anywhere else.
  assert.equal((WF_CODE.match(/\|\|\s*true/g) || []).length, 1);
});

/* ================================================================== *
 * H. Fail closed on an unexpected file
 * ================================================================== */

test('H: anything outside the generated set is refused, by name', () => {
  const slugs = ['jersey', 'france'];
  assert.deepEqual(unexpectedPaths(['esim/jersey/index.html', 'esim/index.html', 'sitemap.xml'], slugs), []);

  assert.deepEqual(
    unexpectedPaths(['esim/jersey/index.html', 'assets/catalog.json', '.github/workflows/tests.yml'], slugs),
    ['.github/workflows/tests.yml', 'assets/catalog.json'],
  );

  // A guide page is NOT a country page. build-all does not generate the guides,
  // so one changing here means something else happened — and a wildcard over
  // esim/*/index.html would have hidden exactly that.
  assert.deepEqual(unexpectedPaths(['esim/payment-rubles/index.html'], slugs), ['esim/payment-rubles/index.html']);

  // The runtime the customer's browser executes is never generated output.
  assert.deepEqual(unexpectedPaths(['assets/country-tariffs.js'], slugs), ['assets/country-tariffs.js']);
});

test('H: the allowlist is derived from the built snapshot, not from a kept list', () => {
  // A country the provider starts selling must not fail the run closed.
  assert.ok(allowedPaths(['newland']).has('esim/newland/index.html'));
  assert.ok(!allowedPaths([]).has('esim/newland/index.html'));
  assert.equal(allowedPaths([]).size, FIXED_ALLOWED.length);
});

test('H: git status is parsed for the path that exists on disk', () => {
  assert.deepEqual(parsePorcelain(' M esim/jersey/index.html'), ['esim/jersey/index.html']);
  assert.deepEqual(parsePorcelain('?? seo/new.json'), ['seo/new.json']);
  // A rename reports both; only the destination is a file the commit would add.
  assert.deepEqual(parsePorcelain('R  esim/old/index.html -> esim/new/index.html'), ['esim/new/index.html']);
  // A quoted path is left quoted, so it cannot match the allowlist and the run
  // stops. Guessing at an unprintable name is not better than stopping.
  assert.deepEqual(parsePorcelain(' M "esim/\\320\\272/index.html"'), ['"esim/\\320\\272/index.html"']);
});

test('H: the workflow checks the paths before it looks at anything else', () => {
  assert.ok(WF.indexOf('- name: Только ожидаемые файлы') < WF.indexOf('- name: Есть ли что публиковать'));
  assert.match(WF, /git add -- esim seo\/catalogue-countries\.json seo\/fact-sheets\.json seo\/sitemap-lastmod\.json sitemap\.xml/);
  assert.doesNotMatch(WF_CODE, /git add \.|git add -A/);
});

/* ================================================================== *
 * I, J. One pull request, and the newest catalogue wins
 * ================================================================== */

test('I: runs queue instead of cancelling, so no push is interrupted', () => {
  assert.match(WF, /concurrency:\s*\n\s*group: seo-refresh-pr\s*\n\s*cancel-in-progress: false/);
});

test('I/J: an open PR is edited, never duplicated', () => {
  assert.match(WF, /gh pr list --head "\$BRANCH" --state open/);
  const create = WF.indexOf('gh pr create');
  const edit = WF.indexOf('gh pr edit');
  assert.ok(edit > 0 && create > 0);
  assert.ok(edit < create, 'сначала должна проверяться ветка существующего PR');
  assert.match(WF, /if \[ -n "\$existing" \]/);
});

test('J/I: every run rebuilds from main, and leaves no credential behind', () => {
  const checkout = STEPS.find((x) => (x.uses || '').startsWith('actions/checkout'));
  assert.ok(checkout, 'нет шага checkout');
  const at = WF.indexOf(checkout.uses);
  const block = WF.slice(at, at + 260);
  assert.match(block, /ref: main/);
  assert.match(block, /fetch-depth: 0/);
  // Otherwise checkout leaves a push-capable credential in .git/config for every
  // later step — including `npm ci`, which runs dependency lifecycle scripts.
  assert.match(block, /persist-credentials: false/);
});

test('M1/M6: exactly one add and one push, and the push cannot reach main', () => {
  const runs = STEPS.map((x) => code(x.run)).join('\n');
  assert.equal((runs.match(/\bgit add\b/g) || []).length, 1, 'git add должен быть ровно один');
  assert.equal((runs.match(/\bgit push\b/g) || []).length, 1, 'git push должен быть ровно один');

  // Line continuations are folded FIRST. The push is written across three lines,
  // and a mutation that put the `+` refspec — an unconditional force that no
  // --force flag names — on the continuation line walked past a single-line
  // regex while also dropping `$lease` entirely.
  const folded = runs.replace(/\\\n\s*/g, ' ');
  const push = folded.split('\n').find((l) => l.includes('git push'));
  assert.ok(push, 'не нашёл команду push');
  assert.match(push, /refs\/heads\/\$BRANCH:refs\/heads\/\$BRANCH/);
  assert.match(push, /\$lease/, 'push должен идти с --force-with-lease через $lease');
  assert.doesNotMatch(push, /\s\+["']?refs|\s\+["']?\$BRANCH/, 'refspec с + это безусловный force');
  assert.doesNotMatch(folded, /:main\b|:refs\/heads\/main/);
});

test('M4: the two load-bearing steps actually run the command they exist for', () => {
  // Pinned by name and position only, both could be gutted — the name kept, the
  // body replaced with `echo` — and every earlier assertion stayed green.
  assert.match(stepByName('Пересборка').run, /node seo\/build-all\.mjs/);
  assert.match(stepByName('Только ожидаемые файлы').run, /node scripts\/seo-refresh-check-paths\.mjs/);
  assert.match(stepByName('Только ожидаемые файлы').run, /git status --porcelain -uall/);
  assert.match(stepByName('Сводка изменений').run, /node scripts\/seo-refresh-summary\.mjs/);
  assert.match(stepByName('Проверки — гейты витрины').run, /npm test/);
  // And the allowlist is re-established against the tree being committed: the
  // steps in between rebuild and run `npm test`, which writes to ROOT by design.
  assert.match(stepByName('Ветка').run, /node scripts\/seo-refresh-check-paths\.mjs/);
});

test('M1: the step list is exactly this, in this order', () => {
  // Without pinning the SET, anything appended after the PR step is unreviewed.
  assert.deepEqual(named, [
    'Снимок артефактов до пересборки',
    'Пересборка',
    'Только ожидаемые файлы',
    'Есть ли что публиковать',
    'Воспроизводимость',
    'Проверки — гейты витрины',
    'Проверки — установка браузера',
    'Проверки — браузер',
    'Сводка изменений',
    'Ветка',
    'Pull request',
    'Ничего не изменилось',
  ]);
});

test('M7: no Actions expression is expanded inside ANY run, block or one-line', () => {
  for (const st of STEPS) {
    assert.doesNotMatch(code(st.run), /\$\{\{/, `выражение в run: шага «${st.name || st.uses}»`);
  }
  // The token exists only where GitHub is actually talked to.
  const withToken = STEPS.filter((x) => WF.slice(WF.indexOf(`- name: ${x.name}`), WF.indexOf(`- name: ${x.name}`) + 400).includes('GH_TOKEN'));
  assert.deepEqual(withToken.map((x) => x.name).filter(Boolean), ['Ветка', 'Pull request']);
  assert.doesNotMatch(WF_CODE, /^\s{4}env:[\s\S]{0,200}?GH_TOKEN/m);
});


/* ================================================================== *
 * K. A human touched the branch
 * ================================================================== */

test('K: a foreign commit on the automation branch stops the run before any push', () => {
  const at = WF.indexOf('- name: Ветка');
  const block = WF.slice(at, WF.indexOf('- name: Pull request'));

  // The guard exists, is computed against the merge-base, and exits non-zero.
  assert.match(block, /merge-base origin\/main/);
  assert.match(block, /foreign=/);
  assert.match(block, /if \[ -n "\$foreign" \]/);
  assert.match(block, /exit 1/);

  // And the push is leased to the exact SHA that was inspected, so anything
  // arriving in between loses the race rather than being overwritten.
  assert.match(block, /--force-with-lease=refs\/heads\/\$BRANCH:\$remote_sha/);
  const code = block.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.doesNotMatch(code, /push .*--force(\s|$)/);
  assert.ok(block.indexOf('foreign=') < block.indexOf('git push'), 'проверка должна быть до push');
});

/* ================================================================== *
 * The blast radius of the automation itself
 * ================================================================== */

test('permissions are the least that can open a PR, and no secret is used', () => {
  // deepEqual on the parsed block, not a prefix match: the regex form stayed green
  // when `actions: write` and `id-token: write` were added under it.
  const block = WF_CODE.match(/^permissions:\n((?:\s{2}\S[^\n]*\n)+)/m);
  assert.ok(block, 'нет блока permissions');
  assert.deepEqual(block[1].trim().split('\n').map((l) => l.trim()).sort(),
    ['contents: write', 'pull-requests: write']);
  // A PUBLIC repository: a secret here would be readable by any fork's PR run.
  assert.doesNotMatch(WF_CODE, /secrets\.(?!GITHUB_TOKEN)/);
  // The only credential referenced anywhere is the run's own ephemeral token.
  // Matching the WORD «PAT» would fail on the comment that explains why there is
  // none — a rule has to test the thing, not the discussion of it.
  const tokens = [...WF.matchAll(/\$\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(tokens)].filter((t) => /token|secret/i.test(t)), ['github.token']);
  // Nothing merges itself, ever.
  assert.doesNotMatch(WF_CODE, /gh pr merge|--auto|--admin/);
});

test('the catalogue sync workflow is not the thing being changed', () => {
  // This automation starts after that job; it must not have acquired the habit
  // of writing pages itself.
  const syncCode = SYNC.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.doesNotMatch(syncCode, /build-all|build-catalogue-pages|fact-sheet/);
  assert.match(SYNC, /git add assets\/catalog\.json/);
  assert.match(WF, /workflows: \["Refresh static catalog cache"\]/);
});

test('a package name from the provider cannot forge the body a reviewer reads', () => {
  // The one field in the summary that nobody in this repository writes. It goes
  // into a Markdown code span, so a backtick closes the span and everything after
  // renders as prose — enough to fake a heading or bury a removal in a body
  // somebody is skimming for exactly those lines.
  const evil = {
    package_id: 'x',
    name: 'plan` ## ПОДДЕЛЬНЫЙ ЗАГОЛОВОК\n- добавлен: всё в порядке',
    price: 100, plan_type: 'DAILY', coverage_country_codes: ['JE'],
  };
  const s = classify({ cacheAfter: { countries: [] }, catalogueBefore: [evil], catalogueAfter: [] });
  const line = renderMarkdown(s, {}).split('\n').find((l) => l.includes('снят:'));

  assert.ok(line, 'снятый тариф вообще не попал в тело');
  assert.equal((line.match(/`/g) || []).length, 2, 'кодовый спан разомкнут — имя вырвалось в разметку');
  assert.doesNotMatch(line, /\n/);
  assert.doesNotMatch(line, /^#/m);

  // A name long enough to push the numbers off the screen hides them just as
  // effectively as markup does.
  const long = classify({
    cacheAfter: { countries: [] },
    catalogueBefore: [{ ...evil, name: 'x'.repeat(500) }],
    catalogueAfter: [],
  });
  assert.ok(long.plans.removed[0].name.length <= 120);
});

test('no Actions expression is expanded inside a shell command', () => {
  // The standard injection shape. Harmless with today\'s values — three literals
  // this repo produces — and the reason to forbid it anyway is that the rule has
  // to hold when the value is somebody else\'s.
  // Walked line by line on INDENTATION rather than matched with one regex over
  // the whole file: the first version of this test used a lazy `[\s\S]*?` with a
  // lookahead for the next step, and a mutation that put the expression straight
  // back into the `gh pr comment` line walked past it. A block scanner cannot
  // miss a line that is inside the block.
  const lines = WF_CODE.split('\n');
  let runIndent = null;
  const offenders = [];
  for (const line of lines) {
    const indent = line.length - line.trimStart().length;
    if (runIndent !== null && line.trim() && indent <= runIndent) runIndent = null;
    if (runIndent !== null && line.includes('${{')) offenders.push(line.trim());
    if (/^\s*run: \|/.test(line)) runIndent = indent;
  }
  assert.deepEqual(offenders, [], 'выражение ${{ }} подставлено внутрь run:');
  assert.match(WF, /env:\n\s+RISK: \$\{\{ steps\.summary\.outputs\.risk \}\}/);
});

test('M3: the success guard is on the job\'s if:, not in a comment', () => {
  // Asserted against WF (comments included), the guard could be demoted to a
  // comment and `if: always()` put in its place with the test still green.
  const line = WF_CODE.split('\n').find((l) => /^\s{4}if:/.test(l));
  assert.ok(line, 'у job нет if:');
  assert.match(line, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.doesNotMatch(line, /always\(\)/);
});

test('actions are pinned by commit, not by a movable tag', () => {
  for (const st of STEPS.filter((x) => x.uses)) {
    assert.match(st.uses, /@[0-9a-f]{40}/, `${st.uses} закреплён тегом`);
  }
});

/* ================================================================== *
 * N. The no-op sync: an identical tree must not be force-pushed
 *
 * Measured 2026-09-16: while PR #3 was open, a catalogue job that had nothing
 * to commit still moved the branch 5615090 -> 3f5f88b with tree 862913c89707
 * on both sides. A force-push dismisses review approvals, so «review now,
 * merge later» silently stopped meaning anything on that PR.
 * ================================================================== */

const SHA = (c) => c.repeat(40);

test('N: an identical tree on the current main is not rewritten', () => {
  const tree = SHA('a'), main = SHA('c');
  const d = pushDecision({ branchExists: true, stagedTree: tree, remoteTree: tree,
                           remoteBase: main, mainSha: main });
  assert.equal(d.push, false);
  assert.match(d.reason, /переписывать нечего/);
});

test('N: a REAL catalogue change still pushes — the fix may not suppress that', () => {
  const main = SHA('c');
  // The whole point: the only thing that changed is the content.
  const d = pushDecision({ branchExists: true, stagedTree: SHA('a'), remoteTree: SHA('b'),
                           remoteBase: main, mainSha: main });
  assert.equal(d.push, true);
  assert.match(d.reason, /содержимое отличается/);
});

test('N: same tree but a stale base is rebuilt, because the PR diff is against that base', () => {
  const tree = SHA('a');
  const d = pushDecision({ branchExists: true, stagedTree: tree, remoteTree: tree,
                           remoteBase: SHA('b'), mainSha: SHA('c') });
  assert.equal(d.push, true);
  assert.match(d.reason, /не от текущего main/);
});

test('N: no branch means create it, never skip', () => {
  assert.equal(pushDecision({ branchExists: false }).push, true);
  assert.equal(pushDecision({}).push, true);
});

test('N: fail-closed here means PUSH — every unusable input keeps the old behaviour', () => {
  const tree = SHA('a'), main = SHA('c');
  const base = { branchExists: true, stagedTree: tree, remoteTree: tree, remoteBase: main, mainSha: main };
  assert.equal(pushDecision(base).push, false, 'baseline must be the skip case');
  // Each field, one at a time, made unusable. Every one must flip to push —
  // otherwise a blank variable in the workflow would read as «nothing to do»
  // and quietly strand a stale pull request in front of a reviewer.
  for (const field of ['stagedTree', 'remoteTree', 'remoteBase', 'mainSha']) {
    for (const bad of ['', '   ', 'HEAD', 'abc123', undefined, null, 42, SHA('a').toUpperCase()]) {
      const d = pushDecision({ ...base, [field]: bad });
      assert.equal(d.push, true, `${field}=${JSON.stringify(bad)} должно приводить к push`);
    }
  }
});

test('N: the workflow asks the tested function, and skips BEFORE committing', () => {
  const branch = code(stepByName('Ветка').run);
  const call = branch.indexOf('scripts/seo-refresh-should-push.mjs');
  const commit = branch.indexOf('git commit');
  const push = branch.indexOf('git push');
  const skip = branch.indexOf('if [ "$verdict" = "skip" ]');
  assert.ok(call > 0, 'шаг «Ветка» не спрашивает решение');
  assert.ok(skip > call, 'решение должно читаться до ветвления');
  assert.ok(skip < commit && skip < push, 'выход по skip обязан быть ДО commit и push');
  assert.ok(branch.slice(skip, commit).includes('exit 0'), 'ветка skip обязана завершать шаг');

  // The guards this fix must not step over: all of them still run first.
  const paths = branch.indexOf('seo-refresh-check-paths.mjs');
  const foreign = branch.indexOf('ОСТАНОВ: на ветке есть коммиты не этой автоматики');
  const lease = branch.indexOf('--force-with-lease');
  assert.ok(paths > 0 && paths < call, 'аллоулист путей должен проверяться до решения');
  assert.ok(foreign > 0 && foreign < call, 'проверка чужих коммитов должна быть до решения');
  assert.ok(lease > 0, 'лиза не должна исчезнуть');
  // The lease is ASSIGNED above the decision — that is where it belongs, since it
  // is pinned to the sha just inspected. What must sit after the skip is the push
  // that carries it. Asserting on the assignment's position was my own error and
  // would have passed a workflow that pushed before deciding.
  assert.ok(lease < skip, 'лиза вычисляется до решения, вместе с осмотром ветки');
  assert.ok(branch.slice(push).includes('$lease'), 'push обязан нести лизу');
  assert.ok(push > skip, 'сам push остаётся на пути реального изменения');
});

test('N: a no-op does not rewrite the PR body or comment on it either', () => {
  const pr = code(stepByName('Pull request').run);
  const existing = pr.indexOf('existing=$(gh pr list');
  const guard = pr.indexOf('"${NOOP:-}" = "true"');
  const body = pr.indexOf('>> /tmp/seo-summary/summary.md');
  const edit = pr.indexOf('gh pr edit');
  const comment = pr.indexOf('gh pr comment');
  assert.ok(existing > 0 && guard > existing, 'о наличии PR надо узнать до проверки no-op');
  assert.ok(guard < body, 'тело не должно дописываться на холостом прогоне');
  assert.ok(guard < edit && guard < comment, 'ни edit, ни comment на холостом прогоне');
  assert.ok(pr.slice(guard, body).includes('exit 0'), 'холостой прогон обязан выйти');
  // …but a no-op with NO open pull request must still open one: the branch
  // carries the right tree and nobody can see it.
  assert.match(pr, /\[ -n "\$existing" \]/, 'решение обязано зависеть от наличия PR');
  assert.ok(pr.indexOf('gh pr create') > guard, 'создание PR остаётся доступным после guard');
});

test('N: the workflow passes every field the decision needs', () => {
  const branch = code(stepByName('Ветка').run);
  for (const flag of ['--branch-exists', '--staged-tree', '--remote-tree', '--remote-base', '--main']) {
    assert.ok(branch.includes(flag), `в вызов не передан ${flag}`);
  }
  assert.match(branch, /staged_tree=\$\(git write-tree\)/,
    'дерево будущего коммита должно браться из write-tree, а не угадываться');
  assert.match(branch, /refs\/remotes\/origin\/\$BRANCH\^\{tree\}/,
    'дерево ветки должно читаться у самой ветки');
  assert.match(code(WF), /NOOP: \$\{\{ steps\.branch\.outputs\.noop \}\}/,
    'шаг PR должен получать решение шага «Ветка»');
});

/* ================================================================== *
 * N2. The same decision against a REAL repository.
 *
 * Everything above tests the rule with made-up shas. The rule rests on one
 * claim about git that no amount of unit testing can check: that
 * `git write-tree` of the staged index is the tree the next commit would
 * carry, and therefore comparable with the branch head's tree. If that is
 * false, the fix either never skips (harmless) or skips when it should not
 * (a stale pull request in front of a reviewer). So it is exercised here on
 * an actual repository, not asserted.
 * ================================================================== */

test('N2: on a real repo, an unchanged regeneration produces the branch\'s own tree', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seo-noop-'));
  const git = (...a) => execFileSync('git', ['-C', dir,
    '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a],
    { encoding: 'utf8' }).trim();
  try {
    git('init', '-q', '-b', 'main');
    mkdirSync(join(dir, 'seo'));
    writeFileSync(join(dir, 'seo/fact-sheets.json'), '{"fetched_at":"old"}\n');
    writeFileSync(join(dir, 'untracked-by-us.txt'), 'not ours\n');
    git('add', '-A'); git('commit', '-qm', 'main');
    const main = git('rev-parse', 'HEAD');

    // The automation's first run: regenerate, stage only allowed paths, commit.
    writeFileSync(join(dir, 'seo/fact-sheets.json'), '{"fetched_at":"new"}\n');
    git('checkout', '-q', '-B', 'automation');
    git('add', '--', 'seo/fact-sheets.json');
    git('commit', '-qm', 'chore(seo): refresh pages after catalogue update');
    const branchHead = git('rev-parse', 'HEAD');
    const branchTree = git('rev-parse', 'HEAD^{tree}');

    // The next run, catalogue unmoved: back to main, regenerate the SAME bytes,
    // stage the same path, and ask what the commit WOULD be — without making one.
    git('checkout', '-q', main);
    writeFileSync(join(dir, 'seo/fact-sheets.json'), '{"fetched_at":"new"}\n');
    git('checkout', '-q', '-B', 'automation-retry', main);
    git('add', '--', 'seo/fact-sheets.json');
    const stagedTree = git('write-tree');

    assert.equal(stagedTree, branchTree,
      'write-tree индекса обязан совпасть с деревом коммита ветки — на этом держится весь фикс');
    const base = git('merge-base', 'main', branchHead);
    assert.equal(base, main, 'ветка собрана от main');

    assert.equal(pushDecision({ branchExists: true, stagedTree, remoteTree: branchTree,
                                remoteBase: base, mainSha: main }).push, false);

    // Now a real catalogue change: one byte, and the decision must flip.
    writeFileSync(join(dir, 'seo/fact-sheets.json'), '{"fetched_at":"newer"}\n');
    git('add', '--', 'seo/fact-sheets.json');
    const movedTree = git('write-tree');
    assert.notEqual(movedTree, branchTree);
    assert.equal(pushDecision({ branchExists: true, stagedTree: movedTree, remoteTree: branchTree,
                                remoteBase: base, mainSha: main }).push, true);

    // And main moving under an unchanged tree must also flip it, because the
    // pull request's diff is computed against the merge-base.
    writeFileSync(join(dir, 'unrelated.txt'), 'someone else pushed\n');
    git('checkout', '-q', 'main'); git('add', '-A'); git('commit', '-qm', 'other work');
    const newMain = git('rev-parse', 'HEAD');
    assert.equal(pushDecision({ branchExists: true, stagedTree: branchTree, remoteTree: branchTree,
                                remoteBase: base, mainSha: newMain }).push, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
