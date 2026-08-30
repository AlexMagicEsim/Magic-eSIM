'use strict';

/**
 * What the Mini App is allowed to see during a browser test.
 *
 * TWO SEAMS, and the choice of seam matters.
 *
 *   1. `addInitScript` installs a fake `Telegram.WebApp` BEFORE any page script
 *      runs. It has to be before: `ui.js` reads `window.Telegram` on its first
 *      line, and `i18n.js` reads `initDataUnsafe.user.language_code` while
 *      building its default instance.
 *
 *   2. `page.route` intercepts at the NETWORK layer. This is the part an
 *      earlier hand-rolled harness got wrong: it replaced `window.fetch` after
 *      load, but `core.js` captures `window.fetch.bind(window)` when the app
 *      boots, so the replacement was never called and a "reproduction" of a
 *      race condition reproduced nothing. Routing does not care when the
 *      reference was taken.
 *
 * Nothing here talks to a real backend, a real payment provider or a real
 * order. The two API hosts are named because the app's own CSP names them; the
 * requests are answered in-process and never leave the machine.
 */
const API_HOSTS = [
  'https://esim-backend-3wmu.onrender.com',
  'https://api.magicesim.store',
];

/** One proven address, masked the way the server masks it. */
const EMAIL = {
  id: '11111111-2222-4333-8444-555555555555',
  masked: 'b***r@example.com',
  verified_at: '2026-08-19T08:54:02.000Z',
};

/**
 * A masked address long enough to be the widest thing in its row.
 *
 * The 320px overflow this suite guards was caused by exactly this: the row is a
 * grid item, its automatic minimum is its min-content, and the address is one
 * unbreakable token. A short address hides the bug.
 */
const LONG_EMAIL = {
  id: '22222222-3333-4444-8555-666666666666',
  masked: 'konstantin.aleksandrov***@verylongmaildomain.example.com',
  verified_at: '2026-08-19T08:54:02.000Z',
};

const RAW_EMAIL = 'buyer@example.com';

/**
 * One eSIM and one plan, enough to reach every screen that needs them.
 *
 * Shaped from the real catalogue's own fields so the screens render what they
 * would render in production — a DAILY plan in particular, because its copy
 * comes from the shared assets/daily-plan-copy.js and is exactly the kind of
 * text that would stay Russian if a language argument were missed.
 */
const ESIM = {
  id: 'aaaaaaaa-1111-4222-8333-444444444444',
  iccid: '89000000000000000001',
  status: 'active',
  package_name: 'Japan 5GB 30Days',
  country_code: 'JP',
  total_gb: 5,
  remaining_gb: 3.2,
  expires_at: '2026-12-31T00:00:00.000Z',
  last_usage_sync_at: '2026-08-30T10:00:00.000Z',
  hidden: false,
};

const PACKAGE = {
  package_id: 'pkg-jp-5',
  name: 'Japan 5GB 30Days',
  country_code: 'JP',
  region: 'JP',
  coverage_country_codes: ['JP'],
  data_gb: 5,
  validity_days: 30,
  price: 1150,
  networks: [{ operator: 'NTT docomo', type: '5G' }],
  speed: '3G/4G/5G',
  speed_note: 'unrestricted',
  fup_policy: 'no daily limits',
  hotspot_supported: true,
  activation_policy: 'first_data_usage',
  topup_available: true,
  ip_export: ['JP'],
  plan_type: 'FIXED_VOLUME',
  sellable_days: [],
};

/**
 * The Telegram surface, as a string evaluated in the page before it loads.
 *
 * `initDataUnsafe` is deliberately shaped by the caller: the language tests are
 * about what the app does with what Telegram says, including saying nothing.
 */
function telegramStub({ languageCode }) {
  const user = languageCode === null
    ? { id: 1 }
    : { id: 1, language_code: languageCode };

  return `
    window.__opened = null;
    window.Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
      initDataUnsafe: { user: ${JSON.stringify(user)} },
      version: '7.0',
      isVersionAtLeast(v) { return parseFloat(v) <= 7.0; },
      ready() {}, expand() {}, close() {},
      colorScheme: 'light', platform: 'ios', themeParams: {},
      setBackgroundColor() {}, setHeaderColor() {}, onEvent() {},
      BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
      HapticFeedback: { impactOccurred() {}, notificationOccurred() {} },
      openLink(u) { window.__opened = u; },
    } };
  `;
}

/**
 * Install the fakes on a page.
 *
 * `state` is returned so a test can read what the app asked for — how many
 * revokes reached the server is a fact about the network, and reading it from
 * the page would be reading the app's own opinion of itself.
 */
