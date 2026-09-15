'use strict';

/*
 * The invitation remembers, and what it remembers it learns from the server.
 *
 * WHY THIS FILE EXISTS. A customer who was already in the channel and had
 * already pressed «Проверить подписку» met the invitation again on every single
 * launch — «Подпишитесь на канал Magic eSIM» shown to somebody who had
 * subscribed, with the code they had earned gone. The reason was not subtle:
 * the only thing that could hide the block was `state.channelBlockDone`, a field
 * in a plain object that Telegram throws away every time it restarts the Mini
 * App — and returning from the channel IS a restart, four sessions in four
 * minutes on record.
 *
 * The worse half of the same defect had no bug report at all: a customer who has
 * already BOUGHT is permanently ineligible for a first-purchase code, and was
 * shown the offer forever, burning a getChatMember every time they tapped to
 * find out.
 *
 * WHAT IS UNDER TEST is therefore not «does the banner hide» but where the
 * decision comes from and what it costs:
 *
 *   * the session round trip the app already makes carries the answer, so a
 *     confirmed subscriber costs ZERO extra requests and asks Telegram nothing;
 *   * the block ships hidden, so «not yet told» never renders an invitation —
 *     there is no state in which it appears and is then taken away;
 *   * a Telegram failure is not an answer. A confirmed customer stays confirmed
 *     through a timeout; only Telegram saying left/kicked brings the block back.
 *
 * The existing promo-channel.spec.js still owns the tap itself: what the two
 * controls do, what the three strings say, and that the code is nowhere in the
 * bundle. This file owns memory across launches.
 */

const { test, expect } = require('@playwright/test');
const { installMiniApp, openApp } = require('./harness.js');

const CHECK = '/api/v1/tma/channel/subscription/check';
const BLOCK = '#home-promo';

const callsTo = (state, path) => state.calls.filter((c) => c.path.endsWith(path)).length;

/** Long enough that a banner appearing late would have appeared. */
const SETTLE = 900;

/* ================================================================== *
 * A, B. The states a first-time visitor moves through
 * ================================================================== */

test('A: a new customer who has never been asked sees the invitation', async ({ page }) => {
  const state = await installMiniApp(page, {
    channelSubscription: 'no',
    sessionChannel: { eligible: true, confirmed: false, stale: false, checked: false },
  });
  await openApp(page);

  await expect(page.locator(BLOCK)).toBeVisible();
  await expect(page.locator('#promo-channel')).toBeVisible();
  await expect(page.locator('#promo-verify')).toBeVisible();
});

test('B: confirming the membership works exactly as it did, and the code appears', async ({ page }) => {
  // The point of this one is that the fix did NOT change the successful tap.
  // Hiding the block the instant it succeeds would make the code the customer
  // just earned flash past them; it stays until the next launch, and the server
  // is what remembers.
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: true, confirmed: false, stale: false, checked: true },
  });
  await openApp(page);

  await expect(page.locator(BLOCK)).toBeVisible();
  await page.locator('#promo-verify').click();

  await expect(page.locator('.promo__code-value')).toHaveText('WELCOME10');
  await expect(page.locator('#promo-verify')).toBeHidden();
  await expect(page.locator(BLOCK)).toBeVisible();
});

/* ================================================================== *
 * C, D. The bug, and the thing that must not replace it
 * ================================================================== */

test('C: THE BUG — a confirmed subscriber reopens and is not asked again', async ({ page }) => {
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: true, confirmed: true, stale: false, checked: true },
  });
  await openApp(page);
  await page.waitForTimeout(SETTLE);

  await expect(page.locator(BLOCK)).toBeHidden();
  // And it cost nothing: the session already knew, so Telegram was never asked.
  expect(callsTo(state, CHECK)).toBe(0);
});

test('D: no flash — the invitation is never on screen before the answer arrives', async ({ page }) => {
  // The failure this prevents is worse than the bug it replaces: showing
  // «Подпишитесь на канал» to a subscriber for 300 ms and then snatching it away
  // reads as a broken page. The block ships hidden, so there is no first paint
  // in which it exists.
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: true, confirmed: true, stale: false, checked: true },
    // The session is the gating latency in production — a cold gateway is
    // seconds. Slow it down so any flash has time to be seen.
    sessionDelayMs: 600,
  });

  const seen = [];
  await page.addInitScript(() => {
    window.__promoSeen = [];
    const tick = () => {
      const b = document.querySelector('#home-promo');
      if (b) window.__promoSeen.push(b.hidden === false);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await openApp(page);
  await page.waitForTimeout(SETTLE + 600);

  const everVisible = await page.evaluate(() => window.__promoSeen.some(Boolean));
  expect(everVisible, 'приглашение мелькнуло до ответа сервера').toBe(false);
  await expect(page.locator(BLOCK)).toBeHidden();
});

/* ================================================================== *
 * E, F, G, H. The TTL, and the asymmetry of its failure directions
 * ================================================================== */

test('E: a fresh confirmation asks Telegram nothing', async ({ page }) => {
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: true, confirmed: true, stale: false, checked: true },
  });
  await openApp(page);
  await page.waitForTimeout(SETTLE);

  expect(callsTo(state, CHECK)).toBe(0);
  await expect(page.locator(BLOCK)).toBeHidden();
});

