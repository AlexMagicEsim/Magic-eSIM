#!/usr/bin/env node
// LEGAL-5 — every published version of the three international legal documents is kept, word for word, at its own
// permanent address (Terms §5.5 and §15: a buyer must be able to keep and later recover the version accepted at checkout).
//
// THE ARCHIVE IS THE RECORD. seo/legal-archive/<kind>-<version>.json is a frozen copy of the ENGLISH text of one version
// (the master; the translations are for convenience, Terms §5.6) with the SHA-256 of that text. It is written ONCE, by
// `--freeze`, and never rewritten: a snapshot whose text no longer matches its own hash fails seo/test-legal-archive.mjs,
// and so does a current document whose text differs from the snapshot of its own version — a wording change must come
// with a new version number (and a new effective date), never under the old one.
//
// What the build makes of it (seo/build-locale-pages.mjs, English only):
//   /en/<kind>/v<number>/   one page per frozen version, in the frame of the current legal page, with a notice that it is
//                           an archived version and a link to the current one; noindex, follow; no script but the logo's;
//   /en/legal-versions.json the public list: document, version, effective date, permanent URL, text SHA-256, current.
// The current page (/en/<kind>/ and its translations) links the permanent copy of its own version.
//
//   node seo/legal-archive.mjs --freeze   write the snapshot of every current version that has none (refuses to overwrite)
//   node seo/legal-archive.mjs --check    exit 1 if a snapshot is damaged or a current text has no matching snapshot
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TERMS, TERMS_VERSION, TERMS_EFFECTIVE, TERMS_EFFECTIVE_ISO } from './terms-en.mjs';
import { REFUND, REFUND_VERSION, REFUND_EFFECTIVE, REFUND_EFFECTIVE_ISO } from './refund-en.mjs';
import { PRIVACY, PRIVACY_VERSION, PRIVACY_EFFECTIVE, PRIVACY_EFFECTIVE_ISO } from './privacy-en.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARCHIVE_DIR = join(ROOT, 'seo', 'legal-archive');
export const VERSIONS_JSON = 'en/legal-versions.json';
const SITE = 'https://magicesim.store';

export const KINDS = Object.freeze(['terms', 'refund', 'privacy']);

/** The current English documents. */
export const CURRENT = Object.freeze({
  terms: { D: TERMS, version: TERMS_VERSION, effective: TERMS_EFFECTIVE, effectiveIso: TERMS_EFFECTIVE_ISO, path: '/en/terms/' },
  refund: { D: REFUND, version: REFUND_VERSION, effective: REFUND_EFFECTIVE, effectiveIso: REFUND_EFFECTIVE_ISO, path: '/en/refund/' },
  privacy: { D: PRIVACY, version: PRIVACY_VERSION, effective: PRIVACY_EFFECTIVE, effectiveIso: PRIVACY_EFFECTIVE_ISO, path: '/en/privacy/' },
});

/** «0.9.1 (pre-launch)» → «0.9.1»: the number that names the permanent address. */
export function versionNumber(version) {
  const m = /^(\d+(?:\.\d+){1,3})(?:\s|$)/.exec(String(version));
  if (!m) throw new Error(`legal-archive: «${version}» does not start with a version number`);
  return m[1];
}

/** The permanent path of one version of one document. */
export const archivePath = (kind, version) => `/en/${kind}/v${versionNumber(version)}/`;

/** Exactly what a version consists of: the words a reader sees, and nothing of the page frame. */
export function textOf({ kind, version, effective, effectiveIso, D }) {
  return {
    kind, version, effective, effectiveIso,
    title: D.title, description: D.description, h1: D.h1, lead: D.lead, crumb: D.crumb,
    sections: D.sections.map((s) => ({ id: s.id, h2: s.h2, html: s.html })),
  };
}

/** SHA-256 of a version's text (the canonical JSON above, in that key order). */
export const textSha256 = (t) => createHash('sha256').update(JSON.stringify(textOf({ ...t, D: t.D || t }))).digest('hex');

