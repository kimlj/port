/* Load form verification when a visitor approaches or focuses the form.
   Server-side verification remains mandatory; only SDK loading is deferred. */
(function initializeTurnstile() {
  "use strict";
  var widgets = Array.from(document.querySelectorAll(".cf-turnstile"));
  if (!widgets.length) return;
  var loading = false;
  function render() {
    window.turnstile.ready(function () {
      widgets.forEach(function (widget) {
        if (widget.dataset.rendered) return;
        window.turnstile.render(widget, {
          sitekey: widget.dataset.sitekey,
          theme: widget.dataset.theme || "auto",
          appearance: widget.dataset.appearance || "always"
        });
        widget.dataset.rendered = "true";
      });
    });
  }
  function load() {
    if (window.turnstile) { render(); return; }
    if (loading) return;
    loading = true;
    var script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.addEventListener("load", render, { once: true });
    script.addEventListener("error", function () {
      loading = false;
      script.remove(); // A later focus can retry a failed connection.
    }, { once: true });
    document.head.appendChild(script);
  }
  document.addEventListener("focusin", function (event) {
    var form = event.target.closest("form");
    if (form && form.querySelector(".cf-turnstile")) load();
  });
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; })) load();
    }, { rootMargin: "600px" });
    widgets.forEach(function (widget) { observer.observe(widget.closest("form") || widget); });
  } else load();
})();
