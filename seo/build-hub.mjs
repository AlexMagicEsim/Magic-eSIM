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
import { stampUrl } from './asset-version.mjs';
import { headIcons } from './head-icons.mjs';
import { ruHeader, RU_FOOTER, RU_FONT_PRELOAD, RU_POPULAR } from './ru-chrome.mjs';
import { SEARCH_ICON } from './site-chrome.mjs';
import { GUIDES } from './guides.mjs';

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

// The Russian alphabet, as the English hub's A–Z: a letter with no country is
// shown greyed, a letter with countries is a jump link. Ё is filed under Е.
const LETTERS = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ'.split('');
const letterOf = (name) => { const L = String(name).charAt(0).toUpperCase(); return L === 'Ё' ? 'Е' : L; };
const byName = countries.slice().sort((a, b) => a.nameRu.localeCompare(b.nameRu, 'ru'));
const groups = new Map();
for (const c of byName) { const L = letterOf(c.nameRu); if (!groups.has(L)) groups.set(L, []); groups.get(L).push(c); }
for (const L of groups.keys()) if (!LETTERS.includes(L)) throw new Error(`build-hub: буква «${L}» вне алфавита`);
const aid = (L) => `az-${LETTERS.indexOf(L) + 1}`;
const jump = LETTERS.map((L) => (groups.has(L)
  ? `<a href="#${aid(L)}">${L}</a>`
  : `<span aria-hidden="true">${L}</span>`)).join('');
const tariffWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'тариф' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'тарифа' : 'тарифов'));
// Every row keeps the two numbers the catalogue gives: how many tariffs and
// the floor price («от N ₽», gated by seo/test-catalogue-sync.mjs).
const item = (c) => `        <li data-name="${esc(c.nameRu.toLowerCase())}" data-slug="${c.slug}" data-iso="${c.iso}" data-count="${c.total_count}" data-price="${c.min_price_rub === null ? '' : c.min_price_rub}"><a href="${c.slug}/"><img class="flag" src="/assets/flags/${c.iso.toLowerCase()}.svg" alt="" width="28" height="21" loading="lazy"><span>${esc(c.nameRu)}<small class="dest-meta">${c.total_count} ${tariffWord(c.total_count)}${c.min_price_rub === null ? '' : ` · от ${money(c.min_price_rub)} ₽`}</small></span></a></li>`;
const sections = [...groups.entries()].map(([L, cs]) => `    <section class="az-group" id="${aid(L)}" aria-labelledby="${aid(L)}h">
      <h2 id="${aid(L)}h">${L}</h2>
      <ul class="dest">
${cs.map(item).join('\n')}
      </ul>
    </section>`).join('\n');
const bySlug = new Map(countries.map((c) => [c.slug, c]));
const popular = RU_POPULAR.map((p) => {
  const c = bySlug.get(p.slug);
  if (!c) throw new Error(`build-hub: популярного направления ${p.slug} нет в каталоге`);
  return `      <a class="hub-tile" href="${c.slug}/"><img class="flag" src="/assets/flags/${c.iso.toLowerCase()}.svg" alt="" width="40" height="30"><span>${esc(c.nameRu)}</span></a>`;
}).join('\n');

// The index of every information page, built from seo/guides.mjs — the one
// list build-guides.mjs renders them from — so a new guide appears here by
// construction. Until 2026-09-30 this was five hand-written links, and the two
// installation guides (iPhone, Android) were not among them.
const materials = GUIDES.map((g) => {
  if (!g.hubBlurb) throw new Error(`guides.mjs: у ${g.url} нет hubBlurb`);
  const href = g.url.slice(SITE.length);
  return `        <li><a href="${href}">${esc(g.h1)}</a><span>${esc(g.hubBlurb)}</span></li>`;
}).join('\n');

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
  <meta property="og:image" content="${SITE}/assets/magic-esim-logo.png" />
  <meta property="og:locale" content="ru_RU" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${SITE}/assets/magic-esim-logo.png" />
${headIcons('  ')}
${RU_FONT_PRELOAD.replace(/^/gm, '  ')}
  <link rel="stylesheet" href="${stampUrl('/assets/site.css')}" />
  <link rel="stylesheet" href="${stampUrl('/assets/page-hub.css')}" />
  <link rel="stylesheet" href="${stampUrl('/assets/ru.css')}" />
  <!-- Первичный origin, а не шлюз: assets/magic-net.js держит render первым
       (ENDPOINTS[0]), а api.magicesim.store — резервом. Здесь стоял шлюз —
       генератор отстал от переключения, и пересборка хаба вернула бы
       preconnect к резерву. Страницы стран уже preconnect-ят к render. -->
  <link rel="preconnect" href="https://esim-backend-3wmu.onrender.com" crossorigin />
