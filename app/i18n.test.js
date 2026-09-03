'use strict';

// Mini App i18n — the engine, the dictionaries, and the promise that Russian
// did not change.
//
//   node --test app/i18n.test.js
//
// WHAT THESE TESTS ARE FOR. Not "does a lookup work" — that fails loudly the
// first time anybody opens the app. They exist for the failures that stay
// GREEN: a language that is chosen and silently not saved, a fallback that
// quietly shows English to a Russian customer, a stored value that is trusted
// without being checked, and a Russian sentence that drifted by one character
// while every test kept passing.
//
// So almost nothing here observes the value the code just put in memory. The
// tests that matter cross an instance boundary, inject a dictionary with a hole
// in it, or assert on something a mutation cannot leave intact.

const test = require('node:test');
const assert = require('node:assert/strict');

const LOCALES = require('./locales.js');
const I18N = require('./i18n.js');

const create = I18N.create;

/* -------------------------------------------------------------------------- */

/** A localStorage-shaped fake that records what was asked of it. */
function fakeStorage(initial) {
  const data = Object.assign({}, initial);
  const calls = [];

  return {
    calls,
    data,
    getItem(k) { calls.push(['get', k]); return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { calls.push(['set', k, v]); data[k] = String(v); },
    removeItem(k) { calls.push(['remove', k]); delete data[k]; },
  };
}

/** A storage where every single call throws, the way a blocked WebView does. */
const hostileStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
  removeItem() { throw new Error('SecurityError'); },
};

/** Telegram, saying one thing about the customer's client. */
function fakeTelegram(languageCode) {
  return { WebApp: { initDataUnsafe: { user: languageCode === undefined ? {} : { id: 1, language_code: languageCode } } } };
}

const DICTS = LOCALES;

/* ==========================================================================
 * 1. Detection
 * ======================================================================== */

test('a Telegram language of ru gives Russian, and a stated other language gives English', () => {
  // Both halves in ONE test over one table: split apart, `return 'ru'` passes
  // the first and `return 'en'` passes the second.
  const cases = [
    ['ru', 'ru'], ['ru-RU', 'ru'], ['ru_RU', 'ru'], ['RU', 'ru'], ['Ru-ru', 'ru'],
    ['en', 'en'], ['en-GB', 'en'], ['de', 'en'], ['uk', 'en'], ['kk', 'en'], ['pt-br', 'en'],
  ];

  for (const [code, want] of cases) {
    const i = create({ dicts: DICTS, storage: null, telegram: fakeTelegram(code) });
    assert.equal(i.lang(), want, `language_code ${code}`);
  }
});

test('only the ru primary subtag is Russian — not «rue», not a word that starts with ru', () => {
  // MUT-3. `String(code).toLowerCase().startsWith('ru')` passes every case in
  // the table above and fails here: `rue` is Rusyn, a real IETF primary
  // subtag for a language that is not Russian.
  for (const code of ['rue', 'rup', 'runyankole']) {
    const i = create({ dicts: DICTS, storage: null, telegram: fakeTelegram(code) });
    assert.equal(i.lang(), 'en', `${code} is not Russian`);
  }
});

test('an absent or unusable language_code is Russian, because absence is not a statement', () => {
  // This is the decision, written down: the field is OPTIONAL on Telegram's
  // WebAppUser, initDataUnsafe is {} in a plain browser tab, and some launch
  // contexts carry no user at all. Defaulting those to English would flip a
  // Russian shop to English for every customer whose client did not say.
  const telegrams = [
    null,
    {},
    { WebApp: {} },
    { WebApp: { initDataUnsafe: {} } },
    { WebApp: { initDataUnsafe: { user: {} } } },
    fakeTelegram(''),
    fakeTelegram('   '),
    fakeTelegram(null),
    fakeTelegram(0),
  ];

  for (const telegram of telegrams) {
    const i = create({ dicts: DICTS, storage: null, telegram });
    assert.equal(i.lang(), 'ru', JSON.stringify(telegram));
  }
});

test('detection never throws, whatever Telegram hands it', () => {
  const exploding = { WebApp: { get initDataUnsafe() { throw new Error('boom'); } } };
  assert.doesNotThrow(() => create({ dicts: DICTS, storage: null, telegram: exploding }));
  assert.equal(create({ dicts: DICTS, storage: null, telegram: exploding }).lang(), 'ru');
});

/* ==========================================================================
 * 2. The manual choice outranks everything
 * ======================================================================== */

test('a saved choice outranks Telegram, in both directions', () => {
  // MUT-1. One direction alone is satisfied by "always prefer storage" AND by
  // "always answer en"; both directions plus the detection table close it.
  const en = create({ dicts: DICTS, storage: fakeStorage({ 'mesim.lang': 'en' }), telegram: fakeTelegram('ru') });
  assert.equal(en.lang(), 'en');

  const ru = create({ dicts: DICTS, storage: fakeStorage({ 'mesim.lang': 'ru' }), telegram: fakeTelegram('en') });
  assert.equal(ru.lang(), 'ru');
});

