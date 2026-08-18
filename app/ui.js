'use strict';

/* ============================================================================
 * Magic eSIM Mini App — the DOM half.
 *
 * All the network and money logic lives in core.js, which is tested in Node.
 * This file is deliberately the part that is hard to unit-test: element
 * creation, Telegram's WebApp surface, and navigation.
 *
 * WHAT THIS FILE IS CAREFUL ABOUT
 *
 *   Nothing is ever inserted with innerHTML from data. Package names, country
 *   names and provider text all come from outside, and one of them containing a
 *   tag would otherwise execute in the customer's session. Everything goes
 *   through textContent or a created node.
 *
 *   Loading is never an open-ended spinner. Every screen either has data, a
 *   skeleton with a shape, or a stated failure with a retry — because a Mini App
 *   that spins forever on a bad gateway minute is indistinguishable from one that
 *   is broken, and TD-55 guarantees bad minutes.
 * ========================================================================= */

(function () {
  const C = window.MagicCore;
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  /* ------------------------------------------------------------------ *
   * Tiny DOM helpers
   * ------------------------------------------------------------------ */

  const $ = (sel, root = document) => root.querySelector(sel);

  /** Create an element. Text is set as TEXT, never parsed. */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = String(v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      // Through the CSSOM, never through the attribute. Our own CSP says
      // style-src 'self', which blocks a style ATTRIBUTE outright — measured on
      // production 2026-08-17, that is why the usage gauge always drew empty.
      // The property setter is not covered by style-src and applies normally.
      else if (k === 'style') node.style.cssText = String(v);
      else node.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of [].concat(children)) {
      if (c === null || c === undefined || c === false) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }

    return node;
  }

  const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };

  /* ------------------------------------------------------------------ *
   * Telegram surface
   *
   * Every call is guarded: the app must still run in a plain browser tab, which
   * is how it gets developed and how a broken Telegram build gets diagnosed.
   * ------------------------------------------------------------------ */

  const haptic = (style) => {
    // Used only on outcomes a customer would want confirmed — a purchase
    // starting, a copy succeeding. Buzzing on navigation is noise.
    try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(style || 'light'); } catch { /* */ }
  };

  const notifySuccess = () => {
    try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success'); } catch { /* */ }
  };

  function setBackButton(visible, handler) {
    if (!tg || !tg.BackButton) return;
    try {
      if (visible) {
        tg.BackButton.show();
        tg.BackButton.onClick(handler);
      } else {
        tg.BackButton.hide();
      }
    } catch { /* older clients */ }
  }

  function openExternal(url) {
    // Payment leaves Telegram on purpose: Platega's page must run in a real
    // browser, and openLink keeps the Mini App alive underneath so the customer
    // comes back to it rather than to a cold start.
    try {
      if (tg && tg.openLink) { tg.openLink(url); return; }
    } catch { /* */ }
    window.location.href = url;
  }

  /* ------------------------------------------------------------------ *
   * App state
   * ------------------------------------------------------------------ */

  const storage = (() => {
    try {
      window.sessionStorage.setItem('mesim.probe', '1');
      window.sessionStorage.removeItem('mesim.probe');
      return window.sessionStorage;
    } catch {
      // Private mode, or storage disabled. An in-memory fallback loses the
      // idempotency key across a payment round-trip, which is worse than
      // persisting it — but crashing is worse still, and the server's key
      // uniqueness is what actually prevents a double charge.
      return C.memoryStorage();
    }
  })();

  const cache = C.createCache(storage);

  // Exposed for the browser suite only: it needs to assert that what the
  // selector SHOWS and what the intent WILL SEND are the same thing, and a
  // discrepancy between those two is exactly the bug this guards.
  if (typeof window !== 'undefined') window.__state = null;

  let api = null;
  const state = {
    // 'loading' until boot says otherwise: the markup ships with that screen
    // active so the first paint is never blank.
    screen: 'loading',
    // False until a session exists. The catalogue does not wait for it — only
    // «Мои eSIM», purchase, activation and usage do.
    ready: false,
    authError: null,
    countries: [],
    // Regional and global offers, kept apart from countries: they are a
    // different thing to buy and the Blueprint lists them separately.
    regions: [],
    query: '',
    // The last few endpoint decisions, for diagnosis during a live test.
    apiTrace: [],
    // §8.4: the six-character order ref that came back through startapp. A hint
    // for which order to highlight, never a claim about it.
    orderRef: null,
    lastOrder: null,
    // The full A-Z list is behind one tap. Opening on 213 rows was the reported
    // "весь каталог алфавитом".
    showAll: false,
    // Never defaults to true. §9 S4: acceptance is an act, not a default.
    termsAccepted: false,
    country: null,
    esims: [],
    intent: null,
    stale: {},
  };

  if (typeof window !== 'undefined') window.__state = state;

  /* ------------------------------------------------------------------ *
   * Navigation
   * ------------------------------------------------------------------ */

  const SCREENS = ['home', 'country', 'checkout', 'esims', 'esim', 'install', 'error', 'loading', 'order'];
  const history = [];

  function show(name, { push = true } = {}) {
    if (push && state.screen !== name) history.push(state.screen);
    // Leaving S6 stops its poll. Without this the timer outlived the screen,
    // kept asking the gateway, rewrote a hidden container and could fire the
    // success haptic while the customer was somewhere else entirely.
    if (state.screen === 'order' && name !== 'order') { stopOrderPoll(); resumeOnReturn = null; }
    state.screen = name;
    for (const s of SCREENS) {
      const node = document.getElementById(`screen-${s}`);
      if (!node) continue;
      if (s === name) node.setAttribute('data-active', '');
      else node.removeAttribute('data-active');
    }
    window.scrollTo(0, 0);
    setBackButton(history.length > 0, goBack);
  }

  function goBack() {
    const previous = history.pop();
    show(previous || 'home', { push: false });
  }

  /* ------------------------------------------------------------------ *
   * Shared pieces
   * ------------------------------------------------------------------ */

  /** A stale-data notice with a retry. Never silent: see core.readThrough. */
  function staleNotice(onRetry) {
    return el('div', { class: 'notice' }, [
      el('span', { text: 'Показаны сохранённые данные — сеть недоступна.' }),
      el('button', { class: 'btn btn--quiet', text: 'Обновить', onclick: onRetry }),
    ]);
  }

  function errorNotice(message, onRetry) {
    return el('div', { class: 'notice notice--bad' }, [
      el('span', { text: message }),
      onRetry ? el('button', { class: 'btn btn--quiet', text: 'Повторить', onclick: onRetry }) : null,
    ]);
  }

  function skeletonCards(n) {
    return el('div', {}, Array.from({ length: n }, () => el('div', { class: 'skel skel--card' })));
  }

  /** A copyable value. The copy is the point: nobody retypes an LPA by choice. */
  function copyField(label, value) {
    if (!value) return null;

    return el('div', { class: 'stack' }, [
      el('div', { class: 'small muted', text: label }),
      el('div', { class: 'copyfield' }, [
        el('code', { text: value }),
        el('button', {
          class: 'btn btn--quiet',
          text: 'Копировать',
          onclick: async (e) => {
            try {
              await navigator.clipboard.writeText(value);
              e.target.textContent = 'Скопировано';
              notifySuccess();
              setTimeout(() => { e.target.textContent = 'Копировать'; }, 1600);
            } catch {
              // Clipboard is permission-gated in some webviews. Selecting the
              // text is a worse but working fallback.
              const range = document.createRange();
              range.selectNodeContents(e.target.closest('.copyfield').querySelector('code'));
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
            }
          },
        }),
      ]),
    ]);
  }

  /* ------------------------------------------------------------------ *
   * Screen: home
   * ------------------------------------------------------------------ */

  /**
   * The catalogue. Deliberately NOT gated on the session.
   *
   * /api/v1/retail/packages is public — it is the same endpoint the website
   * calls, with `auth: false` — so making the customer wait for a session before
   * seeing a price was a self-inflicted delay. On a cold gateway that session
   * costs about twelve seconds and sometimes fails outright, and the catalogue
   * is what most people opened the app to see. It now renders as soon as the
   * network answers; the session lands separately and only unlocks «Мои eSIM»,
   * purchase, activation and usage.
   */
  /** Turn a catalogue envelope into the two lists the screen renders. */
  function adoptCatalogue(payload) {
    const grouped = C.groupCatalogue((payload && payload.data) || []);
    state.countries = grouped.countries;
    state.regions = grouped.regions;
  }

  /**
   * The catalogue. It waits for neither endpoint.
   *
   * Three sources, in the order they can possibly arrive: whatever is already
   * in this session's cache, the static snapshot that ships with the site, and
   * the live API. The first two are drawn immediately and marked as such; the
   * live answer replaces them when it lands. On a phone in another country the
   * difference between "instant, four hours old, and says so" and "three
   * seconds of skeleton" is the whole experience.
   *
   * §9 S1 is explicit that stale data may never be presented as fresh, so the
   * snapshot always carries its notice until the live answer overwrites it.
   */
  async function renderCatalogue() {
    const list = $('#home-countries');
    let painted = false;

    const notice = $('#home-notice');
    const paint = (payload, { stale, retry } = {}) => {
      adoptCatalogue(payload);
      clear(notice);
      // Blueprint §9 S1: a snapshot may be shown, but never as if it were fresh.
      // The notice lives outside #home-countries because paintCountryList()
      // clears that container on every keystroke and would erase it.
      if (stale) notice.appendChild(staleNotice(retry || renderCatalogue));
      paintCountryList();
      painted = true;
    };

    clear(list);
    list.appendChild(skeletonCards(5));

    // The snapshot races the network. Whichever lands first is shown; a live
    // answer always wins afterwards.
    const live = api.catalogue().then(
      (v) => ({ ok: true, value: v }),
      (err) => ({ ok: false, err })
    );
    const snapshot = api.staticCatalogue().then(
      (v) => ({ ok: true, value: v }),
      (err) => ({ ok: false, err })
    );

    const first = await Promise.race([live, snapshot]);
    if (first.ok) paint(first.value, { stale: first.value.generated_at != null });

    const settled = await live;
    // An EMPTY live answer is not a fresher catalogue, it is an incident. It
    // used to satisfy `ok` and repaint over a perfectly good snapshot, leaving
    // a blank shop window with no tiles, no «Все страны» and no error to
    // explain it. The storefront has always had this guard; the Mini App did
    // not. Treated as a failure so the snapshot path below takes over.
    const liveHasRows = settled.ok
      && Array.isArray(settled.value && settled.value.data)
      && settled.value.data.length > 0;

    if (liveHasRows) {
      // Fresh beats everything, and the notice goes with it.
      paint(settled.value, { stale: false });
      cache.write('catalogue', settled.value);

      return;
    }

    if (painted) return;                       // the snapshot is already on screen

    const fallback = await snapshot;
    if (fallback.ok) {
      paint(fallback.value, { stale: true });

      return;
    }

    // Nothing reached us at all — say so once, with a way out.
    const cached = cache.read('catalogue');
    if (cached && cached.value) {
      paint(cached.value, { stale: true });

      return;
    }
    clear(list);
    clear(notice);
    list.appendChild(errorNotice('Не удалось загрузить тарифы.', renderCatalogue));
  }

  /**
   * The return block — Blueprint §9 S1 puts it FIRST when it exists, because a
   * customer who already bought is far more likely to have opened the app for
   * an eSIM they own than for a new one (P2).
   *
   * Needs a session, so it arrives after the catalogue and never blocks it.
   * Failure is quiet by design: no session simply means no block.
   */
  async function renderMine() {
    const mine = $('#home-mine');
    if (!state.ready) return;

    try {
      const own = await api.esims();
      state.esims = own.items || [];
    } catch {
      clear(mine);

      return;
    }

    clear(mine);
    if (!state.esims.length) return;

    mine.appendChild(el('h2', { text: 'Мои eSIM' }));
    for (const e of state.esims.slice(0, 3)) mine.appendChild(esimCard(e));
    if (state.esims.length > 3) {
      mine.appendChild(el('button', {
        class: 'btn btn--ghost', text: `Все eSIM · ${state.esims.length}`,
        onclick: () => { show('esims'); renderEsims(); },
      }));
    }
  }

  async function renderHome() {
    await renderCatalogue();
    await renderMine();
  }

  /** One destination row: flag, name, how many tariffs, cheapest price. */
  function destinationRow(g) {
    return el('button', { class: 'card card--row', onclick: () => openCountry(g) }, [
      el('span', { class: 'card__flag', text: g.flag || '' }),
      el('span', { class: 'card__body' }, [
        el('span', { class: 'card__title', text: g.country }),
        el('span', {
          class: 'card__meta',
          text: g.regional
            ? `${C.countryWord(g.coverage.length)} · ${C.tariffWord(g.items.length)}`
            : C.tariffWord(g.items.length),
        }),
      ]),
      el('span', { class: 'card__price tabular', text: g.from === null ? '' : `от ${C.money(g.from)}` }),
      el('span', { class: 'card__chevron', 'aria-hidden': 'true', text: '›' }),
    ]);
  }

  /**
   * A popular destination, as a tile.
   *
   * The flag is the storefront's own PNG — same file, same artwork — rather than
   * an emoji, because these sixteen are the ones the site presents as its shop
   * window and they should not look different here. Emoji stays for the long
   * tail, where sixteen extra requests would not be worth it and many of those
   * countries have no asset anyway.
   */
  function popularTile(g) {
    const code = g.country_code.toLowerCase();

    return el('button', { class: 'tile', onclick: () => openCountry(g) }, [
      el('img', {
        class: 'tile__flag', src: `../assets/flags/${code}.png`,
        width: '34', height: '24', alt: '', loading: 'lazy',
        // An asset that 404s must not leave a broken-image glyph on the tile.
        onerror: (e) => { e.target.remove(); },
      }),
      el('span', { class: 'tile__name', text: g.country }),
      el('span', { class: 'tile__from tabular', text: g.from === null ? '' : `от ${C.money(g.from)}` }),
    ]);
  }

  /** One destination row: flag, name, what you get, price, chevron. */
  function destinationRow(g) {
    return el('button', { class: 'card card--row', onclick: () => openCountry(g) }, [
      el('span', { class: 'card__flag', text: g.flag || '' }),
      el('span', { class: 'card__body' }, [
        el('span', { class: 'card__title', text: g.country }),
        el('span', {
          class: 'card__meta',
          text: g.regional
            ? `${C.countryWord(g.coverage.length)} · ${C.tariffWord(g.items.length)}`
            : C.tariffWord(g.items.length),
        }),
      ]),
      el('span', { class: 'card__price tabular', text: g.from === null ? '' : `от ${C.money(g.from)}` }),
      el('span', { class: 'card__chevron', 'aria-hidden': 'true', text: '›' }),
    ]);
  }

  /**
   * The catalogue screen has two completely different jobs and used to try to do
   * both at once: browsing, and finding. Browsing opens on sixteen popular
   * destinations — the storefront's own set, in the storefront's own order —
   * with everything else behind one tap. Finding replaces all of it with ranked
   * matches.
   *
   * The previous version rendered 213 rows on open and, while searching, left
   * all 23 regional rows unfiltered above the matches. Typing "Таиланд" left
   * nineteen rows on screen of which eighteen were regions, which is why this
   * was reported as "search does not work": it did work, and you could not see
   * that it had.
   */
  function paintCountryList() {
    const list = $('#home-countries');
    clear(list);

    const q = state.query;
    const countries = state.countries || [];
    const regions = state.regions || [];

    if (q) {
      const matches = C.searchCountries([...countries, ...regions], q);
      if (!matches.length) {
        list.appendChild(el('div', { class: 'empty stack' }, [
          el('p', { text: 'Страна не найдена.' }),
          el('p', { class: 'small muted', text: 'Попробуйте другое название — например, «Таиланд» или «Turkey».' }),
          el('button', { class: 'btn btn--quiet', text: 'Показать популярные', onclick: clearSearch }),
        ]));
        return;
      }
      list.appendChild(el('h2', { class: 'section', text: `Найдено · ${matches.length}` }));
      for (const g of matches) list.appendChild(destinationRow(g));

      return;
    }

    const popular = C.popularGroups(countries);
    if (popular.length) {
      list.appendChild(el('h2', { class: 'section', text: 'Популярные направления' }));
      list.appendChild(el('div', { class: 'tiles' }, popular.map(popularTile)));
    }

    if (!state.showAll) {
      const rest = countries.length - popular.length + regions.length;
      if (rest > 0) {
        list.appendChild(el('button', {
          class: 'btn btn--ghost btn--wide',
          text: `Все страны и регионы · ${rest}`,
          onclick: () => { state.showAll = true; paintCountryList(); },
        }));
      }

      return;
    }

    if (regions.length) {
      list.appendChild(el('h2', { class: 'section', text: 'Регионы и весь мир' }));
      for (const r of regions) list.appendChild(destinationRow(r));
    }
    if (countries.length) {
      list.appendChild(el('h2', { class: 'section', text: 'Все страны' }));
      for (const g of countries) list.appendChild(destinationRow(g));
    }
  }

  function clearSearch() {
    const input = $('#search');
    input.value = '';
    state.query = '';
    paintCountryList();
  }

  /* ------------------------------------------------------------------ *
   * Screen: country
   * ------------------------------------------------------------------ */

  /** TariffCard (§12.3): volume, term, price, and the one badge worth having. */
  function tariffCard(p, group) {
    const isBest = group && group.best && group.best.package_id === p.package_id;
    const days = Number(p.validity_days);

    return el('button', { class: 'card stack', onclick: () => openCheckout(p, group) }, [
      el('div', { class: 'row row--between' }, [
        el('div', { class: 'row tariff__head' }, [
          el('span', { class: 'card__title', text: p.unlimited ? 'Безлимит' : `${p.data_gb} ГБ` }),
          isBest ? el('span', { class: 'badge badge--best', text: 'Оптимальный выбор' }) : null,
        ]),
        el('div', { class: 'card__price tabular', text: C.money(p.price) }),
      ]),
      el('div', {
        class: 'card__meta',
        text: `${days} ${C.plural(days, 'день', 'дня', 'дней')}`
          + (p.hotspot_supported === true ? ' · раздача интернета' : ''),
      }),
    ]);
  }

  function openCountry(group) {
    state.country = group;
    $('#country-title').textContent = group.country;
    const list = $('#country-list');
    clear(list);

    if (group.regional) {
      list.appendChild(el('p', {
        class: 'small muted',
        text: `Один тариф на ${C.countryWord(group.coverage.length)}.`,
      }));
    }

    for (const p of group.items) list.appendChild(tariffCard(p, group));

    // Blueprint §9 S2: a country is never a dead end. Regional offers that
    // cover it are shown underneath — and if it has no local tariff at all,
    // they are the only thing standing between the customer and a blank screen.
    const alternatives = group.regional ? [] : C.regionsCovering(state.regions, group.country_code);
    if (alternatives.length) {
      list.appendChild(el('h2', {
        class: 'section',
        text: group.items.length ? 'Также подойдут' : 'Подойдут региональные тарифы',
      }));
      for (const r of alternatives) list.appendChild(destinationRow(r));
    }

    if (!group.items.length && !alternatives.length) {
      list.appendChild(el('div', { class: 'empty stack' }, [
        el('p', { text: 'Для этой страны пока нет тарифов.' }),
        el('button', { class: 'btn btn--quiet', text: 'Выбрать другую страну', onclick: () => show('home') }),
      ]));
    }

    show('country');
  }

  /* ------------------------------------------------------------------ *
   * Screen: checkout
   * ------------------------------------------------------------------ */

  function openCheckout(pkg, group) {
    // `pkg.country` does not exist in the catalogue DTO, so this line used to
    // render " · 3 ГБ" with an empty space where the destination should be. The
    // name comes from the group the customer navigated through, or from the
    // dictionary as a fallback.
    const where = (group && group.country) || C.countryLabel(pkg.country_code);
    const days = Number(pkg.validity_days);

    state.intent = {
      package_id: pkg.package_id,
      // §9 S4: sbp or card, nothing else. SBP is the default on both surfaces
      // and is the cheaper rail; it was hard-coded to 'card' here with no way
      // to see or change it.
      payment_type: 'sbp',
      email: '',
      expected_amount_rub: Number(pkg.price),
      _pkg: pkg,
      _where: where,
    };
    state.termsAccepted = false;

    $('#checkout-summary').replaceChildren(
      el('div', { class: 'card stack' }, [
        el('div', { class: 'row' }, [
          el('span', { class: 'card__flag', text: (group && group.flag) || C.flagFor(pkg.country_code, pkg) }),
          el('span', { class: 'card__body' }, [
            el('span', { class: 'card__title', text: where }),
            el('span', {
              class: 'card__meta',
              text: `${pkg.unlimited ? 'Безлимит' : `${pkg.data_gb} ГБ`}`
                + ` · ${days} ${C.plural(days, 'день', 'дня', 'дней')}`,
            }),
          ]),
        ]),
        el('div', { class: 'row row--between' }, [
          el('span', { class: 'muted', text: 'К оплате' }),
          el('strong', { class: 'tabular', text: C.money(pkg.price) }),
        ]),
      ])
    );

    // Blueprint §9 S4: «Согласие с офертой — обязательно. Явное действие.
    // Предустановленной галочки быть не может.» The app was sending
    // terms_accepted: true unconditionally, which is an acceptance nobody made.
    // A fresh intent starts on SBP every time, however the last one ended.
    setPaymentMethod('sbp');

    const terms = $('#checkout-terms');
    terms.checked = false;
    $('#checkout-error').replaceChildren();
    $('#checkout-email').value = '';
    setPayEnabled(false, `Оплатить ${C.money(pkg.price)}`);
    show('checkout');
  }

  /**
   * Choose the rail, and show it.
   *
   * Changing the method changes the intent, and purchaseIntentKey already has
   * payment_type in its scope — so a switch derives a NEW key while retrying
   * the same choice reuses the existing one. Nothing here has to manage that;
   * it only has to keep state.intent honest.
   */
  function setPaymentMethod(method) {
    const chosen = method === 'card' ? 'card' : 'sbp';
    if (state.intent) state.intent.payment_type = chosen;

    for (const btn of document.querySelectorAll('#checkout-methods .segmented__opt')) {
      btn.setAttribute('aria-checked', String(btn.dataset.method === chosen));
    }
  }

  /**
   * Two different reasons a pay button is disabled, and they must not look the
   * same.
   *
   * `busy` means an order is being created and a spinner is the truth. Merely
   * NOT YET ALLOWED — the oferta is unticked — is not work in progress, and
   * showing a spinner for it says the app is doing something when it is waiting
   * for the customer. That is what shipped when the consent gate started
   * reusing this function, which had only ever had the one meaning.
   */
  function setPayEnabled(enabled, label, { busy = false } = {}) {
    const btn = $('#checkout-pay');
    btn.disabled = !enabled;
    clear(btn);
    if (!enabled && busy) btn.appendChild(el('span', { class: 'btn__spinner' }));
    btn.appendChild(document.createTextNode(
      label || (enabled ? 'Оплатить' : (busy ? 'Создаём заказ…' : 'Оплатить'))
    ));
  }

  async function pay() {
    const email = String($('#checkout-email').value || '').trim();
    const errBox = $('#checkout-error');
    errBox.replaceChildren();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errBox.appendChild(errorNotice('Укажите e-mail — на него придёт eSIM.'));
      return;
    }
    if (state.termsAccepted !== true) {
      errBox.appendChild(errorNotice('Примите оферту, чтобы продолжить.'));
      return;
    }

    // The guard against the second tap. The idempotency key makes a repeat safe
    // on the server; disabling the button is what stops the customer having to
    // find out.
    setPayEnabled(false, null, { busy: true });
    state.intent.email = email;
    state.intent.terms_accepted = state.termsAccepted === true;
    haptic('medium');

    try {
      const out = await api.purchase(state.intent);
      // The intent is spent. Forgetting the key means the next purchase of the
      // same tariff is a NEW order rather than a replay of this one.
      api.forgetIntent(state.intent);

      // §9 S5: the token is kept BEFORE leaving for payment, so a return that
      // lands anywhere still knows which order this was. The architecture does
      // not depend on it — /tma/me/orders/active finds the order on any later
      // launch because the link was made when the order was created — but it
      // makes the immediate return instant instead of a lookup.
      rememberPendingOrder(out.public_order_token);

      if (out.redirect_url) {
        // §9 S5: the destination is checked before the customer is sent to it.
        // Refusing is safe here — the order already exists on the server, so
        // nothing is lost by not opening, and S6 below will show its state.
        if (!C.isAllowedPaymentUrl(out.redirect_url)) {
          errBox.appendChild(errorNotice(
            'Не удалось открыть безопасную страницу оплаты. Заказ сохранён — напишите нам, и мы поможем завершить его.'
          ));
          errBox.appendChild(supportButton({ public_order_token: out.public_order_token }));
        } else {
          setPayEnabled(false, 'Открываем оплату…', { busy: true });
          openExternal(out.redirect_url);
        }
      }
      // Either way the customer lands on the status screen rather than on a
      // checkout form they have already submitted.
      await showOrderStatus(String(out.public_order_token || '').slice(-6));
    } catch (err) {
      setPayEnabled(true);

      if (err.code === 'AMOUNT_CHANGED') {
        const actual = err.body && err.body.actual_amount_rub;
        errBox.appendChild(errorNotice(
          actual ? `Цена изменилась: теперь ${C.money(actual)}. Подтвердите заново.`
            : 'Цена изменилась. Обновите тариф.'
        ));
        if (actual) {
          state.intent.expected_amount_rub = Number(actual);
          api.forgetIntent(state.intent);   // a new price is a new intent
        }
        return;
      }
      if (err.code === 'PROMO_REJECTED') {
        errBox.appendChild(errorNotice('Промокод не применён. Продолжите без него.'));
        return;
      }
      if (err.isTransport) {
        // The order may or may not exist. Saying so is better than guessing, and
        // the key means retrying cannot double-charge.
        errBox.appendChild(errorNotice(
          'Не удалось подтвердить заказ — связь прервалась. Нажмите «Оплатить» ещё раз: повторный заказ не создастся.',
          null
        ));
        return;
      }
      errBox.appendChild(errorNotice(err.message || 'Не удалось создать заказ.'));
    }
  }


  const PENDING_ORDER_KEY = 'mesim.pending_order_ref';

  /** Keep only the six-character ref — never the whole token. */
  function rememberPendingOrder(token) {
    try {
      const ref = String(token || '').slice(-6);
      if (ref) storage.setItem(PENDING_ORDER_KEY, ref);
    } catch { /* private mode: the server-side lookup still works */ }
  }

  function readPendingOrder() {
    try { return storage.getItem(PENDING_ORDER_KEY) || null; } catch { return null; }
  }

  function clearPendingOrder() {
    try { storage.removeItem(PENDING_ORDER_KEY); } catch { /* */ }
  }

  /**
   * §8.4: `startapp=o_<ref>` arrives as initDataUnsafe.start_param.
   *
   * It is a hint and nothing else — six characters that say which order to
   * highlight among the ones the server has already agreed belong to this
   * customer. It cannot assert payment, cannot name another customer's order,
   * and is discarded when it matches nothing.
   */
  function launchOrderRef() {
    let param = '';
    try {
      param = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || '';
    } catch { param = ''; }

    const m = /^o_([A-Za-z0-9_-]{4,16})$/.exec(String(param));
    if (m) return m[1];

    return readPendingOrder();
  }

  /* ------------------------------------------------------------------ *
   * S11 · Support — a handover, not a second support channel
   * ------------------------------------------------------------------ */

  // §9 S11: «Mini App не содержит собственного чата.» The client bot already
  // has AI answers, escalation to a live operator and an operator-reply
  // bridge; a second, worse channel inside the Mini App would be a downgrade
  // dressed as a feature. All this does is open that bot with enough context
  // that the customer does not have to re-describe what they bought.
  //
  // Only the last six characters of the public token travel — the same ref the
  // return deep-link already carries, and never the whole bearer (R10).
  const SUPPORT_BOT = 'https://t.me/magic_esim_support_bot';

  function supportUrl(order) {
    const ref = order && order.public_order_token
      ? String(order.public_order_token).slice(-6)
      : (state.orderRef ? String(state.orderRef).slice(-6) : '');

    return ref ? `${SUPPORT_BOT}?start=order_${encodeURIComponent(ref)}` : SUPPORT_BOT;
  }

  function supportButton(order, { wide = true } = {}) {
    return el('button', {
      class: wide ? 'btn btn--ghost btn--wide' : 'btn btn--ghost',
      text: 'Написать в поддержку',
      onclick: () => openExternal(supportUrl(order)),
    });
  }

  /* ------------------------------------------------------------------ *
   * S6 · Order status — the screen the Blueprint calls the most important
   * one in the product, and the one a real paid purchase proved missing.
   * ------------------------------------------------------------------ */

  /**
   * §9 S6: 3 s for the first 30 s, then 10 s, stopping at five minutes.
   *
   * The old schedule ran out after about two minutes, which was defensible
   * when every request went through a gateway that dropped a third of them.
   * Render is primary now and answers in well under a second, so the Blueprint
   * cadence is affordable — and two minutes is shorter than a card payment
   * with a 3-D Secure step, which is exactly the customer who most needs the
   * screen to still be watching when they come back.
   *
   * Bounded remains non-negotiable: after five minutes the customer gets a
   * manual refresh and the promise of an email, not an unbounded poll.
   */
  const ORDER_POLL_MS = Object.freeze([
    ...Array.from({ length: 10 }, () => 3000),   // 30 s
    ...Array.from({ length: 27 }, () => 10000),  // to 5 min
  ]);

  /**
   * The five states §6.3 allows, keyed on what the BACKEND sends.
   *
   * `display_status` is produced by ORDER_DISPLAY_STATUS in lib/tmaProjection.js
   * and its entire vocabulary is: awaiting_payment · paid · provisioning ·
   * ready · failed · canceled · unknown. This table was keyed on the INTERNAL
   * retail_orders.status names instead — `purchasing_esim`, `completed`,
   * `cancelled` with two Ls, `refunded` — so four of seven keys could never
   * match anything the server says.
   *
   * The two that mattered were the two that broke: fulfilment in progress fell
   * through to a card titled «Заказ» with an empty note, and a finished order
   * never satisfied `done`, so «Открыть eSIM» never appeared. The e2e suite did
   * not catch it because its fixture invented `display_status: 'purchasing_esim'`
   * — a value production has never emitted.
   *
   * Internal names are kept as aliases, not deleted: a miss here is silent, and
   * silence is precisely the failure being fixed.
   */
  const ORDER_STAGE = Object.freeze({
    awaiting_payment: { title: 'Ждём оплату', note: 'Завершите оплату в браузере. Мы сами узнаем, когда она пройдёт.', spin: true },
    paid: { title: 'Оплата получена', note: 'Готовим eSIM. Обычно это занимает меньше минуты.', spin: true },
    provisioning: { title: 'Готовим eSIM', note: 'Выпускаем профиль у оператора.', spin: true },
    ready: { title: 'eSIM готова', note: 'Профиль выпущен и доступен в «Мои eSIM».', spin: false },
    failed: { title: 'Нужна помощь с заказом', note: 'Мы не смогли выпустить eSIM. Деньги не списаны или будут возвращены — напишите нам, разберёмся.', spin: false },
    canceled: { title: 'Заказ отменён', note: 'Оплата не прошла. Можно попробовать ещё раз.', spin: false },

    // Aliases for the internal vocabulary.
    purchasing_esim: { title: 'Готовим eSIM', note: 'Выпускаем профиль у оператора.', spin: true },
    completed: { title: 'eSIM готова', note: 'Профиль выпущен и доступен в «Мои eSIM».', spin: false },
    cancelled: { title: 'Заказ отменён', note: 'Оплата не прошла. Можно попробовать ещё раз.', spin: false },
    refunded: { title: 'Возврат', note: 'Средства возвращены.', spin: false },
  });

  let orderPollTimer = null;

  function stopOrderPoll() {
    if (orderPollTimer) { clearTimeout(orderPollTimer); orderPollTimer = null; }
  }

  /**
   * Show the status of one order, refreshed from the SERVER and only from it.
   *
   * Nothing in a URL is evidence here. The return from Platega carries a
   * six-character ref and no claim about payment; the truth is the webhook that
   * reached the origin, and this screen learns it by asking under the customer's
   * own session. `paid=true` in a query string would be worth exactly nothing
   * and is never read.
   */
  async function showOrderStatus(ref) {
    stopOrderPoll();
    state.orderRef = ref || state.orderRef || null;
    show('order', { push: false });

    let attempt = 0;

    const paint = (order, { stale = false } = {}) => {
      const body = $('#order-body');
      clear(body);

      if (!order) {
        $('#order-title').textContent = stale ? 'Не удалось проверить заказ' : 'Заказ не найден';
        body.appendChild(el('p', { class: 'muted', text: stale
          ? 'Связь с сервером пропала. Статус заказа не изменился от того, что мы его не увидели — попробуйте ещё раз.'
          : 'Мы не нашли такой заказ. Если оплата прошла, он появится в «Мои eSIM» — а если нет, напишите нам.' }));
        body.appendChild(el('button', {
          class: 'btn btn--ghost btn--wide', text: 'Повторить',
          onclick: () => { attempt = 0; tick(); },
        }));
        body.appendChild(el('button', {
          class: 'btn btn--wide', text: 'Открыть «Мои eSIM»',
          onclick: () => { stopOrderPoll(); show('esims'); renderEsims(); },
        }));
        body.appendChild(supportButton(null));

        return;
      }

      const st = order.display_status || order.status;
      const stage = ORDER_STAGE[st] || null;
      const done = C.isOrderReady(st);
      const dead = C.isOrderDead(st);
      $('#order-title').textContent = stage ? stage.title : 'Проверяем заказ';

      body.appendChild(el('div', { class: 'card stack' }, [
        el('div', {
          class: 'card__title',
          text: C.destinationTitle(order.package_name, order.country_code),
        }),
        order.amount_rub ? el('div', { class: 'row row--between' }, [
          el('span', { class: 'muted', text: 'Сумма' }),
          el('strong', { class: 'tabular', text: C.money(order.amount_rub) }),
        ]) : null,
        el('div', {
          class: 'card__meta',
          // An unmapped status is not a blank card. §16: the state is always
          // carried in words, never only by the absence of them.
          text: stage ? stage.note : 'Мы уточняем статус заказа. Если он не изменится, напишите нам.',
        }),
      ]));

      if (stale) {
        body.appendChild(el('div', { class: 'notice' }, [
          el('span', { text: 'Не удалось обновить статус — показано последнее известное состояние.' }),
        ]));
      }

      if (stage && stage.spin && !stale) {
        // A shaped, finite progress note — never an open-ended spinner.
        body.appendChild(el('div', { class: 'notice' }, [
          el('span', { class: 'btn__spinner' }),
          el('span', { text: 'Обновляем статус автоматически' }),
        ]));
      }

      if (done) {
        notifySuccess();
        // The order carries `esim_id`, so this opens THE eSIM that was just
        // paid for rather than a list the customer then has to search.
        body.appendChild(el('button', {
          class: 'btn btn--wide', text: 'Открыть eSIM',
          onclick: () => {
            stopOrderPoll();
            if (order.esim_id) openEsim(order.esim_id);
            else { show('esims'); renderEsims(); }
          },
        }));
      } else {
        body.appendChild(el('button', {
          class: 'btn btn--ghost btn--wide', text: 'Обновить',
          onclick: () => { attempt = 0; tick(); },
        }));
      }

      // §9 S6 and §9 S11: the failure copy tells the customer to write to us,
      // so it has to be possible to write to us. The Mini App runs no chat of
      // its own — the existing client bot already has AI answers, escalation
      // and an operator bridge — this only hands the conversation over with
      // enough context that nobody has to re-describe their purchase.
      if (dead || !stage) body.appendChild(supportButton(order));
    };

    /** The ref is a HINT. It selects among orders the SERVER gave us, never more. */
    const matchRef = (orders) => (state.orderRef
      ? orders.find((o) => String(o.public_order_token || '').slice(-6)
          === String(state.orderRef).slice(-6))
      : null);

    /**
     * Find this order, wherever it now lives.
     *
     * `/me/orders/active` only carries the three NON-terminal statuses
     * (ACTIVE_ORDER_STATUSES in lib/tmaRepo.js), so the moment an order
     * succeeds, fails or is cancelled it drops out of that list entirely.
     *
     * What used to happen then was the bug this function exists to remove: an
     * empty active list was read as success, and the screen printed «eSIM
     * готова» plus a success haptic if the customer owned ANY eSIM — naming
     * whichever one happened to be first. For a repeat customer whose payment
     * had just FAILED, the product congratulated them on a purchase that did
     * not happen. Completion was inferred from a proxy instead of being read.
     *
     * `/me/orders` returns every order with its true terminal `display_status`
     * and the `esim_id` it produced. It is one extra request, and only on the
     * transition — which is the one moment worth being right about.
     */
    async function findOrder() {
      const active = await api.activeOrders();
      const list = (active && (active.items || active.orders)) || [];
      const hit = matchRef(list);
      if (hit) return { order: hit, terminal: false };

      // No ref and something is in flight: the newest active order is the one
      // the customer is most plausibly looking at.
      if (!state.orderRef && list[0]) return { order: list[0], terminal: false };

      const all = await api.orders();
      const items = (all && all.items) || [];

      return { order: matchRef(items) || (state.orderRef ? null : items[0]) || null, terminal: true };
    }

    async function tick() {
      let found = null;
      try {
        found = await findOrder();
      } catch {
        // A failed poll is not new information; keep what is on screen and let
        // the customer retry rather than replacing a real status with an error.
        paint(state.lastOrder || null, { stale: true });

        return;
      }

      const order = found.order;
      state.lastOrder = order || state.lastOrder;

      if (!order) {
        // The server knows of no such order. Say that, and do not invent one.
        stopOrderPoll();
        paint(null);

        return;
      }

      paint(order);

      // A terminal order will not change by being asked again.
      if (C.isOrderReady(order.display_status) || C.isOrderDead(order.display_status)) {
        stopOrderPoll();
        // «Мои eSIM» is about to be opened from here; keep it warm and correct.
        if (C.isOrderReady(order.display_status)) await refreshEsimsQuietly();

        return;
      }

      if (attempt < ORDER_POLL_MS.length) {
        const wait = ORDER_POLL_MS[attempt];
        attempt += 1;
        orderPollTimer = setTimeout(tick, wait);
      }
    }

    // Coming back from the payment browser is the moment the answer is most
    // likely to have changed, and it is also the moment the schedule above is
    // most likely to have run out — the customer spent the whole budget paying.
    // Without this a slow payer returned to a stale «Ждём оплату» and had to
    // find the refresh button themselves.
    resumeOnReturn = () => {
      if (state.screen !== 'order') return;
      if (state.lastOrder && (C.isOrderReady(state.lastOrder.display_status)
        || C.isOrderDead(state.lastOrder.display_status))) return;
      stopOrderPoll();
      attempt = 0;
      void tick();
    };

    $('#order-title').textContent = 'Проверяем оплату';
    clear($('#order-body'));
    $('#order-body').appendChild(skeletonCards(1));
    await tick();
  }

  /**
   * Set by the S6 screen while it is the one on display. Held outside it so
   * the listeners below can be attached once, at boot, rather than being added
   * again on every visit to the screen.
   */
  let resumeOnReturn = null;

  function bindReturnToApp() {
    const fire = () => { if (typeof resumeOnReturn === 'function') resumeOnReturn(); };
    try {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') fire();
      });
      window.addEventListener('focus', fire);
      // Bot API 6.1+. Guarded: an older client simply keeps the two above.
      if (tg && tg.onEvent) tg.onEvent('activated', fire);
    } catch { /* an environment without these is an environment without S6 */ }
  }

  /** Refresh the eSIM list without drawing anything, for the completion check. */
  async function refreshEsimsQuietly() {
    try {
      const out = await api.esims();
      state.esims = C.sortOwnedEsims((out && out.items) || []);
    } catch { /* the list keeps whatever it had */ }
  }

  /* ------------------------------------------------------------------ *
   * Screen: my eSIMs
   * ------------------------------------------------------------------ */

  async function renderEsims() {
    const list = $('#esims-list');
    clear(list);
    list.appendChild(skeletonCards(3));

    const out = await C.readThrough(cache, 'esims', () => api.esims());
    clear(list);

    if (!out.value) {
      list.appendChild(errorNotice('Не удалось загрузить ваши eSIM.', renderEsims));
      return;
    }
    if (out.stale) list.appendChild(staleNotice(renderEsims));

    state.esims = C.sortOwnedEsims(out.value.items || []);
    if (!state.esims.length) {
      // §9 S8: "Не «нет данных», а два предложения". The second one the
      // Blueprint asks for — linking purchases made on the site — needs the
      // three /tma/identity/email/* endpoints, which are not written and 404 at
      // the gateway. Promising it here would be a button that cannot work, so
      // the honest half is stated instead: a site purchase is not lost, and
      // support can find it today.
      list.appendChild(el('div', { class: 'empty' }, [
        el('p', { text: 'Пока нет ни одной eSIM.' }),
        el('button', { class: 'btn', text: 'Выбрать тариф', onclick: () => show('home') }),
        el('p', { class: 'small muted', text: 'Покупали на сайте? Эти eSIM пока не подключаются к приложению автоматически — напишите нам, и мы поможем.' }),
        supportButton(null),
      ]));
      return;
    }
    for (const e of state.esims) list.appendChild(esimCard(e));
  }

  function statusBadge(status) {
    // Never the raw enum: an unmapped status is our gap, not a word a customer
    // should have to read. RAW CODES = 0 covers status vocabularies too.
    const text = C.ESIM_STATUS_TEXT[status] || 'Статус уточняется';
    const tone = status === 'active' || status === 'ready' ? 'badge--good'
      : (status === 'depleted' || status === 'expired' || status === 'failed' ? 'badge--bad'
        : (status === 'suspended' ? 'badge--warn' : ''));

    return el('span', { class: `badge ${tone}`.trim(), text });
  }

  function gauge(esim) {
    const fraction = C.remainingFraction(esim);
    if (fraction === null) {
      // Unknown, and it must not look like empty. The hatched bar plus the word
      // is the whole point.
      return el('div', { class: 'stack', style: 'gap:4px' }, [
        el('div', { class: 'gauge gauge--unknown' }),
        el('div', { class: 'small muted', text: 'Остаток неизвестен — обновите данные' }),
      ]);
    }
    const cls = fraction === 0 ? 'gauge__fill--empty' : (fraction < 0.15 ? 'gauge__fill--low' : '');

    return el('div', { class: 'stack', style: 'gap:4px' }, [
      el('div', { class: 'gauge' }, [
        el('div', { class: `gauge__fill ${cls}`.trim(), style: `width:${Math.round(fraction * 100)}%` }),
      ]),
      el('div', { class: 'small muted tabular', text: `${esim.remaining_gb} из ${esim.total_gb} ГБ` }),
    ]);
  }

  /**
   * What to call something the customer owns.
   *
   * NOT `package_name`. That is the provider's own string — "Algeria 100MB
   * 7Days" — and it is English, contains the volume twice once the meta line is
   * drawn, and falls back to a bare ISO code. Found while verifying the first
   * real purchase: the eSIM the customer had just paid for would have appeared
   * in «Мои eSIM» as "Algeria 100MB 7Days". Same P3 rule as the catalogue: the
   * customer never sees an internal technical entity.
   *
   * Nor is it `countryLabel(country_code)` alone, which was the second half of
   * the same mistake: the owned DTO has no coverage list, so a regional pack
   * files under one arbitrary member country and «Best World 10 GB» came out
   * as «Албания» (53 of 59 regionals in the 2026-08-18 catalogue), while
   * GL-120 / CA-4 / AF-29 have no Russian name at all and rendered as the bare
   * code. `destinationTitle` reads the provider family name to tell those
   * apart — used, never shown — and never answers with a code.
   */
  const ownedLabel = (e) => C.destinationTitle(e && e.package_name, e && e.country_code);

  function esimCard(e) {
    const days = C.daysLeft(e.expires_at);

    return el('button', {
      // §9 S8: spent eSIMs stay in the list — a customer looks for what they
      // bought, not only for what still works — but they are dimmed so the
      // live one is found without reading. Never dimming alone: `statusBadge`
      // carries the same fact in words (§16 — colour is never the only signal).
      class: C.isSpentEsim(e) ? 'card stack card--spent' : 'card stack',
      onclick: () => openEsim(e.id),
    }, [
      el('div', { class: 'row row--between' }, [
        el('div', { class: 'row' }, [
          el('span', { class: 'card__flag', text: C.flagFor(e.country_code) }),
          el('span', { class: 'card__body' }, [
            el('span', { class: 'card__title', text: ownedLabel(e) }),
            el('span', {
              class: 'card__meta',
              text: days === null ? '' : `${days} ${C.plural(days, 'день', 'дня', 'дней')} осталось`,
            }),
          ]),
        ]),
        statusBadge(e.status),
      ]),
      gauge(e),
    ]);
  }

  /* ------------------------------------------------------------------ *
   * Screen: eSIM detail
   * ------------------------------------------------------------------ */

  async function openEsim(id) {
    show('esim');
    const box = $('#esim-detail');
    clear(box);
    box.appendChild(el('div', { class: 'skel skel--card' }));

    let e = null;
    try {
      e = await api.esim(id);
    } catch (err) {
      clear(box);
      box.appendChild(errorNotice(
        err.status === 404 ? 'eSIM не найдена.' : 'Не удалось загрузить eSIM.',
        err.status === 404 ? null : () => openEsim(id)
      ));
      return;
    }

    clear(box);
    box.appendChild(el('div', { class: 'card stack' }, [
      el('div', { class: 'row row--between' }, [
        el('h1', { text: ownedLabel(e) }),
        statusBadge(e.status),
      ]),
      gauge(e),
      el('div', { class: 'small muted', text: e.expires_at ? `Действует до ${new Date(e.expires_at).toLocaleDateString('ru-RU')}` : '' }),
      el('button', {
        class: 'btn', text: 'Установка и QR', onclick: () => openInstall(id, e),
      }),
      el('button', {
        id: 'esim-refresh', class: 'btn btn--ghost', text: 'Обновить остаток',
        onclick: (ev) => refreshUsage(id, ev.target),
      }),
      // §9 S9 lists four actions and this is the fourth. An eSIM that will not
      // connect is the moment a customer most needs a person, and until now the
      // app had no way to reach one from anywhere.
      supportButton(null, { wide: false }),
      // No top-up button, and its absence is deliberate: recharge is unsafe at
      // BOTH providers (architecture Р-4 — the call carries no ICCID and would
      // likely create a second eSIM, and its transaction id is random per
      // attempt so a retry charges twice). A disabled button would promise
      // something that does not exist.
    ]));
  }

  async function refreshUsage(id, button) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Обновляем…';
    try {
      const fresh = await api.refreshUsage(id);
      await openEsim(id);
      notifySuccess();
      void fresh;
    } catch (err) {
      button.disabled = false;
      button.textContent = original;
      const box = $('#esim-detail');
      if (err.code === 'REFRESH_TOO_SOON') {
        const secs = (err.body && err.body.retry_after) || 60;
        box.appendChild(el('div', { class: 'notice', text: `Данные уже свежие. Повторите через ${secs} с.` }));
        return;
      }
      box.appendChild(errorNotice(
        err.code === 'PROVIDER_UNAVAILABLE'
          ? 'Оператор не ответил. Остаток показан по последним известным данным.'
          : 'Не удалось обновить остаток.'
      ));
    }
  }

  /* ------------------------------------------------------------------ *
   * Screen: installation
   * ------------------------------------------------------------------ */

  async function openInstall(id, esim) {
    show('install');
    const box = $('#install-body');
    clear(box);
    box.appendChild(el('div', { class: 'skel skel--card' }));

    let act = null;
    try {
      act = await api.activation(id);
    } catch (err) {
      clear(box);
      box.appendChild(errorNotice(
        err.status === 404 ? 'Данные установки не найдены.' : 'Не удалось получить данные установки.',
        err.status === 404 ? null : () => openInstall(id, esim)
      ));
      return;
    }

    clear(box);

    // Nothing to install yet: the eSIM exists and is still being issued. The
    // server answers 200 with empty fields precisely so this can be said plainly
    // rather than shown as "not found".
    if (!act.lpa && !act.activation_code) {
      box.appendChild(el('div', { class: 'notice' }, [
        el('span', { text: 'eSIM ещё выпускается. Загляните через пару минут.' }),
      ]));
      return;
    }

    box.appendChild(el('p', { class: 'muted', text: C.activationPolicyText(act.activation_policy) }));

    if (act.qr_png_base64) {
      box.appendChild(el('img', {
        class: 'qr',
        alt: 'QR-код для установки eSIM',
        src: `data:image/png;base64,${act.qr_png_base64}`,
      }));
    }

    // Platform tabs. Both sets of steps are real device flows, not a generic
    // "scan the code" — the settings paths differ and that is where people get
    // stuck.
    const tabs = el('div', { class: 'tabs' });
    const steps = el('div', {});
    const IOS = [
      'Откройте «Настройки» → «Сотовая связь».',
      'Нажмите «Добавить eSIM».',
      'Выберите «Использовать QR-код» и отсканируйте код выше.',
      'Если камеры нет под рукой — «Ввести данные вручную» и вставьте значения ниже.',
    ];
    const ANDROID = [
      'Откройте «Настройки» → «Сеть и интернет» → «SIM-карты».',
      'Нажмите «Добавить eSIM» или «Загрузить SIM-карту».',
      'Отсканируйте код выше.',
      'Если сканер недоступен — введите данные вручную из полей ниже.',
    ];

    const paint = (which) => {
      clear(steps);
      const list = el('ol', { class: 'steps' });
      for (const s of (which === 'ios' ? IOS : ANDROID)) list.appendChild(el('li', { text: s }));
      steps.appendChild(list);
      for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.os === which));
    };

    tabs.appendChild(el('button', { 'data-os': 'ios', text: 'iPhone', onclick: () => paint('ios') }));
    tabs.appendChild(el('button', { 'data-os': 'android', text: 'Android', onclick: () => paint('android') }));
    box.appendChild(tabs);
    box.appendChild(steps);
    paint(/iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'android');

    box.appendChild(el('h2', { text: 'Ввод вручную' }));
    box.appendChild(el('div', { class: 'stack' }, [
      copyField('SM-DP+ адрес', act.smdp_address),
      copyField('Код активации', act.activation_code),
      copyField('LPA (одной строкой)', act.lpa),
      act.iccid ? copyField('ICCID', act.iccid) : null,
    ]));

    box.appendChild(el('p', { class: 'small muted', text: 'Устанавливайте eSIM при работающем интернете. Удалить и установить повторно тот же профиль нельзя.' }));
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  async function authenticate() {
    const initData = tg && tg.initData ? tg.initData : '';
    if (!initData) {
      // Opened outside Telegram. Say so instead of failing at the first request
      // with a 401 the customer cannot act on.
      throw Object.assign(new Error('no initData'), { code: 'NO_TELEGRAM' });
    }

    return api.openSession(initData);
  }

  async function boot() {
    try {
      if (tg) {
        tg.ready();
        tg.expand();
      }
    } catch { /* */ }

    api = C.createApi({
      fetch: window.fetch.bind(window),
      storage,
      // Which road each request took, and why. Kept in memory and surfaced to
      // Telegram's own metrics if the client offers them; never sent anywhere
      // ourselves, and it carries no token, no initData and nothing about the
      // customer — the shape is asserted in core.test.js.
      telemetry: (e) => {
        state.apiTrace.push(e);
        if (state.apiTrace.length > 50) state.apiTrace.shift();
        if (e.fallback_used || e.failed) {
          // A fallback is not an error, but it IS the signal that the primary
          // is having a bad minute, and it is worth being able to see that in a
          // console during a live test.
          try {
            console.info('api', e.api_route, e.path, 'fallback', e.fallback_reason || '-',
              'primary_ms', e.primary_latency_ms);
          } catch { /* */ }
        }
      },
      // Re-mint on a 401 without telling anybody: a 30-minute session expiring
      // while the app sits open is the likeliest failure here.
      reauthenticate: () => authenticate(),
    });

    // Wire the chrome BEFORE the network, and keep a screen on display the whole
    // time. This ordering is the fix for R-44: <nav> lives outside <main>, so the
    // two buttons are painted the instant the HTML parses, but they used to stay
    // inert until a session round-trip finished. On a cold gateway that is twelve
    // seconds — sometimes a 502 — of an app that looks fully rendered and ignores
    // every tap. Reported from an iPhone on 2026-08-17 as "neither button works".
    bindChrome();
    bindReturnToApp();
    applyTelegramTheme();

    // The catalogue is public, so the app opens on it immediately and the
    // session is minted alongside rather than in front. Before this, a cold
    // gateway meant twelve seconds of "Подключаемся…" in front of a price list
    // that needed no session at all.
    show('home', { push: false });
    const catalogue = renderCatalogue();

    const session = authenticate().then(
      () => { state.ready = true; state.authError = null; },
      (err) => { state.ready = false; state.authError = err; }
    );

    await Promise.all([catalogue, session]);

    // §8.4: a launch that came back from payment opens on the order, not on the
    // catalogue. The ref may come from startapp or from what we stored before
    // leaving; either way the STATUS comes from the server.
    //
    // Resolved BEFORE the session check on purpose. It used to sit after an
    // early `return`, so a customer coming back from a completed payment onto
    // a cold gateway — the exact condition that makes the session fail — was
    // dropped onto the catalogue with no sign their order existed. That is the
    // one moment in the product where saying nothing is most expensive.
    const ref = launchOrderRef();

    if (!state.ready) {
      markSignedOut();
      if (ref) { clearPendingOrder(); await showReturnWithoutSession(ref); }

      return;
    }

    await renderMine();

    if (ref) {
      clearPendingOrder();
      await showOrderStatus(ref);
    }
  }

  /**
   * Came back from payment, but the session did not come up.
   *
   * The status cannot be read without one, and guessing is the failure this
   * whole screen exists to prevent — so it says exactly that, and offers the
   * only two things that can actually help: try again, or talk to a human.
   */
  async function showReturnWithoutSession(ref) {
    state.orderRef = ref;
    show('order', { push: false });
    $('#order-title').textContent = 'Не удалось проверить оплату';
    const body = $('#order-body');
    clear(body);
    body.appendChild(el('p', { class: 'muted', text:
      'Мы не смогли связаться с сервером. Это не влияет на оплату: '
      + 'если она прошла, заказ уже принят и eSIM появится в «Мои eSIM».' }));
    body.appendChild(el('button', {
      class: 'btn btn--wide',
      text: 'Проверить ещё раз',
      onclick: async () => {
        try {
          await authenticate();
          state.ready = true;
          state.authError = null;
          await renderMine();
          await showOrderStatus(ref);
        } catch { /* the screen already says what is wrong */ }
      },
    }));
    body.appendChild(supportButton(null));
  }

  /**
   * Telegram hands its palette in as --tg-theme-* custom properties, which
   * mini.css already consumes. What it does not do is colour the native chrome
   * above and below our page, so the header stayed light while the app went
   * dark. Both calls are guarded: they are recent Bot API additions and an old
   * client simply keeps its default.
   */
  function applyTelegramTheme() {
    if (!tg) return;
    const paint = () => {
      try {
        const bg = (tg.themeParams && tg.themeParams.bg_color) || null;
        if (bg && tg.setBackgroundColor) tg.setBackgroundColor(bg);
        if (bg && tg.setHeaderColor) tg.setHeaderColor(bg);
        document.documentElement.setAttribute('data-tg-scheme', tg.colorScheme || 'light');
      } catch { /* an older client keeps its own chrome; nothing breaks */ }
    };
    paint();
    try { if (tg.onEvent) tg.onEvent('themeChanged', paint); } catch { /* */ }
  }

  /**
   * The session failed but the catalogue did not. Say so where it matters —
   * inside «Мои eSIM» — instead of taking the whole app down for it.
   */
  function markSignedOut() {
    const mine = $('#home-mine');
    clear(mine);
  }

  /** Every listener the app owns, attached once and never dependent on a session. */
  function bindChrome() {
    // `input`, not `change` or Enter: results must follow the keystroke. No
    // debounce — the whole catalogue is already in memory, the match is a string
    // compare over ~200 rows, and a delay here would be felt as lag rather than
    // read as care.
    $('#search').addEventListener('input', (e) => {
      state.query = e.target.value;
      paintCountryList();
    });
    // iOS renders a native clear button inside type=search and fires `search`,
    // not `input`, when it is tapped. Without this the field empties and the
    // results stay behind.
    $('#search').addEventListener('search', (e) => {
      state.query = e.target.value;
      paintCountryList();
    });
    $('#checkout-pay').addEventListener('click', pay);
    for (const btn of document.querySelectorAll('#checkout-methods .segmented__opt')) {
      btn.addEventListener('click', () => {
        setPaymentMethod(btn.dataset.method);
        haptic('light');
      });
    }
    // The pay button stays disabled until the oferta is accepted. The gate is
    // here rather than inside pay() so the customer can see the requirement
    // instead of discovering it by being refused.
    $('#checkout-terms').addEventListener('change', (e) => {
      state.termsAccepted = Boolean(e.target.checked);
      const price = state.intent ? C.money(state.intent.expected_amount_rub) : '';
      setPayEnabled(state.termsAccepted, price ? `Оплатить ${price}` : 'Оплатить');
    });
    // The catalogue is public: this tab must work whether or not a session ever
    // arrives, and it is the reason most people opened the app.
    $('#nav-home').addEventListener('click', () => show('home'));
    // «Мои eSIM» is the one tab that genuinely needs the customer's identity.
    $('#nav-esims').addEventListener('click', () => { show('esims'); renderEsims(); });
  }

  /**
   * Three different failures, three different sentences.
   *
   * This used to say "Сеть не ответила" for anything that was not NO_TELEGRAM,
   * and on 2026-08-17 that cost real time: the owner's session was being
   * rejected by the server with a perfectly clear 401 INIT_DATA_INVALID, the app
   * reported a network problem, and the gateway logs had to be read to find out
   * the requests had arrived in 70ms and were answered. A client must not invent
   * a diagnosis the server did not give.
   */
  function showAuthError(err) {
    const outsideTelegram = err && err.code === 'NO_TELEGRAM';
    // status 0/502/503/504 — the request never reached a verdict.
    const transport = Boolean(err && err.isTransport);
    // The server answered and refused. Its own message is the accurate one.
    const refused = Boolean(err && err.status && !transport);

    const box = $('#screen-error');
    clear(box);

    let heading = 'Не удалось войти';
    let detail = 'Сеть не ответила. Обычно помогает повторить попытку.';

    if (outsideTelegram) {
      heading = 'Откройте приложение в Telegram';
      detail = 'Эта страница работает только внутри Telegram.';
    } else if (refused) {
      // Prefer what the server actually said; fall back only if it said nothing.
      detail = (err && err.message)
        || 'Telegram не подтвердил вход. Откройте приложение заново из бота.';
    }

    const parts = [
      // The third and last screen that carries the mark. A customer who cannot
      // get in should still be able to see whose app refused them — and this
      // screen was the barest one in the product.
      el('img', {
        class: 'brand brand--lg', src: '../assets/magic-esim-logo-header.png',
        alt: 'Magic eSIM', width: '185', height: '140',
      }),
      el('h1', { text: heading }),
      el('p', { class: 'muted', text: detail }),
    ];

    // Outside Telegram there is nothing to retry — no initData will ever appear.
    // Inside it, a failed mint is usually a cold gateway, so offer the retry
    // instead of the old dead end that told people to close the app.
    if (!outsideTelegram) {
      parts.push(el('button', {
        class: 'btn',
        text: 'Повторить',
        onclick: async () => {
          show('loading', { push: false });
          try {
            await authenticate();
          } catch (again) {
            showAuthError(again);
            return;
          }
          state.ready = true;
          show('home', { push: false });
          await renderHome();
        },
      }));
    }

    box.appendChild(el('div', { class: 'empty stack' }, parts));
    show('error', { push: false });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
