/* =====================================================================
 * /en/esim/<slug>/ — the GLOBAL checkout, up to the payment step.
 * ---------------------------------------------------------------------
 * Three steps in one window:
 *
 *   1. Plan     what the card showed, plus the duration for a per-day plan.
 *   2. Price    the SERVER fixes the price: POST /api/v1/global/quotes
 *               { package_id, days } → { quote_id, amount, currency, expires_at }.
 *               The amount shown from here on is the quote's, never the
 *               catalogue's and never anything computed here. The quote is
 *               held for its TTL; when it runs out the price must be fetched
 *               again before anything else happens.
 *   3. Review   coverage, data, validity, the quoted USD price, the email
 *               typed in — and a plain status: online payment is not available
 *               yet. The payment button is disabled and can do nothing.
 *
 * WHAT THIS FILE MUST NEVER DO, and why each is structural:
 *
 *   * Create an order, start a payment or ask for an eSIM. The ONLY request is
 *     the quote POST above; there is no order route for GLOBAL, and a test
 *     bans every other network primitive and path in this file.
 *   * Send or keep the email. It is held in this page's memory to show it back
 *     on the review step, and dropped when the window closes. It is not in the
 *     quote body, not in storage, not in a URL. Nothing exists yet that could
 *     use it, so nothing is allowed to receive it.
 *   * Trust a price from the browser. The quote request carries no price, and
 *     the answer is checked: right package, right term, USD, a positive amount,
 *     an expiry in the future. Anything else is «price unavailable».
 *   * Fall back to roubles or to the catalogue's own figure when the quote
 *     fails. No quote, no step 2.
 *   * Re-send a quote on its own. A quote is a row in the database: one is
 *     requested only when the visitor presses the button, never on a timer,
 *     never on a retry loop, and MagicNet does not carry it to the fallback
 *     road (a write without an idempotency key never fails over).
 * ================================================================== */