test('an unrecognised saved value is discarded, not adopted and not left to rot', () => {
  // Assert the SET of things accepted, not one sample: `.slice(0,2)` after a
  // lowercase would accept 'ruX' and 'RU' while passing a one-case test.
  for (const bad of ['fr', 'RU', 'ru-RU', '', 'null', '[object Object]', 'en; DROP', '__proto__', 'constructor', ' ru']) {
    const storage = fakeStorage({ 'mesim.lang': bad });
    const i = create({ dicts: DICTS, storage, telegram: fakeTelegram('en') });

    assert.equal(i.lang(), 'en', `${bad} must not be honoured`);
    // and it is deleted, so "chose nothing" and "chose something gone" stay
    // distinguishable on the next launch
    assert.equal(storage.data['mesim.lang'], undefined, `${bad} must be removed`);
  }
});

test('a language with no dictionary cannot be chosen, from the API any more than from the picker', () => {
  const i = create({ dicts: DICTS, storage: fakeStorage({}), telegram: null });
  let fired = 0;
  i.onChange(() => { fired += 1; });

  i.setLang('fr');
  assert.equal(i.lang(), 'ru');
  assert.equal(fired, 0);
});

test('choosing the language already in use changes nothing and tells nobody', () => {
  // onChange repaints the open screen. A spurious fire re-enters that paint.
  const i = create({ dicts: DICTS, storage: fakeStorage({}), telegram: null });
  let fired = 0;
  i.onChange(() => { fired += 1; });

  i.setLang('ru');
  assert.equal(fired, 0);

  i.setLang('en');
  assert.equal(fired, 1);

  i.setLang('en');
  assert.equal(fired, 1, 'the second identical choice must be a no-op');
});

/* ==========================================================================
 * 3. Persistence
 * ======================================================================== */

test('a chosen language survives a restart, not merely the rest of this instance', () => {
  // MUT-4, and the mistake this test exists to prevent: asserting
  // `i.lang() === 'en'` right after setLang passes on memory alone and stays
  // green with the write deleted. The second instance is the whole test.
  const storage = fakeStorage({});
  const first = create({ dicts: DICTS, storage, telegram: fakeTelegram('ru') });
  first.setLang('en');

  const second = create({ dicts: DICTS, storage, telegram: fakeTelegram('ru') });
  assert.equal(second.lang(), 'en', 'the choice must outlive the instance that made it');
});

test('a detected language is never written down as though it had been chosen', () => {
  // Otherwise the first client a customer happens to open decides for them
  // permanently, and "guessed" becomes indistinguishable from "chose".
  const storage = fakeStorage({});
  const i = create({ dicts: DICTS, storage, telegram: fakeTelegram('de') });

  i.lang(); i.t('settings.title'); i.lang();

  assert.equal(storage.calls.some((c) => c[0] === 'set'), false, JSON.stringify(storage.calls));
});

test('a storage that throws on every call gives Russian rather than a dead app', () => {
  // MUT-5. Testing only getItem misses the commoner real case: Safari private
  // mode throws on setItem while getItem works, and "changes but does not
  // stick" must still beat "does not run".
  let i;
  assert.doesNotThrow(() => { i = create({ dicts: DICTS, storage: hostileStorage, telegram: null }); });
  assert.equal(i.lang(), 'ru');

  let fired = 0;
  i.onChange(() => { fired += 1; });
  assert.doesNotThrow(() => i.setLang('en'));
  assert.equal(i.lang(), 'en', 'the language still changes when it cannot be saved');
  assert.equal(fired, 1);
});

/* ==========================================================================
 * 4. Lookup, fallback, interpolation
 * ======================================================================== */

test('a key missing from the active language falls back to Russian, never to English', () => {
  // MUT-2, and the house rule it protects: core.js already holds that "an
  // untranslated English string is never shown to a customer".
  //
  // INJECTED dictionaries, deliberately. Run against the real ones this test
  // is vacuous — key parity means the fallback branch is never entered.
  const holed = { ru: { 'a.b': 'Почта' }, en: {} };
  const enActive = create({ dicts: holed, storage: fakeStorage({ 'mesim.lang': 'en' }), telegram: null });
  assert.equal(enActive.t('a.b'), 'Почта');

  const reversed = { ru: {}, en: { 'a.b': 'Mail' } };
  const ruActive = create({ dicts: reversed, storage: null, telegram: null });
  assert.equal(ruActive.t('a.b'), 'a.b', 'Russian must never borrow the English string');
});

test('a key in neither dictionary comes back as the key, and is recorded as a miss', () => {
  const seen = [];
  const i = create({ dicts: DICTS, storage: null, telegram: null, onMiss: (k) => seen.push(k) });

  assert.equal(i.t('nope.nope'), 'nope.nope');
  assert.deepEqual(seen, ['nope.nope']);
  assert.deepEqual(i.misses, ['nope.nope']);
});

