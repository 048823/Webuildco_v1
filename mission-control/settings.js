/* Mission Control — user settings store.
   Pure helpers + defaults, shared by the browser (classic <script>, loaded
   before app.js) and by settings.test.mjs (CommonJS require). Settings live in
   this browser's localStorage only — nothing is sent to the server. */
(function (root) {
  "use strict";

  var KEY = "mc_settings";
  var CURRENCIES = ["AUD", "USD", "MYR", "SGD", "GBP", "EUR"];
  var THEMES = ["system", "light", "dark"];
  var DENSITIES = ["comfortable", "compact"];
  var REFRESH_CHOICES = [0, 1, 5, 15];
  var ROW_CHOICES = [10, 14, 25, 50];
  // Sections the user can never hide — without them there is no way back to Settings.
  var PINNED = ["overview", "settings"];

  var DEFAULTS = {
    v: 1,
    hidden: [],
    theme: "system",
    density: "comfortable",
    landing: "overview",
    briefTab: "all",
    rows: 14,
    base: "AUD",
    // Units of each currency per 1 AUD. Editable in Settings — no live FX feed.
    fx: { AUD: 1, USD: 0.66, MYR: 2.95, SGD: 0.88, GBP: 0.88, EUR: 0.6 },
    refresh: 0,
    tags: [
      { id: "client", label: "Client", color: "#0d9488", cat: "Engagement" },
      { id: "internal", label: "Internal", color: "#52525b", cat: "Engagement" },
      { id: "venture", label: "Venture", color: "#db2777", cat: "Engagement" },
      { id: "website", label: "Website", color: "#2563eb", cat: "Type" },
      { id: "crm-app", label: "CRM / App", color: "#7c3aed", cat: "Type" },
      { id: "ecommerce", label: "E-commerce", color: "#16a34a", cat: "Type" },
      { id: "landing", label: "Landing", color: "#d97706", cat: "Type" },
      { id: "agent", label: "Agent build", color: "#dc2626", cat: "Type" },
    ],
    assign: {},
  };

  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var isHex = function (s) { return /^#[0-9a-fA-F]{6}$/.test(String(s == null ? "" : s)); };
  var oneOf = function (v, list, fallback) { return list.indexOf(v) === -1 ? fallback : v; };
  var strs = function (v) {
    return Array.isArray(v) ? v.filter(function (x) { return typeof x === "string" && x; }) : [];
  };

  /* Anything read back out of localStorage is untrusted — a stale or
     hand-edited blob must never reach the renderer. Every field is validated
     against the defaults, and an unknown field is dropped. */
  function merge(saved) {
    var s = clone(DEFAULTS);
    if (!saved || typeof saved !== "object") return s;
    s.hidden = strs(saved.hidden).filter(function (id) { return PINNED.indexOf(id) === -1; });
    s.theme = oneOf(saved.theme, THEMES, s.theme);
    s.density = oneOf(saved.density, DENSITIES, s.density);
    if (typeof saved.landing === "string" && saved.landing) s.landing = saved.landing;
    if (typeof saved.briefTab === "string" && saved.briefTab) s.briefTab = saved.briefTab;
    s.rows = oneOf(Number(saved.rows), ROW_CHOICES, s.rows);
    s.base = oneOf(saved.base, CURRENCIES, s.base);
    s.refresh = oneOf(Number(saved.refresh), REFRESH_CHOICES, s.refresh);
    if (saved.fx && typeof saved.fx === "object") {
      CURRENCIES.forEach(function (c) {
        var r = Number(saved.fx[c]);
        if (isFinite(r) && r > 0) s.fx[c] = r;
      });
    }
    s.fx.AUD = 1; // AUD is the pivot; a non-1 rate would double-convert.
    if (Array.isArray(saved.tags)) {
      s.tags = saved.tags
        .filter(function (t) { return t && typeof t.id === "string" && t.id && typeof t.label === "string"; })
        .map(function (t) {
          return {
            id: t.id,
            label: String(t.label).slice(0, 40),
            color: isHex(t.color) ? t.color : "#52525b",
            cat: typeof t.cat === "string" ? String(t.cat).slice(0, 24) : "Type",
          };
        });
    }
    if (saved.assign && typeof saved.assign === "object" && !Array.isArray(saved.assign)) {
      var ids = s.tags.map(function (t) { return t.id; });
      s.assign = {};
      Object.keys(saved.assign).forEach(function (k) {
        var kept = strs(saved.assign[k]).filter(function (id) { return ids.indexOf(id) !== -1; });
        if (kept.length) s.assign[k] = kept;
      });
    }
    return s;
  }

  /* Convert between currencies through the AUD pivot. Unknown or zero rate =
     no conversion, so a bad rate shows the raw number instead of a wrong one. */
  function convert(n, from, to, fx) {
    var amount = Number(n) || 0;
    if (!fx || from === to) return amount;
    var f = Number(fx[from]), t = Number(fx[to]);
    if (!isFinite(f) || !isFinite(t) || f <= 0 || t <= 0) return amount;
    return amount * t / f;
  }

  // Sections the sidebar should show, in declared order.
  function visible(sections, hidden) {
    var hide = strs(hidden);
    return (sections || []).filter(function (s) {
      return PINNED.indexOf(s.id) !== -1 || hide.indexOf(s.id) === -1;
    });
  }

  function load(storage) {
    var store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return clone(DEFAULTS);
    try { return merge(JSON.parse(store.getItem(KEY) || "null")); }
    catch (e) { return clone(DEFAULTS); }
  }

  function save(settings, storage) {
    var store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return settings;
    try { store.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* quota / private mode */ }
    return settings;
  }

  var api = {
    KEY: KEY, DEFAULTS: DEFAULTS, CURRENCIES: CURRENCIES, THEMES: THEMES,
    DENSITIES: DENSITIES, REFRESH_CHOICES: REFRESH_CHOICES, ROW_CHOICES: ROW_CHOICES,
    PINNED: PINNED, merge: merge, convert: convert, visible: visible,
    load: load, save: save, isHex: isHex, clone: clone,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MCSettings = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
