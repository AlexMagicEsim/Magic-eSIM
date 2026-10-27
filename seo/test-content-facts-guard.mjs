/* A new USD plan-facts snapshot is never published over an authored sentence it contradicts (2026-10-27).
 *
 * «Refresh static catalog cache» writes seo/global-plan-facts.json and pushes it to main with GITHUB_TOKEN — no CI runs
 * on that push. Authored country texts pin their plan-block sentences to the snapshot (`plan_claims`), and the page
 * build throws on a contradiction. These tests hold that scripts/update-global-plan-facts.mjs:
 *   1. checks every authored text against the NEW snapshot before writing it (seo/content-facts-guard.mjs);
 *   2. on a contradiction keeps the previous file, exits 0, warns, and writes a report naming the file, the sentence,
 *      the claim, what moved and the kept snapshot's date and age — again on every run while the conflict lasts;
 *   3. writes a snapshot that contradicts nothing exactly as before;
 *   4. finds a content validator per language (not only English);
 * and that the workflow still commits the Russian catalogue whatever the facts step decides.
 *
 * Run: node --test seo/test-content-facts-guard.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { buildFacts, runUpdate } from '../scripts/update-global-plan-facts.mjs';
import { contentValidators, checkFactsAgainstContent, factsDiff } from './content-facts-guard.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const FACTS = JSON.parse(read('seo/global-plan-facts.json'));
const clone = (x) => JSON.parse(JSON.stringify(x));

/* A USD catalogue answer whose derived facts are exactly `facts` (buildFacts(answerFrom(f)).countries == f.countries). */
function answerFrom(facts) {
  const data = [];
  const countries = {};
  let n = 0;
  const id = () => `p${(n += 1)}`;
  for (const [iso, f] of Object.entries(facts.countries)) {
    const layout = { local: [], regional: [], daily: [] };
    for (const gb of f.local.gb) { const i = id(); data.push({ package_id: i, data_gb: gb, validity_days: f.local.days[0], coverage_country_codes: [iso] }); layout.local.push(i); }
    for (const d of f.local.days) { const i = id(); data.push({ package_id: i, data_gb: f.local.gb[0], validity_days: d, coverage_country_codes: [iso] }); layout.local.push(i); }
    // regional package j covers the first N-j codes, so the code ranked k is counted N-k times: the ranking is kept
    const N = f.also.length;
    for (let j = 0; j < N; j += 1) { const i = id(); data.push({ package_id: i, coverage_country_codes: [iso, ...f.also.slice(0, N - j)] }); layout.regional.push(i); }
    for (const gb of f.daily.gb_per_day) { const i = id(); data.push({ package_id: i, daily_gb: gb, sellable_days: f.daily.days, coverage_country_codes: [iso] }); layout.daily.push(i); }
    countries[iso] = layout;
  }
  return { currency: 'USD', data, assortment: { countries } };
}
const serve = (facts) => async () => ({ status: 200, text: async () => JSON.stringify(answerFrom(facts)) });

/* The falsifying change: a destination an authored English sentence names leaves its country's regional plans. */
const TH_CLAIM = JSON.parse(read('seo/content-en/thailand.json')).plan_claims.find((c) => c.kind === 'regional_also' && c.codes.includes('MY'));
function falsified() {
  const f = clone(FACTS);
  f.countries.TH.also = f.countries.TH.also.filter((c) => c !== 'MY');
  return f;
}

