// The browser suite in tests.yml runs in parallel shards, and the browsers are installed with a bounded retry
// (2026-10-22: one job reached ~20 min with 1320 tests, and a stalled Ubuntu mirror cut it at its 25-min limit
// before or during the tests — with no failing test). These rules keep the split HONEST:
//   - every shard runs `npx playwright test --shard=<i>/<total>` with the total taken from the matrix itself, and no
//     filter (no --grep / --project / --last-failed / --only-changed), so the shards together are the whole suite;
//   - fail-fast is off, so one red shard never cancels (hides) the other;
//   - one aggregate job reads `needs.browser.result` and is green ONLY on «success» — a failed, cancelled or skipped
//     shard turns it red; it runs `always()`, so it reports even then;
//   - both browser jobs run in Microsoft's Playwright image of the lockfile's @playwright/test version, pinned by
//     digest, and nothing downloads browsers: a timed, retried download was tried first (2026-10-22) and stalled on
//     4 of 6 runners for all three attempts — the same runner kept the same slow Ubuntu mirror.
// Read from the workflow TEXT: the unit job runs without dependencies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = readFileSync(join(ROOT, '.github/workflows/tests.yml'), 'utf8');

/** The text of one top-level job (from `  <id>:` to the next job). */
export function jobText(text, id) {
  const start = text.indexOf(`\n  ${id}:\n`);
  if (start < 0) return null;
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
  return next < 0 ? rest : rest.slice(0, next + 2);
}

/** Problems with the sharded browser job + its aggregate; [] when the shape is right. */
export function shardProblems(text) {
  const out = [];
  const job = jobText(text, 'browser');
  if (!job) return ['no browser job'];
  const m = job.match(/\n {8}shard: \[([^\]]*)\]/);
  const shards = m ? m[1].split(',').map((x) => Number(x.trim())) : [];
  if (shards.length < 2 || shards.some((n, i) => n !== i + 1)) out.push(`matrix.shard is not 1..N: [${m ? m[1] : ''}]`);
  if (!/\n {6}fail-fast: false\n/.test(job)) out.push('fail-fast is not off');
  const runs = [...job.matchAll(/npx playwright test\b([^\n]*)/g)].map((x) => x[1]);
  if (runs.length !== 1) out.push(`expected one \`npx playwright test\`, found ${runs.length}`);
  for (const args of runs) {
    if (!args.includes('--shard=${{ matrix.shard }}/${{ strategy.job-total }}')) out.push(`not sharded by the matrix: ${args.trim()}`);
    const filter = args.match(/--(grep|grep-invert|project|last-failed|only-changed|max-failures|x)\b/);
    if (filter) out.push(`the shard filters tests: --${filter[1]}`);
  }
  const agg = jobText(text, 'browser-result');
  if (!agg) out.push('no browser-result job');
  else {
    if (!/\n {4}needs: browser\n/.test(agg)) out.push('browser-result does not need browser');
    if (!/\n {4}if: \$\{\{ always\(\) \}\}\n/.test(agg)) out.push('browser-result does not run always()');
    if (!/RESULT: \$\{\{ needs\.browser\.result \}\}/.test(agg)) out.push('browser-result does not read needs.browser.result');
    if (!/\n {10}test "\$RESULT" = "success"\n/.test(agg)) out.push('browser-result does not demand «success»');
    if (/continue-on-error/.test(agg) || /continue-on-error/.test(job)) out.push('continue-on-error');
  }
  return out;
}

const LOCK = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')).packages['node_modules/@playwright/test'].version;

/** Problems with where the browsers come from; [] when both browser jobs run in the lockfile's Playwright image. */
export function imageProblems(text) {
  const out = [];
  for (const id of ['browser', 'miniapp-scripts']) {
    const job = jobText(text, id);
    if (!job) { out.push(`no ${id} job`); continue; }
    const m = job.match(/\n {4}container:\n {6}image: mcr\.microsoft\.com\/playwright:v([0-9.]+)-noble@sha256:([0-9a-f]+)\n/);
    if (!m) { out.push(`${id}: not in mcr.microsoft.com/playwright:v<version>-noble@sha256:<digest>`); continue; }
    if (m[1] !== LOCK) out.push(`${id}: image v${m[1]} ≠ @playwright/test ${LOCK} in package-lock.json`);
    if (m[2].length !== 64) out.push(`${id}: the digest is not a full sha256`);
  }
  // a download fallback would bring the stalled mirror back
  if (/npx playwright install\b/.test(text)) out.push('tests.yml downloads browsers (npx playwright install)');
  const digests = new Set([...text.matchAll(/image: mcr\.microsoft\.com\/playwright:[^\s]+/g)].map((x) => x[0]));
  if (digests.size > 1) out.push(`two different Playwright images: ${[...digests].join(' | ')}`);
  return out;
}

test('the browser suite runs in shards 1..N of the matrix, unfiltered, with fail-fast off', () => {
  assert.deepEqual(shardProblems(WORKFLOW), []);
});

test('both browser jobs run in Microsoft\'s Playwright image of the lockfile\'s version, pinned by digest; nothing is downloaded', () => {
  assert.deepEqual(imageProblems(WORKFLOW), []);
});

test('negative controls: each way to make a red shard look green, or to drop tests, is caught', () => {
  const mut = (from, to) => { assert.ok(WORKFLOW.includes(from), `fixture: ${from}`); return shardProblems(WORKFLOW.replace(from, to)); };
  assert.notDeepEqual(mut('fail-fast: false', 'fail-fast: true'), []);
  assert.notDeepEqual(mut('shard: [1, 2]', 'shard: [1]'), []);
  assert.notDeepEqual(mut('shard: [1, 2]', 'shard: [1, 3]'), []);
  assert.notDeepEqual(mut('--shard=${{ matrix.shard }}/${{ strategy.job-total }}', '--shard=${{ matrix.shard }}/3'), []);
  assert.notDeepEqual(mut('--shard=${{ matrix.shard }}/${{ strategy.job-total }}', '--shard=${{ matrix.shard }}/${{ strategy.job-total }} --project=chromium-390'), []);
  assert.notDeepEqual(mut('test "$RESULT" = "success"', 'test "$RESULT" != "failure"'), []);
  assert.notDeepEqual(mut('if: ${{ always() }}', 'if: ${{ success() }}'), []);
  assert.notDeepEqual(mut('    needs: browser\n', '    needs: unit\n'), []);
  assert.notDeepEqual(mut('  browser-result:', '  browser-summary:'), []);
});

test('negative controls: a drifted, unpinned, missing or bypassed image is caught', () => {
  const img = WORKFLOW.match(/image: (mcr\.microsoft\.com\/playwright:v[0-9.]+-noble@sha256:[0-9a-f]{64})/)[1];
  const all = (from, to) => imageProblems(WORKFLOW.split(from).join(to));
  assert.notDeepEqual(all(`:v${LOCK}-`, ':v1.0.0-'), [], 'another version than the lockfile');
  assert.notDeepEqual(all(img, img.replace(/@sha256:[0-9a-f]{64}/, '')), [], 'no digest');
  assert.notDeepEqual(imageProblems(WORKFLOW.replace(`      image: ${img}\n`, '      image: ubuntu:24.04\n')), [], 'one job out of the image');
  assert.notDeepEqual(imageProblems(WORKFLOW.replace('      - name: Browser tests\n', '      - run: npx playwright install --with-deps chromium webkit\n      - name: Browser tests\n')), [], 'a download fallback');
});
