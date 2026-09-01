// One way for a country page to exist. Exactly one.
//
// WHY
//
//   Until 2026-09-01 there were two. `build-catalogue-pages.mjs` built 192 pages
//   from `seo/content-profiles/*.json`, and `build-country-pages.mjs` built six
//   from a second copy of the text inside `seo/countries.mjs`. The second
//   generator was not called by `build-all.mjs`, so nobody regenerated those
//   pages — and both editorial gates glob the profiles directory, so nobody
//   checked them either. What accumulated there:
//
//     * «5–8 ГБ» recommended on four pages, twice each (visible FAQ and FAQPage
//       schema). No country in the catalogue sells 8 ГБ;
//     * a categorical «срок отсчитывается с первого подключения» on a page
//       rendering four packages whose validity starts at installation;
//     * six pages 48–59 % identical to each other, five of six FAQ answers
//       restating a guide they already link;
//     * and, decisively, DRIFT: a fix landed in esim/malaysia/index.html while
//       seo/countries.mjs kept the defective sentence. Two sources of truth for
//       one page, already disagreeing.
//
//   The six are profiles now and the second generator is deleted. This file is
//   what stops the arrangement coming back — because it came back once before:
//   handoff §23.4 records the same shape of trap, where a storefront-wide change
//   reported 191 pages and the other twelve silently kept the old sentence.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL } from './countries.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILES = new Set(readdirSync(join(ROOT, 'seo/content-profiles'))
  .filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')));

test('the legacy generator is gone and has not come back', () => {
  assert.ok(!existsSync(join(ROOT, 'seo/build-country-pages.mjs')),
    'seo/build-country-pages.mjs воскрес — второй путь генерации страниц запрещён');
});

