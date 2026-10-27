'use strict';

/*
 * The first-visit language of «/» (assets/lang-route.js) and the saved choice (assets/logo-once.js), in a real browser
 * (Chromium 390/320 and WebKit — webkit-flags): browser languages → the right home, a saved choice wins, a manual switch
 * is saved and never bounced, direct links are never moved, the query (utm, partner marks) and an applicable hash are
 * kept, no loop, no JS error, no counter request on a moved visit, and storage that throws breaks nothing.
 * Every request off the local server is refused and recorded.
 */

const { test, expect } = require('@playwright/test');

function watch(page) {
  const st = { off: [], errors: [], navs: [] };
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('http://127.0.0.1') && !u.startsWith('http://localhost')) st.off.push(u);
  });
  page.on('pageerror', (e) => st.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) st.errors.push(m.text()); });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) st.navs.push(new URL(f.url()).pathname); });
  return st;
}

// Every main-frame document request (a move by lang-route.js is one): landed() waits until none has started for a while.
const docRequests = new WeakMap();
async function prep(page) {
  docRequests.set(page, 0);
  page.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) docRequests.set(page, docRequests.get(page) + 1); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
  await page.route(/\/api\//, (r) => r.fulfill({ status: 503, body: '{}' }));
}

const path = (page) => { const u = new URL(page.url()); return u.pathname + u.search + u.hash; };
const settle = (page) => page.waitForLoadState('domcontentloaded');
// A visit typed / opened from outside: no referrer (WebKit would otherwise hand the previous page over as one).
// goto() waits only for `commit` — the response arrived and the document started. NEVER for `load` (the default) or
// `domcontentloaded`: when lang-route.js moves the visit, location.replace runs from <head> and «/» is superseded before
// its own `load`, and WebKit now and then never settles goto()'s wait on that superseded navigation — goto() hung for the
// whole 30-s test timeout (CI 2026-10-27, two runs, «navigating to "/", waiting until "load"»; a different test of this
// file each time). Where a visit ENDS is landed()'s question, never goto()'s: every visit() below is followed by one.
async function visit(page, url, opts) { await page.goto('about:blank'); await page.goto(url, { waitUntil: 'commit', ...opts }); }
// Where a visit ENDS. lang-route.js moves with location.replace from <head>; WebKit parses the Russian page to the end
// before it starts that navigation, and now and then «/» fires `load` first — goto() returns on «/» while the move is
// still pending, and the next goto() cancels it (measured 2026-10-24: 2 of 40 visits; the move itself completed in 300 of
// 300 visits without a test in the way). So never read the address right after goto():
//   - wait until the address IS `want` (a move that never comes, or goes elsewhere, fails here);
//   - then let the page load and require QUIET_MS with no new document request, and the address to be STILL `want` — a
//     move scheduled late (WebKit starts it right after `load`) or a second move fails here, also when `want` is «/» and
//     nothing may move at all. (Not `networkidle`: in Chromium it sometimes never came — 10 timeouts in 1 500 runs.)
const QUIET_MS = 500;
const pathOf = (u) => u.pathname + u.search + u.hash;
async function landed(page, want, msg) {
  if (!docRequests.has(page)) throw new Error('landed() needs prep(page) first: it counts the document requests');
  await page.waitForURL((u) => pathOf(u) === want, { waitUntil: 'commit' });
  for (;;) {
    await page.waitForLoadState('load');
    const seen = docRequests.get(page);
    await page.waitForTimeout(QUIET_MS);
    if (docRequests.get(page) === seen) break;
  }
  expect(path(page), msg).toBe(want);
}
// The switch is a header link on wide screens and the phone menu on narrow ones: click the element itself.
const tap = (page, css) => page.locator(css).first().evaluate((a) => a.click());

const CASES = [
  ['ru-RU', '/'], ['en-US', '/en/'], ['es-ES', '/es/'], ['fr-FR', '/fr/'], ['de-DE', '/de/'],
  ['zh-CN', '/zh/'], ['zh-TW', '/zh/'], ['ko-KR', '/ko/'], ['ja-JP', '/en/'], ['uk-UA', '/en/'], ['pt-BR', '/en/'],
];

for (const [locale, want] of CASES) {
  test.describe(`browser ${locale}`, () => {
    test.use({ locale });
    test(`first visit to / → ${want}; a repeat visit → the same; no loop, no error`, async ({ page }) => {
      const st = watch(page);
      await prep(page);
      await visit(page, '/');
      await landed(page, want);
      await visit(page, '/');
      await landed(page, want);
      expect(st.navs.filter((p) => p === want).length).toBeLessThanOrEqual(2);
      expect(st.errors).toEqual([]);
      if (want !== '/') expect(st.off.filter((u) => /mc\.yandex/.test(u)), 'no counter request on a moved visit').toEqual([]);
    });
  });
}

