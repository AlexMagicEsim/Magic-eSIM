'use strict';

/**
 * Disconnecting a proven address — exactly once per intention.
 *
 * This is the file that most needed a real browser, and the one an earlier
 * hand-rolled harness got wrong twice.
 *
 * The first mistake was the seam: the harness replaced `window.fetch` after the
 * page had loaded, but `core.js` captures `window.fetch.bind(window)` when the
 * app boots, so the replacement was never called. The "reproduction" of the
 * race reproduced nothing — both the broken and the fixed build looked
 * identical, because the script was really just performing two complete,
 * sequential intentions. Here the delay lives in a `page.route` handler, which
 * does not care when the app took its reference to fetch.
 *
 * The second was assuming the only window was the request. It was not. There is
 * ONE sheet element in ui.js and `openSheet` closes whatever is open before it
 * opens anything, so a second entry while the first confirmation is up removes
 * the DOM that the first `confirmSheet` promise resolves from — and that
 * promise then never settles at all. That is why the guard goes on before the
 * question rather than around the request, and why this file checks the dialog
 * as well as the request count.
 */
const { test, expect } = require('@playwright/test');
const { installMiniApp, openApp, openSettings, callsTo } = require('./harness');

const REVOKE = '/api/v1/tma/identity/email/revoke';

/**
 * Deliver a second press straight to the handler.
 *
 * NOT `click({ force: true })`. A forced click is dispatched at the element's
 * COORDINATES, and while the confirmation is up those coordinates belong to the
 * sheet's backdrop — so the "second press" actually dismissed the dialog, and
 * did it at one viewport width and not the other. That is how this test failed
 * on 390 and passed on 320 while the code was correct.
 *
 * `dispatchEvent` reaches the listener even on a disabled control, which is
 * precisely the path the in-code guard exists for: `disabled` stops a finger,
 * but focus is not trapped, so a keyboard or anything programmatic can still
 * re-enter. This is the instrument that tests `if (btn.disabled) return;`
 * rather than testing the browser's own hit-testing.
 */
const pressAgain = (locator) => locator.evaluate(
  (node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
);

test.describe('revoking an address', () => {
  test('a second press while the request is in flight sends nothing more', async ({ page }) => {
    // 600ms is a plausible request. Without a delay the whole flow completes
    // inside a frame and there is no window to test.
    const state = await installMiniApp(page, { revokeDelayMs: 600 });
    await openApp(page);
    await openSettings(page);

    const button = page.locator('#screen-settings .settings__act');
    await button.click();
    await page.locator('.sheetm__panel').waitFor();

    await page.locator('.sheetm__panel .btn--wide').click();

    // Mid-flight: the request has left, the answer has not come back.
    await expect(button).toBeDisabled();
    expect(callsTo(state, REVOKE)).toBe(1);

    // An impatient second attempt, delivered to the handler itself.
    await pressAgain(button);
    await page.waitForTimeout(250);
    expect(await page.locator('.sheetm').count()).toBe(0);

    // The first revoke is still in flight. Wait for the ANSWER rather than for
    // a clock: when the row is gone the response has been applied, so a second
    // request — if the guard had let one out — has had its chance to be counted.
    await expect(page.locator('#screen-settings .settings__row')).toHaveCount(0);
    expect(callsTo(state, REVOKE)).toBe(1);
  });

  test('a second press while the confirmation is still up raises no second dialog', async ({ page }) => {
    // The dangerous half: a second sheet would strand the first promise for
    // good, and the flow would simply stop with no error anywhere.
    const state = await installMiniApp(page, { revokeDelayMs: 600 });
    await openApp(page);
    await openSettings(page);

    const button = page.locator('#screen-settings .settings__act');
    await button.click();
    await page.locator('.sheetm__panel').waitFor();

    await expect(button).toBeDisabled();
    await pressAgain(button);
    // A fixed wait is the right instrument here and only here: the claim is
    // that something does NOT appear, and absence cannot be polled for. It is
    // deliberately unrelated to `revokeDelayMs` — no request is in flight yet.
    await page.waitForTimeout(250);

    // Still exactly one sheet — a second would have torn out the DOM the first
    // promise resolves from, and that promise would never have settled.
    expect(await page.locator('.sheetm').count()).toBe(1);
    expect(callsTo(state, REVOKE)).toBe(0);

    // …and the first confirmation is still answerable, which is the property a
    // stranded promise would have destroyed silently.
    await page.locator('.sheetm__panel .btn--wide').click();
    await expect(page.locator('.sheetm')).toHaveCount(0);
    await expect(page.locator('#screen-settings .settings__row')).toHaveCount(0);
    expect(callsTo(state, REVOKE)).toBe(1);
  });

  test('cancelling gives the button back and sends nothing', async ({ page }) => {
    const state = await installMiniApp(page);
    await openApp(page);
    await openSettings(page);

    const button = page.locator('#screen-settings .settings__act');

    await button.click();
    await page.locator('.sheetm__panel').waitFor();
    await page.locator('.sheetm__panel .btn--quiet').click();

    await expect(page.locator('.sheetm')).toHaveCount(0);
    await expect(button).toBeEnabled();
    expect(callsTo(state, REVOKE)).toBe(0);
  });

  test('dismissing by the backdrop does the same', async ({ page }) => {
    // The scrim resolves the promise too — a sheet that can only be answered by
    // its own button is a sheet somebody gets stuck in.
    const state = await installMiniApp(page);
    await openApp(page);
    await openSettings(page);

    const button = page.locator('#screen-settings .settings__act');

    await button.click();
    await page.locator('.sheetm__panel').waitFor();
    await page.locator('.sheetm__scrim').click({ position: { x: 5, y: 5 } });

    await expect(page.locator('.sheetm')).toHaveCount(0);
    await expect(button).toBeEnabled();
    expect(callsTo(state, REVOKE)).toBe(0);

    // …and the control still works afterwards, which is what makes the
    // re-enable a fix rather than a way of hiding the button.
    await button.click();
    await expect(page.locator('.sheetm__panel')).toHaveCount(1);
  });

  test('a failed revoke says so and leaves the row usable', async ({ page }) => {
    const state = await installMiniApp(page, { revokeFails: true });
    await openApp(page);
    await openSettings(page);

    const button = page.locator('#screen-settings .settings__act');
    await button.click();
    await page.locator('.sheetm__panel').waitFor();
    await page.locator('.sheetm__panel .btn--wide').click();

    await expect(page.locator('.toast')).toBeVisible();
    await expect(button).toBeEnabled();
    expect(callsTo(state, REVOKE)).toBe(1);
  });

  test('a confirmed revoke removes the row and asks the server exactly once', async ({ page }) => {
    const state = await installMiniApp(page);
    await openApp(page);
    await openSettings(page);

    await page.locator('#screen-settings .settings__act').click();
    await page.locator('.sheetm__panel').waitFor();
    await page.locator('.sheetm__panel .btn--wide').click();

    await expect(page.locator('#screen-settings .settings__row')).toHaveCount(0);
    expect(callsTo(state, REVOKE)).toBe(1);
  });
});