(function (root) {
  'use strict';

  var QUOTE_PATH = '/api/v1/global/quotes';
  var UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  // Deliberately plain: a browser cannot prove an address exists, and nothing
  // is sent to it yet. This only catches a typo before it is shown back.
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /** The request body: the package and, for a per-day plan, the days. Nothing else. */
  function quoteBody(packageId, days) {
    return JSON.stringify({ package_id: String(packageId), days: days == null ? null : Number(days) });
  }

  /**
   * Is this answer a quote for exactly what was asked? Returns the quote or a
   * reason; never throws, never guesses.
   */
  function validateQuote(res, ask, nowMs) {
    var status = res && res.status;
    var body = res && res.body;
    if (status === 200 && body && typeof body === 'object') {
      var amount = Number(body.amount);
      var expires = Date.parse(body.expires_at);
      var days = body.days == null ? null : Number(body.days);
      var want = ask.days == null ? null : Number(ask.days);
      if (typeof body.quote_id !== 'string' || !UUID.test(body.quote_id)) return { ok: false, reason: 'bad_quote' };
      if (String(body.package_id) !== String(ask.packageId)) return { ok: false, reason: 'bad_quote' };
      if (days !== want) return { ok: false, reason: 'bad_quote' };
      if (body.currency !== 'USD') return { ok: false, reason: 'bad_quote' };
      // A whole number of cents. Compared with a tolerance, never exactly:
      // 73.99 * 100 is 7398.999… in floating point, and the exact test refused
      // a correct $73.99 quote (production, 2026-10-05). A real fraction of a
      // cent (9.999, 4.995) is off by at least 0.1 cent and is still refused.
      if (!isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return { ok: false, reason: 'bad_quote' };
      if (!isFinite(expires) || expires <= nowMs) return { ok: false, reason: 'bad_quote' };
      return { ok: true, quote: { id: body.quote_id, amount: amount, days: days, expiresAt: expires } };
    }
    var code = body && body.error;
    if (status === 503) return { ok: false, reason: 'unavailable' };
    if (status === 429) return { ok: false, reason: 'busy' };
    if ((status === 404 || status === 409) && code === 'GLOBAL_PACKAGE_UNAVAILABLE') return { ok: false, reason: 'gone' };
    if (!status) return { ok: false, reason: 'offline' };
    return { ok: false, reason: 'unavailable' };
  }

  var REASON_KEY = {
    unavailable: 'quote.unavailable',
    bad_quote: 'quote.unavailable',
    busy: 'quote.busy',
    gone: 'quote.gone',
    offline: 'quote.offline',
  };

  /** Ask the server for a price. Exactly one POST, never repeated here. */
  function requestQuote(net, packageId, days, nowFn) {
    var ask = { packageId: packageId, days: days };
    if (!net || typeof net.request !== 'function' || !UUID.test(String(packageId || ''))) {
      return Promise.resolve({ ok: false, reason: 'unavailable' });
    }
    return Promise.resolve()
      .then(function () {
        return net.request(QUOTE_PATH, {
          method: 'POST',
          kind: 'write',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: quoteBody(packageId, days),
        });
      })
      .then(function (res) { return validateQuote(res, ask, nowFn()); },
        function () { return { ok: false, reason: 'offline' }; });
  }

  /** The per-day durations a visitor can choose: the ladder, cheapest term first. */
  function durations(p) {
    var terms = Array.isArray(p && p.term_prices) ? p.term_prices : [];
    var out = [];
    terms.forEach(function (t) {
      var d = Number(t && t.days); var price = Number(t && t.price);
      if (Number.isInteger(d) && d > 0 && isFinite(price) && price > 0
        && !out.some(function (x) { return x.days === d; })) out.push({ days: d, price: price });
    });
    return out.sort(function (a, b) { return a.days - b.days; });
  }

  function isPerDay(p) {
    return String((p && p.daily_term_mode) || '') === 'PER_DAY';
  }

  function clock(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  /**
   * Bind the window once per page. Returns open(plan, focusIso).
   * deps: { I18N, PLANS, net?, now? } — net defaults to window.MagicNet.
   */
  function bind(doc, deps) {
    var I18N = deps.I18N;
    var PLANS = deps.PLANS;
    var now = deps.now || function () { return Date.now(); };
    // The one network road, MagicNet (assets/magic-net.js), read here and only
    // here: no other English page script holds it.
    var net = deps.net || root.MagicNet;
    var $ = function (id) { return doc.getElementById(id); };
    var box = $('checkout');
    if (!box) return function () {};

    // Everything this window knows. Reset on every open and every close.
    var st = null;
    var timer = null;

    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

    function show(step) {
      $('coStep1').hidden = step !== 1;
      $('coStep2').hidden = step !== 2;
      $('coStep3').hidden = step !== 3;
    }

    // One-off announcements for screen readers (price fixed, price expired).
    // The visible countdown is NOT a live region: it changes every second, and
    // a live region there was read out every second.
    function announce(text) {
      var live = $('coLive');
      if (!live) return;
      live.textContent = '';
      live.textContent = text;
    }

    // When a step change hides the element that had focus, put focus on the
    // new step's anchor instead of letting it fall to <body>. Never steals
    // focus from an element that is still on screen (someone typing an email).
    function keepFocus(target) {
      var a = doc.activeElement;
      var lost = !a || a === doc.body || !box.contains(a) || a.offsetParent === null;
      if (lost && target && typeof target.focus === 'function') target.focus();
    }

    function say(id, key, extra) {
      var el = $(id);
      el.textContent = key ? I18N.t(key) + (extra ? ' ' + extra : '') : '';
      el.hidden = !key;
    }

    function chosenDays() {
      if (!st || !st.perDay) return null;
      var v = Number($('coDays').value);
      return Number.isInteger(v) && v > 0 ? v : null;
    }

    function listed() {
      // The catalogue's figure for the chosen term, shown as «listed» only:
      // the price that counts is the quote's.
      if (!st) return null;
      if (st.perDay) {
        var d = chosenDays();
        var hit = durations(st.plan).filter(function (x) { return x.days === d; })[0];
        return hit ? hit.price : null;
      }
      var priced = PLANS.priceOf(st.plan);
      return priced ? priced.amount : null;
    }

    function termText() {
      if (!st) return '';
      if (st.perDay) {
        var d = chosenDays();
        return d ? d + ' ' + (d === 1 ? 'day' : 'days') : '';
      }
      return PLANS.termText(st.plan);
    }

    function renderPlan() {
      $('coCoverage').textContent = PLANS.coverageText(st.plan, st.focus);
      $('coData').textContent = PLANS.dataText(st.plan);
      $('coTerm').textContent = termText();
      var l = listed();
      $('coListed').textContent = l ? PLANS.money(l) : '—';
    }

    // Throws away the held price AND any quote still in flight: a response to
    // an earlier request (another duration, say) must never be shown as the
    // price of what is selected now. `seq` numbers the requests; a response
    // whose number is not the current one is dropped.
    function invalidateQuote() {
      stopTimer();
      if (st) { st.quote = null; st.seq = (st.seq || 0) + 1; st.inFlight = false; }
      $('coQuote').disabled = false;
      $('coRequote').disabled = false;
      $('coTotal').textContent = '—';
      say('coExpiry', null);
      say('coQuoteStatus', null);
      say('coPriceChanged', null);
      show(1);
      keepFocus($('coQuote'));
    }

    function tick() {
      if (!st || !st.quote) return;
      var left = st.quote.expiresAt - now();
      if (left <= 0) {
        // The held price is gone. Nothing proceeds on it; the visitor asks
        // for a new one — never automatically.
        stopTimer();
        st.quote = null;
        $('coTotal').textContent = '—';
        say('coExpiry', 'quote.expired');
        $('coRequote').hidden = false;
        $('coReview').disabled = true;
        st.step = 2;
        show(2);
        announce(I18N.t('quote.expired'));
        keepFocus($('coRequote'));
        return;
      }
      say('coExpiry', 'quote.heldFor', clock(left));
    }

    function getQuote() {
      if (!st || st.inFlight) return;
      var days = chosenDays();
      if (st.perDay && !days) return;
      st.inFlight = true;
      var btns = [$('coQuote'), $('coRequote')];
      btns.forEach(function (b) { b.disabled = true; });
      say('coQuoteStatus', 'quote.loading');
      var mine = st;
      st.seq = (st.seq || 0) + 1;
      var ask = st.seq;
      requestQuote(net, st.plan.package_id, days, now).then(function (r) {
        // The window was closed or reopened, the duration was changed, or a
        // newer request was made meanwhile: this answer is for something that
        // is no longer on screen. Drop it.
        if (st !== mine || mine.seq !== ask || (mine.perDay && chosenDays() !== days)) return;
        mine.inFlight = false;
        btns.forEach(function (b) { b.disabled = false; });
        if (!r.ok) {
          say('coQuoteStatus', REASON_KEY[r.reason] || 'quote.unavailable');
          // The pressed button was disabled while the request ran, and a
          // disabled button drops focus to <body>. Hand it back to whichever
          // price button is on screen, so «try again» is one keypress away.
          keepFocus($('coRequote').hidden ? $('coQuote') : $('coRequote'));
          return;
        }
        say('coQuoteStatus', null);
        mine.quote = r.quote;
        var l = listed();
        $('coTotal').textContent = PLANS.money(r.quote.amount);
        say('coPriceChanged', l != null && l !== r.quote.amount ? 'quote.changed' : null);
        $('coRequote').hidden = true;
        $('coReview').disabled = false;
        mine.step = 2;
        show(2);
        announce(I18N.t('quote.fixed') + ' ' + PLANS.money(r.quote.amount) + '.');
        keepFocus($('coTotal'));
        tick();
        stopTimer();
        timer = setInterval(tick, 1000);
      });
    }

    function review() {
      if (!st || !st.quote) return;
      var email = String($('coEmail').value || '').trim();
      if (!EMAIL.test(email)) { say('coFormError', 'checkout.emailInvalid'); $('coEmail').focus(); return; }
      if (!$('coDevice').checked) { say('coFormError', 'checkout.deviceRequired'); return; }
      say('coFormError', null);
      $('rvCoverage').textContent = PLANS.coverageText(st.plan, st.focus);
      $('rvData').textContent = PLANS.dataText(st.plan);
      $('rvTerm').textContent = termText();
      $('rvEmail').textContent = email;
      $('rvTotal').textContent = PLANS.money(st.quote.amount);
      st.step = 3;
      show(3);
      keepFocus($('coFinal'));
    }

    // Keyboard and screen-reader users: focus goes INTO the dialog when it
    // opens, Tab cannot wander behind it, and focus returns to the button that
    // opened it when it closes (WCAG 2.4.3; found by axe-core on the live page).
    var opener = null;
    var FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    function focusables() {
      return Array.prototype.filter.call(box.querySelectorAll(FOCUSABLE), function (el) {
        return el.offsetParent !== null || el === doc.activeElement;
      });
    }
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || box.hidden) return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0]; var last = f[f.length - 1];
      if (e.shiftKey && (doc.activeElement === first || !box.contains(doc.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    function close() {
      stopTimer();
      st = null;
      // The email leaves with the window: nothing keeps it.
      $('coEmail').value = '';
      $('coDevice').checked = false;
      box.hidden = true;
      if (opener && doc.contains(opener) && typeof opener.focus === 'function') opener.focus();
      opener = null;
    }

    $('coClose').addEventListener('click', close);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) close(); });
    $('coDays').addEventListener('change', function () { invalidateQuote(); renderPlan(); });
    $('coQuote').addEventListener('click', getQuote);
    $('coRequote').addEventListener('click', getQuote);
    $('coReview').addEventListener('click', review);
    $('coBack').addEventListener('click', function () { if (st) { st.step = 2; show(2); keepFocus($('coTotal')); } });
    // The payment button exists to say what is missing. It is disabled in the
    // markup and nothing here ever enables it or listens to it.

    return function open(plan, focusIso) {
      stopTimer();
      st = { plan: plan, focus: focusIso, perDay: isPerDay(plan), quote: null, step: 1, inFlight: false };
      var sel = $('coDays');
      sel.textContent = '';
      if (st.perDay) {
        durations(plan).forEach(function (d) {
          var o = doc.createElement('option');
          o.value = String(d.days);
          o.textContent = d.days + ' days';
          sel.appendChild(o);
        });
      }
      $('coTermPick').hidden = !st.perDay;
      $('coEmail').value = '';
      $('coDevice').checked = false;
      $('coTotal').textContent = '—';
      $('coRequote').hidden = true;
      ['coQuoteStatus', 'coExpiry', 'coPriceChanged', 'coFormError'].forEach(function (id) { say(id, null); });
      $('coQuote').disabled = false;
      renderPlan();
      show(1);
      opener = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
      box.hidden = false;
      // The title, so a screen reader announces the dialog and the refusal
      // under it before any control.
      $('coTitle').focus();
    };
  }

  var api = {
    QUOTE_PATH: QUOTE_PATH, quoteBody: quoteBody, validateQuote: validateQuote, requestQuote: requestQuote,
    durations: durations, isPerDay: isPerDay, clock: clock, REASON_KEY: REASON_KEY, EMAIL: EMAIL, bind: bind,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MagicEnCheckout = api;
})(typeof window !== 'undefined' ? window : globalThis);
