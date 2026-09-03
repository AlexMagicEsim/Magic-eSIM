'use strict';

/**
 * The channel invitation, and the promo code it guards.
 *
 * The property that matters most is a NEGATIVE one: WELCOME10 must not exist
 * anywhere in the app until a server has confirmed a real channel membership.
 * A test that only checks the happy path would pass just as well against a
 * build that shipped the code in the bundle and merely hid it — so the first
 * assertions here look for the string in the whole document, scripts included.
 */
const { test, expect } = require('@playwright/test');
const { installMiniApp, openApp, callsTo, overflowingInside, PACKAGE } = require('./harness');

const CHANNEL = 'https://t.me/magicesim';
const CODE = 'WELCOME10';
const CHECK = '/api/v1/tma/channel/subscription/check';

const COPY = {
  ru: {
    languageCode: 'ru',
    title: 'Скидка 10% на первую покупку',
    text: 'Подпишитесь на канал Magic eSIM и получите промокод',
    cta: 'Подписаться на канал',
    verify: 'Проверить подписку',
    notFound: 'Подписка пока не найдена. Подпишитесь на канал и попробуйте ещё раз.',
    codeLabel: 'Промокод',
  },
  en: {
    languageCode: 'de',
    title: '10% off your first purchase',
    text: 'Follow the Magic eSIM channel and get a 10% discount code',
    cta: 'Follow the channel',
    verify: 'Check subscription',
    notFound: 'Subscription not found yet. Follow the channel and try again.',
    codeLabel: 'Promo code',
  },
};

/** The code, anywhere in the delivered document — text, attributes, scripts. */
const codeIsAnywhere = (page) => page.evaluate((code) => {
  if (document.documentElement.outerHTML.includes(code)) return 'markup';
  for (const s of document.scripts) if ((s.textContent || '').includes(code)) return 'inline script';
  return null;
}, CODE);

test.describe('before any verification', () => {
  test('the promo code is nowhere in the app — not hidden, not in an attribute', async ({ page }) => {
    await installMiniApp(page);
    await openApp(page);

    await expect(page.locator('#home-promo')).toBeVisible();
    expect(await codeIsAnywhere(page)).toBe(null);
    // Nor in the files the page loads: the bundle must not carry it either.
    const bundles = await page.evaluate(async () => {
      const out = [];
      for (const src of ['ui.js', 'core.js', 'locales.js', 'i18n.js']) {
        const r = await fetch(src).catch(() => null);
        if (r && r.ok) out.push((await r.text()).includes('WELCOME' + '10'));
      }
      return out;
    });
    expect(bundles).not.toContain(true);
  });

  test('both controls are on screen from the start, and the reward is not', async ({ page }) => {
    await installMiniApp(page);
    await openApp(page);

    await expect(page.locator('#promo-channel')).toBeVisible();
    // Always present — see the note in index.html. The version that revealed it
    // on the channel tap lost a real customer their code, because returning
    // from the channel restarts the Mini App and the flag died with the page.
    await expect(page.locator('#promo-verify')).toBeVisible();
    await expect(page.locator('#promo-reward')).toBeHidden();

    await page.locator('#promo-channel').click();
    // Opening the channel proves nothing on its own.
    expect(await codeIsAnywhere(page)).toBe(null);
  });

  test('THE RELOAD: the check survives Telegram restarting the app', async ({ page }) => {
    // The defect this file did not catch, reproduced. Production on 2026-09-03
    // minted four sessions in four minutes: every return from the channel is a
    // cold start, and the customer came back to a screen with nothing to press.
    // A test that clicks and asserts in one page life cannot see that.
    const state = await installMiniApp(page, { channelSubscription: 'yes' });
    await openApp(page);

    await page.locator('#promo-channel').click();
    expect(await page.evaluate(() => window.__opened)).toBe(CHANNEL);

    // Telegram brings the app back from scratch — a new document, a new session.
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#screen-loading[data-active]'), null, { timeout: 15_000 });

    await expect(page.locator('#home-promo')).toBeVisible();
    await expect(page.locator('#promo-verify')).toBeVisible();
    expect(await codeIsAnywhere(page)).toBe(null);

    // And it still works: one tap, and the code appears.
    await page.locator('#promo-verify').click();
    await expect(page.locator('.promo__code-value')).toHaveText(CODE);
    expect(callsTo(state, CHECK)).toBe(1);
  });

  test('THE RELOAD: a subscriber who never taps the channel button can still check', async ({ page }) => {
    // The shape the old version made impossible: somebody who subscribed from
    // the channel itself, or on another device, and opens the app fresh.
    await installMiniApp(page, { channelSubscription: 'yes' });
    await openApp(page);

    await page.locator('#promo-verify').click();          // no channel tap at all
    await expect(page.locator('.promo__code-value')).toHaveText(CODE);
  });
});

