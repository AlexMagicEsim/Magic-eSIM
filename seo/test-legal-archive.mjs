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
import { snapshots, problems, archivePath, versionNumber, CURRENT, KINDS, textSha256, VERSIONS_JSON, translationSnapshots, translationProblems, TRANSLATION_CODES } from './legal-archive.mjs';
import { locale } from './locales.mjs';

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

test('every current legal page links the permanent copy of the version it shows — in its own language (LEGAL-8)', () => {
  for (const k of KINDS) {
    for (const code of ['en', ...TRANSLATION_CODES]) {
      const prefix = locale(code).prefix;
      const href = archivePath(k, CURRENT[k].version, code);
      const PAGE = read(`${prefix}/${k}/index.html`);
      assert.match(PAGE, new RegExp(`<p class="lg-meta lg-permanent"><a href="${href.replace(/\./g, '\\.')}"`), `${prefix}/${k}/ → ${href}`);
    }
  }
});

/* LEGAL-8: the frozen translations */
const TSNAPS = translationSnapshots();
test('the translation archive is intact; every current translation is frozen under the current English version', () => {
  assert.deepEqual(translationProblems(), []);
  for (const code of TRANSLATION_CODES) for (const k of KINDS) {
    assert.ok(TSNAPS.some((t) => t.code === code && t.kind === k && versionNumber(t.version) === versionNumber(CURRENT[k].version)), `${code} ${k}`);
  }
  const t = TSNAPS[0];
  const edited = { ...t, sections: t.sections.map((x, i) => (i ? x : { ...x, html: `${x.html} ` })) };
  assert.ok(translationProblems([...TSNAPS.filter((x) => x !== t), edited]).some((p) => /never edited/.test(p)), 'the check fires');
});
for (const t of TSNAPS) {
  const rel = `${archivePath(t.kind, t.version, t.code).slice(1)}index.html`;
  test(`${rel}: the frozen translation, its own language, noindex, its own canonical, the English copy linked`, () => {
    const PAGE = read(rel);
    const L = locale(t.code);
    assert.match(PAGE, new RegExp(`^<!doctype html>\n<html lang="${L.htmlLang}">`));
    assert.ok(PAGE.includes(`<link rel="canonical" href="https://magicesim.store${archivePath(t.kind, t.version, t.code)}">`));
    assert.ok(PAGE.includes('<meta name="robots" content="noindex, follow">'));
    assert.ok(PAGE.includes('class="lg-meta lg-archived"'));
    assert.ok(PAGE.includes(`href="${archivePath(t.kind, t.version)}" hreflang="en"`), 'the English copy of the same version');
    for (const x of t.sections) assert.ok(PAGE.includes(x.html.replace(/^\n/, '').replace(/\s+$/, '')), `${x.id}: verbatim`);
    assert.ok(!read('sitemap.xml').includes(archivePath(t.kind, t.version, t.code)), 'not in the sitemap');
  });
}

test('/en/legal-versions.json lists exactly the frozen versions, one current per document', () => {
  const J = JSON.parse(read(VERSIONS_JSON));
  assert.deepEqual(J.documents.map((d) => [d.document, d.version, d.sha256]), SNAPS.map((s) => [s.kind, s.version, s.sha256]));
  for (const k of KINDS) {
    const cur = J.documents.filter((d) => d.document === k && d.current);
    assert.equal(cur.length, 1, `${k}: one current version`);
    assert.equal(cur[0].version, CURRENT[k].version);
    assert.equal(cur[0].url, `https://magicesim.store${archivePath(k, CURRENT[k].version)}`);
    for (const code of TRANSLATION_CODES) {
      assert.equal(cur[0].translations[code], `https://magicesim.store${archivePath(k, CURRENT[k].version, code)}`, `${k} ${code}`);
    }
  }
});
