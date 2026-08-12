// Тесты Content Intelligence.
//
// Главное, что здесь проверяется — не арифметика, а поведение на плохих
// входах. Система, которая ставит оценку по одному клику или переписывает
// страницу, приносящую деньги, опаснее отсутствия системы: она выглядит
// авторитетно и ошибается молча.
//
//   node --test seo/intel/intel.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { performanceScore, corpusStats, expectedCtr, gradeOf, SAMPLE } from './performance.mjs';
import { resolveStatus, rewriteBan, topSets, researchPriority, isHighPerformer, STATUS } from './decisions.mjs';
import { recommend } from './recommendations.mjs';
import { verdictOf } from './history.mjs';
import { evaluateSeoTest, evaluateConversionTest } from './ab-test.mjs';
import { slugFromUrl } from './metrics.mjs';

const page = (over = {}) => ({
  slug: 'x', iso: 'XX', name_ru: 'Страна', as_of: '2026-08-12T00:00:00Z',
  search: { available: false }, behaviour: { available: false }, commerce: { available: false },
  content: { has_profile: true, status: 'published', faq_count: 5, why_count: 4, sources_count: 2,
    last_reviewed: '2026-08-01', locked: false },
  ...over,
});
// 9% на пятой позиции — это 1.5× от ожидаемых 6%. Ровно 7% дало бы 1.17× и
// не прошло бы порог High Performer: порог выбран так, чтобы «чуть лучше
// обычного» не считалось достижением.
const strongSearch = { available: true, impressions: 5000, clicks: 450, ctr: 0.09, position: 5, top_queries: [] };
const strongCorpus = { totalOrders: 200, medianConversion: 0.01, maxRevenue: 100000 };

// ---------------------------------------------------------------------------
// Оценка отсутствует, когда данных нет
// ---------------------------------------------------------------------------

test('без внешних данных оценки нет — не «D», а «—»', () => {
  const r = performanceScore(page(), {});
  assert.equal(r.grade, '—');
  assert.equal(r.score, null);
  assert.ok(r.coverage < 0.4);
  assert.ok(r.note.includes('оценку не выставляем'));
});

test('отсутствующий источник не превращается в ноль', () => {
  // Если однажды кто-то поставит `?? 0`, эта проверка упадёт: страница без
  // Search Console получит CTR 0% и уедет в аутсайдеры всем корпусом.
  const r = performanceScore(page(), {});
  assert.equal(r.parts.ctr, undefined);
  assert.equal(r.parts.position, undefined);
  assert.ok(r.missing.some((m) => m.includes('Search Console')));
});

test('мало показов — CTR и позиция не участвуют', () => {
  const r = performanceScore(page({ search: { available: true, impressions: 20, clicks: 5, ctr: 0.25, position: 3 } }), {});
  assert.equal(r.parts.ctr, undefined, 'CTR 25% на 20 показах — это шум, а не результат');
  assert.ok(r.missing.some((m) => m.includes('показов 20')));
});

test('конверсия отключена, пока в корпусе мало заказов', () => {
  const p = page({
    search: strongSearch,
    behaviour: { available: true, pageviews: 500, bounce_rate: 0.4, avg_visit_duration_sec: 90, scroll_depth: 0.6 },
    commerce: { available: true, completed_orders: 1, revenue_rub: 50 },
  });
  const r = performanceScore(p, { totalOrders: 5, medianConversion: 0, maxRevenue: 650 });
  assert.equal(r.parts.conversion, undefined);
  assert.ok(r.missing.some((m) => m.includes('во всём корпусе 5')));
});

// ---------------------------------------------------------------------------
// CTR судится относительно позиции
// ---------------------------------------------------------------------------

test('CTR оценивается относительно позиции, а не абсолютно', () => {
  const high = performanceScore(page({ search: { available: true, impressions: 3000, clicks: 36, ctr: 0.012, position: 28 } }), {});
  const low = performanceScore(page({ search: { available: true, impressions: 3000, clicks: 120, ctr: 0.04, position: 2 } }), {});
  assert.ok(high.parts.ctr > low.parts.ctr,
    '1.2% на 28-й позиции — лучше своей позиции; 4% на второй — сильно хуже своей');
});

