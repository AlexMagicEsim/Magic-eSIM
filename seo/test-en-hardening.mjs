/* English storefront hardening (A1 + D1, 2026-10-04): the Content-Security-
 * Policy that keeps GLOBAL off the fallback gateway, WCAG contrast and dialog
 * markup, and the look-alike card distinguishers.
 *
 * Run: node --test seo/test-en-hardening.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { primaryApiOrigin } from './build-en-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const require = createRequire(import.meta.url);

const COUNTRY_PAGES = readdirSync(join(ROOT, 'en/esim'), { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => `en/esim/${d.name}/index.html`);
const OTHER_PAGES = ['en/index.html', 'en/esim/index.html', 'en/guides/index.html',
  ...readdirSync(join(ROOT, 'en/guides'), { withFileTypes: true }).filter((d) => d.isDirectory())
    .map((d) => `en/guides/${d.name}/index.html`)];

const cspOf = (html) => {
  const all = [...html.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/g)];
  return { count: all.length, policy: all[0] ? all[0][1] : '', at: html.indexOf('http-equiv="Content-Security-Policy"') };
};
const directive = (policy, name) => {
  const d = policy.split(';').map((x) => x.trim()).find((x) => x.startsWith(`${name} `));
  return d ? d.slice(name.length + 1) : null;
};

/* ===================================================================== *
 * 1. CSP — and through it, D1: GLOBAL connects to the primary origin only
 * ===================================================================== */

test('the primary origin in the CSP is the one assets/magic-net.js names first', () => {
  const net = read('assets/magic-net.js');
  assert.equal(primaryApiOrigin(), 'https://esim-backend-3wmu.onrender.com');
  assert.ok(net.includes(`{ name: 'render', base: '${primaryApiOrigin()}' }`));
  assert.notEqual(primaryApiOrigin(), 'https://api.magicesim.store', 'never the gateway');
});

test('every English country page may connect to the primary origin and nowhere else', () => {
  assert.ok(COUNTRY_PAGES.length >= 190, `only ${COUNTRY_PAGES.length} country pages`);
  for (const p of COUNTRY_PAGES) {
    const h = read(p);
    const { count, policy, at } = cspOf(h);
    assert.equal(count, 1, `${p}: exactly one CSP`);
    assert.ok(at < h.indexOf('<script'), `${p}: the CSP comes before the first script`);
    assert.equal(directive(policy, 'connect-src'), primaryApiOrigin(), p);
    assert.equal(directive(policy, 'script-src'), "'self'", p);
    assert.equal(/unsafe-inline|unsafe-eval|\*/.test(policy), false, `${p}: no wildcard, no unsafe-*`);
    assert.equal(/magicesim\.store/.test(directive(policy, 'connect-src')), false, `${p}: not the gateway`);
  }
});

test('the home, the lists and the guides call no API at all: connect-src \'none\'', () => {
  for (const p of OTHER_PAGES) {
    const { count, policy } = cspOf(read(p));
    assert.equal(count, 1, `${p}: exactly one CSP`);
    assert.equal(directive(policy, 'connect-src'), "'none'", p);
    assert.equal(/unsafe-inline|unsafe-eval/.test(policy), false, p);
  }
});

test('the CSP rules can fire', () => {
  assert.equal(directive("default-src 'self'; connect-src https://api.magicesim.store", 'connect-src'), 'https://api.magicesim.store');
  assert.equal(/unsafe-inline|unsafe-eval|\*/.test("script-src 'self' 'unsafe-inline'"), true);
});