for (const [lang, L] of Object.entries(COPY)) {
  test.describe(`copy in ${lang}`, () => {
    test('every state reads correctly', async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await installMiniApp(page, { languageCode: L.languageCode, channelSubscription: 'no' });
      await openApp(page);

      await expect(page.locator('#home-promo')).toContainText(L.title);
      await expect(page.locator('#home-promo')).toContainText(L.text);
      await expect(page.locator('#promo-channel')).toHaveText(L.cta);

      await page.locator('#promo-channel').click();
      await expect(page.locator('#promo-verify')).toHaveText(L.verify);

      await page.locator('#promo-verify').click();
      await expect(page.locator('#promo-note')).toHaveText(L.notFound);
      expect(errors).toEqual([]);
    });

    test('a confirmed subscriber sees the code and its label', async ({ page }) => {
      await installMiniApp(page, { languageCode: L.languageCode, channelSubscription: 'yes' });
      await openApp(page);

      await page.locator('#promo-channel').click();
      await page.locator('#promo-verify').click();

      await expect(page.locator('#promo-reward')).toBeVisible();
      await expect(page.locator('#promo-reward')).toContainText(L.codeLabel);
      await expect(page.locator('.promo__code-value')).toHaveText(CODE);
    });
  });
}

test.describe('the verdict comes from the server', () => {
  test('subscribed=false shows the calm line and no code, and can be retried', async ({ page }) => {
    const state = await installMiniApp(page, { channelSubscription: 'no' });
    await openApp(page);

    await page.locator('#promo-channel').click();
    await page.locator('#promo-verify').click();

    await expect(page.locator('#promo-note')).toBeVisible();
    await expect(page.locator('#promo-reward')).toBeHidden();
    expect(await codeIsAnywhere(page)).toBe(null);

    // Both ways out are still there, and a second check is a second request —
    // one per tap, never a timer.
    await expect(page.locator('#promo-channel')).toBeVisible();
    await expect(page.locator('#promo-verify')).toBeVisible();
    const asked = callsTo(state, CHECK);
    await page.locator('#promo-verify').click();
    await expect.poll(() => callsTo(state, CHECK)).toBe(asked + 1);
  });

  test('a check that could not run says so, and does not call anybody unsubscribed', async ({ page }) => {
    await installMiniApp(page, { channelSubscription: 'error' });
    await openApp(page);

    await page.locator('#promo-channel').click();
    await page.locator('#promo-verify').click();

    await expect(page.locator('#promo-note')).toContainText(/Не удалось|Could not/);
    await expect(page.locator('#promo-reward')).toBeHidden();
    expect(await codeIsAnywhere(page)).toBe(null);
  });

  test('nothing is asked until the customer asks — there is no polling', async ({ page }) => {
    const state = await installMiniApp(page, { channelSubscription: 'yes' });
    await openApp(page);

    await page.waitForTimeout(1200);
    expect(callsTo(state, CHECK)).toBe(0);

    await page.locator('#promo-channel').click();
    await page.waitForTimeout(600);
    expect(callsTo(state, CHECK)).toBe(0);   // opening the channel is not a check

    await page.locator('#promo-verify').click();
    await expect.poll(() => callsTo(state, CHECK)).toBe(1);
    await page.waitForTimeout(1200);
    expect(callsTo(state, CHECK)).toBe(1);   // and it does not repeat on its own
  });
});

test.describe('the tap and its telemetry', () => {
  test('opens exactly the channel, through Telegram, without closing the app', async ({ page }) => {
    await installMiniApp(page);
    await openApp(page);
    await page.locator('#promo-channel').click();

    expect(await page.evaluate(() => window.__opened)).toBe(CHANNEL);
    await expect(page.locator('#screen-home[data-active]')).toBeVisible();
  });

  test('channel_click once per tap, and the verified event only on a yes', async ({ page }) => {
    const state = await installMiniApp(page, { channelSubscription: 'no' });
    await openApp(page);

    const before = callsTo(state, '/api/v1/tma/events');
    await page.locator('#promo-channel').click();
    await expect.poll(() => callsTo(state, '/api/v1/tma/events')).toBe(before + 1);

    await page.locator('#promo-verify').click();          // check fires one more
    await expect.poll(() => callsTo(state, '/api/v1/tma/events')).toBe(before + 2);
    await expect(page.locator('#promo-note')).toBeVisible();
    // A «no» must not emit the verified event: that would be a false positive
    // in the only number this block exists to produce.
    await page.waitForTimeout(300);
    expect(callsTo(state, '/api/v1/tma/events')).toBe(before + 2);
  });

  test('does not touch the session or its acquisition', async ({ page }) => {
    const state = await installMiniApp(page, { channelSubscription: 'yes' });
    await openApp(page);

    const sessions = callsTo(state, '/api/v1/tma/session');
    const token = await page.evaluate(() => window.MagicCore && window.MagicCore.__testToken);

    await page.locator('#promo-channel').click();
    await page.locator('#promo-verify').click();
    await expect(page.locator('#promo-reward')).toBeVisible();

    expect(callsTo(state, '/api/v1/tma/session')).toBe(sessions);
    expect(await page.evaluate(() => window.MagicCore && window.MagicCore.__testToken)).toBe(token);
  });
});

