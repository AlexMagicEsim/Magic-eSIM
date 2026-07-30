#!/usr/bin/env node
// Regenerates the /esim/ hub from seo/countries.mjs: region-grouped links to
// every country page, popular row, honest guidance, FAQ (+FAQPage LD), and a
// CollectionPage hasPart list. Run: node seo/build-hub.mjs

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL, SITE } from './countries.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const jstr = (s) => JSON.stringify(String(s));
const bySlug = Object.fromEntries(ALL.map((c) => [c.slug, c]));

const REGIONS = [
  { name: 'Юго-Восточная Азия', slugs: ['thailand', 'vietnam', 'indonesia', 'malaysia', 'singapore'] },
  { name: 'Восточная Азия', slugs: ['china', 'japan', 'south-korea'] },
  { name: 'Южная Азия и острова', slugs: ['india', 'sri-lanka', 'maldives'] },
  { name: 'Ближний Восток и Африка', slugs: ['uae', 'egypt'] },
  { name: 'Кавказ и Центральная Азия', slugs: ['georgia', 'armenia', 'kazakhstan'] },
  { name: 'Европа и Средиземноморье', slugs: ['turkey', 'italy', 'spain', 'france', 'germany', 'greece', 'cyprus'] },
  { name: 'Америка', slugs: ['usa', 'mexico', 'brazil'] },
];
const POPULAR = ['thailand', 'turkey', 'uae', 'vietnam', 'georgia', 'italy'];

const HUB_FAQ = [
  { q: 'Чем eSIM отличается от обычной SIM-карты?', a: 'eSIM — цифровая SIM, встроенная в телефон: её не нужно вставлять физически. Тариф устанавливается по QR-коду из письма, а основная SIM остаётся в телефоне и продолжает работать.' },
  { q: 'Когда устанавливать eSIM — до поездки или на месте?', a: 'Удобнее до поездки, дома по Wi-Fi. У большинства тарифов срок действия начинается при первом подключении к сети страны поездки, поэтому ранняя установка дни не расходует.' },
  { q: 'Сохранится ли мой российский номер?', a: 'Российская SIM остаётся в телефоне и работает отдельно от eSIM. Если на ней подключён международный роуминг и оператор обслуживает её в стране поездки, звонки и SMS приходят на основной номер — включая коды банков, когда их доставку поддерживают оператор и сам сервис. Интернет при этом идёт через eSIM.' },
  { q: 'Как выбрать объём трафика?', a: 'Для карт, мессенджеров и такси обычно достаточно 1 ГБ на 1–2 дня поездки. Видеозвонки, сторис и раздача интернета заметно увеличивают расход — берите тариф с запасом или с пополнением.' },
  { q: 'Чем travel eSIM отличается от роуминга оператора?', a: 'Travel eSIM — это отдельный пакет мобильного интернета для страны поездки, который вы покупаете заранее и ставите второй линией. Основная SIM остаётся отдельной линией для номера, SMS и звонков. Обычный роуминг — услуга вашего домашнего оператора со своими ценами и условиями. Итоговые условия в обоих случаях зависят от конкретного тарифа и оператора.' },
  { q: 'Моей страны нет в списке — что делать?', a: 'Загляните в полный каталог на главной странице: там собраны тарифы для 150+ стран. Списки на этой странице — только самые популярные направления.' },
];

function link(slug) {
  const c = bySlug[slug];
  const flag = c.flagImg
    ? `<img src="../assets/flags/${c.flagImg}" alt="Флаг: ${esc(c.nameRu)}" width="30" height="21">`
    : `<span aria-hidden="true">${c.flagEmoji}</span>`;
  return `          <a class="country-link" href="${c.slug}/">${flag} ${esc(c.nameRu)}</a>`;
}

const hasPart = ALL.map((c) =>
  `    {"@type":"WebPage","name":${jstr('eSIM для ' + c.nameGen)},"url":"${SITE}/esim/${c.slug}/"}`).join(',\n');
const faqLd = HUB_FAQ.map((f) =>
  `    {"@type":"Question","name":${jstr(f.q)},"acceptedAnswer":{"@type":"Answer","text":${jstr(f.a)}}}`).join(',\n');

