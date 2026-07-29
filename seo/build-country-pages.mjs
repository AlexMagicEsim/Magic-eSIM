#!/usr/bin/env node
// Generates /esim/<slug>/index.html for countries in seo/countries.mjs.
// Mirrors the proven hand-made template (esim/thailand/index.html): shared
// assets/country-pages.css + assets/country-tariffs.js, static indexable SEO
// copy, JS-hydrated real tariffs from the public API. Existing 5 hand-made
// pages are NEVER overwritten. Run: node seo/build-country-pages.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES, EXISTING, ALL, SITE } from './countries.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const jstr = (s) => JSON.stringify(String(s));

const METRIKA = readFileSync(join(ROOT, 'esim/thailand/index.html'), 'utf8')
  .match(/<!-- Yandex\.Metrika counter -->[\s\S]*?<\/script>\n(?=\n|  <!-- Structured data -->)/)[0];

function flagHtml(c, size) {
  if (c.flagImg) {
    const [w, h] = size === 'sm' ? [30, 21] : [26, 18];
    return `<img class="flag" src="../../assets/flags/${c.flagImg}" alt="Флаг: ${esc(c.nameRu)}" width="${w}" height="${h}">`;
  }
  return `<span class="flag" aria-hidden="true">${c.flagEmoji}</span>`;
}

function relatedLinks(c) {
  const bySlug = Object.fromEntries(ALL.map((x) => [x.slug, x]));
  const links = c.related.map((slug) => {
    const r = bySlug[slug];
    const flag = r.flagImg
      ? `<img src="../../assets/flags/${r.flagImg}" alt="Флаг: ${esc(r.nameRu)}" width="30" height="21">`
      : `<span aria-hidden="true">${r.flagEmoji}</span>`;
    return `          <a class="country-link" href="../${r.slug}/">${flag} ${esc(r.nameRu)}</a>`;
  });
  links.push('          <a class="country-link" href="../">Все направления</a>');
  return links.join('\n');
}

function faqLd(c) {
  const items = c.faq.map((f) =>
    `      {"@type":"Question","name":${jstr(f.q)},"acceptedAnswer":{"@type":"Answer","text":${jstr(f.a)}}}`).join(',\n');
  return `{\n    "@context":"https://schema.org",\n    "@type":"FAQPage",\n    "mainEntity":[\n${items}\n    ]\n  }`;
}

function page(c) {
  const url = `${SITE}/esim/${c.slug}/`;
  const ogTitle = c.title.replace(' | Magic eSIM', '');
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(c.title)}</title>
  <meta name="description" content="${esc(c.description)}" />
  <link rel="canonical" href="${url}" />
  <meta name="robots" content="index, follow" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Magic eSIM" />
  <meta property="og:locale" content="ru_RU" />
  <meta property="og:title" content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(c.description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${SITE}/assets/magic-esim-logo.png" />
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(c.description)}" />
  <meta name="twitter:image" content="${SITE}/assets/magic-esim-logo.png" />

  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preconnect" href="https://api.magicesim.store" crossorigin />
  <link rel="preconnect" href="https://mc.yandex.ru" />
  <link rel="stylesheet" href="../../assets/country-pages.css" />

  ${METRIKA.trim()}

  <!-- Structured data -->
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"BreadcrumbList",
    "itemListElement":[
      {"@type":"ListItem","position":1,"name":"Главная","item":"${SITE}/"},
      {"@type":"ListItem","position":2,"name":"eSIM","item":"${SITE}/esim/"},
      {"@type":"ListItem","position":3,"name":${jstr(c.nameRu)},"item":"${url}"}
    ]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"WebPage",
    "name":${jstr(ogTitle)},
    "url":"${url}",
    "description":${jstr(c.description)},
    "inLanguage":"ru",
    "isPartOf":{"@type":"WebSite","name":"Magic eSIM","url":"${SITE}/"},
    "publisher":{"@type":"Organization","name":"Magic eSIM","url":"${SITE}/","logo":"${SITE}/assets/magic-esim-logo.png"}
  }
  </script>
  <script type="application/ld+json">
  ${faqLd(c)}
  </script>
