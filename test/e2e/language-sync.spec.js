'use strict';

/**
 * Telling the server which language the customer chose.
 *
 * The claim being tested is narrow and load-bearing: the request goes out when
 * somebody TAPS, and at no other time. Detection — what Telegram says a client
 * is set to — is a guess about a person, and the backend deliberately refuses
 * to store one. If this ever fires on boot, that refusal is defeated from the
 * client side.
 *
 * The second claim is that the switch works with a backend that has never
 * heard of the route. During the rollout it will not have, for a few minutes.
 */
const { test, expect } = require('@playwright/test');
const { installMiniApp, openApp, openSettings } = require('./harness');

const ROUTE = '/api/v1/tma/settings/language';

/** Every language POST the app made, with its body. */
async function watchLanguageCalls(page) {
  const calls = [];
  await page.route(`**${ROUTE}`, async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lang: 'en' }) });
  });

  return calls;
}

test.describe('the language preference reaches the server', () => {
  test('a manual switch sends exactly one request, with the chosen language', async ({ page }) => {
    await installMiniApp(page, { languageCode: 'ru', emails: [] });
    const calls = await watchLanguageCalls(page);
    await openApp(page);
    await openSettings(page);

    await page.locator('#settings-language [data-lang="en"]').click();
    await expect(page.locator('#screen-settings h1')).toHaveText('Settings');
    await page.waitForTimeout(300);

    expect(calls).toEqual([{ lang: 'en' }]);
  });

  test('switching back sends the other one', async ({ page }) => {
    await installMiniApp(page, { languageCode: 'ru', emails: [] });
    const calls = await watchLanguageCalls(page);
    await openApp(page);
    await openSettings(page);

    await page.locator('#settings-language [data-lang="en"]').click();
    await expect(page.locator('#screen-settings h1')).toHaveText('Settings');
    await page.locator('#settings-language [data-lang="ru"]').click();
    await expect(page.locator('#screen-settings h1')).toHaveText('Настройки');
    await page.waitForTimeout(300);

    expect(calls).toEqual([{ lang: 'en' }, { lang: 'ru' }]);
  });

  test('DETECTION NEVER WRITES — booting in any language sends nothing', async ({ page }) => {
    // The rule the backend's whole storage argument rests on. Telegram saying
    // «en» is not the customer choosing English.
    for (const languageCode of ['en', 'ru', 'de', null]) {
      const fresh = await page.context().newPage();
      const calls = [];
      await fresh.route(`**${ROUTE}`, async (route) => {
        calls.push(route.request().postDataJSON());
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      });
      await installMiniApp(fresh, { languageCode, emails: [] });
      await openApp(fresh);
      await openSettings(fresh);
      await fresh.waitForTimeout(400);

      expect(calls, `booting with language_code=${String(languageCode)} must write nothing`).toEqual([]);
      await fresh.close();
    }
  });

  test('re-tapping the language already in use sends nothing', async ({ page }) => {
    await installMiniApp(page, { languageCode: 'ru', emails: [] });
    const calls = await watchLanguageCalls(page);
    await openApp(page);
    await openSettings(page);

    await page.locator('#settings-language [data-lang="ru"]').click();
    await page.locator('#settings-language [data-lang="ru"]').click();
    await page.waitForTimeout(300);

    expect(calls).toEqual([]);
  });

  test('a reload does not re-send the stored choice', async ({ page }) => {
    // The preference is already on the server; re-sending it on every launch
    // would be a write per app open, for nothing.
    await installMiniApp(page, { languageCode: 'ru', emails: [] });
    const calls = await watchLanguageCalls(page);
    await openApp(page);
    await openSettings(page);
    await page.locator('#settings-language [data-lang="en"]').click();
    await expect(page.locator('#screen-settings h1')).toHaveText('Settings');
    await page.waitForTimeout(300);
    expect(calls.length).toBe(1);

    await openApp(page);
    await openSettings(page);
    await page.waitForTimeout(400);

    expect(calls.length).toBe(1);
  });
});

test.describe('a backend that does not know the route yet', () => {
  for (const [name, status] of [['404 — old backend', 404], ['401 — no session', 401],
    ['500 — server fault', 500], ['429 — rate limited', 429]]) {
    test(`${name}: the language still changes and nothing is shown to the customer`, async ({ page }) => {
      await installMiniApp(page, { languageCode: 'ru', emails: [] });
      await page.route(`**${ROUTE}`, (route) => route.fulfill({
        status, contentType: 'application/json', body: JSON.stringify({ error: 'NOPE' }),
      }));
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));

      await openApp(page);
      await openSettings(page);
      await page.locator('#settings-language [data-lang="en"]').click();

      // The switch is a LOCAL preference and does not wait on a round trip.
      await expect(page.locator('#screen-settings h1')).toHaveText('Settings');
      await page.waitForTimeout(400);

      expect(errors, 'a rejected save must not become an unhandled rejection').toEqual([]);
      // No toast, no notice — the control has already done its job.
      await expect(page.locator('.toast')).toHaveCount(0);
      // …and it still persists locally, which is what the customer sees.
      expect(await page.evaluate(() => window.localStorage.getItem('mesim.lang'))).toBe('en');
    });
  }

  test('a request that never answers does not freeze the switch', async ({ page }) => {
    await installMiniApp(page, { languageCode: 'ru', emails: [] });
    await page.route(`**${ROUTE}`, async () => { /* hang for ever */ });

    await openApp(page);
    await openSettings(page);
    await page.locator('#settings-language [data-lang="en"]').click();

    await expect(page.locator('#screen-settings h1')).toHaveText('Settings');
    await page.locator('#settings-language [data-lang="ru"]').click();
    await expect(page.locator('#screen-settings h1')).toHaveText('Настройки');
  });
});
