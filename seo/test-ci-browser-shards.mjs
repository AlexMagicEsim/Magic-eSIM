// The browser suite in tests.yml runs in parallel shards, and the browsers are installed with a bounded retry
// (2026-10-22: one job reached ~20 min with 1320 tests, and a stalled Ubuntu mirror cut it at its 25-min limit
// before or during the tests — with no failing test). These rules keep the split HONEST:
//   - every shard runs `npx playwright test --shard=<i>/<total>` with the total taken from the matrix itself, and no
//     filter (no --grep / --project / --last-failed / --only-changed), so the shards together are the whole suite;
//   - fail-fast is off, so one red shard never cancels (hides) the other;
//   - one aggregate job reads `needs.browser.result` and is green ONLY on «success» — a failed, cancelled or skipped
//     shard turns it red; it runs `always()`, so it reports even then;
//   - every browser install is cut after a few minutes and retried a bounded number of times, and the step fails
//     when every attempt failed — a retry can never turn into «installed nothing, carried on».
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

/** Problems with the browser installs of a workflow; [] when every install is bounded and retried. */
export function installProblems(text) {
  const out = [];
  // a step ends at the next step, job or comment block at step level (the comment belongs to the step after it)
  const steps = text.split(/\n(?= {6}- )/).map((s) => s.replace(/\n(?: {6}#| {2}[a-z])[\s\S]*$/, '\n')).filter((s) => /npx playwright install\b/.test(s));
  if (steps.length === 0) out.push('no browser install');
  for (const step of steps) {
    const name = (step.match(/name: ([^\n]+)/) || [, '?'])[1];
    if (!/timeout-minutes: \d+/.test(step)) out.push(`${name}: no step timeout`);
    if (!/for attempt in [\d ]+; do/.test(step)) out.push(`${name}: no bounded retry`);
    if (!/\n {12}timeout (--kill-after=\S+ )?\d+m npx playwright install --with-deps chromium webkit && exit 0\n/.test(step)) out.push(`${name}: an attempt is not cut by \`timeout\``);
    if (!/\n {10}exit 1\n?$/.test(step.trimEnd() + '\n')) out.push(`${name}: does not fail after the last attempt`);
  }
  return out;
}

test('the browser suite runs in shards 1..N of the matrix, unfiltered, with fail-fast off', () => {
  assert.deepEqual(shardProblems(WORKFLOW), []);
});

test('every browser install in tests.yml is cut after a few minutes, retried a bounded number of times, and fails at the end', () => {
  assert.deepEqual(installProblems(WORKFLOW), []);
  assert.equal([...WORKFLOW.matchAll(/npx playwright install\b/g)].length, 2, 'the browser job and miniapp-scripts');
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

test('negative controls: an unbounded, unretried or never-failing install is caught', () => {
  const plain = 'jobs:\n  x:\n    steps:\n      - name: Install Chromium and WebKit\n        run: npx playwright install --with-deps chromium webkit\n';
  assert.notDeepEqual(installProblems(plain), []);
  const swallow = WORKFLOW.replace(/echo "::error::browser install failed three times"\n {10}exit 1/g, 'echo "::warning::carry on"');
  assert.notDeepEqual(installProblems(swallow), []);
  const noCut = WORKFLOW.replace(/timeout --kill-after=30s 6m npx/g, 'npx');
  assert.notDeepEqual(installProblems(noCut), []);
});
