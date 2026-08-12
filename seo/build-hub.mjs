#!/usr/bin/env node
// Builds /esim/ — the country index — from the CATALOGUE.
//
// Previously this listed twenty-six hand-kept countries. The catalogue now
// covers two hundred, and any list maintained beside it is wrong the moment
// either changes. So the page is generated: a country appears here when it has
// a sellable tariff and disappears when it does not.
//
// The three numbers beside each country — how many tariffs, whether any are
// local, the cheapest price — come from the same fetch the pages use, so the
// index can never promise something a country page does not have.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCached } from './catalogue-source.mjs';
import { SITE } from './countries.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const METRIKA = readFileSync(join(ROOT, 'esim/thailand/index.html'), 'utf8')
  .match(/<!-- Yandex\.Metrika counter -->[\s\S]*?<\/script>\n(?=\n|  <!-- Structured data -->)/)[0];

const { countries, fetched_at: fetchedAt } = loadCached();
const money = (v) => (v === null ? null : Math.round(Number(v)).toLocaleString('ru-RU'));
const withLocal = countries.filter((c) => c.strategy === 'LOCAL');

const title = `eSIM для поездок за границу — ${countries.length} стран | Magic eSIM`;
const description = `Выберите страну поездки: ${countries.length} направлений с реальными тарифами, `
  + `${withLocal.length} из них с локальными тарифами. Оплата рублями, QR-код на почту, установка до вылета.`;

// Only what is rendered: an ItemList of the countries actually on the page.
const jsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Страны', item: `${SITE}/esim/` },
      ],
    },
    {
      '@type': 'ItemList',
      numberOfItems: countries.length,
      itemListElement: countries.map((c, i) => ({
        '@type': 'ListItem', position: i + 1, name: `eSIM для ${c.nameRu}`,
        url: `${SITE}/esim/${c.slug}/`,
      })),
    },
  ],
};

