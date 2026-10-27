'use strict';

/*
 * The country flags as a browser draws them — in Chromium (Android, Telegram on
 * Android, Chrome and Edge on the desktop) and, through the `webkit-flags`
 * project, in WebKit (Safari on macOS and iOS, Telegram on iOS).
 *
 *   - all 199 files under assets/flags decode and are not blank;
 *   - the seven repaired in 2026-10 draw what the minified copies had lost:
 *     the stars of New Zealand, Honduras and Curaçao, China's and
 *     Guinea-Bissau's and Grenada's stars in their real shape, Guatemala's
 *     emblem. Each threshold sits between the broken file and the original in
 *     BOTH engines (measured 2026-10-19), so the old files fail here;
 *   - every flag on the RU and EN home, catalogue and a country page loads and
 *     keeps its 4:3 box, on a phone and on a 1366 px desktop.
 * Nothing leaves the machine: every request to another host is aborted.
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'assets', 'flags');
const CODES = fs.readdirSync(DIR).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort();

async function offline(page) {
  await page.addInitScript(() => { window.ym = function () {}; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
}

/** Counts the pixels of one colour class inside a box of the 640×480 drawing. */
function countIn(page, code, box, cls) {
  return page.evaluate(async ({ code, box, cls }) => {
    const img = new Image();
    img.src = `/assets/flags/${code}.svg`;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = 640; cv.height = 480;
    const x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 640, 480);
    x.drawImage(img, 0, 0, 640, 480);
    const [x0, y0, x1, y1] = box;
    const d = x.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    const is = {
      red: (r, g, b) => r > 150 && g < 90 && b < 110,
      blue: (r, g, b) => b > 150 && r < 120,
      white: (r, g, b) => r > 220 && g > 220 && b > 220,
      yellow: (r, g, b) => r > 200 && g > 200 && b < 90,
      gold: (r, g, b) => r > 200 && g > 170 && b < 80,
      black: (r, g, b) => r < 60 && g < 60 && b < 60,
      grey: (r, g, b) => Math.abs(r - g) < 25 && Math.abs(g - b) < 25 && r < 200 && r > 40,
    }[cls];
    let n = 0;
    for (let k = 0; k < d.length; k += 4) if (is(d[k], d[k + 1], d[k + 2])) n++;
    return n;
  }, { code, box, cls });
}

test('all 199 flags decode and are not blank', async ({ page }) => {
  await offline(page);
  await page.goto('/assets/flags/LICENSE.txt');
  const bad = await page.evaluate(async (codes) => {
    const out = [];
    for (const c of codes) {
      try {
        const img = new Image();
        img.src = `/assets/flags/${c}.svg`;
        await img.decode();
        const cv = document.createElement('canvas');
        cv.width = 64; cv.height = 48;
        const x = cv.getContext('2d');
        x.drawImage(img, 0, 0, 64, 48);
        const d = x.getImageData(0, 0, 64, 48).data;
        const colours = new Set();
        for (let k = 0; k < d.length; k += 16) colours.add(`${d[k] >> 4},${d[k + 1] >> 4},${d[k + 2] >> 4},${d[k + 3] >> 6}`);
        if (colours.size < 2) out.push(`${c}: blank`);
      } catch (e) { out.push(`${c}: ${e.message}`); }
    }
    return out;
  }, CODES);
  expect(CODES.length).toBe(199);
  expect(bad).toEqual([]);
});

// [code, box in the 640×480 drawing, colour, min, max] — broken → original, Chromium / WebKit:
const FEATURES = [
  ['nz', [320, 0, 640, 480], 'red', 1500, Infinity],      // 0 → 1959 / 1953: the four red stars
  ['hn', [0, 160, 640, 320], 'blue', 3000, Infinity],     // 0 → 3732 / 3754: the five stars
  ['cw', [0, 0, 320, 240], 'white', 3500, Infinity],      // 0 → 4337 / 4329: the two stars
  ['cn', [0, 0, 320, 240], 'yellow', 7500, 9500],         // 11550 → 8386 / 8395: five stars, not five blobs
  ['gw', [0, 0, 213, 480], 'black', 6300, 8000],          // 10034 → 7137 / 7130: the star
  ['gd', [0, 0, 640, 80], 'gold', 8000, 10100],           // 10724 → 9447 / 8952: the three upper stars
  ['gt', [213, 120, 427, 360], 'grey', 940, 1200],        // 787 → 1018 / 1073: rifles and swords of the emblem
];

