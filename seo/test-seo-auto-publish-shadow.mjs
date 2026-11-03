// scripts/seo-auto-publish-shadow.mjs — stage 2 of the catalogue-publication
// plan (2026-11-03): decide whether a rebuild could have been published without a
// person, and only RECORD it. The rules, the masks on a real page, the report and
// the wiring (shadow mode: no token, exit 0, read by no later step).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { maskNumbers, maskLists, maskRelated, classify, toMarkdown } from '../scripts/seo-auto-publish-shadow.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/* ------------------------------------------------------------ the masks */

test('a real page: a new price, floor or count masks to the same page; a new word does not', () => {
  const html = read('esim/brazil/index.html');
  const prices = html.match(/\d[\d   ]* ?₽/g);
  assert.ok(prices && prices.length > 5, 'the page prints amounts');
  let moved = html.replace(/(\d) (\d{3}) ₽/g, (m, a, b) => `${Number(a) + 1} ${b} ₽`).replace(/Цены от <b data-cat="floor">\d+ ₽/, 'Цены от <b data-cat="floor">1 250 ₽');
  moved = moved.replace(/<b data-cat="local">\d+<\/b>/, '<b data-cat="local">21</b>');
  assert.notEqual(moved, html);
  assert.equal(maskNumbers(moved), maskNumbers(html), 'only numbers moved');
  const worded = html.replace('дороже', 'дешевле');
  assert.notEqual(maskNumbers(worded), maskNumbers(html), 'a word is text');
});

test('the counted nouns lose their plural: «22 тарифа» and «27 тарифов» are the same page', () => {
  assert.equal(maskNumbers('<p>22 тарифа · от 150 ₽</p>'), maskNumbers('<p>27 тарифов · от 1 400 ₽</p>'));
  assert.equal(maskNumbers('в 1 стране'), maskNumbers('в 5 странах'));
  assert.equal(maskNumbers('7 дней'), maskNumbers('1 день'));
  assert.notEqual(maskNumbers('22 тарифа'), maskNumbers('22 пакета'), 'another noun is another word');
  assert.equal(maskNumbers('<script src="/a.js?v=1a2b3c4d" defer>'), maskNumbers('<script src="/a.js?v=ffeeddcc" defer>'), 'asset stamps are not text');
});

test('the stage-3 readings: a longer list of values, the related destinations', () => {
  const a = maskNumbers('<p>1 GB, 3 GB, 5 GB</p>');
  const b = maskNumbers('<p>1 GB, 3 GB, 5 GB, 10 GB</p>');
  assert.notEqual(a, b, 'for the verdict a longer list is a change');
  assert.equal(maskLists(a), maskLists(b));
  assert.equal(maskLists(maskNumbers('1, 3 и 5 ГБ')), maskLists(maskNumbers('1 и 3 ГБ')));
  const r1 = '<ul><li><a href="/de/esim/andorra/">Andorra</a></li><li><a href="/de/esim/chile/">Chile</a></li></ul>';
  const r2 = '<ul><li><a href="/de/esim/azerbaijan/">Aserbaidschan</a></li></ul>';
  assert.notEqual(maskLists(r1), maskLists(r2));
  assert.equal(maskRelated(r1), maskRelated(r2));
});

/* ------------------------------------------------------------ the rules */

const countries = (slugs) => JSON.stringify({ countries: slugs.map((slug) => ({ slug })) });
const sitemap = (locs) => `<urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join('')}</urlset>`;
const suppressed = (entries) => JSON.stringify({ entries });
const lastmod = (pages) => JSON.stringify({ pages });
function tree(over = {}) {
  return {
    'seo/catalogue-countries.json': countries(['brazil', 'chile']),
    'sitemap.xml': sitemap(['https://magicesim.store/esim/brazil/', 'https://magicesim.store/esim/chile/']),
    'seo/suppressed-claims.json': suppressed([]),
    'seo/sitemap-lastmod.json': lastmod({ a: { lastmod: '2026-11-01' } }),
    'esim/brazil/index.html': '<h1>eSIM для Бразилии</h1><p>23 тарифа · от 300 ₽</p><p>1 GB, 3 GB</p>',
    'esim/chile/index.html': '<h1>eSIM для Чили</h1><ul><li><a href="/esim/peru/">Перу</a></li></ul>',
    ...over,
  };
}
const run = (before, after, porcelain, gates = 'success', browser = 'success') => classify({
  porcelain, gates, browser,
  before: (p) => (p in before ? before[p] : null),
  after: (p) => (p in after ? after[p] : null),
});
const M = (...paths) => paths.map((p) => ` M ${p}`).join('\n');

