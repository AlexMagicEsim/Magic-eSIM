/* The country flags: where they come from, that they are what was shipped, and
 * that nothing on the site or in the Mini App asks for one that does not exist.
 *
 * Why this exists (2026-10-19). The 198 SVG flags were imported minified with
 * every coordinate rounded to a whole unit (4a219e31). A shape drawn in tiny
 * units and blown up by a transform does not survive that: China's five stars
 * were flattened, New Zealand, Honduras and Curaçao lost theirs, Guinea-Bissau's
 * and Grenada's became blobs, Guatemala's emblem lost parts — and nothing
 * noticed for nine days. Those seven are now the flag-icons 7.5.0 originals.
 *
 *   1. PROVENANCE. `assets/flags/SOURCE.json` names the source and holds the
 *      sha256 of every SVG. A changed, added or removed file fails here until
 *      the manifest says so — a flag is replaced on purpose, never silently.
 *   2. THE DEFECT CLASS. No path may consist only of whole numbers within ±3:
 *      such a shape only means something when it is scaled up, and then the
 *      rounding has destroyed it. It caught 6 of the 7 broken files (and found
 *      Grenada, which the audit had missed); flag-icons itself has none. The
 *      browser test (test/e2e/flags.spec.js) checks what the seven DRAW.
 *   3. SAFETY. A flag is an image: no script, no handler, no external reference.
 *   4. REACH. Every flag a page, the search data or the Mini App asks for exists;
 *      the Mini App's list of drawable codes IS the directory; the sixteen PNG
 *      tiles of the Mini App's popular destinations are still there.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'assets/flags');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const MANIFEST = JSON.parse(read('assets/flags/SOURCE.json'));
const SVGS = readdirSync(DIR).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort();
const svg = (code) => readFileSync(join(DIR, `${code}.svg`), 'utf8');

/** Paths made only of whole numbers within ±3 — the rounding's fingerprint. */
export function roundedMicroPaths(text) {
  const out = [];
  for (const m of text.matchAll(/<path\b[^>]*?\bd="([^"]+)"/g)) {
    const nums = (m[1].match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
    if (nums.length && nums.every((n) => Math.abs(n) <= 3 && Number.isInteger(n))) out.push(m[1]);
  }
  return out;
}

const REPAIRED = ['cn', 'cw', 'gd', 'gt', 'gw', 'hn', 'nz'];
// Destinations added after the import arrive as the flag-icons 7.5.0 originals, byte for byte (2026-10-25: vi —
// U.S. Virgin Islands, which gained plans with the assortment activation).
const ADDED = ['vi'];

test('the manifest names the source and covers exactly the shipped files', () => {
  assert.equal(MANIFEST.source.package, 'flag-icons');
  assert.equal(MANIFEST.source.set, 'flags/4x3');
  assert.equal(MANIFEST.source.reference_version, '7.5.0');
  assert.ok(existsSync(join(DIR, 'LICENSE.txt')), 'the MIT licence travels with the files');
  assert.equal(SVGS.length, 199);
  assert.deepEqual(Object.keys(MANIFEST.files).sort(), SVGS,
    'a flag without an entry, or an entry without a flag');
  for (const [code, e] of Object.entries(MANIFEST.files)) {
    assert.ok(e.origin in MANIFEST.origins, `${code}: unknown origin ${e.origin}`);
  }
});

test('every flag is byte for byte the file the manifest records', () => {
  const changed = SVGS.filter((c) => createHash('sha256').update(readFileSync(join(DIR, `${c}.svg`))).digest('hex')
    !== MANIFEST.files[c].sha256);
  assert.deepEqual(changed, [], 'replace a flag on purpose: update assets/flags/SOURCE.json in the same commit');
});

test('the seven repaired flags are the flag-icons 7.5.0 originals', () => {
  const upstream = SVGS.filter((c) => MANIFEST.files[c].origin === 'flag-icons@7.5.0');
  assert.deepEqual(upstream, [...REPAIRED, ...ADDED].sort());
  for (const c of [...REPAIRED, ...ADDED]) assert.match(svg(c), new RegExp(`id="flag-icons-${c}"`), `${c}: not the original file`);
});

