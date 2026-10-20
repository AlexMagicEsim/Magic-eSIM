#!/usr/bin/env node
// Runs every test/mini-app/*.e2e.js — the Mini App's WebKit + Chromium scripts — and fails if any of them does.
//
// Until 2026-10-20 nothing ran these in CI: «promo starts collapsed» had been red since 1080c09f (2026-09-03, the
// opener became «Ввести промокод») and «the real header asset» since storefront #106 (the logo became an SVG), and
// nobody saw either. The list is the DIRECTORY, not a hand-written list, so a new script cannot be left out.
//
// Each script starts its own static server on a free port and its own browsers, and is independent of the others;
// they run CONCURRENCY at a time (run one after another they take ~16 min). Each script's output is printed whole,
// in file order, after it ends, so the log reads like a serial run.
//
//   node test/mini-app/run-all.mjs            (CONCURRENCY=1 to run them one by one)
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
export const scripts = () => readdirSync(DIR).filter((f) => f.endsWith('.e2e.js')).sort();

function run(file) {
  return new Promise((resolve) => {
    const started = Date.now(); let out = '';
    const child = spawn(process.execPath, [join(DIR, file)], { env: process.env });
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code, signal) => resolve({ file, code: code ?? 1, signal, out, seconds: Math.round((Date.now() - started) / 1000) }));
  });
}

async function main() {
  const files = scripts();
  const concurrency = Math.max(1, Number(process.env.CONCURRENCY) || 3);
  const results = new Array(files.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, async () => {
    while (next < files.length) { const i = next++; results[i] = await run(files[i]); }
  }));
  for (const r of results) {
    console.log(`\n════ ${r.file} — ${r.code === 0 ? 'ok' : `FAILED (exit ${r.code}${r.signal ? ', ' + r.signal : ''})`} in ${r.seconds}s ════`);
    process.stdout.write(r.out);
  }
  const failed = results.filter((r) => r.code !== 0);
  console.log(`\n${files.length - failed.length}/${files.length} Mini App scripts passed${failed.length ? ' — FAILED: ' + failed.map((r) => r.file).join(', ') : ''}`);
  process.exit(failed.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
