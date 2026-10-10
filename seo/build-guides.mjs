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
import { stampUrl } from './asset-version.mjs';
import { headIcons } from './head-icons.mjs';
import { ruHeader, RU_FOOTER, RU_FONT_PRELOAD } from './ru-chrome.mjs';
import { GUIDE_ICON } from './site-chrome.mjs';

// Each Russian guide's icon: the English guide's icon where the subject is the
// same, two of its own for the Russian-only guides.
const GUIDE_ICON_OF = Object.freeze({
  'iphone.html': 'iphone',
  'android.html': 'android',
  'esim/compatibility/index.html': 'compatibility',
  'esim/activation-before-travel/index.html': 'activation',
  'esim/not-working/index.html': 'troubleshooting',
  'esim/dual-sim-sms/index.html': 'sim',
  'esim/payment-rubles/index.html': 'payment',
});

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
    ? `<a href="${P}">Главная</a> › 
        <a href="${P}esim/">eSIM</a> › 
        <span aria-current="page">${esc(g.crumb)}</span>`
    : `<a href="${P}./">Главная</a> › 
        <span aria-current="page">${esc(g.crumb)}</span>`;
  const faqLd = g.faq.map((f) =>
    `      {"@type":"Question","name":${jstr(f.q)},"acceptedAnswer":{"@type":"Answer","text":${jstr(f.a)}}}`).join(',\n');
  // «На этой странице»: one anchor per section, numbered — Russian headings do
  // not make readable ids, and a number never collides.
  const sections = g.sections.map((s, i) => `    <section class="g-sec" id="s${i + 1}" aria-labelledby="s${i + 1}-h">
      <p class="g-kicker">${esc(s.kicker)}</p>
      <h2 id="s${i + 1}-h">${esc(s.h2)}</h2>
${s.html.replaceAll('{P}', P).trim().replace(/^/gm, '      ')}
    </section>`).join('\n\n');
  const toc = g.sections.map((s, i) => `        <li><a href="#s${i + 1}">${esc(s.h2)}</a></li>`)
    .concat(['        <li><a href="#faq">Частые вопросы</a></li>']).join('\n');
  const related = g.related.map((r) =>
    `        <a class="ru-tile ru-tile-guide" href="${P}${r.href}"><span>${esc(r.label)}</span></a>`).join('\n');
  const ctaCountries = g.ctaCountries.map((slug) => {
    const c = bySlug[slug];
    return `        <a class="ru-tile" href="/esim/${c.slug}/"><img class="flag" src="/assets/flags/${c.iso.toLowerCase()}.svg" alt="" width="36" height="27"><span>eSIM для ${esc(c.nameGen)}</span></a>`;
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

${headIcons('  ')}
  <link rel="preconnect" href="https://mc.yandex.ru" />
${RU_FONT_PRELOAD.replace(/^/gm, '  ')}
  <link rel="stylesheet" href="${stampUrl('/assets/site.css')}" />
  <link rel="stylesheet" href="${stampUrl('/assets/page-guides.css')}" />
  <link rel="stylesheet" href="${stampUrl('/assets/ru.css')}" />

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
${ruHeader()}

<main class="guide">
  <section class="g-hero">
    <div class="wrap">
      <nav class="crumbs" aria-label="Хлебные крошки">
        ${crumbsHtml}
      </nav>
      <div class="g-hero-row">
        <span class="g-ico g-ico-lg">${GUIDE_ICON[GUIDE_ICON_OF[g.out]]}</span>
        <h1>${esc(g.h1)}</h1>
      </div>
      <p class="lead">${esc(g.hero)}</p>
    </div>
  </section>

  <div class="wrap g-layout">
    <nav class="g-toc" aria-label="На этой странице">
      <p class="g-toc-title">На этой странице</p>
      <ol>
${toc}
      </ol>
    </nav>

    <article class="g-article">
${sections}

    <section class="g-sec" id="faq" aria-labelledby="faq-h">
      <h2 id="faq-h">Частые вопросы</h2>
      <div class="faq-list">
${g.faq.map((f) => `        <div class="faq-item"><p class="faq-q">${esc(f.q)}</p><p class="faq-a">${esc(f.a)}</p></div>`).join('\n')}
      </div>
    </section>
    </article>
  </div>

  <div class="wrap">
    <section class="g-related" aria-labelledby="related-h">
      <h2 id="related-h">Смотрите также</h2>
      <div class="ru-tiles">
${related}
${ctaCountries}
      </div>
      <p class="ru-more"><a class="btn btn-ghost btn-sm" href="/esim/">Все направления</a></p>
    </section>

    <section class="ru-cta">
      <div>
        <h2>Готовы к поездке?</h2>
        <p>Выберите страну и тариф, оплатите российской картой или через СБП — QR-код придёт на почту.</p>
      </div>
      <a class="btn" href="/esim/">Выбрать направление</a>
    </section>
  </div>
</main>

${RU_FOOTER}
</body>
</html>
`;
}

for (const g of GUIDES) {
  if (!GUIDE_ICON[GUIDE_ICON_OF[g.out]]) throw new Error(`build-guides: у ${g.out} нет иконки`);
  const outPath = join(ROOT, g.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, page(g));
  console.log(`OK  /${g.out.replace(/index\.html$/, '')}  (${g.sections.length} секций, ${g.faq.length} FAQ)`);
}
console.log(`\nGenerated: ${GUIDES.length} guide pages`);
