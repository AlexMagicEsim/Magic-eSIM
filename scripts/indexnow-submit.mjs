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
 * The URLs go in batches of at most BATCH_SIZE, one after another; each batch's result is logged, written to the run
 * summary and to one `INDEXNOW_RESULT {…}` line (URLs, HTTP status, outcome — never the key).
 *
 * Exit 0: every batch sent or key pending, nothing to send, or a batch gave up on 429/5xx/network (a warning — nothing
 * is re-sent later; the next deployment sends its own changes). Exit 1: our error — bad arguments, no/invalid key
 * file, a batch rejected 400/403/422 (after the other batches were still sent), over MAX_URLS.
 * The key is never printed.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGIN, MAX_URLS, BATCH_SIZE, readKey, selectUrls, liveCheck, batches, submitBatches } from '../seo/indexnow.mjs';
import { contentHash } from '../seo/build-sitemap.mjs';

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
    readBase: (rel) => show(base, rel),
    // A hash-rule migration (--rehash-keep-dates) moves hashes, not pages: same date + same content under the deployed rule.
    sameContent: (before, after) => contentHash(before) === contentHash(after),
  });
} catch (e) {
  fail(e.message);
}

const byReason = (r) => picked.send.filter((u) => picked.reason[u] === r).length;
console.log(`IndexNow: ${base.slice(0, 9)}..${head.slice(0, 9)} — ${picked.send.length} candidate URL(s) (content ${byReason('content')}, links ${byReason('links')}, both ${byReason('content+links')}), ${picked.skipped.length} skipped`);
for (const s of picked.skipped) console.log(`  skip ${s.url} — ${s.why}`);
if (picked.rehashed.length) console.log(`IndexNow: ${picked.rehashed.length} page(s) not sent — hash rule changed, date and content did not (--rehash-keep-dates)`);

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

for (const u of send) console.log(`  send ${u} (${picked.reason[u]})`);
if (dryRun) {
  const n = batches(send).length;
  console.log(`IndexNow: dry run — ${send.length} URL(s) would be sent in ${n} batch(es) of at most ${BATCH_SIZE}`);
  summary(['### IndexNow (dry run)', `${send.length} URL(s) in ${n} batch(es) of at most ${BATCH_SIZE}`, ...send.map((u) => `- ${u}`)]);
  process.exit(0);
}

const r = await submitBatches(key, send);
const lines = ['### IndexNow', `${base.slice(0, 9)}..${head.slice(0, 9)}: ${send.length} URL(s) in ${r.batches.length} batch(es) — received ${r.sent}, failed ${r.failed}, not sent ${r.notSent}`, '', '| batch | URLs | HTTP | outcome | attempts |', '|---|---|---|---|---|'];
for (const b of r.batches) lines.push(`| ${b.n} | ${b.urls.length} | ${b.status ?? '—'} | ${b.outcome} | ${b.attempts} |`);
for (const b of r.batches) {
  if (b.outcome === 'accepted' || b.outcome === 'pending_key') continue;
  lines.push('', `Batch ${b.n} (${b.outcome}) — not received by Yandex:`, ...b.urls.map((u) => `- ${u}`));
}
summary(lines);
console.log(`INDEXNOW_RESULT ${JSON.stringify({ base, head, total: send.length, sent: r.sent, failed: r.failed, not_sent: r.notSent, batches: r.batches.map((b) => ({ n: b.n, size: b.urls.length, status: b.status, outcome: b.outcome, attempts: b.attempts, urls: b.urls })) })}`);
if (r.batches.some((b) => b.outcome === 'gave_up' || b.outcome === 'not_sent')) {
  console.log('::warning::IndexNow: some batches were not received by Yandex (listed in the run summary) — not retried further');
}
process.exit(r.batches.some((b) => b.outcome === 'rejected') ? 1 : 0);