test('only numbers moved, nothing else: «auto»', () => {
  const after = tree({ 'esim/brazil/index.html': '<h1>eSIM для Бразилии</h1><p>27 тарифов · от 250 ₽</p><p>1 GB, 3 GB</p>',
    'seo/sitemap-lastmod.json': lastmod({ a: { lastmod: '2026-11-03' } }) });
  const r = run(tree(), after, M('esim/brazil/index.html', 'seo/sitemap-lastmod.json'));
  assert.equal(r.verdict, 'auto', JSON.stringify(r.reasons));
  assert.deepEqual(r.pages, { changed: 1, numbers_only: 1, text_changed: 0, lists_only: 0, related_links_only: 0, words: 0 });
  assert.deepEqual(r.lastmod, { moved_now: 1, moved_if_number_blind: 0 });
});

test('a word, a longer list, other related links: «review», each counted in its own bucket', () => {
  const after = tree({
    'esim/brazil/index.html': '<h1>eSIM для Бразилии</h1><p>27 тарифов · от 250 ₽</p><p>1 GB, 3 GB, 5 GB</p>',
    'esim/chile/index.html': '<h1>eSIM для Чили</h1><ul><li><a href="/esim/bolivia/">Боливия</a></li></ul>',
  });
  const r = run(tree(), after, M('esim/brazil/index.html', 'esim/chile/index.html'));
  assert.equal(r.verdict, 'review');
  assert.deepEqual(r.reasons.map((x) => x.code), ['text_changed']);
  assert.equal(r.pages.lists_only, 1);
  assert.equal(r.pages.related_links_only, 1);
  const worded = run(tree(), tree({ 'esim/brazil/index.html': '<h1>eSIM для Бразилии и соседей</h1><p>23 тарифа · от 300 ₽</p><p>1 GB, 3 GB</p>' }), M('esim/brazil/index.html'));
  assert.equal(worded.pages.words, 1);
});

test('a newly left-out sentence is «review», and so is one that came back', () => {
  const entry = { slug: 'brazil', source: 'coverage', id: 'count-cov' };
  const r = run(tree(), tree({ 'seo/suppressed-claims.json': suppressed([entry]) }), M('seo/suppressed-claims.json'));
  assert.equal(r.verdict, 'review');
  assert.equal(r.reasons[0].code, 'suppressed_claims_changed');
  assert.deepEqual(r.reasons[0].detail.added, ['brazil|coverage|count-cov|']);
  const back = run(tree({ 'seo/suppressed-claims.json': suppressed([entry]) }), tree(), M('seo/suppressed-claims.json'));
  assert.deepEqual(back.reasons[0].detail.removed, ['brazil|coverage|count-cov|']);
});

test('a page or URL that appears or disappears is «review»', () => {
  const after = tree({ 'seo/catalogue-countries.json': countries(['brazil', 'chile', 'peru']),
    'sitemap.xml': sitemap(['https://magicesim.store/esim/brazil/', 'https://magicesim.store/esim/chile/', 'https://magicesim.store/esim/peru/']),
    'esim/peru/index.html': '<h1>eSIM для Перу</h1>' });
  const r = run(tree(), after, `${M('seo/catalogue-countries.json', 'sitemap.xml')}\n?? esim/peru/index.html`);
  const codes = r.reasons.map((x) => x.code);
  assert.equal(r.verdict, 'review');
  for (const c of ['file_added_or_deleted', 'pages_changed', 'urls_changed']) assert.ok(codes.includes(c), `${c} in ${codes}`);
});