test('a substituted value is inserted literally, even when it looks like a replacement pattern', () => {
  // MUT-6. String.prototype.replace with a STRING replacement expands $&, $1,
  // $` and $' — so a value carrying them would rewrite the sentence around it.
  // Substituting '5' passes with either implementation; this does not.
  const dicts = { ru: { 'x': 'до {date} включительно' }, en: {} };
  const i = create({ dicts, storage: null, telegram: null });

  const nasty = "$& $1 $` $' $$";
  assert.equal(i.t('x', { date: nasty }), `до ${nasty} включительно`);
});

test('a placeholder with no value is left standing rather than rendered as «undefined»', () => {
  const dicts = { ru: { 'x': 'осталось {n}' }, en: {} };
  const i = create({ dicts, storage: null, telegram: null });

  for (const out of [i.t('x'), i.t('x', {}), i.t('x', { n: undefined }), i.t('x', { n: null })]) {
    assert.equal(/undefined|null|NaN/.test(out), false, out);
    assert.equal(out, 'осталось {n}');
  }
});

test('every placeholder is substituted, not only the first', () => {
  const dicts = { ru: { 'x': '{n} из {n}' }, en: {} };
  const i = create({ dicts, storage: null, telegram: null });
  assert.equal(i.t('x', { n: 3 }), '3 из 3');
});

test('t returns a string for any input at all, because apply() hands it whatever the markup said', () => {
  const i = create({ dicts: DICTS, storage: null, telegram: null });
  for (const junk of [null, undefined, 42, {}, [], '', true]) {
    assert.equal(typeof i.t(junk), 'string', JSON.stringify(junk));
  }
});

test('a value that is not a string is a miss, never «[object Object]» on a screen', () => {
  // The reserved plural shape. Nothing selects from it yet, and until something
  // does it must not reach a customer.
  const dicts = { ru: { 'x': { one: 'день', few: 'дня', many: 'дней' } }, en: {} };
  const i = create({ dicts, storage: null, telegram: null });
  assert.equal(i.t('x', { count: 2 }), 'x');
});

/* ==========================================================================
 * 5. Dates
 * ======================================================================== */

test('a date reads as the language reads, and identically on every machine', () => {
  // Built from LOCAL parts so the assertion cannot depend on the runner's
  // timezone — which is exactly how a hardcoded ISO string produces a green
  // that flips at UTC−12.
  const day = new Date(2026, 7, 9);

  const ru = create({ dicts: DICTS, storage: fakeStorage({ 'mesim.lang': 'ru' }), telegram: null });
  const en = create({ dicts: DICTS, storage: fakeStorage({ 'mesim.lang': 'en' }), telegram: null });

  assert.equal(ru.formatDate(day), '09.08.2026', 'Russian keeps the zero-padded form it always had');
  assert.equal(en.formatDate(day), '9 Aug 2026', 'English is unambiguous about which number is the day');
  assert.notEqual(ru.formatDate(day), en.formatDate(day));
});

test('the Russian date is byte-identical to the one toLocaleDateString produced before there were two languages', () => {
  // The guarantee, for the one piece of Settings that is computed rather than
  // written down. Compares against the real previous implementation.
  const ru = create({ dicts: DICTS, storage: fakeStorage({ 'mesim.lang': 'ru' }), telegram: null });

  for (const d of [new Date(2026, 7, 9), new Date(2026, 0, 1), new Date(2026, 11, 31), new Date(2026, 7, 19)]) {
    assert.equal(ru.formatDate(d), d.toLocaleDateString('ru-RU'), d.toISOString());
  }
});

test('an unusable date is nothing at all, never the words «Invalid Date»', () => {
  const i = create({ dicts: DICTS, storage: null, telegram: null });
  for (const junk of [null, undefined, '', 'not-a-date', NaN, {}, [], 'Invalid Date']) {
    assert.equal(i.formatDate(junk), '', JSON.stringify(junk));
  }
});

test('changing the language changes what a date says, with no reload', () => {
  const i = create({ dicts: DICTS, storage: fakeStorage({}), telegram: null });
  const day = new Date(2026, 7, 9);

  const before = i.formatDate(day);
  i.setLang('en');
  assert.notEqual(i.formatDate(day), before);
});

/* ==========================================================================
 * 6. apply() — what can be held without a DOM
 * ======================================================================== */

test('the engine never assigns markup, only text', () => {
  // MUT-8, held at the source so it is caught without a browser. The whole
  // el() doctrine in ui.js is "never innerHTML from data"; apply() is the one
  // place that could quietly reintroduce it.
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, 'i18n.js'), 'utf8');
  for (const sink of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write']) {
    assert.equal(source.includes(sink), false, `i18n.js must not mention ${sink}`);
  }
});

