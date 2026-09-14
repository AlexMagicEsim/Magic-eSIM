/* The English country dictionary is generated; this proves the committed file
 * still matches its source.
 *
 * The Russian half has had this gate since it existed (`test-country-names.mjs`).
 * Without the same gate on the English half, a country renamed in
 * `seo/country-names.mjs` would keep its old English name on /en/ forever, and
 * nothing would say so.
 *
 * Run: node seo/test-country-names-en.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { render } from './build-country-dictionary-en.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const FILE = join(ROOT, 'assets/country-names-en.js');

test('the committed dictionary is byte-identical to a fresh generation', () => {
  assert.equal(readFileSync(FILE, 'utf8'), render(),
    'run: node seo/build-country-dictionary-en.mjs');
});

test('every country in the source reaches the browser', () => {
  const N = require(FILE);
  const all = N.all();
  assert.equal(Object.keys(all).length, Object.keys(COUNTRY_NAMES).length);
  for (const iso of Object.keys(COUNTRY_NAMES)) {
    assert.equal(all[iso], COUNTRY_NAMES[iso].en, iso);
  }
});

test('an unknown code returns the code, never undefined and never an object', () => {
  const N = require(FILE);
  assert.equal(N.of('ZZ'), 'ZZ');
  assert.equal(N.of(''), '');
  assert.equal(N.of(undefined), '');
  // `of('__proto__')` must not reach Object.prototype.
  assert.equal(typeof N.of('__proto__'), 'string');
  assert.equal(typeof N.of('constructor'), 'string');
});

test('no name is empty', () => {
  const N = require(FILE).all();
  const blank = Object.entries(N).filter(([, v]) => !String(v).trim());
  assert.deepEqual(blank, []);
});
