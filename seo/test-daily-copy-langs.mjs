/* The daily-plan card's words, one table per language (I18N stage 2).
 *
 * assets/daily-plan-copy.js decides what a daily tariff card may say; until 2026-10-21 its English was a second
 * `lang === EN ? … : …` branch in every function, so a third language would have been a third branch everywhere. The
 * words now live in one table per language and the rules once. This holds:
 *
 *   - Russian and English byte for byte: every exported function, over the daily plans of both frozen catalogue samples,
 *     in every language a caller passes today (none, ru, en, unknown), hashes to what the branches produced
 *     (test/fixtures/daily-copy-golden.json, recorded on storefront 27529719 before the move);
 *   - every table has the Russian one's keys, the same {placeholders} in each template, all thirteen region names and
 *     the plural forms its language's Intl.PluralRules asks for — and never a word for unlimited traffic;
 *   - the module's list of languages is the one the Mini App (DAILY_COPY_LANGS) and the locale generator
 *     (cannotBuild) use, and every published prefixed language is in it;
 *   - A REHEARSAL for each planned language: a table of MARKS («⟦es:allowance⟧ …») dropped into the module makes every
 *     card line, title, place and count come out as marks, digits and that language's country names only — no Russian
 *     or English word survives in the code path. Enabling Spanish is one table.
 *
 * Run: node --test seo/test-daily-copy-langs.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { fingerprint, sample } from '../test/fixtures/daily-copy-matrix.mjs';
import { LOCALES } from './locales.mjs';
import { DAILY_COPY_LANGS as GENERATOR_LANGS, cannotBuild } from './build-locale-pages.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';
import { countryName } from './country-names-i18n.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const SOURCE = readFileSync(join(ROOT, 'assets/daily-plan-copy.js'), 'utf8');
const END = '    /* --- LANGUAGE TABLES END --- */';
/* KO-1: every registry language is published. The marked-table rehearsal still needs a subject: Korean, «as if
 * planned» — the marked table is injected after the real one, so it replaces it in the rehearsal only. */
const LIVE_PLANNED = LOCALES.filter((l) => !l.site.enabled).map((l) => l.code);
const PLANNED = LIVE_PLANNED.length ? LIVE_PLANNED : ['ko'];

/** The module, optionally with extra tables dropped in before the end marker. */
function loadWith(extra = '') {
  const ctx = { Intl, Math, JSON, Number, String, Array, Object, isFinite };
  ctx.window = ctx;
  vm.createContext(ctx);
  assert.equal(SOURCE.split(END).length, 2, 'the tables end at one marker');
  vm.runInContext(SOURCE.replace(END, extra + END), ctx);
  return ctx.MagicDailyPlan;
}

/** The tables themselves, read out of the module (they are not exported: nothing at runtime may change them). */
function tables() {
  const ctx = { Intl, Math, JSON, Number, String, Array, Object, isFinite };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SOURCE.replace('  var LANGS = Object.keys(COPY);', '  var LANGS = Object.keys(COPY); root.__COPY = COPY;'), ctx);
  return ctx.__COPY;
}

const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/* ===================================================================== */

test('Russian and English say exactly what they said before the tables (golden over 1198 packages)', () => {
  const golden = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/daily-copy-golden.json'), 'utf8'));
  const now = fingerprint(ROOT);
  assert.deepEqual(now.counts, golden.counts);
  const moved = Object.keys(golden.hashes).filter((k) => golden.hashes[k] !== now.hashes[k]);
  assert.deepEqual(moved, [], 'functions whose output moved');
  assert.deepEqual(Object.keys(now.hashes).sort(), Object.keys(golden.hashes).sort());
});

test('the golden can fire: one changed word moves its hash', () => {
  const D = loadWith();
  const p = sample().find((x) => D.isDaily(x) && D.lines(x, 'en').length > 1);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);   // objects from two vm contexts: compare their content
  assert.ok(same(loadWith().lines(p, 'en'), D.lines(p, 'en')));
  const ctx = { Intl, Math, JSON, Number, String, Array, Object, isFinite };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SOURCE.replace("throttle: 'Then up to {s}'", "throttle: 'After that up to {s}'"), ctx);
  assert.ok(!same(ctx.MagicDailyPlan.lines(p, 'en'), D.lines(p, 'en')));
});

