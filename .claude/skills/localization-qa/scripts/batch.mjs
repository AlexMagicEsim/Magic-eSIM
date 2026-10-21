#!/usr/bin/env node
// Split one run's strings into review batches and write each reviewer's task (references/review-prompt.md, filled in).
//
//   node .claude/skills/localization-qa/scripts/batch.mjs --run <run dir>     (the run dir holds items.json)
//
// Batches follow the site's own groups (one guide, the 404 + page words, the daily card…), so a reviewer sees strings that
// belong together; the interface is cut into slices of at most 45 and the country names stay one batch. Read-only apart
// from <run>/batches/ and <run>/prompts/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(HERE, '..');
const ROOT = resolve(SKILL, '../../..');
const NAMES = { es: 'Spanish (neutral international)', de: 'German', fr: 'French', 'zh-Hans': 'Simplified Chinese', ko: 'Korean' };
const MAX = 45;

export function plan(items) {
  const groups = new Map();
  for (const it of items) { const g = it.group === '404' ? 'page' : it.group; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); }
  const batches = [];
  for (const [g, its] of groups) {
    const size = g === 'countries' ? its.length : MAX;
    for (let i = 0; i < its.length; i += size) batches.push({ group: g, items: its.slice(i, i + size) });
  }
  return batches.map((b, i) => ({ ...b, name: `${String(i + 1).padStart(2, '0')}-${b.group}` }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const run = resolve(arg('--run'));
  const { lang, items } = JSON.parse(readFileSync(join(run, 'items.json'), 'utf8'));
  if (process.argv.includes('--verify')) {
    // After a first merge: the critical and major AI findings go to an independent second reviewer.
    const report = JSON.parse(readFileSync(join(run, 'report.json'), 'utf8'));
    // …and the deterministic findings a script cannot word a fix for (an SEO title over budget): the second reviewer writes one.
    const pick = report.findings.filter((f) => (f.source === 'ai' && (f.severity === 'critical' || f.severity === 'major')) || (f.source === 'check' && !f.suggestion))
      .map(({ id, where, en, target, suggestion, explanation, category, severity, confidence, source }) => ({ id, where, en, target, suggestion, explanation, category, severity, confidence, needs_suggestion: source === 'check' && !suggestion }));
    mkdirSync(join(run, 'verify'), { recursive: true }); mkdirSync(join(run, 'prompts'), { recursive: true });
    writeFileSync(join(run, 'verify-input.json'), JSON.stringify(pick, null, 1));
    const v = readFileSync(join(SKILL, 'references/verify-prompt.md'), 'utf8');
    const rel = (p) => relative(ROOT, p);
    writeFileSync(join(run, 'prompts', 'verify.md'), v.replace(/\{\{LANGUAGE_NAME\}\}/g, NAMES[lang] || lang).replace(/\{\{LANG\}\}/g, lang)
      .replace(/\{\{SKILL\}\}/g, rel(SKILL)).replace(/\{\{IN\}\}/g, rel(join(run, 'verify-input.json'))).replace(/\{\{OUT\}\}/g, rel(join(run, 'verify', 'verdicts.json'))));
    console.error(`${lang}: ${pick.length} findings for a second opinion (${pick.filter((p) => p.needs_suggestion).length} need a suggestion) → prompts/verify.md`);
    process.exit(0);
  }
  const tpl = readFileSync(join(SKILL, 'references/review-prompt.md'), 'utf8');
  mkdirSync(join(run, 'batches'), { recursive: true }); mkdirSync(join(run, 'prompts'), { recursive: true }); mkdirSync(join(run, 'ai'), { recursive: true });
  const rel = (p) => relative(ROOT, p);
  const out = [];
  for (const b of plan(items)) {
    const file = join(run, 'batches', `${b.name}.json`);
    writeFileSync(file, JSON.stringify(b.items.map(({ id, kind, where, en, target, note }) => ({ id, kind, where, en, target, ...(note ? { note } : {}) })), null, 1));
    const prompt = tpl.replace(/\{\{LANGUAGE_NAME\}\}/g, NAMES[lang] || lang).replace(/\{\{LANG\}\}/g, lang).replace(/\{\{SKILL\}\}/g, rel(SKILL))
      .replace(/\{\{BATCH\}\}/g, rel(file)).replace(/\{\{COUNT\}\}/g, String(b.items.length)).replace(/\{\{GROUP\}\}/g, b.group)
      .replace(/\{\{OUT\}\}/g, rel(join(run, 'ai', `${b.name}.json`)));
    writeFileSync(join(run, 'prompts', `${b.name}.md`), prompt);
    out.push(`${b.name} (${b.items.length})`);
  }
  console.error(`${lang}: ${out.length} batches — ${out.join(', ')}`);
}
