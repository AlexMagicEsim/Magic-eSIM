// The one machine-readable seller entity (seo/seller-entity.mjs): declared in
// full on the home page, referenced by @id from the five SEO-pilot pages'
// publisher and Product offer. Only facts the site already publishes; nothing
// invented. Every other page is out of scope and keeps its inline Organization.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SELLER_ID, SELLER_NODE, SELLER_REF, SUPPORT_EMAIL, SAME_AS, SITE } from './seller-entity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const PILOT = ['uae', 'egypt', 'georgia', 'uzbekistan', 'italy'];

function ldNodes(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 1, 'no JSON-LD at all');
  const nodes = [];
  for (const b of blocks) {
    const json = JSON.parse(b); // must parse
    nodes.push(...(json['@graph'] || [json]));
  }
  return nodes;
}
const walk = (v, f) => { if (v && typeof v === 'object') { f(v); for (const x of Object.values(v)) walk(x, f); } };

const FORBIDDEN = ['aggregateRating', 'review', 'address', 'foundingDate', 'legalName', 'hasMerchantReturnPolicy',
  'telephone', 'vatID', 'taxID', 'numberOfEmployees', 'founder'];

test('the home page declares the seller exactly once, as OnlineStore with the stable @id and only published facts', () => {
  const home = read('index.html');
  const nodes = ldNodes(home);
  const sellers = nodes.filter((n) => n['@id'] === SELLER_ID);
  assert.equal(sellers.length, 1);
  assert.deepEqual(sellers[0], JSON.parse(JSON.stringify(SELLER_NODE)), 'index.html and seo/seller-entity.mjs must agree');
  assert.equal(sellers[0]['@type'], 'OnlineStore');
  assert.equal(nodes.filter((n) => n['@type'] === 'Organization').length, 0, 'no second, anonymous organization');
  for (const k of FORBIDDEN) assert.ok(!(k in sellers[0]), `${k} is not public — never invent it`);
  // Every contact and profile is one the page itself already shows.
  assert.ok(home.includes(`mailto:${SUPPORT_EMAIL}`) || home.includes(SUPPORT_EMAIL), 'support email not on the page');
  for (const u of SAME_AS) assert.ok(home.includes(u), `${u} is not linked from the site`);
  assert.equal(sellers[0].logo, `${SITE}/assets/magic-esim-logo.png`);
  assert.ok(existsSync(join(ROOT, 'assets/magic-esim-logo.png')), 'logo file missing');
  assert.match(sellers[0].description, /190\+ направлениях/, 'the one measured wording');
});

for (const slug of PILOT) {
  test(`${slug}: publisher and Product offer point at the one seller; JSON-LD parses`, () => {
    const nodes = ldNodes(read(`esim/${slug}/index.html`));
    const page = nodes.find((n) => n['@type'] === 'WebPage');
    assert.deepEqual(page.publisher, JSON.parse(JSON.stringify(SELLER_REF)));
    const product = nodes.find((n) => n['@type'] === 'Product');
    assert.ok(product, 'pilot page lost its Product');
    assert.equal(product.offers['@type'], 'AggregateOffer');
    assert.deepEqual(product.offers.seller, JSON.parse(JSON.stringify(SELLER_REF)));
    assert.equal(product.brand.name, 'Magic eSIM');
    // Nothing invented anywhere on the page.
    walk(nodes, (n) => { for (const k of ['aggregateRating', 'review']) assert.ok(!(k in n), `${slug}: ${k}`); });
  });
}

test('out of scope: no other country page references the seller @id (pilot only, owner 2026-10-14)', () => {
  let checked = 0;
  for (const slug of readdirSync(join(ROOT, 'esim'))) {
    const f = join(ROOT, 'esim', slug, 'index.html');
    if (PILOT.includes(slug) || !existsSync(f)) continue;
    const h = readFileSync(f, 'utf8');
    assert.ok(!h.includes(SELLER_ID), `${slug} references the seller — the scope is the five pilot pages`);
    checked++;
  }
  assert.ok(checked >= 190, `only ${checked} pages checked`);
  assert.ok(!read('en/index.html').includes(SELLER_ID), 'the English home is out of scope');
});

test('every JSON-LD block on the home, all country pages and the English home parses', () => {
  const files = ['index.html', 'en/index.html', ...readdirSync(join(ROOT, 'esim'))
    .map((s) => `esim/${s}/index.html`).filter((f) => existsSync(join(ROOT, f)))];
  for (const f of files) {
    const h = read(f);
    for (const [, b] of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => JSON.parse(b), f);
    }
  }
});
