'use strict';

/* ============================================================================
 * Magic eSIM Mini App — the part with no DOM in it.
 *
 * Everything here is testable in Node, and that is the reason it exists as its
 * own file: the interesting behaviour of this app is not layout, it is what
 * happens when the network is unreliable and when a customer taps twice.
 *
 * THREE RULES THIS FILE ENFORCES
 *
 *   1. Reads may be retried. Writes may not — not blindly. A GET that fails
 *      costs a second request; a POST that fails might have succeeded on the
 *      server, and repeating it without an idempotency key is how one tap
 *      becomes two orders. So retry is opt-in per call and the purchase path
 *      carries a key that survives the retry.
 *
 *   2. A single 502 must not look like a broken app. TD-55 (R-38) means the
 *      gateway drops a real share of requests — measured at 20-35% on a bad
 *      minute, with origin healthy throughout. So reads retry with backoff, and
 *      when they still fail the app shows the last good answer with an honest
 *      "shown from cache" rather than an empty screen or an endless spinner.
 *
 *   3. Never invent a number. A usage figure the app could not fetch is
 *      rendered as unknown, never as zero. "0 GB left" and "we could not ask"
 *      look identical in a progress bar and mean opposite things to somebody
 *      standing in an airport.
 * ========================================================================= */

/* --------------------------------------------------------------------------
 * Configuration
 * ----------------------------------------------------------------------- */

// The gateway, always. Never the Render origin directly: RU networks reach
// api.magicesim.store 3/3 and the origin 0/3 (measured 2026-08-16), which is the
// entire reason the proxy exists. A "temporary" direct fallback here would be
// invisible in testing and broken for exactly the customers this app is for.
const API_BASE = 'https://api.magicesim.store';

// Reads: three attempts total. The first retry catches a dropped connection, the
// second catches a bad few seconds. A third would mostly add latency to an
// outage a human can already see.
const READ_ATTEMPTS = 3;
const READ_BACKOFF_MS = [400, 1200];

// Writes get ONE retry and only when a key makes it safe to repeat.
const WRITE_ATTEMPTS_WITH_KEY = 2;
const WRITE_BACKOFF_MS = [700];

// Longer than the gateway's own ~12s retry budget would take to exhaust, so a
// slow-but-alive request is not abandoned by the client first; short enough that
// a hung one does not become a spinner nobody can dismiss.
const REQUEST_TIMEOUT_MS = 20000;

/* --------------------------------------------------------------------------
 * Small helpers
 * ----------------------------------------------------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bytes -> GB for display. null stays null: unknown is not zero. */
function gb(bytes) {
  if (bytes === null || bytes === undefined || bytes === '') return null;
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return null;

  return Math.round((n / (1024 ** 3)) * 100) / 100;
}

/**
 * A price for a Russian customer: whole roubles, grouped, sign after.
 *
 * Non-breaking spaces, written as ESCAPES rather than typed. A price that wraps
 * between its digits — or away from its sign — is a price somebody misreads, and
 * a literal space character in source is invisible in review and easy for an
 * editor to normalise into something else. This started life as U+2009 THIN
 * SPACE, which is breakable in some renderers.
 */
function money(rub) {
  // Absence before coercion, for the third time in this file: Number(null) is 0,
  // so a missing price would render as "0 ₽" — a free eSIM, confidently offered.
  if (rub === null || rub === undefined || rub === '') return '';

  const n = Number(rub);
  if (!Number.isFinite(n)) return '';

  const grouped = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');

  return `${grouped}\u00A0\u20BD`;
}

/**
 * Days left, floored, never negative.
 *
 * Floored rather than rounded on purpose: telling somebody they have "1 day"
 * when 4 hours remain is the error that gets a customer stranded.
 */
function daysLeft(expiresAt, now = Date.now()) {
  if (!expiresAt) return null;
  const t = new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return null;

  return Math.max(0, Math.floor((t - now) / 86400000));
}

