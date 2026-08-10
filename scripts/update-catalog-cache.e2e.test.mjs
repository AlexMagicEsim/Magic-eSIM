// End-to-end: when every source is unreachable, assets/catalog.json is not
// touched.
//
// The unit tests next door prove fetchLiveCatalogue throws. That is the
// mechanism, not the guarantee. The guarantee is about a file on disk, and the
// only honest way to check it is to run the real script against dead endpoints
// and compare the bytes.
//
// The script writes to the repo's own assets/catalog.json, so this test backs
// the file up and restores it in a finally — if the fix under test were broken,
// the test would otherwise be the thing that destroyed the cache.
//
//   node --test scripts/update-catalog-cache.e2e.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'update-catalog-cache.mjs');
const OUT = join(ROOT, 'assets', 'catalog.json');
const TMP = join(ROOT, 'assets', '.catalog.json.tmp');

// Port 1 is reserved and never listening: connection refused, immediately.
const DEAD = 'http://127.0.0.1:1';

test('both sources dead: exit 1, catalog.json byte-identical, no temp file left', () => {
  assert.ok(existsSync(OUT), 'this test needs a real cache present to protect');
  const before = readFileSync(OUT);
  const mtimeBefore = statSync(OUT).mtimeMs;

  let out = '';
  let code = 0;
  try {
    try {
      out = execFileSync(process.execPath, [SCRIPT], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CATALOG_API_BASE: DEAD, CATALOG_API_FALLBACK: DEAD },
      });
    } catch (e) {
      code = e.status;
      out = `${e.stdout || ''}${e.stderr || ''}`;
    }

    assert.equal(code, 1, 'a total failure must be a non-zero exit, so CI shows red');
    assert.deepEqual(readFileSync(OUT), before, 'catalog.json was modified — the one thing that must never happen');
    assert.equal(statSync(OUT).mtimeMs, mtimeBefore, 'catalog.json was rewritten, even if with identical bytes');
    assert.ok(!existsSync(TMP), 'the temp file must be cleaned up');

    // Both sources tried, three attempts each, and the log says so.
    assert.match(out, /НЕ ТРОНУТ/);
    assert.match(out, /api, попытка 3\/3/);
    assert.match(out, /origin, попытка 3\/3/);
  } finally {
    // Restore only if something went wrong; a passing run leaves it untouched.
    if (!readFileSync(OUT).equals(before)) writeFileSync(OUT, before);
  }
});
