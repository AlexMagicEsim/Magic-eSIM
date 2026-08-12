#!/usr/bin/env node
// Сбор данных из всех источников в один снимок.
//
//   node seo/intel/collect.mjs              всё, что доступно
//   node seo/intel/collect.mjs --commerce   только продажи (нужен psql и .env бэкенда)
//
// Пишет seo/intel/data/*.json. Недоступный источник записывается как
// недоступный — с причиной, а не пропускается молча.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { fetchSearchConsole, fetchYandexWebmaster, fetchMetrika } from './sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = join(ROOT, 'seo/intel/data');
mkdirSync(DATA, { recursive: true });

const BACKEND = process.env.ESIM_BACKEND_DIR || join(homedir(), 'esim-backend');

// Продажи по странам. Запускается через psql бэкенда, чтобы витрине не
// требовались собственные доступы к базе.
function collectCommerce() {
  const sql = `
    select country_code,
           count(*)                                                        as orders,
           count(*) filter (where status = 'completed')                    as completed_orders,
           coalesce(sum(amount_rub) filter (where status = 'completed'), 0) as revenue_rub,
           coalesce(sum(retail_price_rub_at_sale - coalesce(provider_price_rub_at_sale, 0))
                    filter (where status = 'completed'), 0)                 as profit_rub,
           min(created_at)::date::text                                      as first_order,
           max(created_at)::date::text                                      as last_order
      from retail_orders
     where coalesce(test_order, false) = false
       and country_code is not null
     group by 1`;
  const out = execFileSync('bash', ['-c',
    `set -a; source "${BACKEND}/.env"; set +a; psql "$DATABASE_URL" -tAF'|' -c "${sql.replace(/\n\s*/g, ' ')}"`,
  ], { encoding: 'utf8', timeout: 120000 });

  const byCountry = {};
  for (const line of out.trim().split('\n').filter(Boolean)) {
    const [iso, orders, completed, revenue, profit, first, last] = line.split('|');
    byCountry[iso] = {
      orders: Number(orders),
      completed_orders: Number(completed),
      revenue_rub: Number(revenue),
      profit_rub: Number(profit),
      first_order: first || null,
      last_order: last || null,
    };
  }
  // Атрибуция страницы ещё не включена — это записано в самом снимке, чтобы
  // потребитель не мог принять данные за страничные.
  return {
    fetched_at: new Date().toISOString(),
    granularity: 'country',
    attribution_note: 'заказ знает страну, но не страницу входа — см. seo/intel/attribution.mjs',
    total_orders: Object.values(byCountry).reduce((a, x) => a + x.orders, 0),
    total_completed: Object.values(byCountry).reduce((a, x) => a + x.completed_orders, 0),
    total_revenue_rub: Object.values(byCountry).reduce((a, x) => a + x.revenue_rub, 0),
    countries: byCountry,
  };
}

const only = process.argv.slice(2);
const want = (name) => only.length === 0 || only.includes(`--${name}`);
const report = [];

if (want('commerce')) {
  try {
    const data = collectCommerce();
    writeFileSync(join(DATA, 'commerce.json'), `${JSON.stringify(data, null, 2)}\n`);
    report.push(`продажи: ${data.total_completed} выполненных заказов, ${Math.round(data.total_revenue_rub)} ₽, ${Object.keys(data.countries).length} стран`);
  } catch (e) {
    writeFileSync(join(DATA, 'commerce.json'), `${JSON.stringify({ error: e.message, fetched_at: new Date().toISOString() }, null, 2)}\n`);
    report.push(`продажи: не собрались — ${e.message.split('\n')[0]}`);
  }
}

for (const [name, fn, file] of [
  ['search', fetchSearchConsole, 'search-console.json'],
  ['webmaster', fetchYandexWebmaster, 'yandex-webmaster.json'],
  ['metrika', fetchMetrika, 'yandex-metrika.json'],
]) {
  if (!want(name)) continue;
  const res = await fn();
  writeFileSync(join(DATA, file), `${JSON.stringify(res, null, 2)}\n`);
  report.push(`${name}: ${res.available ? 'собрано' : `недоступно — ${res.reason}`}`);
}

console.log(report.join('\n'));