/**
 * How much of the bundle is left, 0..1, or null when unknown.
 *
 * Returns null — not 0 — when either side is missing, so a progress bar can
 * render "unknown" instead of an empty tank.
 */
function remainingFraction(esim) {
  // `Number(null)` is 0, not NaN — which is exactly how "we could not ask the
  // provider" turns into "you have nothing left". So absence is checked BEFORE
  // coercion, on both sides.
  const rawTotal = esim ? esim.total_gb : null;
  const rawLeft = esim ? esim.remaining_gb : null;
  if (rawTotal === null || rawTotal === undefined || rawTotal === '') return null;
  if (rawLeft === null || rawLeft === undefined || rawLeft === '') return null;

  const total = Number(rawTotal);
  const left = Number(rawLeft);
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(left)) return null;

  return Math.max(0, Math.min(1, left / total));
}

/* --------------------------------------------------------------------------
 * Idempotency keys
 * ----------------------------------------------------------------------- */

/**
 * One key per purchase INTENT, not per request.
 *
 * The distinction is the whole mechanism. A double tap, a retry after a timeout
 * and a resumed screen are all the same intent and must carry the same key, or
 * the customer pays twice. Choosing a different tariff is a new intent and must
 * carry a new one, or the second purchase silently replays the first.
 *
 * The key is derived from what identifies the intent and kept in sessionStorage
 * so it survives the Mini App being backgrounded mid-payment — which is exactly
 * what happens, because paying leaves Telegram for a browser and comes back.
 */
function purchaseIntentKey(intent, storage, randomHex) {
  const scope = [
    'buy',
    String((intent && intent.package_id) || ''),
    String((intent && intent.payment_type) || ''),
    String((intent && intent.promo_code) || '').trim().toUpperCase(),
    String((intent && intent.email) || '').trim().toLowerCase(),
  ].join('|');

  const slot = `mesim.idem.${hash32(scope)}`;
  const existing = storage && storage.getItem ? storage.getItem(slot) : null;
  if (existing) return existing;

  const fresh = `tma-${hash32(scope)}-${randomHex(8)}`;
  if (storage && storage.setItem) storage.setItem(slot, fresh);

  return fresh;
}

/** Forget an intent's key, so the next purchase of the same tariff is a new one. */
function clearIntentKey(intent, storage) {
  const scope = [
    'buy',
    String((intent && intent.package_id) || ''),
    String((intent && intent.payment_type) || ''),
    String((intent && intent.promo_code) || '').trim().toUpperCase(),
    String((intent && intent.email) || '').trim().toLowerCase(),
  ].join('|');
  if (storage && storage.removeItem) storage.removeItem(`mesim.idem.${hash32(scope)}`);
}

/** Tiny stable hash. Not security — a storage slot name. */
function hash32(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return (h >>> 0).toString(36);
}

/* --------------------------------------------------------------------------
 * The API client
 * ----------------------------------------------------------------------- */

class ApiError extends Error {
  constructor(status, code, message, body) {
    super(message || code || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || '';
    this.body = body || null;
  }

  /** The session is gone and the app must mint a new one from initData. */
  get isAuthFailure() {
    return this.status === 401;
  }

  /**
   * The request never reached a decision — a gateway drop, a timeout, an offline
   * radio. Safe to retry for a read; for a write, only with a key.
   */
  get isTransport() {
    return this.status === 0 || this.status === 502 || this.status === 503 || this.status === 504;
  }
}

/**
 * @param {object} deps
 * @param {Function} deps.fetch      window.fetch, or a stub
 * @param {object}   deps.storage    sessionStorage-like
 * @param {Function} [deps.now]
 * @param {Function} [deps.sleep]
 * @param {Function} [deps.randomHex]
 */
function createApi(deps = {}) {
  const doFetch = deps.fetch;
  const storage = deps.storage || memoryStorage();
  const now = deps.now || (() => Date.now());
  const wait = deps.sleep || sleep;
  const randomHex = deps.randomHex || defaultRandomHex;
  const base = deps.base || API_BASE;

  // Held in memory only. Writing a bearer to localStorage would leave it on the
  // device after the app closes, and it is re-mintable from initData for free.
  let sessionToken = null;
  let sessionExpiresAt = 0;

  async function once(path, { method = 'GET', body = null, auth = true } = {}) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;

    try {
      const res = await doFetch(base + path, {
        method,
        headers: Object.assign(
          { 'Content-Type': 'application/json', Accept: 'application/json' },
          auth && sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}
        ),
        body: body === null ? undefined : JSON.stringify(body),
        signal: controller ? controller.signal : undefined,
      });

      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }

