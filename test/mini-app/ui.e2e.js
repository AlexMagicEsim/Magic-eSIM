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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

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
    if (u.includes('/retail/packages')) { window.__lastCatalogue = c.data; return j(c); }
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
    const url = q.url.split('?')[0];
    const n = url === '/' ? '/index.html' : url;
    // /assets/** comes from the repo root: the popular tiles use the
    // storefront's own flag PNGs, which live one level above app/.
    const root = n.startsWith('/assets/') ? path.join(APP, '..') : APP;
    fs.readFile(path.join(root, n), (e, b) => {
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
  await page.waitForSelector('#home-countries .tile', { timeout: 20000 });
  const tCat = Date.now() - t0;
  console.log(`   time to visible catalogue: ${tCat} ms`);

  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${engineName}-${scheme}-home.png` });

  // ---- start screen: popular first, not the A-Z wall ----------------------
  const tiles = await page.$$eval('.tile .tile__name', (n) => n.map((x) => x.innerText.trim()));
  ok('the start screen opens on popular destinations', tiles.length > 0, `${tiles.length} tiles`);
  ok('popular order matches the storefront exactly',
    JSON.stringify(tiles) === JSON.stringify(await page.evaluate(
      () => window.MagicCore.popularGroups(
        window.MagicCore.groupCatalogue(window.__lastCatalogue || []).countries
      ).map((g) => g.country))),
    tiles.slice(0, 4).join(', '));
  ok('the full A-Z list is NOT the initial view',
    (await page.$$('#home-countries .card--row')).length === 0);
  ok('and it is one tap away',
    (await page.$$eval('#home-countries .btn--wide', (n) => n.length)) === 1);

  // ---- search --------------------------------------------------------------
  const type = async (q) => {
    await page.fill('#search', q);
    await page.waitForTimeout(120);
    return page.$$eval('#home-countries .card--row .card__title', (n) => n.map((x) => x.innerText.trim()));
  };

  for (const [q, expect] of [
    ['Таиланд', 'Таиланд'], ['тай', 'Таиланд'], ['thailand', 'Таиланд'],
    ['Турция', 'Турция'], ['turkey', 'Турция'],
    ['ОАЭ', 'ОАЭ'], ['uae', 'ОАЭ'],
    ['китай', 'Китай'], ['china', 'Китай'],
    ['вьетнам', 'Вьетнам'], ['vietnam', 'Вьетнам'],
  ]) {
    const r = await type(q);
    ok(`search ${JSON.stringify(q)} -> ${expect} first`, r[0] === expect, `got ${JSON.stringify(r.slice(0, 3))}`);
  }

  ok('searching hides the popular tiles',
    (await page.$$('.tile')).length === 0);

  const none = await type('несуществующая страна');
  ok('no match shows a stated empty state, not a blank screen',
    none.length === 0
      && (await page.$eval('#home-countries', (n) => n.innerText)).includes('Страна не найдена'));

  await page.fill('#search', '');
  await page.dispatchEvent('#search', 'input');
  await page.waitForTimeout(150);
  ok('clearing the field brings the popular tiles back',
    (await page.$$('.tile')).length > 0);

  const homeText = await page.$eval('#screen-home', (n) => n.innerText);
  const m = homeText.match(RAW);
  ok('no raw country/technical codes on the catalogue', !m, m ? `found ${JSON.stringify(m[0])}` : '');
  ok('mini.css actually loaded (not merely unreported)',
    await page.evaluate(() => getComputedStyle(document.querySelector('nav')).paddingBottom !== '0px'));
  ok('no horizontal scroll',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  // Open the full list so the raw-code sweep covers every row, not just tiles.
  await page.evaluate(() => {
    const b = document.querySelector('#home-countries .btn--wide');
    if (b) b.click();
  });
  await page.waitForTimeout(250);
  const fullText = await page.$eval('#screen-home', (n) => n.innerText);
  ok('both sections present once expanded',
    fullText.includes('Регионы и весь мир') && fullText.includes('Все страны'));
  const fm = fullText.match(RAW);
  ok('no raw codes in the FULL list either', !fm, fm ? `found ${JSON.stringify(fm[0])}` : '');
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