test('every table has the Russian keys, placeholders, thirteen places and its own plural forms — and no word for unlimited', () => {
  const T = tables();
  const ru = T.ru;
  const PLACES = Object.keys(T.en.places);
  assert.equal(PLACES.length, 13);
  for (const [code, t] of Object.entries(T)) {
    // `unitSpace` is the one optional key (KO-1: Korean writes «1.5GB»); absent = one space, as every older table
    assert.deepEqual(Object.keys(t).filter((k) => k !== 'unitSpace').sort(), Object.keys(ru).sort(), `${code}: keys`);
    if ('unitSpace' in t) assert.ok(t.unitSpace === '' || t.unitSpace === ' ', `${code}: unitSpace is '' or ' '`);
    for (const [k, v] of Object.entries(ru)) {
      if (typeof v === 'string') assert.deepEqual(placeholders(t[k]), placeholders(v), `${code}.${k}: placeholders`);
    }
    if (code !== 'ru') {
      assert.deepEqual(Object.keys(t.places).sort(), PLACES.slice().sort(), `${code}: places`);
      for (const n of PLACES) assert.ok(t.places[n] && !/[а-яё]/i.test(t.places[n]), `${code}: place ${n}`);
    }
    for (const k of ['days', 'countries']) {
      if (typeof t[k] === 'function') continue;
      const need = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
      for (const c of need) assert.ok(t[k][c], `${code}.${k}: plural form «${c}»`);
    }
    const words = JSON.stringify(t, (key, v) => (typeof v === 'function' ? String(v) : v));
    assert.doesNotMatch(words, /безлимит|unlimit|ilimitad|unbegrenzt|illimit|无限|無限|무제한/i, `${code}: a daily card never promises unlimited traffic`);
  }
});

