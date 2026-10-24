'use strict';

/*
 * Conversion stage 2, PR A — a Russian country page in the EN country page's
 * structure, in a real browser (outside the SEO experiment):
 *   - the first plan and its «Купить» are in the first screen, phone and desktop;
 *   - plans render local → regional → daily (EN order), the jump bar follows;
 *   - the EN skeleton stands in while the plans load, and goes when they come;
 *   - jump links land on their block; a local card and a daily card (with its
 *     chosen term) open the checkout with that plan;
 *   - the authored text is under the plans;
 *   - an SEO-experiment page keeps the old first screen and order.
 * Nothing leaves the machine: the API is answered here, Metrika is stubbed.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8'));
const cors = { 'access-control-allow-origin': '*' };

async function open(page, url, { gate } = {}) {
  await page.addInitScript(() => { window.ym = function () {}; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.abort();
    if (/\/api\/v1\/retail\/packages/.test(req.url())) {
      if (gate) await gate;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ status: 'success', data: CATALOG.packages }) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto(url);
}
const blockOrder = (page) => page.evaluate(() => [...document.querySelectorAll('#tariffs .plan-block')]
  .filter((b) => !b.hidden).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map((b) => b.id));

for (const [w, h] of [[390, 844], [320, 568], [1366, 900]]) {
  test(`${w}x${h}: short H1, and the first plan with «Купить» in the first screen`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page, '/esim/thailand/');
    await expect(page.locator('h1')).toHaveText('eSIM для Таиланда');
    const buy = page.locator('#localGrid .plan .js-buy').first();
    await expect(buy).toBeVisible();
    const box = await buy.boundingBox();
    if (w >= 390) expect(box.y + box.height).toBeLessThanOrEqual(h);   // 320x568: the card starts in the first screen
    const card = await page.locator('#localGrid .plan').first().boundingBox();
    expect(card.y).toBeLessThan(h);
  });
}

test('plans in the EN order, the jump bar too; the authored text under them', async ({ page }) => {
  await open(page, '/esim/thailand/');
  await expect(page.locator('#dailyGrid .plan').first()).toBeAttached();
  expect(await blockOrder(page)).toEqual(['localBlock', 'regionalBlock', 'dailyBlock']);
  const jumps = await page.locator('.cp-jump a:not([hidden])').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(jumps).toEqual(['#localBlock', '#regionalBlock', '#dailyBlock']);
  const about = page.locator('.cp-sec.about');
  await expect(about.locator('h2')).toHaveText(/Интернет в Таиланде/);
  const aboutY = await about.evaluate((e) => e.getBoundingClientRect().top + scrollY);
  const dailyY = await page.locator('#dailyBlock').evaluate((e) => e.getBoundingClientRect().top + scrollY);
  expect(aboutY).toBeGreaterThan(dailyY);
});

test('the EN skeleton stands in while the plans load, and goes when they come', async ({ page }) => {
  let release; const gate = new Promise((r) => { release = r; });
  await open(page, '/esim/thailand/', { gate });
  await expect(page.locator('#tariffs .cp-skeleton')).toBeVisible();
  await expect(page.locator('#localBlock')).toBeHidden();
  release();
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
  await expect(page.locator('#tariffs .cp-skeleton')).toBeHidden();
});

test('the jump link to «На каждый день» lands on that block', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/esim/thailand/');
  await expect(page.locator('#dailyGrid .plan').first()).toBeVisible();
  await page.locator('.cp-jump a[href="#dailyBlock"]').click();
  await expect.poll(() => page.locator('#dailyBlock h2').evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBeLessThan(300);
  const bar = await page.locator('.cp-jump').boundingBox();
  const head = await page.locator('#dailyBlock h2').boundingBox();
  expect(head.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
});

test('a local card and a daily card with its chosen term open the checkout with that plan', async ({ page }) => {
  await open(page, '/esim/thailand/');
  const local = page.locator('#localGrid .plan').first();
  await local.locator('.js-buy').click();
  await expect(page.locator('#checkoutModal')).toBeVisible();
  await expect(page.locator('#coPlanName')).toHaveText(await local.locator('.js-buy').getAttribute('data-name'));
  await page.click('#checkoutClose');
  const daily = page.locator('#dailyGrid .plan').first();
  await daily.scrollIntoViewIfNeeded();
  await daily.locator('.js-daily-term').nth(2).click();
  const days = await daily.locator('.js-daily-term').nth(2).getAttribute('data-days');
  await daily.locator('.js-buy').click();
  await expect(page.locator('#checkoutModal')).toBeVisible();
  await expect(page.locator('#coDays')).toHaveText(`${days} дн.`);
});

test('a former SEO-experiment page has the EN first screen and order since 2026-10-24; its headline stands under the plans', async ({ page }) => {
  await open(page, '/esim/uae/');
  await expect(page.locator('#tariffs .plan').first()).toBeVisible();
  await expect(page.locator('h1')).toHaveText(/^eSIM для ОАЭ$/);
  expect(await page.locator('.cp-text').count()).toBe(0);
  await expect(page.locator('.cp-sec.about #aboutTitle')).toContainText('Дуба');
  expect((await blockOrder(page))[0]).toBe('localBlock');
});
