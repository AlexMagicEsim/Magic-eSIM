// ---------------------------------------------------------------------------
// seo/head-icons.mjs — the ONE place that decides which icons a page declares.
//
// WHY THIS FILE EXISTS. Before it, the site had four different answers:
//
//   8 hand-written pages   the full set (.ico twice, .svg, 32px png, apple-touch)
//   ~199 country pages     /favicon.ico and nothing else
//   /en/                   assets/magic-esim-logo.png — a 423x320 picture WITH a
//                          wordmark in it, 107 KB, squashed into a 16px tab slot
//   /app/ (Mini App)       nothing at all
//
// and no test looked at icons, so none of that was visible to anybody. The set
// lives here, the three generators import it, the five hand-written pages repeat
// it verbatim, and seo/test-icons.mjs compares what every page family actually
// declares — parsed, not grepped — against this list.
//
// WHAT THE ARTWORK IS, AND WHY IT IS TWO DRAWINGS OF ONE MARK.
// apple-touch-icon.png, icon-192.png and icon-512.png are the Magic eSIM mark in
// full — the circuit-trace M with the eSIM chip and the stars. Since 2026-10-19
// (owner: favicon variant 1 «Плотный») favicon.svg / favicon.ico / favicon-32.png
// are THAT mark reduced for 16–32 px, not a letter: icon-512.png traced, strokes
// thickened, the inner channels closed, the ring nodes filled, one sparkle kept,
// the frame tightened so the traces run off its edges. The .ico's 48 px frame
// keeps every trace and nine sparkles. No tile: the mark stands on the tab.
// The approved drawing and how it was derived: the brandbook (BRANDBOOK_MAGIC_ESIM.md).
// The letter-M icon it replaced (2026-09-15 … 2026-10-19) and the blue-tile icon
// before that are both refused by test 8 in seo/test-icons.mjs.
//
// THE ICON HREFS CARRY A CONTENT VERSION. seo/stamp-assets.mjs adds ?v=<hash> to
// the four favicon files on every page (seo/asset-version.mjs), because browsers
// keep a favicon longer than the page — Safari until the URL changes. Test 9
// fails on a stale hash. The strings below stay unversioned: stamping is the
// build's last step, as for CSS and JS.
//
// PATHS ARE ROOT-ABSOLUTE ON PURPOSE. A country page lives two directories deep
// and a guide one; a relative icon href would have to be re-based per family,
// which is exactly the per-family drift this file removes.
// ---------------------------------------------------------------------------

// Order matters only for `rel="icon"` fallbacks in older browsers: the .ico is
// first so a browser that ignores type= still finds something, and the SVG sits
// after it because every browser that understands type="image/svg+xml" prefers
// it regardless of position.
export const ICON_LINKS = Object.freeze([
  '<link rel="icon" href="/favicon.ico" sizes="any" />',
  '<link rel="shortcut icon" href="/favicon.ico" />',
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
  '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
]);

export const MANIFEST_LINK = '<link rel="manifest" href="/site.webmanifest" />';

// The Mini App gets the icons and NOT the manifest. Its CSP is `default-src
// 'none'` with no `manifest-src`, so the browser would refuse the file anyway —
// and «installable web app» is meaningless for a page that only ever renders
// inside Telegram's WebView. Loosening a CSP to satisfy a consistency test would
// be the test damaging the thing it checks.
export const MANIFEST_EXEMPT = Object.freeze(['app/index.html']);

/** The block as it should appear in a <head>, indented to match its neighbours. */
export function headIcons(indent = '  ', { manifest = true } = {}) {
  const lines = manifest ? [...ICON_LINKS, MANIFEST_LINK] : [...ICON_LINKS];
  return lines.map((l) => indent + l).join('\n');
}
