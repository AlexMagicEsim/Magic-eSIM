// R3-12 (2026-10-11) — the workflows of a PUBLIC repository whose main is
// published by Pages on every push.
//
// The catalogue bot (refresh-catalog-cache.yml) pushes to main six times a day
// with `contents: write`. Before R3-12 it ran actions by mutable TAG
// (`actions/checkout@v4`) and checkout left the write token in .git/config for
// every later step: a repointed tag would have been able to publish to
// magicesim.store. These checks keep that from coming back, for every workflow
// in .github/workflows — including ones added later:
//
//   1. every `uses:` is an actions/* action pinned to a 40-hex commit, with the
//      version in a comment (so «require SHA pinning» and «GitHub-owned actions
//      only» can stay switched on for the repository);
//   2. every workflow declares top-level `permissions:` (the repository default
//      must never decide what a workflow may do);
//   3. a workflow that can write has no checkout that persists credentials, and
//      every `git push` in it carries the token explicitly — the credential lives
//      in one command, not in the job;
//   4. the token is never put in the environment of a whole job or workflow;
//   5. a workflow that runs the browser suite installs every engine playwright.config.js uses.
//
// Each rule's FIRST test proves it fires, on the pre-R3-12 text of the bot.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WF_DIR = join(ROOT, '.github', 'workflows');
const workflows = readdirSync(WF_DIR).filter((f) => /\.ya?ml$/.test(f)).map((f) => ({ name: f, text: readFileSync(join(WF_DIR, f), 'utf8') }));

