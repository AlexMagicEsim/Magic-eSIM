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
import { loadCatalogue, countryFacts, countryOffers, coverageCodes, purchasablePrice, isDaily } from './catalogue-facts.mjs';
import { EDITORIAL_KEYS } from './content-profile.mjs';
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

test('no rendered field of a pilot profile states a rouble amount — every price on these pages is the catalogue\'s', () => {
  // The owner had every hand-written price taken out of the five pilot pages
  // (2026-10-12): the UAE FAQ first, then Egypt, Georgia, Uzbekistan and Italy.
  // Concrete prices come only from the catalogue-built price block, title and
  // FAQ answer. editor_notes and other META keys are never rendered and may keep
  // their history.
  for (const slug of PILOT) {
    const p = profile(slug);
    const walk = (v, path) => {
      if (typeof v === 'string') assert.doesNotMatch(v, /\d[\d\s ]*(₽|руб)/, `${slug}${path}`);
      else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], `${path}.${k}`);
    };
    for (const k of EDITORIAL_KEYS) if (p[k] !== undefined) walk(p[k], `.${k}`);
  }
});

// The words that replaced the prices still state RELATIONS between prices and
// the SHAPE of each ladder. With the numbers gone, test-catalogue-sync no longer
// notices when one of them stops being true, so each one is pinned here: a
// catalogue move that breaks a sentence fails the SEO-refresh PR, and a person
// rewrites the sentence. Never loosen these to make a refresh pass.
const own = (iso) => PACKAGES.filter((p) => Number(p.price) > 0 && coverageCodes(p).join() === iso);
const vol = (iso) => own(iso).filter((p) => !isDaily(p));
const at = (iso, gb, days) => vol(iso).filter((p) => Number(p.data_gb) === gb && Number(p.validity_days) === days);
const cheapest = (rows) => Math.min(...rows.map(purchasablePrice));
const ladder = (iso) => {
  const by = new Map();
  for (const p of vol(iso)) by.set(Number(p.data_gb), Math.min(by.get(Number(p.data_gb)) ?? Infinity, purchasablePrice(p)));
  return [...by.entries()].sort((a, b) => a[0] - b[0]);
};
const term = (p, days) => Number((p.term_prices || []).find((t) => Number(t.days) === days)?.price);
const kbps = (s) => { const m = String(s).match(/([\d.]+)\s*(K|M)bps/i); return m ? Number(m[1]) * (/m/i.test(m[2]) ? 1000 : 1) : NaN; };

test('egypt: the ladder, the missing 10 GB step and the price relations the copy states', () => {
  const l = ladder('EG');
  assert.deepEqual(l.map(([g]) => g), [3, 5, 7, 12, 20, 25], '«Линейка идёт 3, 5, 7, 12, 20 и 25 ГБ»');
  assert.equal(at('EG', 25, 30).length, 1, 'one local 25 GB, 30 days');
  const regional10 = PACKAGES.filter((p) => Number(p.price) > 0 && !isDaily(p) && Number(p.data_gb) === 10
    && coverageCodes(p).includes('EG') && coverageCodes(p).length > 1);
  assert.ok(regional10.length > 0, '10 GB exists only as regional');
  assert.ok(cheapest(regional10) > cheapest(at('EG', 25, 30)), 'the cheapest regional 10 GB costs more than the local 25 GB');
  const steps = l.slice(1).map(([g, pr], i) => ({ from: l[i][0], to: g, d: pr - l[i][1] }));
  const max = steps.reduce((a, b) => (b.d > a.d ? b : a));
  assert.deepEqual([max.from, max.to], [12, 20], '12 → 20 GB is the longest step by money');
  assert.ok(steps.find((x) => x.from === 20).d < max.d / 2, '20 → 25 GB is a small extra');
  const five = at('EG', 5, 30).sort((a, b) => purchasablePrice(a) - purchasablePrice(b));
  assert.equal(five.length, 2, 'two local 5 GB / 30 days');
  assert.ok(purchasablePrice(five[0]) < purchasablePrice(five[1]), 'one is cheaper');
  assert.ok(purchasablePrice(five[1]) - purchasablePrice(five[0]) <= purchasablePrice(five[0]) * 0.1, '«почти не отличаются»');
  assert.ok((five[0].networks || []).length > 0 && /5G/.test(five[0].speed), 'the cheaper card lists operators and 3G/4G/5G');
  assert.ok(!(five[1].networks || []).length && !/5G/.test(five[1].speed || ''), 'the dearer card does not');
});

test('georgia: the equal-price daily pair, the dearer smaller limit, the 3 GB twins', () => {
  const daily = own('GE').filter(isDaily);
  const pick = (gb, fup) => daily.filter((p) => Number(p.daily_gb) === gb && kbps(p.fup_policy) === fup);
  const [plain2] = pick(2, 512); const [fup2] = pick(2, 1000); const [fup3] = pick(3, 1000);
  assert.ok(plain2 && fup2 && fup3, 'the three daily plans the copy compares');
  assert.equal(term(plain2, 3), term(fup3, 3), '2 GB/day and 3 GB/day cost the same for three days');
  assert.ok(kbps(fup3.fup_policy) > kbps(plain2.fup_policy), 'the larger limit keeps the higher speed after it');
  assert.ok(term(fup2, 3) > term(fup3, 3), '2 GB/day with the soft policy costs more than 3 GB/day');
  const [t15] = at('GE', 3, 15); const [t30] = at('GE', 3, 30);
  assert.ok(t15 && t30, '3 GB is sold for 15 and for 30 days');
  assert.ok(purchasablePrice(t30) - purchasablePrice(t15) <= purchasablePrice(t15) * 0.2, '«небольшая доплата»');
  const l = ladder('GE');
  assert.equal(cheapest(vol('GE')), purchasablePrice(t15), '3 GB / 15 days is the most affordable volume plan');
  assert.equal(l.at(-1)[0], 20, '20 GB is the top volume step');
  assert.ok(at('GE', 20, 30).length && at('GE', 5, 30).length && at('GE', 10, 30).length, '5, 10, 20 GB on 30 days');
});

test('uzbekistan: 3 GB lasts 15 days, 5 and 10 GB last 30', () => {
  assert.equal(ladder('UZ')[0][0], 3, '3 GB is the bottom step');
  assert.deepEqual(vol('UZ').filter((p) => Number(p.data_gb) === 3).map((p) => Number(p.validity_days)), [15]);
  assert.ok(at('UZ', 5, 30).length && at('UZ', 10, 30).length, '5 GB and 10 GB on 30 days');
});

test('italy: 10 GB over 5 GB costs less extra than the 5 GB itself', () => {
  const p5 = cheapest(at('IT', 5, 30)); const p10 = cheapest(at('IT', 10, 30));
  assert.ok(Number.isFinite(p5) && Number.isFinite(p10));
  assert.ok(p10 - p5 < p5, '«доплата меньше цены самого пятигигабайтного»');
});

test('guides link the pilot pages: activation-before-travel → uae, egypt; payment-rubles → italy, georgia, uzbekistan', () => {
  const a = readFileSync(join(ROOT, 'esim/activation-before-travel/index.html'), 'utf8');
  const r = readFileSync(join(ROOT, 'esim/payment-rubles/index.html'), 'utf8');
  for (const s of ['uae', 'egypt']) assert.ok(a.includes(`href="/esim/${s}/"`), s);
  for (const s of ['italy', 'georgia', 'uzbekistan']) assert.ok(r.includes(`href="/esim/${s}/"`), s);
  assert.ok(r.includes('<span>eSIM для Узбекистана</span>'), 'genitive from seo/countries.mjs');
});
