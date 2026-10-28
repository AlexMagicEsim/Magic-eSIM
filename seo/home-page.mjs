/* THE HOME PAGE of a prefixed language (/en/, /es/, …) — ONE template for every language (I18N ES-0, 2026-10-21).
 *
 * Until ES-0 the English home was the one hand-written page of the English site (en/index.html); a Spanish home would
 * have been a second hand-written copy of it, drifting the day either changed. It is now built by the same generator as
 * the country pages, from the same pieces: the shared header (with the language switch), the payment notice and the
 * footer; interface words from assets/i18n/<code>.js (re-applied at runtime through data-i18n), page words from
 * seo/page-copy.mjs (`home*`, `quick`), the popular destinations from the language's own copy, the guide cards from its
 * guides. For English the output is BYTE FOR BYTE the page it replaced (seo/test-locale-home.mjs keeps it so).
 *
 * Indexing is the registry's: a language whose home is indexable (seo/locales.mjs `site.indexableHome`) gets the
 * hreflang cluster of every indexable home, x-default and `index, follow`; any other gets `noindex, follow` and no
 * alternate. The HTML comments below are for maintainers and stay English in every language. */

import { siteI18nBundle } from './site-i18n-bundle.mjs';
import { SELLER_ID } from './seller-entity.mjs';

