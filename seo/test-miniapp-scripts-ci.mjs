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

// Five scripts once saved screenshots under a past session's scratch dir on the author's Mac
// (/private/tmp/claude-501/…/scratchpad): green there, ENOENT on every CI runner. A script may write only under
// MINIAPP_SHOTS / UI_SHOTS, the system temp dir or its own directory.
const MACHINE_PATH = /['"`](?:\/private\/|\/tmp\/|\/Users\/|\/home\/|[A-Z]:\\\\)/;
test('negative control: a machine-specific path is caught', () => {
  assert.ok(MACHINE_PATH.test("await p.screenshot({path:'/private/tmp/claude-501/x/scratchpad/gear-home.png'});"));
  assert.ok(MACHINE_PATH.test('const OUT = `/Users/someone/shots`;'));
  assert.ok(!MACHINE_PATH.test("await p.screenshot({path:SHOTS+'/gear-home.png'});"));
});
test('no Mini App script names a path on one machine', () => {
  for (const f of readdirSync(join(ROOT, 'test/mini-app')).filter((x) => x.endsWith('.js') || x.endsWith('.mjs'))) {
    const line = read(`test/mini-app/${f}`).split('\n').find((l) => MACHINE_PATH.test(l));
    assert.equal(line, undefined, `${f}: ${line && line.trim().slice(0, 120)}`);
  }
});
