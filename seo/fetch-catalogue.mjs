#!/usr/bin/env node
// One API call per build. Every other generator reads the file this writes.
import { fetchCatalogueCountries, writeCache } from './catalogue-source.mjs';

const data = await fetchCatalogueCountries();
writeCache(data);

const local = data.countries.filter((c) => c.strategy === 'LOCAL').length;
console.log(`Каталог: ${data.countries.length} стран (LOCAL ${local}, только REGIONAL ${data.countries.length - local})`);
if (data.unnamed.length) {
  // Named loudly: a country the catalogue sells and the table cannot name gets
  // no page at all, and a silent skip is how that stays unnoticed for months.
  console.error(`БЕЗ НАЗВАНИЯ В ТАБЛИЦЕ (страницы не будет): ${data.unnamed.join(', ')}`);
}
