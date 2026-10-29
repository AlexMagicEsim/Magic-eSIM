#!/usr/bin/env node
/**
 * Builds the GitHub Pages artifact: a copy of ONLY the site's files, chosen by an explicit ALLOWLIST.
 *
 * WHY. Until this existed Pages served the repository WHOLESALE from the branch, and `.nojekyll` switched off even
 * Jekyll's default exclusions — so every tracked file was a public URL: the agent skills under .claude/, the test
 * suite, the workflows, infra/, the SEO generators (seo/*.mjs), package.json, playwright.config.js, .env.example,
 * the RepairBase posters in the root, the Mini App's diagnostic canary page. Nothing secret (the repository is public
 * anyway), but a storefront should publish its pages, not its workshop.
 *
 * HOW IT DECIDES. A file is published only if a rule below ADMITS it — an exact root file, or a file inside an allowed
 * directory whose extension that directory allows (or an exact file there). Anything else — a new root file, an
 * unknown extension, a new top-level directory — is simply NOT published, and is listed in the summary. The repository
 * layout does not change: every generator and test keeps reading the repo root, only the published copy is filtered.
 *
 * DENY RULES ARE A SECOND LOCK. If an allow rule would admit a file that also matches a deny rule (a test, a
 * generator, a dotfile, a document, a poster…), the build FAILS instead of publishing it: that means an allow rule
 * became too wide, and a person must decide.
 *
 * REFERENCES ARE CHECKED. After the copy, every local `src` / `href` / `srcset` / `content` URL of every published
 * HTML page, every `url(…)` of every published CSS file, every icon of site.webmanifest, every <loc> of sitemap.xml and
 * every static '/assets/…'-style string literal of every published script must resolve INSIDE the artifact — so a page
 * that needs a file this allowlist forgot fails the build instead of shipping broken.
 *
 *   node scripts/build-pages-artifact.mjs                  build ./_site from the repository root
 *   node scripts/build-pages-artifact.mjs --out <dir>      build into <dir> (emptied first)
 *   node scripts/build-pages-artifact.mjs --root <dir>     read the site from <dir> instead of the repository root
 *
 * Exit codes: 0 built and verified; 1 a deny conflict or a missing reference (nothing usable was produced).
 */

import { readdirSync, statSync, lstatSync, mkdirSync, copyFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, extname, posix, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prefixedSiteLocales } from '../seo/locales.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE_ORIGIN = 'https://magicesim.store';

/* ------------------------------------------------------------------------ *
 * THE ALLOWLIST
 * ------------------------------------------------------------------------ */

/** Files published from the repository root, by exact name. */
export const ROOT_FILES = Object.freeze([
  // RU pages that live in the root
  'index.html', '404.html', 'android.html', 'iphone.html', 'privacy.html', 'terms.html',
  'payment-success.html', 'payment-failed.html',
  // crawler / browser files
  'robots.txt', 'sitemap.xml', 'site.webmanifest', 'CNAME',
  'favicon.ico', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png',
]);

/** Root files published by pattern: search-engine ownership verification files (Yandex, Google). */
export const ROOT_PATTERNS = Object.freeze([
  /^yandex_[0-9a-f]{16}\.html$/,
  /^google[0-9a-f]{16}\.html$/,
]);

/**
 * Directories: the extensions published inside them, the exact extra files, and the sub-trees that never are.
 * The language directories come from seo/locales.mjs — a published language is published, an unpublished one is not.
 */
