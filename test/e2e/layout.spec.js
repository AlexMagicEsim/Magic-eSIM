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
  installMiniApp, openApp, openSettings, overflowingInside,
  LONG_EMAIL, RAW_EMAIL, ESIM, PACKAGE,
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

/**
 * The same width claims, in English.
 *
 * English is not a translation of Russian's length. "Coverage and conditions"
 * is longer than «Покрытие и условия»; "Exits to the internet in" is nearly
 * twice «Выход в интернет»; and the 320px floor has no slack to give. A layout
 * proved at 320 in Russian is not proved at 320 in English, so it is proved
 * again rather than assumed.
 */
test.describe('Mini App layout, in English', () => {
  const english = (page, extra) => installMiniApp(page, Object.assign({
    languageCode: 'en', emails: [], esims: [ESIM], packages: [PACKAGE],
  }, extra || {}));

  test('the home screen never scrolls sideways', async ({ page }) => {
    await english(page);
    await openApp(page);

    const sideways = await page.evaluate(() => {
      const d = document.documentElement;

      return d.scrollWidth > d.clientWidth + 1;
    });
    expect(sideways).toBe(false);
    expect(await overflowingInside(page, '#screen-home')).toEqual([]);
  });

  test('the tab bar fits four English labels', async ({ page }) => {
    // The narrowest thing on the screen with the most words on it.
    await english(page);
    await openApp(page);

    expect(await overflowingInside(page, '.tabbar')).toEqual([]);
    const tabs = page.locator('.tabbar .tab');
    await expect(tabs).toHaveCount(4);
  });

  test('the settings screen holds together with a long address', async ({ page }) => {
    await english(page, { emails: [LONG_EMAIL] });
    await openApp(page);
    await openSettings(page);

    const row = page.locator('#screen-settings .settings__row');
    const box = await row.boundingBox();
    expect(box.width).toBeLessThanOrEqual(page.viewportSize().width);
    expect(await overflowingInside(page, '#screen-settings')).toEqual([]);
  });

  test('My eSIMs, where the numbers and their labels compete for one line', async ({ page }) => {
    await english(page);
    await openApp(page);
    await page.locator('.tab').nth(2).click();
    await page.locator('#screen-esims[data-active]').waitFor();
    await page.waitForTimeout(400);

    expect(await overflowingInside(page, '#screen-esims')).toEqual([]);
  });

  test('the help screen with every answer open', async ({ page }) => {
    await english(page);
    await openApp(page);
    await page.locator('.tab').nth(3).click();
    await page.locator('#screen-help[data-active]').waitFor();
    for (const d of await page.locator('#screen-help details').all()) {
      await d.evaluate((n) => { n.open = true; });
    }

    expect(await overflowingInside(page, '#screen-help')).toEqual([]);
  });
});

/**
 * The payment pickers, at both viewports.
 *
 * WHY THIS EXISTS. On 2026-09-01 the card label was changed from «Карта» to
 * «Российская карта» — a correctness fix, because Platega takes Russian-issued
 * cards only and the short label invited a foreign-card holder to pick it and
 * fail at the payment page. The label is three times longer, and on the PUBLIC
 * checkout it was then drawn 13px OUTSIDE its own button at 320px: the МИР logo
 * is 60px, the text could not shrink, and `.co-method` sets no overflow, so the
 * label spilled past the rounded border rather than clipping.
 *
 * It shipped. This suite already ran at 320x568 and would have caught it, but
 * every case in it was about Settings, Home, the tab bar, My eSIMs and Help —
 * nothing had ever rendered a payment control. That gap is what these close.
 */
