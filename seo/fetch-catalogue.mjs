#!/usr/bin/env node
// Writes seo/catalogue-countries.json — the file every page generator reads.
//
// DEFAULT SOURCE IS assets/catalog.json, the snapshot the storefront serves and
// every gate checks a page against. `--api` re-reads the live catalogue instead;
// use it to seed a snapshot, not as part of an ordinary build, because a page
// built from a snapshot the gates do not hold is only accidentally correct.
// The reasoning is in catalogue-source.mjs above localCatalogueCountries().
import { fetchCatalogueCountries, localCatalogueCountries, writeCache } from './catalogue-source.mjs';

// The country order below is a Russian collation, and it decides the card order
// on /esim/. A Node built with small-icu silently falls back to a codepoint sort
// — «ДР Конго» moves across «Дания» — and would rewrite the hub and this cache
// wholesale, as a several-thousand-line diff with nothing to explain it. Cheaper
// to refuse than to review. Pre-existing behaviour; only the check is new.
if (Intl.Collator.supportedLocalesOf(['ru']).length === 0) {
  throw new Error('Node без русской локали (small-icu): порядок стран был бы другим — соберите на сборке с full-icu');
}

const useApi = process.argv.slice(2).includes('--api');
const data = useApi ? await fetchCatalogueCountries() : localCatalogueCountries();
writeCache(data);

const local = data.countries.filter((c) => c.strategy === 'LOCAL').length;
console.log(`Каталог: ${data.countries.length} стран (LOCAL ${local}, только REGIONAL ${data.countries.length - local})`);
console.log(`Источник: ${data.source}, данные от ${data.fetched_at}`);
if (data.unnamed.length) {
  // Named loudly: a country the catalogue sells and the table cannot name gets
  // no page at all, and a silent skip is how that stays unnoticed for months.
  console.error(`БЕЗ НАЗВАНИЯ В ТАБЛИЦЕ (страницы не будет): ${data.unnamed.join(', ')}`);
}
