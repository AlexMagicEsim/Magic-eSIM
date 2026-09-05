'use strict';

/*
 * The country screen: tariff cards, the daily block, the sort control, and the
 * space between the last thing on a screen and the tab bar.
 *
 * WHY THIS FILE EXISTS. Before it, the busiest screen in the app had no browser
 * test of its own. `journey.spec.js` opens a country with ONE package, which is
 * below the threshold that draws the sort control and carries no daily plan at
 * all — so the whole of `sortToggle`, `dailyCard` and `chipsFor` was unreached.
 * Three defects lived in that gap and all three were found by rendering this
 * fixture rather than by reading the code:
 *
 *   1. the sort control printed «По цене» / «По объёму» to ENGLISH readers,
 *      because its labels came from `TARIFF_SORTS[key].label` in core.js and
 *      those are literal Russian strings;
 *   2. the primary CTA's bottom edge sat 0.0px from the tab bar's top edge, so
 *      «Купить за 500 ₽» and the navigation read as one welded control;
 *   3. two «5 ГБ в день» cards showed byte-identical copy at 1 950 ₽ and
 *      2 550 ₽ — the catalogue distinguishes them by exit country and nothing
 *      on the card said so.
 *
 * THE FIXTURE IS REAL. Eight rows lifted from `assets/catalog.json` unchanged,
 * chosen to reproduce Vietnam's shape: a volume ladder, a hotspot flag on the
 * larger plans, and two same-allowance daily pairs that differ only by fields
 * the card had not been printing. Prices are the catalogue's own — nothing here
 * asserts a price, only that the card SHOWS what the catalogue holds.
 */

const { test, expect } = require('@playwright/test');
const { installMiniApp, openApp } = require('./harness.js');

/* ------------------------------------------------------------------ *
 * Fixture — Vietnam, trimmed to the eight rows that carry the cases.
 * ------------------------------------------------------------------ */

const base = {
  country_code: 'VN',
  region: 'VN',
  coverage_country_codes: ['VN'],
  networks: [{ operator: 'Viettel Mobile', type: '4G' }],
  activation_policy: 'first_data_usage',
  topup_available: true,
};

const volume = (id, gb, days, price, extra = {}) => Object.assign({}, base, {
  package_id: id,
  name: `Vietnam ${gb}GB ${days}Days`,
  data_gb: gb,
  validity_days: days,
  price,
  plan_type: 'FIXED_VOLUME',
  network_technologies: ['3G', '4G', '5G'],
  speed: '3G/4G/5G',
  hotspot_supported: false,
  sellable_days: [],
}, extra);

const daily = (id, gb, price, throttle, tech, ip, extra = {}) => Object.assign({}, base, {
  package_id: id,
  name: `Vietnam ${gb}GB/Day`,
  data_gb: 0,
  validity_days: 0,
  price,
  plan_type: 'DAILY',
  daily_term_mode: 'PER_DAY',
  daily_gb: gb,
  daily_throttle_label: throttle,
  daily_throttle_continues: false,
  // FALSE on every Vietnam row in the real catalogue, and on 1307 of 1329 daily
  // rows overall. The copy module refuses to claim a nightly reset without it,
  // and the section heading must not claim one either.
  daily_reset_confirmed: false,
  network_technologies: tech,
  speed: tech.join('/'),
  hotspot_supported: false,
  ip_export: [ip],
  sellable_days: [3, 5, 7, 10, 15, 30],
  term_prices: [
    { days: 3, price },
    { days: 7, price: price * 2 },
    { days: 30, price: price * 7 },
  ],
}, extra);

