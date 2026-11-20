// The BIMI sender logo (2026-11-20): /.well-known/bimi/magic-esim.svg, named by the DNS record
// default._bimi.magicesim.store («v=BIMI1; l=https://magicesim.store/.well-known/bimi/magic-esim.svg;» — added by the
// owner after this file is live). Without a certificate (VMC/CMC) only self-asserted-BIMI mailbox providers may show it.
//
// Pinned here:
//   1. SVG Tiny P/S — what the BIMI Group profile (bimigroup.org/resources/SVG_PS-latest.rnc) requires of the file:
//      version 1.2, baseProfile tiny-ps, a <title>, a square viewBox with no x/y on the root, only elements and
//      attributes the profile allows, no raster, script, link, animation, text or external reference; ≤ 32 KB;
//   2. the brand mark is the approved one (brandbook v1.2, mark on white) and it fits the round avatar: a solid white
//      square, and every point of the drawing lies inside the inscribed circle (mail clients crop to a circle);
//   3. it is published: the Pages artifact admits exactly this one dot-path, deploy-pages.yml uploads hidden files
//      (actions/upload-pages-artifact v5 drops them otherwise), and the built _site carries the file byte for byte —
//      whatever language scope the site has, because it is not in any language directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { WELL_KNOWN_FILES, planArtifact, buildArtifact, denyReason, allowRule } from '../scripts/build-pages-artifact.mjs';
import { scopeOf } from './publication-scope.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REL = '.well-known/bimi/magic-esim.svg';
const BYTES = readFileSync(join(ROOT, REL));
const SVG = BYTES.toString('utf8');

// The elements this file may use, each with the attributes the SVG Tiny P/S schema allows it (a subset of the schema:
// what a flat-colour + gradient logo needs). Anything else fails, so a new element is a deliberate decision.
const ALLOWED = {
  svg: ['xmlns', 'version', 'baseProfile', 'viewBox'],
  title: [],
  defs: [],
  linearGradient: ['id', 'gradientUnits', 'x1', 'y1', 'x2', 'y2'],
  stop: ['offset', 'stop-color'],
  rect: ['width', 'height', 'fill'],
  g: ['transform'],
  path: ['d', 'fill', 'fill-rule'],
};

