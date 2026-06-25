(function () {
  function injectKofiStrip() {
    if (document.querySelector(".kofi-strip")) return;
    const footer = document.querySelector(".site-footer");
    if (!footer) return;

    const strip = document.createElement("section");
    strip.className = "kofi-strip";
    strip.innerHTML = `
      <div class="kofi-strip-inner">
        <div class="kofi-strip-text">
          <strong>Graardor is free.</strong> If these tools save you GP or time, a Ko-fi tip helps pay for hosting and keeps development going.
        </div>
        <a class="kofi-strip-btn" href="https://ko-fi.com/greatblue" target="_blank" rel="noopener">Support on Ko-fi</a>
      </div>`;
    footer.parentNode.insertBefore(strip, footer);
  }

  function markActiveNav() {
    const path = location.pathname.replace(/\/$/, "") || "/";
    document.querySelectorAll(".site-nav a[href]").forEach((link) => {
      const href = link.getAttribute("href").replace(/\/$/, "") || "/";
      if (href.startsWith("http")) return;
      link.classList.toggle("active", href === path);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      injectKofiStrip();
      markActiveNav();
    });
  } else {
    injectKofiStrip();
    markActiveNav();
  }
})();
