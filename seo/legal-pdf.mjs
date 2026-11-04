#!/usr/bin/env node
// P1-3 (owner's decision 2026-11-04) — IMMUTABLE PDF copies of the Terms of Service and the Refund Policy, per version
// and language, for the GLOBAL order confirmation email.
//
// WHY. Directive 2011/83/EU Art. 8(7): the confirmation of a distance contract is given on a DURABLE MEDIUM, with the
// Art. 6(1) information (the terms; the right of withdrawal and its model form — the Refund Policy). A link to the
// trader's website is not a durable medium (CJEU C-49/11 Content Services, 2012). The email carries these PDFs as
// attachments (the backend keeps byte copies and checks every one against the SHA-256 published here) and keeps its
// links to the permanent pages.
//
// FROZEN, LIKE THE LEGAL ARCHIVE. A PDF is printed ONCE from the frozen version page (/<lang>/<kind>/v<n>/), its
// SHA-256 written to seo/legal-pdf.json, and never printed again: `--freeze` refuses to overwrite a file, `--check`
// fails when a file and its record differ, when a record has no file, or when a current version (from the first
// version that can be bought under — FROM below) has no PDF. A new document version = `node seo/legal-archive.mjs
// --freeze`, a template-only rebuild, then `node seo/legal-pdf.mjs --freeze`.
//
// PRINTING. Chromium (Playwright) prints the built page with the site's own CSS and fonts, the page frame hidden
// (header, footer, menus, payment bar, table of contents), A4, no running header or footer.
// The dates Chromium writes into the PDF are set to the version's effective date, so a file says nothing about the
// machine or the moment it was printed. Chinese and Korean are printed with Noto Sans SC / KR (SIL OFL 1.1), fetched
// from a pinned release and checked by SHA-256 into a local cache — never into the repository.
//
//   node seo/legal-pdf.mjs --freeze   print every missing PDF (refuses to overwrite one)
//   node seo/legal-pdf.mjs --check    exit 1 on any problem (also run by seo/test-legal-pdf.mjs)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { snapshots, translationSnapshots, versionNumber } from './legal-archive.mjs';
import { locale } from './locales.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RECORD = 'seo/legal-pdf.json';
const SITE = 'https://magicesim.store';

/** The documents that get a PDF, and the first version of each that any order can be placed under. */
export const PDF_KINDS = Object.freeze(['terms', 'refund']);
export const FROM = Object.freeze({ terms: '0.9.6', refund: '0.9.4' });

const cmp = (a, b) => {
  const x = a.split('.').map(Number); const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
};

/** The published path of one PDF (no leading slash): /<prefix>/<kind>/v<n>/magic-esim-<kind>-<n>-<code>.pdf */
export function pdfPath(kind, version, code) {
  const n = versionNumber(version);
  return `${locale(code).prefix}/${kind}/v${n}/magic-esim-${kind}-${n}-${code}.pdf`;
}

/** Every PDF that must exist: [{ kind, version, code, path, effectiveIso, title }]. */
export function expected(en = snapshots(), tr = translationSnapshots()) {
  const out = [];
  for (const s of en) {
    if (!PDF_KINDS.includes(s.kind) || cmp(versionNumber(s.version), FROM[s.kind]) < 0) continue;
    out.push({ kind: s.kind, version: versionNumber(s.version), code: 'en', path: pdfPath(s.kind, s.version, 'en'), effectiveIso: s.effectiveIso, title: s.title });
    for (const t of tr.filter((x) => x.kind === s.kind && versionNumber(x.version) === versionNumber(s.version))) {
      out.push({ kind: t.kind, version: versionNumber(t.version), code: t.code, path: pdfPath(t.kind, t.version, t.code), effectiveIso: s.effectiveIso, title: t.title || s.title });
    }
  }
  return out;
}