/* Capture what the script prints (the ::warning:: annotations). */
async function capture(fn) {
  const lines = [];
  const orig = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  try { return { result: await fn(), out: lines.join('\n') }; } finally { console.log = orig; }
}

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'gpf-guard-'));
  const file = join(dir, 'facts.json');
  const summary = join(dir, 'summary.md');
  const kept = { ...clone(FACTS), updated: '2026-10-01' };
  writeFileSync(file, `${JSON.stringify(kept, null, 1)}\n`);
  return { dir, file, summary, before: readFileSync(file, 'utf8'), done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('the fixture answer reproduces the committed facts exactly (so the tests below change one fact and nothing else)', () => {
  assert.deepEqual(buildFacts(answerFrom(FACTS)).countries, FACTS.countries);
  assert.ok(TH_CLAIM, 'thailand.json names Malaysia in a regional_also claim — the fixture needs one');
  assert.ok(FACTS.countries.TH.also.includes('MY'));
});

test('the committed content holds against the committed facts, and English is discovered', async () => {
  const v = await contentValidators();
  assert.ok(v.some((x) => x.lang === 'en' && x.folder === 'seo/content-en'), 'the English validator is found');
  assert.deepEqual(await checkFactsAgainstContent(FACTS, FACTS), []);
});

test('a snapshot that falsifies a published sentence is NOT written; the report names the file, sentence, claim and move', async () => {
  const s = sandbox();
  try {
    const { result, out } = await capture(() => runUpdate({ fetchImpl: serve(falsified()), today: '2026-10-28', file: s.file, summaryFile: s.summary }));
    assert.equal(result, 0, 'never blocks the Russian refresh');
    assert.equal(readFileSync(s.file, 'utf8'), s.before, 'the previous snapshot stays, byte for byte');
    assert.match(out, /::warning::.*contradict authored plan_claims.*NOT published.*kept snapshot dated 2026-10-01.*seo\/content-en\/thailand\.json/);
    const report = readFileSync(s.summary, 'utf8');
    assert.ok(report.includes('`seo/content-en/thailand.json`'), 'the file');
    assert.ok(report.includes(`«${TH_CLAIM.quote}»`), 'the sentence');
    assert.match(report, /plan_claims\[\d+\]: MY is not among the destinations TH's regional plans also cover/, 'the claim');
    assert.match(report, /TH `also`: dropped MY; added —/, 'old fact vs new fact');
    assert.match(report, /Countries whose facts moved in this snapshot \(1\): TH\./);
    assert.match(report, /dated \*\*2026-10-01\*\*, \*\*27 day\(s\) old\*\*/, 'the kept snapshot\'s age');
  } finally { s.done(); }
});

test('negative control: without the guard (the old behaviour) the same snapshot passes validateFacts and IS written', async () => {
  const s = sandbox();
  try {
    await capture(() => runUpdate({ fetchImpl: serve(falsified()), today: '2026-10-28', file: s.file, summaryFile: s.summary, validators: [] }));
    const written = JSON.parse(readFileSync(s.file, 'utf8'));
    assert.equal(written.updated, '2026-10-28');
    assert.equal(written.countries.TH.also.includes('MY'), false, 'the falsifying fact would have been published');
    assert.equal(existsSync(s.summary), false);
  } finally { s.done(); }
});

test('a kept-old snapshot is flagged on EVERY run while the conflict lasts, with its growing age', async () => {
  const s = sandbox();
  try {
    for (const today of ['2026-10-28', '2026-10-29', '2026-11-05']) {
      const { out } = await capture(() => runUpdate({ fetchImpl: serve(falsified()), today, file: s.file, summaryFile: s.summary }));
      assert.match(out, /::warning::.*kept snapshot dated 2026-10-01/, `${today}: the annotation repeats`);
    }
    const report = readFileSync(s.summary, 'utf8');
    assert.equal(report.match(/NOT published/g).length, 3, 'one report per run');
    for (const age of [27, 28, 35]) assert.ok(report.includes(`**${age} day(s) old**`), `age ${age}`);
    assert.equal(readFileSync(s.file, 'utf8'), s.before);
  } finally { s.done(); }
});

test('a snapshot that contradicts nothing is written as before', async () => {
  const s = sandbox();
  try {
    const next = clone(FACTS);
    next.countries.TH.local.gb = [...new Set([...next.countries.TH.local.gb, 777])].sort((a, b) => a - b); // a new volume: no sentence names one
    const { result, out } = await capture(() => runUpdate({ fetchImpl: serve(next), today: '2026-10-28', file: s.file, summaryFile: s.summary }));
    assert.equal(result, 0);
    assert.doesNotMatch(out, /::warning::/);
    const written = JSON.parse(readFileSync(s.file, 'utf8'));
    assert.equal(written.updated, '2026-10-28');
    assert.ok(written.countries.TH.local.gb.includes(777));
    assert.equal(existsSync(s.summary), false, 'no report when nothing conflicts');
  } finally { s.done(); }
});

test('a guard that cannot run keeps the previous snapshot — an unconfirmed fact is never published', async () => {
  const s = sandbox();
  try {
    const broken = [{ lang: 'xx', folder: 'seo/content-xx', dir: s.dir, mod: { contentSlugs: () => { throw new Error('boom'); } } }];
    const next = clone(FACTS);
    next.countries.TH.local.gb = [...next.countries.TH.local.gb, 777].sort((a, b) => a - b);
    const { result, out } = await capture(() => runUpdate({ fetchImpl: serve(next), today: '2026-10-28', file: s.file, summaryFile: s.summary, validators: broken }));
    assert.equal(result, 0);
    assert.equal(readFileSync(s.file, 'utf8'), s.before);
    assert.match(out, /::warning::.*boom/);
    assert.match(readFileSync(s.summary, 'utf8'), /could not run — snapshot NOT published/);
  } finally { s.done(); }
});

test('only the conflicts the NEW facts cause are reported (a defect unrelated to the facts is not blamed on the catalogue)', async () => {
  const fake = (problemsFor) => [{ lang: 'xx', folder: 'seo/content-xx', dir: '/nowhere', mod: {
    contentSlugs: () => ['a'], loadContent: () => ({ iso: 'TH', plan_claims: [{ quote: 'Q' }] }),
    validateContent: (doc, { facts }) => problemsFor(facts),
  } }];
  const always = fake(() => ['sources[0].checked: 2099-01-01 is in the future']);
  assert.deepEqual(await checkFactsAgainstContent(FACTS, falsified(), { validators: always }), []);
  const caused = fake((f) => (f.countries.TH.also.includes('MY') ? [] : ['plan_claims[0]: MY is not among …']));
  const [c] = await checkFactsAgainstContent(FACTS, falsified(), { validators: caused });
  assert.deepEqual(c.problems, [{ problem: 'plan_claims[0]: MY is not among …', quote: 'Q' }]);
  assert.equal(c.file, 'seo/content-xx/a.json');
  // no previous snapshot: everything counts
  assert.equal((await checkFactsAgainstContent(null, falsified(), { validators: always })).length, 1);
});

test('language-agnostic: a content-<prefix>.mjs + content-<prefix>/ pair of any published language is discovered and checked', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gpf-seo-'));
  try {
    mkdirSync(join(dir, 'content-es'));
    writeFileSync(join(dir, 'content-es', 'tailandia.json'), '{}');
    writeFileSync(join(dir, 'content-es.mjs'), `
      export const contentSlugs = () => ['tailandia'];
      export const loadContent = () => ({ iso: 'TH', plan_claims: [{ quote: 'Los planes regionales también cubren Malasia.' }] });
      export const validateContent = (doc, { facts }) => (facts.countries.TH.also.includes('MY') ? [] : ['plan_claims[0]: MY is not among the destinations']);
    `);
    // a module without its folder, or a folder without its module, is not a validator
    writeFileSync(join(dir, 'content-de.mjs'), 'export const contentSlugs = () => []; export const loadContent = () => null; export const validateContent = () => [];');
    mkdirSync(join(dir, 'content-fr'));
    const v = await contentValidators({ seoDir: dir });
    assert.deepEqual(v.map((x) => x.lang), ['es']);
    // a module that does not keep the contract fails closed (the caller then keeps the previous snapshot)
    writeFileSync(join(dir, 'content-ko.mjs'), 'export const contentSlugs = () => [];');
    await assert.rejects(contentValidators({ seoDir: dir }), /content-ko\.mjs: a content validator exports/);
    const [c] = await checkFactsAgainstContent(FACTS, falsified(), { validators: v });
    assert.equal(c.lang, 'es');
    assert.equal(c.file, 'seo/content-es/tailandia.json');
    assert.equal(c.problems[0].quote, 'Los planes regionales también cubren Malasia.');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('factsDiff names what moved per country and field', () => {
  const d = factsDiff(FACTS, falsified());
  assert.deepEqual(Object.keys(d), ['TH']);
  assert.deepEqual(d.TH, { also: { removed: ['MY'], added: [] } });
});

test('the workflow commits the Russian catalogue whatever the facts step decides', () => {
  const wf = read('.github/workflows/refresh-catalog-cache.yml');
  const code = wf.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const step = code.slice(code.indexOf('- name: Refresh global plan facts'), code.indexOf('- name: Commit if changed'));
  // the guard lives inside the script, whose update mode always exits 0; no separate content check in the step that
  // could exit 1 and skip the commit
  assert.deepEqual(step.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('node ')),
    ['node scripts/update-global-plan-facts.mjs', 'node scripts/update-global-plan-facts.mjs --check']);
  assert.doesNotMatch(step, /content-en\.mjs|content-facts-guard/);
  assert.doesNotMatch(code, /continue-on-error/);
  // the commit step is the next step and decides on the catalogue on its own: a kept facts file is simply «no diff»
  const commit = code.slice(code.indexOf('- name: Commit if changed'));
  assert.match(commit, /git diff --quiet -- assets\/catalog\.json seo\/global-plan-facts\.json/);
  assert.match(commit, /git add assets\/catalog\.json seo\/global-plan-facts\.json\n/);
  assert.ok(code.indexOf('- name: Refresh global plan facts') > code.indexOf('- name: SEO coverage facts still hold'), 'after every RU guard');
  // the script's update path has no exit other than runUpdate's 0
  const script = read('scripts/update-global-plan-facts.mjs');
  assert.match(script, /process\.exit\(process\.argv\.includes\('--check'\) \? runCheck\(\) : await runUpdate\(\)\)/);
  assert.doesNotMatch(script.slice(script.indexOf('export async function runUpdate'), script.indexOf('function runCheck')), /return [1-9]|process\.exit|throw /);
});
