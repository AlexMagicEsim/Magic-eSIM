// seo/ru-chrome.mjs — the Russian storefront's header and footer, in the shared
// design system (assets/site.css). The markup is the English header's and
// footer's (seo/build-en-pages.mjs), class for class, so the two storefronts
// look the same; the words, the links and the market are Russian.
//
// The navigation is the English one, item for item (RU↔EN migration PR C):
// Направления · Как это работает · Проверка устройства · Инструкции, and the CTA
// «Найти тариф» goes to the home's search (/#plans), as «Find a plan» does on
// /en/. The home no longer carries a catalogue: plans and the checkout live on
// the country pages.
//
// What is Russian-only and deliberately so:
//   * «English» as the language switch, pointing at the page's English twin;
//   * the Telegram links in the footer (the Mini App and the channel are
//     Russian channels); the hero of the home keeps the Mini App button;
//   * no payment-status bar (that bar says GLOBAL cannot take payment; the
//     Russian checkout can);
//   * no skip link — seo/test-en-skip-link.mjs pins that the Russian site
//     carries none.
// The destination count is the one measured wording, «190+ направлений»
// (198 countries render plans in the Russian catalogue on 2026-10-10).

import { LOGO, LOGO_ANIMATED, ICON_GLOBE, ICON_MENU } from './site-chrome.mjs';
import { text } from './site-dictionary.mjs';

/** The one wording for the size of the catalogue, everywhere on the Russian site. */
export const RU_DESTINATIONS = '190+ направлений';

/* Cyrillic first: on a Russian page it is the subset nearly every glyph needs;
 * latin carries the digits and «eSIM». */
export const RU_FONT_PRELOAD = `<link rel="preload" href="/assets/fonts/inter-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>`;

export const RU_TG_APP = 'https://t.me/magicesim_bot?startapp';
export const RU_TG_CHANNEL = 'https://t.me/magicesim';

/* Words that already live in the one site dictionary (assets/site-i18n.js) are
 * read from it rather than typed again (I18N-02). «Проверка устройства» has no
 * Russian entry there yet: adding one would change that shipped file's bytes. */
const NAV_LINKS = `<a href="/ru/esim/">${text('ru', 'nav.destinations')}</a>
      <a href="/ru/#how">${text('ru', 'nav.how')}</a>
      <a href="/ru/#compat">Проверка устройства</a>
      <a href="/ru/#guides">${text('ru', 'nav.guides')}</a>`;

/** The header. `en` is where «English» leads — the same page in English (seo/indexing.mjs enSwitchPath), «/» when
 * English has no such page. The logo is the animated vector one (site-chrome LOGO_ANIMATED) except where `animatedLogo: false`
 * — the ten SEO-experiment pages, which keep their markup byte for byte. `hreflang` marks the English link's language — on the home
 * only, which always linked /en/ that way (seo/test-en-storefront.mjs); the
 * country pages carry no hreflang at all (they have no indexable twin). */
export const ruHeader = ({ hreflang = false, animatedLogo = true, en = '/' } = {}) => `<header class="site-header">
  <div class="wrap hdr">
    <a class="brand" href="/ru/">${animatedLogo ? LOGO_ANIMATED : LOGO}</a>
    <nav class="nav" aria-label="Основное меню">
      ${NAV_LINKS}
    </nav>
    <div class="hdr-actions">
      <a class="langsw" href="${en}"${hreflang ? ' hreflang="en"' : ''} lang="en">${ICON_GLOBE}<span>English</span></a>
      <a class="btn btn-sm hdr-cta" href="/ru/#plans">Найти тариф</a>
      <details class="mnav">
        <summary aria-label="Меню">${ICON_MENU}</summary>
        <nav class="mnav-panel" aria-label="Меню">
      ${NAV_LINKS}
          <hr>
          <a href="${en}"${hreflang ? ' hreflang="en"' : ''} lang="en">English</a>
        </nav>
      </details>
    </div>
  </div>
</header>`;

/* The Russian storefront's popular destinations, in its order — ONE list.
 * Until RU↔EN migration PR C it was the home's sixteen tiles, and
 * seo/build-country-dictionary.mjs parsed it out of index.html for the Mini App
 * («popularCountries» in app/core.js). The home now shows eight, as /en/ does,
 * so the list lives here and both read it: the Mini App keeps all sixteen, the
 * site shows the first eight (RU_POPULAR). Reordering here moves both. */
export const RU_POPULAR_ALL = Object.freeze([
  { slug: 'turkey', iso: 'TR', name: 'Турция' },
  { slug: 'thailand', iso: 'TH', name: 'Таиланд' },
  { slug: 'vietnam', iso: 'VN', name: 'Вьетнам' },
  { slug: 'egypt', iso: 'EG', name: 'Египет' },
  { slug: 'maldives', iso: 'MV', name: 'Мальдивы' },
  { slug: 'sri-lanka', iso: 'LK', name: 'Шри-Ланка' },
  { slug: 'china', iso: 'CN', name: 'Китай' },
  { slug: 'italy', iso: 'IT', name: 'Италия' },
  { slug: 'uae', iso: 'AE', name: 'ОАЭ' },
  { slug: 'indonesia', iso: 'ID', name: 'Индонезия' },
  { slug: 'japan', iso: 'JP', name: 'Япония' },
  { slug: 'south-korea', iso: 'KR', name: 'Южная Корея' },
  { slug: 'spain', iso: 'ES', name: 'Испания' },
  { slug: 'france', iso: 'FR', name: 'Франция' },
  { slug: 'greece', iso: 'GR', name: 'Греция' },
  { slug: 'cyprus', iso: 'CY', name: 'Кипр' },
]);

