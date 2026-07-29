#!/usr/bin/env node
// Generates the guide/support pages from seo/guides.mjs on the shared
// country-pages template (same CSS, nav, breadcrumbs, footer, Metrika).
// Root guides keep their historical URLs (/iphone.html, /android.html).
// Run: node seo/build-guides.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUIDES } from './guides.mjs';
import { ALL, SITE } from './countries.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const jstr = (s) => JSON.stringify(String(s));
const bySlug = Object.fromEntries(ALL.map((c) => [c.slug, c]));

const METRIKA = readFileSync(join(ROOT, 'esim/thailand/index.html'), 'utf8')
  .match(/<!-- Yandex\.Metrika counter -->[\s\S]*?<!-- \/Yandex\.Metrika counter -->/)[0];

function breadcrumbLd(g) {
  const items = [{ name: 'Главная', item: `${SITE}/` }];
  if (g.out.startsWith('esim/')) items.push({ name: 'eSIM', item: `${SITE}/esim/` });
  items.push({ name: g.crumb, item: g.url });
  return `{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[${items
    .map((it, i) => `{"@type":"ListItem","position":${i + 1},"name":${jstr(it.name)},"item":"${it.item}"}`).join(',')}]}`;
}

function page(g) {
  const P = g.prefix;
  const ogTitle = g.title.replace(' | Magic eSIM', '');
  const crumbsHtml = g.out.startsWith('esim/')
    ? `<a href="${P}">Главная</a><span class="sep">/</span>
        <a href="${P}esim/">eSIM</a><span class="sep">/</span>
        <span aria-current="page">${esc(g.crumb)}</span>`
    : `<a href="${P}./">Главная</a><span class="sep">/</span>
        <span aria-current="page">${esc(g.crumb)}</span>`;
  const faqLd = g.faq.map((f) =>
    `      {"@type":"Question","name":${jstr(f.q)},"acceptedAnswer":{"@type":"Answer","text":${jstr(f.a)}}}`).join(',\n');
  const sections = g.sections.map((s) => `    <section>
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">${esc(s.kicker)}</div>
          <h2>${esc(s.h2)}</h2>
        </div>
${s.html.replaceAll('{P}', P).trim().replace(/^/gm, '        ')}
      </div>
    </section>`).join('\n\n');
  const related = g.related.map((r) =>
    `          <a class="country-link" href="${P}${r.href}">${esc(r.label)}</a>`).join('\n');
  const ctaCountries = g.ctaCountries.map((slug) => {
    const c = bySlug[slug];
    const flag = c.flagImg ? `<img src="${P}assets/flags/${c.flagImg}" alt="Флаг: ${esc(c.nameRu)}" width="30" height="21">` : `<span aria-hidden="true">${c.flagEmoji}</span>`;
    return `          <a class="country-link" href="${P}esim/${c.slug}/">${flag} eSIM для ${esc(c.nameGen)}</a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(g.title)}</title>
  <meta name="description" content="${esc(g.description)}" />
  <link rel="canonical" href="${g.url}" />
  <meta name="robots" content="index, follow" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Magic eSIM" />
  <meta property="og:locale" content="ru_RU" />
  <meta property="og:title" content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(g.description)}" />
  <meta property="og:url" content="${g.url}" />
  <meta property="og:image" content="${SITE}/assets/magic-esim-logo.png" />
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(g.description)}" />
  <meta name="twitter:image" content="${SITE}/assets/magic-esim-logo.png" />

  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preconnect" href="https://mc.yandex.ru" />
  <link rel="stylesheet" href="${P}assets/country-pages.css" />

  ${METRIKA}

  <!-- Structured data -->
  <script type="application/ld+json">
  ${breadcrumbLd(g)}
  </script>
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"WebPage",
    "name":${jstr(ogTitle)},
    "url":"${g.url}",
    "description":${jstr(g.description)},
    "inLanguage":"ru",
    "isPartOf":{"@type":"WebSite","name":"Magic eSIM","url":"${SITE}/"},
    "publisher":{"@type":"Organization","name":"Magic eSIM","url":"${SITE}/","logo":"${SITE}/assets/magic-esim-logo.png"}
  }
  </script>
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"FAQPage",
    "mainEntity":[
${faqLd}
    ]
  }
  </script>
</head>
<body>
  <nav class="nav">
    <a class="brand" href="${P}./" aria-label="Magic eSIM"><img class="brand-logo" src="${P}assets/magic-esim-logo-header.png" alt="Magic eSIM" width="66" height="50"></a>
    <div class="nav-links"><a href="#faq">Вопросы</a><a href="${P}esim/">Направления</a><a href="${P}./#global-pricing">Тарифы</a><a href="${P}./">На главную</a></div>
    <a class="btn" href="${P}esim/">Выбрать направление</a>
  </nav>

  <main>
    <!-- Breadcrumbs -->
    <div class="breadcrumbs"><div class="container">
      <nav class="crumbs" aria-label="Хлебные крошки">
        ${crumbsHtml}
      </nav>
    </div></div>

    <!-- Hero -->
    <header class="cp-hero"><div class="container">
      <span class="eyebrow"><span class="pulse"></span> Инструкции Magic eSIM</span>
      <h1>${esc(g.h1)}</h1>
      <p class="lead">${esc(g.hero)}</p>
      <div class="hero-actions">
        <a class="btn" href="${P}esim/">Выбрать направление</a>
        <a class="btn secondary" href="#faq">Частые вопросы</a>
      </div>
    </div></header>

${sections}

    <!-- FAQ -->
    <section id="faq">
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Вопросы и ответы</div>
          <h2>Частые вопросы</h2>
        </div>
        <div class="faq-list">
${g.faq.map((f) => `          <div class="faq-item"><p class="faq-q">${esc(f.q)}</p><p class="faq-a">${esc(f.a)}</p></div>`).join('\n')}
        </div>
      </div>
    </section>

    <!-- Related -->
    <section>
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Полезное</div>
          <h2>Смотрите также</h2>
        </div>
        <div class="links-wrap">
${related}
        </div>
        <div class="links-wrap" style="margin-top:10px">
${ctaCountries}
          <a class="country-link" href="${P}esim/">Все направления</a>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta">
      <div class="container">
        <div class="cta-box">
          <h2>Готовы к поездке?</h2>
          <p class="lead">Выберите страну и тариф, оплатите российской картой или через СБП — QR-код придёт на почту.</p>
          <a class="btn" href="${P}esim/">Выбрать направление</a>
        </div>
      </div>
    </section>
  </main>

  <footer><div class="container footer-inner">
    <div class="brand"><span class="company-name">Magic eSIM</span></div>
    <nav class="footer-links"><a href="${P}./">Главная</a><a href="${P}privacy.html">Политика конфиденциальности</a><a href="${P}terms.html">Пользовательское соглашение</a></nav>
    <span class="footer-support"><a href="mailto:support@magicesim.store">support@magicesim.store</a></span>
  </div></footer>
</body>
</html>
`;
}

for (const g of GUIDES) {
  const outPath = join(ROOT, g.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, page(g));
  console.log(`OK  /${g.out.replace(/index\.html$/, '')}  (${g.sections.length} секций, ${g.faq.length} FAQ)`);
}
console.log(`\nGenerated: ${GUIDES.length} guide pages`);