test('apply writes only the four attributes it is allowed to, and skips any other', () => {
  const i = create({ dicts: { ru: { 'k': 'ЗНАЧЕНИЕ' }, en: {} }, storage: null, telegram: null });

  const written = [];
  const node = {
    getAttribute: (a) => (a === 'data-i18n-aria-label' ? 'k' : null),
    setAttribute: (a, v) => written.push([a, v]),
  };
  const root = {
    querySelectorAll: (sel) => (sel === '[data-i18n-aria-label]' ? [node] : []),
  };

  i.apply(root);
  assert.deepEqual(written, [['aria-label', 'ЗНАЧЕНИЕ']]);
  assert.deepEqual(i.ATTRS, ['aria-label', 'placeholder', 'title', 'alt']);
});

test('a hook naming a key that does not exist is recorded, not painted silently', () => {
  const seen = [];
  const i = create({ dicts: DICTS, storage: null, telegram: null, onMiss: (k) => seen.push(k) });
  const node = { getAttribute: () => 'ghost.key', textContent: '' };
  i.apply({ querySelectorAll: (sel) => (sel === '[data-i18n]' ? [node] : []) });

  assert.deepEqual(seen, ['ghost.key']);
});

/* ==========================================================================
 * 7. The dictionaries themselves
 * ======================================================================== */

const RU = LOCALES.ru;
const EN = LOCALES.en;
const FS = require('node:fs');
const PATH = require('node:path');
const LOCALES_SRC = FS.readFileSync(PATH.join(__dirname, 'locales.js'), 'utf8');
const HTML_SRC = FS.readFileSync(PATH.join(__dirname, 'index.html'), 'utf8');

/**
 * The same source with its comments blanked out, line numbers preserved.
 *
 * Every scan below asks a question about CODE — which keys are requested,
 * which literals are still hardcoded — and a comment is prose. Without this,
 * a comment mentioning `t('…')` is read as a call to a key that does not
 * exist, and an apostrophe in an English comment opens a string that swallows
 * the next forty lines. Both happened on the first run of this file.
 *
 * It walks the source rather than regexing it, because a comment marker inside
 * a string literal is not a comment and a quote inside a comment is not a
 * string.
 */
function codeOnly(source) {
  const out = source.split('');
  let at = 0;

  while (at < source.length) {
    const ch = source[at];

    if (ch === '\'' || ch === '"' || ch === '`') {
      let scan = at + 1;
      while (scan < source.length) {
        if (source[scan] === '\\') { scan += 2; continue; }
        if (source[scan] === ch) break;
        scan += 1;
      }
      at = scan + 1;
      continue;
    }

    if (ch === '/' && source[at + 1] === '/') {
      let end = source.indexOf('\n', at);
      if (end < 0) end = source.length;
      for (let n = at; n < end; n += 1) out[n] = ' ';
      at = end;
      continue;
    }

    if (ch === '/' && source[at + 1] === '*') {
      let end = source.indexOf('*/', at);
      end = end < 0 ? source.length : end + 2;
      for (let n = at; n < end; n += 1) if (source[n] !== '\n') out[n] = ' ';
      at = end;
      continue;
    }

    at += 1;
  }

  return out.join('');
}

const UI_RAW = FS.readFileSync(PATH.join(__dirname, 'ui.js'), 'utf8');
const UI_SRC = codeOnly(UI_RAW);

test('the two dictionaries have exactly the same keys', () => {
  // A SET property. `assert.equal(Object.keys(EN).length, 33)` would be the
  // counting mistake this project has already paid for once.
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
});

test('no key is declared twice — a duplicate in an object literal is silent', () => {
  // `{a:1, a:2}` has one key and throws nothing, and this dictionary is flat,
  // hand-maintained, and full of near-identical names.
  // Per dictionary, not over the file: the two dictionaries declare the SAME
  // key names by design, so a whole-file uniqueness check would fail on a
  // correct file and prove nothing about either half.
  const blocks = {
    ru: LOCALES_SRC.slice(LOCALES_SRC.indexOf('const ru = {'), LOCALES_SRC.indexOf('const en = {')),
    en: LOCALES_SRC.slice(LOCALES_SRC.indexOf('const en = {'), LOCALES_SRC.indexOf('const LOCALES = {')),
  };

  for (const [name, block] of Object.entries(blocks)) {
    assert.ok(block.length > 0, `${name} block not found`);
    const declared = [...block.matchAll(/^\s+'([^']+)':/gm)].map((m) => m[1]);
    const dupes = declared.filter((k, n) => declared.indexOf(k) !== n);

    assert.deepEqual(dupes, [], `${name} declares ${dupes.join(', ')} twice`);
    assert.equal(declared.length, Object.keys(LOCALES[name]).length,
      `${name}: ${declared.length} declared, ${Object.keys(LOCALES[name]).length} survived`);
  }
});

