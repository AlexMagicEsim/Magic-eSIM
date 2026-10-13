/* The language registry, and the gate that holds every shipped list to it.
 *
 * I18N-01. `seo/locales.mjs` describes seven languages and enables two. This
 * file makes three promises checkable:
 *
 *   1. ONE ANSWER. The Mini App's `LANGS`, the site dictionary's `LANGS` and the
 *      Mini App's dictionaries name exactly the enabled languages of the
 *      registry — a fourth list cannot quietly disagree.
 *   2. NOTHING IS ACTIVATED BY DESCRIBING IT. A described-but-disabled language
 *      has no directory, no sitemap URL, no `<html lang>`, no `hreflang` and no
 *      switcher entry anywhere in the repository. Turning one on is a stage of
 *      the plan that edits the pin below on purpose.
 *   3. TESTS DO NOT BORROW REAL LANGUAGES AS «UNKNOWN». The old fixtures used
 *      `de` and `fr` as the example of a language nobody speaks — both are on
 *      the roadmap, and those tests would have flipped meaning the day German
 *      shipped. The codes the fixtures use now are pinned as NOT in the registry.
 *
 * Run: node --test seo/test-locales.mjs
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LOCALES, X_DEFAULT_CURRENT, X_DEFAULT_DECIDED, SITE,
  locale, siteLocales, appLocales, homeUrl,
} from './locales.mjs';
import { allowedPaths } from './refresh-allowlist.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const DISABLED = LOCALES.filter((l) => !l.site.enabled);
const ENABLED = LOCALES.filter((l) => l.site.enabled);

/** Every published HTML page: the repo minus tooling, tests and dependencies. */
function htmlFiles() {
  const SKIP = new Set(['.git', 'node_modules', 'test', 'test-results', 'playwright-report', 'infra', 'seo', 'scripts']);
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.html')) out.push(relative(ROOT, p));
    }
  }(ROOT));
  return out;
}
const HTML = htmlFiles().map((f) => [f, read(f)]);

/** hreflang values that would be WRONG on a page today. Pure, so it can be shown to fire. */
function foreignHreflangs(pages, enabled) {
  const ok = new Set([...enabled.map((l) => l.hreflang), 'x-default']);
  const bad = [];
  for (const [f, html] of pages) {
    for (const m of html.matchAll(/hreflang="([^"]*)"/g)) if (!ok.has(m[1])) bad.push(`${f}: ${m[1]}`);
  }
  return bad;
}

/** <html lang> values that are not an enabled language. Pure, for the same reason. */
function foreignHtmlLangs(pages, enabled) {
  const ok = new Set(enabled.map((l) => l.htmlLang));
  const bad = [];
  for (const [f, html] of pages) {
    const m = html.match(/<html\b[^>]*\blang="([^"]*)"/);
    if (m && !ok.has(m[1])) bad.push(`${f}: ${m[1]}`);
  }
  return bad;
}

/* ===================================================================== *
 * 1. The registry itself
 * ===================================================================== */

test('the registry describes exactly the seven planned languages, in order', () => {
  assert.deepEqual(LOCALES.map((l) => l.code), ['ru', 'en', 'es', 'de', 'fr', 'zh-Hans', 'ko']);
});

test('codes, prefixes, hreflangs and og:locales are unique', () => {
  for (const field of ['code', 'prefix', 'hreflang', 'htmlLang', 'ogLocale', 'endonym']) {
    const values = LOCALES.map((l) => l[field]);
    assert.equal(new Set(values).size, values.length, `${field} repeats: ${values}`);
  }
});

test('Russian stays at the root and English at /en/ — existing URLs never move', () => {
  assert.equal(locale('ru').prefix, '');
  assert.equal(locale('en').prefix, 'en');
  assert.equal(homeUrl('ru'), `${SITE}/`);
  assert.equal(homeUrl('en'), `${SITE}/en/`);
});

test('Simplified Chinese is /zh/ with the SCRIPT subtag zh-Hans, never a region (owner, 2026-10-13)', () => {
  const zh = locale('zh-Hans');
  assert.equal(zh.prefix, 'zh');
  assert.equal(zh.htmlLang, 'zh-Hans');
  assert.equal(zh.hreflang, 'zh-Hans');
  assert.equal(zh.script, 'Hans');
  assert.equal(locale('zh-CN'), null, 'zh-CN is an alias for detection, not a language of its own');
  // Room for Traditional Chinese later without renaming anything.
  assert.equal(LOCALES.some((l) => l.prefix === 'zh-hant'), false);
});

