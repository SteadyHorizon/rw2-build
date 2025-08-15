/*! RW2 Reveal Build – addons/confirm.drop.js (production) */
(function () {
  "use strict";

  var DROP_ID = "rw2-confirm-drop";
  var ACTIVE_CLASS = "rw2-confirm-active";
  var ANIM_DURATION = 1200; // ms, total flip/transition time

  // --- Create confirmation drop DOM ---
  function buildDrop(message) {
    if (document.getElementById(DROP_ID)) return; // already built

    var overlay = document.createElement("div");
    overlay.id = DROP_ID;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-live", "assertive");
    overlay.innerHTML = (
      '<div class="rw2-drop-inner">' +
        '<div class="rw2-drop-card">' +
          '<div class="rw2-drop-front">' +
            '<h2>Confirmation</h2>' +
            '<p>' + (message || "Your submission was received successfully.") + '</p>' +
          '</div>' +
          '<div class="rw2-drop-back">' +
            '<h2>All Set</h2>' +
            '<p>We’ll guide you to the next step.</p>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(overlay);
  }

  // --- Apply styles inline for portability ---
  function injectStyles() {
    if (document.getElementById(DROP_ID + "-styles")) return;
    var css = '' +
      '#' + DROP_ID + '{position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;pointer-events:none;transition:opacity 200ms ease-out;}' +
      '#' + DROP_ID + '.' + ACTIVE_CLASS + '{opacity:1;pointer-events:auto;}' +
      '.rw2-drop-inner{perspective:1000px;}' +
      '.rw2-drop-card{width:320px;height:200px;transform-style:preserve-3d;transition:transform 600ms ease-in-out;}' +
      '#' + DROP_ID + '.' + ACTIVE_CLASS + ' .rw2-drop-card{transform:rotateY(180deg);}' +
      '.rw2-drop-front,.rw2-drop-back{position:absolute;width:100%;height:100%;backface-visibility:hidden;background:#0f1631;color:#e6ecff;border-radius:12px;padding:20px;box-shadow:0 6px 20px rgba(0,0,0,0.4);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;}' +
      '.rw2-drop-front h2,.rw2-drop-back h2{margin:0 0 8px;font-size:18px;}' +
      '.rw2-drop-front p,.rw2-drop-back p{margin:0;font-size:14px;line-height:1.4;color:#9fb0ff;}' +
      '.rw2-drop-back{transform:rotateY(180deg);}';
    var s = document.createElement("style");
    s.id = DROP_ID + "-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  // --- Show confirmation drop ---
  function showConfirmDrop(message, cb) {
    buildDrop(message);
    injectStyles();
    var overlay = document.getElementById(DROP_ID);
    if (!overlay) return;
    overlay.classList.add(ACTIVE_CLASS);

    // Auto-hide after animation
    setTimeout(function () {
      hideConfirmDrop();
      if (typeof cb === "function") cb();
    }, ANIM_DURATION + 400); // add buffer for exit
  }

  // --- Hide and remove confirmation drop ---
  function hideConfirmDrop() {
    var overlay = document.getElementById(DROP_ID);
    if (!overlay) return;
    overlay.classList.remove(ACTIVE_CLASS);
    setTimeout(function () {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 200);
  }

  // --- Public API hook ---
  window.RW2ConfirmDrop = {
    show: showConfirmDrop,
    hide: hideConfirmDrop
  };

})();