export function directoryRules(locales = prefixedSiteLocales()) {
  const rules = [
    { dir: 'esim', ext: ['.html'] },
    {
      dir: 'assets',
      ext: ['.js', '.css', '.png', '.svg', '.woff2'],
      files: ['assets/catalog.json', 'assets/fonts/OFL.txt', 'assets/flags/LICENSE.txt'],
      // a Python workspace for Telegram story images, and the logo's master drawing (seo/build-logo-svg.mjs input)
      never: ['assets/story-workspace/', 'assets/brand/source/'],
    },
    // The Mini App, file by file: what app/index.html loads. Its tests (*.test.js) and the diagnostic canary page are
    // not part of it. A new Mini App file must be added here — the reference check fails the build until it is.
    {
      dir: 'app',
      ext: [],
      files: ['app/index.html', 'app/mini.css', 'app/core.js', 'app/i18n.js', 'app/locales.js', 'app/ui.js', 'app/motion.js'],
    },
  ];
  for (const l of locales) {
    rules.push({
      dir: l.prefix,
      ext: ['.html', '.js', '.css'],
      // the public list of legal document versions (the backend copies it; LEGAL-5…8)
      files: l.prefix === 'en' ? ['en/legal-versions.json'] : [],
    });
  }
  return rules;
}

/* ------------------------------------------------------------------------ *
 * THE DENY RULES — never published; an allow rule that admits one is an error
 * ------------------------------------------------------------------------ */

export const DENY_SEGMENTS = Object.freeze(['node_modules', 'test', 'tests', 'scripts', 'infra', 'seo', 'story-workspace', '__tests__']);
export const DENY_NAMES = Object.freeze([
  [/^\./, 'dotfile or dot-directory'],
  [/\.(test|spec|e2e)\.[cm]?[jt]s$/i, 'test file'],
  [/\.[cm]js$/i, 'node module (.mjs/.cjs)'],
  [/\.(md|markdown)$/i, 'document'],
  [/\.(py|sh|ts|yml|yaml|lock|log|bak|backup|map)$/i, 'tooling file'],
  [/\.(pptx|pdf|docx|xlsx|key|psd|ai|zip)$/i, 'office / print file'],
  [/^package(-lock)?\.json$/i, 'npm manifest'],
  [/\.config\.[cm]?[jt]s$/i, 'tool config'],
  [/RepairBase/i, 'RepairBase poster'],
  [/^Magic_eSIM_/, 'root poster / print file'],
  [/canary/i, 'diagnostic page'],
  [/^\.?env(\.|$)/i, 'environment file'],
]);

/** Why a path is denied, or null. */
export function denyReason(rel) {
  const parts = rel.split('/');
  for (const p of parts.slice(0, -1)) if (DENY_SEGMENTS.includes(p) || p.startsWith('.')) return `inside ${p}/`;
  if (rel.startsWith('assets/brand/source/')) return 'logo master drawing';
  const name = parts[parts.length - 1];
  for (const [re, why] of DENY_NAMES) if (re.test(name)) return why;
  return null;
}

/** The rule that admits a path (a string naming it), or null when nothing does. Deny rules are NOT consulted here. */
export function allowRule(rel, rules = directoryRules()) {
  if (!rel.includes('/')) {
    if (ROOT_FILES.includes(rel)) return 'root file';
    if (ROOT_PATTERNS.some((re) => re.test(rel))) return 'verification file';
    return null;
  }
  const top = rel.slice(0, rel.indexOf('/'));
  const rule = rules.find((r) => r.dir === top);
  if (!rule) return null;
  if ((rule.never || []).some((n) => rel.startsWith(n))) return null;
  if ((rule.files || []).includes(rel)) return `${top}/ exact file`;
  if (rule.ext.includes(extname(rel).toLowerCase())) return `${top}/ *${extname(rel).toLowerCase()}`;
  return null;
}

/* ------------------------------------------------------------------------ *
 * PLAN, COPY, VERIFY
 * ------------------------------------------------------------------------ */

const SKIP_WALK = new Set(['.git', 'node_modules', '_site']);

function walk(root, rel = '', out = []) {
  for (const name of readdirSync(join(root, rel)).sort()) {
    if (!rel && SKIP_WALK.has(name)) continue;
    if (rel && name === 'node_modules') continue;
    const r = rel ? `${rel}/${name}` : name;
    const st = lstatSync(join(root, r));
    if (st.isSymbolicLink()) { out.push({ rel: r, symlink: true }); continue; }
    if (st.isDirectory()) walk(root, r, out);
    else if (st.isFile()) out.push({ rel: r });
  }
  return out;
}