test('every field is well-formed', () => {
  for (const l of LOCALES) {
    assert.match(l.code, /^[a-z]{2}(-[A-Z][a-z]{3})?$/, l.code);
    assert.equal(l.htmlLang, l.code, `${l.code}: <html lang> is the code itself`);
    assert.equal(l.hreflang, l.code, `${l.code}: hreflang is the code itself`);
    assert.match(l.prefix, /^([a-z]{2})?$/, l.code);
    assert.match(l.ogLocale, /^[a-z]{2}_[A-Z]{2}$/, l.code);
    assert.match(l.script, /^[A-Z][a-z]{3}$/, l.code);
    assert.ok(['ru', 'global'].includes(l.defaultMarket), l.code);
    assert.equal(typeof l.site.enabled, 'boolean');
    assert.equal(typeof l.site.indexableHome, 'boolean');
    assert.equal(typeof l.app.enabled, 'boolean');
    assert.ok(!l.site.indexableHome || l.site.enabled, `${l.code}: an indexable home must exist`);
  }
});

test('only Russian defaults to the rouble market; a language never IS a market', () => {
  assert.deepEqual(LOCALES.filter((l) => l.defaultMarket === 'ru').map((l) => l.code), ['ru']);
});

test('the registry cannot be rewritten at runtime', () => {
  assert.ok(Object.isFrozen(LOCALES));
  for (const l of LOCALES) {
    assert.ok(Object.isFrozen(l) && Object.isFrozen(l.site) && Object.isFrozen(l.app), l.code);
  }
});

test('x-default: today it is the Russian home; the owner decided EN, applied by the indexing stage', () => {
  assert.equal(X_DEFAULT_CURRENT, 'ru');
  assert.equal(X_DEFAULT_DECIDED, 'en');
});

/* ===================================================================== *
 * 2. Nothing new is switched on — I18N-01 pins RU + EN
 * ===================================================================== */

test('exactly Russian and English are enabled, on the site and in the Mini App', () => {
  // A stage that launches a language changes THIS line, deliberately, in the
  // same PR as that language's dictionaries and pages.
  assert.deepEqual(siteLocales(), ['ru', 'en']);
  assert.deepEqual(appLocales(), ['ru', 'en']);
});

test('a disabled language has no directory and no sitemap URL', () => {
  const sitemap = read('sitemap.xml');
  for (const l of DISABLED) {
    assert.equal(existsSync(join(ROOT, l.prefix)), false, `/${l.prefix}/ exists while ${l.code} is disabled`);
    assert.equal(sitemap.includes(`${SITE}/${l.prefix}/`), false, `sitemap lists /${l.prefix}/`);
  }
});

test('every page declares an enabled language and points hreflang only at enabled ones', () => {
  assert.ok(HTML.length >= 400, `only ${HTML.length} pages found — the walk is broken`);
  assert.deepEqual(foreignHtmlLangs(HTML, ENABLED), []);
  assert.deepEqual(foreignHreflangs(HTML, ENABLED), []);
});

test('the language gates can fire', () => {
  // §26.1: a gate that only ever reports «clean» is indistinguishable from one
  // that never ran.
  const fake = [['es/index.html', '<html lang="es"><link rel="alternate" hreflang="es" href="/es/">']];
  assert.deepEqual(foreignHtmlLangs(fake, ENABLED), ['es/index.html: es']);
  assert.deepEqual(foreignHreflangs(fake, ENABLED), ['es/index.html: es']);
  assert.deepEqual(foreignHreflangs([['x', 'hreflang="x-default"']], ENABLED), []);
});

test('no switcher offers a disabled language by its name', () => {
  for (const l of DISABLED) {
    const hit = HTML.find(([, html]) => html.includes(`>${l.endonym}<`));
    assert.equal(hit, undefined, `${l.endonym} appears in ${hit && hit[0]}`);
  }
});

test('each enabled home exists, declares its language and is in the sitemap', () => {
  const sitemap = read('sitemap.xml');
  for (const l of ENABLED) {
    const file = l.prefix ? `${l.prefix}/index.html` : 'index.html';
    assert.match(read(file), new RegExp(`<html lang="${l.htmlLang}"`), file);
    if (l.site.indexableHome) assert.ok(sitemap.includes(`<loc>${homeUrl(l.code)}</loc>`), homeUrl(l.code));
  }
});

test('the home hreflang cluster is exactly the indexable homes plus x-default', () => {
  // Exact, not «contains»: a stray alternate is as wrong as a missing one.
  const want = LOCALES.filter((l) => l.site.indexableHome)
    .map((l) => `${l.hreflang} ${homeUrl(l.code)}`)
    .concat(`x-default ${homeUrl(X_DEFAULT_CURRENT)}`)
    .sort();
  for (const l of LOCALES.filter((x) => x.site.indexableHome)) {
    const file = l.prefix ? `${l.prefix}/index.html` : 'index.html';
    const got = [...read(file).matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)]
      .map((m) => `${m[1]} ${m[2]}`).sort();
    assert.deepEqual(got, want, file);
  }
});

