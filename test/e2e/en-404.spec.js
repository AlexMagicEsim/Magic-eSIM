'use strict';

/*
 * An unknown page under /en/: the English 404, at 390 and 320 (the projects)
 * and 1366. GitHub Pages answers any missing path with /404.html; the local
 * server does not, so the test serves 404.html for the missing path exactly as
 * Pages would. Metrika is answered locally and recorded: the English branch
 * must never request it, and the Russian branch still must.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PAGE = fs.readFileSync(path.join(__dirname, '..', '..', '404.html'), 'utf8');

async function openMissing(page, url) {
  const metrika = [];
  await page.route('**/mc.yandex.ru/**', (r) => { metrika.push(r.request().url()); return r.fulfill({ status: 204, body: '' }); });
  await page.route((u) => u.pathname === new URL(url, 'http://x').pathname, (r) => r.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body: PAGE }));
  await page.goto(url);
  await page.waitForTimeout(300);
  return metrika;
}

test('an unknown English page: English, links into /en/, no counter, no overflow', async ({ page }) => {
  for (const w of [null, 1366]) {
    if (w) await page.setViewportSize({ width: w, height: 900 });
    for (const url of ['/en/esim/atlantis/', '/en/guides/nope/', '/en/nope']) {
      const metrika = await openMissing(page, url);
      await expect(page.locator('h1')).toHaveText('Page not found');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page).toHaveTitle('Page not found — Magic eSIM');
      const hrefs = await page.locator('#card a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      expect(hrefs).toEqual(['/en/', '/en/esim/']);
      expect(await page.locator('#card').innerText()).not.toMatch(/[А-Яа-яЁё]/);
      expect(metrika, url).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('the Russian 404 is unchanged: Russian, the home link, and the counter', async ({ page }) => {
  const metrika = await openMissing(page, '/esim/atlantis/');
  await expect(page.locator('h1')).toHaveText('Страница не найдена');
  await expect(page.locator('#card a')).toHaveAttribute('href', '/');
  expect(metrika.length).toBeGreaterThan(0);
});

test('a /pay/ path still never reaches the counter', async ({ page }) => {
  const metrika = await openMissing(page, '/pay/not–a–token');
  await expect(page.locator('h1')).toHaveText('Страница не найдена');
  expect(metrika).toEqual([]);
});
