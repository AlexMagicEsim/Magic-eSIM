'use strict';

/*
 * Conversion audit 2026-10-19, stage 1 — the quick fixes, in a real browser:
 *   1. promo messages never contradict each other: an applied code clears the
 *      «введён, но не применён» error, editing the field clears a stale message,
 *      and «Применить» is inactive while a code is applied;
 *   2. a promo action never hides an error of another kind (a missing email);
 *   3. no autofocus on a touch screen (the keyboard covered the sum and the pay
 *      button), autofocus kept with a mouse;
 *   4. on a short screen the pay button stays in view (320x568: it was below
 *      the fold of an 800 px window);
 *   5. the jump bar keeps its place while the plans load: the plans do not
 *      move when it appears (CLS 0.45 on template pages);
 *   6. «Найти тариф» in the header scrolls to this page's plans instead of
 *      leaving for the home; its href is unchanged;
 *   7. tariff_buy_click no longer reports a daily plan as «local»;
 *   8. the failed-payment page does not claim the money was not taken.
 * Nothing leaves the machine: the API is answered here, Metrika is stubbed.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'catalog.json'), 'utf8'));
const cors = { 'access-control-allow-origin': '*' };

async function open(page, url = '/esim/turkey/', opts = {}) {
  const st = { goals: [], quotes: [] };
  await page.exposeBinding('__goal', (src, name, params) => st.goals.push({ name, params }));
  await page.addInitScript(() => { window.ym = function (id, kind, goal, params) { if (kind === 'reachGoal') window.__goal(goal, params || null); }; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (u.pathname === '/api/v1/retail/packages') {
      if (opts.liveDelayMs) await new Promise((r) => setTimeout(r, opts.liveDelayMs));
      return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ status: 'success', data: CATALOG.packages }) });
    }
    if (req.method() === 'POST' && u.pathname === '/api/v1/retail/promo/quote') {
      const b = JSON.parse(req.postData() || '{}'); st.quotes.push(b);
      if (b.promo_code === 'GOOD10') return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ valid: true, promo_code: 'GOOD10', original_amount_rub: 450, discount_amount_rub: 45, final_amount_rub: 405 }) });
      return route.fulfill({ status: 404, contentType: 'application/json', headers: cors, body: JSON.stringify({ valid: false, error: 'PROMO_CODE_NOT_FOUND' }) });
    }
    if (req.method() !== 'GET') return route.abort();
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto(url);
  return st;
}
const err = (page) => page.locator('#coError');
const promoMsg = (page) => page.locator('#coPromoMsg');

async function openLocal(page) {
  const b = page.locator('#localGrid .plan .js-buy').first();
  await expect(b).toBeVisible();
  await b.click();
  await expect(page.locator('#checkoutModal')).toBeVisible();
}

test('promo: an applied code clears «не применён», locks the field, and «Удалить» unlocks it', async ({ page }) => {
  await open(page);
  await openLocal(page);
  await page.fill('#coEmail', 'buyer@example.com');
  await page.check('#coConsent');
  await page.fill('#coPromoInput', 'good10');
  await page.click('#coPay');                                    // typed, not applied
  await expect(err(page)).toHaveText(/не применён/);
  await page.click('#coPromoApply');
  await expect(page.locator('#coPromoApplied')).toBeVisible();
  await expect(err(page)).toBeHidden();                          // was: both on screen at once
  await expect(page.locator('#coPromoApply')).toBeDisabled();
  await expect(page.locator('#coPromoInput')).toHaveJSProperty('readOnly', true);
  await page.click('#coPromoRemove');
  await expect(page.locator('#coPromoApply')).toBeEnabled();
  await expect(page.locator('#coPromoInput')).toHaveJSProperty('readOnly', false);
});

test('promo: editing the field clears a stale message; changing the method still drops the code', async ({ page }) => {
  const st = await open(page);
  await openLocal(page);
  await page.fill('#coPromoInput', 'bad1');
  await page.click('#coPromoApply');
  await expect(promoMsg(page)).toHaveText('Промокод не найден.');
  await page.fill('#coPromoInput', 'good');                      // the message described the old text
  await expect(promoMsg(page)).toBeHidden();
  await page.fill('#coPromoInput', 'good10');
  await page.click('#coPromoApply');
  await expect(page.locator('#coPromoApplied')).toBeVisible();
  await page.click('#coMethodCard');                             // deliberate: the quote depends on the method
  await expect(page.locator('#coPromoApplied')).toBeHidden();
  await expect(promoMsg(page)).toHaveText(/примените промокод заново/);
  await page.fill('#coPromoInput', '');
  await expect(promoMsg(page)).toBeHidden();
  expect(st.quotes.length).toBe(2);
});

test('a promo action never hides an error of another kind', async ({ page }) => {
  await open(page);
  await openLocal(page);
  await page.click('#coPay');                                    // no email
  await expect(err(page)).toHaveText(/корректный email/);
  await page.fill('#coPromoInput', 'good10');
  await page.click('#coPromoApply');
  await expect(page.locator('#coPromoApplied')).toBeVisible();
  await expect(err(page)).toHaveText(/корректный email/);         // still there: not a promo message
});

test('no autofocus on a touch screen; autofocus kept with a mouse', async ({ browser, page }) => {
  await open(page);
  await openLocal(page);
  await expect(page.locator('#coEmail')).toBeFocused();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: test.info().project.use.baseURL });
  const touch = await ctx.newPage();
  await open(touch);
  const b = touch.locator('#localGrid .plan .js-buy').first();
  await expect(b).toBeVisible();
  await b.tap();
  await expect(touch.locator('#checkoutModal')).toBeVisible();
  await touch.waitForTimeout(200);
  expect(await touch.evaluate(() => document.activeElement && document.activeElement.id)).not.toBe('coEmail');
  await ctx.close();
});

test('on a short screen the pay button is in view when the window opens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page);
  await openLocal(page);
  const box = await page.locator('#coPay').boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(568);
  expect(box.y).toBeGreaterThanOrEqual(0);
});

test('the plans do not move when the jump bar appears', async ({ page }) => {
  await open(page, '/esim/peru/', { liveDelayMs: 1500 });
  const before = await page.locator('#tariffs').evaluate((e) => e.getBoundingClientRect().top + scrollY);
  await expect(page.locator('.cp-jump')).toBeVisible();
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
  const after = await page.locator('#tariffs').evaluate((e) => e.getBoundingClientRect().top + scrollY);
  expect(after).toBe(before);
});

test('«Найти тариф» on a country page scrolls to its plans and keeps its href', async ({ page }) => {
  await open(page);
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
  const cta = page.locator('.hdr-cta');
  await expect(cta).toHaveAttribute('href', '/#plans');
  test.skip(!(await cta.isVisible()), 'the header hides this button on the narrowest screens');
  await cta.click();
  await expect(page).toHaveURL(/\/esim\/turkey\/(\?|$)/);
  // The first plan block's heading ends up in view, below the sticky jump bar.
  await expect.poll(() => page.evaluate(() => {
    const h = document.querySelector('#tariffs .plan-block:not([hidden]) h2').getBoundingClientRect();
    const bar = document.querySelector('.cp-jump').getBoundingClientRect();
    return h.top >= bar.bottom - 1 && h.bottom <= innerHeight && scrollY > 0;
  })).toBe(true);
});

test('tariff_buy_click: a daily plan carries no tariff_type, a local one says local', async ({ page }) => {
  const st = await open(page);
  await expect(page.locator('#dailyGrid .js-buy').first()).toBeVisible();
  await page.locator('#dailyGrid .js-buy').first().click();
  await page.click('#checkoutClose');
  await page.locator('#localGrid .js-buy').first().click();
  const buys = st.goals.filter((g) => g.name === 'tariff_buy_click');
  expect(buys).toHaveLength(2);
  expect(buys[0].params.tariff_type).toBeUndefined();
  expect(buys[1].params.tariff_type).toBe('local');
});

test('the failed-payment page does not claim the money was not taken', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'payment-failed.html'), 'utf8');
  expect(html).not.toContain('Средства не списаны');
  expect(html).toContain('Если деньги всё же списались, напишите нам');
});
