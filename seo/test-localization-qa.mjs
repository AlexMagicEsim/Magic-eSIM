/* The localization-QA skill (.claude/skills/localization-qa/), its scripts and its promises.
 *
 *   - extract: every published string of a language beside its English source (Spanish: 515), unique ids, nothing
 *     missing; an unpublished language or the root one is refused;
 *   - check: every deterministic rule fires on the case it exists for and stays quiet on a clean string;
 *   - batch: the site's own groups, at most 45 strings, the country names as one batch;
 *   - merge: a model cannot change what it quotes (en/target come from the items), malformed or low-confidence findings
 *     are dropped and counted, a second opinion can reject (kept apart) or downgrade;
 *   - the skill is read-only and offline, and keeps AI findings away from the native reviewer's verdicts.
 *
 * Run: node --test seo/test-localization-qa.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, '.claude/skills/localization-qa');
const imp = (rel) => import(pathToFileURL(join(SKILL, rel)).href);
const { extract } = await imp('scripts/extract.mjs');
const { check } = await imp('scripts/check.mjs');
const { plan } = await imp('scripts/batch.mjs');
const { merge, markdown, CATEGORIES, SEVERITIES } = await imp('scripts/merge.mjs');

const ES = await extract('es');

test('extract: 950 Spanish strings beside their English source — unique ids, none missing, every group', () => {
  assert.equal(ES.items.length, 950); // + 55 authored country strings (malaysia 27, singapore 28; seo/content-es/, 2026-10-28); + 21 page words of the region pages (international SEO stage 4, 2026-10-27); + 333 authored country strings (13 files, seo/content-es/) and the 2 headings they add (2026-10-27); + 8 page words of «at a glance» (international SEO, 2026-10-27); − 1 country (ZW withdrawn by the provider, 2026-10-26); + 8 words of LEGAL-3 (the consents, footer.refund); + 1 country (VI, 2026-10-25); + 9 words of LEGAL-5 (start of validity, activation deadline)
  assert.equal(new Set(ES.items.map((i) => i.id)).size, ES.items.length);
  assert.deepEqual(ES.items.filter((i) => i.target == null || i.target === ''), []);
  const by = {}; for (const i of ES.items) by[i.group] = (by[i.group] || 0) + 1;
  assert.deepEqual(by, { ui: 150, page: 83, daily: 20, 'guide-iphone': 24, 'guide-android': 20, 'guide-compatibility': 20,
    'guide-activation': 22, 'guide-troubleshooting': 20, 404: 5, countries: 198, content: 2,
    'content-china': 28, 'content-france': 24, 'content-greece': 24, 'content-indonesia': 24, 'content-japan': 29,
    'content-malaysia': 27, 'content-maldives': 25, 'content-mexico': 23, 'content-singapore': 28, 'content-south-korea': 30, 'content-sri-lanka': 24, 'content-thailand': 28,
    'content-turkey': 24, 'content-united-kingdom': 25, 'content-vietnam': 23 });
  // every authored string sits beside its English source
  assert.deepEqual(ES.items.filter((i) => i.group.startsWith('content') && !i.en), []);
  assert.equal(ES.items.find((i) => i.id === 'content:faqTitle').target, 'Preguntas frecuentes: Japón');
  const nav = ES.items.find((i) => i.id === 'ui:nav.destinations');
  assert.equal(nav.en, 'Destinations'); assert.equal(nav.target, 'Destinos');
  assert.ok(ES.items.every((i) => i.url.startsWith('https://magicesim.store/es/')));
});

test('extract refuses a language with nothing live to review, and the root language', async () => {
  // KO-1: every registry language is published — «not published» is proved on a copy of the registry in test-locale-*
  await assert.rejects(extract('ru'), /not a prefixed/);
  await assert.rejects(extract('xx'), /not a prefixed/);
});

const item = (o) => ({ id: `t:${o.key || 'k'}`, group: 'ui', kind: 'ui', key: 'k', where: 'test', url: 'https://magicesim.store/es/', note: '', ...o });
const rulesOf = async (items) => (await check({ lang: 'es', items })).map((f) => f.rule.split(':')[0]);

test('check: every rule fires on the case it exists for', async () => {
  const cases = [
    [item({ en: 'Show all {n} plans', target: 'Ver todos los planes' }), 'placeholders'],
    [item({ en: 'Plans for one country', target: 'Plans for one country' }), 'untranslated'],
    [item({ en: 'x', target: '' }), 'missing'],
    [item({ kind: 'seo-title', en: 'Short title', target: 'Un título de búsqueda que es claramente demasiado largo para Google y se corta' }), 'seo-title-length'],
    [item({ kind: 'seo-description', en: 'd', target: 'x'.repeat(170) }), 'seo-description-length'],
    [item({ group: 'guide-iphone', en: 'Install the eSIM.', target: 'Instala la eSIM con datos ilimitados.' }), 'claim-guards'],
    [item({ en: 'Scan the QR code', target: 'Escanea el código' }), 'do-not-translate'],
    [item({ en: 'on a computer', target: 'en un ordenador' }), 'glossary'],
    [item({ en: 'Install it', target: 'Instaladla vosotros' }), 'style'],
    [item({ en: 'Will my phone work?', target: 'Funcionará mi teléfono?' }), 'inverted-question'],
    [item({ en: 'Data', target: 'Datos  móviles' }), 'double-space'],
  ];
  for (const [it, rule] of cases) assert.ok((await rulesOf([it])).includes(rule), `${rule} must fire on «${it.target}»`);
  const dup = [item({ id: 'c:AA', kind: 'country-name', group: 'countries', key: 'AA', en: 'A', target: 'Igual' }),
    item({ id: 'c:BB', kind: 'country-name', group: 'countries', key: 'BB', en: 'B', target: 'Igual' })];
  assert.ok((await rulesOf(dup)).includes('duplicate-name'));
});

test('check: a clean string, a technical key and a decided price format are not findings', async () => {
  assert.deepEqual(await rulesOf([item({ en: 'Will my phone work?', target: '¿Funcionará mi teléfono?' }),
    item({ kind: 'technical', en: 'en-US', target: 'es-419' }), item({ en: 'Price', target: 'Precio: USD 12.99' })]), []);
});

// The rules' firing is proved on synthetic strings above. On the live Spanish the two defects the first run found
// (iPhone «ordenador», the 70-character Android title) were fixed by PR #120 — they must stay fixed.
test('check on the live Spanish: the fixed defects stay fixed, no false «untranslated»', async () => {
  const f = await check(ES);
  const rules = f.map((x) => `${x.item_id}|${x.rule.split(':')[0]}`);
  assert.ok(!rules.includes('guide-iphone:s2.body|glossary'), '«ordenador» is back on the iPhone guide');
  assert.equal(f.filter((x) => x.rule === 'seo-title-length' && x.item_id.startsWith('guide-')).length, 0, 'a guide title over the budget');
  assert.equal(f.filter((x) => x.rule === 'untranslated').length, 0);
  assert.equal(f.filter((x) => x.rule === 'placeholders').length, 0);
  for (const x of f) { assert.ok(CATEGORIES.includes(x.category), x.category); assert.ok(SEVERITIES.includes(x.severity)); }
});

test('batch: groups packed up to --max (split when larger), the country names alone, every string once', () => {
  for (const max of [45, 110]) {
    const b = plan(ES.items, max);
    assert.ok(b.every((x) => x.items.length <= max || x.group === 'countries'), `max ${max}`);
    assert.equal(b.filter((x) => x.group === 'countries').length, 1);
    assert.equal(b.reduce((n, x) => n + x.items.length, 0), ES.items.length);
    assert.equal(new Set(b.flatMap((x) => x.items.map((i) => i.id))).size, ES.items.length);
  }
  assert.equal(plan(ES.items, 110).length, 9, 'nine batches a stage at --max 110 (the ui group, 150 strings since LEGAL-5, splits in two; the authored country text, 333 strings since 2026-10-27 and 388 since 2026-10-28, adds four)');
});

test('merge: the arbiter\'s decisions become a change log — EN, old, new, reason, every stage\'s evidence, landed or not', () => {
  const run = { lang: 'es', items: [item({ id: 'a', en: '{n} countries, incl. {name}', target: '{n} países, incluido {name}' }), item({ id: 'b', en: 'Data', target: 'Datos' }), item({ id: 'c', en: 'Plans', target: 'Planes' })] };
  const ai = [{ item_id: 'a', stage: 'linguistic', objective: true, suggestion: '{n} países, entre ellos {name}', explanation: 'agreement', category: 'grammar', severity: 'minor', confidence: 0.8 },
    { item_id: 'b', stage: 'fidelity', objective: false, suggestion: 'Datos móviles', explanation: 'nuance', category: 'fluency', severity: 'preferential', confidence: 0.6 }];
  const decisions = [{ item_id: 'a', decision: 'apply', final: '{n} países, entre ellos {name}', severity: 'minor', reason: 'gender agreement' },
    { item_id: 'b', decision: 'keep', reason: 'correct and clear' }, { item_id: 'c', decision: 'apply' }, { item_id: 'zz', decision: 'apply', final: 'x' }];
  const after = { items: [{ id: 'a', target: '{n} países, entre ellos {name}' }, { id: 'b', target: 'Datos' }] };
  const r = merge({ run, ai, decisions, after });
  assert.equal(r.changes.length, 1);
  const c = r.changes[0];
  assert.deepEqual([c.en, c.old, c.new, c.reason], ['{n} countries, incl. {name}', '{n} países, incluido {name}', '{n} países, entre ellos {name}', 'gender agreement']);
  assert.equal(c.evidence[0].stage, 'linguistic');
  assert.deepEqual(c.checks, { placeholders_kept: true, landed: true });
  assert.equal(r.kept.length, 1);
  assert.deepEqual(r.arbitration.invalid, ['c', 'zz'], 'an «apply» without wording or for an unknown string is refused');
  const broken = merge({ run, ai, decisions: [{ item_id: 'a', decision: 'apply', final: '{n} países', reason: 'x' }], after: { items: [{ id: 'a', target: 'other' }] } });
  assert.deepEqual(broken.changes[0].checks, { placeholders_kept: false, landed: false });
  assert.match(markdown(r), /## Решения арбитра/);
});

test('merge: quotes come from the items, bad findings are dropped and counted, a second opinion rejects or downgrades', () => {
  const run = { lang: 'es', items: [item({ id: 'a', en: 'Plans', target: 'Planes' }), item({ id: 'b', en: 'Data', target: 'Datos' })] };
  const ai = [
    { item_id: 'a', en: 'FORGED', target: 'FORGED', suggestion: 'Planes de datos', explanation: 'clearer', category: 'fluency', severity: 'minor', confidence: 0.7 },
    { item_id: 'b', suggestion: 'Datos móviles', explanation: 'x', category: 'accuracy', severity: 'major', confidence: 0.9 },
    { item_id: 'b', suggestion: 'Data', explanation: 'x', category: 'accuracy', severity: 'critical', confidence: 0.95 },
    { item_id: 'nope', suggestion: 's', explanation: 'x', category: 'fluency', severity: 'minor', confidence: 0.9 },
    { item_id: 'a', suggestion: 's', explanation: 'x', category: 'made-up', severity: 'minor', confidence: 0.9 },
    { item_id: 'a', suggestion: 's', explanation: 'x', category: 'fluency', severity: 'minor', confidence: 0.3 },
    { item_id: 'a', en: 'x', suggestion: 'Planes de datos', explanation: 'again', category: 'fluency', severity: 'minor', confidence: 0.8 },
  ];
  const first = merge({ run, ai });
  assert.equal(first.findings.length, 3);
  const a = first.findings.find((f) => f.item_id === 'a');
  assert.equal(a.en, 'Plans'); assert.equal(a.target, 'Planes', 'a model cannot change what it quotes');
  assert.deepEqual(first.meta.dropped, { unknownItem: 1, badShape: 1, lowConfidence: 1, duplicate: 1 });
  const crit = first.findings.find((f) => f.severity === 'critical'); const maj = first.findings.find((f) => f.severity === 'major');
  const second = merge({ run, ai, verify: [{ id: crit.id, verdict: 'reject', reason: 'adds nothing' }, { id: maj.id, verdict: 'downgrade', severity: 'minor', reason: 'taste' }] });
  assert.equal(second.findings.length, 2);
  assert.equal(second.rejected.length, 1);
  assert.equal(second.findings.find((f) => f.id === maj.id).severity, 'minor');
  // a deterministic finding with no wording gets the second reviewer's; a finding that has one keeps it
  const chk = [{ id: 'C0001', item_id: 'a', suggestion: '', explanation: 'title too long', category: 'seo', severity: 'minor', confidence: 0.9, rule: 'seo-title-length' }];
  const third = merge({ run, check: chk, ai, verify: [{ id: 'C0001', verdict: 'confirm', suggestion: 'Planes', reason: 'shorter' }, { id: maj.id, verdict: 'confirm', suggestion: 'IGNORED', reason: 'ok' }] });
  assert.equal(third.findings.find((f) => f.id === 'C0001').suggestion, 'Planes');
  assert.equal(third.findings.find((f) => f.id === maj.id).suggestion, 'Datos móviles');
  const md = markdown(second);
  assert.match(md, /# Ревью локализации: es/); assert.match(md, /\*\*EN\*\*/); assert.match(md, /Отклонено вторым мнением/);
});

