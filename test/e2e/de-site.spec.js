'use strict';

/*
 * The German site, /de/ (I18N DE-1), in a real browser: Chromium at 390 and 320 (the projects) and at 1366, and in
 * WebKit (the webkit-flags project runs this file too — Safari's engine). The GLOBAL catalogue is a fixture and the
 * quote POST is answered in the browser, exactly as the Spanish spec does; nothing reaches the API.
 *
 *   * a country page: local → regional → daily, German labels, prices «2,99 USD» (owner D2), the daily lines from the
 *     German table (decimal comma), a per-day term picked on the card and handed to the checkout and the quote;
 *   * the list: an umlaut-free search finds «Türkei», «Ägypten», «Österreich»; the home: the search opens a German page;
 *   * the language list on every kind of page keeps the reader on the same page;
 *   * an unknown /de/ address gets the German 404, without the counter;
 *   * the logo «Reveal + Wave» and Expressive as in English, CLS < 0.02, axe clean, no clipped German compound;
 *   * noindex in the live DOM.
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });
const fs = require('fs');
const path = require('path');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const NOT_FOUND = fs.readFileSync(path.join(__dirname, '..', '..', '404.html'), 'utf8');
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const local = (n, gb, days, price) => ({ package_id: uuid(n), name: `Thailand ${gb}GB`, country_code: 'TH', coverage_country_codes: ['TH'],
  data_gb: gb, validity_days: days, price, currency: 'USD', plan_type: 'FIXED_VOLUME' });
const PER_DAY = { package_id: uuid(50), name: 'Thailand 1GB/Day', country_code: 'TH', coverage_country_codes: ['TH'], plan_type: 'DAILY',
  daily_term_mode: 'PER_DAY', daily_gb: 1, data_gb: 0, price: 1.49, currency: 'USD', daily_throttle_label: '512 Kbps',
  term_prices: [{ days: 3, price: 4.99 }, { days: 7, price: 10.99 }, { days: 15, price: 19.99 }] };
const FIXED_DAILY = { package_id: uuid(51), name: 'Thailand 1.5GB/Day 3 Days', country_code: 'TH', coverage_country_codes: ['TH'], plan_type: 'DAILY',
  daily_term_mode: 'FIXED_TERM', daily_gb: 1.5, data_gb: 0, validity_days: 3, price: 15.99, currency: 'USD', daily_reset_confirmed: true };
const REGIONAL = { package_id: uuid(60), name: 'Asia 5GB', country_code: 'AS-5', coverage_country_codes: ['TH', 'MY', 'SG', 'VN', 'ID'],
  data_gb: 5, validity_days: 30, price: 12.99, currency: 'USD', plan_type: 'FIXED_VOLUME' };
const LOCALS = [local(1, 1, 7, 2.99), local(2, 3, 15, 4.99), local(3, 5, 30, 6.99), local(4, 10, 30, 11.99), local(5, 20, 30, 19.99),
  local(6, 50, 30, 29.99), local(7, 100, 30, 49.99), local(8, 30, 30, 24.99)];
const BODY = JSON.stringify(withLayout({ status: 'success', market: 'global', currency: 'USD', data: [...LOCALS, PER_DAY, FIXED_DAILY, REGIONAL] }));

async function open(page, url = '/de/esim/thailand/', { gate } = {}) {
  const st = { quotes: [], csp: [], errors: [], external: [] };
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text());
    else if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) st.errors.push(m.text());
  });
  page.on('pageerror', (e) => st.errors.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => { st.external.push(r.request().url()); return r.abort(); });
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      if (gate) await gate;
      return route.fulfill({ status: 200, contentType: 'application/json', body: BODY });
    }
    const b = JSON.parse(req.postData());
    st.quotes.push(b);
    const price = b.days === 7 ? 10.99 : b.days === 15 ? 19.99 : 4.99;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quote_id: '3fbced54-1111-4222-8333-444455556666',
      package_id: b.package_id, days: b.days, currency: 'USD', amount: price, expires_at: new Date(Date.now() + 1800000).toISOString() }) });
  });
  await page.goto(url);
  return st;
}
const ready = (page) => expect(page.locator('#localGrid .card').first()).toBeVisible();
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const restful = (page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 6000 });

test('a country page in German: blocks, labels, «USD» prices and the daily lines from the German table', async ({ page }) => {
  const st = await open(page); await ready(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('h1')).toHaveText('eSIM für Thailand');
  const order = await page.evaluate(() => [...document.querySelectorAll('.plan-block:not([hidden])')].map((s) => s.id));
  expect(order).toEqual(['localBlock', 'regionalBlock', 'dailyBlock']);
  await expect(page.locator('.cp-jump a:visible')).toHaveText([/Thailand\s*8/, /Regional\s*1/, /Daten für jeden Tag\s*2/]);
  const loc = page.locator('#localGrid .card').first();
  await expect(loc.locator('.plan-badge')).toHaveText('Ländertarif');
  await expect(loc.locator('.plan-data')).toHaveText('1 GB');
  await expect(loc.locator('.plan-term')).toHaveText('7 Tage');
  await expect(loc.locator('.price')).toHaveText(/^2,99\sUSD$/);
  await expect(page.locator('#localBlock')).toContainText('Alle 8 Tarife anzeigen');
  const daily = page.locator('#dailyGrid .card', { hasText: '1 GB pro Tag' });
  await expect(daily).toContainText('Danach bis zu 512 kbit/s');
  const fixed = page.locator('#dailyGrid .card', { hasText: '1,5 GB pro Tag' });
  await expect(fixed).toContainText('Das Volumen wird alle 24 Stunden zurückgesetzt');
  await expect(fixed.locator('.plan-term')).toHaveText('3 Tage');
  const reg = page.locator('#regionalGrid .card').first();
  await expect(reg.locator('.price')).toHaveText(/^12,99\sUSD$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  expect(await page.locator('link[rel="alternate"][hreflang]').count()).toBe(0);
  expect(st.csp).toEqual([]); expect(st.errors).toEqual([]); expect(st.external).toEqual([]);
  expect(await noOverflow(page)).toBe(true);
});

test('a country whose German name takes an article: «eSIM für die Türkei»', async ({ page }) => {
  const st = await open(page, '/de/esim/turkey/');
  await expect(page.locator('h1')).toHaveText('eSIM für die Türkei');
  await expect(page).toHaveTitle('eSIM für die Türkei: Tarife in US-Dollar | Magic eSIM');
  expect(st.errors).toEqual([]);
});

test('per-day: the term picked on the card goes to the checkout and the quote; the checkout speaks German', async ({ page }) => {
  const st = await open(page); await ready(page);
  const card = page.locator('#dailyGrid .card', { hasText: '1 GB pro Tag' });
  await expect(card.getByRole('radio', { name: '3' })).toBeChecked();
  await card.getByRole('radio', { name: '7' }).check();
  await expect(card.locator('.price')).toHaveText(/^10,99\sUSD$/);
  await expect(card.locator('.plan-term')).toHaveText('7 Tage');
  await card.getByRole('button').click();
  await expect(page.locator('#coDays')).toHaveValue('7');
  await expect(page.locator('#coTerm')).toHaveText('7 Tage');
  await expect(page.locator('.co-steps')).toContainText('Angaben');
  await expect(page.locator('#coQuote')).toHaveText('Genauen Preis abrufen');
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText(/^10,99\sUSD$/);
  expect(st.quotes).toEqual([{ package_id: PER_DAY.package_id, days: 7 }]);
  await expect(page.locator('#coPay')).toBeDisabled();                 // payment is not available — in German too
  expect(st.errors).toEqual([]);
});

test('the list: an umlaut-free search finds Türkei, Ägypten and Österreich; the count speaks German', async ({ page }) => {
  const st = await open(page, '/de/esim/');
  await page.locator('#hq').fill('turkei');
  await expect(page.locator('#hubList li:not([hidden]) a').first()).toContainText('Türkei');
  await expect(page.locator('#hubCount')).toHaveText('1 Reiseziel gefunden');
  await page.locator('#hq').fill('agypten');
  await expect(page.locator('#hubList li:not([hidden]) a').first()).toContainText('Ägypten');
  await page.locator('#hq').fill('Österreich');
  await expect(page.locator('#hubList li:not([hidden]) a').first()).toContainText('Österreich');
  await page.locator('#hq').fill('zzzz');
  await expect(page.locator('#hubEmpty')).toBeVisible();
  expect(st.external).toEqual([]); expect(st.errors).toEqual([]);
});

test('the home: the search opens the German page of the country; Expressive and the logo are on', async ({ page }) => {
  const st = await open(page, '/de/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', /.+/);
  await expect(page.locator('.brand-logo .lm-symbol')).toHaveCount(1);
  await expect(page.locator('.brand-logo .lm-waves')).toHaveCount(1);
  await page.locator('#q').fill('mexi');
  const first = page.locator('#results a.res').first();
  await expect(first).toHaveText('Mexiko');
  await first.click();
  await expect(page).toHaveURL(/\/de\/esim\/mexico\/$/);
  expect(st.errors).toEqual([]); expect(st.external).toEqual([]);
});

test('the logo «Reveal + Wave» plays once per visit, as on the English pages (the shared `me-logo` key)', async ({ page }) => {
  await open(page, '/de/');
  expect(await page.evaluate(() => [document.documentElement.classList.contains('lm-once'), sessionStorage.getItem('me-logo')])).toEqual([true, '1']);
  await page.goto('/de/esim/');
  expect(await page.evaluate(() => document.documentElement.classList.contains('lm-once')), 'not again in the same visit').toBe(false);
  await page.goto('/en/');
  expect(await page.evaluate(() => document.documentElement.classList.contains('lm-once')), 'nor on English').toBe(false);
});

test('motion.js loads on the home and a country page, as in English, and not on a guide', async ({ page }) => {
  const loaded = [];
  page.on('request', (r) => { if (/\/assets\/motion\.js/.test(r.url())) loaded.push(new URL(page.url()).pathname); });
  await open(page, '/de/'); await page.waitForTimeout(400);
  await page.goto('/de/esim/thailand/'); await page.waitForTimeout(400);
  await page.goto('/de/guides/iphone/'); await page.waitForTimeout(400);
  expect([...new Set(loaded)]).toEqual(['/de/', '/de/esim/thailand/']);
});

test('the phone menu lists the other languages, each to the same page', async ({ page }) => {
  await open(page, '/de/guides/android/');
  await page.locator('.mnav summary').click();
  const langs = page.locator('.mnav-panel a[hreflang]');
  await expect(langs).toHaveText(['Русский', 'English', 'Español', 'Français', '简体中文', '한국어']);
  expect(await langs.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['/android.html', '/en/guides/android/', '/es/guides/android/', '/fr/guides/android/', '/zh/guides/android/', '/ko/guides/android/']);
  expect(await noOverflow(page)).toBe(true);
});

test('an unknown /de/ address gets the German 404, without the counter', async ({ page }) => {
  const metrika = [];
  await page.route('**/mc.yandex.ru/**', (r) => { metrika.push(r.request().url()); return r.fulfill({ status: 204, body: '' }); });
  await page.route((u) => u.pathname === '/de/esim/atlantis/', (r) => r.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body: NOT_FOUND }));
  await page.goto('/de/esim/atlantis/');
  await expect(page.locator('h1')).toHaveText('Seite nicht gefunden');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('a.home').first()).toHaveAttribute('href', '/de/');
  expect(metrika).toEqual([]);
});

test('no layout shift while a country page loads its plans (CLS < 0.02)', async ({ page }) => {
  let release; const gate = new Promise((r) => { release = r; });
  await page.addInitScript(() => {
    window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* WebKit: no API */ }
  });
  await open(page, '/de/esim/thailand/', { gate });
  await page.waitForTimeout(500);
  release();
  await ready(page);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.02);
});

