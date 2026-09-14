/* The storefront's two languages, and the gate that keeps them honest.
 *
 * THE MIRROR IS THE POINT. `index.html` stays hardcoded Russian — it is the
 * only page that has ever taken money and rewriting 3409 lines of it to render
 * through a dictionary would have been the tidier shape and a far worse risk.
 * The cost of leaving it alone is that the dictionary is free to drift from the
 * page. This file is what removes that freedom: every Russian string in
 * `assets/site-i18n.js` must appear VERBATIM in `index.html`, so the dictionary
 * is provably a mirror rather than a second opinion.
 *
 * Run: node seo/test-site-i18n.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const I18N = require(join(ROOT, 'assets/site-i18n.js'));
const LANDING = readFileSync(join(ROOT, 'index.html'), 'utf8');
const EN_PAGE = readFileSync(join(ROOT, 'en/index.html'), 'utf8');

/* ===================================================================== */

test('every Russian string in the dictionary appears verbatim on the Russian landing', () => {
  const missing = Object.entries(I18N.DICT.ru)
    .filter(([, v]) => !LANDING.includes(v))
    .map(([k, v]) => `${k} = ${JSON.stringify(v)}`);

  assert.deepEqual(missing, [],
    'the dictionary drifted from index.html — fix the dictionary, not this test');
});

test('the mirror can actually fail', () => {
  // §26.1: the FIRST assertion of a rule must prove it fires. A gate that only
  // ever reports «clean» is indistinguishable from a gate that never ran.
  assert.equal(LANDING.includes('Оформление заказа'), true);
  assert.equal(LANDING.includes('Оформление заказа под ключ'), false,
    'if this string ever appears, rewrite the test — it is the canary');
});

test('the Russian dictionary is not empty and covers the checkout', () => {
  const ru = Object.keys(I18N.DICT.ru);
  assert.ok(ru.length >= 20, `only ${ru.length} keys — an empty mirror mirrors nothing`);
  for (const k of ['checkout.title', 'checkout.total', 'checkout.email', 'checkout.sbp', 'checkout.card']) {
    assert.ok(Object.prototype.hasOwnProperty.call(I18N.DICT.ru, k), k);
  }
});

/* ---- the engine ----------------------------------------------------- */

test('a Russian string is never replaced by an English one', () => {
  // The chain is active -> ru -> key, never active -> en. An untranslated
  // English string shown to a Russian customer looks deliberate, which is worse
  // than an untranslated key.
  const ru = I18N.createI18n('ru');
  assert.equal(ru.t('site.tagline'), 'site.tagline',
    'an English-only key must fall through to the key, not to the English text');
  assert.equal(ru.t('checkout.title'), 'Оформление заказа');
});

test('English falls back to Russian rather than to a key', () => {
  const en = I18N.createI18n('en');
  assert.equal(en.t('checkout.title'), 'Your order');
  assert.equal(en.t('checkout.sbp'), 'СБП', 'no English word for it, so the Russian stands');
});

test('t() cannot throw, cannot return an object, and never indexes a prototype', () => {
  const en = I18N.createI18n('en');
  for (const hostile of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', '', null, undefined, 42, {}]) {
    const out = en.t(hostile);
    assert.equal(typeof out, 'string', JSON.stringify(hostile));
  }
  assert.equal(en.t('__proto__'), '__proto__');
});

test('an unknown language is refused rather than stored', () => {
  const i = I18N.createI18n('en');
  assert.equal(i.setLang('de'), 'en');
  assert.equal(i.setLang('__proto__'), 'en');
  assert.equal(i.setLang(undefined), 'en');
  assert.equal(i.setLang('ru'), 'ru');
  assert.deepEqual(I18N.LANGS, ['ru', 'en']);
});

test('an unrecognised initial language resolves to Russian, not to English', () => {
  // The absence of a statement is not a statement. This shop is Russian.
  assert.equal(I18N.createI18n('de').lang(), 'ru');
  assert.equal(I18N.createI18n(undefined).lang(), 'ru');
  assert.equal(I18N.DEFAULT_LANG, 'ru');
});

/* ---- the English page uses the dictionary rather than repeating it ---- */

test('every key used on the English page has an ENGLISH entry', () => {
  // THE FIRST VERSION ACCEPTED A RUSSIAN FALLBACK HERE, and that is the one
  // thing this gate must not do. `t()` falls back active -> ru by design — an
  // untranslated key is better than an untranslated English string on a Russian
  // page — but on the ENGLISH page that same fallback silently ships «Российская
  // карта» to an English reader. Four such keys exist today (checkout.sbp,
  // checkout.card, checkout.paySbp, checkout.note); none is used on /en/, and
  // this is what keeps it that way.
  const html = [...EN_PAGE.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
  const attrs = [...EN_PAGE.matchAll(/data-i18n-attr="[^":]+:([^"]+)"/g)].map((m) => m[1]);
  const js = [...readFileSync(join(ROOT, 'en/app.js'), 'utf8')
    .matchAll(/I18N\.t\('([^']+)'\)/g)].map((m) => m[1]);
  const used = [...new Set([...html, ...attrs, ...js])];

  assert.ok(used.length >= 25, `only ${used.length} keys in use`);
  const russianOnly = used.filter((k) => !Object.prototype.hasOwnProperty.call(I18N.DICT.en, k));
  assert.deepEqual(russianOnly, [],
    'these would render in Russian on the English page');
});

test('the English-coverage rule can fire', () => {
  // §26.1: prove the check is capable of failing. `checkout.sbp` is a real key
  // that exists in `ru` only — if it were ever placed on /en/ the test above
  // must go red, and this is the demonstration that it would.
  assert.equal(Object.prototype.hasOwnProperty.call(I18N.DICT.ru, 'checkout.sbp'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(I18N.DICT.en, 'checkout.sbp'), false);
  const en = I18N.createI18n('en');
  assert.equal(en.t('checkout.sbp'), 'СБП', 'the fallback is real, which is why the gate is needed');
});

test('the dictionaries cannot be rewritten at runtime', () => {
  assert.throws(() => { 'use strict'; I18N.DICT.en['pay.unavailableBody'] = 'x'; }, TypeError);
  assert.throws(() => { 'use strict'; I18N.DICT.ru['checkout.title'] = 'x'; }, TypeError);
  assert.throws(() => { 'use strict'; I18N.DICT.de = {}; }, TypeError);
});

test('data-i18n-attr only ever targets an attribute on the allowlist', () => {
  // The helper sets attributes from markup. An arbitrary attribute name is how
  // a convenience like that grows into a way to set href or an event handler.
  const specs = [...EN_PAGE.matchAll(/data-i18n-attr="([^"]+)"/g)].map((m) => m[1]);
  for (const spec of specs) {
    const [attr, key] = spec.split(':');
    assert.ok(['placeholder', 'aria-label', 'title'].includes(attr), `attribute ${attr}`);
    assert.ok(key && key.length > 0, spec);
  }
});
