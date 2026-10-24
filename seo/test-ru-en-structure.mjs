// Conversion stage 2, PR A — the Russian country page follows the EN country
// page's structure (en/esim/<slug>/) outside the SEO experiment:
//   short H1 «eSIM для <genitive>» + one line (the facts line, live numbers)
//   → jump bar → plans: local → regional → daily (EN order) → the authored
//   text, WHOLE, under the plans (the old H1 as its H2, the lead, every intro)
//   → «Почему eSIM» → «Перед покупкой» → FAQ → «Другие направления».
// Since 2026-10-24 the ten former SEO-experiment pages have this structure too (the experiment ended). The EN pages are not
// touched by this (their generator is another file).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countryPages } from './generated-prices.mjs';
import { isFrozenPage } from './frozen-pages.mjs';
import { buildDictionaryGen } from './build-country-dictionary.mjs';
import { renderPriceTokens, readRefs } from './price-tokens.mjs';
import { loadCatalogue } from './catalogue-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = countryPages();
const GEN = buildDictionaryGen();
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const PK = loadCatalogue();
// The profile as the generator prints it: {{price:…}} already the catalogue amount.
const profile = (slug) => {
  const p = join(ROOT, 'seo', 'content-profiles', `${slug}.json`);
  if (!existsSync(p)) return {};
  const { profile: out, problems } = renderPriceTokens(JSON.parse(readFileSync(p, 'utf8')), readRefs(slug), slug, PK);
  assert.deepEqual(problems, [], slug);
  return out;
};
const at = (html, s) => { const i = html.indexOf(s); assert.notEqual(i, -1, `missing: ${s.slice(0, 60)}`); return i; };

test('outside the experiment: short H1, the facts line under it, nothing else before the plans', () => {
  let n = 0;
  for (const { slug, iso, html } of PAGES) {
    n += 1;
    const h1 = (html.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1];
    assert.equal(h1, `eSIM для ${esc(GEN[iso])}`, slug);
    const title = (html.match(/<div class="cp-title">([\s\S]*?)<\/div>\s*<\/div>/) || [])[1] || '';
    assert.match(title, /<p class="facts">[\s\S]*data-cat="floor"/, `${slug}: the facts line (live floor) under the H1`);
    assert.doesNotMatch(html, /class="cp-text"/, `${slug}: no article in the first screen`);
    const hero = html.slice(at(html, '<section class="cp-hero">'), at(html, 'id="tariffs"'));
    assert.doesNotMatch(hero, /class="intro"|class="lead"/, `${slug}: lead / intro are not above the plans`);
  }
  assert.ok(n >= 180, `pages checked: ${n}`);
});

test('outside the experiment: plans in the EN order, the jump bar in the same order, the EN skeleton while loading', () => {
  for (const { slug, html } of PAGES) {
    const l = at(html, '<section id="localBlock"'); const r = at(html, '<section id="regionalBlock"'); const d = at(html, '<section id="dailyBlock"');
    assert.ok(l < r && r < d, `${slug}: local → regional → daily`);
    const jump = (html.match(/<nav class="cp-jump"[\s\S]*?<\/nav>/) || [''])[0];
    const order = [...jump.matchAll(/href="#(\w+)"/g)].map((m) => m[1]);
    assert.deepEqual(order, ['localBlock', 'regionalBlock', 'dailyBlock'], `${slug}: jump bar`);
    const tariffs = html.slice(at(html, 'id="tariffs"'), l);
    assert.match(tariffs, /<div class="cp-skeleton" aria-hidden="true">/, `${slug}: skeleton`);
  }
});

test('the authored text is under the plans, word for word: old H1 as H2, the lead, every intro paragraph', () => {
  let authored = 0;
  for (const { slug, html } of PAGES) {
    const p = profile(slug);
    const about = (html.match(/<section class="cp-sec about" aria-labelledby="aboutTitle">([\s\S]*?)<\/section>/) || [])[1];
    assert.ok(about, `${slug}: the about section`);
    assert.ok(html.indexOf('cp-sec about') > html.indexOf('id="tariffs"'), `${slug}: under the plans`);
    const why = html.indexOf('class="cp-sec why"'); const help = html.indexOf('class="cp-help"');
    assert.ok(html.indexOf('cp-sec about') < (why !== -1 ? why : help), `${slug}: before «Почему eSIM» / «Перед покупкой»`);
    if (!p.h1) continue;
    authored += 1;
    assert.ok(about.includes(`<h2 id="aboutTitle">${esc(p.h1)}</h2>`), `${slug}: the old H1 as the H2`);
    assert.ok(about.includes(`<p class="lead">${esc(p.lead)}</p>`), `${slug}: the lead`);
    for (const t of (p.intro || []).filter(Boolean)) assert.ok(about.includes(`<p class="intro">${esc(t)}</p>`), `${slug}: intro «${t.slice(0, 40)}…»`);
  }
  assert.ok(authored >= 50, `authored pages checked: ${authored}`);
});

test('the ten former SEO-experiment pages have the common structure since 2026-10-24', () => {
  const frozen = PAGES.filter((p) => isFrozenPage(p.slug));
  assert.equal(frozen.length, 10);
  for (const { slug, html } of frozen) {
    assert.doesNotMatch(html, /class="cp-text"/, slug);
    for (const re of [/cp-sec about/, /<section id="dailyBlock"/, /cp-skeleton/]) assert.match(html, re, slug);
    const jump = (html.match(/<nav class="cp-jump"[\s\S]*?<\/nav>/) || [''])[0];
    assert.deepEqual([...jump.matchAll(/href="#(\w+)"/g)].map((m) => m[1]), ['localBlock', 'regionalBlock', 'dailyBlock'], `${slug}: the EN order`);
  }
});
