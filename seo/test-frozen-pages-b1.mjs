// The SEO-experiment pages and the B1 card (owner, 2026-10-24, variant «Б»):
//   1. EVERY RU country page — the ten pilot / control pages included — renders the B1 card (data-cards="compact");
//   2. since 2026-10-24 the experiment ENDED (owner): those ten pages have the common structure — the English reference's hero,
//      skeleton, live numbers — and their authored H1 / lead / intro stand whole in the «about» block under the plans;
//   3. both dates are recorded once: CARDS_B1_SINCE and EXPERIMENT_ENDED = 2026-10-24 (results are never pooled across it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEO_PILOT_PAGES, SEO_CONTROL_PAGES, FROZEN_PAGES, CARDS_B1_SINCE, EXPERIMENT_ENDED } from './frozen-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (slug) => readFileSync(join(ROOT, 'esim', slug, 'index.html'), 'utf8');
const countries = readdirSync(join(ROOT, 'esim')).filter((s) => existsSync(join(ROOT, 'esim', s, 'index.html')) && read(s).includes('data-country-page='));

test('every RU country page renders the B1 card — the ten experiment pages included', () => {
  assert.equal(countries.length, 198);
  const missing = countries.filter((s) => !/<section class="packages" id="tariffs" data-country-page="[A-Z]{2}" data-cards="compact">/.test(read(s)));
  assert.deepEqual(missing, []);
});

test('the ten former experiment pages have the common structure; their authored headline stands in the about block', () => {
  assert.equal(SEO_PILOT_PAGES.length, 5);
  assert.equal(SEO_CONTROL_PAGES.length, 5);
  assert.equal(FROZEN_PAGES.size, 10);
  for (const s of FROZEN_PAGES) {
    const h = read(s);
    assert.ok(!h.includes('<div class="cp-text">'), `${s}: no experiment hero`);
    assert.match(h, /<h1>eSIM для [^<]+<\/h1>/, `${s}: the common H1`);
    assert.ok(h.includes('cp-skeleton'), `${s}: the loading skeleton`);
    assert.ok(/data-cat[=-]/.test(h), `${s}: live catalogue numbers`);
    const prof = JSON.parse(readFileSync(join(ROOT, 'seo', 'content-profiles', `${s}.json`), 'utf8'));
    const about = (h.match(/<h2 id="aboutTitle">([^<]*)<\/h2>/) || [])[1];
    const unesc = (t) => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    assert.equal(about && unesc(about), prof.h1, `${s}: the authored headline whole in the about block`);
  }
});

test('the dates are recorded: cards B1 and the end of the experiment, 2026-10-24', () => {
  assert.equal(CARDS_B1_SINCE, '2026-10-24');
  assert.equal(EXPERIMENT_ENDED, '2026-10-24');
});
