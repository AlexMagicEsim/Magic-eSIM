// The Mini App's browser scripts (test/mini-app/*.e2e.js) run in CI — added 2026-10-20 after two of them had been red
// unseen (promo since 2026-09-03, ui since storefront #106), because nothing ever ran them. This keeps the job and keeps
// the runner reading the directory, so a new script can neither be skipped nor need a workflow edit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('tests.yml runs every Mini App script through test/mini-app/run-all.mjs, with both engines installed', () => {
  const wf = read('.github/workflows/tests.yml');
  const job = wf.slice(wf.indexOf('\n  miniapp-scripts:'));
  assert.ok(wf.includes('\n  miniapp-scripts:'), 'the miniapp-scripts job exists');
  assert.match(job, /run: node test\/mini-app\/run-all\.mjs/);
  assert.match(job, /npx playwright install --with-deps chromium webkit/);
  assert.match(job, /runs-on: ubuntu-24\.04/);
});

test('the runner takes its list from the directory, not from a hand-written list', async () => {
  const runner = read('test/mini-app/run-all.mjs');
  assert.match(runner, /readdirSync\(DIR\)\.filter\(\(f\) => f\.endsWith\('\.e2e\.js'\)\)/);
  const { scripts } = await import(join(ROOT, 'test/mini-app/run-all.mjs'));
  const onDisk = readdirSync(join(ROOT, 'test/mini-app')).filter((f) => f.endsWith('.e2e.js')).sort();
  assert.deepEqual(scripts(), onDisk);
  assert.ok(onDisk.length >= 11, `${onDisk.length} scripts`);
});
