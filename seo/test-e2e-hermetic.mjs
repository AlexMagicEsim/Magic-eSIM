// A browser test of a Russian page never waits on the internet (2026-11-03).
//
// The Russian pages load Yandex Metrika's tag.js as an async script, and an
// async script inserted before «load» holds «load». In the SEO refresh's
// container https://mc.yandex.ru/metrika/tag.js hung (status -1 in the trace):
// test/e2e/published-counts.spec.js timed out on Seychelles and South Africa,
// and the refresh went red for nothing the pages did. Every spec that opens a
// Russian page must therefore block other hosts: test/helpers/hermetic.cjs
// (isolateFromInternet), a catch-all route of non-local hosts, or at least
// Metrika itself.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'test', 'e2e');
const require = createRequire(import.meta.url);

// A navigation to a Russian page: /esim/…, the Russian home, or a constant holding one.
const OPENS_RU = /\.goto\(\s*(?:`\/esim\/|'\/esim\/|"\/esim\/|'\/'|`\/`|'\/\?|`\/\?)|=\s*'\/esim\/[^']*'/;
// What counts as «does not wait on the internet».
const ISOLATED = /isolateFromInternet\(|route\(\s*\/\^https\?:\\\/\\\/\(\?!|mc\\?\.yandex/;

export function unisolated(files) {
  return files.filter(([, src]) => OPENS_RU.test(src) && !ISOLATED.test(src)).map(([f]) => f);
}

const specs = () => readdirSync(DIR).filter((f) => f.endsWith('.spec.js')).map((f) => [f, readFileSync(join(DIR, f), 'utf8')]);

test('every browser spec that opens a Russian page blocks the internet (Metrika included)', () => {
  const all = specs();
  assert.ok(all.filter(([, s]) => OPENS_RU.test(s)).length >= 10, 'the rule sees the Russian-page specs');
  assert.deepEqual(unisolated(all), []);
});

test('the rule fires: a spec opening a Russian page with no block is named', () => {
  const bare = "const { test } = require('@playwright/test');\ntest('x', async ({ page }) => { await page.goto('/esim/turkey/'); });";
  assert.deepEqual(unisolated([['bare.spec.js', bare]]), ['bare.spec.js']);
  assert.deepEqual(unisolated([['const.spec.js', "const PAGE = '/esim/payment-rubles/index.html';\nawait page.goto(PAGE);"]]), ['const.spec.js']);
  assert.deepEqual(unisolated([['en.spec.js', "await page.goto('/en/esim/turkey/');"]]), [], 'an English page carries no Metrika');
  for (const ok of ["await isolateFromInternet(context);", "await page.route(/^https?:\\/\\/(?!127\\.0\\.0\\.1)/, r);", "await page.route('**/mc.yandex.ru/**', r);"]) {
    assert.deepEqual(unisolated([['ok.spec.js', `${ok}\nawait page.goto('/esim/turkey/');`]]), [], ok);
  }
});

test('the helper lets the local server through and nothing else', () => {
  const { LOCAL } = require('../test/helpers/hermetic.cjs');
  for (const u of ['http://127.0.0.1:4321/esim/turkey/', 'http://localhost:4321/assets/x.js', 'data:image/png;base64,AA', 'about:blank']) assert.ok(LOCAL.test(u), u);
  for (const u of ['https://mc.yandex.ru/metrika/tag.js', 'https://esim-backend-3wmu.onrender.com/api/v1/retail/packages', 'http://127.0.0.1.evil.example/', 'https://localhost.example/']) assert.ok(!LOCAL.test(u), u);
});
