// The old addresses' CLIENT-SIDE REDIRECT PAGES (EN-root migration, owner 2026-11-07; the site stays on GitHub Pages,
// which sends no configurable HTTP 301). seo/build-legacy-redirects.mjs writes one at every old address that moved.
//
// Pinned, each rule first proving it fires:
//   - the frozen inventory (seo/url-migration-legacy-paths.json) holds the old tree's pages, noindex ones included, and
//     `--freeze` refuses to overwrite it;
//   - every moved legacy path has its page; its refresh URL, canonical and script target all equal newPath();
//   - the target is a real page of the tree, never another redirect page (one client hop, no chain, no loop);
//   - the script is the only one, allowed by its own sha256 in the page's meta CSP; it keeps the query and fragment;
//   - no Metrika, no noindex, no hreflang; never in the sitemap or its lastmod state; «/» has none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legacyRedirects, legacyPaths, redirectPage, fileOfPath, isLegacyRedirectFile } from './build-legacy-redirects.mjs';
import { newPath } from './url-migration.mjs';
import { planArtifact } from '../scripts/build-pages-artifact.mjs';
import { restoredScope } from './publication-scope.mjs'; // the pages as published once the scope is lifted

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const ALL = legacyRedirects();
const PUBLISHED = new Set(planArtifact(ROOT, { scope: restoredScope() }).publish);

