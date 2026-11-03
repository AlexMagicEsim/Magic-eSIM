'use strict';

/*
 * A browser test talks to the local test server only.
 *
 * Every request to any other host — Yandex Metrika's tag.js and its pixel on
 * the Russian pages, the production API, anything else on the internet — is
 * aborted at once, unless a route registered AFTER this one answers it (a
 * test's own API stub: Playwright tries the most recent route first).
 *
 * Why (2026-11-03): test/e2e/published-counts.spec.js let the RU pages load
 * https://mc.yandex.ru/metrika/tag.js from the internet. In the SEO refresh's
 * container that request hung (status -1 in the trace), the async script held
 * the page's «load», and Seychelles and South Africa timed out at 30 s — a red
 * SEO refresh that had nothing to do with the pages. The same spec passed 100
 * of 100 locally, where Yandex answers. seo/test-e2e-hermetic.mjs requires this
 * (or an equivalent block) in every spec that opens a Russian page.
 */
const LOCAL = /^(?:https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/|data:|blob:|about:)/;

async function isolateFromInternet(context) {
  await context.route((url) => !LOCAL.test(url.href), (route) => route.abort('blockedbyclient'));
}

module.exports = { isolateFromInternet, LOCAL };
