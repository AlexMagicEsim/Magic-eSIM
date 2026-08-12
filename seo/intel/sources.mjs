// The source layer, and the rule that makes the whole system worth anything:
// a number either came from a named source or it does not exist.
//
// Every adapter returns the same shape:
//
//   { available: boolean, reason: string|null, data: ... , fetched_at, source }
//
// `available:false` is a first-class answer. It is NOT an error and it is NOT
// zero. A page with no Search Console data has no CTR — it does not have a CTR
// of nought — and everything downstream is built to carry that distinction all
// the way to the grade, because the alternative is a dashboard that quietly
// tells you a page is failing when the truth is that nobody connected the API.
//
// ---------------------------------------------------------------------------
// SOURCE TIERS
// ---------------------------------------------------------------------------
//
// TIER 1 — FACTS. May be stated on a page as fact.
//   Google Search Console, Яндекс Вебмастер, Яндекс Метрика, Magic eSIM API и
//   база заказов, Apple/Google/GSMA, сайты операторов, госисточники.
//   These are either our own measurements or the primary authority on the
//   thing being described.
//
// TIER 2 — INTENT ONLY. May shape WHICH questions a page answers. May never
//   supply an answer.
//   Reddit, vc.ru, DTF, форумы, отзывы.
//   A forum post is evidence that people ask something. It is not evidence of
//   what the answer is. The content pipeline already records this distinction
//   in every profile's `research_method`.
//
// TIER 3 — NEVER. SEO-помойки, AI-сгенерированные сайты, скраперы, агрегаторы
//   чужих текстов. Not "use with care" — not used, not cited, not read.
//
// The tier is a property of the SOURCE, not of the claim. A correct fact found
// on a Tier 3 site is still not usable: it has to be found again somewhere
// that can be held to it.

export const TIER = Object.freeze({
  FACT: 1,
  INTENT: 2,
  NEVER: 3,
});

export const SOURCE_REGISTRY = Object.freeze([
  { id: 'google-search-console', tier: TIER.FACT, kind: 'search', name: 'Google Search Console' },
  { id: 'yandex-webmaster', tier: TIER.FACT, kind: 'search', name: 'Яндекс Вебмастер' },
  { id: 'yandex-metrika', tier: TIER.FACT, kind: 'behaviour', name: 'Яндекс Метрика' },
  { id: 'magic-esim-orders', tier: TIER.FACT, kind: 'commerce', name: 'Magic eSIM: заказы и выручка' },
  { id: 'magic-esim-catalogue', tier: TIER.FACT, kind: 'catalogue', name: 'Magic eSIM: каталог' },
  { id: 'apple-google-gsma', tier: TIER.FACT, kind: 'reference', name: 'Apple / Google / GSMA / операторы / госисточники' },
  { id: 'forums', tier: TIER.INTENT, kind: 'intent', name: 'Reddit, vc.ru, DTF, форумы' },
  { id: 'seo-farms', tier: TIER.NEVER, kind: 'none', name: 'SEO-помойки, AI-сайты, скраперы' },
]);

const unavailable = (source, reason) => ({ available: false, reason, data: null, source, fetched_at: null });
const ok = (source, data) => ({ available: true, reason: null, data, source, fetched_at: new Date().toISOString() });

// ---------------------------------------------------------------------------
// Google Search Console — Search Analytics API
// ---------------------------------------------------------------------------
//
// Auth: a refresh token for an account with at least "restricted" access to
// the property, exchanged for an access token at request time. Credentials are
// read from the environment and never written anywhere.
//
//   GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN, GSC_SITE_URL
//
// Query: dimensions [page, query], 28 days, so a page's rows carry both its
// own totals and the queries that produced them. One request per run, not one
// per page: the API is row-limited, not page-limited, and 202 requests would
// hit quota for no benefit.