test.describe('the first language of navigator.languages that we publish wins', () => {
  test.use({ locale: 'en-US' });
  for (const [langs, want] of [[['pt-BR', 'ru-RU', 'en'], '/'], [['ja', 'de-CH', 'en'], '/de/'], [['en-GB', 'ru'], '/en/'], [[], '/en/']]) {
    test(`${JSON.stringify(langs)} → ${want}`, async ({ page }) => {
      await prep(page);
      await page.addInitScript((l) => {
        Object.defineProperty(Navigator.prototype, 'languages', { get: () => l, configurable: true });
        if (!l.length) Object.defineProperty(Navigator.prototype, 'language', { get: () => undefined, configurable: true });
      }, langs);
      await visit(page, '/');
      await landed(page, want);
    });
  }
});

test.describe('English browser', () => {
  test.use({ locale: 'en-US' });

  test('the query (utm, gclid, partner marks) is kept; a hash the target has is kept, another is dropped', async ({ page }) => {
    await prep(page);
    await visit(page, '/?utm_source=tg&utm_medium=post&utm_campaign=c1&gclid=G&yclid=Y&ref=partner7#plans');
    await landed(page, '/en/?utm_source=tg&utm_medium=post&utm_campaign=c1&gclid=G&yclid=Y&ref=partner7#plans');
    await visit(page, '/?utm_source=x#solution');
    await landed(page, '/en/?utm_source=x#how');
    await visit(page, '/#faq');
    await landed(page, '/en/');
  });

  test('an arrival from a search engine is moved too; direct links to language pages never are', async ({ page }) => {
    await prep(page);
    await visit(page, '/', { referer: 'https://www.google.com/' });
    await landed(page, '/en/');
    for (const p of ['/esim/turkey/', '/esim/', '/esim/not-working/', '/iphone.html', '/es/', '/de/esim/japan/', '/ko/guides/']) {
      await visit(page, p);
      await landed(page, p, p);
    }
  });

  test('/?country=XX is an old link to one Russian country page: not moved by language', async ({ page }) => {
    await prep(page);
    await page.goto('/?country=TR', { waitUntil: 'commit' });   // moved by a script too (assets/ru-home.js): see visit()
    await page.waitForURL(/\/esim\/turkey\/$/);
    expect(new URL(page.url()).pathname).toBe('/esim/turkey/');
  });

  test('«Русский» in the switch is saved and never bounced back; later visits to / stay Russian', async ({ page }) => {
    const st = watch(page);
    await prep(page);
    await visit(page, '/');
    await landed(page, '/en/');
    expect(await page.evaluate(() => localStorage.getItem('mesim.site.lang')), 'the automatic move is not a choice').toBeNull();
    await page.locator('a.langsw, .langmenu a[hreflang="ru"]').first().evaluate((el) => {
      const a = el.matches('a') ? el : el.querySelector('a[hreflang="ru"]');
      a.click();
    });
    await page.waitForURL((u) => u.pathname === '/');
    await landed(page, '/');
    expect(await page.evaluate(() => localStorage.getItem('mesim.site.lang'))).toBe('ru');
    await visit(page, '/');
    await landed(page, '/');
    expect(st.errors).toEqual([]);
  });

  test('a saved choice wins over the browser language', async ({ page }) => {
    await prep(page);
    await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mesim.site.lang', 'ko'); sessionStorage.setItem('seeded', '1'); } });
    await visit(page, '/');
    await landed(page, '/ko/');
  });

  test('our own links to / (the logo of a Russian page) never move the visitor', async ({ page }) => {
    await prep(page);
    await page.goto('/esim/turkey/');
    await tap(page, 'a.brand');
    await page.waitForURL((u) => u.pathname === '/');
    await landed(page, '/');
  });
});

test.describe('Russian browser', () => {
  test.use({ locale: 'ru-RU' });

  test('«English» on a Russian page is saved: later visits to / open /en/', async ({ page }) => {
    await prep(page);
    await visit(page, '/esim/turkey/');
    await landed(page, '/esim/turkey/');
    await tap(page, 'a.langsw[lang="en"]');
    await page.waitForURL((u) => u.pathname === '/en/');
    await settle(page);
    expect(await page.evaluate(() => localStorage.getItem('mesim.site.lang'))).toBe('en');
    await visit(page, '/');
    await landed(page, '/en/');
  });

  test('a language picked in an international switch is saved', async ({ page }) => {
    await prep(page);
    await visit(page, '/en/');
    await landed(page, '/en/');
    await tap(page, 'details.langmenu a[hreflang="fr"]');
    await page.waitForURL((u) => u.pathname === '/fr/');
    expect(await page.evaluate(() => localStorage.getItem('mesim.site.lang'))).toBe('fr');
    await visit(page, '/');
    await landed(page, '/fr/');
  });
});

for (const locale of ['en-US', 'ru-RU']) {
  test.describe(`storage that throws (${locale})`, () => {
    test.use({ locale });
    test('the site works, nothing throws, the browser language decides', async ({ page }) => {
      const st = watch(page);
      await prep(page);
      await page.addInitScript(() => {
        for (const k of ['localStorage', 'sessionStorage']) {
          Object.defineProperty(window, k, { get() { throw new DOMException('denied', 'SecurityError'); }, configurable: true });
        }
      });
      await visit(page, '/');
      await landed(page, locale === 'en-US' ? '/en/' : '/');
      expect(st.errors).toEqual([]);
    });
  });
}
