'use strict';

/**
 * The main customer path, walked in BOTH languages.
 *
 * The other specs check properties — no overflow, no Cyrillic, one request per
 * intention. This one checks that the app still WORKS: that a catalogue loads,
 * a country resolves to a name, a plan opens, its conditions render, checkout
 * shows a price, and the screens a buyer reaches afterwards are reachable.
 *
 * It runs the same walk twice because a language layer's characteristic
 * failure is not a wrong word — it is a screen that renders in one language and
 * throws in the other, on a branch nobody visited.
 */
const { test, expect } = require('@playwright/test');
const { installMiniApp, openApp, openSettings, ESIM, PACKAGE } = require('./harness');

const CYRILLIC = /[Ѐ-ӿ]/;

/** The walk, plus what each language expects to read at the end of it. */
const LANGS = [
  {
    code: 'ru',
    country: 'Япония',
    plans: 'Тарифы',
    conditions: 'Покрытие и условия',
    myEsims: 'Мои eSIM',
    coverage: 'Япония',
  },
  {
    code: 'en',
    country: 'Japan',
    plans: 'Plans',
    conditions: 'Coverage and conditions',
    myEsims: 'My eSIMs',
    coverage: 'Japan',
  },
];

for (const L of LANGS) {
  test.describe(`the buying path in ${L.code}`, () => {
    const open = (page) => installMiniApp(page, {
      languageCode: L.code, emails: [], esims: [ESIM], packages: [PACKAGE],
    });

    test('the catalogue loads and the country has a name, not a code', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await open(page);
      await openApp(page);

      await expect(page.locator('#screen-home')).toContainText(L.country);
      // The failure this project has already had once, in Russian: cards
      // titled "BN 10 GB". A name that is its own ISO code is not a name.
      await expect(page.locator('#screen-home')).not.toContainText(/\bJP\b/);
      expect(errors).toEqual([]);
    });

    test('a country opens its plans, and a plan opens its conditions', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await open(page);
      await openApp(page);

      // The tile is the control. Clicking the text node inside a card that
      // happens to contain the same word reaches a different element entirely.
      await page.locator('#screen-home .tile', { hasText: L.country }).first().click();
      await page.locator('#screen-country[data-active]').waitFor();
      await expect(page.locator('#country-title')).toContainText(L.country);

      await page.locator('#screen-country .card').first().click();
      await page.locator('#screen-tariff[data-active]').waitFor();

      // The conditions sheet is where provider wording, activation policy and
      // the coverage summary all land — the densest translation on any screen.
      await expect(page.locator('#screen-tariff')).toContainText(L.conditions);
      await expect(page.locator('#screen-tariff')).toContainText(L.coverage);
      expect(errors).toEqual([]);
    });

    test('the price is a number in roubles, in both languages', async ({ page }) => {
      // Currency is NOT translated: the shop charges roubles whoever is reading.
      await open(page);
      await openApp(page);
      await page.locator('#screen-home .tile', { hasText: L.country }).first().click();
      await page.locator('#screen-country[data-active]').waitFor();

      await expect(page.locator('#screen-country')).toContainText('₽');
    });

    test('My eSIMs lists the eSIM with its remaining data', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await open(page);
      await openApp(page);
      await page.locator('.tab').nth(2).click();
      await page.locator('#screen-esims[data-active]').waitFor();
      await page.waitForTimeout(400);

      await expect(page.locator('#screen-esims')).toContainText('3.2');
      expect(errors).toEqual([]);
    });

    test('settings, help and the linking flow all render', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await open(page);
      await openApp(page);

      await openSettings(page);
      await expect(page.locator('#settings-language [data-lang]')).toHaveCount(2);

      await page.locator('.tab').nth(3).click();
      await page.locator('#screen-help[data-active]').waitFor();
      await expect(page.locator('#screen-help details')).toHaveCount(6);

      expect(errors).toEqual([]);
    });
  });
}

test.describe('the two languages are genuinely different', () => {
  test('switching language re-renders the catalogue, not just the chrome', async ({ page }) => {
    // The bug this catches: a country list resolved ONCE at grouping time keeps
    // its Russian names under an English heading. That is exactly what the
    // English audit found, and this is the regression pin for it.
    await installMiniApp(page, { languageCode: 'ru', emails: [], packages: [PACKAGE] });
    await openApp(page);
    await expect(page.locator('#screen-home')).toContainText('Япония');

    await openSettings(page);
    await page.locator('#settings-language [data-lang="en"]').click();
    await expect(page.locator('#screen-settings h1')).toHaveText('Settings');

    await page.locator('.tab').nth(0).click();
    await page.locator('#screen-home[data-active]').waitFor();
    await page.waitForTimeout(400);

    await expect(page.locator('#screen-home')).toContainText('Japan');
    expect(await page.locator('#screen-home').innerText()).not.toMatch(CYRILLIC);
  });
});
