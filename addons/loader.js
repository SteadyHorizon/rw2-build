/*! RW2 Reveal Build – addons/loader.js (production, small, lazy, no-bloat)
   Purpose: Minimal add-ons loader/glue with:
   - is(name): presence check for loaded modules
   - add(spec): register a module (and optionally autoload)
   - init(): lazy-load enabled modules (from config / data-attrs / query)
   Features: idempotent, Promise-based, SRI support, zero console output
*/
(function () {
  "use strict";

  // -------- Config (override via window.RW2_ADDONS or data-addons) --------
  var BASE = (function () {
    try {
      var s = document.currentScript;
      if (s && s.src) {
        // Use the same directory as this loader
        return s.src.replace(/[^/]+$/, "");
      }
    } catch (_) {}
    return "addons/"; // fallback
  })();

  // Default module registry (name -> spec)
  // Each spec: { src, sri?, global?, enabled?, version?, defer? }
  var REG = {
    "schema": {
      src: "schema.js",
      global: null,        // purely injects JSON-LD
      enabled: true
    },
    "confirm": {
      src: "confirm.drop.js",
      global: "RW2ConfirmDrop",
      enabled: true
    },
    "fallback": {
      src: "fallback.js",
      global: "RW2FallbackRouter",
      enabled: true
    },
    "submission": {
      src: "submission.controller.js",
      global: "RW2Submission",
      enabled: true
    }
  };

  // -------- Small utilities --------
  function $(sel, ctx) { try { return (ctx || document).querySelector(sel); } catch (_) { return null; } }
  function parseCSV(s) {
    if (!s) return [];
    return String(s).split(",").map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function uniq(arr) {
    var out = [], seen = {};
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (!seen[v]) { seen[v] = 1; out.push(v); }
    }
    return out;
  }
  function hasGlobal(name) {
    try { return !!(name && window[name]); } catch (_) { return false; }
  }

  // Build absolute URL for a module (supports version suffix)
  function buildUrl(spec) {
    var src = spec.src || "";
    if (spec.version) {
      // e.g., confirm.drop.v1.0.3.js or ?v=1.0.3 (choose suffix approach)
      if (/\.js$/i.test(src)) {
        var parts = src.split(".js");
        src = parts[0] + ".v" + spec.version + ".js";
      } else {
        src = src + "?v=" + encodeURIComponent(spec.version);
      }
    }
    if (/^https?:\/\//i.test(src) || /^\/\//.test(src) || /^\//.test(src)) return src;
    return BASE + src;
  }

  // -------- Tiny script loader (Promise, SRI, once) --------
  var LOADED = {}; // name -> Promise
  function loadScript(name, spec) {
    if (LOADED[name]) return LOADED[name];

    var p = new Promise(function (resolve, reject) {
      try {
        var url = buildUrl(spec);
        var s = document.createElement("script");
        s.src = url;
        s.async = true;
        if (spec.defer) s.defer = true;
        if (spec.sri) {
          s.integrity = spec.sri;
          s.crossOrigin = "anonymous";
        }
        s.onload = function () { resolve({ name: name, url: url }); };
        s.onerror = function () { reject({ name: name, url: url }); };
        document.head.appendChild(s);
      } catch (e) { reject(e); }
    });

    LOADED[name] = p;
    return p;
  }

  // -------- Source of truth for which modules to enable --------
  function enabledSet() {
    var set = [];

    // 1) From data-addons on #app or <body>
    var root = $("#app") || $("body");
    if (root) {
      set = set.concat(parseCSV(root.getAttribute("data-addons")));
    }

    // 2) From query string ?addons=confirm,fallback
    try {
      var qs = new URLSearchParams(window.location.search);
      var q = qs.get("addons");
      if (q) set = set.concat(parseCSV(q));
    } catch (_) { /* no-op */ }

    // 3) From window.RW2_ADDONS (object or array)
    try {
      var cfg = window.RW2_ADDONS;
      if (Array.isArray(cfg)) set = set.concat(cfg);
      else if (cfg && typeof cfg === "object") {
        Object.keys(cfg).forEach(function (k) {
          if (cfg[k] === true) set.push(k);
          // also allow version or sri overrides via object
          if (REG[k] && typeof cfg[k] === "object") {
            var spec = cfg[k];
            if (typeof spec.version === "string") REG[k].version = spec.version;
            if (typeof spec.sri === "string") REG[k].sri = spec.sri;
            if (typeof spec.src === "string") REG[k].src = spec.src;
            if (typeof spec.enabled === "boolean") REG[k].enabled = spec.enabled;
          }
        });
      }
    } catch (_) { /* no-op */ }

    // 4) Defaults from REG.enabled
    Object.keys(REG).forEach(function (k) {
      if (REG[k].enabled) set.push(k);
    });

    return uniq(set);
  }

  // -------- Public API --------
  var API = {
    // Presence check for module globals or load status
    is: function (name) {
      if (!name || !REG[name]) return false;
      var g = REG[name].global;
      if (g && hasGlobal(g)) return true;
      return !!LOADED[name]; // already requested/loaded
    },

    // Register/override a module spec. If autoload true, load immediately.
    add: function (name, spec, autoload) {
      if (!name || !spec) return API;
      if (!REG[name]) REG[name] = {};
      var cur = REG[name];
      cur.src = (typeof spec.src === "string") ? spec.src : cur.src;
      cur.global = (typeof spec.global === "string" || spec.global === null) ? spec.global : cur.global;
      cur.sri = (typeof spec.sri === "string") ? spec.sri : cur.sri;
      cur.version = (typeof spec.version === "string") ? spec.version : cur.version;
      cur.enabled = (typeof spec.enabled === "boolean") ? spec.enabled : (typeof cur.enabled === "boolean" ? cur.enabled : true);
      cur.defer = (typeof spec.defer === "boolean") ? spec.defer : cur.defer;

      if (autoload) {
        API.load(name);
      }
      return API;
    },

    // Explicitly load one module by name
    load: function (name) {
      if (!name || !REG[name]) return Promise.resolve(null);
      var spec = REG[name];
      if (spec.global && hasGlobal(spec.global)) {
        return Promise.resolve({ name: name, cached: true });
      }
      return loadScript(name, spec);
    },

    // Initialize: lazy-load all enabled modules (idempotent)
    init: function () {
      if (API._inited) return API._promise || Promise.resolve([]);
      API._inited = true;

      var list = enabledSet().filter(function (k) { return !!REG[k]; });
      var promises = list.map(function (k) { return API.load(k); });
      var p = Promise.all(promises).catch(function () { return []; });
      API._promise = p;

      // Optional: expose a tiny bridge for core to call fallback router
      if (!window.RW2LoadRoute && window.RW2FallbackRouter && typeof window.RW2FallbackRouter.render === "function") {
        window.RW2LoadRoute = function (r) {
          try { window.RW2FallbackRouter.render(r); } catch (_) {}
        };
      }
      return p;
    }
  };

  // Expose
  if (!window.RW2Loader) window.RW2Loader = API;

  // Auto-init on DOM ready (non-blocking)
  function ready(fn) {
    if (document && document.readyState === "loading") {
      try { document.addEventListener("DOMContentLoaded", fn, { once: true }); } catch (_) { fn(); }
    } else { fn(); }
  }
  ready(function () { API.init(); });

})();
