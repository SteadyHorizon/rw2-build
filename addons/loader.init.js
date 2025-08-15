/*! RW2 Reveal Build – addons/loader.init.js (production)
    Purpose:
    - Register analytics.js so RW2Loader can lazy-load it.
    - Ensure theme.overrides.css is injected into <head> if not already linked.
    - Initialize loader so all enabled add-ons load.
*/
(function () {
  "use strict";

  // Safety: skip if loader isn't present
  if (!window.RW2Loader || typeof RW2Loader.add !== "function") return;

  // 1. Register analytics add-on (do not autoload immediately; let loader handle it)
  RW2Loader.add("analytics", {
    src: "analytics.js",
    global: "RW2Analytics",
    enabled: true
  }, false);

  // 2. Ensure theme overrides CSS is linked in <head> (after style.css for override priority)
  try {
    var alreadyLinked = document.querySelector('link[href$="addons/theme.overrides.css"]');
    if (!alreadyLinked) {
      var linkEl = document.createElement("link");
      linkEl.rel = "stylesheet";
      linkEl.href = "addons/theme.overrides.css";
      document.head.appendChild(linkEl);
    }
  } catch (_) {
    /* fail silently in production */
  }

  // 3. Initialize the loader (lazy-load all enabled add-ons)
  try {
    RW2Loader.init();
  } catch (_) {
    /* fail silently in production */
  }
})();