export function readRecord(root = ROOT) {
  const f = join(root, RECORD);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : { files: [] };
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** Everything wrong with the PDFs and their record: [] = in order. */
export function problems({ root = ROOT, record = readRecord(root), want = expected() } = {}) {
  const out = [];
  const byPath = new Map(record.files.map((r) => [r.path, r]));
  for (const r of record.files) {
    const f = join(root, r.path);
    if (!existsSync(f)) { out.push(`${r.path}: recorded, but the file is missing`); continue; }
    const buf = readFileSync(f);
    if (sha(buf) !== r.sha256) out.push(`${r.path}: the file no longer matches its SHA-256 — a frozen PDF is never replaced`);
    if (buf.length !== r.bytes) out.push(`${r.path}: ${buf.length} bytes, recorded ${r.bytes}`);
    if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') out.push(`${r.path}: not a PDF`);
    if (r.path !== pdfPath(r.kind, r.version, r.code)) out.push(`${r.path}: not the path of ${r.kind} ${r.version} ${r.code}`);
  }
  for (const w of want) if (!byPath.has(w.path)) out.push(`${w.path}: ${w.kind} ${w.version} (${w.code}) has no PDF — node seo/legal-pdf.mjs --freeze`);
  return out;
}

/** The PDFs of one version of one document, for /en/legal-versions.json: { <code>: { url, sha256 } } or null. */
export function pdfEntries(kind, version, record = readRecord()) {
  const rows = record.files.filter((r) => r.kind === kind && r.version === versionNumber(version));
  if (!rows.length) return null;
  return Object.fromEntries(rows.map((r) => [r.code, { url: `${SITE}/${r.path}`, sha256: r.sha256 }]));
}

/* ------------------------------------------------------------------ printing (only with --freeze) */

// Noto Sans CJK, SIL Open Font License 1.1 — release Sans2.004 of github.com/notofonts/noto-cjk, subset OTF; Noto Sans
// Georgian, OFL 1.1 — github.com/notofonts/notofonts.github.io at a pinned commit. Every file checked by SHA-256.
const GEORGIAN_URL = (w) => `https://raw.githubusercontent.com/notofonts/notofonts.github.io/a5fca98891563057e7f65c1c4bf3f2a58c7704a4/fonts/NotoSansGeorgian/hinted/ttf/NotoSansGeorgian-${w}.ttf`;
const FONTS = Object.freeze([
  { family: 'Noto Sans SC', weight: 400, file: 'NotoSansSC-Regular.otf', dir: 'SC', sha256: 'faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9' },
  { family: 'Noto Sans SC', weight: 700, file: 'NotoSansSC-Bold.otf', dir: 'SC', sha256: 'c6cb5a93abaa9edc8ee7463b7ebb7f42d618d40e6ed2f7a5371c97b0b64767c0' },
  { family: 'Noto Sans KR', weight: 400, file: 'NotoSansKR-Regular.otf', dir: 'KR', sha256: '69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68' },
  { family: 'Noto Sans KR', weight: 700, file: 'NotoSansKR-Bold.otf', dir: 'KR', sha256: '5a6ceb287ed2fc6cfc6213144ebea68cbd94b20fc9eb873d8486493bf02d9bda' },
  // The seller's name in Georgian (Terms §1) — Inter has no Georgian; never a system font in a published file.
  { family: 'Noto Sans Georgian', weight: 400, file: 'NotoSansGeorgian-Regular.ttf', url: GEORGIAN_URL('Regular'), sha256: 'd3e33254b09e7bb2c5cf0f17e554b80462056c5a107097f258d495168c3a9346' },
  { family: 'Noto Sans Georgian', weight: 700, file: 'NotoSansGeorgian-Bold.ttf', url: GEORGIAN_URL('Bold'), sha256: 'a7f6bc365b7c33372e9ff0b0422f35dad52df501a8fcd4e8766cefa430508693' },
]);
const FONT_DIR = process.env.LEGAL_PDF_FONT_DIR || join(homedir(), '.cache', 'magic-esim-legal-pdf-fonts');
const FONT_URL = (f) => f.url || `https://github.com/notofonts/noto-cjk/raw/Sans2.004/Sans/SubsetOTF/${f.dir}/${f.file}`;

async function fonts() {
  mkdirSync(FONT_DIR, { recursive: true });
  for (const f of FONTS) {
    const p = join(FONT_DIR, f.file);
    if (!existsSync(p)) {
      const r = await fetch(FONT_URL(f));
      if (!r.ok) throw new Error(`legal-pdf: ${f.file}: HTTP ${r.status}`);
      writeFileSync(p, Buffer.from(await r.arrayBuffer()));
    }
    if (sha(readFileSync(p)) !== f.sha256) throw new Error(`legal-pdf: ${p} is not the pinned font (SHA-256 differs)`);
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.otf': 'font/otf' };

// The page frame is not the document: hidden in print. The fonts of the language follow the site's Inter.
const PRINT_CSS = `
  .skip, .site-header, .site-footer, .paybar, .g-toc, .crumbs, .langsw, .mnav-panel, nav { display: none !important; }
  .g-layout { display: block !important; }
  /* shadows, filters and background images print as page-sized raster images: a flat document instead */
  *, *::before, *::after { box-shadow: none !important; text-shadow: none !important; filter: none !important;
    backdrop-filter: none !important; background-image: none !important; mask: none !important; }
  section, .g-section, .card { background: #fff !important; border: 1px solid #d9dde6 !important; break-inside: auto; }
  @font-face { font-family: 'Noto Sans Georgian'; font-weight: 400; src: url(/__fonts/NotoSansGeorgian-Regular.ttf); }
  @font-face { font-family: 'Noto Sans Georgian'; font-weight: 700; src: url(/__fonts/NotoSansGeorgian-Bold.ttf); }
  body, body * { font-family: 'Inter', 'Noto Sans Georgian', sans-serif !important; }
  @font-face { font-family: 'Noto Sans SC'; font-weight: 400; src: url(/__fonts/NotoSansSC-Regular.otf); }
  @font-face { font-family: 'Noto Sans SC'; font-weight: 700; src: url(/__fonts/NotoSansSC-Bold.otf); }
  @font-face { font-family: 'Noto Sans KR'; font-weight: 400; src: url(/__fonts/NotoSansKR-Regular.otf); }
  @font-face { font-family: 'Noto Sans KR'; font-weight: 700; src: url(/__fonts/NotoSansKR-Bold.otf); }
  html:lang(zh-Hans) body, html:lang(zh-Hans) body * { font-family: 'Inter', 'Noto Sans SC', 'Noto Sans Georgian', sans-serif !important; }
  html:lang(ko) body, html:lang(ko) body * { font-family: 'Inter', 'Noto Sans KR', 'Noto Sans Georgian', sans-serif !important; }
  * { animation: none !important; transition: none !important; }
`;

/** Chromium's two PDF dates → the version's effective date, same length (the cross-reference offsets stay valid). */
export function pinDates(buf, iso) {
  const day = iso.replaceAll('-', '');
  if (!/^\d{8}$/.test(day)) throw new Error(`legal-pdf: bad effective date ${iso}`);
  const s = buf.toString('latin1');
  let n = 0;
  const out = s.replace(/\/(CreationDate|ModDate) \(D:(\d{14})/g, (m, k) => { n += 1; return `/${k} (D:${day}000000`; });
  if (n === 0) throw new Error('legal-pdf: no PDF date found to pin — Chromium changed its output, check before freezing');
  const pinned = Buffer.from(out, 'latin1');
  if (pinned.length !== buf.length) throw new Error('legal-pdf: pinning the dates changed the length');
  return pinned;
}

async function print(items) {
  await fonts();
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ env: { ...process.env, TZ: 'UTC' } });
  const written = [];
  try {
    const page = await browser.newPage();
    await page.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.host !== 'pdf.local') return route.abort();
      let file;
      // the print style is served as a file of the page's own origin: the pages' CSP (style-src 'self') refuses inline CSS
      if (u.pathname === '/__print.css') return route.fulfill({ status: 200, contentType: 'text/css', body: PRINT_CSS });
      if (u.pathname.startsWith('/__fonts/')) file = join(FONT_DIR, u.pathname.slice('/__fonts/'.length));
      else file = join(ROOT, decodeURIComponent(u.pathname), u.pathname.endsWith('/') ? 'index.html' : '');
      if (!existsSync(file) || !statSync(file).isFile()) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: TYPES[extname(file)] || 'application/octet-stream', body: readFileSync(file) });
    });
    await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
    for (const it of items) {
      const dir = `/${it.path.slice(0, it.path.lastIndexOf('/') + 1)}`;
      if (!existsSync(join(ROOT, dir, 'index.html'))) throw new Error(`legal-pdf: ${dir} is not built — run the template rebuild first`);
      await page.goto(`http://pdf.local${dir}`, { waitUntil: 'load' });
      await page.addStyleTag({ url: '/__print.css' });
      await page.evaluate(() => document.fonts.ready);
      // No running footer: Chromium prints header/footer templates in a context without the page's fonts, so a
      // system font would end up in the file. The document's own heading names the version and its effective date.
      const raw = await page.pdf({
        format: 'A4', printBackground: false, preferCSSPageSize: false,
        margin: { top: '16mm', bottom: '16mm', left: '16mm', right: '16mm' },
        displayHeaderFooter: false,
      });
      const buf = pinDates(Buffer.from(raw), it.effectiveIso);
      const f = join(ROOT, it.path);
      if (existsSync(f)) throw new Error(`legal-pdf: ${it.path} exists already — a frozen PDF is never replaced`);
      writeFileSync(f, buf);
      written.push({ kind: it.kind, version: it.version, code: it.code, path: it.path, sha256: sha(buf), bytes: buf.length });
    }
  } finally {
    await browser.close();
  }
  return written;
}

