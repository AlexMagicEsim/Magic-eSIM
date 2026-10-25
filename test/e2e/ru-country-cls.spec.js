'use strict';

/*
 * A country page does not jump while its plans load (conversion audit
 * 2026-10-19). Two sources moved the page under a reader's finger on template
 * pages: the jump bar appearing (#95) and the «На каждый день» block inserted
 * above the empty «Тарифы для X» / «Региональные» headings (assets/ru.css).
 * Measured as the browser measures it — the sum of unexpected layout shifts
 * over the load — with the API answering late, so the loading state is
 * actually on screen. Nothing leaves the machine.
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });
const fs = require('fs');
const path = require('path');

const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8'));
// A template page with plans in the first screen, an authored one, and the
// thinnest pages (1–3 plans: the reserved place must not make them jump UP).
const PAGES = ['/esim/peru/', '/esim/turkey/', '/esim/timor-leste/', '/esim/sint-maarten/', '/esim/sudan/'];

async function cls(page, url) {
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  });
  await page.addInitScript(() => { window.ym = function () {}; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/v1/retail/packages') {
      await new Promise((r) => setTimeout(r, 1500));
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(withLayout({ status: 'success', data: CATALOG.packages })) });
    }
    if (route.request().method() !== 'GET') return route.abort();
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto(url);
  await expect(page.locator('#packagesStatus')).toHaveText(/Загружаем/);       // the loading state was on screen
  await expect(page.locator('.plan .js-buy').first()).toBeVisible();
  await page.waitForTimeout(800);
  return page.evaluate(() => window.__cls);
}

for (const url of PAGES) {
  test(`${url}: no layout shift while the plans load`, async ({ page }) => {
    expect(await cls(page, url)).toBeLessThan(0.02);
  });
  // The projects are phones; the first measurement (0.45, then 0.24) was on a desktop too.
  test(`${url}: no layout shift on a 1366x900 screen either`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    expect(await cls(page, url)).toBeLessThan(0.02);
  });
}

test('while loading, the empty plan headings are not on the page; after, they are', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/v1/retail/packages') {
      await gate;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(withLayout({ status: 'success', data: CATALOG.packages })) });
    }
    if (route.request().method() !== 'GET') return route.abort();
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto('/esim/peru/');
  await expect(page.locator('#packagesStatus')).toHaveText(/Загружаем/);
  await expect(page.locator('#localBlock')).toBeHidden();
  await expect(page.locator('#regionalBlock')).toBeHidden();
  release();
  await expect(page.locator('#localBlock')).toBeVisible();
  await expect(page.locator('#packagesStatus')).toBeEmpty();
});