const code = (text) => text.split('\n').filter((l) => !/^\s*#/.test(l));

export function unpinnedUses(text) {
  const bad = [];
  for (const line of code(text)) {
    const m = /^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/.exec(line);
    if (!m) continue;
    const [, ref, rest] = m;
    if (!/^actions\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/.test(ref) || !/#\s*v\d+/.test(rest)) bad.push(ref);
  }
  return bad;
}

export function hasTopLevelPermissions(text) {
  return code(text).some((l) => /^permissions:/.test(l));
}

export function canWrite(text) {
  return code(text).some((l) => /^\s*(contents|pull-requests|actions|packages|deployments|pages|id-token):\s*write\b/.test(l) || /^permissions:\s*write-all/.test(l));
}

/** checkout steps without `persist-credentials: false` in their own `with:` block. */
export function persistingCheckouts(text) {
  const lines = code(text);
  const bad = [];
  lines.forEach((line, i) => {
    const m = /^(\s*)-\s+uses:\s*actions\/checkout@/.exec(line);
    if (!m) return;
    const indent = m[1].length;
    let ok = false;
    for (let j = i + 1; j < lines.length; j += 1) {
      const l = lines[j];
      if (!l.trim()) continue;
      const ind = l.length - l.trimStart().length;
      if (ind <= indent) break; // next step or end of steps
      if (/^\s*persist-credentials:\s*false\s*$/.test(l)) ok = true;
    }
    if (!ok) bad.push(i + 1);
  });
  return bad;
}

/** `git push` commands that rely on a credential stored somewhere else. */
export function implicitPushes(text) {
  return code(text).filter((l) => /\bgit push\b/.test(l) && !/x-access-token:\$GH_TOKEN@github\.com/.test(l));
}

/** GH_TOKEN / GITHUB_TOKEN given to a whole workflow or job instead of one step. */
export function broadTokenEnv(text) {
  return code(text).filter((l) => /^\s{0,6}(GH_TOKEN|GITHUB_TOKEN):/.test(l));
}

// The bot as it was before R3-12 (the relevant lines, verbatim).
const OLD_BOT = `on:
  schedule:
    - cron: "20 0 * * *"
permissions:
  contents: write
jobs:
  refresh:
    runs-on: ubuntu-latest
    env:
      GH_TOKEN: \${{ github.token }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Commit if changed
        run: |
          git add assets/catalog.json
          git commit -m "chore: refresh static catalog cache"
          git push
`;

test('negative control: every rule fires on the pre-R3-12 bot', () => {
  assert.deepEqual(unpinnedUses(OLD_BOT), ['actions/checkout@v4', 'actions/setup-node@v4']);
  assert.equal(canWrite(OLD_BOT), true);
  assert.equal(persistingCheckouts(OLD_BOT).length, 1);
  assert.equal(implicitPushes(OLD_BOT).length, 1);
  assert.equal(broadTokenEnv(OLD_BOT).length, 1, 'job-level GH_TOKEN');
  assert.equal(hasTopLevelPermissions('on: push\njobs: {}\n'), false);
  // pinned but without the version comment, a third-party owner, a short sha
  assert.deepEqual(unpinnedUses([
    '      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
    '      - uses: someone/thing@11d5960a326750d5838078e36cf38b85af677262 # v1',
    '      - uses: actions/checkout@11d5960 # v4',
  ].join('\n')).length, 3);
  // a commented-out line is not a step
  assert.deepEqual(unpinnedUses('      # - uses: actions/checkout@v4\n'), []);
});

test('every workflow pins every action to a commit of a GitHub-owned action', () => {
  assert.ok(workflows.length >= 3, `workflows found: ${workflows.length}`);
  for (const w of workflows) assert.deepEqual(unpinnedUses(w.text), [], `${w.name}: unpinned uses`);
  // and there is something to check in each of them
  for (const w of workflows) assert.ok(/uses:\s*actions\/checkout@[0-9a-f]{40}/.test(w.text), `${w.name}: checks out by commit`);
});

test('every workflow declares its own top-level permissions', () => {
  for (const w of workflows) assert.ok(hasTopLevelPermissions(w.text), `${w.name}: no top-level permissions`);
});

test('a workflow that can write never persists credentials and pushes only with an explicit, step-scoped token', () => {
  const writers = workflows.filter((w) => canWrite(w.text)).map((w) => w.name).sort();
  assert.deepEqual(writers, ['refresh-catalog-cache.yml', 'seo-refresh-pr.yml']);
  for (const w of workflows.filter((x) => canWrite(x.text))) {
    assert.deepEqual(persistingCheckouts(w.text), [], `${w.name}: checkout persists credentials`);
    assert.deepEqual(implicitPushes(w.text), [], `${w.name}: git push without an explicit credential`);
  }
  for (const w of workflows) assert.deepEqual(broadTokenEnv(w.text), [], `${w.name}: token in a job or workflow env`);
});

test('the catalogue bot pushes to the ref it was started on, with the token only in that step', () => {
  const bot = workflows.find((w) => w.name === 'refresh-catalog-cache.yml').text;
  assert.match(bot, /git push "https:\/\/x-access-token:\$GH_TOKEN@github\.com\/\$\{GITHUB_REPOSITORY\}\.git" "HEAD:\$\{GITHUB_REF\}"/);
  const step = bot.slice(bot.indexOf('- name: Commit if changed'));
  assert.match(step, /^\s+env:\n\s+GH_TOKEN: \$\{\{ github\.token \}\}\n\s+run: \|/m);
  assert.equal((bot.match(/GH_TOKEN: \$\{\{ github\.token \}\}/g) || []).length, 1, 'one step holds the token');
  assert.match(bot, /persist-credentials: false/);
});

// Runner image (2026-10-14). `ubuntu-latest` moves to Ubuntu 26 from 2026-10-19
// (actions/runner-images#14748) — an OS change under every job on a date nobody
// chose. Every job names its image instead, so moving to a new Ubuntu is a
// deliberate edit, proved on a branch first.
const PINNED_IMAGE = /^ubuntu-\d{2}\.\d{2}$/;
const runsOn = (text) => code(text).map((l) => /^\s*runs-on:\s*(\S+)/.exec(l)).filter(Boolean).map((m) => m[1]);

test('negative control: a moving runner label is caught, a commented one is not', () => {
  const sample = '    runs-on: ubuntu-latest\n    # runs-on: ubuntu-latest\n    runs-on: ubuntu-24.04\n    runs-on: ubuntu-22.04';
  assert.deepEqual(runsOn(sample).filter((x) => !PINNED_IMAGE.test(x)), ['ubuntu-latest']);
});

test('every job runs on a named Ubuntu image, never ubuntu-latest', () => {
  for (const w of workflows) {
    const images = runsOn(w.text);
    assert.ok(images.length > 0, `${w.name}: no runs-on found`);
    assert.deepEqual(images.filter((x) => !PINNED_IMAGE.test(x)), [], `${w.name}: unpinned runner`);
  }
});

// 5. A workflow that runs the browser suite installs every engine the suite needs. The SEO refresh installed only
// chromium after #101 added the webkit-flags project, and every refresh stopped at «Проверки — браузер» with
// «Executable doesn't exist … webkit» (2026-10-20, run 39372551147) while tests.yml, which installs both, stayed green.
const require = createRequire(import.meta.url);
function configEngines() {
  const cfg = require(join(ROOT, 'playwright.config.js'));
  return [...new Set((cfg.projects || []).map((p) => p.use?.browserName || p.use?.defaultBrowserType || 'chromium'))].sort();
}
function installGaps(text) {
  if (!/npx playwright test(?![^\n]*--project)/.test(text)) return null;
  const installed = new Set([...text.matchAll(/npx playwright install\b([^\n]*)/g)].flatMap((m) => m[1].split(/\s+/).filter((w) => w && !w.startsWith('-'))));
  return configEngines().filter((e) => !installed.has(e));
}

test('negative control: a workflow that runs every project but installs only chromium is caught', () => {
  assert.ok(configEngines().includes('webkit'), 'the config has a WebKit project');
  const before = 'run: |\n  npm ci\n  npx playwright install --with-deps chromium\n- run: npx playwright test\n';
  assert.deepEqual(installGaps(before), ['webkit']);
});

test('every workflow that runs the browser suite installs every engine of playwright.config.js', () => {
  let seen = 0;
  for (const f of readdirSync(WF_DIR).filter((x) => /\.ya?ml$/.test(x))) {
    const gaps = installGaps(readFileSync(join(WF_DIR, f), 'utf8'));
    if (gaps === null) continue;
    seen += 1;
    assert.deepEqual(gaps, [], `${f} runs \`npx playwright test\` without installing ${gaps.join(', ')}`);
  }
  assert.ok(seen >= 2, 'tests.yml and seo-refresh-pr.yml both run the suite');
});
