/* The English guides and their list after the 2026-10 redesign. What the
 * frame may change and what it may not:
 *   * the words are seo/guides-en.mjs, verbatim — every section, every
 *     question and answer; the only new words are «On this page»;
 *   * every link is one the guide already had, or an anchor to its own heading;
 *   * the payment bar is the home's, word for word; no script at all;
 *   * the list links all five, as cards, with their own blurbs.
 *
 * Run: node --test seo/test-en-guides-layout.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EN_GUIDES } from './guides-en.mjs';
import { PAYBAR, sectionId } from './build-en-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const page = (slug) => read(`en/guides/${slug}/index.html`);
const HUB = read('en/guides/index.html');
const CSS = read('en/guides.css');
const mainOf = (h) => h.slice(h.indexOf('<main'), h.indexOf('</main>'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

test('every section of every guide is in the page verbatim, under its own heading and anchor', () => {
  let n = 0;
  for (const g of EN_GUIDES) {
    const h = page(g.slug);
    for (const s of g.sections) {
      const id = sectionId(s.h2);
      assert.match(id, /^[a-z0-9-]+$/);
      assert.ok(h.includes(`<section class="g-sec prose" id="${id}" aria-labelledby="${id}-h">\n      <h2 id="${id}-h">${esc(s.h2)}</h2>`), `${g.slug}: «${s.h2}»`);
      assert.ok(h.includes(s.html.replace(/^\n/, '').replace(/\s+$/, '')), `${g.slug}: the text of «${s.h2}» is unchanged`);
      n += 1;
    }
    for (const f of g.faq) {
      assert.ok(h.includes(`<summary>${esc(f.q)}</summary>\n        <p class="note">${esc(f.a)}</p>`), `${g.slug}: «${f.q}»`);
    }
    assert.ok(h.includes(`<h1>${esc(g.h1)}</h1>`) && h.includes(`<p class="lead">${esc(g.lead)}</p>`), g.slug);
  }
  assert.equal(n, EN_GUIDES.reduce((a, g) => a + g.sections.length, 0));
});

test('«On this page» lists every section and the questions, in order, and every anchor exists', () => {
  for (const g of EN_GUIDES) {
    const h = page(g.slug);
    const nav = h.slice(h.indexOf('<nav class="g-toc"'), h.indexOf('</nav>', h.indexOf('<nav class="g-toc"')));
    const hrefs = [...nav.matchAll(/href="#([a-z0-9-]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, [...g.sections.map((s) => sectionId(s.h2)), 'faq'], g.slug);
    for (const id of hrefs) assert.equal(h.split(`id="${id}"`).length - 1, 1, `${g.slug}: #${id} exists once`);
  }
});

test('a guide links only where it linked before, plus its own anchors', () => {
  for (const g of EN_GUIDES) {
    const h = mainOf(page(g.slug));
    const allowed = new Set(['/en/', '/en/guides/', '/en/esim/', 'mailto:support@magicesim.store',
      ...g.related.map((s) => `/en/guides/${s}/`),
      ...g.sections.flatMap((s) => [...s.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))]);
    for (const [, href] of h.matchAll(/href="([^"]+)"/g)) {
      if (href.startsWith('#')) continue;
      assert.ok(allowed.has(href), `${g.slug}: ${href} is not a link the guide had`);
    }
    for (const s of g.related) assert.ok(h.includes(`<a class="g-card" href="/en/guides/${s}/">`), `${g.slug} → ${s}`);
    assert.ok(h.includes('<a class="btn" href="/en/esim/">Choose a destination</a>'));
  }
});

test('the only new words in a guide are «On this page»', () => {
  for (const g of EN_GUIDES) {
    // The lead first: «Do not delete the eSIM» is a heading AND inside a lead.
    let text = mainOf(page(g.slug)).split(esc(g.lead)).join('');
    for (const s of g.sections) text = text.replace(s.html.replace(/^\n/, '').replace(/\s+$/, ''), '').split(esc(s.h2)).join('');
    for (const f of g.faq) text = text.split(esc(f.q)).join('').split(esc(f.a)).join('');
    for (const r of EN_GUIDES) text = text.split(esc(r.h1)).join('').split(esc(r.blurb)).join('');
    for (const w of [esc(g.nav), 'Magic eSIM', 'Guides', 'Questions', 'Related guides', 'Choose a destination', 'On this page']) text = text.split(w).join('');
    const rest = text.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/[›\s]+/g, ' ').trim();
    assert.equal(rest, '', `${g.slug}: unexpected words «${rest}»`);
  }
});

test('the payment bar on all six pages is the home\'s, and still no script anywhere', () => {
  for (const h of [HUB, ...EN_GUIDES.map((g) => page(g.slug))]) {
    assert.ok(h.includes(PAYBAR));
    assert.ok(h.indexOf('id="previewNotice"') < h.indexOf('<main'));
    assert.doesNotMatch(h, /<script/i);
    assert.match(h, /<link rel="stylesheet" href="\/en\/guides\.css\?v=[0-9a-f]{8}">/);
  }
});

test('the list: all five guides as cards, in order, each with its own title and blurb', () => {
  const cards = [...HUB.matchAll(/<a class="g-card" href="\/en\/guides\/([a-z]+)\/">[\s\S]*?<h2 class="g-card-title">([^<]+)<\/h2><span class="g-card-blurb">([^<]+)<\/span>/g)];
  assert.deepEqual(cards.map((m) => m[1]), EN_GUIDES.map((g) => g.slug));
  cards.forEach((m, i) => { assert.equal(m[2], esc(EN_GUIDES[i].h1)); assert.equal(m[3], esc(EN_GUIDES[i].blurb)); });
});

test('guides.css reaches nothing outside the site and styles no class the pages do not use', () => {
  assert.doesNotMatch(CSS, /https?:\/\/|@import|url\(/i);
  let sel = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let i = 0; i < 5; i += 1) sel = sel.replace(/\{[^{}]*\}/g, ' ');
  const classes = [...new Set([...sel.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))];
  const all = [HUB, ...EN_GUIDES.map((g) => page(g.slug))].join('');
  const used = new Set([...all.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  assert.deepEqual(classes.filter((c) => !used.has(c)), []);
});
