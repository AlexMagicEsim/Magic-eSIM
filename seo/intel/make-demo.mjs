#!/usr/bin/env node
// Синтетические данные для проверки механики.
//
// Существует ровно потому, что настоящих Search Console и Метрики пока нет, а
// убедиться, что оценки, статусы, запреты и рекомендации работают, надо до
// того, как данные появятся. Пишет в отдельный каталог: демо-цифры физически
// не могут попасть туда, откуда читается реальный отчёт.
//
//   node seo/intel/make-demo.mjs && INTEL_DATA_DIR=seo/intel/data-demo node seo/content-dashboard.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCached } from '../catalogue-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'seo/intel/data-demo');
mkdirSync(join(OUT, 'snapshots'), { recursive: true });

const { countries } = loadCached();
// Детерминированный «шум»: одна и та же страна всегда получает одни и те же
// числа, иначе каждый прогон демо выглядел бы как изменение метрик.
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 100000; return h; };
const rnd = (slug, salt, min, max) => min + ((hash(slug + salt) % 1000) / 1000) * (max - min);

const gscRows = [];
const metrikaRows = [];
const commerce = {};
const TOP = new Set(['thailand', 'turkey', 'uae', 'usa', 'japan', 'china', 'south-korea', 'vietnam',
  'indonesia', 'singapore', 'france', 'germany', 'united-kingdom', 'italy', 'spain']);

for (const c of countries) {
  const big = TOP.has(c.slug);
  const impressions = Math.round(rnd(c.slug, 'i', big ? 2000 : 20, big ? 30000 : 900));
  const position = rnd(c.slug, 'p', big ? 3 : 12, big ? 22 : 60);
  const baseCtr = position <= 10 ? 0.05 : position <= 20 ? 0.02 : 0.006;
  const ctr = Math.max(0.0005, baseCtr * rnd(c.slug, 'c', 0.3, 2.0));
  const clicks = Math.max(0, Math.round(impressions * ctr));
  gscRows.push({ keys: [`https://magicesim.store/esim/${c.slug}/`, `esim ${c.nameRu.toLowerCase()}`],
    impressions: Math.round(impressions * 0.6), clicks: Math.round(clicks * 0.6), ctr, position });
  gscRows.push({ keys: [`https://magicesim.store/esim/${c.slug}/`, `интернет ${c.nameRu.toLowerCase()} туристу`],
    impressions: Math.round(impressions * 0.4), clicks: Math.round(clicks * 0.4), ctr: ctr * 0.8, position: position + 6 });

  const pageviews = Math.max(0, Math.round(clicks * rnd(c.slug, 'v', 0.8, 1.4)));
  metrikaRows.push({ dimensions: [{ name: `/esim/${c.slug}/` }],
    metrics: [pageviews, Math.round(pageviews * 0.85), rnd(c.slug, 't', 15, 180), rnd(c.slug, 'b', 25, 88)] });

  const orders = Math.round(pageviews * rnd(c.slug, 'o', 0, 0.03));
  if (orders > 0) {
    const revenue = orders * rnd(c.slug, 'r', 400, 3000);
    commerce[c.iso] = { orders: orders + 1, completed_orders: orders,
      revenue_rub: Math.round(revenue), profit_rub: Math.round(revenue * 0.35),
      first_order: '2026-06-01', last_order: '2026-08-12' };
  }
}

writeFileSync(join(OUT, 'search-console.json'), `${JSON.stringify({
  available: true, reason: null, source: 'google-search-console', fetched_at: new Date().toISOString(),
  DEMO: true, data: { rows: gscRows, days: 28 },
}, null, 2)}\n`);

writeFileSync(join(OUT, 'yandex-metrika.json'), `${JSON.stringify({
  available: true, reason: null, source: 'yandex-metrika', fetched_at: new Date().toISOString(),
  DEMO: true, data: { data: metrikaRows, days: 28 },
}, null, 2)}\n`);

writeFileSync(join(OUT, 'commerce.json'), `${JSON.stringify({
  DEMO: true, fetched_at: new Date().toISOString(), granularity: 'country',
  total_orders: Object.values(commerce).reduce((a, x) => a + x.orders, 0),
  total_completed: Object.values(commerce).reduce((a, x) => a + x.completed_orders, 0),
  total_revenue_rub: Object.values(commerce).reduce((a, x) => a + x.revenue_rub, 0),
  countries: commerce,
}, null, 2)}\n`);

console.log(`демо-данные → seo/intel/data-demo/ (${countries.length} стран, `
  + `${Object.keys(commerce).length} с заказами)`);
