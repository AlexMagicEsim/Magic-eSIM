// seo/url-migration.mjs — the one map of old paths to new ones for the EN-root migration.
//
// Pinned: every URL of the sitemap has a defined fate; one hop (no rule's target is another rule's source, no
// target equals its source); `/` and every path in STAYS are never redirected; the legal documents and the payment
// return pages keep their addresses; `/?country=XX` reaches a Russian country page. Each rule's FIRST assertion
// proves it fires.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES, STAYS, newPath, countryQueryTargets, RU_BASE, EN_CATALOGUE_BASE } from './url-migration.mjs';
import { nowAt } from '../scripts/url-migration-switch.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';
const locsOf = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
// The sitemap BEFORE the move — recorded once in seo/url-migration-switch.json (scripts/url-migration-switch.mjs); the
// committed sitemap.xml is the one AFTER it.
const SWITCH = JSON.parse(readFileSync(join(ROOT, 'seo/url-migration-switch.json'), 'utf8'));
const sitemapPaths = () => SWITCH.pairs.map(([old]) => old.replace(SITE, ''));
const currentLocs = () => locsOf(readFileSync(join(ROOT, 'sitemap.xml'), 'utf8'));

test('each rule fires on the path it names', () => {
  assert.equal(newPath('/en/'), '/');
  assert.equal(newPath('/en/esim/turkey/'), `${EN_CATALOGUE_BASE}turkey/`);
  assert.equal(newPath('/en/guides/iphone/'), '/guides/iphone/');
  assert.equal(newPath('/en/support/'), null, '/en/support/ never existed on main (a draft): nothing moves from it');
  assert.equal(newPath('/esim/turkey/'), `${RU_BASE}esim/turkey/`);
  assert.equal(newPath('/esim/'), `${RU_BASE}esim/`);
  assert.equal(newPath('/iphone.html'), '/ru/iphone.html');
  assert.equal(newPath('/android.html'), '/ru/android.html');
  for (const r of RULES) {
    const probe = r.type === 'exact' ? r.from : `${r.from}x/`;
    assert.notEqual(newPath(probe), null, `${r.from} fires`);
  }
});

test('one hop: no target is another rule source, and nothing redirects to itself', () => {
  assert.equal(newPath(newPath('/en/esim/turkey/')), null, 'the proof: a moved English country does not move again');
  const targets = RULES.map((r) => r.to);
  for (const t of targets) assert.equal(newPath(t), null, `target ${t} is not redirected again`);
  for (const p of sitemapPaths()) {
    const n = newPath(p);
    if (n !== null) {
      assert.notEqual(n, p, `${p} does not redirect to itself`);
      assert.equal(newPath(n), null, `${p} -> ${n} is one hop`);
    }
  }
});

test('the root, the legal documents, the payment pages, Pay, the Mini App and the other languages stay', () => {
  assert.equal(newPath('/'), null, 'the proof: / is a page, never a redirect');
  for (const p of STAYS) assert.equal(newPath(p), null, `${p} stays`);
  for (const p of ['/en/terms/v0.9.6/', '/en/terms/v0.9.6/magic-esim-terms-0.9.6-en.pdf', '/en/refund/v0.9.4/', '/en/privacy/v0.9.6/',
    '/en/checkout.js', '/en/en.css', '/en/destinations.js', '/pay/s/abc', '/app/index.html', '/es/esim/turkey/', '/ko/esim/japan/',
    '/payment-success.html', '/terms.html', '/privacy.html']) {
    assert.equal(newPath(p), null, `${p} stays`);
  }
});

test('every sitemap URL has a defined fate, and the moved ones land on new, distinct paths', () => {
  const paths = sitemapPaths();
  assert.ok(paths.length > 200, `the proof: the sitemap was read (${paths.length})`);
  const moved = paths.map((p) => [p, newPath(p)]).filter(([, n]) => n !== null);
  assert.ok(moved.length > 200, `the Russian catalogue moves (${moved.length})`);
  const seen = new Map();
  for (const [p, n] of moved) {
    assert.ok(!seen.has(n), `${p} and ${seen.get(n)} would share ${n}`);
    seen.set(n, p);
    assert.ok(n.startsWith(RU_BASE) || n === '/' || n.startsWith(EN_CATALOGUE_BASE) || n.startsWith('/guides/'), n);
  }
});