const regionsHtml = REGIONS.map((r) => `        <h3 class="region-head">${esc(r.name)}</h3>
        <div class="links-wrap">
${r.slugs.map(link).join('\n')}
        </div>`).join('\n');

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>eSIM для поездок за границу — ${ALL.length} направлений | Magic eSIM</title>
  <meta name="description" content="Выберите страну поездки — eSIM с реальными тарифами: Таиланд, Турция, ОАЭ, Япония, Грузия, Италия и ещё ${ALL.length - 6} направлений. Оплата рублями, установка по QR-коду до вылета." />
  <link rel="canonical" href="${SITE}/esim/" />
  <meta name="robots" content="index, follow" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Magic eSIM" />
  <meta property="og:locale" content="ru_RU" />
  <meta property="og:title" content="eSIM для поездок за границу — направления Magic eSIM" />
  <meta property="og:description" content="${ALL.length} направлений с реальными тарифами: выберите страну, оплатите рублями и установите eSIM до вылета." />
  <meta property="og:url" content="${SITE}/esim/" />
  <meta property="og:image" content="${SITE}/assets/magic-esim-logo.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="eSIM для поездок за границу — направления Magic eSIM" />
  <meta name="twitter:description" content="${ALL.length} направлений с реальными тарифами: выберите страну и установите eSIM до вылета." />
  <meta name="twitter:image" content="${SITE}/assets/magic-esim-logo.png" />

  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preconnect" href="https://mc.yandex.ru" />
  <link rel="stylesheet" href="../assets/country-pages.css" />
  <style>.region-head{font-size:17px;margin:26px 0 4px;color:var(--text,#1a2230)}</style>

  <!-- Yandex.Metrika counter -->
  <script type="text/javascript">
    (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
    ym(110393848,"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});
  </script>
  <noscript><div><img src="https://mc.yandex.ru/watch/110393848" style="position:absolute;left:-9999px;" alt=""></div></noscript>
  <!-- /Yandex.Metrika counter -->

  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
    {"@type":"ListItem","position":1,"name":"Главная","item":"${SITE}/"},
    {"@type":"ListItem","position":2,"name":"eSIM","item":"${SITE}/esim/"}
  ]}
  </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"CollectionPage","name":"eSIM для поездок за границу — направления","url":"${SITE}/esim/","description":"Направления eSIM Magic eSIM для поездок за границу с оплатой российской картой или через СБП.","inLanguage":"ru","isPartOf":{"@type":"WebSite","name":"Magic eSIM","url":"${SITE}/"},"hasPart":[
${hasPart}
  ]}
  </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
${faqLd}
  ]}
  </script>
</head>
<body>
  <nav class="nav">
    <a class="brand" href="../" aria-label="Magic eSIM"><img class="brand-logo" src="../assets/magic-esim-logo-header.png" alt="Magic eSIM" width="66" height="50"></a>
    <div class="nav-links"><a href="#directions">Направления</a><a href="#hub-faq">Вопросы</a><a href="../#global-pricing">Все тарифы</a><a href="../">На главную</a></div>
    <a class="btn" href="../#global-pricing">Выбрать тариф</a>
  </nav>

  <main>
    <div class="breadcrumbs"><div class="container">
      <nav class="crumbs" aria-label="Хлебные крошки">
        <a href="../">Главная</a><span class="sep">/</span>
        <span aria-current="page">eSIM</span>
      </nav>
    </div></div>

    <header class="cp-hero"><div class="container">
      <span class="eyebrow"><span class="pulse"></span> eSIM для поездок за границу</span>
      <h1>eSIM для поездок — <span class="gradient-text">выберите направление</span></h1>
      <p class="lead">Magic eSIM — мобильный интернет для зарубежных поездок с оплатой российской картой или через СБП. Ниже — ${ALL.length} направлений со страницами тарифов; полный каталог на главной охватывает 150+ стран.</p>
      <div class="hero-actions">
        <a class="btn" href="#directions">Выбрать страну</a>
        <a class="btn secondary" href="../#global-pricing">Все тарифы</a>
      </div>
    </div></header>

    <section id="directions">
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Направления</div>
          <h2>Страны, куда чаще всего берут eSIM</h2>
          <p class="muted">На странице каждой страны — реальные тарифы из каталога с покрытием этой страны, советы по объёму трафика, инструкции по подключению и ответы на частые вопросы.</p>
        </div>
        <h3 class="region-head">Популярное сейчас</h3>
        <div class="links-wrap">
${POPULAR.map(link).join('\n')}
        </div>
