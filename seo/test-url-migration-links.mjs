// The EN-root migration (owner, 2026-11-07), held on the BUILT tree: English at the root, Russian under /ru/.
//
//   1. No published page names an old address — one that moved (seo/url-migration.mjs newPath): not in a
//      link, a script or style, a canonical, an hreflang, og:url, nor a JSON-LD url / @id / item. Internal links go
//      straight to the final address — the old addresses' client-side redirect pages (PR 4/4) are for the outside world. The ONE exception is named and narrow: the
//      owner-approved Terms text «Website: https://magicesim.store/en/» (scripts/build-pages-artifact.mjs
//      LEGAL_TEXT_OLD_LINK), which is never edited without the owner.
//   2. «/» is the English home: lang="en", no Metrika, the language suggestion first in <head>. /ru/ is the Russian
//      home: lang="ru", Metrika, no language suggestion.
//   3. The Russian checkout (assets/ru-checkout.js, assets/country-tariffs.js) loads only on /ru/esim/<country>/, and no
//      Russian page loads the international checkout (en/checkout.js) or prints a dollar price.
//   (Every local reference resolving in the built tree is seo/test-pages-artifact.mjs; hreflang reciprocity in every
//   language is seo/test-i18n-indexing.mjs; the lang-route matrix is seo/test-lang-route.mjs and lang-route.spec.js.)
//
// Each rule's first assertion proves it fires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planArtifact, LEGAL_TEXT_OLD_LINK } from '../scripts/build-pages-artifact.mjs';
import { newPath } from './url-migration.mjs';
import { LOCALES, cataloguePath } from './locales.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const HTML = planArtifact(ROOT).publish.filter((f) => f.endsWith('.html'));

