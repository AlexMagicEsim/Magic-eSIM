#!/usr/bin/env node
// The EN-root migration's ONE-TIME switch list (2026-11-07) — written once, from the sitemap as it was before the move,
// and committed as seo/url-migration-switch.json. It is a record, not a build step: nothing reads it to build a page.
//
//   pairs           every URL of the OLD sitemap and where it is now: the new URL (seo/url-migration.mjs newPath; the
//                   old Russian home «/» is now /ru/, «/» itself is the English home) — or itself when it stays.
//                   seo/test-url-migration.mjs holds every target to the CURRENT sitemap: one to one, nothing lost.
//   indexnow_once   what the owner may submit to IndexNow by hand on the day of the switch (Yandex): every new Russian
//                   URL of the sitemap, the old Russian addresses (so the crawler meets their redirect pages), and «/» (a new page
//                   at a known address). The automation (seo/indexnow.mjs) never sends «/» or an old path — this list
//                   exists because the switch is the one day they matter. NOTHING here is sent by this script.
//
//   node scripts/url-migration-switch.mjs --from <git rev>   (the commit whose sitemap.xml is the old one)
import { writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newPath } from '../seo/url-migration.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';
export const SWITCH_FILE = 'seo/url-migration-switch.json';
const locs = (xml) => [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);

/** Where an OLD URL lives now. The old «/» was the Russian home; every other path follows the map. */
export function nowAt(oldUrl) {
  const path = oldUrl.slice(SITE.length);
  if (path === '/') return `${SITE}/ru/`;
  const n = newPath(path);
  return n === null ? oldUrl : SITE + n;
}

export function switchList(oldSitemapXml, newSitemapXml) {
  const old = locs(oldSitemapXml);
  const pairs = old.map((u) => [u, nowAt(u)]);
  const now = locs(newSitemapXml);
  const ru = now.filter((u) => u.startsWith(`${SITE}/ru/`));
  const oldRu = old.filter((u) => nowAt(u).startsWith(`${SITE}/ru/`));
  const indexnow = [...new Set([...ru, ...oldRu, `${SITE}/`])].sort();
  return { pairs, indexnow_once: indexnow };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const i = process.argv.indexOf('--from');
  if (i < 0 || !process.argv[i + 1]) { console.error('usage: node scripts/url-migration-switch.mjs --from <git rev>'); process.exit(1); }
  const rev = process.argv[i + 1];
  const oldXml = execFileSync('git', ['-C', ROOT, 'show', `${rev}:sitemap.xml`], { encoding: 'utf8' });
  const list = switchList(oldXml, readFileSync(join(ROOT, 'sitemap.xml'), 'utf8'));
  writeFileSync(join(ROOT, SWITCH_FILE), `${JSON.stringify({
    note: 'EN-root migration (owner, 2026-11-07): every URL of the sitemap before the move and where it is after it; and the one-time IndexNow list for the day of the switch — never sent by any automation (scripts/url-migration-switch.mjs).',
    old_sitemap_commit: execFileSync('git', ['-C', ROOT, 'rev-parse', rev], { encoding: 'utf8' }).trim(),
    ...list,
  }, null, 2)}\n`);
  console.log(`${SWITCH_FILE}: ${list.pairs.length} pairs, ${list.pairs.filter(([a, b]) => a !== b).length} moved; IndexNow once: ${list.indexnow_once.length}`);
}