test('the English dictionary has no Cyrillic left in it, apart from the two language names', () => {
  // Over the VALUES: the endonym «Русский» is correct English-side copy and is
  // the single deliberate exception.
  for (const [key, value] of Object.entries(EN)) {
    if (key === 'settings.language.ru') continue;
    assert.equal(/[Ѐ-ӿ]/.test(value), false, `${key}: ${value}`);
  }
  assert.equal(EN['settings.language.ru'], 'Русский');
});

test('every Russian value is really Russian, and none is merely its own key', () => {
  // The guard against the specific rot where somebody regenerates the file
  // from the key list to make a red test green.
  const latinOnly = new Set(['settings.language.en', 'settings.account.esims']);
  for (const [key, value] of Object.entries(RU)) {
    assert.notEqual(value, key, `${key} is its own value`);
    assert.equal(value.trim(), value, `${key} has stray whitespace`);
    assert.notEqual(value, '', `${key} is empty`);
    if (!latinOnly.has(key)) {
      assert.equal(/[Ѐ-ӿ]/.test(value), true, `${key} has no Cyrillic: ${value}`);
    }
  }
});

/* ==========================================================================
 * 8. The keys the app actually asks for
 * ======================================================================== */

// The lookbehind is not optional: a bare /t\(/ matches the tail of `format(`,
// `split(`, `assert(` and every other identifier ending in t.
const KEY_CALL = /(?<![A-Za-z0-9_$.])t\(\s*(['"])([^'"]+)\1/g;
const ANY_CALL = /(?<![A-Za-z0-9_$.])t\(/g;
const HTML_HOOK = /data-i18n(?:-(?:aria-label|placeholder|title|alt))?="([^"]+)"/g;

function usedKeys() {
  const keys = new Set();
  for (const m of UI_SRC.matchAll(KEY_CALL)) keys.add(m[2]);
  for (const m of HTML_SRC.matchAll(HTML_HOOK)) keys.add(m[1]);

  return keys;
}

test('every key the app asks for exists in both dictionaries', () => {
  for (const key of usedKeys()) {
    assert.ok(Object.prototype.hasOwnProperty.call(RU, key), `ru is missing ${key}`);
    assert.ok(Object.prototype.hasOwnProperty.call(EN, key), `en is missing ${key}`);
  }
});

test('every key that exists is asked for — a dictionary is not a graveyard', () => {
  const used = usedKeys();
  const orphans = Object.keys(RU).filter((k) => !used.has(k));
  assert.deepEqual(orphans, [], `unused key(s): ${orphans.join(', ')}`);
});

test('no translation key is built at runtime — every t() call spells its key out', () => {
  // This is what makes the two tests above an equality rather than a guess. A
  // computed key is invisible to the scanner, and the scanner's failure mode is
  // a human deleting a live key to make it green. Fail loudly here instead.
  const literal = [...UI_SRC.matchAll(KEY_CALL)].length;
  const total = [...UI_SRC.matchAll(ANY_CALL)].length;
  assert.equal(total, literal,
    `${total - literal} t() call(s) do not name a literal key — spell them out`);
});

test('the shell markup and the Russian dictionary agree, so the duplicated copy cannot drift', () => {
  // The static HTML ships its Russian text so the first paint is right with no
  // flash — which means the copy exists twice. This is what keeps the two in
  // step. A country with two text sources has bitten this project before.
  const hooks = [...HTML_SRC.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]*)</g)];
  assert.ok(hooks.length > 0, 'no data-i18n text hooks found at all');
  for (const [, key, text] of hooks) {
    assert.equal(text.trim(), RU[key], `index.html text for ${key}`);
  }

  for (const m of HTML_SRC.matchAll(/aria-label="([^"]*)"[^>]*data-i18n-aria-label="([^"]+)"/g)) {
    assert.equal(m[1], RU[m[2]], `index.html aria-label for ${m[2]}`);
  }
  for (const m of HTML_SRC.matchAll(/data-i18n-aria-label="([^"]+)"[^>]*aria-label="([^"]*)"/g)) {
    assert.equal(m[2], RU[m[1]], `index.html aria-label for ${m[1]}`);
  }
});

test('the Mini App loads the dictionaries, then the engine, then core, then the app', () => {
  // ui.js reads window.MagicI18n on its first line and i18n.js reads
  // window.MagicLocales while building its default instance. A reordered script
  // tag is a TypeError before the first paint.
  const order = ['locales.js', 'i18n.js', 'core.js', 'ui.js']
    .map((name) => HTML_SRC.indexOf(`src="${name}`));

  for (const at of order) assert.notEqual(at, -1, 'a script tag is missing');
  for (let n = 1; n < order.length; n += 1) {
    assert.ok(order[n] > order[n - 1], `${['locales.js', 'i18n.js', 'core.js', 'ui.js'][n]} loads too early`);
  }
});

