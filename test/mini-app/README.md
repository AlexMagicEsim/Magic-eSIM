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
