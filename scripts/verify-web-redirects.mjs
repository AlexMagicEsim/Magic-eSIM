#!/usr/bin/env node
/**
 * Proves the web server answers the URL map (seo/url-migration.mjs) with real, single-hop 301s — and that everything
 * that does not move keeps answering as GitHub Pages answers it today.
 *
 *   node scripts/verify-web-redirects.mjs --base https://127.0.0.1:18443 --host magicesim.store --insecure \
 *        --http-base http://127.0.0.1:18080 --docroot <artifact dir> --allow-missing-targets --report out.json
 *   node scripts/verify-web-redirects.mjs --base https://magicesim.store --expect-pages --rate 2 --report live.json
 *
 * WHAT IS ASKED (never following a redirect): every <loc> of the artifact's sitemap.xml and every page of the artifact
 * (x/index.html -> /x/, y.html -> /y.html), each once plain and — when it moves — once with `?utm_source=x`; then fixed
 * probes: /, /?country=TR (+ UTM in front and behind), /?country=ZZ, /?country=../x, /?country=tr (-> the page), /esim/turkey (no slash, one hop), /en, /esim, /es,
 * /iphone, /pay/<token>, /pay/s/<secret>, an unknown page, content types, cache and gzip headers, and the host blocks
 * (www, http) when --http-base is given.
 *
 *   moved (newPath() names a target)  exactly ONE 301, Location = the target with the same query; the target is not
 *                                     a redirect; when the target file is in the docroot it answers 200, else it is
 *                                     `target-missing` (a failure unless --allow-missing-targets: the new tree does
 *                                     not exist yet)
 *   stays                             the status Pages gives (200 for a file, 404 + 404.html for /pay/...)
 *   chains / loops                    a second pass follows every redirect up to 5 hops: more than 1 is a failure
 *
 * --expect-pages   the LIVE GitHub Pages site, read-only, to RECORD today's statuses (nothing moves there yet): HEAD for
 *                  the bulk, GET for the few body checks, at --rate requests per second (default 2). Never fails.
 * --docroot        the artifact to compare with; without it the artifact is built into a temp dir from this checkout.
 * --ask-from       an artifact of the OLD tree (today's main): its sitemap and pages are asked too, so every address in
 *                  use today is proved to land — with --docroot = the new tree and no --allow-missing-targets this is
 *                  the switch proof. A page of the new tree that a rule would redirect is a failure (`shadowed`).
 *
 * Exit codes: 0 every check passed (or --expect-pages); 1 a failure; 2 bad arguments.
 */

import http from 'node:http';
import https from 'node:https';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { newPath, countryQueryTargets } from '../seo/url-migration.mjs';
import { buildArtifact } from './build-pages-artifact.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';
const MAX_HOPS = 5;

/* ------------------------------------------------------------------------ *
 * the docroot: what Pages (and the nginx try_files) would serve for a path
 * ------------------------------------------------------------------------ */

