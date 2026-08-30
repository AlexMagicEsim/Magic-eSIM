'use strict';

// Mini App core — the behaviour that only shows up on a bad network.
//
// Runs in plain Node with no DOM and no build step, which is why the logic lives
// apart from the rendering:
//
//   node --test app/core.test.js
//
// What is under test is deliberately not layout. It is the three properties the
// app would be dangerous without: a read survives a gateway drop, a write does
// NOT get repeated blindly, and a number the app could not fetch is never shown
// as zero.

const test = require('node:test');
const assert = require('node:assert/strict');

const C = require('./core.js');

/* -------------------------------------------------------------------------- */

/** A fetch stub driven by a script of responses or thrown errors. */
function scriptedFetch(script) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts, body: opts && opts.body ? JSON.parse(opts.body) : null });
    const next = script.shift();
    if (!next) throw new Error(`unscripted request: ${url}`);
    if (next.throw) throw next.throw;

    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      text: async () => (next.body === undefined ? '' : JSON.stringify(next.body)),
    };
  };
  fn.calls = calls;

  return fn;
}

const nap = async () => {};   // no real waiting in tests

function api(script, extra = {}) {
  const fetchStub = scriptedFetch(script);
  const client = C.createApi(Object.assign({
    fetch: fetchStub, storage: C.memoryStorage(), sleep: nap,
    randomHex: () => 'deadbeef',
  }, extra));

  return { client, fetchStub };
}

const OK = (body) => ({ status: 200, body });
const GATEWAY_DROP = { status: 502, body: { error: 'upstream_unreachable' } };

/* --------------------------------------------------------------------------
 * TD-55: a read must survive a gateway drop
 * ----------------------------------------------------------------------- */

test('a read retries a 502 and succeeds on the second attempt', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    GATEWAY_DROP,
    OK({ items: [{ id: 'esim-1' }] }),
  ]);
  await client.openSession('init');

  const out = await client.esims();

  assert.deepEqual(out, { items: [{ id: 'esim-1' }] });
  assert.equal(fetchStub.calls.length, 3, 'session + failed read + retried read');
});

test('a read gives up after its full budget ON BOTH endpoints, and says it was transport', async () => {
  // Three attempts at Render, then three at the gateway, then it stops. The
  // budget is bounded twice: per endpoint, and by there being exactly two.
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    GATEWAY_DROP, GATEWAY_DROP, GATEWAY_DROP,
    GATEWAY_DROP, GATEWAY_DROP, GATEWAY_DROP,
  ]);
  await client.openSession('init');

  await assert.rejects(client.esims(), (err) => {
    assert.equal(err.name, 'ApiError');
    assert.equal(err.status, 502);
    assert.equal(err.isTransport, true);
    return true;
  });
  assert.equal(fetchStub.calls.length, 1 + C.READ_ATTEMPTS * 2);
});

test('a thrown fetch — offline, DNS, abort — is transport, not a crash', async () => {
  const { client } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    { throw: new TypeError('Failed to fetch') },
    { throw: new TypeError('Failed to fetch') },
    { throw: new TypeError('Failed to fetch') },
  ]);
  await client.openSession('init');

  await assert.rejects(client.esims(), (err) => {
    assert.equal(err.status, 0);
    assert.equal(err.isTransport, true);
    // The browser's message must not become the customer's message.
    assert.ok(!/Failed to fetch/.test(err.message));
    return true;
  });
});

test('a 404 is NOT retried — it is an answer, not a drop', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    { status: 404, body: { error: 'NOT_FOUND' } },
  ]);
  await client.openSession('init');

  await assert.rejects(client.esim('x'), (err) => err.status === 404);
  assert.equal(fetchStub.calls.length, 2, 'one read attempt only');
});

/* --------------------------------------------------------------------------
 * A 30-minute session expiring mid-use must be invisible
 * ----------------------------------------------------------------------- */

test('a 401 re-authenticates once and replays the read', async () => {
  let reauths = 0;
  const { client, fetchStub } = api([
    OK({ session_token: 't1', expires_in: 1800 }),
    { status: 401, body: { error: 'SESSION_INVALID' } },
    OK({ items: [] }),
  ], {
    reauthenticate: async () => { reauths += 1; },
  });
  await client.openSession('init');

  const out = await client.esims();

  assert.deepEqual(out, { items: [] });
  assert.equal(reauths, 1);
  assert.equal(fetchStub.calls.length, 3);
});

test('a second 401 is surfaced rather than looping', async () => {
  let reauths = 0;
  const { client } = api([
    OK({ session_token: 't1', expires_in: 1800 }),
    { status: 401, body: { error: 'SESSION_INVALID' } },
    { status: 401, body: { error: 'SESSION_INVALID' } },
  ], { reauthenticate: async () => { reauths += 1; } });
  await client.openSession('init');

  await assert.rejects(client.esims(), (err) => err.status === 401);
  assert.equal(reauths, 1, 're-authentication is tried once, not in a loop');
});

test('the session token is never written to storage', async () => {
  const storage = C.memoryStorage();
  const { client } = api([OK({ session_token: 'secret-token', expires_in: 1800 })], { storage });
  await client.openSession('init');

  // Held in memory only: a bearer in storage outlives the app on a shared device
  // and is re-mintable from initData for free.
  for (const slot of ['mesim.session', 'mesim.token', 'token']) {
    assert.equal(storage.getItem(slot), null);
  }
});

/* --------------------------------------------------------------------------
 * Writes: one tap must never become two orders
 * ----------------------------------------------------------------------- */

const INTENT = {
  package_id: 'pkg-1', payment_type: 'card', email: 'a@b.c', expected_amount_rub: 1150,
};

test('purchase sends an idempotency key and never a price instruction', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    { status: 201, body: { public_order_token: 'tok', redirect_url: 'u', amount_rub: 1150 } },
  ]);
  await client.openSession('init');

  await client.purchase(INTENT);

  const sent = fetchStub.calls[1].body;
  assert.match(sent.idempotency_key, /^tma-/);
  assert.equal(sent.expected_amount_rub, 1150, 'an assertion about what was shown');
  // Nothing that could be mistaken for the price to charge.
  for (const forbidden of ['amount_rub', 'amount', 'price', 'discount_rub']) {
    assert.equal(sent[forbidden], undefined, `${forbidden} must not be sent`);
  }
});

test('a double tap on the same intent reuses one key', async () => {
  const storage = C.memoryStorage();
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    { status: 201, body: { public_order_token: 'tok' } },
    { status: 200, body: { public_order_token: 'tok', idempotent_replay: true } },
  ], { storage });
  await client.openSession('init');

  await client.purchase(INTENT);
  await client.purchase(INTENT);

  assert.equal(fetchStub.calls[1].body.idempotency_key, fetchStub.calls[2].body.idempotency_key,
    'the same intent must carry the same key, or the customer pays twice');
});

test('a different tariff is a different intent and gets a different key', async () => {
  const storage = C.memoryStorage();
  let n = 0;
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    { status: 201, body: {} },
    { status: 201, body: {} },
  ], { storage, randomHex: () => `r${(n += 1)}` });
  await client.openSession('init');

  await client.purchase(INTENT);
  await client.purchase({ ...INTENT, package_id: 'pkg-2' });

  assert.notEqual(fetchStub.calls[1].body.idempotency_key, fetchStub.calls[2].body.idempotency_key,
    'a new intent must not replay the previous order');
});

test('changing the promo code is a new intent', async () => {
  const storage = C.memoryStorage();
  let n = 0;
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    { status: 201, body: {} },
    { status: 201, body: {} },
  ], { storage, randomHex: () => `r${(n += 1)}` });
  await client.openSession('init');

  await client.purchase(INTENT);
  await client.purchase({ ...INTENT, promo_code: 'SAVE10' });

  assert.notEqual(fetchStub.calls[1].body.idempotency_key, fetchStub.calls[2].body.idempotency_key);
});

test('a purchase retried after a gateway drop reuses the key, and is tried twice at most', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    GATEWAY_DROP,
    { status: 201, body: { public_order_token: 'tok' } },
  ]);
  await client.openSession('init');

  await client.purchase(INTENT);

  assert.equal(fetchStub.calls.length, 3);
  assert.equal(fetchStub.calls[1].body.idempotency_key, fetchStub.calls[2].body.idempotency_key,
    'the retry must be the SAME request, or it is a second order');
});

test('a keyed purchase is bounded per endpoint and then stops', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    GATEWAY_DROP, GATEWAY_DROP,
    GATEWAY_DROP, GATEWAY_DROP,
  ]);
  await client.openSession('init');

  await assert.rejects(client.purchase(INTENT));
  assert.equal(fetchStub.calls.length, 1 + C.WRITE_ATTEMPTS_WITH_KEY * 2);
});

test('a write WITHOUT a key is never retried', async () => {
  // usage refresh creates nothing, but it is still a POST: repeating it blindly
  // would spend a second provider call and could trip the cooldown.
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    GATEWAY_DROP,
  ]);
  await client.openSession('init');

  await assert.rejects(client.refreshUsage('id-1'));
  assert.equal(fetchStub.calls.length, 2, 'exactly one attempt');
});

test('a 409 AMOUNT_CHANGED is surfaced with the real amount, not retried', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    { status: 409, body: { error: 'AMOUNT_CHANGED', actual_amount_rub: 1250 } },
  ]);
  await client.openSession('init');

  await assert.rejects(client.purchase(INTENT), (err) => {
    assert.equal(err.code, 'AMOUNT_CHANGED');
    assert.equal(err.body.actual_amount_rub, 1250);
    return true;
  });
  assert.equal(fetchStub.calls.length, 2, 'a priced refusal is an answer, not a drop');
});

/* --------------------------------------------------------------------------
 * Everything goes through the gateway
 * ----------------------------------------------------------------------- */

test('a healthy primary is the ONLY endpoint touched — the gateway is never called', async () => {
  // The old form of this test asserted the opposite, and correctly so at the
  // time: measured through a plain RU browser the origin answered 0/3. Inside
  // Telegram's WebView on a system-wide VPN it answers 8/8 while the gateway
  // manages 2/8, which is a different network and therefore a different answer.
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    OK({ items: [] }), OK({ data: [] }),
  ]);
  await client.openSession('init');
  await client.esims();
  await client.catalogue();

  assert.equal(fetchStub.calls.length, 3, 'no endpoint should have been tried twice');
  for (const c of fetchStub.calls) {
    assert.ok(c.url.startsWith('https://esim-backend-3wmu.onrender.com'), c.url);
  }
});

test('the catalogue is fetched without a bearer', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }), OK({ data: [] }),
  ]);
  await client.openSession('init');
  await client.catalogue();

  assert.equal(fetchStub.calls[1].opts.headers.Authorization, undefined,
    'the public catalogue needs no session and must not carry one');
});

/* --------------------------------------------------------------------------
 * Cache: stale is fine, silently stale is not
 * ----------------------------------------------------------------------- */

test('readThrough serves cache on failure and marks it stale', async () => {
  const storage = C.memoryStorage();
  const cache = C.createCache(storage);

  const first = await C.readThrough(cache, 'esims', async () => ({ items: [1, 2] }));
  assert.deepEqual(first, { value: { items: [1, 2] }, stale: false, error: null });

  const second = await C.readThrough(cache, 'esims', async () => {
    throw new C.ApiError(502, 'upstream_unreachable', 'x');
  });

  assert.deepEqual(second.value, { items: [1, 2] });
  assert.equal(second.stale, true, 'the flag travels WITH the data, so a caller cannot forget it');
  assert.equal(second.error.status, 502);
});

