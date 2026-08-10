// Tests for catalogue fetching: retries and the fallback source.
//
// The failure these guard against was observed in production on 2026-08-10: the
// Yandex Cloud balancer in front of api.magicesim.store answered
// {"error":"upstream_unreachable"} with HTTP 502 after ~13.9 s, in bursts —
// 5 failures in 6 requests, then 2 in 10, then 0 in 24 within half an hour. The
// script had no retry, so a single unlucky request failed the whole workflow.
//
// The rule that must survive every change here: a source counts as successful
// only when it returns HTTP 200 AND a body that parses AND a non-empty `data`
// array. Anything else is a failure, because publishing a malformed catalogue
// would overwrite a good one.
//
//   node --test scripts/update-catalog-cache.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchLiveCatalogue,
  fetchCatalogueOnce,
  CATALOG_SOURCES,
  FETCH_ATTEMPTS,
} from './update-catalog-cache.mjs';

// Minimal fetch double. `script` is consumed one entry per call, so a test can
// say "fail twice, then succeed".
const PKG = { package_id: 'p1', name: 'Vietnam 3GB', price: 700 };

const ok = (data = [PKG]) => ({ status: 200, text: async () => JSON.stringify({ data }) });
const bad502 = () => ({ status: 502, text: async () => '{"error":"upstream_unreachable"}' });
const badJson = () => ({ status: 200, text: async () => 'not json at all' });
const noArray = () => ({ status: 200, text: async () => JSON.stringify({ data: 'nope' }) });
const empty = () => ({ status: 200, text: async () => JSON.stringify({ data: [] }) });

function fakeFetch(script) {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    const next = script.shift();
    if (!next) throw new Error('fake fetch exhausted — more calls than the test scripted');
    // Entries may be a response object or a thunk producing one.
    return typeof next === 'function' ? next() : next;
  };
  impl.calls = calls;
  return impl;
}

const SOURCES = [
  { name: 'api', base: 'https://api.example' },
  { name: 'origin', base: 'https://origin.example' },
];
// Backoff is irrelevant to correctness and would only slow the suite down.
const NO_WAIT = { backoff: [0, 0], log: () => {} };

// --------------------------------------------------------------------------

test('primary succeeds on the first attempt: one request, no fallback', async () => {
  const f = fakeFetch([ok()]);
  const r = await fetchLiveCatalogue({ fetchImpl: f, sources: SOURCES, ...NO_WAIT });

  assert.equal(r.source, 'api');
  assert.equal(r.attempt, 1);
  assert.deepEqual(r.packages, [PKG]);
  assert.equal(f.calls.length, 1, 'a healthy primary must not be retried');
  assert.ok(f.calls[0].startsWith('https://api.example/'));
});

test('primary 502 then success: retried on the same source, fallback untouched', async () => {
  const f = fakeFetch([bad502(), ok()]);
  const r = await fetchLiveCatalogue({ fetchImpl: f, sources: SOURCES, ...NO_WAIT });

  assert.equal(r.source, 'api');
  assert.equal(r.attempt, 2);
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls.every((u) => u.startsWith('https://api.example/')),
    'a transient primary failure must not reach for the fallback');
});

test('primary fails three times: falls back to origin', async () => {
  const f = fakeFetch([bad502(), bad502(), bad502(), ok()]);
  const r = await fetchLiveCatalogue({ fetchImpl: f, sources: SOURCES, ...NO_WAIT });

  assert.equal(r.source, 'origin');
  assert.equal(r.attempt, 1, 'the fallback starts its own attempt count');
  assert.equal(f.calls.length, 4, 'exactly FETCH_ATTEMPTS on the primary, then the fallback');
  assert.equal(f.calls.filter((u) => u.includes('api.example')).length, 3);
  assert.ok(f.calls[3].startsWith('https://origin.example/'));
});

