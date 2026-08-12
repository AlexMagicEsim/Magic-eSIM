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

function behaviourByPage(metrika) {
  if (!metrika || !metrika.available) return { available: false, reason: metrika?.reason || 'нет данных', pages: new Map() };
  const pages = new Map();
  for (const row of metrika.data.data || []) {
    const url = row.dimensions?.[0]?.name;
    const slug = slugFromUrl(url);
    if (!slug) continue;
    const [pageviews, users, avgSeconds, bounce, ...goalReaches] = row.metrics || [];
    const cols = metrika.data.goal_columns || [];
    pages.set(slug, {
      pageviews: pageviews ?? null,
      users: users ?? null,
      time_on_page_sec: avgSeconds ?? null,
      bounce_rate: Number.isFinite(bounce) ? bounce / 100 : null,
      scroll_depth: null,       // требует отдельного отчёта по скроллу
      internal_clicks: null,
      exits: null,
      checkout_clicks: cols.includes('checkout_clicks') ? goalReaches[cols.indexOf('checkout_clicks')] ?? null : null,
      purchases: cols.includes('purchases') ? goalReaches[cols.indexOf('purchases')] ?? null : null,
    });
  }
  return { available: true, reason: null, pages };
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
            // Клики в checkout приходят из Метрики (цели уже настроены на
            // сайте), а заказы и деньги — из базы. Источники разные, поэтому
            // сходиться в ноль они не обязаны.
            checkout_clicks: b?.checkout_clicks ?? null,
            checkout_starts: b?.purchases ?? null }
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