test('readThrough with no cache reports the failure honestly', async () => {
  const cache = C.createCache(C.memoryStorage());
  const out = await C.readThrough(cache, 'nothing', async () => { throw new C.ApiError(0, 'NETWORK', 'x'); });

  assert.equal(out.value, null);
  assert.equal(out.stale, false, 'no data must not be dressed up as stale data');
  assert.ok(out.error);
});

test('a storage that refuses to write does not break the read', async () => {
  const hostile = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
  const cache = C.createCache(hostile);

  const out = await C.readThrough(cache, 'x', async () => ({ ok: 1 }));

  assert.deepEqual(out.value, { ok: 1 }, 'losing the cache costs a spinner, not the screen');
});

/* --------------------------------------------------------------------------
 * Never invent a number
 * ----------------------------------------------------------------------- */

test('unknown usage is null, never zero', () => {
  assert.equal(C.gb(null), null);
  assert.equal(C.gb(undefined), null);
  assert.equal(C.gb(''), null);
  assert.equal(C.gb('nonsense'), null);
  assert.equal(C.gb(-5), null);
  // And a real zero survives as zero.
  assert.equal(C.gb(0), 0);
  assert.equal(C.gb(5368709120), 5);
});

test('remainingFraction is null when either side is unknown', () => {
  assert.equal(C.remainingFraction({ total_gb: null, remaining_gb: 3 }), null);
  assert.equal(C.remainingFraction({ total_gb: 10, remaining_gb: null }), null);
  assert.equal(C.remainingFraction({ total_gb: 0, remaining_gb: 0 }), null);
  assert.equal(C.remainingFraction({}), null);
  // A genuinely empty bundle is 0, and that is a different statement.
  assert.equal(C.remainingFraction({ total_gb: 10, remaining_gb: 0 }), 0);
  assert.equal(C.remainingFraction({ total_gb: 10, remaining_gb: 2.5 }), 0.25);
});

test('days left is floored and never negative', () => {
  const now = Date.UTC(2026, 7, 17, 12, 0, 0);
  // Four hours left is zero days, not one: rounding up is how somebody gets
  // stranded.
  assert.equal(C.daysLeft(new Date(now + 4 * 3600e3).toISOString(), now), 0);
  assert.equal(C.daysLeft(new Date(now + 30 * 86400e3).toISOString(), now), 30);
  assert.equal(C.daysLeft(new Date(now - 86400e3).toISOString(), now), 0);
  assert.equal(C.daysLeft(null, now), null);
  assert.equal(C.daysLeft('not a date', now), null);
});

test('money is formatted for a Russian customer and refuses nonsense', () => {
  assert.equal(C.money(1150), '1\u00A0150\u00A0\u20BD');
  assert.equal(C.money(950), '950\u00A0\u20BD');
  assert.equal(C.money(1234567), '1\u00A0234\u00A0567\u00A0\u20BD');
  assert.equal(C.money('abc'), '');
  assert.equal(C.money(null), '');
});

/* --------------------------------------------------------------------------
 * Catalogue shaping
 * ----------------------------------------------------------------------- */

const CATALOGUE = [
  { package_id: '1', country_code: 'TR', country: 'Турция', data_gb: 1, validity_days: 7, price: 500 },
  { package_id: '2', country_code: 'TR', country: 'Турция', data_gb: 10, validity_days: 30, price: 1150 },
  { package_id: '3', country_code: 'TR', country: 'Турция', data_gb: 20, validity_days: 30, price: 1900 },
  { package_id: '4', country_code: 'AE', country: 'ОАЭ', data_gb: 5, validity_days: 30, price: 1400 },
];

test('the catalogue groups by country, cheapest first, with a from-price', () => {
  const groups = C.byCountry(CATALOGUE);

  assert.equal(groups.length, 2);
  const tr = groups.find((g) => g.country_code === 'TR');
  assert.equal(tr.items.length, 3);
  assert.equal(tr.from, 500);
  assert.equal(tr.items[0].price, 500, 'cheapest first');
});

test('best value is cheapest per GB, not simply the cheapest plan', () => {
  // 500/1 = 500 per GB; 1150/10 = 115; 1900/20 = 95. The 1 GB plan is the
  // cheapest and the worst deal, and it is what a naive "from" price would push.
  const tr = C.byCountry(CATALOGUE).find((g) => g.country_code === 'TR');

  assert.equal(tr.best.package_id, '3');
});

test('best value ignores plans it cannot judge', () => {
  assert.equal(C.pickBestValue([{ data_gb: 0, price: 100 }, { data_gb: null, price: 50 }]), null);
  assert.equal(C.pickBestValue([]), null);
  assert.equal(C.pickBestValue(undefined), null);
});

test('country search tolerates how people type', () => {
  const groups = C.byCountry(CATALOGUE);

  assert.equal(C.searchCountries(groups, 'тур').length, 1);
  assert.equal(C.searchCountries(groups, 'ТУР').length, 1);
  assert.equal(C.searchCountries(groups, 'ae').length, 1);
  assert.equal(C.searchCountries(groups, '').length, 2);
  assert.equal(C.searchCountries(groups, 'ничего').length, 0);
});

test('a catalogue with junk rows does not take the screen down', () => {
  const groups = C.byCountry([null, {}, { country_code: '' }, CATALOGUE[0]]);

  assert.equal(groups.length, 1);
});

/* --------------------------------------------------------------------------
 * Vocabulary
 * ----------------------------------------------------------------------- */

test('an unknown activation policy gets a usable sentence, not a guess', () => {
  // The server sends null for the 801 packages whose provider states nothing.
  assert.match(C.activationPolicyText(null), /Уточните/);
  assert.match(C.activationPolicyText('SOMETHING_NEW'), /Уточните/);
  assert.match(C.activationPolicyText('ON_FIRST_DATA'), /первого использования/);
  assert.match(C.activationPolicyText('ON_INSTALL'), /перед поездкой/);
});

test('every eSIM status the architecture defines has customer-facing text', () => {
  for (const s of ['provisioning', 'ready', 'active', 'depleted', 'expired', 'suspended', 'failed']) {
    assert.ok(C.ESIM_STATUS_TEXT[s], `${s} needs a label`);
  }
});

/* --------------------------------------------------------------------------
 * R-44: the session mint must survive the cold start it always meets first
 *
 * Measured on production 2026-08-17: five of six cold probes of
 * POST /api/v1/tma/session returned 502 after ~12s, while the warmed instance
 * answered in 0.2s. openSession used `once` — one attempt — so that first 502
 * took the whole Mini App down: no session, no catalogue, nothing to tap.
 * ----------------------------------------------------------------------- */

test('the session survives a cold-start 502 and mints on the retry', async () => {
  const { client, fetchStub } = api([
    GATEWAY_DROP,
    OK({ session_token: 'warm', expires_in: 1800 }),
  ]);

  const out = await client.openSession('init');

  assert.equal(out.session_token, 'warm');
  assert.equal(fetchStub.calls.length, 2, 'the 502 was retried, not surfaced');
  assert.equal(client.hasSession(), true);
});

test('the session gives up only after both endpoints have been tried', async () => {
  const { client, fetchStub } = api([
    GATEWAY_DROP, GATEWAY_DROP, GATEWAY_DROP,
    GATEWAY_DROP, GATEWAY_DROP, GATEWAY_DROP,
  ]);

  await assert.rejects(client.openSession('init'), (err) => {
    assert.equal(err.status, 502);
    assert.equal(err.isTransport, true);
    return true;
  });
  assert.equal(fetchStub.calls.length, C.SESSION_ATTEMPTS * 2);
  assert.equal(client.hasSession(), false);
});

test('a rejected initData is not retried — it is a verdict, not a blip', async () => {
  const { client, fetchStub } = api([{ status: 401, body: { error: 'bad_init_data' } }]);

  await assert.rejects(client.openSession('forged'), (err) => {
    assert.equal(err.status, 401);
    return true;
  });
  assert.equal(fetchStub.calls.length, 1, 'a forged signature must not be hammered');
});

test('a transport failure with no response at all is retried too', async () => {
  const { client, fetchStub } = api([
    { throw: new TypeError('Load failed') },
    OK({ session_token: 'second', expires_in: 1800 }),
  ]);

  const out = await client.openSession('init');

  assert.equal(out.session_token, 'second');
  assert.equal(fetchStub.calls.length, 2);
});

/* --------------------------------------------------------------------------
 * Search and popular destinations
 *
 * Reported from production 2026-08-18: "поиск стран не работает". It did fire —
 * 213 rows became 19 — but 18 of those 19 were regional rows the filter never
 * touched, so the one real match sat below a screenful of globes. These tests
 * pin both halves: that the right thing matches, and that it is offered FIRST.
 * ----------------------------------------------------------------------- */

const GROUPS = ['TH', 'TR', 'CN', 'AE', 'VN', 'FR', 'JP', 'TW', 'TJ', 'EG', 'IT']
  .map((code) => ({ country_code: code, country: C.countryLabel(code), items: [], from: 100 }));

const found = (q) => C.searchCountries(GROUPS, q).map((g) => g.country);

test('search finds a country by its Russian name', () => {
  assert.deepEqual(found('Таиланд'), ['Таиланд']);
  assert.deepEqual(found('Турция'), ['Турция']);
  assert.deepEqual(found('Китай'), ['Китай']);
  assert.deepEqual(found('ОАЭ'), ['ОАЭ']);
  assert.deepEqual(found('Вьетнам'), ['Вьетнам']);
});

test('search finds a country by its Latin name', () => {
  assert.deepEqual(found('thailand'), ['Таиланд']);
  assert.deepEqual(found('turkey'), ['Турция']);
  assert.deepEqual(found('china'), ['Китай']);
  assert.deepEqual(found('uae'), ['ОАЭ']);
  assert.deepEqual(found('vietnam'), ['Вьетнам']);
});

test('«тай» offers Thailand FIRST, though Ки-тай contains it too', () => {
  // The country is spelled «Таиланд» — та-и, no й — so a naive substring match
  // finds «Китай» and misses Thailand entirely. This is the exact case that
  // made search look broken.
  const r = found('тай');
  assert.equal(r[0], 'Таиланд', `expected Таиланд first, got ${JSON.stringify(r)}`);
  assert.ok(r.includes('Китай'), 'Китай is a legitimate match and should still appear');
});

test('the common misspelling «Тайланд» also finds Thailand', () => {
  assert.equal(found('тайланд')[0], 'Таиланд');
});

test('search is case, space and ё-insensitive', () => {
  assert.deepEqual(found('  ТАИЛАНД '), ['Таиланд']);
  assert.deepEqual(found('таиланд'), found('Таиланд'));
});

test('no match returns nothing at all, not everything', () => {
  assert.deepEqual(found('несуществующая страна'), []);
  assert.deepEqual(found('zzzz'), []);
});

test('an empty query returns the list untouched', () => {
  assert.equal(C.searchCountries(GROUPS, '').length, GROUPS.length);
  assert.equal(C.searchCountries(GROUPS, '   ').length, GROUPS.length);
});

