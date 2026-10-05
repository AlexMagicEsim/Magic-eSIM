'use strict';

/*
 * The GLOBAL destination list /en/esim/ after the 2026-10 redesign, at 390
 * and 320 (the projects) and at 1366 (set per test). What it must do:
 *   * keep the payment bar above everything, and stay noindex;
 *   * give a large search that filters the static list in place, with an
 *     honest «no matches» state and a way back;
 *   * group every destination A–Z with jump letters, usable by keyboard;
 *   * work without JavaScript (no dead search box, the full list);
 *   * stay inside its CSP, call no API, overflow nothing, pass axe.
 * Nothing real is touched: the page calls no API, and any /api/ request is
 * answered with an error so it would show up as a failure.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

async function open(page, path = '/en/esim/') {
  const st = { calls: [], csp: [], errors: [] };
  page.on('request', (r) => st.calls.push({ method: r.method(), url: r.url() }));
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text());
    if (m.type() === 'error') st.errors.push(m.text());
  });
  await page.route('**/api/**', (route) => route.fulfill({ status: 500, body: 'the list must not call the API' }));
  await page.goto(path);
  return st;
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const visibleLinks = (page) => page.locator('#hubList li:not([hidden]) a');

test('first screen: payment bar, then the hero and a large search; no overflow, no API, no CSP message', async ({ page }) => {
  for (const w of [null, 1366]) {
    if (w) await page.setViewportSize({ width: w, height: 900 });
    const st = await open(page);
    const bar = await page.locator('#previewNotice').boundingBox();
    const q = page.locator('#hq');
    await expect(q).toBeVisible();
    const box = await q.boundingBox();
    expect(bar.y + bar.height).toBeLessThanOrEqual(box.y);
    expect(box.height).toBeGreaterThanOrEqual(56);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
    await expect(page.locator('h1')).toHaveText('eSIM destinations');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    expect(await noOverflow(page)).toBe(true);
    expect(st.calls.filter((c) => /\/api\//.test(c.url) || c.method !== 'GET')).toEqual([]);
    expect(st.csp).toEqual([]);
    expect(st.errors).toEqual([]);
  }
});

test('every destination link opens a real country page (198, all 200)', async ({ page, request }) => {
  await open(page);
  const hrefs = await page.locator('#hubList a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBe(198);
  expect(new Set(hrefs).size).toBe(198);
  for (const h of hrefs) {
    const r = await request.get(h);
    expect(r.status(), h).toBe(200);
  }
  const pop = await page.locator('.hub-tile').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(pop).toEqual(['/en/esim/thailand/', '/en/esim/turkey/', '/en/esim/uae/', '/en/esim/japan/',
    '/en/esim/usa/', '/en/esim/italy/', '/en/esim/spain/', '/en/esim/united-kingdom/']);
  for (const h of pop) expect(hrefs).toContain(h);
});

test('search: a country is found by name, without accents, and by its code; Enter opens it', async ({ page }) => {
  await open(page);
  await page.locator('#hq').fill('japan');
  await expect(visibleLinks(page)).toHaveCount(1);
  await expect(visibleLinks(page).first()).toHaveAttribute('href', '/en/esim/japan/');
  await expect(page.locator('#hubCount')).toHaveText('1 destination match');
  await expect(page.locator('#hubPopular')).toBeHidden();
  await expect(page.locator('#hubEmpty')).toBeHidden();
  await expect(page.locator('#az-a')).toBeHidden();
  await expect(page.locator('#hubAz')).toBeHidden();

  await page.locator('#hq').fill('aland');
  await expect(visibleLinks(page).first()).toContainText('Åland Islands');
  await page.locator('#hq').fill('reunion');
  await expect(visibleLinks(page).first()).toContainText('Réunion');
  await page.locator('#hq').fill('AE');
  await expect(visibleLinks(page).filter({ hasText: 'United Arab Emirates' })).toHaveCount(1);

  await page.locator('#hq').fill('united');
  expect(await visibleLinks(page).count()).toBeGreaterThanOrEqual(3);
  expect(await noOverflow(page)).toBe(true);

  await page.locator('#hq').fill('thai');
  await page.locator('#hq').press('Enter');
  await expect(page).toHaveURL(/\/en\/esim\/thailand\/$/);
});

test('search with no result: says so, offers the whole list, and gives it back', async ({ page }) => {
  await open(page);
  await page.locator('#hq').fill('zzzz');
  await expect(visibleLinks(page)).toHaveCount(0);
  await expect(page.locator('#hubEmpty')).toBeVisible();
  await expect(page.locator('#hubEmpty')).toContainText('No destination matches that name.');
  await expect(page.locator('#hubCount')).toHaveText('No matches');
  await page.locator('#hq').press('Enter');
  await expect(page).toHaveURL(/\/en\/esim\/$/);
  await page.locator('#hubReset').click();
  await expect(page.locator('#hq')).toBeFocused();
  await expect(page.locator('#hq')).toHaveValue('');
  await expect(visibleLinks(page)).toHaveCount(198);
  await expect(page.locator('#hubEmpty')).toBeHidden();
  await expect(page.locator('#hubPopular')).toBeVisible();
  await expect(page.locator('#hubAz')).toBeVisible();

  await page.locator('#hq').fill('zzzz');
  await page.locator('#hubClear').click();
  await expect(visibleLinks(page)).toHaveCount(198);
  await page.locator('#hq').fill('zzzz');
  await page.locator('#hq').press('Escape');
  await expect(page.locator('#hq')).toHaveValue('');
  await expect(visibleLinks(page)).toHaveCount(198);
});

test('keyboard: Tab from the search reaches the popular tiles, the letters, then the list; a letter jumps', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await open(page);
  await page.locator('#hq').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('.hub-tile').first()).toBeFocused();
  for (let i = 0; i < 8; i += 1) await page.keyboard.press('Tab');
  await expect(page.locator('#hubAz a').first()).toBeFocused();
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  expect(outline).not.toBe('none');
  await page.locator('#hubAz a[href="#az-s"]').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#az-s$/);
  const top = await page.locator('#az-s').boundingBox();
  const az = await page.locator('#hubAz').boundingBox();
  expect(top.y).toBeGreaterThanOrEqual(az.y + az.height - 2);
  await page.keyboard.press('Tab');
  await expect(page.locator('#az-s a').first()).toBeFocused();
});

test('the letters: the whole alphabet is on screen at every width, and a jump does not land under the header', async ({ page }) => {
  for (const w of [null, 1366]) {
    if (w) await page.setViewportSize({ width: w, height: 900 });
    await open(page);
    const vw = page.viewportSize().width;
    for (const el of await page.locator('#hubAz > *').all()) {
      const b = await el.boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(vw);
    }
    await page.locator('#hubAz a[href="#az-m"]').click();
    const header = await page.locator('header.site-header').boundingBox();
    const head = await page.locator('#azh-m').boundingBox();
    expect(head.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    expect(head.y).toBeLessThan(page.viewportSize().height / 2);
    if (vw >= 900) {
      const az = await page.locator('#hubAz').boundingBox();
      expect(az.y).toBeLessThan(120);
      expect(head.y).toBeGreaterThanOrEqual(az.y + az.height - 2);
    }
    expect(await noOverflow(page)).toBe(true);
  }
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('no search box, the full list and the letters', async ({ page }) => {
    await open(page);
    await expect(page.locator('#hubSearch')).toBeHidden();
    await expect(page.locator('#hubList a')).toHaveCount(198);
    await expect(page.locator('#hubAz a').first()).toBeVisible();
    await expect(page.locator('#hubEmpty')).toBeHidden();
    await expect(page.locator('#previewNotice')).toBeVisible();
    await expect(page.locator('.support a[href="mailto:support@magicesim.store"]')).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
  });
});

test.describe('axe on the destination list', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected; the page is unchanged
  const audit = async (page, label) => {
    await page.addScriptTag({ content: AXE });
    const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
      .violations.map((x) => `${x.id} ×${x.nodes.length}`));
    expect(v, label).toEqual([]);
  };
  test('as loaded, with a search, with no result, and at 1366', async ({ page }) => {
    await open(page);
    await audit(page, 'as loaded');
    await page.locator('#hq').fill('united');
    await audit(page, 'searching');
    await page.locator('#hq').fill('zzzz');
    await audit(page, 'no result');
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.locator('#hq').fill('');
    await audit(page, 'desktop');
  });
});
