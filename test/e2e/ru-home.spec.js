'use strict';

/*
 * The Russian home as the Russian localisation of /en/ (RU↔EN migration PR C),
 * in a real browser at 390 and 320 (the projects) and at desktop width. The home
 * reads no catalogue: a search over a static list and eight tiles lead to the
 * country pages, where the plans and the checkout are. Metrika is answered
 * locally; every non-GET request is aborted and counted, and the count must
 * stay 0. The country page's checkout is opened and inspected, never submitted.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8'));

async function open(page, url = '/') {
  const st = { nonGet: 0, errors: [], goals: [], apiReads: 0 };
  page.on('pageerror', (e) => st.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') st.errors.push(m.text()); });
  // Goals survive the navigation a tile or a result makes.
  await page.exposeBinding('__goal', (src, g) => st.goals.push(g));
  await page.addInitScript(() => {
    // Count reachGoal calls without letting tag.js load: the counter stub
    // keeps the inline snippet's ym() from ever reaching Yandex.
    window.ym = function (id, kind, name) { if (kind === 'reachGoal') window.__goal(name); };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const req = route.request();
    if (req.method() !== 'GET') { st.nonGet += 1; return route.abort(); }
    if (/\/api\/v1\//.test(req.url())) {
      st.apiReads += 1;
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

test('the hero: one search, the Mini App second, the measured wording, no catalogue read', async ({ page }) => {
  const st = await open(page);
  await expect(page.locator('h1')).toHaveText('Интернет в путешествии без роуминга');
  await expect(page.locator('.hero .lead')).toContainText('190+ направлений');
  await expect(page.locator('#q')).toHaveClass(/ym-hide-content/);
  await expect(page.locator('#qGo')).toHaveText('Найти тарифы');
  await expect(page.locator('.hero-tg__btn')).toHaveAttribute('href', 'https://t.me/magicesim_bot?startapp');
  await expect(page.locator('.quick a')).toHaveCount(6);
  await expect(page.locator('#popular .dest-tile')).toHaveCount(8);
  expect(await noOverflow(page)).toBe(true);
  await page.waitForLoadState('networkidle');
  expect(st.apiReads).toBe(0);
  expect(st.errors).toEqual([]);
  expect(st.nonGet).toBe(0);
});

test('search finds a country in Russian, in Latin and by code, and Enter opens its page', async ({ page }) => {
  const st = await open(page);
  const q = page.locator('#q');
  await q.fill('турц');
  await expect(page.locator('#results a.res').first()).toHaveText('Турция');
  await q.fill('turkey');
  await expect(page.locator('#results a.res').first()).toHaveText('Турция');
  await q.fill('ae');
  await expect(page.locator('#results a.res').first()).toHaveAttribute('href', '/esim/uae/');
  await q.fill('корея');
  await expect(page.locator('#results a.res').first()).toHaveText('Южная Корея');
  await q.fill('атлантида');
  await expect(page.locator('#results .note')).toContainText('Такого направления нет');
  await expect(page.locator('#results .note a')).toHaveAttribute('href', '/esim/');
  await q.fill('Турция');
  await q.press('Enter');
  await expect(page).toHaveURL(/\/esim\/turkey\/$/);
  await expect(page.locator('#localGrid .plan .js-buy').first()).toBeVisible();
  expect(st.goals).toContain('country_search');
  expect(st.nonGet).toBe(0);
});

test('«Найти тарифы» with nothing typed puts the caret in the search', async ({ page }) => {
  await open(page);
  await page.locator('#qGo').click();
  await expect(page.locator('#q')).toBeFocused();
  await expect(page).toHaveURL(/\/$/);
});

test('a popular tile opens that country\'s page; the existing goal fires', async ({ page }) => {
  const st = await open(page);
  const tile = page.locator('#popular a.dest-tile').nth(1);
  const href = await tile.getAttribute('href');
  await tile.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.locator('#localGrid .plan, #dailyGrid .plan').first()).toBeVisible();
  expect(st.goals).toContain('popular_country_click');
  expect(st.goals).not.toContain('regional_country_click');
});

test('old links keep working: /?country=XX and the old anchors', async ({ page }) => {
  await open(page, '/?country=TR&utm_source=old');
  await expect(page).toHaveURL(/\/esim\/turkey\/$/);
  // The visit's first touch was captured on the home, before the hop.
  const attr = await page.evaluate(() => JSON.parse(sessionStorage.getItem('magic_attr') || '{}'));
  expect(attr).toMatchObject({ entry: '/', utm_source: 'old' });

  await page.goto('/?country=ZZ');
  await expect(page).toHaveURL(/\/\?country=ZZ$/);            // an unknown code leaves the home as it is
  // Each one a fresh load, as a link from outside would be.
  for (const [from, to] of [['#global-pricing', '#plans'], ['#solution', '#how'], ['#install-guides-section', '#guides']]) {
    await page.goto('about:blank');
    await page.goto('/' + from);
    await expect(page).toHaveURL(new RegExp(`/${to}$`));
    await expect(page.locator(to)).toBeInViewport();
  }
});

test('the mobile menu carries the English menu\'s four items, in Russian, and English', async ({ page }) => {
  await open(page);
  if (page.viewportSize().width >= 900) return;
  await page.locator('.mnav > summary').click();
  expect(await page.locator('.mnav-panel a').allTextContents())
    .toEqual(['Направления', 'Как это работает', 'Проверка устройства', 'Инструкции', 'English']);
  await expect(page.locator('.hdr-cta')).toHaveAttribute('href', '/#plans');
});

test('the FAQ opens, and its question set is the FAQPage\'s', async ({ page }) => {
  await open(page);
  const items = page.locator('#faq details');
  expect(await items.count()).toBeGreaterThanOrEqual(5);
  await items.first().locator('summary').click();
  await expect(items.first()).toHaveAttribute('open', '');
});

test.describe('axe on the home', () => {
  test('first screen, the search results and the open FAQ', async ({ page }) => {
    await open(page);
    expect(await axeViolations(page)).toEqual([]);
    await page.locator('#q').fill('ита');
    await expect(page.locator('#results a.res').first()).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    await page.locator('#faq details summary').first().click();
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('desktop width', () => {
  test.use({ viewport: { width: 1366, height: 900 } });
  test('the home at 1366: the Data Pass beside the copy, the English grid, no overflow', async ({ page }) => {
    await open(page);
    await expect(page.locator('.hero-art')).toBeVisible();
    await expect(page.locator('.dp-title')).toHaveText('Пропуск в интернет');
    expect(await noOverflow(page)).toBe(true);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('the Russian and English homes lay out the same blocks the same way', async ({ page }) => {
    const grid = () => page.evaluate(() => {
      const cols = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).gridTemplateColumns.split(' ').length : 0; };
      const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; };
      return { hero: cols('.hero-grid'), tiles: cols('.dest-grid'), steps: cols('.steps-grid'), types: cols('.types'), guides: cols('.guide-grid'),
        search: box('.search-card'), heroArt: box('.hero-art'), support: box('.support-band') };
    });
    await open(page, '/en/');
    const en = await grid();
    await page.goto('/');
    const ru = await grid();
    expect(ru).toEqual(en);
  });
});

/* ---- the country page it leads to: the checkout window, inspected, not sent -- */

test.describe('the country page the home leads to', () => {
  test('«Купить» opens the Platega checkout with the card\'s plan and price; nothing is sent', async ({ page }) => {
    const st = await open(page, '/esim/turkey/');
    const card = page.locator('#localGrid .plan').first();
    await expect(card).toBeVisible();
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

  test('«Покрытие и условия» opens its window', async ({ page }) => {
    await open(page, '/esim/turkey/');
    await page.locator('#localGrid .plan .js-coverage').first().click();
    await expect(page.locator('#coverageModal')).toBeVisible();
    await page.locator('#coverageClose').click();
    await expect(page.locator('#coverageModal')).toBeHidden();
  });
});
