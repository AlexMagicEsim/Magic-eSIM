// P1-1 / P1-4 — the statements of the international checkout (seo/checkout-statements.mjs): frozen per version, the
// same four statements in every international language, the public list the backend copies, and the words the
// documents promise (Terms §5.3(e) the 18+ confirmation; the record's time is the SERVER's, never «when you ticked»).
//
// Run: node --test seo/test-checkout-statements.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STATEMENTS_VERSION, STATEMENTS_JSON, STATEMENT_IDS, statementLanguages, currentSet, snapshots, problems, statementsJson,
} from './checkout-statements.mjs';
import { TERMS } from './terms-en.mjs';
import { REFUND } from './refund-en.mjs';
import { LEGAL_TRANSLATIONS } from './legal-i18n.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const plain = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const PREFIX = { en: 'en', es: 'es', de: 'de', fr: 'fr', 'zh-Hans': 'zh', ko: 'ko' };

test('the international languages are exactly en, es, de, fr, zh-Hans, ko — Russian has its own checkout', () => {
  assert.deepEqual(statementLanguages(), ['en', 'es', 'de', 'fr', 'zh-Hans', 'ko']);
  assert.deepEqual(STATEMENT_IDS, ['terms_refund', 'immediate_supply', 'age_18', 'device_compatible']);
});

test(`the current set v${STATEMENTS_VERSION} is frozen, intact, and what the pages say`, () => {
  assert.deepEqual(problems(), []);
  const v = snapshots().find((s) => s.version === STATEMENTS_VERSION);
  assert.deepEqual(Object.keys(v.languages), statementLanguages());
  for (const [code, list] of Object.entries(v.languages)) {
    assert.deepEqual(list.map((x) => x.id), STATEMENT_IDS, code);
    for (const x of list) assert.ok(x.text.length > 5 && /^[0-9a-f]{64}$/.test(x.sha256), `${code} ${x.id}`);
  }
});

test('the check can fire: a changed word, a damaged text, a missing language, an unfrozen version', () => {
  const list = snapshots();
  const now = currentSet();
  const changed = JSON.parse(JSON.stringify(now));
  changed.languages.de[2].text = `${changed.languages.de[2].text}!`;
  assert.match(problems(list, changed).join('\n'), /v1 de age_18: the words changed since the set was frozen/);
  const damaged = JSON.parse(JSON.stringify(list));
  damaged[0].languages.ko[0].text += ' ';
  assert.match(problems(damaged, now).join('\n'), /v1 ko terms_refund: the text does not match its own sha256/);
  const missing = JSON.parse(JSON.stringify(list));
  delete missing[0].languages.fr;
  assert.match(problems(missing, now).join('\n'), /v1 fr: not in the frozen set/);
  assert.match(problems([], now).join('\n'), /not frozen/);
});

test('the public list is generated, committed and published: every frozen version, the current one marked', () => {
  assert.equal(read(STATEMENTS_JSON), statementsJson());
  const doc = JSON.parse(read(STATEMENTS_JSON));
  assert.equal(doc.current, STATEMENTS_VERSION);
  assert.deepEqual(doc.versions.filter((v) => v.current).map((v) => v.version), [STATEMENTS_VERSION]);
  assert.match(read('scripts/build-pages-artifact.mjs'), /'en\/checkout-statements\.json'/, 'in the Pages allow list');
});

test('every international page names the set it shows, and shows its words: the three boxes and the device box', () => {
  const set = currentSet();
  for (const code of statementLanguages()) {
    const h = read(`${PREFIX[code]}/esim/japan/index.html`);
    assert.match(h, new RegExp(`data-statements-version="${STATEMENTS_VERSION}"`), code);
    const t = Object.fromEntries(set.languages[code].map((x) => [x.id, x.text]));
    const text = plain(h);
    const bare = (x) => x.replace(/\s+/g, '');
    for (const id of ['immediate_supply', 'age_18']) assert.ok(bare(text).includes(bare(t[id])), `${code} ${id}`);
    assert.ok(bare(text).includes(bare(t.terms_refund)), `${code} terms_refund (link words as plain text)`);
    assert.ok(h.includes(`<span data-i18n="checkout.device">${t.device_compatible}</span>`), `${code} device_compatible`);
  }
  assert.doesNotMatch(read('esim/japan/index.html'), /data-statements-version|coAgreeAge/, 'the Russian page is untouched');
});

test('Terms §5.3(e): the 18+ confirmation is asked at checkout — in English and in every translation', () => {
  const en = plain(TERMS.sections.find((s) => s.id === 'how-to-order').html);
  assert.match(en, /\(e\) confirm that you are at least 18 years old \(section 3\.1\)\./);
  assert.match(plain(TERMS.sections.find((s) => s.id === 'who-can-buy').html), /at least 18 years old/);
  for (const [code, T] of Object.entries(LEGAL_TRANSLATIONS)) {
    const x = plain(T.terms.sections.find((s) => s.id === 'how-to-order').html);
    assert.match(x, /\(e\)[^<]*18/, `${code}: §5.3(e)`);
  }
});

test('the record\'s time is the server\'s: Terms §5.3 and Refund §4.2 never claim the moment a box was ticked', () => {
  const terms = plain(TERMS.sections.find((s) => s.id === 'how-to-order').html);
  assert.match(terms, /We keep a record of what you accepted, with the date and time our server recorded it\./);
  const refund = plain(REFUND.sections.find((s) => s.id === 'your-statutory-rights').html);
  assert.match(refund, /We repeat this text in your order confirmation email, with the date and time our server recorded your request\./);
  for (const D of [TERMS, REFUND]) assert.doesNotMatch(plain(D.sections.map((s) => s.html).join(' ')), /you ticked the box|and when\./);
  const OLD = { de: /angekreuzt hast/, es: /marcaste la casilla/, fr: /avez coché la case/, 'zh-Hans': /您勾选该复选框的日期/, ko: /체크한 날짜/ };
  for (const [code, T] of Object.entries(LEGAL_TRANSLATIONS)) {
    const all = plain([...T.terms.sections, ...T.refund.sections].map((s) => s.html).join(' '));
    assert.doesNotMatch(all, OLD[code], `${code}: the old «when you ticked» wording`);
  }
});