      if (!res.ok) {
        throw new ApiError(res.status, json && json.error, json && json.message, json);
      }

      return json;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // A thrown fetch is a transport failure: DNS, TLS, offline, abort. Status 0
      // so `isTransport` treats it like the gateway drop it usually is.
      throw new ApiError(0, 'NETWORK', 'network unavailable', null);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * One request, with the retry policy the method deserves.
   *
   * A 401 is retried exactly once, after re-authenticating — a 30-minute session
   * expiring while the app sits open is the single most likely failure here, and
   * making the customer notice it would be pointless.
   */
  async function request(path, opts = {}) {
    const isWrite = opts.method && opts.method !== 'GET';
    const retryable = !isWrite || Boolean(opts.idempotent);
    const attempts = isWrite
      ? (opts.idempotent ? WRITE_ATTEMPTS_WITH_KEY : 1)
      : READ_ATTEMPTS;
    const backoff = isWrite ? WRITE_BACKOFF_MS : READ_BACKOFF_MS;

    let lastError = null;
    let reauthed = false;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await once(path, opts);
      } catch (err) {
        lastError = err;

        if (err.isAuthFailure && !reauthed && opts.auth !== false && deps.reauthenticate) {
          reauthed = true;
          await deps.reauthenticate();
          continue;                      // does not consume an attempt
        }
        if (!err.isTransport || !retryable || attempt === attempts - 1) throw err;

        await wait(backoff[Math.min(attempt, backoff.length - 1)]);
      }
    }

    throw lastError;
  }

  /* ---- session ---- */

  async function openSession(initData) {
    const out = await once('/api/v1/tma/session', {
      method: 'POST', body: { init_data: initData }, auth: false,
    });
    sessionToken = out.session_token;
    sessionExpiresAt = now() + (Number(out.expires_in) || 0) * 1000;

    return out;
  }

  const hasSession = () => Boolean(sessionToken) && now() < sessionExpiresAt;

  /* ---- catalogue (public, no session) ---- */

  // The same endpoint the website uses. §8.3 rejected a TMA twin of it, so this
  // is deliberately not a Mini-App-specific catalogue.
  const catalogue = () => request('/api/v1/retail/packages', { auth: false });

  /* ---- the customer's own things ---- */

  const me = () => request('/api/v1/tma/me');
  const orders = (params = '') => request(`/api/v1/tma/me/orders${params}`);
  const activeOrders = () => request('/api/v1/tma/me/orders/active');
  const orderStatus = (token) => request(`/api/v1/tma/orders/${encodeURIComponent(token)}/status`);
  const esims = () => request('/api/v1/tma/esims');
  const esim = (id) => request(`/api/v1/tma/esims/${encodeURIComponent(id)}`);

  // POST, but it creates nothing — see the route comment. Retryable as a read is
  // wrong (it is a POST), so it gets the write policy without a key: one shot.
  const activation = (id) => request(
    `/api/v1/tma/esims/${encodeURIComponent(id)}/activation`, { method: 'POST', body: {} }
  );

  const refreshUsage = (id) => request(
    `/api/v1/tma/esims/${encodeURIComponent(id)}/usage/refresh`, { method: 'POST', body: {} }
  );

  /**
   * Buy. The only call in this file that can spend money.
   *
   * `idempotent: true` is what makes the single retry safe, and the key comes
   * from the INTENT rather than from this call — so a retry, a double tap and a
   * resumed screen all reuse it.
   */
  async function purchase(intent) {
    const key = purchaseIntentKey(intent, storage, randomHex);

    return request('/api/v1/tma/orders', {
      method: 'POST',
      idempotent: true,
      body: {
        package_id: intent.package_id,
        email: intent.email,
        payment_type: intent.payment_type,
        terms_accepted: true,
        promo_code: intent.promo_code || undefined,
        // An assertion about what was shown, never an instruction. The server
        // prices the order and refuses if this disagrees.
        expected_amount_rub: intent.expected_amount_rub,
        idempotency_key: key,
      },
    });
  }

  return {
    openSession, hasSession, catalogue, me, orders, activeOrders, orderStatus,
    esims, esim, activation, refreshUsage, purchase,
    forgetIntent: (intent) => clearIntentKey(intent, storage),
    get token() { return sessionToken; },
  };
}

