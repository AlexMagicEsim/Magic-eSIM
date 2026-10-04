#!/usr/bin/env node
/* The English country pages: /en/esim/<slug>/, the list /en/esim/, and the
 * home's destination list en/destinations.js.
 *
 * THE ONLY GENERATOR OF ENGLISH PAGES, and it writes nothing outside `en/`.
 * The Russian country pages under `esim/` belong to build-catalogue-pages.mjs
 * alone (seo/test-one-pipeline.mjs runs every generator and proves it).
 *
 * WHAT A PAGE CARRIES, AND WHAT IT DELIBERATELY DOES NOT:
 *
 *   * No price, no plan, no count. A page is the country's name, its ISO
 *     code and empty blocks; en/country.js fills them in the browser from the
 *     GLOBAL catalogue (`?market=global`, US dollars). One catalogue, so no
 *     English page can carry a stale price, and a catalogue refresh does not
 *     rewrite 198 English pages — only a country appearing or leaving does.
 *   * No claim. These pages are a TEMPLATE: not one sentence on them was
 *     written or fact-checked for its country (the profiles carry no `en`
 *     block). So every page here is `noindex, follow`, is left out of the
 *     sitemap, and carries no hreflang — a crawler is not asked to rank a page
 *     nobody has reviewed, and the Russian twin is not paired with it. Making
 *     a page indexable is its own change (handoff 10-04 §4.5, PR 8): a reviewed
 *     English text, the sitemap entry and the reciprocal hreflang together.
 *
 * WHICH COUNTRIES: exactly the ones the Russian site has a page for
 * (seo/catalogue-countries.json — the countries whose grid renders something).
 * The slug is the same, so /esim/uae/ and /en/esim/uae/ are the same place.
 *
 * Deterministic: no clock, no network, sorted input. Run it twice and the
 * tree is byte-identical (seo/test-en-pages.mjs checks the committed output).
 *
 * Run: node seo/build-en-pages.mjs   (build-all.mjs runs it)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COUNTRY_NAMES } from './country-names.mjs';
import { stampHtml } from './asset-version.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** The English pages, as data. Exported for the tests. */
export function enCountries() {
  const { countries } = JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8'));
  return countries.map((c) => {
    const entry = COUNTRY_NAMES[c.iso];
    if (!entry || !entry.en) throw new Error(`${c.iso} (${c.slug}) has no English name in seo/country-names.mjs`);
    if (entry.slug !== c.slug) throw new Error(`${c.iso}: slug ${c.slug} ≠ dictionary ${entry.slug}`);
    if (!/^[a-z0-9-]+$/.test(c.slug)) throw new Error(`${c.slug} is not a safe path segment`);
    return { iso: c.iso, slug: c.slug, name: entry.en };
  }).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/* Shared chrome. The home (en/index.html) is hand-written and carries the same
 * header, notice and footer; the tests compare the notice word for word. */
const HEAD_ICONS = `<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="shortcut icon" href="/favicon.ico" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />`;

const ROBOTS = `<!-- A TEMPLATE PAGE: nothing on it was written or reviewed for this country,
     so it is not offered to search engines (noindex), is not in the sitemap and
     has no hreflang twin. «follow» keeps its links crawlable. -->
<meta name="robots" content="noindex, follow">`;

const header = (ruHref) => `<header>
  <div class="wrap hdr">
    <a class="brand" href="/en/"><img src="/assets/magic-esim-logo-header.png" alt="Magic eSIM"><span>Magic eSIM</span></a>
    <nav>
      <a href="/en/esim/" data-i18n="nav.destinations">Destinations</a>
      <a href="/en/#how" data-i18n="nav.how">How it works</a>
    </nav>
    <a class="langsw" href="${ruHref}" hreflang="ru" data-i18n="lang.switchToRu">Перейти на русскую версию</a>
  </div>
</header>`;

const NOTICE = `  <div class="unavail notice" id="previewNotice" role="note">
    <h2 data-i18n="preview.noticeTitle">Online payment isn't available yet — plans can't be bought here yet</h2>
    <p data-i18n="preview.noticeBody">You can browse plans, get an exact price in US dollars and go through checkout, but payment can't be taken yet: nothing is charged, and no order or eSIM is created.</p>
  </div>`;

const FOOTER = `<footer class="wrap">
  <p>© Magic eSIM · <a href="/en/esim/" data-i18n="site.allDestinations">All destinations</a> · <a href="/terms.html" hreflang="ru" data-i18n="footer.terms">Terms (in Russian)</a> · <a href="/privacy.html" hreflang="ru" data-i18n="footer.privacy">Privacy (in Russian)</a></p>
</footer>`;

/* The checkout window: plan → price fixed by the server (a GLOBAL quote) →
 * review. Each fact about the plan is shown once: coverage, data, validity
 * (the card's own title IS the data line, so a separate «plan» row only
 * repeated it). The refusal is the first thing in it, and the payment button is
 * DISABLED in the markup — en/checkout.js never enables it. */
const MODAL = `<div class="overlay" id="checkout" hidden>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="coTitle">
    <button type="button" class="close" id="coClose" data-i18n-attr="aria-label:checkout.close" aria-label="Close">×</button>
    <h3 id="coTitle" data-i18n="checkout.title">Checkout</h3>
    <div class="unavail" id="coUnavail">
      <h4 data-i18n="pay.unavailableTitle">Online payment is not available yet</h4>
      <p data-i18n="pay.unavailableBody">You can check a plan and get its exact price, but payment can't be taken yet. Nothing is charged, and no order or eSIM is created.</p>
    </div>
    <div class="rows">
      <div><span data-i18n="checkout.coverage">Coverage</span><b id="coCoverage">—</b></div>
      <div><span data-i18n="checkout.data">Data</span><b id="coData">—</b></div>
      <div><span data-i18n="checkout.term">Validity</span><b id="coTerm">—</b></div>
    </div>
    <!-- The duration stays in view on every step: changing it drops the held
         price and starts again from step 1. -->
    <div class="field" id="coTermPick" hidden>
      <label for="coDays" data-i18n="checkout.duration">Duration</label>
      <select id="coDays"></select>
    </div>
    <p class="note" id="coQuoteStatus" role="status" hidden></p>
    <div id="coStep1">
      <div class="rows"><div><span data-i18n="checkout.listed">Listed price</span><b id="coListed">—</b></div></div>
      <p class="note" data-i18n="quote.explain">The exact price is fixed by our server and held for 30 minutes.</p>
      <button type="button" class="btn" id="coQuote" data-i18n="quote.get">Get the exact price</button>
    </div>
    <div id="coStep2" hidden>
      <div class="rows"><div class="total"><span data-i18n="checkout.price">Price</span><b id="coTotal">—</b></div></div>
      <p class="note" id="coExpiry" role="status" hidden></p>
      <p class="note" id="coPriceChanged" hidden></p>
      <button type="button" class="btn btn-ghost" id="coRequote" data-i18n="quote.again" hidden>Get a new price</button>
      <div class="field">
        <label for="coEmail" data-i18n="checkout.email">Email for your eSIM</label>
        <input type="email" id="coEmail" autocomplete="email" inputmode="email" spellcheck="false" maxlength="254">
        <p class="note" data-i18n="checkout.emailNote">Not sent or saved anywhere yet — payment isn't available.</p>
      </div>
      <label class="check"><input type="checkbox" id="coDevice"> <span data-i18n="checkout.device">My phone supports eSIM and isn't carrier-locked</span></label>
      <p class="note err" id="coFormError" role="alert" hidden></p>
      <button type="button" class="btn" id="coReview" data-i18n="checkout.review">Review</button>
    </div>
    <div id="coStep3" hidden>
      <div class="rows">
        <div><span data-i18n="checkout.coverage">Coverage</span><b id="rvCoverage">—</b></div>
        <div><span data-i18n="checkout.data">Data</span><b id="rvData">—</b></div>
        <div><span data-i18n="checkout.term">Validity</span><b id="rvTerm">—</b></div>
        <div><span data-i18n="checkout.emailShort">Email</span><b id="rvEmail">—</b></div>
        <div class="total"><span data-i18n="checkout.price">Price</span><b id="rvTotal">—</b></div>
      </div>
      <div class="unavail" id="coFinal" role="status">
        <h4 data-i18n="pay.finalTitle">Online payment is not available yet</h4>
        <p data-i18n="pay.finalBody">We can't take payment yet, so nothing has been charged, no order has been created and no eSIM will be sent. Your email has not been sent or saved.</p>
      </div>
      <button type="button" class="btn" id="coPay" disabled aria-disabled="true" data-i18n="pay.disabled">Payment not available yet</button>
      <button type="button" class="btn btn-ghost" id="coBack" data-i18n="checkout.back">Back</button>
    </div>
  </div>
</div>`;

const block = (id, title, note) => `  <section class="block" id="${id}Block" hidden>
    <h2><span>${title}</span> <span class="count" id="${id}Count"></span></h2>
    <p class="note">${note}</p>
    <div class="grid" id="${id}Grid"></div>
  </section>`;

export function countryPage(c) {
  const name = esc(c.name);
  const url = `${SITE}/en/esim/${c.slug}/`;
  const title = `eSIM for ${name} — data plans in US dollars | Magic eSIM`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="eSIM data plans that cover ${name}, with prices in US dollars. Online payment is not available yet.">
<link rel="canonical" href="${url}">
${ROBOTS}
<meta property="og:type" content="website">
<meta property="og:locale" content="en_US">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${title}">
${HEAD_ICONS}
<link rel="stylesheet" href="/en/en.css">
</head>
<body data-iso="${c.iso}">

${header(`/esim/${c.slug}/`)}

<main class="wrap">
  <p class="crumbs"><a href="/en/">Magic eSIM</a> › <a href="/en/esim/" data-i18n="nav.destinations">Destinations</a> › ${name}</p>
  <h1>eSIM for ${name}</h1>
  <p class="lead">Data plans that work in ${name}, with prices in US dollars. Plans load live from the catalogue.</p>

${NOTICE}

  <p class="note" id="status" data-i18n="site.loading">Loading plans…</p>

${block('daily', 'Data every day', 'A data allowance for each day of the trip.')}

${block('local', `Plans for ${name}`, `Plans that cover ${name} only.`)}

${block('regional', `Regional plans that include ${name}`, `Plans that cover ${name} together with other countries.`)}

  <p class="note" id="currencyNote" data-i18n="price.currencyNote" hidden>Prices in US dollars (USD). These plans can't be bought on this page yet.</p>
</main>

${MODAL}

${FOOTER}

<script src="/assets/magic-net.js"></script>
<script src="/assets/global-catalog.js"></script>
<script src="/assets/daily-plan-copy.js"></script>
<script src="/assets/country-names-en.js"></script>
<script src="/assets/site-i18n.js"></script>
<script src="/en/plans.js"></script>
<script src="/en/checkout.js"></script>
<script src="/en/country.js"></script>
</body>
</html>
`;
}

export function hubPage(list) {
  const url = `${SITE}/en/esim/`;
  const items = list.slice().sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .map((c) => `    <li><a href="/en/esim/${c.slug}/">${esc(c.name)}</a></li>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>eSIM destinations — Magic eSIM</title>
<meta name="description" content="Every destination Magic eSIM has data plans for, with prices in US dollars. Online payment is not available yet.">
<link rel="canonical" href="${url}">
${ROBOTS}
${HEAD_ICONS}
<link rel="stylesheet" href="/en/en.css">
</head>
<body>

${header('/esim/')}

<main class="wrap">
  <p class="crumbs"><a href="/en/">Magic eSIM</a> › <span data-i18n="nav.destinations">Destinations</span></p>
  <h1>eSIM destinations</h1>
  <p class="lead">Pick a country to see its data plans, with prices in US dollars.</p>

${NOTICE}

  <ul class="dest">
${items}
  </ul>
</main>

${FOOTER}

</body>
</html>
`;
}

export function destinationsJs(list) {
  const rows = list.slice().sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .map((c) => `  { iso: ${JSON.stringify(c.iso)}, slug: ${JSON.stringify(c.slug)}, name: ${JSON.stringify(c.name)} },`)
    .join('\n');
  return `/* GENERATED by seo/build-en-pages.mjs — do not edit by hand.
 * The destinations that have an English page (/en/esim/<slug>/), for the
 * home's search. Static on purpose: the home reads no catalogue. */
window.MagicEnDestinations = [
${rows}
];
`;
}

function write(rel, text) {
  const file = join(ROOT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const list = enCountries();
  // The script first: the pages stamp asset versions from file contents.
  write('en/destinations.js', destinationsJs(list));
  for (const c of list) write(`en/esim/${c.slug}/index.html`, stampHtml(countryPage(c), join(ROOT, 'en/esim', c.slug)));
  write('en/esim/index.html', stampHtml(hubPage(list), join(ROOT, 'en/esim')));
  console.log(`en/esim: ${list.length} country pages + the list (all noindex), en/destinations.js`);
}
