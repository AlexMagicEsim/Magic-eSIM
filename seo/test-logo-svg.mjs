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
import { LOGO, LOGO_ANIMATED, LOGO_ANIMATED_SVG, MINI_APP_LOGO, HEADER_MOTION_SCRIPT, LOGO_ANIMATED_EN, LOGO_ONCE_SCRIPT, LOGO_ONCE_SCRIPT_MOTION, MOTION_JS_URL } from './site-chrome.mjs';
import { ruHeader } from './ru-chrome.mjs';
import { FROZEN_PAGES } from './frozen-pages.mjs';
import { contentHash, stripAnimatedLogo } from './build-sitemap.mjs';
import { REGION_SLUGS } from './regions.mjs';

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

test('the RU header carries the animated logo on every page (the former experiment ten too, since 2026-10-24); the footer keeps the static one', () => {
  assert.ok(ruHeader().includes(LOGO_ANIMATED));
  assert.ok(ruHeader({ animatedLogo: false }).includes(LOGO) && !ruHeader({ animatedLogo: false }).includes('brand-logo'));
  for (const slug of FROZEN_PAGES) {
    const h = read(`esim/${slug}/index.html`);
    assert.ok(h.includes(LOGO_ANIMATED), `${slug}: the animated logo`);
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
  // The Expressive rules live ONCE, in the shared site.css (moved from ru.css 2026-10-21): no duplicate in the RU layer.
  assert.doesNotMatch(read('assets/ru.css'), /\[data-motion\]/, 'assets/ru.css carries no motion rule (they are in site.css)');
  for (const f of ['app/mini.css', 'assets/site.css']) {
    const css = read(f);
    const marker = ['Motion — «Expressive»', 'MOTION — «Expressive»', 'THE HEADER LOGO — «Reveal + Wave»'].find((m) => css.includes(m));
    const from = marker ? css.indexOf(marker) : -1;
    assert.ok(from > 0, f);
    const block = css.slice(from);
    assert.doesNotMatch(block, /animation(?:-iteration-count)?:[^;}]*infinite/, `${f}: no loop`);
    for (const kf of block.match(/@keyframes [\w-]+\{[\s\S]*?\}\}/g)) {
      assert.doesNotMatch(kf, /\b(width|height|top|left|margin|padding)\s*:/, `${f}: ${kf.slice(0, 30)} animates layout`);
    }
    // every rule that animates sits inside @media (prefers-reduced-motion:no-preference) — walk the braces
    // A declaration is judged when it ENDS (`;` or `}`): judged char by char, `animation:n` looked like an animation
    // before it could read as `animation:none` — the reduce rule that stops motion.
    const stack = []; let decl = '';
    const judge = () => {
      if (/(^|\s)animation:\s*(?!none\b)[a-z]/.test(decl) && !stack.some((x) => x.startsWith('@keyframes'))) {
        assert.ok(stack.includes('@media (prefers-reduced-motion:no-preference)'), `${f}: ${stack.at(-1)} animates outside no-preference`);
      }
    };
    for (const ch of block) {
      if (ch === '{') { stack.push(decl.trim()); decl = ''; continue; }
      if (ch === '}') { judge(); stack.pop(); decl = ''; continue; }
      if (ch === ';') { judge(); decl = ''; continue; }
      decl += ch;
    }
  }
});

test('the sitemap hash does not see the animated logo (no date moves)', () => {
  const page = read('esim/turkey/index.html');
  assert.ok(!stripAnimatedLogo(page).includes('brand-logo'));
  assert.ok(stripAnimatedLogo(page).includes(`<a class="brand" href="/">${LOGO}</a>`));
  assert.equal(contentHash(page), contentHash(page.split(LOGO_ANIMATED).join(LOGO)));
});

test('every RU page with the shared header has the animated logo (no exception since 2026-10-24)', () => {
  const pages = ['index.html', 'payment-success.html', 'payment-failed.html', 'privacy.html', 'terms.html', 'iphone.html', 'android.html', 'esim/index.html'];
  for (const d of readdirSync(join(ROOT, 'esim'))) if (existsSync(join(ROOT, 'esim', d, 'index.html'))) pages.push(`esim/${d}/index.html`);
  for (const p of pages) {
    const h = read(p); if (!h.includes('class="site-header"')) continue;
    assert.ok(h.includes(LOGO_ANIMATED), `${p}: header logo`);
  }
});

// ---- the English pages (2026-10-20): the same logo and the same once-per-session start, without inline script ----
const EN_PAGES = () => {
  const out = ['en/index.html', 'en/esim/index.html', 'en/guides/index.html'];
  for (const d of readdirSync(join(ROOT, 'en/esim'))) if (existsSync(join(ROOT, 'en/esim', d, 'index.html'))) out.push(`en/esim/${d}/index.html`);
  for (const d of readdirSync(join(ROOT, 'en/guides'))) if (existsSync(join(ROOT, 'en/guides', d, 'index.html'))) out.push(`en/guides/${d}/index.html`);
  return out;
};

