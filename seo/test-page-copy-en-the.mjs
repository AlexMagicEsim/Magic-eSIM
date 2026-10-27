/* «the» before the English country names that take it, in every EN country template (language review, 2026-10-27).
 * Run: node --test seo/test-page-copy-en-the.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_COPY, EN_THE } from './page-copy.mjs';
import { countryName } from './country-names-i18n.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COUNTRIES = JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8')).countries;
const NAMES = COUNTRIES.map((c) => countryName(c.iso, 'en'));
const C = PAGE_COPY.en;

test('every «the» name is a real English country name of the catalogue', () => {
  for (const n of EN_THE) assert.ok(NAMES.includes(n), n);
});

test('the templates put «the» before those names and only those', () => {
  assert.equal(C.esimFor('United Kingdom'), 'eSIM for the United Kingdom');
  assert.equal(C.localTitle('Maldives'), 'Plans for the Maldives');
  assert.equal(C.regionalTitle('Philippines'), 'Regional plans that include the Philippines');
  assert.match(C.countryTitle('United States'), /^eSIM for the United States/);
  assert.equal(C.esimFor('Japan'), 'eSIM for Japan');
  assert.equal(C.esimFor('Czechia'), 'eSIM for Czechia');
  assert.equal(C.localTitle('Vatican City'), 'Plans for Vatican City');
});

test('the built pages carry it', () => {
  const uk = readFileSync(join(ROOT, 'en/esim/united-kingdom/index.html'), 'utf8');
  assert.match(uk, /<h1>eSIM for the United Kingdom<\/h1>/);
  const mv = readFileSync(join(ROOT, 'en/esim/maldives/index.html'), 'utf8');
  assert.match(mv, /<h1>eSIM for the Maldives<\/h1>/);
  assert.doesNotMatch(mv, /Plans for Maldives\b/);
});