/**
 * Sorts every file under `root` into published / excluded, and lists the conflicts (admitted AND denied) and the
 * symlinks an allow rule would admit (a symlink in the artifact could point anywhere on the runner).
 */
export function planArtifact(root = REPO, { rules = directoryRules() } = {}) {
  const publish = [];
  const excluded = [];
  const conflicts = [];
  for (const f of walk(root)) {
    const allowed = allowRule(f.rel, rules);
    if (!allowed) { excluded.push(f.rel); continue; }
    const denied = denyReason(f.rel);
    if (denied) { conflicts.push(`${f.rel}: admitted by «${allowed}» but denied (${denied})`); continue; }
    if (f.symlink) { conflicts.push(`${f.rel}: admitted by «${allowed}» but is a symlink`); continue; }
    publish.push(f.rel);
  }
  return { publish, excluded, conflicts };
}

/** Copies the planned files into `out` (emptied first). Throws on any conflict, before writing anything. */
export function buildArtifact(root = REPO, out = join(REPO, '_site'), opts = {}) {
  const plan = planArtifact(root, opts);
  if (plan.conflicts.length) {
    const err = new Error(`pages artifact: ${plan.conflicts.length} deny conflict(s):\n  ${plan.conflicts.join('\n  ')}`);
    err.conflicts = plan.conflicts;
    throw err;
  }
  const absOut = resolve(out);
  if (absOut === resolve(root)) throw new Error('pages artifact: --out must not be the source root');
  rmSync(absOut, { recursive: true, force: true });
  for (const rel of plan.publish) {
    const dst = join(absOut, ...rel.split('/'));
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(join(root, ...rel.split('/')), dst);
  }
  return plan;
}

/* --- reference check ---------------------------------------------------- */

