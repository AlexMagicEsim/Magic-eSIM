// What the system is allowed to DO with a page, given what it measured.
//
// Three separate questions, deliberately kept apart:
//
//   STATUS       what state is this page in
//   REWRITE BAN  may an automated pipeline change its text
//   PRIORITY     if an editor has one hour, which page earns it
//
// They are not the same question. A page can be a High Performer (status),
// protected from rewriting (ban), and still top the editor queue (priority) —
// because the recommendation "add an internal link" is not a rewrite.

import { expectedCtr, SAMPLE } from './performance.mjs';

export const STATUS = Object.freeze({
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  REVIEWED: 'Reviewed',
  HIGH_PERFORMER: 'High Performer',
  NEEDS_IMPROVEMENT: 'Needs Improvement',
  STALE: 'Stale',
  LOCKED: 'Locked',
});

// First match wins. Locked outranks everything because it is a human decision
// and no measurement may overrule it; Draft outranks performance because an
// unpublished page's numbers belong to whatever is live in its place.
const PRECEDENCE = [STATUS.LOCKED, STATUS.DRAFT, STATUS.HIGH_PERFORMER,
  STATUS.NEEDS_IMPROVEMENT, STATUS.STALE, STATUS.REVIEWED, STATUS.PUBLISHED];

export const STALE_DAYS = 180;

// Ниже этого недобор кликов — шум, а не задача.
export const MIN_MISSED_CLICKS = 5;

/**
 * High Performer — proven, not promising.
 *
 * All three of CTR, position and conversion must be good, and each only counts
 * on enough evidence. Any one of them alone is a page that got lucky in one
 * dimension. The sample gates matter more than the thresholds: promoting a
 * page on twelve impressions freezes it against improvement forever, and the
 * freeze is the expensive part.
 */
export function isHighPerformer(page, corpus = {}) {
  const s = page.search || {};
  const c = page.commerce || {};
  const b = page.behaviour || {};
  if (!s.available || !Number.isFinite(s.impressions) || s.impressions < 300) return { yes: false, why: 'мало показов для такого решения' };
  if (!Number.isFinite(s.clicks) || s.clicks < 20) return { yes: false, why: 'меньше 20 кликов' };
  const exp = expectedCtr(s.position);
  const ratio = exp ? s.ctr / exp : null;
  if (!ratio || ratio < 1.2) return { yes: false, why: `CTR ${ratio ? ratio.toFixed(2) : '—'}× от ожидаемого, нужно ≥1.2×` };
  if (!(s.position <= 10)) return { yes: false, why: `позиция ${s.position?.toFixed?.(1) ?? '—'}, нужно ≤10` };
  // Conversion only participates when the corpus can support the notion.
  if (Number(corpus.totalOrders) >= SAMPLE.orders_corpus) {
    const pv = Number(b.pageviews);
    const ord = Number(c.completed_orders);
    if (!(pv >= SAMPLE.pageviews) || !Number.isFinite(ord)) return { yes: false, why: 'нет данных о конверсии' };
    if (ord / pv < Number(corpus.medianConversion || 0)) return { yes: false, why: 'конверсия ниже медианы' };
  }
  return { yes: true, why: `CTR ${ratio.toFixed(2)}× ожидаемого, позиция ${s.position.toFixed(1)}, ${s.clicks} кликов` };
}

/**
 * Needs Improvement — two independent bad signals, not one.
 *
 * One weak metric is noise or a seasonal dip. Two agreeing metrics is a page
 * with a problem. Requiring two is what keeps the editor queue from becoming
 * the whole corpus.
 */
export function needsImprovement(page, corpus = {}) {
  const s = page.search || {};
  const b = page.behaviour || {};
  const c = page.commerce || {};
  const flags = [];
  if (s.available && s.impressions >= SAMPLE.impressions) {
    const exp = expectedCtr(s.position);
    if (exp && s.ctr / exp < 0.7) flags.push(`CTR ${(s.ctr / exp).toFixed(2)}× от ожидаемого для позиции ${s.position.toFixed(1)}`);
    if (s.position > 20) flags.push(`позиция ${s.position.toFixed(1)}`);
  }
  if (b.available && b.pageviews >= SAMPLE.pageviews) {
    if (Number.isFinite(b.bounce_rate) && b.bounce_rate > 0.7) flags.push(`отказы ${Math.round(b.bounce_rate * 100)}%`);
    if (Number.isFinite(b.time_on_page_sec) && b.time_on_page_sec < 30) flags.push(`${Math.round(b.time_on_page_sec)} с на странице`);
    if (Number.isFinite(b.scroll_depth) && b.scroll_depth < 0.3) flags.push(`дочитывают до ${Math.round(b.scroll_depth * 100)}%`);
  }
  if (Number(corpus.totalOrders) >= SAMPLE.orders_corpus && c.available && b.pageviews >= SAMPLE.pageviews) {
    const conv = Number(c.completed_orders) / b.pageviews;
    if (conv < 0.5 * Number(corpus.medianConversion || 0)) flags.push('конверсия вдвое ниже медианы');
  }
  return { yes: flags.length >= 2, flags };
}

