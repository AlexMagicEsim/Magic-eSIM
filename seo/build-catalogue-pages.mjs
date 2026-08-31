#!/usr/bin/env node
// Generates a factual /esim/<slug>/ page for every country the CATALOGUE
// supports and that has no hand-written page.
//
// TWO RULES DECIDE EVERYTHING HERE
//
//   1. Hand-written pages are never touched. Twenty-six countries carry real
//      editorial copy — why the country needs an eSIM, what to expect at the
//      airport, six answered questions. Replacing that with a template would
//      be a regression dressed up as coverage.
//
//   2. Nothing is invented. This template states what the catalogue knows:
//      how many tariffs, which volumes, what they cost, whether they are local
//      or regional. There are no travel tips, no claims about coverage quality,
//      no "best time to visit". Where a fact is unknown, the page says nothing
//      rather than guessing.
//
// Tariffs themselves are hydrated at runtime by assets/country-tariffs.js from
// the same API, so a price on a page can never be staler than the catalogue.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCached } from './catalogue-source.mjs';
import { loadProfile } from './content-profile.mjs';
import { CLIENT_SNIPPET } from './intel/attribution.mjs';
import { ALL as EDITORIAL, SITE } from './countries.mjs';
import { stampUrl } from './asset-version.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const METRIKA = readFileSync(join(ROOT, 'esim/thailand/index.html'), 'utf8')
  .match(/<!-- Yandex\.Metrika counter -->[\s\S]*?<\/script>\n(?=\n|  <!-- Structured data -->)/)[0];

const { countries } = loadCached();
const editorialSlugs = new Set(EDITORIAL.map((c) => c.slug));

const money = (v) => (v === null || v === undefined ? null : Math.round(Number(v)).toLocaleString('ru-RU'));
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100; const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

// Neighbours by name, purely so every page has outgoing links and none is
// orphaned. Not a claim that the countries are related.
function nearby(country, all) {
  const i = all.findIndex((c) => c.iso === country.iso);
  const out = [];
  for (const step of [-3, -2, -1, 1, 2, 3]) {
    const n = all[i + step];
    if (n) out.push(n);
  }
  return out.slice(0, 5);
}

function faq(c) {
  // Every answer is derived from the catalogue row. A question the data cannot
  // answer is not asked.
  const items = [];
  const volumes = c.volumes.filter((v) => v > 0);
  const volumeText = volumes.length
    ? volumes.map((v) => `${v % 1 === 0 ? v : v.toFixed(1)} ГБ`).join(', ')
    : null;

  if (c.local_count > 0) {
    items.push({
      q: `${c.nameRu} — есть ли локальные тарифы?`,
      a: `Да. Сейчас доступно ${c.local_count} ${plural(c.local_count, 'локальный тариф', 'локальных тарифа', 'локальных тарифов')} `
        + `именно для этой страны. Они показаны первым блоком на этой странице.`,
    });
  } else {
    // The old text asserted «Доступны региональные тарифы… они показаны ниже»
    // whenever there were no local ones — an `else` that assumed the regional
    // block could not also be empty. On four pages it could, and the claim went
    // out in the visible FAQ AND in FAQPage structured data: a machine-readable
    // statement that tariffs are shown below an empty grid. Answer what is
    // actually true instead of what is usually true.
    items.push({
      q: `${c.nameRu} — есть ли локальные тарифы?`,
      a: c.regional_count > 0
        ? `Локальных тарифов для этой страны сейчас нет. Доступны региональные тарифы, покрытие которых включает эту страну — они показаны ниже.`
        : c.daily_count > 0
          ? `Локальных и региональных тарифов для этой страны сейчас нет. Доступны тарифы с оплатой за день — они показаны ниже.`
          : `Тарифов с покрытием этой страны сейчас нет. Посмотрите другие направления в каталоге.`,
    });
  }
  if (c.regional_count > 0) {
    items.push({
      q: `Что такое региональные тарифы?`,
      a: `Это тарифы, покрытие которых включает несколько стран, в том числе эту. `
        + `Сейчас таких ${c.regional_count}. Они подходят, если поездка захватывает не одну страну; полный список стран покрытия указан в карточке каждого тарифа.`,
    });
  }
  if (volumeText) {
    items.push({
      q: `${c.nameRu} — какие объёмы трафика доступны?`,
      a: `Сейчас доступны тарифы на ${volumeText}. Точный срок действия указан в карточке каждого тарифа.`,
    });
  }
  if (c.daily_count > 0) {
    items.push({
      q: `${c.nameRu} — есть ли тарифы с оплатой за день?`,
      a: `Да, сейчас таких ${c.daily_count}. У них платится не объём, а срок: вы выбираете, на сколько дней нужен интернет, `
        + `а дневной лимит трафика обновляется каждые сутки. Минимальный срок и цена указаны в карточке каждого тарифа.`,
    });
  }
  if (c.min_price_rub !== null) {
    items.push({
      q: `${c.nameRu} — сколько стоит eSIM?`,
      a: `Цены начинаются от ${money(c.min_price_rub)} ₽. Оплата в рублях российской картой или через СБП; актуальная цена каждого тарифа показана на этой странице.`,
    });
  }
  items.push({
    q: `Когда устанавливать eSIM?`,
    a: `eSIM можно установить заранее, дома по Wi-Fi: после оплаты QR-код приходит на почту. Срок действия тарифа отсчитывается с момента подключения к сети в поездке, а не с момента покупки.`,
  });
  items.push({
    q: `Останется ли российский номер?`,
    a: `Да. eSIM добавляется второй линией и не заменяет физическую SIM — российский номер остаётся в телефоне и работает отдельно.`,
  });
  return items;
}

