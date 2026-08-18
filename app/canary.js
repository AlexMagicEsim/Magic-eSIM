'use strict';

/* ============================================================================
 * Endpoint canary — direct Render vs the Yandex gateway, measured from inside
 * the real Telegram WebView.
 *
 * The architectural question this exists to answer: if the customer is on a
 * system-wide VPN, the WebView's traffic goes through it too, and the Yandex
 * gateway may no longer be the only way to reach the backend from RU. That is a
 * claim about a network nobody here can stand on, so it gets measured on the
 * owner's phone rather than argued.
 *
 * What it does NOT do: buy anything, top anything up, or touch a provider. It
 * issues reads, and — only when Telegram gave it real initData — one session
 * mint per endpoint so the authenticated read can be measured at all. A session
 * is a short-lived row, not a purchase.
 * ========================================================================= */

(function () {
  const GATEWAY = 'https://api.magicesim.store';
  const RENDER = 'https://esim-backend-3wmu.onrender.com';

  // Enough samples to see a median and a tail without keeping somebody standing
  // in a shop doorway. The catalogue is 604KB, so it is sampled less.
  const SAMPLES = { health: 8, catalogue: 4, session: 5, me: 5 };
  const TIMEOUT_MS = 20000;

  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = String(v);
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'style') n.style.cssText = String(v);
      else n.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of [].concat(kids)) if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return n;
  };

  try { if (tg) { tg.ready(); tg.expand(); } } catch { /* */ }

  // Both APIs allow exactly one browser origin: https://magicesim.store. Run
  // this anywhere else — a local server, a file:// page — and every request is
  // refused by CORS before it leaves, which looks identical to an outage.
  const WRONG_ORIGIN = location.origin !== 'https://magicesim.store';

  const initData = (tg && tg.initData) || '';
  const platform = (tg && tg.platform) || 'browser';
  $('#env').textContent = WRONG_ORIGIN
    ? `${location.origin} — не тот origin. Обе площадки разрешают только https://magicesim.store, замер будет пустым.`
    : (initData
      ? `Telegram · ${platform} · initData есть — полный замер`
      : `${platform} · initData нет — только сеть и чтение`);

  /** One request, timed. Never throws: a failure is a result. */
  async function timed(base, path, opts = {}) {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
    const t0 = performance.now();
    try {
      const res = await fetch(base + path, {
        method: opts.method || 'GET',
        headers: Object.assign(
          { Accept: 'application/json' },
          opts.body ? { 'Content-Type': 'application/json' } : {},
          opts.token ? { Authorization: `Bearer ${opts.token}` } : {}
        ),
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ctrl ? ctrl.signal : undefined,
        cache: 'no-store',
      });
      const text = await res.text();
      return { ms: performance.now() - t0, status: res.status, ok: res.ok, text };
    } catch (err) {
      // Abort, DNS, TLS, offline, blocked — all the same to a customer.
      return { ms: performance.now() - t0, status: 0, ok: false, error: String(err && err.name || err) };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const pct = (arr, q) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * q))]);
  };

  async function series(base, path, n, opts) {
    const ms = [];
    const codes = [];
    let ok = 0;
    for (let i = 0; i < n; i += 1) {
      const r = await timed(base, path, opts);
      ms.push(r.ms);
      codes.push(r.status || (r.error || 'ERR'));
      // A 401 from an invalid probe is a healthy answer: the request arrived.
      if (r.status >= 200 && r.status < 500) ok += 1;
    }
    return { n, ok, p50: pct(ms, 0.5), p95: pct(ms, 0.95), max: Math.round(Math.max(...ms)), codes: [...new Set(codes)] };
  }

  const row = (label, a, b) => el('div', { class: 'card stack' }, [
    el('div', { class: 'card__title', text: label }),
    line('Render', a),
    line('Yandex', b),
  ]);

  function line(name, r) {
    if (!r) return el('div', { class: 'small muted', text: `${name}: пропущено` });
    const bad = r.ok < r.n;

    return el('div', { class: 'stack' }, [
      el('div', { class: 'row row--between' }, [
        el('span', { class: bad ? 'small' : 'small muted', text: `${name} · ${r.ok}/${r.n}` }),
        el('span', { class: 'small tabular', text: `p50 ${r.p50}ms · p95 ${r.p95}ms` }),
      ]),
      // WHY it failed, not merely that it did. A blocked request and an
      // unreachable host both read as "0/8" and mean completely different
      // things — the first is this page being served from the wrong origin.
      bad ? el('div', { class: 'small muted', text: `↳ ${r.codes.join(', ')}` }) : null,
    ]);
  }

  const results = {};

  async function run() {
    const out = $('#out');
    const btn = $('#run');
    btn.disabled = true;
    btn.textContent = 'Идёт замер…';
    out.replaceChildren();
    $('#verdict').replaceChildren();

    const step = (t) => { const n = el('p', { class: 'small muted', text: t }); out.appendChild(n); return n; };

    // 1. health — the cheapest possible reachability probe
    let s = step('health…');
    results.health = {
      render: await series(RENDER, '/health', SAMPLES.health),
      yandex: await series(GATEWAY, '/health', SAMPLES.health),
    };
    s.remove();
    out.appendChild(row('/health', results.health.render, results.health.yandex));

    // 2. catalogue — the big read, 604KB, the one bandwidth actually shows up in
    s = step('каталог…');
    results.catalogue = {
      render: await series(RENDER, '/api/v1/retail/packages', SAMPLES.catalogue),
      yandex: await series(GATEWAY, '/api/v1/retail/packages', SAMPLES.catalogue),
    };
    s.remove();
    out.appendChild(row('Каталог · 604 КБ', results.catalogue.render, results.catalogue.yandex));

    // 3. session — with real initData if we have it, otherwise a probe that
    //    still measures the round trip and should answer 401
    s = step('вход…');
    const body = { init_data: initData || 'canary-probe' };
    results.session = {
      render: await series(RENDER, '/api/v1/tma/session', SAMPLES.session, { method: 'POST', body }),
      yandex: await series(GATEWAY, '/api/v1/tma/session', SAMPLES.session, { method: 'POST', body }),
    };
    s.remove();
    out.appendChild(row(initData ? 'Вход (реальный initData)' : 'Вход (проба, ожидается 401)',
      results.session.render, results.session.yandex));

    // 4. /tma/me — only meaningful with a real session
    if (initData) {
      s = step('профиль…');
      const mint = async (base) => {
        const r = await timed(base, '/api/v1/tma/session', { method: 'POST', body: { init_data: initData } });
        try { return JSON.parse(r.text || '{}').session_token || null; } catch { return null; }
      };
      const [tr, ty] = [await mint(RENDER), await mint(GATEWAY)];
      results.me = {
        render: tr ? await series(RENDER, '/api/v1/tma/me', SAMPLES.me, { token: tr }) : null,
        yandex: ty ? await series(GATEWAY, '/api/v1/tma/me', SAMPLES.me, { token: ty }) : null,
      };
      results.sessionMinted = { render: Boolean(tr), yandex: Boolean(ty) };
      s.remove();
      out.appendChild(row('/tma/me (с сессией)', results.me.render, results.me.yandex));

      // The security question, answered rather than assumed: a token minted by
      // one endpoint must be equally valid at the other, or the two are not the
      // same contract and no failover is safe.
      if (tr) {
        const cross = await timed(GATEWAY, '/api/v1/tma/me', { token: tr });
        results.crossEndpointToken = { status: cross.status, ok: cross.ok };
        out.appendChild(el('div', { class: 'card stack' }, [
          el('div', { class: 'card__title', text: 'Токен Render принят Yandex' }),
          el('div', { class: 'small muted', text: `HTTP ${cross.status} — ${cross.ok ? 'да, контракт общий' : 'НЕТ, контракты расходятся'}` }),
        ]));
      }
    }

    verdict();
    btn.disabled = false;
    btn.textContent = 'Повторить';
    $('#copy').hidden = false;
  }

  function verdict() {
    const h = results.health;
    const c = results.catalogue;
    const reachable = h.render.ok > 0;
    const renderWins = reachable
      && h.render.ok >= h.yandex.ok
      && c.render.p50 <= c.yandex.p50 * 1.2;

    const text = WRONG_ORIGIN
      ? 'Замер недействителен: страница открыта не с https://magicesim.store.'
      : !reachable
      ? 'Render напрямую НЕ доступен отсюда — оставляем Yandex.'
      : renderWins
        ? 'Render доступен и не медленнее — есть смысл в dual-endpoint.'
        : 'Render доступен, но не быстрее. Смена primary не обоснована.';

    $('#verdict').replaceChildren(el('div', { class: 'notice' }, [el('span', { text })]));
    results.verdict = text;
  }

  $('#run').addEventListener('click', () => { run().catch((e) => {
    $('#out').appendChild(el('p', { class: 'small', text: 'Ошибка замера: ' + e }));
    $('#run').disabled = false;
  }); });

  $('#copy').addEventListener('click', () => {
    const payload = JSON.stringify({ platform, hasInitData: Boolean(initData), ...results }, null, 1);
    try {
      // No secrets in here: latencies, status codes, and whether a token was
      // accepted. Never the token itself and never initData.
      navigator.clipboard.writeText(payload);
      $('#copy').textContent = 'Скопировано';
    } catch {
      $('#copy').textContent = 'Не удалось скопировать';
    }
  });
})();
