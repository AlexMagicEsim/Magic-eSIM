// Сборка канонической записи страницы из всех источников.
//
// Один формат, из которого считают Performance Score, статусы, приоритет и
// рекомендации. Ключевое свойство формата: у каждого блока есть `available`.
// Отсутствующий источник даёт available:false и причину — и это НЕ ноль.
//
// Если однажды кто-то заменит здесь `?? 0`, вся система начнёт врать: страницы
// без Search Console получат CTR 0% и уедут в Needs Improvement всем корпусом.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCached } from '../catalogue-source.mjs';
import { PROFILE_DIR } from '../content-profile.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
// Каталог данных можно подменить — этим пользуется только демо-режим, чтобы
// синтетические цифры физически не могли попасть в тот же файл, что реальные.
const DATA = process.env.INTEL_DATA_DIR
  ? join(ROOT, process.env.INTEL_DATA_DIR)
  : join(ROOT, 'seo/intel/data');
export const IS_DEMO = Boolean(process.env.INTEL_DATA_DIR);

const readJson = (file) => {
  const f = join(DATA, file);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; }
};

/** slug из URL страницы страны; null для всего остального. */
export function slugFromUrl(url) {
  const m = String(url || '').match(/\/esim\/([a-z0-9-]+)\/?(?:[?#]|$)/i);
  return m ? m[1].toLowerCase() : null;
}

function searchByPage(gsc) {
  // GSC отдаёт строки [page, query]; собираем в страницы и запросы.
  if (!gsc || !gsc.available) return { available: false, reason: gsc?.reason || 'нет данных', pages: new Map() };
  const pages = new Map();
  for (const row of gsc.data.rows || []) {
    const [url, query] = row.keys || [];
    const slug = slugFromUrl(url);
    if (!slug) continue;
    if (!pages.has(slug)) pages.set(slug, { impressions: 0, clicks: 0, queries: [] });
    const p = pages.get(slug);
    p.impressions += row.impressions || 0;
    p.clicks += row.clicks || 0;
    p.queries.push({
      query, impressions: row.impressions || 0, clicks: row.clicks || 0,
      ctr: row.ctr || 0, position: row.position || null,
    });
  }
  for (const p of pages.values()) {
    p.ctr = p.impressions > 0 ? p.clicks / p.impressions : 0;
    // Позиция страницы — средневзвешенная по показам её запросов. Простое
    // среднее дало бы одинаковый вес запросу с 5000 показов и с тремя.
    const withPos = p.queries.filter((q) => Number.isFinite(q.position));
    const w = withPos.reduce((a, q) => a + q.impressions, 0);
    p.position = w > 0 ? withPos.reduce((a, q) => a + q.position * q.impressions, 0) / w : null;
    p.queries.sort((a, b) => b.impressions - a.impressions);
    p.top_queries = p.queries.slice(0, 10);
    delete p.queries;
  }
  return { available: true, reason: null, pages };
}

// Имена целей, которые сайт отправляет через reachGoal. Их роль в воронке
// зафиксирована здесь один раз, чтобы дальше по коду не гадать, что считать
// кликом в checkout, а что — покупкой.
export const FUNNEL = Object.freeze({
  entry: ['country_tariff_click'],                       // клик по тарифу на странице страны
  intent: ['tariff_buy_click'],                          // клик «купить» в карточке
  checkout: ['checkout_open'],                           // открылась форма оформления
  payment_attempt: ['payment_sbp_click', 'payment_card_click'],
  purchase: ['payment_success'],
  failure: ['payment_failed', 'payment_canceled', 'payment_tech_error'],
});

/** Строка ответа Метрики → { slug, metrics[] }. Не-страны отбрасываются. */
function rowsBySlug(block) {
  const out = new Map();
  for (const row of (block && block.data) || []) {
    const slug = slugFromUrl(row.dimensions?.[0]?.name);
    if (!slug) continue;
    // Один slug может встретиться дважды (с параметрами и без) — суммируем.
    const prev = out.get(slug);
    if (!prev) out.set(slug, row.metrics.slice());
    else prev.forEach((v, i) => { prev[i] = (v || 0) + (row.metrics[i] || 0); });
  }
  return out;
}

/** Тестовый вход к разбору ответа Метрики: парсер должен проверяться отдельно
 *  от файловой системы и от каталога. */
export function behaviourFixtureCheck(metrika) {
  return behaviourByPage(metrika).pages;
}

function behaviourByPage(metrika) {
  if (!metrika || !metrika.available) {
    return { available: false, reason: metrika?.reason || 'нет данных', pages: new Map() };
  }
  const d = metrika.data;
  const goalOrder = d.goal_order || [];
  const visits = rowsBySlug(d.visits);
  const views = rowsBySlug(d.pageviews);
  const exits = rowsBySlug(d.exits);

  const pages = new Map();
  const slugs = new Set([...visits.keys(), ...views.keys(), ...exits.keys()]);
  for (const slug of slugs) {
    const v = visits.get(slug);
    const pv = views.get(slug);
    const ex = exits.get(slug);

    // Цели идут после пяти базовых метрик, в порядке запроса.
    const goals = {};
    if (v) {
      goalOrder.forEach((g, i) => {
        const key = g.event || g.name;
        goals[key] = v[5 + i] ?? null;
      });
    }
    const sumOf = (names) => {
      const vals = names.map((n) => goals[n]).filter((x) => Number.isFinite(x));
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    };

    pages.set(slug, {
      visits: v ? v[0] : null,
      users: v ? v[1] : null,
      bounce_rate: v && Number.isFinite(v[2]) ? v[2] / 100 : null,
      // Честное имя: это длительность ВИЗИТА, а не время на этой странице.
      // Времени на конкретной странице в отчётном API нет вообще.
      avg_visit_duration_sec: v ? v[3] : null,
      page_depth: v ? v[4] : null,
      pageviews: pv ? pv[0] : null,
      pageview_users: pv ? pv[1] : null,
      exits: ex ? ex[0] : null,
      // Метрик, которых в API не существует, здесь нет и не будет нуля.
      scroll_depth: null,
      internal_clicks: null,
      goals,
      funnel: {
        entry: sumOf(FUNNEL.entry),
        intent: sumOf(FUNNEL.intent),
        checkout: sumOf(FUNNEL.checkout),
        payment_attempt: sumOf(FUNNEL.payment_attempt),
        purchase: sumOf(FUNNEL.purchase),
        failure: sumOf(FUNNEL.failure),
      },
    });
  }
  return { available: true, reason: null, pages, goalOrder, unavailable: d.unavailable_metrics || {} };
}

/** @returns {{pages: object[], sources: object}} */
export function buildPages({ asOf = new Date().toISOString() } = {}) {
  const { countries } = loadCached();
  const gsc = readJson('search-console.json');
  const wm = readJson('yandex-webmaster.json');
  const metrika = readJson('yandex-metrika.json');
  const commerce = readJson('commerce.json');

  const search = searchByPage(gsc);
  const behaviour = behaviourByPage(metrika);
  const commerceOk = commerce && !commerce.error && commerce.countries;

  const pages = countries.map((c) => {
    const profileFile = join(PROFILE_DIR, `${c.slug}.json`);
    let profile = null;
    if (existsSync(profileFile)) {
      try { profile = JSON.parse(readFileSync(profileFile, 'utf8')); } catch { /* битый профиль — как будто нет */ }
    }
    const s = search.pages.get(c.slug);
    const b = behaviour.pages.get(c.slug);
    const m = commerceOk ? commerce.countries[c.iso] : null;
    const reviewed = profile?.last_reviewed ? Date.parse(profile.last_reviewed) : NaN;

    return {
      slug: c.slug,
      iso: c.iso,
      name_ru: c.nameRu,
      as_of: asOf,
      search: s
        ? { available: true, ...s }
        : { available: false, reason: search.reason || 'страница не встречалась в выгрузке' },
      behaviour: b
        ? { available: true, ...b }
        : { available: false, reason: behaviour.reason || 'страница не встречалась в выгрузке' },
      commerce: m
        ? { available: true, granularity: 'country', ...m,
            // Клики в checkout приходят из Метрики (цели визита, разложенные по
            // странице входа), а заказы и деньги — из базы. Источники разные и
            // считают разное: Метрика меряет визиты, база — оплаченные заказы.
            // Сходиться они не обязаны, и подгонять их друг под друга нельзя.
            checkout_clicks: b?.funnel?.entry ?? null,
            checkout_starts: b?.funnel?.checkout ?? null,
            metrika_purchases: b?.funnel?.purchase ?? null }
        : { available: false, granularity: 'country',
            reason: commerceOk ? 'по этой стране заказов не было' : 'нет снимка продаж' },
      content: {
        has_profile: Boolean(profile),
        status: profile?.status || (profile ? 'draft' : null),
        locked: profile?.locked === true,
        priority: profile?.priority || null,
        traffic_bucket: profile?.traffic_bucket || null,
        faq_count: Array.isArray(profile?.faq) ? profile.faq.length : 0,
        why_count: Array.isArray(profile?.why) ? profile.why.length : 0,
        sources_count: Array.isArray(profile?.sources) ? profile.sources.length : 0,
        last_reviewed: profile?.last_reviewed || null,
        next_review: profile?.next_review || null,
        reviewed_by: profile?.reviewed_by || null,
        age_days: Number.isFinite(reviewed) ? Math.round((Date.parse(asOf) - reviewed) / 86400000) : null,
      },
      catalogue: {
        local_count: c.local_count, regional_count: c.regional_count,
        min_price_rub: c.min_price_rub, strategy: c.strategy,
      },
    };
  });

  return {
    pages,
    demo: IS_DEMO,
    sources: {
      'google-search-console': { available: search.available, reason: search.reason || null },
      'yandex-webmaster': { available: Boolean(wm?.available), reason: wm?.reason || 'не собирался' },
      'yandex-metrika': { available: behaviour.available, reason: behaviour.reason || null },
      'magic-esim-orders': commerceOk
        ? { available: true, reason: null, granularity: 'country',
            total_completed: commerce.total_completed, total_revenue_rub: commerce.total_revenue_rub }
        : { available: false, reason: commerce?.error || 'нет снимка продаж' },
    },
  };
}
