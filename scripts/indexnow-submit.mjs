#!/usr/bin/env node
/*
 * Sends the RU pages that changed between two DEPLOYED commits to IndexNow (Yandex). Rules: seo/indexnow.mjs.
 *
 *   node scripts/indexnow-submit.mjs --base <sha> --head <sha> [--dry-run] [--offline]
 *
 *   --base / --head  full 40-hex commits, both present in this clone (the workflow fetches the base)
 *   --dry-run        everything except the POST (the live checks still run unless --offline)
 *   --offline        no network at all: no live checks, no POST (implies --dry-run) — for local runs and tests
 *
 * Exit 0: sent, key pending, nothing to send, or gave up on 429/5xx/network (a warning — the next deployment sends its
 * own changes). Exit 1: our error — bad arguments, no/invalid key file, rejected 400/403/422, over MAX_URLS.
 * The key is never printed.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGIN, MAX_URLS, readKey, selectUrls, liveCheck, submit } from '../seo/indexnow.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHA = /^[0-9a-f]{40}$/;

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const flag = (name) => process.argv.includes(name);

function fail(msg) {
  console.log(`::error::${msg}`);
  process.exit(1);
}

function show(sha, rel) {
  try {
    return execFileSync('git', ['show', `${sha}:${rel}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function summary(lines) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}

const base = arg('--base');
const head = arg('--head');
const offline = flag('--offline');
const dryRun = offline || flag('--dry-run');
if (!SHA.test(base || '') || !SHA.test(head || '')) fail('--base and --head must be full 40-hex commit ids');

let key;
let keyFile;
try { ({ key, file: keyFile } = readKey(ROOT)); } catch (e) { fail(e.message); }

const baseLastmod = show(base, 'seo/sitemap-lastmod.json');
const headLastmod = show(head, 'seo/sitemap-lastmod.json');
if (baseLastmod == null || headLastmod == null) {
  console.log(`::warning::IndexNow: seo/sitemap-lastmod.json is missing at ${baseLastmod == null ? 'the base' : 'the head'} commit — nothing sent`);
  process.exit(0);
}

let picked;
try {
  picked = selectUrls({
    baseState: JSON.parse(baseLastmod),
    headState: JSON.parse(headLastmod),
    sitemapXml: show(head, 'sitemap.xml') || '',
    robotsTxt: show(head, 'robots.txt') || '',
    read: (rel) => show(head, rel),
  });
} catch (e) {
  fail(e.message);
}

console.log(`IndexNow: ${base.slice(0, 9)}..${head.slice(0, 9)} — ${picked.send.length} candidate URL(s), ${picked.skipped.length} skipped`);
for (const s of picked.skipped) console.log(`  skip ${s.url} — ${s.why}`);

if (picked.send.length > MAX_URLS) fail(`IndexNow: ${picked.send.length} changed RU URLs is more than MAX_URLS (${MAX_URLS}) — nothing sent; check the base commit`);

let send = picked.send;
if (!offline && send.length) {
  // The deployed site must serve the key and each page as the commit says — else Yandex would answer 403 / index a stale page.
  let liveKey = null;
  try {
    const r = await fetch(`${ORIGIN}/${keyFile}`, { redirect: 'manual' });
    liveKey = r.status === 200 ? await r.text() : null;
  } catch { liveKey = null; }
  if (liveKey !== key) {
    console.log('::warning::IndexNow: the key file is not served by the live site (yet) — nothing sent');
    summary(['### IndexNow', 'key file not live — nothing sent']);
    process.exit(0);
  }
  const ok = [];
  for (const u of send) {
    const why = await liveCheck(u);
    if (why) console.log(`  skip ${u} — live: ${why}`); else ok.push(u);
  }
  send = ok;
}

if (send.length === 0) {
  console.log('IndexNow: nothing to send');
  summary(['### IndexNow', `${base.slice(0, 9)}..${head.slice(0, 9)}: no changed RU page`]);
  process.exit(0);
}

for (const u of send) console.log(`  send ${u}`);
if (dryRun) {
  console.log(`IndexNow: dry run — ${send.length} URL(s) would be sent`);
  summary(['### IndexNow (dry run)', ...send.map((u) => `- ${u}`)]);
  process.exit(0);
}

const r = await submit(key, send);
summary(['### IndexNow', `HTTP ${r.status ?? 'network error'} — ${r.outcome}, ${send.length} URL(s), ${r.attempts} attempt(s)`, ...send.map((u) => `- ${u}`)]);
if (r.outcome === 'rejected') process.exit(1);
if (r.outcome === 'gave_up') console.log('::warning::IndexNow: Yandex did not accept the submission after retries — not retried further');
process.exit(0);
