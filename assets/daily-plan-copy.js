/* =====================================================================
 * daily-plan-copy — what a daily tariff card is allowed to say.
 * ---------------------------------------------------------------------
 * ONE copy, loaded by the storefront, the SEO country pages and the Mini
 * App. The landing has no bundler and this project's usual answer to that
 * has been to duplicate a block into each surface and pin the copies
 * together with a test. That works for a mapper nobody edits; it is the
 * wrong shape for THIS, because the thing being decided here is what we
 * promise a customer about a product, and three copies of a promise is
 * three places for it to stop being true.
 *
 * WHAT WE MAY SAY, AND WHAT WE MAY NOT
 *
 *   The allowance line is always safe: the provider states a per-day
 *   number and we repeat it.
 *
 *   The speed-after line is printed only when the provider published a
 *   throttle speed. It says what the speed BECOMES, and never that the
 *   traffic continues. The Russian word for "unlimited" is absent from
 *   this file by design and a test enforces its absence — including from
 *   these comments, which is how this sentence came to be phrased the
 *   long way round. For eSIM Access the feed carries a `fupPolicy` speed
 *   and says nothing whatever about what happens to the traffic;
 *   completing that sentence for it is exactly the failure this whole
 *   feature was built to avoid.
 *
 *   The reset line is printed only where the provider states it in
 *   words. MobiMatter's «resets every 24 hours» earns it. MobiMatter's
 *   other wording — «for the remainder of the day» — does not, and
 *   neither does eSIM Access, which says nothing. A daily allowance
 *   almost certainly does come back; almost certainly is not something
 *   to print on a product card.
 *
 * The backend decides all of this. `daily_throttle_continues` and
 * `daily_reset_confirmed` arrive already computed from the provider
 * payload by lib/dailyPlan; nothing here re-derives them, and nothing
 * here upgrades a speed label into a claim about continuation.
 * ================================================================== */
