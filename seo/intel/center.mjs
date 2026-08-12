#!/usr/bin/env node
// Content Intelligence Center — одна страница, отвечающая на вопрос
// «что происходит с двумястами страницами».
//
// Собирается ВНЕ репозитория сайта. Это не эстетика: репозиторий целиком
// раздаётся GitHub Pages, и любой файл в нём — публичный URL. Внутренняя
// панель с выручкой, прибылью и очередью правок публичной быть не должна.
//
//   node seo/intel/center.mjs
//   → ~/Desktop/eSim/content-intelligence/index.html

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { assess } from '../content-dashboard.mjs';
import { STATUS } from './decisions.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = process.env.INTEL_OUT || join(homedir(), 'Desktop/eSim/content-intelligence');
const SNAPSHOTS = join(ROOT, process.env.INTEL_DATA_DIR || 'seo/intel/data', 'snapshots');

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const pct = (v, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—');
const num = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString('ru-RU') : '—');
const pos = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');

/** Рост считается только между двумя снимками. С одним — честное «нет ряда». */
function growth(rows) {
  if (!existsSync(SNAPSHOTS)) return { available: false, reason: 'снимков ещё нет' };
  const files = readdirSync(SNAPSHOTS).filter((f) => f.endsWith('.json')).sort();
  if (files.length < 2) return { available: false, reason: `снимков ${files.length} — для динамики нужно минимум два` };
  const oldest = JSON.parse(readFileSync(join(SNAPSHOTS, files[0]), 'utf8'));
  const prev = new Map(oldest.rows.map((r) => [r.slug, r]));
  const out = [];
  for (const r of rows) {
    const before = prev.get(r.slug);
    if (!before || !Number.isFinite(before.clicks) || !Number.isFinite(r.clicks)) continue;
    out.push({ ...r, delta_clicks: r.clicks - before.clicks, delta_position: (r.position ?? 0) - (before.position ?? 0) });
  }
  return { available: true, since: files[0].replace('.json', ''), rows: out };
}

const report = assess();
const rows = report.rows;
const g = growth(rows);

const withSearch = rows.filter((r) => Number.isFinite(r.impressions) && r.impressions > 0);
const has = (arr) => arr.length > 0;

const boards = [
  { id: 'winners', title: 'Top Winners', hint: 'лучший Performance Score',
    rows: rows.filter((r) => r.performance_score !== null).sort((a, b) => b.performance_score - a.performance_score).slice(0, 10),
    cols: ['grade', 'score', 'ctr', 'position'] },
  { id: 'losers', title: 'Top Losers', hint: 'худший Performance Score при наличии трафика',
    rows: rows.filter((r) => r.performance_score !== null && r.impressions > 0).sort((a, b) => a.performance_score - b.performance_score).slice(0, 10),
    cols: ['grade', 'score', 'ctr', 'position'] },
  { id: 'growing', title: 'Fastest Growing', hint: g.available ? `изменение кликов с ${g.since}` : g.reason,
    rows: g.available ? g.rows.sort((a, b) => b.delta_clicks - a.delta_clicks).slice(0, 10) : [],
    cols: ['delta_clicks', 'clicks', 'position'] },
  { id: 'revenue', title: 'Highest Revenue', hint: 'гранулярность: страна, не страница',
    rows: rows.filter((r) => r.revenue_rub > 0).sort((a, b) => b.revenue_rub - a.revenue_rub).slice(0, 10),
    cols: ['orders', 'revenue', 'profit'] },
  { id: 'lowctr', title: 'Lowest CTR', hint: 'относительно позиции, при достаточных показах',
    rows: withSearch.filter((r) => r.impressions >= 100).sort((a, b) => a.ctr - b.ctr).slice(0, 10),
    cols: ['ctr', 'position', 'impressions'] },
  { id: 'bounce', title: 'Highest Bounce', hint: 'по данным Метрики',
    rows: rows.filter((r) => Number.isFinite(r.bounce_rate)).sort((a, b) => b.bounce_rate - a.bounce_rate).slice(0, 10),
    cols: ['bounce', 'pageviews'] },
  { id: 'review', title: 'Needs Review', hint: 'очередь редактора по потенциалу роста',
    rows: rows.filter((r) => r.status === STATUS.NEEDS_IMPROVEMENT || r.status === STATUS.STALE || r.research_priority > 0)
      .sort((a, b) => b.research_priority - a.research_priority).slice(0, 15),
    cols: ['status', 'priority_score', 'why'] },
  { id: 'hp', title: 'High Performer', hint: 'автоматически защищены от переписывания',
    rows: rows.filter((r) => r.statuses.includes(STATUS.HIGH_PERFORMER)), cols: ['ctr', 'position', 'revenue'] },
  { id: 'locked', title: 'Locked', hint: 'заблокированы вручную',
    rows: rows.filter((r) => r.statuses.includes(STATUS.LOCKED)), cols: ['status'] },
];

