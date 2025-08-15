/*! RW2 Reveal Build – addons/schema.js (production) */
(function () {
  "use strict";

  // --- Lightweight config (edit to your real data before ship) ---
  var CONFIG = {
    brandName: "RW2 • SignalPath",
    siteUrl: (function () {
      try { return window.location.origin || ""; } catch (_) { return ""; }
    })(),
    logoPath: "/assets/logo.svg",         // ensure this asset exists
    telephone: "",                        // e.g., "+1-800-555-1212"
    email: "",                            // e.g., "support@yourdomain.com"
    sameAs: [/* e.g., "https://www.linkedin.com/company/yourbrand" */],
    areaServed: "US",
    language: "en",
    // Optional: set to true if you run a site-level search box and wire it up below
    enableSearchAction: false,
    searchUrlTemplate: "/search?q={search_term_string}"
  };

  // --- Utils ---
  function clean(o) {
    if (o && typeof o === "object") {
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (v === null || v === undefined || v === "" ||
            (Array.isArray(v) && v.length === 0) ||
            (typeof v === "object" && Object.keys(clean(v)).length === 0)) {
          delete o[k];
        }
      });
    }
    return o;
  }

  function injectJsonLd(id, data) {
    try {
      if (!document || !document.head) return;
      if (id && document.getElementById(id)) return; // idempotent
      var s = document.createElement("script");
      if (id) s.id = id;
      s.type = "application/ld+json";
      s.text = JSON.stringify(data);
      document.head.appendChild(s);
    } catch (_) { /* no-op in production */ }
  }

  function nowISODate() {
    try { return new Date().toISOString().split("T")[0]; } catch (_) { return undefined; }
  }

  // --- Schema payloads ---
  var org = clean({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": CONFIG.brandName,
    "url": CONFIG.siteUrl,
    "logo": CONFIG.siteUrl && CONFIG.logoPath ? (CONFIG.siteUrl + CONFIG.logoPath) : undefined,
    "description": "AI-driven behavioral engagement for credit resolution and document preparation using Blink Transitions, Misfire Logic, and persona-tuned micro-commitment flows.",
    "sameAs": CONFIG.sameAs && CONFIG.sameAs.length ? CONFIG.sameAs : undefined,
    "contactPoint": clean({
      "@type": "ContactPoint",
      "telephone": CONFIG.telephone || undefined,
      "email": CONFIG.email || undefined,
      "contactType": "customer service",
      "areaServed": CONFIG.areaServed || undefined,
      "availableLanguage": CONFIG.language ? [CONFIG.language] : undefined
    })
  });

  var website = clean({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": CONFIG.brandName,
    "url": CONFIG.siteUrl,
    "inLanguage": CONFIG.language || undefined,
    "dateModified": nowISODate(),
    "potentialAction": CONFIG.enableSearchAction ? clean({
      "@type": "SearchAction",
      "target": CONFIG.siteUrl ? (CONFIG.siteUrl + CONFIG.searchUrlTemplate) : undefined,
      "query-input": "required name=search_term_string"
    }) : undefined
  });

  // Simple top-level breadcrumb (Home → Start). Safe even if you keep a single page.
  var breadcrumbs = clean({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      clean({
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": CONFIG.siteUrl || undefined
      }),
      clean({
        "@type": "ListItem",
        "position": 2,
        "name": "Start",
        "item": CONFIG.siteUrl ? (CONFIG.siteUrl + "/#start") : undefined
      })
    ]
  });

  // Service description for what RW2 provides (generic & compliant)
  var service = clean({
    "@context": "https://schema.org",
    "@type": "Service",
    "serviceType": "Document preparation & credit resolution guidance",
    "provider": clean({
      "@type": "Organization",
      "name": CONFIG.brandName,
      "url": CONFIG.siteUrl || undefined
    }),
    "areaServed": CONFIG.areaServed || undefined,
    "availableLanguage": CONFIG.language ? [CONFIG.language] : undefined
  });

  // --- Injection (runs immediately if head is available; otherwise on DOM ready) ---
  function run() {
    injectJsonLd("rw2-jsonld-org", org);
    injectJsonLd("rw2-jsonld-website", website);
    injectJsonLd("rw2-jsonld-breadcrumbs", breadcrumbs);
    injectJsonLd("rw2-jsonld-service", service);
  }

  if (document && document.head) {
    run();
  } else {
    try {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } catch (_) { /* no-op */ }
  }
})();
