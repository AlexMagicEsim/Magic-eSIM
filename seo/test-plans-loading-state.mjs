// The plans area's loading state is ONE attribute, #tariffs[data-loading]
// (assets/country-tariffs.js writes it, assets/ru.css reads it).
//
// Why: Safari 26.4 (WebKit 21624.1.16.11.4) does not restyle a rule of the form
// `.packages:has(> .packages-status:not(:empty)) > .plan-block` when the status
// text is cleared. Measured 2026-10-20 in the system WebKit: the status was
// empty, `matches(':has(…)')` was false, and getComputedStyle still gave the
// local block display:none with ten cards inside; in the owner's Safari the
// local and regional plans stayed hidden ~15 s (until a scroll) or for good.
// Chrome and Playwright's WebKit 26.5 do not show it, so the browser suite
// cannot catch a regression — this test pins the shape instead.
//
// The rules:
// 1. A CSS rule whose selector watches #packagesStatus through :has() serves
//    only the first paint, before the script runs: it carries
//    :not([data-loading]) on the element the :has() hangs on.
// 2. Every such rule has a twin keyed on [data-loading="true"] with the same
//    declarations, so the state after the script starts is the attribute alone.
// 3. The script sets "true" when it starts loading, "false" in the render (the
//    same task that clears the status) and "false" on a failure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** Flat list of { selector, body } for the top-level and @media rules of a stylesheet. */
export function cssRules(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}@]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(src))) out.push({ selector: m[1].trim(), body: m[2].trim() });
  return out;
}

const WATCHES_STATUS = /:has\(\s*>\s*\.packages-status/;

/** Problems with how a stylesheet ties the plans' visibility to the loading state. */
export function loadingStateProblems(css) {
  const rules = cssRules(css);
  const problems = [];
  for (const r of rules) {
    for (const sel of r.selector.split(',').map((s) => s.trim())) {
      if (!WATCHES_STATUS.test(sel)) continue;
      if (!/:not\(\[data-loading\]\):has\(/.test(sel)) {
        problems.push(`watches the status text without :not([data-loading]): ${sel}`);
        continue;
      }
      const twin = sel.replace(/:not\(\[data-loading\]\):has\(\s*>\s*\.packages-status:not\(:empty\)\)/, '[data-loading="true"]');
      const found = rules.some((x) => x.body === r.body && x.selector.split(',').map((s) => s.trim()).includes(twin));
      if (!found) problems.push(`no [data-loading="true"] twin with the same declarations: ${twin} { ${r.body} }`);
    }
  }
  return problems;
}

const RU_CSS = read('assets/ru.css');
const JS = read('assets/country-tariffs.js');

test('ru.css: every rule that watches the status text serves the first paint only and has a data-loading twin', () => {
  assert.deepEqual(loadingStateProblems(RU_CSS), []);
});

test('ru.css: the four loading-state rules are there (blocks, skeleton, two reserves)', () => {
  const twins = cssRules(RU_CSS).map((r) => r.selector).filter((s) => /\[data-loading="true"\]/.test(s));
  assert.deepEqual(twins.sort(), [
    '#tariffs[data-cards="compact"][data-loading="true"]',
    '#tariffs[data-loading="true"] > .cp-skeleton',
    '.packages[data-loading="true"]',
    '.packages[data-loading="true"] > .plan-block',
  ].sort());
});

test('no other stylesheet watches the status text', () => {
  for (const f of ['assets/site.css', 'assets/page-country.css', 'assets/page-home.css', 'assets/page-hub.css', 'assets/page-guides.css', 'en/en.css']) {
    let css;
    try { css = read(f); } catch { continue; }
    assert.equal(WATCHES_STATUS.test(css), false, `${f} watches #packagesStatus — use #tariffs[data-loading]`);
  }
});

test('the checker fires on the rule Safari 26.4 left stale (mutation)', () => {
  const old = '.packages:has(> .packages-status:not(:empty)) > .plan-block{display:none}';
  assert.equal(loadingStateProblems(old).length, 1);
  // A guarded rule without its twin is refused too.
  const half = '.packages:not([data-loading]):has(> .packages-status:not(:empty)) > .plan-block{display:none}';
  assert.match(loadingStateProblems(half)[0], /twin/);
  // A twin with different declarations is not a twin.
  assert.equal(loadingStateProblems(half + '.packages[data-loading="true"] > .plan-block{display:grid}').length, 1);
  assert.deepEqual(loadingStateProblems(half + '.packages[data-loading="true"] > .plan-block{display:none}'), []);
  // The live sheet with one twin removed fails.
  const cut = RU_CSS.replace('.packages[data-loading="true"] > .plan-block{display:none}', '');
  assert.equal(loadingStateProblems(cut).length, 1);
});

function body(name) {
  const at = JS.search(new RegExp(`(?:async\\s+)?function ${name}\\(`));
  assert.ok(at >= 0, `${name} not found`);
  let i = JS.indexOf('{', at), depth = 0;
  for (let j = i; j < JS.length; j++) {
    if (JS[j] === '{') depth++;
    else if (JS[j] === '}' && --depth === 0) return JS.slice(i, j + 1);
  }
  throw new Error(`${name}: unbalanced`);
}

test('country-tariffs.js writes the attribute in one helper, on #tariffs', () => {
  const h = body('setPlansLoading');
  assert.match(h, /byIdG\('tariffs'\)/);
  assert.match(h, /setAttribute\('data-loading',on\?'true':'false'\)/);
});

test('loading sets "true" right after the status says so; the render and a failure set "false"', () => {
  const load = body('loadCountryPackages');
  assert.match(load, /status\.textContent='Загружаем тарифы\.\.\.';\s*setPlansLoading\(true\);/);
  const fail = load.slice(load.indexOf('catch(err)'));
  assert.match(fail, /status\.textContent='';\s*setPlansLoading\(false\);/);
  // The render clears the status and shows the blocks in one task.
  assert.match(body('renderCountrySplit'), /status\.textContent='';\s*setPlansLoading\(false\);/);
});
