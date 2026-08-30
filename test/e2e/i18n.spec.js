'use strict';

/**
 * The language layer, in a real browser.
 *
 * `app/i18n.test.js` already covers the engine in Node, against injected
 * dictionaries and fake storage. What Node cannot answer is whether the wiring
 * holds: whether the static markup actually gets translated, whether the gear
 * keeps its icon when its label changes, whether the choice survives a reload
 * through a real `localStorage` rather than a fake one.
 *
 * That last one is the reason this file exists. A Node test proves the storage
 * CONTRACT; only a browser proves the substrate.
 */
const { test, expect } = require('@playwright/test');
const { installMiniApp, openApp, openSettings, CYRILLIC } = require('./harness');

const lang = (page) => page.evaluate(() => window.MagicI18n.lang());

test.describe('language detection', () => {
  test('a Telegram client set to Russian gets Russian', async ({ page }) => {
    await installMiniApp(page, { languageCode: 'ru' });
    await openApp(page);

    expect(await lang(page)).toBe('ru');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });

  test('a Telegram client set to something else gets English', async ({ page }) => {
    await installMiniApp(page, { languageCode: 'de' });
    await openApp(page);
    await openSettings(page);

    expect(await lang(page)).toBe('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#screen-settings h1')).toHaveText('Settings');
  });

  test('a client that names no language at all gets Russian, because absence is not a statement', async ({ page }) => {
    // `language_code` is optional on Telegram's WebAppUser, it is absent
    // outside Telegram entirely, and some launch contexts carry no user. Those
    // must not flip a Russian shop to English.
    await installMiniApp(page, { languageCode: null });
    await openApp(page);
    await openSettings(page);

    expect(await lang(page)).toBe('ru');
    await expect(page.locator('#screen-settings h1')).toHaveText('Настройки');
  });
});

test.describe('the language control', () => {
  test('switching to English changes the screen it is on, with no reload', async ({ page }) => {
    await installMiniApp(page, { languageCode: 'ru' });
    await openApp(page);
    await openSettings(page);

    const before = await page.locator('#screen-settings').innerText();
    await page.locator('#settings-language [data-lang="en"]').click();

    await expect(page.locator('#screen-settings h1')).toHaveText('Settings');
    const after = await page.locator('#screen-settings').innerText();
    expect(after).not.toBe(before);
  });

  test('and leaves no Russian behind on it', async ({ page }) => {
    await installMiniApp(page, { languageCode: 'ru' });
    await openApp(page);
    await openSettings(page);
    await page.locator('#settings-language [data-lang="en"]').click();
    await expect(page.locator('#screen-settings h1')).toHaveText('Settings');

    // «Русский» is the one deliberate exception: the options are endonyms, each
    // written in its own language, so the control does not relabel itself under
    // the finger that just used it.
    const text = (await page.locator('#screen-settings').innerText()).replace(/Русский/g, '');
    expect(CYRILLIC.test(text)).toBe(false);
  });

  test('exactly one option is marked as the one in use, and the other says so out loud', async ({ page }) => {
    // `el()` drops an attribute whose value is `false`, so an option built
    // carelessly ships with no state at all and a screen reader announces a
    // radio that is neither on nor off.
    await installMiniApp(page, { languageCode: 'ru' });
    await openApp(page);
    await openSettings(page);

    const checked = page.locator('#settings-language [data-lang][aria-checked="true"]');
    await expect(checked).toHaveCount(1);
    await expect(checked).toHaveAttribute('data-lang', 'ru');
    await expect(page.locator('#settings-language [data-lang="en"]')).toHaveAttribute('aria-checked', 'false');
  });

  test('the control is honest that the rest of the app is still Russian', async ({ page }) => {
    await installMiniApp(page, { languageCode: 'ru' });
    await openApp(page);
    await openSettings(page);

    await expect(page.locator('#screen-settings')).toContainText('Часть экранов пока только на русском');
  });

  test('the gear keeps its icon when its label changes language', async ({ page }) => {
    // The hero gear carries an inline <svg> and an aria-label. A `data-i18n`
    // hook on the button rather than on the attribute would set textContent and
    // erase the icon — silently, because nothing else would break.
    await installMiniApp(page, { languageCode: 'ru' });
    await openApp(page);
    await openSettings(page);
    await page.locator('#settings-language [data-lang="en"]').click();
    await expect(page.locator('#screen-settings h1')).toHaveText('Settings');

    await expect(page.locator('#open-settings')).toHaveAttribute('aria-label', 'Settings');
    await expect(page.locator('#open-settings svg')).toHaveCount(1);
  });
});

test.describe('the choice outlives the app', () => {
  test('a manual choice beats what Telegram says, and survives a reload', async ({ page }) => {
    await installMiniApp(page, { languageCode: 'ru' });
    await openApp(page);
    await openSettings(page);

    await page.locator('#settings-language [data-lang="en"]').click();
    await expect(page.locator('#screen-settings h1')).toHaveText('Settings');
    expect(await page.evaluate(() => window.localStorage.getItem('mesim.lang'))).toBe('en');

    // Telegram still says `ru` on the way back in. The customer's own choice
    // has to win, or the control does nothing the next time they open the app.
    await openApp(page);
    expect(await lang(page)).toBe('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await openSettings(page);
    await expect(page.locator('#screen-settings h1')).toHaveText('Settings');
    await expect(page.locator('#settings-language [data-lang="en"]')).toHaveAttribute('aria-checked', 'true');
  });

  test('and switching back restores the Russian screen', async ({ page }) => {
    await installMiniApp(page, { languageCode: 'ru' });
    await openApp(page);
    await openSettings(page);

    const russian = await page.locator('#screen-settings').innerText();

    await page.locator('#settings-language [data-lang="en"]').click();
    await expect(page.locator('#screen-settings h1')).toHaveText('Settings');

    await page.locator('#settings-language [data-lang="ru"]').click();
    await expect(page.locator('#screen-settings h1')).toHaveText('Настройки');

    expect(await page.locator('#screen-settings').innerText()).toBe(russian);
  });

  test('nothing is written down until a choice is actually made', async ({ page }) => {
    // Otherwise the first client a customer happens to open decides for them
    // permanently, and a guess becomes indistinguishable from a decision.
    await installMiniApp(page, { languageCode: 'de' });
    await openApp(page);
    await openSettings(page);

    expect(await page.evaluate(() => window.localStorage.getItem('mesim.lang'))).toBeNull();
  });
});
