/**
 * R-44 regression: the Mini App must be usable before the session arrives.
 *
 * On 2026-08-17 the owner opened the closed Mini App on an iPhone and saw the
 * two nav buttons and nothing else, with neither button responding. The cause
 * was ordering, not Telegram: boot() awaited the session mint before it attached
 * a single listener or showed a single screen, and <nav> lives outside <main> so
 * it is painted the instant the HTML parses. A cold gateway takes ~12s to answer
 * that request and frequently 502s outright (TD-55), which is exactly the window
 * the owner was tapping in.
 *
 * Runs in WebKit on an iPhone viewport with a real touch stack: iOS Telegram is
 * WKWebView, and a Chromium mouse click would not have shown the safe-area part
 * of this at all.
 *
 * Nothing here is copied from app/ — the real files are served and the Telegram
 * SDK and gateway are faked at the network edge, so this cannot drift.
 *
 *   npx playwright install webkit      # once
 *   node test/mini-app/boot.e2e.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { webkit, devices } = require('playwright');

const APP_DIR = path.join(__dirname, '..', '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

/* -------------------------------------------------------------------------- *
 * The fake Telegram + gateway, injected before any page script runs.
 * Mode comes from the query string so one page can play every failure.
 * -------------------------------------------------------------------------- */
function mock() {
  var mode = location.search.replace('?', '') || 'ok';

  var PACKAGES = [
    { package_id: 'p1', name: 'Thailand 3GB 15Days', data_gb: 3, validity_days: 15,
      country_code: 'TH', price: 690, currency: 'RUB',
      coverage_country_codes: ['TH'], coverage_flags: '🇹🇭' },
    { package_id: 'p2', name: 'Thailand 10GB 30Days', data_gb: 10, validity_days: 30,
      country_code: 'TH', price: 1490, currency: 'RUB',
      coverage_country_codes: ['TH'], coverage_flags: '🇹🇭' },
    { package_id: 'p3', name: 'Netherlands 3GB 15Days', data_gb: 3, validity_days: 15,
      country_code: 'NL', price: 350, currency: 'RUB',
      coverage_country_codes: ['NL'], coverage_flags: '🇳🇱' },
    { package_id: 'p4', name: 'Vietnam Plus 3 GB', data_gb: 3, validity_days: 30,
      country_code: 'ID', price: 1900, currency: 'RUB',
      coverage_country_codes: ['ID', 'MY', 'SG', 'KR', 'TH', 'VN'],
      coverage_flags: '🇮🇩🇲🇾🇸🇬🇰🇷🇹🇭🇻🇳' },
  ];

  window.Telegram = {
    WebApp: {
      initData: 'query_id=AAF&user=%7B%22id%22%3A1%7D&auth_date=1&hash=deadbeef',
      ready: function () {}, expand: function () {}, close: function () {},
      BackButton: { show: function () {}, hide: function () {}, onClick: function () {}, offClick: function () {} },
      HapticFeedback: { impactOccurred: function () {} },
      openTelegramLink: function () {}, openLink: function () {},
    },
  };

  var json = function (body, status) {
    return Promise.resolve(new Response(JSON.stringify(body), {
      status: status || 200, headers: { 'content-type': 'application/json' },
    }));
  };

  window.__sessionHits = 0;
  window.fetch = function (url) {
    var u = String(url);
    if (u.indexOf('/tma/session') !== -1) {
      window.__sessionHits += 1;
      if (mode === 'slow') return new Promise(function () { /* never settles */ });
      if (mode === 'fail') return json({ error: 'upstream_unreachable' }, 502);
      // What the owner actually hit on 2026-08-17: the request arrives, the
      // server verifies the signature and refuses. Retrying cannot help.
      if (mode === 'badauth') {
        return json({
          error: 'INIT_DATA_INVALID',
          message: 'Не удалось подтвердить вход через Telegram. Откройте приложение заново.',
        }, 401);
      }
      // A dead radio: fetch rejects instead of answering.
      if (mode === 'offline') return Promise.reject(new TypeError('Load failed'));
      // The measured production profile: the first call after idle 502s, the
      // instance is warm by the second.
      if (mode === 'coldstart' && window.__sessionHits === 1) {
        return json({ error: 'upstream_unreachable' }, 502);
      }

      return json({ session_token: 'mock', expires_in: 1800 });
    }
    // The static snapshot that ships with the site. Same packages, snapshot
    // envelope. It is the path that must work when BOTH endpoints are down, so
    // the failure modes below are only honest if it is served here too.
    if (u.indexOf('catalog.json') !== -1) {
      return json({
        schema_version: 1, generated_at: '2026-08-18T07:08:16.254Z',
        source: 'production-public-api', package_count: 4, packages: PACKAGES,
      });
    }
    // The REAL catalogue envelope: {status, count, currency, data}. It was
    // {packages: []} here, which is a shape the app has never received — the
    // suite was asserting against an empty screen and calling it a pass.
    if (u.indexOf('/retail/packages') !== -1) {
      return json({ status: 'success', count: 4, currency: 'RUB', data: PACKAGES });
    }
    if (false) {
      return json({
        status: 'success', count: 4, currency: 'RUB',
        data: [
          { package_id: 'p1', name: 'Thailand 3GB 15Days', data_gb: 3, validity_days: 15,
            country_code: 'TH', price: 690, currency: 'RUB',
            coverage_country_codes: ['TH'], coverage_flags: '🇹🇭' },
          { package_id: 'p2', name: 'Thailand 10GB 30Days', data_gb: 10, validity_days: 30,
            country_code: 'TH', price: 1490, currency: 'RUB',
            coverage_country_codes: ['TH'], coverage_flags: '🇹🇭' },
          { package_id: 'p3', name: 'Netherlands 3GB 15Days', data_gb: 3, validity_days: 15,
            country_code: 'NL', price: 350, currency: 'RUB',
            coverage_country_codes: ['NL'], coverage_flags: '🇳🇱' },
          // Regional: filed under one member country, six countries wide. This
          // is the row that used to read "Индонезия" on the catalogue screen.
          { package_id: 'p4', name: 'Vietnam Plus 3 GB', data_gb: 3, validity_days: 30,
            country_code: 'ID', price: 1900, currency: 'RUB',
            coverage_country_codes: ['ID', 'MY', 'SG', 'KR', 'TH', 'VN'],
            coverage_flags: '🇮🇩🇲🇾🇸🇬🇰🇷🇹🇭🇻🇳' },
        ],
      });
    }

    return json({ items: [] });
  };
}

