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

import { LOGO, ICON_GLOBE, ICON_MENU } from './site-chrome.mjs';

/** The one wording for the size of the catalogue, everywhere on the Russian site. */
export const RU_DESTINATIONS = '190+ направлений';

/* Cyrillic first: on a Russian page it is the subset nearly every glyph needs;
 * latin carries the digits and «eSIM». */
export const RU_FONT_PRELOAD = `<link rel="preload" href="/assets/fonts/inter-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>`;

export const RU_TG_APP = 'https://t.me/magicesim_bot?startapp';
export const RU_TG_CHANNEL = 'https://t.me/magicesim';

const NAV_LINKS = `<a href="/esim/">Направления</a>
      <a href="/#how">Как это работает</a>
      <a href="/#compat">Проверка устройства</a>
      <a href="/#guides">Инструкции</a>`;

/** The header. `hreflang` marks the English link's language — on the home
 * only, which always linked /en/ that way (seo/test-en-storefront.mjs); the
 * country pages carry no hreflang at all (they have no indexable twin). */
export const ruHeader = ({ hreflang = false } = {}) => `<header class="site-header">
  <div class="wrap hdr">
    <a class="brand" href="/">${LOGO}</a>
    <nav class="nav" aria-label="Основное меню">
      ${NAV_LINKS}
    </nav>
    <div class="hdr-actions">
      <a class="langsw" href="/en/"${hreflang ? ' hreflang="en"' : ''} lang="en">${ICON_GLOBE}<span>English</span></a>
      <a class="btn btn-sm hdr-cta" href="/#plans">Найти тариф</a>
      <details class="mnav">
        <summary aria-label="Меню">${ICON_MENU}</summary>
        <nav class="mnav-panel" aria-label="Меню">
      ${NAV_LINKS}
          <hr>
          <a href="/en/"${hreflang ? ' hreflang="en"' : ''} lang="en">English</a>
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
 * #popular); the hero's «Популярно:» row and the footer show the first six, the
 * hub all eight. Russian demand, so not the English list. */
export const RU_POPULAR = Object.freeze(RU_POPULAR_ALL.slice(0, 8));
export const RU_FOOTER_DESTINATIONS = RU_POPULAR.slice(0, 6);

export const RU_FOOTER_GUIDES = Object.freeze([
  { href: '/iphone.html', label: 'Как установить eSIM на iPhone' },
  { href: '/android.html', label: 'Как установить eSIM на Android' },
  { href: '/esim/compatibility/', label: 'Поддерживает ли телефон eSIM' },
  { href: '/esim/activation-before-travel/', label: 'Когда устанавливать eSIM' },
  { href: '/esim/not-working/', label: 'eSIM не работает — что проверить' },
  { href: '/esim/payment-rubles/', label: 'Оплата российской картой или СБП' },
]);

const li = (href, label, extra = '') => `          <li><a href="${href}"${extra}>${label}</a></li>`;

export const RU_FOOTER = `<footer class="site-footer">
  <div class="wrap">
    <div class="ft-grid">
      <div class="ft-brand">
        <a href="/">${LOGO}</a>
        <p>Мобильный интернет в поездке: eSIM для ${RU_DESTINATIONS}, оплата в рублях российской картой или через СБП.</p>
      </div>
      <div class="ft-col">
        <h2>Направления</h2>
        <ul>
${RU_FOOTER_DESTINATIONS.map((d) => li(`/esim/${d.slug}/`, d.name)).join('\n')}
${li('/esim/', 'Все направления')}
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
${li('/#how', 'Как это работает')}
${li('/#compat', 'Проверка устройства')}
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
