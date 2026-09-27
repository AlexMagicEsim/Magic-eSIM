// Authored country pages must be reachable from more than the hub.
//
// Measured 2026-09-27 against Yandex Webmaster: the 56 URLs in search are
// exactly the pages the robot fetched at least once, and 16 of the 46 authored
// pages had never been fetched — while the site's most-crawled pages (/ and
// /esim/turkey/) linked to their ALPHABETICAL neighbours. «Другие направления»
// on 44 authored pages was nearby(): Turkey → Tunisia, Turks and Caicos, Tonga.
// Those neighbours got indexed; Uzbekistan, Montenegro, Qatar did not.
//
// The hub links every country, and was last fetched on 2026-08-31. So the
// invariant is: an authored page — the site's best content — is linked from at
// least two OTHER country pages. The hub does not count.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUIDES = new Set(['payment-rubles', 'dual-sim-sms', 'compatibility', 'activation-before-travel', 'not-working']);
const countries = readdirSync(join(ROOT, 'esim'))
  .filter((d) => !GUIDES.has(d) && existsSync(join(ROOT, 'esim', d, 'index.html')));
const authored = readdirSync(join(ROOT, 'seo/content-profiles'))
  .filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
  .filter((s) => JSON.parse(readFileSync(join(ROOT, 'seo/content-profiles', `${s}.json`), 'utf8')).status === 'published');

function inboundFromCountries() {
  const inbound = new Map(countries.map((c) => [c, new Set()]));
  for (const from of countries) {
    const html = readFileSync(join(ROOT, 'esim', from, 'index.html'), 'utf8');
    for (const [, to] of html.matchAll(/href="(?:\.\.\/|\/esim\/)([a-z-]+)\/"/g)) {
      if (to !== from && inbound.has(to)) inbound.get(to).add(from);
    }
  }
  return inbound;
}

test('every authored page is linked from at least two other country pages', () => {
  assert.ok(authored.length >= 46, `профилей ${authored.length}`);
  const inbound = inboundFromCountries();
  const weak = authored.filter((s) => (inbound.get(s)?.size || 0) < 2)
    .map((s) => `${s}: ${[...(inbound.get(s) || [])].join(', ') || 'ни одной'}`);
  assert.deepEqual(weak, []);
});

test('the selector sees the related block — it would pass vacuously otherwise', () => {
  const inbound = inboundFromCountries();
  assert.ok(inbound.get('bulgaria').has('turkey'), 'Турция → Болгария должна находиться');
  const total = [...inbound.values()].reduce((n, s) => n + s.size, 0);
  assert.ok(total > countries.length * 3, `ссылок между странами ${total}`);
});

test('the home page links the popular destinations statically', () => {
  // The home catalogue renders client-side; this block is the only static
  // path from the most-crawled URL on the site to a country page.
  const home = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const block = home.match(/<section aria-label="Популярные eSIM-направления"[\s\S]*?<\/section>/);
  assert.ok(block, 'блок популярных направлений исчез с главной');
  const links = [...block[0].matchAll(/href="esim\/([a-z-]+)\/"/g)].map((m) => m[1]);
  assert.ok(links.length >= 9 && links.length <= 12, `ссылок ${links.length} — блок не должен стать списком всех стран`);
  for (const s of links) assert.ok(countries.includes(s), `нет страницы /esim/${s}/`);
});
