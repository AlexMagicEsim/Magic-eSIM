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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';
const sitemapPaths = () => [...readFileSync(join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].replace(SITE, ''));

test('each rule fires on the path it names', () => {
  assert.equal(newPath('/en/'), '/');
  assert.equal(newPath('/en/esim/turkey/'), `${EN_CATALOGUE_BASE}turkey/`);
  assert.equal(newPath('/en/guides/iphone/'), '/guides/iphone/');
  assert.equal(newPath('/en/support/'), '/support/');
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
    assert.ok(n.startsWith(RU_BASE) || n === '/' || n.startsWith(EN_CATALOGUE_BASE) || n.startsWith('/guides/') || n.startsWith('/support/'), n);
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

test('newPath refuses what is not a path', () => {
  assert.throws(() => newPath('esim/turkey/'));
  assert.throws(() => newPath(undefined));
});