/* ==========================================================================
 * 9. Russian did not change
 * ======================================================================== */

// Frozen from `app/ui.js` as it stood before there were two languages,
// extracted by bracket-matched slice rather than by eye. It lives HERE and not
// in a helper that reads locales.js — a test that builds its oracle from the
// file under test asserts x === x.
//
// The two entries that were built by concatenation across two source lines are
// written out whole; the join is the trailing space, and losing it would give
// the customer «покупке.Рекламных».
const SHIPPED_RU = {
  'settings.loadFailed': 'Не удалось загрузить настройки.',
  'settings.email.section': 'Почта',
  'settings.email.none': 'Подтверждённых адресов нет. Подключите почту, чтобы покупки с сайта появились здесь.',
  'settings.email.add': 'Добавить покупки с сайта',
  'settings.email.have': 'Покупки с сайта на эти адреса появляются в «Мои eSIM» автоматически.',
  'settings.email.verifiedAt': 'подтверждён {date}',
  'settings.email.verified': 'подтверждён',
  'settings.email.disconnect': 'Отключить',
  'settings.email.disconnectAction': 'Отключить',
  'settings.email.disconnectConfirm': 'Отключить этот адрес? Покупки, которые уже добавлены, останутся — новые с этого адреса просто перестанут появляться сами.',
  'settings.email.disconnectFailed': 'Не удалось отключить. Попробуйте ещё раз.',
  'settings.notify.section': 'Уведомления',
  'settings.notify.lowData.title': 'Интернет заканчивается',
  'settings.notify.lowData.hint': 'При остатке 20% и 10%',
  'settings.notify.expiry.title': 'Срок действия истекает',
  'settings.notify.expiry.hint': 'За 3 дня и за сутки',
  'settings.notify.note': 'Приходят в этот чат. Данные eSIM и чек — на почту, указанную при покупке. Рекламных рассылок мы не отправляем.',
  'settings.notify.saveFailed': 'Не удалось сохранить. Попробуйте ещё раз.',
  'settings.account.section': 'Аккаунт',
  'settings.account.since': 'Вы с нами с',
  'settings.account.orders': 'Покупок',
  'settings.account.esims': 'eSIM',
  'settings.title': 'Настройки',
  'common.retry': 'Повторить',
  'common.confirmTitle': 'Подтвердите',
  'common.continue': 'Продолжить',
  'common.cancel': 'Отмена',
};

test('every Russian string that shipped before there were two languages is unchanged', () => {
  for (const [key, was] of Object.entries(SHIPPED_RU)) {
    assert.equal(RU[key], was, key);
  }
});

