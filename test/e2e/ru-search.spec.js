'use strict';

/*
 * Conversion stage 2, PR B — the destination search in a real browser, on the
 * home and on /esim/: cities / resorts / English names / case forms find the
 * country, a region shows its countries (and never jumps anywhere), nothing
 * found shows the popular destinations, and search_no_result is reported ONCE
 * per such query, with no parameters (never the text). Nothing leaves the
 * machine; Metrika is a recording stub.
 */

const { test, expect } = require('@playwright/test');

// The Russian home is the Russian browser's «/»: any other browser language is sent on by assets/lang-route.js
// (owner, 2026-10-23; test/e2e/lang-route.spec.js covers that).
test.use({ locale: 'ru-RU' });

async function open(page, url) {
  const st = { goals: [], nonGet: 0 };
  await page.exposeBinding('__ym', (src, args) => st.goals.push(args));
  await page.addInitScript(() => {
    window.ym = function () { const a = [].slice.call(arguments); if (a[1] === 'reachGoal') window.__ym(a.slice(2)); };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    if (route.request().method() !== 'GET') { st.nonGet += 1; return route.abort(); }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto(url);
  return st;
}
const noResultGoals = (st) => st.goals.filter((g) => g[0] === 'search_no_result');

test.describe('home', () => {
  test('«Бали» → Индонезия, labelled with the place; Enter opens the country page', async ({ page }) => {
    await open(page, '/');
    await page.fill('#q', 'Бали');
    const first = page.locator('#results a.res').first();
    await expect(first).toContainText('Индонезия');
    await expect(first.locator('.res-via')).toHaveText('Бали');
    await page.press('#q', 'Enter');
    await expect(page).toHaveURL(/\/esim\/indonesia\/$/);
  });

  test('case forms and English: «в Турцию», «в Египте», «Thailand», «Шри Ланка»', async ({ page }) => {
    await open(page, '/');
    for (const [q, name] of [['в Турцию', 'Турция'], ['в Египте', 'Египет'], ['Thailand', 'Таиланд'], ['Шри Ланка', 'Шри-Ланка'], ['Анталья', 'Турция'], ['Дубай', 'ОАЭ']]) {
      await page.fill('#q', q);
      await expect(page.locator('#results a.res').first(), q).toContainText(name);
    }
  });

  test('a region lists its countries without promising the region, and Enter stays put', async ({ page }) => {
    await open(page, '/');
    await page.fill('#q', 'в Европу');
    await expect(page.locator('#results .note').first()).toHaveText(/^Европа — популярные направления\. Выберите первую страну поездки: на её странице есть и тарифы на несколько стран, если они её покрывают\.$/);
    await expect(page.locator('#results a.res')).toHaveCount(16);
    await expect(page.locator('#results a.res', { hasText: 'Италия' })).toBeVisible();
    await page.press('#q', 'Enter');
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    for (const q of ['Азия', 'Балканы', 'Скандинавия', 'Африка', 'Латинская Америка', 'весь мир']) {
      await page.fill('#q', q);
      await expect(page.locator('#results .note').first(), q).toContainText('популярные направления');
      expect(await page.locator('#results a.res').count(), q).toBeGreaterThanOrEqual(4);
    }
  });

  test('nothing found: the popular destinations, and search_no_result once, with no parameters', async ({ page }) => {
    const st = await open(page, '/');
    await page.fill('#q', 'xyzqw');
    await expect(page.locator('#results .note').first()).toContainText('Такого направления нет');
    await expect(page.locator('#results a.res')).toHaveCount(8);
    await expect.poll(() => noResultGoals(st).length, { timeout: 4000 }).toBe(1);
    await page.press('#q', 'Enter');                       // the same streak: not twice
    await page.waitForTimeout(300);
    expect(noResultGoals(st)).toEqual([['search_no_result']]);
    await page.fill('#q', 'Турция');                       // a hit ends the streak…
    await page.fill('#q', 'qqqqq');                        // …so a new empty query counts again
    await page.press('#q', 'Enter');
    expect(noResultGoals(st).length).toBe(2);
    expect(st.goals.flat().join(' ')).not.toMatch(/xyzqw|qqqqq/);
    expect(st.nonGet).toBe(0);
  });

  test('a short query that finds nothing is not reported while typing', async ({ page }) => {
    const st = await open(page, '/');
    await page.fill('#q', 'zz');
    await page.waitForTimeout(1800);
    expect(noResultGoals(st)).toEqual([]);
  });
});

test.describe('/esim/', () => {
  test('«Анталья» leaves Турция; «Thailand» works here too', async ({ page }) => {
    await open(page, '/esim/');
    await page.fill('#hubSearch', 'Анталья');
    await expect(page.locator('#hubList li:not([hidden])')).toHaveCount(1);
    await expect(page.locator('#hubList li:not([hidden])')).toContainText('Турция');
    await page.fill('#hubSearch', 'Thailand');
    await expect(page.locator('#hubList li:not([hidden])')).toContainText('Таиланд');
  });

  test('a region shows its countries and the same careful sentence', async ({ page }) => {
    await open(page, '/esim/');
    await page.fill('#hubSearch', 'Балканы');
    await expect(page.locator('#hubCount')).toHaveText('Балканы — популярные направления. Выберите первую страну поездки: на её странице есть и тарифы на несколько стран, если они её покрывают.');
    expect(await page.locator('#hubList li:not([hidden])').count()).toBeGreaterThanOrEqual(6);
    await expect(page.locator('#hubList li:not([hidden])', { hasText: 'Черногория' })).toBeVisible();
  });

  test('nothing found: the popular destinations show, search_no_result once, no parameters', async ({ page }) => {
    const st = await open(page, '/esim/');
    await page.fill('#hubSearch', 'xyzqw');
    await expect(page.locator('#hubEmpty')).toBeVisible();
    await expect(page.locator('#hubPopular')).toBeVisible();
    await expect(page.locator('#hubCount')).toHaveText('Ничего не нашлось — посмотрите популярные направления.');
    await page.press('#hubSearch', 'Enter');
    await page.waitForTimeout(1800);
    expect(noResultGoals(st)).toEqual([['search_no_result']]);
    await page.click('#hubReset');
    await expect(page.locator('#hubEmpty')).toBeHidden();
    expect(st.nonGet).toBe(0);
  });
});