// Both checks below run the generators in a TEMP COPY of the repo, never in
// place. The first version ran them here — which (a) judged each generator
// against a tree an earlier generator in the same loop had already changed, so
// the blame landed on whoever ran last, and (b) mutated the working tree
// concurrently with seo/test-sitemap-lastmod.mjs, because `node --test` runs
// FILES in parallel. That is the same race this repo has now hit twice; the fix
// is not another file, it is not touching the shared tree at all.
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'pipeline-'));
  // --others --exclude-standard as well: a new profile is untracked until it is
  // committed, and a sandbox without it makes the build fail for the wrong reason.
  execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'buffer' })
    .toString('utf8').split('\0').filter(Boolean)
    .forEach((rel) => {
      const dst = join(dir, rel);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(join(ROOT, rel), dst);
    });
  return dir;
}
const countryPages = (root) => readdirSync(join(root, 'esim'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(root, 'esim', d.name, 'index.html'))
  .filter((f) => existsSync(f) && /id="localGrid"/.test(readFileSync(f, 'utf8')));

test('exactly one generator writes country pages — proven by running them', () => {
  // The first version of this test matched SOURCE TEXT for `join(…, 'esim', …)`
  // plus `writeFileSync`, in files named build-*.mjs, in seo/ only. A review
  // walked past it four ways out of five — including the template-literal style
  // `join(ROOT, \`esim/${slug}/index.html\`)` that build-guides.mjs and
  // build-hub.mjs already use. A regex over source was never going to hold.
  const dir = sandbox();
  try {
    const before = new Map(countryPages(dir).map((f) => [f, readFileSync(f, 'utf8')]));
    const culprits = [];
    for (const f of readdirSync(join(dir, 'seo'))
      .filter((x) => x.endsWith('.mjs') && x.startsWith('build-'))
      .filter((x) => x !== 'build-catalogue-pages.mjs' && x !== 'build-all.mjs')) {
      execFileSync('node', [`seo/${f}`], { cwd: dir, stdio: 'pipe' });
      for (const [file, body] of before) {
        if (readFileSync(file, 'utf8') !== body) {
          culprits.push(`${f} переписал ${file.slice(dir.length + 1)}`);
          writeFileSync(file, body);   // судим каждый генератор отдельно
        }
      }
    }
    assert.deepEqual(culprits, [], `страницы стран пишет не только build-catalogue-pages.mjs:\n${culprits.join('\n')}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the committed HTML is exactly what the generator produces', () => {
  // The defect that motivated the migration was DRIFT: a fix landed in
  // esim/malaysia/index.html while seo/countries.mjs kept the old sentence. This
  // makes a hand edit to the OUTPUT visible too, which nothing checked before.
  const dir = sandbox();
  try {
    const before = new Map(countryPages(dir).map((f) => [f, readFileSync(f, 'utf8')]));
    execFileSync('node', ['seo/build-catalogue-pages.mjs'], { cwd: dir, stdio: 'pipe' });
    execFileSync('node', ['seo/stamp-assets.mjs'], { cwd: dir, stdio: 'pipe' });
    const drifted = [...before].filter(([f, body]) => readFileSync(f, 'utf8') !== body)
      .map(([f]) => f.slice(dir.length + 1));
    assert.deepEqual(drifted, [], `страницы правились руками — пересборка их меняет:\n${drifted.join('\n')}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the suite still runs its files one at a time', () => {
  // seo/test-sitemap-lastmod.mjs mutates the real working tree and restores it.
  // The two sandbox() calls in this file copy that tree. Run in parallel — which
  // is `node --test`'s default — the copy can catch the other file mid-restore
  // and this file goes red on a page nobody touched, about one run in six.
  // The flag is the fix; this assertion is what stops it being dropped.
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.test, /--test-concurrency=1/,
    'npm test потерял --test-concurrency=1: этот файл и seo/test-sitemap-lastmod.mjs снова гонятся за одно дерево');
});

test('every editorial country has a profile — no page may bypass the gates', () => {
  const orphan = ALL.map((c) => c.slug).filter((s) => !PROFILES.has(s));
  assert.deepEqual(orphan, [],
    `у этих стран есть запись в seo/countries.mjs, но нет профиля: ${orphan.join(', ')}`);
});

test('countries.mjs carries identity only — page text lives in profiles', () => {
  // The second copy of the text is what drifted. Keeping the file to slug, ISO,
  // flag and the Russian case forms means there is nothing left to drift.
  // An ALLOWLIST, not a denylist. A denylist of eight field names is defeated by
  // renaming one — `pageTitle` instead of `title` and the text is back.
  const ALLOWED = new Set(['slug', 'iso', 'flagImg', 'flagEmoji', 'nameRu', 'nameGen', 'namePrep', 'nameAcc']);
  for (const c of ALL) {
    const extra = Object.keys(c).filter((k) => !ALLOWED.has(k));
    assert.deepEqual(extra, [], `seo/countries.mjs снова несёт что-то кроме идентичности: ${c.slug}.${extra.join(', ')}`);
  }
});

test('every country page on disk was produced by the profile pipeline', () => {
  // The rendered signature of build-catalogue-pages.mjs: a why-cards block, a
  // <summary> FAQ and a single @graph JSON-LD. The legacy generator emitted
  // faq-q spans and three separate JSON-LD blocks, so a page built the old way
  // is recognisable without keeping a list of slugs.
  const dirs = readdirSync(join(ROOT, 'esim'), { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name);
  const bad = [];
  for (const slug of dirs) {
    const file = join(ROOT, 'esim', slug, 'index.html');
    if (!existsSync(file)) continue;
    const html = readFileSync(file, 'utf8');
    if (!/id="localGrid"/.test(html)) continue;          // не страновая страница
    const ld = (html.match(/application\/ld\+json/g) || []).length;
    if (/class="faq-q"/.test(html) || ld > 1) bad.push(`${slug} (ld+json ×${ld})`);
  }
  assert.deepEqual(bad, [], `страницы собраны не тем генератором: ${bad.join(', ')}`);
});
