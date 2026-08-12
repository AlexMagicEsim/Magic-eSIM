#!/usr/bin/env node
// Отчёт по данным Метрики: что реально пришло и что на этом можно построить.
//
// Отдельно от общей панели, потому что вопросы здесь другие — не «как дела у
// страницы», а «хватает ли данных, чтобы вообще судить». Пока подключён один
// источник, это и есть главный вопрос.
//
//   node seo/intel/metrika-report.mjs

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages } from './metrics.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = join(ROOT, process.env.INTEL_DATA_DIR || 'seo/intel/data');
const read = (f) => (existsSync(join(DATA, f)) ? JSON.parse(readFileSync(join(DATA, f), 'utf8')) : null);

const goalsFile = read('yandex-metrika-goals.json');
const metrika = read('yandex-metrika.json');

if (!metrika || !metrika.available) {
  console.log('Метрика не подключена.');
  console.log(`  причина: ${metrika?.reason || 'снимок не собирался'}`);
  console.log('\n  1. Получи токен: https://oauth.yandex.ru → приложение со scope metrika:read');
  console.log('  2. Положи в .env: YANDEX_METRIKA_TOKEN=...   (.env в .gitignore)');
  console.log('  3. node seo/intel/collect.mjs --metrika');
  process.exit(1);
}

