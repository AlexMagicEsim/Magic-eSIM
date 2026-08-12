// Recommendations — what to do, tied to the measurement that says so.
//
// Every rule states three things: the observation, the action, and the metric
// that should move if the action worked. The third is what makes it a
// recommendation rather than an opinion: if the metric does not move, the rule
// was wrong and history will show it.
//
// Rules never fire without evidence. A page with no Search Console data gets
// no CTR advice — it gets "connect Search Console", which is the honest
// recommendation.

import { expectedCtr, SAMPLE } from './performance.mjs';
import { rewriteBan } from './decisions.mjs';

export const SEVERITY = Object.freeze({ HIGH: 'высокий', MEDIUM: 'средний', LOW: 'низкий' });

const rec = (id, severity, observation, action, expect, opts = {}) =>
  ({ id, severity, observation, action, expect, touches_text: opts.touches_text !== false, ...opts });

export function recommend(page, corpus = {}, tops = {}) {
  const out = [];
  const s = page.search || {};
  const b = page.behaviour || {};
  const c = page.commerce || {};
  const content = page.content || {};
  const ban = rewriteBan(page, corpus, tops);

  // ---- нечего измерять --------------------------------------------------
  if (!s.available) {
    out.push(rec('connect-search', SEVERITY.HIGH,
      'нет данных Search Console и Вебмастера',
      'подключить GSC и Яндекс Вебмастер — без них CTR и позиция не измеряются',
      'появятся показы, клики, позиция и запросы', { touches_text: false }));
  }
  if (!b.available) {
    out.push(rec('connect-metrika', SEVERITY.HIGH,
      'нет данных Метрики',
      'выдать токен Метрики для счётчика на сайте',
      'появятся просмотры, глубина скролла, время и отказы', { touches_text: false }));
  }
  if (!c.available) {
    out.push(rec('connect-commerce', SEVERITY.HIGH,
      'заказы не связаны со страницей',
      'включить атрибуцию: страна → checkout → заказ (seo/intel/attribution.mjs)',
      'выручка и прибыль на страницу станут измеримыми', { touches_text: false }));
  }

  // ---- CTR --------------------------------------------------------------
  if (s.available && s.impressions >= SAMPLE.impressions) {
    const exp = expectedCtr(s.position);
    const ratio = exp ? s.ctr / exp : null;
    if (ratio !== null && ratio < 0.7 && s.position <= 20) {
      out.push(rec('title-ctr', SEVERITY.HIGH,
        `CTR ${(s.ctr * 100).toFixed(1)}% против ожидаемых ${(exp * 100).toFixed(1)}% для позиции ${s.position.toFixed(1)}`,
        'переписать title и description: позиция есть, а по сниппету не кликают',
        'CTR до уровня позиции — это +' + Math.round(s.impressions * (exp - s.ctr)) + ' кликов на том же трафике'));
    }
    if (s.position > 20 && s.impressions >= 500) {
      out.push(rec('position', SEVERITY.MEDIUM,
        `позиция ${s.position.toFixed(1)} при ${s.impressions} показах`,
        'усилить содержание под топ-запросы страницы и добавить внутренние ссылки на неё',
        'рост позиции; CTR подтянется следом'));
    }
    // Queries the page ranks for but does not answer.
    const uncovered = (s.top_queries || []).filter((q) => q.impressions >= 50 && q.position > 15).slice(0, 3);
    if (uncovered.length) {
      out.push(rec('uncovered-queries', SEVERITY.MEDIUM,
        `запросы с показами, но без позиции: ${uncovered.map((q) => `«${q.query}»`).join(', ')}`,
        'добавить в FAQ ответы именно на эти запросы',
        'позиция по этим запросам и дополнительные показы'));
    }
  }

  // ---- поведение ---------------------------------------------------------
  if (b.available && b.pageviews >= SAMPLE.pageviews) {
    if (Number.isFinite(b.bounce_rate) && b.bounce_rate > 0.7) {
      out.push(rec('first-screen', SEVERITY.HIGH,
        `отказы ${Math.round(b.bounce_rate * 100)}%`,
        'переработать первый экран: лид и первый блок тарифов должны отвечать на запрос сразу',
        'снижение отказов и рост времени на странице'));
    }
    if (Number.isFinite(b.scroll_depth) && b.scroll_depth < 0.3) {
      out.push(rec('scroll', SEVERITY.MEDIUM,
        `дочитывают до ${Math.round(b.scroll_depth * 100)}%`,
        'поднять важное выше: тарифы и ответ на главный вопрос до первого скролла',
        'рост глубины просмотра'));
    }
    if (Number.isFinite(b.internal_clicks) && b.internal_clicks / b.pageviews < 0.05) {
      out.push(rec('internal-links', SEVERITY.LOW,
        'почти не кликают по внутренним ссылкам',
        'пересобрать блок «другие направления» под реальные соседние маршруты',
        'рост внутренних переходов', { touches_text: false }));
    }
  }

  // ---- деньги ------------------------------------------------------------
  if (c.available && b.available && b.pageviews >= SAMPLE.pageviews
      && Number(corpus.totalOrders) >= SAMPLE.orders_corpus) {
    const conv = Number(c.completed_orders) / b.pageviews;
    const median = Number(corpus.medianConversion) || 0;
    if (s.available && s.position <= 10 && median > 0 && conv < 0.5 * median) {
      out.push(rec('cta', SEVERITY.HIGH,
        `позиция ${s.position.toFixed(1)} хорошая, а конверсия ${(conv * 100).toFixed(2)}% против медианы ${(median * 100).toFixed(2)}%`,
        'переработать CTA: трафик приходит целевой, но до checkout не доходит',
        'рост конверсии до медианы корпуса'));
    }
    if (Number.isFinite(c.checkout_clicks) && Number.isFinite(c.checkout_starts)
        && c.checkout_clicks > 20 && c.checkout_starts / c.checkout_clicks < 0.5) {
      out.push(rec('checkout-drop', SEVERITY.HIGH,
        `из ${c.checkout_clicks} кликов в checkout доходит ${c.checkout_starts}`,
        'разобрать шаг между кликом и стартом оформления — это не текст страницы',
        'рост доли начатых оформлений', { touches_text: false }));
    }
  }

  // ---- содержание --------------------------------------------------------
  if (!content.has_profile) {
    out.push(rec('no-profile', SEVERITY.MEDIUM,
      'страница собрана по фактическому шаблону, авторского профиля нет',
      'провести страницу через пайплайн: research → draft → review → browser QA',
      'уникальный текст и рост CTR относительно шаблонных страниц'));
  }
  if (content.has_profile && Number.isFinite(content.age_days) && content.age_days > 180) {
    out.push(rec('stale', SEVERITY.LOW,
      `последняя ревизия ${content.age_days} дней назад`,
      'сверить факты с каталогом и обновить дату ревизии',
      'свежесть в Performance Score и защита от расхождения с каталогом'));
  }

  // ---- запрет ------------------------------------------------------------
  //
  // The ban does not remove recommendations. It changes what may be done with
  // them: an editor may act, the pipeline may not. Silently dropping advice on
  // a High Performer would hide the one thing worth knowing about it.
  for (const r of out) {
    if (ban.banned && r.touches_text) {
      r.auto_apply = false;
      r.blocked_by = ban.reasons;
    } else {
      r.auto_apply = !r.touches_text;
    }
  }
  const order = { [SEVERITY.HIGH]: 0, [SEVERITY.MEDIUM]: 1, [SEVERITY.LOW]: 2 };
  out.sort((a, b2) => order[a.severity] - order[b2.severity]);
  return { recommendations: out, ban };
}
