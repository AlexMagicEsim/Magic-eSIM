// THE REFERRER HAND-OFF (post-migration audit P2, 2026-11-07). A search or referral visit that reaches an OLD Russian
// address passes through its client-side redirect page (seo/build-legacy-redirects.mjs), so the new page used to see
// our own old address as document.referrer: the attribution capture (assets/country-tariffs.js = ru/index.html, pinned
// byte for byte by seo/test-attribution.mjs) and Metrika both filed it as «direct». Now the Russian redirect page leaves
// the external referrer in sessionStorage['magic_legacy_ref'] = { r, to, ts }, and the target page — only that path,
// only within LEGACY_REF_MAX_AGE_MS — gives it to the capture (which then removes it) and to `ym(…,"init",{referrer})`.
// The English redirect pages hand nothing over (no counter, no capture there; the international Privacy Policy lists
// every storage key). None of this moves a page's lastmod (seo/build-sitemap.mjs stripLegacyReferrer).
//
// Everything below is executed, not read: the generated script, the capture block and the counter snippet run against
// small stubs. Each rule's first assertion proves it fires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redirectPage, legacyRedirects, LEGACY_REF_KEY, LEGACY_REF_MAX_AGE_MS } from './build-legacy-redirects.mjs';
import { contentHash, stripLegacyReferrer } from './build-sitemap.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const ORIGIN = 'https://magicesim.store';
const SEARCH = 'https://yandex.ru/search/?text=esim+turkey';

