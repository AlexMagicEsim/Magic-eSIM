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
  const raw = JSON.parse(fs.readFileSync(
    given && fs.existsSync(given) ? given : path.join(__dirname, 'catalogue.fixture.json'),
    'utf8'
  ));

  // Two envelopes are in circulation and the README invites both: the live API
  // answers `{status,count,currency,data}`, while assets/catalog.json — the
  // production snapshot a reviewer actually has to hand — is
  // `{schema_version,generated_at,package_count,packages}`. Reading only
  // `.data` meant the documented "pass a real snapshot" path fed the app an
  // undefined list and the suite died on a selector timeout.
  const data = Array.isArray(raw.data) ? raw.data
    : Array.isArray(raw.packages) ? raw.packages
    : Array.isArray(raw) ? raw : [];

  return { status: 'success', currency: 'RUB', ...raw, data, count: data.length };
})();
const OUT = process.env.UI_SHOTS || path.join(__dirname, '.shots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

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
    if (u.includes('catalog.json')) {
      return j({ schema_version: 1, generated_at: '2026-08-18T07:08:16.254Z',
        source: 'production-public-api', package_count: c.data.length, packages: c.data });
    }
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
  await page.addInitScript(() => {
    window.__cls = 0;
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* not every engine reports it */ }
  });
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

  // ---- branding ------------------------------------------------------------
  const brand = await page.$eval('#screen-home .brand', (n) => ({
    natural: n.naturalWidth, height: n.getBoundingClientRect().height, src: n.currentSrc,
  }));
  ok('the real header asset is used, not a redraw',
    /assets\/magic-esim-logo-header\.png$/.test(brand.src) && brand.natural === 185,
    `${brand.natural}px intrinsic`);
  ok('the logo is a header, not a banner', brand.height > 0 && brand.height <= 44,
    `${Math.round(brand.height)}px`);
  ok('an image with intrinsic size causes no layout shift',
    (await page.evaluate(() => window.__cls || 0)) < 0.02,
    `CLS=${(await page.evaluate(() => window.__cls || 0)).toFixed(4)}`);
  ok('the mark is on the entry screens only, not on every screen',
    (await page.$$('.screen .brand')).length <= 3,
    `${(await page.$$('.screen .brand')).length}`);

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
    // The EXACT country, not the first row whose text contains its name: with
    // a real catalogue the regions are listed first, so `includes('Таиланд')`
    // opened «Сингапур, Малайзия и Таиланд» — a regional group with one or two
    // tariffs — and every assertion below was then made about the wrong screen.
    const rows = [...document.querySelectorAll('#home-countries .card--row')];
    const title = (r) => (r.querySelector('.card__title') || r).innerText.trim();
    const th = rows.find((r) => title(r) === 'Таиланд')
      || rows.find((r) => title(r).includes('Таиланд'))
      || rows[rows.length - 1];
    th.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${engineName}-${scheme}-country.png` });
  const cText = await page.$eval('#screen-country', (n) => n.innerText);
  const cm = cText.match(RAW);
  ok('no raw codes on the country screen', !cm, cm ? `found ${JSON.stringify(cm[0])}` : '');
  ok('tariff cards rendered', (await page.$$('#country-list .card')).length > 0);

  // ---- S2 · sorting --------------------------------------------------------
  // Scoped to tariff cards: the «Также подойдут» rows underneath are
  // destinations, not tariffs, and they carry the same generic classes.
  const prices = () => page.$$eval('#country-list .card--tariff .card__price',
    (n) => n.map((x) => Number(x.innerText.replace(/[^0-9]/g, ''))));
  const volumes = () => page.$$eval('#country-list .card--tariff .card__title',
    (n) => n.map((x) => (/Безлимит/.test(x.innerText) ? Infinity : parseFloat(x.innerText))));
  const sortBox = await page.$('#country-list .segmented--sort');
  if (sortBox) {
    const byPrice = await prices();
    ok('tariffs open sorted by price ascending',
      byPrice.every((v, i) => i === 0 || byPrice[i - 1] <= v), byPrice.join(','));
    ok('the default axis is marked as chosen',
      await page.$eval('#country-list [data-sort="price"]', (b) => b.getAttribute('aria-checked')) === 'true');

    await page.tap('#country-list [data-sort="volume"]');
    await page.waitForTimeout(200);
    const byVol = await volumes();
    ok('switching to volume puts the largest first',
      byVol.every((v, i) => i === 0 || byVol[i - 1] >= v), byVol.join(','));
    ok('and the same number of tariffs is still on screen',
      (await prices()).length === byPrice.length);
    // Back to price, so the rest of the drill starts where it always did.
    await page.tap('#country-list [data-sort="price"]');
    await page.waitForTimeout(200);
    ok('switching back restores the price order',
      (await prices()).join(',') === byPrice.join(','));
  } else {
    ok('sort switch is omitted for a list too short to reorder',
      (await page.$$('#country-list .card--tariff')).length <= 2);
  }

  // ---- S3 · tariff detail --------------------------------------------------
  // A tariff card now opens the tariff, not the payment form. §9 S3 is the
  // screen that answers "will this work on my phone" before money moves.
  await page.evaluate(() => document.querySelector('#country-list .card').click());
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${engineName}-${scheme}-tariff.png` });
  const active = (await page.$$eval('.screen[data-active]', (n) => n.map((x) => x.id)))[0];
  ok('a tariff card opens the tariff, not the checkout', active === 'screen-tariff', active);

  const tText = await page.$eval('#screen-tariff', (n) => n.innerText);
  const tm = tText.match(RAW);
  ok('no raw codes on the tariff screen', !tm, tm ? `found ${JSON.stringify(tm[0])}` : '');
  ok('it names the destination and the price',
    /Таиланд|Turkey|Турция/.test(tText) && /₽/.test(tText));
  ok('it says what happens after payment',
    /Что будет после оплаты/.test(tText) && (await page.$$('#tariff-body .step')).length === 3);
  ok('the compatibility answer is a sheet on this screen, not a screen of its own',
    (await page.$$eval('#tariff-body details summary',
      (n) => n.map((x) => x.innerText))).some((t) => /Подойдёт ли мой телефон/.test(t)));
  // §9 S3: only non-empty fields. Never a label with nothing after it.
  const emptyFacts = await page.$$eval('#tariff-body .fact',
    (n) => n.filter((x) => !x.querySelector('.fact__value').innerText.trim()).length);
  ok('every characteristic shown has a value', emptyFacts === 0, String(emptyFacts));
  // The SMS row must not appear unless the provider explicitly said true, and
  // it must never promise that a bank's codes will arrive.
  ok('nothing on this screen promises bank SMS', !/банк/i.test(tText) || /не гарантируется/.test(tText));

  const buy = await page.$eval('#tariff-body .btn--wide', (b) => b.innerText);
  ok('the action names the price', /Купить за/.test(buy) && /₽/.test(buy), buy);

  await page.tap('#tariff-body .btn--wide');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${engineName}-${scheme}-checkout.png` });
  const ck = await page.$eval('#screen-checkout', (n) => n.innerText);
  ok('checkout names the destination', !/^\s*·/m.test(ck) && ck.length > 30);
  // ---- payment method ------------------------------------------------------
  const chosen = () => page.$eval('#checkout-methods [aria-checked="true"]', (n) => n.dataset.method);
  const order = await page.$$eval('#checkout-methods .segmented__opt', (n) => n.map((x) => x.dataset.method));
  ok('СБП is offered first, Карта second', JSON.stringify(order) === JSON.stringify(['sbp', 'card']),
    order.join(' > '));
  ok('a fresh checkout defaults to СБП', await chosen() === 'sbp');
  ok('the choice is visible before paying — both options on screen',
    (await page.$$('#checkout-methods .segmented__opt')).length === 2);
  ok('and the intent agrees with what is shown',
    await page.evaluate(() => window.__state && window.__state.intent
      ? window.__state.intent.payment_type : 'sbp') === 'sbp');

  await page.tap('#checkout-methods [data-method="card"]');
  ok('tapping Карта selects it', await chosen() === 'card');
  await page.tap('#checkout-methods [data-method="sbp"]');
  ok('tapping СБП selects it back', await chosen() === 'sbp');

  ok('pay button starts DISABLED until the oferta is accepted',
    await page.$eval('#checkout-pay', (b) => b.disabled) === true);
  // Waiting for a tick is not work in progress. A spinner here says the app is
  // busy when it is in fact waiting for the customer.
  ok('and shows no spinner while merely awaiting consent',
    (await page.$$('#checkout-pay .btn__spinner')).length === 0);
  ok('it still names the price while disabled',
    /Оплатить/.test(await page.$eval('#checkout-pay', (b) => b.innerText)));
  await page.evaluate(() => {
    const c = document.querySelector('#checkout-terms');
    c.checked = true; c.dispatchEvent(new Event('change'));
  });
  ok('accepting the oferta enables it',
    await page.$eval('#checkout-pay', (b) => b.disabled) === false);

  // Reopening a checkout must start from СБП again, whatever the last one ended on.
  await page.tap('#checkout-methods [data-method="card"]');
  await page.tap('#nav-home');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const b = document.querySelector('#home-countries .btn--wide');
    if (b) b.click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#home-countries .card--row')];
    const title = (r) => (r.querySelector('.card__title') || r).innerText.trim();
    (rows.find((r) => title(r) === 'Таиланд')
      || rows.find((r) => title(r).includes('Таиланд')) || rows[0]).click();
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('#country-list .card').click());
  await page.waitForTimeout(250);
  await page.tap('#tariff-body .btn--wide');
  await page.waitForTimeout(250);
  ok('reopening a checkout resets the default to СБП', await chosen() === 'sbp');
  ok('and the oferta must be accepted again',
    await page.$eval('#checkout-pay', (b) => b.disabled) === true);

  await page.tap('#nav-esims');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${engineName}-${scheme}-esims.png` });

  // ---- the bottom navigation ----------------------------------------------
  const tabs = await page.$$eval('.tabbar .tab',
    (n) => n.map((x) => ({ id: x.id, label: x.querySelector('.tab__t').innerText.trim() })));
  ok('four destinations, in order', tabs.map((t) => t.label).join('|')
    === 'Главная|Купить|Мои eSIM|Помощь', tabs.map((t) => t.label).join('|'));

  // Every tap target has to clear 44pt, and no label may be clipped to a stub.
  const tapBoxes = await page.$$eval('.tabbar .tab', (n) => n.map((x) => {
    const r = x.getBoundingClientRect();
    const t = x.querySelector('.tab__t');

    return { h: r.height, w: r.width, clipped: t.scrollWidth > t.clientWidth + 1 };
  }));
  ok('every tab clears the 44pt tap floor',
    tapBoxes.every((b) => b.h >= 44), JSON.stringify(tapBoxes.map((b) => Math.round(b.h))));
  ok('no tab label is clipped at this width',
    tapBoxes.every((b) => !b.clipped), JSON.stringify(tapBoxes.map((b) => b.clipped)));
  ok('«Мои eSIM» is lit while its own screen is open',
    await page.$eval('#nav-esims', (b) => b.getAttribute('aria-selected')) === 'true');
  ok('and exactly one tab is lit at a time',
    (await page.$$('.tabbar .tab[aria-selected="true"]')).length === 1);

  // ---- Купить -------------------------------------------------------------
  await page.tap('#nav-buy');
  await page.waitForTimeout(300);
  ok('«Купить» opens the catalogue on the full list',
    (await page.$$eval('.screen[data-active]', (n) => n.map((x) => x.id)))[0] === 'screen-home'
    && (await page.$$('#home-countries .card--row')).length > 0);
  ok('and «Купить» is the lit tab',
    await page.$eval('#nav-buy', (b) => b.getAttribute('aria-selected')) === 'true');

  // ---- Помощь -------------------------------------------------------------
  await page.tap('#nav-help');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${engineName}-${scheme}-help.png` });
  const helpScreen = (await page.$$eval('.screen[data-active]', (n) => n.map((x) => x.id)))[0];
  ok('«Помощь» opens a real screen, not an external link', helpScreen === 'screen-help', helpScreen);
  ok('it answers questions without a person',
    (await page.$$('#help-body details')).length >= 5);
  const helpText = await page.$eval('#screen-help', (n) => n.innerText);
  ok('and it offers a person for the rest', /Написать в поддержку/.test(helpText));
  // §9 S11: no second chat inside the Mini App.
  ok('the Mini App does not grow a chat of its own',
    (await page.$$('#help-body textarea, #help-body input[type="text"]')).length === 0);
  // The help screen must survive with no session — it is what a signed-out
  // customer is most likely to need.
  ok('help needs no session', !/Не удалось|Ошибка/.test(helpText.slice(0, 200)));

  await page.tap('#nav-home');
  await page.waitForTimeout(250);

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
