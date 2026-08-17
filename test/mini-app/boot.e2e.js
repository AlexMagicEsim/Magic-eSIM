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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

/* -------------------------------------------------------------------------- *
 * The fake Telegram + gateway, injected before any page script runs.
 * Mode comes from the query string so one page can play every failure.
 * -------------------------------------------------------------------------- */
function mock() {
  var mode = location.search.replace('?', '') || 'ok';

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
      // The measured production profile: the first call after idle 502s, the
      // instance is warm by the second.
      if (mode === 'coldstart' && window.__sessionHits === 1) {
        return json({ error: 'upstream_unreachable' }, 502);
      }

      return json({ session_token: 'mock', expires_in: 1800 });
    }
    if (u.indexOf('/retail/packages') !== -1) return json({ packages: [] });

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
    const name = (req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]);
    const file = path.join(APP_DIR, path.normalize(name).replace(/^(\.\.[/\\])+/, ''));
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
  check('a screen is visible, not a blank app', await active(page), ['screen-loading']);
  await page.tap('#nav-esims');
  await page.tap('#nav-home');
  check('taps before the session do not fall into a void', await active(page), ['screen-loading']);
  check('nav keeps its safe-area padding (a style attribute would be CSP-blocked)',
    await page.$eval('nav', (n) => getComputedStyle(n).paddingBottom !== '0px'), true);

  console.log('\n[coldstart] first call 502s, the retry succeeds');
  await page.goto(`${base}?coldstart`);
  await page.waitForSelector('#screen-home[data-active]', { timeout: 15000 });
  check('the cold-start 502 is absorbed', await active(page), ['screen-home']);
  check('it took two session calls', await page.evaluate(() => window.__sessionHits), 2);
  await page.tap('#nav-esims');
  check('TAP «Мои eSIM» opens the eSIM screen', await active(page), ['screen-esims']);
  await page.tap('#nav-home');
  check('TAP «Каталог» opens the catalogue', await active(page), ['screen-home']);

  console.log('\n[fail] every attempt 502s');
  await page.goto(`${base}?fail`);
  await page.waitForSelector('#screen-error[data-active]', { timeout: 20000 });
  check('three attempts were made before giving up',
    await page.evaluate(() => window.__sessionHits), 3);
  check('the customer gets a retry, not a dead end',
    await page.$eval('#screen-error', (n) => n.innerText.includes('Повторить')), true);

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