test('F: an expired confirmation re-checks in the background and stays hidden', async ({ page }) => {
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: true, confirmed: true, stale: true, checked: true },
  });
  await openApp(page);

  await expect.poll(() => callsTo(state, CHECK)).toBe(1);
  await page.waitForTimeout(SETTLE);

  // Hidden the whole way through: the screen already showed the right thing, and
  // a revalidation must not make it blink.
  await expect(page.locator(BLOCK)).toBeHidden();
  expect(callsTo(state, CHECK)).toBe(1);
});

test('G: Telegram says they left — the invitation comes back', async ({ page }) => {
  const state = await installMiniApp(page, {
    channelSubscription: 'no',   // authoritative: a 200 saying subscribed: false
    sessionChannel: { eligible: true, confirmed: true, stale: true, checked: true },
  });
  await openApp(page);

  await expect.poll(() => callsTo(state, CHECK)).toBe(1);
  await expect(page.locator(BLOCK)).toBeVisible();
});

test('H: Telegram could not be asked — a confirmed customer is NOT demoted', async ({ page }) => {
  // The mistake this exists to prevent: a 503 is silence, not a denial, and
  // treating it as one takes a code away from somebody who did subscribe.
  const state = await installMiniApp(page, {
    channelSubscription: 'error',
    sessionChannel: { eligible: true, confirmed: true, stale: true, checked: true },
  });
  await openApp(page);

  await expect.poll(() => callsTo(state, CHECK)).toBe(1);
  await page.waitForTimeout(SETTLE);

  await expect(page.locator(BLOCK)).toBeHidden();
});

/* ================================================================== *
 * I. The customer this fix is for
 * ================================================================== */

test('I: someone subscribed before any of this was stored is found automatically', async ({ page }) => {
  // No record on the server, because the record did not exist when they
  // confirmed. One automatic check, and they never press the button again.
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: true, confirmed: false, stale: false, checked: false },
  });
  await openApp(page);

  await expect.poll(() => callsTo(state, CHECK)).toBe(1);
  await expect(page.locator(BLOCK)).toBeHidden();
  // Never pressed anything.
  expect(state.calls.filter((c) => c.event === 'channel_subscription_check').length).toBe(0);
});

test('I: and once Telegram has answered no, it is not asked again on the next launch', async ({ page }) => {
  // The other half of the same decision. Without it, somebody who will never
  // subscribe would cost a getChatMember on every single cold start.
  const state = await installMiniApp(page, {
    channelSubscription: 'no',
    sessionChannel: { eligible: true, confirmed: false, stale: false, checked: true },
  });
  await openApp(page);
  await page.waitForTimeout(SETTLE);

  await expect(page.locator(BLOCK)).toBeVisible();
  expect(callsTo(state, CHECK)).toBe(0);
});

test('the automatic discovery is bounded — a slow answer does not leave a gap', async ({ page }) => {
  // The customer this offer exists for is a new arrival from an ad, who is
  // `checked: false` by definition. The discovery rides a session that can take
  // twelve seconds on a cold gateway and then has a twenty-second timeout of its
  // own, so without a bound they wait half a minute for a discount banner — or
  // never see it at all, which is indistinguishable from not having one.
  const state = await installMiniApp(page, {
    channelSubscription: 'no',
    sessionChannel: { eligible: true, confirmed: false, stale: false, checked: false },
    checkDelayMs: 6000,
  });
  await openApp(page);

  // Appears without waiting for the answer.
  await expect(page.locator(BLOCK)).toBeVisible({ timeout: 4000 });
  await expect(page.locator('#promo-verify')).toBeVisible();
});

test('but a quick answer still hides it, with no flash', async ({ page }) => {
  // The other side of the same bound: the legacy subscriber the discovery exists
  // for normally answers in milliseconds, and must never see the invitation.
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: true, confirmed: false, stale: false, checked: false },
  });

  await page.addInitScript(() => {
    window.__promoSeen = [];
    const tick = () => {
      const b = document.querySelector('#home-promo');
      if (b) window.__promoSeen.push(b.hidden === false);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await openApp(page);
  await page.waitForTimeout(SETTLE);

  expect(await page.evaluate(() => window.__promoSeen.some(Boolean)),
    'приглашение мелькнуло перед тем, как скрыться').toBe(false);
  await expect(page.locator(BLOCK)).toBeHidden();
});

/* ================================================================== *
 * The half nobody reported
 * ================================================================== */

test('a customer who has already bought is not offered a first-purchase code', async ({ page }) => {
  // Permanent and derived: a paid order never unpays, so this costs no storage
  // and no Telegram call, now or ever.
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: false, confirmed: false, stale: false, checked: false },
  });
  await openApp(page);
  await page.waitForTimeout(SETTLE);

  await expect(page.locator(BLOCK)).toBeHidden();
  expect(callsTo(state, CHECK)).toBe(0);
});

/* ================================================================== *
 * When the server says nothing
 * ================================================================== */

test('a response without the field falls back to offering, not to refusing', async ({ page }) => {
  // An older backend, a read that failed, a session that never resolved. We
  // cannot tell, and «cannot tell» must never hide an offer from somebody
  // entitled to it — the server still decides on the tap.
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: null,
  });
  await openApp(page);
  await page.waitForTimeout(SETTLE);

  await expect(page.locator(BLOCK)).toBeVisible();
  await expect(page.locator('#promo-verify')).toBeVisible();
  expect(callsTo(state, CHECK)).toBe(0);
});