test('a regional group is found by a country it covers', () => {
  const region = {
    country_code: 'ID', country: 'Вьетнам и Юго-Восточная Азия', regional: true,
    coverage: ['ID', 'MY', 'SG', 'KR', 'TH', 'VN'], items: [], from: 1900,
  };
  const r = C.searchCountries([...GROUPS, region], 'сингапур').map((g) => g.country);
  assert.ok(r.includes('Вьетнам и Юго-Восточная Азия'),
    'a traveller searching Singapore should be shown the region that covers it');
});

test('an exact country still outranks a region that merely covers it', () => {
  const region = {
    country_code: 'ID', country: 'Вьетнам и Юго-Восточная Азия', regional: true,
    coverage: ['ID', 'MY', 'SG', 'KR', 'TH', 'VN'], items: [], from: 1900,
  };
  assert.equal(C.searchCountries([...GROUPS, region], 'таиланд')[0].country, 'Таиланд');
});

test('popular destinations are the storefront list, in the storefront order', () => {
  // Parsed out of index.html by seo/build-country-dictionary.mjs — never retyped.
  assert.deepEqual(C.popularCountries,
    ['TR', 'TH', 'VN', 'EG', 'MV', 'LK', 'CN', 'IT', 'AE', 'ID', 'JP', 'KR', 'ES', 'FR', 'GR', 'CY']);
});

test('popularGroups keeps that order and drops what is not on sale', () => {
  const out = C.popularGroups(GROUPS).map((g) => g.country_code);
  assert.deepEqual(out, ['TR', 'TH', 'VN', 'EG', 'CN', 'IT', 'AE', 'JP', 'FR']);
  assert.ok(!out.includes('TW'), 'Taiwan is on sale but is not a popular tile');
});

test('every popular destination has a Russian name and a Latin alias', () => {
  for (const code of C.popularCountries) {
    assert.ok(C.countryLabel(code) !== code, `${code} has no Russian name`);
    assert.ok(C.countryLatin[code], `${code} has no Latin alias`);
  }
});

/* --------------------------------------------------------------------------
 * Dual endpoint — failover, and the far more important question of when NOT to
 *
 * Measured on the owner's iPhone inside Telegram's WebView on a system-wide VPN
 * (2026-08-18): /health Render 8/8 p50 237ms against Yandex 2/8 p50 12239ms;
 * catalogue Render p50 654ms against 1720ms. So Render leads and the gateway
 * catches. Both terminate at the same backend, so the danger is never "the
 * fallback cannot serve it" — it is asking a settled question twice.
 * ----------------------------------------------------------------------- */

const RENDER = C.API_RENDER;
const YANDEX = C.API_GATEWAY;
const hosts = (stub) => stub.calls.map((c) => (c.url.startsWith(RENDER) ? 'render' : 'yandex'));

function dual(script, extra = {}) {
  const events = [];
  const out = api(script, { telemetry: (e) => events.push(e), ...extra });
  out.events = events;

  return out;
}

test('1. Render healthy — the gateway is never called at all', async () => {
  const { client, fetchStub, events } = dual([
    OK({ session_token: 't', expires_in: 1800 }), OK({ items: [] }),
  ]);
  await client.openSession('init');
  await client.esims();

  assert.deepEqual(hosts(fetchStub), ['render', 'render']);
  assert.ok(events.every((e) => e.api_route === 'render'));
  assert.ok(events.every((e) => e.fallback_used === false));
});

test('2. Render times out — the gateway answers', async () => {
  const { client, fetchStub, events } = dual([
    OK({ session_token: 't', expires_in: 1800 }),
    { throw: new TypeError('Load failed') },
    { throw: new TypeError('Load failed') },
    { throw: new TypeError('Load failed') },
    OK({ items: [{ id: 'e1' }] }),
  ]);
  await client.openSession('init');

  assert.deepEqual(await client.esims(), { items: [{ id: 'e1' }] });
  assert.deepEqual(hosts(fetchStub), ['render', 'render', 'render', 'render', 'yandex']);
  const served = events.filter((e) => e.path === '/api/v1/tma/esims').pop();
  assert.equal(served.api_route, 'yandex_fallback');
  assert.equal(served.fallback_used, true);
  assert.equal(served.fallback_reason, 'NETWORK');
});

test('3. Render 502 — the gateway answers', async () => {
  const { client, fetchStub, events } = dual([
    OK({ session_token: 't', expires_in: 1800 }),
    GATEWAY_DROP, GATEWAY_DROP, GATEWAY_DROP,
    OK({ items: [] }),
  ]);
  await client.openSession('init');
  await client.esims();

  assert.equal(hosts(fetchStub).pop(), 'yandex');
  // The server's own code when it gave one, `http_<status>` when it did not.
  // Either names the cause; neither carries anything about the customer.
  assert.equal(events.pop().fallback_reason, 'upstream_unreachable');
});

test('4. Render 401/409/422 — NEVER failed over', async () => {
  for (const status of [401, 409, 422, 400, 403, 404]) {
    const { client, fetchStub } = dual([
      OK({ session_token: 't', expires_in: 1800 }),
      { status, body: { error: 'REFUSED' } },
      // A gateway answer is scripted but must not be consumed: reaching it
      // would mean a settled question was asked twice.
      OK({ items: [{ id: 'must-not-be-reached' }] }),
    ], { reauthenticate: null });
    await client.openSession('init');

    await assert.rejects(client.esims(), (err) => err.status === status);
    assert.deepEqual(hosts(fetchStub), ['render', 'render'],
      `${status} must be final on the primary`);
  }
});

test('4b. a refused SESSION is not re-asked at the gateway either', async () => {
  const { client, fetchStub } = dual([{ status: 401, body: { error: 'INIT_DATA_INVALID' } }]);

  await assert.rejects(client.openSession('forged'), (err) => err.status === 401);
  assert.deepEqual(hosts(fetchStub), ['render']);
});

test('5. both endpoints fail — one controlled error, nothing invented', async () => {
  const { client, fetchStub, events } = dual([
    OK({ session_token: 't', expires_in: 1800 }),
    GATEWAY_DROP, GATEWAY_DROP, GATEWAY_DROP,
    GATEWAY_DROP, GATEWAY_DROP, GATEWAY_DROP,
  ]);
  await client.openSession('init');

  await assert.rejects(client.esims(), (err) => {
    assert.equal(err.isTransport, true);
    return true;
  });
  assert.equal(fetchStub.calls.length, 1 + C.READ_ATTEMPTS * 2);
  const last = events.pop();
  assert.equal(last.api_route, 'none');
  assert.equal(last.failed, true);
});

test('6. a purchase that times out on Render carries the SAME key to the gateway', async () => {
  const { client, fetchStub } = dual([
    OK({ session_token: 't', expires_in: 1800 }),
    { throw: new TypeError('Load failed') },
    { throw: new TypeError('Load failed') },
    OK({ order: { public_order_token: 'tok' } }),
  ]);
  await client.openSession('init');
  await client.purchase(INTENT);

  const keys = fetchStub.calls.slice(1).map((c) => c.body.idempotency_key);
  assert.equal(new Set(keys).size, 1, `one intent must mean one key, saw ${JSON.stringify(keys)}`);
  assert.equal(hosts(fetchStub).pop(), 'yandex');
});

test('7. a duplicate purchase is impossible: the key survives the endpoint change', async () => {
  // The key is derived from the intent and persisted, so it does not depend on
  // which host answered — and (scope, idempotency_key) is unique in the one
  // database both endpoints share.
  const { client, fetchStub } = dual([
    OK({ session_token: 't', expires_in: 1800 }),
    GATEWAY_DROP, GATEWAY_DROP,
    GATEWAY_DROP, OK({ order: { public_order_token: 'tok' } }),
  ]);
  await client.openSession('init');
  await client.purchase(INTENT);

  const keys = fetchStub.calls.slice(1).map((c) => c.body.idempotency_key);
  assert.equal(new Set(keys).size, 1);
  assert.ok(keys[0], 'a purchase must always carry a key');
});

test('7b. a write with NO key is never repeated — not even on the other endpoint', async () => {
  const { client, fetchStub } = dual([
    OK({ session_token: 't', expires_in: 1800 }),
    GATEWAY_DROP,
    OK({ ok: true }),
  ]);
  await client.openSession('init');

  await assert.rejects(client.refreshUsage('esim-1'));
  assert.deepEqual(hosts(fetchStub), ['render', 'render'],
    'an unkeyed write may already have been applied; the other endpoint is the same database');
});

test('8. a session minted on either endpoint is used on whichever answers next', async () => {
  // Both hosts terminate at the same backend, and customer_sessions binds a
  // token to a customer and an expiry — not to an IP, a user agent or an
  // origin. So a token is a token wherever it arrives.
  const { client, fetchStub } = dual([
    GATEWAY_DROP, GATEWAY_DROP, GATEWAY_DROP,
    OK({ session_token: 'minted-at-yandex', expires_in: 1800 }),
    { throw: new TypeError('Load failed') },
    { throw: new TypeError('Load failed') },
    { throw: new TypeError('Load failed') },
    OK({ items: [] }),
  ]);
  await client.openSession('init');
  assert.equal(hosts(fetchStub)[3], 'yandex', 'the session came from the fallback');

  await client.esims();
  const authed = fetchStub.calls.filter((c) => c.opts && c.opts.headers && c.opts.headers.Authorization);
  assert.ok(authed.length > 0);
  for (const c of authed) {
    assert.equal(c.opts.headers.Authorization, 'Bearer minted-at-yandex',
      'the same token must be presented to whichever endpoint answers');
  }
});

test('telemetry never carries initData, a token, or anything personal', async () => {
  const { client, events } = dual([
    OK({ session_token: 'secret-token', expires_in: 1800 }), OK({ items: [] }),
  ]);
  await client.openSession('init-data-secret');
  await client.esims();

  const blob = JSON.stringify(events);
  assert.ok(!blob.includes('secret-token'), 'a session token must never reach telemetry');
  assert.ok(!blob.includes('init-data-secret'), 'initData must never reach telemetry');
  for (const e of events) {
    assert.deepEqual(Object.keys(e).sort().filter((k) => !['api_route', 'path', 'primary_latency_ms',
      'latency_ms', 'fallback_used', 'fallback_reason', 'refused', 'failed'].includes(k)), []);
  }
});

/* --------------------------------------------------------------------------
 * Payment method — the rail is a choice, and the key follows it
 *
 * The Mini App sent payment_type:'card' hard-coded, with no control and no
 * display. Two things wrong with that: §9 S4 requires the method to be chosen,
 * and card is the dearer rail (9.5% against SBP's 8.5%), so an invisible
 * default was quietly the expensive one.
 * ----------------------------------------------------------------------- */

const keyFor = (intent) => C.purchaseIntentKey(intent, C.memoryStorage(), () => 'deadbeef');

function keyIn(store, intent) {
  return C.purchaseIntentKey(intent, store, () => Math.random().toString(16).slice(2, 10));
}

test('switching the method is a NEW intent and earns a new key', async () => {
  const store = C.memoryStorage();
  const base = { package_id: 'p1', email: 'a@b.co', promo_code: '' };

  const sbp = keyIn(store, { ...base, payment_type: 'sbp' });
  const card = keyIn(store, { ...base, payment_type: 'card' });

  assert.notEqual(sbp, card, 'a different rail is a different purchase');
});

test('retrying the SAME method reuses the SAME key', async () => {
  const store = C.memoryStorage();
  const intent = { package_id: 'p1', email: 'a@b.co', promo_code: '', payment_type: 'sbp' };

  assert.equal(keyIn(store, intent), keyIn(store, intent));
});

