#!/usr/bin/env node
// Reads the two states and writes the summary the pull request body is made of.
//
//   node scripts/seo-refresh-summary.mjs --before <dir> --out <dir>
//
// `--before` holds copies of the artefacts as they were committed on main,
// taken before `seo/build-all.mjs` ran. The working tree is the «after». Writes
// summary.json (machine) and summary.md (the PR body), and prints the risk level
// on stdout so the workflow can put it in the job summary without re-parsing.
//
// FINDING THE PREVIOUS CATALOGUE IS NOT «THE PARENT COMMIT». Up to six catalogue
// refreshes a day land on main and none of them rebuilds anything, so several
// can sit between two rebuilds; the parent of the latest one would describe the
// wrong pair and quietly under-report what was withdrawn. The committed snapshot
// carries the provenance to do it properly — seo/catalogue-countries.json's
// `fetched_at` IS the `generated_at` of the catalogue it was built from — so the
// history of assets/catalog.json is walked until that exact stamp is found.
// If it is not found the field stays null and the summary says «не определено».

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, riskOf, renderMarkdown } from '../seo/refresh-summary.mjs';
import { parsePorcelain } from '../seo/refresh-allowlist.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i === -1 || i === process.argv.length - 1 ? fallback : process.argv[i + 1];
};

const BEFORE = arg('--before');
const OUT = arg('--out', join(ROOT, '.seo-refresh'));
if (!BEFORE) {
  console.error('нужен --before <каталог со снимком артефактов до пересборки>');
  process.exit(2);
}

const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const locs = (p) => (existsSync(p)
  ? [...readFileSync(p, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  : null);

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  } catch {
    return null;
  }
};

/** The packages of the snapshot the committed artefacts were built from. */
function previousCatalogue(stamp) {
  if (!stamp) return { packages: null, at: null };
  const log = git('log', '--format=%H', '-40', '--', 'assets/catalog.json');
  for (const sha of String(log || '').split('\n').filter(Boolean)) {
    const blob = git('show', `${sha}:assets/catalog.json`);
    if (!blob) continue;
    let parsed;
    try { parsed = JSON.parse(blob); } catch { continue; }
    if (parsed.generated_at === stamp) {
      return { packages: Array.isArray(parsed.packages) ? parsed.packages : null, at: stamp };
    }
  }
  return { packages: null, at: null };
}

const cacheBefore = readJson(join(BEFORE, 'catalogue-countries.json'));
const cacheAfter = readJson(join(ROOT, 'seo/catalogue-countries.json'));
if (!cacheAfter) {
  console.error('seo/catalogue-countries.json отсутствует после сборки — нечего описывать');
  process.exit(2);
}

const catalogueAfter = readJson(join(ROOT, 'assets/catalog.json'));
const prev = previousCatalogue(cacheBefore?.fetched_at || null);

const summary = classify({
  cacheBefore,
  cacheAfter,
  sheetsBefore: readJson(join(BEFORE, 'fact-sheets.json')),
  sheetsAfter: readJson(join(ROOT, 'seo/fact-sheets.json')),
  catalogueBefore: prev.packages,
  catalogueAfter: Array.isArray(catalogueAfter?.packages) ? catalogueAfter.packages : null,
  urlsBefore: locs(join(BEFORE, 'sitemap.xml')),
  urlsAfter: locs(join(ROOT, 'sitemap.xml')),
  lastmodBefore: readJson(join(BEFORE, 'sitemap-lastmod.json')),
  lastmodAfter: readJson(join(ROOT, 'seo/sitemap-lastmod.json')),
});

const risk = riskOf(summary);

// The file list goes in the body because the two can legitimately disagree: a
// rebuild may move `fetched_at` and a bookkeeping field like `networks_rows`,
// which no gate reads, while nothing a reader sees has changed. A body that says
// «ни одна страна не изменилась» next to a two-file diff reads as broken unless
// it also says which files moved and that it knows.
const changedFile = arg('--changed');
const changed = changedFile && existsSync(changedFile)
  ? parsePorcelain(readFileSync(changedFile, 'utf8'))
  : null;
const meta = {
  catalogue_commit: (git('log', '-1', '--format=%H', '--', 'assets/catalog.json') || '').trim() || null,
  catalogue_generated_at: catalogueAfter?.generated_at || null,
  previous_snapshot_at: prev.at,
  base_commit: (git('rev-parse', 'HEAD') || '').trim() || null,
  validation: (arg('--validation', '') || '').split('|').filter(Boolean),
  changed_files: changed,
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'summary.json'), `${JSON.stringify({ risk, meta, summary }, null, 2)}\n`);
writeFileSync(join(OUT, 'summary.md'), `${renderMarkdown(summary, meta)}\n`);

console.log(risk.level);
console.error([
  `стран затронуто: ${summary.totals.countries_affected}`,
  `тарифов снято: ${summary.totals.plans_removed ?? 'не определено'}`,
  `тарифов добавлено: ${summary.totals.plans_added ?? 'не определено'}`,
  `полов сдвинулось: ${summary.totals.floors_changed}`,
  `утверждений изменилось: ${summary.totals.claims_changed}`,
  `адресов +${summary.totals.urls_added} / −${summary.totals.urls_removed}`,
  `риск: ${risk.level}`,
].join('\n'));
