// The Mini App's translation function is `t` (app/ui.js: `const t = (key, vars) => I.t(key, vars)`), and nothing in that
// file may declare another `t`. The daily term picker mapped its terms as `(t) =>`; inside it `t('tariff.buyFor', …)` called
// the TERM, threw «t is not a function» after the header price moved, and «Купить за …» kept the first term's price while
// the order was for the chosen one (production, 2026-10-20: 400 ₽ on the button, 3 150 ₽ charged). test/e2e/miniapp-prices
// pins the screen; this pins the cause, so the same mistake elsewhere in the file fails before a browser runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every place a binding named exactly `t` is introduced, other than ui.js's one translator. */
export function shadowsOfT(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');   // comments out
  const hits = [];
  const patterns = [
    /(?:^|[^\w$.])t\s*=>/g,                                    // t => …
    /\(\s*(?:[\w$]+\s*,\s*)*t\s*(?:,[^()]*)?\)\s*=>/g,          // (t) => …, (a, t) => …, (t, i) => …
    /function\s*[\w$]*\s*\(\s*(?:[^()]*,\s*)?t\s*[,)]/g,        // function (t) / function f(a, t, …)
    /\b(?:const|let|var)\s+t\s*=/g,                              // const t = …
    /\bcatch\s*\(\s*t\s*\)/g,                                    // catch (t)
  ];
  for (const re of patterns) for (const m of code.matchAll(re)) hits.push(m[0].trim());
  return hits;
}

test('negative control: the defect shipped in app/ui.js is caught, and so are its siblings', () => {
  assert.equal(shadowsOfT("const rows = terms.map((t) => el('button', { onclick: () => { buy.textContent = t('tariff.buyFor'); } }));").length, 1);
  assert.equal(shadowsOfT('list.forEach(t => go(t));').length, 1);
  assert.equal(shadowsOfT('items.map((t, i) => i);').length, 1);
  assert.equal(shadowsOfT('function pick(a, t) { return t; }').length, 1);
  assert.equal(shadowsOfT('try { x(); } catch (t) {}').length, 1);
  // not a binding named t: other names, a call, a property, a comment
  assert.deepEqual(shadowsOfT("const rows = terms.map((term) => t('x', { n: term.days })); obj.t = 1; // (t) => old"), []);
});

test('app/ui.js declares `t` exactly once — the translator', () => {
  // app/core.js has no translator (it returns keys; ui.js translates), so a local `t` there shadows nothing.
  const ui = shadowsOfT(readFileSync(join(ROOT, 'app/ui.js'), 'utf8'));
  assert.deepEqual(ui, ['const t ='], `app/ui.js shadows the translator: ${ui.join(' | ')}`);
});
