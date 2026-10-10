// The Russian home as the Russian localisation of /en/ (RU↔EN migration PR C).
//
// What this pins:
//   1. STRUCTURE: the same sections, in the same order, as en/index.html — plus
//      exactly the two Russian exceptions the owner decided: the Mini App
//      button in the hero, and «Частые вопросы» (the FAQ behind FAQPage);
//   2. the home reads no catalogue and takes no money — the search is a static
//      list (assets/ru-destinations.js, generated) of links to the country
//      pages, where the plans and the checkout are;
//   3. assets/ru-home.js touches no network, redirects only to a page from the
//      generated list (an old /?country=XX link), and fires only the home's
//      existing goals, each allowlisted;
//   4. the search field stays masked for Webvisor (R3-08: ym-hide-content);
//   5. the old anchors other pages and people still use keep landing somewhere.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const RU = read('index.html');
const EN = read('en/index.html');
const JS = read('assets/ru-home.js');
const LIST = read('assets/ru-destinations.js');

const mainOf = (h) => h.slice(h.indexOf('<main'), h.indexOf('</main>'));
const sectionIds = (h) => [...mainOf(h).matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);

test('the home has the English home\'s sections, in its order, plus the FAQ', () => {
  const en = sectionIds(EN);
  const ru = sectionIds(RU);
  assert.deepEqual(en, ['popular', 'how', 'plan-types', 'compat', 'guides', 'support'], 'the English home changed — revisit this test');
  // The hero on /en/ has no id; on the Russian home it keeps #top.
  assert.deepEqual(ru, ['top', 'popular', 'how', 'plan-types', 'compat', 'guides', 'faq', 'support']);
  // and the rule can fire
  assert.notDeepEqual(ru.filter((x) => x !== 'faq' && x !== 'top'), [...en].reverse());
});