</head>
<body>
  <nav class="nav">
    <a class="brand" href="../../" aria-label="Magic eSIM"><img class="brand-logo" src="../../assets/magic-esim-logo-header.png" alt="Magic eSIM" width="66" height="50"></a>
    <div class="nav-links"><a href="#country-tariffs">Тарифы</a><a href="#how">Как подключить</a><a href="#faq">Вопросы</a><a href="../../">На главную</a></div>
    <a class="btn" href="#country-tariffs">Выбрать тариф</a>
  </nav>

  <main>
    <!-- Breadcrumbs -->
    <div class="breadcrumbs"><div class="container">
      <nav class="crumbs" aria-label="Хлебные крошки">
        <a href="../../">Главная</a><span class="sep">/</span>
        <a href="../">eSIM</a><span class="sep">/</span>
        <span aria-current="page">${esc(c.nameRu)}</span>
      </nav>
    </div></div>

    <!-- Hero -->
    <header class="cp-hero"><div class="container">
      <span class="eyebrow">${flagHtml(c)} eSIM для поездки: ${esc(c.nameRu)}</span>
      <h1>eSIM для ${esc(c.nameGen)} — <span class="gradient-text">мобильный интернет</span> в поездке</h1>
      <p class="lead">${esc(c.heroLead)}</p>
      <div class="hero-actions">
        <a class="btn" href="#country-tariffs">Выбрать тариф</a>
        <a class="btn secondary" href="#how">Как подключить</a>
      </div>
    </div></header>

    <!-- Tariffs (JS-hydrated from the live catalog) -->
    <section id="country-tariffs" data-country-page="${c.iso}">
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Тарифы</div>
          <h2>Тарифы eSIM для ${esc(c.nameGen)}</h2>
          <p class="muted">Здесь показываются тарифы с покрытием ${esc(c.nameGen)} из каталога Magic eSIM — локальные и региональные. Цены, объём и срок действия подтягиваются из каталога; итоговая стоимость всегда видна перед оплатой.</p>
        </div>
        <div class="sort-bar">
          <label class="sort-field" for="packageSort">
            <span class="sort-label">Сортировка</span>
            <span class="sort-select-wrap">
              <select id="packageSort" class="sort-select">
                <option value="price_asc">Сначала дешевле</option>
                <option value="data_desc">Сначала больше трафика</option>
                <option value="days_desc">Сначала дольше срок</option>
              </select>
              <svg class="sort-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            </span>
          </label>
        </div>
        <div id="packagesStatus" class="packages-status">Загружаем тарифы…</div>
        <div id="localBlock" class="tariff-block" hidden>
          <div class="tariff-subhead"><h3 id="localHead">Тарифы</h3><span class="count" id="localCount"></span></div>
          <div id="localEmpty" class="tariff-empty" hidden>Для этой страны доступны региональные тарифы.</div>
          <div id="localGrid" class="packages-grid"></div>
        </div>
        <div id="regionalBlock" class="tariff-block" hidden>
          <div class="tariff-subhead"><h3 id="regionalHead">Региональные тарифы</h3><span class="count" id="regionalCount"></span></div>
          <div id="regionalGrid" class="packages-grid"></div>
        </div>
        <div id="packagesGrid" class="packages-grid"></div>
      </div>
    </section>

    <!-- Why eSIM -->
    <section>
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Зачем это нужно</div>
          <h2>Почему eSIM удобна в поездке: ${esc(c.nameRu)}</h2>
        </div>
        <div class="prose">
${c.whyIntro.map((p) => `          <p>${esc(p)}</p>`).join('\n')}
        </div>
        <div class="grid-cards" style="margin-top:24px">
${c.whyCards.map((w) => `          <div class="card"><div class="icon">${w.icon}</div><h3>${esc(w.h)}</h3><p>${esc(w.p)}</p></div>`).join('\n')}
        </div>
      </div>
    </section>

    <!-- How to connect -->
    <section id="how">
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Подключение</div>
          <h2>Как подключить eSIM для ${esc(c.nameGen)}</h2>
          <p class="muted">Порядок одинаковый для большинства телефонов. Подробные шаги — в инструкциях для вашего устройства.</p>
        </div>
        <ol class="ol-steps">
          <li>Выберите тариф для ${esc(c.nameGen)} выше и оплатите российской картой или через СБП.</li>
          <li>Получите QR-код и данные для установки eSIM на почту после оплаты.</li>
          <li>Дома, по Wi-Fi, добавьте eSIM в настройках телефона — сканированием QR-кода или вводом данных вручную.</li>
          <li>По прибытии включите на этой eSIM передачу данных и роуминг данных.</li>
          <li>Основную российскую SIM оставьте для звонков и SMS, а интернет пустите через eSIM.</li>
        </ol>
        <div class="link-row">
          <a href="../../iphone.html">Инструкция для iPhone →</a>
          <a href="../../android.html">Инструкция для Android →</a>
        </div>
      </div>
    </section>

    <!-- What to check -->
    <section>
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Перед вылетом</div>
          <h2>Что проверить перед поездкой</h2>
        </div>
        <ul class="check-list">
          <li>Телефон поддерживает eSIM и не заблокирован под одного оператора.</li>
          <li>eSIM установлена заранее, дома по Wi-Fi, а не в последний момент в аэропорту.</li>
          <li>На eSIM включена передача данных; на основной SIM роуминг данных можно выключить, чтобы не потратить лишнего.</li>
          <li>Вы знаете, где лежит письмо с QR-кодом, если понадобится переустановка.</li>
          <li>Контакты поддержки Magic eSIM сохранены на случай вопросов в поездке.</li>
        </ul>
      </div>
    </section>

    <!-- Compatibility -->
    <section>
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Совместимость</div>
          <h2>Поддерживает ли телефон eSIM</h2>
        </div>
        <div class="prose">
          <p>eSIM поддерживают большинство современных смартфонов: iPhone XR, XS и новее, многие модели Android — Google Pixel, современные Samsung Galaxy и другие. У телефона должна быть поддержка eSIM и отсутствовать операторская блокировка. Проверить наличие eSIM можно в настройках сотовой связи или уточнить по модели устройства.</p>
        </div>
        <div class="link-row">
          <a href="../../iphone.html">Настройка eSIM на iPhone →</a>
          <a href="../../android.html">Настройка eSIM на Android →</a>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq">
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Вопросы и ответы</div>
          <h2>Частые вопросы об eSIM для ${esc(c.nameGen)}</h2>
        </div>
        <div class="faq-list">