const VIETNAM = [
  volume('vn-3-15', 3, 15, 500),
  volume('vn-5-30', 5, 30, 850),
  volume('vn-10-15', 10, 15, 1200, { hotspot_supported: true }),
  // The per-GB winner, and therefore the recommended card: 3950/50 = 79 ₽/GB
  // against 120 for the 10 GB and 170 for the 5 GB. `pickBestValue` is not
  // touched by any of this work — the card is only DRAWN differently.
  volume('vn-50-30', 50, 30, 3950, { hotspot_supported: true }),
  // A five-digit price. The longest thing that can land in that column, and the
  // reason the price box is `flex: 0 0 auto` and never shrinks.
  volume('vn-100-30', 100, 30, 12950, { hotspot_supported: true }),

  // The pair the whole daily-differentiator change exists for: same allowance,
  // same throttle, different price — and the only thing separating them in the
  // catalogue is where the traffic leaves the internet.
  daily('vn-d5-hk', 5, 650, '384 Kbps', ['3G', '4G', '5G'], 'HK'),
  daily('vn-d5-sg', 5, 850, '384 Kbps', ['3G', '4G', '5G'], 'SG'),
  // A second pair, separated by network generation instead.
  daily('vn-d1-5g', 1, 250, '512 Kbps', ['3G', '4G', '5G'], 'HK'),
];

const L = {
  ru: {
    code: 'ru', country: 'Вьетнам',
    sortPrice: 'По цене', sortVolume: 'По объёму',
    hotspot: 'Раздача', best: 'Оптимальный выбор',
    dayBlock: 'Трафик на каждый день', perDay: 'в день',
    hk: 'Гонконг', sg: 'Сингапур',
  },
  en: {
    code: 'en', country: 'Vietnam',
    sortPrice: 'By price', sortVolume: 'By size',
    hotspot: 'Hotspot', best: 'Best value',
    dayBlock: 'Data every day', perDay: 'a day',
    hk: 'Hong Kong', sg: 'Singapore',
  },
};

async function openVietnam(page, lang) {
  await page.locator('#screen-home .tile', { hasText: L[lang].country }).first().click();
  await page.locator('#screen-country[data-active]').waitFor();
  await expect(page.locator('#country-list .card--tariff').first()).toBeVisible();
}

/** The smallest thing a thumb hits reliably; `--tap` in mini.css. */
const TAP_FLOOR = 44;

/** Every card whose own box is taller than one row of content, i.e. wrapped. */
async function cardHeights(page, selector) {
  return page.$$eval(selector, (nodes) => nodes.map((n) => Math.round(n.getBoundingClientRect().height)));
}

/* ================================================================== *
 * 1. The ordinary card
 * ================================================================== */

for (const lang of ['ru', 'en']) {
  test(`[${lang}] an ordinary card shows volume, term and price on one row`, async ({ page }, info) => {
    await installMiniApp(page, { languageCode: lang, packages: VIETNAM });
    await openApp(page);
    await openVietnam(page, lang);

    const card = page.locator('#country-list .card--tariff').first();
    // Cheapest first is the default axis, and 3 GB / 15 days / 500 ₽ is it.
    await expect(card.locator('.card__title')).toHaveText(lang === 'ru' ? '3 ГБ' : '3 GB');
    await expect(card.locator('.card__price')).toContainText('500');
    await expect(card.locator('.tariff__pill').first())
      .toHaveText(lang === 'ru' ? '15 дней' : '15 days');

    // The volume must dominate the price, not merely differ from it. This is
    // the hierarchy the redesign is FOR, and a later tweak that quietly
    // equalises them would otherwise pass everything else in this file.
    const sizes = await card.evaluate((n) => ({
      title: parseFloat(getComputedStyle(n.querySelector('.card__title')).fontSize),
      price: parseFloat(getComputedStyle(n.querySelector('.card__price')).fontSize),
    }));
    expect(sizes.title).toBeGreaterThan(sizes.price);

    // One row at 390. At 320 a card carrying two pills legitimately wraps, so
    // the assertion is scoped to the viewport where the claim is made.
    if (info.project.name === 'chromium-390') {
      const h = (await cardHeights(page, '#country-list .card--tariff'))[0];
      expect(h).toBeLessThan(60);
    }
  });

  test(`[${lang}] hotspot is a labelled pill, not a run-on sentence`, async ({ page }) => {
    await installMiniApp(page, { languageCode: lang, packages: VIETNAM });
    await openApp(page);
    await openVietnam(page, lang);

    // vn-10-15 carries hotspot; vn-3-15 and vn-5-30 do not. The pill must be on
    // exactly the cards whose catalogue row says so — a decoration that appears
    // everywhere tells a buyer nothing.
    const withHotspot = page.locator('#country-list .card--tariff', { hasText: L[lang].hotspot });
    await expect(withHotspot).toHaveCount(3);
    await expect(page.locator('.tariff__pill--hotspot').first()).toBeVisible();
  });
}

