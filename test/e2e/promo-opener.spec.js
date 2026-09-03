'use strict';

/**
 * The promo opener on the checkout screen.
 *
 * It used to be `.btn--quiet` — transparent, muted, 36px, no padding — which
 * renders under the tariff card as a grey sentence and reads as a caption.
 * Production feedback was simply that nobody could tell it was a control.
 *
 * These tests hold the two halves of the fix: it LOOKS like an action (a real
 * row, a real target, a chevron, body ink rather than hint grey), and it still
 * DOES exactly what it did — the field, the apply, the recalculated price and
 * the applied state are untouched.
 */
const { test, expect } = require('@playwright/test');
const { installMiniApp, openApp, overflowingInside, PACKAGE } = require('./harness');

const COPY = {
  ru: { languageCode: 'ru', open: 'Ввести промокод', label: 'Промокод', apply: 'Применить' },
  en: { languageCode: 'de', open: 'Enter promo code', label: 'Promo code', apply: 'Apply' },
};

/** country -> tariff -> checkout, the way a customer gets there. */
async function toCheckout(page) {
  await page.locator('#screen-home .tile').first().click();
  await page.locator('#screen-country[data-active]').waitFor();
  await page.locator('#screen-country .card').first().click();
  await page.locator('#screen-tariff[data-active]').waitFor();
  await page.locator('#tariff-buy').click();
  await page.locator('#screen-checkout[data-active]').waitFor();
}

for (const [lang, L] of Object.entries(COPY)) {
  test.describe(`the opener in ${lang}`, () => {
    test('reads as an action, not as a caption', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await installMiniApp(page, { languageCode: L.languageCode, packages: [PACKAGE] });
      await openApp(page);
      await toCheckout(page);

      const opener = page.locator('#checkout-promo .promo__toggle');
      await expect(opener).toBeVisible();
      await expect(opener).toContainText(L.open);
      // The chevron is drawn by the row and hidden from assistive tech: an
      // affordance, not a word to read out.
      await expect(opener.locator('.card__chevron')).toHaveText('›');
      await expect(opener.locator('.card__chevron')).toHaveAttribute('aria-hidden', 'true');

      // A real button, so the keyboard and the screen reader get it for free.
      expect(await opener.evaluate((e) => e.tagName)).toBe('BUTTON');
      expect(await opener.evaluate((e) => e.type)).toBe('button');

      expect(errors).toEqual([]);
    });

    test('the whole row is the target, and the target is big enough to tap', async ({ page }) => {
      await installMiniApp(page, { languageCode: L.languageCode, packages: [PACKAGE] });
      await openApp(page);
      await toCheckout(page);

      const opener = page.locator('#checkout-promo .promo__toggle');
      const box = await opener.boundingBox();
      const container = await page.locator('#checkout-promo').boundingBox();

      // 44px is the app's own --tap. It used to be 36.
      expect(box.height).toBeGreaterThanOrEqual(44);
      // Full width: the row, not the words.
      expect(Math.round(box.width)).toBe(Math.round(container.width));

      // And a tap on the far right — where there is no text — opens the field.
      await page.mouse.click(box.x + box.width - 12, box.y + box.height / 2);
      await expect(page.locator('#checkout-promo-input')).toBeVisible();
    });

    test('opening it still shows the same field, and applying still works', async ({ page }) => {
      await installMiniApp(page, { languageCode: L.languageCode, packages: [PACKAGE] });
      await openApp(page);
      await toCheckout(page);

      await page.locator('#checkout-promo .promo__toggle').click();

      const input = page.locator('#checkout-promo-input');
      await expect(input).toBeVisible();
      await expect(input).toHaveAttribute('aria-label', L.label);
      await expect(page.locator('#checkout-promo .promo__act')).toContainText(L.apply);

      await input.fill('welcome10');
      // The field upper-cases what the customer typed, as it always did.
      await page.locator('#checkout-promo .promo__act').click();

      // The applied state is the pre-existing one: the code and the discount,
      // read from the server's answer and never computed here.
      await expect(page.locator('#checkout-promo .promo-applied')).toBeVisible();
      await expect(page.locator('#checkout-promo .promo-applied')).toContainText('WELCOME10');
      // And the opener is gone, because there is nothing left to open.
      await expect(page.locator('#checkout-promo .promo__toggle')).toHaveCount(0);
    });
  });
}

