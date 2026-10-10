'use strict';

/*
 * The Russian country pages, the /esim/ list and the guides on the shared
 * design system (RU↔EN design parity, PR 2), in a real browser at 390 and 320
 * (the projects) and at desktop width. The catalogue is the committed snapshot
 * (assets/catalog.json) served as the live API; Metrika is answered locally.
 * Nothing is bought: the «Выбрать тариф» link only leads to the landing.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8'));

async function open(page, url) {
  const st = { nonGet: 0, errors: [] };
  page.on('pageerror', (e) => st.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') st.errors.push(m.text()); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const req = route.request();
    if (req.method() !== 'GET') { st.nonGet += 1; return route.abort(); }
    if (/\/api\/v1\/retail\/packages/.test(req.url())) {
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ status: 'success', data: CATALOG.packages }) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto(url);
  return st;
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
async function axeViolations(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
    .violations.map((v) => `${v.id}: ${v.nodes.length}`));
}

test('country page: daily, local, regional — in that order, folded at six, with jump links', async ({ page }) => {
  const st = await open(page, '/esim/turkey/');
  await expect(page.locator('#dailyGrid .plan').first()).toBeVisible();
  const order = await page.evaluate(() => [...document.querySelectorAll('.plan-block:not([hidden])')].map((s) => s.id));
  expect(order).toEqual(['dailyBlock', 'localBlock', 'regionalBlock']);
  // Fold: 6 shown, the rest behind one button that opens them all.
  const daily = page.locator('#dailyGrid > .plan');
  const total = await daily.count();
  expect(total).toBeGreaterThan(6);
  expect(await page.locator('#dailyGrid > .plan:not([hidden])').count()).toBe(6);
  const more = page.locator('#dailyBlock .plan-more');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  expect(await page.locator('#dailyGrid > .plan:not([hidden])').count()).toBe(total);
  // Jump links: one per non-empty block, with its count.
  await expect(page.locator('.cp-jump')).toBeVisible();
  await expect(page.locator('.cp-jump a[href="#dailyBlock"] .n')).toHaveText(String(total));
  expect(await noOverflow(page)).toBe(true);
  expect(st.errors).toEqual([]);
  expect(st.nonGet).toBe(0);
});

test('country page: choosing a term moves the price, the term chip and the buy button', async ({ page }) => {
  await open(page, '/esim/turkey/');
  const card = page.locator('#dailyGrid .daily-card').filter({ has: page.locator('.js-daily-term:nth-child(2)') }).first();
  const second = card.locator('.js-daily-term').nth(1);
  const days = await second.getAttribute('data-days');
  const price = await second.getAttribute('data-price');
  await second.click();
  await expect(second).toHaveAttribute('aria-checked', 'true');
  await expect(card.locator('.js-daily-days')).toContainText(days);
  expect((await card.locator('.js-daily-price').textContent()).replace(/\D/g, '')).toBe(price);
  await expect(card.locator('.js-buy')).toHaveAttribute('data-days', days);
  await expect(card.locator('.js-buy')).toHaveAttribute('data-price', price);
  // Since PR B the button opens the checkout on this page (test/e2e/ru-checkout.spec.js).
  await expect(card.locator('.js-buy')).toHaveText('Купить');
  expect(await card.locator('.js-buy').evaluate((b) => b.tagName)).toBe('BUTTON');
});

test('country page: «Покрытие и условия» opens the window and closes it', async ({ page }) => {
  await open(page, '/esim/turkey/');
  const btn = page.locator('#localGrid .plan .js-coverage').first();
  await btn.click();
  await expect(page.locator('#coverageModal')).toBeVisible();
  await expect(page.locator('#covStart')).not.toHaveText('—');
  await page.locator('#coverageClose').click();
  await expect(page.locator('#coverageModal')).toBeHidden();
});

test('country page: one primary button per card, the rest is quiet', async ({ page }) => {
  await open(page, '/esim/thailand/');
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
  const counts = await page.evaluate(() => [...document.querySelectorAll('.plan')].slice(0, 20)
    .map((c) => c.querySelectorAll('.btn:not(.btn-ghost)').length));
  expect(counts.every((n) => n === 1)).toBe(true);
});

test('/esim/: search filters the list in place, and an empty result says so', async ({ page }) => {
  const st = await open(page, '/esim/');
  const input = page.locator('#hubSearch');
  await expect(input).toBeVisible();
  await expect(input).toHaveClass(/ym-hide-content/);
  await input.fill('тур');
  await expect(page.locator('#hubList li:not([hidden])')).toHaveCount(await page.locator('#hubList li[data-name*="тур"]').count());
  await expect(page.locator('#hubPopular')).toBeHidden();
  await input.fill('zzzz');
  await expect(page.locator('#hubEmpty')).toBeVisible();
  await page.locator('#hubReset').click();
  await expect(page.locator('#hubEmpty')).toBeHidden();
  expect(await page.locator('#hubList li:not([hidden])').count()).toBeGreaterThanOrEqual(190);
  // Every row keeps its numbers: tariffs and the floor price.
  await expect(page.locator('#hubList li[data-slug="turkey"] .dest-meta')).toContainText(/тариф.* · от .*₽/);
  expect(await noOverflow(page)).toBe(true);
  expect(st.errors).toEqual([]);
});

test('guides: «На этой странице» anchors every section, nothing overflows', async ({ page }) => {
  for (const url of ['/iphone.html', '/esim/payment-rubles/']) {
    const st = await open(page, url);
    const ids = await page.evaluate(() => [...document.querySelectorAll('.g-toc a')].map((a) => a.getAttribute('href').slice(1)));
    expect(ids.length).toBeGreaterThan(2);
    for (const id of ids) expect(await page.locator(`#${id}`).count()).toBe(1);
    expect(await noOverflow(page)).toBe(true);
    expect(st.errors).toEqual([]);
  }
});

test('the mobile menu opens and carries the same links as the desktop bar', async ({ page }) => {
  await open(page, '/esim/turkey/');
  const w = page.viewportSize().width;
  if (w >= 900) return;
  await page.locator('.mnav > summary').click();
  const links = await page.locator('.mnav-panel a').allTextContents();
  // The English menu's four items, in Russian (RU↔EN migration PR C), then English.
  expect(links).toEqual(['Направления', 'Как это работает', 'Проверка устройства', 'Инструкции', 'English']);
});

test.describe('axe on the Russian pages', () => {
  for (const url of ['/esim/turkey/', '/esim/', '/iphone.html', '/esim/payment-rubles/']) {
    test(`axe: ${url}`, async ({ page }) => {
      await open(page, url);
      if (url === '/esim/turkey/') await expect(page.locator('#localGrid .plan').first()).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });
  }
});

test.describe('desktop width', () => {
  test.use({ viewport: { width: 1366, height: 900 } });
  test('country page and list at 1366: three columns of plans, no overflow, axe clean', async ({ page }) => {
    await open(page, '/esim/turkey/');
    await expect(page.locator('#localGrid .plan').first()).toBeVisible();
    const cols = await page.evaluate(() => getComputedStyle(document.getElementById('localGrid')).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(3);
    expect(await noOverflow(page)).toBe(true);
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('the service pages', () => {
  for (const url of ['/payment-failed.html', '/payment-success.html', '/privacy.html', '/terms.html']) {
    test(`${url}: axe 0, no overflow, the shared chrome`, async ({ page }) => {
      const st = await open(page, url);
      await expect(page.locator('header.site-header')).toBeVisible();
      await expect(page.locator('footer.site-footer')).toBeAttached();
      expect(await noOverflow(page)).toBe(true);
      expect(await axeViolations(page)).toEqual([]);
      expect(st.errors).toEqual([]);
      expect(st.nonGet).toBe(0);
    });
  }
});

test('country page: the checkout window opened from a card passes axe and fits the screen', async ({ page }) => {
  const st = await open(page, '/esim/turkey/');
  await page.locator('#localGrid .plan .js-buy').first().click();
  await expect(page.locator('#checkoutModal')).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  expect(await axeViolations(page)).toEqual([]);
  expect(st.nonGet).toBe(0);
});
