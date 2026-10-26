// LEGAL-5 — the permanent copies of the international legal documents (seo/legal-archive.mjs). Pinned:
//   1. every frozen version is intact (its text matches its own SHA-256) and every CURRENT English text is frozen under its
//      own version — a wording change without a new version number fails here;
//   2. each frozen version is published at /en/<kind>/v<number>/: English, noindex, its own canonical, the archived text
//      word for word, a link back to the current version, no script but the logo's;
//   3. every current legal page (EN and its translations) links the permanent copy of the version it shows;
//   4. /en/legal-versions.json lists exactly the frozen versions, one current per document, with the same hashes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshots, problems, archivePath, versionNumber, CURRENT, KINDS, textSha256, VERSIONS_JSON } from './legal-archive.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const SNAPS = snapshots();

test('the archive is intact and every current text is frozen under its own version', () => {
  assert.deepEqual(problems(), []);
  for (const k of KINDS) assert.ok(SNAPS.some((s) => s.kind === k), `${k}: at least one frozen version`);
});

test('the check fires: an edited snapshot, and a current text changed under the same version', () => {
  const s = SNAPS.find((x) => x.kind === 'refund');
  const edited = { ...s, sections: s.sections.map((x, i) => (i ? x : { ...x, html: `${x.html} ` })) };
  assert.ok(problems([...SNAPS.filter((x) => x !== s), edited]).some((p) => /never edited/.test(p)), 'an edited snapshot');
  const cur = SNAPS.find((x) => x.kind === 'terms' && versionNumber(x.version) === versionNumber(CURRENT.terms.version));
  const stale = { ...cur, sha256: textSha256({ ...cur, D: { ...cur, title: `${cur.title}!` } }), title: `${cur.title}!` };
  assert.ok(problems([...SNAPS.filter((x) => x !== cur), stale]).some((p) => /needs a new version number/.test(p)), 'a changed current text');
});

for (const s of SNAPS) {
  const rel = `${archivePath(s.kind, s.version).slice(1)}index.html`;
  test(`${rel}: the frozen text, word for word, English, noindex, its own canonical, a way to the current version`, () => {
    assert.ok(existsSync(join(ROOT, rel)), `${rel} is built`);
    const PAGE = read(rel);
    const head = PAGE.slice(0, PAGE.indexOf('</head>'));
    assert.match(PAGE, /^<!doctype html>\n<html lang="en">/);
    assert.ok(head.includes(`<link rel="canonical" href="https://magicesim.store${archivePath(s.kind, s.version)}">`));
    assert.ok(head.includes('<meta name="robots" content="noindex, follow">'));
    assert.match(head, /connect-src 'none'/);
    const scripts = [...PAGE.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(scripts.every((x) => /src="\/assets\/logo-once\.js/.test(x)), 'only the logo script');
    assert.ok(PAGE.includes(`Version ${s.version} · Effective date: <time datetime="${s.effectiveIso}">${s.effective}</time>`));
    assert.ok(PAGE.includes(`kept unchanged at this address. The current version is always at <a href="${CURRENT[s.kind].path}">`));
    for (const x of s.sections) {
      assert.ok(PAGE.includes(`<h2 id="${x.id}-h">${x.h2.replace(/&/g, '&amp;')}</h2>`) || PAGE.includes(`<h2 id="${x.id}-h">${x.h2}</h2>`), `${x.id}: heading`);
      assert.ok(PAGE.includes(x.html.replace(/^\n/, '').replace(/\s+$/, '')), `${x.id}: the archived text, verbatim`);
    }
    assert.ok(!read('sitemap.xml').includes(archivePath(s.kind, s.version)), 'not in the sitemap');
  });
}

test('every current legal page links the permanent copy of the version it shows', () => {
  const pages = { en: 'en', es: 'es', de: 'de', fr: 'fr', zh: 'zh', ko: 'ko' };
  for (const k of KINDS) {
    const href = archivePath(k, CURRENT[k].version);
    for (const prefix of Object.values(pages)) {
      const PAGE = read(`${prefix}/${k}/index.html`);
      assert.match(PAGE, new RegExp(`<p class="lg-meta lg-permanent"><a href="${href.replace(/\./g, '\\.')}"`), `${prefix}/${k}/`);
    }
  }
});

test('/en/legal-versions.json lists exactly the frozen versions, one current per document', () => {
  const J = JSON.parse(read(VERSIONS_JSON));
  assert.deepEqual(J.documents.map((d) => [d.document, d.version, d.sha256]), SNAPS.map((s) => [s.kind, s.version, s.sha256]));
  for (const k of KINDS) {
    const cur = J.documents.filter((d) => d.document === k && d.current);
    assert.equal(cur.length, 1, `${k}: one current version`);
    assert.equal(cur[0].version, CURRENT[k].version);
    assert.equal(cur[0].url, `https://magicesim.store${archivePath(k, CURRENT[k].version)}`);
  }
});