export function homePage({ L, P, SITE, C, t, a, esc, json, header, twins, PAYBAR, FOOTER, POPULAR, QUICK, GUIDES,
  HEAD_ICONS, FONT_PRELOAD, LOGO_ONCE_SCRIPT_MOTION, cspMeta, indexing }) {
  return `<!doctype html>
<html lang="${L.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${C.homeTitle}</title>
<meta name="description" content="${C.homeDescription}">
<link rel="canonical" href="${SITE}${P}/">
${indexing.alternates}<meta property="og:type" content="website">
<meta property="og:locale" content="${L.ogLocale}">
${indexing.ogAlternates}<meta property="og:url" content="${SITE}${P}/">
<meta property="og:title" content="${C.homeTitle}">
<meta property="og:description" content="${C.homeOgDescription}">
<meta property="og:image" content="https://magicesim.store/assets/magic-esim-logo.png">
<meta name="twitter:card" content="summary">
${indexing.robots}
<!-- The same policy as the generated English pages (seo/build-en-pages.mjs
     cspMeta): this page reads no API, so connect-src is 'none'. -->
${cspMeta("'none'")}
${HEAD_ICONS}
<!-- The seller, WebSite and WebPage. The seller is the site's ONE entity (seo/seller-entity.mjs SELLER_ID,
     declared in full on the Russian home with its Russian description): here it is referenced by the same @id with
     name, url and logo only — no second identity, no description in another language. \`inLanguage\` sits on
     WebSite and WebPage (CreativeWork); schema.org has none on an organisation. -->
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
 {"@type":"OnlineStore","@id":"${SELLER_ID}","name":"Magic eSIM",
  "url":"https://magicesim.store/","logo":"https://magicesim.store/assets/magic-esim-logo.png"},
 {"@type":"WebSite","@id":"${SITE}${P}/#website","url":"${SITE}${P}/",
  "name":"Magic eSIM","inLanguage":"${L.htmlLang}","publisher":{"@id":"${SELLER_ID}"}},
 {"@type":"WebPage","@id":"${SITE}${P}/#webpage","url":"${SITE}${P}/",
  "name":${json(C.homeTitle)},"inLanguage":"${L.htmlLang}",
  "isPartOf":{"@id":"${SITE}${P}/#website"}}
]}
</script>
${FONT_PRELOAD}
${LOGO_ONCE_SCRIPT_MOTION}
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/en/en.css">
<link rel="stylesheet" href="/assets/page-home.css">
</head>
<body>
${header(twins)}
${PAYBAR}

<main class="home" id="main" tabindex="-1">
  <section class="hero">
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <p class="eyebrow"><span class="dot" aria-hidden="true"></span><span data-i18n="home.eyebrow">${t('home.eyebrow')}</span></p>
        <h1><span data-i18n="home.h1a">${t('home.h1a')}</span> <span class="grad-text" data-i18n="home.h1b">${t('home.h1b')}</span></h1>
        <p class="lead" data-i18n="site.lead">${t('site.lead')}</p>

        <!-- The search is the page's main call to action. Results are plain
             links to /en/esim/<slug>/, where the plans are. The home reads no
             catalogue: the destination list is static. -->
        <div class="search-card" id="plans" role="search">
          <label for="q" data-i18n="site.chooseCountry">${t('site.chooseCountry')}</label>
          <div class="search-row">
            <div class="search-field">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
              <input type="text" id="q" autocomplete="off" spellcheck="false" enterkeyhint="go" aria-controls="results"
                     data-i18n-attr="placeholder:home.searchPlaceholder" placeholder="${a('home.searchPlaceholder')}">
            </div>
            <button type="button" class="btn" id="qGo" data-i18n="home.find">${t('home.find')}</button>
          </div>
          <div class="results" id="results" hidden></div>
          <noscript><p class="note nojs-search">${C.homeNojsSearch} <a href="${P}/esim/">${C.homeNojsBrowse}</a></p></noscript>
        </div>

        <div class="quick">
          <span data-i18n="home.popularShort">${t('home.popularShort')}</span>
${QUICK.map((c) => `          <a href="${P}/esim/${c.slug}/"><img class="flag" src="/assets/flags/${c.iso.toLowerCase()}.svg" alt="" width="22" height="16">${esc(c.name)}</a>`).join('\n')}
        </div>

        <ul class="facts">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span data-i18n="home.fact1">${t('home.fact1')}</span></li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span data-i18n="home.fact2">${t('home.fact2')}</span></li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span data-i18n="home.fact3">${t('home.fact3')}</span></li>
        </ul>
      </div>

      <!-- Decoration only: the Magic eSIM Data Pass — a travel pass for mobile
           data, drawn in HTML/CSS/SVG. Every word on it is a fact about the
           product (logo, eSIM, 190+ destinations, install by QR code); no
           flight, gate, seat or time. The QR pattern is not a code. Hidden from
           assistive technology, and not shown below 960 px. -->
      <div class="hero-art" aria-hidden="true">
        <div class="dp-stage">
          <div class="dp-glow"></div>
          <div class="dp-back">
            <svg class="dp-back-art" viewBox="0 0 260 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <g fill="none" stroke="#fff" stroke-linecap="round">
                <circle cx="250" cy="40" r="70" stroke-opacity=".14" stroke-dasharray="1 6" stroke-width="2"/>
                <circle cx="250" cy="40" r="120" stroke-opacity=".11" stroke-dasharray="1 6" stroke-width="2"/>
                <circle cx="250" cy="40" r="170" stroke-opacity=".08" stroke-dasharray="1 6" stroke-width="2"/>
                <circle cx="250" cy="40" r="220" stroke-opacity=".06" stroke-dasharray="1 6" stroke-width="2"/>
                <path d="M-10 300 C70 240 150 250 270 170" stroke-opacity=".18" stroke-width="1.4" stroke-dasharray="2 6"/>
              </g>
            </svg>
            <span class="dp-back-label">${C.homeArtBack}</span>
          </div>
          <div class="dp-mid"></div>
          <div class="dp-wrap">
            <div class="dp-pass">
              <div class="dp-main">
            <svg class="dp-guilloche" viewBox="0 0 262 232" preserveAspectRatio="none"><g fill="none" stroke="#3866d9" stroke-opacity=".07"><path d="M-10 40c40-24 80 24 120 0s80 24 120 0 80 24 120 0"/><path d="M-10 56c40-24 80 24 120 0s80 24 120 0 80 24 120 0"/><path d="M-10 72c40-24 80 24 120 0s80 24 120 0 80 24 120 0"/><path d="M-10 88c40-24 80 24 120 0s80 24 120 0 80 24 120 0"/><path d="M-10 104c40-24 80 24 120 0s80 24 120 0 80 24 120 0"/></g></svg>
                <div class="dp-row">
                  <img class="dp-logo" src="/assets/magic-esim-logo-header.png" alt="" width="185" height="140">
                  <span class="dp-chip"><i></i>eSIM</span>
                </div>
                <div class="dp-title">${C.homeArtTitle}</div>
                <div class="dp-fields">
                  <div><span>${C.homeArtCoverage}</span><b>${C.homeArtCoverageValue}</b></div>
                  <div class="dp-flags"><img src="/assets/flags/jp.svg" alt=""><img src="/assets/flags/it.svg" alt=""><img src="/assets/flags/th.svg" alt=""><img src="/assets/flags/us.svg" alt=""></div>
                  <div class="dp-type"><span>${C.homeArtType}</span><b>eSIM</b></div>
                </div>
              </div>
              <div class="dp-tear" aria-hidden="true"></div>
              <div class="dp-stub">
                <div class="dp-qr">
                  <svg viewBox="-1 -1 23 23" aria-hidden="true"><defs><linearGradient id="dpq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a16c7"/><stop offset="1" stop-color="#0aa3c2"/></linearGradient></defs><rect x="0" y="0" width="7" height="7" rx="1.8" fill="#18203a"/><rect x="1" y="1" width="5" height="5" rx="1.2" fill="#fff"/><rect x="2" y="2" width="3" height="3" rx=".9" fill="url(#dpq)"/><rect x="14" y="0" width="7" height="7" rx="1.8" fill="#18203a"/><rect x="15" y="1" width="5" height="5" rx="1.2" fill="#fff"/><rect x="16" y="2" width="3" height="3" rx=".9" fill="url(#dpq)"/><rect x="0" y="14" width="7" height="7" rx="1.8" fill="#18203a"/><rect x="1" y="15" width="5" height="5" rx="1.2" fill="#fff"/><rect x="2" y="16" width="3" height="3" rx=".9" fill="url(#dpq)"/><g fill="#18203a"><rect x="8.1" y="0.1" width=".8" height=".8" rx=".26"/><rect x="9.1" y="1.1" width=".8" height=".8" rx=".26"/><rect x="8.1" y="2.1" width=".8" height=".8" rx=".26"/><rect x="9.1" y="2.1" width=".8" height=".8" rx=".26"/><rect x="10.1" y="2.1" width=".8" height=".8" rx=".26"/><rect x="8.1" y="3.1" width=".8" height=".8" rx=".26"/><rect x="8.1" y="4.1" width=".8" height=".8" rx=".26"/><rect x="9.1" y="4.1" width=".8" height=".8" rx=".26"/><rect x="11.1" y="4.1" width=".8" height=".8" rx=".26"/><rect x="12.1" y="4.1" width=".8" height=".8" rx=".26"/><rect x="8.1" y="5.1" width=".8" height=".8" rx=".26"/><rect x="9.1" y="5.1" width=".8" height=".8" rx=".26"/><rect x="11.1" y="5.1" width=".8" height=".8" rx=".26"/><rect x="12.1" y="6.1" width=".8" height=".8" rx=".26"/><rect x="8.1" y="7.1" width=".8" height=".8" rx=".26"/><rect x="0.1" y="8.1" width=".8" height=".8" rx=".26"/><rect x="1.1" y="8.1" width=".8" height=".8" rx=".26"/><rect x="2.1" y="8.1" width=".8" height=".8" rx=".26"/><rect x="3.1" y="8.1" width=".8" height=".8" rx=".26"/><rect x="5.1" y="8.1" width=".8" height=".8" rx=".26"/><rect x="7.1" y="8.1" width=".8" height=".8" rx=".26"/><rect x="10.1" y="8.1" width=".8" height=".8" rx=".26"/><rect x="11.1" y="8.1" width=".8" height=".8" rx=".26"/><rect x="15.1" y="8.1" width=".8" height=".8" rx=".26"/><rect x="16.1" y="8.1" width=".8" height=".8" rx=".26"/><rect x="19.1" y="8.1" width=".8" height=".8" rx=".26"/><rect x="20.1" y="8.1" width=".8" height=".8" rx=".26"/><rect x="0.1" y="9.1" width=".8" height=".8" rx=".26"/><rect x="3.1" y="9.1" width=".8" height=".8" rx=".26"/><rect x="4.1" y="9.1" width=".8" height=".8" rx=".26"/><rect x="5.1" y="9.1" width=".8" height=".8" rx=".26"/><rect x="6.1" y="9.1" width=".8" height=".8" rx=".26"/><rect x="8.1" y="9.1" width=".8" height=".8" rx=".26"/><rect x="10.1" y="9.1" width=".8" height=".8" rx=".26"/><rect x="11.1" y="9.1" width=".8" height=".8" rx=".26"/><rect x="13.1" y="9.1" width=".8" height=".8" rx=".26"/><rect x="15.1" y="9.1" width=".8" height=".8" rx=".26"/><rect x="16.1" y="9.1" width=".8" height=".8" rx=".26"/><rect x="17.1" y="9.1" width=".8" height=".8" rx=".26"/><rect x="18.1" y="9.1" width=".8" height=".8" rx=".26"/><rect x="0.1" y="10.1" width=".8" height=".8" rx=".26"/><rect x="2.1" y="10.1" width=".8" height=".8" rx=".26"/><rect x="3.1" y="10.1" width=".8" height=".8" rx=".26"/><rect x="6.1" y="10.1" width=".8" height=".8" rx=".26"/><rect x="8.1" y="10.1" width=".8" height=".8" rx=".26"/><rect x="9.1" y="10.1" width=".8" height=".8" rx=".26"/><rect x="11.1" y="10.1" width=".8" height=".8" rx=".26"/><rect x="12.1" y="10.1" width=".8" height=".8" rx=".26"/><rect x="13.1" y="10.1" width=".8" height=".8" rx=".26"/><rect x="14.1" y="10.1" width=".8" height=".8" rx=".26"/><rect x="16.1" y="10.1" width=".8" height=".8" rx=".26"/><rect x="18.1" y="10.1" width=".8" height=".8" rx=".26"/><rect x="19.1" y="10.1" width=".8" height=".8" rx=".26"/><rect x="3.1" y="11.1" width=".8" height=".8" rx=".26"/><rect x="4.1" y="11.1" width=".8" height=".8" rx=".26"/><rect x="7.1" y="11.1" width=".8" height=".8" rx=".26"/><rect x="8.1" y="11.1" width=".8" height=".8" rx=".26"/><rect x="11.1" y="11.1" width=".8" height=".8" rx=".26"/><rect x="15.1" y="11.1" width=".8" height=".8" rx=".26"/><rect x="16.1" y="11.1" width=".8" height=".8" rx=".26"/><rect x="17.1" y="11.1" width=".8" height=".8" rx=".26"/><rect x="19.1" y="11.1" width=".8" height=".8" rx=".26"/><rect x="0.1" y="12.1" width=".8" height=".8" rx=".26"/><rect x="3.1" y="12.1" width=".8" height=".8" rx=".26"/><rect x="4.1" y="12.1" width=".8" height=".8" rx=".26"/><rect x="6.1" y="12.1" width=".8" height=".8" rx=".26"/><rect x="7.1" y="12.1" width=".8" height=".8" rx=".26"/><rect x="11.1" y="12.1" width=".8" height=".8" rx=".26"/><rect x="13.1" y="12.1" width=".8" height=".8" rx=".26"/><rect x="14.1" y="12.1" width=".8" height=".8" rx=".26"/><rect x="15.1" y="12.1" width=".8" height=".8" rx=".26"/><rect x="16.1" y="12.1" width=".8" height=".8" rx=".26"/><rect x="17.1" y="12.1" width=".8" height=".8" rx=".26"/><rect x="18.1" y="12.1" width=".8" height=".8" rx=".26"/><rect x="19.1" y="12.1" width=".8" height=".8" rx=".26"/><rect x="8.1" y="13.1" width=".8" height=".8" rx=".26"/><rect x="9.1" y="13.1" width=".8" height=".8" rx=".26"/><rect x="15.1" y="13.1" width=".8" height=".8" rx=".26"/><rect x="16.1" y="13.1" width=".8" height=".8" rx=".26"/><rect x="17.1" y="13.1" width=".8" height=".8" rx=".26"/><rect x="8.1" y="14.1" width=".8" height=".8" rx=".26"/><rect x="12.1" y="14.1" width=".8" height=".8" rx=".26"/><rect x="14.1" y="14.1" width=".8" height=".8" rx=".26"/><rect x="9.1" y="15.1" width=".8" height=".8" rx=".26"/><rect x="13.1" y="15.1" width=".8" height=".8" rx=".26"/><rect x="18.1" y="15.1" width=".8" height=".8" rx=".26"/><rect x="8.1" y="16.1" width=".8" height=".8" rx=".26"/><rect x="13.1" y="16.1" width=".8" height=".8" rx=".26"/><rect x="16.1" y="16.1" width=".8" height=".8" rx=".26"/><rect x="18.1" y="16.1" width=".8" height=".8" rx=".26"/><rect x="20.1" y="16.1" width=".8" height=".8" rx=".26"/><rect x="10.1" y="17.1" width=".8" height=".8" rx=".26"/><rect x="15.1" y="17.1" width=".8" height=".8" rx=".26"/><rect x="16.1" y="17.1" width=".8" height=".8" rx=".26"/><rect x="17.1" y="17.1" width=".8" height=".8" rx=".26"/><rect x="19.1" y="17.1" width=".8" height=".8" rx=".26"/><rect x="20.1" y="17.1" width=".8" height=".8" rx=".26"/><rect x="10.1" y="18.1" width=".8" height=".8" rx=".26"/><rect x="12.1" y="18.1" width=".8" height=".8" rx=".26"/><rect x="14.1" y="18.1" width=".8" height=".8" rx=".26"/><rect x="15.1" y="18.1" width=".8" height=".8" rx=".26"/><rect x="19.1" y="18.1" width=".8" height=".8" rx=".26"/><rect x="8.1" y="19.1" width=".8" height=".8" rx=".26"/><rect x="9.1" y="19.1" width=".8" height=".8" rx=".26"/><rect x="15.1" y="19.1" width=".8" height=".8" rx=".26"/><rect x="16.1" y="19.1" width=".8" height=".8" rx=".26"/><rect x="17.1" y="19.1" width=".8" height=".8" rx=".26"/><rect x="18.1" y="19.1" width=".8" height=".8" rx=".26"/><rect x="19.1" y="19.1" width=".8" height=".8" rx=".26"/><rect x="20.1" y="19.1" width=".8" height=".8" rx=".26"/><rect x="10.1" y="20.1" width=".8" height=".8" rx=".26"/><rect x="13.1" y="20.1" width=".8" height=".8" rx=".26"/><rect x="14.1" y="20.1" width=".8" height=".8" rx=".26"/><rect x="15.1" y="20.1" width=".8" height=".8" rx=".26"/><rect x="17.1" y="20.1" width=".8" height=".8" rx=".26"/><rect x="20.1" y="20.1" width=".8" height=".8" rx=".26"/></g></svg>
                  <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
                </div>
                <div class="dp-stub-text"><b>${C.homeArtInstall}</b></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="popular" aria-labelledby="popularTitle">
    <div class="wrap">
      <div class="section-head">
        <span class="kicker" data-i18n="nav.destinations">${t('nav.destinations')}</span>
        <h2 id="popularTitle" data-i18n="home.popularTitle">${t('home.popularTitle')}</h2>
        <p data-i18n="home.popularLead">${t('home.popularLead')}</p>
      </div>
      <div class="dest-grid">
${POPULAR.map((c) => `        <a class="dest-tile" href="${P}/esim/${c.slug}/"><img class="flag" src="/assets/flags/${c.iso.toLowerCase()}.svg" alt="" width="44" height="33"><span><b>${esc(c.name)}</b><span data-i18n="home.viewPlans">${t('home.viewPlans')}</span></span><span class="arrow" aria-hidden="true">→</span></a>`).join('\n')}
      </div>
      <div class="dest-more"><a class="btn btn-ghost" href="${P}/esim/" data-i18n="site.allDestinations">${t('site.allDestinations')}</a></div>
    </div>
  </section>

  <section class="section section-alt" id="how" aria-labelledby="howTitle">
    <div class="wrap">
      <div class="section-head">
        <span class="kicker" data-i18n="home.howKicker">${t('home.howKicker')}</span>
        <h2 id="howTitle" data-i18n="how.title">${t('how.title')}</h2>
      </div>
      <ol class="steps-grid">
        <li class="step"><span class="step-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/></svg></span><span class="step-n">01</span><p data-i18n="how.step1">${t('how.step1')}</p></li>
        <li class="step"><span class="step-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/><path d="M9.5 9.5l2 2 3.5-3.5"/></svg></span><span class="step-n">02</span><p data-i18n="how.step2">${t('how.step2')}</p></li>
        <li class="step"><span class="step-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5"/></svg></span><span class="step-n">03</span><p data-i18n="how.step3">${t('how.step3')}</p></li>
        <li class="step"><span class="step-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 13.5l8-2 5.5-6a1.8 1.8 0 0 1 2.6 2.5l-5.6 5.8-2 8-2.2-.6-.6-5.6-5.1-.8z"/></svg></span><span class="step-n">04</span><p data-i18n="how.step4">${t('how.step4')}</p></li>
      </ol>
    </div>
  </section>

  <section class="section" id="plan-types" aria-labelledby="typesTitle">
    <div class="wrap">
      <div class="section-head">
        <span class="kicker" data-i18n="home.typesKicker">${t('home.typesKicker')}</span>
        <h2 id="typesTitle" data-i18n="home.typesTitle">${t('home.typesTitle')}</h2>
        <p data-i18n="home.typesLead">${t('home.typesLead')}</p>
      </div>
      <div class="types">
        <div class="type">
          <span class="type-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/></svg></span>
          <h3 data-i18n="home.typeLocalTitle">${t('home.typeLocalTitle')}</h3>
          <p data-i18n="home.typeLocalBody">${t('home.typeLocalBody')}</p>
        </div>
        <div class="type">
          <span class="type-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg></span>
          <h3 data-i18n="home.typeRegionalTitle">${t('home.typeRegionalTitle')}</h3>
          <p data-i18n="home.typeRegionalBody">${t('home.typeRegionalBody')}</p>
        </div>
        <div class="type">
          <span class="type-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></span>
          <h3 data-i18n="home.typeDailyTitle">${t('home.typeDailyTitle')}</h3>
          <p data-i18n="home.typeDailyBody">${t('home.typeDailyBody')}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="compat" aria-labelledby="compatTitle">
    <div class="wrap">
      <div class="compat">
        <div>
          <span class="kicker" data-i18n="nav.compat">${t('nav.compat')}</span>
          <h2 id="compatTitle" data-i18n="site.compatTitle">${t('site.compatTitle')}</h2>
          <p data-i18n="site.compatBody">${t('site.compatBody')}</p>
        </div>
        <ul class="compat-list">
          <li><a href="${P}/guides/compatibility/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M9.5 10l2 2 3.5-3.5"/></svg><span data-i18n="site.compatGuide">${t('site.compatGuide')}</span></a></li>
          <li><a href="${P}/guides/iphone/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg><span data-i18n="site.compatCheck">${t('site.compatCheck')}</span></a></li>
          <li><a href="${P}/guides/android/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2"/><path d="M6.5 6h11M6.5 18h11"/></svg><span data-i18n="site.compatAndroid">${t('site.compatAndroid')}</span></a></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="section section-alt" id="guides" aria-labelledby="guidesTitle">
    <div class="wrap">
      <div class="section-head">
        <span class="kicker" data-i18n="nav.guides">${t('nav.guides')}</span>
        <h2 id="guidesTitle" data-i18n="home.guidesTitle">${t('home.guidesTitle')}</h2>
        <p data-i18n="home.guidesLead">${t('home.guidesLead')}</p>
      </div>
      <div class="guide-grid">
${GUIDES.map((g) => `        <a class="guide-card" href="${P}/guides/${g.slug}/"><b>${esc(g.h1)}</b><span>${esc(g.blurb)}</span><span class="more" aria-hidden="true">${C.homeReadGuide}</span></a>`).join('\n')}
      </div>
    </div>
  </section>

  <section class="section" id="support" aria-labelledby="supportTitle">
    <div class="wrap">
      <div class="support-band">
        <div>
          <h2 id="supportTitle" data-i18n="home.supportTitle">${t('home.supportTitle')}</h2>
          <p data-i18n="home.supportBody">${t('home.supportBody')}</p>
        </div>
        <a class="btn" href="mailto:support@magicesim.store">support@magicesim.store</a>
      </div>
    </div>
  </section>
</main>

${FOOTER}

<script src="${P}/destinations.js" defer></script>
<script src="${siteI18nBundle(L.code).src}" defer></script>
<script src="/en/app.js" defer></script>
</body>
</html>
`;
}