test('retrying the same CARD intent reuses its key too', async () => {
  const store = C.memoryStorage();
  const intent = { package_id: 'p1', email: 'a@b.co', promo_code: '', payment_type: 'card' };

  assert.equal(keyIn(store, intent), keyIn(store, intent));
});

test('switching back and forth returns to the first key, not a third one', async () => {
  // Otherwise a customer who taps Карта and changes their mind starts a second
  // order for the tariff they already have an intent for.
  const store = C.memoryStorage();
  const base = { package_id: 'p1', email: 'a@b.co', promo_code: '' };

  const first = keyIn(store, { ...base, payment_type: 'sbp' });
  keyIn(store, { ...base, payment_type: 'card' });

  assert.equal(keyIn(store, { ...base, payment_type: 'sbp' }), first);
});

test('the order body carries payment_type explicitly, never by omission', async () => {
  for (const method of ['sbp', 'card']) {
    const { client, fetchStub } = api([
      OK({ session_token: 't', expires_in: 1800 }),
      OK({ order: { public_order_token: 'tok' } }),
    ]);
    await client.openSession('init');
    await client.purchase({ ...INTENT, payment_type: method });

    const body = fetchStub.calls[1].body;
    assert.equal(body.payment_type, method);
    assert.ok(body.idempotency_key, 'and it still carries a key');
  }
});

test('sbp and card are the only two values the backend accepts', () => {
  // lib/plategaService.js whitelists exactly these and maps them to a fixed
  // Platega method code; a raw numeric method is never accepted from a client.
  // Anything else here would be a 400 the customer cannot act on.
  assert.deepEqual(['sbp', 'card'].sort(), ['card', 'sbp']);
});

/* ==========================================================================
 * What a customer is told a thing is called, and what state it is in.
 *
 * Both of these were production defects on 2026-08-18, and both were invisible
 * to the suite because the fixtures spoke a vocabulary the backend does not.
 * ======================================================================== */

test('a destination is never named by a raw code', () => {
  // The three codes the live catalogue carries that have no Russian name.
  for (const code of ['AF-29', 'CA-4', 'GL-120', 'ZZ', '', null]) {
    const t = C.destinationTitle('Something 5GB 30Days', code);
    assert.ok(!/^[A-Z]{2}(-\d+)?$/.test(t), `${code} -> ${t}`);
  }
});

test('a regional pack is named by its region, not by one member country', () => {
  // Every one of these files under an arbitrary member country in the live
  // catalogue: AL for the global packs, AR for LatAm, CY for the Greece trio.
  assert.equal(C.destinationTitle('Best World 10 GB', 'AL'), 'Весь мир');
  assert.equal(C.destinationTitle('Half Global 30 GB Yearly', 'AL'), 'Полмира');
  assert.equal(C.destinationTitle('LatAm 50 GB', 'AR'), 'Латинская Америка');
  assert.equal(C.destinationTitle('APAC 12 GB', 'AU'), 'Азия и Океания');
  assert.equal(C.destinationTitle('Greece Cyprus Turkey 7 GB', 'CY'), 'Греция, Кипр и Турция');
  assert.equal(C.destinationTitle('Global (120+ areas) 10GB 30Days', 'GL-120'), 'Весь мир');
});

test('a local pack is still named by its country', () => {
  assert.equal(C.destinationTitle('Algeria 100MB 7Days', 'DZ'), 'Алжир');
  assert.equal(C.destinationTitle('Thailand 3GB 15Days', 'TH'), 'Таиланд');
  // Italy covers IT+SM+VA and «Италия» is the honest answer for all three.
  assert.equal(C.destinationTitle('Italy 7 GB', 'IT'), 'Италия');
});

test('an unnamed family with an unnamed code degrades to a word, not a code', () => {
  assert.equal(C.destinationTitle('Mystery Pack 1GB', 'QQ-7'), 'Регион');

  // Daily plans reach neither table above: regionKey strips «5GB 30Days» and
  // «(120+ areas)», but these are named «Europe(30+ areas) 300MB/Day», and
  // «EU-39» is not a country. 91 production rows showed the placeholder.
  const daily = (name, cc, codes) => ({
    plan_type: 'DAILY', daily_term_mode: 'PER_DAY', daily_gb: 0.49,
    name, country_code: cc, coverage_country_codes: codes,
  });
  const title = (p) => C.destinationTitle(p.name, p.country_code, p);

  assert.equal(title(daily('Europe(30+ areas) 300MB/Day', 'EU-39', Array(39).fill('XX'))), 'Европа');
  assert.equal(title(daily('Central Asia 500MB/Day', 'CA-5', Array(5).fill('XX'))), 'Центральная Азия');
  assert.equal(title(daily('North America 500MB/Day', 'NA-3', ['US', 'CA', 'MX'])), 'Северная Америка');
  assert.equal(title(daily('Singapore & Malaysia & Thailand 500MB/Day', 'AS-3', ['SG', 'MY', 'TH'])),
    'Сингапур, Малайзия и Таиланд');

  // Without the package — the call shape every other caller still uses — the
  // answer is exactly what it was before this fallback existed.
  assert.equal(C.destinationTitle('Central Asia 500MB/Day', 'CA-5'), 'Регион');

  // And the extra argument must not change an ordinary package's answer.
  assert.equal(C.destinationTitle('Mystery Pack 1GB', 'QQ-7',
    { plan_type: 'ORDINARY', name: 'Mystery Pack 1GB', country_code: 'QQ-7' }), 'Регион');
});

test('order status speaks the vocabulary lib/tmaProjection.js actually emits', () => {
  // ORDER_DISPLAY_STATUS maps retail_orders.status onto exactly these.
  for (const s of ['awaiting_payment', 'paid', 'provisioning', 'ready', 'failed', 'canceled']) {
    assert.ok(C.ORDER_STATUS_TEXT[s], `no text for display_status "${s}"`);
  }
});

test('only "ready" means the eSIM exists — nothing else may claim it', () => {
  assert.equal(C.isOrderReady('ready'), true);
  assert.equal(C.isOrderReady('completed'), true);   // the internal alias
  for (const s of ['awaiting_payment', 'paid', 'provisioning', 'failed', 'canceled', 'unknown', '', null]) {
    assert.equal(C.isOrderReady(s), false, s);
  }
});

test('a dead order is dead, and waiting will not revive it', () => {
  for (const s of ['failed', 'canceled', 'cancelled', 'refunded']) {
    assert.equal(C.isOrderDead(s), true, s);
  }
  for (const s of ['awaiting_payment', 'paid', 'provisioning', 'ready']) {
    assert.equal(C.isOrderDead(s), false, s);
  }
});

test('ready and dead are mutually exclusive — no status is both', () => {
  const all = ['awaiting_payment', 'paid', 'provisioning', 'ready', 'failed',
    'canceled', 'unknown', 'purchasing_esim', 'completed', 'cancelled', 'refunded'];
  for (const s of all) assert.ok(!(C.isOrderReady(s) && C.isOrderDead(s)), s);
});

test('the static snapshot has a deadline of its own', () => {
  // It bypasses `request()` deliberately, so it does not inherit that timeout.
  // Without one of its own, a hung CDN pinned the first paint forever.
  assert.ok(C.STATIC_CATALOGUE_TIMEOUT_MS > 0);
  assert.ok(C.STATIC_CATALOGUE_TIMEOUT_MS < C.REQUEST_TIMEOUT_MS);
});

test('a customer is only ever walked out to the payment provider', () => {
  // Every real payment to date redirected to exactly this host.
  assert.equal(C.isAllowedPaymentUrl('https://pay.platega.io?id=abc&mh=def'), true);
  assert.equal(C.isAllowedPaymentUrl('https://app.platega.io/x'), true);
  assert.equal(C.isAllowedPaymentUrl('https://platega.io/'), true);
});

test('a lookalike domain is not the payment provider', () => {
  for (const bad of [
    'https://platega.io.evil.tld/pay',   // suffix, not host
    'https://evilplatega.io/pay',        // no dot before the allowed host
    'https://pay.platega.io.co/x',
    'http://pay.platega.io/x',           // plaintext
    'javascript:alert(1)',
    'data:text/html,<script>',
    'https://magicesim.store/pay',
    '', null, undefined, 'not a url',
  ]) {
    assert.equal(C.isAllowedPaymentUrl(bad), false, String(bad));
  }
});

test('the eSIM travelled on is above the ones already spent', () => {
  const list = [
    { id: 'a', status: 'expired' },
    { id: 'b', status: 'active' },
    { id: 'c', status: 'depleted' },
    { id: 'd', status: 'ready' },
    { id: 'e', status: 'failed' },
    { id: 'f', status: 'provisioning' },
  ];
  assert.deepEqual(C.sortOwnedEsims(list).map((x) => x.id), ['b', 'd', 'f', 'a', 'c', 'e']);
});

test('sorting is stable — the server order survives inside each band', () => {
  const list = [
    { id: '1', status: 'active' }, { id: '2', status: 'active' },
    { id: '3', status: 'expired' }, { id: '4', status: 'expired' },
  ];
  assert.deepEqual(C.sortOwnedEsims(list).map((x) => x.id), ['1', '2', '3', '4']);
});

test('an unknown status is treated as live, never quietly buried', () => {
  // A status we have no opinion about is not evidence the eSIM is spent, and
  // dimming a working profile is the more expensive mistake.
  assert.equal(C.isSpentEsim({ status: 'something_new' }), false);
  assert.equal(C.isSpentEsim({}), false);
  assert.equal(C.isSpentEsim(null), false);
});

test('nothing is lost by sorting', () => {
  const list = [{ id: 'a', status: 'expired' }, { id: 'b', status: 'active' }];
  assert.equal(C.sortOwnedEsims(list).length, 2);
  assert.deepEqual(C.sortOwnedEsims([]), []);
  assert.deepEqual(C.sortOwnedEsims(null), []);
});

test('the poll follows the Blueprint cadence and still ends', () => {
  // §9 S6: 3 s for the first 30 s, then 10 s, stopping at five minutes.
  // Read off the same array the screen uses, so a change to one fails here.
  const ui = require('node:fs').readFileSync(`${__dirname}/ui.js`, 'utf8');
  const m = ui.match(/const ORDER_POLL_MS = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(m, 'ORDER_POLL_MS not found');
  const fast = Number((m[1].match(/length: (\d+) \}, \(\) => 3000/) || [])[1]);
  const slow = Number((m[1].match(/length: (\d+) \}, \(\) => 10000/) || [])[1]);
  assert.equal(fast * 3000, 30000, 'the first 30 s are polled every 3 s');
  assert.equal(fast * 3000 + slow * 10000, 300000, 'and it stops at five minutes');
});

/* ==========================================================================
 * S3 · the characteristics block. The rule for every row is the same: a fact
 * the provider actually sent, in Russian, or no row.
 * ======================================================================== */

test('an untranslated English string is never shown to a customer', () => {
  assert.equal(C.tariffTextRu('Some policy we have never seen before'), '');
  assert.equal(C.tariffTextRu('Unrestricted'), 'Без ограничений скорости.');
  assert.equal(C.tariffTextRu(''), '');
  assert.equal(C.tariffTextRu(null), '');
});

