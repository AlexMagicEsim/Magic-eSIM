// The animated header logo and the interface motion (owner, 2026-10-20: «Reveal + Wave», «Expressive»).
// Pins: the optimised SVG is the master's drawing (rebuilt byte for byte; every point within 0.05 unit; the master's fills,
// rules and gradients); the RU header, the Mini App and the frozen ten carry what they should; the motion stays inside
// prefers-reduced-motion and uses no layout property; the sitemap hash does not see it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, parsePath, MASTER, OUT } from './build-logo-svg.mjs';
import { LOGO, LOGO_ANIMATED, LOGO_ANIMATED_SVG, MINI_APP_LOGO, HEADER_MOTION_SCRIPT } from './site-chrome.mjs';
import { ruHeader } from './ru-chrome.mjs';
import { FROZEN_PAGES } from './frozen-pages.mjs';
import { contentHash, stripAnimatedLogo } from './build-sitemap.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** relative m/c/z (our output) → absolute points */
function absPoints(d) {
  const t = []; const re = /([Mcz])|(-?(?:\d+\.?\d*|\.\d+))/g; let k;
  while ((k = re.exec(d))) t.push(k[1] || Number(k[2]));
  const pts = []; let cx = 0, cy = 0, sx = 0, sy = 0, i = 0, cmd = '';
  while (i < t.length) {
    if (typeof t[i] === 'string') { cmd = t[i++]; if (cmd === 'z') { cx = sx; cy = sy; } continue; }
    if (cmd === 'M') { cx = sx = t[i]; cy = sy = t[i + 1]; i += 2; pts.push([cx, cy]); continue; }
    const s = t.slice(i, i + 6); i += 6;
    for (let j = 0; j < 6; j += 2) pts.push([cx + s[j], cy + s[j + 1]]);
    cx += s[4]; cy += s[5];
  }
  return pts;
}

test('assets/brand/logo.svg is rebuilt byte for byte from the master', () => {
  assert.equal(read(OUT), build());
  assert.ok(read(OUT).length < read(MASTER).length * 0.55, 'the optimisation must stay worth it');
});

test('every point of the optimised logo is within 0.05 unit of the master, in the same commands', () => {
  const master = read(MASTER).match(/<path [^>]*\/>/g);
  const out = read(OUT).match(/<path [^>]*\/>/g);
  assert.equal(out.length, 3);
  out.forEach((p, i) => {
    const want = parsePath(master[i].match(/\sd="([^"]+)"/)[1]);
    const got = absPoints(p.match(/\sd="([^"]+)"/)[1]);
    const flat = want.flatMap((s) => s.pts);
    assert.equal(got.length, flat.length, `path ${i}: point count`);
    assert.equal(p.match(/\sd="([^"]+)"/)[1].match(/[Mcz]/g).join('').toUpperCase(), want.map((s) => s.cmd).join('').replace(/C/g, 'C'), `path ${i}: commands`);
    got.forEach((q, j) => {
      assert.ok(Math.abs(q[0] - flat[j][0]) <= 0.0501 && Math.abs(q[1] - flat[j][1]) <= 0.0501, `path ${i} point ${j}`);
    });
    const attrs = (x) => x.replace(/\sd="[^"]+"/, '');
    assert.equal(attrs(p), attrs(master[i]), `path ${i}: fill, rule and id unchanged`);
  });
  const grads = (s) => s.match(/<linearGradient[\s\S]*?<\/linearGradient>/g).map((g) => g.replace(/\s+/g, ' ').replace(/> </g, '><'));
  assert.deepEqual(grads(read(OUT)), grads(read(MASTER)));
});

test('the RU header carries the animated logo; the footer and the frozen ten keep the static one', () => {
  assert.ok(ruHeader().includes(LOGO_ANIMATED));
  assert.ok(ruHeader({ animatedLogo: false }).includes(LOGO) && !ruHeader({ animatedLogo: false }).includes('brand-logo'));
  for (const slug of FROZEN_PAGES) {
    const h = read(`esim/${slug}/index.html`);
    assert.doesNotMatch(h, /brand-logo|data-motion|motion\.js/, `${slug}: frozen pages stay static`);
  }
  const turkey = read('esim/turkey/index.html');
  assert.ok(turkey.includes(LOGO_ANIMATED), 'a live country page plays it');
  assert.equal(turkey.split('brand-logo').length - 1, 1, 'one animated logo per page (the footer keeps the image)');
});

