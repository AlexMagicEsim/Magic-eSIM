'use strict';

/*
 * An English country page must not jump when its catalogue does not come (2026-10-21).
 *
 * While the GLOBAL catalogue loads, the skeleton holds the plans' place and «Before you buy» sits below it. On a failure
 * `failed()` used to hide the skeleton and leave two lines and a button, so everything under them moved up by a
 * skeleton's height and into the screen: CLS 0.07 at 1366 and 0.11 at 390 in Chromium. The state line now keeps the
 * skeleton's height (en/country.js keepPlace) — on a failure and on «no plans» — and gives it back when plans load.
 *
 * Measured two ways: the SUM of layout shifts over the load (Chromium; the budget the RU pages use, < 0.02), and the
 * position of «Before you buy» before and after the failure (any engine — Safari has no layout-shift API).
 * Nothing real is touched: the catalogue is answered in the browser, every other external request is refused.
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });
const ROWS = require('../fixtures/en-plans-catalogue.json').packages;

const CATALOGUE = /\/api\/v1\/retail\/packages\?market=global(?:&country=[A-Z]{2})?$/;
const ok = (packages) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(withLayout({ status: 'success', market: 'global', currency: 'USD', data: packages })) });

async function open(page, answer, { delayMs = 0 } = {}) {
  await page.addInitScript(() => {
    window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* no API */ }
  });
  // The LAST registered route wins: the refusal first, the catalogue after it.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
  await page.route(CATALOGUE, async (route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return answer === 'abort' ? route.abort() : route.fulfill(answer);
  });
  await page.goto('/en/esim/thailand/');
}
const helpTop = (page) => page.evaluate(() => Math.round(document.querySelector('.cp-help').getBoundingClientRect().top + window.scrollY));
const cls = (page) => page.evaluate(() => window.__cls);

for (const [name, answer] of [['HTTP 500', { status: 500, body: '' }], ['a dropped connection', 'abort']]) {
  test(`catalogue fails (${name}): «Before you buy» stays where the skeleton put it, CLS under budget`, async ({ page }) => {
    await open(page, answer, { delayMs: 800 });
    await expect(page.locator('#skeleton')).toBeVisible();
    const before = await helpTop(page);
    await expect(page.locator('#retry')).toBeVisible();
    await expect(page.locator('#skeleton')).toBeHidden();
    expect(Math.abs((await helpTop(page)) - before), 'moved by').toBeLessThanOrEqual(1);
    expect(await cls(page)).toBeLessThan(0.02);
    // the same words and the same button as before: only the place is kept
    await expect(page.locator('#status')).toHaveText("Prices are temporarily unavailable. Please check back soon — nothing can be ordered here yet.");
  });
}

test('a failure that answers at once is under budget too', async ({ page }) => {
  await open(page, { status: 500, body: '' });
  await expect(page.locator('#retry')).toBeVisible();
  await page.waitForTimeout(300);
  expect(await cls(page)).toBeLessThan(0.02);
});

test('«Try again» after a failure: the reserved place is given back when the plans arrive', async ({ page }) => {
  let fail = true;
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
  await page.route(CATALOGUE, (route) => (fail ? route.fulfill({ status: 500, body: '' }) : route.fulfill(ok(ROWS))));
  await page.goto('/en/esim/thailand/');
  await expect(page.locator('#retry')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('.cp-state').style.minHeight)).toMatch(/^\d+px$/);
  fail = false;
  await page.locator('#retry').click();
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('.cp-state').style.minHeight)).toBe('');
});

test('a normal load is unchanged: no reserved height, plans shown, CLS 0', async ({ page }) => {
  await open(page, ok(ROWS));
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
  await expect(page.locator('#status')).toBeHidden();
  expect(await page.evaluate(() => document.querySelector('.cp-state').style.minHeight)).toBe('');
  await page.waitForTimeout(300);
  expect(await cls(page)).toBeLessThan(0.02);
});

test('«no plans for this country» holds the place the same way', async ({ page }) => {
  await open(page, ok(ROWS.filter((p) => !(p.coverage_country_codes || []).includes('TH'))), { delayMs: 800 });
  await expect(page.locator('#skeleton')).toBeVisible();
  const before = await helpTop(page);
  await expect(page.locator('#emptyLink')).toBeVisible();
  expect(Math.abs((await helpTop(page)) - before)).toBeLessThanOrEqual(1);
  expect(await cls(page)).toBeLessThan(0.02);
});
