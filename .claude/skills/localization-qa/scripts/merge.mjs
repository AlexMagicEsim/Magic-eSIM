#!/usr/bin/env node
// Merge a run into ONE report: the deterministic findings (check.json), the reviewers' findings (ai/*.json) and, when
// present, the second opinions on critical/major ones (verify/*.json). Writes <run>/report.json and <run>/report.md.
//
//   node .claude/skills/localization-qa/scripts/merge.mjs --run <run dir> [--commit <sha>]
//
// Trust nothing a model wrote about the strings themselves: `en`, `target`, `where`, `url` always come from items.json;
// a finding about an unknown string, with an unknown category/severity or a confidence outside 0–1 is dropped and
// counted; below 0.5 confidence it is dropped (rubric). Rejected second opinions are kept in the report, apart.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CATEGORIES = ['grammar', 'spelling', 'punctuation', 'fluency', 'accuracy', 'terminology', 'platform-label', 'seo',
  'consistency', 'country-name', 'placeholder', 'claim', 'style-variant'];
export const SEVERITIES = ['critical', 'major', 'minor', 'preferential'];
const RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));
const SEV_RU = { critical: 'критично', major: 'важно', minor: 'мелко', preferential: 'на вкус' };

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readDir = (d) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.json')).sort().flatMap((f) => {
  const v = readJson(join(d, f)); return Array.isArray(v) ? v.map((x) => ({ ...x, __file: f })) : [];
}) : []);

export function merge({ run: runData, check = [], ai = [], verify = [], commit = '' }) {
  const byId = new Map(runData.items.map((it) => [it.id, it]));
  const dropped = { unknownItem: 0, badShape: 0, lowConfidence: 0, duplicate: 0 };
  const norm = (f, src, n) => {
    const it = byId.get(f.item_id);
    if (!it) { dropped.unknownItem++; return null; }
    const conf = Number(f.confidence);
    if (!CATEGORIES.includes(f.category) || !SEVERITIES.includes(f.severity) || !(conf >= 0 && conf <= 1) || !f.explanation) { dropped.badShape++; return null; }
    if (conf < 0.5) { dropped.lowConfidence++; return null; }
    return { id: src === 'ai' ? (f.id && /^A\d+$/.test(f.id) ? f.id : `A${String(n).padStart(4, '0')}`) : f.id,
      item_id: it.id, group: it.group, key: it.key, kind: it.kind, where: it.where, url: it.url, en: it.en, target: it.target,
      suggestion: typeof f.suggestion === 'string' ? f.suggestion : '', explanation: String(f.explanation),
      category: f.category, severity: f.severity, confidence: Math.round(conf * 100) / 100, source: src, rule: String(f.rule || f.category) };
  };
  let n = 0;
  const all = [...check.map((f) => norm(f, 'check')), ...ai.map((f) => norm(f, 'ai', ++n))].filter(Boolean);
  // renumber AI ids uniquely (batches each start at A0001)
  let a = 0; for (const f of all) if (f.source === 'ai') f.id = `A${String(++a).padStart(4, '0')}`;
  // second opinions, keyed by the report's finding id (stable: AI files are read in name order)
  const rejected = [];
  const verdictFor = new Map(verify.map((v) => [v.id, v]));
  const kept = [];
  for (const f of all) {
    const v = verdictFor.get(f.id);
    if (v && v.verdict === 'reject') { rejected.push({ ...f, verify: { verdict: 'reject', reason: v.reason } }); continue; }
    if (v && v.verdict === 'downgrade' && SEVERITIES.includes(v.severity)) { f.verify = { verdict: 'downgrade', from: f.severity, reason: v.reason }; f.severity = v.severity; }
    else if (v && v.verdict === 'confirm') f.verify = { verdict: 'confirm', reason: v.reason };
    if (v && v.verdict !== 'reject' && !f.suggestion && typeof v.suggestion === 'string' && v.suggestion.trim()) { f.suggestion = v.suggestion.trim(); f.suggestion_by = 'second opinion'; }
    kept.push(f);
  }
  // duplicates: same string, same category, same suggestion
  const seen = new Set(); const findings = [];
  for (const f of kept) { const k = `${f.item_id}|${f.category}|${f.suggestion}`; if (seen.has(k)) { dropped.duplicate++; continue; } seen.add(k); findings.push(f); }
  findings.sort((x, y) => RANK[x.severity] - RANK[y.severity] || y.confidence - x.confidence || x.item_id.localeCompare(y.item_id));
  const count = (arr, k) => arr.reduce((m, f) => ((m[f[k]] = (m[f[k]] || 0) + 1), m), {});
  return {
    meta: { lang: runData.lang, generated: new Date().toISOString(), commit, strings: runData.items.length,
      strings_with_findings: new Set(findings.map((f) => f.item_id)).size, findings: findings.length,
      by_severity: count(findings, 'severity'), by_category: count(findings, 'category'), by_source: count(findings, 'source'),
      verified: findings.filter((f) => f.verify).length, rejected_by_second_opinion: rejected.length, dropped },
    findings, rejected,
  };
}