test('кривая ожидаемого CTR монотонно убывает', () => {
  let prev = Infinity;
  for (const pos of [1, 2, 3, 5, 8, 10, 15, 20, 30, 50, 80]) {
    const e = expectedCtr(pos);
    assert.ok(e < prev, `позиция ${pos}`);
    prev = e;
  }
});

// ---------------------------------------------------------------------------
// High Performer
// ---------------------------------------------------------------------------

test('High Performer требует всех трёх сигналов', () => {
  const base = { available: true, impressions: 5000, clicks: 450, ctr: 0.09, position: 5 };
  const beh = { available: true, pageviews: 500 };
  const com = { available: true, completed_orders: 10, revenue_rub: 20000 };
  assert.equal(isHighPerformer(page({ search: base, behaviour: beh, commerce: com }), strongCorpus).yes, true);
  // позиция хуже десятой — нет
  assert.equal(isHighPerformer(page({ search: { ...base, position: 14 }, behaviour: beh, commerce: com }), strongCorpus).yes, false);
  // конверсия ниже медианы — нет
  assert.equal(isHighPerformer(page({ search: base, behaviour: beh, commerce: { ...com, completed_orders: 1 } }), strongCorpus).yes, false);
});

test('High Performer не выдаётся на маленькой выборке', () => {
  // Иначе страница с 12 показами и одним кликом навсегда замораживается.
  const r = isHighPerformer(page({ search: { available: true, impressions: 12, clicks: 1, ctr: 0.083, position: 3 } }), strongCorpus);
  assert.equal(r.yes, false);
  assert.ok(r.why.includes('мало показов'));
});

// ---------------------------------------------------------------------------
// Needs Improvement
// ---------------------------------------------------------------------------

test('один плохой сигнал — не повод в очередь, два — повод', () => {
  const one = page({ search: { available: true, impressions: 3000, clicks: 15, ctr: 0.005, position: 8, top_queries: [] } });
  assert.equal(resolveStatus(one, strongCorpus).status, STATUS.PUBLISHED, 'только низкий CTR');
  const two = page({
    search: { available: true, impressions: 3000, clicks: 15, ctr: 0.005, position: 24, top_queries: [] },
  });
  assert.equal(resolveStatus(two, strongCorpus).status, STATUS.NEEDS_IMPROVEMENT);
});

// ---------------------------------------------------------------------------
// Приоритет статусов
// ---------------------------------------------------------------------------

test('Locked перебивает всё, включая High Performer', () => {
  const p = page({
    search: strongSearch,
    behaviour: { available: true, pageviews: 500 },
    commerce: { available: true, completed_orders: 10, revenue_rub: 20000 },
    content: { ...page().content, locked: true },
  });
  assert.equal(resolveStatus(p, strongCorpus).status, STATUS.LOCKED);
});

test('Draft перебивает результаты', () => {
  const p = page({ search: strongSearch, content: { ...page().content, status: 'draft' } });
  assert.equal(resolveStatus(p, strongCorpus).status, STATUS.DRAFT);
});

test('Stale по просроченному next_review', () => {
  const p = page({ content: { ...page().content, last_reviewed: '2026-08-01', next_review: '2026-08-05' } });
  assert.ok(resolveStatus(p, strongCorpus).all.includes(STATUS.STALE));
});

// ---------------------------------------------------------------------------
// Запрет на переписывание
// ---------------------------------------------------------------------------

test('заблокированную вручную страницу пайплайн не трогает', () => {
  const p = page({ content: { ...page().content, locked: true } });
  const ban = rewriteBan(p, strongCorpus, topSets([p], 10, strongCorpus));
  assert.equal(ban.banned, true);
  assert.ok(ban.reasons.some((r) => r.includes('вручную')));
});