const fileOf = (kind, version) => join(ARCHIVE_DIR, `${kind}-${versionNumber(version)}.json`);

/** Every frozen version, sorted by document and version number. */
export function snapshots() {
  if (!existsSync(ARCHIVE_DIR)) return [];
  const num = (v) => versionNumber(v).split('.').map(Number);
  const cmp = (a, b) => { const x = num(a); const y = num(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
  return readdirSync(ARCHIVE_DIR).filter((n) => n.endsWith('.json')).map((n) => {
    const s = JSON.parse(readFileSync(join(ARCHIVE_DIR, n), 'utf8'));
    return { ...s, file: n };
  }).sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || cmp(a.version, b.version));
}

/** Everything wrong with the archive: [] when every snapshot is intact and every current text is frozen under its version. */
export function problems(list = snapshots()) {
  const out = [];
  for (const s of list) {
    if (!KINDS.includes(s.kind)) { out.push(`${s.file}: unknown document «${s.kind}»`); continue; }
    if (s.file !== `${s.kind}-${versionNumber(s.version)}.json`) out.push(`${s.file}: the file name does not match ${s.kind} ${s.version}`);
    const t = { kind: s.kind, version: s.version, effective: s.effective, effectiveIso: s.effectiveIso, D: s };
    if (textSha256(t) !== s.sha256) out.push(`${s.file}: the text no longer matches its SHA-256 — an archived version is never edited`);
  }
  for (const kind of KINDS) {
    const c = CURRENT[kind];
    const s = list.find((x) => x.kind === kind && versionNumber(x.version) === versionNumber(c.version));
    if (!s) { out.push(`${kind} ${c.version}: not frozen — run node seo/legal-archive.mjs --freeze`); continue; }
    if (textSha256({ kind, ...c }) !== s.sha256) {
      out.push(`${kind} ${c.version}: the text differs from the frozen copy of this version — a changed text needs a new version number and effective date`);
    }
  }
  return out;
}

/** Freeze every current version that has no snapshot yet. Never overwrites one. */
export function freeze() {
  mkdirSync(ARCHIVE_DIR, { recursive: true });
  const written = [];
  for (const kind of KINDS) {
    const c = CURRENT[kind];
    const f = fileOf(kind, c.version);
    if (existsSync(f)) continue;
    const t = textOf({ kind, ...c });
    writeFileSync(f, `${JSON.stringify({ ...t, sha256: textSha256({ kind, ...c }) }, null, 2)}\n`);
    written.push(f);
  }
  return written;
}

/** The public list of versions (written to /en/legal-versions.json by the English build). */
export function versionsJson(list = snapshots()) {
  const rows = list.map((s) => ({
    document: s.kind,
    version: s.version,
    effective_date: s.effectiveIso,
    url: `${SITE}${archivePath(s.kind, s.version)}`,
    sha256: s.sha256,
    current: versionNumber(s.version) === versionNumber(CURRENT[s.kind].version),
  }));
  return `${JSON.stringify({ language: 'en', note: 'Each version of the Magic eSIM international legal documents, at its permanent address. The English text is the master version.', documents: rows }, null, 2)}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const arg = process.argv[2];
  if (arg === '--freeze') {
    const w = freeze();
    console.log(w.length ? w.map((f) => `frozen ${f.slice(ROOT.length + 1)}`).join('\n') : 'nothing to freeze');
    const p = problems();
    if (p.length) { console.error(p.join('\n')); process.exit(1); }
  } else if (arg === '--check') {
    const p = problems();
    if (p.length) { console.error(p.join('\n')); process.exit(1); }
    console.log(`legal archive: ${snapshots().length} versions intact; every current text frozen`);
  } else {
    console.error('usage: node seo/legal-archive.mjs --freeze | --check');
    process.exit(2);
  }
}