test('the frozen list covers every Russian key, not just the ones present when it was written', () => {
  // Without this the snapshot decays: a key added later escapes it forever and
  // the guarantee quietly shrinks. The only keys allowed to be outside it are
  // the ones that did not exist before — the language block itself.
  const introduced = [
    // Phase 1 — the language block itself.
    'settings.language.section', 'settings.language.hint',
    'settings.language.ru', 'settings.language.en',
    // Phase 2 — every key added while making the whole customer-facing app
    // speak two languages. Sentences the server picks BY CODE are NOT here:
    // they are SERVER_ERRORS in core.js, because a code is data and t() may
    // never be handed a computed key.
    'nav.sections', 'nav.home', 'nav.buy',
    'nav.esims', 'nav.help', 'home.aria',
    'home.title', 'home.payNote', 'search.placeholder',
    'search.aria', 'country.aria', 'country.title',
    'tariff.aria', 'claim.aria', 'claim.title',
    'help.aria', 'help.title', 'checkout.aria',
    'checkout.title', 'checkout.emailTitle', 'checkout.emailNote',
    'checkout.method', 'checkout.sbp', 'checkout.card',
    'checkout.pay', 'checkout.payNote', 'esims.aria',
    'esims.title', 'install.aria', 'install.title',
    'order.aria', 'order.checking', 'topup.aria',
    'topup.title', 'error.aria', 'loading.aria',
    'loading.text', 'home.myEsims', 'home.allEsims',
    'home.loadFailed', 'search.notFound', 'search.tryAnother',
    'search.showPopular', 'search.found', 'list.popular',
    'list.allCountries', 'list.regions', 'list.countries',
    'tile.from', 'stale.notice', 'common.refresh',
    'tile.fromWord', 'plan.unlimited', 'plan.gb',
    'plan.best', 'plan.hotspot', 'country.onePlan',
    'country.alsoFit', 'country.regionalFit', 'country.none',
    'country.pickAnother', 'tariff.coverageConditions', 'tariff.coverage',
    'tariff.afterPayment', 'tariff.unavailable', 'tariff.term',
    'tariff.willItWork', 'tariff.iphoneGuide', 'tariff.androidGuide',
    'tariff.buyFor', 'tariff.coverageCount', 'tariff.worksIn',
    'checkout.plan', 'checkout.total', 'checkout.creating',
    'checkout.needEmail', 'checkout.needTerms', 'checkout.opening',
    'checkout.payFailed', 'checkout.priceChanged', 'checkout.priceChangedPlain',
    'checkout.promoDropped', 'checkout.confirmLost', 'promo.applied',
    'promo.remove', 'promo.have', 'promo.label',
    'promo.apply', 'promo.enter', 'promo.checking',
    'promo.checkFailed', 'promo.withCode', 'topup.payFailed',
    'copy.copy', 'copy.copied', 'copy.selected',
    'daily.perDay', 'topup.showStatus', 'topup.alreadyRunning',
    'topup.action', 'topup.sectionTitle', 'topup.soon',
    'common.hide', 'topup.package', 'topup.payFor',
    'topup.confirmTitle', 'topup.validFor', 'topup.addsTo',
    'topup.card', 'terms.iAccept', 'terms.offerConditions',
    'common.back', 'topup.preparing', 'topup.goToPayment',
    'topup.toMyEsims', 'topup.checkingState', 'topup.notFound',
    'topup.checkAgain', 'topup.noServer', 'order.awaiting.title',
    'order.awaiting.note', 'order.paid.title', 'order.paid.note',
    'order.provisioning.title', 'order.provisioning.note', 'order.ready.title',
    'order.ready.note', 'order.failed.title', 'order.failed.note',
    'order.canceled.title', 'order.canceled.note', 'order.refunded.title',
    'order.refunded.note', 'order.checkFailed', 'order.notFound',
    'order.staleNote', 'order.notFoundNote', 'support.write',
    'help.intro', 'help.installGuides', 'help.iphone',
    'help.account', 'help.noAnswer', 'help.offer',
    'help.privacy', 'faq.install.q', 'faq.install.a',
    'faq.phone.q', 'faq.phone.a', 'faq.term.q',
    'faq.term.a', 'faq.paid.q', 'faq.paid.a',
    'faq.noNet.q', 'faq.noNet.a', 'faq.refund.q',
    'faq.refund.a', 'compat.iphone', 'compat.android',
    'compat.note', 'common.retryAction', 'common.openMyEsims',
    'order.checkingOrder', 'order.amount', 'order.unknownNote',
    'order.staleStatus', 'order.autoRefresh', 'order.openEsim',
    'esims.loadFailed', 'esims.empty', 'esims.pickPlan',
    'esims.boughtOnSite', 'esims.hidden', 'esims.hiddenNote',
    'claim.intro', 'claim.placeholder', 'claim.sendCode',
    'claim.sending', 'claim.badEmail', 'claim.already',
    'claim.alreadyNote', 'claim.alreadyAuto', 'claim.otherAddress',
    'claim.enterCode', 'claim.codeIntro', 'claim.attemptsLeft',
    'claim.confirm', 'claim.sixDigits', 'claim.resend',
    'claim.noMail', 'claim.added', 'claim.confirmed',
    'claim.alreadyAddedAll', 'claim.noneFound', 'claim.futureAuto',
    'claim.esimReady', 'claim.noEsim', 'esim.statusUnknown',
    'esim.remainingUnknownRefresh', 'esim.remainingOf', 'esim.remainingUnknown',
    'esim.ofTotal', 'esim.status.provisioning', 'esim.status.ready',
    'esim.status.active', 'esim.status.depleted', 'esim.status.expired',
    'esim.status.suspended', 'esim.status.failed', 'topup.status.awaiting_payment',
    'topup.status.paid', 'topup.status.in_progress', 'topup.status.completed',
    'topup.status.verifying', 'topup.status.needs_review', 'topup.status.refund_pending',
    'claim.foundAdded', 'esim.notFound', 'esim.loadFailed',
    'rename.placeholder', 'rename.label', 'common.save',
    'common.saving', 'rename.note', 'rename.reset',
    'rename.tooLong', 'hide.confirm', 'hide.failed',
    'manage.title', 'manage.rename', 'manage.unhide',
    'manage.hide', 'manage.hiddenNote', 'esim.isHidden',
    'esim.installQr', 'esim.refreshData', 'esim.refreshing',
    'esim.tooSoon', 'esim.providerQuiet', 'esim.refreshFailed',
    'install.notFound', 'install.loadFailed', 'install.stillIssuing',
    'install.qrAlt', 'install.ios1', 'install.ios2',
    'install.ios3', 'install.ios4', 'install.ios5',
    'install.and1', 'install.and2', 'install.and3',
    'install.and4', 'install.and5', 'install.phoneType',
    'install.oneTapIos', 'install.oneTapAnd', 'install.oneTapIosNote',
    'install.oneTapAndNote', 'install.whichPhone', 'install.manual',
    'install.smdp', 'install.code', 'install.lpa',
    'install.note', 'order.payCheckFailed', 'order.payCheckNote',
    'login.failed', 'login.network', 'login.outside',
    'login.outsideNote', 'afterPay.1', 'afterPay.2',
    'afterPay.3', 'terms.offer', 'terms.privacy',
    'terms.andWord', 'esim.validUntil', 'errors.promoFallback',
    'errors.topupTransport', 'errors.topupFallback', 'errors.orderFallback',
    'errors.codeCheckFallback', 'errors.renameFallback', 'errors.loginFallback',
    // 2026-09-03 — the channel invitation on the home screen. `channel.*` and
    // not `promo.*`: the checkout's promo-code block already owns that prefix.
    // The code itself is not a key — it is not in the bundle at all.
    'channel.title', 'channel.text', 'channel.codeLabel', 'channel.cta',
    'channel.verify', 'channel.checking', 'channel.notFound', 'channel.checkFailed',
  ];

  assert.deepEqual(
    Object.keys(RU).sort(),
    Object.keys(SHIPPED_RU).concat(introduced).sort()
  );
});