const n = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString('ru-RU') : '—');
const pct = (v, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—');

// ---------------------------------------------------------------------------
console.log('══ 1. ПЕРИОД И ОХВАТ ══');
const d = metrika.data;
console.log(`  счётчик ${d.counter}, окно ${d.days} дней, собрано ${metrika.fetched_at?.slice(0, 16).replace('T', ' ')}`);
console.log(`  строк по страницам входа: ${(d.visits?.data || []).length}`);
console.log(`  строк по просмотрам: ${(d.pageviews?.data || []).length}`);
console.log(`  строк по страницам выхода: ${(d.exits?.data || []).length}`);

// ---------------------------------------------------------------------------
console.log('\n══ 2. ЦЕЛИ СЧЁТЧИКА ══');
if (goalsFile?.available) {
  const goals = goalsFile.data.goals;
  console.log(`  всего целей: ${goals.length}`);
  console.log(`  ${'id'.padEnd(10)} ${'событие'.padEnd(24)} тип   название`);
  for (const g of goals) {
    console.log(`  ${String(g.id).padEnd(10)} ${String(g.event || '—').padEnd(24)} ${String(g.type || '').padEnd(5)} ${g.name}`);
  }
} else {
  console.log(`  не получены: ${goalsFile?.reason || 'нет файла'}`);
}

// ---------------------------------------------------------------------------
const { pages } = buildPages();
const withData = pages.filter((p) => p.behaviour.available && Number.isFinite(p.behaviour.visits) && p.behaviour.visits > 0);
const noData = pages.filter((p) => !withData.includes(p));

console.log('\n══ 3. СКОЛЬКО СТРАНИЦ С ДАННЫМИ ══');
console.log(`  страниц стран всего: ${pages.length}`);
console.log(`  с визитами за период: ${withData.length}`);
console.log(`  без единого визита: ${noData.length}`);

const table = (rows, cols) => {
  if (!rows.length) { console.log('  нет данных'); return; }
  console.log('  ' + 'страна'.padEnd(22) + cols.map((c) => c.head.padStart(c.w)).join(''));
  for (const r of rows) console.log('  ' + r.name_ru.padEnd(22) + cols.map((c) => String(c.get(r)).padStart(c.w)).join(''));
};

console.log('\n══ 4. ТОП ПО ВИЗИТАМ ══');
table(withData.slice().sort((a, b) => b.behaviour.visits - a.behaviour.visits).slice(0, 15), [
  { head: 'визиты', w: 9, get: (r) => n(r.behaviour.visits) },
  { head: 'польз.', w: 9, get: (r) => n(r.behaviour.users) },
  { head: 'просм.', w: 9, get: (r) => n(r.behaviour.pageviews) },
  { head: 'отказы', w: 9, get: (r) => pct(r.behaviour.bounce_rate, 0) },
  { head: 'с/визит', w: 9, get: (r) => n(r.behaviour.avg_visit_duration_sec) },
]);

console.log('\n══ 5. ТОП ПО ОТКРЫТИЮ ОФОРМЛЕНИЯ (checkout_open) ══');
const byCheckout = withData.filter((p) => Number.isFinite(p.behaviour.funnel?.checkout))
  .sort((a, b) => b.behaviour.funnel.checkout - a.behaviour.funnel.checkout).slice(0, 15);
table(byCheckout, [
  { head: 'визиты', w: 9, get: (r) => n(r.behaviour.visits) },
  { head: 'клик тар.', w: 11, get: (r) => n(r.behaviour.funnel.entry) },
  { head: 'checkout', w: 10, get: (r) => n(r.behaviour.funnel.checkout) },
  { head: 'доля', w: 8, get: (r) => pct(r.behaviour.visits ? r.behaviour.funnel.checkout / r.behaviour.visits : null, 1) },
]);

console.log('\n══ 6. ТОП ПО ОПЛАТАМ (payment_success) ══');
const byPay = withData.filter((p) => Number.isFinite(p.behaviour.funnel?.purchase) && p.behaviour.funnel.purchase > 0)
  .sort((a, b) => b.behaviour.funnel.purchase - a.behaviour.funnel.purchase).slice(0, 15);
table(byPay, [
  { head: 'визиты', w: 9, get: (r) => n(r.behaviour.visits) },
  { head: 'checkout', w: 10, get: (r) => n(r.behaviour.funnel.checkout) },
  { head: 'оплаты', w: 9, get: (r) => n(r.behaviour.funnel.purchase) },
  { head: 'сбои', w: 7, get: (r) => n(r.behaviour.funnel.failure) },
  { head: 'конв.', w: 8, get: (r) => pct(r.behaviour.visits ? r.behaviour.funnel.purchase / r.behaviour.visits : null, 2) },
]);
if (!byPay.length) console.log('  ни одной оплаты, привязанной к странице входа, за период');

// ---------------------------------------------------------------------------
// Трафик есть, а до оформления не доходят. Порог по визитам обязателен: без
// него список возглавят страницы с тремя визитами и нулём кликов.
const MIN_VISITS = 30;
console.log(`\n══ 7. ТРАФИК ЕСТЬ — В CHECKOUT НЕ ИДУТ (от ${MIN_VISITS} визитов) ══`);
const candidates = withData.filter((p) => p.behaviour.visits >= MIN_VISITS && Number.isFinite(p.behaviour.funnel?.checkout));
const rates = candidates.map((p) => p.behaviour.funnel.checkout / p.behaviour.visits).sort((a, b) => a - b);
const median = rates.length ? rates[Math.floor(rates.length / 2)] : null;
console.log(`  медиана перехода в оформление: ${pct(median, 2)} по ${candidates.length} страницам`);
const weak = candidates.filter((p) => median !== null && p.behaviour.funnel.checkout / p.behaviour.visits < median * 0.5)
  .sort((a, b) => b.behaviour.visits - a.behaviour.visits).slice(0, 15);
table(weak, [
  { head: 'визиты', w: 9, get: (r) => n(r.behaviour.visits) },
  { head: 'checkout', w: 10, get: (r) => n(r.behaviour.funnel.checkout) },
  { head: 'доля', w: 8, get: (r) => pct(r.behaviour.funnel.checkout / r.behaviour.visits, 2) },
  { head: 'отказы', w: 9, get: (r) => pct(r.behaviour.bounce_rate, 0) },
]);

console.log('\n══ 8. СТРАНИЦЫ БЕЗ ТРАФИКА ══');
console.log(`  ${noData.length} страниц без визитов за ${d.days} дней`);
console.log(`  ${noData.slice(0, 20).map((p) => p.name_ru).join(', ')}${noData.length > 20 ? ` … и ещё ${noData.length - 20}` : ''}`);

// ---------------------------------------------------------------------------
console.log('\n══ 9. ЧТО ИЗ ВОРОНКИ УЖЕ СТРОИТСЯ БЕЗ МИГРАЦИИ ══');
const step = (label, key) => {
  const have = withData.filter((p) => Number.isFinite(p.behaviour.funnel?.[key]));
  const sum = have.reduce((a, p) => a + p.behaviour.funnel[key], 0);
  console.log(`  ${label.padEnd(26)} страниц с данными ${String(have.length).padStart(4)}   сумма ${n(sum)}`);
};
step('визит (вход)', 'entry');
step('клик «купить»', 'intent');
step('открытие оформления', 'checkout');
step('попытка оплаты', 'payment_attempt');
step('успешная оплата', 'purchase');
step('сбой оплаты', 'failure');
console.log('\n  Чего Метрика не даст без миграции:');
console.log('    — суммы заказа и прибыли на страницу (деньги живут в retail_orders);');
console.log('    — атрибуции, если посетитель вошёл на лендинг и открыл страну потом;');
console.log('    — связи конкретного заказа с конкретной страницей.');
console.log('\n  Чего нет в API Метрики вообще:');
for (const [k, v] of Object.entries(d.unavailable_metrics || {})) console.log(`    — ${k}: ${v}`);
