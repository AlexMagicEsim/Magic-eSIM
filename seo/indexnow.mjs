/*
 * IndexNow for magicesim.store — tells Yandex which RU pages CHANGED in a deployment.
 *
 * Why: the Yandex Webmaster recrawl API answers 504 since the October 2026 data-centre outage
 * (MAGIC_ESIM_YANDEX_CRAWL_DIAGNOSIS_2026-11-06.md); IndexNow is Yandex's own second channel
 * (https://yandex.ru/support/webmaster/ru/indexing-options/index-now, protocol https://www.indexnow.org/documentation).
 *
 * The rules this module enforces, each pinned by seo/test-indexnow.mjs:
 *   * WHAT changed is read from seo/sitemap-lastmod.json — the file whose `lastmod` moves only when a page's
 *     SUBSTANTIVE content moves (asset stamps, header/footer, CSP, i18n bundle are stripped from its hash). A URL is a
 *     candidate when its lastmod or hash differs between the previous deployment and this one, or it is new. Never the
 *     whole sitemap: a missing previous state sends NOTHING.
 *     PLUS (2026-11-06) a page whose set of links inside the site (<a href>) differs between the two deployed commits:
 *     the footer is chrome and moves no lastmod, but a new site-wide link is a real change of every page that carries
 *     it. Asset stamps, CSS, scripts never count; lastmod is not touched by this rule.
 *   * WHICH URLs may be sent: only https://magicesim.store/… URLs that are <loc>s of sitemap.xml at this commit, outside
 *     every language prefix of seo/locales.mjs (the RU segment lives at the root), without query or fragment, allowed
 *     by robots.txt for Yandex, and — on the live site — answering 200 with a self canonical and no noindex. Nothing a
 *     caller passes in can add a URL: the list is derived, never supplied.
 *   * HOW MUCH: at most MAX_URLS per run (the RU sitemap holds 210 URLs on 2026-11-06, so a site-wide link change fits);
 *     more means something is wrong (a lost base, a rename) and nothing is sent.
 *   * RETRIES: 429 / 5xx / network errors are retried at most RETRY_DELAYS_MS.length times (Retry-After honoured up
 *     to RETRY_AFTER_CAP_MS); then the run gives up with a warning. 400/403/422 are our errors: no retry.
 *   * THE KEY is a public value by design (the key file is served at /<key>.txt), but it is never written to a log.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from './locales.mjs';

export const ORIGIN = 'https://magicesim.store';
export const HOST = 'magicesim.store';
/** Yandex's own endpoint (IndexNow shares submissions between participating engines). Fixed — not configurable. */
export const ENDPOINT = 'https://yandex.com/indexnow';
export const MAX_URLS = 250;
export const RETRY_DELAYS_MS = Object.freeze([30_000, 120_000]);
export const RETRY_AFTER_CAP_MS = 300_000;
/** Yandex: «для одного URL рекомендуется пауза 10 минут между отправками». */
export const SAME_URL_PAUSE_MS = 10 * 60_000;

/** The key file: <key>.txt in the site root, 32 lowercase hex characters, the file holding exactly its own name. */
export const KEY_FILE_RE = /^([0-9a-f]{32})\.txt$/;

/** Every language prefix the registry knows (published or not) — none of them is the RU segment. */
export const FOREIGN_PREFIXES = Object.freeze([...new Set(LOCALES.map((l) => l.prefix).filter(Boolean))]);

/** Finds the single valid key file in `root`. Throws on none, on two, or on a file whose content is not its name. */
export function readKey(root) {
  const found = readdirSync(root).filter((f) => KEY_FILE_RE.test(f));
  if (found.length !== 1) throw new Error(`IndexNow: expected exactly one key file <32 hex>.txt in the root, found ${found.length}`);
  const [file] = found;
  const key = KEY_FILE_RE.exec(file)[1];
  const body = readFileSync(join(root, file), 'utf8');
  if (body !== key) throw new Error('IndexNow: the key file must contain exactly its own name (no newline, no BOM, no markup)');
  return { key, file };
}