test('the settings screen no longer formats a date with a hardcoded locale', () => {
  // Bracket-matched slice, never a line offset: an assertion pinned to a fixed
  // window stops covering the code after a refactor and stays green.
  const from = UI_SRC.indexOf('async function renderSettings(');
  const to = UI_SRC.indexOf('function renderHelp(');
  assert.ok(from > 0 && to > from, 'the settings slice could not be located');

  const slice = UI_SRC.slice(from, to);
  assert.ok(/function paintSettings\(/.test(slice), 'the slice must cover the paint');
  assert.ok(/function emailRow\(/.test(slice), 'the slice must cover the email row');
  assert.equal(/toLocaleDateString/.test(slice), false, 'dates here go through I.formatDate');
});

test('the settings screen has no Russian literal left in it', () => {
  // Over the comment-stripped source: comments here are prose and legitimately
  // quote Russian, and an apostrophe in an English one would otherwise open a
  // string literal that runs to the end of the file.
  const from = UI_SRC.indexOf('async function renderSettings(');
  const to = UI_SRC.indexOf('function renderHelp(');
  const slice = UI_SRC.slice(from, to);

  const literals = [...slice.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
  const cyrillic = literals.filter((s) => /[Ѐ-ӿ]/.test(s));
  assert.deepEqual(cyrillic, [], `still hardcoded: ${cyrillic.join(' | ')}`);
});

/* ==========================================================================
 * 10. The line between copy and identifiers
 *
 * These two do not test today's code — today's code obviously passes. They
 * exist so that the day somebody reaches for the language while wiring
 * something else, the build says no.
 * ======================================================================== */

test('the purchase fingerprint does not know what language the app is in', () => {
  // Language is not part of what makes an order a different order: same
  // package, same price, same term, same charge. Putting it in the scope would
  // mint a NEW idempotency key for a purchase already in flight — so paying,
  // leaving for the payment page, switching language and coming back to tap
  // again would create a SECOND order instead of replaying the first. The
  // failure would also be silent: the sessionStorage slot name is derived from
  // this same string, so the old key could no longer be found.
  const CORE = require('./core.js');
  const intent = {
    package_id: 'pkg-1', payment_type: 'sbp', promo_code: 'FRIENDS10',
    email: 'buyer@example.com', days: 7,
  };

  const scope = CORE.purchaseIntentScope(intent);
  assert.equal(scope.includes('ru'), false, scope);
  assert.equal(scope.includes('en'), false, scope);
  assert.equal(scope, CORE.purchaseIntentScope(Object.assign({ lang: 'en' }, intent)),
    'an extra language field must not change the fingerprint');
});

test('a notification preference is sent by its identifier, never by its label', () => {
  // `notifyToggle(key, initial, title, hint)` posts `{ [key]: want }`. The key
  // is argument one and the copy is arguments three and four; the moment a key
  // is derived from a translated string, the app starts sending the customer's
  // language to the server as a field name.
  assert.match(UI_SRC, /notifyToggle\(\s*'low_data'/);
  assert.match(UI_SRC, /notifyToggle\(\s*'expiry'/);

  for (const value of Object.values(RU).concat(Object.values(EN))) {
    assert.equal(/^(low_data|expiry|sbp|card)$/.test(value), false,
      `${value} is an identifier, not copy — it must not live in a dictionary`);
  }
});

test('the file no longer tells the next reader that the app has one language', () => {
  // The comment that was true is now false, and this codebase's tests read
  // source text. Leaving it would have the next person re-derive the wrong
  // conclusion — which is exactly how the e2e assertion that forbade a picker
  // came to be written.
  for (const claim of ['There is NO language control', 'no localisation of any kind',
    'There is NO notifications toggle']) {
    assert.equal(UI_SRC.includes(claim), false, `stale claim still in ui.js: ${claim}`);
  }
});