for (const [code, box, cls, min, max] of FEATURES) {
  test(`${code}: draws what the original draws`, async ({ page }) => {
    await offline(page);
    await page.goto('/assets/flags/LICENSE.txt');
    const n = await countIn(page, code, box, cls);
    expect(n, `${code} ${cls} pixels`).toBeGreaterThanOrEqual(min);
    expect(n, `${code} ${cls} pixels`).toBeLessThanOrEqual(max);
  });
}

const SURFACES = ['/', '/esim/', '/esim/china/', '/en/', '/en/esim/', '/en/esim/china/'];

async function flagsOn(page) {
  return page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('img[src*="/assets/flags/"]')];
    const srcs = [...new Set(imgs.map((i) => i.getAttribute('src')))];
    // Loaded as images, not fetched: the EN pages' CSP says connect-src 'none'.
    const missing = [];
    for (const s of srcs) {
      try { const im = new Image(); im.src = s; await im.decode(); } catch (e) { missing.push(s); }
    }
    // The phone mock on the home draws its flags as round avatars on purpose
    // (.dp-flags); every other flag on the site is a 4:3 rectangle.
    const shown = imgs.filter((i) => i.offsetParent && i.getBoundingClientRect().width > 0 && !i.closest('.dp-flags'));
    const notLoaded = [];
    for (const i of shown) {
      const r = i.getBoundingClientRect();
      if (r.top > innerHeight || r.bottom < 0) continue; // a lazy image below the fold loads when reached
      if (!i.complete || !i.naturalWidth) notLoaded.push(i.getAttribute('src'));
    }
    const notFourThree = shown.filter((i) => {
      const r = i.getBoundingClientRect();
      return Math.abs(r.width / r.height - 4 / 3) > 0.04;
    }).map((i) => `${i.getAttribute('src')} ${Math.round(i.getBoundingClientRect().width)}×${Math.round(i.getBoundingClientRect().height)}`);
    return { count: imgs.length, missing, notLoaded, notFourThree: [...new Set(notFourThree)] };
  });
}

for (const url of SURFACES) {
  // «/» is the RUSSIAN home only for a Russian browser: with the default en-US locale assets/lang-route.js moves the
  // visit to /en/ from <head> — this test then measured /en/, and WebKit now and then never settled goto()'s «load» on
  // the superseded «/» (CI 2026-10-27, 30-s timeout). The Russian home is tested as a Russian browser sees it.
  test.describe(url === '/' ? 'the Russian home' : url, () => {
  if (url === '/') test.use({ locale: 'ru-RU' });
  for (const width of [null, 1366]) {
    test(`${url}${width ? ' at 1366 px' : ''}: every flag loads and keeps 4:3`, async ({ page }) => {
      await offline(page);
      if (width) await page.setViewportSize({ width, height: 900 });
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => [...document.querySelectorAll('img[src*="/assets/flags/"]')]
        .filter((i) => i.offsetParent).every((i) => i.loading === 'lazy' || i.complete));
      const r = await flagsOn(page);
      expect(r.count).toBeGreaterThan(0);
      expect(r.missing).toEqual([]);
      expect(r.notLoaded).toEqual([]);
      expect(r.notFourThree).toEqual([]);
      if (url === '/') expect(new URL(page.url()).pathname, 'measured the Russian home itself').toBe('/');
    });
  }
  });
}

test.describe('the Russian home (a Russian browser: assets/lang-route.js sends any other on)', () => {
  test.use({ locale: 'ru-RU' });
  test('the home search shows China with the repaired flag', async ({ page }) => {
    await offline(page);
    await page.goto('/');
    await page.fill('#q', 'Китай');
    const img = page.locator('#results a.res img').first();
    await expect(img).toHaveAttribute('src', '/assets/flags/cn.svg');
    await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
  });
});