test('the header script: before first paint, once per session, motion.js loaded without blocking', () => {
  assert.match(HEADER_MOTION_SCRIPT, /setAttribute\('data-motion','expressive'\)/);
  assert.match(HEADER_MOTION_SCRIPT, /sessionStorage/);
  assert.match(HEADER_MOTION_SCRIPT, /j\.async=true/);
  assert.match(HEADER_MOTION_SCRIPT, /\/assets\/motion\.js\?v=[0-9a-f]{8}/);
  assert.match(LOGO_ANIMATED_SVG(), /\/assets\/brand\/logo\.svg\?v=[0-9a-f]{8}#me-symbol/);
  assert.match(LOGO_ANIMATED_SVG(), /width="59" height="44"/, 'the PNG logo\'s box: no layout shift');
});

test('the Mini App hero carries the same logo, plays it once, and turns motion on', () => {
  const h = read('app/index.html');
  assert.ok(h.includes(MINI_APP_LOGO));
  assert.match(h, /<html lang="ru" data-motion="expressive">/);
  assert.match(h, /<script src="motion\.js\?v=[0-9a-f]{8}"><\/script>/);
  assert.match(read('app/motion.js'), /classList\.remove\('lm-play'\)/);
});

test('motion CSS: inside prefers-reduced-motion, transform/opacity only, no infinite loop', () => {
  for (const f of ['assets/ru.css', 'app/mini.css']) {
    const css = read(f);
    const from = css.indexOf('Motion — «Expressive»') > 0 ? css.indexOf('Motion — «Expressive»') : css.indexOf('MOTION — «Expressive»');
    assert.ok(from > 0, f);
    const block = css.slice(from);
    assert.doesNotMatch(block, /animation(?:-iteration-count)?:[^;}]*infinite/, `${f}: no loop`);
    for (const kf of block.match(/@keyframes [\w-]+\{[\s\S]*?\}\}/g)) {
      assert.doesNotMatch(kf, /\b(width|height|top|left|margin|padding)\s*:/, `${f}: ${kf.slice(0, 30)} animates layout`);
    }
    // every rule that animates sits inside @media (prefers-reduced-motion:no-preference) — walk the braces
    const stack = []; let prelude = '';
    for (const ch of block) {
      if (ch === '{') { stack.push(prelude.trim()); prelude = ''; continue; }
      if (ch === '}') { stack.pop(); prelude = ''; continue; }
      prelude += ch;
      if (/(^|[;\s])animation:\s*[a-z]/.test(prelude) && !stack.some((x) => x.startsWith('@keyframes'))) {
        assert.ok(stack.includes('@media (prefers-reduced-motion:no-preference)'), `${f}: ${stack.at(-1)} animates outside no-preference`);
        prelude = '';
      }
    }
  }
});

test('the sitemap hash does not see the animated logo (no date moves)', () => {
  const page = read('esim/turkey/index.html');
  assert.ok(!stripAnimatedLogo(page).includes('brand-logo'));
  assert.ok(stripAnimatedLogo(page).includes(`<a class="brand" href="/">${LOGO}</a>`));
  assert.equal(contentHash(page), contentHash(page.split(LOGO_ANIMATED).join(LOGO)));
});

test('every RU page with the shared header has the animated logo or is frozen', () => {
  const pages = ['index.html', 'payment-success.html', 'payment-failed.html', 'privacy.html', 'terms.html', 'iphone.html', 'android.html', 'esim/index.html'];
  for (const d of readdirSync(join(ROOT, 'esim'))) if (existsSync(join(ROOT, 'esim', d, 'index.html'))) pages.push(`esim/${d}/index.html`);
  for (const p of pages) {
    const h = read(p); if (!h.includes('class="site-header"')) continue;
    const slug = p.split('/')[1];
    if (FROZEN_PAGES.has(slug)) continue;
    assert.ok(h.includes(LOGO_ANIMATED), `${p}: header logo`);
  }
});
