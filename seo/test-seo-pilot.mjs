// The Google SEO pilot (approved 2026-10-12; docs: handoff 10-11 §5j).
//
// Five country pages — uae, egypt, georgia, uzbekistan, italy — get a commercial
// title and H1, a STATIC price block, Product + AggregateOffer, and a price FAQ.
// Five authored, indexed pages are the untouched CONTROL group the result is
// measured against in Search Console.
//
// What this pins:
//   - exactly the five pages carry the pilot; no other page has a price block or a
//     Product — the control group above all;
//   - every number the pilot prints is the catalogue's (assets/catalog.json via
//     countryOffers/countryFacts), so a bot refresh + the SEO-refresh rebuild moves
//     them, and nothing in a profile can state a price;
//   - the structured data says exactly what the page shows.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalogue, countryFacts, countryOffers } from './catalogue-facts.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PILOT = ['uae', 'egypt', 'georgia', 'uzbekistan', 'italy'];
const CONTROL = ['cyprus', 'spain', 'usa', 'albania', 'kyrgyzstan'];
const PACKAGES = loadCatalogue();
const ISO = Object.fromEntries(Object.entries(COUNTRY_NAMES).map(([iso, e]) => [e.slug, iso]));

const html = (slug) => readFileSync(join(ROOT, 'esim', slug, 'index.html'), 'utf8');
const profile = (slug) => JSON.parse(readFileSync(join(ROOT, 'seo/content-profiles', `${slug}.json`), 'utf8'));
const graph = (h) => JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
const money = (v) => Math.round(Number(v)).toLocaleString('ru-RU');
const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('exactly the five pilot profiles carry seo_pilot', () => {
  const withPilot = readdirSync(join(ROOT, 'seo/content-profiles'))
    .filter((f) => f.endsWith('.json'))
    .filter((f) => JSON.parse(readFileSync(join(ROOT, 'seo/content-profiles', f), 'utf8')).seo_pilot)
    .map((f) => f.replace('.json', '')).sort();
  assert.deepEqual(withPilot, [...PILOT].sort());
});

test('no pilot string states a price, and no pilot profile keeps a hand-written title or description', () => {
  for (const slug of PILOT) {
    const p = profile(slug);
    for (const [k, v] of Object.entries(p.seo_pilot)) assert.doesNotMatch(v, /\d[\d\s ]*₽/, `${slug}: seo_pilot.${k}`);
    assert.equal(p.title, undefined, `${slug}: title`);
    assert.equal(p.description, undefined, `${slug}: description`);
  }
});

test('no other country page has a price block or a Product — the control group above all', () => {
  const pages = readdirSync(join(ROOT, 'esim'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(ROOT, 'esim', d.name, 'index.html'))).map((d) => d.name);
  for (const slug of pages.filter((s) => !PILOT.includes(s))) {
    const h = html(slug);
    assert.doesNotMatch(h, /id="prices"/, slug);
    assert.doesNotMatch(h, /"@type":"Product"/, slug);
  }
  for (const slug of CONTROL) assert.ok(existsSync(join(ROOT, 'esim', slug, 'index.html')), `control ${slug} exists`);
});