/* The home's «Популярные направления» — eight tiles, as on /en/ (index.html,
 * #popular); the hero's «Популярно:» row shows the first six, the hub all eight.
 * Russian demand, so not the English list. */
export const RU_POPULAR = Object.freeze(RU_POPULAR_ALL.slice(0, 8));

/* The footer's «Направления» — its own list since 2026-11-06, no longer the first six of RU_POPULAR: the footer is on every
 * Russian page, so it IS the site-wide internal link to a country, and the old slice left China (seventh) out — 12 pages
 * linked it against 211 for each of the six. China goes first (the owner's priority; real Yandex Wordstat demand,
 * MAGIC_ESIM_YANDEX_WORDSTAT_SEO_2026-11-05.md, «esim/есим X» a month: Turkey 26 110, China 16 595, Egypt 5 909, Vietnam
 * 4 573, Thailand 3 371), then Kazakhstan (3 381; linked from 9 pages before — the owner's call, 2026-11-06), then the
 * Maldives and Sri Lanka (395 and 198 — low demand, but they were here before and taking them out dropped each from 211
 * linking pages to ~10). Eight, two lines more than the old six: on a phone the column is two ~31 px lines longer, at
 * 1366 px it is the tallest footer column. The UAE (2 592) and Georgia (2 723) are NOT here on purpose: both are
 * SEO-pilot pages (seo/frozen-pages.mjs), and the footer would multiply their inbound links during the pilot; Egypt (a
 * pilot page too) was already in the footer, so its links do not move. seo/test-ru-footer-destinations.mjs holds the
 * list. */
export const RU_FOOTER_DESTINATIONS = Object.freeze([
  { slug: 'china', iso: 'CN', name: 'Китай' },
  { slug: 'turkey', iso: 'TR', name: 'Турция' },
  { slug: 'thailand', iso: 'TH', name: 'Таиланд' },
  { slug: 'vietnam', iso: 'VN', name: 'Вьетнам' },
  { slug: 'egypt', iso: 'EG', name: 'Египет' },
  { slug: 'kazakhstan', iso: 'KZ', name: 'Казахстан' },
  { slug: 'maldives', iso: 'MV', name: 'Мальдивы' },
  { slug: 'sri-lanka', iso: 'LK', name: 'Шри-Ланка' },
]);

export const RU_FOOTER_GUIDES = Object.freeze([
  { href: '/ru/iphone.html', label: 'Как установить eSIM на iPhone' },
  { href: '/ru/android.html', label: 'Как установить eSIM на Android' },
  { href: '/ru/esim/compatibility/', label: 'Поддерживает ли телефон eSIM' },
  { href: '/ru/esim/activation-before-travel/', label: 'Когда устанавливать eSIM' },
  { href: '/ru/esim/not-working/', label: 'eSIM не работает — что проверить' },
  { href: '/ru/esim/payment-rubles/', label: 'Оплата российской картой или СБП' },
]);

const li = (href, label, extra = '') => `          <li><a href="${href}"${extra}>${label}</a></li>`;

export const RU_FOOTER = `<footer class="site-footer">
  <div class="wrap">
    <div class="ft-grid">
      <div class="ft-brand">
        <a href="/ru/">${LOGO}</a>
        <p>Мобильный интернет в поездке: eSIM для ${RU_DESTINATIONS}, оплата в рублях российской картой или через СБП.</p>
      </div>
      <div class="ft-col">
        <h2>Направления</h2>
        <ul>
${RU_FOOTER_DESTINATIONS.map((d) => li(`/ru/esim/${d.slug}/`, d.name)).join('\n')}
${li('/ru/esim/', 'Все направления')}
        </ul>
      </div>
      <div class="ft-col">
        <h2>Инструкции</h2>
        <ul>
${RU_FOOTER_GUIDES.map((g) => li(g.href, g.label)).join('\n')}
        </ul>
      </div>
      <div class="ft-col">
        <h2>Помощь</h2>
        <p class="support">Поддержка: <a href="mailto:support@magicesim.store">support@magicesim.store</a></p>
        <ul>
${li('/ru/#how', 'Как это работает')}
${li('/ru/#compat', 'Проверка устройства')}
${li(RU_TG_CHANNEL, 'Наш Telegram-канал', ' target="_blank" rel="noopener noreferrer"')}
${li(RU_TG_APP, 'Magic eSIM в Telegram', ' target="_blank" rel="noopener noreferrer"')}
        </ul>
      </div>
    </div>
    <div class="ft-bottom">
      <p>© Magic eSIM</p>
      <p><a href="/terms.html">Пользовательское соглашение</a> · <a href="/privacy.html">Политика конфиденциальности</a></p>
    </div>
  </div>
</footer>`;
