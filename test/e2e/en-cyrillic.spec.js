'use strict';

/**
 * THE ENGLISH CYRILLIC AUDIT.
 *
 * Phase 2's actual claim is not "we added a dictionary" — it is "a customer who
 * chooses English does not meet Russian". A dictionary test cannot check that,
 * because the failure mode is a string that never went through the dictionary
 * at all: a literal left in ui.js, a table captured at module load, a helper
 * whose language argument nobody passed. Every one of those is invisible to a
 * test that reads app/locales.js.
 *
 * So this walks the app in English and reads what is actually on the screen.
 *
 * WHAT IS ALLOWED TO BE CYRILLIC, and why each one is not a bug:
 *
 *   «Русский» — the language control's own option. Endonyms are written in
 *   their own language, so the control does not relabel itself under the finger
 *   that just used it. This is the single deliberate exception, and it is
 *   asserted to be PRESENT rather than merely tolerated.
 *
 * Nothing else. Provider text that arrives in Russian would also be allowed —
 * app/core.js passes it through in both languages, because it is the content
 * rather than our copy — but no fixture here sends any, so the audit stays
 * strict and would fail if one appeared unexpectedly.
 */
const { test, expect } = require('@playwright/test');
const { installMiniApp, openApp, openSettings, ESIM, PACKAGE } = require('./harness');

const CYRILLIC = /[Ѐ-ӿ]/;
const ALLOWED = ['Русский'];

/** Every visible text node under `root`, with the allowed exceptions removed. */
async function cyrillicOn(page, root, allowed) {
  return page.evaluate(({ sel, ok }) => {
    const node = document.querySelector(sel);
    if (!node) return ['__MISSING__' + sel];
    const out = [];
    const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('[hidden]')) continue;
      // Only what is actually painted: a screen that is not active still has
      // its Russian markup in the DOM, and that is not what a customer sees.
      if (!el.offsetParent && el.tagName !== 'BODY') continue;
      let text = String(n.textContent || '').trim();
      if (!text) continue;
      for (const word of ok) text = text.split(word).join('');
      if (/[Ѐ-ӿ]/.test(text)) out.push(text.slice(0, 120));
    }
    // Attributes a screen reader would speak are just as visible to the person
    // who depends on them.
    for (const el of node.querySelectorAll('[aria-label],[placeholder],[alt],[title]')) {
      for (const attr of ['aria-label', 'placeholder', 'alt', 'title']) {
        let v = el.getAttribute(attr);
        if (!v) continue;
        for (const word of ok) v = v.split(word).join('');
        if (/[Ѐ-ӿ]/.test(v)) out.push(`@${attr}=${v.slice(0, 120)}`);
      }
    }
    return out;
  }, { sel: root, ok: allowed });
}

const english = (page) => installMiniApp(page, {
  languageCode: 'en',
  emails: [],
  esims: [ESIM],
  packages: [PACKAGE],
});

