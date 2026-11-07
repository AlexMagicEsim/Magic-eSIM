#!/usr/bin/env node
// READ-ONLY check of the EN-root migration on a running site: every old address that moved (the frozen inventory,
// seo/url-migration-legacy-paths.json) answers 200 with its CLIENT-SIDE REDIRECT PAGE (refresh, canonical and script
// all naming newPath()), and that target answers 200 as a real page (no second redirect). GET only, one request at a
// time, paced. Sends nothing anywhere else.
//
//   node scripts/verify-pages-migration.mjs                       (default: starts the repository's local static server)
//   node scripts/verify-pages-migration.mjs --base http://127.0.0.1:4321 [--pace-ms 0]
//   node scripts/verify-pages-migration.mjs --base https://magicesim.store   (LATER, after the switch; paced 1 s by default)
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legacyRedirects } from '../seo/build-legacy-redirects.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const freePort = () => new Promise((res, rej) => {
  const s = createServer(); s.unref(); s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});

/** What one redirect page says. */
export function readRedirect(html) {
  return {
    refresh: (html.match(/<meta http-equiv="refresh" content="0; url=([^"]+)">/) || [])[1] || null,
    canonical: (html.match(/<link rel="canonical" href="([^"]+)">/) || [])[1] || null,
    js: ((html.match(/<script>location\.replace\(("[^"]+")\+location\.search\+location\.hash\)<\/script>/) || [])[1] || 'null'),
  };
}

async function main() {
  let base = arg('--base');
  let server = null;
  if (!base) {
    const port = await freePort();
    server = spawn(process.execPath, [join(ROOT, 'test/e2e/server.mjs')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
    base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 50; i++) { try { await fetch(`${base}/`); break; } catch { await sleep(100); } }
  }
  base = base.replace(/\/$/, '');
  const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base);
  const pace = Number(arg('--pace-ms') ?? (local ? 0 : 1000));
  const get = async (path) => {
    if (pace) await sleep(pace);
    const r = await fetch(base + path, { redirect: 'manual', headers: { Accept: 'text/html' } });
    return { status: r.status, body: r.status === 200 ? await r.text() : '' };
  };
  const problems = [];
  let checked = 0;
  try {
    for (const r of legacyRedirects()) {
      const old = await get(r.path);
      if (old.status !== 200) { problems.push(`${r.path}: HTTP ${old.status}`); continue; }
      const x = readRedirect(old.body);
      if (x.refresh !== r.target || x.canonical !== SITE + r.target || JSON.parse(x.js) !== r.target) {
        problems.push(`${r.path}: the page does not name ${r.target} (refresh ${x.refresh}, canonical ${x.canonical}, script ${x.js})`);
        continue;
      }
      const to = await get(r.target);
      if (to.status !== 200) problems.push(`${r.path} → ${r.target}: HTTP ${to.status}`);
      else if (/<meta http-equiv="refresh"/i.test(to.body)) problems.push(`${r.path} → ${r.target}: the target is a redirect too`);
      checked++;
    }
  } finally {
    if (server) server.kill();
  }
  console.log(`${base}: ${checked} old addresses checked, ${problems.length} problem(s)`);
  for (const p of problems.slice(0, 50)) console.log(`  ${p}`);
  process.exit(problems.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
