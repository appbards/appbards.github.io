// Google Analytics 4 with basic Consent Mode, shared by every page of the site.
//
// Loaded once per document from index.html (the SPA shell that every
// prerendered page is built from) and from the static privacy policy page.
// Nothing is requested from Google until the visitor accepts analytics, and
// only on the production hostnames. Page views, history navigation and
// outbound clicks come from GA4 Enhanced Measurement, so no events are sent
// manually here.
//
// Any element with a data-analytics-preferences attribute reopens the banner.
(function () {
  "use strict";

  if (window.__appbardsAnalytics) return;
  window.__appbardsAnalytics = true;

  var MEASUREMENT_ID = "G-0TRB7R1QNF";
  var PRODUCTION_HOSTS = ["appbards.com", "www.appbards.com"];
  var STORAGE_KEY = "appbards-analytics-consent";
  var POLICY_URL = "/privacy-policy/#website-analytics";
  var GRANTED = "granted";
  var DENIED = "denied";

  var isProduction = PRODUCTION_HOSTS.indexOf(location.hostname) !== -1;
  var tagLoaded = false;
  var collecting = false;
  var memoryChoice = null;
  var banner = null;
  var returnFocusTo = null;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }

  // Everything starts denied; advertising consent is never granted.
  gtag("consent", "default", {
    ad_storage: DENIED,
    ad_user_data: DENIED,
    ad_personalization: DENIED,
    analytics_storage: DENIED,
  });

  function readChoice() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return value === GRANTED || value === DENIED ? value : memoryChoice;
    } catch (e) {
      return memoryChoice;
    }
  }

  function saveChoice(value) {
    memoryChoice = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      // Storage is unavailable: the choice lasts for this page only.
    }
  }

  // gtag.js batches events and can still flush ones queued before consent was
  // withdrawn, so hits to Google Analytics are dropped while collection is off.
  function guardTransport() {
    var isBlockedHit = function (target) {
      var url = String((target && target.url) || target);
      return !collecting && /^https:\/\/[^/]*(google-analytics\.com|analytics\.google\.com)\//.test(url);
    };
    var sendBeacon = navigator.sendBeacon;
    if (sendBeacon) {
      navigator.sendBeacon = function (url) {
        return isBlockedHit(url) ? true : sendBeacon.apply(navigator, arguments);
      };
    }
    var fetch = window.fetch;
    if (fetch) {
      window.fetch = function (input) {
        return isBlockedHit(input)
          ? Promise.resolve(new Response(null, { status: 204 }))
          : fetch.apply(window, arguments);
      };
    }
  }

  function startAnalytics() {
    collecting = true;
    window["ga-disable-" + MEASUREMENT_ID] = false;
    gtag("consent", "update", { analytics_storage: GRANTED });
    if (tagLoaded || !isProduction) return;
    tagLoaded = true;
    guardTransport();
    gtag("js", new Date());
    gtag("config", MEASUREMENT_ID);
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID;
    document.head.appendChild(script);
  }

  function clearAnalyticsCookies() {
    var names = document.cookie
      .split(";")
      .map(function (pair) {
        return pair.split("=")[0].trim();
      })
      .filter(function (name) {
        return name === "_ga" || name.indexOf("_ga_") === 0;
      });
    var domains = [""];
    var parts = location.hostname.split(".");
    for (var i = 0; i < parts.length - 1; i++) {
      domains.push(parts.slice(i).join("."), "." + parts.slice(i).join("."));
    }
    names.forEach(function (name) {
      domains.forEach(function (domain) {
        document.cookie =
          name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + (domain ? "; domain=" + domain : "");
      });
    });
  }

  function stopAnalytics() {
    collecting = false;
    window["ga-disable-" + MEASUREMENT_ID] = true;
    gtag("consent", "update", { analytics_storage: DENIED });
    clearAnalyticsCookies();
  }

  function choose(value) {
    saveChoice(value);
    if (value === GRANTED) startAnalytics();
    else stopAnalytics();
    closeBanner();
  }

  var CSS =
    ".ab-consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:720px;margin:0 auto;" +
    "padding:20px;box-sizing:border-box;font:inherit;font-size:14px;line-height:1.5;" +
    "color:hsl(var(--foreground,230 25% 18%));background:hsl(var(--card,0 0% 100%));" +
    "border:1px solid hsl(var(--border,230 20% 90%));border-radius:16px;" +
    "box-shadow:0 16px 48px -12px hsl(240 40% 30% / .35)}" +
    ".ab-consent:focus{outline:none}" +
    ".ab-consent h2{margin:0 0 4px;font-size:16px;font-weight:600;color:inherit}" +
    ".ab-consent p{margin:0}" +
    ".ab-consent a{color:hsl(var(--primary,240 60% 62%));text-decoration:underline}" +
    ".ab-consent-status{margin-top:4px!important;font-weight:600}" +
    ".ab-consent-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}" +
    ".ab-consent button{flex:1 1 160px;min-height:44px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer;" +
    "color:hsl(var(--foreground,230 25% 18%));background:hsl(var(--card,0 0% 100%));" +
    "border:2px solid hsl(var(--primary,240 60% 62%));border-radius:12px}" +
    ".ab-consent button:hover{background:hsl(var(--muted,230 30% 95%))}" +
    ".ab-consent button:focus-visible,.ab-consent a:focus-visible{outline:3px solid hsl(var(--primary,240 60% 62%));outline-offset:2px}";

  function el(tag, text, attrs) {
    var node = document.createElement(tag);
    if (text) node.textContent = text;
    for (var key in attrs || {}) node.setAttribute(key, attrs[key]);
    return node;
  }

  function closeBanner() {
    if (!banner) return;
    banner.remove();
    banner = null;
    if (returnFocusTo && document.contains(returnFocusTo)) returnFocusTo.focus();
    returnFocusTo = null;
  }

  // opener is set when the visitor reopens the banner from a preferences control.
  function openBanner(opener) {
    closeBanner();
    returnFocusTo = opener || null;

    if (!document.getElementById("ab-consent-style")) {
      var style = el("style", CSS, { id: "ab-consent-style" });
      document.head.appendChild(style);
    }

    banner = el("section", "", {
      class: "ab-consent",
      role: "region",
      "aria-labelledby": "ab-consent-title",
      tabindex: "-1",
    });
    banner.appendChild(el("h2", "Analytics cookies", { id: "ab-consent-title" }));

    var text = el("p", "We would like to use Google Analytics cookies to measure visits to this website. Nothing is collected unless you accept. ");
    text.appendChild(el("a", "Privacy policy", { href: POLICY_URL }));
    banner.appendChild(text);

    var current = readChoice();
    if (current) {
      banner.appendChild(
        el("p", current === GRANTED ? "Analytics is currently on." : "Analytics is currently off.", {
          class: "ab-consent-status",
        }),
      );
    }

    var actions = el("div", "", { class: "ab-consent-actions" });
    var accept = el("button", "Accept analytics", { type: "button" });
    var reject = el("button", "Reject", { type: "button" });
    accept.addEventListener("click", function () {
      choose(GRANTED);
    });
    reject.addEventListener("click", function () {
      choose(DENIED);
    });
    actions.appendChild(accept);
    actions.appendChild(reject);
    banner.appendChild(actions);

    banner.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && readChoice()) closeBanner();
    });

    document.body.appendChild(banner);
    if (opener) banner.focus();
  }

  document.addEventListener("click", function (event) {
    var control = event.target.closest && event.target.closest("[data-analytics-preferences]");
    if (!control) return;
    event.preventDefault();
    openBanner(control);
  });

  function init() {
    var choice = readChoice();
    if (choice === GRANTED) startAnalytics();
    else if (!choice) openBanner();
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
