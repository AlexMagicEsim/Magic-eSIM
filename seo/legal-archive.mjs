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
// LEGAL-8: the TRANSLATIONS are frozen too — seo/legal-archive/<code>/<kind>-<version>.json, the translated text of the
// English version it follows — and published at /<prefix>/<kind>/v<number>/, so an order placed in Spanish can link the
// Spanish wording it was shown. A translation snapshot is written only while the translation is current (its section
// hashes match that English version); the same immutability checks apply.
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
import { LEGAL_TRANSLATIONS, staleness } from './legal-i18n.mjs';
import { locale } from './locales.mjs';

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

/** The permanent path of one version of one document (English, or the translation in `code`). */
export const archivePath = (kind, version, code = 'en') => `/${locale(code).prefix}/${kind}/v${versionNumber(version)}/`;

/** The translation languages (seo/legal-i18n.mjs). */
export const TRANSLATION_CODES = Object.freeze(Object.keys(LEGAL_TRANSLATIONS));

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

const tFileOf = (code, kind, version) => join(ARCHIVE_DIR, code, `${kind}-${versionNumber(version)}.json`);

/** The translated text of one document, as frozen: the words a reader sees. */
function tTextOf(code, kind, T, version) {
  const D = T[kind];
  return { code, kind, version, title: D.title, description: D.description, h1: D.h1, lead: D.lead, crumb: D.crumb,
    sections: D.sections.map((x) => ({ id: x.id, h2: x.h2, html: x.html })) };
}
const tSha = (t) => createHash('sha256').update(JSON.stringify({ code: t.code, kind: t.kind, version: t.version, title: t.title,
  description: t.description, h1: t.h1, lead: t.lead, crumb: t.crumb, sections: t.sections.map((x) => ({ id: x.id, h2: x.h2, html: x.html })) })).digest('hex');

/** Every frozen translation: [{ code, kind, version, …, sha256, file }]. */
export function translationSnapshots() {
  const out = [];
  for (const code of TRANSLATION_CODES) {
    const dir = join(ARCHIVE_DIR, code);
    if (!existsSync(dir)) continue;
    for (const n of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      out.push({ ...JSON.parse(readFileSync(join(dir, n), 'utf8')), file: `${code}/${n}` });
    }
  }
  return out;
}

/** The frozen translation of one version, or null. */
export function translationSnapshot(code, kind, version) {
  const f = tFileOf(code, kind, version);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

/** Everything wrong with the translation archive. A current translation must be frozen under the current English version. */
export function translationProblems(list = translationSnapshots()) {
  const out = [];
  for (const t of list) {
    if (t.file !== `${t.code}/${t.kind}-${versionNumber(t.version)}.json`) out.push(`${t.file}: the file name does not match`);
    if (tSha(t) !== t.sha256) out.push(`${t.file}: the text no longer matches its SHA-256 — an archived translation is never edited`);
  }
  for (const code of TRANSLATION_CODES) {
    const stale = new Set(staleness(code).map((x) => x.kind));
    for (const kind of KINDS) {
      if (stale.has(kind)) continue;
      const v = CURRENT[kind].version;
      const t = list.find((x) => x.code === code && x.kind === kind && versionNumber(x.version) === versionNumber(v));
      if (!t) { out.push(`${code} ${kind} ${v}: the current translation is not frozen — run node seo/legal-archive.mjs --freeze`); continue; }
      if (tSha(tTextOf(code, kind, LEGAL_TRANSLATIONS[code], v)) !== t.sha256) {
        out.push(`${code} ${kind} ${v}: the translation differs from its frozen copy — a changed translation needs a new English version`);
      }
    }
  }
  return out;
}

/** Freeze every current, non-stale translation that has no snapshot yet. */
export function freezeTranslations() {
  const written = [];
  for (const code of TRANSLATION_CODES) {
    const stale = new Set(staleness(code).map((x) => x.kind));
    for (const kind of KINDS) {
      if (stale.has(kind)) continue;
      const v = CURRENT[kind].version;
      const f = tFileOf(code, kind, v);
      if (existsSync(f)) continue;
      mkdirSync(join(ARCHIVE_DIR, code), { recursive: true });
      const t = tTextOf(code, kind, LEGAL_TRANSLATIONS[code], v);
      writeFileSync(f, `${JSON.stringify({ ...t, sha256: tSha(t) }, null, 2)}\n`);
      written.push(f);
    }
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
    // LEGAL-8: the frozen translations of this version, by language code → permanent URL.
    translations: Object.fromEntries(translationSnapshots()
      .filter((t) => t.kind === s.kind && versionNumber(t.version) === versionNumber(s.version))
      .map((t) => [t.code, `${SITE}${archivePath(t.kind, t.version, t.code)}`])),
  }));
  return `${JSON.stringify({ language: 'en', note: 'Each version of the Magic eSIM international legal documents, at its permanent address. The English text is the master version.', documents: rows }, null, 2)}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const arg = process.argv[2];
  if (arg === '--freeze') {
    const w = [...freeze(), ...freezeTranslations()];
    console.log(w.length ? w.map((f) => `frozen ${f.slice(ROOT.length + 1)}`).join('\n') : 'nothing to freeze');
    const p = [...problems(), ...translationProblems()];
    if (p.length) { console.error(p.join('\n')); process.exit(1); }
  } else if (arg === '--check') {
    const p = [...problems(), ...translationProblems()];
    if (p.length) { console.error(p.join('\n')); process.exit(1); }
    console.log(`legal archive: ${snapshots().length} versions intact; every current text frozen`);
  } else {
    console.error('usage: node seo/legal-archive.mjs --freeze | --check');
    process.exit(2);
  }
}
