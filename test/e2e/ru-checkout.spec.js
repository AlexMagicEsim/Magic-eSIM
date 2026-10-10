'use strict';

/*
 * The Russian checkout (assets/ru-checkout.js), driven in a real browser on a
 * country page — where it opens since RU↔EN migration PR B (the home lost its
 * catalogue and checkout in PR C). It pins what the checkout SENDS and DECIDES,
 * so moving it (PR A, B, C) cannot change the payment flow unseen:
 *   - the order body: package, term, email, terms, method, promo, idempotency
 *     key, attribution — and nothing else;
 *   - the idempotency rule: the same intent keeps its key across a retry (and
 *     across the fallback road), a changed intent gets a new one;
 *   - the promo quote body; a typed-but-unapplied promo and a missing consent
 *     are refused before anything is sent;
 *   - a card shown from the cached catalogue is confirmed against the live API,
 *     and a price change is shown before paying;
 *   - the hand-off to Platega.
 * Nothing leaves the machine: the API is answered here, the Platega page is a
 * stub, Metrika is stubbed. No real order, no real payment.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8'));
const PATH = '/esim/turkey/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function open(page, opts = {}) {
  const st = { posts: [], liveAllowed: !opts.liveFails, orderCalls: 0, platega: [], goals: [] };
  await page.exposeBinding('__goal', (src, g) => st.goals.push(g));
  await page.addInitScript(() => { window.ym = function (id, kind, goal) { if (kind === 'reachGoal') window.__goal(goal); }; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const req = route.request(); const url = new URL(req.url());
    const cors = { 'access-control-allow-origin': '*' };
    if (/platega\.io$/.test(url.host)) { st.platega.push(url.href); return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }); }
    if (url.pathname === '/api/v1/retail/packages') {
      if (!st.liveAllowed) return route.abort();
      const data = opts.liveFails ? CATALOG.packages.map((p) => ({ ...p, price: p.price + 50 })) : CATALOG.packages;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ status: 'success', data }) });
    }
    if (req.method() === 'POST') {
      st.posts.push({ host: url.host, path: url.pathname, body: JSON.parse(req.postData() || 'null') });
      if (url.pathname === '/api/v1/retail/promo/quote') {
        return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ valid: true, code: 'WELCOME10', discount: 35, final: 315, original: 350 }) });
      }
      if (url.pathname === '/api/v1/public/retail-orders') {
        st.orderCalls += 1;
        if (st.orderCalls <= (opts.orderFails || 0)) return route.fulfill({ status: 503, contentType: 'application/json', headers: cors, body: '{"error":"TEMP"}' });
        return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ redirect_url: 'https://pay.platega.io/e2e-stub', public_order_token: 'E2eFakeToken_abcdefghijklmnop123456' }) });
      }
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto(opts.path || PATH);
  return st;
}
const orders = (st) => st.posts.filter((p) => p.path === '/api/v1/public/retail-orders');
// The country page renders its own country's plans; nothing to pick.
async function pickTurkey(page) {
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
}
async function openFirstLocal(page) {
  const btn = page.locator('#localGrid .plan .js-buy').first();
  const pkg = await btn.getAttribute('data-package-id');
  await btn.click();
  await expect(page.locator('#checkoutModal')).toBeVisible();
  return pkg;
}
async function fill(page, email = 'buyer@example.com') {
  await page.locator('#coEmail').fill(email);
  await page.locator('#coConsent').check();
}

test('SBP: one order body, exactly these fields, then the hand-off to Platega', async ({ page }) => {
  const st = await open(page);
  await pickTurkey(page);
  const pkg = await openFirstLocal(page);
  await fill(page, '  Buyer@Example.com ');
  await page.locator('#coPay').click();
  await expect.poll(() => st.platega.length).toBeGreaterThan(0);
  const [o] = orders(st);
  expect(Object.keys(o.body).sort()).toEqual(['attribution', 'email', 'idempotency_key', 'package_id', 'payment_type', 'termsAccepted']);
  expect(o.body).toMatchObject({ package_id: pkg, email: 'Buyer@Example.com', termsAccepted: true, payment_type: 'sbp' });
  expect(o.body.idempotency_key).toMatch(UUID);
  expect(o.body.attribution).toEqual({ entry: PATH });
  expect(st.platega[0]).toBe('https://pay.platega.io/e2e-stub');
  for (const g of ['country_tariff_click', 'tariff_buy_click', 'checkout_open', 'payment_sbp_click', 'payment_redirect']) expect(st.goals).toContain(g);
  expect(page.url()).not.toContain('?country=');              // no hop to the home
});

test('card + promo: the quote body, then an order with the code only — the server prices it', async ({ page }) => {
  const st = await open(page);
  await pickTurkey(page);
  const pkg = await openFirstLocal(page);
  await fill(page);
  await page.locator('#coMethodCard').click();
  await page.locator('#coPromoInput').fill('welcome10');
  await page.locator('#coPromoApply').click();
  await expect.poll(() => st.goals).toContain('promo_apply_success');
  await page.locator('#coPay').click();
  await expect.poll(() => st.platega.length).toBeGreaterThan(0);
  const quote = st.posts.find((p) => p.path === '/api/v1/retail/promo/quote');
  expect(quote.body).toEqual({ promo_code: 'WELCOME10', package_id: pkg, payment_type: 'card', email: 'buyer@example.com' });
  const [o] = orders(st);
  expect(o.body).toMatchObject({ package_id: pkg, payment_type: 'card', promo_code: 'WELCOME10' });
  expect(o.body).not.toHaveProperty('price');
  expect(o.body).not.toHaveProperty('amount');
});

test('a daily plan carries the chosen term, and only that', async ({ page }) => {
  const st = await open(page);
  await pickTurkey(page);
  const card = page.locator('#dailyGrid .daily-card').filter({ has: page.locator('.js-daily-term:nth-child(2)') }).first();
  const second = card.locator('.js-daily-term').nth(1);
  const days = await second.getAttribute('data-days');
  await second.click();
  await card.locator('.js-buy').click();
  await fill(page);
  await page.locator('#coPay').click();
  await expect.poll(() => st.platega.length).toBeGreaterThan(0);
  expect(orders(st)[0].body.days).toBe(days);
});

test('the same intent keeps its key across both roads and a retry', async ({ page }) => {
  const st = await open(page, { orderFails: 2 });
  await pickTurkey(page);
  await openFirstLocal(page);
  await fill(page);
  await page.locator('#coPay').click();                       // primary 503 → fallback 503
  await expect.poll(() => orders(st).length).toBe(2);
  await expect(page.locator('#coError')).toBeVisible();
  await page.locator('#coPay').click();                       // same intent → same key
  await expect.poll(() => st.platega.length).toBeGreaterThan(0);
  const keys = orders(st).map((o) => o.body.idempotency_key);
  expect(new Set(keys).size).toBe(1);
  expect(new Set(orders(st).map((o) => o.host)).size).toBe(2);  // both roads were used
});

test('a changed intent (another payment method) gets a new key', async ({ page }) => {
  const st2 = await open(page, { orderFails: 2 });
  await pickTurkey(page);
  await openFirstLocal(page);
  await fill(page);
  await page.locator('#coPay').click();
  await expect.poll(() => orders(st2).length).toBe(2);
  await page.locator('#coMethodCard').click();                 // a different intent
  await page.locator('#coPay').click();
  await expect.poll(() => st2.platega.length).toBeGreaterThan(0);
  const k = orders(st2).map((o) => o.body.idempotency_key);
  expect(k[0]).toBe(k[1]);
  expect(k[2]).not.toBe(k[0]);
});

test('a typed but unapplied promo, and a missing consent, are refused before anything is sent', async ({ page }) => {
  const st = await open(page);
  await pickTurkey(page);
  await openFirstLocal(page);
  await page.locator('#coEmail').fill('buyer@example.com');
  await page.locator('#coPay').click();
  await expect(page.locator('#coError')).toContainText('согласие');
  await page.locator('#coConsent').check();
  await page.locator('#coPromoInput').fill('WELCOME10');
  await page.locator('#coPay').click();
  await expect(page.locator('#coError')).toContainText('Промокод введён, но не применён');
  expect(orders(st)).toEqual([]);
});

test('a card from the cached catalogue is confirmed against the live API, and a price change is shown', async ({ page }) => {
  test.setTimeout(60_000);
  const st = await open(page, { liveFails: true });
  await page.waitForTimeout(9000);                             // every live retry fails: the cards come from the cache
  await pickTurkey(page);
  const btn = page.locator('#localGrid .plan .js-buy').first();
  const cached = Number(await btn.getAttribute('data-price'));
  st.liveAllowed = true;                                       // the network is back for the confirmation
  await btn.click();
  await expect(page.locator('#checkoutModal')).toBeVisible();
  await expect(page.locator('#coPrice')).toHaveText(`${(cached + 50).toLocaleString('ru-RU')} ₽`);
  await expect(page.locator('#coError')).toContainText('Цена этого тарифа изменилась');
  expect(orders(st)).toEqual([]);
});

/* ---- the window works at any depth ---------------------------------------- */

test('the payment icons load on a country page (absolute paths)', async ({ page }) => {
  await open(page);
  await page.locator('#localGrid .plan .js-buy').first().click();
  await page.locator('#coMethodCard').click();
  const ok = await page.evaluate(() => [...document.querySelectorAll('#checkoutModal img.pay-ico')].every((i) => i.complete && i.naturalWidth > 0));
  expect(ok).toBe(true);
});

test('the home opens no checkout: it links to the country page, which does', async ({ page }) => {
  const st = await open(page, { path: '/' });
  await expect(page.locator('#checkoutModal')).toHaveCount(0);
  await page.locator('#popular a.dest-tile[data-country="TR"]').click();
  await expect(page).toHaveURL(/\/esim\/turkey\/$/);
  await expect(page.locator('#localGrid .plan .js-buy').first()).toBeVisible();
  expect(st.posts).toEqual([]);
});
