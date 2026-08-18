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

  /* ------------------------------------------------------------------ *
   * Navigation
   * ------------------------------------------------------------------ */

  const SCREENS = ['home', 'country', 'checkout', 'esims', 'esim', 'install', 'error', 'loading'];
  const history = [];

  function show(name, { push = true } = {}) {
    if (push && state.screen !== name) history.push(state.screen);
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
    if (settled.ok) {
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
      payment_type: 'card',
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
    const terms = $('#checkout-terms');
    terms.checked = false;
    $('#checkout-error').replaceChildren();
    $('#checkout-email').value = '';
    setPayEnabled(false, `Оплатить ${C.money(pkg.price)}`);
    show('checkout');
  }

  function setPayEnabled(enabled, label) {
    const btn = $('#checkout-pay');
    btn.disabled = !enabled;
    clear(btn);
    if (enabled) {
      btn.appendChild(document.createTextNode(label || 'Оплатить'));
    } else {
      btn.appendChild(el('span', { class: 'btn__spinner' }));
      btn.appendChild(document.createTextNode(label || 'Создаём заказ…'));
    }
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
    setPayEnabled(false);
    state.intent.email = email;
    state.intent.terms_accepted = state.termsAccepted === true;
    haptic('medium');

    try {
      const out = await api.purchase(state.intent);
      // The intent is spent. Forgetting the key means the next purchase of the
      // same tariff is a NEW order rather than a replay of this one.
      api.forgetIntent(state.intent);

      if (out.redirect_url) {
        setPayEnabled(false, 'Открываем оплату…');
        openExternal(out.redirect_url);
        // The app stays on this screen deliberately: the customer returns here
        // from the browser, and "waiting for payment" is the honest state.
        showAwaitingPayment(out.public_order_token);
      } else {
        showAwaitingPayment(out.public_order_token);
      }
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

  function showAwaitingPayment(token) {
    $('#checkout-error').replaceChildren(
      el('div', { class: 'notice' }, [
        el('span', { text: 'Заказ создан. Завершите оплату в браузере — eSIM появится в «Мои eSIM».' }),
        el('button', {
          class: 'btn btn--quiet', text: 'Проверить',
          onclick: async () => {
            try {
              const st = await api.orderStatus(token);
              const text = C.ORDER_STATUS_TEXT[st.display_status] || st.display_status || '—';
              $('#checkout-error').replaceChildren(el('div', { class: 'notice', text: `Статус: ${text}` }));
              if (st.esim_id) { show('esims'); renderEsims(); }
            } catch {
              /* leave the notice as it was: a failed check is not new information */
            }
          },
        }),
      ])
    );
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

    state.esims = out.value.items || [];
    if (!state.esims.length) {
      list.appendChild(el('div', { class: 'empty' }, [
        el('p', { text: 'Пока нет ни одной eSIM.' }),
        el('button', { class: 'btn', text: 'Выбрать тариф', onclick: () => show('home') }),
      ]));
      return;
    }
    for (const e of state.esims) list.appendChild(esimCard(e));
  }

  function statusBadge(status) {
    const text = C.ESIM_STATUS_TEXT[status] || status || '—';
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

  function esimCard(e) {
    const days = C.daysLeft(e.expires_at);

    return el('button', { class: 'card stack', onclick: () => openEsim(e.id) }, [
      el('div', { class: 'row row--between' }, [
        el('div', {}, [
          el('div', { class: 'card__title', text: e.package_name || e.country_code || 'eSIM' }),
          el('div', { class: 'card__meta', text: days === null ? '' : `${days} дней осталось` }),
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
        el('h1', { text: e.package_name || 'eSIM' }),
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

    // Only the customer's own things waited for it.
    if (state.ready) await renderMine();
    else markSignedOut();
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