test('топы не считаются на пустом корпусе — иначе заморозим случайную страницу', () => {
  const p = page({ commerce: { available: true, completed_orders: 1, revenue_rub: 50 } });
  const t = topSets([p], 10, { totalOrders: 5 });
  assert.equal(t.gated, true);
  assert.equal(t.revenue.size, 0);
  assert.equal(rewriteBan(p, { totalOrders: 5 }, t).banned, false);
});

test('на живом корпусе топ по выручке защищает страницу', () => {
  const rich = page({ slug: 'rich', commerce: { available: true, completed_orders: 40, revenue_rub: 90000 } });
  const poor = page({ slug: 'poor', commerce: { available: true, completed_orders: 1, revenue_rub: 100 } });
  const t = topSets([rich, poor], 1, strongCorpus);
  assert.equal(rewriteBan(rich, strongCorpus, t).banned, true);
  assert.equal(rewriteBan(poor, strongCorpus, t).banned, false);
});

test('запрет не отменяет рекомендации, а только автоприменение', () => {
  const p = page({
    search: { available: true, impressions: 4000, clicks: 20, ctr: 0.005, position: 6, top_queries: [] },
    behaviour: { available: true, pageviews: 400, bounce_rate: 0.85, avg_visit_duration_sec: 15, scroll_depth: 0.2 },
    commerce: { available: true, completed_orders: 30, revenue_rub: 90000 },
    content: { ...page().content, locked: true },
  });
  const { recommendations } = recommend(p, strongCorpus, topSets([p], 10, strongCorpus));
  const textual = recommendations.filter((r) => r.touches_text);
  assert.ok(textual.length > 0, 'рекомендации остаются');
  assert.ok(textual.every((r) => r.auto_apply === false), 'но применять их автоматически нельзя');
  assert.ok(textual.every((r) => r.blocked_by?.length));
});

// ---------------------------------------------------------------------------
// Приоритет по потенциалу
// ---------------------------------------------------------------------------

test('приоритет — это недополученные клики, а не размер страны', () => {
  const big = page({ slug: 'big', search: { available: true, impressions: 20000, clicks: 100, ctr: 0.005, position: 12, top_queries: [] } });
  const small = page({ slug: 'small', search: { available: true, impressions: 300, clicks: 3, ctr: 0.01, position: 40, top_queries: [] } });
  assert.ok(researchPriority(big, {}).score > researchPriority(small, {}).score * 10);
});

test('страница, которая уже опережает свою позицию, не в очереди', () => {
  const good = page({ search: { available: true, impressions: 5000, clicks: 500, ctr: 0.1, position: 6, top_queries: [] } });
  assert.equal(researchPriority(good, {}).score, 0);
});

// ---------------------------------------------------------------------------
// Рекомендации
// ---------------------------------------------------------------------------

test('без источников рекомендация — подключить источники, а не переписать текст', () => {
  const { recommendations } = recommend(page(), {}, {});
  const ids = recommendations.map((r) => r.id);
  assert.ok(ids.includes('connect-search'));
  assert.ok(ids.includes('connect-metrika'));
  assert.ok(!ids.includes('title-ctr'), 'нельзя советовать править title, не зная CTR');
});

test('хорошая позиция и низкая конверсия → переработать CTA', () => {
  const p = page({
    search: { available: true, impressions: 4000, clicks: 200, ctr: 0.05, position: 4, top_queries: [] },
    behaviour: { available: true, pageviews: 800, bounce_rate: 0.4, avg_visit_duration_sec: 90, scroll_depth: 0.6 },
    commerce: { available: true, completed_orders: 1, revenue_rub: 500 },
  });
  const ids = recommend(p, strongCorpus, {}).recommendations.map((r) => r.id);
  assert.ok(ids.includes('cta'));
});

