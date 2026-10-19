// What a traveller types into the destination search that is not a country's
// name: a city, a resort, a colloquial name — and a region (conversion stage 2,
// PR B). The generator writes these into assets/ru-destinations.js; the shared
// matcher assets/ru-search.js uses them on the home and on /esim/.
//
// RULES (seo/test-ru-search.mjs holds every one):
//   - an alias names a place INSIDE that country, or the country itself in
//     another word («Англия», «Эмираты»). It only leads to the country page;
//     it says nothing about coverage there;
//   - no islands or territories whose coverage by the country's plans is
//     unclear in our catalogue (Canaries, Balearics, Madeira, Zanzibar, Hawaii,
//     Northern Cyprus) and no politically disputed names — such a hint would
//     read as a promise;
//   - an alias never equals the name of another country with a page;
//   - a region lists countries that HAVE a page; the generator drops any that
//     lose theirs. A region result never claims the whole region is covered.
//
// Lower case, ё as е; spaces, hyphens and case endings are handled by the
// matcher. Sources: common Russian names of the places.

export const ALIASES = Object.freeze({
  TR: ['анталья', 'анталия', 'стамбул', 'кемер', 'аланья', 'бодрум', 'мармарис', 'белек', 'сиде', 'фетхие', 'каппадокия', 'измир', 'анкара'],
  AE: ['дубай', 'абу-даби', 'шарджа', 'рас-эль-хайма', 'эмираты'],
  TH: ['пхукет', 'паттайя', 'бангкок', 'самуи', 'краби', 'чиангмай', 'пханган', 'хуахин', 'тайланд'],
  VN: ['нячанг', 'фукуок', 'хошимин', 'сайгон', 'ханой', 'дананг', 'фантьет', 'муйне', 'хойан'],
  EG: ['хургада', 'шарм-эль-шейх', 'шарм', 'каир', 'марса-алам', 'дахаб', 'эль-гуна'],
  ID: ['бали', 'джакарта', 'ломбок', 'убуд', 'чангу'],
  LK: ['коломбо', 'хиккадува', 'унаватуна', 'канди', 'галле'],
  MV: ['мале'],
  GE: ['тбилиси', 'батуми', 'кутаиси'],
  AM: ['ереван'],
  UZ: ['ташкент', 'самарканд', 'бухара', 'хива'],
  KZ: ['алматы', 'астана'],
  KG: ['бишкек', 'иссык-куль', 'киргизия'],
  CN: ['пекин', 'шанхай', 'гуанчжоу', 'шэньчжэнь', 'хайнань', 'санья'],
  JP: ['токио', 'осака', 'киото'],
  KR: ['сеул', 'пусан', 'корея'],
  IN: ['гоа', 'дели', 'мумбаи', 'бомбей'],
  CY: ['ларнака', 'лимассол', 'пафос', 'айя-напа', 'протарас'],
  ES: ['барселона', 'мадрид', 'валенсия', 'малага', 'севилья', 'коста-брава'],
  IT: ['рим', 'милан', 'венеция', 'флоренция', 'неаполь', 'римини'],
  FR: ['париж', 'ницца', 'лион', 'марсель', 'канны'],
  DE: ['берлин', 'мюнхен', 'франкфурт', 'гамбург'],
  GB: ['англия', 'британия', 'лондон', 'шотландия', 'эдинбург'],
  NL: ['голландия', 'амстердам'],
  CZ: ['прага', 'карловы вары'],
  AT: ['вена', 'зальцбург'],
  HU: ['будапешт'],
  GR: ['афины', 'салоники', 'халкидики', 'крит', 'родос', 'корфу', 'санторини'],
  ME: ['будва', 'бар', 'котор', 'херцег-нови'],
  RS: ['белград', 'нови-сад'],
  HR: ['дубровник', 'сплит', 'загреб'],
  PT: ['лиссабон', 'порту'],
  PL: ['варшава', 'краков'],
  CH: ['цюрих', 'женева'],
  US: ['америка', 'штаты', 'нью-йорк', 'лос-анджелес', 'майами', 'лас-вегас'],
  MX: ['канкун', 'мехико', 'тулум'],
  DO: ['пунта-кана', 'доминикана'],
  BR: ['рио-де-жанейро', 'сан-паулу'],
  AR: ['буэнос-айрес'],
  TN: ['джерба', 'хаммамет', 'сусс'],
  MA: ['марракеш', 'агадир', 'касабланка'],
  ZA: ['кейптаун', 'йоханнесбург'],
  KE: ['найроби'],
  QA: ['доха'],
  OM: ['маскат'],
  BH: ['манама'],
  JO: ['акаба', 'амман', 'петра'],
  MY: ['куала-лумпур', 'лангкави', 'пенанг'],
  PH: ['манила', 'боракай', 'себу'],
  KH: ['пномпень', 'сиемреап'],
  NP: ['катманду'],
  MN: ['улан-батор'],
  TW: ['тайбэй'],
  AZ: ['баку'],
  MD: ['молдавия', 'кишинев'],
  IL: ['тель-авив', 'эйлат'],
});

// Region queries. `names` are what may be typed (case endings are the matcher's);
// `countries` are popular destinations of the region, not its full list.
export const REGIONS = Object.freeze([
  { key: 'europe', label: 'Европа', names: ['европа', 'europe'],
    countries: ['IT', 'ES', 'FR', 'DE', 'GR', 'ME', 'CZ', 'GB', 'PT', 'NL', 'AT', 'CH', 'HR', 'CY', 'RS', 'HU'] },
  { key: 'asia', label: 'Азия', names: ['азия', 'юго-восточная азия', 'asia'],
    countries: ['TH', 'VN', 'ID', 'CN', 'JP', 'KR', 'MY', 'SG', 'IN', 'LK', 'MV', 'PH'] },
  { key: 'balkans', label: 'Балканы', names: ['балканы', 'balkans'],
    countries: ['ME', 'RS', 'AL', 'HR', 'BA', 'MK', 'BG', 'GR'] },
  { key: 'scandinavia', label: 'Скандинавия', names: ['скандинавия', 'scandinavia'],
    countries: ['NO', 'SE', 'DK', 'FI', 'IS'] },
  { key: 'africa', label: 'Африка', names: ['африка', 'africa'],
    countries: ['EG', 'MA', 'TN', 'KE', 'TZ', 'ZA', 'MU', 'SC', 'GH'] },
  { key: 'latam', label: 'Латинская Америка', names: ['латинская америка', 'южная америка', 'латам', 'latin america'],
    countries: ['MX', 'BR', 'AR', 'CO', 'PE', 'CL', 'DO', 'CR', 'EC'] },
  { key: 'world', label: 'Весь мир', names: ['весь мир', 'мир', 'по миру', 'все страны', 'world', 'global'],
    countries: [] },  // the popular list
]);