(function (root) {
  'use strict';

  var BLOCK_TITLE = 'Трафик на каждый день';

  /* ------------------------------------------------------------------ *
   * A SECOND LANGUAGE, ADDED WITHOUT MOVING THE FIRST.
   *
   * Every exported function below grew an OPTIONAL trailing `lang`. It
   * defaults to Russian, so the thirty-odd storefront and SEO-page call sites
   * — which pass nothing — take the identical code path and produce the
   * identical bytes they always did. That is a property of the default, not of
   * anybody remembering to check: a call that does not mention a language
   * cannot get a different answer than it did before this change.
   *
   * The words live HERE rather than in app/locales.js because they are not
   * looked up, they are ASSEMBLED — from a digit-driven plural, a regex-matched
   * region name and a joined country list. A flat key/value dictionary cannot
   * parameterise that, and this file is loaded by the storefront too, which has
   * no dictionary at all.
   * ------------------------------------------------------------------ */
  var EN = 'en';
  var BLOCK_TITLE_EN = 'Data every day';

  function isDaily(pkg) {
    return !!pkg && String(pkg.plan_type || '') === 'DAILY';
  }

  /** «1» -> «1 ГБ», «0.49» -> «500 МБ». Providers sell both. */
  function formatAllowance(gb, lang) {
    var n = Number(gb);
    if (!isFinite(n) || n <= 0) return '';
    // Rounded to the nearest 10 MB, and that is not cosmetic. The API carries
    // the allowance as GB with two decimals, so the provider's «500MB/Day»
    // arrives as 0.49 and multiplies back to 501.76 — printing «502 МБ» would
    // invent a precision the number never had and disagree with the name the
    // provider itself uses.
    if (n < 1) return Math.round((n * 1024) / 10) * 10 + (lang === EN ? ' MB' : ' МБ');
    // Russian decimals use a comma; English uses a point and keeps it.
    var text = Number.isInteger(n) ? String(n)
      : (lang === EN ? String(n) : String(n).replace('.', ','));
    return text + (lang === EN ? ' GB' : ' ГБ');
  }

  /** The provider writes "384 Kbps" / "1 Mbps". Customers read Russian. */
  function formatSpeed(label, lang) {
    var m = String(label || '').trim().match(/^(\d+(?:[.,]\d+)?)\s*(kbps|mbps|gbps)$/i);
    if (!m) return '';
    var unit = m[2].toLowerCase();
    var word = lang === EN
      ? (unit === 'kbps' ? 'Kbps' : unit === 'mbps' ? 'Mbps' : 'Gbps')
      : (unit === 'kbps' ? 'Кбит/с' : unit === 'mbps' ? 'Мбит/с' : 'Гбит/с');
    return (lang === EN ? m[1] : m[1].replace('.', ',')) + ' ' + word;
  }

  function pluralDays(n, lang) {
    // English has two forms and only 1 is singular — zero is plural.
    if (lang === EN) return Math.abs(Number(n) || 0) === 1 ? 'day' : 'days';
    var v = Math.abs(Number(n)) % 100;
    var d = v % 10;
    if (v > 10 && v < 20) return 'дней';
    if (d > 1 && d < 5) return 'дня';
    if (d === 1) return 'день';
    return 'дней';
  }

  /**
   * The card's lines, in order. Only lines the data supports are present,
   * so a country whose provider publishes less simply says less rather
   * than showing a placeholder.
   *
   * @returns {Array<{kind:string,text:string}>}
   */
  function lines(pkg, lang) {
    if (!isDaily(pkg)) return [];
    var out = [];
    var en = lang === EN;

    var allowance = formatAllowance(pkg.daily_gb, lang);
    if (!allowance) return [];
    out.push({ kind: 'allowance', text: en
      ? allowance + ' a day at full speed'
      : allowance + ' в день на максимальной скорости' });

    var speed = formatSpeed(pkg.daily_throttle_label, lang);
    if (speed) {
      // Deliberately «Далее — до X» and not the longer phrasing that would
      // promise the traffic keeps flowing at that speed. We repeat a published
      // number; we do not make the second, stronger claim on top of it.
      out.push({ kind: 'throttle', text: en ? 'Then up to ' + speed : 'Далее — до ' + speed });
    }

    if (pkg.daily_reset_confirmed === true) {
      out.push({ kind: 'reset', text: en
        ? 'The allowance resets every 24 hours'
        : 'Лимит обновляется каждые 24 часа' });
    }

    if (String(pkg.daily_term_mode || '') === 'FIXED_TERM') {
      var d = Number(pkg.validity_days);
      if (isFinite(d) && d > 0) {
        out.push({ kind: 'term', text: (en ? 'Term: ' : 'Срок: ') + d + ' ' + pluralDays(d, lang) });
      }
    }

    return out;
  }

  /**
   * The terms a per-day plan may be bought for. Published by the API and
   * repeated verbatim — the client never invents a term, and never prices
   * one: every rouble comes back from the server.
   */
  function terms(pkg) {
    if (!isDaily(pkg)) return [];
    if (String(pkg.daily_term_mode || '') !== 'PER_DAY') return [];
    var list = Array.isArray(pkg.sellable_days) ? pkg.sellable_days : [];
    return list.map(Number).filter(function (n) { return isFinite(n) && n > 0; });
  }

  /** Split a package list into the two blocks a country page shows. */
  function partition(packages) {
    var daily = [];
    var volume = [];
    (Array.isArray(packages) ? packages : []).forEach(function (p) {
      (isDaily(p) ? daily : volume).push(p);
    });
    return { daily: daily, volume: volume };
  }

  /* ===================================================================
   * Русское имя тарифа.
   *
   * Провайдер называет товар по-своему и по-английски: «Europe(30+ areas)
   * 300MB/Day», «Singapore & Malaysia & Thailand 500MB/Day». Показывать это
   * покупателю нельзя, а тупой replace по словам сломает названия — «Asia»
   * встречается и как регион, и внутри «Central Asia».
   *
   * Поэтому имя собирается ЗАНОВО из структурных полей: покрытие даёт место,
   * daily_gb — объём. Сырое имя провайдера читается только там, где оно
   * действительно единственный источник, — чтобы отличить «Балканы» от
   * «Европы» и «Центральную Азию» от «Азии»: у обоих одинаковый префикс
   * country_code, и по коду их не различить.
   * ================================================================ */

  // Порядок значим: «Central Asia» должна проверяться раньше «Asia», иначе
  // Центральная Азия станет Азией. Якорь ^ не ставим — у части названий
  // впереди идёт страна-владелец, но паттерны достаточно специфичны.
  var KNOWN_PLACES = [
    [/\bcentral\s+asia\b/i,            'Центральная Азия'],
    [/\bbalkans?\b/i,                   'Балканы'],
    [/\bnorth\s+america\b/i,           'Северная Америка'],
    [/\bsouth\s+america\b/i,           'Южная Америка'],
    [/\blatin\s+america\b|\blatam\b/i, 'Латинская Америка'],
    [/\bcaribbean\b/i,                  'Карибы'],
    [/\bgulf\s+region\b|\bgcc\b/i,     'Страны Персидского залива'],
    [/\bmiddle\s+east\b/i,             'Ближний Восток'],
    [/\bglobal\b/i,                     'Весь мир'],
    [/\beurope\b/i,                     'Европа'],
    [/\basia\s*[-–]?\s*pacific\b|\bapac\b/i, 'Азия и Океания'],
    [/\basia\b/i,                       'Азия'],
    [/\bafrica\b/i,                     'Африка'],
  ];

  // Последний рубеж: префикс country_code («EU-35», «AS-7»). Собран по
  // фактическому каталогу, а не по догадке — CA здесь Центральная Азия,
  // потому что так называются все пакеты с этим префиксом, и AR — Латинская
  // Америка по той же причине.
  /**
   * The same places in English, keyed by the RUSSIAN name so the two lists
   * cannot fall out of step: there is still exactly one table of regexes, and
   * this is a translation of its answers rather than a second copy of its
   * questions.
   */
  var PLACES_EN = {
    'Центральная Азия': 'Central Asia', 'Балканы': 'the Balkans',
    'Северная Америка': 'North America', 'Южная Америка': 'South America',
    'Латинская Америка': 'Latin America', 'Карибы': 'the Caribbean',
    'Страны Персидского залива': 'the Gulf states', 'Ближний Восток': 'the Middle East',
    'Весь мир': 'Worldwide', 'Европа': 'Europe', 'Азия и Океания': 'Asia-Pacific',
    'Азия': 'Asia', 'Африка': 'Africa'
  };

  function placeEn(name) {
    return name ? (PLACES_EN[name] || name) : name;
  }

  var REGION_BY_PREFIX = {
    EU: 'Европа', AS: 'Азия', NA: 'Северная Америка', SA: 'Южная Америка',
    CA: 'Центральная Азия', ME: 'Ближний Восток', CB: 'Карибы',
    GL: 'Весь мир', AR: 'Латинская Америка', AF: 'Африка',
  };

  /** «Сингапур, Малайзия и Таиланд» — из КОДОВ, а не из английского текста. */
  function joinCountries(names, lang) {
    if (names.length === 1) return names[0];
    return names.slice(0, -1).join(', ') + (lang === EN ? ' and ' : ' и ') + names[names.length - 1];
  }

  function pluralCountries(n, lang) {
    if (lang === EN) return Math.abs(Number(n) || 0) === 1 ? 'country' : 'countries';
    var v = Math.abs(n) % 100; var d = v % 10;
    if (v > 10 && v < 20) return 'стран';
    if (d > 1 && d < 5) return 'страны';
    if (d === 1) return 'страна';
    return 'стран';
  }

  /**
   * Место, к которому относится тариф.
   *
   * @param {object} pkg
   * @param {function} countryName  код -> русское имя, либо сам код, если имени нет
   */
  function placeName(pkg, countryName, lang) {
    var codes = Array.isArray(pkg && pkg.coverage_country_codes) ? pkg.coverage_country_codes : [];
    var name = typeof countryName === 'function' ? countryName : function (c) { return c; };
    var named = function (c) { var r = name(c); return r && r !== String(c).toUpperCase() ? r : null; };

    if (codes.length <= 1) {
      var one = named(codes[0] || (pkg && pkg.country_code) || '');
      return one || '';
    }

    // Известное имя раньше перечисления: «Северная Америка» понятнее, чем
    // «США, Канада и Мексика», и это то, как продукт называется.
    // Подчёркивание — словесный символ, поэтому \b после «Balkans» в
    // «Balkans_500MB/Day» не срабатывает и место уезжает в fallback по
    // префиксу EU, то есть в «Европу». Сегодня поставщик шлёт пробелы, но
    // цена ошибки — неверная страна в заголовке, а цена защиты — одна замена.
    var raw = String((pkg && pkg.name) || '').replace(/[_/]+/g, ' ');
    for (var i = 0; i < KNOWN_PLACES.length; i++) {
      if (KNOWN_PLACES[i][0].test(raw)) {
        return lang === EN ? placeEn(KNOWN_PLACES[i][1]) : KNOWN_PLACES[i][1];
      }
    }

    // Небольшой набор — перечисляем. Пять имён ещё читаются, шесть уже нет.
    if (codes.length <= 5) {
      var list = codes.map(named);
      if (list.every(Boolean)) return joinCountries(list, lang);
    }

    var prefix = String((pkg && pkg.country_code) || '').replace(/[-–]?\d+\+?$/, '').toUpperCase();
    if (REGION_BY_PREFIX[prefix]) {
      return lang === EN ? placeEn(REGION_BY_PREFIX[prefix]) : REGION_BY_PREFIX[prefix];
    }

    return codes.length + ' ' + pluralCountries(codes.length, lang);
  }

  /** «Европа — 300 МБ в день». Пустая строка, если места назвать не смогли. */
  function displayName(pkg, countryName, lang) {
    if (!isDaily(pkg)) return '';
    var allowance = formatAllowance(pkg && pkg.daily_gb, lang);
    if (!allowance) return '';
    var place = placeName(pkg, countryName, lang);
    var perDay = allowance + (lang === EN ? ' a day' : ' в день');
    var base = place ? place + ' — ' + perDay : perDay;
    // «Dubai Unlimited 1/3/5/7/10/15 Days» — шесть продуктов, у которых
    // совпадает всё, кроме срока. Без срока в заголовке страница ОАЭ
    // показывает шесть карточек с одним и тем же названием и выглядит как
    // дубликаты. У PER_DAY срок выбирает покупатель, поэтому там его в
    // названии быть не должно.
    var fixedDays = Number(pkg && pkg.validity_days);
    if (pkg && pkg.daily_term_mode === 'FIXED_TERM' && isFinite(fixedDays) && fixedDays > 0) {
      return base + ', ' + fixedDays + ' ' + pluralDays(fixedDays, lang);
    }
    return base;
  }

  /** «Покрытие: 34 страны» или «Покрытие: Ирландия». */
  function coverageLine(pkg, countryName, lang) {
    var codes = Array.isArray(pkg && pkg.coverage_country_codes) ? pkg.coverage_country_codes : [];
    if (codes.length > 1) return codes.length + ' ' + pluralCountries(codes.length, lang);
    var name = typeof countryName === 'function' ? countryName : function (c) { return c; };
    return name(codes[0] || (pkg && pkg.country_code) || '') || '';
  }

  /** The block heading, in the asked-for language. Russian by default. */
  function blockTitle(lang) {
    return lang === EN ? BLOCK_TITLE_EN : BLOCK_TITLE;
  }

  var api = {
    // Kept as a plain string as well as a function: thirty-odd storefront call
    // sites read `BLOCK_TITLE` directly, and they must keep working untouched.
    BLOCK_TITLE: BLOCK_TITLE,
    blockTitle: blockTitle,
    placeName: placeName,
    displayName: displayName,
    coverageLine: coverageLine,
    pluralCountries: pluralCountries,
    isDaily: isDaily,
    formatAllowance: formatAllowance,
    formatSpeed: formatSpeed,
    pluralDays: pluralDays,
    lines: lines,
    terms: terms,
    partition: partition,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MagicDailyPlan = api;
}(typeof window !== 'undefined' ? window : globalThis));
