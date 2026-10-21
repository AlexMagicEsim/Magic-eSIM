#!/usr/bin/env node
// Prepare the reviewers' tasks of one run.
//
//   batch.mjs --run <dir> --stage linguistic|fidelity [--max 110]   stage 1 / stage 2: pack the strings into batches,
//                                                                    write <run>/batches/<stage>/*.json + prompts/<stage>/*.md
//   batch.mjs --run <dir> --arbiter                                  stage 3: every string with a finding (both stages and
//                                                                    the checks), grouped → <run>/arbiter-input.json + prompts/arbiter.md
//
// Batches keep the site's groups together (a guide, the interface, the page words) and pack them up to --max strings; the
// country names always go alone. Paths in the prompts are absolute, so a run can review another checkout of the site.
// Read-only apart from the run directory.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(HERE, '..');
const NAMES = { es: 'Spanish (neutral international)', de: 'German', fr: 'French', 'zh-Hans': 'Simplified Chinese', ko: 'Korean' };
const STAGES = { linguistic: 'review-linguistic.md', fidelity: 'review-fidelity.md' };

/** Pack the site's groups into batches of at most `max` strings; a group bigger than `max` is split; countries alone. */
export function plan(items, max = 45) {
  const groups = new Map();
  for (const it of items) { const g = it.group === '404' ? 'page' : it.group; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); }
  const batches = []; let cur = null;
  const flush = () => { if (cur && cur.items.length) batches.push(cur); cur = null; };
  for (const [g, its] of groups) {
    if (g === 'countries') { flush(); batches.push({ group: g, items: its }); continue; }
    for (let i = 0; i < its.length; i += max) {
      const part = its.slice(i, i + max);
      if (cur && cur.items.length + part.length > max) flush();
      if (!cur) cur = { group: g, items: [] }; else if (!cur.group.split('+').includes(g)) cur.group += `+${g}`;
      cur.items.push(...part);
    }
  }
  flush();
  return batches.map((b, i) => ({ ...b, name: `${String(i + 1).padStart(2, '0')}-${b.group.split('+')[0]}${b.group.includes('+') ? '-etc' : ''}` }));
}

const fill = (tpl, map) => Object.entries(map).reduce((s, [k, v]) => s.split(`{{${k}}}`).join(v), tpl);
const readAll = (d) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.json')).sort().flatMap((f) => {
  const v = JSON.parse(readFileSync(join(d, f), 'utf8')); return Array.isArray(v) ? v : [];
}) : []);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const run = resolve(arg('--run'));
  const { lang, items } = JSON.parse(readFileSync(join(run, 'items.json'), 'utf8'));
  const base = { LANGUAGE_NAME: NAMES[lang] || lang, LANG: lang, SKILL };

  if (process.argv.includes('--arbiter')) {
    const byId = new Map(items.map((i) => [i.id, i]));
    const findings = [
      ...(existsSync(join(run, 'check.json')) ? JSON.parse(readFileSync(join(run, 'check.json'), 'utf8')).map((f) => ({ ...f, stage: 'check' })) : []),
      ...['linguistic', 'fidelity'].flatMap((s) => readAll(join(run, 'ai', s)).map((f, k) => ({ ...f, stage: s, id: `${s[0].toUpperCase()}${String(k + 1).padStart(4, '0')}` }))),
    ].filter((f) => byId.has(f.item_id));
    const grouped = [...new Set(findings.map((f) => f.item_id))].map((id) => {
      const it = byId.get(id);
      return { item_id: id, kind: it.kind, where: it.where, en: it.en, target: it.target,
        findings: findings.filter((f) => f.item_id === id).map(({ id: fid, stage, category, severity, confidence, objective, suggestion, explanation }) => ({ id: fid, stage, category, severity, confidence, objective, suggestion, explanation })) };
    });
    mkdirSync(join(run, 'prompts'), { recursive: true }); mkdirSync(join(run, 'arbiter'), { recursive: true });
    writeFileSync(join(run, 'arbiter-input.json'), JSON.stringify(grouped, null, 1));
    writeFileSync(join(run, 'prompts', 'arbiter.md'), fill(readFileSync(join(SKILL, 'references/arbiter-prompt.md'), 'utf8'),
      { ...base, IN: join(run, 'arbiter-input.json'), OUT: join(run, 'arbiter', 'decisions.json') }));
    console.error(`${lang}: ${grouped.length} strings with ${findings.length} findings → prompts/arbiter.md`);
    process.exit(0);
  }

  const stage = arg('--stage');
  if (!STAGES[stage]) { console.error('usage: batch.mjs --run <dir> --stage linguistic|fidelity [--max n] | --arbiter'); process.exit(2); }
  const tpl = readFileSync(join(SKILL, 'references', STAGES[stage]), 'utf8');
  for (const d of [join(run, 'batches', stage), join(run, 'prompts', stage), join(run, 'ai', stage)]) mkdirSync(d, { recursive: true });
  const out = [];
  for (const b of plan(items, Number(arg('--max')) || 45)) {
    const file = join(run, 'batches', stage, `${b.name}.json`);
    writeFileSync(file, JSON.stringify(b.items.map(({ id, kind, where, en, target, note }) => ({ id, kind, where, en, target, ...(note ? { note } : {}) })), null, 1));
    writeFileSync(join(run, 'prompts', stage, `${b.name}.md`), fill(tpl, { ...base, BATCH: file, COUNT: String(b.items.length), GROUP: b.group,
      OUT: join(run, 'ai', stage, `${b.name}.json`) }));
    out.push(`${b.name} (${b.items.length})`);
  }
  console.error(`${lang} ${stage}: ${out.length} batches — ${out.join(', ')}`);
}
