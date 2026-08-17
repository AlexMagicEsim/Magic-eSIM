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
    screen: 'home',
    countries: [],
    country: null,
    esims: [],
    intent: null,
    stale: {},
  };

  /* ------------------------------------------------------------------ *
   * Navigation
   * ------------------------------------------------------------------ */

  const SCREENS = ['home', 'country', 'checkout', 'esims', 'esim', 'install', 'error'];
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

  async function renderHome() {
    const list = $('#home-countries');
    const mine = $('#home-mine');
    clear(list);
    list.appendChild(skeletonCards(4));

    const out = await C.readThrough(cache, 'catalogue', () => api.catalogue());
    clear(list);

    if (!out.value) {
      list.appendChild(errorNotice('Не удалось загрузить тарифы.', renderHome));
      return;
    }
    if (out.stale) list.appendChild(staleNotice(renderHome));

    state.countries = C.byCountry(out.value.data || []);
    paintCountryList(state.countries);

    // The customer's own eSIMs, if they have any. Failure here is quiet: the
    // catalogue is the reason most people opened the app.
    try {
      const own = await api.esims();
      state.esims = own.items || [];
      clear(mine);
      if (state.esims.length) {
        mine.appendChild(el('h2', { text: 'Мои eSIM' }));
        for (const e of state.esims.slice(0, 3)) mine.appendChild(esimCard(e));
        if (state.esims.length > 3) {
          mine.appendChild(el('button', {
            class: 'btn btn--ghost', text: `Все eSIM (${state.esims.length})`,
            onclick: () => { show('esims'); renderEsims(); },
          }));
        }
      }
    } catch {
      clear(mine);
    }
  }

  function paintCountryList(groups) {
    const list = $('#home-countries');
    clear(list);
    if (!groups.length) {
      list.appendChild(el('div', { class: 'empty', text: 'Ничего не найдено.' }));
      return;
    }

    for (const g of groups.slice(0, 60)) {
      list.appendChild(el('button', {
        class: 'card', onclick: () => openCountry(g),
      }, [
        el('div', { class: 'row row--between' }, [
          el('div', {}, [
            el('div', { class: 'card__title', text: g.country }),
            el('div', { class: 'card__meta', text: `${g.items.length} тарифов` }),
          ]),
          el('div', { class: 'tabular', text: g.from === null ? '' : `от ${C.money(g.from)}` }),
        ]),
      ]));
    }
  }

  /* ------------------------------------------------------------------ *
   * Screen: country
   * ------------------------------------------------------------------ */

  function openCountry(group) {
    state.country = group;
    $('#country-title').textContent = group.country;
    const list = $('#country-list');
    clear(list);

    for (const p of group.items) {
      const isBest = group.best && group.best.package_id === p.package_id;
      list.appendChild(el('button', { class: 'card', onclick: () => openCheckout(p) }, [
        el('div', { class: 'row row--between' }, [
          el('div', {}, [
            el('div', { class: 'row', style: 'gap:8px' }, [
              el('span', { class: 'card__title', text: `${p.data_gb} ГБ` }),
              isBest ? el('span', { class: 'badge badge--best', text: 'Выгодно' }) : null,
            ]),
            el('div', { class: 'card__meta', text: `${p.validity_days} дней` }),
          ]),
          el('div', { class: 'tabular', text: C.money(p.price) }),
        ]),
      ]));
    }

    show('country');
  }

  /* ------------------------------------------------------------------ *
   * Screen: checkout
   * ------------------------------------------------------------------ */

  function openCheckout(pkg) {
    state.intent = {
      package_id: pkg.package_id,
      payment_type: 'card',
      email: '',
      expected_amount_rub: Number(pkg.price),
      _pkg: pkg,
    };

    $('#checkout-summary').replaceChildren(
      el('div', { class: 'card stack' }, [
        el('div', { class: 'card__title', text: `${pkg.country || ''} · ${pkg.data_gb} ГБ` }),
        el('div', { class: 'card__meta', text: `${pkg.validity_days} дней` }),
        el('div', { class: 'row row--between' }, [
          el('span', { class: 'muted', text: 'К оплате' }),
          el('strong', { class: 'tabular', text: C.money(pkg.price) }),
        ]),
      ])
    );
    $('#checkout-error').replaceChildren();
    $('#checkout-email').value = '';
    setPayEnabled(true);
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

    // The guard against the second tap. The idempotency key makes a repeat safe
    // on the server; disabling the button is what stops the customer having to
    // find out.
    setPayEnabled(false);
    state.intent.email = email;
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
      // Re-mint on a 401 without telling anybody: a 30-minute session expiring
      // while the app sits open is the likeliest failure here.
      reauthenticate: () => authenticate(),
    });

    try {
      await authenticate();
    } catch (err) {
      const box = $('#screen-error');
      clear(box);
      box.appendChild(el('div', { class: 'empty stack' }, [
        el('h1', { text: 'Откройте приложение в Telegram' }),
        el('p', {
          class: 'muted',
          text: err.code === 'NO_TELEGRAM'
            ? 'Эта страница работает только внутри Telegram.'
            : 'Не удалось подтвердить вход. Закройте и откройте приложение заново.',
        }),
      ]));
      show('error', { push: false });
      return;
    }

    $('#search').addEventListener('input', (e) => {
      paintCountryList(C.searchCountries(state.countries, e.target.value));
    });
    $('#checkout-pay').addEventListener('click', pay);
    $('#nav-esims').addEventListener('click', () => { show('esims'); renderEsims(); });
    $('#nav-home').addEventListener('click', () => show('home'));

    show('home', { push: false });
    await renderHome();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