function page(c, all, profile) {
  // A profile may only ADD prose. Every number below still comes from the
  // catalogue, and the merge cannot reach any of them.
  const p = profile || {};
  // Nominative everywhere. Russian wants the genitive after "для", and a
  // rules-based declension of 202 names is wrong for the indeclinable ones
  // (Перу, Монако, Гаити) and for the irregular fleeting vowels. A profile may
  // override any of these with a properly declined sentence.
  const title = p.title || `${c.nameRu} — eSIM с оплатой рублями | Magic eSIM`;
  // Daily plans are COUNTED, and counted as their own number.
  //
  // They are half the catalogue and the page renders them in a block of their
  // own, with its own counter. Folding them into the local/regional figures
  // would put a number in the description that disagrees with the number the
  // grid prints two screens down — which is the defect this whole pass exists
  // to remove, reintroduced in a new place.
  const dailyPhrase = c.daily_count
    ? ` и ${c.daily_count} ${plural(c.daily_count, 'тариф', 'тарифа', 'тарифов')} с оплатой за день`
    : '';
  // Four countries render nothing at all: every package covering them is dropped
  // by the runtime's own filters. Saying "0 региональных тарифов" would be
  // technically true and useless; saying nothing about tariffs is honest.
  const desc = p.description ? p.description : c.renders_nothing
    ? `${c.nameRu} — eSIM Magic eSIM: тарифов с покрытием этой страны сейчас нет. Посмотрите другие направления — оплата рублями, QR-код на почту.`
    : c.local_count > 0
    ? `${c.nameRu} — eSIM: ${c.local_count} ${plural(c.local_count, 'локальный тариф', 'локальных тарифа', 'локальных тарифов')}`
      + (c.regional_count ? `, ${c.regional_count} ${plural(c.regional_count, 'региональный', 'региональных', 'региональных')}` : '')
      + dailyPhrase
      + `${c.min_price_rub !== null ? `, от ${money(c.min_price_rub)} ₽` : ''}. Оплата рублями, QR-код на почту.`
    : `${c.nameRu} — eSIM: ${c.regional_count} ${plural(c.regional_count, 'региональный тариф', 'региональных тарифа', 'региональных тарифов')} с покрытием этой страны`
      + dailyPhrase
      + `${c.min_price_rub !== null ? `, от ${money(c.min_price_rub)} ₽` : ''}. Оплата рублями, QR-код на почту.`;

  // An editorial "why" block replaces nothing factual — it is added above the
  // generic one only when a person wrote it.
  const whyBlock = Array.isArray(p.why) && p.why.length
    ? `<section class="why"><h2>Почему eSIM: ${esc(c.nameRu)}</h2><div class="why-cards">`
      + p.why.filter((w) => w && w.h && w.p).map((w) =>
        `<div class="why-card"><span class="ico" aria-hidden="true">${esc(w.icon || '')}</span><h3>${esc(w.h)}</h3><p>${esc(w.p)}</p></div>`).join('')
      + '</div></section>'
    : '';

  // Editorial questions come first when a person wrote them; the factual ones
  // remain, because they are the answers the catalogue can guarantee.
  //
  // But not all of them. The catalogue questions are the same five questions on
  // two hundred pages with different numbers substituted in — which is exactly
  // the pattern that makes a corpus read as generated. On a page that already
  // carries its own FAQ, only the two that state country-specific counts are
  // kept; the rest is repetition wearing a country's name.
  const own = Array.isArray(p.faq) ? p.faq.filter((f) => f && f.q && f.a) : [];
  const generated = faq(c);
  const items = [...own, ...(own.length >= 4 ? generated.slice(0, 2) : generated)];
  const links = nearby(c, all);
  const url = `${SITE}/esim/${c.slug}/`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Главная', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Страны', item: `${SITE}/esim/` },
          // Matches the visible breadcrumb, which shows the country name
          // alone. A crumb that disagrees with the page is the one thing
          // structured data must never do.
          { '@type': 'ListItem', position: 3, name: c.nameRu, item: url },
        ],
      },
      {
        '@type': 'WebPage',
        name: title,
        url,
        description: desc,
        inLanguage: 'ru',
        isPartOf: { '@type': 'WebSite', name: 'Magic eSIM', url: `${SITE}/` },
        publisher: {
          '@type': 'Organization',
          name: 'Magic eSIM',
          url: `${SITE}/`,
          logo: `${SITE}/assets/magic-esim-logo.png`,
        },
      },
      // Only the FAQ that is actually rendered below.
      {
        '@type': 'FAQPage',
        mainEntity: items.map((f) => ({
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${url}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:image" content="${SITE}/magic-esim-banner.png" />
  <meta property="og:locale" content="ru_RU" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${SITE}/magic-esim-banner.png" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="stylesheet" href="${stampUrl('../../assets/country-pages.css')}" />
  <!-- Прогреваем ПЕРВУЮ дорогу, а не запасную. assets/magic-net.js ходит
       сначала на Render (97.6% успеха, p50 422ms) и лишь затем на шлюз
       (48.4%, p50 1983ms) — подсказка на шлюз грела сокет, который в
       подавляющем большинстве загрузок не используется, а тот, что
       используется, приходилось открывать с нуля. -->
  <link rel="preconnect" href="https://esim-backend-3wmu.onrender.com" crossorigin />
${METRIKA}
  <!-- Structured data -->
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body data-country-iso="${c.iso}" data-country-name="${esc(c.nameRu)}">
  <header class="site-head">
    <a class="brand" href="/">Magic eSIM</a>
    <nav class="head-nav"><a href="/esim/">Все страны</a><a href="/#tariffs">Тарифы</a></nav>
  </header>

  <nav class="breadcrumbs" aria-label="Хлебные крошки">
    <a href="/">Главная</a> <span aria-hidden="true">›</span>
    <a href="/esim/">Страны</a> <span aria-hidden="true">›</span>
    <span aria-current="page">${esc(c.nameRu)}</span>
  </nav>

  <main>
    <section class="hero">
      <h1><span class="flag" aria-hidden="true">${c.flagEmoji}</span> ${esc(p.h1 || `${c.nameRu} — eSIM для поездки`)}</h1>
      <p class="lead">${esc(p.lead || `${c.nameRu}. Мобильный интернет в поездке: eSIM устанавливается заранее по QR-коду, оплата в рублях российской картой или через СБП. Российская SIM остаётся в телефоне.`)}</p>
      ${Array.isArray(p.intro) ? p.intro.filter(Boolean).map((t) => `<p class="intro">${esc(t)}</p>`).join('\n      ') : ''}
      <p class="facts">
        ${c.local_count > 0 ? `Локальных тарифов: <b>${c.local_count}</b>. ` : ''}${c.regional_count > 0 ? `Региональных: <b>${c.regional_count}</b>. ` : ''}${c.daily_count > 0 ? `С оплатой за день: <b>${c.daily_count}</b>. ` : ''}${c.min_price_rub !== null ? `Цены от <b>${money(c.min_price_rub)} ₽</b>.` : ''}${c.renders_nothing ? 'Тарифов с покрытием этой страны сейчас нет.' : ''}
      </p>
    </section>

    <!-- data-country-page — это то, по чему country-tariffs.js понимает, какую
         страну грузить (pageCountryCode() ищет именно этот атрибут). Без него
         загрузка тихо выходит на первой строке, сетка остаётся пустой, а на
         экране навсегда висит «Загружаем тарифы…». data-country-iso на <body>
         эту роль не выполняет. -->
    <section class="packages" id="tariffs" data-country-page="${c.iso}">
      <div id="packagesStatus" class="packages-status">Загружаем тарифы…</div>

      <!-- Набор id ниже — это контракт с assets/country-tariffs.js, а не
           оформление. renderCountrySplit() обращается к localCount, localEmpty и
           regionalCount напрямую, без проверки на null: если их нет, функция
           падает на первом же обращении, исключение съедается общим catch, и
           страница остаётся с пустой сеткой без единого сообщения. Именно так
           190 страниц уехали в продакшн без тарифов. -->
      <div id="localBlock" class="packages-block">
        <h2 id="localHead">Локальные тарифы: ${esc(c.nameRu)}</h2>
        <span class="count" id="localCount"></span>
        <p class="block-sub">Тарифы, рассчитанные именно на эту страну.</p>
        <div id="localEmpty" class="block-empty" hidden>Локальных тарифов для этой страны нет — ниже региональные, покрытие которых её включает.</div>
        <div id="localGrid" class="packages-grid"></div>
      </div>

      <div id="regionalBlock" class="packages-block">
        <h2 id="regionalHead">Региональные тарифы с покрытием этой страны</h2>
        <span class="count" id="regionalCount"></span>
        <p class="block-sub">Покрытие включает несколько стран — подходит, если поездка не ограничена одной.</p>
        <div id="regionalGrid" class="packages-grid"></div>
      </div>

      <div id="packagesGrid" class="packages-grid"></div>
    </section>

    <!-- Карточка тарифа рендерит кнопку «Покрытие и условия», а её обработчик
         выходит на первой строке, если оверлея нет. Без этого блока кнопка на
         странице есть, но не делает ничего. -->
    <div id="coverageModal" class="cov-overlay" hidden>
      <div class="cov-modal" role="dialog" aria-modal="true" aria-labelledby="covTitle">
        <button type="button" class="cov-close" id="coverageClose" aria-label="Закрыть">×</button>
        <h3 id="covTitle">Покрытие и условия</h3>
        <p class="cov-sub" id="covPlan">—</p>
        <div class="cov-rows">
          <div class="cov-row"><span class="k">Объём трафика</span><span class="v" id="covData">—</span></div>
          <div class="cov-row"><span class="k">Срок действия</span><span class="v" id="covDays">—</span></div>
          <div class="cov-row"><span class="k">Начало срока</span><span class="v" id="covStart">—</span></div>
          <div class="cov-row"><span class="k">Сеть</span><span class="v" id="covSpeed">—</span></div>
          <div class="cov-row"><span class="k">Пополнение</span><span class="v" id="covTopup">—</span></div>
          <div class="cov-row" id="covHotspotRow" hidden><span class="k">Раздача интернета</span><span class="v" id="covHotspot">—</span></div>
          <div class="cov-row" id="covNoteRow" hidden><span class="k">Скорость</span><span class="v" id="covNote">—</span></div>
          <div class="cov-row" id="covFupRow" hidden><span class="k">После лимита</span><span class="v" id="covFup">—</span></div>
        </div>
        <div class="cov-countries" id="covCountriesWrap" hidden>
          <div class="k">Страны покрытия</div>
          <div class="v" id="covCountries">—</div>
        </div>
      </div>
    </div>

    ${whyBlock}

    <section class="why">
      <h2>Что даёт eSIM</h2>
      <ul class="why-list">
        <li><b>Интернет с прилёта.</b> Тариф куплен и установлен до вылета — по прилёте достаточно включить передачу данных.</li>
        <li><b>Оплата в рублях.</b> Российская карта или СБП, без поиска обменника и местного салона связи.</li>
        <li><b>Российский номер остаётся.</b> eSIM работает второй линией и не заменяет физическую SIM.</li>
      </ul>
    </section>

    <section class="compat">
      <h2>Совместимость</h2>
      <p>eSIM работает на телефонах с поддержкой eSIM, не заблокированных под оператора. Проверить свою модель: <a href="/esim/compatibility/">список совместимых устройств</a>, инструкции для <a href="/iphone.html">iPhone</a> и <a href="/android.html">Android</a>.</p>
    </section>

    <section class="howto">
      <h2>Как подключить</h2>
      <ol class="howto-list">
        <li>Выберите тариф на этой странице и оплатите — картой или через СБП.</li>
        <li>QR-код придёт на почту сразу после оплаты.</li>
        <li>Отсканируйте его дома по Wi-Fi: <a href="/esim/activation-before-travel/">как установить до вылета</a>.</li>
        <li>По прилёте включите передачу данных на линии eSIM. Не заработало — <a href="/esim/not-working/">что проверить</a>.</li>
      </ol>
    </section>

    <section class="faq">
      <h2>Вопросы о eSIM: ${esc(c.nameRu)}</h2>
      ${items.map((f) => `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n      ')}
    </section>

    <section class="related">
      <h2>Другие направления</h2>
      <div class="country-links">
${links.map((r) => `        <a class="country-link" href="../${r.slug}/"><span aria-hidden="true">${r.flagEmoji}</span> ${esc(r.nameRu)}</a>`).join('\n')}
        <a class="country-link" href="../">Все направления</a>
      </div>
    </section>
  </main>

  <footer class="site-foot">
    <a href="/terms.html">Условия</a> · <a href="/privacy.html">Конфиденциальность</a> · <a href="/esim/">Все страны</a>
  </footer>

  <script src="${stampUrl('/assets/catalog-loader.js')}" defer></script>
  <!-- The one copy of what a daily tariff card may say. Loaded before
       country-tariffs.js, which reads it; absolute so the depth of the page
       does not matter. -->
  <script src="${stampUrl('/assets/daily-plan-copy.js')}" defer></script>
  <script src="${stampUrl('../../assets/country-tariffs.js')}" defer></script>
${CLIENT_SNIPPET}
</body>
</html>
`;
}

let written = 0; let skipped = 0; let withProfile = 0; let replaced = 0;
const allWarnings = [];
for (const c of countries) {
  const { profile, warnings } = loadProfile(c.slug);
  allWarnings.push(...warnings);
  // The hand-written pages were protected because a generated page would have
  // been worse than them. Once a country has a reviewed profile that is no
  // longer true: the profile went through research, fact-checking against the
  // catalogue and a corpus-wide duplication check, and the page it produces is
  // the audited one. Without a profile the protection still stands.
  if (editorialSlugs.has(c.slug) && !profile) { skipped++; continue; }
  if (editorialSlugs.has(c.slug)) replaced++;
  if (profile) withProfile++;
  const dir = join(ROOT, 'esim', c.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page(c, countries, profile));
  written++;
}
if (allWarnings.length) {
  console.error('\nПРОФИЛИ:');
  for (const w of allWarnings) console.error(`  ${w}`);
}
console.log(`С авторским профилем: ${withProfile}`);
console.log(`Сгенерировано: ${written} страниц; пропущено (есть авторский текст): ${skipped}`);
if (replaced) console.log(`Заменено профилем поверх старой авторской страницы: ${replaced}`);
console.log(`Всего страниц стран: ${written + skipped}`);