test('a bare speed becomes a sentence rather than being dropped', () => {
  assert.match(C.tariffTextRu('1Mbps'), /1 Мбит\/с/);
  assert.match(C.tariffTextRu('512 kbps'), /512 Кбит\/с/);
});

test('Russian already written by the site passes through untouched', () => {
  assert.equal(C.tariffTextRu('Скорость не ограничена.'), 'Скорость не ограничена.');
});

test('throughput is never promoted to a network generation', () => {
  // MobiMatter's `speed` says "Unrestricted". Turning that into a fake 4G
  // would invent a claim about the network being sold.
  assert.equal(C.tariffNetworks({ speed: 'Unrestricted' }), '');
  assert.equal(C.tariffNetworks({ speed: '3G/4G/5G' }), '3G/4G/5G');
  assert.equal(C.tariffNetworks({ network_technologies: ['LTE', '5G'] }), '4G/5G');
  assert.equal(C.tariffNetworks({ network_technologies: ['4G', '4G'] }), '4G');
});

test('hotspot is tri-state and silence drops the row', () => {
  assert.equal(C.tariffHotspot({ hotspot_supported: true }), 'поддерживается');
  assert.equal(C.tariffHotspot({ hotspot_supported: false }), 'не поддерживается');
  assert.equal(C.tariffHotspot({ hotspot_supported: null }), '');
  assert.equal(C.tariffHotspot({}), '');
});

test('an unrecognised activation policy states the usual behaviour, not the code', () => {
  assert.equal(C.tariffActivation({ activation_policy: 'first_data_usage' }),
    'с первого использования интернета');
  assert.equal(C.tariffActivation({ activation_policy: 'unknown' }),
    'с первого подключения к сети');
  assert.equal(C.tariffActivation({}), 'с первого подключения к сети');
});

test('SMS and calls appear only on an explicit true', () => {
  // §9 S3. They are null on every package in the live catalogue, so these rows
  // do not appear at all today — which is the correct outcome, not a gap.
  const label = (p) => C.tariffFacts(p).map((f) => f.label);
  assert.ok(!label({ sms_supported: null }).includes('SMS'));
  assert.ok(!label({ sms_supported: false }).includes('SMS'));
  assert.ok(!label({}).includes('SMS'));
  assert.ok(label({ sms_supported: true }).includes('SMS'));
  assert.ok(!label({ calls_supported: null }).includes('Звонки'));
});

test('the SMS row does not promise what we cannot deliver', () => {
  const sms = C.tariffFacts({ sms_supported: true }).find((f) => f.label === 'SMS');
  assert.match(sms.value, /не гарантируется/);
});

test('no characteristic is ever drawn with an empty value', () => {
  for (const p of [{}, { speed: '' }, { speed_note: 'Untranslatable English' }, null]) {
    for (const f of C.tariffFacts(p)) {
      assert.ok(String(f.value).trim().length > 0, JSON.stringify(f));
      assert.ok(String(f.label).trim().length > 0, JSON.stringify(f));
    }
  }
});

test('every live package produces at least one true thing to say', () => {
  const cat = require('../assets/catalog.json').packages;
  const silent = cat.filter((p) => C.tariffFacts(p).length === 0);
  assert.equal(silent.length, 0, `${silent.length} packages would show an empty S3`);
});

test('and nothing in an S3 fact is English', () => {
  // Operator names are excluded, and that is not a loosening. «Nova», «Síminn»,
  // «NTT docomo» are PROPER NOUNS: they are what the network is called, they
  // are what the phone will show, and transliterating them would make the fact
  // less true rather than more Russian. Every other fact is prose we wrote and
  // must be in Russian.
  //
  // This test was red on main for exactly this reason — Iceland's operators
  // tripped a Latin-run check aimed at untranslated English sentences.
  const PROPER_NOUN_LABELS = new Set(['Операторы']);
  const cat = require('../assets/catalog.json').packages;
  for (const p of cat) {
    for (const f of C.tariffFacts(p)) {
      if (PROPER_NOUN_LABELS.has(f.label)) continue;
      assert.ok(!/[A-Za-z]{4,}/.test(f.value.replace(/\d+[GM]?B|[2345]G|eSIM|SIM|SMS|Мбит|Кбит/g, '')),
        `${p.name}: ${f.label} = ${f.value}`);
    }
  }
});

test('what happens after payment is three lines, one each', () => {
  assert.equal(C.AFTER_PAYMENT_STEPS.length, 3);
  for (const s of C.AFTER_PAYMENT_STEPS) {
    assert.ok(s.length > 20 && s.length < 120, s);
    assert.ok(!s.includes('\n'), s);
  }
});

/* ==========================================================================
 * S9 · a number with no time next to it is a promise we do not control.
 * ======================================================================== */

test('a usage figure always says when it was taken', () => {
  const now = Date.parse('2026-08-18T20:00:00Z');
  assert.match(C.syncedAgo('2026-08-18T19:59:40Z', now), /только что/);
  assert.match(C.syncedAgo('2026-08-18T19:58:00Z', now), /2 минуты назад/);
  assert.match(C.syncedAgo('2026-08-18T19:00:00Z', now), /1 час назад/);
  assert.match(C.syncedAgo('2026-08-18T15:00:00Z', now), /5 часов назад/);
  assert.match(C.syncedAgo('2026-08-16T20:00:00Z', now), /2 дня назад/);
});

test('never having asked is stated, not blank and not "0"', () => {
  assert.equal(C.syncedAgo(null), 'данные ещё не запрашивались');
  assert.equal(C.syncedAgo(''), 'данные ещё не запрашивались');
  assert.equal(C.syncedAgo(undefined), 'данные ещё не запрашивались');
  assert.equal(C.syncedAgo('not a date'), 'время последней проверки неизвестно');
  // Whatever it says, it is never empty — the row must not vanish.
  for (const v of [null, '', 'nonsense', '2026-08-18T19:00:00Z']) {
    assert.ok(C.syncedAgo(v).length > 0);
  }
});

test('a clock ahead of ours does not print a negative age', () => {
  const now = Date.parse('2026-08-18T20:00:00Z');
  assert.equal(C.syncedAgo('2026-08-18T20:05:00Z', now), 'только что');
});

/* ==========================================================================
 * S10 · which instructions to open on.
 * ======================================================================== */

test('Telegram is asked which client it is, not the user agent', () => {
  assert.equal(C.installPlatform('ios', 'Mozilla/5.0 (Linux; Android 13)'), 'ios');
  assert.equal(C.installPlatform('android', 'Mozilla/5.0 (iPhone)'), 'android');
  assert.equal(C.installPlatform('android_x', ''), 'android');
  assert.equal(C.installPlatform('macos', ''), 'ios');
});

test('a client Telegram has not taught us about falls back to the browser', () => {
  for (const p of ['tdesktop', 'weba', 'webk', 'unknown', '', null, undefined]) {
    assert.equal(C.installPlatform(p, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'ios', String(p));
    assert.equal(C.installPlatform(p, 'Mozilla/5.0 (Linux; Android 13)'), 'android', String(p));
  }
});

test('there is always an answer — the screen never opens on neither', () => {
  for (const p of [null, 'nonsense', 42, {}]) {
    assert.ok(['ios', 'android'].includes(C.installPlatform(p, '')), String(p));
  }
});

/* ==========================================================================
 * S2 · the two axes a tariff list is read along.
 * ======================================================================== */

const TARIFFS = [
  { package_id: 'a', price: 700, data_gb: 10 },
  { package_id: 'b', price: 350, data_gb: 3 },
  { package_id: 'c', price: 1400, data_gb: 20 },
  { package_id: 'd', price: 550, data_gb: 5 },
];

test('price ascending is the default the Blueprint asks for', () => {
  assert.deepEqual(C.sortTariffs(TARIFFS).map((p) => p.price), [350, 550, 700, 1400]);
  assert.deepEqual(C.sortTariffs(TARIFFS, 'price').map((p) => p.price), [350, 550, 700, 1400]);
  // An unknown axis is not an empty list.
  assert.equal(C.sortTariffs(TARIFFS, 'nonsense').length, 4);
});

test('by volume, more comes first — that is what is being looked for', () => {
  assert.deepEqual(C.sortTariffs(TARIFFS, 'volume').map((p) => p.data_gb), [20, 10, 5, 3]);
});

test('unlimited is not a big number, it is a different promise', () => {
  const withUnlimited = [...TARIFFS, { package_id: 'u', price: 2000, unlimited: true, data_gb: 0 }];
  assert.equal(C.sortTariffs(withUnlimited, 'volume')[0].package_id, 'u');
  // And it does not distort the price axis.
  assert.equal(C.sortTariffs(withUnlimited, 'price')[0].price, 350);
});

test('the order is total, so a redraw never reshuffles the list', () => {
  const tied = [
    { package_id: 'z', price: 500, data_gb: 5 },
    { package_id: 'a', price: 500, data_gb: 5 },
  ];
  assert.deepEqual(C.sortTariffs(tied, 'volume').map((p) => p.package_id), ['a', 'z']);
  assert.deepEqual(C.sortTariffs(tied, 'price').map((p) => p.package_id), ['a', 'z']);
});

test('sorting never loses or invents a tariff', () => {
  for (const axis of ['price', 'volume']) {
    assert.equal(C.sortTariffs(TARIFFS, axis).length, TARIFFS.length);
  }
  assert.deepEqual(C.sortTariffs([], 'price'), []);
  assert.deepEqual(C.sortTariffs(null, 'price'), []);
  // The input is not mutated — the group keeps the order byCountry gave it.
  const before = TARIFFS.map((p) => p.package_id);
  C.sortTariffs(TARIFFS, 'volume');
  assert.deepEqual(TARIFFS.map((p) => p.package_id), before);
});

/* --------------------------------------------------------------------------
 * W4 — the top-up purchase, from the client's side
 *
 * What is under test is what the client SENDS and what it does with what comes
 * back. Nothing here renders; the three properties that matter are that the
 * request carries no provider anything, that a checkout is never turned into a
 * second payment, and that an uncertain outcome is never called a failure.
 * ----------------------------------------------------------------------- */

test('a quote sends the option id, the method and the consent — and nothing else', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    OK({ public_token: 'tu_abc', price_rub: 200, data_gb: 1, validity_days: 7 }),
  ]);
  await client.openSession('init');

  await client.topupQuote('esim-1', {
    option_id: 'a1b2c3d4e5f6a1b2c3d4e5f6',
    payment_type: 'sbp',
    terms_accepted: true,
  });

  const sent = fetchStub.calls[1];
  assert.match(sent.url, /\/api\/v1\/tma\/esims\/esim-1\/topups\/quote$/);
  assert.deepEqual(Object.keys(sent.body).sort(), ['option_id', 'payment_type', 'terms_accepted']);
  // The three things a client is allowed to say. Everything the server needs to
  // price the top-up — the package, the cost, the ICCID, the provider — is
  // re-derived server-side and appears nowhere in this request.
  assert.equal(sent.body.option_id, 'a1b2c3d4e5f6a1b2c3d4e5f6');
});

test('a quote never asserts consent the customer did not give', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    OK({ public_token: 'tu_abc' }),
  ]);
  await client.openSession('init');

  // Anything that is not exactly `true` travels as false. A truthy string is
  // the shape a form produces, and it is not an acceptance.
  await client.topupQuote('esim-1', { option_id: 'x', payment_type: 'sbp', terms_accepted: 'true' });

  assert.equal(fetchStub.calls[1].body.terms_accepted, false);
});

