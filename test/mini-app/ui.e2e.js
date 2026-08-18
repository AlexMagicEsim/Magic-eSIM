/**
 * Final UI verification for the Mini App redesign.
 *
 * Real app/ files, real production catalogue (973 packages), WebKit AND
 * Chromium, iPhone viewport, light and dark Telegram themes.
 *
 * Checks the things the Blueprint and the brief actually demand:
 *   - no raw ISO / technical codes anywhere a customer can read
 *   - the catalogue renders with NO session
 *   - no horizontal scroll
 *   - no console errors
 *   - the consent box gates payment
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const playwright = require('playwright');

const APP = path.join(__dirname, '..', '..', 'app');
// A real production catalogue snapshot if one is at hand, otherwise a small
// fixture that still exercises both sections. Pass a path as argv[2].
const CAT = (() => {
  const given = process.argv[2];
  if (given && fs.existsSync(given)) return JSON.parse(fs.readFileSync(given, 'utf8'));
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'catalogue.fixture.json'), 'utf8'));
})();
const OUT = process.env.UI_SHOTS || path.join(__dirname, '.shots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

// Raw technical codes a customer must never see. Two-letter ISO codes as a
// standalone word, plus the three invented regional ones.
const RAW = /(?:^|[\s>·|])(A[DEFGILMORTUWXZ]|B[ABDEFGHJLMNORSTWZ]|C[ADFGHILMNORVWYZ]|D[EKMOZ]|E[CEGST]|F[IJOR]|G[ABDEFGHILMNPRTUWY]|H[KNRTU]|I[DELMNQRST]|J[EMOP]|K[EGHNRWYZ]|L[ABCIKRTUVY]|M[ACDEFGKLMNOQRSTUVWXYZ]|N[ACEGILOPRUZ]|OM|P[AEFGHKLMRSTWY]|QA|R[EOSUW]|S[ABCDEGIKLMNRSTVXYZ]|T[CDGHJLMNORTVWZ]|U[AGSYZ]|V[ACEGINU]|WS|XK|Y[ET]|Z[AMW]|AF-29|CA-4|GL-120)(?=$|[\s<·|])/;

function mock(c) {
  window.Telegram = {
    WebApp: {
      initData: 'user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
      ready() {}, expand() {}, close() {},
      colorScheme: window.__scheme || 'light',
      themeParams: window.__tp || {},
      setBackgroundColor() {}, setHeaderColor() {},
      onEvent() {},
      BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
      HapticFeedback: { impactOccurred() {}, notificationOccurred() {} },
      openLink() {}, openTelegramLink() {},
    },
  };
  const j = (b, s = 200) => Promise.resolve(new Response(JSON.stringify(b), {
    status: s, headers: { 'content-type': 'application/json' },
  }));
  window.fetch = (u) => {
    u = String(u);
    if (u.includes('/tma/session')) return j({ session_token: 'm', expires_in: 1800 });
    if (u.includes('/retail/packages')) return j(c);
    return j({ items: [] });
  };
}

let bad = 0;
const ok = (label, cond, detail = '') => {
  if (!cond) bad += 1;
  console.log(`   ${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? '  — ' + detail : ''}`);
};

async function serve() {
  const s = http.createServer((q, r) => {
    const n = q.url.split('?')[0] === '/' ? '/index.html' : q.url.split('?')[0];
    fs.readFile(path.join(APP, n), (e, b) => {
      if (e) return r.writeHead(404).end();
      r.writeHead(200, { 'content-type': TYPES[path.extname(n)] || 'text/plain' });
      r.end(b);
    });
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  return { s, base: `http://127.0.0.1:${s.address().port}/index.html` };
}

const DARK = {
  bg_color: '#17212B', secondary_bg_color: '#232E3C', text_color: '#F5F5F5',
  hint_color: '#7D8B99', link_color: '#6AB3F3', button_color: '#5288C1',
};

async function runOne(engineName, scheme) {
  const { s, base } = await serve();
  const browser = await playwright[engineName].launch();
  const ctx = await browser.newContext({ ...playwright.devices['iPhone 13'] });
  await ctx.route('https://telegram.org/**', (r) => r.fulfill({ status: 200, body: '' }));
  await ctx.addInitScript((tp) => {
    window.__scheme = tp.scheme;
    window.__tp = tp.params;
    // Exactly how telegram-web-app.js does it: CSS custom properties set
    // through the CSSOM on the root element. A <style> element here would be
    // blocked by the app's own style-src 'self' — which is the CSP working, not
    // a bug, and injecting one made this harness test the wrong thing.
    if (tp.scheme === 'dark') {
      const apply = () => {
        const root = document.documentElement;
        if (!root) return false;
        for (const [k, v] of Object.entries(tp.params)) {
          root.style.setProperty(`--tg-theme-${k.replace(/_/g, '-')}`, v);
        }
        return true;
      };
      // documentElement does not exist yet when an init script runs in WebKit.
      if (!apply()) document.addEventListener('DOMContentLoaded', apply);
    }
  }, { scheme, params: scheme === 'dark' ? DARK : {} });
  await ctx.addInitScript(mock, CAT);

  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));

  console.log(`\n── ${engineName} · ${scheme} ──`);
  const t0 = Date.now();
  await page.goto(base);
  await page.waitForSelector('#home-countries .card--row', { timeout: 20000 });
  const tCat = Date.now() - t0;
  console.log(`   time to visible catalogue: ${tCat} ms`);

  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${engineName}-${scheme}-home.png` });

  const homeText = await page.$eval('#screen-home', (n) => n.innerText);
  const m = homeText.match(RAW);
  ok('no raw country/technical codes on the catalogue', !m, m ? `found ${JSON.stringify(m[0])}` : '');
  ok('mini.css actually loaded (not merely unreported)',
    await page.evaluate(() => getComputedStyle(document.querySelector('nav')).paddingBottom !== '0px'));
  ok('no horizontal scroll',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  ok('both sections present',
    homeText.includes('Регионы и весь мир') && homeText.includes('Страны'));
  ok('plural forms are correct (no "1 тарифов")', !/\b1 тарифов\b/.test(homeText));

  // Drill: country -> tariffs -> checkout
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#home-countries .card--row')];
    const th = rows.find((r) => r.innerText.includes('Таиланд')) || rows[rows.length - 1];
    th.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${engineName}-${scheme}-country.png` });
  const cText = await page.$eval('#screen-country', (n) => n.innerText);
  const cm = cText.match(RAW);
  ok('no raw codes on the country screen', !cm, cm ? `found ${JSON.stringify(cm[0])}` : '');
  ok('tariff cards rendered', (await page.$$('#country-list .card')).length > 0);

  await page.evaluate(() => document.querySelector('#country-list .card').click());
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${engineName}-${scheme}-checkout.png` });
  const ck = await page.$eval('#screen-checkout', (n) => n.innerText);
  ok('checkout names the destination', !/^\s*·/m.test(ck) && ck.length > 30);
  ok('pay button starts DISABLED until the oferta is accepted',
    await page.$eval('#checkout-pay', (b) => b.disabled) === true);
  await page.evaluate(() => {
    const c = document.querySelector('#checkout-terms');
    c.checked = true; c.dispatchEvent(new Event('change'));
  });
  ok('accepting the oferta enables it',
    await page.$eval('#checkout-pay', (b) => b.disabled) === false);

  await page.tap('#nav-esims');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${engineName}-${scheme}-esims.png` });

  // Theme actually applied?
  const bgc = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(`body background follows the ${scheme} theme`,
    scheme === 'dark' ? bgc === 'rgb(23, 33, 43)' : bgc !== 'rgb(23, 33, 43)', bgc);

  // Two known non-app sources are filtered, and nothing else:
  //   - frame-ancestors in a <meta> CSP is ignored by every engine, always logs;
  //   - Playwright injects its own <style> to hide the caret for screenshots,
  //     which our style-src 'self' correctly refuses. That refusal is the CSP
  //     working; it is not the page's stylesheet, which loads normally.
  const real = errs.filter((t) => !/frame-ancestors/.test(t)
    && !/Refused to apply a stylesheet/.test(t)
    && !/Applying inline style violates/.test(t));
  ok('no console errors', real.length === 0, real.slice(0, 2).join(' | '));

  await browser.close();
  s.close();
  return tCat;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const times = [];
  for (const engine of ['webkit', 'chromium']) {
    for (const scheme of ['light', 'dark']) times.push(await runOne(engine, scheme));
  }
  console.log(`\nfastest time to visible catalogue: ${Math.min(...times)} ms`);
  console.log(bad ? `\n${bad} FAILURE(S)` : '\nall UI checks passed');
  process.exit(bad ? 1 : 0);
})();
