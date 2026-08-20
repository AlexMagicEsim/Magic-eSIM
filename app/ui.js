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

  /**
   * Diagnostics for us, never for the customer.
   *
   * The console is where a state worth knowing goes when it is not worth a
   * screen — "the catalogue came from the snapshot", say. It is behind a guard
   * because a Mini App has no devtools on a phone and this must never be able
   * to throw its way into the render path.
   */
  const log = (...args) => {
    try { if (console && console.info) console.info('[mesim]', ...args); } catch { /* */ }
  };

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
    // Which of the two catalogue tabs is lit. See TAB_FOR_SCREEN.
    catalogueTab: 'nav-home',
    country: null,
    // §9 S2. Price ascending is the default the Blueprint asks for; the choice
    // is remembered across countries within a session, because a customer who
    // sorts by volume once is usually shopping by volume.
    sort: 'price',
    // The package S3 is showing. Held so checkout is opened from the same
    // object the customer read, not from a fresh lookup that might differ.
    tariff: null,
    esims: [],
    intent: null,
    // The top-up being watched, and the last answer the server gave about it.
    // Held so a return from the payment browser resumes THIS one rather than
    // starting another — «не создавать новый» is the requirement.
    topupToken: null,
    lastTopup: null,
    stale: {},
  };

  if (typeof window !== 'undefined') window.__state = state;

  /* ------------------------------------------------------------------ *
   * Navigation
   * ------------------------------------------------------------------ */

  const SCREENS = ['home', 'country', 'tariff', 'checkout', 'esims', 'esim', 'install', 'claim', 'help', 'error', 'loading', 'order', 'topup'];

  // Which bottom tab is lit for a given screen. A tab bar that never highlights
  // is decoration; one that highlights the wrong thing is worse. Screens
  // reached from a tab keep that tab lit, so «Мои eSIM» stays selected while
  // the customer reads an eSIM or its installation steps.
  // `catalogue` is not a tab id: Главная and Купить are the same screen seen
  // two ways, so which of them is lit cannot be read off the screen name. It
  // is whichever the customer last chose, remembered in state.catalogueTab —
  // and the shopping screens that hang off the catalogue follow it, so tapping
  // Купить and drilling into a tariff does not silently light Главная.
  const TAB_FOR_SCREEN = Object.freeze({
    home: 'catalogue',
    country: 'catalogue',
    tariff: 'catalogue',
    checkout: 'catalogue',
    order: 'catalogue',
    esims: 'nav-esims',
    esim: 'nav-esims',
    install: 'nav-esims',
    claim: 'nav-esims',
    // A top-up starts and ends inside «Мои eSIM». Lighting Купить would tell
    // the customer they are shopping for a new eSIM, which is the one thing a
    // top-up is not.
    topup: 'nav-esims',
    help: 'nav-help',
  });
  const history = [];

  function show(name, { push = true } = {}) {
    if (push && state.screen !== name) history.push(state.screen);
    // Leaving S6 stops its poll. Without this the timer outlived the screen,
    // kept asking the gateway, rewrote a hidden container and could fire the
    // success haptic while the customer was somewhere else entirely.
    if (state.screen === 'order' && name !== 'order') { stopOrderPoll(); resumeOnReturn = null; }
    // The same discipline for the top-up status screen: a timer that outlives
    // its screen keeps asking the gateway, rewrites a hidden container, and can
    // fire a success haptic while the customer is somewhere else entirely.
    if (state.screen === 'topup' && name !== 'topup') { stopTopupPoll(); resumeOnReturn = null; }
    state.screen = name;
    for (const s of SCREENS) {
      const node = document.getElementById(`screen-${s}`);
      if (!node) continue;
      if (s === name) node.setAttribute('data-active', '');
      else node.removeAttribute('data-active');
    }
    const mapped = TAB_FOR_SCREEN[name] || null;
    const lit = mapped === 'catalogue' ? state.catalogueTab : mapped;
    for (const tab of document.querySelectorAll('.tabbar .tab')) {
      tab.setAttribute('aria-selected', String(tab.id === lit));
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
  /**
   * A value to read, and a button that takes it.
   *
   * The value is COPIED VERBATIM. `value` is captured in this closure and
   * handed to the clipboard directly — never read back out of the DOM, where
   * the browser's own line-breaking, selection or a stray zero-width character
   * could change what the customer ends up pasting into a settings screen.
   *
   * The layout that keeps this on one line lives in `.copyfield` — see the CSS,
   * which explains the three-rule interaction that used to render these as
   * one-character-per-line towers.
   */
  function copyField(label, value) {
    if (!value) return null;

    const code = el('code', { text: value });
    const btn = el('button', { class: 'btn btn--quiet copyfield__copy', text: 'Копировать' });

    // Held on the element, so a second tap while the first is still showing
    // «Скопировано» restarts the window instead of reverting the label early.
    let revert = null;
    const flash = () => {
      btn.textContent = 'Скопировано';
      btn.dataset.copied = '1';
      if (revert) clearTimeout(revert);
      revert = setTimeout(() => {
        btn.textContent = 'Копировать';
        delete btn.dataset.copied;
        revert = null;
      }, 1600);
    };

    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(value);
        haptic('light');
        notifySuccess();
        flash();
      } catch {
        // The clipboard is permission-gated in some webviews, and in an
        // iOS WebView it can reject outright. Selecting the text is a worse but
        // working fallback — and it still says «Скопировано» is NOT what
        // happened, because claiming a copy that did not occur is how somebody
        // pastes the previous thing into their phone settings.
        try {
          const range = document.createRange();
          range.selectNodeContents(code);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          btn.textContent = 'Выделено';
          if (revert) clearTimeout(revert);
          revert = setTimeout(() => { btn.textContent = 'Копировать'; revert = null; }, 1600);
        } catch { /* nothing left to try; the value is on screen and selectable */ }
      }
    });

    return el('div', { class: 'stack' }, [
      el('div', { class: 'small muted', text: label }),
      el('div', { class: 'copyfield' }, [code, btn]),
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
    const paint = (payload, { stale, retry } = {}) => {   // eslint-disable-line no-unused-vars
      adoptCatalogue(payload);
      clear(notice);

      /*
       * The staleness is TRACKED and not SHOWN — on this screen only.
       *
       * The mechanism is untouched: the snapshot still races the network, a
       * live answer still overwrites it, an empty live answer is still treated
       * as an incident, the cache is still the last resort, and every one of
       * those paths still runs. What is gone is the card that told the customer
       * about it.
       *
       * The reasoning: on the shop window the distinction does not change what
       * anyone can do. Prices from the snapshot are the prices; the live answer
       * replaces them by itself, seconds later, with no tap. The card asked the
       * customer to think about our network conditions and offered a «Обновить»
       * that the page was already performing.
       *
       * WHERE IT STAYS: «Мои eSIM» (`renderEsims`). There the number on screen
       * is a balance, staleness is a fact about THEIR data, and §9 S1's rule —
       * a snapshot may be shown but never as if it were fresh — has real
       * consequences. A catalogue price and a remaining-data figure are not the
       * same kind of claim.
       */
      if (stale) log('catalogue: painted from snapshot/cache');
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
  /**
   * How many owned-eSIM cards to reserve room for before the session answers.
   *
   * THE PROBLEM. `#home-mine` sits above the catalogue, and the catalogue paints
   * first — it is public and needs no session, which is a deliberate and good
   * decision. The session then lands seconds later (twelve, on a cold gateway)
   * and injects the owned block ABOVE the shop window. Measured at 390px: the
   * first destination tile jumped from y=285 to y=444 with one eSIM, and to
   * y=742 with three. The customer reaches for Turkey and Turkey moves.
   *
   * WHAT IS STORED: one integer, capped at 2. Not an id, not a country, not a
   * status — nothing about any eSIM, only how tall a hole to leave. It is read
   * exactly once, to size a placeholder, and it gates nothing: ownership,
   * visibility and every list still come from the server on this very request.
   * A wrong count costs a smaller shift in one direction or the other, which is
   * strictly better than the whole block arriving at once.
   */
  const MINE_SLOTS_KEY = 'mine-slots';
  // THREE, because that is what `renderMine()` actually draws — it slices to 3.
  // Reserving two left the third card to arrive as a 175px jump, which is the
  // same defect in miniature. A customer who owns three eSIMs is going to see
  // three cards; holding the space for them is honest, not wasteful.
  const MINE_SLOTS_MAX = 3;

  function reserveMineSpace() {
    const mine = $('#home-mine');
    // Never over a live search — the block is hidden there on purpose.
    if (state.query || state.esims.length) return;

    const cached = cache.read(MINE_SLOTS_KEY);
    const slots = Math.min(MINE_SLOTS_MAX, Math.max(0, Number(cached && cached.value) || 0));
    if (!slots) return;

    clear(mine);
    mine.appendChild(el('h2', { class: 'section', text: 'Мои eSIM' }));
    for (let i = 0; i < slots; i += 1) mine.appendChild(el('div', { class: 'skel skel--esim' }));
  }

  async function renderMine() {
    const mine = $('#home-mine');
    if (!state.ready) {
      // No session, so no owned block is coming. Anything reserved for one must
      // go, or the placeholder becomes a permanent grey box.
      clear(mine);

      return;
    }

    try {
      const own = await api.esims();
      state.esims = own.items || [];
      cache.write(MINE_SLOTS_KEY, Math.min(MINE_SLOTS_MAX, state.esims.length));
    } catch {
      clear(mine);

      return;
    }

    clear(mine);
    // The session can land mid-search — it takes seconds on a cold gateway —
    // and this block must not reappear over the results when it does. The query
    // is the authority, read here rather than remembered from when the request
    // went out.
    mine.classList.toggle('is-hidden', Boolean(state.query));
    if (!state.esims.length) return;

    // `.section`, the same heading idiom «Популярные направления» uses eight
    // pixels below it. It was a bare `h2` — 17px, 650, full ink — against the
    // catalogue's 15px, 600, muted, so one screen carried two typographic
    // systems for the same kind of thing. The block's position already makes it
    // the first thing read; the heading does not also have to shout.
    mine.appendChild(el('h2', { class: 'section', text: 'Мои eSIM' }));
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
      // «от» stays muted and small while the number takes reading weight: it is
      // a qualifier on the price, not part of it. Same string, same order, same
      // C.money() — only the emphasis moved.
      g.from === null
        ? el('span', { class: 'tile__from' })
        : el('span', { class: 'tile__from tabular' }, [
            el('span', { class: 'tile__prefix', text: 'от ' }),
            el('span', { text: C.money(g.from) }),
          ]),
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

    /*
     * While searching, the owned-eSIM block gets out of the way.
     *
     * `#home-mine` sits ABOVE `#home-countries` and this function only ever
     * cleared the latter, so typing «Таиланд» left the heading plus up to three
     * cards — measured at 172px — wedged between the field and the answer, and
     * the first match landed at y=456 on an 844px screen. The customer had to
     * scroll past what they already own to see what they were looking for.
     *
     * Hidden, not emptied: the block is rebuilt by `renderMine()` on its own
     * schedule, and clearing it here would race that. `clearSearch()` and every
     * other route back to an empty query comes through this function, so there
     * is one place that decides.
     */
    $('#home-mine').classList.toggle('is-hidden', Boolean(q));
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

    // §9 S3: a tariff card opens the tariff, not the payment form. Going
    // straight to checkout skipped the one screen whose job is to answer
    // "will this work on my phone, and what am I actually buying".
    return el('button', { class: 'card stack card--tariff', onclick: () => openTariff(p, group) }, [
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

  /** The two axes a tariff list is read along: what it costs, and how much. */
  function sortToggle(group) {
    const box = el('div', { class: 'segmented segmented--sort', role: 'radiogroup' });
    for (const [key, spec] of Object.entries(C.TARIFF_SORTS)) {
      box.appendChild(el('button', {
        class: 'segmented__opt',
        'data-sort': key,
        role: 'radio',
        'aria-checked': String(state.sort === key),
        text: spec.label,
        onclick: () => {
          if (state.sort === key) return;
          state.sort = key;
          // Redrawn in place: re-entering the screen would push a second copy
          // onto the back stack and make BackButton feel broken.
          openCountry(group, { push: false });
        },
      }));
    }

    return box;
  }

  function openCountry(group, { push = true } = {}) {
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

    // §9 S2: price ascending by default, with a switch to volume. Only worth
    // drawing when there is something to reorder — two cards sort themselves.
    if (group.items.length > 2) list.appendChild(sortToggle(group));

    for (const p of C.sortTariffs(group.items, state.sort)) {
      list.appendChild(tariffCard(p, group));
    }

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

    show('country', { push });
  }

  /**
   * Top-up options for one eSIM.
   *
   * Deliberately quiet about failure. This is an extra on a screen whose job
   * is showing an eSIM the customer already owns: if discovery is unavailable,
   * or the eSIM has no compatible top-up, or the provider does not support one,
   * the right outcome is the screen the customer came for — not an error about
   * a feature they may not have been looking for.
   */
  async function renderTopups(esimId) {
    const box = $('#esim-topup');
    if (!box) return;
    clear(box);

    // A top-up already under way outranks the option list. Offering options
    // while one is in flight offers something the server will refuse — and,
    // worse, invites a customer who has already paid to pay again.
    const pending = readPendingTopup();
    if (pending) {
      box.appendChild(el('button', {
        class: 'btn btn--wide',
        text: 'Показать статус пополнения',
        onclick: () => { void showTopupStatus(pending); },
      }));
    }

    let out = null;
    try {
      out = await api.topups(esimId);
    } catch {
      return;   // silent: see above
    }
    if (!out || out.topup_available !== true) {
      // `in_progress` is not an absence of options — it is one already running.
      if (out && out.in_progress && !pending) {
        box.appendChild(el('p', { class: 'small muted', text:
          'Пополнение этой eSIM уже выполняется. Дождитесь результата.' }));
      }

      return;
    }

    const options = Array.isArray(out.topup_options) ? out.topup_options : [];
    if (!options.length) return;

    box.appendChild(el('button', {
      class: 'btn btn--ghost',
      text: 'Пополнить',
      onclick: () => openTopupOptions(esimId, out),
    }));
  }

  /**
   * The options, and an honest statement about what can be done with them.
   *
   * `purchase_enabled` comes from the server and is the only thing that decides
   * whether a payment CTA is drawn. The client does not hold that switch, and
   * could not usefully lie about it — the write routes are closed at the
   * gateway regardless.
   */
  function openTopupOptions(esimId, discovery) {
    const box = $('#esim-topup');
    clear(box);

    const list = el('div', { class: 'stack' }, [
      el('h2', { class: 'section', text: 'Пополнить eSIM' }),
      ...discovery.topup_options.map((o) => optionCard(esimId, discovery, o)),
    ]);

    if (discovery.purchase_enabled !== true) {
      list.appendChild(el('p', { class: 'small muted', text:
        'Пополнение скоро заработает. Пока можно посмотреть, что будет доступно для этой eSIM.' }));
    }

    list.appendChild(el('button', {
      class: 'btn btn--quiet', text: 'Скрыть', onclick: () => renderTopups(esimId),
    }));
    box.appendChild(list);
  }

  /**
   * One option, tappable only when the SERVER says buying is open.
   *
   * `purchase_enabled` is the only thing that decides. The client does not hold
   * that switch and could not usefully lie about it: the write routes refuse on
   * two server-side flags and the gateway forwards nothing else.
   */
  function optionCard(esimId, discovery, o) {
    const body = el('span', { class: 'card__body' }, [
      el('span', { class: 'card__title', text: o.data_gb ? `${o.data_gb} ГБ` : 'Пакет' }),
      el('span', {
        class: 'card__meta',
        text: o.validity_days
          ? `+${o.validity_days} ${C.plural(o.validity_days, 'день', 'дня', 'дней')}`
          : '',
      }),
    ]);
    const price = el('strong', { class: 'card__price tabular', text: C.money(o.price_rub) });

    if (discovery.purchase_enabled !== true) {
      return el('div', { class: 'card row row--between topup-opt' }, [body, price]);
    }

    return el('button', {
      class: 'card row row--between topup-opt',
      onclick: () => openTopupCheckout(esimId, o),
    }, [body, price]);
  }

  /* ------------------------------------------------------------------ *
   * Top-up checkout — вариант → способ оплаты → условия → Оплатить
   * ------------------------------------------------------------------ */

  /**
   * The three things a customer chooses, and nothing else.
   *
   * There is no field here for a price, a package or an ICCID, and there is
   * nowhere to put one: the quote call carries an OPAQUE option id and the
   * server re-derives everything else from a live provider list. What the
   * customer sees is what the server priced a moment ago; if it moved, the
   * quote is refused rather than sold at the old number.
   */
  function openTopupCheckout(esimId, option) {
    const box = $('#esim-topup');
    clear(box);

    // §9 S4, and the same default as the eSIM checkout: СБП unless the customer
    // deliberately chooses a card.
    const choice = { payment_type: 'sbp', terms_accepted: false };

    const err = el('div', { class: 'stack' });
    const pay = el('button', { class: 'btn btn--wide', disabled: true, text: `Оплатить ${C.money(option.price_rub)}` });

    const methodButton = (type, label) => el('button', {
      class: 'btn btn--quiet topup-method',
      'data-method': type,
      'aria-pressed': String(choice.payment_type === type),
      text: label,
      onclick: () => {
        choice.payment_type = type;
        for (const b of box.querySelectorAll('.topup-method')) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-method') === type));
        }
      },
    });

    const terms = el('input', { type: 'checkbox', id: 'topup-terms' });
    // Never checked by default. §9 S4 and §14.6: acceptance is an act, and a
    // pre-ticked box is expressly not one. The storefront has shipped that bug.
    terms.checked = false;
    terms.addEventListener('change', () => {
      choice.terms_accepted = Boolean(terms.checked);
      pay.disabled = !choice.terms_accepted;
    });

    pay.addEventListener('click', () => payTopup(esimId, option, choice, { pay, err }));

    box.appendChild(el('div', { class: 'stack' }, [
      el('h2', { class: 'section', text: 'Пополнение eSIM' }),
      el('div', { class: 'card stack' }, [
        el('div', { class: 'row row--between' }, [
          el('span', { text: option.data_gb ? `${option.data_gb} ГБ` : 'Пакет' }),
          el('strong', { class: 'tabular', text: C.money(option.price_rub) }),
        ]),
        option.validity_days
          ? el('p', { class: 'small muted', text:
            `Срок действия: ${option.validity_days} ${C.plural(option.validity_days, 'день', 'дня', 'дней')}` })
          : el('span'),
        el('p', { class: 'small muted', text: 'Пакет добавится к этой eSIM. Новая eSIM не выпускается.' }),
      ]),
      el('h3', { class: 'section', text: 'Способ оплаты' }),
      el('div', { class: 'row' }, [
        methodButton('sbp', 'СБП'),
        methodButton('card', 'Банковская карта'),
      ]),
      el('label', { class: 'row topup-terms-row' }, [
        terms,
        el('span', { class: 'small' }, [
          document.createTextNode('Я принимаю '),
          el('a', {
            href: '#', text: 'условия оферты',
            onclick: (e) => { e.preventDefault(); openExternal('https://magicesim.store/terms.html'); },
          }),
        ]),
      ]),
      err,
      pay,
      el('button', { class: 'btn btn--quiet', text: 'Назад', onclick: () => renderTopups(esimId) }),
    ]));
  }

  /**
   * Quote, then pay.
   *
   * Two calls behind one tap, and the split is the server's contract rather
   * than a UI choice: the quote prices the option against a LIVE provider list
   * and mints the intent; the checkout turns that intent into a payment. The
   * app never sees a package code, a provider or a cost in either direction.
   */
  async function payTopup(esimId, option, choice, { pay, err }) {
    clear(err);

    if (choice.terms_accepted !== true) {
      err.appendChild(errorNotice('Примите условия, чтобы продолжить.'));

      return;
    }

    // The guard against the second tap. The server makes a repeat safe — the
    // intent owns at most one order and one payment — but disabling the button
    // is what stops the customer having to find that out.
    pay.disabled = true;
    clear(pay);
    pay.appendChild(el('span', { class: 'btn__spinner' }));
    pay.appendChild(document.createTextNode('Готовим оплату…'));
    haptic('medium');

    let intent = null;
    try {
      intent = await api.topupQuote(esimId, {
        option_id: option.option_id,
        payment_type: choice.payment_type,
        terms_accepted: choice.terms_accepted === true,
      });
    } catch (e) {
      resetPayButton(pay, option);
      err.appendChild(errorNotice(topupErrorText(e)));

      return;
    }

    // Kept BEFORE leaving for payment, so a return that lands anywhere resumes
    // THIS top-up instead of starting another. The token is not a bearer — the
    // status route authorises by the session and this only says which of the
    // caller's own intents to read — so keeping it whole is safe, and keeping
    // it is what makes «не создавать новый» true rather than hoped for.
    rememberPendingTopup(intent.public_token);

    let checkout = null;
    try {
      checkout = await api.topupCheckout(intent.public_token);
    } catch (e) {
      resetPayButton(pay, option);
      if (e && e.code === 'TOPUP_CHECKOUT_IN_PROGRESS') {
        // Another tap is already creating the payment. Not an error, and above
        // all not a reason to ask for a second one.
        await showTopupStatus(intent.public_token);

        return;
      }
      err.appendChild(errorNotice(topupErrorText(e)));

      return;
    }

    if (checkout.redirect_url) {
      // The destination is checked before the customer is sent to it. Refusing
      // is safe: the intent and its order already exist on the server, so
      // nothing is lost, and the status screen below shows where it stands.
      if (!C.isAllowedPaymentUrl(checkout.redirect_url)) {
        err.appendChild(errorNotice(
          'Не удалось открыть безопасную страницу оплаты. Пополнение сохранено — напишите нам, и мы поможем его завершить.'
        ));
        resetPayButton(pay, option);
      } else {
        openExternal(checkout.redirect_url);
      }
    }

    await showTopupStatus(intent.public_token);
  }

  function resetPayButton(pay, option) {
    pay.disabled = false;
    clear(pay);
    pay.appendChild(document.createTextNode(`Оплатить ${C.money(option.price_rub)}`));
  }

  /**
   * A refusal, in words a customer can act on.
   *
   * A closed map. The server already speaks a closed vocabulary and sends its
   * own Russian sentence; this exists so a code THIS build does not know still
   * produces something useful, and so nothing technical is ever echoed.
   */
  function topupErrorText(e) {
    const code = (e && e.code) || '';
    if (code === 'TOPUP_PURCHASE_DISABLED' || code === 'TOPUP_PROVIDER_DISABLED') {
      return 'Пополнение пока недоступно.';
    }
    if (code === 'TOPUP_IN_PROGRESS') return 'Одно пополнение этой eSIM уже выполняется. Дождитесь результата.';
    if (code === 'TOPUP_QUOTE_EXPIRED' || code === 'OPTION_STALE') {
      return 'Этот вариант больше не актуален. Выберите его заново.';
    }
    if (code === 'TERMS_REQUIRED') return 'Примите условия, чтобы продолжить.';
    if (e && e.isTransport) {
      return 'Связь прервалась. Повторите — лишнего пополнения не создастся.';
    }

    return (e && e.message) || 'Не удалось начать пополнение.';
  }

  /* ------------------------------------------------------------------ *
   * Top-up status
   * ------------------------------------------------------------------ */

  const PENDING_TOPUP_KEY = 'mesim.pending_topup';

  function rememberPendingTopup(token) {
    try { if (token) storage.setItem(PENDING_TOPUP_KEY, String(token)); }
    catch { /* private mode: «Мои eSIM» still shows the result */ }
  }

  function readPendingTopup() {
    try { return storage.getItem(PENDING_TOPUP_KEY) || null; } catch { return null; }
  }

  function clearPendingTopup() {
    try { storage.removeItem(PENDING_TOPUP_KEY); } catch { /* */ }
  }

  /**
   * The same bounded schedule S6 uses, and for the same reasons: often at
   * first, then slowly, then a manual refresh rather than an unbounded poll.
   */
  const TOPUP_POLL_MS = Object.freeze([
    ...Array.from({ length: 10 }, () => 3000),   // 30 s
    ...Array.from({ length: 27 }, () => 10000),  // to 5 min
  ]);

  let topupPollTimer = null;

  function stopTopupPoll() {
    if (topupPollTimer) { clearTimeout(topupPollTimer); topupPollTimer = null; }
  }

  /**
   * Where the top-up stands, asked of the server and only of the server.
   *
   * Coming back from the payment browser proves nothing. The return URL carries
   * no payment claim and this screen makes none: it re-asks under the app's own
   * session and renders what the server says.
   */
  async function showTopupStatus(publicToken) {
    stopTopupPoll();
    state.topupToken = publicToken;
    show('topup', { push: true });

    let attempt = 0;

    async function tick() {
      let out = null;
      try {
        out = await api.topupStatus(publicToken);
      } catch (e) {
        renderTopupStatusError(e, publicToken);
        // A read that failed is not a top-up that failed. Keep asking.
        if (attempt < TOPUP_POLL_MS.length) {
          topupPollTimer = setTimeout(tick, TOPUP_POLL_MS[attempt]);
          attempt += 1;
        }

        return;
      }

      state.lastTopup = out;
      renderTopupStatus(out);

      if (C.isTopupFinal(out)) {
        stopTopupPoll();
        clearPendingTopup();
        if (C.isTopupDone(out)) {
          notifySuccess();
          // The eSIM's own numbers move on the provider's schedule, not ours.
          // Refreshing quietly means «Мои eSIM» is right when the customer gets
          // there, and a stale reading is never presented as a failed top-up.
          await refreshEsimsQuietly();
        }

        return;
      }

      if (attempt < TOPUP_POLL_MS.length) {
        topupPollTimer = setTimeout(tick, TOPUP_POLL_MS[attempt]);
        attempt += 1;
      }
    }

    // Coming back from the payment browser is the moment the answer is most
    // likely to have changed and the schedule most likely to have run out.
    resumeOnReturn = () => {
      if (state.screen !== 'topup') return;
      if (state.lastTopup && C.isTopupFinal(state.lastTopup)) return;
      stopTopupPoll();
      attempt = 0;
      void tick();
    };

    $('#topup-title').textContent = 'Пополнение';
    clear($('#topup-body'));
    $('#topup-body').appendChild(skeletonCards(1));
    await tick();
  }

  /**
   * What the customer reads.
   *
   * The server's own words, because it owns the state machine and its
   * vocabulary is provider-neutral by construction. Nothing technical is drawn:
   * no provider, no package code, no error class, no attempt count — the status
   * body does not contain any of them, and a test asserts that.
   */
  function renderTopupStatus(out) {
    const body = $('#topup-body');
    clear(body);

    const title = C.topupStatusText(out);
    $('#topup-title').textContent = title;

    const card = el('div', { class: 'card stack' }, [
      el('strong', { class: 'card__title', text: title }),
      out.status_detail ? el('p', { class: 'small muted', text: out.status_detail }) : el('span'),
    ]);

    if (out.data_gb || out.price_rub) {
      card.appendChild(el('div', { class: 'row row--between small muted' }, [
        el('span', { text: out.data_gb ? `${out.data_gb} ГБ` : 'Пакет' }),
        el('span', { class: 'tabular', text: out.price_rub ? C.money(out.price_rub) : '' }),
      ]));
    }
    body.appendChild(card);

    // Still payable: the way back to the payment page, from the server's own
    // link and never from anything this screen invented.
    if (out.status === 'awaiting_payment' && out.payment_url && C.isAllowedPaymentUrl(out.payment_url)) {
      body.appendChild(el('button', {
        class: 'btn btn--wide', text: 'Перейти к оплате',
        onclick: () => openExternal(out.payment_url),
      }));
    }

    if (out.status === 'completed') {
      body.appendChild(el('button', {
        class: 'btn btn--wide', text: 'К моим eSIM',
        onclick: () => { void renderEsims(); show('esims'); },
      }));
    }

    if (out.status === 'needs_review' || out.status === 'refund_pending') {
      // The same button the order screen uses, so there is one support route
      // and one bot username rather than two that can drift. It carries no
      // order ref: a top-up has no public order token the customer holds, and
      // the operator finds the intent from the customer's own account.
      body.appendChild(supportButton(null));
    }

    if (!C.isTopupFinal(out)) {
      body.appendChild(el('button', {
        class: 'btn btn--quiet', text: 'Обновить',
        onclick: () => { void showTopupStatus(out.public_token); },
      }));
    }
  }

  /**
   * The read failed. Deliberately says nothing about the top-up itself.
   *
   * A gateway that will not answer tells us nothing about whether a payment was
   * taken or a top-up applied, and saying otherwise in either direction is the
   * mistake this screen exists to avoid.
   */
  function renderTopupStatusError(e, publicToken) {
    const body = $('#topup-body');
    clear(body);
    $('#topup-title').textContent = 'Проверяем состояние пополнения';

    if (e && e.status === 404) {
      clearPendingTopup();
      body.appendChild(el('p', { class: 'muted', text: 'Это пополнение не найдено.' }));
      body.appendChild(el('button', {
        class: 'btn btn--wide', text: 'К моим eSIM',
        onclick: () => { void renderEsims(); show('esims'); },
      }));

      return;
    }

    body.appendChild(el('p', { class: 'muted', text:
      'Не удалось связаться с сервером. Это ничего не говорит об оплате: '
      + 'если она прошла, пополнение уже принято. Повторно платить не нужно.' }));
    body.appendChild(el('button', {
      class: 'btn btn--wide', text: 'Проверить ещё раз',
      onclick: () => { void showTopupStatus(publicToken); },
    }));
  }

  /* ------------------------------------------------------------------ *
   * S11 · Помощь — answer what can be answered, hand over the rest
   * ------------------------------------------------------------------ */

  /**
   * §9 S11: «Mini App не содержит собственного чата.»
   *
   * The bot already has AI answers, escalation to a live operator and an
   * operator-reply bridge. Rebuilding any of that here would be a second,
   * worse channel. So this screen does two things the bot cannot do better:
   * it answers the handful of questions that need no person at all, and it
   * hands over the ones that do — with the customer's order already named, so
   * nobody has to re-describe what they bought.
   *
   * Deliberately session-free. The customer most likely to open it is the one
   * whose session just failed.
   */
  const HELP_TOPICS = Object.freeze([
    {
      q: 'Как установить eSIM?',
      a: 'Откройте «Мои eSIM» → нужную eSIM → «Установка и QR». Там есть QR-код, '
        + 'пошаговая инструкция для вашего телефона и поля для ручного ввода.',
    },
    {
      q: 'Подойдёт ли мой телефон?',
      a: 'iPhone: Настройки → Сотовая связь. Android: настройки SIM-карт. Если есть '
        + '«Добавить eSIM» или «Загрузить SIM» — подойдёт. Телефон не должен быть '
        + 'заблокирован под одного оператора.',
    },
    {
      q: 'Когда начнётся срок действия?',
      a: 'Зависит от тарифа — точная формулировка указана в карточке тарифа в строке '
        + '«Начало срока». Чаще всего отсчёт идёт с первого подключения к сети за границей.',
    },
    {
      q: 'Оплатил, но eSIM не появилась',
      a: 'Обычно выпуск занимает меньше минуты. Статус заказа виден сразу после оплаты, '
        + 'и мы продублируем eSIM письмом на указанную почту. Если прошло больше '
        + 'нескольких минут — напишите нам, заказ уже у нас и никуда не денется.',
    },
    {
      q: 'Интернет не работает за границей',
      a: 'Проверьте, что для eSIM включён роуминг данных и что она выбрана как линия '
        + 'для сотовых данных. Помогает также выбор сети вручную в настройках оператора.',
    },
    {
      q: 'Можно ли вернуть деньги?',
      a: 'Если eSIM не была установлена и не использовалась — напишите нам, разберёмся '
        + 'индивидуально. Условия описаны в оферте.',
    },
  ]);

  function renderHelp() {
    const box = $('#help-body');
    clear(box);

    box.appendChild(el('p', { class: 'muted', text:
      'Ответы на частые вопросы — здесь. Всё остальное — живому человеку в поддержке.' }));

    box.appendChild(el('div', { class: 'stack' },
      HELP_TOPICS.map((t) => el('details', { class: 'card sheet' }, [
        el('summary', { class: 'sheet__head', text: t.q }),
        el('p', { class: 'small', text: t.a }),
      ]))));

    box.appendChild(el('h2', { class: 'section', text: 'Инструкции по установке' }));
    box.appendChild(el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn--quiet', text: 'Для iPhone',
        onclick: () => openExternal('https://magicesim.store/iphone.html'),
      }),
      el('button', {
        class: 'btn btn--quiet', text: 'Для Android',
        onclick: () => openExternal('https://magicesim.store/android.html'),
      }),
    ]));

    box.appendChild(el('h2', { class: 'section', text: 'Не нашли ответ?' }));
    // The order ref rides along when there is one, so the operator opens the
    // conversation already knowing which purchase it is about.
    box.appendChild(supportButton(state.lastOrder || null));

    box.appendChild(el('div', { class: 'stack gap-top-lg' }, [
      el('button', {
        class: 'btn btn--quiet', text: 'Оферта',
        onclick: () => openExternal('https://magicesim.store/terms.html'),
      }),
      el('button', {
        class: 'btn btn--quiet', text: 'Политика конфиденциальности',
        onclick: () => openExternal('https://magicesim.store/privacy.html'),
      }),
    ]));
  }

  /* ------------------------------------------------------------------ *
   * S3 · Tariff detail — the last doubts, before the money
   * ------------------------------------------------------------------ */

  /**
   * Answered entirely from the package already in memory.
   *
   * §9 S3 is explicit that this screen makes NO request: the list the customer
   * just tapped holds every field, and a spinner between a price and a buy
   * button is a reason to leave.
   */
  function openTariff(p, group) {
    state.tariff = { pkg: p, group };
    show('tariff');
    const box = $('#tariff-body');
    clear(box);

    const days = Number(p.validity_days);
    const title = (group && group.country)
      || C.destinationTitle(p.name, p.country_code);

    // 1. Header — what, how much, for how long, for how many.
    box.appendChild(el('div', { class: 'card stack' }, [
      el('div', { class: 'row' }, [
        el('span', { class: 'card__flag', text: C.flagFor(p.country_code, p) }),
        el('h1', { text: title }),
      ]),
      el('div', { class: 'row row--between' }, [
        el('span', { class: 'card__title', text: p.unlimited ? 'Безлимит' : `${p.data_gb} ГБ` }),
        el('strong', { class: 'card__price tabular', text: C.money(p.price) }),
      ]),
      el('div', {
        class: 'card__meta',
        text: `${days} ${C.plural(days, 'день', 'дня', 'дней')}`,
      }),
    ]));

    // 2 & 3. Coverage and characteristics — the same sheet the site shows, in
    // the same order and under the same labels («Покрытие и условия»).
    const coverage = Array.isArray(p.coverage_country_codes) ? p.coverage_country_codes : [];
    const facts = C.tariffFacts(p);
    if (facts.length) {
      box.appendChild(el('div', { class: 'card stack' }, [
        el('h2', { class: 'section', text: 'Покрытие и условия' }),
        el('div', { class: 'row row--between fact' }, [
          el('span', { class: 'muted', text: 'Покрытие' }),
          el('span', { class: 'fact__value', text: C.coverageSummary(p) }),
        ]),
        ...facts.map((f) => el('div', { class: 'row row--between fact' }, [
          el('span', { class: 'muted', text: f.label }),
          el('span', { class: 'fact__value', text: f.value }),
        ])),
      ]));
    }

    // The full country list for a regional pack, one tap under the summary: a
    // customer buying «Европа» has to be able to find their own destination.
    if (coverage.length > 1) box.appendChild(coverageBlock(coverage));

    // 4. Compatibility — a sheet that opens in place. §9 S3 and decision Р6:
    // «Отдельный экран не создаётся, S12 упразднён.»
    box.appendChild(compatibilitySheet());

    // 5. What happens after payment — three lines, so the next twenty minutes
    // hold no surprises.
    box.appendChild(el('div', { class: 'card stack' }, [
      el('h2', { class: 'section', text: 'Что будет после оплаты' }),
      ...C.AFTER_PAYMENT_STEPS.map((t, i) => el('div', { class: 'row step' }, [
        el('span', { class: 'step__n', text: String(i + 1) }),
        el('span', { class: 'small', text: t }),
      ])),
    ]));

    box.appendChild(el('button', {
      class: 'btn btn--wide',
      text: `Купить за ${C.money(p.price)}`,
      onclick: () => openCheckout(p, group),
    }));
  }

  /** The countries a regional pack covers, named and flagged like everywhere else. */
  function coverageBlock(codes) {
    const names = codes
      .map((c) => ({ code: c, name: C.countryLabel(c), flag: C.flagFor(c) }))
      // A code with no Russian name is dropped rather than shown raw: the list
      // is reassurance, and an unreadable entry is the opposite of that.
      .filter((x) => x.name !== String(x.code).toUpperCase())
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    const body = el('div', { class: 'chips' },
      names.map((x) => el('span', { class: 'chip', text: `${x.flag} ${x.name}` })));

    return el('details', { class: 'card sheet' }, [
      el('summary', { class: 'sheet__head', text: `Покрытие · ${C.countryWord(codes.length)}` }),
      names.length
        ? body
        : el('p', { class: 'small muted', text: `Тариф действует в ${C.countryWord(codes.length)}.` }),
    ]);
  }

  /**
   * «Подойдёт ли мой телефон» — the sheet, not a screen.
   *
   * The wording is the site's own (iphone.html / android.html), shortened to
   * the check a customer can make in thirty seconds. Both pages are linked for
   * the rest, because they are maintained and this is not a place to grow a
   * second, staler copy of them (P8).
   */
  function compatibilitySheet() {
    return el('details', { class: 'card sheet' }, [
      el('summary', { class: 'sheet__head', text: 'Подойдёт ли мой телефон' }),
      el('p', { class: 'small', text:
        'iPhone: Настройки → Сотовая связь. Если есть «Добавить eSIM» — телефон подходит.' }),
      el('p', { class: 'small', text:
        'Android: настройки SIM-карт. Пункт «Добавить eSIM» или «Загрузить SIM» означает то же самое.' }),
      el('p', { class: 'small muted', text:
        'Поддержка зависит и от региональной версии устройства, поэтому проверка в настройках надёжнее списка моделей. Телефон не должен быть заблокирован под одного оператора.' }),
      el('div', { class: 'row' }, [
        el('button', {
          class: 'btn btn--quiet', text: 'Инструкция для iPhone',
          onclick: () => openExternal('https://magicesim.store/iphone.html'),
        }),
        el('button', {
          class: 'btn btn--quiet', text: 'Для Android',
          onclick: () => openExternal('https://magicesim.store/android.html'),
        }),
      ]),
    ]);
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
  function startParam() {
    try {
      return String((tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || '');
    } catch { return ''; }
  }

  function launchOrderRef() {
    const m = /^o_([A-Za-z0-9_-]{4,16})$/.exec(startParam());
    if (m) return m[1];

    return readPendingOrder();
  }

  /**
   * `startapp=e_<ref>` — «this person tapped the button in their eSIM email».
   *
   * The same kind of thing `o_` is and nothing more: six characters of a PUBLIC
   * order token, which the server has to agree belong to this customer before
   * they mean anything. It cannot assert a purchase, cannot name somebody
   * else's eSIM, and is discarded when it matches nothing this session owns.
   *
   * `startapp=esims` is the same arrival with no usable ref — the email had no
   * order token to shorten — and lands on the list rather than nowhere.
   *
   * WHY IT IS SAFE TO ACT ON AT ALL: acting on it means choosing a SCREEN. The
   * eSIM behind that screen still comes from `GET /tma/esims`, which is scoped
   * to the customer id of a verified Telegram session. Forward the mail to
   * anybody and the link opens their app, their own list, and the offer to
   * prove a mailbox they do not have.
   */
  function launchFromEmail() {
    const param = startParam();
    if (param === 'esims') return { fromEmail: true, ref: null };

    const m = /^e_([A-Za-z0-9_-]{4,16})$/.exec(param);

    return m ? { fromEmail: true, ref: m[1] } : null;
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
      // §9 S8: «Не «нет данных», а два предложения» — begin a first purchase,
      // AND connect the ones already made on the site. Both are real now: the
      // second used to be a support handover because the three endpoints it
      // needs did not exist.
      list.appendChild(el('div', { class: 'empty' }, [
        el('p', { text: 'Пока нет ни одной eSIM.' }),
        el('button', { class: 'btn', text: 'Выбрать тариф', onclick: () => show('home') }),
        el('p', { class: 'small muted', text: 'Покупали на сайте? Подключите те покупки сюда.' }),
        el('button', { class: 'btn btn--ghost', text: 'Добавить покупки с сайта', onclick: openClaim }),
      ]));
      // Somebody who hid ALL of their eSIMs has an empty main list and is
      // exactly the person who needs the hidden section most. Returning here
      // without it would tell them they own nothing.
      await renderHiddenEsims(list);

      return;
    }
    for (const e of state.esims) list.appendChild(esimCard(e));

    // The same door, kept small for somebody who already has eSIMs here: they
    // may still have older ones bought on the site.
    list.appendChild(el('button', {
      class: 'btn btn--quiet gap-top-lg',
      text: 'Добавить покупки с сайта',
      onclick: openClaim,
    }));

    await renderHiddenEsims(list);
  }

  /**
   * The eSIMs the customer put aside.
   *
   * DRAWN ONLY WHEN THERE ARE ANY. An empty «Скрытые eSIM» heading on every
   * visit would be a permanent reminder of a feature most people will never
   * use — and it would be the second heading on a screen whose first one is the
   * point.
   *
   * Best-effort: a failure here leaves the main list exactly as it was. Nothing
   * on this screen depends on the answer.
   */
  async function renderHiddenEsims(list) {
    let items = [];
    try {
      items = ((await api.hiddenEsims()) || {}).items || [];
    } catch { return; }
    if (!items.length) return;

    list.appendChild(el('h2', { class: 'section', text: 'Скрытые eSIM' }));
    list.appendChild(el('p', { class: 'small muted', text:
      'Они работают как обычно и не показываются в списке выше. Откройте, чтобы вернуть.' }));
    for (const e of items) list.appendChild(esimCard(e));
  }

  /* ------------------------------------------------------------------ *
   * S13 · Purchases made on the website
   *
   * The words a customer reads are the customer's: an address they used, a
   * code we sent, purchases we found. Nothing says "identity", "link",
   * "customer" or "order token" — those are our words for our problem.
   * ------------------------------------------------------------------ */

  function openClaim() {
    show('claim');
    paintClaimEmail();
  }

  const claimBox = () => $('#claim-body');

  const claimNotice = (text, bad) =>
    el('div', { class: bad ? 'notice notice--bad' : 'notice' }, [el('span', { text })]);

  function setBusy(btn, busy, text) {
    btn.disabled = busy;
    clear(btn);
    if (busy) btn.appendChild(el('span', { class: 'btn__spinner' }));
    btn.appendChild(el('span', { text }));
  }

  function paintClaimEmail(prefill = '', error = null) {
    const box = claimBox();
    clear(box);
    $('#claim-title').textContent = 'Покупки с сайта';

    box.appendChild(el('p', { class: 'muted', text:
      'Подключим покупки, сделанные на magicesim.store. Отправим код на вашу почту — так мы убедимся, что адрес ваш.' }));

    // Every assist off: a field that autocapitalises and autocorrects an email
    // is a field that fights the customer on a phone.
    const input = el('input', {
      id: 'claim-email', class: 'input', type: 'email', value: prefill,
      placeholder: 'адрес, который вы указывали при покупке',
      autocomplete: 'email', autocapitalize: 'none', autocorrect: 'off',
      spellcheck: 'false', inputmode: 'email',
    });
    box.appendChild(input);
    if (error) box.appendChild(claimNotice(error, true));

    const send = el('button', { class: 'btn btn--wide' });
    setBusy(send, false, 'Отправить код');
    send.addEventListener('click', async () => {
      const email = String(input.value || '').trim();
      if (!/.+@.+\..+/.test(email)) { paintClaimEmail(email, 'Похоже, в адресе опечатка.'); return; }

      setBusy(send, true, 'Отправляем…');
      let out = null;
      try {
        out = await api.requestEmailCode(email);
      } catch { /* the server answers the same way regardless; move on */ }
      setBusy(send, false, 'Отправить код');

      // Already theirs. The server sent no code — it re-checked their purchases
      // instead — so sending them to the code screen would be a wait with no
      // end. Show what actually happened and refresh the list behind it.
      if (out && out.status === 'already_verified') {
        await refreshEsimsQuietly();
        paintClaimAlreadyVerified(email);
        return;
      }

      paintClaimCode(email);
    });
    box.appendChild(send);
  }

  /**
   * The address was already proven by this customer.
   *
   * No code, no second proof, no dead end. The server re-ran the link when it
   * answered, so by the time this paints, «Мои eSIM» already holds anything
   * that address covers — which is why the list is refreshed BEFORE this shows
   * rather than after the customer taps through to it.
   */
  function paintClaimAlreadyVerified(email) {
    const box = claimBox();
    clear(box);
    $('#claim-title').textContent = 'Адрес уже подтверждён';

    box.appendChild(claimNotice('Этот адрес уже подтверждён. Мы обновили список ваших покупок.'));
    box.appendChild(el('p', { class: 'small muted', text: email }));
    box.appendChild(el('p', { class: 'small muted', text:
      'Покупки с этого адреса добавляются сами — подтверждать его заново не нужно.' }));

    box.appendChild(el('button', {
      class: 'btn btn--wide', text: 'Открыть «Мои eSIM»',
      onclick: () => { show('esims'); renderEsims(); },
    }));
    box.appendChild(el('button', {
      class: 'btn btn--quiet', text: 'Указать другой адрес',
      onclick: () => paintClaimEmail(''),
    }));
  }

  function paintClaimCode(email, error = null, attemptsLeft = null) {
    const box = claimBox();
    clear(box);
    $('#claim-title').textContent = 'Введите код';

    box.appendChild(el('p', { class: 'muted', text:
      'Если этот адрес использовался при покупке, мы отправили на него код. Он действует 10 минут.' }));
    box.appendChild(el('p', { class: 'small muted', text: email }));

    // `one-time-code` lets iOS and Android offer the code straight from the
    // notification; `inputmode: numeric` shows digits rather than a keyboard.
    const input = el('input', {
      id: 'claim-code', class: 'input input--code', type: 'text',
      placeholder: '000000', maxlength: '6', inputmode: 'numeric',
      pattern: '[0-9]*', autocomplete: 'one-time-code',
      autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false',
    });
    box.appendChild(input);

    if (error) box.appendChild(claimNotice(error, true));
    if (attemptsLeft != null && attemptsLeft > 0) {
      box.appendChild(el('p', { class: 'small muted', text: `Осталось попыток: ${attemptsLeft}` }));
    }

    const confirm = el('button', { class: 'btn btn--wide' });
    setBusy(confirm, false, 'Подтвердить');
    confirm.addEventListener('click', async () => {
      const code = String(input.value || '').replace(/\D/g, '');
      if (code.length !== 6) { paintClaimCode(email, 'Код состоит из шести цифр.'); return; }

      setBusy(confirm, true, 'Проверяем…');
      let out = null;
      try {
        out = await api.confirmEmailCode(email, code);
      } catch (err) {
        setBusy(confirm, false, 'Подтвердить');
        const body = (err && err.body) || {};
        paintClaimCode(email, body.message || 'Не удалось проверить код. Попробуйте ещё раз.', body.attempts_left);
        return;
      }
      setBusy(confirm, false, 'Подтвердить');

      // The list is different now, so refresh before showing the result: the
      // customer taps through to something already correct.
      await refreshEsimsQuietly();
      paintClaimDone(out);
    });
    box.appendChild(confirm);

    box.appendChild(el('button', {
      class: 'btn btn--quiet', text: 'Отправить код ещё раз',
      onclick: () => paintClaimEmail(email),
    }));
  }

  function paintClaimDone(out) {
    const box = claimBox();
    clear(box);

    const found = Number((out && out.linked_count) || 0);
    const already = Number((out && out.already_linked_count) || 0);
    $('#claim-title').textContent = found ? 'Покупки добавлены' : 'Адрес подтверждён';

    if (found) {
      box.appendChild(claimNotice(
        `Нашли ${found} ${C.plural(found, 'покупку', 'покупки', 'покупок')} и добавили в «Мои eSIM».`));
      for (const p of (out.purchases || [])) {
        box.appendChild(el('div', { class: 'card row row--between' }, [
          el('span', { class: 'card__body' }, [
            el('span', { class: 'card__title', text: C.destinationTitle(p.package_name, p.country_code) }),
            el('span', { class: 'card__meta', text: p.data_gb ? `${p.data_gb} ГБ` : '' }),
          ]),
          el('span', { class: 'small muted', text: p.has_esim ? 'eSIM готова' : 'без eSIM' }),
        ]));
      }
    } else if (already) {
      box.appendChild(claimNotice('Эти покупки уже были добавлены.'));
    } else {
      // §9 S13: "успех без покупок" is not an error. The address is proven, and
      // future purchases from it now genuinely do attach by themselves — the
      // server reconciles at fulfilment and again on every «Мои eSIM» read.
      // This sentence used to be a promise the code did not keep.
      box.appendChild(claimNotice(
        'Адрес подтверждён. Покупок с него не нашлось — возможно, вы покупали с другого адреса.'));
      box.appendChild(el('p', { class: 'small muted', text:
        'Новые покупки с этого адреса появятся здесь сами.' }));
    }

    box.appendChild(el('button', {
      class: 'btn btn--wide', text: 'Открыть «Мои eSIM»',
      onclick: () => { show('esims'); renderEsims(); },
    }));
  }

  function statusBadge(status, { small = false } = {}) {
    // Never the raw enum: an unmapped status is our gap, not a word a customer
    // should have to read. RAW CODES = 0 covers status vocabularies too.
    const text = C.ESIM_STATUS_TEXT[status] || 'Статус уточняется';
    const tone = status === 'active' || status === 'ready' ? 'badge--good'
      : (status === 'depleted' || status === 'expired' || status === 'failed' ? 'badge--bad'
        : (status === 'suspended' ? 'badge--warn' : ''));

    // `small` is an OUTLINE variant, not just fewer pixels. On a card the
    // destination has to win, and a filled pill beside a country name reads as
    // the more important of the two whatever size it is. The words and the
    // colour are unchanged, so nothing is lost for anyone reading it.
    return el('span', { class: `badge ${tone} ${small ? 'badge--sm' : ''}`.trim().replace(/\s+/g, ' '), text });
  }

  /**
   * The bar alone — no words.
   *
   * Split out of `gauge()` so the card can put the numbers where its own
   * hierarchy wants them instead of taking the stacked block the detail screen
   * needs. One function still decides what a fraction LOOKS like, so the two
   * surfaces cannot drift into disagreeing about what "low" is.
   *
   * Unknown keeps the hatching. It must not read as empty, and hatching is a
   * second signal beside the word — §16: colour is never the only one.
   */
  function gaugeBar(esim) {
    const fraction = C.remainingFraction(esim);
    if (fraction === null) return el('div', { class: 'gauge gauge--unknown' });

    const cls = fraction === 0 ? 'gauge__fill--empty' : (fraction < 0.15 ? 'gauge__fill--low' : '');

    return el('div', { class: 'gauge' }, [
      el('div', { class: `gauge__fill ${cls}`.trim(), style: `width:${Math.round(fraction * 100)}%` }),
    ]);
  }

  function gauge(esim) {
    const fraction = C.remainingFraction(esim);
    // §9 S9: the time is not decoration and it is not conditional. A remaining
    // balance is a number the provider owns and we relayed — possibly hours
    // ago — and without a time beside it the app is promising something it does
    // not control. It sits under BOTH branches for the same reason.
    const when = el('div', { class: 'small muted', text: C.syncedAgo(esim && esim.last_usage_sync_at) });

    if (fraction === null) {
      return el('div', { class: 'stack', style: 'gap:4px' }, [
        gaugeBar(esim),
        el('div', { class: 'small muted', text: 'Остаток неизвестен — обновите данные' }),
        when,
      ]);
    }

    return el('div', { class: 'stack', style: 'gap:4px' }, [
      gaugeBar(esim),
      el('div', { class: 'small muted tabular', text: `${esim.remaining_gb} из ${esim.total_gb} ГБ` }),
      when,
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
  const derivedLabel = (e) => C.destinationTitle(e && e.package_name, e && e.country_code);

  /**
   * The title, which the customer may have written themselves.
   *
   * A custom name WINS, and the derived one survives underneath — see
   * `esimSubtitle`. It is never destroyed and never overwritten: renaming an
   * eSIM «Рабочая» must not make it impossible to see that it is the Turkish
   * one. The server sends both fields for exactly this reason.
   *
   * The name is a LABEL and nothing more. Nothing looks an eSIM up by it, it is
   * not unique, and it reaches no provider — so it can be any words at all
   * without any of that mattering.
   */
  const ownedLabel = (e) => (e && e.display_name) || derivedLabel(e);

  /**
   * What the eSIM actually is, shown under a name the customer chose.
   *
   * Empty when they have not renamed it — the title is already the derived
   * name, and repeating it would be noise.
   */
  const esimSubtitle = (e) => {
    if (!e || !e.display_name) return '';
    const parts = [derivedLabel(e)];
    if (e.total_gb != null) parts.push(`${e.total_gb} ГБ`);

    return parts.filter(Boolean).join(' · ');
  };

  function esimCard(e) {
    const days = C.daysLeft(e.expires_at);

    const fraction = C.remainingFraction(e);

    /*
     * THE HIERARCHY, which is what changed here.
     *
     * The card used to put the destination and a filled green «Готова к
     * установке» pill side by side at the same weight, so the loudest thing on
     * a card about Turkey was a piece of workflow state. The days remaining sat
     * as grey caption under the name, the balance was a caption under the bar,
     * and an unknown balance spent two full lines saying so twice.
     *
     * Now: the destination is the heading, the two numbers a traveller actually
     * opens this for — data left and days left — are the second row at reading
     * size, and the status is a quiet outline pill that says the same words
     * without shouting them.
     *
     * Order of the two numbers is deliberate: data first, because that is the
     * one that runs out unexpectedly. Days are predictable.
     */
    return el('button', {
      // §9 S8: spent eSIMs stay in the list — a customer looks for what they
      // bought, not only for what still works — but they are dimmed so the
      // live one is found without reading. Never dimming alone: `statusBadge`
      // carries the same fact in words (§16 — colour is never the only signal).
      class: C.isSpentEsim(e) ? 'card esim-card card--spent' : 'card esim-card',
      onclick: () => openEsim(e.id),
    }, [
      el('div', { class: 'row row--between esim-card__head' }, [
        el('span', { class: 'row esim-card__id' }, [
          el('span', { class: 'card__flag', text: C.flagFor(e.country_code) }),
          // Title over subtitle when the customer named it; a single line when
          // they did not. The derived name is never lost — only demoted.
          el('span', { class: 'esim-card__titles' }, [
            el('span', { class: 'esim-card__name', text: ownedLabel(e) }),
            esimSubtitle(e)
              ? el('span', { class: 'esim-card__sub', text: esimSubtitle(e) })
              : null,
          ]),
        ]),
        statusBadge(e.status, { small: true }),
      ]),

      el('div', { class: 'row row--between esim-card__metrics' }, [
        fraction === null
          // Said ONCE, and the hatched bar under it says it a second way.
          ? el('span', { class: 'esim-card__unknown', text: 'Остаток неизвестен' })
          : el('span', { class: 'esim-card__metric' }, [
              el('span', { class: 'esim-card__big tabular', text: `${e.remaining_gb} ГБ` }),
              el('span', { class: 'esim-card__of tabular', text: `из ${e.total_gb}` }),
            ]),
        days === null ? null : el('span', { class: 'esim-card__metric esim-card__metric--end' }, [
          el('span', { class: 'esim-card__big tabular', text: String(days) }),
          el('span', { class: 'esim-card__of', text: C.plural(days, 'день', 'дня', 'дней') }),
        ]),
      ]),

      gaugeBar(e),

      /*
       * The timestamp §9 S9 requires beside any relayed balance — one caption
       * line at the foot rather than a second paragraph in the middle.
       *
       * SUPPRESSED in exactly one case: no balance AND no timestamp. There
       * «Остаток неизвестен» and «данные ещё не запрашивались» are the same
       * sentence written twice, and they were the two tallest lines on the home
       * screen. The rule the timestamp exists for is about a NUMBER we relayed
       * — with no number there is nothing for it to qualify.
       *
       * Every other combination keeps it, including a known balance with no
       * timestamp, which is precisely the case the rule was written for.
       */
      (fraction === null && !(e && e.last_usage_sync_at))
        ? null
        : el('span', { class: 'esim-card__synced', text: C.syncedAgo(e && e.last_usage_sync_at) }),
    ]);
  }

  /* ------------------------------------------------------------------ *
   * Screen: eSIM detail
   * ------------------------------------------------------------------ */

  /**
   * §9 S9: «Открывается меньше чем за 2 секунды (P5): сначала кэш, затем
   * асинхронное обновление.»
   *
   * The list the customer just tapped already holds everything this screen
   * shows except `status_detail`, so it is drawn from that first and the
   * request runs behind it. The number is dated either way — `syncedAgo` under
   * the gauge says how old it is — so showing it a second early costs nothing
   * and a skeleton in an airport costs the whole point of the screen.
   */
  async function openEsim(id) {
    show('esim');
    const box = $('#esim-detail');
    const known = (state.esims || []).find((x) => x && x.id === id) || null;

    clear(box);
    if (known) paintEsim(box, known, id);
    else box.appendChild(el('div', { class: 'skel skel--card' }));

    let e = null;
    try {
      e = await api.esim(id);
    } catch (err) {
      // A failed refresh over data already on screen is not worth replacing it
      // with an error — the timestamp under the gauge already says how old it
      // is. With nothing on screen there is nothing to keep.
      if (known) return;
      clear(box);
      box.appendChild(errorNotice(
        err.status === 404 ? 'eSIM не найдена.' : 'Не удалось загрузить eSIM.',
        err.status === 404 ? null : () => openEsim(id)
      ));
      return;
    }

    // The customer may have moved on while the request was in flight.
    if (state.screen !== 'esim') return;
    clear(box);
    paintEsim(box, e, id);
  }

  /* ------------------------------------------------------------------ *
   * Managing an eSIM you own: a name of your own, and getting it out of
   * the way. Neither deletes anything.
   * ------------------------------------------------------------------ */

  const ESIM_NAME_MAX = 60;   // the same number the column's CHECK enforces

  /* ------------------------------------------------------------------ *
   * A bottom sheet, and a confirmation built out of one.
   *
   * NOT `window.confirm` or `window.prompt`. A native dialog inside a Telegram
   * WebView is a different shape on every client, cannot follow the customer's
   * theme, and — the part that decides it — BLOCKS the webview: while one is
   * open the page receives no events at all, which on iOS has been enough to
   * strand a Mini App entirely.
   *
   * Not `tg.showConfirm` either, which exists but is unavailable on older
   * clients and would need this fallback anyway. One implementation is easier
   * to reason about than two, and this one is testable in a plain browser.
   * ------------------------------------------------------------------ */

  let sheetEl = null;

  function closeSheet() {
    if (!sheetEl) return;
    const node = sheetEl;
    sheetEl = null;
    try { node.remove(); } catch { /* */ }
    document.body.classList.remove('sheet-open');
  }

  function openSheet(title, children) {
    closeSheet();

    const panel = el('div', {
      class: 'sheetm__panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': title,
    }, [
      el('div', { class: 'sheetm__grip', 'aria-hidden': 'true' }),
      el('h2', { class: 'sheetm__title', text: title }),
      el('div', { class: 'stack' }, children.filter(Boolean)),
    ]);

    sheetEl = el('div', { class: 'sheetm' }, [
      // The backdrop closes. A sheet that can only be dismissed by its own
      // button is a sheet somebody gets stuck in.
      el('div', { class: 'sheetm__scrim', onclick: closeSheet }),
      panel,
    ]);

    document.body.appendChild(sheetEl);
    document.body.classList.add('sheet-open');

    return closeSheet;
  }

  /**
   * Ask, and resolve to what they chose.
   *
   * The default is NO: the scrim, the cancel button and any dismissal all
   * resolve false, so the only route to true is a deliberate tap on the
   * confirm button.
   */
  function confirmSheet(message, { confirmText = 'Продолжить', tone = '' } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      const finish = (value) => { if (answered) return; answered = true; closeSheet(); resolve(value); };

      openSheet('Подтвердите', [
        el('p', { class: 'muted', text: message }),
        el('button', {
          class: `btn btn--wide ${tone}`.trim(), text: confirmText,
          onclick: () => finish(true),
        }),
        el('button', { class: 'btn btn--quiet', text: 'Отмена', onclick: () => finish(false) }),
      ]);

      // Dismissing by the scrim must answer too, or the promise never settles
      // and the caller waits forever.
      sheetEl.querySelector('.sheetm__scrim').addEventListener('click', () => finish(false));
    });
  }

  /** A short, self-dismissing message. Used only where a failure needs no decision. */
  function toast(text) {
    const node = el('div', { class: 'toast', role: 'status' }, [el('span', { text })]);
    document.body.appendChild(node);
    setTimeout(() => { try { node.remove(); } catch { /* */ } }, 2600);
  }

  /**
   * The rename sheet.
   *
   * Built here rather than as a `prompt()`: a system prompt in a Telegram
   * WebView is inconsistent across clients, cannot be styled to the customer's
   * theme, and on iOS steals focus in a way that occasionally leaves the app
   * scrolled somewhere else. This is a small bottom sheet with one field.
   *
   * Empty is a legitimate answer and means «go back to the standard name» —
   * which is why the primary button stays enabled on an empty field and the
   * hint says so. Making the customer find a separate «Сбросить» for something
   * they can express by clearing the box would be a worse screen.
   */
  function openRenameSheet(esim, onSaved) {
    const current = (esim && esim.display_name) || '';

    const input = el('input', {
      class: 'input', type: 'text', value: current,
      maxlength: String(ESIM_NAME_MAX),
      placeholder: derivedLabel(esim) || 'Например: Отпуск в Турции',
      autocapitalize: 'sentences', autocorrect: 'off', spellcheck: 'false',
      'aria-label': 'Название eSIM',
    });

    const err = el('div', { class: 'small', style: 'display:none' });
    const save = el('button', { class: 'btn btn--wide' });
    setBusy(save, false, 'Сохранить');

    const close = openSheet('Название eSIM', [
      el('p', { class: 'small muted', text:
        'Своё название видите только вы. Данные eSIM, трафик и пополнение не меняются.' }),
      input,
      err,
      save,
      el('button', {
        class: 'btn btn--quiet', text: current ? 'Вернуть стандартное название' : 'Отмена',
        onclick: () => { if (current) { input.value = ''; save.click(); } else closeSheet(); },
      }),
    ]);

    save.addEventListener('click', async () => {
      const name = String(input.value || '').trim();
      if (name.length > ESIM_NAME_MAX) {
        err.textContent = `Не длиннее ${ESIM_NAME_MAX} символов.`;
        err.style.display = '';
        err.className = 'small';
        err.style.color = 'var(--bad)';

        return;
      }
      setBusy(save, true, 'Сохраняем…');
      try {
        await api.renameEsim(esim.id, name);
        haptic('light');
        notifySuccess();
        close();
        await onSaved();
      } catch (ex) {
        setBusy(save, false, 'Сохранить');
        err.textContent = (ex && ex.body && ex.body.message) || 'Не удалось сохранить название.';
        err.style.display = '';
        err.style.color = 'var(--bad)';
      }
    });

    setTimeout(() => { try { input.focus(); } catch { /* */ } }, 60);
  }

  /**
   * Hide, or bring back.
   *
   * The confirmation before hiding is deliberately unalarming, because the
   * action is: it says what happens and that it is reversible. There is no
   * «Удалить» anywhere in this flow and there is nothing behind it that could
   * honestly be called one — the row, the order, the ICCID, the activation
   * data, the usage snapshot and the top-up history all survive untouched.
   *
   * Restoring asks nothing. Undoing something reversible should not need a
   * second decision.
   */
  async function setEsimHidden(esim, hidden, onDone) {
    if (hidden) {
      const ok = await confirmSheet(
        'Скрыть эту eSIM из списка? Вы сможете вернуть её позже.',
        { confirmText: 'Скрыть' }
      );
      if (!ok) return;
    }

    try {
      await api.setEsimVisibility(esim.id, hidden);
      haptic('light');
      notifySuccess();
      await onDone();
    } catch {
      toast('Не удалось изменить. Попробуйте ещё раз.');
    }
  }

  function esimManageSheet(e, id) {
    /*
     * A CAPABILITY CHECK, not a feature flag.
     *
     * The server sends `hidden` on every eSIM once it can store one — always a
     * boolean, never absent. A backend that predates the display-settings
     * migration sends neither field, and drawing «Переименовать» / «Скрыть»
     * against it would offer two buttons that answer 404.
     *
     * So the block appears when the server says it is there, and the app can be
     * deployed ahead of the backend without lying to anybody. It lights up by
     * itself the moment the other side lands — no second release, no flag to
     * remember to flip.
     */
    if (!e || typeof e.hidden !== 'boolean') return null;

    const refresh = async () => {
      /*
       * Both lists change, and so does the screen the customer is standing on.
       *
       * The cache is deliberately NOT cleared: `renderEsims` goes through
       * `readThrough`, which always asks the network first and only falls back
       * to the cache when that fails — so a fresh list arrives anyway, and
       * writing a null into the cache would leave a poisoned entry for the next
       * failure to serve.
       */
      await openEsim(id);
      await renderMine();
    };

    return el('details', { class: 'sheet card gap-top-sm' }, [
      el('summary', { class: 'sheet__head', text: 'Управление' }),
      el('div', { class: 'stack' }, [
        el('button', {
          class: 'btn btn--ghost', text: 'Переименовать',
          onclick: () => openRenameSheet(e, refresh),
        }),
        e.hidden
          ? el('button', {
              class: 'btn btn--ghost', text: 'Вернуть в мои eSIM',
              onclick: () => setEsimHidden(e, false, async () => { await refresh(); show('esims'); await renderEsims(); }),
            })
          : el('button', {
              class: 'btn btn--quiet', text: 'Скрыть eSIM',
              onclick: () => setEsimHidden(e, true, async () => { show('esims'); await renderEsims(); }),
            }),
        el('p', { class: 'small muted', text:
          'Скрытая eSIM продолжает работать. Её данные, история и пополнение сохраняются — она просто не показывается в основном списке.' }),
      ]),
    ]);
  }

  function paintEsim(box, e, id) {
    box.appendChild(el('div', { class: 'card stack' }, [
      el('div', { class: 'row row--between' }, [
        el('span', { class: 'esim-card__titles' }, [
          el('h1', { class: 'esim-detail__title', text: ownedLabel(e) }),
          esimSubtitle(e) ? el('span', { class: 'esim-card__sub', text: esimSubtitle(e) }) : null,
        ]),
        statusBadge(e.status),
      ]),
      // A hidden eSIM says so, once, where the customer opened it — otherwise
      // finding it in «Скрытые» and then seeing a screen identical to any other
      // leaves them unsure whether the tap did anything.
      e.hidden ? el('div', { class: 'notice' }, [
        el('span', { text: 'Эта eSIM скрыта из основного списка. Она работает как обычно.' }),
      ]) : null,
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
      // The top-up affordance, if this eSIM actually has one.
      //
      // The comment that used to sit here said recharge was unsafe at both
      // providers and that a disabled button would promise something that does
      // not exist. The first half was wrong — it described a defect in our
      // client, not a limit of either provider — but the second half still
      // governs this line, and is why nothing is drawn until the SERVER has
      // said, for this specific eSIM, that compatible top-ups exist.
      //
      // Never from a catalogue flag, never from the provider name, and never a
      // greyed-out button: an eSIM with no top-up shows nothing at all.
      el('div', { id: 'esim-topup' }),

      // Management, kept out of the way.
      //
      // A <details> — the same `.sheet` idiom the tariff screen already uses —
      // rather than four more full-width buttons. Renaming and hiding are things
      // a customer does once, if ever; the actions they came for (install, top
      // up, refresh, support) must not have to share weight with them.
      //
      // NOTHING HERE DELETES ANYTHING, and the words say so. «Скрыть» is not a
      // softened «Удалить» — the eSIM keeps working, keeps its ICCID, its order,
      // its usage and its top-up history, and the customer can bring it back.
      esimManageSheet(e, id),
    ]));

    // Asked after the card is on screen, so a slow provider call cannot hold
    // up the eSIM the customer opened this screen to see.
    void renderTopups(id);
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

    // ---- the device picker --------------------------------------------
    //
    // Two real choices, stated as such. The old version was a pair of thin
    // ghost tabs above a list, which read as a filter rather than as the first
    // decision on the screen — and it is the first decision: every settings
    // path below it differs. They are large, labelled, and one of them is
    // already chosen, so a customer who is holding the right phone does
    // nothing at all.
    const IOS = [
      'Откройте «Настройки» → «Сотовая связь» (или «Мобильная связь»).',
      'Нажмите «Добавить eSIM» → «Использовать QR-код».',
      'Наведите камеру на QR выше. Если QR на этом же экране — нажмите «Ввести данные вручную» и вставьте значения ниже.',
      'Дайте профилю имя, например «Поездка», и завершите настройку.',
      'В поездке включите для этой линии передачу данных и роуминг данных.',
    ];
    const ANDROID = [
      'Откройте «Настройки» → «Сеть и Интернет» → «SIM-карты».',
      'Нажмите «Добавить eSIM» / «Загрузить SIM-карту» (на Samsung — «Добавить тарифный план»).',
      'Отсканируйте QR выше. Если сканер недоступен — «Ввести код вручную» и вставьте значения ниже.',
      'Дождитесь загрузки профиля и включите его.',
      'В поездке включите для этой линии мобильные данные и роуминг данных.',
    ];

    const picker = el('div', { class: 'devices', role: 'radiogroup', 'aria-label': 'Тип телефона' });
    const steps = el('div', {});
    const oneTap = el('div', { class: 'stack' });

    const paint = (which) => {
      clear(steps);
      const list = el('ol', { class: 'steps' });
      for (const line of (which === 'ios' ? IOS : ANDROID)) list.appendChild(el('li', { text: line }));
      steps.appendChild(list);
      for (const b of picker.children) {
        b.setAttribute('aria-checked', String(b.dataset.os === which));
      }

      // A one-tap install, using the PROVIDER's own link where there is one.
      //
      // This used to build the Apple URL here from `act.lpa`, and offered
      // nothing at all on Android on the stated grounds that Android has no
      // equivalent link. That was wrong, and it was our gap rather than
      // Android's: MobiMatter returns oneClickInstall.ios AND
      // oneClickInstall.android on every completed order, builds both from the
      // LPA itself, and we were discarding them. The backend now keeps them
      // and serves them under ownership as `install`.
      //
      // Preferring the provider's link over one we assemble matters beyond
      // tidiness: they know their own provisioning host, and a deep link we
      // invent is a link we cannot support when it stops working.
      //
      // The locally-built Apple URL stays as the fallback for providers that
      // send no link — it is Apple's documented format, not a guess — but
      // nothing equivalent is invented for Android.
      clear(oneTap);
      const install = act.install || {};
      const providerUrl = which === 'ios' ? install.ios_url : install.android_url;
      const fallbackIos = which === 'ios' && act.lpa
        ? `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(act.lpa)}`
        : null;
      const url = providerUrl || fallbackIos;

      if (url) {
        oneTap.appendChild(el('button', {
          class: 'btn btn--wide',
          text: which === 'ios' ? 'Установить на этом iPhone' : 'Установить на этом Android',
          onclick: () => openExternal(url),
        }));
        oneTap.appendChild(el('p', { class: 'small muted', text: which === 'ios'
          ? 'Откроется системная установка. Работает на iOS 17.4 и новее — если ничего не произошло, установите по QR или вручную.'
          : 'Откроется системная установка. Поддерживается не всеми моделями — если ничего не произошло, установите по QR или вручную.' }));
      }
    };

    const device = (os, label, hint) => el('button', {
      class: 'device',
      'data-os': os,
      role: 'radio',
      'aria-checked': 'false',
      onclick: () => { paint(os); haptic('light'); },
    }, [
      el('span', { class: 'device__name', text: label }),
      el('span', { class: 'device__hint', text: hint }),
    ]);

    box.appendChild(el('h2', { class: 'section', text: 'Какой у вас телефон?' }));
    picker.appendChild(device('ios', 'iPhone', 'iOS'));
    picker.appendChild(device('android', 'Android', 'Samsung, Pixel, Xiaomi…'));
    box.appendChild(picker);
    box.appendChild(oneTap);
    box.appendChild(steps);

    // §9 S10: Telegram knows which client it is; inside a WebView the user
    // agent only describes the engine. The picker above remains, because
    // detection is allowed to be wrong and a customer stuck on the wrong
    // instructions is not.
    paint(C.installPlatform(tg && tg.platform, navigator.userAgent));

    box.appendChild(el('h2', { class: 'section', text: 'Ввод вручную' }));
    box.appendChild(el('div', { class: 'stack' }, [
      copyField('SM-DP+ адрес', act.smdp_address),
      copyField('Код активации', act.activation_code),
      copyField('LPA (одной строкой)', act.lpa),
      act.iccid ? copyField('ICCID', act.iccid) : null,
    ]));

    box.appendChild(el('p', { class: 'small muted', text: 'Устанавливайте eSIM при работающем интернете. Удалить и установить повторно тот же профиль нельзя.' }));
    box.appendChild(supportButton(null));
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
    // Before the catalogue paints, not after: the hole has to exist by the time
    // the tiles land, or reserving it becomes a second shift instead of the
    // cure for the first.
    reserveMineSpace();
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

      return;
    }

    // Arrived from the eSIM email. Land them where they were promised — their
    // eSIMs — instead of on the catalogue with the thing they just bought
    // nowhere in sight.
    //
    // `renderEsims()` reconciles server-side before it answers, so a purchase
    // covered by an address they have already proven is in the list by the time
    // it paints. If it is still empty, the reason is that nobody has proven the
    // mailbox yet, and the one useful next step is the one we open: the claim
    // screen. That screen proves ownership properly, with a code to the
    // mailbox — the link itself proved nothing and never could.
    const email = launchFromEmail();
    if (email) {
      show('esims');
      await renderEsims();
      if (!state.esims.length) openClaim();

      return;
    }

    // A top-up we left mid-payment. Resuming the SAME intent is the whole
    // point: a fresh quote here would mint a second intent, and the customer
    // could end up paying for two. The token names one of this customer's own
    // intents and authorises nothing — the session does that — so the server
    // still decides what, if anything, to show.
    const pendingTopup = readPendingTopup();
    if (pendingTopup) await showTopupStatus(pendingTopup);
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
    // The catalogue is public: these tabs must work whether or not a session
    // ever arrives, and they are the reason most people opened the app.
    //
    // «Главная» and «Купить» are the same screen seen two ways, and that is
    // deliberate rather than lazy. Главная is where a customer who already
    // bought something lands — the return block and the sixteen destinations
    // most people want. Купить is for somebody who knows where they are going
    // and wants the whole list, so it opens the A-Z section directly. One
    // screen, because splitting the catalogue in two would mean a destination
    // that exists on one tab and not the other.
    $('#nav-home').addEventListener('click', () => {
      state.catalogueTab = 'nav-home';
      state.showAll = false;
      clearSearch();
      show('home');
    });
    $('#nav-buy').addEventListener('click', () => {
      state.catalogueTab = 'nav-buy';
      state.showAll = true;
      paintCountryList();
      show('home');
      // Past the popular strip, onto the list this tab exists for. Guarded:
      // scrollIntoView is not universal in every webview Telegram ships.
      try {
        const list = document.querySelector('#home-countries .section');
        if (list && list.scrollIntoView) list.scrollIntoView({ block: 'start' });
      } catch { /* the list is on screen either way */ }
    });
    // «Мои eSIM» is the one tab that genuinely needs the customer's identity.
    $('#nav-esims').addEventListener('click', () => { show('esims'); renderEsims(); });
    // «Помощь» answers what it can without a person, and hands over what it
    // cannot. It needs no session, which is the point: the customer most in
    // need of it is often the one whose session just failed.
    $('#nav-help').addEventListener('click', () => { show('help'); renderHelp(); });
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
