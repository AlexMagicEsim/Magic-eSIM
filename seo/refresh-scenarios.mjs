// What the SEO refresh does when the catalogue moves — run for real.
//
// Each scenario copies the repository to a temp directory (no node_modules,
// no .git, no symlinks), changes assets/catalog.json the way a provider sync
// would, runs node seo/build-all.mjs there — exactly what
// .github/workflows/seo-refresh-pr.yml does — and then the storefront's own
// corpus gates (the same test files `npm test` runs, by name, without their
// slow self-mutation tests). seo/test-refresh-scenarios.mjs pins the outcome of
// each: which gates stay green, which go red and with what message.
//
// The fixtures are chosen from the profiles and from WORLD — the frozen
// catalogue test/fixtures/seo-test-catalogue.json, in which every authored claim
// holds (pinned in seo/test-coverage-claims.mjs). Every scenario starts from it,
// not from assets/catalog.json. 2026-11-03: the live snapshot moves every slot
// since the auto-import went live, and one sentence it made false today (the
// Philippines «180 дн») turned the control and with it every scenario red — the
// sentence itself is the business of the corpus gates on the live snapshot
// (`npm test`), which still catch it. A fixture that disappears (a claim
// renamed) fails loudly with the name to re-point.

import { republish } from './fixture-layout.mjs';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, lstatSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
// The catalogue every scenario starts from (see the header).
export const WORLD_FILE = join(ROOT, 'test', 'fixtures', 'seo-test-catalogue.json');

export const GATE_FILES = Object.freeze([
  'seo/test-price-claims.mjs',
  'seo/test-coverage-claims.mjs',
  'seo/test-profile-catalogue.mjs',
  'seo/test-catalogue-sync.mjs',
  'seo/test-generated-prices.mjs',
  'seo/test-price-inventory.mjs',
]);
// The corpus-level tests of those files (their MUTATION/self tests and the slow
// C4b mirror, which runs the generator again, are left to `npm test`).
export const GATE_PATTERN = '^(C1|C2|C3|C4b: no page|C5|the corpus|every |no coverage sentence|no NEW|the baseline|the check is not vacuous)';

// Inside `node --test` the child would inherit NODE_TEST_CONTEXT and talk the
// parent's internal protocol instead of TAP — drop it.
const childEnv = () => { const e = { ...process.env }; delete e.NODE_TEST_CONTEXT; return e; };

const run = (cmd, args, cwd, timeout = 240000) => new Promise((resolve) => {
  execFile(cmd, args, { cwd, timeout, maxBuffer: 64 * 1024 * 1024, env: childEnv() },
    (err, stdout, stderr) => resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout: String(stdout), stderr: String(stderr) }));
});

export function copyRepo(root = ROOT) {
  const dir = mkdtempSync(join(tmpdir(), 'seo-scn-'));
  cpSync(root, dir, {
    recursive: true,
    filter: (src) => {
      const b = basename(src);
      if (b === 'node_modules' || b === '.git') return false;
      try { return !lstatSync(src).isSymbolicLink(); } catch { return false; }
    },
  });
  return dir;
}

/** TAP → [{ name, ok, detail }] for the top-level tests. */
export function parseTap(tap) {
  const out = [];
  const lines = String(tap).split('\n');
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^(ok|not ok) \d+ - (.*?)(?: # .*)?$/);
    if (m) { cur = { name: m[2], ok: m[1] === 'ok', detail: '' }; out.push(cur); continue; }
    if (cur && !cur.ok) cur.detail += line + '\n';
  }
  return out;
}

export const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

/**
 * Run one scenario. `mutate(doc, ctx)` edits the catalogue document in place;
 * ctx = { dir, profile(slug) }.
 * @returns {Promise<{ build, tests, failing: string[], info, inspected, gatesRan }>}
 */
export async function runScenario(mutate, { keep = false, inspect = null } = {}) {
  const dir = copyRepo();
  try {
    const file = join(dir, 'assets', 'catalog.json');
    writeFileSync(file, readFileSync(WORLD_FILE));
    const doc = readJson(file);
    const before = readJson(file);
    const ctx = { dir, profile: (slug) => readJson(join(dir, 'seo', 'content-profiles', `${slug}.json`)) };
    const info = mutate(doc, ctx) || {};
    // The provider moved; the backend lays the pages out again (a withdrawn plan
    // leaves them, a new one appears where it covers) — the snapshot carries that
    // layout, and every authored claim is read through it (seo/plan-ref.mjs).
    if (!info.keepLayout) doc.assortment = republish(before, doc.packages).assortment;
    // The bot writes the count with the packages; a snapshot whose count does
    // not match is refused by every gate (coverage-claims validateCatalog).
    doc.package_count = doc.packages.length;
    writeFileSync(file, JSON.stringify(doc));
    const build = await run(process.execPath, ['seo/build-all.mjs'], dir);
    const gates = await run(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap', `--test-name-pattern=${GATE_PATTERN}`, ...GATE_FILES], dir);
    const tests = parseTap(gates.stdout);
    const pageOf = (slug) => { const f = join(dir, 'esim', slug, 'index.html'); return existsSync(f) ? readFileSync(f, 'utf8') : null; };
    const inspected = inspect ? inspect({ dir, pageOf, doc, info }) : null;
    const suppressedFile = join(dir, 'seo', 'suppressed-claims.json');
    const suppressed = existsSync(suppressedFile) ? readJson(suppressedFile).entries : [];
    return { build: { code: build.code, stderr: build.stderr.slice(-2000) }, tests, failing: tests.filter((t) => !t.ok).map((t) => t.name).sort(), info, inspected, gatesRan: tests.length, suppressed };
  } finally {
    if (!keep) rmSync(dir, { recursive: true, force: true });
  }
}

/** Run scenarios a few at a time. */
export async function runAll(list, concurrency = 3) {
  const out = new Array(list.length);
  let i = 0;
  const worker = async () => { while (i < list.length) { const k = i++; out[k] = await list[k](); } };
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  return out;
}

export const countryPageSlugs = (root = ROOT) => readdirSync(join(root, 'esim')).filter((d) => existsSync(join(root, 'esim', d, 'index.html')));