test.describe('an English customer never meets Russian', () => {
  test('the shell, the tab bar and the home screen', async ({ page }) => {
    await english(page);
    await openApp(page);

    expect(await cyrillicOn(page, '#screen-home', ALLOWED)).toEqual([]);
    expect(await cyrillicOn(page, '.tabbar', ALLOWED)).toEqual([]);
  });

  test('search, including its empty state', async ({ page }) => {
    await english(page);
    await openApp(page);

    const box = page.locator('#search');
    await box.fill('zzzzzz');
    await page.waitForTimeout(350);
    expect(await cyrillicOn(page, '#screen-home', ALLOWED)).toEqual([]);

    await box.fill('japan');
    await page.waitForTimeout(350);
    expect(await cyrillicOn(page, '#screen-home', ALLOWED)).toEqual([]);
  });

  test('the settings screen, where the one allowed exception lives', async ({ page }) => {
    await english(page);
    await openApp(page);
    await openSettings(page);

    // «Русский» must be PRESENT — it is the control's own option, and its
    // absence would mean the endonym rule had been quietly dropped.
    await expect(page.locator('#settings-language')).toContainText('Русский');
    expect(await cyrillicOn(page, '#screen-settings', ALLOWED)).toEqual([]);
  });

  test('My eSIMs and the eSIM card', async ({ page }) => {
    await english(page);
    await openApp(page);
    await page.locator('.tabbar [data-screen="esims"], .tabbar a[href="#esims"], .tab').nth(2).click();
    await page.locator('#screen-esims[data-active]').waitFor();
    await page.waitForTimeout(400);

    expect(await cyrillicOn(page, '#screen-esims', ALLOWED)).toEqual([]);
  });

  test('the help screen and every FAQ answer', async ({ page }) => {
    await english(page);
    await openApp(page);
    await page.locator('.tab').nth(3).click();
    await page.locator('#screen-help[data-active]').waitFor();

    // Open every collapsed answer: a <details> that is shut still renders its
    // text, but this makes the assertion about what a reader actually opens.
    for (const d of await page.locator('#screen-help details').all()) {
      await d.evaluate((n) => { n.open = true; });
    }
    await page.waitForTimeout(200);

    expect(await cyrillicOn(page, '#screen-help', ALLOWED)).toEqual([]);
  });

  test('the website-purchase flow, through to the code screen', async ({ page }) => {
    await english(page);
    await openApp(page);
    await openSettings(page);
    await page.getByRole('button', { name: 'Add website purchases' }).click();
    await page.locator('#screen-claim[data-active]').waitFor();
    expect(await cyrillicOn(page, '#screen-claim', ALLOWED)).toEqual([]);

    await page.locator('#claim-email').fill('someone@example.com');
    await page.locator('#screen-claim .btn--wide').click();
    await page.locator('#claim-code').waitFor();
    expect(await cyrillicOn(page, '#screen-claim', ALLOWED)).toEqual([]);
  });

  test('the plan sheet, which carries the densest translation in the app', async ({ page }) => {
    // Provider wording, activation policy, operators, hotspot, the coverage
    // summary and the conditions table all land here. If any of them missed a
    // language argument, this is where it shows.
    await english(page);
    await openApp(page);
    await page.locator('#screen-home .tile').first().click();
    await page.locator('#screen-country[data-active]').waitFor();
    expect(await cyrillicOn(page, '#screen-country', ALLOWED)).toEqual([]);

    await page.locator('#screen-country .card').first().click();
    await page.locator('#screen-tariff[data-active]').waitFor();
    // Open the collapsed conditions and compatibility sheets: their text is the
    // point of this check.
    for (const d of await page.locator('#screen-tariff details').all()) {
      await d.evaluate((n) => { n.open = true; });
    }
    await page.waitForTimeout(200);

    expect(await cyrillicOn(page, '#screen-tariff', ALLOWED)).toEqual([]);
  });

  test('checkout, including the consent row and the pay button', async ({ page }) => {
    await english(page);
    await openApp(page);
    await page.locator('#screen-home .tile').first().click();
    await page.locator('#screen-country[data-active]').waitFor();
    await page.locator('#screen-country .card').first().click();
    await page.locator('#screen-tariff[data-active]').waitFor();

    // `.btn--wide` alone: a comma-selector matches in DOM order, so adding
    // `.btn` picked up the iPhone guide button that sits above the buy button.
    await page.locator('#screen-tariff .btn--wide').first().click();
    await page.locator('#screen-checkout[data-active]').waitFor();
    await page.waitForTimeout(200);

    expect(await cyrillicOn(page, '#screen-checkout', ALLOWED)).toEqual([]);

    // The promo block is collapsed by default and is a screen of its own.
    const promo = page.locator('.promo__toggle');
    if (await promo.count()) {
      await promo.first().click();
      await page.waitForTimeout(150);
      expect(await cyrillicOn(page, '#screen-checkout', ALLOWED)).toEqual([]);
    }
  });

  test('the top-up and order screens, which a buyer reaches after paying', async ({ page }) => {
    // Rendered directly rather than walked to: reaching them for real needs a
    // payment, and this suite creates none. What is under test is the copy on
    // them, which does not depend on how the screen was opened.
    await english(page);
    await openApp(page);

    for (const screen of ['#screen-topup', '#screen-order']) {
      const text = await page.locator(screen).textContent();
      expect(text || '', `${screen} static copy`).not.toMatch(CYRILLIC);
      const label = await page.locator(screen).getAttribute('aria-label');
      expect(label || '', `${screen} aria-label`).not.toMatch(CYRILLIC);
    }
  });

  test('the loading screen, whose copy ships in the HTML rather than from a render', async ({ page }) => {
    await english(page);
    await openApp(page);

    // Checked in the DOM rather than on screen, because by now the app has
    // booted and this screen is behind the one it hands over to. What is being
    // proved is that its text was TRANSLATED, not that it is still visible: a
    // customer whose session drops back to it must not meet Russian there.
    const text = await page.locator('#screen-loading').textContent();
    expect(text).not.toMatch(CYRILLIC);
    expect(text.trim()).toBe('Connecting…');
  });

  test('the language is applied before boot does anything that can wait', async ({ page }) => {
    // The shell ships Russian in the markup so the first paint is right for
    // almost everybody with no flash. For an English reader that trade is only
    // acceptable while it lasts one frame — applyLanguage() must run before the
    // first await in boot(), not after the session call comes back.
    const src = await page.request.get('/app/ui.js').then((r) => r.text());
    const boot = src.slice(src.indexOf('async function boot()'), src.indexOf('async function boot()') + 1200);
    const applied = boot.indexOf('applyLanguage()');
    const awaited = boot.indexOf('await ');

    expect(applied).toBeGreaterThan(-1);
    expect(applied).toBeLessThan(awaited === -1 ? Number.MAX_SAFE_INTEGER : awaited);
  });
});