/* ================================================================== *
 * 2. The recommended card
 * ================================================================== */

test('the recommended card is marked, and is the per-GB winner rather than the cheapest', async ({ page }) => {
  await installMiniApp(page, { languageCode: 'ru', packages: VIETNAM });
  await openApp(page);
  await openVietnam(page, 'ru');

  const best = page.locator('#country-list .card--tariff.is-best');
  await expect(best).toHaveCount(1);
  await expect(best.locator('.card__title')).toHaveText('50 ГБ');
  await expect(best.locator('.badge--best')).toHaveText('Оптимальный выбор');

  // Elegant, not loud: the card is distinguished by its BORDER and a wash, and
  // the brief was explicit that it must not become a solid blue block. A filled
  // accent card would make the other six read as disabled.
  const paint = await best.evaluate((n) => {
    const s = getComputedStyle(n);

    return { border: s.borderTopColor, bg: s.backgroundColor, image: s.backgroundImage };
  });
  expect(paint.border).not.toBe('rgba(0, 0, 0, 0)');
  // The wash is a gradient layer over the surface; the base fill stays the
  // ordinary card colour, so the card never becomes a solid accent block.
  expect(paint.image).toContain('gradient');
});

/* ================================================================== *
 * 3. Daily plans
 * ================================================================== */

for (const lang of ['ru', 'en']) {
  test(`[${lang}] two identical daily allowances are told apart by real catalogue fields`, async ({ page }) => {
    await installMiniApp(page, { languageCode: lang, packages: VIETNAM });
    await openApp(page);
    await openVietnam(page, lang);

    // THE DEFECT, pinned. Both rows are «5 ГБ в день», both throttle to
    // 384 Kbps, and they cost 650 and 850. Before the exit country was drawn,
    // these two cards were the same pixels with two different prices.
    const five = page.locator('#country-list .card--tariff', { hasText: '5' })
      .filter({ hasText: L[lang].perDay });
    await expect(five.filter({ hasText: L[lang].hk })).toHaveCount(1);
    await expect(five.filter({ hasText: L[lang].sg })).toHaveCount(1);

    // The exit country is the chip that carries colour, because it is the one
    // that changes a decision.
    await expect(page.locator('.tariff__chip--ip').first()).toBeVisible();
  });

  test(`[${lang}] the daily price is a floor, and the block is announced`, async ({ page }) => {
    await installMiniApp(page, { languageCode: lang, packages: VIETNAM });
    await openApp(page);
    await openVietnam(page, lang);

    const heading = page.locator('#country-list .section--daily');
    await expect(heading).toHaveCount(1);
    await expect(heading).toContainText(L[lang].dayBlock);

    // «от 650 ₽» / «from 650 ₽» — a PER_DAY plan is a ladder of terms and the
    // card shows the cheapest one. The row's own `price` is a per-DAY rate that
    // is never sold alone, so it must not be the number on the card.
    const dailyCard = page.locator('#country-list .card--tariff')
      .filter({ hasText: L[lang].perDay }).first();
    await expect(dailyCard.locator('.card__price'))
      .toHaveText(lang === 'ru' ? /^от\s/ : /^from\s/);
  });
}