const storage = (store = {}, { blocked = false } = {}) => ({
  store,
  getItem: (k) => { if (blocked) throw new Error('blocked'); return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: (k, v) => { if (blocked) throw new Error('blocked'); store[k] = String(v); },
  removeItem: (k) => { if (blocked) throw new Error('blocked'); delete store[k]; },
});

/** Runs a redirect page's one script: returns where it sent the browser and what it stored. */
function runRedirect(html, { referrer = '', search = '', hash = '', blocked = false } = {}) {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const ss = storage({}, { blocked });
  let to = null;
  const location = { origin: ORIGIN, search, hash, replace: (u) => { to = u; } };
  new Function('sessionStorage', 'location', 'document', script)(ss, location, { referrer });
  return { to, stored: ss.store[LEGACY_REF_KEY] ? JSON.parse(ss.store[LEGACY_REF_KEY]) : null };
}

/** Runs the attribution capture block of ru/index.html (= assets/country-tariffs.js). */
function runCapture({ referrer = '', pathname = '/ru/esim/turkey/', search = '', store = {} } = {}) {
  const src = read('ru/index.html');
  const start = src.indexOf("var AK='magic_attr';");
  const end = src.indexOf('}catch(e){}', src.indexOf('sessionStorage.setItem(AK,JSON.stringify(ar));', start)) + '}catch(e){}'.length;
  const body = src.slice(src.lastIndexOf('try{', start), end);
  const ss = storage(store);
  new Function('sessionStorage', 'location', 'document', 'URLSearchParams', body)(ss, { search, pathname, origin: ORIGIN }, { referrer }, URLSearchParams);
  return { rec: ss.store.magic_attr ? JSON.parse(ss.store.magic_attr) : null, store: ss.store };
}

/** Runs a Russian page's counter snippet with a stub ym and returns the init options. */
function runCounter(rel, { pathname, store = {} }) {
  const src = read(rel);
  const snippet = src.match(/<!-- Yandex\.Metrika counter -->\s*<script type="text\/javascript">([\s\S]*?)<\/script>/)[1]
    .replace(/\(function\(m,e,t,r,i,k,a\)[^\n]*\n/, ''); // the loader line: tag.js is never fetched here
  const calls = [];
  new Function('sessionStorage', 'location', 'ym', snippet)(storage(store), { pathname }, (...a) => calls.push(a));
  const init = calls.find((c) => c[1] === 'init');
  assert.ok(init, `${rel}: ym init ran`);
  return init[2];
}

const handed = (to, { r = SEARCH, ts = Date.now() } = {}) => ({ [LEGACY_REF_KEY]: JSON.stringify({ r, to, ts }) });

test('a Russian redirect page hands an external referrer over for its own target, and still redirects', () => {
  const html = redirectPage('/esim/turkey/', '/ru/esim/turkey/');
  const out = runRedirect(html, { referrer: SEARCH, search: '?utm_source=x', hash: '#plans' });
  assert.equal(out.to, '/ru/esim/turkey/?utm_source=x#plans', 'the redirect is unchanged');
  assert.equal(out.stored.r, SEARCH, 'the proof: the real referrer is handed over');
  assert.equal(out.stored.to, '/ru/esim/turkey/');
  assert.ok(Math.abs(Date.now() - out.stored.ts) < 5000);
  // never our own referrer, never a missing one; a blocked storage never stops the redirect
  assert.equal(runRedirect(html, { referrer: `${ORIGIN}/ru/` }).stored, null, 'our own page is not a referral');
  assert.equal(runRedirect(html, { referrer: ORIGIN }).stored, null);
  assert.equal(runRedirect(html, { referrer: '' }).stored, null);
  assert.equal(runRedirect(html, { referrer: 'https://magicesim.store.evil.com/' }).stored.r, 'https://magicesim.store.evil.com/', 'a look-alike is not ours');
  assert.equal(runRedirect(html, { referrer: SEARCH, blocked: true }).to, '/ru/esim/turkey/');
  assert.equal(runRedirect(redirectPage('/esim/x/', '/ru/esim/x/'), { referrer: `https://a.example/${'x'.repeat(900)}` }).stored.r.length, 500, 'capped');
});

test('an English redirect page hands nothing over; every Russian one does, and each CSP hash still matches its script', () => {
  const en = redirectPage('/en/esim/turkey/', '/destinations/turkey/');
  assert.doesNotMatch(en, new RegExp(LEGACY_REF_KEY), 'the proof: no storage key on the English site');
  assert.equal(runRedirect(en, { referrer: SEARCH }).stored, null);
  const all = legacyRedirects().filter((r) => r.html);
  const ru = all.filter((r) => !r.path.startsWith('/en/'));
  assert.ok(ru.length > 200 && all.length - ru.length > 200, `${ru.length} Russian, ${all.length - ru.length} English`);
  for (const r of all) {
    const committed = read(r.file);
    assert.equal(committed, r.html, `${r.file} is the generator's output`);
    assert.equal(new RegExp(LEGACY_REF_KEY).test(committed), !r.path.startsWith('/en/'), r.file);
  }
});

test('the capture takes the handed-over referrer on that page only, within a minute, once', () => {
  // the bug: without the hand-off the page sees only our own old address
  assert.equal(runCapture({ referrer: `${ORIGIN}/esim/turkey/` }).rec.referrer, undefined, 'the proof: the hop alone loses the source');
  const { rec, store } = runCapture({ referrer: `${ORIGIN}/esim/turkey/`, store: handed('/ru/esim/turkey/') });
  assert.equal(rec.referrer, SEARCH, 'the real source is recorded');
  assert.equal(rec.entry, '/ru/esim/turkey/');
  assert.equal(store[LEGACY_REF_KEY], undefined, 'taken once');
  // another page, an old hand-off, a junk record: ignored (and still cleared)
  assert.equal(runCapture({ referrer: `${ORIGIN}/esim/turkey/`, pathname: '/ru/esim/italy/', store: handed('/ru/esim/turkey/') }).rec.referrer, undefined);
  assert.equal(runCapture({ referrer: `${ORIGIN}/esim/turkey/`, store: handed('/ru/esim/turkey/', { ts: Date.now() - LEGACY_REF_MAX_AGE_MS - 1 }) }).rec.referrer, undefined);
  assert.equal(runCapture({ referrer: `${ORIGIN}/esim/turkey/`, store: { [LEGACY_REF_KEY]: '{not json' } }).rec.entry, '/ru/esim/turkey/');
  assert.equal(runCapture({ referrer: `${ORIGIN}/esim/turkey/`, store: handed('/ru/esim/turkey/', { r: `${ORIGIN}/ru/` }) }).rec.referrer, undefined, 'never our own address');
  // a real external referrer of the page itself always wins over a hand-off
  assert.equal(runCapture({ referrer: 'https://google.com/', store: handed('/ru/esim/turkey/') }).rec.referrer, 'https://google.com/');
  // the two capture copies are still one (seo/test-attribution.mjs pins them byte for byte)
  assert.ok(read('assets/country-tariffs.js').includes("sessionStorage.removeItem('magic_legacy_ref')"));
});

test('the counter of every Russian landing page passes the handed-over referrer to Metrika, and only then', () => {
  const pages = [['ru/esim/turkey/index.html', '/ru/esim/turkey/'], ['ru/esim/index.html', '/ru/esim/'],
    ['ru/esim/compatibility/index.html', '/ru/esim/compatibility/'], ['ru/iphone.html', '/ru/iphone.html'], ['ru/android.html', '/ru/android.html']];
  assert.equal(runCounter(pages[0][0], { pathname: pages[0][1], store: handed(pages[0][1]) }).referrer, SEARCH, 'the proof');
  for (const [rel, path] of pages) {
    const opts = runCounter(rel, { pathname: path, store: handed(path) });
    assert.equal(opts.referrer, SEARCH, rel);
    assert.equal(opts.webvisor, true, `${rel}: the counter's own options are kept`);
    assert.equal(runCounter(rel, { pathname: path, store: {} }).referrer, undefined, `${rel}: nothing handed over, nothing added`);
    assert.equal(runCounter(rel, { pathname: '/ru/', store: handed(path) }).referrer, undefined, `${rel}: another page's hand-off`);
  }
  // every page the Russian redirect pages lead to carries the reader
  const targets = new Set(legacyRedirects().filter((r) => r.html && !r.path.startsWith('/en/')).map((r) => r.target.replace(/index\.html$/, '')));
  for (const t of targets) {
    const rel = t.endsWith('/') ? `${t.slice(1)}index.html` : t.slice(1);
    assert.match(read(rel), /var MAGIC_YM_REF=/, `${rel} (a redirect target) reads the hand-off`);
  }
});

test('the hand-off moves no lastmod: its lines are put back to exactly the form before them', () => {
  const before = '  <script>\n    ym(110393848,"init",{clickmap:true,webvisor:true});\n  </script>\n      var aown=1;\n<main>x</main>';
  const after = '  <script>\n    var MAGIC_YM_REF=(function(){/* magic_legacy_ref */})();\n    ym(110393848,"init",Object.assign({clickmap:true,webvisor:true},MAGIC_YM_REF));\n  </script>\n      var aown=1;\n      try{sessionStorage.getItem(\'magic_legacy_ref\')}catch(e){}\n<main>x</main>';
  assert.notEqual(after, before, 'the proof: the pages really changed');
  assert.equal(stripLegacyReferrer(after), before);
  assert.equal(contentHash(after), contentHash(before));
  assert.notEqual(contentHash(after.replace('<main>x', '<main>y')), contentHash(before), 'a change inside <main> still moves it');
  // on the real built page
  const page = read('ru/esim/turkey/index.html');
  assert.match(page, /MAGIC_YM_REF/);
  assert.doesNotMatch(stripLegacyReferrer(page), /magic_legacy_ref|MAGIC_YM_REF/);
});

test('the production verifier (scripts/verify-pages-migration.mjs) still reads every redirect page, Russian and English', async () => {
  const { readRedirect } = await import('../scripts/verify-pages-migration.mjs');
  assert.equal(JSON.parse(readRedirect(redirectPage('/esim/turkey/', '/ru/esim/turkey/')).js), '/ru/esim/turkey/', 'the proof: a page with the hand-off');
  assert.equal(readRedirect('<script>alert(1);location.replace("/ru/"+location.search+location.hash)</script>').js, 'null', 'any other script is not a redirect page');
  for (const r of legacyRedirects().filter((x) => x.html)) {
    const x = readRedirect(r.html);
    assert.equal(JSON.parse(x.js), r.target, `${r.path}: script`);
    assert.equal(x.refresh, r.target, `${r.path}: refresh`);
  }
});