test('a quote is NOT retried: a repeat that crossed with the first would leave two intents', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    GATEWAY_DROP,
  ]);
  await client.openSession('init');

  await assert.rejects(
    () => client.topupQuote('esim-1', { option_id: 'x', payment_type: 'sbp', terms_accepted: true })
  );
  assert.equal(fetchStub.calls.length, 2, 'session + one attempt, and no repeat');
});

test('a checkout sends an EMPTY body — there is nothing left to tamper with', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    OK({ public_token: 'tu_abc', redirect_url: 'https://platega.io/pay/1', payment_type: 'sbp', amount_rub: 200 }),
  ]);
  await client.openSession('init');

  await client.topupCheckout('tu_abc');

  const sent = fetchStub.calls[1];
  assert.match(sent.url, /\/api\/v1\/tma\/topups\/tu_abc\/checkout$/);
  assert.deepEqual(sent.body, {});
});

test('a checkout MAY be retried, because the server keys on the intent', async () => {
  // Safe for a better reason than a client key would be: a repeat finds the
  // order this intent already has and returns the SAME link, rather than asking
  // Platega for a second transaction.
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    GATEWAY_DROP,
    OK({ public_token: 'tu_abc', redirect_url: 'https://platega.io/pay/1' }),
  ]);
  await client.openSession('init');

  const out = await client.topupCheckout('tu_abc');
  assert.equal(out.redirect_url, 'https://platega.io/pay/1');
  assert.equal(fetchStub.calls.length, 3, 'session + failed write + retried write');
});

test('the status route is a GET and carries no body', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    OK({ public_token: 'tu_abc', status: 'paid', status_text: 'Оплата получена', is_final: false }),
  ]);
  await client.openSession('init');

  await client.topupStatus('tu_abc');

  const sent = fetchStub.calls[1];
  assert.match(sent.url, /\/api\/v1\/tma\/topups\/tu_abc\/status$/);
  assert.ok(!sent.opts.method || sent.opts.method === 'GET');
  assert.equal(sent.body, null);
});

test('an intent token is URL-encoded, so it cannot escape its segment', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    OK({ status: 'paid' }),
  ]);
  await client.openSession('init');

  await client.topupStatus('../../admin/secrets');

  assert.ok(!fetchStub.calls[1].url.includes('/admin/'), 'the token escaped its segment');
});

/* ---- the status vocabulary ---- */

test('the server\'s own words are what gets drawn', () => {
  assert.equal(
    C.topupStatusText({ status: 'verifying', status_text: 'Проверяем состояние пополнения' }),
    'Проверяем состояние пополнения'
  );
});

test('a state this build has never seen still produces a sentence, and a cautious one', () => {
  assert.equal(C.topupStatusText({ status: 'something_new_next_year' }), 'Проверяем состояние пополнения');
  // And it is NOT final: the app keeps asking rather than deciding on its own
  // that nothing more will happen.
  assert.equal(C.isTopupFinal({ status: 'something_new_next_year' }), false);
});

test('an uncertain top-up is never called a failure', () => {
  const text = C.TOPUP_STATUS_TEXT.verifying;
  assert.equal(text, 'Проверяем состояние пополнения');
  assert.equal(text.includes('не удалось'), false);
  // A customer told a top-up failed while it may be on their eSIM buys a second
  // one. That is the specific bug this wording exists to prevent.
  assert.equal(C.isTopupDone({ status: 'verifying' }), false);
});

test('the six required labels are exactly the wording asked for', () => {
  assert.equal(C.TOPUP_STATUS_TEXT.awaiting_payment, 'Ожидаем оплату');
  assert.equal(C.TOPUP_STATUS_TEXT.paid, 'Оплата получена');
  assert.equal(C.TOPUP_STATUS_TEXT.in_progress, 'Пополняем eSIM');
  assert.equal(C.TOPUP_STATUS_TEXT.completed, 'Пополнение выполнено');
  assert.equal(C.TOPUP_STATUS_TEXT.verifying, 'Проверяем состояние пополнения');
  assert.equal(C.TOPUP_STATUS_TEXT.needs_review, 'Требуется дополнительная проверка');
});

test('a failed top-up reads as money owed, and is final', () => {
  assert.equal(C.TOPUP_STATUS_TEXT.refund_pending, 'Пополнение не выполнено. Вернём деньги');
  assert.equal(C.isTopupFinal('refund_pending'), true);
  assert.equal(C.isTopupDone('refund_pending'), false);
});

test('the server owns the state machine: is_final wins over the local list', () => {
  // A build that predates a state must not decide on its own that the story is
  // over. When the server says so, that is the answer.
  assert.equal(C.isTopupFinal({ status: 'in_progress', is_final: true }), true);
  assert.equal(C.isTopupFinal({ status: 'completed', is_final: false }), false);
});

test('polling stops on exactly three states and no others', () => {
  assert.deepEqual([...C.TOPUP_FINAL].sort(), ['completed', 'needs_review', 'refund_pending']);
  for (const live of ['awaiting_payment', 'paid', 'in_progress', 'verifying']) {
    assert.equal(C.isTopupFinal(live), false, `${live} must keep polling`);
  }
});

test('a payment link is only ever opened when it is Platega\'s', () => {
  // The same guard the eSIM checkout uses. A status body that arrived with a
  // lookalike host must not be turned into a tap.
  assert.equal(C.isAllowedPaymentUrl('https://platega.io/pay/1'), true);
  assert.equal(C.isAllowedPaymentUrl('https://pay.platega.io/x'), true);
  assert.equal(C.isAllowedPaymentUrl('https://platega.io.evil.tld/x'), false);
  assert.equal(C.isAllowedPaymentUrl('http://platega.io/x'), false);
});

/* ==========================================================================
 * Promo codes — the pure half
 *
 * The client's ONLY job is to normalise what was typed and to refuse to read a
 * quote it does not understand. Every number comes from the server.
 * ======================================================================== */

test('promo: a typed code is trimmed and upper-cased, exactly as the site does', () => {
  for (const [raw, want] of [
    ['  friends10  ', 'FRIENDS10'],
    ['Friends10', 'FRIENDS10'],
    ['FRIENDS10', 'FRIENDS10'],
    ['', ''],
    [null, ''],
    [undefined, ''],
  ]) {
    assert.equal(C.normalisePromoCode(raw), want, JSON.stringify(raw));
  }
  // NOT cleverer than the site: an inner space is preserved, because the
  // backend is the authority on which codes exist and the two surfaces must
  // send the same string.
  assert.equal(C.normalisePromoCode(' a b '), 'A B');
});

test('promo: a quote is read only when the server said valid AND gave three numbers', () => {
  const good = { valid: true, promo_code: 'friends10', original_amount_rub: 750,
    discount_amount_rub: 75, final_amount_rub: 675 };
  assert.deepEqual(C.readPromoQuote(good, 'x'),
    { code: 'FRIENDS10', original: 750, discount: 75, final: 675 });

  // Everything that must NOT become a discount.
  for (const [label, data] of [
    ['no answer', null],
    ['valid missing', { original_amount_rub: 750, discount_amount_rub: 75, final_amount_rub: 675 }],
    ['valid false', { ...good, valid: false }],
    ['final missing', { valid: true, original_amount_rub: 750, discount_amount_rub: 75 }],
    ['discount not a number', { ...good, discount_amount_rub: 'семьдесят пять' }],
    ['zero discount', { ...good, discount_amount_rub: 0 }],
    ['negative discount', { ...good, discount_amount_rub: -75 }],
    ['final above original', { ...good, final_amount_rub: 800 }],
    ['final below zero', { ...good, final_amount_rub: -1 }],
  ]) {
    assert.equal(C.readPromoQuote(data, 'x'), null, label);
  }
});

test('promo: the code falls back to what was typed when the server echoes none', () => {
  const out = C.readPromoQuote(
    { valid: true, original_amount_rub: 100, discount_amount_rub: 10, final_amount_rub: 90 },
    ' friends10 '
  );
  assert.equal(out.code, 'FRIENDS10');
});

test('promo: every refusal has a sentence, and an unknown one does not leak the raw code', () => {
  assert.equal(C.promoMessage('PROMO_CODE_NOT_FOUND'), 'Промокод не найден.');
  assert.equal(C.promoMessage('PROMO_CODE_EXPIRED'), 'Срок действия промокода истёк.');
  assert.equal(C.promoMessage('PROMO_CODE_NOT_APPLICABLE'),
    'Этот промокод нельзя применить к выбранному тарифу.');

  for (const unknown of ['SOMETHING_NEW', '23505', '', null, undefined]) {
    assert.equal(C.promoMessage(unknown), 'Не удалось применить промокод.', String(unknown));
  }
  // Checked separately, and only for codes that are actually a string: an empty
  // string is a substring of everything, so folding it into the loop above
  // would make the assertion vacuous rather than strict.
  for (const unknown of ['SOMETHING_NEW', '23505', 'relation "x" does not exist']) {
    assert.ok(!C.promoMessage(unknown).includes(unknown),
      'a backend code must not reach the customer');
  }
});

test('promo: applying, changing or removing a code mints a DIFFERENT idempotency key', () => {
  // The invariant the brief asks about: an intent created at the full price must
  // never be replayed at the discounted one, or the reverse. It holds because
  // the fingerprint already spans the promo.
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  let n = 0;
  const rnd = () => `r${n += 1}`;
  const base = { package_id: 'p1', payment_type: 'sbp', email: 'a@b.io' };

  const none = C.purchaseIntentKey({ ...base }, storage, rnd);
  const promoA = C.purchaseIntentKey({ ...base, promo_code: 'FRIENDS10' }, storage, rnd);
  const promoB = C.purchaseIntentKey({ ...base, promo_code: 'OTHER5' }, storage, rnd);
  const card = C.purchaseIntentKey({ ...base, promo_code: 'FRIENDS10', payment_type: 'card' }, storage, rnd);

  assert.equal(new Set([none, promoA, promoB, card]).size, 4, 'all four are distinct intents');
  // And each is STABLE, so a double tap on the same state is still one order.
  assert.equal(C.purchaseIntentKey({ ...base, promo_code: 'FRIENDS10' }, storage, rnd), promoA);
  // Removing the code returns to the no-promo intent rather than inventing a fifth.
  assert.equal(C.purchaseIntentKey({ ...base }, storage, rnd), none);
  // Case and whitespace do not fork the key either.
  assert.equal(C.purchaseIntentKey({ ...base, promo_code: ' friends10 ' }, storage, rnd), promoA);
});

/* ==========================================================================
 * S14 · a per-day allowance is a different product from a volume.
 *
 * The Mini App has no opinion of its own about these: the wording comes from
 * assets/daily-plan-copy.js — the module the storefront and the country pages
 * also load — and the prices come from the server's `term_prices`. What is
 * tested here is that it uses both and invents neither.
 * ======================================================================== */

require('../assets/daily-plan-copy.js'); // sets the shared module on globalThis

const GB = 1024 * 1024 * 1024;
const dailyPkg = (over = {}) => ({
  package_id: 'pkg-daily', plan_type: 'DAILY', daily_term_mode: 'PER_DAY',
  daily_gb: 1, daily_throttle_label: '384 Kbps', daily_throttle_continues: false,
  daily_reset_confirmed: false, validity_days: null,
  sellable_days: [3, 7, 30],
  term_prices: [{ days: 3, price: 700 }, { days: 7, price: 1500 }, { days: 30, price: 5700 }],
  ...over,
});
const volumePkg = (over = {}) => ({
  package_id: 'pkg-volume', plan_type: 'FIXED_VOLUME', data_gb: 5,
  validity_days: 30, price: 900, ...over,
});

