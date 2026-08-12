#!/usr/bin/env node
// Content Dashboard — состояние корпуса по РЕАЛЬНЫМ данным.
//
// Раньше здесь стоял внутренний Quality Score: оценка того, похож ли текст на
// написанный человеком. Она сделала своё дело, пока трафика не было, и стала
// бесполезной, как только он появился — красиво написанная страница может не
// ранжироваться, а невзрачная приносить выручку.
//
// Теперь колонка одна: Performance Score и буква A+…D, посчитанные из
// Search Console, Метрики и заказов. Если источника нет — стоит «—», а не
// плохая оценка. Полнота текста осталась, но весит 5 из 100.
//
//   node seo/content-dashboard.mjs           таблица
//   node seo/content-dashboard.mjs --json    для CI
//   node seo/content-dashboard.mjs --queue   только очередь редактора

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages } from './intel/metrics.mjs';
import { performanceScore, corpusStats } from './intel/performance.mjs';
import { resolveStatus, rewriteBan, topSets, researchPriority, STATUS } from './intel/decisions.mjs';
import { recommend } from './intel/recommendations.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function assess() {
  const { pages, sources, demo } = buildPages();
  const corpus = corpusStats(pages);
  const tops = topSets(pages, 10, corpus);

  const rows = pages.map((p) => {
    const perf = performanceScore(p, corpus);
    const st = resolveStatus(p, corpus);
    const ban = rewriteBan(p, corpus, tops);
    const prio = researchPriority(p, corpus);
    const { recommendations } = recommend(p, corpus, tops);
    return {
      slug: p.slug, iso: p.iso, country: p.name_ru,
      priority: p.content.priority,
      traffic_bucket: p.content.traffic_bucket,
      performance_score: perf.score, grade: perf.grade, coverage: perf.coverage,
      ctr: p.search.available ? p.search.ctr : null,
      impressions: p.search.available ? p.search.impressions : null,
      clicks: p.search.available ? p.search.clicks : null,
      position: p.search.available ? p.search.position : null,
      pageviews: p.behaviour.available ? p.behaviour.pageviews : null,
      bounce_rate: p.behaviour.available ? p.behaviour.bounce_rate : null,
      revenue_rub: p.commerce.available ? p.commerce.revenue_rub : null,
      profit_rub: p.commerce.available ? p.commerce.profit_rub : null,
      orders: p.commerce.available ? p.commerce.completed_orders : null,
      conversion: (p.behaviour.available && p.commerce.available && p.behaviour.pageviews)
        ? p.commerce.completed_orders / p.behaviour.pageviews : null,
      last_review: p.content.last_reviewed,
      next_review: p.content.next_review,
      status: st.status, statuses: st.all,
      rewrite_banned: ban.banned, ban_reasons: ban.reasons,
      research_priority: prio.score, priority_why: prio.why,
      ni_flags: st.needs_improvement.flags,
      missing: perf.missing, perf_note: perf.note,
      recommendations,
    };
  });

  return { generated_at: new Date().toISOString(), demo: Boolean(demo), sources, corpus, rows,
    tops_gated: Boolean(tops.gated), tops_why: tops.why || null,
    profiles: rows.filter((r) => r.last_review !== null).length };
}

