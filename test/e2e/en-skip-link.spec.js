'use strict';

/*
 * «Skip to main content» on every English page type, in a real browser at
 * 390 and 320 (the projects) and 1366:
 *   - hidden (off-screen) until it has keyboard focus;
 *   - the FIRST Tab stop, and fully visible while focused, above the sticky header;
 *   - Enter moves focus to <main>, and the next Tab lands inside it;
 *   - no horizontal scroll, no CSP violation, no console error;
 *   - the same without JavaScript;
 *   - the checkout dialog still keeps Tab inside (the link is not reachable there);
 *   - axe clean with the link focused;
 *   - the English 404 has no header to skip: its first Tab is already in <main>.
 * Static half: seo/test-en-skip-link.mjs.
 * SKIP_SHOTS=<dir> also writes a screenshot of every focused state.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const NOT_FOUND = fs.readFileSync(path.join(__dirname, '..', '..', '404.html'), 'utf8');
const SHOTS = process.env.SKIP_SHOTS || '';

const PRIMARY = 'https://esim-backend-3wmu.onrender.com';
const PAGES = [
  ['home', '/en/'],
  ['destinations', '/en/esim/'],
  ['country', '/en/esim/japan/'],
  ['guides', '/en/guides/'],
  ['guide-iphone', '/en/guides/iphone/'],
  ['guide-android', '/en/guides/android/'],
  ['guide-compatibility', '/en/guides/compatibility/'],
  ['guide-activation', '/en/guides/activation/'],
  ['guide-troubleshooting', '/en/guides/troubleshooting/'],
];

const base = { coverage_country_codes: ['JP'], country_code: 'JP', region: 'JP', currency: 'USD', plan_type: 'FIXED_VOLUME' };
const CATALOGUE = JSON.stringify({ status: 'success', market: 'global', currency: 'USD', data: [
  { ...base, package_id: '11111111-0000-4000-8000-000000000001', name: 'Japan 3GB 15Days', data_gb: 3, validity_days: 15, price: 4.99 },
  { ...base, package_id: '11111111-0000-4000-8000-000000000002', name: 'Japan 10GB 30Days', data_gb: 10, validity_days: 30, price: 11.99 },
] });

async function prepare(page) {
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(String(e)));
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(PRIMARY) && /\/api\/v1\/retail\/packages\?market=global$/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: CATALOGUE });
    }
    if (url.startsWith(PRIMARY)) return route.fulfill({ status: 500, body: 'unexpected' });
    return route.continue();
  });
  return problems;
}

const box = (page) => page.locator('a.skip').evaluate((a) => {
  const r = a.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vh: innerHeight, vw: innerWidth };
});
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

async function checkFirstTab(page, label, width) {
  const skip = page.locator('a.skip');
  await expect(skip).toHaveCount(1);
  await expect(skip).toHaveText('Skip to main content');
  await expect(skip).toHaveAttribute('href', '#main');
  const hidden = await box(page);
  expect(hidden.bottom, `${label}: off-screen before focus`).toBeLessThanOrEqual(0);
  expect(await noHorizontalScroll(page), `${label}: no overflow`).toBe(true);

  await page.keyboard.press('Tab');
  await expect(skip, `${label}: the first Tab stop`).toBeFocused();
  await page.waitForTimeout(250);   // the reveal transition
  const shown = await box(page);
  expect(shown.top, `${label}: visible`).toBeGreaterThanOrEqual(0);
  expect(shown.bottom).toBeLessThanOrEqual(shown.vh);
  expect(shown.left).toBeGreaterThanOrEqual(0);
  expect(shown.right).toBeLessThanOrEqual(shown.vw);
  // On top: the element at its centre is the link itself, not the sticky header.
  expect(await skip.evaluate((a) => {
    const r = a.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === a;
  }), `${label}: above the header`).toBe(true);
  expect(await noHorizontalScroll(page), `${label}: no overflow while focused`).toBe(true);
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `${label}-${width}.png`) });
  }

  await page.keyboard.press('Enter');
  await expect(page.locator('main#main'), `${label}: Enter moves focus to <main>`).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('main')), `${label}: next Tab is inside <main>`).toBe(true);
  await page.waitForTimeout(250);   // the hide transition
  expect((await box(page)).bottom, `${label}: hidden again`).toBeLessThanOrEqual(0);
}

for (const [name, url] of PAGES) {
  test(`${name}: the skip link is the first Tab stop, visible on focus, and lands in <main>`, async ({ page }, info) => {
    const problems = await prepare(page);
    const widths = [page.viewportSize().width, 1366];
    for (const w of widths) {
      if (w === 1366) await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await checkFirstTab(page, name, w);
    }
    expect(problems, `${name}: console / CSP`).toEqual([]);
    void info;
  });
}

test('no JavaScript: the skip link still appears on the first Tab and moves focus to <main>', async ({ browser }, info) => {
  const viewport = info.project.use.viewport;
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport });
  const page = await ctx.newPage();
  for (const [name, url] of PAGES) {
    await page.goto(url);
    const skip = page.locator('a.skip');
    await page.keyboard.press('Tab');
    await expect(skip, `${name}: first Tab without JS`).toBeFocused();
    await page.waitForTimeout(250);
    const b = await box(page);
    expect(b.top, name).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Enter');
    await expect(page, name).toHaveURL(/#main$/);
    await expect(page.locator('main#main'), name).toBeFocused();
  }
  await ctx.close();
});

test('checkout: while the dialog is open Tab stays inside it — the skip link is not reachable', async ({ page }) => {
  const problems = await prepare(page);
  await page.goto('/en/esim/japan/');
  const opener = page.locator('#localGrid .card').first().getByRole('button');
  await opener.focus();
  await opener.press('Enter');
  await expect(page.locator('#checkout')).toBeVisible();
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#checkout .modal'))).toBe(true);
    expect(await page.evaluate(() => document.activeElement.classList.contains('skip'))).toBe(false);
  }
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#checkout .modal'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  expect(problems).toEqual([]);
});

test('the English 404 has no header to skip: the first Tab is already inside <main>', async ({ page }) => {
  for (const w of [null, 1366]) {
    if (w) await page.setViewportSize({ width: w, height: 900 });
    await page.route((u) => u.pathname === '/en/nope/', (r) => r.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body: NOT_FOUND }));
    await page.goto('/en/nope/');
    await expect(page.locator('h1')).toHaveText('Page not found');
    await expect(page.locator('a.skip')).toHaveCount(0);
    expect(await page.locator('body a, body button').first().evaluate((el) => !!el.closest('main'))).toBe(true);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('main'))).toBe(true);
  }
});

test.describe('axe with the skip link focused', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected; the pages are unchanged
  for (const [name, url] of PAGES) {
    test(`axe: ${name}`, async ({ page }) => {
      await prepare(page);
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await page.keyboard.press('Tab');
      await expect(page.locator('a.skip')).toBeFocused();
      await page.waitForTimeout(250);
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
        .violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`));
      expect(v, name).toEqual([]);
    });
  }
});