test('the blocks inside each section are the English ones, class for class', () => {
  for (const cls of ['hero-grid', 'hero-copy', 'search-card', 'search-row', 'search-field', 'results', 'quick', 'facts',
    'hero-art', 'dp-pass', 'dest-grid', 'dest-tile', 'dest-more', 'steps-grid', 'step-ico', 'step-n', 'types', 'type-ico',
    'compat', 'compat-list', 'guide-grid', 'guide-card', 'support-band']) {
    assert.ok(EN.includes(`class="${cls}`) || EN.includes(` ${cls}"`) || EN.includes(` ${cls} `), `/en/ lost .${cls} — revisit`);
    assert.ok(new RegExp(`class="[^"]*\\b${cls}\\b`).test(RU), `the Russian home lacks .${cls}`);
  }
  const count = (h, re) => (mainOf(h).match(re) || []).length;
  assert.equal(count(RU, /class="dest-tile/g), 8, 'eight popular tiles, as on /en/');
  assert.equal(count(EN, /class="dest-tile/g), 8);
  assert.equal(count(RU, /<li class="step">/g), count(EN, /<li class="step">/g), 'as many steps as /en/');
  assert.equal(count(RU, /<div class="type">/g), 3);
  assert.equal(count(RU, /class="guide-card"/g), count(EN, /class="guide-card"/g), 'as many guide cards as /en/');
  assert.equal(count(RU, /class="quick"[\s\S]*?<\/div>/g), 1);
  assert.equal((mainOf(RU).match(/class="quick"[\s\S]*?<\/div>/)[0].match(/<a /g) || []).length, 6, 'six quick links, as on /en/');
});

test('the Russian exceptions are exactly the decided ones', () => {
  // Mini App button in the hero (kept); FAQ + FAQPage (SEO); no separate
  // Telegram banner, no catalogue, no checkout, no «Почему Magic eSIM» blocks.
  assert.match(RU, /class="hero-tg"[\s\S]{0,400}https:\/\/t\.me\/magicesim_bot\?startapp/);
  assert.match(RU, /<section id="faq"/);
  assert.match(RU, /"@type": "FAQPage"/);
  for (const gone of ['id="global-pricing"', 'id="problem"', 'id="solution"', 'id="benefits"', 'id="why-magic"', 'id="tech"',
    'id="social"', 'tg-cta', 'id="install-guides-section"', 'seo-links', 'id="countryChips"', 'id="packageSort"',
    'id="checkoutModal"', 'id="coverageModal"', 'regional_country_click']) {
    assert.ok(!RU.includes(gone), `the home still carries ${gone}`);
  }
  // No English business logic crossed over.
  assert.doesNotMatch(RU, /paybar|previewNotice|global-catalog\.js|\/en\/checkout\.js|US dollars|\$\d/);
});

test('the home reads no catalogue and takes no money', () => {
  for (const s of ['catalog-loader', 'magic-net', 'country-tariffs', 'daily-plan-copy', 'ru-checkout']) {
    assert.ok(!new RegExp(`<script[^>]+src="[^"]*${s}\\.js`).test(RU), `the home loads ${s}.js`);
  }
  assert.doesNotMatch(RU, /page-country\.css/);
  const scripts = [...RU.matchAll(/<script src="([^"?]+)\?v=[0-9a-f]{8}"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ['/assets/ru-destinations.js', '/assets/ru-home.js'], 'the body loads the list, then the search');
});

test('ru-home.js touches no network and builds links only from the generated list', () => {
  const code = JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const bad of [/fetch\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /MagicNet/, /\.innerHTML/, /eval\(/, /new Function/]) {
    assert.doesNotMatch(code, bad);
  }
  // The only navigation: an old ?country=XX link → that country's page, slug from the list.
  const hops = code.match(/location\.(?:replace|assign|href\s*=)[^;]*/g) || [];
  assert.deepEqual(hops, ["location.replace('/esim/' + d.slug + '/')"]);
  assert.match(code, /var d = \/\^\[A-Za-z\]\{2\}\$\/\.test\(code\) \? byIso\(code\) : null;/);
});

/** Run ru-home.js in a fake page and report what it did. */
function runHome({ search = '', hash = '' } = {}) {
  const calls = { replace: [], replaceState: [], scrolled: [], goals: [] };
  const els = {};
  const el = (id) => (els[id] ||= { id, value: '', hidden: true, textContent: '', children: [],
    addEventListener() {}, appendChild(c) { this.children.push(c); }, querySelectorAll() { return []; },
    scrollIntoView() { calls.scrolled.push(id); }, focus() {} });
  const sandbox = {
    window: {}, document: {
      readyState: 'complete', getElementById: el, addEventListener() {},
      querySelector: (sel) => (sel.startsWith('#') ? el(sel.slice(1)) : null),
      createElement: () => ({ setAttribute() {}, appendChild() {} }), createTextNode: () => ({}),
    },
    location: { search, hash, pathname: '/', replace: (u) => calls.replace.push(u) },
    history: { replaceState: (a, b, u) => calls.replaceState.push(u) },
    URLSearchParams,
  };
  sandbox.window.magicMetrikaGoal = (n, p) => calls.goals.push([n, p]);
  vm.createContext(sandbox);
  vm.runInContext(LIST.replace('window.MagicRuDestinations', 'window.MagicRuDestinations'), sandbox);
  vm.runInContext(JS, sandbox);
  return calls;
}

test('an old /?country=XX link goes to that country\'s page, and only a listed one', () => {
  assert.deepEqual(runHome({ search: '?country=TR' }).replace, ['/esim/turkey/']);
  assert.deepEqual(runHome({ search: '?country=vn&utm_source=x' }).replace, ['/esim/vietnam/']);
  // Unknown, restricted (RU has no page), malformed or hostile: the home stays.
  for (const q of ['?country=RU', '?country=ZZ', '?country=TUR', '?country=../x', '?country=%2F%2Fevil.com', '?country=']) {
    assert.deepEqual(runHome({ search: q }).replace, [], q);
  }
});

test('the old anchors land on what replaced them', () => {
  const map = { '#global-pricing': '#plans', '#solution': '#how', '#install-guides-section': '#guides' };
  for (const [from, to] of Object.entries(map)) {
    const c = runHome({ hash: from });
    assert.deepEqual(c.replaceState, ['/' + to], from);
    assert.deepEqual(c.scrolled, [to.slice(1)], from);
    assert.ok(RU.includes(`id="${to.slice(1)}"`), `${to} exists`);
  }
  assert.deepEqual(runHome({ hash: '#faq' }).replaceState, [], 'a live anchor is left alone');
});

test('the generated list is the set of country pages, with Russian and English names', () => {
  const sandbox = { window: {} }; vm.createContext(sandbox); vm.runInContext(LIST, sandbox);
  const list = sandbox.window.MagicRuDestinations;
  const { countries } = JSON.parse(read('seo/catalogue-countries.json'));
  assert.equal(list.length, countries.length);
  for (const d of list) {
    assert.ok(existsSync(join(ROOT, 'esim', d.slug, 'index.html')), `/esim/${d.slug}/ does not exist`);
    assert.match(d.iso, /^[A-Z]{2}$/);
    assert.match(d.name, /[А-ЯЁа-яё]/, `${d.slug}: no Russian name`);
  }
  assert.ok(list.filter((d) => d.en).length >= list.length - 2, 'English names let a Latin query match');
  assert.ok(!list.some((d) => ['RU', 'UA', 'BY'].includes(d.iso)), 'restricted countries have no page');
});

test('the search field stays masked for Webvisor (R3-08)', () => {
  assert.match(RU, /<input type="text" id="q" class="ym-hide-content"/);
});

test('every goal the home fires is allowlisted on the home, and nothing new was invented', () => {
  const fired = [...new Set([...JS.matchAll(/goal\('([a-z_]+)'/g)].map((m) => m[1]))].sort();
  assert.deepEqual(fired, ['country_search', 'popular_country_click', 'telegram_app_click']);
  const goals = RU.match(/var GOALS=\{([\s\S]*?)\};/)[1];
  for (const g of fired) assert.match(goals, new RegExp(`\\b${g}:\\[`), `${g} is not allowlisted`);
  assert.doesNotMatch(goals, /regional_country_click/, 'the retired goal is gone from the allowlist');
});

test('the header CTA and the navigation lead to the home\'s sections, never to the old catalogue', async () => {
  const { ruHeader, RU_FOOTER } = await import('./ru-chrome.mjs');
  const h = ruHeader();
  assert.match(h, /href="\/#plans">Найти тариф</);
  for (const a of ['/#how', '/#compat', '/#guides', '/esim/']) assert.ok(h.includes(`href="${a}"`), a);
  assert.doesNotMatch(h + RU_FOOTER, /#global-pricing|#solution|#install-guides-section/);
  // Nav items: the English four.
  const nav = h.match(/<nav class="nav"[\s\S]*?<\/nav>/)[0];
  const enNav = EN.match(/<nav class="nav"[\s\S]*?<\/nav>/)[0];
  assert.equal((nav.match(/<a /g) || []).length, (enNav.match(/<a /g) || []).length);
});
