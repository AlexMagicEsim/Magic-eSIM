'use strict';

/*
 * Speed audit 2026-10-19 — the plans request in a real browser:
 *   - outside the SEO experiment the request starts in <head> and is the ONLY
 *     API request; a healthy API means no snapshot download at all;
 *   - a stalled API (no headers) → the snapshot after ~2 s, the plans on screen,
 *     still one API request; a failing API → the old retry / fallback / snapshot;
 *   - the prices on the cards are the API's, the checkout opens with the plan;
 *   - an SEO-experiment page keeps the old 1.2 s race.
 * Nothing leaves the machine: the API is answered here, Metrika is stubbed.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8'));
const cors = { 'access-control-allow-origin': '*' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** api: { delayMs, status } — how the API answers; every request is counted. */
async function open(page, url, api = {}) {
  const st = { api: [], apiAt: [], snapshot: 0, errors: [], nonGet: 0 };
  const t0 = Date.now();
  page.on('pageerror', (e) => st.errors.push(e.message));
  await page.addInitScript(() => { window.ym = function () {}; });
  await page.route('**/assets/catalog.json*', async (route) => {
    st.snapshot += 1;
    // A fresh snapshot: the page may show it without a «saved data» notice.
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...CATALOG, generated_at: new Date().toISOString() }) });
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') { st.nonGet += 1; return route.abort(); }
    if (/\/api\/v1\/retail\/packages/.test(req.url())) {
      st.api.push(new URL(req.url()).host); st.apiAt.push(Date.now() - t0);
      if (api.delayMs) await sleep(api.delayMs);
      if (api.status) return route.fulfill({ status: api.status, headers: cors, body: '' });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ status: 'success', data: api.data || CATALOG.packages }) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto(url);
  return st;
}

test('healthy API: one API request, started before the page\'s scripts, and no snapshot download', async ({ page }) => {
  const st = await open(page, '/esim/turkey/', { delayMs: 300 });
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
  await page.waitForTimeout(2500);                      // past the 2 s snapshot deadline
  expect(st.api.length).toBe(1);
  expect(st.snapshot).toBe(0);
  const early = await page.evaluate(() => !!(window.__magicCatalogEarly && window.__magicCatalogEarly.used));
  expect(early).toBe(true);
  expect(st.errors).toEqual([]);
});

test('the prices on the cards are the API\'s, and the checkout opens with the plan', async ({ page }) => {
  // The API answers one Turkey plan 50 ₽ dearer than the snapshot: the card must show the API's price.
  const target = CATALOG.packages.find((p) => (p.coverage_country_codes || []).join() === 'TR' && !Array.isArray(p.term_prices));
  const data = CATALOG.packages.map((p) => (p === target ? { ...p, price: p.price + 50 } : p));
  const st = await open(page, '/esim/turkey/', { delayMs: 200, data });
  const btn = page.locator(`#localGrid .js-buy[data-package-id="${target.package_id}"]`);
  await expect(btn).toHaveAttribute('data-price', String(target.price + 50));
  await page.evaluate((id) => { const b = document.querySelector(`#localGrid .js-buy[data-package-id="${id}"]`); const card = b.closest('.plan'); card.hidden = false; }, target.package_id);
  await btn.click();
  await expect(page.locator('#checkoutModal')).toBeVisible();
  await expect(page.locator('#coPrice')).toHaveText(`${(target.price + 50).toLocaleString('ru-RU')} ₽`);
  expect(st.api.length).toBe(1);
  expect(st.nonGet).toBe(0);
});

test('a stalled API: the snapshot after ~2 s puts the plans on screen; still one API request', async ({ page }) => {
  const st = await open(page, '/esim/turkey/', { delayMs: 9000 });
  const t = Date.now();
  await expect(page.locator('#localGrid .plan').first()).toBeVisible({ timeout: 6000 });
  expect(Date.now() - t).toBeLessThan(5000);
  expect(st.snapshot).toBe(1);
  expect(st.api.length).toBe(1);
  await expect(page.locator('#packagesStatus')).toBeEmpty();
  expect(st.errors).toEqual([]);
});

test('a failing API: the old retry and fallback road, then the snapshot; the plans are on screen', async ({ page }) => {
  const st = await open(page, '/esim/turkey/', { status: 503 });
  await expect(page.locator('#localGrid .plan').first()).toBeVisible({ timeout: 10000 });
  expect(st.snapshot).toBe(1);
  // the early request (attempt 1 on the primary), attempt 2 on the primary, one on the fallback
  expect(st.api.length).toBe(3);
  expect(new Set(st.api).size).toBe(2);
  expect(st.errors).toEqual([]);
});

test('an SEO-experiment page keeps the old 1.2 s race (no early request)', async ({ page }) => {
  const st = await open(page, '/esim/uae/', { delayMs: 2500 });
  await expect(page.locator('#tariffs .plan').first()).toBeVisible({ timeout: 6000 });
  expect(await page.evaluate(() => typeof window.__magicCatalogEarly)).toBe('undefined');
  expect(st.snapshot).toBe(1);
  expect(st.api.length).toBe(1);
});