/** Every site-internal address a page names, absolute or root-relative: [{ where, url }]. Relative links are resolved. */
export function namedAddresses(html, rel) {
  const out = [];
  const base = new URL(`${SITE}/${rel.replace(/(^|\/)index\.html$/, '$1')}`);
  const add = (where, raw) => {
    if (!raw || /^(mailto:|tel:|data:|javascript:|#)/i.test(raw)) return;
    let u;
    try { u = new URL(raw, base); } catch { return; }
    if (u.origin !== SITE) return;
    out.push({ where, url: u.pathname });
  };
  const markup = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const m of markup.matchAll(/<(a|link|script|img|source|iframe|form)\b[^>]*?\s(href|src|action)="([^"]*)"/gi)) add(`${m[1]} ${m[2]}`, m[3]);
  for (const m of markup.matchAll(/<meta\b[^>]*property="og:url"[^>]*content="([^"]*)"/gi)) add('og:url', m[1]);
  for (const m of markup.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    for (const s of m[1].matchAll(/"(?:url|@id|item)"\s*:\s*"([^"]+)"/g)) add('JSON-LD', s[1].replace(/#.*$/, ''));
  }
  return out;
}

/** Old addresses a page still names (they moved): the migration's broken promise. */
export function redirectedAddresses(html, rel) {
  return namedAddresses(html, rel)
    .filter(({ url }) => newPath(url) !== null)
    .filter(({ url }) => !(url === LEGAL_TEXT_OLD_LINK.url && LEGAL_TEXT_OLD_LINK.from.test(rel)));
}

test('no published page names an old (moved) address — links, assets, canonical, hreflang, og:url, JSON-LD', () => {
  // the rule fires: every kind of reference to an old address is seen
  const bad = '<a href="/esim/turkey/">x</a><link rel="canonical" href="https://magicesim.store/en/esim/italy/">'
    + '<link rel="alternate" hreflang="en" href="https://magicesim.store/en/"><meta property="og:url" content="https://magicesim.store/iphone.html">'
    + '<script type="application/ld+json">{"item":"https://magicesim.store/en/guides/iphone/"}</script><a href="../../../esim/">r</a>';
  assert.equal(redirectedAddresses(bad, 'ru/esim/x/index.html').length, 6);
  assert.deepEqual(redirectedAddresses('<a href="/en/">t</a>', 'en/terms/index.html'), [], 'the one named legal-text exception');
  assert.equal(redirectedAddresses('<a href="/en/">t</a>', 'en/privacy/index.html').length, 1, '…and only on a Terms page');
  assert.ok(HTML.length > 1500, `the published pages were read (${HTML.length})`);
  const found = [];
  for (const rel of HTML) for (const x of redirectedAddresses(read(rel), rel)) found.push(`${rel}: ${x.where} ${x.url}`);
  assert.deepEqual(found.slice(0, 20), [], `${found.length} reference(s) to a redirected address`);
});

test('no old page file is left in the tree as a page: the moved pages live only at their new addresses', () => {
  for (const rel of ['esim/index.html', 'esim/turkey/index.html', 'iphone.html', 'android.html', 'en/index.html', 'en/esim/index.html',
    'en/esim/turkey/index.html', 'en/guides/index.html', 'en/guides/iphone/index.html']) {
    assert.equal(existsSync(join(ROOT, rel)), false, `${rel} must be gone (git rm)`);
  }
  for (const rel of ['index.html', 'ru/index.html', 'ru/esim/index.html', 'ru/esim/turkey/index.html', 'ru/iphone.html', 'ru/android.html',
    'destinations/index.html', 'destinations/turkey/index.html', 'guides/index.html', 'guides/iphone/index.html',
    'en/terms/index.html', 'en/legal-versions.json', 'en/checkout-statements.json', 'terms.html', 'privacy.html',
    'payment-success.html', 'payment-failed.html']) {
    assert.ok(existsSync(join(ROOT, rel)), `${rel} exists`);
  }
});

test('«/» is the English home with no counter; /ru/ is the Russian home with Metrika; only «/» suggests a language', () => {
  const counter = /mc\.yandex\.ru|ym\(\d+/;
  assert.match('<script>ym(110393848,"init")</script>', counter, 'the rule fires');
  const en = read('index.html');
  assert.match(en, /^<!doctype html>\n<html lang="en">/i);
  assert.doesNotMatch(en, counter, '«/» loads no Metrika');
  assert.match(en.slice(0, en.indexOf('<title>')), /<script src="\/assets\/lang-route\.js\?v=[0-9a-f]{8}"><\/script>/);
  const ru = read('ru/index.html');
  assert.match(ru, /<html lang="ru">/);
  assert.match(ru, /mc\.yandex\.ru\/metrika\/tag\.js/, '/ru/ keeps Metrika');
  assert.doesNotMatch(ru, /lang-route\.js/, '/ru/ never moves anyone');
  // every other English page carries no counter either (404.html counts only the Russian not-found screen)
  for (const rel of HTML.filter((f) => /^(destinations|guides)\//.test(f))) assert.doesNotMatch(read(rel), counter, rel);
});

test('the Russian checkout runs only on /ru/esim/<country>/; no Russian page loads the international checkout or a dollar price', () => {
  const RU_CHECKOUT = /<script src="\/assets\/(ru-checkout|country-tariffs)\.js/;
  const countries = new Set(JSON.parse(read('seo/catalogue-countries.json')).countries.map((c) => c.slug));
  assert.ok(countries.has('turkey'));
  let pages = 0;
  for (const rel of HTML) {
    const html = read(rel);
    const m = rel.match(/^ru\/esim\/([a-z0-9-]+)\/index\.html$/);
    const isRuCountry = Boolean(m && countries.has(m[1]));
    if (isRuCountry) {
      pages++;
      assert.match(html, /<script src="\/assets\/country-tariffs\.js\?v=[0-9a-f]{8}" defer><\/script>/, rel);
      assert.match(html, /<script src="\/assets\/ru-checkout\.js\?v=[0-9a-f]{8}" defer><\/script>/, rel);
    } else {
      assert.doesNotMatch(html, RU_CHECKOUT, `${rel}: the Russian checkout off a Russian country page`);
    }
    if (rel.startsWith('ru/')) {
      assert.doesNotMatch(html, /\/en\/checkout\.js|global-catalog\.js/, `${rel}: the international checkout on a Russian page`);
      assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/g, ''), /\$\s?\d|USD\s?\d|\d\s?USD/, `${rel}: a dollar price`);
    }
  }
  assert.equal(pages, countries.size, 'every Russian country page was checked');
  // …and the guides and the hub inside ru/esim/ were among the pages that must not load it
  assert.ok(HTML.includes('ru/esim/payment-rubles/index.html') && HTML.includes('ru/esim/index.html'));
});

test('every language publishes its catalogue where the registry says, and nowhere else', () => {
  for (const l of LOCALES.filter((x) => x.site.enabled)) {
    const dir = cataloguePath(l.code).slice(1);
    assert.ok(HTML.filter((f) => f.startsWith(dir)).length >= 200, `${l.code}: ${dir}`);
  }
  assert.equal(HTML.filter((f) => f.startsWith('esim/') || f.startsWith('en/esim/') || f.startsWith('en/guides/')).length, 0);
});