if ((process.argv[1] || '').endsWith('content-dashboard.mjs')) {
  const report = assess();
  // Демо-прогон ничего не пишет в реальные данные: синтетика не должна иметь
  // ни одного способа оказаться в снимке, по которому потом примут решение.
  const outDir = report.demo ? null : join(ROOT, 'seo/intel/data');
  if (outDir) writeFileSync(join(outDir, 'dashboard.json'), `${JSON.stringify(report, null, 2)}\n`);

  // Снимок на дату. Без ряда снимков нельзя ответить «что растёт»: одно
  // измерение показывает уровень, а вопрос всегда про движение. Один файл в
  // день — перезапуск в тот же день переписывает, а не плодит.
  const snapDir = outDir ? join(outDir, 'snapshots') : null;
  if (snapDir) mkdirSync(snapDir, { recursive: true });
  const day = report.generated_at.slice(0, 10);
  if (snapDir) writeFileSync(join(snapDir, `${day}.json`), `${JSON.stringify({
    generated_at: report.generated_at,
    rows: report.rows.map((r) => ({
      slug: r.slug, impressions: r.impressions, clicks: r.clicks, ctr: r.ctr,
      position: r.position, pageviews: r.pageviews, revenue_rub: r.revenue_rub,
      orders: r.orders, performance_score: r.performance_score, status: r.status,
    })),
  }, null, 2)}\n`);

  if (report.demo) console.log('\n⚠️  ДЕМО-ДАННЫЕ — синтетика для проверки механики, не реальные метрики');
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const { rows, sources, corpus } = report;
    console.log('\n── ИСТОЧНИКИ ──');
    for (const [k, v] of Object.entries(sources)) {
      console.log(`  ${v.available ? '✓' : '✗'} ${k.padEnd(24)} ${v.available ? (v.granularity ? `гранулярность: ${v.granularity}` : 'подключён') : v.reason}`);
    }
    console.log(`\nВ корпусе выполненных заказов: ${corpus.totalOrders}. `
      + `${corpus.totalOrders < 30 ? 'Этого мало для оценки конверсии — компонент отключён.' : ''}`);

    const graded = rows.filter((r) => r.performance_score !== null);
    console.log(`\n── ОЦЕНКИ ──`);
    console.log(`  страниц: ${rows.length}, с профилем: ${report.profiles}, с оценкой: ${graded.length}, без данных: ${rows.length - graded.length}`);
    const byGrade = rows.reduce((a, r) => { a[r.grade] = (a[r.grade] || 0) + 1; return a; }, {});
    for (const g of ['A+', 'A', 'B', 'C', 'D', '—']) if (byGrade[g]) console.log(`  ${g.padEnd(3)} ${byGrade[g]}`);

    const byStatus = rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
    console.log(`\n── СТАТУСЫ ──`);
    for (const s of Object.values(STATUS)) if (byStatus[s]) console.log(`  ${s.padEnd(20)} ${byStatus[s]}`);

    const banned = rows.filter((r) => r.rewrite_banned);
    console.log(`\n── ЗАЩИЩЕНЫ ОТ ПЕРЕПИСЫВАНИЯ: ${banned.length} ──`);
    if (report.tops_gated) console.log(`  топы по выручке/конверсии/CTR не считаются: ${report.tops_why}`);
    for (const r of banned.slice(0, 15)) console.log(`  ${r.country.padEnd(20)} ${r.ban_reasons.join(', ')}`);

    // Две разные причины попасть в очередь, и смешивать их в одном списке
    // бессмысленно: «недобирает 85 кликов» — это работа с потенциалом,
    // «отказы 82% и позиция 40» — работа с проблемой.
    const potential = rows.filter((r) => r.research_priority > 0)
      .sort((a, b) => b.research_priority - a.research_priority);
    const broken = rows.filter((r) => r.status === STATUS.NEEDS_IMPROVEMENT && r.research_priority === 0)
      .sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
    console.log(`\n── ОЧЕРЕДЬ РЕДАКТОРА ──`);
    console.log(`  по потенциалу роста: ${potential.length}`);
    for (const r of potential.slice(0, 15)) console.log(`    ${String(r.research_priority).padStart(6)}  ${r.country.padEnd(20)} ${r.priority_why}`);
    console.log(`  по проблемам: ${broken.length}`);
    for (const r of broken.slice(0, 10)) console.log(`    ${String(r.impressions ?? '—').padStart(6)} показов  ${r.country.padEnd(20)} ${r.ni_flags.join('; ')}`);
    const queue = [...potential, ...broken];
    if (!queue.length) console.log('  пусто — приоритет считается из показов и CTR, а поисковых данных пока нет');

    const money = rows.filter((r) => r.revenue_rub > 0).sort((a, b) => b.revenue_rub - a.revenue_rub);
    console.log(`\n── ВЫРУЧКА (гранулярность: страна) ──`);
    if (money.length) {
      console.log(`  ${'страна'.padEnd(20)} заказов  выручка  прибыль`);
      for (const r of money) console.log(`  ${r.country.padEnd(20)} ${String(r.orders).padStart(7)}  ${String(Math.round(r.revenue_rub)).padStart(7)}  ${String(Math.round(r.profit_rub)).padStart(7)}`);
    } else console.log('  нет данных о заказах');

    console.log(`\nseo/intel/data/dashboard.json обновлён.`);
  }
}