async function installMiniApp(page, options = {}) {
  const {
    languageCode = 'ru',
    emails = [EMAIL],
    revokeDelayMs = 0,
    revokeFails = false,
  } = options;

  const state = {
    calls: [],
    emails: emails.slice(),
    esims: options.esims || [],
    packages: options.packages || [],
  };
  const json = (route, body, status = 200) => route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.addInitScript(telegramStub({ languageCode }));

  // Telegram's own bridge. Blocked rather than fetched: the test must not
  // depend on telegram.org being up, and the stub above already provides the
  // surface. Fulfilled empty so the tag still parses.
  await page.route('https://telegram.org/**', (route) => route.fulfill({
    status: 200, contentType: 'text/javascript', body: '',
  }));

  // The static catalogue snapshot is 3.3 MB of real data. The screens under
  // test here never read it, so it is answered empty rather than served.
  await page.route('**/assets/catalog.json*', (route) => json(route, {
    schema_version: 1, generated_at: '2026-08-28T18:41:15.232Z',
    source: 'test', package_count: 0, packages: [],
  }));

  for (const host of API_HOSTS) {
    await page.route(`${host}/**`, async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const at = url.pathname;
      state.calls.push({ path: at, method: request.method() });

      if (at.endsWith('/api/v1/tma/session')) {
        return json(route, { session_token: 'test-session', expires_in: 1800 });
      }

      if (at.endsWith('/api/v1/retail/packages')) {
        return json(route, {
          status: 'success', count: state.packages.length, currency: 'RUB', data: state.packages,
        });
      }

      if (at.endsWith('/api/v1/tma/me')) {
        return json(route, {
          customer: { created_at: '2026-08-18T00:00:00.000Z' },
          emails: state.emails,
          counts: { orders: 3, active_orders: 0, esims: 1 },
          notifications: { low_data: true, expiry: true },
        });
      }

      if (at.endsWith('/api/v1/tma/notifications/prefs')) {
        return json(route, { low_data: true, expiry: true });
      }

      if (at.endsWith('/api/v1/tma/identity/email/revoke')) {
        // The delay is what makes the in-flight window real. Without it the
        // request completes inside one frame and a double tap is simply two
        // separate, legitimate intentions.
        if (revokeDelayMs) await new Promise((r) => setTimeout(r, revokeDelayMs));
        if (revokeFails) return json(route, { error: 'INTERNAL_ERROR' }, 500);

        const body = request.postDataJSON() || {};
        state.emails = state.emails.filter((e) => e.id !== body.identity_id);

        return json(route, { ok: true, revoked: true });
      }

      // The server answers the same way whether the address is free or held by
      // somebody else. That indistinguishability is the feature, and the test
      // that reads this asserts the screen keeps the secret.
      if (at.endsWith('/api/v1/tma/identity/email/request')) {
        return json(route, { status: 'sent' });
      }

      if (at.endsWith('/api/v1/tma/esims/hidden')) return json(route, { items: [] });
      if (at.endsWith('/api/v1/tma/esims')) return json(route, { items: state.esims });
      if (at.includes('/api/v1/tma/esims/')) return json(route, state.esims[0] || {});

      if (at.includes('/api/v1/tma/me/orders')) {
        return json(route, { items: [] });
      }

      return json(route, { items: [] });
    });
  }

  return state;
}

/** Open the app and wait for it to stop being the loading screen. */
async function openApp(page) {
  await page.goto('/app/index.html');
  await page.waitForFunction(
    () => !document.querySelector('#screen-loading[data-active]'),
    null,
    { timeout: 15_000 }
  );
}

/** Reach Settings the way a customer does — the gear in the hero. */
async function openSettings(page) {
  await page.locator('#open-settings').click();
  await page.locator('#screen-settings[data-active]').waitFor();
  // The body is painted after `GET /tma/me` answers.
  await page.locator('#settings-language').waitFor();
}

/** Count the requests that actually left the app for one endpoint. */
function callsTo(state, endsWith) {
  return state.calls.filter((c) => c.path.endsWith(endsWith)).length;
}

/**
 * Every element inside `selector` whose content is wider than its own box.
 *
 * Element-level rather than document-level on purpose: the row that overflowed
 * at 320px never reached the viewport, because an inner `min-width: 0`
 * contained the damage — so a check on `document.scrollWidth` called it clean
 * for as long as the bug existed.
 */
async function overflowingInside(page, selector) {
  return page.$$eval(`${selector} *`, (nodes) => nodes
    .filter((n) => n.clientWidth > 0 && n.scrollWidth > n.clientWidth + 1)
    .map((n) => `${n.className || n.tagName} ${n.scrollWidth}>${n.clientWidth}`));
}

const CYRILLIC = /[Ѐ-ӿ]/;

module.exports = {
  installMiniApp, openApp, openSettings, callsTo, overflowingInside,
  EMAIL, LONG_EMAIL, RAW_EMAIL, CYRILLIC, API_HOSTS, ESIM, PACKAGE,
};
