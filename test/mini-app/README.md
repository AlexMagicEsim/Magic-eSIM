# Mini App browser tests

`app/core.test.js` covers the logic that needs no DOM (`node --test app/core.test.js`).
This directory covers the part that only a browser can answer: whether the app is
usable while the network is still deciding.

## Running

```sh
npm i -D playwright        # not vendored — this repo has no package.json by design
npx playwright install webkit
node test/mini-app/boot.e2e.js
```

WebKit specifically, on an iPhone viewport, with real touch events. iOS Telegram
runs WKWebView; a Chromium mouse click would not have caught either half of R-44.

The suite serves `app/` as-is and fakes the Telegram SDK and the gateway at the
network edge, so there is no copy of the app to drift out of date.

## What it guards

R-44, reported 2026-08-17 from an iPhone: the Mini App showed its two nav buttons
and nothing else, and neither button responded.

Two independent causes, both in this repo, neither in the backend or the proxy:

1. **Ordering.** `boot()` awaited the session mint before attaching any listener
   or showing any screen. `<nav>` sits outside `<main>`, so the buttons are
   painted the moment the HTML parses — visible, and inert. A cold gateway takes
   about twelve seconds to answer and often 502s (TD-55), and that is the window
   the taps landed in.
2. **Our own CSP.** `style-src 'self'` blocks a `style` **attribute**, which is
   how the nav asked for `padding-bottom: calc(14px + safe-area-inset-bottom)`.
   It computed to `0` in production, putting both buttons in the iPhone
   home-indicator swipe zone where the system takes the touch first. The CSSOM
   property setter is *not* covered by `style-src`, which is why `el()` now sets
   `style.cssText` and the markup uses classes.

`openSession` also had no retry at all while every read had three, so a single
cold-start 502 killed the session permanently. That part is covered in
`app/core.test.js`.

## ui.e2e.js — the design contract

```sh
node test/mini-app/ui.e2e.js                       # bundled fixture
node test/mini-app/ui.e2e.js /tmp/catalogue.json   # a real production snapshot
```

WebKit **and** Chromium, iPhone viewport, light **and** dark Telegram themes.
It asserts what the Product Blueprint requires and what the 2026-08-18 review
found missing:

- **no raw ISO or technical codes** anywhere a customer can read. The catalogue
  DTO carries no readable name — `coverage_countries` is empty on all 973
  packages, `name` is English, there is no `country` field — so the app listed
  `AD · AE · AF · AF-29`. Names now come from `seo/country-names.mjs` through
  `seo/build-country-dictionary.mjs`, which also `--check`s for drift in CI.
- **the catalogue renders with no session** (§9 S1 is public; only «Мои eSIM»,
  purchase, activation and usage need identity)
- **no horizontal scroll** — `.stack` is a grid and a grid item's `min-width`
  defaults to `auto`, so a long destination name widened the card past the
  viewport and clipped the price
- **the oferta gates payment** (§9 S4: acceptance is an act; `terms_accepted`
  was hardcoded `true`)
- correct Russian plurals, both catalogue sections, and the theme actually
  applied

Telegram sets `--tg-theme-*` through the CSSOM, and the harness does the same:
injecting a `<style>` element instead is refused by our own `style-src 'self'`,
which is the CSP working rather than a bug.