const ATTR_RE = /\s(?:src|href|content|poster|data-src|action)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const SRCSET_RE = /\ssrcset\s*=\s*("([^"]*)"|'([^']*)')/gi;
const CSS_URL_RE = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]+))\s*\)/gi;
const JS_LIT_RE = /(["'`])(\/(?:assets|app|esim|en|es|de|fr|zh|ko)\/[^"'`\s$<>{}]*\.(?:js|css|json|svg|png|jpg|webp|woff2|html|ico))\1/g;

/**
 * Turns a URL found in `fromRel` into the artifact path it needs, or null when it is not a local file reference
 * (another origin, mailto:, tel:, tg:, data:, a fragment, a template, a non-URL `content` value …).
 */
export function localTarget(url, fromRel) {
  let u = String(url || '').trim();
  if (!u || u.startsWith('#') || /[{}$]/.test(u)) return null;
  if (u.startsWith(SITE_ORIGIN + '/') || u === SITE_ORIGIN) u = u.slice(SITE_ORIGIN.length) || '/';
  else if (/^https?:\/\/(www\.)?magicesim\.store(\/|$)/i.test(u)) u = u.replace(/^https?:\/\/(www\.)?magicesim\.store/i, '') || '/';
  else if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//')) return null;
  u = u.replace(/[?#].*$/, '');
  if (!u) return null;
  let p;
  if (u.startsWith('/')) p = u.slice(1);
  else {
    // a relative reference is only a file reference if it looks like a path (content="width=device-width" is not)
    if (!/^(\.{1,2}\/|[A-Za-z0-9_-]+[/.])/.test(u) || /[=,;]|\s/.test(u)) return null;
    p = posix.normalize(posix.join(posix.dirname(fromRel), u));
    if (p.startsWith('..')) return `<outside>/${u}`;
  }
  try { p = decodeURIComponent(p); } catch { /* keep as is */ }
  if (p === '' || p.endsWith('/')) return `${p}index.html`;
  return p;
}

/** The artifact path that serves `p` the way Pages does (a directory → its index.html), or null. */
function served(out, p) {
  const abs = join(out, ...p.split('/'));
  if (existsSync(abs) && statSync(abs).isFile()) return p;
  if (existsSync(abs) && statSync(abs).isDirectory() && existsSync(join(abs, 'index.html'))) return `${p}/index.html`;
  if (!extname(p) && existsSync(`${abs}.html`)) return `${p}.html`;
  return null;
}

/** Paths under /pay/ are answered by 404.html on purpose (the Private Pay router) — never a file. */
const ROUTED_BY_404 = /^pay(\/|$)/;

/** Every reference of every published file that does not resolve inside `out`: [{ from, url, need }]. */
export function missingReferences(out) {
  const files = walk(out).map((f) => f.rel);
  const missing = [];
  const need = (from, url) => {
    const t = localTarget(url, from);
    if (!t || ROUTED_BY_404.test(t)) return;
    if (t.startsWith('<outside>') || !served(out, t)) missing.push({ from, url, need: t });
  };
  for (const rel of files) {
    const ext = extname(rel).toLowerCase();
    if (!['.html', '.css', '.js', '.webmanifest', '.xml'].includes(ext)) continue;
    const text = readFileSync(join(out, ...rel.split('/')), 'utf8');
    if (ext === '.html') {
      // inline scripts are code, not markup: their string literals are checked like a script's, never as attributes
      const scripts = [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
      for (const s of scripts) for (const m of s.matchAll(JS_LIT_RE)) need(rel, m[2]);
      const html = text.replace(/<!--[\s\S]*?-->/g, '').replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>');
      for (const m of html.matchAll(ATTR_RE)) {
        const v = m[2] ?? m[3];
        // <meta content="…"> is a URL only for the og/twitter image + url properties
        const tagStart = html.lastIndexOf('<', m.index);
        const tag = html.slice(tagStart, html.indexOf('>', m.index) + 1);
        if (/\scontent\s*=/i.test(m[0]) && !/(og:(image|url)|twitter:image|msapplication)/i.test(tag)) continue;
        need(rel, v);
      }
      for (const m of html.matchAll(SRCSET_RE)) for (const part of (m[2] ?? m[3]).split(',')) need(rel, part.trim().split(/\s+/)[0]);
      for (const m of html.matchAll(CSS_URL_RE)) need(rel, m[1] ?? m[2] ?? m[3]);
    } else if (ext === '.css') {
      for (const m of text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(CSS_URL_RE)) need(rel, m[1] ?? m[2] ?? m[3]);
    } else if (ext === '.webmanifest') {
      const j = JSON.parse(text);
      for (const i of [...(j.icons || []), ...(j.screenshots || [])]) need(rel, i.src);
      if (j.start_url) need(rel, j.start_url);
    } else if (ext === '.xml') {
      for (const m of text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) need(rel, m[1]);
      for (const m of text.matchAll(/<xhtml:link[^>]*\shref="([^"]+)"/g)) need(rel, m[1]);
    } else if (ext === '.js') {
      for (const m of text.matchAll(JS_LIT_RE)) need(rel, m[2]);
    }
  }
  return missing;
}

/* ------------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------------ */

function summary(plan) {
  const byTop = new Map();
  for (const rel of plan.excluded) {
    const top = rel.includes('/') ? `${rel.slice(0, rel.indexOf('/'))}/` : rel;
    byTop.set(top, (byTop.get(top) || 0) + 1);
  }
  const lines = [...byTop].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `  ${k}${n > 1 || k.endsWith('/') ? ` (${n})` : ''}`);
  return `published ${plan.publish.length} files; not published ${plan.excluded.length}:\n${lines.join('\n')}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
  const root = resolve(arg('--root') || REPO);
  const out = resolve(arg('--out') || join(REPO, '_site'));
  try {
    const plan = buildArtifact(root, out);
    const missing = missingReferences(out);
    console.log(summary(plan));
    if (missing.length) {
      console.error(`\n${missing.length} reference(s) do not resolve inside the artifact:`);
      for (const m of missing.slice(0, 100)) console.error(`  ${m.from}: ${m.url} → ${m.need}`);
      process.exit(1);
    }
    console.log(`\nartifact ${out.split(sep).join('/')}: every local reference resolves`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