for (const slug of PILOT) {
  test(`${slug}: title, H1, canonical, description — commercial intent, catalogue floor`, () => {
    const h = html(slug); const p = profile(slug); const f = countryFacts(PACKAGES, ISO[slug]);
    const title = h.match(/<title>([^<]*)<\/title>/)[1];
    assert.equal(title, `${p.seo_pilot.name} — тарифы и цены от ${money(f.min_price_rub)} ₽ | Magic eSIM`);
    assert.ok(title.length <= 70, `title ${title.length} chars`);
    assert.equal(text(h.match(/<h1>([\s\S]*?)<\/h1>/)[1]), p.h1);
    assert.match(p.h1, /^eSIM для /);
    assert.match(h, new RegExp(`<link rel="canonical" href="https://magicesim\\.store/esim/${slug}/" />`));
    assert.match(h, /<meta name="robots" content="index, follow" \/>/);
    const desc = h.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.ok(desc.startsWith(`${p.seo_pilot.name}: `) && desc.includes(`от ${money(f.min_price_rub)} ₽`), desc);
  });

  test(`${slug}: the static price block lists exactly the catalogue's local tariffs and ranges`, () => {
    const h = html(slug); const o = countryOffers(PACKAGES, ISO[slug]);
    const block = h.match(/<section class="cp-sec prices" id="prices"[\s\S]*?<\/section>/)[0];
    const rows = [...block.matchAll(/<li>([^<]*) — <b>([^<]*) ₽<\/b><\/li>/g)].map((m) => `${m[1]}=${m[2]}`);
    assert.equal(rows.length, o.local.length);
    o.local.forEach((r, i) => assert.ok(rows[i].endsWith(`=${money(r.price)}`) && rows[i].startsWith(`${r.gb % 1 === 0 ? r.gb : r.gb.toFixed(1)} ГБ на ${r.days} `), `${rows[i]} vs ${JSON.stringify(r)}`));
    assert.match(text(block), new RegExp(`Всего тарифов с покрытием страны: ${o.all.count} , цены (от )?${money(o.all.min).replace(/\s/g, '\\s')}`));
    assert.ok(text(block).includes(`${money(o.all.max).replace(/\s/g, ' ')} ₽`), 'the highest price is printed');
  });

  test(`${slug}: Product/AggregateOffer says exactly what the block shows`, () => {
    const g = graph(html(slug)); const o = countryOffers(PACKAGES, ISO[slug]);
    const prod = g.filter((x) => x['@type'] === 'Product');
    assert.equal(prod.length, 1);
    assert.deepEqual(
      { cur: prod[0].offers.priceCurrency, low: prod[0].offers.lowPrice, high: prod[0].offers.highPrice, n: prod[0].offers.offerCount },
      { cur: 'RUB', low: o.all.min, high: o.all.max, n: o.all.count });
    assert.equal(prod[0].name, profile(slug).seo_pilot.name);
    assert.equal(prod[0].offers.url, `https://magicesim.store/esim/${slug}/#prices`);
  });

  test(`${slug}: the price question is in the visible FAQ and in FAQPage, with catalogue numbers`, () => {
    const h = html(slug); const p = profile(slug); const o = countryOffers(PACKAGES, ISO[slug]);
    const faq = graph(h).find((x) => x['@type'] === 'FAQPage').mainEntity;
    const q = faq.find((x) => x.name === p.seo_pilot.price_question);
    assert.ok(q, 'in FAQPage');
    assert.ok(h.includes(`<summary>${p.seo_pilot.price_question}</summary>`), 'visible');
    if (o.local.length) assert.ok(q.acceptedAnswer.text.includes(money(o.localRange.min)), q.acceptedAnswer.text);
    if (o.daily.count) assert.ok(q.acceptedAnswer.text.includes(money(o.daily.min)), q.acceptedAnswer.text);
    // The visible FAQ and FAQPage stay one list.
    const visible = [...h.matchAll(/<summary>([^<]*)<\/summary>/g)].map((m) => m[1]);
    assert.deepEqual(visible, faq.map((x) => x.name.replaceAll('&', '&amp;').replaceAll('"', '&quot;')));
  });

  test(`${slug}: the angle heading and the related links are rendered`, () => {
    const h = html(slug); const p = profile(slug);
    assert.ok(h.includes(`<h2>${p.seo_pilot.angle}</h2>`), 'angle h2');
    for (const r of p.related || []) assert.ok(h.includes(`href="../${r}/"`), `related ${r}`);
  });
}

test('UAE: the Dubai intent is in the title, H1, price heading and question', () => {
  const h = html('uae');
  assert.match(h.match(/<title>([^<]*)/)[1], /Дубая/);
  assert.match(h.match(/<h1>([^<]*)/)[1], /Дубая/);
  assert.match(h, /<h2 id="pricesTitle">Сколько стоит eSIM в Дубае и ОАЭ<\/h2>/);
  assert.match(h, /<summary>Сколько стоит eSIM в Дубае\?<\/summary>/);
});

test('guides link the pilot pages: activation-before-travel → uae, egypt; payment-rubles → italy, georgia', () => {
  const a = readFileSync(join(ROOT, 'esim/activation-before-travel/index.html'), 'utf8');
  const r = readFileSync(join(ROOT, 'esim/payment-rubles/index.html'), 'utf8');
  for (const s of ['uae', 'egypt']) assert.ok(a.includes(`href="/esim/${s}/"`), s);
  for (const s of ['italy', 'georgia']) assert.ok(r.includes(`href="/esim/${s}/"`), s);
});
