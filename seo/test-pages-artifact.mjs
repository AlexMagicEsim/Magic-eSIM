// The GitHub Pages artifact (scripts/build-pages-artifact.mjs, .github/workflows/deploy-pages.yml).
//
// Pages used to serve the repository wholesale (deploy from the branch, `.nojekyll`), so every tracked file was a
// public URL. The artifact publishes an ALLOWLIST instead. These tests build it into a temp directory and pin:
//
//   (a) what MUST be in it — every sitemap URL, every page of every published language and of /esim/, the root pages,
//       404.html (the site-wide 404 AND the /pay/ router), robots/sitemap/CNAME/manifest/icons, the catalogue
//       snapshot, the legal versions list, the verification files, the Mini App; and every local reference of every
//       published page, stylesheet, script, manifest and the sitemap resolves inside it;
//   (b) what MUST NOT be — tests, agent skills, workflows, infra, generators, scripts, npm and tool config, dotfiles,
//       documents, posters, the canary page;
//   (c) a file nobody allowlisted — a new root file, an unknown extension in an allowed directory, a new directory —
//       is not published, and an allow rule that admits a denied file stops the build;
//   (d) the canonical and hreflang targets of every built page exist in it.
//
// Each rule's FIRST assertion proves it fires.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, cpSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  buildArtifact, planArtifact, missingReferences, denyReason, allowRule, localTarget, directoryRules, ROOT_FILES,
} from '../scripts/build-pages-artifact.mjs';
import { prefixedSiteLocales } from './locales.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = mkdtempSync(join(tmpdir(), 'pages-artifact-'));
const OUT = join(TMP, 'site');
const plan = buildArtifact(ROOT, OUT);
const published = new Set(plan.publish);
test.after(() => rmSync(TMP, { recursive: true, force: true }));

function filesUnder(dir, rel = '') {
  const out = [];
  if (!existsSync(join(dir, rel))) return out;
  for (const n of readdirSync(join(dir, rel))) {
    const r = rel ? `${rel}/${n}` : n;
    if (statSync(join(dir, r)).isDirectory()) out.push(...filesUnder(dir, r));
    else out.push(r);
  }
  return out;
}
const artifactFiles = filesUnder(OUT);
const inArtifact = (p) => existsSync(join(OUT, ...p.split('/')));

/** Tracked files of the repository (git), or every file when this is not a checkout. */
function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0').filter(Boolean);
  } catch {
    return plan.publish.concat(plan.excluded);
  }
}

/* ------------------------------------------------------------------------ *
 * (a) required content
 * ------------------------------------------------------------------------ */

test('negative control: the reference check reports a file the artifact lacks', () => {
  const copy = join(TMP, 'refcheck');
  cpSync(OUT, copy, { recursive: true });
  unlinkSync(join(copy, 'assets', 'site.css'));
  unlinkSync(join(copy, 'app', 'ui.js'));
  rmSync(join(copy, 'es', 'esim', 'france'), { recursive: true });
  // a relative path literal in a script (the Mini App writes '../assets/…') is checked too
  writeFileSync(join(copy, 'app', 'core.js'), readFileSync(join(copy, 'app', 'core.js'), 'utf8') + "\nconst probe = '../assets/no-such-probe.json';\n");
  writeFileSync(join(copy, 'en', 'plans.js'), readFileSync(join(copy, 'en', 'plans.js'), 'utf8') + "\nconst probe2 = './assets/x.webp';\n");
  const missing = missingReferences(copy);
  assert.ok(missing.some((m) => m.need === 'assets/no-such-probe.json' && m.from === 'app/core.js'), 'a relative ../ literal in a script');
  assert.ok(missing.some((m) => m.need === 'en/assets/x.webp' && m.from === 'en/plans.js'), 'a relative ./ literal in a script');
  assert.ok(missing.some((m) => m.need === 'assets/site.css' && m.from === 'index.html'), 'a stylesheet of the RU home');
  assert.ok(missing.some((m) => m.need === 'app/ui.js' && m.from === 'app/index.html'), 'a relative Mini App script');
  assert.ok(missing.some((m) => m.need === 'es/esim/france/index.html' && m.from === 'sitemap.xml'), 'a sitemap URL');
  assert.ok(missing.some((m) => m.need === 'es/esim/france/index.html' && m.from === 'en/esim/france/index.html'), 'an hreflang twin');
});