test('the refresh allowlist writes under enabled prefixes only', () => {
  // The catalogue automation fails closed on any path outside its allowlist;
  // a language enabled here without its paths there would stop every refresh,
  // and a path there for a disabled language would be a page nobody approved.
  const prefixes = new Set(ENABLED.map((l) => l.prefix).filter(Boolean));
  const disabled = new Set(DISABLED.map((l) => l.prefix));
  const paths = [...allowedPaths(['thailand'])];
  for (const p of paths) {
    assert.equal(disabled.has(p.split('/')[0]), false, `${p} writes under a disabled language`);
  }
  for (const pre of prefixes) {
    assert.ok(paths.some((p) => p.startsWith(`${pre}/`)), `no generated path under /${pre}/`);
  }
});

/* ===================================================================== *
 * 3. One answer: the shipped lists equal the registry
 * ===================================================================== */

test('the site dictionary speaks exactly the enabled site languages', () => {
  const I18N = require(join(ROOT, 'assets/site-i18n.js'));
  assert.deepEqual(I18N.LANGS, siteLocales());
  assert.deepEqual(Object.keys(I18N.DICT).sort(), [...siteLocales()].sort());
});

test('the site dictionary puts each language where the registry does (I18N-08b)', () => {
  const I18N = require(join(ROOT, 'assets/site-i18n.js'));
  const enabled = LOCALES.filter((l) => l.site.enabled);
  assert.deepEqual({ ...I18N.PREFIX }, Object.fromEntries(enabled.map((l) => [l.code, l.prefix])));
  for (const l of enabled) {
    assert.equal(I18N.pathPrefix(l.code), l.prefix ? `/${l.prefix}` : '', l.code);
    // pageLang() reads <html lang>: it must BE the dictionary's code.
    assert.equal(l.htmlLang, l.code, `${l.code}: <html lang> differs from the dictionary code`);
  }
});

test('the Mini App engine and its dictionaries speak exactly the enabled app languages', () => {
  const MI18N = require(join(ROOT, 'app/i18n.js'));
  const LOCALES_APP = require(join(ROOT, 'app/locales.js'));
  assert.deepEqual(MI18N.LANGS, appLocales());
  // I18N-04: the Mini App plans the same seven languages, in the same order.
  assert.deepEqual(MI18N.PLANNED, LOCALES.map((l) => l.code));
  assert.deepEqual(Object.keys(LOCALES_APP).sort(), [...appLocales()].sort());
});

/* ===================================================================== *
 * 4. Test fixtures never borrow a planned language as «unknown»
 * ===================================================================== */

/**
 * The language codes tests use as «a language this app does not speak».
 * Each must stay OUT of the registry; if one is ever added, the fixtures that
 * use it change meaning and must be rewritten first.
 */
const FOREIGN_FIXTURES = ['uk', 'kk', 'pl', 'pt', 'xx'];

test('the «unknown language» fixtures are not languages we plan to speak', () => {
  const primaries = new Set(LOCALES.map((l) => l.code.split('-')[0].toLowerCase()));
  for (const code of FOREIGN_FIXTURES) assert.equal(primaries.has(code), false, code);
});

test('no test uses a planned language as the example of an unknown one', () => {
  // The fixtures the registry replaced. A planned language in a «gives English»
  // or «is refused» position would flip the day that language ships.
  const files = {
    // `i.setLang('fr')` was the refusal fixture; a test that ENABLES a planned
    // language (I18N-04, injected `langs`) and selects it is legitimate.
    'app/i18n.test.js': /\['(es|de|fr|ko|zh)[-\w]*', 'en'\]|\bi\.setLang\('(es|de|fr|ko|zh)|'mesim\.lang': '(es|de|fr|ko|zh)|fakeTelegram\('(es|de|fr|ko|zh)/,
    'app/core.test.js': /(countryLabel|errorText)\('[A-Z_]+', '(es|de|fr|ko|zh)/,
    'seo/test-site-i18n.mjs': /(setLang|createI18n)\('(es|de|fr|ko|zh)/,
    'test/e2e/i18n.spec.js': /languageCode: '(es|de|fr|ko|zh)/,
    'test/e2e/language-sync.spec.js': /'(es|de|fr|ko|zh)', null\]/,
    'test/e2e/promo-opener.spec.js': /languageCode: '(es|de|fr|ko|zh)/,
    'test/e2e/promo-channel.spec.js': /languageCode: '(es|de|fr|ko|zh)/,
  };
  for (const [f, re] of Object.entries(files)) {
    assert.equal(re.test(read(f)), false, `${f} borrows a planned language as «unknown»`);
  }
});
