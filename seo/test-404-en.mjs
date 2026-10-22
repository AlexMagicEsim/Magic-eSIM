/* An unknown page under a prefixed language (/en/ today) gets that language's
 * 404 — and no counter.
 *
 * GitHub Pages serves ONE 404.html for the whole site, and that file also
 * routes the /pay/ links. Until 2026-10-05 an unknown /en/ path fell through
 * to the Russian not-found screen («Страница не найдена», a link to the
 * Russian home) and loaded Metrika with Webvisor: the only English page with
 * analytics was the error page. The English site carries none until the
 * consent decision.
 *
 * Since I18N-08b the branch reads one table, NOT_FOUND, keyed by URL prefix —
 * exactly the registry's published prefixed languages — so a language enabled
 * later gets its own 404 by adding its words, not a new branch.
 *
 * Run: node --test seo/test-404-en.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { prefixedSiteLocales } from './locales.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = readFileSync(join(ROOT, '404.html'), 'utf8');
const ROUTING = S.slice(S.indexOf('// --- routing'));
const BRANCH = '} else if(prefixedLocale(path)){';
const bodyOf = (fn) => { const at = S.indexOf(`function ${fn}(`); const rest = S.slice(at + 1); return rest.slice(0, rest.indexOf('\n    function ')); };

/** The table and its two functions, run on their own with a stub page. */
function screen(path) {
  const from = S.indexOf('    var NOT_FOUND = {');
  const to = S.indexOf('\n    function ', S.indexOf('function showNotFoundLocale(') + 1);
  const page = { documentElement: { lang: 'ru' }, title: 'Оплата' };
  const card = { innerHTML: '' };
  const ctx = vm.createContext({ document: page, card, path });
  vm.runInContext(`${S.slice(from, to)}\nvar code = prefixedLocale(path); if (code) showNotFoundLocale(code);`, ctx);
  return { code: ctx.code, lang: page.documentElement.lang, title: page.title, html: card.innerHTML };
}

test('there is ONE prefixed-language branch, after the /pay/ guard and before the counting else', () => {
  const at = ROUTING.indexOf(BRANCH);
  assert.ok(at > 0, 'no prefixed-language branch');
  assert.equal(ROUTING.split(BRANCH).length, 2);
  assert.ok(ROUTING.indexOf("/^\\/pay\\//.test(path)") < at, 'the /pay/ prefix guard must stay first');
  assert.ok(at < ROUTING.lastIndexOf('loadMetrika();'), 'the branch must precede the counting else');
  assert.doesNotMatch(ROUTING, /\/\^\\\/en/, 'no route of one language is typed into the router');
});

test('the branch shows that language\'s screen and never loads the counter', () => {
  const at = ROUTING.indexOf(BRANCH);
  const branch = ROUTING.slice(at, ROUTING.indexOf('} else {', at));
  assert.match(branch, /showNotFoundLocale\(prefixedLocale\(path\)\);/);
  assert.doesNotMatch(branch, /loadMetrika|showNotFound\(\)/);
  assert.doesNotMatch(bodyOf('showNotFoundLocale'), /loadMetrika|ym\(/);
  assert.doesNotMatch(bodyOf('prefixedLocale'), /loadMetrika|ym\(/);
  // Still exactly one counter call, on the Russian not-found branch.
  assert.equal((S.match(/loadMetrika\(\);/g) || []).length, 1);
});

test('the table holds exactly the registry\'s published prefixed languages', () => {
  const ctx = vm.createContext({});
  const from = S.indexOf('    var NOT_FOUND = {');
  vm.runInContext(S.slice(from, S.indexOf('};', from) + 2), ctx);
  const published = prefixedSiteLocales();
  assert.deepEqual(Object.keys(ctx.NOT_FOUND), published.map((l) => l.prefix));
  for (const l of published) {
    const w = ctx.NOT_FOUND[l.prefix];
    assert.equal(w.lang, l.htmlLang, l.code);
    assert.deepEqual(Object.keys(w), ['lang', 'title', 'h1', 'desc', 'home', 'all'], l.code);
    // Static words only: nothing in them could be markup.
    for (const v of Object.values(w)) assert.doesNotMatch(v, /[<>"&]/, l.code);
  }
});

test('the English screen is English, word for word, and links into the English site only', () => {
  const s = screen('/en/esim/atlantis/');
  assert.equal(s.code, 'en');
  assert.equal(s.lang, 'en');
  assert.equal(s.title, 'Page not found — Magic eSIM');
  assert.equal(s.html, '<h1>Page not found</h1>'
    + '<p class="desc">Check the address, or start again from one of these pages.</p>'
    + '<p class="muted"><a class="home" href="/en/">Magic eSIM home</a> · <a class="home" href="/en/esim/">All destinations</a></p>');
  assert.doesNotMatch(s.html, /[А-Яа-яЁё]/);
});

test('the branch matches each published prefix (/en, /es …), and nothing that merely starts with one or names an unpublished language', () => {
  for (const p of ['/en', '/en/', '/en/esim/atlantis/', '/en/guides/nope/']) assert.equal(screen(p).code, 'en', p);
  for (const p of ['/es', '/es/', '/es/esim/atlantis/', '/es/guides/nope/']) assert.equal(screen(p).code, 'es', p);
  for (const p of ['/de', '/de/', '/de/esim/atlantis/', '/de/guides/nope/']) assert.equal(screen(p).code, 'de', p);
  for (const p of ['/fr', '/fr/', '/fr/esim/atlantis/', '/fr/guides/nope/']) assert.equal(screen(p).code, 'fr', p);
  for (const p of ['/enter', '/english/', '/espana/', '/esim/en/', '/pay/en/x', '/', '/nope/', '/ko/x', '/deutsch/', '/francais/', '/zh/', '/ko/esim/',
    '/__proto__/', '/constructor/', '/hasOwnProperty/', '/EN/', '//en/']) {
    assert.equal(screen(p).code, null, p);
  }
});