/** What a redirect page says, read from its markup. */
export function readRedirect(html) {
  const refresh = (html.match(/<meta http-equiv="refresh" content="0; url=([^"]+)">/) || [])[1] || null;
  const canonical = (html.match(/<link rel="canonical" href="([^"]+)">/) || [])[1] || null;
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  // A Russian page's script first hands an external referrer over (seo/test-legacy-referrer.mjs), then redirects.
  const m = scripts.length === 1 ? scripts[0].match(/^((?:try\{[^\n]*?sessionStorage\.setItem\('magic_legacy_ref'[^\n]*?\}catch\(e\)\{\})?)location\.replace\(("[^"]+")\+location\.search\+location\.hash\)$/) : null;
  const csp = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1] || '';
  return { refresh, canonical, js: m ? JSON.parse(m[2]) : null, handOff: Boolean(m && m[1]), scripts, csp };
}

test('the frozen inventory: the old tree\'s pages, noindex ones included; «/» stays a page; --freeze never overwrites', () => {
  const paths = legacyPaths();
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual([...paths].sort(), paths, 'sorted');
  for (const p of ['/', '/en/', '/iphone.html', '/android.html', '/esim/', '/esim/turkey/', '/esim/payment-rubles/', '/en/esim/',
    '/en/esim/afghanistan/', '/en/esim/asia/', '/en/guides/', '/en/guides/iphone/', '/en/terms/', '/es/esim/turkey/', '/payment-failed.html']) {
    assert.ok(paths.includes(p), `${p} is in the inventory`);
  }
  assert.ok(!paths.some((p) => p.startsWith('/ru/') || p.startsWith('/destinations/')), 'no new address in the old inventory');
  assert.equal(newPath('/'), null, '«/» gets no redirect page: it is the English home');
  assert.ok(!ALL.some((r) => r.path === '/'));
  let refused = false;
  try {
    execFileSync('node', [join(ROOT, 'scripts/url-migration-legacy-paths.mjs'), '--freeze', '--from', 'HEAD'], { stdio: 'pipe' });
  } catch (e) { refused = e.status === 1 && /frozen/.test(String(e.stderr)); }
  assert.ok(refused, '--freeze refuses to overwrite the committed inventory');
});

test('every moved legacy path has its redirect page; refresh, canonical and script all name newPath()', () => {
  const bad = redirectPage('/esim/x/', '/ru/esim/x/').replace('url=/ru/esim/x/', 'url=/ru/esim/y/');
  assert.notEqual(readRedirect(bad).refresh, newPath('/esim/x/'), 'the rule fires on a refresh that names another page');
  assert.ok(ALL.length > 400, `${ALL.length} old addresses moved`);
  const fams = {};
  for (const r of ALL) {
    const fam = r.path.startsWith('/en/esim/') ? '/en/esim/…' : r.path.startsWith('/en/guides/') ? '/en/guides/…' : r.path.startsWith('/esim/') ? '/esim/…' : r.path;
    fams[fam] = (fams[fam] || 0) + 1;
  }
  assert.deepEqual(fams, { '/esim/…': 205, '/en/esim/…': 203, '/en/guides/…': 6, '/en/': 1, '/iphone.html': 1, '/android.html': 1 });
  for (const r of ALL) {
    assert.equal(r.missingTarget, false, `${r.path}: its target ${r.target} is gone — remove the redirect page (git rm) on purpose`);
    assert.equal(r.target, newPath(r.path));
    assert.ok(existsSync(join(ROOT, r.file)), `${r.file} exists`);
    const html = read(r.file);
    assert.equal(html, r.html, `${r.file} is exactly the generator's (node seo/build-legacy-redirects.mjs) — never hand-edited`);
    const x = readRedirect(html);
    assert.equal(x.refresh, r.target, `${r.file}: refresh`);
    assert.equal(x.canonical, SITE + r.target, `${r.file}: canonical`);
    assert.equal(x.js, r.target, `${r.file}: script target`);
    assert.equal(x.handOff, !r.path.startsWith('/en/'), `${r.file}: the referrer hand-off on the Russian pages only`);
    assert.match(html, new RegExp(`<a href="${r.target.replace(/[.]/g, '\\.')}">`), `${r.file}: a visible link`);
    assert.match(html, new RegExp(`<html lang="${r.path.startsWith('/en/') ? 'en' : 'ru'}">`), `${r.file}: the old page's language`);
  }
});

test('one client hop: every target is a real published page, never another redirect page', () => {
  for (const r of ALL) {
    const file = fileOfPath(r.target);
    assert.ok(PUBLISHED.has(file), `${r.path} → ${r.target}: published`);
    assert.ok(!isLegacyRedirectFile(file), `${r.path} → ${r.target}: a redirect page (a chain)`);
    assert.doesNotMatch(read(file), /<meta http-equiv="refresh"/i, `${r.target}: a refresh on the target`);
    assert.equal(newPath(r.target), null, `${r.target}: the target moves again`);
  }
  for (const r of ALL) assert.ok(PUBLISHED.has(r.file), `${r.file}: the redirect page itself is published (admitted on purpose)`);
});

test('the one script is allowed by its own sha256 and nothing else runs; it keeps the query and the fragment', () => {
  for (const r of ALL) {
    const x = readRedirect(read(r.file));
    assert.equal(x.scripts.length, 1, `${r.file}: one script`);
    const sha = createHash('sha256').update(x.scripts[0], 'utf8').digest('base64');
    assert.equal(x.csp, `default-src 'none'; script-src 'sha256-${sha}'; img-src 'self'; base-uri 'none'; form-action 'none'`, r.file);
    assert.match(x.scripts[0], /\+location\.search\+location\.hash\)$/, `${r.file}: keeps ?query and #fragment`);
  }
  // the page runs: a script that sees ?utm_source=x#plans goes to the target with both
  const r = ALL.find((x) => x.path === '/esim/turkey/');
  const seen = [];
  new Function('location', readRedirect(r.html).scripts[0])({ search: '?utm_source=x', hash: '#plans', replace: (u) => seen.push(u) });
  assert.deepEqual(seen, ['/ru/esim/turkey/?utm_source=x#plans']);
});

test('no Metrika, no noindex, no hreflang; never in the sitemap or its lastmod state', () => {
  const sitemap = read('sitemap.xml');
  const lastmod = JSON.parse(read('seo/sitemap-lastmod.json')).pages;
  assert.match('<meta name="robots" content="noindex">', /noindex/, 'the rule fires');
  for (const r of ALL) {
    const html = read(r.file);
    assert.doesNotMatch(html, /mc\.yandex|metrika|ym\(/i, `${r.file}: a counter`);
    assert.doesNotMatch(html, /noindex|name="robots"/i, `${r.file}: noindex`);
    assert.doesNotMatch(html, /hreflang/i, `${r.file}: hreflang`);
    assert.ok(!sitemap.includes(`<loc>${SITE}${r.path}</loc>`), `${r.path}: in the sitemap`);
    assert.ok(!lastmod[SITE + r.path], `${r.path}: in seo/sitemap-lastmod.json`);
  }
});

test('no page outside the redirect pages links to one — the old addresses are for the outside world', () => {
  const stubPaths = new Set(ALL.map((r) => r.path));
  const linked = [];
  for (const rel of PUBLISHED) {
    if (!rel.endsWith('.html') || isLegacyRedirectFile(rel)) continue;
    const html = read(rel).replace(/<!--[\s\S]*?-->/g, '');
    for (const m of html.matchAll(/\s(?:href|src|content)="(?:https:\/\/magicesim\.store)?(\/[^"?#]*)/g)) {
      if (stubPaths.has(m[1]) && !(m[1] === '/en/' && /^(?:en|es|de|fr|zh|ko)\/terms\//.test(rel))) linked.push(`${rel} → ${m[1]}`);
    }
  }
  assert.deepEqual(linked.slice(0, 20), [], `${linked.length} link(s) to an old address (only the Terms text «Website: …/en/» may)`);
});