/* -------------------------------------------------------------------------- */

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}`
    + (ok ? '' : `\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(actual)}`));
}

const active = (page) => page.$$eval('.screen[data-active]', (n) => n.map((x) => x.id));

async function serve() {
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    const name = url === '/' ? '/index.html' : url;
    // The popular tiles use the storefront's own flag PNGs, one level above app/.
    const root = name.startsWith('/assets/') ? path.join(APP_DIR, '..') : APP_DIR;
    const file = path.join(root, path.normalize(name).replace(/^(\.\.[/\\])+/, ''));
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));

  return { server, base: `http://127.0.0.1:${server.address().port}/index.html` };
}

async function run() {
  const { server, base } = await serve();
  const browser = await webkit.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'] });

  // The real SDK is never reachable from a test run, and we are replacing it.
  await context.route('https://telegram.org/**', (route) => route.fulfill({
    status: 200, contentType: 'text/javascript', body: '',
  }));
  await context.addInitScript(mock);

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

  console.log('\n[slow] the session never answers — the state the owner tapped into');
  await page.goto(`${base}?slow`);
  // The contract changed on 2026-08-18 and is now STRONGER. It used to be "a
  // loading screen is visible"; the catalogue is public, so it is now "the
  // catalogue is visible and usable while the session is still in flight".
  await page.waitForSelector('#screen-home[data-active]', { timeout: 15000 });
  check('the catalogue is on screen without a session', await active(page), ['screen-home']);
  // Tiles on the start screen, rows once the full list is expanded or a search
  // is running — either is "the customer can see something to buy".
  check('and it has real destinations in it',
    await page.$$eval('#home-countries .tile, #home-countries .card--row', (n) => n.length > 0), true);
  await page.tap('#nav-esims');
  check('taps do not fall into a void', await active(page), ['screen-esims']);
  await page.tap('#nav-home');
  check('and the catalogue tab still works', await active(page), ['screen-home']);
  check('nav keeps its safe-area padding (a style attribute would be CSP-blocked)',
    await page.$eval('nav', (n) => getComputedStyle(n).paddingBottom !== '0px'), true);

  console.log('\n[coldstart] first call 502s, the retry succeeds');
  await page.goto(`${base}?coldstart`);
  await page.waitForSelector('#screen-home[data-active]', { timeout: 15000 });
  check('the cold-start 502 is absorbed', await active(page), ['screen-home']);
  // The session now runs alongside the catalogue rather than in front of it, so
  // wait for it to settle before counting its attempts.
  await page.waitForFunction(() => window.__sessionHits >= 2, { timeout: 15000 });
  await page.waitForTimeout(300);
  check('the 502 was retried on the SAME endpoint, not escalated', 
    await page.evaluate(() => window.__sessionHits), 2);
  await page.tap('#nav-esims');
  check('TAP «Мои eSIM» opens the eSIM screen', await active(page), ['screen-esims']);
  await page.tap('#nav-home');
  check('TAP «Каталог» opens the catalogue', await active(page), ['screen-home']);

  console.log('\n[fail] the session 502s on every attempt — the catalogue must survive it');
  await page.goto(`${base}?fail`);
  await page.waitForSelector('#screen-home[data-active]', { timeout: 20000 });
  // Three attempts on the primary, then three on the fallback, then it stops.
  await page.waitForFunction(() => window.__sessionHits >= 6, { timeout: 25000 });
  await page.waitForTimeout(500);              // prove it does not keep going
  check('the budget is spent on BOTH endpoints and then stops',
    await page.evaluate(() => window.__sessionHits), 6);
  // A dead session used to take the whole app down. It buys nothing: the
  // catalogue needs no session, and a customer who cannot sign in can still be
  // shown what is for sale.
  check('the catalogue is still on screen', await active(page), ['screen-home']);
  check('and still has destinations',
    await page.$$eval('#home-countries .tile, #home-countries .card--row', (n) => n.length > 0), true);
  await page.tap('#nav-esims');
  check('«Мои eSIM» still responds', await active(page), ['screen-esims']);

  console.log('\n[badauth] the server refuses the signature — R-42 diagnosis, 2026-08-17');
  await page.goto(`${base}?badauth`);
  await page.waitForSelector('#screen-home[data-active]', { timeout: 20000 });
  await page.waitForFunction(() => window.__sessionHits >= 1, { timeout: 20000 });
  check('a 401 is NOT retried — it is a verdict, not a blip',
    await page.evaluate(() => window.__sessionHits), 1);
  check('a refused session still leaves the catalogue usable', await active(page), ['screen-home']);

  console.log('\n[offline] the radio is dead — fetch rejects');
  await page.goto(`${base}?offline`);
  await page.waitForSelector('#screen-home[data-active]', { timeout: 25000 });
  await page.waitForFunction(() => window.__sessionHits >= 6, { timeout: 30000 });
  await page.waitForTimeout(500);
  check('a transport failure IS retried to the full budget, on both endpoints',
    await page.evaluate(() => window.__sessionHits), 6);

  console.log('\n[ok] warm gateway');
  await page.goto(`${base}?ok`);
  await page.waitForSelector('#screen-home[data-active]', { timeout: 15000 });
  await page.tap('#nav-esims');
  check('TAP «Мои eSIM» works warm', await active(page), ['screen-esims']);
  await page.tap('#nav-home');
  check('TAP «Каталог» works warm', await active(page), ['screen-home']);

  // frame-ancestors in a <meta> CSP is ignored by every engine and always logs.
  // It is the only console error the page is allowed to produce.
  const real = consoleErrors.filter((t) => !/frame-ancestors/.test(t));
  check('no console errors beyond the known frame-ancestors notice', real, []);

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