test.describe('nothing else moved', () => {
  test('the price recalculates from the server answer, as before', async ({ page }) => {
    await installMiniApp(page, {
      packages: [PACKAGE],
      promoQuote: {
        valid: true, promo_code: 'WELCOME10',
        original_amount_rub: 1000, discount_amount_rub: 100, final_amount_rub: 900,
      },
    });
    await openApp(page);
    await toCheckout(page);

    await page.locator('#checkout-promo .promo__toggle').click();
    await page.locator('#checkout-promo-input').fill('WELCOME10');
    await page.locator('#checkout-promo .promo__act').click();

    // The discount the server sent, on screen.
    await expect(page.locator('#checkout-promo .promo-applied')).toContainText('100');

    // And the amount the order will carry is the server's final one. The pay
    // button's LABEL is refreshed when the terms box changes — pre-existing
    // behaviour, not something this change touches — so the test ticks it and
    // reads the label, rather than asserting a refresh that never happened.
    expect(await page.evaluate(() => window.__state && window.__state.intent
      ? window.__state.intent.expected_amount_rub : null)).toBe(900);
    await page.locator('#checkout-terms').check();
    await expect(page.locator('#checkout-pay')).toContainText('900');
  });

  test('an already-applied code keeps its existing display', async ({ page }) => {
    await installMiniApp(page, { packages: [PACKAGE] });
    await openApp(page);
    await toCheckout(page);

    await page.locator('#checkout-promo .promo__toggle').click();
    await page.locator('#checkout-promo-input').fill('WELCOME10');
    await page.locator('#checkout-promo .promo__act').click();
    await expect(page.locator('#checkout-promo .promo-applied')).toBeVisible();

    // Removing it brings the opener back, in its new form.
    await page.locator('#checkout-promo .promo-applied .promo__act').click();
    await expect(page.locator('#checkout-promo-input')).toBeVisible();
  });

  test('the opener does not compete with the pay button', async ({ page }) => {
    await installMiniApp(page, { packages: [PACKAGE] });
    await openApp(page);
    await toCheckout(page);

    // The primary action is filled; the opener is a bordered card. If the two
    // ever share a background, the screen has two primary actions.
    const bg = (sel) => page.locator(sel).evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(await bg('#checkout-promo .promo__toggle')).not.toBe(await bg('#checkout-pay'));
  });

  test('nothing overflows at either viewport, open or closed', async ({ page }) => {
    await installMiniApp(page, { packages: [PACKAGE] });
    await openApp(page);
    await toCheckout(page);

    expect(await overflowingInside(page, '#checkout-promo')).toEqual([]);
    await page.locator('#checkout-promo .promo__toggle').click();
    expect(await overflowingInside(page, '#checkout-promo')).toEqual([]);

    const box = await page.locator('#checkout-promo').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
  });
});


// ---------------------------------------------------------------------------
// The invitation retires once its code has been used, 2026-09-03
// ---------------------------------------------------------------------------
//
// A block that says «get a code» to somebody who has the code, and has just
// spent it, is clutter. It goes when — and only when — THAT code is applied.

/** Subscribe, verify, and come away holding the code. */
async function earnTheCode(page) {
  await page.locator('#promo-channel').click();
  await page.locator('#promo-verify').click();
  await expect(page.locator('.promo__code-value')).toHaveText('WELCOME10');
}

const backHome = async (page) => {
  await page.locator('.tab').first().click();
  await page.locator('#screen-home[data-active]').waitFor();
};