test('the skill is read-only and offline, and keeps AI findings away from the native reviewer', () => {
  const md = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
  assert.match(md, /^---\nname: localization-qa\ndescription: /);
  assert.match(md, /mode: read-only/);
  assert.match(md, /There is no\s+native-speaker review/);
  assert.match(md, /Correct wording is not rewritten for taste/);
  assert.match(md, /its `verdicts` stay apart from AI findings/);
  for (const f of readdirSync(join(SKILL, 'scripts'))) {
    const src = readFileSync(join(SKILL, 'scripts', f), 'utf8');
    assert.doesNotMatch(src, /\bfetch\(|node:https?|node:net|child_process|https?:\/\/(?!magicesim\.store)/, `${f}: no network, no subprocess`);
    assert.doesNotMatch(src, /verdicts['"]?\s*\)|collection\(/, `${f}: never touches the review artifact`);
  }
  for (const f of ['rubric.md', 'review-prompt.md', 'verify-prompt.md', 'review-linguistic.md', 'review-fidelity.md', 'arbiter-prompt.md', '_template/README.md', 'es/README.md', 'es/platform-labels.md']) {
    assert.ok(existsSync(join(SKILL, 'references', f)), f);
  }
  for (const f of ['es/style.json', 'es/glossary.json']) JSON.parse(readFileSync(join(SKILL, 'references', f), 'utf8'));
});
