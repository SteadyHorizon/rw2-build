/*! RW2 Reveal Build – addons/fallback.js (production) */
/* Purpose: Provide safe default routing, 404 fallback, and direct-URL handling.
   - Supports deep links like /#about, /#faq, /#trust, /#start
   - Normalizes unknown hashes to DEFAULT_ROUTE
   - Renders Broadcast tiles even if core routing isn’t available
   - Idempotent; no console output; defensive against missing DOM */
(function () {
  "use strict";

  var DEFAULT_ROUTE = "about";
  var VALID_ROUTES = { about: 1, faq: 1, trust: 1, start: 1 };
  var APP_ID = "app";
  var GRID_ID = "componentGrid";
  var BROADCAST_STATUS_ID = "broadcastStatus";
  var NAV_CONTAINER_SEL = ".nav-links";
  var ACTIVE_HASH_ATTR = "data-rw2-route-active";

  // --- Views mirror core script to ensure graceful operation without it ---
  function getView(route) {
    switch (route) {
      case "faq":
        return [
          { h: "How long does it take?", sub: "Most users kick off within minutes. Docs follow cleanly.", cta: ["Open FAQ", "open-faq"] },
          { h: "What do you need from me?", sub: "Only what’s required to prepare your documents.", cta: ["See list", "open-faq"] }
        ];
      case "trust":
        return [
          { h: "Privacy by default", sub: "We store only what’s necessary for the intended purpose.", cta: ["Safeguards", "see-trust"] },
          { h: "Transparent steps", sub: "Each step is shown before you commit.", cta: ["See flow", "see-trust"] }
        ];
      case "start":
        return [
          { h: "Begin now", sub: "Answer one question to kick things off.", cta: ["Start", "start-wizard"] }
        ];
      case "about":
      default:
        return [
          { h: "What we do", sub: "We prep the path to resolution. One clean step at a time.", cta: ["Start", "start-wizard"] },
          { h: "Why it works", sub: "Blink + Misfire Logic removes friction so you can finish.", cta: ["Learn", "see-trust"] }
        ];
    }
  }

  // --- Safe DOM helpers ---
  function $(sel, ctx) {
    try { return (ctx || document).querySelector(sel); } catch (_) { return null; }
  }
  function $all(sel, ctx) {
    try { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); } catch (_) { return []; }
  }

  // --- Hash helpers ---
  function parseHash() {
    try {
      var raw = (window.location.hash || "").replace(/^#/, "").trim();
      return raw || "";
    } catch (_) { return ""; }
  }
  function normalizeRoute(hashValue) {
    var r = (hashValue || "").toLowerCase();
    return VALID_ROUTES[r] ? r : DEFAULT_ROUTE;
  }
  function setHash(route) {
    try {
      if (("#" + route) !== window.location.hash) {
        window.location.hash = "#" + route;
      }
    } catch (_) { /* no-op */ }
  }

  // --- Rendering into Broadcast (Component Zone) ---
  function renderRoute(route) {
    var grid = $("#" + GRID_ID);
    if (!grid) return;

    // Route title/status
    var status = $("#" + BROADCAST_STATUS_ID);
    if (status) {
      try {
        status.textContent = route ? route.charAt(0).toUpperCase() + route.slice(1) : "Ready";
      } catch (_) { /* no-op */ }
    }

    var data = getView(route);
    var tiles = $all(".component", grid);
    if (!tiles.length) return;

    for (var i = 0; i < data.length && i < tiles.length; i++) {
      var tile = tiles[i];
      var d = data[i];
      var h = $(".h", tile);
      var sub = $(".sub", tile);
      var btn = $(".cta", tile);

      if (h) h.textContent = d.h;
      if (sub) sub.textContent = d.sub;
      if (btn) {
        btn.textContent = d.cta[0];
        btn.setAttribute("data-cta", d.cta[1]);
      }
      if (tile.classList) tile.classList.add("fade-in");
      tile.style.display = "flex";
    }
  }

  // --- Nav protection: ensure internal links point to hashes and don’t hard-navigate ---
  function hardenNav() {
    var nav = $(NAV_CONTAINER_SEL);
    if (!nav) return;
    $all("a[data-route]", nav).forEach(function (a) {
      var r = (a.getAttribute("data-route") || "").toLowerCase();
      if (!VALID_ROUTES[r]) r = DEFAULT_ROUTE;
      // Ensure href is a hash for deep-linking and prevent full navigation
      a.setAttribute("href", "#" + r);
      a.addEventListener("click", function (e) {
        try { e.preventDefault(); } catch (_) {}
        // Setting hash triggers router below
        setHash(r);
      }, { passive: false });
    });
  }

  // --- Router core ---
  function applyRouteFromHash() {
    var app = $("#" + APP_ID);
    if (!app) return;

    // Prevent double-run within same microtask
    if (app.getAttribute(ACTIVE_HASH_ATTR) === "1") return;
    app.setAttribute(ACTIVE_HASH_ATTR, "1");

    var raw = parseHash();
    var route = normalizeRoute(raw);

    // If invalid, normalize URL to default
    if (!VALID_ROUTES[raw]) setHash(route);

    // Prefer core router if it exists (from main script), else render here
    if (typeof window.RW2LoadRoute === "function") {
      try { window.RW2LoadRoute(route); } catch (_) { renderRoute(route); }
    } else {
      renderRoute(route);
    }

    // Release guard
    app.removeAttribute(ACTIVE_HASH_ATTR);
  }

  // --- Expose optional hook so core can delegate if desired (idempotent) ---
  if (!window.RW2FallbackRouter) {
    window.RW2FallbackRouter = {
      render: renderRoute,
      normalize: normalizeRoute,
      route: function (r) { setHash(normalizeRoute(r)); },
      current: function () { return normalizeRoute(parseHash()); }
    };
  }

  // --- Init ---
  function init() {
    hardenNav();

    // Initial route (direct URL load / refresh)
    applyRouteFromHash();

    // React to hash changes
    try {
      window.addEventListener("hashchange", applyRouteFromHash, { passive: true });
    } catch (_) { /* no-op */ }

    // If no hash at all, enforce default
    if (!parseHash()) setHash(DEFAULT_ROUTE);
  }

  // Fire when ready
  if (document && document.readyState === "loading") {
    try { document.addEventListener("DOMContentLoaded", init, { once: true }); } catch (_) { /* no-op */ }
  } else {
    init();
  }
})();