test('низкий CTR при хорошей позиции → переписать title', () => {
  const p = page({ search: { available: true, impressions: 6000, clicks: 30, ctr: 0.005, position: 5, top_queries: [] } });
  const r = recommend(p, {}, {}).recommendations.find((x) => x.id === 'title-ctr');
  assert.ok(r);
  assert.ok(r.expect.includes('кликов'), 'рекомендация обязана называть метрику, которая должна сдвинуться');
});

// ---------------------------------------------------------------------------
// История
// ---------------------------------------------------------------------------

test('рост номера позиции — это ухудшение', () => {
  const v = verdictOf({ impressions: 1000, ctr: 0.03, position: 8 }, { impressions: 1000, ctr: 0.02, position: 15 });
  assert.equal(v.call, 'хуже');
});

test('на малых показах вердикта нет', () => {
  assert.equal(verdictOf({ impressions: 10, ctr: 0.02 }, { impressions: 900, ctr: 0.05 }).call, 'рано судить');
});

// ---------------------------------------------------------------------------
// A/B
// ---------------------------------------------------------------------------

test('SEO-тест без контроля не считается', () => {
  const r = evaluateSeoTest({ days: 30, variant_before: { impressions: 5000, ctr: 0.02 }, variant_after: { impressions: 5000, ctr: 0.03 } });
  assert.equal(r.conclusive, false);
  assert.ok(r.need.some((n) => n.includes('контрольная')));
});

test('SEO-тест вычитает общий дрейф корпуса', () => {
  // Выросли все на 1 п.п., мы — тоже на 1 п.п. Это не заслуга правки.
  const r = evaluateSeoTest({
    days: 30,
    variant_before: { impressions: 5000, ctr: 0.02 }, variant_after: { impressions: 5000, ctr: 0.03 },
    control_before: { ctr: 0.02 }, control_after: { ctr: 0.03 },
  });
  assert.equal(Math.abs(r.lift) < 1e-9, true);
  assert.equal(r.conclusive, false);
});

test('конверсионный тест ловит расхождение конверсии и денег', () => {
  const r = evaluateConversionTest({
    a: { sessions: 2000, orders: 40, revenue_rub: 60000 },
    b: { sessions: 2000, orders: 70, revenue_rub: 55000 },
  });
  assert.equal(r.revenue_disagrees, true, 'B лучше по конверсии и хуже по деньгам — это обязано быть видно');
  assert.equal(r.auto_publish, false);
});

// ---------------------------------------------------------------------------
// Мелочи, которые ломают всё
// ---------------------------------------------------------------------------

test('slug вытаскивается только из страниц стран', () => {
  assert.equal(slugFromUrl('https://magicesim.store/esim/thailand/'), 'thailand');
  assert.equal(slugFromUrl('https://magicesim.store/esim/thailand/?utm=1'), 'thailand');
  assert.equal(slugFromUrl('https://magicesim.store/'), null);
  assert.equal(slugFromUrl('https://magicesim.store/esim/'), null);
  assert.equal(slugFromUrl(undefined), null);
});

test('границы оценок', () => {
  assert.equal(gradeOf(85), 'A+');
  assert.equal(gradeOf(84), 'A');
  assert.equal(gradeOf(58), 'B');
  assert.equal(gradeOf(41), 'D');
  assert.equal(gradeOf(null), '—');
});

test('corpusStats не считает конверсию по страницам без просмотров', () => {
  const s = corpusStats([
    { behaviour: { pageviews: 10 }, commerce: { completed_orders: 5, revenue_rub: 100 } },
    { behaviour: { pageviews: 1000 }, commerce: { completed_orders: 10, revenue_rub: 5000 } },
  ]);
  assert.equal(s.sampleSize, 1, `страница с ${SAMPLE.pageviews > 10 ? '10' : ''} просмотрами не даёт конверсии`);
  assert.equal(s.maxRevenue, 5000);
  assert.equal(s.totalOrders, 15);
});

