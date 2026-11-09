// The publication scope (seo/publication-scope.mjs; owner, 2026-11-09 — the Merchant of Record application): the
// published copy holds only English pages and English legal documents; every other language is HIDDEN, not deleted.
//
// Pins, on the artifact the deploy builds today (scripts/build-pages-artifact.mjs with the registry's scope):
//   (a) the repository still holds every page, translation and legal document of every language;
//   (b) nothing of a hidden language is published but the owner's D3 list, which is byte-identical to the repository;
//       the Russian legal documents are hidden (their sources stay); the Mini App's links to them are the known limitation;
//   (c) no English page names a page of a hidden language — hreflang, switch, links — and every reference resolves;
//   (d) the English legal documents' text is the repository's, byte for byte; the legal versions list is unchanged;
//   (e) the sitemap is the repository's English entries; the manifest opens «/»; IndexNow reads the published sitemap;
//   (f) a hidden language's path gets the English 404, /pay/ is still routed first;
//   (g) RESTORE: with every language public each scope function is the identity on the whole tree.
// Each rule's first assertion proves it fires.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { buildArtifact, planArtifact, missingReferences, localTarget } from '../scripts/build-pages-artifact.mjs';
import { LOCALES, PUBLIC_SITE_LOCALES } from './locales.mjs';
import {
  scopeOf, restoredScope, isHiddenFile, isHiddenLanguageUrl, scopeHtml, scopeSitemap, scope404, scopeManifest,
  KEPT_UNDER_HIDDEN, HIDDEN_ROOT_RU,
} from './publication-scope.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = mkdtempSync(join(tmpdir(), 'publication-scope-'));
const OUT = join(TMP, 'site');
const SCOPE = scopeOf();
const plan = buildArtifact(ROOT, OUT, { scope: SCOPE });
test.after(() => rmSync(TMP, { recursive: true, force: true }));

function filesUnder(dir, rel = '') {
  const out = [];
  if (!existsSync(join(dir, rel))) return out;
  for (const n of readdirSync(join(dir, rel))) {
    if (!rel && ['.git', 'node_modules', '_site'].includes(n)) continue;
    if (n === 'node_modules') continue;
    const r = rel ? `${rel}/${n}` : n;
    if (statSync(join(dir, r)).isDirectory()) out.push(...filesUnder(dir, r));
    else out.push(r);
  }
  return out;
}
const published = filesUnder(OUT);
const repo = (rel) => readFileSync(join(ROOT, ...rel.split('/')));
const site = (rel) => readFileSync(join(OUT, ...rel.split('/')));
const isRussianPage = (html) => /^<!doctype html>\s*<html lang="ru"/i.test(html);
const HIDDEN_PREFIXES = ['ru', 'es', 'de', 'fr', 'zh', 'ko'];

test('the owner\'s scope: only English is public, every other language stays enabled', () => {
  assert.deepEqual([...PUBLIC_SITE_LOCALES], ['en']);
  assert.deepEqual([...SCOPE.prefixes].sort(), [...HIDDEN_PREFIXES].sort());
  assert.ok(LOCALES.every((l) => l.site.enabled), 'hiding a language never disables it');
  assert.throws(() => scopeOf({ publicCodes: ['xx'] }), /not an enabled language/);
});

test('(a) hidden, not deleted: the repository still holds every language\'s pages, legal documents and PDFs', () => {
  for (const p of HIDDEN_PREFIXES) {
    const files = filesUnder(ROOT, p);
    assert.ok(files.filter((f) => f.endsWith('.html')).length >= 200, `${p}: pages in the repository`);
    if (p !== 'ru') {
      for (const k of ['terms', 'refund', 'privacy']) assert.ok(existsSync(join(ROOT, p, k, 'index.html')), `${p}/${k}`);
      assert.ok(files.some((f) => f.endsWith('.pdf')), `${p}: legal PDFs`);
    }
  }
  assert.ok(plan.hidden.length >= 1400, `hidden from the copy: ${plan.hidden.length}`);
  assert.ok(plan.hidden.every((f) => existsSync(join(ROOT, ...f.split('/')))));
});

test('(b) nothing of a hidden language is published but the D3 list', () => {
  const tops = new Set(published.map((f) => f.split('/')[0]));
  for (const p of ['es', 'de', 'fr', 'zh', 'ko', 'esim']) assert.ok(!tops.has(p), `${p}/ published`);
  assert.deepEqual(published.filter((f) => f.startsWith('ru/')).sort(), [...KEPT_UNDER_HIDDEN].sort());
  // an old address leading to a hidden page is hidden with it; one leading to a kept page stays
  assert.ok(plan.hidden.includes('esim/thailand/index.html'));
  assert.ok(published.includes('iphone.html') && published.includes('android.html'));
  assert.ok(published.includes('en/esim/thailand/index.html'), 'an old English address still redirects');
});