test('no flag carries a shape the rounding destroyed', () => {
  // The rule must fire on the defect it exists for — the old China star.
  assert.deepEqual(roundedMicroPaths('<path id="a" fill="#ff0" d="m-1 1 1-2 1 2-2-1h2z"/>'), ['m-1 1 1-2 1 2-2-1h2z']);
  assert.deepEqual(roundedMicroPaths('<path id="cn-a" fill="#ff0" d="M-.6.8 0-1 .6.8-1-.3h2z"/>'), []);
  assert.deepEqual(roundedMicroPaths('<path fill="#ee1c25" d="M0 0h640v480H0z"/>'), []);
  const hits = SVGS.filter((c) => roundedMicroPaths(svg(c)).length);
  assert.deepEqual(hits, []);
});

test('a flag is an image and nothing else: 4:3, no script, no external reference', () => {
  for (const c of SVGS) {
    const s = svg(c);
    assert.match(s, /^<svg\b[^>]*\bviewBox="0 0 640 480"/, `${c}: not a 4:3 flag-icons SVG`);
    assert.doesNotMatch(s, /<script|<foreignObject|<image\b|\son[a-z]+=/i, `${c}: active content`);
    for (const m of s.matchAll(/(?:xlink:)?href="([^"]*)"/g)) assert.ok(m[1].startsWith('#'), `${c}: external reference ${m[1]}`);
    assert.doesNotMatch(s, /url\((?!#)/, `${c}: external url()`);
  }
});

test('every flag a page or the search data asks for exists', () => {
  const html = execFileSync('git', ['ls-files', '*.html'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
  const asked = new Set();
  for (const f of html) for (const m of read(f).matchAll(/\/assets\/flags\/([a-z-]+)\.svg/g)) asked.add(m[1]);
  assert.ok(asked.size >= 190, `the pages ask for ${asked.size} flags — the scan is broken`);
  assert.deepEqual([...asked].filter((c) => !SVGS.includes(c)), []);
  const w = {};
  new Function('window', read('assets/ru-destinations.js'))(w);
  const isos = (w.MagicRuDestinations || []).map((d) => String(d.iso).toLowerCase());
  assert.ok(isos.length >= 190);
  assert.deepEqual(isos.filter((c) => !SVGS.includes(c)), []);
});

test('the Mini App draws exactly the codes that have a file, and never prints an emoji flag', () => {
  globalThis.window = globalThis.window || {};
  const C = createRequire(import.meta.url)('../app/core.js');
  assert.deepEqual([...C.FLAG_SVG].sort(), SVGS, 'app/core.js FLAG_SVG must list assets/flags/*.svg');
  assert.deepEqual(C.flagParts('🇨🇳'), [{ code: 'cn' }]);
  assert.deepEqual(C.flagParts('🇹🇭🇻🇳'), [{ code: 'th' }, { code: 'vn' }]);
  assert.deepEqual(C.flagParts('🌍'), [{ text: '🌍' }], 'a region keeps its globe');
  assert.deepEqual(C.flagParts('🇦🇶'), [{ text: '🇦🇶' }], 'a code with no file keeps its emoji, never a broken image');
  assert.deepEqual(C.flagParts(''), []);
  const ui = read('app/ui.js');
  assert.doesNotMatch(ui, /class: '(?:card|chip)__flag', text:/, 'a flag printed as text');
  assert.doesNotMatch(ui, /text: `\$\{x\.flag\}/, 'a chip prints the emoji flag');
});

test('the sixteen PNG tiles of the Mini App\'s popular destinations are kept', () => {
  globalThis.window = globalThis.window || {};
  const C = createRequire(import.meta.url)('../app/core.js');
  const pngs = readdirSync(DIR).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();
  assert.equal(pngs.length, 16);
  assert.deepEqual([...C.popularCountries].map((c) => c.toLowerCase()).sort(), pngs);
});