const esc = (s) => String(s).replace(/\|/g, '\\|');
const quote = (s) => String(s).split('\n').map((l) => `> ${l}`).join('\n');

export function markdown(report) {
  const m = report.meta;
  const lines = [`# Ревью локализации: ${m.lang} — ${m.generated.slice(0, 10)}`, '',
    `Строк проверено: **${m.strings}** · строк с замечаниями: **${m.strings_with_findings}** · замечаний: **${m.findings}**` +
    (m.commit ? ` · код: \`${m.commit.slice(0, 8)}\`` : ''), '',
    'Отчёт ИИ и механических проверок. **Ничего не исправлено автоматически**; это материал для окончательного согласования после независимой оценки носителя.', '',
    '| Серьёзность | Замечаний |', '|---|---|', ...['critical', 'major', 'minor', 'preferential'].map((s) => `| ${SEV_RU[s]} (${s}) | ${m.by_severity[s] || 0} |`), '',
    '| Категория | Замечаний |', '|---|---|', ...Object.entries(m.by_category).sort((a, b) => b[1] - a[1]).map(([c, n]) => `| ${c} | ${n} |`), '',
    `Источник: механические проверки ${m.by_source.check || 0}, ИИ-ревью ${m.by_source.ai || 0}; второе мнение подтвердило или понизило ${m.verified}, отклонило ${m.rejected_by_second_opinion}.` +
    ` Отброшено при сверке: неизвестная строка ${m.dropped.unknownItem}, неверная форма ${m.dropped.badShape}, уверенность < 0.5 ${m.dropped.lowConfidence}, дубликаты ${m.dropped.duplicate}.`, ''];
  const groups = [...new Set(report.findings.map((f) => f.group))];
  for (const g of groups) {
    lines.push(`## ${g}`, '');
    for (const f of report.findings.filter((x) => x.group === g)) {
      lines.push(`### ${f.id} · ${SEV_RU[f.severity]} · ${f.category} · уверенность ${f.confidence}`, '',
        `\`${f.key}\` — ${f.where} — [на сайте](${f.url})`, '', '**EN**', '', quote(f.en), '', '**Сейчас**', '', quote(f.target), '');
      if (f.suggestion) lines.push('**Предложение**', '', quote(f.suggestion), '');
      lines.push(`**Почему:** ${f.explanation}` + (f.verify ? ` _(второе мнение: ${f.verify.verdict}${f.verify.reason ? ` — ${f.verify.reason}` : ''})_` : '') + ` · правило \`${esc(f.rule)}\` · ${f.source}`, '');
    }
  }
  if (report.rejected.length) {
    lines.push('## Отклонено вторым мнением', '');
    for (const f of report.rejected) lines.push(`- ${f.item_id} · ${f.category} · «${f.target.slice(0, 60)}» → «${f.suggestion.slice(0, 60)}» — ${f.verify.reason}`);
  }
  return lines.join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const run = resolve(arg('--run'));
  const report = merge({ run: readJson(join(run, 'items.json')), check: existsSync(join(run, 'check.json')) ? readJson(join(run, 'check.json')) : [],
    ai: readDir(join(run, 'ai')), verify: readDir(join(run, 'verify')), commit: arg('--commit') || '' });
  writeFileSync(join(run, 'report.json'), JSON.stringify(report, null, 1));
  writeFileSync(join(run, 'report.md'), markdown(report));
  console.error(`${report.meta.lang}: ${report.meta.findings} findings`, JSON.stringify(report.meta.by_severity), 'dropped', JSON.stringify(report.meta.dropped));
}
