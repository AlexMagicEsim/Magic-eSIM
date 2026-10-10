'use strict';

/*
 * The Russian landing on the shared design system (RU↔EN design parity, PR 3),
 * in a real browser at 390 and 320 (the projects) and at desktop width. The
 * catalogue is the committed snapshot served as the live API; Metrika is
 * answered locally. The checkout is opened and inspected, never submitted:
 * every non-GET request is aborted and counted, and the count must stay 0.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8'));

async function open(page) {
  const st = { nonGet: 0, errors: [], goals: [] };
  page.on('pageerror', (e) => st.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') st.errors.push(m.text()); });
  await page.addInitScript(() => {
    window.__goals = [];
    // Count reachGoal calls without letting tag.js load: the counter stub below
    // keeps the inline snippet's ym() from ever reaching Yandex.
    window.ym = function (id, kind, name) { if (kind === 'reachGoal') window.__goals.push(name); };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const req = route.request();
    if (req.method() !== 'GET') { st.nonGet += 1; return route.abort(); }
    if (/\/api\/v1\/retail\/packages/.test(req.url())) {
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ status: 'success', data: CATALOG.packages }) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto('/');
  return st;
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
async function axeViolations(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
    .violations.map((v) => `${v.id}: ${v.nodes.length}`));
}
async function pickTurkey(page) {
  await page.locator('#destScroller .dest-card[data-country="TR"]').click();
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
}

test('the hero: one search, the Telegram entry second, the measured wording, no overflow', async ({ page }) => {
  const st = await open(page);
  await expect(page.locator('h1')).toHaveText('Интернет в путешествии без роуминга');
  await expect(page.locator('.hero .lead')).toContainText('190+ направлений');
  await expect(page.locator('#packageSearch')).toHaveClass(/ym-hide-content/);
  await expect(page.locator('.hero-tg__btn')).toHaveAttribute('href', 'https://t.me/magicesim_bot?startapp');
  expect(await noOverflow(page)).toBe(true);
  expect(st.errors).toEqual([]);
});

test('search opens the catalogue for the country typed', async ({ page }) => {
  await open(page);
  await page.locator('#packageSearch').fill('Турция');
  await page.locator('#packageSearchButton').click();
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
  await expect(page.locator('#localHead')).toHaveText('Тарифы для Турции');
});

test('a popular tile selects the country: local, daily, regional — folded at six, the goal fires', async ({ page }) => {
  const st = await open(page);
  await pickTurkey(page);
  const order = await page.evaluate(() => [...document.querySelectorAll('#global-pricing .plan-block:not([hidden])')].map((s) => s.id));
  expect(order).toEqual(['localBlock', 'dailyBlock', 'regionalBlock']);
  const daily = page.locator('#dailyGrid > .plan');
  const total = await daily.count();
  expect(total).toBeGreaterThan(6);
  expect(await page.locator('#dailyGrid > .plan:not([hidden])').count()).toBe(6);
  await page.locator('#dailyBlock .plan-more').click();
  expect(await page.locator('#dailyGrid > .plan:not([hidden])').count()).toBe(total);
  expect(await page.evaluate(() => window.__goals)).toContain('popular_country_click');
  expect(await noOverflow(page)).toBe(true);
  expect(st.errors).toEqual([]);
  expect(st.nonGet).toBe(0);
});

test('a daily term moves the card\'s price and what «Купить» will send', async ({ page }) => {
  await open(page);
  await pickTurkey(page);
  const card = page.locator('#dailyGrid .daily-card').filter({ has: page.locator('.js-daily-term:nth-child(2)') }).first();
  const second = card.locator('.js-daily-term').nth(1);
  const days = await second.getAttribute('data-days');
  const price = await second.getAttribute('data-price');
  await second.click();
  expect((await card.locator('.js-daily-price').textContent()).replace(/\D/g, '')).toBe(price);
  await expect(card.locator('.js-buy')).toHaveAttribute('data-days', days);
  await expect(card.locator('.js-buy')).toHaveAttribute('data-price', price);
  await expect(card.locator('.js-buy')).toHaveText('Купить');
});

test('«Купить» opens the Platega checkout with the card\'s plan and price; nothing is sent', async ({ page }) => {
  const st = await open(page);
  await pickTurkey(page);
  const card = page.locator('#localGrid .plan').first();
  const price = (await card.locator('.package-price').textContent()).replace(/\D/g, '');
  await card.locator('.js-buy').click();
  await expect(page.locator('#checkoutModal')).toBeVisible();
  expect((await page.locator('#coPrice').textContent()).replace(/\D/g, '')).toBe(price);
  await expect(page.locator('#coMethodCard')).toContainText('Российская карта');
  await page.locator('#coMethodCard').click();
  await expect(page.locator('#coMethodCard')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#coPayLabel')).not.toHaveText('Оплатить по СБП');
  await expect(page.locator('#coEmail')).toHaveClass(/ym-hide-content/);
  await expect(page.locator('#coPromoInput')).toHaveClass(/ym-hide-content/);
  await expect(page.locator('.checkout-note')).toContainText('Оплата через Platega');
  // «Российская карта» stays inside its button at every width (§30, 320 px).
  const inside = await page.evaluate(() => { const b = document.getElementById('coMethodCard').getBoundingClientRect();
    return [...document.querySelectorAll('#coMethodCard span, #coMethodCard img')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= b.left - 1 && r.right <= b.right + 1; }); });
  expect(inside).toBe(true);
  await page.locator('#checkoutClose').click();
  await expect(page.locator('#checkoutModal')).toBeHidden();
  expect(st.nonGet).toBe(0);
});

test('«Покрытие и условия» on the landing opens its window', async ({ page }) => {
  await open(page);
  await pickTurkey(page);
  await page.locator('#localGrid .plan .js-coverage').first().click();
  await expect(page.locator('#coverageModal')).toBeVisible();
  await page.locator('#coverageClose').click();
  await expect(page.locator('#coverageModal')).toBeHidden();
});

test('the mobile menu carries the Russian links and English', async ({ page }) => {
  await open(page);
  if (page.viewportSize().width >= 900) return;
  await page.locator('.mnav > summary').click();
  expect(await page.locator('.mnav-panel a').allTextContents())
    .toEqual(['Направления', 'Как это работает', 'Совместимость', 'Инструкции', 'Telegram', 'English']);
});

test.describe('axe on the landing', () => {
  test('first screen, the opened catalogue and the checkout window', async ({ page }) => {
    await open(page);
    expect(await axeViolations(page)).toEqual([]);
    await pickTurkey(page);
    expect(await axeViolations(page)).toEqual([]);
    await page.locator('#localGrid .plan .js-buy').first().click();
    await expect(page.locator('#checkoutModal')).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('desktop width', () => {
  test.use({ viewport: { width: 1366, height: 900 } });
  test('the landing at 1366: the Data Pass beside the copy, three plan columns, no overflow', async ({ page }) => {
    await open(page);
    await expect(page.locator('.hero-art')).toBeVisible();
    await expect(page.locator('.dp-title')).toHaveText('Пропуск в интернет');
    await pickTurkey(page);
    const cols = await page.evaluate(() => getComputedStyle(document.getElementById('localGrid')).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(3);
    expect(await noOverflow(page)).toBe(true);
    expect(await axeViolations(page)).toEqual([]);
  });
});