const cell = (r, col) => {
  switch (col) {
    case 'grade': return `<span class="grade g${r.grade.replace('+', 'plus').replace('—', 'none')}">${esc(r.grade)}</span>`;
    case 'score': return num(r.performance_score);
    case 'ctr': return pct(r.ctr, 2);
    case 'position': return pos(r.position);
    case 'impressions': return num(r.impressions);
    case 'clicks': return num(r.clicks);
    case 'delta_clicks': return `${r.delta_clicks > 0 ? '+' : ''}${num(r.delta_clicks)}`;
    case 'pageviews': return num(r.pageviews);
    case 'bounce': return pct(r.bounce_rate, 0);
    case 'orders': return num(r.orders);
    case 'revenue': return `${num(r.revenue_rub)} ₽`;
    case 'profit': return `${num(r.profit_rub)} ₽`;
    case 'status': return esc(r.status);
    case 'priority_score': return num(r.research_priority);
    case 'why': return esc(r.research_priority > 0 ? r.priority_why : (r.ni_flags?.join('; ') || r.priority_why));
    default: return '—';
  }
};
const HEAD = { grade: 'оценка', score: 'score', ctr: 'CTR', position: 'позиция', impressions: 'показы',
  clicks: 'клики', delta_clicks: 'Δ кликов', pageviews: 'просмотры', bounce: 'отказы', orders: 'заказы',
  revenue: 'выручка', profit: 'прибыль', status: 'статус', priority_score: 'приоритет', why: 'почему' };

