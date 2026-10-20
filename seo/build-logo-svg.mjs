// seo/build-logo-svg.mjs — the header logo as SVG, from the approved master (brand book v1.0, logo A).
//
// IN:  assets/brand/source/magic-esim-logo-master.svg — the master, as the brand book ships it (64 KB).
// OUT: assets/brand/logo.svg — the same drawing, smaller: every coordinate rounded to 0.1 unit (the master has 0.01;
//      0.1 unit is 0.005 px in the 44 px header and 0.09 px at 1024 px wide), written relative to the previous
//      ROUNDED point (so the error never accumulates), numbers in their shortest form. Commands, order, fill rules,
//      colours and both gradients are the master's. Two named fragments are exposed for the animated header:
//      #me-symbol (the chip + the mark) and #me-word (the lettering). Nothing is redrawn.
//
// seo/test-logo-svg.mjs rebuilds it and checks it is byte-identical, that every point is within 0.05 unit of the
// master's, and that the colours are the master's. Run after changing the master: node seo/build-logo-svg.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MASTER = 'assets/brand/source/magic-esim-logo-master.svg';
export const OUT = 'assets/brand/logo.svg';

/** Absolute M/C/Z path → [{cmd, pts:[[x,y],…]}]. The master uses only these three. */
export function parsePath(d) {
  const out = []; const re = /([MCZ])([^MCZ]*)/g; let m;
  while ((m = re.exec(d))) {
    const nums = (m[2].match(/-?\d*\.?\d+/g) || []).map(Number); const pts = [];
    for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    if (m[1] !== 'Z' && pts.length % (m[1] === 'M' ? 1 : 3)) throw new Error(`odd ${m[1]} segment`);
    out.push({ cmd: m[1], pts });
  }
  return out;
}
const r1 = (v) => Math.round(v * 10) / 10;
const num = (v) => { let s = (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, ''); if (s === '-0') s = '0'; return s.replace(/^(-?)0\./, '$1.'); };
/** A list of numbers in the shortest SVG form: no separator before «-», nor before «.» when the previous number has a dot. */
function joinNums(nums) {
  let s = ''; let prev = '';
  for (const n of nums) {
    const t = num(n);
    if (prev === '') s = t;
    else if (t[0] === '-' || (t[0] === '.' && prev.includes('.'))) s += t;
    else s += ' ' + t;
    prev = t;
  }
  return s;
}
/** Rounded, relative, compact. Returns the d string and the rounded absolute points (for the test). */
export function optimise(d) {
  const segs = parsePath(d); let cx = 0, cy = 0, sx = 0, sy = 0; let out = ''; const abs = [];
  for (const { cmd, pts } of segs) {
    if (cmd === 'Z') { out += 'z'; cx = sx; cy = sy; continue; }
    const r = pts.map(([x, y]) => [r1(x), r1(y)]); abs.push(...r);
    if (cmd === 'M') { out += 'M' + joinNums(r[0]); cx = sx = r[0][0]; cy = sy = r[0][1]; continue; }
    const rel = [];
    for (let i = 0; i < r.length; i += 3) { for (let k = 0; k < 3; k += 1) rel.push(r[i + k][0] - cx, r[i + k][1] - cy); cx = r[i + 2][0]; cy = r[i + 2][1]; }
    out += 'c' + joinNums(rel);
  }
  return { d: out, abs };
}

export function build(master = readFileSync(join(ROOT, MASTER), 'utf8')) {
  const viewBox = master.match(/viewBox="([^"]+)"/)[1];
  const grads = master.match(/<linearGradient[\s\S]*?<\/linearGradient>/g);
  const paths = master.match(/<path [^>]*\/>/g);
  if (!grads || grads.length !== 2 || !paths || paths.length !== 3) throw new Error('the master must have 2 gradients and 3 paths');
  const attrs = (p) => p.replace(/\sd="[^"]+"/, '').replace(/^<path |\/>$/g, '').trim();
  const [chip, mark, word] = paths.map((p) => `<path ${attrs(p)} d="${optimise(p.match(/\sd="([^"]+)"/)[1]).d}"/>`);
  const g = grads.map((x) => x.replace(/\s+/g, ' ').replace(/> </g, '><')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="Magic eSIM">`
    + `<!-- Magic eSIM — logo A, from ${MASTER} by seo/build-logo-svg.mjs (coordinates rounded to 0.1). -->`
    + `<defs>${g}</defs><g id="me-symbol">${chip}${mark}</g><g id="me-word">${word}</g></svg>\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const svg = build(); writeFileSync(join(ROOT, OUT), svg);
  console.log(OUT, svg.length, 'bytes');
}
