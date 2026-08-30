'use strict';

/**
 * Layout claims that are only true in a browser.
 *
 * Every one of these was measured by hand once, through a throwaway harness,
 * while fixing a grid item that had no `min-width: 0`. A measurement taken once
 * is not a guard — this is the same measurement, taken on every run.
 *
 * Both viewports come from the two projects in playwright.config.js, so each
 * test here runs at 390x844 and again at 320x568. The narrow one is where the
 * bug lived: the row overflowed its own column by 16px and never reached the
 * viewport, so a check on `document.scrollWidth` reported a clean page.
 */
const { test, expect } = require('@playwright/test');
const {
  installMiniApp, openApp, openSettings, overflowingInside, LONG_EMAIL, RAW_EMAIL,
} = require('./harness');

test.describe('Mini App layout', () => {
  test('the settings screen never scrolls sideways', async ({ page }) => {
    await installMiniApp(page);
    await openApp(page);
    await openSettings(page);

    const sideways = await page.evaluate(() => {
      const d = document.documentElement;

      return d.scrollWidth > d.clientWidth + 1;
    });
    expect(sideways).toBe(false);
  });

  test('nothing on the settings screen overflows its own box', async ({ page }) => {
    await installMiniApp(page);
    await openApp(page);
    await openSettings(page);

    expect(await overflowingInside(page, '#screen-settings')).toEqual([]);
  });

  test('a long address stays inside its card instead of widening the row', async ({ page }) => {
    // The address is the widest unbreakable thing on the screen and the reason
    // the row's automatic minimum was too big. If `min-width: 0` is ever lost
    // from `.settings__row`, this is what says so.
    await installMiniApp(page, { emails: [LONG_EMAIL] });
    await openApp(page);
    await openSettings(page);

    const row = page.locator('#screen-settings .settings__row');
    const box = await row.boundingBox();
    const viewport = page.viewportSize().width;

    expect(box.width).toBeLessThanOrEqual(viewport);
    expect(await overflowingInside(page, '#screen-settings')).toEqual([]);

    // …and it is still readable, which is the whole reason the row exists. It
    // wraps rather than being cut, so the full masked address is present.
    await expect(row.locator('.card__title')).toHaveText(LONG_EMAIL.masked);
  });

  test('the raw address never appears anywhere on the screen', async ({ page }) => {
    await installMiniApp(page, { emails: [LONG_EMAIL] });
    await openApp(page);
    await openSettings(page);

    await expect(page.locator('#screen-settings')).not.toContainText(RAW_EMAIL);
  });

  test('the language control fits, and both of its options are tappable', async ({ page }) => {
    await installMiniApp(page);
    await openApp(page);
    await openSettings(page);

    const options = page.locator('#settings-language [data-lang]');
    await expect(options).toHaveCount(2);

    for (const box of await options.evaluateAll((ns) => ns.map((n) => {
      const r = n.getBoundingClientRect();

      return { w: r.width, h: r.height };
    }))) {
      expect(box.w).toBeGreaterThan(0);
      // The 44px tap floor the design system sets for a control.
      expect(box.h).toBeGreaterThanOrEqual(44);
    }
  });
});
