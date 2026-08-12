// A/B тестирование — и честная оговорка о том, что на самом деле можно сравнить.
//
// Сайт статический (GitHub Pages), и это меняет методику принципиально. Есть
// два разных типа теста, и смешивать их нельзя:
//
// 1) SEO-ТЕСТ (title, description, H1, структура).
//    Поисковик видит ОДНУ версию страницы. Одновременного сплита не бывает:
//    показать Google версию A, а Яндексу версию B — это не тест, а клоакинг.
//    Поэтому здесь работает последовательный тест с контрольной группой:
//
//      период до → изменение → период после,
//      и параллельно КОНТРОЛЬ — сопоставимые страницы без изменений.
//
//    Контроль обязателен. Без него сезонность и апдейты алгоритма читаются как
//    результат правки: CTR вырос на 15% в декабре у всех, а мы записали это
//    себе в заслугу.
//
// 2) КОНВЕРСИОННЫЙ ТЕСТ (CTA, первый экран, порядок блоков).
//    Здесь настоящий одновременный сплит возможен: вариант выбирается на
//    клиенте, липнет к посетителю и уходит в Метрику параметром. Поисковика
//    это не касается — он индексирует базовую разметку.
//
// Ни один тест не публикуется автоматически. Модуль считает результат и
// говорит, есть ли разница; решение принимает человек.

export const TEST_KIND = Object.freeze({ SEO: 'seo-sequential', CONVERSION: 'conversion-split' });

export const MIN_SAMPLE = Object.freeze({
  seo_impressions: 500,     // на окно
  seo_days: 21,             // короче — шум индексации
  conversion_sessions: 300, // на вариант
});

/**
 * Последовательный SEO-тест с контролем.
 *
 * @param {object} t
 *   variant_before / variant_after — снимки метрик страницы
 *   control_before / control_after — те же метрики, усреднённые по контрольным страницам
 */
export function evaluateSeoTest(t) {
  const need = [];
  const enough = (x) => Number.isFinite(x?.impressions) && x.impressions >= MIN_SAMPLE.seo_impressions;
  if (!enough(t.variant_before) || !enough(t.variant_after)) need.push(`≥${MIN_SAMPLE.seo_impressions} показов в каждом окне`);
  if (!(t.days >= MIN_SAMPLE.seo_days)) need.push(`≥${MIN_SAMPLE.seo_days} дней после изменения`);
  if (!t.control_before || !t.control_after) need.push('контрольная группа страниц без изменений');
  if (need.length) return { conclusive: false, verdict: 'рано судить', need, lift: null };

  // Разница разниц: сколько изменилось у нас СВЕРХ того, что изменилось у всех.
  const dVar = t.variant_after.ctr - t.variant_before.ctr;
  const dCtl = t.control_after.ctr - t.control_before.ctr;
  const lift = dVar - dCtl;
  const relative = t.variant_before.ctr > 0 ? lift / t.variant_before.ctr : null;

  // Грубая проверка значимости на долях: CTR — это доля кликов от показов.
  const se = (p, n) => Math.sqrt(Math.max(p * (1 - p), 1e-9) / Math.max(n, 1));
  const seDiff = Math.sqrt(
    se(t.variant_before.ctr, t.variant_before.impressions) ** 2
    + se(t.variant_after.ctr, t.variant_after.impressions) ** 2);
  const z = seDiff > 0 ? lift / seDiff : 0;
  const significant = Math.abs(z) >= 1.96;

  return {
    conclusive: significant,
    verdict: !significant ? 'разницы не видно'
      : lift > 0 ? 'вариант B лучше' : 'вариант B хуже',
    lift,
    lift_percent: relative === null ? null : Math.round(relative * 1000) / 10,
    control_drift: dCtl,
    z: Math.round(z * 100) / 100,
    note: 'сравнение с контролем: из изменения вычтен общий дрейф корпуса',
  };
}

/** Одновременный сплит для конверсионных правок. */
export function evaluateConversionTest(t) {
  const a = t.a || {};
  const b = t.b || {};
  const need = [];
  if (!(a.sessions >= MIN_SAMPLE.conversion_sessions)) need.push(`вариант A: ≥${MIN_SAMPLE.conversion_sessions} сессий`);
  if (!(b.sessions >= MIN_SAMPLE.conversion_sessions)) need.push(`вариант B: ≥${MIN_SAMPLE.conversion_sessions} сессий`);
  if (need.length) return { conclusive: false, verdict: 'рано судить', need };

  const pa = a.orders / a.sessions;
  const pb = b.orders / b.sessions;
  const pooled = (a.orders + b.orders) / (a.sessions + b.sessions);
  const se = Math.sqrt(Math.max(pooled * (1 - pooled), 1e-9) * (1 / a.sessions + 1 / b.sessions));
  const z = se > 0 ? (pb - pa) / se : 0;
  const significant = Math.abs(z) >= 1.96;

  // Выручка на сессию — то, ради чего тест и ставится. Вариант может выиграть
  // по конверсии и проиграть по деньгам, если уводит на дешёвый тариф.
  const rpsA = Number.isFinite(a.revenue_rub) ? a.revenue_rub / a.sessions : null;
  const rpsB = Number.isFinite(b.revenue_rub) ? b.revenue_rub / b.sessions : null;

  return {
    conclusive: significant,
    verdict: !significant ? 'разницы не видно' : pb > pa ? 'вариант B лучше' : 'вариант A лучше',
    conversion_a: pa, conversion_b: pb,
    revenue_per_session_a: rpsA, revenue_per_session_b: rpsB,
    revenue_disagrees: rpsA !== null && rpsB !== null && ((pb > pa) !== (rpsB > rpsA)),
    z: Math.round(z * 100) / 100,
    auto_publish: false,
    note: 'публикация только вручную',
  };
}
