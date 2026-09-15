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
