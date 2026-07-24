#!/usr/bin/env node
// Local SEO validator for all indexable HTML pages. No network, no paid tools.
// Exit code 1 on CRITICAL errors (safe for future CI). Run: node seo/validate-seo.mjs

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';

// Collect pages, skipping backups / nested repo copy / assets.
const SKIP_DIRS = new Set(['assets', 'Magic-eSIM-github-2', 'seo', '.git', '.claude']);
function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (!SKIP_DIRS.has(name)) collect(p, out); continue; }
    if (!name.endsWith('.html')) continue;
    if (/backup|before-/.test(name)) continue;
    out.push(p);
  }
  return out;
}

// Pages that MUST be noindex / are technical (never in sitemap, no meta checks).
const TECH = new Set(['payment-success.html', 'payment-failed.html', '404.html']);
const VERIFICATION = /^yandex_[0-9a-f]+\.html$/;

const pages = collect(ROOT);
const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const critical = [];
const warnings = [];
const seenTitle = new Map(); const seenDesc = new Map(); const seenH1 = new Map(); const seenCanon = new Map();

function urlFor(rel) {
  if (rel === 'index.html') return `${SITE}/`;
  if (rel.endsWith('/index.html')) return `${SITE}/${rel.slice(0, -'index.html'.length)}`;
  return `${SITE}/${rel}`;
}

for (const p of pages) {
  const rel = relative(ROOT, p);
  const base = rel.split('/').pop();
  const h = readFileSync(p, 'utf8');
  const isTech = TECH.has(base) || VERIFICATION.test(base);

  // Secrets / localhost — critical for EVERY file.
  if (/localhost:\d+|127\.0\.0\.1/.test(h)) critical.push(`${rel}: содержит localhost/127.0.0.1`);
  if (/(api[_-]?secret|merchant[_-]?id|X-Secret|ADMIN_API_KEY|PLATEGA_API)/i.test(h)) critical.push(`${rel}: похоже на секрет/приватный заголовок`);

  if (isTech) {
    // payment pages must be noindex; verification file is exempt from all checks.
    if (TECH.has(base) && !/name="robots" content="noindex/.test(h)) critical.push(`${rel}: техническая страница БЕЗ noindex`);
    if (sitemapUrls.includes(urlFor(rel))) critical.push(`${rel}: техническая страница попала в sitemap`);
    continue;
  }

  // --- Commercial/indexable page checks ---
  const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (h.match(/name="description" content="([^"]*)"/) || [])[1] || '';
  const canon = (h.match(/rel="canonical" href="([^"]*)"/) || [])[1] || '';
  const h1s = [...h.matchAll(/<h1[^>]*>/g)];
  const lang = /<html lang="ru">/.test(h);
  const noindex = /name="robots" content="[^"]*noindex/.test(h);

  if (!title) critical.push(`${rel}: нет <title>`);
  else {
    if (title.length < 20 || title.length > 75) warnings.push(`${rel}: длина title ${title.length} (реком. 20–75)`);
    if (seenTitle.has(title)) critical.push(`${rel}: ДУБЛЬ title с ${seenTitle.get(title)}`);
    seenTitle.set(title, rel);
  }
  if (!desc) critical.push(`${rel}: нет meta description`);
  else {
    if (desc.length < 70 || desc.length > 180) warnings.push(`${rel}: длина description ${desc.length} (реком. 70–180)`);
    if (seenDesc.has(desc)) critical.push(`${rel}: ДУБЛЬ description с ${seenDesc.get(desc)}`);
    seenDesc.set(desc, rel);
  }
  if (h1s.length !== 1) critical.push(`${rel}: H1 x${h1s.length} (должен быть ровно 1)`);
  else {
    const h1t = (h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>|\s+/g, ' ').trim() || '';
    if (seenH1.has(h1t)) critical.push(`${rel}: ДУБЛЬ H1 с ${seenH1.get(h1t)}`);
    seenH1.set(h1t, rel);
  }
  if (!canon) critical.push(`${rel}: нет canonical`);
  else {
    const expect = urlFor(rel);
    if (canon !== expect) critical.push(`${rel}: canonical "${canon}" != URL страницы "${expect}"`);
    if (seenCanon.has(canon)) critical.push(`${rel}: ДУБЛЬ canonical с ${seenCanon.get(canon)}`);
    seenCanon.set(canon, rel);
  }
  if (!lang) critical.push(`${rel}: нет <html lang="ru">`);
  if (noindex) critical.push(`${rel}: NOINDEX на коммерческой странице`);
  if (!sitemapUrls.includes(urlFor(rel))) warnings.push(`${rel}: отсутствует в sitemap.xml`);

  // JSON-LD syntax.
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { critical.push(`${rel}: невалидный JSON-LD (${e.message.slice(0, 60)})`); }
  }

  // Local link targets exist (href not starting with http/#/mailto).
  for (const m of h.matchAll(/href="([^"#]+?)(?:#[^"]*)?"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:)/.test(href) || href === '') continue;
    // Site-absolute links (/x) resolve against the repo root, not the FS root.
    let target = href.startsWith('/') ? join(ROOT, href.slice(1)) : resolve(dirname(p), href);
    if (href.endsWith('/')) target = join(target, 'index.html');
    if (!existsSync(target) && !existsSync(target + '.html')) critical.push(`${rel}: битая локальная ссылка "${href}"`);
  }
}

// Sitemap URLs must map to existing files.
for (const u of sitemapUrls) {
  const path = u.replace(SITE, '').replace(/^\//, '');
  const f = path === '' ? 'index.html' : path.endsWith('/') ? join(path, 'index.html') : path;
  if (!existsSync(join(ROOT, f))) critical.push(`sitemap.xml: URL без файла -> ${u}`);
}

console.log(`Проверено страниц: ${pages.length} (индексируемых: ${pages.length - [...pages].filter((p) => TECH.has(p.split('/').pop()) || VERIFICATION.test(p.split('/').pop())).length})`);
console.log(`Sitemap URL: ${sitemapUrls.length}`);
if (warnings.length) { console.log(`\n⚠️  Предупреждения (${warnings.length}):`); warnings.forEach((w) => console.log('  -', w)); }
if (critical.length) {
  console.log(`\n❌ КРИТИЧНО (${critical.length}):`); critical.forEach((c) => console.log('  -', c));
  process.exit(1);
}
console.log('\n✅ Критических ошибок нет');
