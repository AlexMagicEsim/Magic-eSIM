// Performance Score — what replaces the internal Quality Score.
//
// The old score answered "does this page look like a person wrote it". Useful
// once, before there was any traffic to judge by, and useless afterwards: a
// page can be beautifully written and rank nowhere, and a plain page can carry
// the revenue. This one answers "is this page working", and every input comes
// from a measurement.
//
// ---------------------------------------------------------------------------
// THE PARTS, AND WHY THEY WEIGH WHAT THEY WEIGH
// ---------------------------------------------------------------------------
//
//   CTR относительно позиции  25   the biggest lever we actually control
//   Позиция                   15   where we are, before what we do with it
//   Конверсия                 25   traffic that does not buy is a cost
//   Выручка                   15   money, log-scaled — see below
//   Вовлечённость             10   scroll / time / bounce
//   Свежесть                   5   decay, not a cliff
//   Полнота контента           5   the only part inherited from Quality Score
//
// CTR IS JUDGED AGAINST POSITION, NOT ABSOLUTELY. A page at position 28 with
// 1.2% CTR is doing well; a page at position 2 with 4% is doing badly. Scoring
// raw CTR would rank the whole corpus by how well it already ranks and tell us
// nothing we did not know. The expected curve below is the ordinary
// position→CTR shape; what matters is the RATIO of actual to expected.
//
// REVENUE IS LOG-SCALED because one country will always dominate. A linear
// revenue term would give every other page a zero and turn the grade into a
// single-country readout.
//
// ---------------------------------------------------------------------------
// THE PART THAT MATTERS MOST: NOT GRADING WHAT WE CANNOT SEE
// ---------------------------------------------------------------------------
//
// Every component can be absent. A component with no data contributes NOTHING
// — not zero, nothing: its weight is removed from the denominator. The result
// carries `coverage` (what share of the weight was actually measurable) and
// `missing` (what was not). Below MIN_COVERAGE there is no grade at all, only
// "недостаточно данных".
//
// This is the whole reason the system is worth building. A dashboard that
// prints D for a page nobody has data on is worse than no dashboard: it sends
// an editor to rewrite a page whose real problem is a disconnected API.

export const WEIGHTS = Object.freeze({
  ctr: 25, position: 15, conversion: 25, revenue: 15, engagement: 10, freshness: 5, completeness: 5,
});

export const MIN_COVERAGE = 0.4;

// Minimum evidence before a component is allowed to speak. Under these numbers
// the metric is noise: three impressions and one click is a 33% CTR and means
// nothing whatsoever.
export const SAMPLE = Object.freeze({
  impressions: 100,   // below this, CTR and position are not judged
  pageviews: 50,      // below this, engagement is not judged
  orders_corpus: 30,  // below this, NOBODY is judged on conversion — see below
});

/**
 * Ordinary organic CTR by position. Used only as a denominator: the score
 * never asks "is 3% good", it asks "is 3% good FOR POSITION 7".
 */