export async function fetchSearchConsole({ days = 28, rowLimit = 25000 } = {}) {
  const { GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN, GSC_SITE_URL } = process.env;
  if (!GSC_CLIENT_ID || !GSC_CLIENT_SECRET || !GSC_REFRESH_TOKEN || !GSC_SITE_URL) {
    return unavailable('google-search-console',
      'нет доступа: задай GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN, GSC_SITE_URL');
  }

  let token;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GSC_CLIENT_ID,
        client_secret: GSC_CLIENT_SECRET,
        refresh_token: GSC_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return unavailable('google-search-console', `OAuth ${res.status}`);
    token = (await res.json()).access_token;
  } catch (e) {
    return unavailable('google-search-console', `OAuth недоступен: ${e.message}`);
  }

  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);

  try {
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          startDate: iso(start), endDate: iso(end),
          dimensions: ['page', 'query'], rowLimit, type: 'web',
        }),
        signal: AbortSignal.timeout(120000),
      });
    if (!res.ok) return unavailable('google-search-console', `API ${res.status}`);
    return ok('google-search-console', { rows: (await res.json()).rows || [], days });
  } catch (e) {
    return unavailable('google-search-console', `запрос не прошёл: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Яндекс Вебмастер — Search Queries API
// ---------------------------------------------------------------------------
//
//   YANDEX_WEBMASTER_TOKEN, YANDEX_WEBMASTER_USER_ID, YANDEX_WEBMASTER_HOST_ID
//
// Yandex reports queries per host with URL-level breakdown; the shape differs
// from Google's but normalises to the same canonical record downstream.

export async function fetchYandexWebmaster({ days = 28 } = {}) {
  const { YANDEX_WEBMASTER_TOKEN, YANDEX_WEBMASTER_USER_ID, YANDEX_WEBMASTER_HOST_ID } = process.env;
  if (!YANDEX_WEBMASTER_TOKEN || !YANDEX_WEBMASTER_USER_ID || !YANDEX_WEBMASTER_HOST_ID) {
    return unavailable('yandex-webmaster',
      'нет доступа: задай YANDEX_WEBMASTER_TOKEN, YANDEX_WEBMASTER_USER_ID, YANDEX_WEBMASTER_HOST_ID');
  }
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  const url = `https://api.webmaster.yandex.net/v4/user/${YANDEX_WEBMASTER_USER_ID}`
    + `/hosts/${YANDEX_WEBMASTER_HOST_ID}/search-queries/all/history`
    + `?query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS&query_indicator=AVG_SHOW_POSITION`
    + `&date_from=${iso(start)}&date_to=${iso(end)}`;
  try {
    const res = await fetch(url, {
      headers: { authorization: `OAuth ${YANDEX_WEBMASTER_TOKEN}` },
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return unavailable('yandex-webmaster', `API ${res.status}`);
    return ok('yandex-webmaster', { ...(await res.json()), days });
  } catch (e) {
    return unavailable('yandex-webmaster', `запрос не прошёл: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Яндекс Метрика — Reporting API
// ---------------------------------------------------------------------------
//
//   YANDEX_METRIKA_TOKEN, YANDEX_METRIKA_COUNTER (счётчик сайта: 110393848)
//
// Behaviour metrics per URL, плюс достижения целей по URL, если заданы их
// числовые идентификаторы.
//
// Цели на сайте УЖЕ настроены — country_tariff_click, tariff_buy_click,
// checkout_open и другие (см. attribution.mjs). Значит Checkout Analytics на
// страницу считается штатным отчётом Метрики, без новой разметки. Не хватает
// только двух вещей: токена и числовых id целей из интерфейса счётчика —
// имена целей в API не принимаются.
//
//   YANDEX_METRIKA_GOAL_CHECKOUT  id цели country_tariff_click / tariff_buy_click
//   YANDEX_METRIKA_GOAL_PURCHASE  id цели успешной оплаты

export const METRIKA_COUNTER = '110393848';

export async function fetchMetrika({ days = 28, limit = 1000 } = {}) {
  const { YANDEX_METRIKA_TOKEN } = process.env;
  const counter = process.env.YANDEX_METRIKA_COUNTER || METRIKA_COUNTER;
  if (!YANDEX_METRIKA_TOKEN) {
    return unavailable('yandex-metrika', 'нет доступа: задай YANDEX_METRIKA_TOKEN');
  }
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  const metrics = ['ym:pv:pageviews', 'ym:pv:users', 'ym:s:avgVisitDurationSeconds', 'ym:s:bounceRate'];
  const goals = [];
  if (process.env.YANDEX_METRIKA_GOAL_CHECKOUT) {
    metrics.push(`ym:s:goal${process.env.YANDEX_METRIKA_GOAL_CHECKOUT}reaches`);
    goals.push('checkout_clicks');
  }
  if (process.env.YANDEX_METRIKA_GOAL_PURCHASE) {
    metrics.push(`ym:s:goal${process.env.YANDEX_METRIKA_GOAL_PURCHASE}reaches`);
    goals.push('purchases');
  }
  const params = new URLSearchParams({
    ids: counter,
    metrics: metrics.join(','),
    dimensions: 'ym:pv:URLPathFull',
    date1: iso(start), date2: iso(end),
    limit: String(limit), accuracy: 'full',
  });
  try {
    const res = await fetch(`https://api-metrika.yandex.net/stat/v1/data?${params}`, {
      headers: { authorization: `OAuth ${YANDEX_METRIKA_TOKEN}` },
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return unavailable('yandex-metrika', `API ${res.status}`);
    return ok('yandex-metrika', { ...(await res.json()), days, counter, goal_columns: goals });
  } catch (e) {
    return unavailable('yandex-metrika', `запрос не прошёл: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Magic eSIM — заказы, выручка, прибыль
// ---------------------------------------------------------------------------
//
// The one commerce source that works today, and the one place where the
// granularity has to be stated out loud.
//
// `retail_orders.country_code` says WHICH COUNTRY was bought, not WHICH PAGE
// the buyer came from. Since there is exactly one page per country those two
// coincide for revenue-per-country — but they do NOT coincide for channel:
// an order tagged TR may have come from the Turkey page, from the landing, or
// from a direct link. So this adapter reports `granularity: 'country'`, and
// the score treats it as country-level evidence.
//
// Page-level channel attribution needs the click to carry its origin into the
// order. That instrumentation is designed in seo/intel/attribution.mjs and is
// deliberately not live yet.
//
// Reads a snapshot file produced by scripts/collect-commerce.sh so that the
// dashboard never needs database credentials of its own.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const COMMERCE_SNAPSHOT = join(ROOT, 'seo/intel/data/commerce.json');

export function loadCommerce() {
  if (!existsSync(COMMERCE_SNAPSHOT)) {
    return unavailable('magic-esim-orders',
      'нет снимка продаж: запусти node seo/intel/collect.mjs --commerce');
  }
  try {
    const raw = JSON.parse(readFileSync(COMMERCE_SNAPSHOT, 'utf8'));
    return ok('magic-esim-orders', raw);
  } catch (e) {
    return unavailable('magic-esim-orders', `снимок не разбирается: ${e.message}`);
  }
}
