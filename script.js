/*! RW2 Reveal Build — script.js (production) */
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // Shortcuts
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // Elements
  const app = $("#app");
  const stream = $("#chatStream");
  const input = $("#chatInput");
  const sendBtn = $("#sendBtn");
  const micro = $("#microBar");
  const grid = $("#componentGrid");
  const startBtn = $("#start-button");
  const toneLock = $("#toneLock");
  const broadcastStatus = $("#broadcastStatus");
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Slim in-memory state
  const state = {
    persona: "soft-reactive",
    tone: "aligning",
    started: false,
    chips: new Set(),
    log: []
  };

  // Blink Transition (screen-level)
  function blinkScreen() {
    document.body.classList.remove("blink");
    requestAnimationFrame(() => document.body.classList.add("blink"));
    setTimeout(() => document.body.classList.remove("blink"), 180);
  }

  // Safe HTML
  function escapeHTML(s = "") {
    return s.replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  // Chat stream
  function addMsg(role, text) {
    const node = document.createElement("div");
    node.className = `msg ${role} fade-in`;
    node.innerHTML = `<div class="soft-label">${role === "you" ? "You" : "RW2"}</div>${escapeHTML(text)}`;
    stream.appendChild(node);
    stream.scrollTop = stream.scrollHeight;
  }

  function setToneLock(value) {
    state.tone = value;
    if (toneLock) toneLock.textContent = `Tone: ${value}`;
  }

  // Confirmation Drop trigger (uses addon if present; falls back to Blink)
  function triggerConfirmationDrop(message, next) {
    if (window.RW2ConfirmDrop && typeof window.RW2ConfirmDrop.show === "function") {
      window.RW2ConfirmDrop.show(message || "Saved. We’re lining up your next step.", () => {
        if (typeof next === "function") next();
      });
    } else {
      blinkScreen();
      if (typeof next === "function") setTimeout(next, 350);
    }
  }

  // Reveal strategy for Component Zone
  function revealStrategy() {
    const cards = $$(".component", grid)
      .map(c => ({ el: c, prio: +(c.dataset.priority || 99) }))
      .sort((a, b) => a.prio - b.prio);

    cards.forEach(({ el }, idx) => {
      const rule = el.dataset.reveal || "revealOnScroll";
      if (rule === "delayedReveal") {
        setTimeout(() => {
          el.classList.add("fade-in");
          el.style.display = "flex";
        }, 240 + idx * 90);
      } else if (rule === "revealOnHover") {
        el.style.display = "flex";
        el.addEventListener("mouseenter", () => el.classList.add("fade-in"), { once: true });
      } else if (rule === "lockedUntilResolution") {
        el.style.display = "flex";
        const cta = el.querySelector(".cta");
        if (state.started) {
          el.classList.add("fade-in");
          cta && cta.removeAttribute("disabled");
        } else {
          el.classList.remove("fade-in");
          cta && cta.setAttribute("disabled", "");
        }
      } else {
        el.style.display = "flex";
        el.classList.add("fade-in");
      }
    });
  }

  function enableEmpowerment() {
    const emp = $("#c-empower");
    if (!emp) return;
    emp.classList.add("fade-in");
    const btn = emp.querySelector(".cta");
    if (btn) btn.removeAttribute("disabled");
  }

  function logIntel(type, payload) {
    state.log.push({ t: Date.now(), type, ...payload });
    // Hook: sync outward if needed.
  }

  function promoteOfferCTAtoFinalize() {
    // After the flow starts, turn the primary offer card into a finalize step
    const offer = $("#c-offer");
    if (!offer) return;
    const btn = offer.querySelector(".cta");
    if (!btn) return;
    btn.textContent = "Finalize Step";
    btn.dataset.cta = "finalize-step";
  }

  function resetOfferCTAtoStart() {
    const offer = $("#c-offer");
    if (!offer) return;
    const btn = offer.querySelector(".cta");
    if (!btn) return;
    btn.textContent = "Start";
    btn.dataset.cta = "start-wizard";
  }

  function startFlow() {
    if (state.started) return;
    state.started = true;
    setToneLock("locked");
    blinkScreen();
    addMsg("rw2", "Alright. I’ll guide — one question at a time. What’s the main account you want handled first?");
    enableEmpowerment();
    if (broadcastStatus) broadcastStatus.textContent = "Resolution started";
    logIntel("start", { chips: [...state.chips] });
    promoteOfferCTAtoFinalize();
    revealStrategy();
  }

  function finalizeStep() {
    // Confirmation drop + post-finalize actions
    triggerConfirmationDrop("Thanks — your step is locked in. We’re preparing the next move.", () => {
      // Post-confirm actions: route to Trust, steady tone, reset CTA
      loadRoute("trust");
      setToneLock("steady");
      resetOfferCTAtoStart();
      state.started = false; // if you want multi-step loops, keep true and branch instead
      logIntel("finalize", { chips: [...state.chips] });
    });
  }

  // Routes load into Broadcast without page nav
  function loadRoute(route) {
    if (broadcastStatus) broadcastStatus.textContent = "Loading…";

    const views = {
      about: () => [
        { h: "What we do", sub: "We prep the path to resolution. One clean step at a time.", cta: ["Start", "start-wizard"] },
        { h: "Why it works", sub: "Blink + Misfire Logic removes friction so you can finish.", cta: ["Learn", "see-trust"] }
      ],
      faq: () => [
        { h: "How long does it take?", sub: "Most users kick off within minutes. Docs follow cleanly.", cta: ["Open FAQ", "open-faq"] },
        { h: "What do you need from me?", sub: "Only what’s required to prepare your documents.", cta: ["See list", "open-faq"] }
      ],
      trust: () => [
        { h: "Privacy by default", sub: "We store only what’s necessary for the intended purpose.", cta: ["Safeguards", "see-trust"] },
        { h: "Transparent steps", sub: "Each step is shown before you commit.", cta: ["See flow", "see-trust"] }
      ],
      start: () => [
        { h: "Begin now", sub: "Answer one question to kick things off.", cta: ["Start", "start-wizard"] }
      ]
    };

    const data = (views[route] || views.about)();
    const tiles = $$(".component", grid);
    tiles.slice(0, data.length).forEach((el, i) => {
      const [title, sub, ctaLabel, ctaKey] = [data[i].h, data[i].sub, data[i].cta[0], data[i].cta[1]];
      el.querySelector(".h").textContent = title;
      el.querySelector(".sub").textContent = sub;
      const btn = el.querySelector(".cta");
      if (btn) {
        btn.textContent = ctaLabel;
        btn.dataset.cta = ctaKey;
      }
      el.classList.add("fade-in");
    });
    if (broadcastStatus) {
      broadcastStatus.textContent = route ? route[0].toUpperCase() + route.slice(1) : "Ready";
    }
    logIntel("route", { route });
  }

  // Micro-commitment nudges
  function quickNudge(key) {
    const map = {
      "resolve-debt": "Got it. Which account feels most urgent to you right now?",
      "clean-credit": "Understood. Want the fastest score wins or the cleanest long-term fix?",
      "letter-los": "I’ll prep LOS guidance. Are you ready to drop the details now?",
      "just-looking": "No problem — I’ll show a simple preview so you can see the path."
    };
    return map[key] || "Noted.";
  }

  // Soft-reactive response pattern (now includes finalize keywords)
  function respond(text) {
    const t = text.toLowerCase();

    if (/start|begin|go/.test(t)) {
      startFlow();
      return "Done. First: source of the balance — original or collector?";
    }
    if (/los|letter/.test(t)) return "Okay. I can outline LOS steps now or after we start — what do you prefer?";
    if (/credit|score/.test(t)) return "Quick win first or foundation first? Pick one and I’ll lay it out.";
    if (/help|how/.test(t)) return "I’ll guide step-by-step. Want to begin now or see the short FAQ?";

    // Finalize triggers by user message (submit/done/finished/complete)
    if (state.started && /(submit|finish|finished|finalize|done|complete|completed)/.test(t)) {
      finalizeStep();
      return "Locked. Give me a second while I set up your next step.";
    }

    return "I hear you. Want me to start the wizard now?";
  }

  // --- Events ---

  // Nav (routes -> Broadcast)
  $$(".nav-links a").forEach(a => {
    a.addEventListener("click", e => {
      const route = a.dataset.route;
      if (!route) return;
      e.preventDefault();
      blinkScreen();
      loadRoute(route);
    });
  });

  // Micro-commitment chips
  micro?.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const key = chip.dataset.chip;
    const pressed = chip.getAttribute("aria-pressed") === "true";
    chip.setAttribute("aria-pressed", String(!pressed));
    if (!pressed) state.chips.add(key);
    else state.chips.delete(key);

    if (state.chips.size === 1) setToneLock("centering");
    if (state.chips.size >= 2) setToneLock("steady");

    addMsg("rw2", quickNudge(key));
    logIntel("chip", { key });
    revealStrategy();
  });

  // Chat input
  function onSend() {
    const text = (input?.value || "").trim();
    if (!text) return;
    addMsg("you", text);
    input.value = "";
    setTimeout(() => {
      addMsg("rw2", respond(text));
      logIntel("chat", { text });
    }, 180);
  }

  sendBtn?.addEventListener("click", onSend);
  input?.addEventListener("keydown", e => {
    if (e.key === "Enter") onSend();
  });

  // Start button (nav)
  startBtn?.addEventListener("click", e => {
    e.preventDefault();
    startFlow();
  });

  // Component CTA actions (now includes finalize-step)
  grid?.addEventListener("click", e => {
    const btn = e.target.closest(".cta");
    if (!btn) return;
    const key = btn.dataset.cta;
    if (key === "start-wizard") startFlow();
    if (key === "finalize-step") finalizeStep();
    if (key === "open-faq") loadRoute("faq");
    if (key === "see-trust") loadRoute("trust");
    if (key === "learn-empower") {
      addMsg("rw2", "Unlocked tools include dispute maps, score boosts, and timing tactics.");
    }
    logIntel("cta", { key });
  });

  // Initial pass
  revealStrategy();
});
