'use strict';

/**
 * Browser tests for the Telegram Mini App.
 *
 * WHAT THIS IS FOR. Some properties of this app are only true in a browser:
 * whether a row overflows its column at 320px, whether a second tap while a
 * request is in flight reaches the server, whether a choice survives a reload.
 * Those were being checked by hand through a throwaway harness, which is fine
 * for one measurement and worthless as a guard — nobody re-runs a harness.
 *
 * CHROMIUM ONLY, and two viewports rather than two engines. The layout claims
 * this suite makes are about width, and width is what varies between the phones
 * customers actually open this on; a second rendering engine would double the
 * runtime to re-answer a question the CSS does not ask differently. (The older
 * `test/mini-app/*.e2e.js` scripts run WebKit for a different reason — they
 * exist because of a touch-handling bug that only WKWebView had — and they are
 * left alone.)
 *
 * TWO EXCEPTIONS: `webkit-flags`, and `webkit-lang-route` (see its entry). The country flags are drawn by the engine, and
 * the minified copies broke differently in WebKit (Curaçao: fragments) than in
 * Chromium (nothing at all), so the flag tests — and only they — also run in
 * WebKit, the engine of Safari on macOS and iOS and of Telegram on iOS.
 *
 * NO RETRIES, deliberately. A retry turns a flaky test into a slow green one,
 * and this suite is small enough that a flake is worth seeing the first time.
 *
 * NOTHING REAL IS TOUCHED. The web server is a static file server over this
 * repository; every API call is intercepted in the browser and answered from a
 * fixture. No backend, no Platega, no order, no credential, no production host.
 */
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.PORT || 4321);
const BASE_URL = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    // A trace only when something failed: cheap to keep, and it is the
    // difference between "flaky" and "here is what the page was doing".
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      // The common phone, and the width the design was drawn at.
      name: 'chromium-390',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    {
      // The narrow floor. iPhone SE (1st gen) and every "small" Android sit
      // here, and it is where a grid item without min-width:0 shows up.
      name: 'chromium-320',
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 568 } },
    },
    {
      // The flag tests in WebKit (see above). Nothing else runs here.
      name: 'webkit-flags',
      // …and the Spanish (I18N ES-1) and German (DE-1) and French (FR-1) sites: every page kind in Safari's engine as well,
      // and the English Privacy Policy (LEGAL-1), and the Korean site (KO-1),
      // and the Mini App plan card and layout (miniapp-ux-parity) — Telegram on iOS is WebKit.
      testMatch: /(?:^|[\\/])(?:flags|miniapp-flags|es-site|de-site|fr-site|zh-site|en-privacy|ko-site|legal-consents|legal-i18n|miniapp-markets|miniapp-catalogue-races|no-horizontal-scroll|coverage-target|miniapp-ux-parity)\.spec\.js$/,
      use: { ...devices['Desktop Safari'], viewport: { width: 390, height: 844 } },
    },
    {
      // The first-visit language of «/» (assets/lang-route.js) in WebKit, in a project of its own. Every intermittent
      // WebKit failure of this suite (CI 2026-10-23 … 10-27: 23 of 23) was a visit to «/» that lang-route.js moves on:
      // the location.replace() request for the right target failed inside WebKit («internal error» / «cancelled» /
      // never answered) and the tab was dead after it — a fresh goto() in the same tab hung too. Every one of those
      // visits ran with request interception on (page.route), and in every traced case the OTHER WebKit worker was
      // running a moving visit at the same moment (once both failed in the same second). So these tests run here: in
      // WebKit workers of their own (never in a browser that has run the rest of the suite), ONE at a time (never two
      // WebKit processes redirecting at once), and the spec intercepts nothing (no page.route: off-site requests fail
      // at a dead proxy instead). The assertions are the same in both engines — no tolerance, no recovery.
      name: 'webkit-lang-route',
      testMatch: /(?:^|[\\/])lang-route\.spec\.js$/,
      workers: 1,
      use: { ...devices['Desktop Safari'], viewport: { width: 390, height: 844 } },
    },
  ],

  webServer: {
    command: 'node test/e2e/server.mjs',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { PORT: String(PORT) },
  },
});