test('(b) the Russian legal documents are not published; their sources stay in the repository', () => {
  assert.deepEqual([...HIDDEN_ROOT_RU], ['terms.html', 'privacy.html']);
  for (const f of HIDDEN_ROOT_RU) {
    assert.ok(!published.includes(f), `${f} published`);
    assert.ok(plan.hidden.includes(f), `${f} not listed as hidden`);
    assert.match(repo(f).toString(), /^<!DOCTYPE html>\s*<html lang="ru"/, `${f}: the source is in the repository`);
  }
  // no legal document but the English ones is published anywhere
  const legal = published.filter((f) => /(^|\/)(terms|privacy|refund)(\.html$|\/)/.test(f));
  assert.ok(legal.length >= 18, `English legal files: ${legal.length}`);
  assert.deepEqual(legal.filter((f) => !f.startsWith('en/')), []);
});

test('(b) KNOWN LIMITATION (owner, no workaround): the Mini App still links the hidden Russian documents', () => {
  // The Mini App is unchanged on purpose. Its consent and help links name /terms.html and /privacy.html, which answer
  // the 404 while Russian is hidden. The order does not depend on them: the backend checks only termsAccepted === true.
  const links = [];
  for (const f of published.filter((x) => x.startsWith('app/'))) {
    for (const m of site(f).toString().matchAll(/https:\/\/magicesim\.store\/(terms|privacy)\.html/g)) links.push(`${f}: ${m[0]}`);
  }
  assert.ok(links.some((l) => l.startsWith('app/index.html') && l.endsWith('/terms.html')), 'checkout consent link');
  assert.ok(links.some((l) => l.startsWith('app/ui.js') && l.endsWith('/terms.html')), 'top-up consent / help link');
  assert.ok(links.some((l) => l.endsWith('/privacy.html')), 'privacy link');
  for (const f of HIDDEN_ROOT_RU) assert.ok(!existsSync(join(OUT, f)), `${f} would answer 404`);
});

test('(b) the pages that stay although Russian, the Mini App and the data files are byte-identical to the repository', () => {
  const same = [...KEPT_UNDER_HIDDEN, 'payment-success.html', 'payment-failed.html', 'robots.txt',
    'assets/catalog.json', 'en/legal-versions.json', 'en/checkout-statements.json',
    ...published.filter((f) => f.startsWith('app/') || f.endsWith('.pdf'))];
  assert.ok(same.filter((f) => f.startsWith('app/')).length >= 7, 'the Mini App files');
  for (const f of same) assert.ok(repo(f).equals(site(f)), `${f} differs from the repository`);
});

test('(c) no English page names a page of a hidden language, and every reference resolves', () => {
  const home = repo('index.html').toString();
  assert.match(home, /class="langsw langmenu"/, 'negative control: the repository\'s home has the switch');
  assert.match(home, /hreflang="ru"/);
  assert.match(home, /assets\/lang-route\.js/);
  const named = [];
  for (const f of published.filter((x) => x.endsWith('.html'))) {
    const html = site(f).toString();
    if (isRussianPage(html)) continue;
    for (const m of html.matchAll(/\s(?:href|src|content)="([^"]+)"/g)) if (isHiddenLanguageUrl(m[1], SCOPE)) named.push(`${f}: ${m[1]}`);
    if (/class="langsw/.test(html)) named.push(`${f}: language switch`);
    if (/assets\/lang-route\.js/.test(html)) named.push(`${f}: lang-route`);
  }
  assert.deepEqual(named, []);
  const hiddenLinks = [];
  assert.deepEqual(missingReferences(OUT, { scope: SCOPE, hiddenLinks }), []);
  // only the kept Russian pages link hidden pages (their own site's frame) — never an English one
  const from = [...new Set(hiddenLinks.map((h) => h.from))].sort();
  assert.deepEqual(from, ['app/index.html', 'payment-failed.html', 'payment-success.html', 'ru/android.html', 'ru/iphone.html']);
});

test('(c) every English page keeps its canonical; hreflang is English and x-default only', () => {
  let pages = 0;
  for (const f of published.filter((x) => x.endsWith('.html'))) {
    const html = site(f).toString();
    if (isRussianPage(html) || /http-equiv="refresh"/.test(html) || f === '404.html') continue;
    pages += 1;
    const langs = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(langs.filter((l) => !['en', 'x-default'].includes(l)), [], f);
    const canon = /<link rel="canonical" href="([^"]+)">/.exec(html);
    if (canon) assert.ok(existsSync(join(OUT, ...localTarget(canon[1], f).split('/'))), `${f}: canonical ${canon[1]}`);
  }
  assert.ok(pages >= 200, `English pages checked: ${pages}`);
});

