// ---------------------------------------------------------------------------
// seo/test-icons.mjs — the gate that did not exist while four page families
// disagreed about their own icons.
//
// Nothing in this repo looked at a <link rel="icon"> before: not a unit test,
// not a Playwright case, not browser-qa.mjs (which filters favicon 404s OUT of
// its console check). So /en/ pointed its tab at a 107 KB 423x320 picture with a
// wordmark baked into it, six tracked pages declared no icon at all, and the
// ~200 country pages declared one of the five. All of that was invisible.
//
// What is checked here is a RELATION, not the existence of a string: every page
// family must declare the SAME set as seo/head-icons.mjs, every href must
// resolve to a file that exists, and the manifest must agree with the pixels in
// the files it names. Test 0 is the mutation: it proves each rule rejects the
// exact defect it was written for, because a rule that never fires is worse than
// no rule (§26.1).
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_LINKS, MANIFEST_LINK, MANIFEST_EXEMPT } from './head-icons.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// A page that only Yandex reads, whose CONTENT is the verification token. Adding
// anything to it would break the verification it exists to carry.
const NOT_A_PAGE = new Set(['yandex_1a8c23f28d1480df.html']);

/** Every icon-ish <link> in a document, as normalised «rel type sizes href». */
function iconLinks(html) {
  const out = [];
  // Comments are stripped before anything is read out of the markup: a <link>
  // quoted inside one is documentation, not a declaration, and counting it
  // would let a page pass this gate while declaring nothing.
  for (const m of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (name) => (tag.match(new RegExp(`${name}="([^"]*)"`, 'i')) || [, ''])[1];
    const rel = attr('rel').toLowerCase();
    if (!/^(icon|shortcut icon|apple-touch-icon|mask-icon|manifest)$/.test(rel)) continue;
    out.push([rel, attr('type'), attr('sizes'), attr('href')].filter(Boolean).join(' '));
  }
  return out;
}
const canonical = (links) => links.map((l) => iconLinks(l)[0]);

const EXPECT_ICONS = canonical(ICON_LINKS);
const EXPECT_FULL = canonical([...ICON_LINKS, MANIFEST_LINK]);

/** Every tracked HTML page, including the ~200 generated country pages. */
function allPages() {
  const pages = ['index.html', 'iphone.html', 'android.html', '404.html',
                 'payment-success.html', 'payment-failed.html', 'privacy.html',
                 'terms.html', 'en/index.html', 'app/index.html',
                 'app/canary.html', 'esim/index.html'];
  for (const d of readdirSync(join(ROOT, 'esim'), { withFileTypes: true })) {
    if (d.isDirectory() && existsSync(join(ROOT, 'esim', d.name, 'index.html'))) {
      pages.push(`esim/${d.name}/index.html`);
    }
  }
  return pages.filter((p) => !NOT_A_PAGE.has(p));
}

// --- 0. the mutations: prove every rule below can actually fail --------------

test('0 — the rules fire on the defects they were written for', () => {
  const good = read('index.html');

  // The /en/ defect: a picture used as a favicon.
  const asLogo = good.replace('<link rel="icon" href="/favicon.ico" sizes="any" />',
                              '<link rel="icon" href="/assets/magic-esim-logo.png" />');
  assert.notDeepEqual(iconLinks(asLogo), EXPECT_FULL,
    'swapping the .ico for the 107 KB logo must not still compare equal');

  // A page that declares nothing, which is what six tracked pages did.
  assert.deepEqual(iconLinks('<html><head><title>x</title></head></html>'), []);

  // A missing apple-touch-icon must be a difference, not a shrug.
  const dropped = good.replace('  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />\n', '');
  assert.notDeepEqual(iconLinks(dropped), EXPECT_FULL);
  assert.equal(iconLinks(dropped).length, EXPECT_FULL.length - 1);

  // And the parser must not be fooled by the word appearing in a comment —
  // three assertions in this repo have already matched a comment and passed.
  assert.deepEqual(iconLinks('<!-- <link rel="icon" href="/nope.png"> -->\n<link rel="icon" href="/ok.ico">'),
                   ['icon /ok.ico'],
                   'a <link> quoted inside a comment is not a declaration');
});

// --- 1. every page declares the canonical set --------------------------------

test('1 — every tracked page declares exactly the canonical set', () => {
  const wrong = [];
  for (const p of allPages()) {
    const expect = MANIFEST_EXEMPT.includes(p) || p.startsWith('app/') ? EXPECT_ICONS : EXPECT_FULL;
    const got = iconLinks(read(p));
    if (JSON.stringify(got) !== JSON.stringify(expect)) wrong.push([p, got]);
  }
  assert.deepEqual(wrong, [], `these pages disagree with seo/head-icons.mjs:\n${
    wrong.map(([p, g]) => `  ${p}\n    ${g.join('\n    ')}`).join('\n')}`);
});

