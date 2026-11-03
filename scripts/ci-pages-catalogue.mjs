#!/usr/bin/env node
// CI ONLY — test the committed pages against the catalogue they were built from.
//
// WHY (2026-11-03). «Refresh static catalog cache» commits assets/catalog.json
// and seo/global-plan-facts.json straight to main after every provider sync;
// the pages built from them reach main only through the SEO refresh PR, which a
// person merges. Since the auto-import went live (2026-11-02) the catalogue moves
// every slot, so main is almost never a pair: on 60dfd0e the pages were built
// from the snapshot of 2026-10-31 05:55, the catalogue was four refreshes newer,
// and `npm test` failed 64 tests on every PR — each one «the page does not match
// the catalogue», none about the PR. With the pages' own catalogue put back the
// same tree passed 1846 of 1846.
//
// WHAT. The pages record their catalogue: seo/catalogue-countries.json and
// seo/fact-sheets.json carry `fetched_at` = that snapshot's `generated_at`.
// If assets/catalog.json is that snapshot, nothing happens. Otherwise this finds
// the commit that wrote it and restores assets/catalog.json and
// seo/global-plan-facts.json from it — in the CI checkout only, never committed —
// and says so in the job summary: how many catalogue refreshes the pages are
// behind, and that TODAY's catalogue is checked by the SEO refresh
// (.github/workflows/seo-refresh-pr.yml), which rebuilds the pages from it and
// runs the same gates before anything can reach main.
//
// IT REFUSES (exit 1) rather than guess: pages without one provenance, a
// snapshot not in the history, or ANY commit after it that touched either file
// and is not the catalogue bot's own refresh commit touching only those two.
//
//   node scripts/ci-pages-catalogue.mjs            (CI: restore, report)
//   node scripts/ci-pages-catalogue.mjs --dry-run  (report only)

import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const FILES = Object.freeze(['assets/catalog.json', 'seo/global-plan-facts.json']);
export const PROVENANCE_FILES = Object.freeze(['seo/catalogue-countries.json', 'seo/fact-sheets.json']);
const BOT = 'github-actions[bot]|41898282+github-actions[bot]@users.noreply.github.com';
const BOT_SUBJECT = /^chore: refresh static catalog cache \(\d+ packages\)$/;

const git = (root, args, opts = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
const generatedAt = (text) => (/"generated_at":\s*"([^"]+)"/.exec(String(text).slice(0, 4096)) || [])[1] || null;

/** The pages' catalogue, by the one `fetched_at` their generated files share. */
export function pagesProvenance(root) {
  const seen = PROVENANCE_FILES.map((f) => ({ f, at: JSON.parse(readFileSync(join(root, f), 'utf8')).fetched_at || null }));
  const at = [...new Set(seen.map((x) => x.at))];
  if (at.length !== 1 || !at[0]) throw new Error(`the generated files disagree on their catalogue: ${seen.map((x) => `${x.f} → ${x.at}`).join(', ')}`);
  return at[0];
}

/**
 * Where the working tree's catalogue stands against the pages'.
 * @returns {{ consistent: true, at } | { consistent: false, at, current, commit, behind: [{ sha, subject }] }}
 */
export function locate(root) {
  const at = pagesProvenance(root);
  const current = generatedAt(readFileSync(join(root, FILES[0]), 'utf8'));
  if (current === at) return { consistent: true, at };
  const log = git(root, ['log', '--format=%H', '--', FILES[0]]).split('\n').filter(Boolean);
  const commit = log.find((sha) => generatedAt(git(root, ['show', `${sha}:${FILES[0]}`])) === at);
  if (!commit) throw new Error(`no commit in this history wrote the pages' catalogue (generated_at ${at}) — is the checkout shallow (fetch-depth: 0)?`);
  const behind = [];
  for (const line of git(root, ['log', '--format=%H%x09%an|%ae%x09%s', `${commit}..HEAD`, '--', ...FILES]).split('\n').filter(Boolean)) {
    const [sha, who, subject] = line.split('\t');
    const touched = git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', '-m', sha]).split('\n').filter(Boolean);
    const foreign = touched.filter((f) => !FILES.includes(f));
    if (who !== BOT || !BOT_SUBJECT.test(subject) || foreign.length) {
      throw new Error(`${sha.slice(0, 9)} «${subject}» (${who}) changed the catalogue and is not the catalogue bot's refresh${foreign.length ? ` — it also touched ${foreign.join(', ')}` : ''}; rebuild the pages (node seo/build-all.mjs) in that change instead`);
    }
    behind.push({ sha, subject });
  }
  return { consistent: false, at, current, commit, behind };
}

export function restore(root, commit) {
  for (const f of FILES) writeFileSync(join(root, f), git(root, ['show', `${commit}:${f}`]));
}

const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);

export function report(r, { restored = true } = {}) {
  if (r.consistent) return `Страницы и каталог согласованы: assets/catalog.json — тот снимок (${r.at}), из которого собраны страницы.`;
  const n = r.behind.length;
  return [
    `Страницы собраны из каталога ${r.at} (коммит ${r.commit.slice(0, 9)}); assets/catalog.json новее на ${n} ${plural(n, 'обновление', 'обновления', 'обновлений')} бота (${r.current}).`,
    restored
      ? 'Тесты этого прогона проверяют закоммиченные страницы на ИХ каталоге: assets/catalog.json и seo/global-plan-facts.json восстановлены из этого коммита только в рабочей копии CI.'
      : '(--dry-run: файлы не тронуты.)',
    'Соответствие текстов СЕГОДНЯШНЕМУ каталогу проверяет «SEO refresh PR» (.github/workflows/seo-refresh-pr.yml): он пересобирает страницы из него и прогоняет те же проверки до того, как что-либо попадёт в main.',
    ...r.behind.map((b) => `  - ${b.sha.slice(0, 9)} ${b.subject}`),
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const r = locate(root);
    const dry = process.argv.includes('--dry-run');
    if (!r.consistent && !dry) restore(root, r.commit);
    const text = report(r, { restored: !dry });
    console.log(text);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Каталог страниц\n\n${text}\n`);
    if (!r.consistent && process.env.GITHUB_ACTIONS) console.log(`::notice title=Каталог страниц::страницы отстают от assets/catalog.json на ${r.behind.length} обновлений бота; тесты идут на каталоге страниц ${r.commit.slice(0, 9)}`);
  } catch (error) {
    console.error(`ОСТАНОВ: ${error.message}`);
    process.exit(1);
  }
}