test('(d) the English legal documents\' text is the repository\'s, byte for byte', () => {
  const docs = published.filter((f) => /^en\/(terms|refund|privacy)\/(v[0-9.]+\/)?index\.html$/.test(f));
  assert.ok(docs.length >= 15, `English legal pages: ${docs.length}`);
  const mainOf = (html) => /<main\b[\s\S]*<\/main>/.exec(html)[0];
  for (const f of docs) assert.equal(mainOf(site(f).toString()), mainOf(repo(f).toString()), f);
  assert.ok(!repo('en/terms/index.html').equals(site('en/terms/index.html')), 'negative control: the frame did change');
});

test('(e) the sitemap is the repository\'s English entries; the manifest opens the English home', () => {
  const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const before = locs(repo('sitemap.xml').toString());
  const after = locs(site('sitemap.xml').toString());
  assert.ok(before.some((u) => u.includes('/ru/')), 'negative control: the repository sitemap lists Russian pages');
  assert.deepEqual(after, before.filter((u) => !isHiddenLanguageUrl(u, SCOPE)));
  assert.ok(after.length >= 20 && after.every((u) => !/\/(ru|es|de|fr|zh|ko)\/|\/(terms|privacy)\.html$/.test(u)), after.join(' '));
  for (const u of after) assert.ok(existsSync(join(OUT, ...localTarget(u, 'sitemap.xml').split('/'))), u);
  assert.equal(JSON.parse(site('site.webmanifest').toString()).start_url, '/');
  assert.equal(JSON.parse(repo('site.webmanifest').toString()).start_url, '/ru/');
});

test('(e) IndexNow selects from the published sitemap', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'indexnow-submit.mjs'), 'utf8');
  assert.match(src, /sitemapXml: scopeSitemap\(show\(head, 'sitemap\.xml'\)/);
});

test('(f) a hidden language\'s path gets the English 404; /pay/ is routed before it', () => {
  const html = site('404.html').toString();
  const start = html.indexOf('var NOT_FOUND = {');
  const end = html.indexOf('function showNotFoundLocale');
  assert.ok(start > 0 && end > start);
  const ctx = {};
  vm.runInNewContext(`${html.slice(start, end)}; this.f = notFoundLocale;`, ctx);
  for (const p of ['/ru/', '/ru/esim/thailand/', '/es/', '/de/terms/', '/zh/esim/japan/', '/ko/privacy/v0.9.5/', '/esim/turkey/', '/iphone', '/terms.html', '/privacy.html', '/nope']) {
    assert.equal(ctx.f(p), 'en', p);
  }
  // negative control: the repository's own 404 gives these paths their own screens
  const r = repo('404.html').toString();
  const ctx2 = {};
  vm.runInNewContext(`${r.slice(r.indexOf('var NOT_FOUND = {'), r.indexOf('function showNotFoundLocale'))}; this.f = notFoundLocale;`, ctx2);
  assert.equal(ctx2.f('/ru/esim/thailand/'), null);
  assert.equal(ctx2.f('/es/'), 'es');
  // /pay/ is decided before notFoundLocale in the router
  assert.ok(html.indexOf("/^\\/pay\\//.test(path)") < html.indexOf('} else if(notFoundLocale(path)){'));
});

test('(g) restore: with every language public each scope function is the identity on the whole tree', () => {
  const FULL = restoredScope();
  assert.equal(FULL.active, false);
  const p = planArtifact(ROOT, { scope: FULL });
  assert.deepEqual(p.hidden, []);
  assert.ok(p.publish.length >= plan.publish.length + plan.hidden.length);
  for (const f of p.publish.filter((x) => x.endsWith('.html'))) {
    const html = repo(f).toString();
    assert.equal(scopeHtml(html, FULL), html, f);
  }
  for (const [f, fn] of [['sitemap.xml', scopeSitemap], ['404.html', scope404], ['site.webmanifest', scopeManifest]]) {
    assert.equal(fn(repo(f).toString(), FULL), repo(f).toString(), f);
  }
  assert.ok(!isHiddenFile('ru/esim/thailand/index.html', FULL));
});

test('the scope never hides a deny conflict: a forbidden file inside a hidden language still stops the build', async () => {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const fake = join(TMP, 'fake');
  for (const f of ['es/index.html', 'es/evil.test.js', 'index.html']) {
    mkdirSync(dirname(join(fake, f)), { recursive: true });
    writeFileSync(join(fake, f), '<!doctype html>\n<html lang="en">');
  }
  const p = planArtifact(fake, { scope: SCOPE });
  assert.deepEqual(p.hidden, ['es/index.html']);
  assert.equal(p.conflicts.length, 1);
  assert.match(p.conflicts[0], /^es\/evil\.test\.js: admitted/);
});
