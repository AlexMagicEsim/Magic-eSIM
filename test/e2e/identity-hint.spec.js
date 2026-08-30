'use strict';

/**
 * The code screen keeps a secret, and offers a way out.
 *
 * A customer whose address is held by ANOTHER account gets the same answer from
 * the server as one whose address is free: `status: 'sent'`. That
 * indistinguishability is deliberate — telling them apart would turn the form
 * into a lookup service for "does this address exist here". The screen has to
 * keep that promise, and it is the screen, not the server, that is easy to
 * break.
 *
 * The hint under the resend button is the one thing that was fixed about this:
 * before it, somebody in that branch sat waiting for a letter that was never
 * going to arrive. It has to be present AND say nothing about why.
 *
 * `app/core.test.js` already reads the source for both properties. This checks
 * the rendered screen, which is what the customer actually gets, and it is the
 * half that would notice the screen never being reachable at all.
 */
const { test, expect } = require('@playwright/test');
const { installMiniApp, openApp, openSettings } = require('./harness');

/** Everything the screen must never say, from core.test.js's own list. */
const REVEALING = [
  'занят', 'занята', 'уже используется', 'уже зарегистрирован',
  'другим аккаунтом', 'другому аккаунту', 'другой аккаунт',
  'привязан', 'существует', 'не найден', 'уже подтверждён',
  'HELD_BY_ANOTHER', 'held_by_another',
];

async function reachCodeScreen(page) {
  // With no proven address, Settings offers the way in.
  await openSettings(page);
  await page.getByRole('button', { name: 'Добавить покупки с сайта' }).click();

  await page.locator('#claim-email').fill('someone@example.com');
  await page.locator('#screen-claim .btn--wide').click();

  await page.locator('#claim-code').waitFor();
}

test.describe('linking website purchases', () => {
  test('the code screen offers a way out when no mail arrives', async ({ page }) => {
    await installMiniApp(page, { emails: [] });
    await openApp(page);
    await reachCodeScreen(page);

    await expect(page.locator('#screen-claim')).toContainText(
      'Если письмо не пришло за пару минут — проверьте адрес и попробуйте другой.'
    );
  });

  test('and the hint is a quiet note rather than an error', async ({ page }) => {
    await installMiniApp(page, { emails: [] });
    await openApp(page);
    await reachCodeScreen(page);

    const hint = page.locator('#screen-claim p', { hasText: 'Если письмо не пришло' });
    await expect(hint).toHaveClass(/small/);
    await expect(hint).toHaveClass(/muted/);
    // Not a notice, not a warning: those carry their own styling and would
    // read as "something went wrong", which is exactly what we cannot say.
    await expect(page.locator('#screen-claim .notice--bad')).toHaveCount(0);
  });

  test('nothing on the screen says why a letter might not have come', async ({ page }) => {
    // The server answers a held address exactly as it answers a free one, so
    // this screen is reached identically in both cases. What it must not do is
    // give the difference away.
    await installMiniApp(page, { emails: [] });
    await openApp(page);
    await reachCodeScreen(page);

    const text = (await page.locator('#screen-claim').innerText()).toLowerCase();
    for (const word of REVEALING) {
      expect(text.includes(word.toLowerCase()), `the screen must not say «${word}»`).toBe(false);
    }
  });

  test('the introduction stays conditional and promises nothing', async ({ page }) => {
    await installMiniApp(page, { emails: [] });
    await openApp(page);
    await reachCodeScreen(page);

    // «Если этот адрес использовался при покупке, мы отправили…» — never a
    // claim that a code was sent.
    await expect(page.locator('#screen-claim')).toContainText('Если этот адрес использовался при покупке');
  });

  test('the way in is reachable at all, from an account with no proven address', async ({ page }) => {
    await installMiniApp(page, { emails: [] });
    await openApp(page);
    await openSettings(page);

    await expect(page.getByRole('button', { name: 'Добавить покупки с сайта' })).toBeVisible();
  });
});