test.describe('it stays out of the way', () => {
  test('country → tariff still works', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await installMiniApp(page, { packages: [PACKAGE] });
    await openApp(page);

    await expect(page.locator('#home-countries .tile').first()).toBeVisible();
    await page.locator('#screen-home .tile').first().click();
    await page.locator('#screen-country[data-active]').waitFor();
    await page.locator('#screen-country .card').first().click();
    await page.locator('#screen-tariff[data-active]').waitFor();

    await expect(page.locator('#home-promo')).not.toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the search field is still above it', async ({ page }) => {
    await installMiniApp(page);
    await openApp(page);
    const search = await page.locator('#search').boundingBox();
    const promo = await page.locator('#home-promo').boundingBox();
    expect(search.y).toBeLessThan(promo.y);
  });

  test('nothing overflows, in any state', async ({ page }) => {
    await installMiniApp(page, { channelSubscription: 'yes' });
    await openApp(page);
    expect(await overflowingInside(page, '#home-promo')).toEqual([]);

    await page.locator('#promo-channel').click();
    await page.locator('#promo-verify').click();
    await expect(page.locator('#promo-reward')).toBeVisible();
    expect(await overflowingInside(page, '#home-promo')).toEqual([]);

    const promo = await page.locator('#home-promo').boundingBox();
    expect(promo.x).toBeGreaterThanOrEqual(0);
    expect(promo.x + promo.width).toBeLessThanOrEqual(page.viewportSize().width);
  });
});

test.describe('a customer who has already bought', () => {
  // The promo is first-purchase-only: the checkout would refuse this person,
  // so the app must not put the offer in front of them. The server decides;
  // the app never guesses.

  test('never sees the code, and the block goes quietly', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await installMiniApp(page, { channelSubscription: 'yes', channelEligible: false });
    await openApp(page);

    // It is offered on first paint — the app has asked nothing yet, by design.
    await expect(page.locator('#home-promo')).toBeVisible();

    await page.locator('#promo-channel').click();
    await page.locator('#promo-verify').click();

    // Gone. Not hidden with the promise still in the page, and no popup,
    // toast or error explaining a discount that was never theirs.
    await expect(page.locator('#home-promo')).toBeHidden();
    expect(await codeIsAnywhere(page)).toBe(null);
    expect(errors).toEqual([]);
  });

  test('the same is true for one who is not subscribed either', async ({ page }) => {
    await installMiniApp(page, { channelSubscription: 'no', channelEligible: false });
    await openApp(page);
    await page.locator('#promo-channel').click();
    await page.locator('#promo-verify').click();

    await expect(page.locator('#home-promo')).toBeHidden();
    expect(await codeIsAnywhere(page)).toBe(null);
  });

  test('the catalogue is untouched by the block disappearing', async ({ page }) => {
    await installMiniApp(page, { packages: [PACKAGE], channelSubscription: 'yes', channelEligible: false });
    await openApp(page);
    await page.locator('#promo-channel').click();
    await page.locator('#promo-verify').click();
    await expect(page.locator('#home-promo')).toBeHidden();

    // The country list is exactly where it was, and still works.
    await expect(page.locator('#home-countries .tile').first()).toBeVisible();
    await page.locator('#screen-home .tile').first().click();
    await page.locator('#screen-country[data-active]').waitFor();
  });

  test('eligibility costs no request on open — it rides the check', async ({ page }) => {
    const state = await installMiniApp(page, { channelSubscription: 'yes', channelEligible: false });
    await openApp(page);
    await page.waitForTimeout(800);

    // The home screen asked nobody anything: not the check, not /tma/me.
    expect(callsTo(state, CHECK)).toBe(0);
    expect(callsTo(state, '/api/v1/tma/me')).toBe(0);

    await page.locator('#promo-channel').click();
    await page.locator('#promo-verify').click();
    await expect(page.locator('#home-promo')).toBeHidden();

    // Exactly one request answered both questions.
    expect(callsTo(state, CHECK)).toBe(1);
    expect(callsTo(state, '/api/v1/tma/me')).toBe(0);
  });
});