const card = (c) => `      <a class="c-card" href="${c.slug}/" data-name="${esc(c.nameRu.toLowerCase())}" data-slug="${c.slug}" data-iso="${c.iso}" data-count="${c.total_count}" data-price="${c.min_price_rub === null ? '' : c.min_price_rub}" data-local="${c.local_count > 0 ? '1' : '0'}">
        <span class="c-flag" aria-hidden="true">${c.flagEmoji}</span>
        <span class="c-name">${esc(c.nameRu)}</span>
        <span class="c-meta">${c.total_count} ${c.total_count === 1 ? 'тариф' : (c.total_count < 5 ? 'тарифа' : 'тарифов')}${c.min_price_rub === null ? '' : ` · от ${money(c.min_price_rub)} ₽`}</span>
        ${c.local_count > 0 ? '<span class="c-badge">локальные</span>' : '<span class="c-badge c-badge--reg">региональные</span>'}
      </a>`;

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${SITE}/esim/" />
  <meta name="robots" content="index, follow" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${SITE}/esim/" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${SITE}/magic-esim-banner.png" />
  <meta property="og:locale" content="ru_RU" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${SITE}/magic-esim-banner.png" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="stylesheet" href="../assets/country-pages.css" />
  <style>
    .hub-tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:18px 0}
    .hub-search{flex:1 1 260px;padding:10px 14px;border:1px solid #d7d7dd;border-radius:10px;font-size:16px}
    .hub-sort{padding:10px 12px;border:1px solid #d7d7dd;border-radius:10px;font-size:15px}
    .hub-count{color:#666;font-size:14px}
    .c-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
    .c-card{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border:1px solid #e4e4ea;border-radius:12px;text-decoration:none;color:inherit;background:#fff}
    .c-card:hover{border-color:#b9b9c6;box-shadow:0 2px 10px rgba(0,0,0,.05)}
    .c-flag{font-size:22px;line-height:1}
    .c-name{font-weight:600}
    .c-meta{color:#666;font-size:13px}
    .c-badge{align-self:flex-start;margin-top:4px;font-size:11px;padding:2px 8px;border-radius:999px;background:#e8f5ec;color:#15803d}
    .c-badge--reg{background:#eef2f7;color:#475569}
    .hub-empty{color:#666;padding:16px 0}
  </style>
  <link rel="preconnect" href="https://api.magicesim.store" crossorigin />
${METRIKA}
  <!-- Structured data -->
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
  <header class="site-head">
    <a class="brand" href="/">Magic eSIM</a>
    <nav class="head-nav"><a href="/esim/">Все страны</a><a href="/#tariffs">Тарифы</a></nav>
  </header>

  <nav class="breadcrumbs" aria-label="Хлебные крошки">
    <a href="/">Главная</a> <span aria-hidden="true">›</span>
    <span aria-current="page">Страны</span>
  </nav>

  <main>
    <section class="hero">
      <h1>eSIM по странам</h1>
      <p class="lead">${countries.length} ${countries.length % 10 === 1 && countries.length % 100 !== 11 ? 'направление' : 'направлений'} с реальными тарифами из каталога. У ${withLocal.length} есть локальные тарифы — они на странице страны идут первым блоком; региональные показываются отдельно и остаются доступны всегда.</p>
    </section>

    <section>
      <div class="hub-tools">
        <input class="hub-search" id="hubSearch" type="search" placeholder="Найти страну…" aria-label="Поиск страны" autocomplete="off" />
        <select class="hub-sort" id="hubSort" aria-label="Сортировка">
          <option value="name">По алфавиту</option>
          <option value="price">Сначала дешевле</option>
          <option value="count">Больше тарифов</option>
        </select>
        <span class="hub-count" id="hubCount">${countries.length}</span>
      </div>
      <div class="c-grid" id="hubGrid">
${countries.map(card).join('\n')}
      </div>
      <p class="hub-empty" id="hubEmpty" hidden>Ничего не нашлось. Попробуйте другое написание.</p>
    </section>

    <section class="compat">
      <h2>Перед покупкой</h2>
      <p><a href="/esim/compatibility/">Совместимость устройств</a> · <a href="/esim/activation-before-travel/">Установка до вылета</a> · <a href="/esim/not-working/">Если интернет не появился</a> · <a href="/esim/dual-sim-sms/">Две SIM и SMS от банков</a></p>
    </section>
  </main>

  <footer class="site-foot">
    <a href="/terms.html">Условия</a> · <a href="/privacy.html">Конфиденциальность</a> · <a href="/">Главная</a>
  </footer>

  <script>
  (function(){
    // Search and sort run over the rendered cards. No second API call: the
    // numbers are already in the markup, which keeps the page fast and keeps it
    // working when the API is briefly unreachable.
    var grid=document.getElementById('hubGrid');
    var search=document.getElementById('hubSearch');
    var sort=document.getElementById('hubSort');
    var count=document.getElementById('hubCount');
    var empty=document.getElementById('hubEmpty');
    var cards=[].slice.call(grid.querySelectorAll('.c-card'));

    function norm(s){return String(s||'').toLowerCase().replace(/ё/g,'е').trim();}
    function apply(){
      var q=norm(search.value);
      var shown=0;
      cards.forEach(function(el){
        var hit=!q||norm(el.dataset.name).indexOf(q)>=0||el.dataset.slug.indexOf(q)>=0||norm(el.dataset.iso)===q;
        el.hidden=!hit; if(hit)shown++;
      });
      count.textContent=shown;
      empty.hidden=shown>0;
    }
    function reorder(){
      var mode=sort.value;
      var sorted=cards.slice().sort(function(a,b){
        if(mode==='price'){
          // A country with no price sorts last rather than first: an empty
          // value must not look like the cheapest option.
          var pa=a.dataset.price===''?Infinity:Number(a.dataset.price);
          var pb=b.dataset.price===''?Infinity:Number(b.dataset.price);
          if(pa!==pb)return pa-pb;
        }
        if(mode==='count'){
          var ca=Number(a.dataset.count||0),cb=Number(b.dataset.count||0);
          if(ca!==cb)return cb-ca;
        }
        return a.dataset.name.localeCompare(b.dataset.name,'ru');
      });
      sorted.forEach(function(el){grid.appendChild(el);});
    }
    search.addEventListener('input',apply);
    sort.addEventListener('change',function(){reorder();apply();});
  })();
  </script>
</body>
</html>
`;

writeFileSync(join(ROOT, 'esim/index.html'), html);
console.log(`/esim/: ${countries.length} стран (LOCAL ${withLocal.length}), данные каталога от ${fetchedAt}`);