/** 'file:<rel>' | 'dir-redirect' | null, the way Pages resolves a path. */
export function servedBy(docroot, path) {
  let p;
  try { p = decodeURIComponent(path.replace(/[?#].*$/, '')); } catch { return null; }
  if (p.split('/').includes('..')) return null;
  const rel = p.replace(/^\/+/, '');
  const abs = join(docroot, ...rel.split('/').filter(Boolean));
  if (p.endsWith('/')) return existsSync(join(abs, 'index.html')) ? `file:${rel}index.html` : null;
  if (existsSync(abs) && statSync(abs).isFile()) return `file:${rel}`;
  if (existsSync(abs) && statSync(abs).isDirectory()) return 'dir-redirect';
  if (existsSync(`${abs}.html`)) return `file:${rel}.html`;
  return null;
}

function filesUnder(dir, rel = '') {
  const out = [];
  for (const n of readdirSync(join(dir, rel))) {
    const r = rel ? `${rel}/${n}` : n;
    if (statSync(join(dir, r)).isDirectory()) out.push(...filesUnder(dir, r));
    else out.push(r);
  }
  return out;
}

/** Sitemap URLs + every page of the artifact, as paths, sorted, unique. */
export function pathsToAsk(docroot) {
  const out = new Set();
  const sm = join(docroot, 'sitemap.xml');
  if (existsSync(sm)) {
    for (const m of readFileSync(sm, 'utf8').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) out.add(m[1].replace(SITE, '') || '/');
  }
  for (const f of filesUnder(docroot)) {
    if (!f.endsWith('.html')) continue;
    if (f === '404.html') continue; // the router page itself is asked by the fixed probes
    out.add(f === 'index.html' ? '/' : f.endsWith('/index.html') ? `/${f.slice(0, -'index.html'.length)}` : `/${f}`);
  }
  return [...out].sort();
}

/* ------------------------------------------------------------------------ *
 * HTTP, never following a redirect
 * ------------------------------------------------------------------------ */

function client(opts) {
  const agents = {
    'http:': new http.Agent({ keepAlive: true, maxSockets: 1 }),
    'https:': new https.Agent({ keepAlive: true, maxSockets: 1, rejectUnauthorized: !opts.insecure, servername: opts.host || undefined }),
  };
  let last = 0;
  const gap = opts.rate > 0 ? 1000 / opts.rate : 0;
  let count = 0;
  async function request(base, path, { method = 'GET', host = opts.host, headers = {} } = {}) {
    if (gap) {
      const wait = last + gap - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      last = Date.now();
    }
    count += 1;
    const u = new URL(base);
    const mod = u.protocol === 'https:' ? https : http;
    const h = { 'user-agent': 'magicesim-verify-web-redirects/1 (+read-only)', ...headers };
    if (host) h.host = host;
    return new Promise((res) => {
      const req = mod.request({
        protocol: u.protocol, hostname: u.hostname, port: u.port || undefined, path, method, headers: h,
        agent: agents[u.protocol], servername: host || u.hostname, timeout: 20000,
      }, (r) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks) }));
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', (e) => res({ status: 0, error: e.code || e.message, headers: {}, body: Buffer.alloc(0) }));
      req.end();
    });
  }
  request.count = () => count;
  request.close = () => Object.values(agents).forEach((a) => a.destroy());
  return request;
}

/** A Location as a path + query on this site, or null when it leaves the site. */
export function siteLocation(location, base) {
  if (!location) return null;
  const u = new URL(location, `${SITE}/`);
  const b = new URL(base);
  if (u.origin !== SITE && u.origin !== b.origin) return null;
  return u.pathname + u.search;
}

/* ------------------------------------------------------------------------ *
 * the checks
 * ------------------------------------------------------------------------ */

export async function verify(opts) {
  const docroot = opts.docroot;
  const ask = client(opts);
  const base = opts.base;
  const rows = []; // { kind, path, status, location, expect, result: pass|fail|target-missing|recorded, note }
  const add = (r) => { rows.push(r); return r; };
  const pages = !!opts.expectPages;
  const bulkMethod = pages ? 'HEAD' : 'GET';
  const body404 = readFileSync(join(docroot, '404.html'));
  const countries = JSON.parse(readFileSync(join(REPO, 'seo', 'catalogue-countries.json'), 'utf8')).countries;
  const ctry = countryQueryTargets(countries);

  const expectStay = (path) => {
    const s = servedBy(docroot, path);
    if (s === 'dir-redirect') return { status: 301, location: `${path}/` };
    if (s) return { status: 200 };
    return { status: 404 };
  };

  // one request, judged against { status, location? }
  async function check(kind, path, expect, { method = bulkMethod, host, note } = {}) {
    const r = await ask(base, path, { method, host });
    const loc = r.headers.location ? siteLocation(r.headers.location, base) ?? r.headers.location : null;
    let ok = r.status === expect.status && (expect.location === undefined || loc === expect.location);
    if (ok && expect.body404) ok = r.body.equals(body404);
    return add({ kind, path, method, status: r.status || r.error, location: loc, expect, result: pages ? 'recorded' : (ok ? 'pass' : 'fail'), match: ok, note });
  }

  const own = new Set(pathsToAsk(docroot));
  const old = opts.askFrom ? pathsToAsk(opts.askFrom) : [];
  for (const path of [...new Set([...own, ...old])].sort()) {
    const to = newPath(path.replace(/\?.*$/, ''));
    if (!pages && to !== null && own.has(path) && servedBy(docroot, path)) {
      add({ kind: 'shadowed', path, method: '-', status: '-', location: to, expect: { status: 200 }, result: 'fail',
        note: `a page of the tree that the rule ${path} -> ${to} would hide` });
    }
    if (pages || to === null) {
      const lost = !pages && opts.askFrom && servedBy(opts.askFrom, path) && !servedBy(docroot, path);
      await check(to === null ? 'stays' : 'moves-later', path, lost ? { status: 200 } : expectStay(path),
        lost ? { note: 'served today, no rule moves it, gone from the new tree' } : {});
      continue;
    }
    for (const q of ['', '?utm_source=x']) {
      const row = await check('moved', path + q, { status: 301, location: to + q });
      if (row.result !== 'pass') continue;
      // the target: never a redirect; 200 when it exists in the docroot, else target-missing
      const t = await ask(base, to + q, { method: bulkMethod });
      const exists = servedBy(docroot, to);
      if (t.status >= 300 && t.status < 400) { row.result = 'fail'; row.note = `target ${to} redirects (${t.status} -> ${t.headers.location})`; }
      else if (exists && exists !== 'dir-redirect') { if (t.status !== 200) { row.result = 'fail'; row.note = `target ${to} answered ${t.status}`; } }
      else if (t.status === 404) { row.result = opts.allowMissingTargets ? 'target-missing' : 'fail'; row.note = `target ${to} not in the tree yet`; }
      else { row.result = 'fail'; row.note = `target ${to} answered ${t.status}`; }
      row.targetStatus = t.status;
    }
  }

  // fixed probes
  const tr = ctry.TR;
  if (!tr) throw new Error('verify: no TR in seo/catalogue-countries.json');
  const P = pages ? {
    root: { status: 200 }, trq: { status: 200 }, en: { status: 301, location: '/en/' }, esim: { status: 301, location: '/esim/' },
  } : {
    root: { status: 200 }, trq: { status: 301, location: tr }, en: { status: 301, location: newPath('/en') }, esim: { status: 301, location: newPath('/esim') },
  };
  await check('probe', '/', P.root, { method: 'GET', note: '/ is a page, never a redirect' });
  await check('probe', '/?country=TR', P.trq, { method: 'GET' });
  if (!pages) {
    await check('probe', '/?country=TR&utm_source=x', { status: 301, location: `${tr}?utm_source=x` }, { method: 'GET' });
    await check('probe', '/?utm_source=x&country=TR&utm_medium=y', { status: 301, location: `${tr}?utm_source=x&utm_medium=y` }, { method: 'GET' });
  }
  if (!pages) {
    await check('probe', '/?country=tr', P.trq, { method: 'GET', note: 'lower case, like the old home script' });
    await check('probe', '/esim/turkey', { status: 301, location: newPath('/esim/turkey') }, { method: 'GET', note: 'no slash: still one hop' });
    await check('probe', '/en/esim/turkey', { status: 301, location: newPath('/en/esim/turkey') }, { method: 'GET', note: 'no slash: still one hop' });
  }
  for (const q of ['/?country=ZZ', '/?country=../x', '/?country=', '/?xcountry=TR']) {
    await check('probe', q, { status: 200 }, { method: 'GET', note: 'unknown / malformed code: the page, no redirect' });
  }
  await check('probe', '/en', P.en, { method: 'GET', note: 'no 2-hop chain via /en/' });
  await check('probe', '/esim', P.esim, { method: 'GET', note: 'no 2-hop chain via /esim/' });
  await check('probe', '/es', { status: 301, location: '/es/' }, { method: 'GET', note: 'directory without slash: one 301 (Pages)' });
  await check('probe', '/iphone', pages ? expectStay('/iphone') : { status: 301, location: newPath('/iphone') }, { method: 'GET', note: 'extensionless .html moves too' });
  for (const p of ['/pay/abc', '/pay/s/0123456789abcdef', '/no-such-page/']) {
    await check('probe', p, { status: 404, body404: true }, { method: 'GET', note: '404.html with status 404 (the /pay/ router)' });
  }
  // headers: Pages-equivalent types, cache, gzip
  const typeProbes = [
    ['/en/legal-versions.json', /^application\/json/], ['/site.webmanifest', /^application\/manifest\+json/],
    ['/favicon.svg', /^image\/svg\+xml/], ['/assets/site.css', /^text\/css/], ['/robots.txt', /^text\/plain/],
  ];
  const js = filesUnder(join(docroot, 'assets')).find((f) => f.endsWith('.js'));
  if (js) typeProbes.push([`/assets/${js}`, /^(application|text)\/javascript/]);
  const pdf = filesUnder(docroot).find((f) => f.endsWith('.pdf'));
  if (pdf) typeProbes.push([`/${pdf}`, /^application\/pdf/]);
  for (const [p, re] of typeProbes) {
    const r = await ask(base, p, { method: 'HEAD' });
    const ok = r.status === 200 && re.test(r.headers['content-type'] || '') && /max-age=600/.test(r.headers['cache-control'] || '');
    add({ kind: 'headers', path: p, method: 'HEAD', status: r.status, location: null, expect: { type: String(re), cache: 'max-age=600' },
      got: { type: r.headers['content-type'], cache: r.headers['cache-control'] }, result: pages ? 'recorded' : (ok ? 'pass' : 'fail'), match: ok });
  }
  {
    const r = await ask(base, '/es/', { method: 'GET', headers: { 'accept-encoding': 'gzip' } });
    const ok = r.headers['content-encoding'] === 'gzip' && /accept-encoding/i.test(r.headers.vary || '');
    add({ kind: 'headers', path: '/es/', note: 'gzip', method: 'GET', status: r.status, location: null, expect: { encoding: 'gzip', vary: 'Accept-Encoding' },
      got: { encoding: r.headers['content-encoding'], vary: r.headers.vary }, result: pages ? 'recorded' : (ok ? 'pass' : 'fail'), match: ok });
  }

  // the host blocks (local only: the live site is not asked with forged Host headers)
  if (!pages) {
    const www = await ask(base, '/esim/turkey/?utm_source=x', { method: 'GET', host: 'www.magicesim.store' });
    add({ kind: 'host', path: 'https://www/esim/turkey/?utm_source=x', method: 'GET', status: www.status, location: www.headers.location,
      expect: { status: 301, location: `${SITE}/esim/turkey/?utm_source=x` },
      result: www.status === 301 && www.headers.location === `${SITE}/esim/turkey/?utm_source=x` ? 'pass' : 'fail' });
    if (opts.httpBase) {
      for (const h of ['magicesim.store', 'www.magicesim.store']) {
        const r = await ask(opts.httpBase, '/en/?a=1', { method: 'GET', host: h });
        add({ kind: 'host', path: `http://${h}/en/?a=1`, method: 'GET', status: r.status, location: r.headers.location,
          expect: { status: 301, location: `${SITE}/en/?a=1` }, result: r.status === 301 && r.headers.location === `${SITE}/en/?a=1` ? 'pass' : 'fail' });
      }
      const acme = await ask(opts.httpBase, '/.well-known/acme-challenge/probe', { method: 'GET', host: 'magicesim.store' });
      add({ kind: 'host', path: 'http://apex/.well-known/acme-challenge/probe', method: 'GET', status: acme.status, location: null,
        expect: { status: 404, note: 'answered on :80, not redirected' }, result: acme.status === 404 ? 'pass' : 'fail' });
      const other = await ask(opts.httpBase, '/', { method: 'GET', host: 'evil.example' });
      add({ kind: 'host', path: 'http://evil.example/', method: 'GET', status: other.status || other.error, location: null,
        expect: { status: 'closed (444)' }, result: other.status === 0 ? 'pass' : 'fail' });
    }
  }

  // second pass: follow every redirect up to MAX_HOPS; more than one hop is a chain, a repeat is a loop
  const chains = [];
  for (const row of rows.filter((r) => r.status >= 300 && r.status < 400 && !['host', 'headers'].includes(r.kind))) {
    let path = row.path;
    const seen = new Set([path]);
    let hops = 0;
    let loop = false;
    for (;;) {
      if (!path.startsWith('/')) break;
      const r = await ask(base, path, { method: pages ? 'HEAD' : 'GET' });
      if (!(r.status >= 300 && r.status < 400)) break;
      hops += 1;
      const next = siteLocation(r.headers.location, base);
      if (!next) break;
      if (seen.has(next)) { loop = true; break; }
      seen.add(next);
      path = next;
      if (hops >= MAX_HOPS) break;
    }
    row.hops = hops;
    if (hops > 1 || loop) {
      chains.push({ path: row.path, hops, loop, via: [...seen] });
      if (!pages) { row.result = 'fail'; row.note = `${loop ? 'loop' : 'chain'} of ${hops} hops: ${[...seen].join(' -> ')}`; }
    }
  }
  ask.close();
  return { rows, chains, requests: ask.count() };
}

export function summarise({ rows, chains, requests }) {
  const by = (pred) => rows.filter(pred).length;
  const statuses = {};
  for (const r of rows) statuses[r.status] = (statuses[r.status] || 0) + 1;
  return {
    asked: rows.length,
    requests,
    moved: by((r) => r.kind === 'moved'),
    stayed: by((r) => r.kind === 'stays'),
    moves_later: by((r) => r.kind === 'moves-later'),
    probes: by((r) => ['probe', 'headers', 'host'].includes(r.kind)),
    pass: by((r) => r.result === 'pass'),
    target_missing: by((r) => r.result === 'target-missing'),
    failures: by((r) => r.result === 'fail'),
    recorded: by((r) => r.result === 'recorded'),
    not_as_expected: by((r) => r.result === 'recorded' && !r.match),
    chains: chains.length,
    loops: chains.filter((c) => c.loop).length,
    max_hops: Math.max(0, ...rows.map((r) => r.hops || 0)),
    statuses,
  };
}

/* ------------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------------ */

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const flag = (n) => argv.includes(n);
  const opts = {
    base: val('--base'),
    host: val('--host'),
    httpBase: val('--http-base'),
    insecure: flag('--insecure'),
    allowMissingTargets: flag('--allow-missing-targets'),
    expectPages: flag('--expect-pages'),
    rate: Number(val('--rate') ?? (flag('--expect-pages') ? 2 : 0)),
    docroot: val('--docroot'),
    askFrom: val('--ask-from'),
  };
  if (!opts.base) { console.error('usage: --base <url> [--host h] [--http-base url] [--insecure] [--docroot dir] [--allow-missing-targets] [--expect-pages] [--rate n] [--report file]'); process.exit(2); }
  if (opts.expectPages && (!(opts.rate > 0) || opts.rate > 2)) { console.error('--expect-pages asks production: --rate must be > 0 and ≤ 2'); process.exit(2); }
  let tmp = null;
  if (!opts.docroot) {
    tmp = mkdtempSync(join(tmpdir(), 'web-verify-'));
    opts.docroot = join(tmp, 'site');
    buildArtifact(REPO, opts.docroot);
  }
  try {
    const res = await verify(opts);
    const sum = summarise(res);
    const report = { base: opts.base, mode: opts.expectPages ? 'expect-pages (record only)' : 'nginx', at: new Date().toISOString(), summary: sum, chains: res.chains, rows: res.rows };
    if (val('--report')) writeFileSync(val('--report'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\n${report.mode} — ${opts.base}`);
    console.table(Object.fromEntries(Object.entries(sum).filter(([k]) => k !== 'statuses')));
    console.log('statuses:', JSON.stringify(sum.statuses));
    const bad = res.rows.filter((r) => r.result === 'fail' || (r.result === 'recorded' && !r.match));
    for (const r of bad.slice(0, 40)) console.log(`${r.result === 'fail' ? 'FAIL' : 'differs'} ${r.kind} ${r.path}: got ${r.status}${r.location ? ` -> ${r.location}` : ''}, expected ${JSON.stringify(r.expect)}${r.note ? ` (${r.note})` : ''}`);
    if (bad.length > 40) console.log(`… ${bad.length - 40} more in the report`);
    for (const c of res.chains.slice(0, 10)) console.log(`${c.loop ? 'LOOP' : 'CHAIN'} ${c.path}: ${c.via.join(' -> ')}`);
    process.exit(!opts.expectPages && sum.failures ? 1 : 0);
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}
