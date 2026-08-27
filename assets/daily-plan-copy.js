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

  function isDaily(pkg) {
    return !!pkg && String(pkg.plan_type || '') === 'DAILY';
  }

  /** «1» -> «1 ГБ», «0.49» -> «500 МБ». Providers sell both. */
  function formatAllowance(gb) {
    var n = Number(gb);
    if (!isFinite(n) || n <= 0) return '';
    // Rounded to the nearest 10 MB, and that is not cosmetic. The API carries
    // the allowance as GB with two decimals, so the provider's «500MB/Day»
    // arrives as 0.49 and multiplies back to 501.76 — printing «502 МБ» would
    // invent a precision the number never had and disagree with the name the
    // provider itself uses.
    if (n < 1) return Math.round((n * 1024) / 10) * 10 + ' МБ';
    // Russian decimals use a comma, and a whole number shows no decimals.
    var text = Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
    return text + ' ГБ';
  }

  /** The provider writes "384 Kbps" / "1 Mbps". Customers read Russian. */
  function formatSpeed(label) {
    var m = String(label || '').trim().match(/^(\d+(?:[.,]\d+)?)\s*(kbps|mbps|gbps)$/i);
    if (!m) return '';
    var unit = m[2].toLowerCase();
    var word = unit === 'kbps' ? 'Кбит/с' : unit === 'mbps' ? 'Мбит/с' : 'Гбит/с';
    return m[1].replace('.', ',') + ' ' + word;
  }

  function pluralDays(n) {
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
  function lines(pkg) {
    if (!isDaily(pkg)) return [];
    var out = [];

    var allowance = formatAllowance(pkg.daily_gb);
    if (!allowance) return [];
    out.push({ kind: 'allowance', text: allowance + ' в день на максимальной скорости' });

    var speed = formatSpeed(pkg.daily_throttle_label);
    if (speed) {
      // Deliberately «Далее — до X» and not the longer phrasing that would
      // promise the traffic keeps flowing at that speed. We repeat a published
      // number; we do not make the second, stronger claim on top of it.
      out.push({ kind: 'throttle', text: 'Далее — до ' + speed });
    }

    if (pkg.daily_reset_confirmed === true) {
      out.push({ kind: 'reset', text: 'Лимит обновляется каждые 24 часа' });
    }

    if (String(pkg.daily_term_mode || '') === 'FIXED_TERM') {
      var d = Number(pkg.validity_days);
      if (isFinite(d) && d > 0) {
        out.push({ kind: 'term', text: 'Срок: ' + d + ' ' + pluralDays(d) });
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

  var api = {
    BLOCK_TITLE: BLOCK_TITLE,
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