test('negative control: localTarget maps local URLs and ignores everything else', () => {
  assert.equal(localTarget('/assets/site.css?v=1', 'index.html'), 'assets/site.css');
  assert.equal(localTarget('https://magicesim.store/en/', 'x.html'), 'en/index.html');
  assert.equal(localTarget('../assets/a.png', 'app/index.html'), 'assets/a.png');
  assert.equal(localTarget('mini.css?v=2', 'app/index.html'), 'app/mini.css');
  for (const u of ['https://telegram.org/js/x.js', 'mailto:a@b', 'tel:1', 'tg://x', 'data:image/png;base64,AA', '#main',
    'width=device-width, initial-scale=1', '//cdn.example/x.js', '/en/${slug}/']) assert.equal(localTarget(u, 'index.html'), null, u);
});

test('every local reference of every published page, stylesheet, script, manifest and the sitemap resolves in the artifact', () => {
  assert.deepEqual(missingReferences(OUT), []);
});

test('every sitemap URL is a page of the artifact', () => {
  const xml = readFileSync(join(OUT, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 200, `sitemap URLs: ${locs.length}`);
  const absent = locs.map((u) => localTarget(u, 'sitemap.xml')).filter((p) => !inArtifact(p));
  assert.deepEqual(absent, []);
});

test('every page of /esim/ and of every published language is in the artifact', () => {
  const prefixes = prefixedSiteLocales().map((l) => l.prefix);
  assert.deepEqual(prefixes.sort(), ['de', 'en', 'es', 'fr', 'ko', 'zh']);
  for (const dir of ['esim', ...prefixes]) {
    const pages = trackedFiles().filter((f) => f.startsWith(`${dir}/`) && f.endsWith('.html'));
    assert.ok(pages.length >= 200, `${dir}: ${pages.length} pages in the repository`);
    assert.deepEqual(pages.filter((p) => !published.has(p)), [], `${dir}: pages not published`);
  }
  for (const p of prefixes) {
    for (const page of ['index.html', 'esim/index.html', 'guides/index.html', 'terms/index.html', 'privacy/index.html', 'refund/index.html']) {
      assert.ok(inArtifact(`${p}/${page}`), `${p}/${page}`);
    }
    assert.ok(artifactFiles.filter((f) => f.startsWith(`${p}/esim/`) && f.endsWith('/index.html')).length >= 200, `${p}: country pages`);
  }
  // the legal archive: every frozen version page
  const archive = trackedFiles().filter((f) => /^[a-z]{2}\/(terms|privacy|refund)\/v[0-9.]+\/index\.html$/.test(f));
  assert.ok(archive.length >= 10, `legal archive pages: ${archive.length}`);
  assert.deepEqual(archive.filter((f) => !published.has(f)), []);
});

test('the root pages, crawler files, icons, catalogue, legal versions, verification files and the Mini App are published', () => {
  for (const f of ROOT_FILES) assert.ok(inArtifact(f), f);
  for (const f of ['404.html', 'index.html', 'privacy.html', 'terms.html', 'iphone.html', 'android.html', 'payment-success.html',
    'payment-failed.html', 'robots.txt', 'sitemap.xml', 'CNAME', 'site.webmanifest', 'assets/catalog.json', 'en/legal-versions.json',
    'app/index.html']) assert.ok(inArtifact(f), f);
  assert.equal(readFileSync(join(OUT, 'CNAME'), 'utf8').trim(), 'magicesim.store');
  const verification = trackedFiles().filter((f) => /^(yandex_[0-9a-f]+|google[0-9a-f]+)\.html$/.test(f));
  assert.ok(verification.length >= 1, 'the Yandex verification file exists in the repository');
  for (const f of verification) assert.ok(inArtifact(f), f);
  // 404.html is the site-wide 404 AND the /pay/ router — it must keep the router
  assert.match(readFileSync(join(OUT, '404.html'), 'utf8'), /\/pay\//);
  // byte-identical copies, not rewrites
  for (const f of ['index.html', '404.html', 'assets/catalog.json', 'app/core.js', 'en/legal-versions.json']) {
    assert.ok(readFileSync(join(OUT, f)).equals(readFileSync(join(ROOT, f))), `${f} is copied byte for byte`);
  }
});

test('every published-kind file of assets/ is published (flags, fonts, scripts, styles, brand), except the two workshop trees', () => {
  const assets = trackedFiles().filter((f) => f.startsWith('assets/'));
  const expectedOut = assets.filter((f) => !f.startsWith('assets/story-workspace/') && !f.startsWith('assets/brand/source/') && f !== 'assets/flags/SOURCE.json');
  assert.deepEqual(expectedOut.filter((f) => !published.has(f)), []);
  assert.ok(artifactFiles.filter((f) => /^assets\/flags\/[a-z-]+\.svg$/i.test(f)).length >= 190, 'flags');
});

/* ------------------------------------------------------------------------ *
 * (b) forbidden content
 * ------------------------------------------------------------------------ */

const FORBIDDEN = [
  [/^test\/|\/test\//, 'test/'], [/(^|\/)tests?\//, 'tests/'], [/\.(spec|test|e2e)\.[cm]?js$/, 'test files'],
  [/^\.claude\//, '.claude/'], [/^\.github\//, '.github/'], [/^infra\//, 'infra/'], [/^scripts\//, 'scripts/'],
  [/^seo\//, 'seo/'], [/\.mjs$/, '*.mjs'], [/(^|\/)node_modules\//, 'node_modules'], [/(^|\/)package(-lock)?\.json$/, 'package*.json'],
  [/\.config\.[cm]?js$/, '*.config.js'], [/(^|\/)\.env/, '.env*'], [/(^|\/)\.git/, '.git*'], [/(^|\/)\./, 'dotfiles'],
  [/\.md$/i, '*.md'], [/RepairBase/i, 'RepairBase'], [/\.pptx$/i, '*.pptx'], [/\.pdf$/i, '*.pdf'], [/\.py$/, '*.py'],
  [/^Magic_eSIM_/, 'root posters'], [/canary/i, 'canary'], [/story-workspace/, 'story workspace'], [/brand\/source\//, 'logo master'],
];
const forbiddenIn = (paths) => paths.flatMap((p) => FORBIDDEN.filter(([re]) => re.test(p)).map(([, why]) => `${p} (${why})`));

test('negative control: the forbidden list catches every kind of file it exists for, and so does denyReason', () => {
  const samples = ['test/e2e/a.spec.js', 'app/core.test.js', '.claude/skills/x/SKILL.md', '.github/workflows/tests.yml',
    'infra/yandex-api-gateway/README.md', 'scripts/update-catalog-cache.mjs', 'seo/build-all.mjs', 'seo/fact-sheets.json',
    'package.json', 'package-lock.json', 'playwright.config.js', '.env.example', '.gitignore', '.nojekyll',
    'Magic_eSIM_poster_A4_RepairBase10_v2_editable.pptx', 'Magic_eSIM_A4_poster_RepairBase10_print_A4.pdf', 'app/canary.html',
    'assets/story-workspace/compose_story.py', 'assets/brand/source/magic-esim-logo-master.svg', 'node_modules/x/index.js'];
  for (const s of samples) {
    assert.ok(forbiddenIn([s]).length > 0, `forbidden list misses ${s}`);
    assert.ok(denyReason(s), `denyReason misses ${s}`);
    assert.equal(published.has(s), false, `${s} published`);
  }
  // and it does not fire on the site
  assert.deepEqual(forbiddenIn(['index.html', 'esim/italy/index.html', 'assets/site.css', 'app/core.js', 'en/legal-versions.json']), []);
  for (const s of ['index.html', 'assets/site.css', 'app/core.js', 'en/plans.js', 'assets/catalog.json']) assert.equal(denyReason(s), null, s);
});

test('nothing forbidden is in the artifact', () => {
  assert.ok(artifactFiles.length > 1500, `artifact files: ${artifactFiles.length}`);
  assert.deepEqual(forbiddenIn(artifactFiles), []);
  // the artifact is exactly the plan — no stray file
  assert.deepEqual(artifactFiles.slice().sort(), plan.publish.slice().sort());
});

test('the internal files that were public on the branch deployment are excluded by name', () => {
  for (const f of ['.claude', '.github', 'infra', 'scripts', 'seo', 'test']) assert.ok(!existsSync(join(OUT, f)), `${f}/`);
  const named = ['package.json', 'package-lock.json', '.env.example', 'playwright.config.js', '.gitignore', '.gitattributes',
    '.nojekyll', 'app/canary.html', 'app/canary.js', 'app/core.test.js', 'app/i18n.test.js', 'Magic_eSIM_QR_magicesim_store.png',
    'assets/flags/SOURCE.json'];
  for (const f of named) {
    assert.ok(trackedFiles().includes(f), `${f} is tracked (the test checks something)`);
    assert.ok(!inArtifact(f), f);
  }
  assert.deepEqual(artifactFiles.filter((f) => /RepairBase|\.pptx$|\.pdf$/i.test(f)), []);
});

/* ------------------------------------------------------------------------ *
 * (c) a file nobody allowlisted
 * ------------------------------------------------------------------------ */

// What the repository root holds besides the site. A NEW top-level entry fails this test until it is either
// published (ROOT_FILES / a directory rule) or added here — so a page dropped in the root cannot silently stay offline.
const KNOWN_UNPUBLISHED_TOP = new Set(['.claude', '.env.example', '.gitattributes', '.github', '.gitignore', '.nojekyll',
  'infra', 'package-lock.json', 'package.json', 'playwright.config.js', 'scripts', 'seo', 'test',
  'Magic_eSIM_A4_poster_RepairBase10_print_A4.pdf', 'Magic_eSIM_poster_A4_RepairBase10_v2_300dpi.jpg',
  'Magic_eSIM_poster_A4_RepairBase10_v2_300dpi.png', 'Magic_eSIM_poster_A4_RepairBase10_v2_editable.pptx',
  'Magic_eSIM_poster_A4_RepairBase10_v2_print.pdf', 'Magic_eSIM_QR_magicesim_store.png']);

test('negative control + rule: an unknown file in a COPY of the repository is not published; a widened allow rule stops the build', () => {
  const copy = join(TMP, 'repo');
  const files = trackedFiles();
  for (const f of files) {
    const dst = join(copy, ...f.split('/'));
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(join(ROOT, ...f.split('/')), dst);
  }
  const probes = ['notes.txt', 'draft.html', 'secret.json', 'newdir/index.html', 'assets/notes.md', 'assets/tool.py',
    'assets/data.csv', 'esim/italy/data.json', 'en/report.csv', 'app/debug.html', 'app/extra.js', 'es/x.mjs', 'xx/index.html'];
  for (const p of probes) {
    mkdirSync(dirname(join(copy, p)), { recursive: true });
    writeFileSync(join(copy, p), 'probe');
  }
  const p = planArtifact(copy);
  // the probes exist and the planner saw them
  for (const f of probes) assert.ok(p.excluded.includes(f), `${f} is seen and excluded`);
  assert.deepEqual(p.conflicts, []);
  assert.equal(p.publish.length, plan.publish.length, 'the same files as from the repository');
  // a file an allow rule admits but a deny rule forbids stops the build before anything is written
  writeFileSync(join(copy, 'assets', 'evil.test.js'), 'probe');
  writeFileSync(join(copy, 'en', 'notes.config.js'), 'probe');
  const out = join(TMP, 'never');
  assert.throws(() => buildArtifact(copy, out), (e) => e.conflicts.length === 2 && e.conflicts.some((c) => c.startsWith('assets/evil.test.js')));
  assert.equal(existsSync(out), false, 'nothing written');
});

test('negative control: allowRule admits only what a rule names', () => {
  const rules = directoryRules();
  assert.equal(allowRule('index.html', rules), 'root file');
  assert.equal(allowRule('yandex_1a8c23f28d1480df.html', rules), 'verification file');
  assert.equal(allowRule('yandex_x.html', rules), null);
  assert.equal(allowRule('about.html', rules), null);
  assert.equal(allowRule('esim/x/index.html', rules), 'esim/ *.html');
  assert.equal(allowRule('esim/x/data.js', rules), null);
  assert.equal(allowRule('assets/flags/SOURCE.json', rules), null);
  assert.equal(allowRule('app/canary.html', rules), null);
  assert.equal(allowRule('app/ui.js', rules), 'app/ exact file');
  // an unpublished language directory is not published
  assert.equal(allowRule('it/index.html', rules), null);
  assert.equal(allowRule('it/index.html', directoryRules([...prefixedSiteLocales(), { prefix: 'it' }])), 'it/ *.html');
});

test('every top-level entry of the repository is either published or a known non-site entry', () => {
  const publishedTops = new Set(plan.publish.map((f) => f.split('/')[0]));
  const undecidedOf = (list) => list.filter((t) => !publishedTops.has(t) && !KNOWN_UNPUBLISHED_TOP.has(t));
  // negative control: a synthetic new root file and a new directory are caught; a published and a known entry are not
  assert.deepEqual(undecidedOf(['about.html', 'newdir', 'index.html', 'seo']), ['about.html', 'newdir']);
  const tops = [...new Set(trackedFiles().map((f) => f.split('/')[0]))];
  assert.ok(KNOWN_UNPUBLISHED_TOP.size > 10 && publishedTops.size > 20);
  const undecided = undecidedOf(tops);
  assert.deepEqual(undecided, [], 'a new top-level entry: publish it (scripts/build-pages-artifact.mjs) or list it here');
  // and the known list holds no entry that is published after all
  assert.deepEqual([...KNOWN_UNPUBLISHED_TOP].filter((t) => publishedTops.has(t)), []);
});

/* ------------------------------------------------------------------------ *
 * (d) canonical and hreflang targets
 * ------------------------------------------------------------------------ */

test('the canonical and hreflang targets of every built page exist in the artifact', () => {
  const pages = artifactFiles.filter((f) => f.endsWith('.html'));
  let canon = 0;
  let alt = 0;
  const absent = [];
  for (const rel of pages) {
    const html = readFileSync(join(OUT, ...rel.split('/')), 'utf8');
    for (const m of html.matchAll(/<link\b[^>]*\brel=["'](canonical|alternate)["'][^>]*>/gi)) {
      const href = /\bhref=["']([^"']+)["']/i.exec(m[0]);
      if (!href) continue;
      if (m[1].toLowerCase() === 'alternate' && !/hreflang=/i.test(m[0])) continue;
      const t = localTarget(href[1], rel);
      if (!t) continue;
      if (m[1].toLowerCase() === 'canonical') canon += 1; else alt += 1;
      if (!inArtifact(t)) absent.push(`${rel}: ${href[1]}`);
    }
  }
  assert.ok(canon >= 1000, `canonical links checked: ${canon}`);
  assert.ok(alt >= 200, `hreflang links checked: ${alt}`);
  assert.deepEqual(absent, []);
});

/* ------------------------------------------------------------------------ *
 * the workflow
 * ------------------------------------------------------------------------ */

const WF = readFileSync(join(ROOT, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');

test('the deploy workflow builds with this script, deploys only behind the owner variable, and follows the catalogue bot', () => {
  assert.match(WF, /run: node scripts\/build-pages-artifact\.mjs --out _site/);
  assert.match(WF, /uses: actions\/upload-pages-artifact@[0-9a-f]{40} # v\d/);
  assert.match(WF, /\n\s+path: _site\n/);
  // the push trigger cannot see the bot's GITHUB_TOKEN push — workflow_run on its completion does
  assert.match(WF, /\non:\n {2}push:\n {4}branches: \[main\]\n {2}workflow_run:\n {4}workflows: \["Refresh static catalog cache"\]\n {4}types: \[completed\]\n {2}workflow_dispatch:\n/);
  const bot = readFileSync(join(ROOT, '.github', 'workflows', 'refresh-catalog-cache.yml'), 'utf8');
  assert.match(bot, /^name: Refresh static catalog cache$/m, 'the workflow_run name matches the bot');
  assert.match(WF, /github\.event\.workflow_run\.head_branch == 'main' && github\.event\.workflow_run\.head_sha != github\.sha/);
  // deploy is gated and least-privilege
  const deploy = WF.slice(WF.indexOf('\n  deploy:'));
  assert.match(deploy, /if: \$\{\{ vars\.PAGES_ARTIFACT_DEPLOY == 'true' && github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(deploy, /permissions:\n\s+pages: write\n\s+id-token: write\n/);
  assert.match(WF, /\npermissions:\n {2}contents: read\n/);
  // a no-op workflow_run run (bot committed nothing / not main) queues in its own group, never in «pages», so it cannot
  // cancel a pending real deploy; the condition is the exact negation of the build job's `if:`
  const group = /\nconcurrency:\n {2}group: \$\{\{ (.+) \}\}\n {2}cancel-in-progress: false\n/.exec(WF);
  assert.ok(group, 'workflow-level concurrency with an expression group');
  assert.equal(group[1], "(github.event_name == 'workflow_run' && (github.event.workflow_run.head_branch != 'main' || github.event.workflow_run.head_sha == github.sha)) && format('pages-noop-{0}', github.run_id) || 'pages'");
  const buildIf = /\n  build:\n[\s\S]*?if: >-\n\s+(.+)\n\s+(.+)\n/.exec(WF);
  assert.equal(`${buildIf[1]} ${buildIf[2]}`, "github.event_name != 'workflow_run' || (github.event.workflow_run.head_branch == 'main' && github.event.workflow_run.head_sha != github.sha)");
  assert.doesNotMatch(WF, /contents: write|git push/);
});
