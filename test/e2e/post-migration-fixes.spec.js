'use strict';

/*
 * Post-migration audit fixes (2026-11-07), in a real browser — Chromium here and WebKit (playwright.config.js
 * webkit-flags). The node tests (seo/test-legacy-referrer.mjs, seo/test-ru-language-switch.mjs) run the same code
 * against stubs; this proves the browser does what they assume.
 *
 *   P2  An old Russian address reached from a search engine: its client-side redirect page hands the real referrer
 *       over, so the new page's attribution record and its Metrika init carry the search engine, not our old address.
 *       The query survives as before.
 *   P2  «English» on a Russian page opens the same page in English.
 *   P1  «Вернуться на главную» after a payment opens the Russian home.
 *
 * Nothing leaves the local server: isolateFromInternet aborts tag.js and the production API (the plans are not needed
 * here); Metrika's own queue (window.ym.a) is read for the init call.
 */

const { test, expect } = require('@playwright/test');
const { isolateFromInternet } = require('../helpers/hermetic.cjs');

const SEARCH = 'https://yandex.ru/search/?text=esim+turkey';

test.beforeEach(async ({ context }) => { await isolateFromInternet(context); });

const ymInit = (page) => page.evaluate(() => {
  const q = (window.ym && window.ym.a) || [];
  const init = [].slice.call(q).map((a) => [].slice.call(a)).find((a) => a[1] === 'init');
  return init ? init[2] : null;
});

test('an old Russian address from a search: the new page records the search engine, in attribution and in Metrika', async ({ page }) => {
  await page.goto('/esim/turkey/?utm_source=x', { referer: SEARCH });
  await page.waitForURL(/\/ru\/esim\/turkey\/\?utm_source=x$/);
  await page.waitForFunction(() => sessionStorage.getItem('magic_attr'));
  const st = await page.evaluate(() => ({
    attr: JSON.parse(sessionStorage.getItem('magic_attr')),
    handOff: sessionStorage.getItem('magic_legacy_ref'),
    referrer: document.referrer,
  }));
  expect(st.referrer, 'the browser itself only sees our old address').toContain('/esim/turkey/');
  expect(st.attr.referrer).toBe(SEARCH);
  expect(st.attr.utm_source).toBe('x');
  expect(st.attr.entry).toBe('/ru/esim/turkey/');
  expect(st.handOff, 'taken once').toBeNull();
  const opts = await ymInit(page);
  expect(opts).toBeTruthy();
  expect(opts.referrer).toBe(SEARCH);
  expect(opts.webvisor).toBe(true);
});

test('the new address opened directly is unchanged: no hand-off, Metrika gets no referrer option', async ({ page }) => {
  await page.goto('/ru/esim/turkey/', { referer: SEARCH });
  await page.waitForFunction(() => sessionStorage.getItem('magic_attr'));
  const attr = await page.evaluate(() => JSON.parse(sessionStorage.getItem('magic_attr')));
  expect(attr.referrer).toBe(SEARCH);
  const opts = await ymInit(page);
  expect(opts.referrer).toBeUndefined();
});

test('an internal hop through an old address is still not a referral', async ({ page }) => {
  await page.goto('/ru/');
  await page.evaluate(() => sessionStorage.clear());
  await page.evaluate(() => { location.href = '/esim/italy/'; }); // a click from our own page: the referrer is ours
  await page.waitForURL(/\/ru\/esim\/italy\/$/);
  await page.waitForFunction(() => sessionStorage.getItem('magic_attr'));
  const attr = await page.evaluate(() => JSON.parse(sessionStorage.getItem('magic_attr')));
  expect(attr.referrer).toBeUndefined();
});

for (const [from, to] of [['/ru/esim/turkey/', '/destinations/turkey/'], ['/ru/esim/', '/destinations/'], ['/ru/iphone.html', '/guides/iphone/'],
  ['/ru/esim/not-working/', '/guides/troubleshooting/'], ['/ru/esim/payment-rubles/', '/'], ['/ru/', '/']]) {
  test(`«English» on ${from} opens ${to}`, async ({ page }) => {
    await page.goto(from);
    const sw = page.locator('a.langsw');
    const menu = page.locator('.mnav-panel a[lang="en"]');
    await expect(sw).toHaveAttribute('href', to);
    await expect(menu).toHaveAttribute('href', to);
    // the header link on a wide screen, the phone menu on a narrow one — whichever a buyer sees
    if (await sw.isVisible()) await sw.click();
    else { await page.locator('details.mnav > summary').click(); await menu.click(); }
    await page.waitForURL((u) => u.pathname === to);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
  });
}

test('after a payment «Вернуться на главную» opens the Russian home', async ({ page }) => {
  await page.route('**/api/v1/public/retail-orders/*/status', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'completed', paymentStatus: 'confirmed', amountRub: 950, currency: 'RUB', country: 'IT' }) }));
  await page.goto('/payment-success.html?token=TestTokenR308_abcdefghijklmnopqrstuvwxyz012');
  const home = page.locator('#actionHome');
  await expect(home).toBeVisible();
  await expect(home).toHaveAttribute('href', '/ru/');
  await home.click();
  await page.waitForURL((u) => u.pathname === '/ru/');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('ru');
});
