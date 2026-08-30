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

  /**
   * The language layer. Read here the same way `MagicCore` is — by the time
   * this file parses, `i18n.js` has already built its default instance.
   *
   * `t` is the whole of the vocabulary this file needs. It is total: it returns
   * a string for anything, so a mistyped key renders as the key rather than
   * taking a screen down.
   */
  const I = window.MagicI18n;
  const t = (key, vars) => I.t(key, vars);

  /**
   * The sentence for a server error — ENGLISH ONLY.
   *
   * Returns null in Russian, on purpose. Every call site below then keeps the
   * exact expression it shipped with, so the Russian diff for this whole phase
   * is empty and no already-trusted error copy needs re-testing.
   *
   * The backend writes `message` in Russian. Echoing that to somebody who chose
   * English is the same failure as showing an untranslated English string to a
   * Russian customer, which app/i18n.js already forbids — so the English branch
   * never reads the wire string at all. It answers from the closed vocabulary
   * `C.errorKey()` recognises, and falls to `fallbackKey` when the server names
   * a code this build has never heard of.
   */
  /**
   * «дня» / "days" — the word only, so the NUMBER stays a substitution and the
   * sentence around it stays in the dictionary. Russian needs three forms and
   * English two, which is why this cannot be one shared call.
   */
  function dayWord(n) {
    return I.lang() === 'en'
      ? C.pluralEn(n, 'day', 'days')
      : C.plural(n, 'день', 'дня', 'дней');
  }

  /** "34 countries" / «34 страны» — number and word together, as one phrase. */
  function countryCount(n) {
    return I.lang() === 'en' ? C.countryWordEn(n) : C.countryWord(n);
  }

  function serverErrorText(e) {
    if (I.lang() !== 'en') return null;

    return C.errorText(e && e.code, 'en');
  }

  /**
   * In English: the mapped sentence, or this screen's own fallback — never the
   * server's Russian wire string, which is what the `||` chains below would
   * otherwise reach next. In Russian: null, so those chains run untouched.
   *
   * Takes the fallback as TEXT rather than as a key, so that every t() call in
   * this file still spells its key out literally. A computed key is invisible
   * to the scanner that proves the dictionary has no dead entries, and that
   * scanner's failure mode is somebody deleting a live key to make it green.
   */
  function enOr(text, fallbackText) {
    if (I.lang() !== 'en') return null;

    return text || fallbackText;
  }

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

  const SCREENS = ['home', 'country', 'tariff', 'checkout', 'esims', 'esim', 'install', 'claim', 'help', 'settings', 'error', 'loading', 'order', 'topup'];

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
      el('span', { text: t('stale.notice') }),
      el('button', { class: 'btn btn--quiet', text: t('common.refresh'), onclick: onRetry }),
    ]);
  }

  function errorNotice(message, onRetry) {
    return el('div', { class: 'notice notice--bad' }, [
      el('span', { text: message }),
      onRetry ? el('button', { class: 'btn btn--quiet', text: t('common.retry'), onclick: onRetry }) : null,
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
    const btn = el('button', { class: 'btn btn--quiet copyfield__copy', text: t('copy.copy') });

    // Held on the element, so a second tap while the first is still showing
    // «Скопировано» restarts the window instead of reverting the label early.
    let revert = null;
    const flash = () => {
      btn.textContent = t('copy.copied');
      btn.dataset.copied = '1';
      if (revert) clearTimeout(revert);
      revert = setTimeout(() => {
        btn.textContent = t('copy.copy');
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
          btn.textContent = t('copy.selected');
          if (revert) clearTimeout(revert);
          revert = setTimeout(() => { btn.textContent = t('copy.copy'); revert = null; }, 1600);
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
    list.appendChild(errorNotice(t('home.loadFailed'), renderCatalogue));
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
    mine.appendChild(el('h2', { class: 'section', text: t('home.myEsims') }));
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
    mine.appendChild(el('h2', { class: 'section', text: t('home.myEsims') }));
    for (const e of state.esims.slice(0, 3)) mine.appendChild(esimCard(e));
    if (state.esims.length > 3) {
      mine.appendChild(el('button', {
        class: 'btn btn--ghost', text: t('home.allEsims', { n: state.esims.length }),
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
            el('span', { class: 'tile__prefix', text: `${t('tile.fromWord')} ` }),
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
      el('span', { class: 'card__price tabular', text: g.from === null ? '' : t('tile.from', { price: C.money(g.from) }) }),
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
          el('p', { text: t('search.notFound') }),
          el('p', { class: 'small muted', text: t('search.tryAnother') }),
          el('button', { class: 'btn btn--quiet', text: t('search.showPopular'), onclick: clearSearch }),
        ]));
        return;
      }
      list.appendChild(el('h2', { class: 'section', text: t('search.found', { n: matches.length }) }));
      for (const g of matches) list.appendChild(destinationRow(g));

      return;
    }

    const popular = C.popularGroups(countries);
    if (popular.length) {
      list.appendChild(el('h2', { class: 'section', text: t('list.popular') }));
      list.appendChild(el('div', { class: 'tiles' }, popular.map(popularTile)));
    }

    if (!state.showAll) {
      const rest = countries.length - popular.length + regions.length;
      if (rest > 0) {
        list.appendChild(el('button', {
          class: 'btn btn--ghost btn--wide',
          text: t('list.allCountries', { n: rest }),
          onclick: () => { state.showAll = true; paintCountryList(); },
        }));
      }

      return;
    }

    if (regions.length) {
      list.appendChild(el('h2', { class: 'section', text: t('list.regions') }));
      for (const r of regions) list.appendChild(destinationRow(r));
    }
    if (countries.length) {
      list.appendChild(el('h2', { class: 'section', text: t('list.countries') }));
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
  /* ========================================================================
   * Daily tariffs — «Трафик на каждый день».
   *
   * A per-day allowance is a different product from a volume, so it gets its
   * own card and its own section. Showing «1 ГБ» on a daily plan next to «1 ГБ»
   * on a volume one, both sorted by price, is a comparison that means nothing.
   *
   * Every line of copy is the shared module's, the same one the storefront and
   * the country pages use. If it did not load, no daily card is drawn at all:
   * a daily plan shown without its terms reads as a volume plan, which is the
   * confusion the section exists to prevent.
   * ===================================================================== */
  function dailyCard(p, group) {
    const D = C.dailyCopy();
    if (!D) return null;
    const lines = D.lines(p);
    if (!lines.length) return null;

    const terms = C.dailyTerms(p);
    // The cheapest offered term, shown as «от», so the card carries a real
    // number without pretending the customer has chosen yet. A plan with no
    // priced ladder shows no price and cannot be opened for purchase.
    const from = terms.length ? terms[0] : null;

    return el('button', { class: 'card stack card--tariff', onclick: () => openTariff(p, group) }, [
      el('div', { class: 'row row--between' }, [
        el('div', { class: 'row tariff__head' }, [
          el('span', { class: 'card__title', text: t('daily.perDay', { allowance: D.formatAllowance(p.daily_gb) }) }),
        ]),
        el('div', {
          class: 'card__price tabular',
          text: from ? t('tile.from', { price: C.money(from.price) }) : '—',
        }),
      ]),
      el('div', { class: 'card__meta', text: lines.map((l) => l.text).slice(1).join(' · ') || ' ' }),
    ]);
  }

  function tariffCard(p, group, distinct) {
    const isBest = group && group.best && group.best.package_id === p.package_id;
    const days = Number(p.validity_days);

    // §9 S3: a tariff card opens the tariff, not the payment form. Going
    // straight to checkout skipped the one screen whose job is to answer
    // "will this work on my phone, and what am I actually buying".
    return el('button', { class: 'card stack card--tariff', onclick: () => openTariff(p, group) }, [
      el('div', { class: 'row row--between' }, [
        el('div', { class: 'row tariff__head' }, [
          el('span', { class: 'card__title', text: p.unlimited ? t('plan.unlimited') : t('plan.gb', { n: p.data_gb }) }),
          isBest ? el('span', { class: 'badge badge--best', text: t('plan.best') }) : null,
        ]),
        el('div', { class: 'card__price tabular', text: C.money(p.price) }),
      ]),
      el('div', {
        class: 'card__meta',
        text: `${days} ${dayWord(days)}`
          + (p.hotspot_supported === true ? ` · ${t('plan.hotspot')}` : ''),
      }),
      // What makes THIS card different from the one beside it. Drawn only when
      // something actually varies among tariffs of the same coverage, volume
      // and validity — so most countries show nothing here, and the two Japan
      // cards that used to read as one row duplicated stop doing that.
      chipsFor(p, distinct),
    ]);
  }

  /** The differentiator row, or nothing at all when there is nothing to say. */
  function chipsFor(p, distinct) {
    const labels = (distinct && distinct.get(String(p.package_id || ''))) || [];
    if (!labels.length) return null;

    return el('div', { class: 'tariff__distinct' }, labels.map((label) => el('span', {
      // The exit country is the one that changes a decision, so it is the one
      // that gets colour; the rest stay quiet.
      class: 'tariff__chip' + (label.startsWith('IP: ') ? ' tariff__chip--ip' : ''),
      text: label,
    })));
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
        text: t('country.onePlan', { countries: countryCount(group.coverage.length) }),
      }));
    }

    // §9 S2: price ascending by default, with a switch to volume. Only worth
    // drawing when there is something to reorder — two cards sort themselves.
    // Counted on the volume pool: the toggle reorders that grid and nothing
    // else, so a country whose only tariffs are daily must not grow one.
    if (C.partitionDaily(group.items).volume.length > 2) list.appendChild(sortToggle(group));

    // Daily plans leave the pool BEFORE it is sorted. Ranking them against
    // fixed volumes by price would let a per-day figure decide which volume
    // card looks best, and the two are not comparable.
    const split = C.partitionDaily(group.items);
    const volume = split.volume;
    const daily = split.daily;

    // Computed over the whole group, once, because "what is different" is a
    // property of the set rather than of any one card.
    const distinct = C.tariffDistinguishers(volume);
    for (const p of C.sortTariffs(volume, state.sort)) {
      list.appendChild(tariffCard(p, group, distinct));
    }

    // Above nothing and below the volumes: a customer scanning for a volume
    // should not have to pass this, and one who wants it finds it in one place.
    const dailyCards = daily.map((p) => dailyCard(p, group)).filter(Boolean);
    if (dailyCards.length) {
      const D = C.dailyCopy();
      list.appendChild(el('h2', { class: 'section', text: D ? D.BLOCK_TITLE : '' }));
      for (const card of dailyCards) list.appendChild(card);
    }

    // Blueprint §9 S2: a country is never a dead end. Regional offers that
    // cover it are shown underneath — and if it has no local tariff at all,
    // they are the only thing standing between the customer and a blank screen.
    const alternatives = group.regional ? [] : C.regionsCovering(state.regions, group.country_code);
    if (alternatives.length) {
      list.appendChild(el('h2', {
        class: 'section',
        text: group.items.length ? t('country.alsoFit') : t('country.regionalFit'),
      }));
      for (const r of alternatives) list.appendChild(destinationRow(r));
    }

    if (!group.items.length && !alternatives.length) {
      list.appendChild(el('div', { class: 'empty stack' }, [
        el('p', { text: t('country.none') }),
        el('button', { class: 'btn btn--quiet', text: t('country.pickAnother'), onclick: () => show('home') }),
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
        text: t('topup.showStatus'),
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
          t('topup.alreadyRunning') }));
      }

      return;
    }

    const options = Array.isArray(out.topup_options) ? out.topup_options : [];
    if (!options.length) return;

    box.appendChild(el('button', {
      class: 'btn btn--ghost',
      text: t('topup.action'),
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
      el('h2', { class: 'section', text: t('topup.sectionTitle') }),
      ...discovery.topup_options.map((o) => optionCard(esimId, discovery, o)),
    ]);

    if (discovery.purchase_enabled !== true) {
      list.appendChild(el('p', { class: 'small muted', text:
        t('topup.soon') }));
    }

    list.appendChild(el('button', {
      class: 'btn btn--quiet', text: t('common.hide'), onclick: () => renderTopups(esimId),
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
      el('span', { class: 'card__title', text: o.data_gb ? t('plan.gb', { n: o.data_gb }) : t('topup.package') }),
      el('span', {
        class: 'card__meta',
        text: o.validity_days
          ? `+${o.validity_days} ${dayWord(o.validity_days)}`
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
    const pay = el('button', { class: 'btn btn--wide', disabled: true, text: t('topup.payFor', { price: C.money(option.price_rub) }) });

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
      el('h2', { class: 'section', text: t('topup.confirmTitle') }),
      el('div', { class: 'card stack' }, [
        el('div', { class: 'row row--between' }, [
          el('span', { text: option.data_gb ? t('plan.gb', { n: option.data_gb }) : t('topup.package') }),
          el('strong', { class: 'tabular', text: C.money(option.price_rub) }),
        ]),
        option.validity_days
          ? el('p', { class: 'small muted', text:
            t('topup.validFor', { n: option.validity_days, word: dayWord(option.validity_days) }) })
          : el('span'),
        el('p', { class: 'small muted', text: t('topup.addsTo') }),
      ]),
      el('h3', { class: 'section', text: t('checkout.method') }),
      el('div', { class: 'row' }, [
        methodButton('sbp', t('checkout.sbp')),
        methodButton('card', t('topup.card')),
      ]),
      el('label', { class: 'row topup-terms-row' }, [
        terms,
        el('span', { class: 'small' }, [
          document.createTextNode(`${t('terms.iAccept')} `),
          el('a', {
            href: '#', text: t('terms.offerConditions'),
            onclick: (e) => { e.preventDefault(); openExternal('https://magicesim.store/terms.html'); },
          }),
        ]),
      ]),
      err,
      pay,
      el('button', { class: 'btn btn--quiet', text: t('common.back'), onclick: () => renderTopups(esimId) }),
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
      err.appendChild(errorNotice(t('checkout.needTerms')));

      return;
    }

    // The guard against the second tap. The server makes a repeat safe — the
    // intent owns at most one order and one payment — but disabling the button
    // is what stops the customer having to find that out.
    pay.disabled = true;
    clear(pay);
    pay.appendChild(el('span', { class: 'btn__spinner' }));
    pay.appendChild(document.createTextNode(t('topup.preparing')));
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
          t('topup.payFailed')
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
    pay.appendChild(document.createTextNode(t('topup.payFor', { price: C.money(option.price_rub) })));
  }

  /**
   * A refusal, in words a customer can act on.
   *
   * A closed map. The server already speaks a closed vocabulary and sends its
   * own Russian sentence; this exists so a code THIS build does not know still
   * produces something useful, and so nothing technical is ever echoed.
   */
  /**
   * The promo sentence, in the customer's language.
   *
   * In Russian this is exactly C.promoMessage() — the same closed map, the same
   * fallback — so the Russian promo screen is byte-for-byte what it was.
   */
  function promoText(code) {
    if (I.lang() !== 'en') return C.promoMessage(code);

    return C.errorText(code, 'en') || t('errors.promoFallback');
  }

  function topupErrorText(e) {
    if (I.lang() === 'en') {
      const known = C.errorText(e && e.code, 'en');
      if (known) return known;
      // The transport sentence is a PROMISE — that a dropped connection has not
      // created a second top-up — so it survives into English as itself rather
      // than collapsing into the generic apology.
      if (e && e.isTransport) return t('errors.topupTransport');

      return t('errors.topupFallback');
    }

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

    $('#topup-title').textContent = t('topup.title');
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
        el('span', { text: out.data_gb ? t('plan.gb', { n: out.data_gb }) : t('topup.package') }),
        el('span', { class: 'tabular', text: out.price_rub ? C.money(out.price_rub) : '' }),
      ]));
    }
    body.appendChild(card);

    // Still payable: the way back to the payment page, from the server's own
    // link and never from anything this screen invented.
    if (out.status === 'awaiting_payment' && out.payment_url && C.isAllowedPaymentUrl(out.payment_url)) {
      body.appendChild(el('button', {
        class: 'btn btn--wide', text: t('topup.goToPayment'),
        onclick: () => openExternal(out.payment_url),
      }));
    }

    if (out.status === 'completed') {
      body.appendChild(el('button', {
        class: 'btn btn--wide', text: t('topup.toMyEsims'),
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
        class: 'btn btn--quiet', text: t('common.refresh'),
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
    $('#topup-title').textContent = t('topup.checkingState');

    if (e && e.status === 404) {
      clearPendingTopup();
      body.appendChild(el('p', { class: 'muted', text: t('topup.notFound') }));
      body.appendChild(el('button', {
        class: 'btn btn--wide', text: t('topup.toMyEsims'),
        onclick: () => { void renderEsims(); show('esims'); },
      }));

      return;
    }

    body.appendChild(el('p', { class: 'muted', text:
      t('topup.noServer') }));
    body.appendChild(el('button', {
      class: 'btn btn--wide', text: t('topup.checkAgain'),
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
      q: () => t('faq.install.q'),
      a: () => t('faq.install.a'),
    },
    {
      q: () => t('faq.phone.q'),
      a: () => t('faq.phone.a'),
    },
    {
      q: () => t('faq.term.q'),
      a: () => t('faq.term.a'),
    },
    {
      q: () => t('faq.paid.q'),
      a: () => t('faq.paid.a'),
    },
    {
      q: () => t('faq.noNet.q'),
      a: () => t('faq.noNet.a'),
    },
    {
      q: () => t('faq.refund.q'),
      a: () => t('faq.refund.a'),
    },
  ]);

  /* ------------------------------------------------------------------ *
   * Screen: account settings
   *
   * WHAT IS HERE, and just as deliberately what is NOT.
   *
   * The proven addresses are here because they are the one account-level thing
   * a customer owns, can act on, and until now could not reach: `revoke` has
   * been implemented on the backend and open at the gateway since S13 shipped,
   * with no interface anywhere. Somebody who connected a mailbox could not
   * disconnect it.
   *
   * THE RULE THAT GOVERNS EVERY CONTROL HERE: it may not lie. Both of the
   * things this screen used to refuse are now here, and each arrived only when
   * that rule was satisfied.
   *
   * There is a LANGUAGE control. It was refused for as long as the app had one
   * language — a picker with one option that changes nothing is a control that
   * lies, the same rule that keeps a greyed-out top-up button off an eSIM that
   * has none. There are two complete dictionaries now, so it offers two. What
   * the rule still demands is the honest part: most screens are Russian for the
   * moment, and the hint under the control says so in as many words. Delete
   * that sentence when it stops being true, and not one commit before.
   *
   * There is a NOTIFICATIONS toggle. It was refused for as long as every
   * message the bot sent was a reply to something the customer sent it — a
   * switch over messages that are never sent is the same lie in a different
   * shape. It exists now because the delivery engine does.
   *
   * Alongside them is the thing this screen was built for: the proven
   * addresses. `revoke` had been implemented on the backend and open at the
   * gateway since S13 shipped, with no interface anywhere — somebody who
   * connected a mailbox could not disconnect it.
   *
   * WHY THE FETCH AND THE PAINT ARE SEPARATE. `renderSettings` asks the server;
   * `paintSettings` draws what came back and nothing else. Changing the
   * language must not cost a round trip, and it must not flash a skeleton over
   * a screen the customer is already reading — on a bad gateway minute it would
   * flash an error notice instead, for a decision that never left the device.
   * ------------------------------------------------------------------ */

  // The last answer the server gave, so a language change can repaint from it
  // instead of asking again. Never used to decide anything — only to redraw
  // what the customer is already looking at.
  let lastMe = null;

  async function renderSettings() {
    const box = $('#settings-body');
    clear(box);
    box.appendChild(el('div', { class: 'skel skel--card' }));

    let me = null;
    try {
      me = await api.me();
    } catch {
      clear(box);
      box.appendChild(errorNotice(t('settings.loadFailed'), renderSettings));

      return;
    }

    lastMe = me;
    paintSettings(me);
  }

  function paintSettings(me) {
    const box = $('#settings-body');
    clear(box);

    /* ---- language --------------------------------------------------- */
    //
    // FIRST on the screen, and that is a decision rather than a default.
    // Choosing a language rebuilds this whole body, which collapses
    // `#settings-body` to nothing for an instant; the scroll position is
    // clamped to what is left, so a control near the bottom throws the
    // customer to the top of a screen that has just changed language under
    // them. Placed first, they tap and are still looking at what they tapped.
    // It is also the block that the person who most needs it — somebody who
    // cannot read the rest — must not have to scroll to find.
    box.appendChild(el('h2', { class: 'section', text: t('settings.language.section') }));
    box.appendChild(languagePicker());
    box.appendChild(el('p', { class: 'small muted', text: t('settings.language.hint') }));

    /* ---- connected addresses --------------------------------------- */
    box.appendChild(el('h2', { class: 'section', text: t('settings.email.section') }));

    const emails = (me && me.emails) || [];
    if (!emails.length) {
      box.appendChild(el('p', { class: 'small muted', text: t('settings.email.none') }));
      box.appendChild(el('button', {
        class: 'btn btn--ghost', text: t('settings.email.add'), onclick: openClaim,
      }));
    } else {
      box.appendChild(el('p', { class: 'small muted', text: t('settings.email.have') }));
      for (const m of emails) box.appendChild(emailRow(m));
    }

    /* ---- notifications, now that they are real ---------------------- */
    //
    // These toggles were deliberately NOT drawn when this screen shipped: there
    // was nothing behind them. Every message the bot sent was a reply, so a
    // switch would have governed messages that were never sent. They exist now
    // because the delivery engine does.
    box.appendChild(el('h2', { class: 'section', text: t('settings.notify.section') }));

    const prefs = (me && me.notifications) || { low_data: true, expiry: true };
    box.appendChild(el('div', { class: 'card stack' }, [
      // The first argument is an IDENTIFIER and the last two are copy. They are
      // never derived from each other: `low_data` is what the server is told,
      // and no translation can reach it.
      notifyToggle('low_data', prefs.low_data,
        t('settings.notify.lowData.title'), t('settings.notify.lowData.hint')),
      el('div', { class: 'settings__sep' }),
      notifyToggle('expiry', prefs.expiry,
        t('settings.notify.expiry.title'), t('settings.notify.expiry.hint')),
    ]));

    box.appendChild(el('p', { class: 'small muted', text: t('settings.notify.note') }));

    /* ---- account --------------------------------------------------- */
    if (me && me.customer && me.customer.created_at) {
      box.appendChild(el('h2', { class: 'section', text: t('settings.account.section') }));
      box.appendChild(el('div', { class: 'card stack' }, [
        el('div', { class: 'row row--between' }, [
          el('span', { class: 'small muted', text: t('settings.account.since') }),
          el('span', { class: 'small', text: I.formatDate(me.customer.created_at) }),
        ]),
        el('div', { class: 'row row--between' }, [
          el('span', { class: 'small muted', text: t('settings.account.orders') }),
          el('span', { class: 'small tabular', text: String((me.counts && me.counts.orders) || 0) }),
        ]),
        el('div', { class: 'row row--between' }, [
          el('span', { class: 'small muted', text: t('settings.account.esims') }),
          el('span', { class: 'small tabular', text: String((me.counts && me.counts.esims) || 0) }),
        ]),
      ]));
    }
  }

  /**
   * The RU/EN control.
   *
   * `.segmented`, because `mini.css` states the rule outright: "one idiom for
   * 'pick one of these', not two". It is the same component the payment method
   * uses, driven the same way — and it is built INLINE rather than as a bottom
   * sheet on purpose: `openSheet` closes whatever sheet is open first, and
   * there is exactly one of those, so a language sheet raised over the
   * disconnect confirmation would leave that confirmation's promise pending
   * forever and the flow dead.
   *
   * The two labels are endonyms — «Русский» and "English" — so they are
   * identical in both dictionaries and the control does not rewrite itself
   * under the finger that just used it. `.segmented` is `1fr 1fr`, so neither
   * label can widen a cell either.
   *
   * `aria-checked` is passed as a STRING. `el()` drops an attribute whose value
   * is `false`, so the unselected option would otherwise ship with no state at
   * all and a screen reader would announce a radio that is neither on nor off.
   */
  function languageOption(code, label) {
    return el('button', {
      type: 'button', class: 'segmented__opt', 'data-lang': code,
      role: 'radio', 'aria-checked': String(code === I.lang()),
      text: label,
      onclick: () => {
        if (code === I.lang()) return;
        haptic('light');
        I.setLang(code);
      },
    });
  }

  function languagePicker() {
    // Both keys spelled out rather than built from the code. A key assembled at
    // runtime cannot be found by the check that every key the app asks for
    // exists — and the failure mode of that check is somebody deleting a live
    // key to make it green.
    return el('div', {
      class: 'segmented', id: 'settings-language',
      role: 'radiogroup', 'aria-label': t('settings.language.section'),
    }, [
      languageOption('ru', t('settings.language.ru')),
      languageOption('en', t('settings.language.en')),
    ]);
  }

  /**
   * One notification switch.
   *
   * A real checkbox, not a styled div: it is focusable, it announces its own
   * state, and it works with a keyboard on Telegram Desktop for free.
   *
   * OPTIMISTIC, then corrected. The switch moves immediately because a control
   * that waits for a round trip before responding feels broken on a phone; if
   * the server refuses, it moves back and says so. What it must never do is
   * show one thing while the server believes another.
   */
  function notifyToggle(key, initial, title, hint) {
    const input = el('input', {
      type: 'checkbox', class: 'switch__input', id: `notify-${key}`,
      'aria-describedby': `notify-${key}-hint`,
    });
    input.checked = initial !== false;

    input.addEventListener('change', async () => {
      const want = input.checked;
      input.disabled = true;
      try {
        // ONLY the switch that changed. The other one is absent from the body,
        // which the server reads as "leave it alone".
        const out = await api.setNotificationPrefs({ [key]: want });
        // Believe the server, not the tap: if it answered something else, that
        // is what is true.
        input.checked = out && typeof out[key] === 'boolean' ? out[key] : want;
        haptic('light');
      } catch {
        input.checked = !want;
        toast(t('settings.notify.saveFailed'));
      } finally {
        input.disabled = false;
      }
    });

    return el('label', { class: 'switch', for: `notify-${key}` }, [
      el('span', { class: 'switch__body' }, [
        el('span', { class: 'switch__title', text: title }),
        el('span', { class: 'switch__hint', id: `notify-${key}-hint`, text: hint }),
      ]),
      input,
    ]);
  }

  /**
   * One proven address, with the one thing that can be done to it.
   *
   * The warning before disconnecting is exact rather than soothing: revoking
   * does NOT unlink the purchases that address already authorised, and a
   * customer who expected it to would be surprised in the wrong direction. It
   * stops FUTURE purchases from attaching by themselves.
   */
  function emailRow(m) {
    return el('div', { class: 'card row row--between settings__row' }, [
      el('span', { class: 'card__body' }, [
        el('span', { class: 'card__title', text: m.masked }),
        // Two keys, not one with an empty date: a merged key would render the
        // literal «подтверждён {date}» on a row whose date never arrived.
        el('span', { class: 'card__meta', text: m.verified_at
          ? t('settings.email.verifiedAt', { date: I.formatDate(m.verified_at) })
          : t('settings.email.verified') }),
      ]),
      el('button', {
        class: 'btn btn--quiet settings__act', text: t('settings.email.disconnect'),
        /**
         * ONE revoke per intention, and the guard goes on BEFORE the question,
         * not after it.
         *
         * Two separate windows were open here. The obvious one is the request:
         * the sheet closes on «Отключить», `revokeEmail` is in flight, and the
         * row's button is live again for as long as that takes — a second tap
         * asks the server to revoke the same address twice.
         *
         * The other one is worse and is the reason the guard is not simply
         * wrapped around the request. There is exactly ONE sheet element in
         * this file, and `openSheet` closes whatever is open before it opens
         * anything. A second entry into this handler while the first
         * confirmation is still up therefore tears out the DOM the first
         * `confirmSheet` promise is waiting on — and that promise resolves only
         * from a click inside its own sheet, so it never settles and this
         * `await` never returns. The scrim stops a finger from doing it; a
         * keyboard cannot be stopped that way, because focus is not trapped.
         *
         * `disabled` rather than a flag: it is also what tells the customer,
         * and `.btn[disabled]` already dims it without changing its width — the
         * width being the thing this row has a budget for.
         */
        onclick: async (event) => {
          const btn = event.currentTarget;
          if (btn.disabled) return;
          btn.disabled = true;

          try {
            const ok = await confirmSheet(
              t('settings.email.disconnectConfirm'),
              { confirmText: t('settings.email.disconnectAction') }
            );
            if (!ok) return;

            await api.revokeEmail(m.id);
            haptic('light');
            notifySuccess();
            // Replaces this row entirely, so the re-enable below lands on a
            // node nobody can see any more. That is the intended end state.
            await renderSettings();
          } catch {
            toast(t('settings.email.disconnectFailed'));
          } finally {
            btn.disabled = false;
          }
        },
      }),
    ]);
  }

  function renderHelp() {
    const box = $('#help-body');
    clear(box);

    box.appendChild(el('p', { class: 'muted', text:
      t('help.intro') }));

    box.appendChild(el('div', { class: 'stack' },
      // `topic`, not `t`: `t` is the translation function in this file now, and
      // a loop parameter shadowing it would make a `t('…')` call inside this
      // callback silently mean something else.
      HELP_TOPICS.map((topic) => el('details', { class: 'card sheet' }, [
        // Called, not read: each topic holds a FUNCTION so the question and
        // answer are resolved at render time and follow a language change.
        // A frozen table of strings would have been captured in whichever
        // language happened to be active when the module loaded.
        el('summary', { class: 'sheet__head', text: topic.q() }),
        el('p', { class: 'small', text: topic.a() }),
      ]))));

    box.appendChild(el('h2', { class: 'section', text: t('help.installGuides') }));
    box.appendChild(el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn--quiet', text: t('help.iphone'),
        onclick: () => openExternal('https://magicesim.store/iphone.html'),
      }),
      el('button', {
        class: 'btn btn--quiet', text: t('tariff.androidGuide'),
        onclick: () => openExternal('https://magicesim.store/android.html'),
      }),
    ]));

    // Account settings. Placed here rather than as a fifth tab: four tabs are
    // already tight at 390px, and mini.css warns in as many words that a fifth
    // starts truncating labels.
    box.appendChild(el('h2', { class: 'section', text: t('help.account') }));
    box.appendChild(el('button', {
      class: 'btn btn--ghost', text: t('settings.title'),
      onclick: () => { show('settings'); void renderSettings(); },
    }));

    box.appendChild(el('h2', { class: 'section', text: t('help.noAnswer') }));
    // The order ref rides along when there is one, so the operator opens the
    // conversation already knowing which purchase it is about.
    box.appendChild(supportButton(state.lastOrder || null));

    box.appendChild(el('div', { class: 'stack gap-top-lg' }, [
      el('button', {
        class: 'btn btn--quiet', text: t('help.offer'),
        onclick: () => openExternal('https://magicesim.store/terms.html'),
      }),
      el('button', {
        class: 'btn btn--quiet', text: t('help.privacy'),
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
      || C.destinationTitle(p.name, p.country_code, p);

    const D = C.dailyCopy();
    const isDaily = !!(D && D.isDaily(p));
    const terms = isDaily ? C.dailyTerms(p) : [];
    // The term is the product, so it is chosen here rather than assumed. The
    // first is preselected: a screen that can be in a "nothing chosen" state is
    // a screen you cannot buy from.
    state.dailyTerm = terms.length ? terms[0] : null;

    // 1. Header — what, how much, for how long, for how many.
    box.appendChild(el('div', { class: 'card stack' }, [
      el('div', { class: 'row' }, [
        el('span', { class: 'card__flag', text: C.flagFor(p.country_code, p) }),
        el('h1', { text: title }),
      ]),
      el('div', { class: 'row row--between' }, [
        el('span', {
          class: 'card__title',
          text: isDaily
            ? t('daily.perDay', { allowance: D.formatAllowance(p.daily_gb) })
            : (p.unlimited ? t('plan.unlimited') : t('plan.gb', { n: p.data_gb })),
        }),
        el('strong', {
          class: 'card__price tabular',
          id: 'tariff-price',
          text: isDaily
            ? (state.dailyTerm ? C.money(state.dailyTerm.price) : '—')
            : C.money(p.price),
        }),
      ]),
      isDaily
        // Every line from the shared module; the screen composes none of its
        // own. The validity line is absent for a per-day plan because the row
        // has no term until one is chosen below.
        ? el('div', { class: 'stack' }, D.lines(p).slice(1).map((l) => el('div', {
          class: 'card__meta', text: l.text,
        })))
        : el('div', {
          class: 'card__meta',
          text: `${days} ${dayWord(days)}`,
        }),
    ]));

    // 1b. The term, and what it costs. Prices are the server's finished
    // `term_prices`; nothing here multiplies anything.
    if (isDaily && terms.length) box.appendChild(dailyTermPicker(p, terms));

    // 2 & 3. Coverage and characteristics — the same sheet the site shows, in
    // the same order and under the same labels («Покрытие и условия»).
    const coverage = Array.isArray(p.coverage_country_codes) ? p.coverage_country_codes : [];
    const facts = C.tariffFacts(p, I.lang());
    if (facts.length) {
      box.appendChild(el('div', { class: 'card stack' }, [
        el('h2', { class: 'section', text: t('tariff.coverageConditions') }),
        el('div', { class: 'row row--between fact' }, [
          el('span', { class: 'muted', text: t('tariff.coverage') }),
          el('span', { class: 'fact__value', text: C.coverageSummary(p, I.lang()) }),
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
      el('h2', { class: 'section', text: t('tariff.afterPayment') }),
      ...C.AFTER_PAYMENT_STEPS.map((t, i) => el('div', { class: 'row step' }, [
        el('span', { class: 'step__n', text: String(i + 1) }),
        el('span', { class: 'small', text: t }),
      ])),
    ]));

    // A daily plan with no priced ladder cannot be bought: a term we cannot
    // price is a term we cannot sell, and inventing one here would be the app
    // deciding what somebody pays.
    if (isDaily && !terms.length) {
      box.appendChild(el('p', {
        class: 'small muted',
        text: t('tariff.unavailable'),
      }));
      return;
    }

    box.appendChild(el('button', {
      class: 'btn btn--wide',
      id: 'tariff-buy',
      text: t('tariff.buyFor', { price: C.money(isDaily ? state.dailyTerm.price : p.price) }),
      onclick: () => openCheckout(p, group, isDaily ? state.dailyTerm : null),
    }));
  }

  /**
   * The term chooser. A radio group, because picking one unpicks the others and
   * exactly one is always picked.
   *
   * Selecting a term rewrites the header price and the buy button in place, so
   * what the screen says and what the next screen charges cannot disagree.
   */
  function dailyTermPicker(pkg, terms) {
    const D = C.dailyCopy();
    const rows = terms.map((t) => el('button', {
      class: 'row row--between daily-term' + (t === terms[0] ? ' is-selected' : ''),
      role: 'radio',
      'aria-checked': t === terms[0] ? 'true' : 'false',
      onclick: (ev) => {
        state.dailyTerm = t;
        const groupEl = ev.currentTarget.parentNode;
        for (const child of groupEl.children) {
          const on = child === ev.currentTarget;
          child.classList.toggle('is-selected', on);
          child.setAttribute('aria-checked', on ? 'true' : 'false');
        }
        const price = $('#tariff-price');
        if (price) price.textContent = C.money(t.price);
        const buy = $('#tariff-buy');
        if (buy) buy.textContent = t('tariff.buyFor', { price: C.money(t.price) });
      },
    }, [
      el('span', { class: 'muted', text: `${t.days} ${D.pluralDays(t.days)}` }),
      el('span', { class: 'fact__value tabular', text: C.money(t.price) }),
    ]));

    return el('div', { class: 'card stack' }, [
      el('h2', { class: 'section', text: t('tariff.term') }),
      el('div', { class: 'stack', role: 'radiogroup', 'aria-label': t('tariff.term') }, rows),
    ]);
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
      el('summary', { class: 'sheet__head', text: t('tariff.coverageCount', { countries: countryCount(codes.length) }) }),
      names.length
        ? body
        : el('p', { class: 'small muted', text: t('tariff.worksIn', { countries: countryCount(codes.length) }) }),
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
      el('summary', { class: 'sheet__head', text: t('tariff.willItWork') }),
      el('p', { class: 'small', text:
        t('compat.iphone') }),
      el('p', { class: 'small', text:
        t('compat.android') }),
      el('p', { class: 'small muted', text:
        'Поддержка зависит и от региональной версии устройства, поэтому проверка в настройках надёжнее списка моделей. Телефон не должен быть заблокирован под одного оператора.' }),
      el('div', { class: 'row' }, [
        el('button', {
          class: 'btn btn--quiet', text: t('tariff.iphoneGuide'),
          onclick: () => openExternal('https://magicesim.store/iphone.html'),
        }),
        el('button', {
          class: 'btn btn--quiet', text: t('tariff.androidGuide'),
          onclick: () => openExternal('https://magicesim.store/android.html'),
        }),
      ]),
    ]);
  }

  /* ------------------------------------------------------------------ *
   * Screen: checkout
   * ------------------------------------------------------------------ */

  function openCheckout(pkg, group, dailyTerm) {
    // `pkg.country` does not exist in the catalogue DTO, so this line used to
    // render " · 3 ГБ" with an empty space where the destination should be. The
    // name comes from the group the customer navigated through, or from the
    // dictionary as a fallback.
    const where = (group && group.country) || C.countryLabel(pkg.country_code);
    // For a tariff sold by the day the term came from the previous screen; the
    // catalogue row has none. Everything below — the summary, the amount the
    // server is told to expect, the idempotency scope — reads this one value,
    // so there is no path by which the screen and the order disagree.
    const days = dailyTerm ? Number(dailyTerm.days) : Number(pkg.validity_days);

    state.intent = {
      package_id: pkg.package_id,
      // Sent only for daily plans. The server validates it against its own
      // ladder and computes the amount.
      days: dailyTerm ? Number(dailyTerm.days) : undefined,
      // §9 S4: sbp or card, nothing else. SBP is the default on both surfaces
      // and is the cheaper rail; it was hard-coded to 'card' here with no way
      // to see or change it.
      payment_type: 'sbp',
      email: '',
      // An assertion about what was SHOWN, and for a daily plan what was shown
      // is the chosen term's price — never the row's, which is one day.
      expected_amount_rub: Number(dailyTerm ? dailyTerm.price : pkg.price),
      _pkg: pkg,
      _where: where,
      // Kept so the summary can be rebuilt when a promo changes the total —
      // the flag and the destination name come from the group the customer
      // navigated through, not from the package DTO.
      _group: group,
    };
    state.termsAccepted = false;

    // A fresh checkout is a fresh intent: any code applied to the previous
    // tariff is dropped, never carried over. Applying a promo to a package the
    // customer is no longer buying is how a discount ends up on the wrong
    // order.
    state.promo = null;
    state.promoDisabled = false;

    renderCheckoutSummary(pkg, group, where, days);
    renderPromoBlock();

    // Blueprint §9 S4: «Согласие с офертой — обязательно. Явное действие.
    // Предустановленной галочки быть не может.» The app was sending
    // terms_accepted: true unconditionally, which is an acceptance nobody made.
    // A fresh intent starts on SBP every time, however the last one ended.
    setPaymentMethod('sbp');

    const terms = $('#checkout-terms');
    terms.checked = false;
    $('#checkout-error').replaceChildren();
    $('#checkout-email').value = '';
    setPayEnabled(false, t('topup.payFor', { price: C.money(pkg.price) }));
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
  /* ------------------------------------------------------------------ *
   * Checkout price, and the promo code that may change it
   *
   * ONE RULE GOVERNS EVERYTHING BELOW: the client never computes a price. Every
   * number on this screen is either the catalogue's own or one the server
   * returned from /api/v1/retail/promo/quote — the SAME endpoint the website
   * calls, which is the only place that knows about validity windows, usage and
   * per-email limits, first-purchase rules, country and package restrictions
   * and the minimum-margin guard.
   *
   * `expected_amount_rub` then carries the server's number back to the order,
   * where `onOrderCreated` compares it against what the checkout independently
   * recomputed inside the transaction and aborts on a mismatch. So the case the
   * brief warns about — intent created at 500, promo applied, Platega still
   * charged 500 — cannot occur: the order would refuse rather than charge the
   * wrong amount.
   * ------------------------------------------------------------------ */

  function renderCheckoutSummary(pkg, group, where, days) {
    const promo = state.promo;
    const D = C.dailyCopy();
    const isDaily = !!(D && D.isDaily(pkg));
    // For a daily plan the row's own price is the price of ONE DAY, so the
    // amount the summary shows is the intent's — the term the customer chose.
    const base = Number(isDaily && state.intent ? state.intent.expected_amount_rub : pkg.price);

    const rows = [
      el('div', { class: 'row' }, [
        el('span', { class: 'card__flag', text: (group && group.flag) || C.flagFor(pkg.country_code, pkg) }),
        el('span', { class: 'card__body' }, [
          el('span', { class: 'card__title', text: where }),
          el('span', {
            class: 'card__meta',
            // «1 ГБ в день · 7 дней», never «null ГБ»: data_gb is meaningless on
            // a daily row and the allowance is the offer.
            text: (isDaily
              ? t('daily.perDay', { allowance: D.formatAllowance(pkg.daily_gb) })
              : (pkg.unlimited ? t('plan.unlimited') : t('plan.gb', { n: pkg.data_gb })))
              + ` · ${days} ${dayWord(days)}`,
          }),
        ]),
      ]),
    ];

    // The two extra lines appear ONLY with a real discount, so an ordinary
    // purchase still reads as one price rather than as arithmetic.
    if (promo) {
      rows.push(el('div', { class: 'row row--between' }, [
        el('span', { class: 'small muted', text: t('checkout.plan') }),
        el('span', { class: 'small tabular muted', text: C.money(promo.original) }),
      ]));
      rows.push(el('div', { class: 'row row--between' }, [
        el('span', { class: 'small muted', text: t('promo.withCode', { code: promo.code }) }),
        el('span', { class: 'small tabular co-discount', text: `−${C.money(promo.discount)}` }),
      ]));
    }

    rows.push(el('div', { class: 'row row--between checkout-total' }, [
      el('span', { class: 'muted', text: t('checkout.total') }),
      el('strong', { class: 'tabular', text: C.money(promo ? promo.final : base) }),
    ]));

    $('#checkout-summary').replaceChildren(el('div', { class: 'card stack' }, rows));

    // The amount the order will be checked against — the SERVER's number when a
    // promo is applied, the catalogue's otherwise. Never arithmetic done here.
    if (state.intent) state.intent.expected_amount_rub = promo ? promo.final : base;
  }

  const repaintCheckout = () => {
    const i = state.intent;
    if (!i || !i._pkg) return;
    renderCheckoutSummary(i._pkg, i._group, i._where,
      Number(i._pkg.validity_days));
  };

  /**
   * The promo block, in its three states: closed, open, applied.
   *
   * Removed entirely when the backend answers PROMO_CODES_DISABLED — a field
   * that cannot succeed is worse than no field, and that is the same signal the
   * website acts on.
   */
  function renderPromoBlock(message) {
    const box = $('#checkout-promo');
    if (!box) return;
    clear(box);
    if (state.promoDisabled) return;

    const promo = state.promo;

    if (promo) {
      box.appendChild(el('div', { class: 'card row row--between promo-applied' }, [
        el('span', { class: 'card__body' }, [
          el('span', { class: 'card__title', text: t('promo.applied') }),
          el('span', { class: 'card__meta', text: `${promo.code} · −${C.money(promo.discount)}` }),
        ]),
        el('button', {
          class: 'btn btn--quiet promo__act', text: t('promo.remove'),
          onclick: () => {
            // Dropping the code restores the catalogue price by RE-READING it,
            // not by adding the discount back — the same rule as everywhere
            // else on this screen.
            state.promo = null;
            state.promoOpen = true;
            repaintCheckout();
            renderPromoBlock();
          },
        }),
      ]));

      return;
    }

    if (!state.promoOpen) {
      box.appendChild(el('button', {
        class: 'btn btn--quiet promo__toggle', text: t('promo.have'),
        onclick: () => { state.promoOpen = true; renderPromoBlock(); },
      }));

      return;
    }

    const input = el('input', {
      class: 'input', type: 'text', id: 'checkout-promo-input',
      placeholder: t('promo.label'), value: state.promoDraft || '',
      autocapitalize: 'characters', autocorrect: 'off', spellcheck: 'false',
      'aria-label': t('promo.label'),
    });
    const apply = el('button', { class: 'btn btn--ghost promo__act' });
    setBusy(apply, false, t('promo.apply'));

    const run = async () => {
      const code = C.normalisePromoCode(input.value);
      state.promoDraft = code;
      input.value = code;
      if (!code) { renderPromoBlock(t('promo.enter')); return; }

      setBusy(apply, true, t('promo.checking'));
      const out = await quotePromo(code);
      setBusy(apply, false, t('promo.apply'));

      if (out.ok) { state.promoDraft = ''; repaintCheckout(); renderPromoBlock(); return; }
      if (state.promoDisabled) { renderPromoBlock(); return; }
      renderPromoBlock(out.message);
    };

    apply.addEventListener('click', run);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });

    box.appendChild(el('div', { class: 'promo__row' }, [input, apply]));
    if (message) box.appendChild(el('p', { class: 'small promo__err', text: message }));
  }

  /**
   * Ask the server what a code is worth. The ONLY place a discount comes from.
   *
   * A network failure is reported as a failure rather than guessed at: there is
   * no local rule that could stand in for the one on the server, and inventing
   * one is how an app shows a discount the payment does not honour.
   */
  async function quotePromo(code) {
    const i = state.intent;
    if (!i) return { ok: false, message: promoText('') };

    let data = null;
    try {
      data = await api.promoQuote({
        code,
        packageId: i.package_id,
        paymentType: i.payment_type,
        email: String($('#checkout-email').value || '').trim(),
      });
    } catch (err) {
      const body = (err && err.body) || {};

      if (body.error === 'PROMO_CODES_DISABLED') {
        state.promoDisabled = true;
        state.promo = null;
        repaintCheckout();

        return { ok: false, message: promoText('PROMO_CODES_DISABLED') };
      }

      /*
       * A REFUSAL and a FAILURE are not the same thing, and the difference
       * decides whether a discount survives.
       *
       * A body with an `error` code is the server having looked and said no —
       * 409 PROMO_CODE_EMAIL_LIMIT_REACHED is exactly that, and it arrives here
       * rather than below because a 409 throws. The discount must go: leaving
       * «−75 ₽» on screen after the server refused the code is a price the
       * payment will not honour, and the customer would find out at Platega.
       * A test caught this — the discount stayed.
       *
       * No body is a NETWORK failure, and there the applied code is kept on
       * purpose: we have not been told anything, and the order re-validates in
       * its own transaction anyway, so a stale screen can cost a refused order
       * but never a wrong charge.
       */
      if (body.error) {
        state.promo = null;
        repaintCheckout();

        return { ok: false, message: promoText(body.error) };
      }

      return { ok: false, message: t('promo.checkFailed') };
    }

    if (data && data.error === 'PROMO_CODES_DISABLED') {
      state.promoDisabled = true;
      state.promo = null;
      repaintCheckout();

      return { ok: false, message: promoText('PROMO_CODES_DISABLED') };
    }

    const quote = C.readPromoQuote(data, code);
    if (!quote) {
      state.promo = null;
      repaintCheckout();

      return { ok: false, message: promoText(data && data.error) };
    }

    state.promo = quote;

    return { ok: true };
  }

  /**
   * Re-check an APPLIED code when something it depends on changes.
   *
   * The payment type and the email both feed the server's answer — per-email
   * and first-purchase limits cannot be evaluated without an address, and the
   * quote takes the payment type. A stale discount on screen would be a price
   * the payment does not honour.
   *
   * A network error deliberately KEEPS the current promo: the order re-validates
   * inside its own transaction and aborts on a mismatch, so a stale screen can
   * cost a refused order but never a wrong charge.
   */
  async function revalidatePromo() {
    if (!state.promo || state.promoDisabled) return;
    const out = await quotePromo(state.promo.code);
    repaintCheckout();
    renderPromoBlock(out.ok ? undefined : out.message);
  }

  function setPaymentMethod(method) {
    const chosen = method === 'card' ? 'card' : 'sbp';
    const changed = state.intent && state.intent.payment_type !== chosen;
    if (state.intent) state.intent.payment_type = chosen;

    for (const btn of document.querySelectorAll('#checkout-methods .segmented__opt')) {
      btn.setAttribute('aria-checked', String(btn.dataset.method === chosen));
    }

    // The quote takes the payment type, so a switch has to be re-priced. It
    // also mints a NEW idempotency key by itself — the fingerprint in
    // purchaseIntentKey already spans package, payment type, promo and email —
    // so changing rails cannot replay the previous intent's amount.
    if (changed) void revalidatePromo();
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
      label || (enabled ? t('checkout.pay') : (busy ? t('checkout.creating') : t('checkout.pay')))
    ));
  }

  async function pay() {
    const email = String($('#checkout-email').value || '').trim();
    const errBox = $('#checkout-error');
    errBox.replaceChildren();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errBox.appendChild(errorNotice(t('checkout.needEmail')));
      return;
    }
    if (state.termsAccepted !== true) {
      errBox.appendChild(errorNotice(t('checkout.needTerms')));
      return;
    }

    // The guard against the second tap. The idempotency key makes a repeat safe
    // on the server; disabling the button is what stops the customer having to
    // find out.
    setPayEnabled(false, null, { busy: true });
    state.intent.email = email;
    state.intent.terms_accepted = state.termsAccepted === true;

    /*
     * The promo travels as a CODE, never as a discount.
     *
     * `expected_amount_rub` is the server's own number from the quote — set by
     * renderCheckoutSummary, never computed here. The checkout re-validates the
     * code and recomputes the price inside the order transaction and aborts on
     * a mismatch (AMOUNT_CHANGED), so a stale screen costs a refused order and
     * never a wrong charge.
     *
     * It is also part of the idempotency fingerprint — purchaseIntentKey spans
     * package, payment type, promo and email — so applying, changing or
     * removing a code mints a new key by itself. The intent created at the full
     * price cannot be replayed at the discounted one, or the reverse.
     */
    state.intent.promo_code = state.promo ? state.promo.code : undefined;
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
            t('checkout.payFailed')
          ));
          errBox.appendChild(supportButton({ public_order_token: out.public_order_token }));
        } else {
          setPayEnabled(false, t('checkout.opening'), { busy: true });
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
          actual ? t('checkout.priceChanged', { price: C.money(actual) })
            : t('checkout.priceChangedPlain')
        ));
        if (actual) {
          state.intent.expected_amount_rub = Number(actual);
          api.forgetIntent(state.intent);   // a new price is a new intent
        }
        return;
      }
      if (err.code === 'PROMO_REJECTED') {
        errBox.appendChild(errorNotice(t('checkout.promoDropped')));
        return;
      }
      if (err.isTransport) {
        // The order may or may not exist. Saying so is better than guessing, and
        // the key means retrying cannot double-charge.
        errBox.appendChild(errorNotice(
          t('checkout.confirmLost'),
          null
        ));
        return;
      }
      errBox.appendChild(errorNotice(
        enOr(serverErrorText(err), t('errors.orderFallback'))
        || err.message || t('errors.orderFallback')
      ));
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
      text: t('support.write'),
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
    awaiting_payment: { key: 'awaiting', spin: true },
    paid: { key: 'paid', spin: true },
    provisioning: { key: 'provisioning', spin: true },
    ready: { key: 'ready', spin: false },
    failed: { key: 'failed', spin: false },
    canceled: { key: 'canceled', spin: false },

    // Aliases for the internal vocabulary.
    purchasing_esim: { key: 'provisioning', spin: true },
    completed: { key: 'ready', spin: false },
    cancelled: { key: 'canceled', spin: false },
    refunded: { key: 'refunded', spin: false },
  });

  /**
   * The title and note for a stage, resolved when it is rendered.
   *
   * The table above holds a KEY rather than a sentence so that the aliases stay
   * visibly the same stage — `completed` and `ready` point at one entry instead
   * of at two copies of a sentence that could drift apart. The seven titles are
   * spelled out here, literally, because t() may never be handed a computed
   * key: a computed key is invisible to the scanner that proves the dictionary
   * has no dead entries.
   */
  const ORDER_STAGE_TEXT = {
    awaiting: () => ({ title: t('order.awaiting.title'), note: t('order.awaiting.note') }),
    paid: () => ({ title: t('order.paid.title'), note: t('order.paid.note') }),
    provisioning: () => ({ title: t('order.provisioning.title'), note: t('order.provisioning.note') }),
    ready: () => ({ title: t('order.ready.title'), note: t('order.ready.note') }),
    failed: () => ({ title: t('order.failed.title'), note: t('order.failed.note') }),
    canceled: () => ({ title: t('order.canceled.title'), note: t('order.canceled.note') }),
    refunded: () => ({ title: t('order.refunded.title'), note: t('order.refunded.note') }),
  };

  /** A stage with its words filled in, or null when the status is unknown. */
  function orderStage(status) {
    const row = ORDER_STAGE[status] || null;
    if (!row) return null;
    const words = ORDER_STAGE_TEXT[row.key]();

    return { title: words.title, note: words.note, spin: row.spin };
  }

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
        $('#order-title').textContent = stale ? t('order.checkFailed') : t('order.notFound');
        body.appendChild(el('p', { class: 'muted', text: stale
          ? t('order.staleNote')
          : t('order.notFoundNote') }));
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
      const stage = orderStage(st);
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
          class: 'btn btn--ghost btn--wide', text: t('common.refresh'),
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
        paintClaimCode(
          email,
          enOr(serverErrorText(err), t('errors.codeCheckFallback'))
            || body.message || 'Не удалось проверить код. Попробуйте ещё раз.',
          body.attempts_left
        );
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

    // The way out of a wait that will not end.
    //
    // The server answers a request identically whether it mailed a code or
    // deliberately did not — rate limited, malformed, or an address somebody
    // else has already proven. That sameness is the anti-enumeration property
    // and must not be weakened: a screen that said «this address is taken»
    // would turn the form into a lookup for whether an address is registered.
    //
    // So this line names no cause. It is the same advice whatever happened,
    // and it is useful in every one of those cases: check the address, try
    // another. Someone waiting on a code that was never sent gets a next step
    // instead of a spinner, and someone who simply mistyped gets the same
    // nudge — which is exactly why it gives nothing away.
    box.appendChild(el('p', { class: 'small muted', text:
      'Если письмо не пришло за пару минут — проверьте адрес и попробуйте другой.' }));
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
  function confirmSheet(message, { confirmText = null, tone = '' } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      const finish = (value) => { if (answered) return; answered = true; closeSheet(); resolve(value); };

      openSheet(t('common.confirmTitle'), [
        el('p', { class: 'muted', text: message }),
        el('button', {
          class: `btn btn--wide ${tone}`.trim(), text: confirmText || t('common.continue'),
          onclick: () => finish(true),
        }),
        el('button', { class: 'btn btn--quiet', text: t('common.cancel'), onclick: () => finish(false) }),
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
        err.textContent = enOr(serverErrorText(ex), t('errors.renameFallback'))
          || (ex && ex.body && ex.body.message) || 'Не удалось сохранить название.';
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
      // I.formatDate, not toLocaleDateString('ru-RU'): the engine formats by
      // hand precisely because ICU differs across the WebViews this app runs
      // in, and a hardcoded locale would have kept this date Russian in English.
      el('div', {
        class: 'small muted',
        text: e.expires_at ? t('esim.validUntil', { date: I.formatDate(e.expires_at) }) : '',
      }),
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
    // FIRST, before anything is shown. The shell ships its Russian text in the
    // markup — that is what makes the first paint correct for the language
    // almost everybody is in, with no flash and no second copy of the copy to
    // keep in step — and this is the moment it becomes English if it should be.
    //
    // Called from here rather than from a DOMContentLoaded listener inside
    // i18n.js: the order would then depend on which script registered first,
    // and `boot()` itself has a second entry point for the already-loaded case
    // that such a listener could never match.
    applyLanguage();

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

  /**
   * Translate the shell, and redraw the one screen that is localized.
   *
   * The static markup goes through `I.apply`. The settings body is JS-rendered,
   * so it is repainted here — from the LAST SERVER ANSWER, never by asking
   * again: a language is a decision that never left the device, and it must not
   * cost a request or risk an error notice on a bad gateway minute.
   *
   * Nothing else is redrawn, because nothing else is translated yet. When a
   * screen joins, it joins here.
   */
  function applyLanguage() {
    I.apply(document);

    const settings = $('#screen-settings');
    if (settings && settings.hasAttribute('data-active') && lastMe) paintSettings(lastMe);
  }

  /** Every listener the app owns, attached once and never dependent on a session. */
  function bindChrome() {
    // A language change repaints; it never re-fetches and never renavigates.
    I.onChange(applyLanguage);

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
    // The hero gear. Same destination as the button at the foot of Помощь —
    // one screen, one renderer, two doors. The switches behind it govern real
    // sends, so the door being findable is part of the feature working.
    $('#open-settings').addEventListener('click', () => {
      haptic('light');
      show('settings');
      void renderSettings();
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
    /*
     * The email feeds the promo answer.
     *
     * Per-email and first-purchase limits cannot be evaluated without an
     * address, so a code that was valid with no email may stop being valid once
     * one is typed — and the customer must see that before paying, not as a
     * refused order afterwards.
     *
     * On `change`, not on every keystroke: the quote endpoint is rate-limited,
     * and re-pricing on each letter of an address would spend that budget on
     * nothing.
     */
    $('#checkout-email').addEventListener('change', () => { void revalidatePromo(); });

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
      detail = enOr(serverErrorText(err), t('errors.loginFallback'))
        || (err && err.message)
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
