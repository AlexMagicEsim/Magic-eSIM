'use strict';

/*
 * The Mini App as the brand book v1.0 draws it (approved 2026-10-20), in Telegram's light and dark
 * themes: Inter actually loaded and applied, the slogan exactly «Stay Connected Anywhere» (no full
 * stop), the primary button the brand blue, the state badges in the palette's colours (lifted in
 * dark), and axe's colour-contrast rule clean on the home screen. seo/test-miniapp-brand.mjs pins the
 * stylesheet's shape. Nothing leaves the machine: the harness answers Telegram and the API.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { installMiniApp, openApp } = require('./harness.js');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8')).packages;
const pick = (cc) => CATALOG.filter((p) => (p.coverage_country_codes || []).join() === cc).slice(0, 6);
const PACKAGES = [...pick('TR'), ...pick('TH'), ...pick('AE'), ...pick('CN')];

// Computed colours come back as rgb() or, from color-mix, as color(srgb r g b) in 0..1.
const toRgb = (s) => { let m = s.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)/); if (m) return m.slice(1, 4).map(Number);
  m = s.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/); return m.slice(1, 4).map((v) => Math.round(Number(v) * 255)); };
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Probes styled by the app's own classes, so the test reads what mini.css resolves to.
const probe = (page, cls) => page.evaluate((c) => {
  const el = document.createElement(c.startsWith('btn') ? 'button' : 'span');
  el.className = c; el.textContent = 'Проверка';
  document.querySelector('#screen-home').appendChild(el);
  const s = getComputedStyle(el); const out = { color: s.color, background: s.backgroundColor };
  el.remove(); return out;
}, cls);

for (const scheme of ['light', 'dark']) {
  test(`${scheme}: Inter, the slogan, the brand button and state colours`, async ({ page }) => {
    await installMiniApp(page, { languageCode: 'ru', packages: PACKAGES, colorScheme: scheme });
    await openApp(page);
    await page.evaluate(() => document.fonts.ready);

    const font = await page.evaluate(() => ({
      family: getComputedStyle(document.body).fontFamily,
      loaded: [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'Inter' && f.status === 'loaded').length,
      check: document.fonts.check('600 16px Inter', 'Интернет'),
    }));
    expect(font.family.startsWith('Inter') || font.family.startsWith('"Inter"')).toBe(true);
    expect(font.loaded).toBeGreaterThan(0);
    expect(font.check).toBe(true);

    await expect(page.locator('.hero__sub--slogan')).toHaveText('Stay Connected Anywhere');
    await expect(page.locator('.hero__sub--slogan')).toHaveAttribute('lang', 'en');

    expect((await probe(page, 'btn')).background).toBe('rgb(66, 103, 232)');
    const good = await probe(page, 'badge badge--good');
    const bad = await probe(page, 'badge badge--bad');
    if (scheme === 'light') {
      expect(good.color).toBe('rgb(20, 121, 74)');        // #14794A on #E7F6EE — the brand book's chip pair
      expect(good.background).toBe('rgb(231, 246, 238)');
      expect(bad.color).toBe('rgb(197, 55, 43)');         // Error #C5372B
      // The home screen fades its sections in; measured mid-fade, text is translucent and fails. Wait it out.
      await page.evaluate(() => Promise.all(document.getAnimations().filter((x) => x.effect && x.effect.getComputedTiming().iterations !== Infinity).map((x) => x.finished.catch(() => {}))));
      await page.evaluate(AXE);   // the app's CSP forbids inline scripts, so not addScriptTag
      const res = await page.evaluate(() => window.axe.run('#screen-home', { runOnly: { type: 'rule', values: ['color-contrast'] } }));
      expect(res.violations.map((v) => v.nodes.map((n) => n.target.join(' ')).join(', '))).toEqual([]);
    } else {
      // The palette lifted toward white (55 / 45), read on Telegram's dark card #17212B.
      // (axe is not run here: Telegram's own hint colour on its dark surfaces is under 4.5:1 on main
      // too — Telegram decides those, not the brand.)
      for (const cls of ['badge badge--good', 'badge badge--warn', 'badge badge--bad']) {
        const c = toRgb((await probe(page, cls)).color);
        expect(contrast(c, [0x17, 0x21, 0x2b]), cls).toBeGreaterThanOrEqual(4.5);
      }
      expect(good.color).not.toBe('rgb(74, 222, 128)');   // not the old off-palette greens and reds
      expect(bad.color).not.toBe('rgb(248, 113, 113)');
    }
  });
}

test('English: the slogan is the same English line, the title follows the language', async ({ page }) => {
  await installMiniApp(page, { languageCode: 'en', packages: PACKAGES });
  await openApp(page);
  await expect(page.locator('.hero__sub--slogan')).toHaveText('Stay Connected Anywhere');
  await expect(page.locator('.hero h1')).not.toHaveText(/Интернет/);
});