test('2 — the Mini App is the only family without a manifest, and for its CSP', () => {
  for (const p of ['app/index.html', 'app/canary.html']) {
    const html = read(p);
    // Strip comments FIRST. The first version of this test matched the word
    // «manifest-src» inside the comment that explains why there is no
    // manifest-src, and failed a page that was correct — the fourth time in this
    // repo an assertion has read a comment as if it were code.
    const code = html.replace(/<!--[\s\S]*?-->/g, '');
    assert.ok(!/rel="manifest"/.test(code), `${p} must not link a manifest`);
    assert.match(code, /default-src 'none'/, `${p}'s exemption rests on this CSP`);
    assert.ok(!/manifest-src/.test(code),
      `${p} declares manifest-src — the exemption's reason is gone, revisit it`);
  }
});

// --- 3. the files behind the hrefs -------------------------------------------

/** width and height out of a PNG's IHDR, without a library. */
function pngSize(buf) {
  assert.equal(buf.slice(1, 4).toString('ascii'), 'PNG', 'not a PNG');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

test('3 — every referenced icon exists, is non-empty and is the size it claims', () => {
  const hrefs = new Set();
  for (const p of allPages()) {
    for (const link of iconLinks(read(p))) hrefs.add(link.split(' ').pop());
  }
  for (const href of hrefs) {
    assert.ok(href.startsWith('/'), `${href} must be root-absolute`);
    const file = join(ROOT, href.slice(1));
    assert.ok(existsSync(file), `${href} is declared but no such file exists`);
    assert.ok(statSync(file).size > 0, `${href} is empty`);
  }
  assert.deepEqual(pngSize(readFileSync(join(ROOT, 'favicon-32.png'))), [32, 32]);
  assert.deepEqual(pngSize(readFileSync(join(ROOT, 'apple-touch-icon.png'))), [180, 180]);
});

test('4 — no page uses a photograph or the wordmark logo as an icon', () => {
  const bad = [];
  for (const p of allPages()) {
    for (const link of iconLinks(read(p))) {
      const href = link.split(' ').pop();
      if (/magic-esim-logo|banner/.test(href)) bad.push([p, href]);
    }
  }
  assert.deepEqual(bad, [],
    'assets/magic-esim-logo.png is 423x320 and carries the wordmark — it cannot be a favicon');
});

test('5 — icons stay small enough to be icons', () => {
  // A tab icon is fetched on every cold page load. The cap is generous; what it
  // stops is another 107 KB picture quietly becoming the favicon.
  const cap = { 'favicon.ico': 16_384, 'favicon.svg': 4_096, 'favicon-32.png': 8_192,
                'apple-touch-icon.png': 64_000, 'icon-192.png': 64_000, 'icon-512.png': 200_000 };
  for (const [name, max] of Object.entries(cap)) {
    const size = statSync(join(ROOT, name)).size;
    assert.ok(size <= max, `${name} is ${size} bytes, over the ${max} cap`);
  }
});

// --- 6. the manifest ----------------------------------------------------------

test('6 — the manifest parses and agrees with the files it names', () => {
  const m = JSON.parse(read('site.webmanifest'));
  assert.equal(m.name, 'Magic eSIM');
  assert.equal(m.start_url, '/');
  assert.ok(Array.isArray(m.icons) && m.icons.length >= 2);
  for (const icon of m.icons) {
    const file = join(ROOT, icon.src.slice(1));
    assert.ok(existsSync(file), `manifest names ${icon.src}, which does not exist`);
    const [w, h] = pngSize(readFileSync(file));
    assert.equal(`${w}x${h}`, icon.sizes,
      `${icon.src} is ${w}x${h} but the manifest says ${icon.sizes}`);
  }
  // Chrome needs a 192 and a 512 before it will offer to install anything.
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'), sizes.join(','));
});

// --- 7. the generators must not grow their own copy ---------------------------

test('7 — the three generators take their icons from head-icons.mjs', () => {
  for (const g of ['build-catalogue-pages.mjs', 'build-hub.mjs', 'build-guides.mjs']) {
    const src = read(`seo/${g}`).replace(/<!--[\s\S]*?-->|\/\/[^\n]*/g, '');
    assert.match(src, /headIcons\(/, `${g} must render the shared block`);
    assert.ok(!/rel="icon"|apple-touch-icon"/.test(src),
      `${g} has grown its own icon markup again — put it in head-icons.mjs`);
  }
});

// --- 8. the small icons are the brand mark, not the old generic M -------------

/**
 * Decode an 8-bit truecolour, non-interlaced PNG to {w, h, px:(x,y)=>[r,g,b]}.
 * Thirty lines of zlib and un-filtering, so this gate can look at what the icon
 * actually LOOKS like rather than at the markup that points to it. Every check
 * below fires on the previous icon — see the mutation at the end.
 */
function pngPixels(buf) {
  assert.equal(buf.readUInt32BE(8 + 4) && buf.toString('ascii', 12, 16), 'IHDR');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  assert.equal(buf[24], 8, 'expected 8-bit');
  // Truecolour with or without alpha. Accepting BOTH is not tidiness: the icon
  // this replaced is RGBA, and a decoder that refused it would have failed the
  // mutation test for the wrong reason — which looks exactly like a rule that
  // works, and is how a gate ends up proving nothing.
  const colour = buf[25];
  assert.ok(colour === 2 || colour === 6, `expected truecolour PNG, got colour type ${colour}`);
  assert.equal(buf[28], 0, 'expected non-interlaced');
  const idat = [];
  for (let off = 8; off < buf.length; ) {
    const len = buf.readUInt32BE(off);
    if (buf.toString('ascii', off + 4, off + 8) === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = colour === 6 ? 4 : 3, stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[y * stride + i - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= bpp ? out[(y - 1) * stride + i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else assert.equal(filter, 0, `unsupported PNG filter ${filter}`);
      out[y * stride + i] = v & 0xff;
    }
  }
  // Composited over white, because that is what a light browser tab renders —
  // a transparent ground and a white ground look the same there, and the claim
  // being checked is «the mark sits on light, not the other way round».
  return { w, h, px: (x, y) => {
    const i = y * stride + x * bpp;
    const a = bpp === 4 ? out[i + 3] / 255 : 1;
    return [0, 1, 2].map((k) => Math.round(out[i + k] * a + 255 * (1 - a)));
  } };
}

/** Share of near-white pixels. The mark sits ON white; the old icon was inverted. */
function whiteShare(png) {
  let white = 0;
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) {
    if (png.px(x, y).every((c) => c > 235)) white++;
  }
  return white / (png.w * png.h);
}

test('8 — the tab icon is the brand M on white, not the old white-M-on-blue tile', () => {
  const svg = read('favicon.svg');
  // The mark is drawn in the brand gradient on a white ground — the logo's own
  // arrangement, and the inverse of what shipped before.
  assert.match(svg, /<rect[^>]*fill="#ffffff"/, 'the ground must be white');
  assert.match(svg, /stroke="url\(#g\)"/, 'the M itself must carry the gradient');
  // Round caps and joins are what made the old M read as a generic letter. The
  // logo's corners are mitered: a sharp V, flat-cut apexes.
  assert.ok(!/stroke-line(cap|join)="round"/.test(svg), 'the mark has no round joins');
  assert.match(svg, /stroke-linejoin="miter"/);
  assert.match(svg, /stroke-miterlimit="2\.5"/, 'the limit is what bevels the apexes and keeps the V sharp');

  const png = pngPixels(readFileSync(join(ROOT, 'favicon-32.png')));
  const share = whiteShare(png);
  assert.ok(share >= 0.45,
    `favicon-32.png is ${(share * 100).toFixed(1)}% white — the mark should sit on a white ground. ` +
    'The icon this replaced measures 19.5% by this same reading: a coloured tile with a white letter cut out of it.');
  // and it must not be blank: the mark has to be there
  let coloured = 0;
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) {
    const [r, g, b] = png.px(x, y);
    if (Math.max(r, g, b) - Math.min(r, g, b) > 60) coloured++;
  }
  assert.ok(coloured / (png.w * png.h) > 0.15, 'no mark visible in favicon-32.png');

  // The path the old icon drew must not come back anywhere.
  for (const p of ['favicon.svg', ...allPages()]) {
    assert.ok(!/M17 47 V17 L32 37 L47 17 V47/.test(read(p)), `${p} still draws the old M`);
  }
  assert.deepEqual(sorted(icoSizes()), [[16, 16], [32, 32], [48, 48]]);
});

const sorted = (a) => a.slice().sort((x, y) => x[0] - y[0]);

/** The sizes stored in favicon.ico, from its directory table. */
function icoSizes() {
  const b = readFileSync(join(ROOT, 'favicon.ico'));
  assert.equal(b.readUInt16LE(2), 1, 'not an .ico');
  const n = b.readUInt16LE(4);
  return Array.from({ length: n }, (_, i) => {
    const e = 6 + i * 16;
    return [b[e] || 256, b[e + 1] || 256];
  });
}