test('both sources exhausted: throws, and the failure list names every attempt', async () => {
  const f = fakeFetch([bad502(), bad502(), bad502(), bad502(), bad502(), bad502()]);

  await assert.rejects(
    () => fetchLiveCatalogue({ fetchImpl: f, sources: SOURCES, ...NO_WAIT }),
    (e) => {
      // The caller keys off this throw to leave catalog.json alone.
      assert.equal(e.failures.length, 6);
      assert.ok(e.failures.some((x) => x.startsWith('api #1')));
      assert.ok(e.failures.some((x) => x.startsWith('origin #3')));
      assert.match(e.message, /все источники недоступны/);
      return true;
    }
  );
  assert.equal(f.calls.length, 6, '3 attempts × 2 sources, then stop');
});

// --------------------------------------------------------------------------
// A 200 is not enough. These are the cases where the balancer is healthy but
// what comes back must still not be published.

test('invalid JSON is a failure, not a success', async () => {
  const f = fakeFetch([badJson(), badJson(), badJson(), ok()]);
  const r = await fetchLiveCatalogue({ fetchImpl: f, sources: SOURCES, ...NO_WAIT });

  assert.equal(r.source, 'origin', 'a 200 carrying garbage must fall through');
  assert.equal(f.calls.length, 4);
});

test('a 200 with no data array is a failure', async () => {
  const f = fakeFetch([noArray(), noArray(), noArray(), ok()]);
  const r = await fetchLiveCatalogue({ fetchImpl: f, sources: SOURCES, ...NO_WAIT });
  assert.equal(r.source, 'origin');
});

test('an empty catalogue is a failure — it would wipe the cache', async () => {
  const f = fakeFetch([empty(), empty(), empty(), empty(), empty(), empty()]);
  await assert.rejects(() => fetchLiveCatalogue({ fetchImpl: f, sources: SOURCES, ...NO_WAIT }),
    (e) => {
      assert.ok(e.failures.every((x) => /empty catalogue/.test(x)));
      return true;
    });
});

test('a malformed payload never wins over a later good source', async () => {
  // The dangerous ordering: the primary answers 200 with rubbish while the
  // fallback is healthy. The rubbish must lose.
  const f = fakeFetch([empty(), badJson(), noArray(), ok()]);
  const r = await fetchLiveCatalogue({ fetchImpl: f, sources: SOURCES, ...NO_WAIT });
  assert.equal(r.source, 'origin');
  assert.deepEqual(r.packages, [PKG]);
});

// --------------------------------------------------------------------------

test('fetchCatalogueOnce enforces the rules on its own', async () => {
  const call = (resp) => fetchCatalogueOnce('https://x.example', { fetchImpl: async () => resp() });

  assert.deepEqual(await call(ok), [PKG]);
  await assert.rejects(() => call(bad502), /HTTP 502/);
  await assert.rejects(() => call(badJson), /not valid JSON/);
  await assert.rejects(() => call(noArray), /no data array/);
  await assert.rejects(() => call(empty), /empty catalogue/);
});

test('the shipped configuration is two sources and three attempts', async () => {
  assert.equal(FETCH_ATTEMPTS, 3);
  assert.equal(CATALOG_SOURCES.length, 2);
  assert.equal(CATALOG_SOURCES[0].name, 'api');
  assert.equal(CATALOG_SOURCES[1].name, 'origin');
  // Distinct hosts, or the fallback is decoration.
  assert.notEqual(CATALOG_SOURCES[0].base, CATALOG_SOURCES[1].base);
});

test('nothing secret is logged: only host names reach the log', async () => {
  const lines = [];
  const f = fakeFetch([bad502(), bad502(), bad502(), ok()]);
  await fetchLiveCatalogue({ fetchImpl: f, sources: SOURCES, backoff: [0, 0], log: (m) => lines.push(m) });

  const joined = lines.join('\n');
  for (const forbidden of ['Authorization', 'Bearer', 'token', 'apikey', 'api_key', 'password', 'secret']) {
    assert.ok(!joined.toLowerCase().includes(forbidden.toLowerCase()), `leaked: ${forbidden}`);
  }
  // The cache-busting query string is noise in a log; the host is the point.
  assert.ok(lines.every((l) => !l.includes('?t=')));
});
