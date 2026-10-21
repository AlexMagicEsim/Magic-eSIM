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
// Stage folders (ai/linguistic, ai/fidelity) and, for an older run, flat files in ai/.
const readStages = (d) => [...readDir(d).map((f) => ({ ...f, stage: f.stage || 'review' })),
  ...['linguistic', 'fidelity'].flatMap((s) => readDir(join(d, s)).map((f) => ({ ...f, stage: s })))];

export function merge({ run: runData, check = [], ai = [], verify = [], decisions = [], after = null, commit = '' }) {
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
      category: f.category, severity: f.severity, confidence: Math.round(conf * 100) / 100, source: src, rule: String(f.rule || f.category),
      stage: src === 'check' ? 'check' : (f.stage || 'review'), objective: f.objective === true || (src === 'check' && f.severity !== 'preferential') };
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
  // Stage 3: the arbiter's decision per string. A change = an «apply» decision: original, old, new, reason, the evidence of
  // every stage — and, when the strings were extracted again after the edit (`after`), whether the site now says it.
  const afterById = after ? new Map(after.items.map((i) => [i.id, i])) : null;
  const norm2 = (t) => String(t || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const changes = []; const keepD = []; const optionalD = []; const badDecision = [];
  for (const d of decisions) {
    const it = byId.get(d.item_id);
    if (!it || !['apply', 'keep', 'optional'].includes(d.decision) || (d.decision === 'apply' && !d.final)) { badDecision.push(d.item_id); continue; }
    const evidence = findings.filter((f) => f.item_id === it.id).map((f) => ({ id: f.id, stage: f.stage, category: f.category, severity: f.severity,
      confidence: f.confidence, objective: f.objective, suggestion: f.suggestion, explanation: f.explanation }));
    const entry = { item_id: it.id, where: it.where, url: it.url, kind: it.kind, en: it.en, old: it.target, new: d.final || null,
      severity: SEVERITIES.includes(d.severity) ? d.severity : null, reason: d.reason || '', evidence };
    if (d.decision === 'apply') {
      const ph = (x) => (String(x).match(/\{\w+\}/g) || []).sort().join(' ');
      entry.checks = { placeholders_kept: ph(d.final) === ph(it.en) };
      if (afterById) { const a = afterById.get(it.id); entry.checks.landed = !!a && norm2(a.target) === norm2(d.final); entry.now = a ? a.target : null; }
      changes.push(entry);
    } else (d.decision === 'keep' ? keepD : optionalD).push(entry);
  }
  return {
    meta: { lang: runData.lang, generated: new Date().toISOString(), commit, strings: runData.items.length,
      strings_with_findings: new Set(findings.map((f) => f.item_id)).size, findings: findings.length,
      by_severity: count(findings, 'severity'), by_category: count(findings, 'category'), by_source: count(findings, 'source'),
      verified: findings.filter((f) => f.verify).length, rejected_by_second_opinion: rejected.length, dropped },
    findings, rejected,
    arbitration: decisions.length ? { strings_decided: decisions.length, apply: changes.length, keep: keepD.length, optional: optionalD.length,
      invalid: badDecision, landed: afterById ? changes.filter((c) => c.checks.landed).length : null } : null,
    changes, optional: optionalD, kept: keepD,
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
  if (report.arbitration) {
    const a = report.arbitration;
    lines.push('## Решения арбитра', '', `Строк с замечаниями: ${a.strings_decided} · исправить: **${a.apply}** · оставить как есть: ${a.keep} · стилистика (не применяется): ${a.optional}` +
      (a.landed != null ? ` · внесено и подтверждено повторной выгрузкой: **${a.landed}/${a.apply}**` : ''), '');
    for (const c of report.changes) {
      lines.push(`### ${c.item_id} · ${SEV_RU[c.severity] || '—'}`, '', `${c.where} — [на сайте](${c.url})`, '', '**EN**', '', quote(c.en), '', '**Было**', '', quote(c.old), '',
        '**Стало**', '', quote(c.new), '', `**Причина:** ${c.reason}`, '',
        `**Независимые проверки:** ${c.evidence.map((e) => `${e.stage} ${e.id} (${e.category}, ${SEV_RU[e.severity]}, ${e.confidence})`).join('; ')}` +
        ` · плейсхолдеры ${c.checks.placeholders_kept ? 'сохранены' : '**ИЗМЕНЕНЫ**'}` + (c.checks.landed != null ? ` · на сайте ${c.checks.landed ? 'именно этот текст' : '**ОТЛИЧАЕТСЯ**'}` : ''), '');
    }
    if (report.optional.length) { lines.push('### Стилистика — записано, не применяется', ''); for (const c of report.optional) lines.push(`- ${c.item_id}: ${c.reason}`); lines.push(''); }
    if (report.kept.length) { lines.push('### Оставлено как есть', ''); for (const c of report.kept) lines.push(`- ${c.item_id}: ${c.reason}`); lines.push(''); }
    lines.push('## Все замечания этапов', '');
  }
  const groups = [...new Set(report.findings.map((f) => f.group))];
  for (const g of groups) {
    lines.push(`## ${g}`, '');
    for (const f of report.findings.filter((x) => x.group === g)) {
      lines.push(`### ${f.id} · ${SEV_RU[f.severity]} · ${f.category} · уверенность ${f.confidence} · ${f.stage}${f.objective ? ' · объективное' : ''}`, '',
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
  const after = arg('--after');
  const report = merge({ run: readJson(join(run, 'items.json')), check: existsSync(join(run, 'check.json')) ? readJson(join(run, 'check.json')) : [],
    ai: readStages(join(run, 'ai')), verify: readDir(join(run, 'verify')),
    decisions: existsSync(join(run, 'arbiter', 'decisions.json')) ? readJson(join(run, 'arbiter', 'decisions.json')) : [],
    after: after ? readJson(after) : null, commit: arg('--commit') || '' });
  writeFileSync(join(run, 'report.json'), JSON.stringify(report, null, 1));
  writeFileSync(join(run, 'report.md'), markdown(report));
  console.error(`${report.meta.lang}: ${report.meta.findings} findings`, JSON.stringify(report.meta.by_severity), 'dropped', JSON.stringify(report.meta.dropped));
}