${c.faq.map((f) => `          <div class="faq-item"><p class="faq-q">${esc(f.q)}</p><p class="faq-a">${esc(f.a)}</p></div>`).join('\n')}
        </div>
      </div>
    </section>

    <!-- Internal links -->
    <section>
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Другие направления</div>
          <h2>eSIM для других стран</h2>
        </div>
        <div class="links-wrap">
${relatedLinks(c)}
        </div>
        <div class="link-row">
          <a href="../../">На главную Magic eSIM</a>
          <a href="../../iphone.html">Настройка на iPhone</a>
          <a href="../../android.html">Настройка на Android</a>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta">
      <div class="container">
        <div class="cta-box">
          <h2>Собираетесь ${esc(c.ctaAcc || 'в ' + c.nameAcc)}?</h2>
          <p class="lead">Выберите тариф, оплатите российской картой или через СБП и установите eSIM до вылета.</p>
          <a class="btn" href="#country-tariffs">Выбрать тариф</a>
        </div>
      </div>
    </section>
  </main>

  <footer><div class="container footer-inner">
    <div class="brand"><span class="company-name">Magic eSIM</span></div>
    <nav class="footer-links"><a href="../../">Главная</a><a href="../../privacy.html">Политика конфиденциальности</a><a href="../../terms.html">Пользовательское соглашение</a></nav>
    <span class="footer-support"><a href="mailto:support@magicesim.store">support@magicesim.store</a></span>
  </div></footer>

  <!-- Coverage & conditions modal -->
  <div id="coverageModal" class="cov-overlay" hidden>
    <div class="cov-modal" role="dialog" aria-modal="true" aria-labelledby="covTitle">
      <button type="button" class="cov-close" id="coverageClose" aria-label="Закрыть">×</button>
      <h3 id="covTitle">Покрытие и условия</h3>
      <p class="cov-sub" id="covPlan">—</p>
      <div class="cov-rows">
        <div class="cov-row"><span class="k">Объём трафика</span><span class="v" id="covData">—</span></div>
        <div class="cov-row"><span class="k">Срок действия</span><span class="v" id="covDays">—</span></div>
        <div class="cov-row"><span class="k">Начало срока</span><span class="v">с активации / первого подключения к сети</span></div>
        <div class="cov-row"><span class="k">Сеть</span><span class="v" id="covSpeed">—</span></div>
        <div class="cov-row"><span class="k">Пополнение</span><span class="v" id="covTopup">—</span></div>
        <div class="cov-row"><span class="k">Раздача интернета</span><span class="v">зависит от условий тарифа</span></div>
      </div>
      <div class="cov-countries" id="covCountriesWrap" hidden>
        <div class="k">Страны покрытия</div>
        <div class="v" id="covCountries">—</div>
      </div>
    </div>
  </div>

  <script src="../../assets/country-tariffs.js" defer></script>
</body>
</html>
`;
}

let written = 0;
for (const c of COUNTRIES) {
  if (EXISTING.some((e) => e.slug === c.slug)) {
    console.error(`SKIP (hand-made page exists): ${c.slug}`);
    continue;
  }
  const dir = join(ROOT, 'esim', c.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page(c));
  written++;
  console.log(`OK  /esim/${c.slug}/  (${c.faq.length} FAQ, ${c.related.length} related)`);
}
console.log(`\nGenerated: ${written} pages`);
