/*! RW2 Reveal Build – addons/analytics.js (production)
   Privacy-light event logger with offline queue + Beacon/fetch fallback.
   Auto-hooks: pageview, route changes, CTA clicks, chip toggles, submission lifecycle.
*/
(function(){ "use strict";
  var CFG = {
    endpoint: "",            // e.g., "https://api.yourdomain.com/analytics"
    method: "POST",
    timeoutMs: 5000,
    queueKey: "rw2_analytics_q1",
    sendMode: "beacon"       // "beacon" | "fetch"
  };

  function nowISO(){ try{return new Date().toISOString();}catch(_){return"";} }
  function safeParse(s,f){ try{return JSON.parse(s);}catch(_){return f;} }
  function qRead(){ try{var r=localStorage.getItem(CFG.queueKey);var a=safeParse(r,[]);return Array.isArray(a)?a:[];}catch(_){return[];} }
  function qWrite(a){ try{localStorage.setItem(CFG.queueKey,JSON.stringify(a||[]));}catch(_){}} 
  function qPush(ev){ var a=qRead(); a.push(ev); qWrite(a); }
  function qShift(){ var a=qRead(); if(!a.length) return null; var x=a.shift(); qWrite(a); return x; }

  function send(ev, ok, err){
    if(!CFG.endpoint){ qPush({ts:ev.ts,type:ev.type,payload:ev.payload,local:true}); ok&&ok({localQueued:true}); return; }
    var body = JSON.stringify(ev);

    if(CFG.sendMode==="beacon" && navigator && navigator.sendBeacon){
      var okb = navigator.sendBeacon(CFG.endpoint, new Blob([body],{type:"application/json"}));
      if(!okb){ qPush(ev); err&&err({queued:true}); } else { ok&&ok({ok:true}); }
      return;
    }

    var ctl, timer; try{ctl=new AbortController();}catch(_){}
    try{timer=setTimeout(function(){ try{ctl&&ctl.abort();}catch(_){} }, CFG.timeoutMs);}catch(_){}

    fetch(CFG.endpoint,{method:CFG.method,headers:{"Content-Type":"application/json"},body:body,signal:ctl?ctl.signal:undefined})
      .then(function(r){ if(!r.ok) throw new Error("bad_status_"+r.status); ok&&ok({ok:true}); })
      .catch(function(){ qPush(ev); err&&err({queued:true}); })
      .finally(function(){ try{clearTimeout(timer);}catch(_){} });
  }

  function flush(){ var c=0,i; while((i=qShift())){ c++; send(i); } return c; }

  function evt(type,payload){ 
    send({ ts: nowISO(), type: type, payload: payload||{} }); 
  }

  // Auto hooks
  function hook(){
    flush();

    // pageview
    evt("pageview",{path:location.pathname+location.hash, ua:(navigator&&navigator.userAgent)||""});

    // route changes (fallback + core)
    try{ window.addEventListener("hashchange", function(){ evt("route",{hash:location.hash}); }, {passive:true}); }catch(_){}

    // CTA clicks
    try{ document.addEventListener("click", function(e){
      var btn = e.target && e.target.closest && e.target.closest(".cta");
      if(!btn) return;
      evt("cta",{key:btn.getAttribute("data-cta")||"", label:btn.textContent||""});
    }, {passive:true}); }catch(_){}

    // Chip toggles
    try{ document.addEventListener("click", function(e){
      var chip = e.target && e.target.closest && e.target.closest(".chip");
      if(!chip) return;
      evt("chip",{key:chip.getAttribute("data-chip")||"", pressed:chip.getAttribute("aria-pressed")});
    }, {passive:true}); }catch(_){}

    // Submission lifecycle (from submission.controller)
    try{
      document.addEventListener("rw2:submission:request", function(ev){ evt("submission_request", ev.detail||{}); }, {passive:true});
      document.addEventListener("rw2:submission:success", function(ev){ evt("submission_success", ev.detail||{}); }, {passive:true});
      document.addEventListener("rw2:submission:error",   function(ev){ evt("submission_error",   ev.detail||{}); }, {passive:true});
    }catch(_){}
  }

  // Public API
  var API = {
    init: function(opts){
      opts=opts||{};
      if(typeof opts.endpoint==="string") CFG.endpoint=opts.endpoint;
      if(typeof opts.method==="string") CFG.method=opts.method;
      if(typeof opts.timeoutMs==="number") CFG.timeoutMs=opts.timeoutMs;
      if(typeof opts.sendMode==="string") CFG.sendMode=opts.sendMode;
      flush(); hook();
    },
    event: evt,
    flush: flush,
    setEndpoint: function(u,m){ if(typeof u==="string") CFG.endpoint=u; if(typeof m==="string") CFG.method=m; }
  };

  if(!window.RW2Analytics) window.RW2Analytics = API;

  // auto-init on DOM ready
  function ready(fn){ if(document.readyState==="loading"){ try{document.addEventListener("DOMContentLoaded",fn,{once:true});}catch(_){fn();} } else { fn(); } }
  ready(function(){ API.init(); });
})();
