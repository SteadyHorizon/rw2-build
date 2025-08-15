/*! RW2 Reveal Build – addons/submission.controller.js (production)
   Purpose: Minimal, resilient submission controller for RW2.
   - Packages lightweight submission data (chips, last user input, route)
   - Submits to optional endpoint, else queues locally (offline-first)
   - Emits lifecycle events instead of touching UI (confirm UI handled elsewhere)
   - Defensive, idempotent, zero console noise
*/
(function () {
  "use strict";

  // ---------- Config ----------
  var CONFIG = {
    endpointUrl: "",            // e.g., "https://api.yourdomain.com/submit"
    method: "POST",
    timeoutMs: 8000,
    queueKey: "rw2_queue_v1",
    autoWire: true,             // listen to finalize CTA automatically (non-invasive)
    captureChatDepth: 4,        // how many recent user messages to keep
    maxFieldLen: 500            // hard cap per text field
  };

  // ---------- Safe DOM helpers ----------
  function $(sel, ctx) { try { return (ctx || document).querySelector(sel); } catch (_) { return null; } }
  function $all(sel, ctx) { try { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); } catch (_) { return []; } }

  // ---------- Utilities ----------
  function clampText(s, max) {
    if (!s) return s;
    var t = String(s);
    if (t.length > max) return t.slice(0, max);
    return t;
  }

  function nowISO() {
    try { return new Date().toISOString(); } catch (_) { return ""; }
  }

  function safeJSONparse(s, fallback) {
    try { return JSON.parse(s); } catch (_) { return fallback; }
  }

  function emit(name, detail) {
    try {
      var ev = new CustomEvent(name, { detail: detail, bubbles: true });
      document.dispatchEvent(ev);
    } catch (_) { /* no-op */ }
  }

  // ---------- Queue (localStorage) ----------
  function readQueue() {
    try {
      var raw = localStorage.getItem(CONFIG.queueKey);
      var arr = safeJSONparse(raw, []);
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  function writeQueue(arr) {
    try { localStorage.setItem(CONFIG.queueKey, JSON.stringify(arr || [])); } catch (_) { /* no-op */ }
  }

  function enqueue(item) {
    var q = readQueue();
    q.push(item);
    writeQueue(q);
  }

  function dequeue() {
    var q = readQueue();
    if (!q.length) return null;
    var item = q.shift();
    writeQueue(q);
    return item;
  }

  // ---------- Data capture ----------
  function captureChips() {
    var chips = $all('.chip[aria-pressed="true"]');
    return chips.map(function (c) { return c.getAttribute("data-chip") || ""; }).filter(Boolean);
  }

  function captureRoute() {
    try {
      var h = (window.location.hash || "").replace(/^#/, "");
      return h || "about";
    } catch (_) { return "about"; }
  }

  function captureLastUserMessages(depth) {
    var stream = $("#chatStream");
    if (!stream) return [];
    var msgs = $all(".msg.you", stream);
    if (!msgs.length) return [];
    var out = [];
    for (var i = msgs.length - 1; i >= 0 && out.length < depth; i--) {
      var txt = msgs[i].textContent || "";
      // Remove the "You" label if present
      txt = txt.replace(/^You\s*/i, "");
      out.push(clampText(txt.trim(), CONFIG.maxFieldLen));
    }
    return out;
  }

  function capturePersona() {
    var app = $("#app");
    return app ? (app.getAttribute("data-mode") || "soft-reactive-default") : "soft-reactive-default";
  }

  function captureOfferState() {
    var btn = $('#c-offer .cta');
    var state = btn ? (btn.getAttribute("data-cta") || "") : "";
    return state; // "start-wizard" or "finalize-step" etc.
  }

  function buildPayload(extra) {
    var payload = {
      ts: nowISO(),
      route: captureRoute(),
      personaMode: capturePersona(),
      chips: captureChips(),
      recentInputs: captureLastUserMessages(CONFIG.captureChatDepth),
      offerState: captureOfferState()
    };
    if (extra && typeof extra === "object") {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) {
          payload[k] = (typeof extra[k] === "string")
            ? clampText(extra[k], CONFIG.maxFieldLen)
            : extra[k];
        }
      }
    }
    return payload;
  }

  // ---------- Network ----------
  function submitRemote(payload, onOk, onErr) {
    if (!CONFIG.endpointUrl) {
      // No endpoint: succeed locally and queue for potential future sync
      enqueue({ mode: "local", payload: payload, ts: payload.ts });
      if (onOk) onOk({ localQueued: true });
      return;
    }

    var controller, timer;
    try { controller = new AbortController(); } catch (_) { controller = null; }
    try {
      timer = setTimeout(function () {
        try { controller && controller.abort(); } catch (_) { /* no-op */ }
      }, CONFIG.timeoutMs);
    } catch (_) { /* no-op */ }

    fetch(CONFIG.endpointUrl, {
      method: CONFIG.method || "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    })
      .then(function (r) {
        if (!r.ok) throw new Error("bad_status_" + r.status);
        return r.text().then(function (t) {
          var data = safeJSONparse(t, { ok: true });
          if (onOk) onOk(data);
        });
      })
      .catch(function () {
        // Queue on failure for later retry
        enqueue({ mode: "retry", payload: payload, ts: payload.ts });
        if (onErr) onErr({ queuedForRetry: true });
      })
      .finally(function () {
        try { clearTimeout(timer); } catch (_) { /* no-op */ }
      });
  }

  function flushQueue(onEachOk, onEachErr) {
    var moved = 0;
    var item;
    while ((item = dequeue())) {
      moved++;
      submitRemote(item.payload, onEachOk, onEachErr);
    }
    return moved;
  }

  // ---------- Public API ----------
  var API = {
    init: function init(options) {
      options = options || {};
      if (typeof options.endpointUrl === "string") CONFIG.endpointUrl = options.endpointUrl;
      if (typeof options.method === "string") CONFIG.method = options.method;
      if (typeof options.timeoutMs === "number") CONFIG.timeoutMs = options.timeoutMs;
      if (typeof options.autoWire === "boolean") CONFIG.autoWire = options.autoWire;
      if (typeof options.captureChatDepth === "number") CONFIG.captureChatDepth = options.captureChatDepth;

      // Attempt to flush any queued submissions
      flushQueue();

      // Auto-wire finalize CTA (non-invasive, no UI actions)
      if (CONFIG.autoWire) attachFinalizeListener();
    },

    setEndpoint: function setEndpoint(url, method) {
      if (typeof url === "string") CONFIG.endpointUrl = url;
      if (typeof method === "string") CONFIG.method = method;
    },

    capture: function capture(field, value) {
      // optional manual enrichment
      try {
        var v = (typeof value === "string") ? clampText(value, CONFIG.maxFieldLen) : value;
        var tmp = JSON.parse(sessionStorage.getItem("rw2_capture") || "{}");
        tmp[field] = v;
        sessionStorage.setItem("rw2_capture", JSON.stringify(tmp));
      } catch (_) { /* no-op */ }
    },

    submit: function submit(extra, callbacks) {
      var captured = safeJSONparse(sessionStorage.getItem("rw2_capture"), {});
      var payload = buildPayload(Object.assign({}, captured, extra || {}));

      emit("rw2:submission:request", { payload: payload });

      submitRemote(payload, function (res) {
        emit("rw2:submission:success", { payload: payload, response: res });
        if (callbacks && typeof callbacks.onSuccess === "function") callbacks.onSuccess(res);
      }, function (err) {
        emit("rw2:submission:error", { payload: payload, error: err });
        if (callbacks && typeof callbacks.onError === "function") callbacks.onError(err);
      });
    },

    flush: function flush(cbOk, cbErr) {
      return flushQueue(cbOk, cbErr);
    },

    getQueue: function getQueue() {
      return readQueue();
    }
  };

  // ---------- Finalize CTA listener (passive) ----------
  function attachFinalizeListener() {
    try {
      document.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest && e.target.closest('.cta[data-cta="finalize-step"]');
        if (!btn) return;

        // Build + submit silently; UI feedback handled by main script / confirm.drop
        API.submit();

        // note: do NOT preventDefault; allow core flow to proceed (avoids double-UI)
      }, { passive: true });
    } catch (_) { /* no-op */ }
  }

  // ---------- Expose ----------
  if (!window.RW2Submission) {
    window.RW2Submission = API;
  }

  // ---------- Auto-init on DOM ready ----------
  function ready(fn) {
    if (document && document.readyState === "loading") {
      try { document.addEventListener("DOMContentLoaded", fn, { once: true }); } catch (_) { /* no-op */ }
    } else { fn(); }
  }

  ready(function () {
    API.init(); // default init; override via RW2Submission.init({...}) later if needed
  });
})();
