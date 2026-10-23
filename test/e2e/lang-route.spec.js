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

async function prep(page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
  await page.route(/\/api\//, (r) => r.fulfill({ status: 503, body: '{}' }));
}

const path = (page) => { const u = new URL(page.url()); return u.pathname + u.search + u.hash; };
const settle = (page) => page.waitForLoadState('domcontentloaded');
// A visit typed / opened from outside: no referrer (WebKit would otherwise hand the previous page over as one).
async function visit(page, url, opts) { await page.goto('about:blank'); await page.goto(url, opts); await settle(page); }
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
      expect(path(page)).toBe(want);
      await visit(page, '/');
      expect(path(page)).toBe(want);
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
      expect(path(page)).toBe(want);
    });
  }
});

test.describe('English browser', () => {
  test.use({ locale: 'en-US' });

  test('the query (utm, gclid, partner marks) is kept; a hash the target has is kept, another is dropped', async ({ page }) => {
    await prep(page);
    await visit(page, '/?utm_source=tg&utm_medium=post&utm_campaign=c1&gclid=G&yclid=Y&ref=partner7#plans');
    expect(path(page)).toBe('/en/?utm_source=tg&utm_medium=post&utm_campaign=c1&gclid=G&yclid=Y&ref=partner7#plans');
    await visit(page, '/?utm_source=x#solution');
    expect(path(page)).toBe('/en/?utm_source=x#how');
    await visit(page, '/#faq');
    expect(path(page)).toBe('/en/');
  });

  test('an arrival from a search engine is moved too; direct links to language pages never are', async ({ page }) => {
    await prep(page);
    await visit(page, '/', { referer: 'https://www.google.com/' });
    expect(path(page)).toBe('/en/');
    for (const p of ['/esim/turkey/', '/esim/', '/esim/not-working/', '/iphone.html', '/es/', '/de/esim/japan/', '/ko/guides/']) {
      await visit(page, p);
      expect(path(page), p).toBe(p);
    }
  });

  test('/?country=XX is an old link to one Russian country page: not moved by language', async ({ page }) => {
    await prep(page);
    await page.goto('/?country=TR');
    await page.waitForURL(/\/esim\/turkey\/$/);
    expect(new URL(page.url()).pathname).toBe('/esim/turkey/');
  });

  test('«Русский» in the switch is saved and never bounced back; later visits to / stay Russian', async ({ page }) => {
    const st = watch(page);
    await prep(page);
    await visit(page, '/');
    expect(path(page)).toBe('/en/');
    expect(await page.evaluate(() => localStorage.getItem('mesim.site.lang')), 'the automatic move is not a choice').toBeNull();
    await page.locator('a.langsw, .langmenu a[hreflang="ru"]').first().evaluate((el) => {
      const a = el.matches('a') ? el : el.querySelector('a[hreflang="ru"]');
      a.click();
    });
    await page.waitForURL((u) => u.pathname === '/');
    await settle(page);
    expect(path(page)).toBe('/');
    expect(await page.evaluate(() => localStorage.getItem('mesim.site.lang'))).toBe('ru');
    await visit(page, '/');
    expect(path(page)).toBe('/');
    expect(st.errors).toEqual([]);
  });

  test('a saved choice wins over the browser language', async ({ page }) => {
    await prep(page);
    await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mesim.site.lang', 'ko'); sessionStorage.setItem('seeded', '1'); } });
    await visit(page, '/');
    expect(path(page)).toBe('/ko/');
  });

  test('our own links to / (the logo of a Russian page) never move the visitor', async ({ page }) => {
    await prep(page);
    await page.goto('/esim/turkey/');
    await tap(page, 'a.brand');
    await page.waitForURL((u) => u.pathname === '/');
    await settle(page);
    expect(path(page)).toBe('/');
  });
});

test.describe('Russian browser', () => {
  test.use({ locale: 'ru-RU' });

  test('«English» on a Russian page is saved: later visits to / open /en/', async ({ page }) => {
    await prep(page);
    await visit(page, '/esim/turkey/');
    await tap(page, 'a.langsw[lang="en"]');
    await page.waitForURL((u) => u.pathname === '/en/');
    await settle(page);
    expect(await page.evaluate(() => localStorage.getItem('mesim.site.lang'))).toBe('en');
    await visit(page, '/');
    expect(path(page)).toBe('/en/');
  });

  test('a language picked in an international switch is saved', async ({ page }) => {
    await prep(page);
    await visit(page, '/en/');
    await tap(page, 'details.langmenu a[hreflang="fr"]');
    await page.waitForURL((u) => u.pathname === '/fr/');
    expect(await page.evaluate(() => localStorage.getItem('mesim.site.lang'))).toBe('fr');
    await visit(page, '/');
    expect(path(page)).toBe('/fr/');
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
      expect(path(page)).toBe(locale === 'en-US' ? '/en/' : '/');
      expect(st.errors).toEqual([]);
    });
  });
}