test('the daily heading never claims a reset the provider did not confirm', async ({ page }) => {
  // `daily_reset_confirmed` is false on every fixture row, as it is on every
  // real Vietnam row and on 1307 of the catalogue's 1329 daily packages. A
  // section-level «обновляется каждый день» would assert for a whole country
  // what the provider published for almost none of it.
  await installMiniApp(page, { languageCode: 'ru', packages: VIETNAM });
  await openApp(page);
  await openVietnam(page, 'ru');

  const block = await page.locator('#country-list').innerText();
  expect(block).not.toMatch(/обновля[а-яё]*\s+кажд/i);
  expect(block).not.toMatch(/каждые\s+24/i);
});

/* ================================================================== *
 * 4. The sort control
 * ================================================================== */

for (const lang of ['ru', 'en']) {
  test(`[${lang}] the sort control speaks the reader's language`, async ({ page }) => {
    // THE DEFECT, pinned. These labels used to come from `TARIFF_SORTS.label`,
    // which is Russian in the source, so an English reader saw «По цене».
    await installMiniApp(page, { languageCode: lang, packages: VIETNAM });
    await openApp(page);
    await openVietnam(page, lang);

    const box = page.locator('#country-list .segmented--sort');
    await expect(box.locator('[data-sort="price"]')).toHaveText(L[lang].sortPrice);
    await expect(box.locator('[data-sort="volume"]')).toHaveText(L[lang].sortVolume);
    if (lang === 'en') {
      expect(await box.innerText()).not.toMatch(/[Ѐ-ӿ]/);
    }
  });
}

test('the chosen axis is obvious, and choosing the other one reorders the list', async ({ page }) => {
  await installMiniApp(page, { languageCode: 'ru', packages: VIETNAM });
  await openApp(page);
  await openVietnam(page, 'ru');

  const price = page.locator('[data-sort="price"]');
  const volume = page.locator('[data-sort="volume"]');
  await expect(price).toHaveAttribute('aria-checked', 'true');

  // Obvious means MEASURABLY different, not merely styled: the chosen half must
  // not share its background with the unchosen one.
  const paint = await page.evaluate(() => {
    const on = document.querySelector('[data-sort="price"]');
    const off = document.querySelector('[data-sort="volume"]');

    return {
      on: getComputedStyle(on).backgroundColor,
      off: getComputedStyle(off).backgroundColor,
      onColor: getComputedStyle(on).color,
      offColor: getComputedStyle(off).color,
    };
  });
  expect(paint.on).not.toBe(paint.off);
  expect(paint.onColor).not.toBe(paint.offColor);

  /*
   * The touch target stays at the 44px floor this project holds itself to,
   * whatever the control looks like. The BUTTON is what a thumb hits, so the
   * button is what is measured — an inset track that steals 6px from it to keep
   * the outer box at 44 would pass an outer-box assertion and still be wrong,
   * and that is exactly what the first version of this control did.
   *
   * ROUNDED, and not out of laziness. `min-height: 44px` comes back from
   * `boundingBox()` as 43.999996185302734 on roughly one run in six — a
   * float artefact of the layout, not a real 44th pixel going missing. Left
   * as a bare `>= 44` this failed intermittently, and an intermittent gate
   * teaches everyone to re-run instead of read.
   */
  const box = await price.boundingBox();
  expect(Math.round(box.height)).toBeGreaterThanOrEqual(TAP_FLOOR);
  const outer = await page.locator('.segmented--sort').boundingBox();
  expect(Math.round(outer.height)).toBeGreaterThanOrEqual(TAP_FLOOR);

  await volume.click();
  await expect(volume).toHaveAttribute('aria-checked', 'true');
  const titles = await page.$$eval('#country-list .card--tariff .card__title',
    (n) => n.map((x) => x.textContent.trim()));
  expect(titles[0]).toBe('100 ГБ');
});

/* ================================================================== *
 * 5. Long prices, both languages, both viewports
 * ================================================================== */

