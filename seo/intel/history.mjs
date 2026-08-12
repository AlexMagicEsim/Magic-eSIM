// История изменений и то, что после них произошло.
//
// A change log alone answers "who touched this". The useful question is "did
// it help", and that needs the metrics BEFORE and the metrics AFTER, measured
// over comparable windows. So an entry is written at change time with a
// snapshot of the current numbers, and closed later when enough days have
// passed to compare.
//
// The comparison is deliberately conservative: fewer than MIN_DAYS_AFTER days,
// or fewer than MIN_IMPRESSIONS in either window, and the verdict is
// "рано судить" rather than a number. Search metrics move slowly and a verdict
// after three days is a coin flip with a decimal point.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const HISTORY_FILE = join(ROOT, 'seo/intel/data/history.json');

export const MIN_DAYS_AFTER = 21;
export const MIN_IMPRESSIONS = 200;

function load() {
  if (!existsSync(HISTORY_FILE)) return { entries: [] };
  try { return JSON.parse(readFileSync(HISTORY_FILE, 'utf8')); } catch { return { entries: [] }; }
}

function save(db) {
  mkdirSync(dirname(HISTORY_FILE), { recursive: true });
  writeFileSync(HISTORY_FILE, `${JSON.stringify(db, null, 2)}\n`);
}

const snap = (page) => ({
  impressions: page?.search?.impressions ?? null,
  clicks: page?.search?.clicks ?? null,
  ctr: page?.search?.ctr ?? null,
  position: page?.search?.position ?? null,
  pageviews: page?.behaviour?.pageviews ?? null,
  bounce_rate: page?.behaviour?.bounce_rate ?? null,
  orders: page?.commerce?.completed_orders ?? null,
  revenue_rub: page?.commerce?.revenue_rub ?? null,
});

/** Record a change. `what` should say what actually changed, not "updated". */
export function recordChange({ slug, who, what, fields = [], page = null, at = new Date().toISOString() }) {
  const db = load();
  const entry = {
    id: `${slug}-${at}`,
    slug, who, what, fields, at,
    before: snap(page),
    after: null,
    verdict: null,
  };
  db.entries.push(entry);
  save(db);
  return entry;
}

/**
 * Close open entries whose waiting period has elapsed, using today's metrics.
 * Returns what it closed, so a report can show it.
 */
export function settle(pages, now = new Date()) {
  const db = load();
  const byslug = new Map(pages.map((p) => [p.slug, p]));
  const closed = [];
  for (const e of db.entries) {
    if (e.after) continue;
    const days = (now - Date.parse(e.at)) / 86400000;
    if (days < MIN_DAYS_AFTER) continue;
    const page = byslug.get(e.slug);
    if (!page) continue;
    e.after = snap(page);
    e.days_between = Math.round(days);
    e.verdict = verdictOf(e.before, e.after);
    closed.push(e);
  }
  if (closed.length) save(db);
  return closed;
}

export function verdictOf(before, after) {
  const enough = (x) => Number.isFinite(x?.impressions) && x.impressions >= MIN_IMPRESSIONS;
  if (!enough(before) || !enough(after)) {
    return { call: 'рано судить', why: `нужно ≥${MIN_IMPRESSIONS} показов в обоих окнах` };
  }
  const d = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? b - a : null);
  const dCtr = d(before.ctr, after.ctr);
  const dPos = d(before.position, after.position);
  const dRev = d(before.revenue_rub, after.revenue_rub);
  const moves = [];
  if (dCtr !== null) moves.push(`CTR ${(dCtr * 100).toFixed(2)} п.п.`);
  if (dPos !== null) moves.push(`позиция ${dPos > 0 ? '+' : ''}${dPos.toFixed(1)}`);
  if (dRev !== null) moves.push(`выручка ${dRev > 0 ? '+' : ''}${Math.round(dRev)} ₽`);
  // Position improving means the number going DOWN. Getting this backwards is
  // the classic way a dashboard congratulates itself on a collapse.
  const better = (dCtr ?? 0) > 0 || (dPos ?? 0) < -0.5;
  const worse = (dCtr ?? 0) < 0 && (dPos ?? 0) > 0.5;
  return {
    call: worse ? 'хуже' : better ? 'лучше' : 'без изменений',
    why: moves.join(', '),
  };
}

export function listHistory(slug = null) {
  const db = load();
  return slug ? db.entries.filter((e) => e.slug === slug) : db.entries;
}