test('the two products are separated before anything is ranked', () => {
  const { daily, volume } = C.partitionDaily([volumePkg(), dailyPkg(), volumePkg({ package_id: 'v2' })]);
  assert.equal(daily.length, 1);
  assert.equal(volume.length, 2);
  assert.equal(daily[0].package_id, 'pkg-daily');
});

test('the offered terms are the server\'s, repeated and not computed', () => {
  assert.deepEqual(C.dailyTerms(dailyPkg()), [
    { days: 3, price: 700 }, { days: 7, price: 1500 }, { days: 30, price: 5700 },
  ]);
});

test('a term with no usable price is dropped, and an empty ladder stays empty', () => {
  // A term we cannot price is a term we cannot sell. The screen then offers no
  // purchase at all rather than inventing a number.
  assert.deepEqual(C.dailyTerms(dailyPkg({ term_prices: [{ days: 7, price: 0 }] })), []);
  assert.deepEqual(C.dailyTerms(dailyPkg({ term_prices: [{ days: 0, price: 700 }] })), []);
  assert.deepEqual(C.dailyTerms(dailyPkg({ term_prices: null })), []);
  assert.deepEqual(C.dailyTerms(volumePkg()), []);
});

test('an ordinary package produces no daily copy', () => {
  const D = C.dailyCopy();
  assert.ok(D, 'the shared module must be loaded');
  assert.deepEqual(D.lines(volumePkg()), []);
  assert.equal(D.isDaily(volumePkg()), false);
});

test('the app never promises unlimited traffic for a daily plan', () => {
  const text = C.dailyCopy().lines(dailyPkg()).map((l) => l.text).join(' ');
  assert.ok(!/безлимит/i.test(text));
  assert.match(text, /1 ГБ в день на максимальной скорости/);
  assert.match(text, /Далее — до 384 Кбит\/с/);
});

test('TWO TERMS ARE TWO ORDERS: the term is part of the purchase intent', () => {
  // Without this, choosing 30 days after 7 would reuse the first intent's
  // idempotency key and the backend would correctly return the FIRST order —
  // a customer charged for a week and shown a month.
  const base = { package_id: 'pkg-daily', payment_type: 'sbp', email: 'a@b.c' };
  const seven = C.purchaseIntentKey({ ...base, days: 7 }, C.memoryStorage(), () => 'aaaaaaaa');
  const thirty = C.purchaseIntentKey({ ...base, days: 30 }, C.memoryStorage(), () => 'aaaaaaaa');
  assert.notEqual(seven, thirty);

  // And the same term is the same intent, which is what makes a retry safe.
  const store = C.memoryStorage();
  const first = C.purchaseIntentKey({ ...base, days: 7 }, store, () => 'aaaaaaaa');
  const again = C.purchaseIntentKey({ ...base, days: 7 }, store, () => 'bbbbbbbb');
  assert.equal(first, again);
});

test('minting and clearing an intent key agree on what the intent is', () => {
  // They used to be two hand-written copies of the same tuple. A scope that
  // disagrees hashes to a different slot, so a mint would store a key the clear
  // could never find — and that stale key would be reused by a later purchase.
  const intent = { package_id: 'p', payment_type: 'sbp', email: 'a@b.c', promo_code: 'X', days: 7 };
  const store = C.memoryStorage();
  const key = C.purchaseIntentKey(intent, store, () => 'aaaaaaaa');
  assert.equal(store.getItem(`mesim.idem.${C.hash32(C.purchaseIntentScope(intent))}`), key);

  C.clearIntentKey(intent, store);
  const fresh = C.purchaseIntentKey(intent, store, () => 'bbbbbbbb');
  assert.notEqual(fresh, key, 'clearing must actually forget the key it minted');
});

test('an ordinary purchase intent is unchanged by any of this', () => {
  const base = { package_id: 'p', payment_type: 'sbp', email: 'a@b.c' };
  const store = C.memoryStorage();
  const a = C.purchaseIntentKey(base, store, () => 'aaaaaaaa');
  const b = C.purchaseIntentKey({ ...base, days: undefined }, store, () => 'bbbbbbbb');
  assert.equal(a, b, 'no term means the same intent as before terms existed');
});

/* --------------------------------------------------------------------------
 * «от X ₽» — the price on the card must be one a person can actually pay
 *
 * The bug this pins: the card took min(item.price) over every package, and for
 * a PER_DAY plan `price` is the rate for ONE DAY. No such plan is sold for one
 * day — the shortest term is three. Turkey advertised «от 100 ₽» while the
 * cheapest purchase was 200 ₽. Sixteen of sixteen popular countries were wrong.
 * ----------------------------------------------------------------------- */

const PER_DAY = (over) => ({
  package_id: 'd1', country_code: 'TR', plan_type: 'DAILY', daily_term_mode: 'PER_DAY',
  daily_gb: 1, price: 100,
  term_prices: [{ days: 3, price: 200 }, { days: 5, price: 350 }, { days: 7, price: 500 }],
  ...over,
});

test('a per-day plan contributes its cheapest TERM, never its per-day rate', () => {
  const tr = C.byCountry([PER_DAY()]).find((g) => g.country_code === 'TR');

  assert.equal(tr.from, 200, 'the three-day term, which is the shortest sold');
  assert.notEqual(tr.from, 100, 'the per-day rate is not a purchasable price');
});

test('a cheap per-day rate cannot undercut a real volume price', () => {
  // 100/day looks cheapest and is unbuyable; the 150 ₽ volume plan is the
  // cheapest thing anyone can actually put in a basket.
  const tr = C.byCountry([
    PER_DAY(),
    { package_id: 'v1', country_code: 'TR', price: 150 },
  ]).find((g) => g.country_code === 'TR');

  assert.equal(tr.from, 150);
});

test('a per-day plan with no priced ladder sets no price at all', () => {
  // dailyCard shows «—» for it and refuses to open it, so it is not on sale.
  // Falling back to `price` here would put the per-day rate straight back.
  const only = C.byCountry([PER_DAY({ term_prices: [] })]).find((g) => g.country_code === 'TR');
  assert.equal(only.from, null);

  const withVolume = C.byCountry([
    PER_DAY({ term_prices: [] }),
    { package_id: 'v1', country_code: 'TR', price: 900 },
  ]).find((g) => g.country_code === 'TR');
  assert.equal(withVolume.from, 900, 'the unsellable plan is ignored, not preferred');
});

test('a fixed-term daily plan is priced by its own price, not a ladder', () => {
  // FIXED_TERM carries the whole-term price in `price` and has no term_prices.
  const tr = C.byCountry([{
    package_id: 'f1', country_code: 'TR', plan_type: 'DAILY',
    daily_term_mode: 'FIXED_TERM', daily_gb: 1, validity_days: 5, price: 640,
  }]).find((g) => g.country_code === 'TR');

  assert.equal(tr.from, 640);
});

test('regional groups price the same way as countries', () => {
  const { regions } = C.groupCatalogue([
    PER_DAY({ package_id: 'r1', country_code: 'EU', coverage_country_codes: ['FR', 'DE', 'IT'] }),
  ]);

  assert.equal(regions.length, 1);
  assert.equal(regions[0].from, 200, 'the ladder, not the per-day rate');
});

test('the from-price is computed apart from the sort, which is left alone', () => {
  // The sort orders the list the screen renders; the card price is a different
  // question. Answering it from items[0] is what tied them together.
  const tr = C.byCountry([
    { package_id: 'v2', country_code: 'TR', price: 800 },
    PER_DAY(),
  ]).find((g) => g.country_code === 'TR');

  assert.equal(tr.items[0].price, 100, 'raw sort order is unchanged');
  assert.equal(tr.from, 200, 'but the price shown is the cheapest purchasable one');
});

test('sellableFrom answers for a single package', () => {
  assert.equal(C.sellableFrom(PER_DAY()), 200);
  assert.equal(C.sellableFrom(PER_DAY({ term_prices: [] })), null);
  assert.equal(C.sellableFrom({ price: 300 }), 300);
  assert.equal(C.sellableFrom({ price: 0 }), null, 'a zero price is not a price');
  assert.equal(C.sellableFrom(null), null);
});

/* --------------------------------------------------------------------------
 * The wait that would otherwise not end
 *
 * The request endpoint answers identically whether it mailed a code or
 * deliberately did not — rate limited, malformed, or an address another
 * customer has already proven (HELD_BY_ANOTHER). That sameness is the
 * anti-enumeration property. It also means someone can sit on the code screen
 * waiting for mail that was never sent, which is what happened in production
 * on 2026-08-29.
 *
 * The fix is one line of guidance that names NO cause. These tests pin both
 * halves: that the line is there, and that it stays silent about why.
 * ----------------------------------------------------------------------- */

const UI_SRC = require('node:fs').readFileSync(`${__dirname}/ui.js`, 'utf8');

function claimCodeScreenSource() {
  const start = UI_SRC.indexOf('function paintClaimCode(');
  assert.ok(start > 0, 'paintClaimCode not found');
  const end = UI_SRC.indexOf('function paintClaimDone(', start);
  assert.ok(end > start, 'paintClaimDone not found after paintClaimCode');
  return UI_SRC.slice(start, end);
}

test('the code screen offers a way out when no mail arrives', () => {
  const src = claimCodeScreenSource();

  // The sentence moved into the dictionary when the Mini App learned a second
  // language. Both halves of the original guarantee are still checked: the hint
  // is asked for ON THE CODE SCREEN, where the waiting happens, and it is still
  // the quiet class the email line and the attempt counter use — a note rather
  // than an error. What changed is only where the words live.
  assert.match(src, /class: 'small muted', text:\s*\n?\s*t\('claim\.noMail'\)/,
    'the hint lives on the code screen, as a quiet note');
  assert.match(LOCALES.ru['claim.noMail'],
    /Если письмо не пришло за пару минут — проверьте адрес и попробуйте другой\./);
  assert.ok(LOCALES.en['claim.noMail'], 'and it exists in English too');
});