test.describe('payment pickers fit the buttons they are drawn in', () => {
  test('the Mini App purchase picker holds its labels', async ({ page }) => {
    await installMiniApp(page);
    await openApp(page);

    // The screens are all present and toggled with [data-active], so the
    // checkout can be shown without walking a purchase.
    await page.evaluate(() => {
      document.querySelectorAll('[id^=screen-]').forEach((s) => s.removeAttribute('data-active'));
      document.getElementById('screen-checkout').setAttribute('data-active', '');
    });

    expect(await overflowingInside(page, '#checkout-methods')).toEqual([]);

    // Equal height, whether or not the longer label wraps. A picker where one
    // option is taller than the other reads as one of them being selected.
    const heights = await page.$$eval('#checkout-methods .segmented__opt',
      (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(heights.length).toBe(2);
    expect(heights[0]).toBe(heights[1]);
  });

  test('the public checkout picker holds its labels', async ({ page }) => {
    await page.goto('/index.html');

    // The overlay is revealed by clearing `hidden`, not by walking a purchase.
    // Opening it for real needs the catalogue API, which these tests do not
    // reach — and the method buttons are STATIC markup, so what is being
    // measured does not depend on any tariff being loaded. Nothing else is
    // overridden: no widths, no styles, no display.
    await page.waitForSelector('#checkoutModal', { state: 'attached', timeout: 15_000 });
    await page.evaluate(() => {
      document.getElementById('checkoutModal').hidden = false;
    });
    await page.waitForSelector('#coMethodCard', { state: 'visible', timeout: 15_000 });

    // THE REGRESSION, asserted directly: the label must be inside its button.
    // `overflowingInside` alone would not have caught it — the spill escaped the
    // button without ever reaching the viewport.
    const spill = await page.$$eval('.co-method', (els) => els.map((b) => {
      const span = b.querySelector('span');
      return {
        label: span.textContent.trim(),
        overflow: b.scrollWidth - b.clientWidth,
        spill: Math.round(span.getBoundingClientRect().right - b.getBoundingClientRect().right),
      };
    }));

    for (const m of spill) {
      expect(m.overflow, `«${m.label}» overflows its button by ${m.overflow}px`).toBeLessThanOrEqual(1);
      expect(m.spill, `«${m.label}» is drawn ${m.spill}px outside its button`).toBeLessThanOrEqual(0);
    }

    const heights = spill.length;
    expect(heights).toBe(2);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

/**
 * /esim/payment-rubles/ — the one page that used to say a foreign card might work.
 *
 * The text changed on 2026-09-02: the title, the H1, the lead, the payment step
 * and the FAQ now name the restriction («российская банковская карта», «карты
 * иностранных банков сейчас не принимаются») instead of hedging it. Two of those
 * strings got noticeably longer, and a longer H1 is exactly the kind of edit that
 * pushes a hero out of its container on a narrow screen — the same failure the
 * card label produced on the checkout the day before.
 *
 * Rendered rather than grepped, and at three widths: the file tests assert what
 * the page SAYS, this asserts that a reader can see all of it.
 */
test.describe('the payment guide holds its layout after the wording change', () => {
  const PAGE = '/esim/payment-rubles/index.html';

  test('the page never scrolls sideways, at this viewport or a desktop one', async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForSelector('h1', { timeout: 15_000 });

    const sideways = () => page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(await sideways(), 'sideways scroll at the project viewport').toBe(false);

    // Desktop, from inside the test: adding a third project would run every
    // Mini App case at a width its layout was never drawn for.
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await sideways(), 'sideways scroll at 1440').toBe(false);
  });

  test('the hero and the FAQ answers stay inside their boxes', async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForSelector('.cp-hero h1', { timeout: 15_000 });

    expect(await overflowingInside(page, '.cp-hero')).toEqual([]);
    expect(await overflowingInside(page, '#faq')).toEqual([]);
  });

  test('canonical, title and H1 all name the restriction', async ({ page }) => {
    await page.goto(PAGE);

    expect(await page.getAttribute('link[rel=canonical]', 'href'))
      .toBe('https://magicesim.store/esim/payment-rubles/');
    expect(await page.title()).toContain('российская карта');
    expect((await page.textContent('h1')).trim()).toBe('Оплата eSIM рублями: СБП и российская карта');

    // The visible answer, read off the rendered page rather than the source.
    const faq = (await page.textContent('.faq-list')).replace(/\s+/g, ' ');
    expect(faq).toContain('карта выпущена российским банком');
    expect(faq).toContain('не примет');
    expect(faq).not.toContain('зависит от платёжного провайдера');
  });
});