/* --------------------------------------------------------------------------
 * A read-through cache that is honest about staleness
 * ----------------------------------------------------------------------- */

/**
 * Serve the last good answer when the network will not cooperate.
 *
 * This is the concrete answer to TD-55 in the UI: a customer who opens "my
 * eSIMs" on a bad minute sees their eSIMs with a quiet "shown from cache" line,
 * not an error and not a spinner. What it must never do is hide a failure on a
 * WRITE, so only reads go through here.
 */
function createCache(storage, { now = () => Date.now() } = {}) {
  const KEY = (name) => `mesim.cache.${name}`;

  return {
    read(name, maxAgeMs) {
      try {
        const raw = storage.getItem(KEY(name));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const age = now() - Number(parsed.at || 0);
        if (maxAgeMs && age > maxAgeMs) return { value: parsed.value, age, expired: true };

        return { value: parsed.value, age, expired: false };
      } catch {
        return null;
      }
    },
    write(name, value) {
      try {
        storage.setItem(KEY(name), JSON.stringify({ at: now(), value }));
      } catch {
        // A full or disabled storage must not break the app. Losing the cache
        // costs a spinner; throwing here costs the screen.
      }
    },
  };
}

/**
 * Fetch, and fall back to cache with the staleness made visible.
 *
 * Returns { value, stale, error } so a caller cannot accidentally present cached
 * data as fresh — the flag is in the same object as the data.
 */
async function readThrough(cache, name, fetcher) {
  try {
    const value = await fetcher();
    cache.write(name, value);

    return { value, stale: false, error: null };
  } catch (err) {
    const cached = cache.read(name);
    if (cached) return { value: cached.value, stale: true, error: err, age: cached.age };

    return { value: null, stale: false, error: err };
  }
}

/* --------------------------------------------------------------------------
 * Catalogue shaping — done here so the UI stays dumb
 * ----------------------------------------------------------------------- */

/**
 * Group the flat package list by country, and pick a "best value" per country.
 *
 * Best value is cheapest-per-GB among the cheapest half, not simply the cheapest
 * plan: the 1 GB option is almost always cheapest and almost never what somebody
 * travelling for a week wants.
 */
function byCountry(packages) {
  const map = new Map();
  for (const p of (Array.isArray(packages) ? packages : [])) {
    // A catalogue is external input. One malformed row must cost that row, not
    // the screen.
    if (!p || typeof p !== 'object') continue;
    const code = String(p.country_code || '').toUpperCase();
    if (!code) continue;
    if (!map.has(code)) map.set(code, { country_code: code, country: p.country || code, items: [] });
    map.get(code).items.push(p);
  }

  for (const group of map.values()) {
    group.items.sort((a, b) => Number(a.price) - Number(b.price));
    group.from = group.items.length ? Number(group.items[0].price) : null;
    group.best = pickBestValue(group.items);
  }

  return [...map.values()].sort((a, b) => String(a.country).localeCompare(String(b.country), 'ru'));
}