test('German is longer than English: no page overflows the width, no button or tab clips its words', async ({ page }) => {
  for (const url of ['/de/', '/de/esim/', '/de/esim/thailand/', '/de/esim/central-african-republic/', '/de/guides/',
    '/de/guides/iphone/', '/de/guides/troubleshooting/']) {
    await open(page, url);
    if (url === '/de/esim/thailand/') await ready(page);
    expect(await noOverflow(page), `${url}: horizontal scroll`).toBe(true);
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.btn, .cp-jump a, .hub-tile, .dest-tile, .guide-card, .langsw, .co-steps li, h1, h2')]
      .filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map((e) => e.className + ': ' + e.textContent.trim().slice(0, 40)));
    expect(clipped, url).toEqual([]);
  }
  // hyphenation is on for German only
  expect(await page.evaluate(() => getComputedStyle(document.body).hyphens || getComputedStyle(document.body).webkitHyphens)).toBe('auto');
  await page.goto('/en/guides/');
  expect(await page.evaluate(() => getComputedStyle(document.body).hyphens || getComputedStyle(document.body).webkitHyphens)).not.toBe('auto');
});

test.describe('axe', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected
  for (const url of ['/de/', '/de/esim/', '/de/esim/thailand/', '/de/guides/', '/de/guides/iphone/']) {
    test(`axe: ${url}`, async ({ page }) => {
      await open(page, url);
      if (url === '/de/esim/thailand/') await ready(page);
      await restful(page);
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
        .violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`));
      expect(v, url).toEqual([]);
    });
  }
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1366, height: 860 } });
  test('the language list keeps the page; the country page shows prices and no overflow', async ({ page }) => {
    await open(page); await ready(page);
    await page.locator('.hdr-actions details.langmenu summary').click();
    const entries = await page.locator('.langmenu-list li').allTextContents();
    expect(entries.map((t) => t.trim())).toEqual(['Русский', 'English', 'Español', 'Deutsch', 'Français', '简体中文', '한국어']);
    expect(await page.locator('.langmenu-list a').evaluateAll((as) => as.map((a) => a.getAttribute('href'))))
      .toEqual(['/esim/thailand/', '/en/esim/thailand/', '/es/esim/thailand/', '/fr/esim/thailand/', '/zh/esim/thailand/', '/ko/esim/thailand/']);
    await expect(page.locator('#localGrid .card .price').first()).toHaveText(/^2,99\sUSD$/);
    expect(await noOverflow(page)).toBe(true);
  });
});
