'use strict';

/*
 * The GLOBAL home after the 2026-10 redesign, in a real browser at 390 and
 * 320 (the projects) and at desktop width (set per test). What it must do:
 *   * say it sells nothing — the payment bar — before anything purchasable,
 *     with the full wording one click away;
 *   * make the destination search the main action, by mouse AND keyboard;
 *   * work as a storefront at every width: no overflow, a real mobile menu;
 *   * stay inside its CSP, call no API, load its own font and flags;
 *   * pass axe (WCAG A/AA) in every state a visitor can reach.
 * Nothing real is touched: the home calls no API, and any /api/ request is
 * answered with an error so it would show up as a failure.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const WIDTHS = [[1366, 900], [390, 844], [320, 640]];

async function open(page, path = '/en/') {
  const st = { calls: [], csp: [], errors: [] };
  page.on('request', (r) => st.calls.push({ method: r.method(), url: r.url(), type: r.resourceType() }));
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text());
    if (m.type() === 'error') st.errors.push(m.text());
  });
  await page.route('**/api/**', (route) => route.fulfill({ status: 500, body: 'the home must not call the API' }));
  await page.goto(path);
  return st;
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const isMobile = (page) => page.viewportSize().width < 900;

test('first screen: the payment bar under the header, then the hero search — at the visitor\'s width', async ({ page }) => {
  await open(page);
  const bar = page.locator('#previewNotice');
  await expect(bar).toBeVisible();
  await expect(bar.locator('summary')).toContainText("Online payment isn't available yet — plans can't be bought here yet");
  const header = await page.locator('header.site-header').boundingBox();
  const barBox = await bar.boundingBox();
  const search = await page.locator('#q').boundingBox();
  expect(barBox.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(search.y);
  // Compact: a short strip, not a card that owns the first screen.
  expect(barBox.height).toBeLessThan(isMobile(page) ? 90 : 50);
  await expect(page.locator('#q')).toBeInViewport();
  await expect(page.locator('#qGo')).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});

test('«What this means» opens the full wording, by click and by keyboard', async ({ page }) => {
  await open(page);
  const full = page.locator('#previewNotice details > p');
  await expect(full).toBeHidden();
  await page.locator('#previewNotice summary').click();
  await expect(full).toBeVisible();
  await expect(full).toHaveText("You can browse plans, get an exact price in US dollars and go through checkout, but payment can't be taken yet: nothing is charged, and no order or eSIM is created.");
  await page.locator('#previewNotice summary').focus();
  await page.keyboard.press('Enter');
  await expect(full).toBeHidden();
  await page.keyboard.press('Space');
  await expect(full).toBeVisible();
});

test('search by keyboard: type, arrow into the results, Enter opens the country', async ({ page }) => {
  await open(page);
  await page.locator('#q').focus();
  await page.keyboard.type('jap');
  const first = page.locator('#results a.res').first();
  await expect(first).toHaveText('Japan');
  await expect(first.locator('img.flag')).toHaveAttribute('src', '/en/flags/jp.svg');
  await page.keyboard.press('ArrowDown');
  await expect(first).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#q')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/en\/esim\/japan\/$/);
});

test('«Find plans»: with a name it opens the best match, with nothing typed it puts the caret in the search', async ({ page }) => {
  await open(page);
  await page.locator('#qGo').click();
  await expect(page.locator('#q')).toBeFocused();
  await expect(page).toHaveURL(/\/en\/$/);
  await page.locator('#q').fill('thai');
  await page.locator('#qGo').click();
  await expect(page).toHaveURL(/\/en\/esim\/thailand\/$/);
});

test('an unknown name says so, and Enter goes nowhere', async ({ page }) => {
  await open(page);
  await page.locator('#q').fill('zzzz');
  await expect(page.locator('#results')).toContainText('No destination matches that name.');
  await page.locator('#q').press('Enter');
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator('#q')).toBeFocused();
});

test('keyboard order: skip nothing, trap nothing — logo, menu, search, button, popular', async ({ page }) => {
  await open(page);
  await page.locator('body').focus();
  const seen = [];
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => {
      const a = document.activeElement;
      return a.id || a.getAttribute('href') || (a.tagName === 'SUMMARY' ? `summary:${a.closest('[id]') ? a.closest('[id]').id : a.parentElement.className}` : a.tagName);
    }));
  }
  expect(seen[0]).toBe('/en/');
  const q = seen.indexOf('q');
  expect(q).toBeGreaterThan(0);
  expect(seen[q + 1]).toBe('qGo');
  expect(seen.slice(q + 2)).toContain('/en/esim/thailand/');
  expect(seen.indexOf('summary:previewNotice')).toBeLessThan(q);
  if (isMobile(page)) expect(seen).toContain('summary:mnav');
  else expect(seen).toEqual(expect.arrayContaining(['/en/esim/', '/en/#how', '/en/#compat', '/en/guides/']));
});

test('the mobile menu opens from the keyboard and leads to every section', async ({ page }) => {
  test.skip(!isMobile(page), 'the menu exists below 900 px');
  await open(page);
  await expect(page.locator('nav.nav')).toBeHidden();
  const summary = page.locator('.mnav summary');
  await expect(summary).toHaveAttribute('aria-label', 'Menu');
  await summary.focus();
  await page.keyboard.press('Enter');
  const panel = page.locator('.mnav-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('a')).toHaveText(['Destinations', 'How it works', 'Device check', 'Guides', 'Русский']);
  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  await panel.locator('a', { hasText: 'Guides' }).click();
  await expect(page).toHaveURL(/\/en\/guides\/$/);
});

test('desktop: four header links, the language switch and «Find a plan» in one row', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await open(page);
  await expect(page.locator('.mnav')).toBeHidden();
  await expect(page.locator('nav.nav a')).toHaveText(['Destinations', 'How it works', 'Device check', 'Guides']);
  await expect(page.locator('a.langsw')).toHaveAttribute('href', '/');
  await expect(page.locator('a.langsw')).toHaveAttribute('hreflang', 'ru');
  const tops = await page.locator('header .hdr > *').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(20);
  await page.locator('.hdr-cta').click();
  await expect(page.locator('#plans')).toBeInViewport();
});

test('popular destinations: eight real pages with their flags drawn', async ({ page }) => {
  await open(page);
  const tiles = page.locator('.dest-tile');
  await expect(tiles).toHaveCount(8);
  await tiles.first().scrollIntoViewIfNeeded();
  const drawn = await page.locator('.dest-tile img.flag').evaluateAll((imgs) => Promise.all(imgs.map((i) => (i.complete ? i : new Promise((r) => { i.onload = i.onerror = () => r(i); })))).then((all) => all.map((i) => i.naturalWidth > 0)));
  expect(drawn).toEqual(Array(8).fill(true));
  await tiles.filter({ hasText: 'Japan' }).click();
  await expect(page).toHaveURL(/\/en\/esim\/japan\/$/);
});

test('the sections a visitor scrolls to are all there', async ({ page }) => {
  await open(page);
  for (const id of ['popular', 'how', 'plan-types', 'compat', 'guides', 'support']) {
    await expect(page.locator(`#${id} h2`)).toBeVisible();
  }
  await expect(page.locator('#how .step')).toHaveCount(4);
  await expect(page.locator('#plan-types .type h3')).toHaveText(['Plans for one country', 'Regional plans', 'Data every day']);
  await expect(page.locator('#guides .guide-card')).toHaveCount(5);
  await expect(page.locator('#support a[href="mailto:support@magicesim.store"]')).toBeVisible();
});

for (const [w, h] of WIDTHS) {
  test(`${w}px: nothing overflows, Inter is the font, and the page stays inside its CSP with no API call`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const st = await open(page);
    await page.evaluate(() => document.fonts.ready);
    expect(await noOverflow(page)).toBe(true);
    const wide = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width && (r.right > window.innerWidth + 1 || r.left < -1) && !e.closest('.hero-art');
    }).map((e) => e.className || e.tagName).slice(0, 5));
    expect(wide).toEqual([]);
    expect(await page.evaluate(() => [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Inter' && f.status === 'loaded'))).toBe(true);
    expect(st.csp).toEqual([]);
    expect(st.errors).toEqual([]);
    expect(st.calls.filter((c) => /\/api\//.test(c.url))).toEqual([]);
    expect(st.calls.filter((c) => !c.url.startsWith('http://127.0.0.1') && !c.url.startsWith('http://localhost'))).toEqual([]);
    expect(st.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });
}

test('without JavaScript: the bar, the popular destinations and a way to every country', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 640 } });
  const page = await ctx.newPage();
  await page.goto('/en/');
  await expect(page.locator('#previewNotice summary')).toContainText("Online payment isn't available yet");
  await expect(page.locator('.nojs-search a[href="/en/esim/"]')).toBeVisible();
  await expect(page.locator('.dest-tile')).toHaveCount(8);
  await page.locator('.mnav summary').click();
  await expect(page.locator('.mnav-panel')).toBeVisible();
  await ctx.close();
});

test.describe('axe on the home', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected; the page is unchanged
  const audit = async (page, label) => {
    await page.addScriptTag({ content: AXE });
    const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
      .violations.map((x) => `${x.id} ×${x.nodes.length}`));
    expect(v, label).toEqual([]);
  };
  test('closed, with the bar open, with results, and with the menu open', async ({ page }) => {
    await open(page);
    await audit(page, 'as loaded');
    await page.locator('#previewNotice summary').click();
    await page.locator('#q').fill('un');
    await expect(page.locator('#results a.res').first()).toBeVisible();
    await audit(page, 'bar open, results shown');
    if (isMobile(page)) {
      await page.locator('.mnav summary').click();
      await audit(page, 'menu open');
    }
  });
  test('desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await open(page);
    await audit(page, 'desktop');
  });
});