function pickBestValue(items) {
  const usable = (items || []).filter((p) => Number(p.data_gb) > 0 && Number(p.price) > 0);
  if (!usable.length) return null;
  const scored = usable
    .map((p) => ({ p, perGb: Number(p.price) / Number(p.data_gb) }))
    .sort((a, b) => a.perGb - b.perGb);

  return scored[0].p;
}

/** Free-text country search that tolerates the way people actually type. */
function searchCountries(groups, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return groups;

  return groups.filter((g) => String(g.country).toLowerCase().includes(q)
    || String(g.country_code).toLowerCase().startsWith(q));
}

/* --------------------------------------------------------------------------
 * Status vocabulary — one place, so no screen improvises
 * ----------------------------------------------------------------------- */

const ESIM_STATUS_TEXT = Object.freeze({
  provisioning: 'Выпускается',
  ready: 'Готова к установке',
  active: 'Активна',
  depleted: 'Трафик закончился',
  expired: 'Срок истёк',
  suspended: 'Приостановлена',
  failed: 'Ошибка выпуска',
});

const ORDER_STATUS_TEXT = Object.freeze({
  awaiting_payment: 'Ждёт оплаты',
  paid: 'Оплачен',
  purchasing_esim: 'Выпускаем eSIM',
  completed: 'Готово',
  failed: 'Не удался',
  cancelled: 'Отменён',
  refunded: 'Возврат',
});

/**
 * Installation guidance, keyed by the closed activation_policy code.
 *
 * The server maps three known provider sentences to these codes and null to
 * everything else, so this table has a null branch by design: "мы не знаем" is
 * a sentence a customer can act on, and a guess is not.
 */
const ACTIVATION_POLICY_TEXT = Object.freeze({
  ON_FIRST_DATA: 'Срок начнётся с первого использования интернета.',
  ON_NETWORK_ATTACH: 'Срок начнётся, когда телефон подключится к сети за границей.',
  ON_INSTALL: 'Срок начнётся сразу после установки — устанавливайте перед поездкой.',
});

function activationPolicyText(code) {
  return ACTIVATION_POLICY_TEXT[code]
    || 'Уточните момент начала срока в описании тарифа.';
}

/* --------------------------------------------------------------------------
 * Plumbing
 * ----------------------------------------------------------------------- */

function memoryStorage() {
  const m = new Map();

  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

function defaultRandomHex(bytes) {
  const g = typeof globalThis !== 'undefined' ? globalThis : {};
  if (g.crypto && g.crypto.getRandomValues) {
    const a = new Uint8Array(bytes);
    g.crypto.getRandomValues(a);

    return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Only reachable in an environment with no WebCrypto. The value is a storage
  // discriminator, not a secret — the idempotency key's job is uniqueness.
  let out = '';
  for (let i = 0; i < bytes * 2; i += 1) out += Math.floor(Math.random() * 16).toString(16);

  return out;
}

const CORE = {
  API_BASE, ApiError, createApi, createCache, readThrough,
  gb, money, daysLeft, remainingFraction,
  purchaseIntentKey, clearIntentKey, hash32,
  byCountry, pickBestValue, searchCountries,
  ESIM_STATUS_TEXT, ORDER_STATUS_TEXT, activationPolicyText,
  memoryStorage,
  READ_ATTEMPTS, WRITE_ATTEMPTS_WITH_KEY, REQUEST_TIMEOUT_MS,
};

if (typeof module !== 'undefined' && module.exports) module.exports = CORE;
if (typeof window !== 'undefined') window.MagicCore = CORE;
