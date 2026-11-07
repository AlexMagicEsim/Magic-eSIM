#!/usr/bin/env node
// The EN-root migration's FROZEN INVENTORY of old addresses (owner, 2026-11-07; the site stays on GitHub Pages).
//
// Every HTML page the OLD tree published — the GitHub Pages artifact of the commit before the move (its own
// scripts/build-pages-artifact.mjs, run on that commit's files) plus every <loc> of its sitemap.xml: indexed and
// noindex pages alike (the English countries, regions and guides, iphone.html, android.html, en/index.html …).
// seo/build-legacy-redirects.mjs writes a client-side redirect page for every path whose newPath() is not null.
//
// Written ONCE: `--freeze` refuses to overwrite the committed file. The old tree never changes again, so neither
// does this list; nothing else writes it.
//
//   node scripts/url-migration-legacy-paths.mjs --freeze --from <git rev>
import { writeFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';
export const LEGACY_FILE = 'seo/url-migration-legacy-paths.json';

/** A published file as the URL path GitHub Pages serves it at: 'index.html' -> '/', 'esim/x/index.html' -> '/esim/x/'. */
export const pathOfFile = (rel) => `/${rel.replace(/(^|\/)index\.html$/, '$1')}`;

/** The old tree's HTML addresses: [path], sorted, unique. `plan` = its planArtifact(), `sitemapXml` = its sitemap. */
export function legacyPaths(plan, sitemapXml) {
  const fromFiles = plan.publish.filter((f) => f.endsWith('.html')).map(pathOfFile);
  const fromSitemap = [...String(sitemapXml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].slice(SITE.length));
  return [...new Set([...fromFiles, ...fromSitemap])].sort();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const i = process.argv.indexOf('--from');
  if (!process.argv.includes('--freeze') || i < 0 || !process.argv[i + 1]) {
    console.error('usage: node scripts/url-migration-legacy-paths.mjs --freeze --from <git rev>');
    process.exit(1);
  }
  if (existsSync(join(ROOT, LEGACY_FILE))) {
    console.error(`${LEGACY_FILE} exists — the inventory is frozen; it is never rewritten`);
    process.exit(1);
  }
  const rev = execFileSync('git', ['-C', ROOT, 'rev-parse', process.argv[i + 1]], { encoding: 'utf8' }).trim();
  const tmp = mkdtempSync(join(tmpdir(), 'legacy-tree-'));
  try {
    execFileSync('sh', ['-c', `git -C "${ROOT}" archive ${rev} | tar -x -C "${tmp}"`]);
    const { planArtifact } = await import(pathToFileURL(join(tmp, 'scripts/build-pages-artifact.mjs')).href);
    const plan = planArtifact(tmp);
    if (plan.conflicts.length) throw new Error(`the old tree's plan has conflicts: ${plan.conflicts.slice(0, 3).join('; ')}`);
    const paths = legacyPaths(plan, readFileSync(join(tmp, 'sitemap.xml'), 'utf8'));
    writeFileSync(join(ROOT, LEGACY_FILE), `${JSON.stringify({
      note: 'EN-root migration (owner, 2026-11-07): every HTML address the site published before the move — the GitHub Pages artifact and the sitemap of the source commit. Frozen: written once by scripts/url-migration-legacy-paths.mjs --freeze. seo/build-legacy-redirects.mjs writes a client-side redirect page for each one that moved.',
      source_commit: rev,
      paths,
    }, null, 2)}\n`);
    console.log(`${LEGACY_FILE}: ${paths.length} paths from ${rev.slice(0, 9)}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
