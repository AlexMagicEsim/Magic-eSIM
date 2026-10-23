'use strict';

/*
 * Compact plan cards (the EN card's density) on the RU country pages outside the
 * SEO experiment — at 320, 375 and 390 px:
 *   - a plan for this country alone drops «Покрытие: <страна>»; a multi-country
 *     plan keeps it (authored pages cite «строка «Покрытие»» for those);
 *   - «Активация» keeps its row (cited by 14 profiles), without «установка по QR»;
 *   - the daily term picker: «Срок, дней:» and the days only, in ONE row (3 + 3 at 320 px); each
 *     cell keeps its price in aria-label and data-price; picking one moves the
 *     card's price and term, and the checkout gets that term and price;
 *   - volume, term, price, type badge, «Покрытие и условия», network, top-up and
 *     the 40 px buy button stay; cards are lower than before; axe 0; no overflow;
 *   - an SEO-experiment page renders the cards exactly as before.
 * Nothing leaves the machine: the API is answered here, Metrika is stubbed.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8'));
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const cors = { 'access-control-allow-origin': '*' };

async function open(page, url, width) {
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(() => { window.ym = function () {}; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.abort();
    if (/\/api\/v1\/retail\/packages/.test(req.url())) {
      return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ status: 'success', data: CATALOG.packages }) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto(url);
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
  // the layout claims below are about the cards at rest: let the Expressive entrance (a rise, no resize) finish
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 });
}
const h = (loc) => loc.evaluate((e) => Math.round(e.getBoundingClientRect().height));
// Measured before this change (2026-10-19, /esim/turkey/): local / daily card height.
const BEFORE = { 320: { local: 300, daily: 468 }, 375: { local: 275, daily: 436 }, 390: { local: 275, daily: 436 } };

for (const width of [320, 375, 390]) {
  test.describe(`${width} px`, () => {
    test('what a card says: single-country lines dropped, multi-country kept, everything essential there', async ({ page }) => {
      await open(page, '/esim/turkey/', width);
      await expect(page.locator('#tariffs')).toHaveAttribute('data-cards', 'compact');
      const local = page.locator('#localGrid .plan').first();
      await expect(local.locator('.plan-data')).toHaveText(/\d+\s*GB/);
      await expect(local.locator('.plan-term')).toHaveText(/\d+ (день|дня|дней)/);
      await expect(local.locator('.price')).toHaveText(/\d[\d\s ]*₽/);
      await expect(local.locator('.plan-badge').first()).toHaveText('Локальный тариф');
      await expect(local.locator('.meta')).not.toContainText('Покрытие:');
      await expect(local.locator('.meta')).toContainText(/^Активация: срок /);
      await expect(local.locator('.meta')).not.toContainText('установка по QR');
      await expect(local.locator('.js-coverage')).toHaveText('Покрытие и условия');
      await expect(local.locator('.plan-net')).toContainText('Сеть');
      const regional = page.locator('#regionalGrid .plan').first();
      await expect(regional.locator('.meta')).toContainText('Покрытие:');
      // Daily: Turkey's own keeps no coverage line; a multi-country daily keeps it.
      const dailyTr = page.locator('#dailyGrid .plan', { has: page.locator('.plan-data', { hasText: /^Турция — / }) }).first();
      await expect(dailyTr.locator('.meta')).not.toContainText('Покрытие:');
      const dailyMulti = page.locator('#dailyGrid .plan', { hasNot: page.locator('.plan-data', { hasText: /^Турция — / }) }).first();
      if (await dailyMulti.count()) await expect(dailyMulti.locator('.meta')).toContainText('Покрытие:');
    });

    test('cards are lower than before; the buy button keeps its 40 px', async ({ page }) => {
      await open(page, '/esim/turkey/', width);
      const local = await h(page.locator('#localGrid .plan').first());
      const daily = await h(page.locator('#dailyGrid .plan').nth(0));
      expect(local).toBeLessThan(BEFORE[width].local - 25);
      expect(daily).toBeLessThan(BEFORE[width].daily - 60);
      for (const b of await page.locator('#tariffs .js-buy:visible').all()) {
        const box = await b.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('the daily terms: days only, one row (3 + 3 at 320), 40×40 targets; the pick reaches the card and the checkout', async ({ page }) => {
      await open(page, '/esim/turkey/', width);
      const card = page.locator('#dailyGrid .plan').first();
      await expect(card.locator('.daily-terms-block > .package-meta-label')).toHaveText('Срок, дней:');
      const cells = card.locator('.js-daily-term');
      const n = await cells.count();
      expect(n).toBeGreaterThan(2);
      const tops = [];
      for (let i = 0; i < n; i++) {
        const c = cells.nth(i);
        await expect(c).toHaveText(/^\d+$/);
        await expect(c).toHaveAttribute('aria-label', /^\d+ (день|дня|дней) за \d+ рублей$/);
        const box = await c.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(40);
        expect(box.width).toBeGreaterThanOrEqual(40);
        tops.push(Math.round(box.y));
      }
      // B1 (brand book v1.1): 44 px day targets; at 320 px six of them cannot share one row (6 × 44 + 5 × 6 = 294 px
      // against ~248), so a six-term ladder sits three and three (owner, 2026-10-23); wider: one row
      const rows = [...new Set(tops)];
      if (width === 320 && n === 6) {
        expect(rows.length).toBe(2);
        expect(tops.filter((t) => t === rows[0]).length).toBe(3);
      } else {
        expect(rows.length).toBe(1);
      }
      const pick = cells.nth(2);
      await pick.scrollIntoViewIfNeeded();
      await pick.click();
      const days = await pick.getAttribute('data-days');
      const price = await pick.getAttribute('data-price');
      await expect(card.locator('.js-daily-price')).toHaveText(`${Number(price).toLocaleString('ru-RU')} ₽`);
      await expect(card.locator('.js-daily-days')).toHaveText(new RegExp(`^${days} `));
      await card.locator('.js-buy').click();
      await expect(page.locator('#checkoutModal')).toBeVisible();
      await expect(page.locator('#coDays')).toHaveText(`${days} дн.`);
      await expect(page.locator('#coPrice')).toHaveText(`${Number(price).toLocaleString('ru-RU')} ₽`);
    });
  });
}

test('axe: the compact cards, with a term selected', async ({ page }) => {
  await open(page, '/esim/turkey/', 390);
  await page.locator('#dailyGrid .plan').first().locator('.js-daily-term').nth(1).click();
  await page.addScriptTag({ content: AXE });
  const v = await page.evaluate(async () => (await axe.run(document.getElementById('tariffs'), { runOnly: ['wcag2a', 'wcag2aa'] }))
    .violations.map((x) => `${x.id}: ${x.nodes.length}`));
  expect(v).toEqual([]);
});

test('an SEO-experiment page renders the cards exactly as before', async ({ page }) => {
  await open(page, '/esim/uae/', 390);
  expect(await page.locator('#tariffs').getAttribute('data-cards')).toBeNull();
  await expect(page.locator('#localGrid .plan').first().locator('.meta')).toContainText('Покрытие:');
  await expect(page.locator('#localGrid .plan').first().locator('.meta')).toContainText('установка по QR');
  const cell = page.locator('#dailyGrid .js-daily-term').first();
  await expect(cell.locator('.package-meta-value')).toHaveText(/\d+ ₽/);
});