// ---------------------------------------------------------------------------
// Разбор ответов Метрики
// ---------------------------------------------------------------------------
//
// Токена ещё нет, поэтому парсер проверяется на записанной ФОРМЕ ответа. Форма
// взята из контракта API: /stat/v1/data отдаёт data[].dimensions[].name и
// data[].metrics[] в порядке запрошенных метрик. Ошибиться здесь легко и
// незаметно: перепутанный индекс превратит глубину просмотра в отказы.

import { behaviourFixtureCheck } from './metrics.mjs';

const metrikaFixture = {
  available: true,
  data: {
    counter: '110393848', days: 28,
    goal_order: [
      { id: 111, name: 'Клик по тарифу', event: 'country_tariff_click' },
      { id: 222, name: 'Открытие оформления', event: 'checkout_open' },
      { id: 333, name: 'Оплата', event: 'payment_success' },
    ],
    visits: { data: [
      // visits, users, bounceRate(%), avgDuration, pageDepth, goal111, goal222, goal333
      { dimensions: [{ name: '/esim/thailand/' }], metrics: [420, 380, 41.5, 96, 2.3, 55, 18, 4] },
      { dimensions: [{ name: '/esim/japan/' }], metrics: [120, 110, 68.0, 34, 1.4, 6, 1, 0] },
      { dimensions: [{ name: '/' }], metrics: [900, 800, 30.0, 150, 3.1, 0, 40, 12] },
    ] },
    pageviews: { data: [
      { dimensions: [{ name: '/esim/thailand/' }], metrics: [1010, 640] },
      { dimensions: [{ name: '/esim/japan/' }], metrics: [180, 140] },
    ] },
    exits: { data: [
      { dimensions: [{ name: '/esim/thailand/' }], metrics: [140] },
    ] },
    unavailable_metrics: { time_on_page: 'нет', scroll_depth: 'нет', internal_clicks: 'нет' },
  },
};

test('разбор ответа Метрики: метрики не перепутаны местами', () => {
  const b = behaviourFixtureCheck(metrikaFixture).get('thailand');
  assert.equal(b.visits, 420);
  assert.equal(b.users, 380);
  assert.equal(b.bounce_rate, 0.415, 'проценты приводятся к доле');
  assert.equal(b.avg_visit_duration_sec, 96);
  assert.equal(b.page_depth, 2.3);
  assert.equal(b.pageviews, 1010, 'из отдельного запроса по хитам');
  assert.equal(b.exits, 140, 'из отдельного запроса по страницам выхода');
});

test('цели раскладываются по именам событий, а не по позиции в отчёте', () => {
  const b = behaviourFixtureCheck(metrikaFixture).get('thailand');
  assert.equal(b.goals.country_tariff_click, 55);
  assert.equal(b.goals.checkout_open, 18);
  assert.equal(b.goals.payment_success, 4);
  assert.equal(b.funnel.entry, 55);
  assert.equal(b.funnel.checkout, 18);
  assert.equal(b.funnel.purchase, 4);
});

test('лендинг не попадает в страницы стран', () => {
  const pages = behaviourFixtureCheck(metrikaFixture);
  assert.equal(pages.has('thailand'), true);
  assert.equal(pages.size, 2, 'строка "/" — это лендинг, а не страна');
});

test('несуществующие в API метрики остаются null, а не нулём', () => {
  const b = behaviourFixtureCheck(metrikaFixture).get('thailand');
  assert.equal(b.scroll_depth, null);
  assert.equal(b.internal_clicks, null);
});

test('страница без просмотров и выходов не выдумывает нули', () => {
  const b = behaviourFixtureCheck(metrikaFixture).get('japan');
  assert.equal(b.visits, 120);
  assert.equal(b.exits, null, 'в отчёте по выходам этой страницы нет');
  assert.equal(b.funnel.purchase, 0, 'а вот цель запрошена и вернула ноль — это измерение');
});

test('недоступная Метрика не создаёт пустых страниц', () => {
  const r = behaviourFixtureCheck({ available: false, reason: 'нет токена' });
  assert.equal(r.size, 0);
});
