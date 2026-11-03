// scripts/ci-pages-catalogue.mjs — CI tests the committed pages on the catalogue
// they were built from; the SEO refresh tests today's. Each case runs in a
// throwaway git repository.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { locate, restore, report, pagesProvenance } from '../scripts/ci-pages-catalogue.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOT = ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com'];
const HUMAN = ['-c', 'user.name=someone', '-c', 'user.email=someone@example.com'];

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'pages-cat-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  for (const d of ['assets', 'seo']) mkdirSync(join(dir, d));
  const put = (f, v) => writeFileSync(join(dir, f), typeof v === 'string' ? v : JSON.stringify(v, null, 2));
  const catalogue = (at, n) => { put('assets/catalog.json', { schema_version: 1, generated_at: at, package_count: n, packages: [] }); put('seo/global-plan-facts.json', { updated: at.slice(0, 10), n }); };
  const pages = (at) => { put('seo/catalogue-countries.json', { fetched_at: at, countries: [] }); put('seo/fact-sheets.json', { fetched_at: at, sheets: {} }); put('esim.html', `<p>${at}</p>`); };
  const commit = (who, msg) => { git('add', '-A'); git(...who, 'commit', '-q', '-m', msg); return git('rev-parse', 'HEAD').trim(); };
  return { dir, git, put, catalogue, pages, commit, done: () => rmSync(dir, { recursive: true, force: true }) };
}
const A = '2026-10-31T05:55:31.430Z';
const B = '2026-11-02T16:07:45.098Z';
const C = '2026-11-03T02:58:35.752Z';

test('pages and catalogue a pair: nothing to do', () => {
  const r = repo();
  try {
    r.catalogue(A, 1); r.pages(A); r.commit(HUMAN, 'seo: pages');
    assert.deepEqual(locate(r.dir), { consistent: true, at: A });
    assert.match(report(locate(r.dir)), /согласованы/);
  } finally { r.done(); }
});

test('the bot moved the catalogue twice: the pages\' snapshot is found and put back, the report counts the refreshes', () => {
  const r = repo();
  try {
    r.catalogue(A, 1); r.pages(A); const built = r.commit(HUMAN, 'seo: pages');
    r.catalogue(B, 2); r.commit(BOT, 'chore: refresh static catalog cache (2 packages)');
    r.catalogue(C, 3); r.commit(BOT, 'chore: refresh static catalog cache (3 packages)');
    const got = locate(r.dir);
    assert.equal(got.consistent, false);
    assert.equal(got.commit, built);
    assert.equal(got.current, C);
    assert.equal(got.behind.length, 2);
    restore(r.dir, got.commit);
    assert.equal(JSON.parse(readFileSync(join(r.dir, 'assets/catalog.json'), 'utf8')).generated_at, A);
    assert.equal(JSON.parse(readFileSync(join(r.dir, 'seo/global-plan-facts.json'), 'utf8')).n, 1, 'the global facts of the same commit');
    assert.deepEqual(locate(r.dir), { consistent: true, at: A }, 'after the restore the tree is a pair');
    assert.match(report(got), /новее на 2 обновления бота/);
    assert.match(report(got), /SEO refresh PR/, 'the report names who checks today\'s catalogue');
  } finally { r.done(); }
});

test('a person\'s commit that changed the catalogue without rebuilding the pages is refused, not restored over', () => {
  const r = repo();
  try {
    r.catalogue(A, 1); r.pages(A); r.commit(HUMAN, 'seo: pages');
    r.catalogue(B, 2); r.commit(HUMAN, 'chore: refresh static catalog cache (2 packages)');
    assert.throws(() => locate(r.dir), /is not the catalogue bot's refresh/);
  } finally { r.done(); }
});

test('a bot-looking commit that touched anything else is refused', () => {
  const r = repo();
  try {
    r.catalogue(A, 1); r.pages(A); r.commit(HUMAN, 'seo: pages');
    r.catalogue(B, 2); r.put('esim.html', '<p>edited</p>'); r.commit(BOT, 'chore: refresh static catalog cache (2 packages)');
    assert.throws(() => locate(r.dir), /also touched esim\.html/);
  } finally { r.done(); }
});

test('a bot commit with another subject is refused', () => {
  const r = repo();
  try {
    r.catalogue(A, 1); r.pages(A); r.commit(HUMAN, 'seo: pages');
    r.catalogue(B, 2); r.commit(BOT, 'chore(seo): refresh pages after catalogue update');
    assert.throws(() => locate(r.dir), /is not the catalogue bot's refresh/);
  } finally { r.done(); }
});

test('generated files that disagree on their catalogue, or a snapshot the history lacks, stop the job', () => {
  const r = repo();
  try {
    r.catalogue(A, 1); r.pages(A); r.put('seo/fact-sheets.json', { fetched_at: B, sheets: {} }); r.commit(HUMAN, 'seo: pages');
    assert.throws(() => pagesProvenance(r.dir), /disagree/);
    r.pages(B); r.catalogue(C, 3); r.commit(HUMAN, 'pages built from a catalogue never committed');
    assert.throws(() => locate(r.dir), /no commit in this history wrote the pages' catalogue/);
  } finally { r.done(); }
});

// ---------------------------------------------------------------- wiring

const wf = (f) => readFileSync(join(ROOT, '.github', 'workflows', f), 'utf8').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const job = (text, name) => { const i = text.indexOf(`\n  ${name}:\n`); assert.ok(i >= 0, `job ${name}`); const rest = text.slice(i + 1); const j = rest.slice(1).search(/\n {2}[a-z][\w-]*:\n/); return j < 0 ? rest : rest.slice(0, j + 1); };

test('tests.yml: the unit and browser jobs pair the pages with their catalogue BEFORE testing, on a full history', () => {
  const t = wf('tests.yml');
  for (const [name, run] of [['unit', 'npm test'], ['browser', 'npx playwright test']]) {
    const j = job(t, name);
    assert.match(j, /fetch-depth: 0/, `${name}: the catalogue's history`);
    const pin = j.indexOf('node scripts/ci-pages-catalogue.mjs');
    assert.ok(pin > 0, `${name}: runs the script`);
    assert.ok(pin < j.indexOf(run), `${name}: before «${run}»`);
    assert.doesNotMatch(j.slice(pin, j.indexOf('\n', pin)), /--dry-run|\|\||continue-on-error/, `${name}: a refusal stops the job`);
  }
});

test('the SEO refresh and the catalogue refresh never use it: they test TODAY\'s catalogue', () => {
  for (const f of ['seo-refresh-pr.yml', 'refresh-catalog-cache.yml', 'deploy-pages.yml']) {
    assert.doesNotMatch(wf(f), /ci-pages-catalogue/, f);
  }
});