${METRIKA}
  <!-- Structured data -->
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
${ruHeader()}

<main class="hub">
  <section class="hub-hero">
    <div class="wrap">
      <nav class="crumbs" aria-label="Хлебные крошки"><a href="/">Главная</a> › <span aria-current="page">Страны</span></nav>
      <h1>eSIM по странам</h1>
      <p class="lead">${countries.length} ${countries.length % 10 === 1 && countries.length % 100 !== 11 ? 'направление' : 'направлений'} с реальными тарифами из каталога. У ${withLocal.length} есть локальные тарифы — на странице страны у них свой блок, отдельный от региональных.</p>
      <p class="lead"><a href="#materials">Инструкции и ответы перед поездкой</a> — установка, совместимость, оплата.</p>
      <!-- Поиск показывает скрипт внизу страницы: без него не будет поля, которое ничего не делает. -->
      <div class="hub-search" id="hubFind" role="search" hidden>
        <label for="hubSearch" class="sr-only">Найти страну</label>
        <div class="hub-field">${SEARCH_ICON}<input type="text" class="ym-hide-content" id="hubSearch" autocomplete="off" spellcheck="false" enterkeyhint="go" aria-controls="hubList" aria-describedby="hubCount" placeholder="Найти страну…"><button type="button" class="hub-clear" id="hubClear" aria-label="Очистить поиск" hidden>×</button></div>
      </div>
      <p class="hub-count" id="hubCount" role="status" aria-live="polite"></p>
    </div>
  </section>

  <div class="wrap hub-body">
    <section class="hub-pop" id="hubPopular" aria-labelledby="hubPopTitle">
      <h2 id="hubPopTitle">Популярные направления</h2>
      <div class="hub-tiles">
${popular}
      </div>
    </section>

    <nav class="hub-az" id="hubAz" aria-label="Направления от А до Я">${jump}</nav>

    <div class="hub-list" id="hubList">
${sections}
    </div>

    <div class="hub-empty" id="hubEmpty" hidden>
      <p class="hub-empty-title">Ничего не нашлось.</p>
      <p class="note">Попробуйте другое написание или выберите страну в списке от А до Я.</p>
      <button type="button" class="btn btn-ghost" id="hubReset">Показать все направления</button>
    </div>

    <section class="compat cp-help" id="materials">
      <h2>Инструкции и ответы перед поездкой</h2>
      <ul class="materials">
${materials}
      </ul>
    </section>
  </div>
</main>

${RU_FOOTER}

  <script>
  (function(){
    // Search runs over the rendered list: no second API call — the names and
    // the numbers are already in the markup, so the page works when the API is
    // briefly unreachable. Matches the Russian name (ё = е), the slug or the
    // ISO code; a letter group with nothing left in it hides with its letter.
    var box=document.getElementById('hubFind');
    var input=document.getElementById('hubSearch');
    var clear=document.getElementById('hubClear');
    var count=document.getElementById('hubCount');
    var empty=document.getElementById('hubEmpty');
    var pop=document.getElementById('hubPopular');
    var az=document.getElementById('hubAz');
    var groups=[].slice.call(document.querySelectorAll('#hubList .az-group'));
    function norm(s){return String(s||'').toLowerCase().replace(/ё/g,'е').trim();}
    function plural(n){var a=n%10,b=n%100;return a===1&&b!==11?'направление':(a>=2&&a<=4&&(b<12||b>14)?'направления':'направлений');}
    function apply(){
      var q=norm(input.value),shown=0;
      groups.forEach(function(g){
        var any=0;
        [].forEach.call(g.querySelectorAll('li'),function(li){
          var hit=!q||norm(li.dataset.name).indexOf(q)>=0||li.dataset.slug.indexOf(q)>=0||norm(li.dataset.iso)===q;
          li.hidden=!hit;if(hit){any++;shown++;}
        });
        g.hidden=!any;
      });
      clear.hidden=!q;pop.hidden=!!q;az.hidden=!!q;
      empty.hidden=shown>0;
      count.textContent=q?(shown?'Найдено: '+shown+' '+plural(shown):''):'';
    }
    input.addEventListener('input',apply);
    clear.addEventListener('click',function(){input.value='';apply();input.focus();});
    document.getElementById('hubReset').addEventListener('click',function(){input.value='';apply();input.focus();});
    box.hidden=false;
    count.textContent='';
  })();
  </script>
</body>
</html>
`;

writeFileSync(join(ROOT, 'esim/index.html'), html);
console.log(`/esim/: ${countries.length} стран (LOCAL ${withLocal.length}), данные каталога от ${fetchedAt}`);
