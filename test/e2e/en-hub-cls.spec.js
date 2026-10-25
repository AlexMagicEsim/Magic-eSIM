'use strict';

/*
 * The English destinations hub must not move while it loads (2026-10-21).
 *
 * Its search box used to be `hidden` in the markup and unhidden by en/hub.js — a deferred script. When the page painted
 * before the script ran (5–7 loads in 10 in Chromium), the box appeared afterwards and pushed the list (.hub-body) down
 * 74 px: CLS 0.05 at 390/320, 0.03 at 1366. The box is now in the layout from the first paint; without JavaScript
 * en/noscript.css (in <noscript>) hides it.
 *
 * Worst case forced on purpose: en/hub.js is held back 800 ms, so the page certainly paints before it runs. The hub reads
 * no catalogue and calls no API — pinned too, so «with or without the API» is the same page.
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });

async function open(page, { holdHubJs = 0 } = {}) {
  const external = [];
  await page.addInitScript(() => {
    window.__cls = 0; window.__tops = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* no API */ }
    const f = () => { const b = document.querySelector('.hub-body'); if (b) { const y = Math.round(b.getBoundingClientRect().top + window.scrollY); if (window.__tops[window.__tops.length - 1] !== y) window.__tops.push(y); } if (performance.now() < 3000) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => { external.push(route.request().url()); return route.abort(); });
  if (holdHubJs) await page.route(/\/en\/hub\.js/, async (route) => { await new Promise((r) => setTimeout(r, holdHubJs)); return route.continue(); });
  await page.goto('/en/esim/');
  return external;
}

test('the list does not move when the search script arrives late; CLS 0', async ({ page }) => {
  const external = await open(page, { holdHubJs: 800 });
  await expect(page.locator('#hubSearch')).toBeVisible();
  await page.waitForTimeout(1200);   // the held script has arrived and run
  // the load is judged BEFORE any typing: a result count appearing under the box after the visitor types is a reaction
  // to their input, which CLS excludes (hadRecentInput)
  const r = await page.evaluate(() => ({ tops: window.__tops.slice(), cls: window.__cls }));
  expect(r.tops, 'every position .hub-body had, frame by frame, through the load').toHaveLength(1);
  expect(r.cls).toBeLessThan(0.001);
  // and the late script did its job: typing filters
  await page.locator('#hq').fill('thai');
  await expect(page.locator('#hubList li:not([hidden]) a').first()).toContainText('Thailand');
  expect(external, 'the hub calls nothing outside the site — no API, with or without it').toEqual([]);
});

test('a normal load: the search box is there from the first frame, CLS 0', async ({ page }) => {
  await open(page);
  await expect(page.locator('#hubSearch')).toBeVisible();
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => ({ tops: window.__tops, cls: window.__cls }));
  expect(r.tops).toHaveLength(1);
  expect(r.cls).toBeLessThan(0.001);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('no search box that does nothing (noscript.css), the full list', async ({ page }) => {
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
    await page.goto('/en/esim/');
    await expect(page.locator('#hubSearch')).toBeHidden();
    await expect(page.locator('#hubList a')).toHaveCount(199);
  });
});
