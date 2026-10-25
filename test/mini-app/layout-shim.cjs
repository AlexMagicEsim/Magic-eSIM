'use strict';

// TEST ONLY. The catalogue answer now carries the backend's layout of every country page
// (assets/assortment-view.js); these scripts' in-page mocks predate it. Every browser context the
// scripts open gets one init script that gives a catalogue body (`data` or `packages` array, no
// `assortment`) the layout the backend gives an unfiltered list — test/helpers/assortment-layout.cjs,
// the same port the Playwright suite uses. Applied where the app READS the body (Response.text /
// .json), so it does not matter when or how a script patches fetch.

const fs = require('fs');
const path = require('path');

const HELPER = fs.readFileSync(path.join(__dirname, '..', 'helpers', 'assortment-layout.cjs'), 'utf8');
const SRC = `(function () {
  var module = { exports: {} };
  (function (module) { ${HELPER} })(module);
  var L = module.exports;
  window.__layoutOf = L.layoutOf;   // for a script that recomputes what the screen should show
  function add(b) {
    if (b && typeof b === 'object' && !Array.isArray(b) && !b.assortment) {
      var rows = Array.isArray(b.data) ? b.data : Array.isArray(b.packages) ? b.packages : null;
      if (rows) b.assortment = L.layoutOf(rows);
    }
    return b;
  }
  var text = Response.prototype.text;
  Response.prototype.text = function () {
    return text.call(this).then(function (t) {
      try { var b = JSON.parse(t); var before = !!(b && b.assortment); add(b); return before ? t : JSON.stringify(b); } catch (e) { return t; }
    });
  };
  var json = Response.prototype.json;
  Response.prototype.json = function () { return json.call(this).then(add); };
})();`;

module.exports = function shim(browserType) {
  const launch = browserType.launch.bind(browserType);
  browserType.launch = async (...args) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...a) => { const c = await newContext(...a); await c.addInitScript({ content: SRC }); return c; };
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async (...a) => { const p = await newPage(...a); await p.addInitScript({ content: SRC }); return p; };
    return browser;
  };
  return browserType;
};
