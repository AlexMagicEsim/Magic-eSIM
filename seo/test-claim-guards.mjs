/* The claim rules, in every language that has them (seo/claim-guards.mjs, I18N ES-0).
 *
 *   - every language's table has every rule; each rule fires on every sentence it declares and leaves every honest
 *     sentence it declares alone — the first test of a rule is that it fires (§26.1);
 *   - a Spanish rule never relies on ASCII \b around a word with an accented letter (it would never fire);
 *   - every PUBLISHED prefixed language must have a complete table, and the generator refuses one that does not;
 *   - the rules are applied to the generated pages of every published prefixed language, by page kind.
 *
 * Run: node --test seo/test-claim-guards.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CLAIM_GUARDS, RULES, rulesFor, missingGuards, word, hanWord, SOURCED, withoutSourced } from './claim-guards.mjs';
import { LOCALES } from './locales.mjs';
import { cannotBuild, localeGenerator } from './build-locale-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

for (const [code, table] of Object.entries(CLAIM_GUARDS)) {
  test(`${code}: every rule is there, fires on what it is for and stays quiet on honest text`, () => {
    assert.equal(missingGuards(code), null);
    assert.deepEqual(Object.keys(table).sort(), Object.keys(RULES).sort());
    for (const [id, r] of Object.entries(table)) {
      assert.ok(r.fires.length >= 1, `${code}.${id}: a sentence it must fire on`);
      for (const s of r.fires) assert.match(s, r.re, `${code}.${id} must fire on «${s}»`);
      for (const s of r.quiet || []) assert.doesNotMatch(s, r.re, `${code}.${id} must stay quiet on «${s}»`);
    }
  });
}

test('the Spanish rules catch the sentences the English ones would let through', () => {
  const es = CLAIM_GUARDS.es;
  const cases = [
    ['features', 'Datos ilimitados durante todo el viaje'],
    ['delivery', 'Te enviaremos el código QR al correo'],
    ['network', 'Cobertura total y señal fuerte en todo el país'],
    ['installEarly', 'Instala la eSIM unos días antes de salir'],
    ['marketing', 'Las mejores tarifas, con reembolso garantizado'],
    ['money', 'Paga con cualquier tarjeta'],
  ];
  for (const [id, s] of cases) {
    assert.match(s, es[id].re, `es.${id}`);
    const en = CLAIM_GUARDS.en[id].re;
    assert.doesNotMatch(s.replace(/[0-9]G/g, ''), en, `en.${id} would not have caught «${s}» — that is why es has its own`);
  }
});

test('ASCII \\b is the trap word() exists for: «única» is invisible to \\b, caught by word()', () => {
  assert.doesNotMatch('Una oferta única', /\búnica\b/i);
  assert.match('Una oferta única', word('única'));
  assert.doesNotMatch('Comunicación', word('única'), 'and still whole words only');
  // No Spanish, German or French rule is written with \b around a word.
  for (const code of ['es', 'de', 'fr']) for (const [id, r] of Object.entries(CLAIM_GUARDS[code])) {
    assert.doesNotMatch(r.re.source, /\\b/, `${code}.${id}: use word() — \\b is ASCII-only`);
  }
});

test('a published prefixed language must have its table — the generator refuses one without', () => {
  for (const l of LOCALES.filter((x) => x.prefix && x.site.enabled)) assert.equal(missingGuards(l.code), null, l.code);
  assert.match(missingGuards('pl'), /pl has no claim guards/);
  assert.match(read('seo/build-locale-pages.mjs'), /const guards = missingGuards\(code\);\n\s+if \(guards\) return guards;/);
  assert.equal(cannotBuild('en'), null);
});

/* ------------------------------------------------------------------ applied to the published pages */

const prose = (html) => html
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
  // the language switch: other languages by their own names — not this page's words
  .replace(/<a [^>]*hreflang="[^"]*"[^>]*>[\s\S]*?<\/a>/g, ' ')
  .replace(/<details class="langsw langmenu">[\s\S]*?<\/details>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z#0-9]+;/g, ' ');

for (const l of LOCALES.filter((x) => x.prefix && x.site.enabled)) {
  test(`${l.code}: the published guides, home and country template say nothing the rules forbid`, () => {
    const P = l.prefix;
    const hits = [];
    for (const slug of readdirSync(join(ROOT, P, 'guides'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
      // a sentence the owner allowed whole, with its source (SOURCED, ZH-1 D12), is taken out before the rules run
      const text = withoutSourced(l.code, `${P}/guides/${slug}/`, prose(read(`${P}/guides/${slug}/index.html`)));
      for (const [id, re] of rulesFor(l.code, 'guide')) if (re.test(text)) hits.push(`${P}/guides/${slug}/: ${id} «${text.match(re)[0]}»`);
    }
    const home = prose(read(`${P}/index.html`).replace(/^[\s\S]*?<main/, '<main'));
    for (const [id, re] of rulesFor(l.code, 'home')) if (re.test(home)) hits.push(`${P}/: ${id} «${home.match(re)[0]}»`);
    const country = prose(localeGenerator(l.code).countryPage({ iso: 'XX', slug: 'x', name: 'Placeholder' }));
    for (const [id, re] of rulesFor(l.code, 'country')) if (re.test(country)) hits.push(`country template: ${id} «${country.match(re)[0]}»`);
    assert.deepEqual(hits, []);
  });
}

/* ZH-1 T1: Chinese has no spaces between words — word() cannot fire inside a Chinese sentence; hanWord() can. */
test('hanWord: a Han phrase fires inside a Chinese sentence where word() is blind; Latin letters and digits still end a match', () => {
  assert.equal(word('最快').test('我们是最快的eSIM'), false, 'the defect hanWord exists for');
  assert.equal(hanWord('最快').test('我们是最快的eSIM'), true);
  assert.equal(hanWord('5G').test('支持5G网络'), true);
  assert.equal(hanWord('5G').test('15G'), false);
  assert.equal(hanWord('VPN').test('VPNs'), false);
  for (const r of Object.values(CLAIM_GUARDS['zh-Hans'])) assert.ok(r.re.flags.includes('u'), String(r.re));
});

/* ZH-1 D12: SOURCED allows exact sentences, never a pattern. Each must be on its page, need its rule, and cite a source. */
test('SOURCED: every allowed sentence is on its page verbatim, its rule fires on it, and it cites an https source', () => {
  let n = 0;
  for (const [code, list] of Object.entries(SOURCED)) for (const s of list) {
    n += 1;
    assert.ok(CLAIM_GUARDS[code] && CLAIM_GUARDS[code][s.rule], `${code}: unknown rule ${s.rule}`);
    assert.ok(CLAIM_GUARDS[code][s.rule].re.test(s.sentence), `${code}: ${s.rule} does not fire on «${s.sentence}» — not needed`);
    assert.match(s.source, /^https:\/\/support\.apple\.com\//, 'a vendor source');
    assert.match(s.read, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(prose(read(`${s.page}index.html`)).includes(s.sentence), `${s.page}: the allowed sentence is not on the page as written`);
    assert.ok(!withoutSourced(code, s.page, prose(read(`${s.page}index.html`))).includes(s.sentence));
  }
  assert.equal(n, 1, 'one sourced sentence (the Apple mainland list) — a new one is an owner decision');
});
