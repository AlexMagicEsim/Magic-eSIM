/* The GLOBAL checkout window after its redesign (PR 3): layout only.
 * en/checkout.js is unchanged; these hold the markup and the stylesheet to
 * what it needs, and keep the step indicator and the review free of script.
 *
 * Run: node --test seo/test-en-checkout-layout.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const JS = read('en/checkout.js');
const PAGE = read('en/esim/thailand/index.html');
const WIN = PAGE.slice(PAGE.indexOf('<div class="overlay" id="checkout"'), PAGE.indexOf('<footer'));
const CSS = read('en/checkout.css');

test('every element en/checkout.js reads is in the window, exactly once', () => {
  const ids = [...new Set([...JS.matchAll(/\$\('([A-Za-z]+)'\)/g)].map((m) => m[1]))];
  assert.ok(ids.length >= 20, `${ids.length} ids`);   // 23 today: the scan must find them
  for (const id of ids) assert.equal(PAGE.split(`id="${id}"`).length - 1, 1, id);
});

test('the window says it takes no payment before anything else, and again in full on review', () => {
  assert.ok(WIN.indexOf('id="coUnavail"') < WIN.indexOf('class="co-sum"'), 'before the plan');
  assert.ok(WIN.indexOf('id="coUnavail"') < WIN.indexOf('id="coStep1"'), 'before the price');
  const s3 = WIN.slice(WIN.indexOf('id="coStep3"'));
  assert.ok(s3.indexOf('id="coFinal"') < s3.indexOf('id="coPay"'), 'the full refusal sits above the payment button');
  assert.match(WIN, /<button type="button" class="btn" id="coPay" disabled aria-disabled="true"/);
});

test('the step indicator is decoration: three steps, hidden from assistive technology, no script', () => {
  assert.match(WIN, /<ol class="co-steps" aria-hidden="true">\s*<li><span>1<\/span>Plan<\/li>\s*<li><span>2<\/span>Details<\/li>\s*<li><span>3<\/span>Review<\/li>\s*<\/ol>/);
  assert.doesNotMatch(JS, /co-steps|co-sum|co-action/, 'en/checkout.js knows nothing of the layout');
  for (const n of [1, 2, 3]) assert.match(CSS, new RegExp(`\\.co:has\\(#coStep${n}:not\\(\\[hidden\\]\\)\\) \\.co-steps li:nth-child\\(${n}\\)`));
  assert.match(CSS, /\.co:has\(#coStep3:not\(\[hidden\]\)\) \.co-sum\{display:none\}/, 'review shows each fact once');
  assert.match(CSS, /\.co:has\(#coStep3:not\(\[hidden\]\)\) #coUnavail\{display:none\}/, 'and the refusal once, in full');
});

test('the summary names the page\'s country with its flag', () => {
  assert.match(WIN, /<div class="co-sum-head"><img class="co-flag" src="\/en\/flags\/th\.svg" alt="" width="36" height="27"><span>eSIM for Thailand<\/span><\/div>/);
});

test('the checkout styles live in en/checkout.css only, reach nothing outside, and style nothing unused', () => {
  assert.doesNotMatch(read('en/en.css'), /\.overlay\{|\.modal\{|#coStep|\.unavail\{/, 'moved out of the shared stylesheet');
  assert.match(PAGE, /<link rel="stylesheet" href="\/en\/checkout\.css\?v=[0-9a-f]{8}">/);
  assert.doesNotMatch(CSS, /https?:\/\/|@import|url\(/i);
  let sel = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let i = 0; i < 5; i += 1) sel = sel.replace(/\{[^{}]*\}/g, ' ');
  const classes = [...new Set([...sel.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))];
  const used = new Set([...WIN.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  assert.deepEqual(classes.filter((c) => !used.has(c)), []);
});