/** Print every expected PDF that has no record yet, and record it. Refuses to overwrite a file. */
export async function freeze() {
  const record = readRecord();
  const have = new Set(record.files.map((r) => r.path));
  const missing = expected().filter((w) => !have.has(w.path));
  if (!missing.length) return [];
  const written = await print(missing);
  const files = [...record.files, ...written].sort((a, b) => a.path.localeCompare(b.path));
  const doc = {
    note: 'Immutable PDF copies of the Magic eSIM Terms of Service and Refund Policy, by version and language (seo/legal-pdf.mjs). Each file is printed once from its frozen version page and never replaced; sha256 is over the file bytes.',
    files,
  };
  writeFileSync(join(ROOT, RECORD), `${JSON.stringify(doc, null, 2)}\n`);
  return written;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const arg = process.argv[2];
  if (arg === '--freeze') {
    const w = await freeze();
    console.log(w.length ? w.map((x) => `frozen ${x.path} (${x.bytes} B)`).join('\n') : 'nothing to freeze');
  } else if (arg !== '--check') {
    console.error('usage: node seo/legal-pdf.mjs --freeze | --check');
    process.exit(2);
  }
  const p = problems();
  for (const x of p) console.error(x);
  if (p.length) process.exit(1);
  console.log(`legal PDFs: ${readRecord().files.length} frozen, every one intact`);
}