export function expectedCtr(position) {
  if (!Number.isFinite(position) || position <= 0) return null;
  const curve = [0.28, 0.15, 0.11, 0.08, 0.06, 0.05, 0.04, 0.033, 0.028, 0.025];
  if (position <= 10) {
    const i = Math.floor(position) - 1;
    const j = Math.min(9, i + 1);
    const frac = position - Math.floor(position);
    return curve[i] + (curve[j] - curve[i]) * frac;
  }
  if (position <= 20) return 0.025 - (position - 10) * 0.0015;
  if (position <= 50) return Math.max(0.002, 0.010 - (position - 20) * 0.00025);
  return 0.002;
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * @param {object} page   canonical record from metrics.mjs
 * @param {object} corpus { medianConversion, maxRevenue, totalOrders }
 * @returns {{score:number|null, grade:string, coverage:number, parts:object, missing:string[], reasons:string[]}}
 */
export function performanceScore(page, corpus = {}) {
  const parts = {};
  const missing = [];
  const reasons = [];

  const search = page.search || {};
  const behaviour = page.behaviour || {};
  const commerce = page.commerce || {};
  const content = page.content || {};

  // ---- CTR относительно позиции ----------------------------------------
  const impressions = Number(search.impressions);
  const position = Number(search.position);
  const ctr = Number(search.ctr);
  if (search.available && impressions >= SAMPLE.impressions && Number.isFinite(position) && Number.isFinite(ctr)) {
    const exp = expectedCtr(position);
    const ratio = exp ? ctr / exp : null;
    if (ratio !== null) {
      // 1.0 = exactly as expected for this position → 0.6. Twice expected → 1.0.
      parts.ctr = clamp01(0.6 * Math.min(ratio, 1) + 0.4 * clamp01((ratio - 1) / 1));
      reasons.push(`CTR ${(ctr * 100).toFixed(1)}% при ожидаемых ${(exp * 100).toFixed(1)}% для позиции ${position.toFixed(1)}`);
    }
  }
  if (parts.ctr === undefined) missing.push(search.available ? `CTR: показов ${impressions || 0} < ${SAMPLE.impressions}` : 'CTR: нет Search Console');

  // ---- Позиция ----------------------------------------------------------
  if (search.available && Number.isFinite(position) && impressions >= SAMPLE.impressions) {
    // Position 1 → 1.0, position 10 → 0.55, position 50 → 0.05.
    parts.position = clamp01(1 - Math.log10(Math.max(1, position)) / Math.log10(60));
  } else missing.push(search.available ? 'позиция: мало показов' : 'позиция: нет Search Console');

  // ---- Конверсия --------------------------------------------------------
  //
  // Gated on the CORPUS, not on the page. With thirty orders across two
  // hundred pages there is no page-level conversion rate — there is a handful
  // of orders and a lot of arithmetic. Judging pages on that would be the
  // model's opinion wearing a percentage sign.
  const pageviews = Number(behaviour.pageviews);
  const orders = Number(commerce.completed_orders);
  const totalOrders = Number(corpus.totalOrders) || 0;
  if (commerce.available && behaviour.available && totalOrders >= SAMPLE.orders_corpus
      && Number.isFinite(pageviews) && pageviews >= SAMPLE.pageviews && Number.isFinite(orders)) {
    const conv = orders / pageviews;
    const median = Number(corpus.medianConversion) || 0;
    parts.conversion = median > 0 ? clamp01(0.5 * (conv / median)) : clamp01(conv * 100);
    reasons.push(`конверсия ${(conv * 100).toFixed(2)}% при медиане ${(median * 100).toFixed(2)}%`);
  } else {
    missing.push(totalOrders < SAMPLE.orders_corpus
      ? `конверсия: во всём корпусе ${totalOrders} заказ(ов) < ${SAMPLE.orders_corpus} — судить не о чем`
      : 'конверсия: нет данных о просмотрах или заказах');
  }

  // ---- Выручка ----------------------------------------------------------
  const revenue = Number(commerce.revenue_rub);
  if (commerce.available && Number.isFinite(revenue) && Number(corpus.maxRevenue) > 0) {
    parts.revenue = clamp01(Math.log10(1 + Math.max(0, revenue)) / Math.log10(1 + corpus.maxRevenue));
  } else missing.push('выручка: нет привязки заказов к странице');

  // ---- Вовлечённость -----------------------------------------------------
  if (behaviour.available && Number.isFinite(pageviews) && pageviews >= SAMPLE.pageviews) {
    const scroll = Number(behaviour.scroll_depth);       // 0..1
    // Длительность ВИЗИТА, а не время на этой странице: времени на конкретной
    // странице в API Метрики нет. Для вовлечённости это приемлемая замена, но
    // называть её временем на странице — значит обещать точность, которой нет.
    const time = Number(behaviour.avg_visit_duration_sec);
    const bounce = Number(behaviour.bounce_rate);         // 0..1
    const bits = [];
    if (Number.isFinite(scroll)) bits.push(clamp01(scroll / 0.75));
    if (Number.isFinite(time)) bits.push(clamp01(time / 120));
    if (Number.isFinite(bounce)) bits.push(clamp01(1 - bounce / 0.8));
    if (bits.length) parts.engagement = bits.reduce((a, b) => a + b, 0) / bits.length;
  }
  if (parts.engagement === undefined) missing.push(behaviour.available ? 'вовлечённость: мало просмотров' : 'вовлечённость: нет Метрики');

  // ---- Свежесть ----------------------------------------------------------
  // Always computable: it is a property of our own files. Decays over a year
  // rather than expiring, because a page does not become wrong on a date.
  const reviewed = content.last_reviewed ? Date.parse(content.last_reviewed) : NaN;
  if (Number.isFinite(reviewed)) {
    const days = (Date.parse(page.as_of || new Date().toISOString()) - reviewed) / 86400000;
    parts.freshness = clamp01(1 - days / 365);
  } else parts.freshness = 0;

  // ---- Полнота контента --------------------------------------------------
  const c = [
    content.has_profile ? 1 : 0,
    Math.min(1, (content.faq_count || 0) / 5),
    Math.min(1, (content.why_count || 0) / 4),
    Math.min(1, (content.sources_count || 0) / 2),
  ];
  parts.completeness = c.reduce((a, b) => a + b, 0) / c.length;

  // ---- Собрать -----------------------------------------------------------
  let weighted = 0;
  let covered = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    if (parts[key] === undefined) continue;
    weighted += parts[key] * weight;
    covered += weight;
  }
  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const coverage = covered / totalWeight;
  if (coverage < MIN_COVERAGE) {
    return { score: null, grade: '—', coverage, parts, missing, reasons,
      note: `данных на ${Math.round(coverage * 100)}% веса — оценку не выставляем` };
  }
  const score = Math.round((weighted / covered) * 100);
  return { score, grade: gradeOf(score), coverage, parts, missing, reasons, note: null };
}

export function gradeOf(score) {
  if (score === null || !Number.isFinite(score)) return '—';
  if (score >= 85) return 'A+';
  if (score >= 72) return 'A';
  if (score >= 58) return 'B';
  if (score >= 42) return 'C';
  return 'D';
}

/** Corpus-level numbers every page is compared against. */
export function corpusStats(pages) {
  const convs = [];
  let maxRevenue = 0;
  let totalOrders = 0;
  for (const p of pages) {
    const pv = Number(p.behaviour?.pageviews);
    const ord = Number(p.commerce?.completed_orders);
    const rev = Number(p.commerce?.revenue_rub);
    if (Number.isFinite(rev)) maxRevenue = Math.max(maxRevenue, rev);
    if (Number.isFinite(ord)) totalOrders += ord;
    if (Number.isFinite(pv) && pv >= SAMPLE.pageviews && Number.isFinite(ord)) convs.push(ord / pv);
  }
  convs.sort((a, b) => a - b);
  const medianConversion = convs.length ? convs[Math.floor(convs.length / 2)] : 0;
  return { medianConversion, maxRevenue, totalOrders, sampleSize: convs.length };
}