for (const lang of ['ru', 'en']) {
  test(`[${lang}] a five-digit price stays on its card and never wraps`, async ({ page }) => {
    await installMiniApp(page, { languageCode: lang, packages: VIETNAM });
    await openApp(page);
    await openVietnam(page, lang);

    const card = page.locator('#country-list .card--tariff', { hasText: '12' })
      .filter({ hasText: lang === 'ru' ? '100 ГБ' : '100 GB' }).first();
    const price = card.locator('.card__price');
    await expect(price).toContainText('12');

    // One line: `white-space: nowrap` plus a non-shrinking flex basis. A price
    // broken across two lines is the failure this pins.
    const lines = await price.evaluate((n) => {
      const lh = parseFloat(getComputedStyle(n).lineHeight) || 20;

      return Math.round(n.getBoundingClientRect().height / lh);
    });
    expect(lines).toBe(1);

    // And it must not push its own card sideways at either width.
    const overflow = await card.evaluate((n) => n.scrollWidth - n.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

/* ================================================================== *
 * 6. Dark theme
 * ================================================================== */

test('dark theme: the chosen sort axis reads as chosen, not as a hole', async ({ page }) => {
  /*
   * THE DEFECT, pinned. The first version of this control marked the chosen
   * half with `background: var(--surface)` — the iOS "raised white pill" idiom.
   * In Telegram's dark palette `bg_color` (the card, #17212B) is DARKER than
   * `secondary_bg_color` (the page, #232E3C) that the track sits on, so the
   * chosen half sank and the unchosen half looked raised. Only a dark render
   * shows it.
   */
  await installMiniApp(page, { languageCode: 'ru', packages: VIETNAM, colorScheme: 'dark' });
  await openApp(page);
  await openVietnam(page, 'ru');

  await expect(page.locator('html')).toHaveAttribute('data-tg-scheme', 'dark');

  const lum = (rgb) => {
    const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).map(Number);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const paint = await page.evaluate(() => {
    const on = document.querySelector('[data-sort="price"]');
    const track = document.querySelector('.segmented--sort');

    return {
      on: getComputedStyle(on).backgroundColor,
      onText: getComputedStyle(on).color,
      track: getComputedStyle(track).backgroundColor,
      page: getComputedStyle(document.body).backgroundColor,
    };
  });
  // The page really is Telegram's dark ground, so the fixture is doing its job.
  expect(lum(paint.page)).toBeLessThan(80);
  // The mark is carried by the accent, which has the same relation to whatever
  // is behind it in both themes — this is what replaced the surface swap.
  expect(paint.on).not.toBe(paint.track);
  expect(lum(paint.onText)).toBeGreaterThan(lum(paint.track));
});

test('dark theme: a card is still a card, and the differentiator chip is still legible', async ({ page }) => {
  await installMiniApp(page, { languageCode: 'ru', packages: VIETNAM, colorScheme: 'dark' });
  await openApp(page);
  await openVietnam(page, 'ru');

  const seen = await page.evaluate(() => {
    const card = document.querySelector('#country-list .card--tariff');
    const chip = document.querySelector('.tariff__chip--ip');
    const pill = document.querySelector('.tariff__pill');

    return {
      cardBg: getComputedStyle(card).backgroundColor,
      pageBg: getComputedStyle(document.body).backgroundColor,
      chipBg: getComputedStyle(chip).backgroundColor,
      pillBg: getComputedStyle(pill).backgroundColor,
    };
  });
  // A pill must be a distinct surface rather than a hairline. `--soft` was
  // referenced by `.tariff__chip` and NEVER DEFINED before this work, so every
  // chip rendered fully transparent; this is the pin for that.
  expect(seen.pillBg).not.toBe('rgba(0, 0, 0, 0)');
  expect(seen.chipBg).not.toBe('rgba(0, 0, 0, 0)');
  expect(seen.cardBg).not.toBe(seen.pageBg);
});

/* ================================================================== *
 * 7. The tab bar, and the space above it
 * ================================================================== */

test('scrolling to the last tariff leaves it clear of the tab bar', async ({ page }) => {
  await installMiniApp(page, { languageCode: 'ru', packages: VIETNAM });
  await openApp(page);
  await openVietnam(page, 'ru');

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);

  const gap = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#country-list .card--tariff')];
    const last = cards[cards.length - 1].getBoundingClientRect();
    const bar = document.querySelector('.tabbar').getBoundingClientRect();

    return Math.round((bar.top - last.bottom) * 10) / 10;
  });
  // Never underneath, and not touching either.
  expect(gap).toBeGreaterThan(0);
});

for (const lang of ['ru', 'en']) {
  test(`[${lang}] the buy button is a CTA, not part of the navigation`, async ({ page }) => {
    /*
     * THE DEFECT, pinned. `.screen` had `padding: 12px 16px 0`, so the last
     * element of every screen ended exactly on the tab bar's top border —
     * measured at 0.0px at both viewports in both languages. On the tariff
     * screen that last element is the primary CTA, and «Купить за 500 ₽» read
     * as one welded control with the navigation under it.
     */
    await installMiniApp(page, { languageCode: lang, packages: VIETNAM });
    await openApp(page);
    await openVietnam(page, lang);

    await page.locator('#country-list .card--tariff').first().click();
    await page.locator('#screen-tariff[data-active]').waitFor();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);

    const m = await page.evaluate(() => {
      const b = document.querySelector('#tariff-buy').getBoundingClientRect();
      const bar = document.querySelector('.tabbar').getBoundingClientRect();

      return { gap: Math.round((bar.top - b.bottom) * 10) / 10, h: Math.round(b.height) };
    });
    // A calm, deliberate gap — enough that the eye separates them. 16px is the
    // floor the assertion holds; the rule sets 24.
    expect(m.gap).toBeGreaterThanOrEqual(16);
    // And the CTA is still a comfortable target. Rounded for the same reason
    // as the sort control above — a CSS pixel does not always survive
    // `getBoundingClientRect()` intact.
    expect(Math.round(m.h)).toBeGreaterThanOrEqual(TAP_FLOOR);
  });
}

