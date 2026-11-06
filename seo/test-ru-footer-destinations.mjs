// The Russian footer's «Направления» is the one link to a country that every Russian page carries — 211 pages. Until
// 2026-11-06 it was the first six of RU_POPULAR, so China (seventh there; 16 595 «esim/есим китай» a month in Yandex
// Wordstat, second only to Turkey) was linked from 12 pages against 211 for each of the six. It is its own list now
// (seo/ru-chrome.mjs RU_FOOTER_DESTINATIONS); this holds it to pages that exist, are indexable, and to plain links.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RU_FOOTER, RU_FOOTER_DESTINATIONS } from './ru-chrome.mjs';
import { COUNTRY_SLUGS } from './catalogue-page-count.mjs';
import { FROZEN_PAGES } from './frozen-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function footerProblems(footer) {
  const problems = [];
  const col = footer.match(/<h2>Направления<\/h2>\s*<ul>([\s\S]*?)<\/ul>/);
  if (!col) return ['no «Направления» column'];
  const hrefs = [...col[1].matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g)].map((m) => m[1]);
  const items = (col[1].match(/<li>/g) || []).length;
  if (hrefs.length !== items) problems.push(`${items - hrefs.length} item(s) are not a plain <a href>`);
  const seen = new Set();
  for (const h of hrefs) {
    if (seen.has(h)) problems.push(`duplicate link ${h}`);
    seen.add(h);
  }
  if (hrefs.at(-1) !== '/esim/') problems.push('«Все направления» is not last');
  return problems;
}

test('the footer destinations: China first, the owner\'s priority order, six, each slug once', () => {
  assert.deepEqual(RU_FOOTER_DESTINATIONS.map((d) => d.slug), ['china', 'turkey', 'thailand', 'vietnam', 'egypt', 'kazakhstan']);
  assert.equal(new Set(RU_FOOTER_DESTINATIONS.map((d) => d.slug)).size, RU_FOOTER_DESTINATIONS.length);
});

test('every footer destination is a published, indexable RU page with a self canonical', () => {
  for (const { slug, name } of RU_FOOTER_DESTINATIONS) {
    assert.ok(COUNTRY_SLUGS.includes(slug), `${slug}: not a country page of the catalogue`);
    const file = `esim/${slug}/index.html`;
    assert.ok(existsSync(join(ROOT, file)), `${file} missing`);
    const h = read(file);
    assert.match(h, /<meta name="robots" content="index, follow" \/>/, `${slug}: not indexable`);
    assert.ok(h.includes(`<link rel="canonical" href="https://magicesim.store/esim/${slug}/" />`), `${slug}: canonical`);
    assert.ok(h.includes(`data-country-name="${name}"`), `${slug}: the label «${name}» is not the page's country`);
  }
});

test('the footer adds no SEO-pilot or control page: their inbound links stay as they were during the pilot', () => {
  // Egypt (a pilot page) was in the footer before the change, so its links do not move.
  const added = RU_FOOTER_DESTINATIONS.map((d) => d.slug).filter((s) => FROZEN_PAGES.has(s) && s !== 'egypt');
  assert.deepEqual(added, []);
});

test('the footer column is plain links without duplicates — and the check fires', () => {
  assert.deepEqual(footerProblems(RU_FOOTER), []);
  const dup = RU_FOOTER.replace('<li><a href="/esim/turkey/">Турция</a></li>', '<li><a href="/esim/china/">Китай</a></li>');
  assert.notEqual(dup, RU_FOOTER);
  assert.ok(footerProblems(dup).some((p) => p.includes('duplicate link /esim/china/')));
  const js = RU_FOOTER.replace('<li><a href="/esim/turkey/">Турция</a></li>', '<li><button data-href="/esim/turkey/">Турция</button></li>');
  assert.ok(footerProblems(js).some((p) => p.includes('not a plain <a href>')));
});

test('the RU pages carry this footer in their HTML, without JavaScript', () => {
  for (const p of ['index.html', 'esim/index.html', 'esim/turkey/index.html', 'esim/china/index.html', 'esim/egypt/index.html', 'esim/compatibility/index.html', 'terms.html']) {
    assert.ok(read(p).includes(RU_FOOTER), `${p}: footer drifted`);
  }
});