/** <loc> values of a sitemap. */
export function sitemapLocs(xml) {
  return [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

/** True for a URL of the RU segment of this site: https, our host, no query/fragment, not under a language prefix. */
export function isRuSiteUrl(u) {
  let url;
  try { url = new URL(u); } catch { return false; }
  if (url.protocol !== 'https:' || url.host !== HOST || url.search || url.hash || url.username || url.password) return false;
  if (u !== url.href) return false; // no normalisation surprises: the sitemap form is the only accepted form
  const first = url.pathname.split('/')[1] || '';
  if (FOREIGN_PREFIXES.includes(first)) return false;
  return true;
}

/** URLs whose lastmod/hash moved between two seo/sitemap-lastmod.json states (or that are new). */
export function changedPages(baseState, headState) {
  if (!baseState || !baseState.pages || typeof baseState.pages !== 'object' || !headState || !headState.pages || typeof headState.pages !== 'object') {
    throw new Error('IndexNow: both lastmod states are required — refusing to guess (a lost base would send the whole site)');
  }
  const out = [];
  for (const [u, now] of Object.entries(headState.pages)) {
    const was = baseState.pages[u];
    if (!was || was.lastmod !== now.lastmod || was.hash !== now.hash) out.push(u);
  }
  return out.sort();
}

/* ------------------------------------------------------------------------ *
 * robots.txt — the groups for Yandex (or *, when Yandex has none); Allow/Disallow, longest match wins, Allow on a tie;
 * `*` and a trailing `$` as Yandex documents them.
 * ------------------------------------------------------------------------ */
export function robotsRules(text, agent = 'yandex') {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') {
      if (!lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (cur && (field === 'allow' || field === 'disallow')) cur.rules.push({ allow: field === 'allow', path: value });
  }
  const own = groups.filter((g) => g.agents.includes(agent));
  const chosen = own.length ? own : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

function ruleMatches(path, pattern) {
  if (pattern === '') return false;
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp('^' + body.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : ''));
  return re.test(path);
}

export function robotsAllows(rules, u) {
  const path = new URL(u).pathname;
  let best = null;
  for (const r of rules) {
    if (!ruleMatches(path, r.path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return !best || best.allow;
}

/* ------------------------------------------------------------------------ *
 * A page's own statements: canonical and robots meta.
 * ------------------------------------------------------------------------ */
export function pageFacts(html) {
  const tags = String(html).match(/<(link|meta)\b[^>]*>/gi) || [];
  const attr = (t, n) => (new RegExp(`\\b${n}\\s*=\\s*"([^"]*)"`, 'i').exec(t) || [])[1];
  const canon = tags.find((t) => /^<link/i.test(t) && (attr(t, 'rel') || '').toLowerCase() === 'canonical');
  const robots = tags.filter((t) => /^<meta/i.test(t) && /^(robots|yandex)$/i.test(attr(t, 'name') || '')).map((t) => (attr(t, 'content') || '').toLowerCase());
  return { canonical: canon ? attr(canon, 'href') : null, noindex: robots.some((c) => /\b(noindex|none)\b/.test(c)) };
}

/** Repository path of a RU page URL: `/` → index.html, `/esim/x/` → esim/x/index.html, `/iphone.html` → iphone.html. */
export function repoPath(u) {
  const p = decodeURIComponent(new URL(u).pathname).replace(/^\//, '');
  return p === '' || p.endsWith('/') ? `${p}index.html` : p;
}

/**
 * A page's outgoing links inside the site: every <a href> (scripts left out), resolved against the page, without the
 * fragment, unique and sorted. Asset stamps, CSS and the like are not links, so they never make a page «changed» here.
 */
export function internalLinks(html, pageUrl) {
  const body = String(html).replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const out = new Set();
  for (const m of body.matchAll(/<a\b[^>]*?\shref\s*=\s*"([^"]*)"/gi)) {
    let url;
    try { url = new URL(m[1].replace(/&amp;/g, '&'), pageUrl); } catch { continue; }
    if (url.protocol !== 'https:' || url.host !== HOST) continue;
    out.add(url.pathname + url.search);
  }
  return [...out].sort();
}

/**
 * The URLs of this deployment to send. `read(relPath)` returns a file of the deployed commit (or null); `readBase` the same
 * file of the previous deployed commit.
 *
 * A page is CHANGED when its seo/sitemap-lastmod.json entry moved (its content) OR — when `readBase` is given — when the set
 * of its links inside the site differs between the two commits. The second rule is for site-wide link changes: the footer
 * is chrome, stripped from the lastmod hash on purpose (a menu change must not re-date 200 pages), so a new footer link
 * moves no lastmod, yet every page carrying it now links somewhere new and is worth one recrawl. Only `<a href>` counts —
 * an asset stamp, a stylesheet or a script never sends a page. Each deployment is compared with the previous DEPLOYED
 * commit, so a change is sent once and never again.
 * Returns { send, skipped: [{url, why}], reason: {url: 'content' | 'links' | 'content+links'} }.
 */
export function selectUrls({ baseState, headState, sitemapXml, robotsTxt, read, readBase }) {
  const locs = sitemapLocs(sitemapXml);
  const inSitemap = new Set(locs);
  const rules = robotsRules(robotsTxt);
  const reason = {};
  for (const u of changedPages(baseState, headState)) reason[u] = 'content';
  if (typeof readBase === 'function') {
    for (const u of locs) {
      if (!isRuSiteUrl(u)) continue;
      const before = readBase(repoPath(u));
      const after = read(repoPath(u));
      if (before == null || after == null) continue; // a new or removed page is the lastmod rule's business
      if (internalLinks(before, u).join('\n') !== internalLinks(after, u).join('\n')) reason[u] = reason[u] ? 'content+links' : 'links';
    }
  }
  const send = [];
  const skipped = [];
  for (const u of Object.keys(reason).sort()) {
    let why = null;
    if (!isRuSiteUrl(u)) why = 'not a RU-segment URL of the site';
    else if (!inSitemap.has(u)) why = 'not in sitemap.xml';
    else if (!robotsAllows(rules, u)) why = 'disallowed by robots.txt';
    else {
      const html = read(repoPath(u));
      if (html == null) why = 'no page file at this commit';
      else {
        const f = pageFacts(html);
        if (f.noindex) why = 'noindex';
        else if (f.canonical !== u) why = `canonical is ${f.canonical || 'missing'}`;
      }
    }
    if (why) skipped.push({ url: u, why }); else send.push(u);
  }
  return { send, skipped, reason };
}

/** Live re-check of one URL on production: 200 without a redirect, self canonical, no noindex (meta or header). */
export async function liveCheck(u, { fetchImpl = fetch } = {}) {
  let res;
  try {
    res = await fetchImpl(u, { redirect: 'manual', headers: { 'user-agent': 'magicesim-indexnow-check/1 (+https://magicesim.store/)' } });
  } catch (e) {
    return `network error (${e && e.code ? e.code : 'fetch failed'})`;
  }
  if (res.status !== 200) return `HTTP ${res.status}`;
  if (/\b(noindex|none)\b/i.test(res.headers.get('x-robots-tag') || '')) return 'X-Robots-Tag noindex';
  const f = pageFacts(await res.text());
  if (f.noindex) return 'noindex';
  if (f.canonical !== u) return `canonical is ${f.canonical || 'missing'}`;
  return null;
}

/* ------------------------------------------------------------------------ *
 * Submission. Never logs the key; the body is built here from validated URLs only.
 * ------------------------------------------------------------------------ */
const TRANSIENT = (s) => s === 429 || (s >= 500 && s <= 599);

export function buildBody(key, urls) {
  for (const u of urls) if (!isRuSiteUrl(u)) throw new Error(`IndexNow: refusing a URL outside the RU segment: ${u}`);
  if (urls.length === 0) throw new Error('IndexNow: nothing to send');
  if (urls.length > MAX_URLS) throw new Error(`IndexNow: ${urls.length} URLs is more than MAX_URLS (${MAX_URLS}) — nothing sent`);
  return { host: HOST, key, keyLocation: `${ORIGIN}/${key}.txt`, urlList: urls };
}

/**
 * POSTs once, retrying only 429/5xx/network errors. Resolves to
 *   { outcome: 'accepted' | 'pending_key' | 'rejected' | 'gave_up', status, attempts }.
 */
export async function submit(key, urls, { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = console.log } = {}) {
  const body = JSON.stringify(buildBody(key, urls));
  let attempts = 0;
  let last = null;
  for (;;) {
    attempts += 1;
    let status = null;
    let retryAfter = null;
    try {
      const res = await fetchImpl(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body });
      status = res.status;
      retryAfter = res.headers && res.headers.get ? res.headers.get('retry-after') : null;
    } catch (e) {
      status = null;
      last = `network error (${e && e.code ? e.code : 'fetch failed'})`;
    }
    if (status === 200) { log(`IndexNow: HTTP 200 — ${urls.length} URL(s) accepted (attempt ${attempts})`); return { outcome: 'accepted', status, attempts }; }
    if (status === 202) { log(`IndexNow: HTTP 202 — accepted, the key is awaiting verification (attempt ${attempts})`); return { outcome: 'pending_key', status, attempts }; }
    if (status !== null && !TRANSIENT(status)) {
      log(`IndexNow: HTTP ${status} — rejected, not retried (400 invalid body, 403 key not found or not matching, 422 URL/key invalid)`);
      return { outcome: 'rejected', status, attempts };
    }
    if (status !== null) last = `HTTP ${status}`;
    if (attempts > RETRY_DELAYS_MS.length) {
      log(`IndexNow: ${last} after ${attempts} attempt(s) — gave up; the next deployment sends its own changes`);
      return { outcome: 'gave_up', status, attempts };
    }
    let wait = RETRY_DELAYS_MS[attempts - 1];
    const ra = Number(retryAfter);
    if (Number.isFinite(ra) && ra > 0) wait = Math.min(Math.max(wait, ra * 1000), RETRY_AFTER_CAP_MS);
    log(`IndexNow: ${last} — retry ${attempts} of ${RETRY_DELAYS_MS.length} in ${Math.round(wait / 1000)} s`);
    await sleep(wait);
  }
}
