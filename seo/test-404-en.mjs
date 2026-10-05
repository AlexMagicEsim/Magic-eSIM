/* An unknown page under /en/ gets an English 404 — and no counter.
 *
 * GitHub Pages serves ONE 404.html for the whole site, and that file also
 * routes the /pay/ links. Until 2026-10-05 an unknown /en/ path fell through
 * to the Russian not-found screen («Страница не найдена», a link to the
 * Russian home) and loaded Metrika with Webvisor: the only English page with
 * analytics was the error page. The English site carries none until the
 * consent decision.
 *
 * Run: node --test seo/test-404-en.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = readFileSync(join(ROOT, '404.html'), 'utf8');
const ROUTING = S.slice(S.indexOf('// --- routing'));
const EN_BRANCH = "} else if(/^\\/en(\\/|$)/.test(path)){";
const bodyOf = (fn) => { const at = S.indexOf(`function ${fn}(`); const rest = S.slice(at + 1); return rest.slice(0, rest.indexOf('\n    function ')); };

test('there is an /en/ branch, after the /pay/ guard and before the counting else', () => {
  const en = ROUTING.indexOf(EN_BRANCH);
  assert.ok(en > 0, 'no /en/ branch');
  assert.ok(ROUTING.indexOf("/^\\/pay\\//.test(path)") < en, 'the /pay/ prefix guard must stay first');
  assert.ok(en < ROUTING.lastIndexOf('loadMetrika();'), 'the /en/ branch must precede the counting else');
});

test('the /en/ branch shows the English screen and never loads the counter', () => {
  const en = ROUTING.indexOf(EN_BRANCH);
  const branch = ROUTING.slice(en, ROUTING.indexOf('} else {', en));
  assert.match(branch, /showNotFoundEn\(\);/);
  assert.doesNotMatch(branch, /loadMetrika|showNotFound\(\)/);
  assert.doesNotMatch(bodyOf('showNotFoundEn'), /loadMetrika|ym\(/);
  // Still exactly one counter call, on the Russian not-found branch.
  assert.equal((S.match(/loadMetrika\(\);/g) || []).length, 1);
});

test('the English screen is English, and links into the English site only', () => {
  const b = bodyOf('showNotFoundEn');
  assert.match(b, /document\.documentElement\.lang = 'en';/);
  assert.match(b, /document\.title = 'Page not found — Magic eSIM';/);
  assert.match(b, /<h1>Page not found<\/h1>/);
  assert.doesNotMatch(b, /[А-Яа-яЁё]/);
  const hrefs = [...b.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ['/en/', '/en/esim/']);
});

test('the branch matches /en and /en/…, and nothing that merely starts with «en»', () => {
  const re = /^\/en(\/|$)/;
  for (const p of ['/en', '/en/', '/en/esim/atlantis/', '/en/guides/nope/']) assert.ok(re.test(p), p);
  for (const p of ['/enter', '/english/', '/esim/en/', '/pay/en/x']) assert.equal(re.test(p), false, p);
});