test('/?country=XX reaches the Russian page of every country with a page', () => {
  const cc = JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8')).countries;
  const t = countryQueryTargets(cc);
  const tr = cc.find((c) => c.iso === 'TR');
  assert.equal(t.TR, `/ru/esim/${tr.slug}/`, 'the proof');
  assert.equal(Object.keys(t).length, cc.length);
  assert.deepEqual(countryQueryTargets([{ iso: 'tr', slug: 'x' }, { iso: 'TR', slug: '../x' }]), {}, 'malformed rows are refused');
});

test('a page path without its slash lands on the final URL in one hop; files and extensionless guides too', () => {
  assert.equal(newPath('/esim/turkey'), '/ru/esim/turkey/', 'the proof: the target names the final page');
  assert.equal(newPath('/en/esim/turkey'), `${EN_CATALOGUE_BASE}turkey/`);
  assert.equal(newPath('/en/guides/iphone'), '/guides/iphone/');
  assert.equal(newPath('/esim/turkey/index.html'), '/ru/esim/turkey/index.html', 'a file keeps its name');
  assert.equal(newPath('/iphone'), '/ru/iphone.html');
  assert.equal(newPath('/android'), '/ru/android.html');
});

test('newPath refuses what is not a path', () => {
  assert.throws(() => newPath('esim/turkey/'));
  assert.throws(() => newPath(undefined));
});

// Pages created AFTER the switch of 2026-11-07. The switch record stays frozen; a new page is declared here on
// purpose, so «nothing lost» still holds and an unexpected URL in the sitemap still fails.
const ADDED_AFTER_SWITCH = Object.freeze([
  `${SITE}/ru/esim/esim-or-roaming/`,   // P2-2 of the SEO plan, 2026-11-08
  `${SITE}/ru/esim/europe/`,            // P2-3 of the SEO plan, 2026-11-08 (listed while indexed)
]);

test('the switch: every old sitemap URL lands on exactly one URL of the current sitemap, and the current one names no old path', () => {
  const now = currentLocs();
  assert.ok(now.length > 200, `the proof: the current sitemap was read (${now.length})`);
  for (const u of ADDED_AFTER_SWITCH) assert.ok(now.includes(u), `${u}: declared as added, but not in the sitemap`);
  const moved = now.filter((u) => !ADDED_AFTER_SWITCH.includes(u));
  assert.equal(SWITCH.pairs.length, moved.length, 'the same number of URLs before and after the move (pages added since are declared)');
  assert.deepEqual(SWITCH.pairs.map(([, n]) => n).sort(), [...moved].sort(), 'one to one: nothing lost, nothing added but the declared pages');
  for (const [old, n] of SWITCH.pairs) assert.equal(n, nowAt(old), `${old}: the record follows the map`);
  for (const u of now) assert.equal(newPath(u.replace(SITE, '')), null, `${u} is a final URL, never a redirect source`);
  assert.ok(now.includes(`${SITE}/`) && now.includes(`${SITE}/ru/`), 'both homes');
  assert.equal(nowAt(`${SITE}/`), `${SITE}/ru/`, 'the old «/» was the Russian home');
});

test('the one-time IndexNow list: the new Russian URLs, the old Russian addresses and «/» — nothing English, nothing outside the site', () => {
  const list = SWITCH.indexnow_once;
  assert.ok(list.includes(`${SITE}/`) && list.includes(`${SITE}/ru/`) && list.includes(`${SITE}/ru/esim/turkey/`) && list.includes(`${SITE}/esim/turkey/`));
  for (const u of list) {
    assert.ok(u.startsWith(`${SITE}/`), u);
    assert.ok(u === `${SITE}/` || nowAt(u).startsWith(`${SITE}/ru/`) || u.startsWith(`${SITE}/ru/`) || ['/terms.html', '/privacy.html'].includes(u.slice(SITE.length)), `${u}: Russian or «/»`);
    assert.ok(!/\/(destinations|guides|en|es|de|fr|zh|ko)\//.test(u.slice(SITE.length)), `${u}: no international page`);
  }
  assert.equal(new Set(list).size, list.length);
  // No automation reads it: it is the owner's list for the day of the switch.
  for (const f of ['.github/workflows/indexnow.yml', 'seo/indexnow.mjs', 'scripts/indexnow-submit.mjs']) {
    let src = ''; try { src = readFileSync(join(ROOT, f), 'utf8'); } catch { continue; }
    assert.doesNotMatch(src, /url-migration-switch/, `${f} must not read the one-time list`);
  }
});
