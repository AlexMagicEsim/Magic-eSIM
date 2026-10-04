'use strict';

/*
 * The English guides (/en/guides/), in a real browser at 390 and 320: they
 * render, they fit, they are reachable from the English pages, and they make
 * no request beyond their own stylesheet and icons — a guide runs no script.
 */

const { test, expect } = require('@playwright/test');

const GUIDES = [
  ['iphone', 'How to install an eSIM on iPhone', '/iphone.html'],
  ['android', 'How to install an eSIM on Android', '/android.html'],
  ['compatibility', 'Does your phone support eSIM?', '/esim/compatibility/'],
  ['activation', 'When to install and turn on your eSIM', '/esim/activation-before-travel/'],
  ['troubleshooting', 'eSIM not working — what to check', '/esim/not-working/'],
];

async function visit(page, path) {
  const calls = [];
  page.on('request', (r) => calls.push({ method: r.method(), url: r.url(), type: r.resourceType() }));
  await page.route('**/api/**', (route) => route.fulfill({ status: 500, body: 'a guide must not call the API' }));
  await page.goto(path);
  return calls;
}

for (const [slug, h1, ru] of GUIDES) {
  test(`guide «${slug}» renders in English, fits the screen and calls nothing`, async ({ page }) => {
    const calls = await visit(page, `/en/guides/${slug}/`);
    await expect(page.locator('h1')).toHaveText(h1);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(7, 9, 16)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    await expect(page.locator('a.langsw')).toHaveAttribute('href', ru);
    expect(calls.filter((c) => c.type === 'script' || c.type === 'fetch' || c.type === 'xhr')).toEqual([]);
    expect(calls.filter((c) => !['GET', 'HEAD'].includes(c.method))).toEqual([]);
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/[А-Яа-яЁё]{3,}|₽/);
    // The FAQ opens.
    const first = page.locator('#faq details').first();
    await first.locator('summary').click();
    await expect(first.locator('p')).toBeVisible();
  });
}

test('the guide list links all five, and is reachable from the home and a country page', async ({ page }) => {
  await visit(page, '/en/guides/');
  await expect(page.locator('.guides a')).toHaveCount(5);
  await page.goto('/en/index.html');
  await expect(page.locator('header nav a', { hasText: 'Guides' })).toHaveAttribute('href', '/en/guides/');
  await expect(page.locator('#compat a[href="/en/guides/iphone/"]')).toHaveCount(1);
  await page.goto('/en/esim/uae/');
  await page.locator('header nav a', { hasText: 'Guides' }).click();
  await expect(page).toHaveURL(/\/en\/guides\/$/);
  await page.locator('.guides a', { hasText: 'iPhone' }).click();
  await expect(page.locator('h1')).toHaveText('How to install an eSIM on iPhone');
});