test('a red gate, a red browser tier, a path outside the allowlist, an unreadable file: «review»', () => {
  const after = tree({ 'esim/brazil/index.html': '<h1>eSIM для Бразилии</h1><p>27 тарифов · от 250 ₽</p><p>1 GB, 3 GB</p>' });
  const codes = (r) => r.reasons.map((x) => x.code);
  assert.deepEqual(codes(run(tree(), after, M('esim/brazil/index.html'), 'failure')), ['gates_not_green']);
  assert.deepEqual(codes(run(tree(), after, M('esim/brazil/index.html'), 'success', 'skipped')), ['browser_not_green']);
  assert.ok(codes(run(tree(), after, M('esim/brazil/index.html', 'assets/ru-checkout.js'))).includes('path_outside_allowlist'));
  const broken = { ...after }; delete broken['sitemap.xml'];
  assert.ok(codes(run(tree(), broken, M('esim/brazil/index.html'))).includes('unreadable'));
});

/* ------------------------------------------------------------ the report and the command */

test('page text in the report cannot become a link, a mention or markup in the PR body', () => {
  const evil = '<h1>x</h1><p>@owner [click](https://evil.example) `code` </p>';
  const r = run(tree(), tree({ 'esim/brazil/index.html': evil }), M('esim/brazil/index.html'));
  const md = toMarkdown(r);
  const line = md.split('\n').find((l) => l.includes('esim/brazil/index.html'));
  assert.ok(line, md);
  for (const piece of line.split(' → ')) {
    const spans = piece.match(/`[^`]*`/g) || [];
    assert.ok(spans.length >= 1, piece);
  }
  assert.doesNotMatch(line.replace(/`[^`]*`/g, ''), /@owner|\]\(https?:/, 'everything from the page is inside code spans');
});

test('the command never fails the job: no arguments, no files — «review» with the error, exit 0', () => {
  const out = execFileSync('node', ['scripts/seo-auto-publish-shadow.mjs', '--out', join(ROOT, 'test-results', 'shadow-test')], { cwd: ROOT, encoding: 'utf8' });
  const line = out.split('\n').find((l) => l.startsWith('SEO_SHADOW '));
  assert.ok(line, out);
  const r = JSON.parse(line.slice('SEO_SHADOW '.length));
  assert.equal(r.verdict, 'review');
  assert.deepEqual(r.reasons, ['error']);
});

/* ------------------------------------------------------------ the wiring: shadow means shadow */

const WF = read('.github/workflows/seo-refresh-pr.yml');
const stepBlock = (name) => {
  const at = WF.indexOf(`- name: ${name}`); assert.ok(at > 0, name);
  const next = WF.indexOf('\n      - name:', at + 10);
  // the step itself, without the comment block that introduces the next one
  return WF.slice(at, next < 0 ? undefined : next).split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
};

test('the shadow step: after the summary, before the branch; runs after a red gate; exit 0; no token', () => {
  const at = WF.indexOf('- name: Тень — автопубликация (только запись)');
  assert.ok(WF.indexOf('- name: Сводка изменений') < at && at < WF.indexOf('- name: Ветка'));
  const block = stepBlock('Тень — автопубликация (только запись)');
  assert.match(block, /id: shadow/);
  assert.match(block, /if: \$\{\{ !cancelled\(\) && steps\.diff\.outputs\.changed == 'true' \}\}/);
  assert.match(block, /set \+e/);
  assert.match(block.trimEnd(), /exit 0$/, 'the last word is exit 0');
  assert.doesNotMatch(block, /GH_TOKEN|secrets\.|github\.token|git push|gh pr|continue-on-error/);
  assert.match(block, /node scripts\/seo-auto-publish-shadow\.mjs --changed \/tmp\/seo-changed\.txt/);
});

test('no later step decides anything on the shadow verdict', () => {
  const after = WF.slice(WF.indexOf('- name: Ветка'));
  const uses = [...after.matchAll(/steps\.shadow\.[a-z]+/g)].map((m) => m[0]);
  assert.deepEqual([...new Set(uses)], ['steps.shadow.outcome'], 'only the failure triage reads its outcome');
  assert.match(stepBlock('Разбор падения'), /O_SHADOW: \$\{\{ steps\.shadow\.outcome \}\}/);
  assert.doesNotMatch(WF, /seo-shadow\/shadow\.json/, 'the JSON verdict is written, never read by the workflow');
});