${regionsHtml}
      </div>
    </section>

    <section>
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Как это работает</div>
          <h2>Почему eSIM удобна в поездке</h2>
        </div>
        <div class="prose">
          <p>eSIM — это встроенная SIM-карта, которую не нужно вставлять физически. Вы покупаете тариф на нужную страну, устанавливаете eSIM заранее дома по Wi-Fi, а по прилёте включаете на ней передачу данных — и телефон подключается к местной сети. Не нужно стоять в очереди за туристической SIM в аэропорту и менять свою карту.</p>
          <p>Основная российская SIM при этом может оставаться в телефоне и работает отдельно от eSIM: при подключённом международном роуминге на неё приходят звонки и входящие SMS, включая коды банков, — насколько это поддерживают ваш оператор и сам сервис. Мобильный интернет пойдёт через eSIM. Оплатить тариф можно российской картой или через СБП, в рублях, до поездки — это удобно, когда за границей привычные способы оплаты работают не всегда.</p>
          <p>Мы не обещаем «интернет везде» и конкретную скорость: доступность сети зависит от страны, тарифа и покрытия оператора. На странице каждого направления мы честно описываем, чего ожидать, и показываем актуальные тарифы из каталога.</p>
        </div>
        <div class="link-row">
          <a href="../iphone.html">Настройка eSIM на iPhone →</a>
          <a href="../android.html">Настройка eSIM на Android →</a>
          <a href="../#global-pricing">Все тарифы и страны →</a>
        </div>
      </div>
    </section>

    <section>
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Полезное</div>
          <h2>Инструкции и помощь</h2>
        </div>
        <div class="links-wrap">
          <a class="country-link" href="../iphone.html">📱 Установка eSIM на iPhone</a>
          <a class="country-link" href="../android.html">🤖 Установка eSIM на Android</a>
          <a class="country-link" href="compatibility/">✅ Проверка совместимости</a>
          <a class="country-link" href="activation-before-travel/">🛫 Активация до поездки</a>
          <a class="country-link" href="not-working/">🛠️ Если eSIM не работает</a>
          <a class="country-link" href="dual-sim-sms/">📞 Основной номер, SMS и звонки</a>
        </div>
      </div>
    </section>

    <section>
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Сравнение</div>
          <h2>eSIM или роуминг оператора</h2>
        </div>
        <div class="prose">
          <p>Travel eSIM даёт отдельный, заранее оплаченный пакет мобильного интернета для страны поездки — вы знаете его объём и стоимость ещё до вылета. Основная SIM при этом может оставаться в телефоне для номера, SMS и звонков.</p>
          <p>Обычный роуминг — услуга вашего домашнего оператора: его стоимость и условия зависят от вашего тарифа и направления, уточнять их нужно у оператора. Скорость и покрытие в обоих случаях зависят от доступной местной сети и не гарантируются.</p>
        </div>
        <div class="hero-actions" style="margin-top:16px">
          <a class="btn" href="#directions">Выбрать eSIM</a>
          <a class="btn secondary" href="dual-sim-sms/">Как сохранить основной номер</a>
        </div>
      </div>
    </section>

    <section id="hub-faq">
      <div class="container">
        <div class="section-head">
          <div class="section-kicker">Вопросы и ответы</div>
          <h2>Частые вопросы об eSIM для поездок</h2>
        </div>
        <div class="faq-list">
${HUB_FAQ.map((f) => `          <div class="faq-item"><p class="faq-q">${esc(f.q)}</p><p class="faq-a">${esc(f.a)}</p></div>`).join('\n')}
        </div>
      </div>
    </section>

    <section class="cta">
      <div class="container">
        <div class="cta-box">
          <h2>Готовитесь к поездке?</h2>
          <p class="lead">Выберите страну, оплатите российской картой или через СБП и установите eSIM до вылета.</p>
          <a class="btn" href="#directions">Выбрать направление</a>
        </div>
      </div>
    </section>
  </main>

  <footer><div class="container footer-inner">
    <div class="brand"><span class="company-name">Magic eSIM</span></div>
    <nav class="footer-links"><a href="../">Главная</a><a href="../privacy.html">Политика конфиденциальности</a><a href="../terms.html">Пользовательское соглашение</a></nav>
    <span class="footer-support"><a href="mailto:support@magicesim.store">support@magicesim.store</a></span>
  </div></footer>
</body>
</html>
`;

writeFileSync(join(ROOT, 'esim', 'index.html'), html);
console.log(`Hub rebuilt: ${ALL.length} countries in ${REGIONS.length} regions, ${HUB_FAQ.length} FAQ`);
