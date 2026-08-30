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
  ],

  webServer: {
    command: 'node test/e2e/server.mjs',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { PORT: String(PORT) },
  },
});