const board = (b) => `
<section class="board" id="${b.id}">
  <h2>${esc(b.title)} <span class="hint">${esc(b.hint)}</span></h2>
  ${has(b.rows) ? `<table>
    <thead><tr><th>страна</th>${b.cols.map((c) => `<th>${esc(HEAD[c])}</th>`).join('')}</tr></thead>
    <tbody>${b.rows.map((r) => `<tr><td class="country">${esc(r.country)}</td>${b.cols.map((c) => `<td>${cell(r, c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>` : `<p class="empty">нет данных</p>`}
</section>`;

const sourceRow = ([id, s]) => `<tr>
  <td>${s.available ? '<span class="ok">✓</span>' : '<span class="no">✗</span>'}</td>
  <td class="country">${esc(id)}</td>
  <td>${esc(s.available ? (s.granularity ? `гранулярность: ${s.granularity}` : 'подключён') : s.reason)}</td>
</tr>`;

const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Content Intelligence Center — Magic eSIM</title>
<style>
  :root{--bg:#fff;--fg:#14161a;--mut:#6b7280;--line:#e5e7eb;--card:#fafafa;--acc:#2563eb}
  @media(prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--mut:#8b949e;--line:#21262d;--card:#161b22;--acc:#58a6ff}}
  *{box-sizing:border-box}
  body{margin:0;padding:2rem 1.25rem 4rem;background:var(--bg);color:var(--fg);
       font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:1200px;margin-inline:auto}
  h1{font-size:1.6rem;margin:0 0 .25rem}
  .sub{color:var(--mut);margin:0 0 2rem}
  h2{font-size:1.05rem;margin:0 0 .6rem;display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap}
  .hint{font-weight:400;font-size:.82rem;color:var(--mut)}
  .board{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:1rem 1.1rem;margin-bottom:1rem}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:1rem}
  table{width:100%;border-collapse:collapse;font-size:.88rem;display:block;overflow-x:auto}
  th,td{text-align:right;padding:.35rem .5rem;border-bottom:1px solid var(--line);white-space:nowrap}
  th{color:var(--mut);font-weight:500;font-size:.78rem}
  th:first-child,td:first-child{text-align:left}
  .country{font-weight:500}
  .empty{color:var(--mut);font-style:italic;margin:.3rem 0 0}
  .ok{color:#16a34a}.no{color:#dc2626}
  .grade{display:inline-block;min-width:2.1em;text-align:center;padding:.05rem .35rem;border-radius:5px;font-weight:600;font-size:.8rem}
  .gAplus{background:#16a34a;color:#fff}.gA{background:#65a30d;color:#fff}.gB{background:#ca8a04;color:#fff}
  .gC{background:#ea580c;color:#fff}.gD{background:#dc2626;color:#fff}.gnone{background:var(--line);color:var(--mut)}
  .banner{border-left:3px solid var(--acc);padding:.7rem 1rem;background:var(--card);border-radius:0 8px 8px 0;margin-bottom:1.5rem}
  code{font-size:.85em;background:var(--line);padding:.1em .35em;border-radius:4px}
</style></head>
<body>
<h1>Content Intelligence Center</h1>
<p class="sub">Magic eSIM · ${esc(report.rows.length)} страниц · снимок ${esc(report.generated_at.slice(0, 16).replace('T', ' '))}</p>

${report.demo ? `<div class="banner" style="border-color:#dc2626">
  <strong>⚠️ ДЕМО-ДАННЫЕ.</strong> Это синтетические цифры для проверки механики.
  Ни одна из них не является измерением. Реальный отчёт собирается без <code>INTEL_DATA_DIR</code>.
</div>` : ''}
<div class="banner">
  <strong>Оценок выставлено: ${report.rows.filter((r) => r.performance_score !== null).length} из ${report.rows.length}.</strong>
  Страница без данных получает «—», а не низкую оценку: отсутствие источника — это не плохой результат.
  В корпусе ${report.corpus.totalOrders} выполненных заказ(ов)${report.corpus.totalOrders < 30 ? ' — компонент конверсии отключён до 30' : ''}.
</div>

<section class="board">
  <h2>Источники <span class="hint">Tier 1 — факты; Tier 2 — только интент; Tier 3 — не используются</span></h2>
  <table><tbody>${Object.entries(report.sources).map(sourceRow).join('')}</tbody></table>
</section>

<div class="grid">${boards.map(board).join('')}</div>

<section class="board">
  <h2>Все страницы</h2>
  <table>
    <thead><tr><th>страна</th><th>приоритет</th><th>трафик</th><th>оценка</th><th>score</th><th>CTR</th>
      <th>позиция</th><th>выручка</th><th>конверсия</th><th>ревизия</th><th>следующая</th><th>статус</th></tr></thead>
    <tbody>${rows
      .slice()
      .sort((a, b) => (b.research_priority - a.research_priority)
        || ((b.revenue_rub || 0) - (a.revenue_rub || 0))
        || a.country.localeCompare(b.country, 'ru'))
      .map((r) => `<tr>
        <td class="country">${esc(r.country)}</td>
        <td>${esc(r.priority || '—')}</td>
        <td>${esc(r.traffic_bucket || '—')}</td>
        <td><span class="grade g${r.grade.replace('+', 'plus').replace('—', 'none')}">${esc(r.grade)}</span></td>
        <td>${num(r.performance_score)}</td>
        <td>${pct(r.ctr, 2)}</td>
        <td>${pos(r.position)}</td>
        <td>${r.revenue_rub ? `${num(r.revenue_rub)} ₽` : '—'}</td>
        <td>${pct(r.conversion, 2)}</td>
        <td>${esc(r.last_review || '—')}</td>
        <td>${esc(r.next_review || '—')}</td>
        <td>${esc(r.status)}${r.rewrite_banned ? ' 🔒' : ''}</td>
      </tr>`).join('')}</tbody>
  </table>
</section>

<p class="sub">Собирается локально: <code>node seo/intel/collect.mjs &amp;&amp; node seo/intel/center.mjs</code>.
Вне репозитория сайта — панель не должна быть публичной.</p>
</body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'index.html'), html);
console.log(`Content Intelligence Center → ${join(OUT_DIR, 'index.html')}`);
console.log(`  страниц ${rows.length}, с оценкой ${rows.filter((r) => r.performance_score !== null).length}, `
  + `источников подключено ${Object.values(report.sources).filter((s) => s.available).length}/${Object.keys(report.sources).length}`);