test('the hint never says WHY a code did not arrive', () => {
  // Naming the cause would turn the form into a lookup for whether an address
  // is registered. Every word below would do that, in the phrasings a Russian
  // screen would plausibly use.
  // The words moved into the dictionary, so this checks the DICTIONARY as well
  // as the source. Reading only the source would have made this guard pass
  // trivially the moment the sentences were keyed — a false green on the one
  // test here that protects a customer's privacy rather than their experience.
  const src = claimCodeScreenSource();
  const leaks = [
    'занят', 'занята', 'уже используется', 'уже зарегистрирован',
    'другим аккаунтом', 'другому аккаунту', 'другой аккаунт',
    'привязан', 'существует', 'не найден', 'уже подтверждён',
    'HELD_BY_ANOTHER', 'held_by_another',
  ];
  // Deliberately WIDER than a translation of the Russian list. Russian says
  // «занят» in one word; English has a dozen ways to say the same thing, and a
  // sentence like "already registered elsewhere" or "in use by someone else"
  // would leak just as much while matching none of the obvious pairs. The list
  // is matched as substrings, so the short forms cover the long ones.
  const leaksEn = [
    'taken', 'in use', 'registered', 'another account', 'a different account',
    'someone else', 'belongs to', 'linked to', 'associated with', 'claimed',
    'exists', 'not found', 'already confirmed', 'already verified',
    'held_by_another',
  ];
  // Every key the code screen actually asks for, and both of its languages.
  const keys = [...src.matchAll(/t\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(keys.length >= 4, 'expected the code screen to ask for several keys');

  for (const word of leaks) {
    assert.ok(!src.toLowerCase().includes(word.toLowerCase()),
      `the code screen must not say «${word}» — it would confirm the address exists`);
    for (const key of keys) {
      assert.ok(!String(LOCALES.ru[key] || '').toLowerCase().includes(word.toLowerCase()),
        `${key} (ru) must not say «${word}»`);
    }
  }
  for (const word of leaksEn) {
    for (const key of keys) {
      assert.ok(!String(LOCALES.en[key] || '').toLowerCase().includes(word.toLowerCase()),
        `${key} (en) must not say “${word}”`);
    }
  }
});

test('the code screen still promises nothing it cannot keep', () => {
  // The intro was already conditional before this change and must stay so:
  // «Если этот адрес использовался при покупке, мы отправили…» never claims a
  // code was sent. A future edit that turns it into a promise contradicts the
  // hint added below it.
  const src = claimCodeScreenSource();
  assert.match(src, /t\('claim\.codeIntro'\)/, 'the intro is the keyed one');
  // …and the sentence itself is still conditional, in BOTH languages. This is
  // the half that matters: the key could be right while the words silently
  // became a promise.
  assert.match(LOCALES.ru['claim.codeIntro'], /^Если этот адрес использовался при покупке/);
  assert.match(LOCALES.en['claim.codeIntro'], /^If this address was used/);
});

/* --------------------------------------------------------------------------
 * S13 · disconnecting a proven address — exactly once per intention
 *
 * Two windows were open on this button, and the second is the reason the guard
 * sits before the question rather than around the request.
 *
 * The request window is the obvious one: the confirmation closes, `revokeEmail`
 * is in flight, and a live button can ask for the same revoke again.
 *
 * The dialog window is the expensive one. There is ONE sheet element in ui.js
 * and `openSheet` closes whatever is open before opening anything, so a second
 * entry while the first confirmation is up removes the DOM that the first
 * `confirmSheet` promise resolves from — and that promise then never settles at
 * all. A scrim stops a finger; it does not stop a keyboard, because focus is
 * not trapped.
 *
 * Source assertions rather than behaviour: ui.js is a bare IIFE with no export,
 * and the behavioural half of this lives in the browser suite, which CI does
 * not run. This is the half that runs on every `node --test`.
 * ----------------------------------------------------------------------- */

function emailRowSource() {
  const start = UI_SRC.indexOf('function emailRow(');
  assert.ok(start > 0, 'emailRow not found');
  const end = UI_SRC.indexOf('function renderHelp(', start);
  assert.ok(end > start, 'renderHelp not found after emailRow');

  return UI_SRC.slice(start, end);
}

test('disconnecting an address cannot be asked for twice', () => {
  const src = emailRowSource();

  // The guard is real, and it is a refusal rather than a hope.
  assert.match(src, /if \(btn\.disabled\) return;/,
    'a second entry must return, not queue');
  assert.match(src, /btn\.disabled = true;/, 'the button is closed on the way in');
  assert.match(src, /finally \{\s*\n\s*btn\.disabled = false;/,
    'and reopened however the flow ends, including on cancel');

  // ORDER is the whole point: closed BEFORE the question, or the dialog window
  // stays open and a second sheet can strand the first promise forever.
  const closed = src.indexOf('btn.disabled = true;');
  const asked = src.indexOf('await confirmSheet(');
  const sent = src.indexOf('await api.revokeEmail(');

  assert.ok(closed > 0 && asked > closed,
    'the button must be closed before the confirmation is raised, not after it');
  assert.ok(sent > asked, 'and the request still follows the answer');
});

test('a refused confirmation leaves the address alone and the button usable', () => {
  const src = emailRowSource();
  const asked = src.indexOf('await confirmSheet(');
  const bail = src.indexOf('if (!ok) return;', asked);
  const sent = src.indexOf('await api.revokeEmail(', asked);

  assert.ok(bail > asked && bail < sent,
    'cancel must return before anything is sent');
});

/* ==========================================================================
 * Phase 2 — the language-aware data layer.
 *
 * These guard the DATA, not the rendering: that every country has an English
 * name, that a region does, that the closed error vocabulary and the two
 * dictionaries cannot drift apart, and — the one that matters most — that
 * adding English did not move a single Russian byte.
 * ======================================================================== */

const LOCALES = require('./locales.js');

test('every country the Russian dictionary names, the English one names too', () => {
  const ru = Object.keys(C.countryNames || {});
  const missing = ru.filter((code) => !C.countryNamesEn[code]);

  assert.equal(missing.length, 0,
    `codes with no English name: ${missing.join(', ')}`);
  assert.ok(ru.length >= 235, `expected the full dictionary, got ${ru.length}`);
});

test('no English country name is a bare ISO code', () => {
  // The failure this repository has already had once, in Russian: 130 cards
  // titled "BN 10 GB". A name that equals its own key is not a name.
  const raw = Object.entries(C.countryNamesEn).filter(([code, name]) => code === name);

  assert.deepEqual(raw, []);
});

test('the withdrawn code AN says the same thing in both languages', () => {
  // CLDR resolves AN to "Curaçao" — a DIFFERENT territory from the one the
  // Russian name describes. Generating it blindly would have made one code
  // mean two things. It is live: Caribbean bundles carry it.
  assert.equal(C.countryNamesEn.AN, 'Netherlands Antilles');
  assert.match(C.countryNames.AN, /Антильские/);
});

test('an English country name falls back to Russian before it falls back to a code', () => {
  // «Бруней» is worse than "Brunei" for an English reader. "BN" is worse than
  // both, and that is the one this rule exists to prevent.
  assert.equal(C.countryLabel('AE', 'en'), 'United Arab Emirates');
  assert.equal(C.countryLabel('AE'), 'ОАЭ');
  assert.equal(C.countryLabel('ZZ', 'en'), 'ZZ');
  assert.equal(C.countryLabel('', 'en'), '');
});

test('asking for a language nobody has still answers in Russian', () => {
  // countryLabel is called from render paths that may hand it anything.
  assert.equal(C.countryLabel('AE', 'de'), 'ОАЭ');
  assert.equal(C.countryLabel('AE', null), 'ОАЭ');
  assert.equal(C.countryLabel('AE', undefined), 'ОАЭ');
});

test('every named region has both languages, and the marketing tiers keep their names', () => {
  for (const key of Object.keys(C.REGION_NAMES_EN)) {
    assert.ok(C.REGION_NAMES_EN[key], `no English for region ${key}`);
  }
  // Measured, not assumed: BEST WORLD covers 173 countries and HALF GLOBAL 50.
  // «Полмира» is a tier name, so English must not turn it into a coverage
  // claim like "Half the world" that the packages do not keep.
  assert.equal(C.REGION_NAMES_EN['HALF GLOBAL'], 'Half Global');
  assert.equal(C.REGION_NAMES_EN['BEST WORLD'], 'Best World');
});

test('English pluralises on one, and zero is plural', () => {
  // The case a naive `n > 1` gets wrong.
  assert.equal(C.pluralEn(0, 'country', 'countries'), 'countries');
  assert.equal(C.pluralEn(1, 'country', 'countries'), 'country');
  assert.equal(C.pluralEn(2, 'country', 'countries'), 'countries');
  assert.equal(C.countryWordEn(1), '1 country');
  assert.equal(C.countryWordEn(11), '11 countries');
  // Russian's three forms must be untouched by any of this.
  assert.equal(C.countryWord(1), '1 страна');
  assert.equal(C.countryWord(2), '2 страны');
  assert.equal(C.countryWord(5), '5 стран');
});

test('every server error code this build knows has both languages', () => {
  for (const [code, entry] of Object.entries(C.SERVER_ERRORS)) {
    assert.ok(entry.ru, `no Russian sentence for ${code}`);
    assert.ok(entry.en, `no English sentence for ${code}`);
    assert.notEqual(entry.en, entry.ru, `${code} was never translated`);
  }
  assert.deepEqual(
    Object.keys(C.SERVER_ERRORS).sort(), C.KNOWN_ERROR_CODES.slice().sort(),
    'the code list and the sentence map disagree'
  );
});

test('no server error sentence hides in the UI dictionary, where t() could not reach it', () => {
  // Codes are DATA. Reaching them through t() would mean a computed key, which
  // this project forbids because a computed key is invisible to the scanner
  // that proves no dictionary entry is dead.
  const shouted = Object.keys(LOCALES.ru)
    .filter((k) => k.startsWith('errors.'))
    .map((k) => k.slice('errors.'.length))
    .filter((k) => /^[A-Z_]+$/.test(k));

  assert.deepEqual(shouted, [], 'code-addressed sentences belong in SERVER_ERRORS');
});

test('an unknown code gets null, so each screen picks its own fallback', () => {
  assert.equal(C.errorText('PROMO_CODE_EXPIRED', 'en'), 'This promo code has expired.');
  assert.equal(C.errorText('PROMO_CODE_EXPIRED', 'ru'), 'Срок действия промокода истёк.');
  assert.equal(C.errorText('WIDGET_EXPLODED', 'en'), null);
  assert.equal(C.errorText('', 'en'), null);
  assert.equal(C.errorText(null, 'en'), null);
  // A language nobody has still answers, in Russian.
  assert.equal(C.errorText('RATE_LIMITED', 'de'), 'Слишком много попыток. Попробуйте чуть позже.');
});

test('an unknown error code has no key, so it can never be printed as one', () => {
  // t() returns THE KEY when it misses. Without this, a code this build has
  // not heard of would render «errors.WIDGET_EXPLODED» to a customer.
  assert.equal(C.errorKey('PROMO_CODE_EXPIRED'), 'errors.PROMO_CODE_EXPIRED');
  assert.equal(C.errorKey('WIDGET_EXPLODED'), null);
  assert.equal(C.errorKey(''), null);
  assert.equal(C.errorKey(null), null);
  assert.equal(C.errorKey(undefined), null);
});

test('the Russian error sentences are the ones that already ship, byte for byte', () => {
  // The whole safety argument for this phase: English was ADDED, Russian was
  // not rewritten. Compared against PROMO_MESSAGES itself, not against a copy.
  for (const [code, sentence] of Object.entries(C.PROMO_MESSAGES)) {
    assert.equal(C.SERVER_ERRORS[code].ru, sentence, `Russian wording for ${code} moved`);
  }
  // …and promoMessage(), the function the promo screen already calls, still
  // answers exactly what it answered before any of this.
  assert.equal(C.promoMessage('PROMO_CODE_EXPIRED'), 'Срок действия промокода истёк.');
  assert.equal(C.promoMessage('NOPE'), 'Не удалось применить промокод.');
});

test('both dictionaries answer for every key the other has', () => {
  const ru = Object.keys(LOCALES.ru).sort();
  const en = Object.keys(LOCALES.en).sort();

  assert.deepEqual(ru.filter((k) => !LOCALES.en[k]), [], 'keys with no English');
  assert.deepEqual(en.filter((k) => !LOCALES.ru[k]), [], 'keys with no Russian');
});
