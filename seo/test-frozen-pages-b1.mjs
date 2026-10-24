// The SEO-experiment pages and the B1 card (owner, 2026-10-24, variant «Б»):
//   1. EVERY RU country page — the ten pilot / control pages included — renders the B1 card (data-cards="compact");
//   2. the experiment pages keep their own page: the experiment hero (.cp-text + authored lead), no loading skeleton, no live
//      catalogue numbers — so the pilot and control groups stay apart from the rest and from each other;
//   3. the date both groups changed card design is recorded once, CARDS_B1_SINCE = 2026-10-24 (results are never pooled across it);
//   4. the switch added ONE attribute to those pages: their head (title, description, canonical, robots, hreflang) and JSON-LD
//      are the generator's frozen output, untouched by the card switch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEO_PILOT_PAGES, SEO_CONTROL_PAGES, FROZEN_PAGES, CARDS_B1_SINCE } from './frozen-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (slug) => readFileSync(join(ROOT, 'esim', slug, 'index.html'), 'utf8');
const countries = readdirSync(join(ROOT, 'esim')).filter((s) => existsSync(join(ROOT, 'esim', s, 'index.html')) && read(s).includes('data-country-page='));

test('every RU country page renders the B1 card — the ten experiment pages included', () => {
  assert.equal(countries.length, 198);
  const missing = countries.filter((s) => !/<section class="packages" id="tariffs" data-country-page="[A-Z]{2}" data-cards="compact">/.test(read(s)));
  assert.deepEqual(missing, []);
});

test('the experiment groups stay apart: five pilot, five control, their own hero, no skeleton, no live numbers', () => {
  assert.equal(SEO_PILOT_PAGES.length, 5);
  assert.equal(SEO_CONTROL_PAGES.length, 5);
  assert.equal(FROZEN_PAGES.size, 10);
  for (const s of FROZEN_PAGES) {
    const h = read(s);
    assert.ok(h.includes('<div class="cp-text">'), `${s}: the experiment hero`);
    assert.ok(!h.includes('cp-skeleton'), `${s}: no loading skeleton`);
    assert.ok(!/data-cat[=-]/.test(h), `${s}: no live catalogue numbers`);
  }
  for (const s of countries.filter((x) => !FROZEN_PAGES.has(x)).slice(0, 20)) assert.ok(!read(s).includes('<div class="cp-text">'), `${s}: not an experiment page`);
});

test('the date both groups switched card design is recorded: 2026-10-24', () => {
  assert.equal(CARDS_B1_SINCE, '2026-10-24');
});
