// The /esim/ hub indexes every information page, from the one list that
// renders them.
//
// Until 2026-09-30 the hub's «Перед покупкой» block was five hand-written
// links; the two installation guides (iPhone, Android) were not among them,
// and nothing would have noticed a sixth guide missing. The block is now
// built from seo/guides.mjs — the list build-guides.mjs renders the pages
// from — so this file pins the property, not the markup.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUIDES } from './guides.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';
const HUB = readFileSync(join(ROOT, 'esim/index.html'), 'utf8');
const SITEMAP = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');

function materials() {
  const m = HUB.match(/<section class="compat" id="materials">[\s\S]*?<\/section>/);
  assert.ok(m, 'на /esim/ нет оглавления материалов (#materials)');
  return [...m[0].matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><span>([^<]+)<\/span><\/li>/g)]
    .map(([, href, name, blurb]) => ({ href, name, blurb }));
}

test('the hub links every information page exactly once, and nothing else', () => {
  const items = materials();
  assert.ok(GUIDES.length >= 7, `гайдов ${GUIDES.length}`);
  assert.deepEqual(items.map((i) => i.href).sort(), GUIDES.map((g) => g.url.slice(SITE.length)).sort());
});

test('every indexed material exists, is in the sitemap and is named by its own H1', () => {
  for (const g of GUIDES) {
    const path = g.url.slice(SITE.length);
    const file = path.endsWith('/') ? `${path}index.html` : path;
    assert.ok(existsSync(join(ROOT, file)), `${path} не существует`);
    assert.ok(SITEMAP.includes(`<loc>${g.url}</loc>`), `${g.url} нет в sitemap`);
    const item = materials().find((i) => i.href === path);
    assert.equal(item.name, g.h1, `${path}: ссылка должна называться как H1 страницы`);
  }
});

test('every blurb is one short line, and payment uses the mandated wording', () => {
  for (const { href, blurb } of materials()) {
    assert.ok(blurb.length >= 20 && blurb.length <= 80, `${href}: «${blurb}» — ${blurb.length} символов`);
  }
  const pay = materials().find((i) => i.href === '/esim/payment-rubles/');
  assert.match(pay.blurb, /Российской банковской картой или через СБП/);
  assert.doesNotMatch(materials().map((i) => i.blurb).join(' '), /любой карт|any card/i);
});

test('the hub\'s first screen points to the index', () => {
  const hero = HUB.match(/<section class="hero">[\s\S]*?<\/section>/)[0];
  assert.match(hero, /href="#materials"/);
});