test('no English page carries inline script, inline style or an inline handler the CSP would block', () => {
  for (const p of [...COUNTRY_PAGES.slice(0, 20), ...OTHER_PAGES]) {
    const h = read(p).replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
    assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/.test(h), false, `${p}: inline script`);
    assert.equal(/<style|\sstyle="/.test(h), false, `${p}: inline style`);
    assert.equal(/\son[a-z]+="/.test(h), false, `${p}: inline handler`);
  }
});

/* ===================================================================== *
 * 2. WCAG — contrast, dialog, live region, decorative logo
 * ===================================================================== */

function luminance(hex) {
  const n = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const CSS = read('en/en.css');
const cssVar = (name) => (CSS.match(new RegExp(`--${name}:(#[0-9a-fA-F]{6})`)) || [])[1];

test('button text meets WCAG AA (4.5:1) and the button stands out from the page (3:1)', () => {
  const btn = cssVar('accent-btn');
  assert.ok(btn, '--accent-btn is defined');
  assert.match(CSS, /\.btn\{[^}]*background:var\(--accent-btn\);color:#fff/, '.btn uses it with white text');
  assert.ok(contrast('#ffffff', btn) >= 4.5, `white on ${btn} = ${contrast('#ffffff', btn).toFixed(2)}`);
  assert.ok(contrast(btn, cssVar('bg')) >= 3, `${btn} on the page = ${contrast(btn, cssVar('bg')).toFixed(2)}`);
  assert.ok(contrast(cssVar('muted'), cssVar('bg')) >= 4.5, 'muted notes on the page');
  // The rule can fire: the old button colour fails it.
  assert.ok(contrast('#ffffff', '#6c8cff') < 4.5);
});

test('error and recovery markup: a silent countdown, one live region for events, an honest no-JS state', () => {
  const page = read('en/esim/uae/index.html');
  assert.match(page, /<p class="note" id="coExpiry" hidden><\/p>/, 'the countdown is not a live region');
  assert.match(page, /<p class="sr-only" id="coLive" role="status" aria-live="polite"><\/p>/);
  assert.match(page, /<b id="coTotal" tabindex="-1">/);
  assert.match(page, /id="coFinal" role="status" tabindex="-1"/);
  assert.match(page, /<noscript>\s*<link rel="stylesheet" href="\/en\/noscript\.css\?v=[0-9a-f]{8}">\s*<p class="note">Plans and prices on this page need JavaScript\. Nothing can be bought here yet\.<\/p>\s*<\/noscript>/);
  assert.match(read('en/noscript.css'), /#status\{display:none!important\}/);
  assert.match(CSS, /\.sr-only\{position:absolute;width:1px;height:1px/);
});

test('the hidden attribute wins over every display rule in en.css', () => {
  assert.match(CSS, /\[hidden\]\{display:none!important\}/);
  // …and the rules it has to beat exist, or this test would prove nothing.
  assert.match(CSS, /\.btn\{display:inline-flex/);
  assert.match(CSS, /\.results\{[^}]*display:grid/);
});

test('the checkout dialog can take focus, the status is announced, the logo is decorative', () => {
  const page = read('en/esim/uae/index.html');
  assert.match(page, /<h3 id="coTitle" tabindex="-1"/);
  assert.match(page, /role="dialog" aria-modal="true" aria-labelledby="coTitle"/);
  assert.match(page, /<p class="note" id="status" role="status" aria-live="polite"/);
  assert.match(page, /<button type="button" class="btn btn-ghost" id="retry" data-i18n="site.retry" hidden>Try again<\/button>/);
  for (const p of [...COUNTRY_PAGES.slice(0, 5), ...OTHER_PAGES]) {
    assert.match(read(p), /<img src="\/assets\/magic-esim-logo-header\.png" alt="">/, `${p}: the logo sits beside its own name`);
  }
  const co = read('en/checkout.js');
  assert.match(co, /\$\('coTitle'\)\.focus\(\)/, 'focus moves into the dialog');
  assert.match(co, /opener\.focus\(\)/, 'and back to the button that opened it');
  assert.match(co, /e\.key !== 'Tab'/, 'Tab is kept inside');
  assert.equal(require(join(ROOT, 'assets/site-i18n.js')).DICT.en['site.retry'], 'Try again');
});

/* ===================================================================== *
 * 3. Look-alike cards are told apart by what actually differs
 * ===================================================================== */

const PLANS = require(join(ROOT, 'en/plans.js')).create({
  I18N: { t: (k) => k }, NAMES: require(join(ROOT, 'assets/country-names-en.js')),
  DAILY: require(join(ROOT, 'assets/daily-plan-copy.js')),
});
const vol = (id, extra = {}) => ({ package_id: id, coverage_country_codes: ['JP'], country_code: 'JP', data_gb: 3,
  validity_days: 15, price: 4.99, currency: 'USD', plan_type: 'FIXED_VOLUME', ...extra });

test('siblings differing in exit country, operators or generation get chips — only for what varies', () => {
  const d = PLANS.distinguishers([
    vol('a', { ip_export: ['HK'], networks: [{ operator: 'Docomo' }], network_technologies: ['4G', '5G'] }),
    vol('b', { ip_export: ['SG'], networks: [{ operator: 'KDDI' }, { operator: 'SoftBank' }], network_technologies: ['4G', '5G'] }),
  ]);
  assert.deepEqual(d.a, [{ kind: 'ip', label: 'IP: Hong Kong' }, { kind: 'net', label: 'Docomo' }]);
  assert.deepEqual(d.b, [{ kind: 'ip', label: 'IP: Singapore' }, { kind: 'net', label: '2 networks' }]);
});

test('no chip where nothing varies, where coverage or term differ, or where the value is unknown', () => {
  const same = { ip_export: ['HK'], networks: [{ operator: 'Docomo' }], network_technologies: ['5G'] };
  assert.deepEqual(PLANS.distinguishers([vol('a', same), vol('b', same)]), {}, 'identical attributes');
  assert.deepEqual(PLANS.distinguishers([vol('a', { ip_export: ['HK'] }), vol('b', { ip_export: ['SG'], validity_days: 30 })]), {},
    'a different term is not a sibling');
  assert.deepEqual(PLANS.distinguishers([vol('a', { ip_export: ['HK'] }),
    vol('b', { ip_export: ['SG'], coverage_country_codes: ['JP', 'KR'] })]), {}, 'a different coverage is not a sibling');
  const d = PLANS.distinguishers([vol('a', { ip_export: ['UK'] }), vol('b', {})]);
  assert.deepEqual(d.a, [{ kind: 'ip', label: 'IP: United Kingdom' }], '«UK» reads as the ISO country');
  assert.equal(d.b, undefined, 'an unknown exit gets no chip, not «Unknown»');
});

test('daily plans are siblings by their daily allowance and the term their price buys', () => {
  const day = (id, gb, extra) => ({ package_id: id, coverage_country_codes: ['AT'], country_code: 'AT', plan_type: 'DAILY',
    daily_term_mode: 'PER_DAY', daily_gb: gb, data_gb: 0, price: 1.99, currency: 'USD',
    term_prices: [{ days: 3, price: 4.99 }], ...extra });
  const d = PLANS.distinguishers([day('a', 1, { network_technologies: ['4G'] }), day('b', 1, { network_technologies: ['5G'] }),
    day('c', 2, { network_technologies: ['3G'] })]);
  assert.deepEqual(d.a, [{ kind: 'gen', label: '4G' }]);
  assert.deepEqual(d.b, [{ kind: 'gen', label: '5G' }]);
  assert.equal(d.c, undefined, 'a 2 GB/day plan is not a sibling of the 1 GB/day ones');
});

test('a daily card states the published speed after the allowance, never that traffic continues', () => {
  const src = read('en/plans.js');
  assert.match(src, /l\.kind === 'throttle' \|\| l\.kind === 'reset'/);
  const DAILY = require(join(ROOT, 'assets/daily-plan-copy.js'));
  const lines = DAILY.lines({ plan_type: 'DAILY', daily_term_mode: 'PER_DAY', daily_gb: 1, daily_throttle_label: '512 Kbps' }, 'en');
  assert.deepEqual(lines.map((l) => l.text), ['1 GB a day at full speed', 'Then up to 512 Kbps']);
  assert.equal(/continu|unlimited/i.test(lines.map((l) => l.text).join(' ')), false);
  assert.ok(existsSync(join(ROOT, 'en/plans.js')));
});