function elements(svg) {
  const out = [];
  for (const m of svg.matchAll(/<([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g)) {
    out.push({ tag: m[1], attrs: [...m[2].matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => ({ name: a[1], value: a[2] })) });
  }
  return out;
}

test('1. SVG Tiny P/S: root, title, square viewBox, size', () => {
  const root = SVG.match(/^<svg\b([^>]*)>/);
  assert.ok(root, 'the file starts with <svg>');
  assert.match(root[1], /\sversion="1\.2"/);
  assert.match(root[1], /\sbaseProfile="tiny-ps"/);
  assert.match(root[1], /\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(root[1], /\s(x|y|width|height)="/, 'no x/y (and no fixed size) on the root');
  const vb = root[1].match(/viewBox="0 0 (\d+) (\d+)"/);
  assert.ok(vb && vb[1] === vb[2], 'a square viewBox from 0 0');
  assert.match(SVG, /^<svg\b[^>]*>\s*<title>Magic eSIM<\/title>/, 'a <title>, first');
  assert.ok(BYTES.length <= 32 * 1024, `${BYTES.length} bytes ≤ 32 KB`);
  assert.doesNotMatch(SVG, /<\?xml-stylesheet|<!DOCTYPE|<!ENTITY/i);
});

test('1b. only the elements and attributes the profile allows; nothing raster, active or external', () => {
  for (const { tag, attrs } of elements(SVG)) {
    assert.ok(Object.hasOwn(ALLOWED, tag), `<${tag}> is not allowed in this logo`);
    for (const a of attrs) assert.ok(ALLOWED[tag].includes(a.name), `<${tag}> ${a.name}= is not allowed`);
  }
  assert.doesNotMatch(SVG, /<(image|script|a|use|text|style|foreignObject|animate\w*|set)\b/);
  assert.doesNotMatch(SVG, /href=|url\(\s*['"]?(https?:|data:)/i, 'no external or embedded resource');
  assert.doesNotMatch(SVG, /\son[a-z]+=/i, 'no event handler');
  for (const { tag, attrs } of elements(SVG)) {
    for (const a of attrs.filter((x) => x.name === 'fill' && x.value.startsWith('url('))) {
      const id = a.value.match(/^url\(#([\w-]+)\)$/);
      assert.ok(id && SVG.includes(`id="${id[1]}"`), `<${tag}> fill refers to a gradient defined in the file`);
    }
  }
});

test('2. the approved mark on white: brand colours, solid white square background', () => {
  assert.match(SVG, /<rect width="640" height="640" fill="#ffffff"\/>/, 'a solid white square (no transparency)');
  // brandbook v1.2 mark: the a-mark gradient (violet → cyan) and the chip colour
  for (const c of ['#8b20b7', '#3451c7', '#0ad0f9', '#f6ce82']) assert.ok(SVG.includes(c), `brand colour ${c}`);
});

/** Every point the paths can reach: M x,y and the control/end points of relative cubics (c). A cubic lies inside the
 *  hull of its control points, so their bounding box bounds the drawing. */
function pathPoints(d) {
  const toks = d.match(/[MmCcZz]|-?(?:\d+\.?\d*|\.\d+)/g);
  const pts = [];
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = null;
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    if (cmd === 'Z' || cmd === 'z') { x = sx; y = sy; continue; }
    if (cmd === 'M') { x = +toks[i++]; y = +toks[i++]; sx = x; sy = y; pts.push([x, y]); cmd = 'L?'; continue; }
    if (cmd === 'c') {
      const v = toks.slice(i, i + 6).map(Number); i += 6;
      pts.push([x + v[0], y + v[1]], [x + v[2], y + v[3]], [x + v[4], y + v[5]]);
      x += v[4]; y += v[5]; continue;
    }
    if (cmd === 'C') {
      const v = toks.slice(i, i + 6).map(Number); i += 6;
      pts.push([v[0], v[1]], [v[2], v[3]], [v[4], v[5]]); x = v[4]; y = v[5]; continue;
    }
    throw new Error(`unexpected path command ${cmd}`);
  }
  return pts;
}

test('2b. the drawing fits the round avatar: every point inside the inscribed circle, with room to spare', () => {
  const t = SVG.match(/<g transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)">/);
  assert.ok(t, 'one translate+scale group');
  const [tx, ty, s] = [+t[1], +t[2], +t[3]];
  const ds = [...SVG.matchAll(/<path [^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ds.length >= 2);
  let worst = 0;
  for (const d of ds) for (const [px, py] of pathPoints(d)) {
    const X = tx + s * px, Y = ty + s * py;
    worst = Math.max(worst, Math.hypot(X - 320, Y - 320));
  }
  assert.ok(worst < 320 * 0.95, `farthest point ${worst.toFixed(1)} from the centre stays inside the circle (r = 320)`);
});

test('3. published: the one admitted dot-path, the hidden-file upload, and the built _site carries it byte for byte', () => {
  assert.deepEqual([...WELL_KNOWN_FILES], [REL], 'exactly one file under /.well-known/');
  assert.equal(denyReason(REL), null);
  assert.equal(allowRule(REL), 'well-known file');
  // any other dot-path stays denied
  for (const p of ['.well-known/other.txt', '.well-known/bimi/other.svg', '.env', '.github/workflows/x.yml', '.nojekyll']) {
    assert.ok(denyReason(p), `${p} stays denied`);
  }
  const plan = planArtifact(ROOT, { scope: scopeOf() });
  assert.ok(plan.publish.includes(REL), 'in the publish list under the current language scope');
  assert.deepEqual(plan.publish.filter((f) => f.split('/').some((seg) => seg.startsWith('.'))), [REL], 'the only dot-path published');
  const wf = readFileSync(join(ROOT, '.github/workflows/deploy-pages.yml'), 'utf8');
  assert.match(wf, /upload-pages-artifact@[0-9a-f]{40} # v5[\s\S]{0,80}path: _site[\s\S]{0,600}include-hidden-files: true/,
    'upload-pages-artifact v5 drops dot-paths unless include-hidden-files is true');
  const tmp = mkdtempSync(join(tmpdir(), 'bimi-artifact-'));
  try {
    buildArtifact(ROOT, join(tmp, 'site'), { scope: scopeOf() });
    const out = join(tmp, 'site', REL);
    assert.ok(existsSync(out), 'the built _site has the file');
    assert.ok(readFileSync(out).equals(BYTES), 'byte for byte');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