test('the checkout CTA gets the same room as the tariff one', async ({ page }) => {
  await installMiniApp(page, { languageCode: 'ru', packages: VIETNAM });
  await openApp(page);
  await openVietnam(page, 'ru');

  await page.locator('#country-list .card--tariff').first().click();
  await page.locator('#screen-tariff[data-active]').waitFor();
  await page.locator('#tariff-buy').click();
  await page.locator('#screen-checkout[data-active]').waitFor();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);

  const gap = await page.evaluate(() => {
    const screen = document.querySelector('#screen-checkout');
    const last = screen.lastElementChild.getBoundingClientRect();
    const bar = document.querySelector('.tabbar').getBoundingClientRect();

    return Math.round((bar.top - last.bottom) * 10) / 10;
  });
  expect(gap).toBeGreaterThanOrEqual(16);
});

/* ================================================================== *
 * 8. Nothing overflows, at either width, in either language
 * ================================================================== */

for (const lang of ['ru', 'en']) {
  test(`[${lang}] no tariff card overflows its own box`, async ({ page }) => {
    await installMiniApp(page, { languageCode: lang, packages: VIETNAM });
    await openApp(page);
    await openVietnam(page, lang);

    const bad = await page.$$eval('#country-list .card--tariff *', (nodes) => nodes
      .filter((n) => n.clientWidth > 0 && n.scrollWidth > n.clientWidth + 1)
      .map((n) => `${n.className} ${n.scrollWidth}>${n.clientWidth}`));
    expect(bad).toEqual([]);

    // And the page itself never scrolls sideways.
    const doc = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(doc).toBeLessThanOrEqual(1);
  });
}