test.describe('the invitation after the code is used', () => {
  test('A: before anything is applied, it is on screen', async ({ page }) => {
    await installMiniApp(page, { packages: [PACKAGE], channelSubscription: 'yes' });
    await openApp(page);
    await expect(page.locator('#home-promo')).toBeVisible();
  });

  test('B: holding the code is not using it — the block stays', async ({ page }) => {
    await installMiniApp(page, { packages: [PACKAGE], channelSubscription: 'yes' });
    await openApp(page);
    await earnTheCode(page);

    // Still there, still showing the code it just handed over.
    await expect(page.locator('#home-promo')).toBeVisible();
    await expect(page.locator('.promo__code-value')).toHaveText('WELCOME10');
  });

  test('C: applying it at checkout retires the block, and it is gone on return', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await installMiniApp(page, { packages: [PACKAGE], channelSubscription: 'yes' });
    await openApp(page);
    await earnTheCode(page);

    await toCheckout(page);
    await page.locator('#checkout-promo .promo__toggle').click();
    await page.locator('#checkout-promo-input').fill('WELCOME10');
    await page.locator('#checkout-promo .promo__act').click();
    await expect(page.locator('#checkout-promo .promo-applied')).toBeVisible();

    // The discount survives the block disappearing — hiding a block on another
    // screen must not touch the checkout.
    expect(await page.evaluate(() => window.__state.promo && window.__state.promo.code)).toBe('WELCOME10');
    expect(await page.evaluate(() => window.__state.intent.expected_amount_rub)).toBe(900);

    await backHome(page);
    await expect(page.locator('#home-promo')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('D: an apply that FAILED leaves the invitation alone', async ({ page }) => {
    await installMiniApp(page, {
      packages: [PACKAGE], channelSubscription: 'yes',
      promoQuote: { valid: false, error: 'PROMO_CODE_NOT_FOUND' },
    });
    await openApp(page);
    await earnTheCode(page);

    await toCheckout(page);
    await page.locator('#checkout-promo .promo__toggle').click();
    await page.locator('#checkout-promo-input').fill('WELCOME10');
    await page.locator('#checkout-promo .promo__act').click();
    await expect(page.locator('#checkout-promo .promo-applied')).toHaveCount(0);

    // They can still fix it and try again, so the offer must still be there.
    await backHome(page);
    await expect(page.locator('#home-promo')).toBeVisible();
  });

  test('E: somebody else\'s promo code does not dismiss this invitation', async ({ page }) => {
    await installMiniApp(page, {
      packages: [PACKAGE], channelSubscription: 'yes',
      promoQuote: {
        valid: true, promo_code: 'FRIENDS10',
        original_amount_rub: 1000, discount_amount_rub: 100, final_amount_rub: 900,
      },
    });
    await openApp(page);
    await earnTheCode(page);

    await toCheckout(page);
    await page.locator('#checkout-promo .promo__toggle').click();
    await page.locator('#checkout-promo-input').fill('FRIENDS10');
    await page.locator('#checkout-promo .promo__act').click();
    await expect(page.locator('#checkout-promo .promo-applied')).toContainText('FRIENDS10');

    await backHome(page);
    await expect(page.locator('#home-promo')).toBeVisible();
  });

  test('a code applied without ever having been offered here changes nothing', async ({ page }) => {
    // No subscription check, so the app never learned which code is the
    // invitation's. It must not guess from the string.
    await installMiniApp(page, { packages: [PACKAGE], channelSubscription: 'yes' });
    await openApp(page);

    await toCheckout(page);
    await page.locator('#checkout-promo .promo__toggle').click();
    await page.locator('#checkout-promo-input').fill('WELCOME10');
    await page.locator('#checkout-promo .promo__act').click();
    await expect(page.locator('#checkout-promo .promo-applied')).toBeVisible();

    await backHome(page);
    await expect(page.locator('#home-promo')).toBeVisible();
  });

  test('the subscription flow itself is untouched, and nothing overflows', async ({ page }) => {
    await installMiniApp(page, { packages: [PACKAGE], channelSubscription: 'yes' });
    await openApp(page);
    await earnTheCode(page);

    expect(await overflowingInside(page, '#home-promo')).toEqual([]);
    await toCheckout(page);
    await page.locator('#checkout-promo .promo__toggle').click();
    await page.locator('#checkout-promo-input').fill('WELCOME10');
    await page.locator('#checkout-promo .promo__act').click();
    await backHome(page);

    // Hidden, not destroyed — and the catalogue below it is where it was.
    await expect(page.locator('#home-promo')).toBeHidden();
    await expect(page.locator('#home-countries .tile').first()).toBeVisible();
  });
});
