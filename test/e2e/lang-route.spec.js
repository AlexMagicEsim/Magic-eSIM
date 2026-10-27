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

// Every main-frame document request (a move by lang-route.js is one), with what became of it: landed() reads the log
// to know that the page ASKED for the expected address, and whether the engine answered it.
const navLog = new WeakMap();    // page → [{ url, state: 'pending' | 'response' | 'failed: <text>' }]
const marks = new WeakMap();     // page → index in navLog where the current visit() began
async function prep(page) {
  navLog.set(page, []);
  const mine = (r) => r.isNavigationRequest() && r.frame() === page.mainFrame();
  page.on('request', (r) => { if (mine(r)) navLog.get(page).push({ url: r.url(), req: r, state: 'pending' }); });
  page.on('response', (res) => { const n = navLog.get(page).find((x) => x.req === res.request()); if (n) n.state = 'response'; });
  page.on('requestfailed', (r) => { const n = navLog.get(page).find((x) => x.req === r); if (n) n.state = `failed: ${(r.failure() || {}).errorText || ''}`; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
  await page.route(/\/api\//, (r) => r.fulfill({ status: 503, body: '{}' }));
}

const path = (page) => { const u = new URL(page.url()); return u.pathname + u.search + u.hash; };
const settle = (page) => page.waitForLoadState('domcontentloaded');
// A visit typed / opened from outside: no referrer (WebKit would otherwise hand the previous page over as one).
// goto() waits only for `commit` — the response arrived and the document started. NEVER for `load` (the default) or
// `domcontentloaded`: when lang-route.js moves the visit, location.replace runs from <head> and «/» is superseded before
// its own `load` — goto() would wait on a document that is gone. Where a visit ENDS is landed()'s question, never
// goto()'s: every visit() below is followed by one.
async function visit(page, url, opts) {
  await page.goto('about:blank');
  marks.set(page, navLog.get(page).length);
  await page.goto(url, { waitUntil: 'commit', ...opts });
}
// Where a visit ENDS, in three steps:
//   1. the page ASKED for `want` — a main-frame document request for exactly that address (hash aside: a request has
//      none) since the visit began, or the page never left it. A move that never comes, or goes elsewhere, fails here,
//      in every browser.
//   2. the address IS `want` (commit). In Chromium always. In WebKit the engine itself sometimes drops that correct
//      request: CI 2026-10-26/27, 18 failures in ~1 500 redirecting visits, every one traced — lang-route.js ran, the
//      replace() request for the right target left 17–38 ms later, the old page's loads were cancelled, and the target
//      request then failed with «WebKit encountered an internal error» (4 of 5 traces) or got no response at all (1)
//      from a local static server that answers in milliseconds; no JS error, no crash; never in Chromium, never on a
//      visit that does not redirect; not reproducible on macOS WebKit or locally in the CI image (0 in ~1 500). The
//      same symptom is open upstream as WebKit bug 327297 («location.replace() navigation sometimes never commits»,
//      Playwright WebKit WPE/GTK). That case — and only that: WebKit, OUR request issued for the right address, and the
//      engine's own failure on it — is recorded as an annotation `webkit-navigation-stall` (visible in the report,
//      counted, never silent), and the test opens `want` itself so the next steps run on the page the product chose.
//      STALL_MS is not a tolerance for slowness: the server is local and static; ten seconds without an answer to a
//      document request is the stall, and it leaves the test room to go on.
//   3. QUIET_MS with no new document request after `load`, and the address STILL `want` — a late or a second move
//      (a loop) fails here, also when `want` is «/» and nothing may move at all. (Not `networkidle`: in Chromium it
//      sometimes never came — 10 timeouts in 1 500 runs.)
const QUIET_MS = 500;
const STALL_MS = 10_000;
const pathOf = (u) => u.pathname + u.search + u.hash;
const reqPath = (url) => { const u = new URL(url); return u.pathname + u.search; };
async function landed(page, want, msg, { stallMs = STALL_MS } = {}) {
  if (!navLog.has(page)) throw new Error('landed() needs prep(page) first: it logs the document requests');
  const target = want.replace(/#.*$/, '');
  const since = () => navLog.get(page).slice(marks.get(page) || 0);
  const asked = () => since().filter((n) => reqPath(n.url) === target).at(-1);
  await expect.poll(() => path(page) === want || !!asked(), { timeout: stallMs, message: `${msg || want}: the page never asked for ${target}` }).toBe(true);

  const committed = path(page) === want
    || await page.waitForURL((u) => pathOf(u) === want, { waitUntil: 'commit', timeout: stallMs }).then(() => true, (e) => e);
  if (committed !== true) {
    const n = asked();
    // What became of OUR request, from Playwright's own record — never from the event log alone: a request that was
    // just failed may not have delivered its `requestfailed` yet and would read as «no answer» (a local stress run
    // caught exactly that). response() settles on an answer or a failure; one second lets it settle.
    let outcome = 'pending';
    if (n) {
      const settled = await Promise.race([n.req.response().then((r) => (r ? 'response' : 'failed'), () => 'failed'),
        page.waitForTimeout(1000).then(() => 'pending')]);
      const f = n.req.failure();
      outcome = f ? `failed: ${f.errorText}` : settled;
    }
    const engineDropped = page.context().browser().browserType().name() === 'webkit' && n
      && (outcome === 'pending' || /WebKit encountered an internal error/.test(outcome));
    if (!engineDropped) throw committed;
    test.info().annotations.push({ type: 'webkit-navigation-stall',
      description: `${target}: requested correctly by lang-route.js, then ${outcome === 'pending' ? 'no response' : outcome} (WebKit bug 327297 family)` });
    await page.goto(want, { waitUntil: 'commit' });
  }
  for (;;) {
    await page.waitForLoadState('load');
    const seen = navLog.get(page).length;
    await page.waitForTimeout(QUIET_MS);
    if (navLog.get(page).length === seen) break;
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

/* landed() itself: each way the product or the engine can go wrong is told apart, and only the engine's own drop of a
 * correct request is tolerated — in WebKit, annotated. Short stallMs so a control does not wait ten seconds. */
test.describe('landed() cannot pass a wrong visit', () => {
  test.use({ locale: 'en-US' });
  const short = { stallMs: 2000 };

  test('no move where one is expected fails, in every browser', async ({ page }) => {
    await prep(page);
    await page.addInitScript(() => { try { localStorage.setItem('mesim.site.lang', 'ru'); } catch (e) { /* about:blank */ } });
    await visit(page, '/');
    await expect(landed(page, '/en/', 'control', short)).rejects.toThrow(/never asked for \/en\//);
  });

  test('a move to another address fails, in every browser', async ({ page }) => {
    await prep(page);
    await page.addInitScript(() => { try { localStorage.setItem('mesim.site.lang', 'ko'); } catch (e) { /* about:blank */ } });
    await visit(page, '/');
    await expect(landed(page, '/en/', 'control', short)).rejects.toThrow(/never asked for \/en\//);
  });

  test('a target request failed by something other than the engine fails, in every browser', async ({ page }) => {
    await prep(page);
    await page.route(/\/en\/$/, (r) => r.abort('failed'), { times: 1 });
    await visit(page, '/');
    await expect(landed(page, '/en/', 'control', short)).rejects.toThrow();
    expect(test.info().annotations.filter((a) => a.type === 'webkit-navigation-stall')).toEqual([]);
  });

  test('a target request that is never answered fails in Chromium; in WebKit it is annotated and the visit goes on', async ({ page, browserName }) => {
    await prep(page);
    let hold;
    await page.route(/\/en\/$/, () => new Promise((r) => { hold = r; }), { times: 1 });
    await visit(page, '/');
    if (browserName === 'webkit') {
      await landed(page, '/en/', 'stall', short);
      expect(test.info().annotations.map((a) => a.type)).toContain('webkit-navigation-stall');
      expect(path(page)).toBe('/en/');
    } else {
      await expect(landed(page, '/en/', 'control', short)).rejects.toThrow();
    }
    if (hold) hold();   // release the held route so the context closes cleanly
    test.info().annotations.splice(0);   // the control's own annotation is not a CI event
  });
});
