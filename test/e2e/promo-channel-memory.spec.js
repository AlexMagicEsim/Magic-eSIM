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
// The invitation — title, text, «Подписаться», «Проверить» — as opposed to the
// block, which also holds the one line a confirmed subscriber still needs.
const INVITE = '#promo-invite';
const CODE = '.promo__code-value';

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

  // The invitation is gone — that is the bug. The code is not: it is still
  // theirs, still unredeemed, and this is the only place it is ever shown.
  await expect(page.locator(INVITE)).toBeHidden();
  await expect(page.locator(CODE)).toHaveText('WELCOME10');
  await expect(page.locator(BLOCK)).toContainText('Ваш промокод');
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
      // REAL GEOMETRY, not the `hidden` attribute. The first version read
      // `#promo-invite`.hidden, which is false while its parent aside is hidden
      // — nothing is on screen and the probe said it was. What a customer sees
      // is what has height.
      const b = document.querySelector('#promo-invite');
      window.__promoSeen.push(Boolean(b && b.getBoundingClientRect().height > 0));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await openApp(page);
  await page.waitForTimeout(SETTLE + 600);

  const everVisible = await page.evaluate(() => window.__promoSeen.some(Boolean));
  expect(everVisible, 'приглашение мелькнуло до ответа сервера').toBe(false);
  await expect(page.locator(INVITE)).toBeHidden();
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
  await expect(page.locator(INVITE)).toBeHidden();
  await expect(page.locator(CODE)).toHaveText('WELCOME10');
});

test('F: an expired confirmation re-checks in the background and stays hidden', async ({ page }) => {
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: true, confirmed: true, stale: true, checked: true },
  });
  await openApp(page);

  await expect.poll(() => callsTo(state, CHECK)).toBe(1);
  await page.waitForTimeout(SETTLE);

  // Unchanged the whole way through: the screen already showed the right thing,
  // and a revalidation must not make it blink.
  await expect(page.locator(INVITE)).toBeHidden();
  await expect(page.locator(CODE)).toHaveText('WELCOME10');
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

  // Not demoted: no invitation, and the code they earned is still on screen.
  await expect(page.locator(INVITE)).toBeHidden();
  await expect(page.locator(CODE)).toHaveText('WELCOME10');
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
  await expect(page.locator(INVITE)).toBeHidden();
  await expect(page.locator(CODE)).toHaveText('WELCOME10');
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
      // REAL GEOMETRY, not the `hidden` attribute. The first version read
      // `#promo-invite`.hidden, which is false while its parent aside is hidden
      // — nothing is on screen and the probe said it was. What a customer sees
      // is what has height.
      const b = document.querySelector('#promo-invite');
      window.__promoSeen.push(Boolean(b && b.getBoundingClientRect().height > 0));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await openApp(page);
  await page.waitForTimeout(SETTLE);

  expect(await page.evaluate(() => window.__promoSeen.some(Boolean)),
    'приглашение мелькнуло перед тем, как скрыться').toBe(false);
  await expect(page.locator(INVITE)).toBeHidden();
  await expect(page.locator(CODE)).toHaveText('WELCOME10');
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
 * The compact state — what a confirmed subscriber is left holding
 * ================================================================== */

test('REOPEN: confirm, close, open again — no invitation, code still there', async ({ page }) => {
  // The whole bug and the whole fix in one journey. The second launch is a
  // genuinely new document: Telegram discards the first, which is why nothing
  // the page remembered could ever have survived.
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: true, confirmed: false, stale: false, checked: true },
  });
  await openApp(page);

  await page.locator('#promo-verify').click();
  await expect(page.locator(CODE)).toHaveText('WELCOME10');
  await expect(page.locator(INVITE)).toBeHidden();

  // Telegram restarts the app, and the server is what remembers.
  await page.evaluate(() => { window.__sessionChannel = null; });
  await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: true, confirmed: true, stale: false, checked: true },
  });
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#screen-loading[data-active]'),
    null, { timeout: 15_000 });

  await expect(page.locator(INVITE)).toBeHidden();
  await expect(page.locator(CODE)).toHaveText('WELCOME10');
  await expect(page.locator(BLOCK)).toContainText('Ваш промокод');
});

test('REOPEN: and the compact line costs no Telegram call', async ({ page }) => {
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: true, confirmed: true, stale: false, checked: true },
  });
  await openApp(page);
  await page.waitForTimeout(SETTLE);

  await expect(page.locator(CODE)).toHaveText('WELCOME10');
  expect(callsTo(state, CHECK)).toBe(0);
});

test('FIRST PURCHASE MADE: the code line goes too, not just the invitation', async ({ page }) => {
  // Eligibility is what the line is FOR. Once the customer has bought, the code
  // would be refused at checkout, and «Ваш промокод: WELCOME10» about a code
  // that no longer works is a promise rather than information — worse than the
  // invitation it replaced, because it reads as something they still hold.
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: false, confirmed: true, stale: false, checked: true },
  });
  await openApp(page);
  await page.waitForTimeout(SETTLE);

  await expect(page.locator(BLOCK)).toBeHidden();
  await expect(page.locator(INVITE)).toBeHidden();
  expect(await page.locator('body').innerText()).not.toContain('WELCOME10');
  // And no round trip was spent discovering it: a paid order never unpays, so
  // the session answers this from data we already own.
  expect(callsTo(state, CHECK)).toBe(0);
});

test('FIRST PURCHASE MADE: the server never sends the code to somebody ineligible', async ({ page }) => {
  // Belt and braces at the boundary rather than in the renderer: even if the
  // block said «confirmed», an ineligible customer must not receive the string.
  // The harness derives `promo_code` by the service's own rule, so this asserts
  // that rule and not a fixture's kindness.
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: false, confirmed: true, stale: false, checked: true },
  });
  await openApp(page);
  await page.waitForTimeout(SETTLE);

  const session = state.calls.find((c) => c.path.endsWith('/api/v1/tma/session'));
  expect(session, 'сессия должна была открыться').toBeTruthy();
  const html = await page.content();
  expect(html).not.toContain('WELCOME10');
});

test('a background re-check that reports the purchase takes the line away at once', async ({ page }) => {
  // The other route to the same fact, and it was not covered: the session said
  // eligible, the stale re-check says otherwise. A mutation that made this
  // branch show the code instead of hiding it survived every other test in this
  // file — the line would have stayed on screen describing a code the checkout
  // had already started refusing.
  const state = await installMiniApp(page, {
    channelSubscription: 'yes',
    channelEligible: false,   // what the CHECK answers
    sessionChannel: { eligible: true, confirmed: true, stale: true, checked: true },
  });
  await openApp(page);

  await expect.poll(() => callsTo(state, CHECK)).toBe(1);
  await page.waitForTimeout(SETTLE);

  await expect(page.locator(BLOCK)).toBeHidden();
  await expect(page.locator(INVITE)).toBeHidden();
});

test('losing eligibility LATER takes the line away on the next launch', async ({ page }) => {
  // They held the code, then bought something with a different one. The line
  // must not outlive the thing it describes.
  await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: true, confirmed: true, stale: false, checked: true },
  });
  await openApp(page);
  await expect(page.locator(CODE)).toHaveText('WELCOME10');

  await installMiniApp(page, {
    channelSubscription: 'yes',
    sessionChannel: { eligible: false, confirmed: true, stale: false, checked: true },
  });
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#screen-loading[data-active]'),
    null, { timeout: 15_000 });
  await page.waitForTimeout(SETTLE);

  await expect(page.locator(BLOCK)).toBeHidden();
  expect(await page.locator('body').innerText()).not.toContain('WELCOME10');
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