/** The single status shown in the dashboard. */
export function resolveStatus(page, corpus = {}) {
  const content = page.content || {};
  const found = new Set();

  if (content.locked) found.add(STATUS.LOCKED);
  if (content.status === 'draft') found.add(STATUS.DRAFT);
  if (content.status === 'reviewed') found.add(STATUS.REVIEWED);
  if (content.status === 'published') found.add(STATUS.PUBLISHED);

  const hp = isHighPerformer(page, corpus);
  if (hp.yes) found.add(STATUS.HIGH_PERFORMER);
  const ni = needsImprovement(page, corpus);
  if (ni.yes) found.add(STATUS.NEEDS_IMPROVEMENT);

  const reviewed = content.last_reviewed ? Date.parse(content.last_reviewed) : NaN;
  const age = Number.isFinite(reviewed) ? (Date.now() - reviewed) / 86400000 : Infinity;
  const nextDue = content.next_review ? Date.parse(content.next_review) < Date.now() : false;
  if (content.has_profile && (age > STALE_DAYS || nextDue)) found.add(STATUS.STALE);

  const status = PRECEDENCE.find((s) => found.has(s)) || STATUS.PUBLISHED;
  return { status, all: [...found], high_performer: hp, needs_improvement: ni, age_days: Number.isFinite(age) ? Math.round(age) : null };
}

/**
 * May the pipeline rewrite this page's text?
 *
 * The bar is deliberately asymmetric. Rewriting a page that earns money can
 * cost real revenue and the loss is invisible for weeks; NOT rewriting a page
 * costs a delay. So the ban triggers on any single reason, and every reason
 * produces recommendations instead.
 */
export function rewriteBan(page, corpus = {}, tops = {}) {
  const reasons = [];
  if (page.content?.locked) reasons.push('страница заблокирована вручную (LOCK PAGE)');
  if (isHighPerformer(page, corpus).yes) reasons.push('High Performer');
  if (tops.revenue?.has(page.slug)) reasons.push('в топе по выручке');
  if (tops.conversion?.has(page.slug)) reasons.push('в топе по конверсии');
  if (tops.ctr?.has(page.slug)) reasons.push('в топе по CTR');
  return { banned: reasons.length > 0, reasons };
}

/**
 * Top-N sets used by the ban.
 *
 * Gated on the corpus having enough evidence to HAVE a top. With five orders
 * spread over four countries, "топ-10 по выручке" is just "все, у кого была
 * хоть одна продажа" — and freezing a page because it once sold a 50 ₽ tariff
 * is the opposite of what the ban is for. Below the gate the sets are empty
 * and only Locked and High Performer can protect a page.
 */
export function topSets(pages, n = 10, corpus = {}) {
  const enoughOrders = Number(corpus.totalOrders) >= SAMPLE.orders_corpus;
  const enoughSearch = pages.some((p) => p.search?.available && p.search.impressions >= SAMPLE.impressions);
  const empty = new Set();
  if (!enoughOrders && !enoughSearch) {
    return { revenue: empty, conversion: empty, ctr: empty, gated: true,
      why: `в корпусе ${Number(corpus.totalOrders) || 0} заказ(ов) и нет поисковых данных — топы не считаются` };
  }
  const by = (fn) => new Set(pages
    .map((p) => [p.slug, fn(p)])
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([slug]) => slug));
  return {
    revenue: enoughOrders ? by((p) => Number(p.commerce?.revenue_rub)) : empty,
    conversion: enoughOrders ? by((p) => {
      const pv = Number(p.behaviour?.pageviews);
      return pv >= SAMPLE.pageviews ? Number(p.commerce?.completed_orders) / pv : NaN;
    }) : empty,
    ctr: enoughSearch ? by((p) => (p.search?.available && p.search.impressions >= SAMPLE.impressions ? p.search.ctr : NaN)) : empty,
    gated: false, why: null,
  };
}

/**
 * Research Priority — potential, not popularity.
 *
 * The question is not "which page is important" but "which page is leaving the
 * most clicks on the table". A page with 20 000 impressions at half the CTR it
 * should have is worth more editor time than a perfect page with 40
 * impressions, and country size has nothing to do with it.
 *
 *   missed clicks = impressions × (expected CTR at this position − actual CTR)
 *
 * Revenue weighting is applied only where revenue is actually attributable;
 * otherwise the pure click gap stands on its own.
 */
export function researchPriority(page, corpus = {}) {
  const s = page.search || {};
  if (!s.available || !Number.isFinite(s.impressions) || s.impressions < SAMPLE.impressions) {
    return { score: 0, missed_clicks: null, why: 'нет поисковых данных — приоритет не считается' };
  }
  const exp = expectedCtr(s.position);
  if (!exp) return { score: 0, missed_clicks: null, why: 'нет позиции' };
  const missed = Math.max(0, s.impressions * (exp - s.ctr));
  // A page that already beats its position has nothing to recover here.
  if (missed <= 0) return { score: 0, missed_clicks: 0, why: 'CTR уже выше ожидаемого для позиции' };
  // И пол по абсолютной величине. Страница, недобирающая один клик в месяц,
  // формально «в очереди», но очередь из сорока таких страниц — это не очередь,
  // а список всего корпуса, отсортированный по шуму.
  if (missed < MIN_MISSED_CLICKS) {
    return { score: 0, missed_clicks: Math.round(missed),
      why: `недобор меньше ${MIN_MISSED_CLICKS} кликов — не повод занимать редактора` };
  }

  const rev = Number(page.commerce?.revenue_rub);
  const maxRev = Number(corpus.maxRevenue) || 0;
  const revenueWeight = maxRev > 0 && Number.isFinite(rev)
    ? 1 + Math.log10(1 + rev) / Math.log10(1 + maxRev)
    : 1;
  return {
    score: Math.round(missed * revenueWeight),
    missed_clicks: Math.round(missed),
    why: `${Math.round(missed)} недополученных кликов при позиции ${s.position.toFixed(1)}`
      + (revenueWeight > 1.01 ? `, вес по выручке ×${revenueWeight.toFixed(2)}` : ''),
  };
}
