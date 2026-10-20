'use strict';

/*
 * The plans area's loading state is #tariffs[data-loading] (assets/country-tariffs.js
 * writes it, assets/ru.css reads it) — not the status text. Safari 26.4 left the
 * local and regional plans display:none after the status was cleared (a missed
 * restyle of a :has(:not(:empty)) rule; ~15 s, or until a scroll). This suite runs
 * in Chromium, which restyles correctly, so it pins the property that makes the
 * Safari bug irrelevant: once the script has run, the plans' visibility follows the
 * attribute alone. seo/test-plans-loading-state.mjs pins the stylesheet's shape.
 * Nothing leaves the machine.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8'));
const OK = { status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ status: 'success', data: CATALOG.packages }) };

// gate: a promise the API answer waits for; fail: the API and the snapshot both fail.
async function stub(page, { gate, fail } = {}) {
  await page.addInitScript(() => { window.ym = function () {}; });
  if (fail) await page.route('**/assets/catalog.json*', (route) => route.abort());
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/v1/retail/packages') {
      if (fail) return route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' });
      if (gate) await gate;
      return route.fulfill(OK);
    }
    if (route.request().method() !== 'GET') return route.abort();
    return route.fulfill({ status: 204, body: '' });
  });
}

const minHeight = (page) => page.locator('#tariffs').evaluate((e) => getComputedStyle(e).minHeight);

// Turkey: compact cards (skeleton + 60vh); UAE: a frozen SEO-experiment page (old cards, 80vh).
for (const url of ['/esim/turkey/', '/esim/uae/']) {
  test(`${url}: «true» while loading, «false» after — and the plans show`, async ({ page }) => {
    let release;
    await stub(page, { gate: new Promise((r) => { release = r; }) });
    await page.goto(url);
    const tariffs = page.locator('#tariffs');
    await expect(tariffs).toHaveAttribute('data-loading', 'true');
    await expect(page.locator('#packagesStatus')).toHaveText(/Загружаем/);
    await expect(page.locator('#localBlock')).toBeHidden();
    await expect(page.locator('#regionalBlock')).toBeHidden();
    expect(await minHeight(page)).not.toBe('0px');                       // the CLS reserve holds
    if (url === '/esim/turkey/') await expect(page.locator('#tariffs > .cp-skeleton')).toBeVisible();
    release();
    await expect(tariffs).toHaveAttribute('data-loading', 'false');
    await expect(page.locator('#packagesStatus')).toBeEmpty();
    await expect(page.locator('#localBlock')).toBeVisible();
    await expect(page.locator('#localGrid .plan').first()).toBeVisible();
    await expect(page.locator('#tariffs > .cp-skeleton')).toBeHidden();
    expect(await minHeight(page)).toBe('0px');                           // the reserve is gone
  });
}

test('after the render, the status text no longer decides anything (the Safari 26.4 bug cannot hide the plans)', async ({ page }) => {
  await stub(page);
  await page.goto('/esim/turkey/');
  await expect(page.locator('#tariffs')).toHaveAttribute('data-loading', 'false');
  await expect(page.locator('#localBlock')).toBeVisible();
  // What Safari 26.4 effectively did: apply the rules as if the status still had text.
  await page.locator('#packagesStatus').evaluate((e) => { e.textContent = 'Загружаем тарифы...'; });
  await expect(page.locator('#localBlock')).toBeVisible();
  await expect(page.locator('#regionalBlock')).toBeVisible();
  await expect(page.locator('#tariffs > .cp-skeleton')).toBeHidden();
  expect(await minHeight(page)).toBe('0px');
});

test('before the script runs, the first paint still hides the empty plan headings (CLS)', async ({ page }) => {
  await stub(page);
  await page.route('**/assets/country-tariffs.js*', (route) => route.abort());
  await page.goto('/esim/turkey/');
  await expect(page.locator('#tariffs')).not.toHaveAttribute('data-loading', /.*/);
  await expect(page.locator('#packagesStatus')).toHaveText(/Загружаем/);
  await expect(page.locator('#localBlock')).toBeHidden();
  await expect(page.locator('#regionalBlock')).toBeHidden();
  await expect(page.locator('#tariffs > .cp-skeleton')).toBeVisible();
  expect(await minHeight(page)).not.toBe('0px');
});

test('a failed load ends the loading state too: no skeleton, no reserve, the retry notice', async ({ page }) => {
  await stub(page, { fail: true });
  await page.goto('/esim/turkey/');
  await expect(page.locator('#tariffs')).toHaveAttribute('data-loading', 'false', { timeout: 30_000 });
  await expect(page.locator('#catalogNotice')).toBeVisible();
  await expect(page.locator('#tariffs > .cp-skeleton')).toBeHidden();
  expect(await minHeight(page)).toBe('0px');
});
