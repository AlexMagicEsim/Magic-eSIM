// P1-3 — the immutable PDF copies of the Terms of Service and the Refund Policy (seo/legal-pdf.mjs): every version an
// order can be placed under has one per published language, each file matches the SHA-256 recorded when it was
// printed, the public list names them, and Pages publishes exactly these PDFs and no other.
//
// Run: node --test seo/test-legal-pdf.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PDF_KINDS, FROM, RECORD, expected, readRecord, problems, pdfPath, pinDates } from './legal-pdf.mjs';
import { CURRENT, versionNumber } from './legal-archive.mjs';
import { statementLanguages } from './checkout-statements.mjs';
import { allowRule, denyReason, legalPdfPaths } from '../scripts/build-pages-artifact.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel));
const sha = (b) => createHash('sha256').update(b).digest('hex');

test('every PDF is in order: recorded, present, intact; nothing missing', () => {
  assert.deepEqual(problems(), []);
});

test('the current Terms and Refund Policy have a PDF in each of the six international languages — Russian never', () => {
  const rec = readRecord();
  for (const kind of PDF_KINDS) {
    const v = versionNumber(CURRENT[kind].version);
    const codes = rec.files.filter((r) => r.kind === kind && r.version === v).map((r) => r.code).sort();
    assert.deepEqual(codes, [...statementLanguages()].sort(), `${kind} ${v}`);
  }
  assert.equal(rec.files.some((r) => r.code === 'ru' || r.path.startsWith('ru/') || !/^(en|es|de|fr|zh|ko)\//.test(r.path)), false);
  assert.deepEqual(PDF_KINDS, ['terms', 'refund'], 'the Privacy Policy is linked, not attached');
  assert.deepEqual({ ...FROM }, { terms: '0.9.6', refund: '0.9.4' });
});

test('each file: a PDF, its recorded SHA-256 and size, the dates pinned to the effective date, no system font', () => {
  const rec = readRecord();
  for (const r of rec.files) {
    const b = read(r.path);
    assert.equal(b.subarray(0, 5).toString('latin1'), '%PDF-', r.path);
    assert.equal(sha(b), r.sha256, r.path);
    assert.equal(b.length, r.bytes, r.path);
    assert.ok(b.length < 1_500_000, `${r.path}: ${b.length} bytes — an email carries up to four`);
    const s = b.toString('latin1');
    const eff = expected().find((w) => w.path === r.path).effectiveIso.replaceAll('-', '');
    const dates = [...s.matchAll(/\/(?:CreationDate|ModDate) \(D:(\d{8})/g)].map((m) => m[1]);
    assert.ok(dates.length >= 1 && dates.every((d) => d === eff), `${r.path}: dates ${dates} ≠ ${eff}`);
    const fonts = [...new Set([...s.matchAll(/\/(?:FontName|BaseFont) *\/[A-Z]{6}\+([^/\s>]+)/g)].map((m) => m[1]))];
    for (const f of fonts) assert.match(f, /^(Inter|NotoSans)/, `${r.path}: «${f}» — only the site's Inter and Noto (OFL)`);
    assert.equal(/\/Subtype \/Image/.test(s), false, `${r.path}: no raster image (a flat document)`);
    assert.equal(r.path, pdfPath(r.kind, r.version, r.code));
  }
});

test('the public list names every PDF with its URL and SHA-256 (the backend copies them by these)', () => {
  const doc = JSON.parse(read('en/legal-versions.json').toString('utf8'));
  const rec = readRecord();
  for (const r of rec.files) {
    const row = doc.documents.find((d) => d.document === r.kind && versionNumber(d.version) === r.version);
    assert.ok(row && row.pdf && row.pdf[r.code], `${r.kind} ${r.version} ${r.code}`);
    assert.deepEqual(row.pdf[r.code], { url: `https://magicesim.store/${r.path}`, sha256: r.sha256 });
  }
  for (const d of doc.documents) {
    if (d.document === 'privacy') assert.equal(d.pdf, undefined, 'no Privacy PDF');
  }
});

test('Pages publishes exactly the recorded PDFs — any other PDF stays denied', () => {
  const paths = legalPdfPaths();
  assert.deepEqual(paths.slice().sort(), readRecord().files.map((r) => r.path).sort());
  for (const p of paths) {
    assert.equal(denyReason(p), null, p);
    assert.ok(allowRule(p), p);
  }
  for (const p of ['en/terms/v0.9.6/other.pdf', 'en/terms/v0.9.5/magic-esim-terms-0.9.5-en.pdf', 'assets/x.pdf', 'Magic_eSIM_poster.pdf']) {
    assert.ok(denyReason(p) || !allowRule(p), `${p} must not be published`);
  }
});

test('the check can fire: a changed byte, a missing file, an unrecorded version', () => {
  const dir = mkdtempSync(join(tmpdir(), 'legal-pdf-'));
  try {
    const rec = readRecord();
    const r0 = rec.files[0];
    mkdirSync(join(dir, dirname(r0.path)), { recursive: true });
    const b = Buffer.from(read(r0.path)); b[b.length - 20] ^= 1;
    writeFileSync(join(dir, r0.path), b);
    const one = { files: [r0] };
    assert.match(problems({ root: dir, record: one, want: [] }).join('\n'), /no longer matches its SHA-256/);
    assert.match(problems({ root: dir, record: { files: [rec.files[1]] }, want: [] }).join('\n'), /the file is missing/);
    copyFileSync(join(ROOT, r0.path), join(dir, r0.path));
    assert.deepEqual(problems({ root: dir, record: one, want: [] }), []);
    assert.match(problems({ root: dir, record: one, want: [{ ...expected()[1] }] }).join('\n'), /has no PDF/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pinDates keeps the length and refuses a PDF without dates', () => {
  const s = Buffer.from('%PDF-1.4\n/CreationDate (D:20261104123456+00\'00\')\n/ModDate (D:20261104123456+00\'00\')\n', 'latin1');
  const p = pinDates(s, '2026-11-04');
  assert.equal(p.length, s.length);
  assert.equal((p.toString('latin1').match(/D:20261104000000/g) || []).length, 2);
  assert.throws(() => pinDates(Buffer.from('%PDF-1.4\n'), '2026-11-04'), /no PDF date/);
});

test('the record file is the generator\'s', () => {
  const rec = JSON.parse(read(RECORD).toString('utf8'));
  assert.ok(/printed once/.test(rec.note));
  assert.ok(rec.files.every((r) => /^[0-9a-f]{64}$/.test(r.sha256) && Number.isInteger(r.bytes)));
});
