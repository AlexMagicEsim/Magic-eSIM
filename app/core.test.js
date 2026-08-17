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

test('a read gives up after three attempts, and says it was transport', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    GATEWAY_DROP, GATEWAY_DROP, GATEWAY_DROP,
  ]);
  await client.openSession('init');

  await assert.rejects(client.esims(), (err) => {
    assert.equal(err.name, 'ApiError');
    assert.equal(err.status, 502);
    assert.equal(err.isTransport, true);
    return true;
  });
  assert.equal(fetchStub.calls.length, 1 + C.READ_ATTEMPTS);
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

test('a purchase does not retry a third time, even with a key', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    GATEWAY_DROP, GATEWAY_DROP,
  ]);
  await client.openSession('init');

  await assert.rejects(client.purchase(INTENT));
  assert.equal(fetchStub.calls.length, 1 + C.WRITE_ATTEMPTS_WITH_KEY);
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

test('every request goes to the gateway, never to the Render origin', async () => {
  const { client, fetchStub } = api([
    OK({ session_token: 't', expires_in: 1800 }),
    OK({ items: [] }), OK({ data: [] }),
  ]);
  await client.openSession('init');
  await client.esims();
  await client.catalogue();

  for (const c of fetchStub.calls) {
    assert.ok(c.url.startsWith('https://api.magicesim.store'), c.url);
    assert.ok(!/onrender\.com|origin\.magicesim\.store/.test(c.url),
      'RU networks reach the origin 0/3 — a direct fallback would break the customers this app is for');
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