test('every English page: the same SVG logo in the header, started from <head> by logo-once.js; footer static; no inline script', () => {
  const pages = EN_PAGES();
  assert.ok(pages.length >= 200, `${pages.length} English pages`);
  assert.equal(LOGO_ANIMATED_EN, LOGO_ANIMATED_SVG(), 'the Russian header\'s SVG, byte for byte');
  for (const p of pages) {
    const h = read(p);
    if (!h.includes('class="site-header"')) continue;
    assert.ok(h.includes(`<a class="brand" href="/en/">${LOGO_ANIMATED_EN}</a>`), `${p}: header logo`);
    // assets/motion.js only where it has something to do: the home (reveal, parallax) and the country pages (reveal, the
    // jump bar's spy) — never on the guides, the guide list or the destinations hub (owner, 2026-10-21).
    // The region pages (seo/regions.mjs) are static lists like the hub: no motion.
    const wantsMotion = p === 'en/index.html' || (/^en\/esim\/[^/]+\/index\.html$/.test(p) && !REGION_SLUGS.some((r) => p === `en/esim/${r}/index.html`));
    const tag = wantsMotion ? LOGO_ONCE_SCRIPT_MOTION : LOGO_ONCE_SCRIPT;
    assert.equal(h.split(tag).length - 1, 1, `${p}: one logo-once.js${wantsMotion ? ' naming motion.js' : ' without motion.js'}`);
    assert.equal(h.includes('data-motion-src'), wantsMotion, `${p}: motion.js ${wantsMotion ? 'named' : 'not named'}`);
    assert.ok(h.indexOf(tag) < h.indexOf('<link rel="stylesheet"'), `${p}: logo-once.js before the stylesheets (before first paint)`);
    assert.equal(h.split('brand-logo').length - 1, 1, `${p}: one animated logo (the footer keeps the image)`);
    assert.doesNotMatch(h, /<script>(?!\s*<\/script>)/, `${p}: no inline script — the CSP refuses it`);
    assert.doesNotMatch(h, /<script src="\/assets\/motion\.js/, `${p}: motion.js is never a <script> tag of its own (logo-once.js loads it, async)`);
  }
});

test('assets/logo-once.js: data-motion, its sessionStorage flags, the logo class, at most assets/motion.js, the one language key — nothing else', () => {
  const js = read('assets/logo-once.js');
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.match(code, /r\.setAttribute\('data-motion', 'expressive'\)/, 'turns the interface motion on, as the RU header script does');
  assert.match(HEADER_MOTION_SCRIPT, /setAttribute\('data-motion','expressive'\)/, 'the same value as the RU script');
  assert.match(code, /getItem\('me-logo'\)/);
  assert.match(code, /setItem\('me-logo', '1'\)/);
  assert.match(code, /classList\.add\('lm-once'\)/);
  assert.match(HEADER_MOTION_SCRIPT, /getItem\('me-logo'\)/, 'the Russian script uses the same key: once per visit across both languages');
  // the one script it may add: assets/motion.js, from its own tag's data-motion-src, checked against that path
  assert.equal((code.match(/createElement\(/g) || []).length, 1);
  assert.match(code, /createElement\('script'\)/);
  assert.match(code, /getAttribute\('data-motion-src'\)/);
  assert.match(code, /\^\\\/assets\\\/motion\\\.js/, 'the src is checked to be assets/motion.js');
  assert.match(MOTION_JS_URL, /^\/assets\/motion\.js\?v=[0-9a-f]{8}$/);
  // The language choice (owner, 2026-10-23; seo/test-lang-route.mjs): ONE localStorage key, written only, and the page's
  // own origin read to recognise an arrival from a Russian page — nothing else of either.
  assert.deepEqual(code.match(/localStorage[^;]*/g), ["localStorage.setItem(KEY, lang)"]);
  assert.match(code, /var KEY = 'mesim\.site\.lang'/);
  assert.deepEqual(code.match(/location\.[a-z]+/gi), ['location.origin']);
  for (const re of [/\bfetch\b/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /indexedDB/, /document\.cookie/, /location\.(?!origin\b)/, /\.replace\(|\.assign\(|href\s*=/, /innerHTML/, /\bimport\b/, /\beval\b/, /new Function/]) {
    assert.doesNotMatch(code, re, String(re));
  }
});

test('the English CSP is unchanged: script-src \'self\' only', () => {
  for (const p of ['en/index.html', 'en/esim/thailand/index.html', 'en/esim/index.html', 'en/guides/iphone/index.html']) {
    const csp = (read(p).match(/Content-Security-Policy" content="([^"]+)"/) || [])[1];
    assert.ok(csp, `${p}: CSP`);
    assert.match(csp, /(?:^|; )script-src 'self'(?:;|$)/, p);
    assert.doesNotMatch(csp, /unsafe-inline|sha256-|nonce-/, p);
  }
});