test('one list of languages: the module, the Mini App and the locale generator agree; every published prefixed language has words', () => {
  const D = require(join(ROOT, 'assets/daily-plan-copy.js'));
  assert.deepEqual([...D.LANGS], ['ru', 'en', 'es', 'de', 'fr', 'zh-Hans', 'ko']);
  assert.deepEqual([...GENERATOR_LANGS], [...D.LANGS]);
  const core = readFileSync(join(ROOT, 'app/core.js'), 'utf8');
  const m = core.match(/const DAILY_COPY_LANGS = Object\.freeze\((\[[^\]]*\])\);/);
  assert.ok(m, 'app/core.js names DAILY_COPY_LANGS');
  // The Mini App asks only for languages the module has; it may ask for fewer (it offers no language before GLOBAL
  // payments — Spanish is on the site, not in the Mini App).
  const app = JSON.parse(m[1].replace(/'/g, '"'));
  for (const l of app) assert.ok(D.LANGS.includes(l), `the Mini App asks for daily copy in ${l}, which the module lacks`);
  for (const l of LOCALES.filter((x) => x.app.enabled)) assert.ok(app.includes(l.code), `${l.code} is offered in the Mini App without daily copy`);
  for (const l of LOCALES) assert.ok(D.LANGS.includes(l.code) || !l.site.enabled, `${l.code} is published without daily words`);
  for (const code of D.LANGS) assert.ok(LOCALES.some((l) => l.code === code), `${code} is not a registry language`);
  // The generator says why it would refuse a language without daily words.
  const gen = readFileSync(join(ROOT, 'seo/build-locale-pages.mjs'), 'utf8');
  assert.match(gen, /if \(!DAILY_COPY_LANGS\.includes\(code\)\) return `\$\{code\} has no daily-plan words/);
  assert.equal(cannotBuild('en'), null);
  // Without a table a language still speaks Russian, as every caller that passes nothing always has.
  assert.equal(D.blockTitle('xx'), D.BLOCK_TITLE);
  assert.equal(D.blockTitle(), D.BLOCK_TITLE);
  assert.equal(D.blockTitle('__proto__'), D.BLOCK_TITLE);
});

/* ------------------------------------------------------------------ the rehearsal */

const mark = (code, key) => `⟦${code}:${key}⟧`;

function markedTable(code) {
  const T = tables();
  const forms = (base) => `{ ${new Intl.PluralRules(code).resolvedOptions().pluralCategories.map((c) => `${c}: ${JSON.stringify(mark(code, `${base}.${c}`))}`).join(', ')} }`;
  const tpl = (k) => JSON.stringify(T.en[k].replace(/[^{}]+(?=\{|$)|^[^{]+/g, (w) => (w.trim() ? ` ${mark(code, k)} ` : w)));
  const places = Object.keys(T.en.places).map((n, i) => `${JSON.stringify(n)}: ${JSON.stringify(mark(code, `place${i}`))}`).join(', ');
  return `,
    ${JSON.stringify(code)}: {
      blockTitle: ${JSON.stringify(mark(code, 'blockTitle'))}, decimal: ',', mb: ${JSON.stringify(mark(code, 'mb'))}, gb: ${JSON.stringify(mark(code, 'gb'))},
      kbps: ${JSON.stringify(mark(code, 'kbps'))}, mbps: ${JSON.stringify(mark(code, 'mbps'))}, gbps: ${JSON.stringify(mark(code, 'gbps'))},
      allowance: ${tpl('allowance')}, throttle: ${tpl('throttle')}, reset: ${JSON.stringify(mark(code, 'reset'))}, term: ${tpl('term')},
      perDay: ${tpl('perDay')}, titled: '{place} · {perDay}', withTerm: '{base} · {n} {days}', count: '{n} {countries}',
      listSep: '、', listAnd: ${JSON.stringify(` ${mark(code, 'and')} `)},
      days: ${forms('days')}, countries: ${forms('countries')},
      places: { ${places} }
    }
`;
}

for (const code of PLANNED) {
  test(`${code}: a marked table makes every daily line, title, place and count speak only ${code}`, () => {
    const D = loadWith(markedTable(code));
    assert.ok(D.LANGS.includes(code));
    const names = Object.keys(COUNTRY_NAMES).map((iso) => countryName(iso, code)).sort((a, b) => b.length - a.length);
    const namer = (c) => countryName(String(c || '').toUpperCase(), code) || String(c || '').toUpperCase();
    const runs = [D.blockTitle(code)];
    for (const p of sample().filter((x) => D.isDaily(x))) {
      for (const l of D.lines(p, code)) runs.push(l.text);
      runs.push(D.displayName(p, namer, code), D.placeName(p, namer, code), D.coverageLine(p, namer, code));
    }
    for (let n = 0; n < 40; n++) runs.push(D.pluralDays(n, code), D.pluralCountries(n, code));
    runs.push(D.formatSpeed('1.5 Mbps', code), D.formatAllowance(0.49, code), D.formatAllowance(1.5, code));
    const leaks = new Set();
    for (const r of runs) {
      let s = String(r).replace(/⟦[^⟧]*⟧/g, ' ');
      for (const n of names) if (n) s = s.split(n).join(' ');
      for (const w of s.replace(/[\s\d.,:;·—–\-+/()、]+/g, ' ').trim().split(/\s+/)) if (w) leaks.add(`${w} ← ${r}`);
    }
    assert.deepEqual([...leaks].slice(0, 15), []);
    assert.equal(D.formatAllowance(1.5, code), `1,5 ${mark(code, 'gb')}`, 'the decimal mark is the table\'s');
    // Russian and English are untouched by a third table.
    const golden = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/daily-copy-golden.json'), 'utf8'));
    const p = sample().find((x) => D.isDaily(x));
    assert.equal(JSON.stringify(D.lines(p, 'en')), JSON.stringify(loadWith().lines(p, 'en')));
    assert.ok(golden.hashes['lines.en']);
  });
}

test('the rehearsal can fire: a Russian word left in the shared code is caught', () => {
  const code = 'es';
  const bad = loadWith(markedTable(code).replace(`reset: ${JSON.stringify(mark(code, 'reset'))}`, "reset: 'Лимит обновляется'"));
  const p = sample().find((x) => bad.isDaily(x) && x.daily_reset_confirmed === true);
  assert.ok(p, 'the sample has a plan with a confirmed reset');
  assert.ok(bad.lines(p, code).some((l) => /[а-я]/i.test(l.text.replace(/⟦[^⟧]*⟧/g, ''))));
});
