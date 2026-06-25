(function () {
  const NAV_SECTIONS = [
    {
      id: "economy",
      label: "Economy",
      href: "/tools/flips",
      paths: ["/tools/flips", "/tools/recipes", "/tools/coffer", "/tools/alch", "/tools/item", "/tools/flip-log"],
      tools: [
        { href: "/tools/flips", label: "Flip Finder", desc: "Top flips & search" },
        { href: "/tools/recipes", label: "Transforms", desc: "Decants & sets" },
        { href: "/tools/coffer", label: "Death's Coffer", desc: "105% sacrifice profit" },
        { href: "/tools/alch", label: "High Alch", desc: "Alch GP/hr scanner" },
        { href: "/tools/item", label: "Item lookup", desc: "Prices & charts" },
        { href: "/tools/flip-log", label: "Flip log", desc: "Track your profit" },
      ],
    },
    {
      id: "track",
      label: "Track",
      href: "/tools/dashboard",
      paths: ["/tools/dashboard", "/tools/boss", "/tools/herbs", "/tools/loot", "/tools/community", "/tools/alerts"],
      tools: [
        { href: "/tools/dashboard", label: "Dashboard", desc: "Pro P&L overview", pro: true },
        { href: "/tools/boss", label: "Boss GP/hr", desc: "Supply vs loot" },
        { href: "/tools/herbs", label: "Herb runs", desc: "Seed profit planner" },
        { href: "/tools/loot", label: "Loot import", desc: "Value CSV drops" },
        { href: "/tools/community", label: "Community", desc: "Top flipped items" },
        { href: "/tools/alerts", label: "Price alerts", desc: "Discord webhooks", pro: true },
      ],
    },
    {
      id: "plan",
      label: "Plan",
      href: "/tools/prep",
      paths: ["/tools/prep"],
      tools: [
        { href: "/tools/prep", label: "Boss prep", desc: "Gear & inventory lists" },
        { href: "/guides", label: "Guides", desc: "How-to articles" },
      ],
    },
  ];

  const PATH_LABELS = {};
  NAV_SECTIONS.forEach((sec) => {
    sec.tools.forEach((t) => {
      PATH_LABELS[t.href.replace(/\/$/, "")] = t.label;
    });
  });

  function currentPath() {
    return location.pathname.replace(/\/$/, "") || "/";
  }

  function injectHeadMeta() {
    if (!document.querySelector('link[rel="icon"]')) {
      const icon = document.createElement("link");
      icon.rel = "icon";
      icon.type = "image/svg+xml";
      icon.href = "/assets/images/favicon.svg";
      document.head.appendChild(icon);
    }
    if (!document.querySelector('link[rel="manifest"]')) {
      const m = document.createElement("link");
      m.rel = "manifest";
      m.href = "/manifest.webmanifest";
      document.head.appendChild(m);
    }
    if ("serviceWorker" in navigator && !window.__graardorSw) {
      window.__graardorSw = true;
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }

  function injectSkipLink() {
    if (document.querySelector(".skip-link")) return;
    const link = document.createElement("a");
    link.className = "skip-link";
    link.href = "#main-content";
    link.textContent = "Skip to content";
    document.body.prepend(link);
  }

  function ensureMainId() {
    const main =
      document.getElementById("main-content") ||
      document.querySelector("main") ||
      document.querySelector(".home-main") ||
      document.querySelector(".tool-page-main");
    if (main && !main.id) main.id = "main-content";
  }

  function setupMobileNav() {
    const header = document.querySelector(".site-header-inner");
    const nav = document.querySelector(".site-nav");
    if (!header || !nav || document.querySelector(".nav-toggle")) return;

    const mq = window.matchMedia("(max-width: 860px)");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-toggle";
    btn.setAttribute("aria-label", "Open menu");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "site-nav");
    btn.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
    header.insertBefore(btn, nav);

    if (!nav.id) nav.id = "site-nav";

    function setNavOpen(open) {
      document.body.classList.toggle("nav-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }

    btn.addEventListener("click", () => {
      setNavOpen(!document.body.classList.contains("nav-open"));
    });

    nav.addEventListener("click", (e) => {
      if (!mq.matches) return;
      const link = e.target.closest("a");
      if (!link) return;
      if (link.classList.contains("nav-dropdown-trigger")) return;
      setNavOpen(false);
      document.querySelectorAll(".nav-dropdown.open").forEach((d) => d.classList.remove("open"));
    });

    document.addEventListener("click", (e) => {
      if (!mq.matches || !document.body.classList.contains("nav-open")) return;
      if (e.target.closest(".site-header-inner")) return;
      setNavOpen(false);
    });

    mq.addEventListener("change", (ev) => {
      if (!ev.matches) {
        setNavOpen(false);
        document.querySelectorAll(".nav-dropdown.open").forEach((d) => d.classList.remove("open"));
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        setNavOpen(false);
        document.querySelectorAll(".nav-dropdown.open").forEach((d) => d.classList.remove("open"));
      }
    });
  }

  function injectHeaderSearch() {
    const inner = document.querySelector(".site-header-inner");
    if (!inner || document.querySelector(".header-search")) return;

    const form = document.createElement("form");
    form.className = "header-search";
    form.setAttribute("role", "search");
    form.innerHTML = `<label class="visually-hidden" for="headerItemSearch">Search items</label>
      <input id="headerItemSearch" type="search" placeholder="Search items…" autocomplete="off" />
      <button type="submit" aria-label="Search">⌕</button>`;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = form.querySelector("input").value.trim();
      if (q) location.href = `/tools/item?q=${encodeURIComponent(q)}`;
    });

    const nav = document.querySelector(".site-nav");
    inner.insertBefore(form, nav);
  }

  function injectNavDropdowns() {
    const nav = document.querySelector(".site-nav");
    if (!nav || nav.dataset.enhanced) return;
    nav.dataset.enhanced = "1";

    NAV_SECTIONS.forEach((sec) => {
      const oldLink = nav.querySelector(`a[href="${sec.href}"]`);
      if (!oldLink) return;

      const wrap = document.createElement("div");
      wrap.className = "nav-dropdown";
      wrap.innerHTML = `
        <a class="nav-dropdown-trigger" href="${sec.href}" data-section="${sec.id}">${sec.label}<span class="nav-chevron" aria-hidden="true">▾</span></a>
        <div class="nav-dropdown-panel" role="menu">
          ${sec.tools
            .map(
              (t) => `<a class="nav-dropdown-item" href="${t.href}" role="menuitem">
              <span class="nav-dropdown-item-label">${t.label}${t.pro ? '<span class="nav-badge">Pro</span>' : ""}</span>
              <span class="nav-dropdown-item-desc">${t.desc}</span>
            </a>`
            )
            .join("")}
          <a class="nav-dropdown-footer" href="/tools#${sec.id}">All ${sec.label.toLowerCase()} tools</a>
        </div>`;

      oldLink.replaceWith(wrap);

      const trigger = wrap.querySelector(".nav-dropdown-trigger");
      trigger.addEventListener("click", (e) => {
        if (window.matchMedia("(max-width: 860px)").matches) {
          e.preventDefault();
          wrap.classList.toggle("open");
        }
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".nav-dropdown")) {
        document.querySelectorAll(".nav-dropdown.open").forEach((d) => d.classList.remove("open"));
      }
    });
  }

  function toolSectionForPath(path) {
    return NAV_SECTIONS.find((s) => s.paths.some((p) => path === p || path.startsWith(p + "/")));
  }

  function injectHeaderSubnav() {
    const path = currentPath();
    const section = toolSectionForPath(path);
    if (!section || document.querySelector(".header-tool-subnav")) return;

    const header = document.querySelector(".site-header");
    if (!header) return;

    const nav = document.createElement("nav");
    nav.className = "tool-subnav header-tool-subnav";
    nav.setAttribute("aria-label", `${section.label} tools`);
    nav.innerHTML = section.tools
      .map((t) => {
        const active = path === t.href || (t.href === "/tools/item" && path.startsWith("/tools/item"));
        const badge = t.pro ? '<span class="nav-badge">Pro</span>' : "";
        return `<a href="${t.href}" class="${active ? "active" : ""}">${t.label}${badge}</a>`;
      })
      .join("");
    header.appendChild(nav);
    document.body.classList.add("has-header-subnav");
  }

  function injectBreadcrumbs() {
    const path = currentPath();
    if (path === "/" || document.querySelector(".breadcrumbs")) return;
    if (toolSectionForPath(path)) return;

    const crumbs = [{ href: "/", label: "Home" }];
    if (path.startsWith("/tools")) {
      crumbs.push({ href: "/tools", label: "Tools" });
      const section = toolSectionForPath(path);
      if (section) crumbs.push({ href: section.href, label: section.label });
      const label = PATH_LABELS[path] || document.querySelector(".page-hero h1")?.textContent?.trim();
      if (label && path !== section?.href) crumbs.push({ href: path, label, current: true });
    } else if (path.startsWith("/guides")) {
      crumbs.push({ href: "/guides", label: "Guides", current: path === "/guides" });
      if (path !== "/guides") {
        crumbs.push({ href: path, label: document.title.split("—")[0].trim(), current: true });
      }
    } else if (path === "/upgrade") {
      crumbs.push({ href: "/upgrade", label: "Graardor Pro", current: true });
    } else if (path === "/changelog") {
      crumbs.push({ href: "/changelog", label: "Changelog", current: true });
    }

    const bar = document.createElement("nav");
    bar.className = "breadcrumbs";
    bar.setAttribute("aria-label", "Breadcrumb");
    bar.innerHTML = crumbs
      .map((c, i) => {
        if (c.current || i === crumbs.length - 1) {
          return `<span aria-current="page">${c.label}</span>`;
        }
        return `<a href="${c.href}">${c.label}</a><span class="bc-sep">/</span>`;
      })
      .join("");

    const hero = document.querySelector(".page-hero");
    if (hero) hero.prepend(bar);
  }

  function ensureHeaderActions() {
    const inner = document.querySelector(".site-header-inner");
    const nav = document.querySelector(".site-nav");
    if (!inner) return null;

    let actions = inner.querySelector(".header-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "header-actions";
      inner.appendChild(actions);
    }

    const authSlot = document.getElementById("authSlot");
    const kofi = nav?.querySelector(".kofi-nav-cta") || inner.querySelector(".kofi-nav-cta");
    if (authSlot && authSlot.parentElement !== actions) actions.appendChild(authSlot);
    if (kofi && kofi.parentElement !== actions) actions.appendChild(kofi);

    document.querySelectorAll(".theme-toggle").forEach((btn, i) => {
      if (i === 0) {
        if (btn.parentElement !== actions) actions.insertBefore(btn, authSlot || kofi || null);
      } else {
        btn.remove();
      }
    });

    return actions;
  }

  function injectThemeToggle() {
    const actions = ensureHeaderActions();
    if (!actions || actions.querySelector(".theme-toggle")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";
    btn.setAttribute("aria-label", "Toggle light/dark theme");

    function applyLabel() {
      const light = document.documentElement.getAttribute("data-theme") === "light";
      btn.innerHTML = light
        ? '<span class="theme-toggle-icon" aria-hidden="true">☀</span><span class="theme-toggle-text">Light</span>'
        : '<span class="theme-toggle-icon" aria-hidden="true">☾</span><span class="theme-toggle-text">Dark</span>';
      btn.title = light ? "Switch to dark mode" : "Switch to light mode";
    }

    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("graardor-theme", next);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", next === "light" ? "#f8f4eb" : "#1e1e1e");
      applyLabel();
    });

    applyLabel();
    const authSlot = document.getElementById("authSlot");
    if (authSlot && authSlot.parentElement === actions) actions.insertBefore(btn, authSlot);
    else actions.appendChild(btn);
  }

  function injectProLink() {
    const actions = ensureHeaderActions();
    if (!actions || actions.querySelector('a[href="/upgrade"]')) return;
    const link = document.createElement("a");
    link.href = "/upgrade";
    link.textContent = "Pro";
    const themeToggle = actions.querySelector(".theme-toggle");
    if (themeToggle) actions.insertBefore(link, themeToggle);
    else {
      const authSlot = document.getElementById("authSlot");
      if (authSlot && authSlot.parentElement === actions) actions.insertBefore(link, authSlot);
      else actions.prepend(link);
    }
  }

  function injectKofiStrip() {
    if (document.querySelector(".kofi-strip")) return;
    const footer = document.querySelector(".site-footer");
    if (!footer) return;
    const strip = document.createElement("section");
    strip.className = "kofi-strip";
    strip.innerHTML = `<div class="kofi-strip-inner"><div class="kofi-strip-text">Tips on Ko-fi help keep Graardor running.</div><a class="kofi-strip-btn" href="https://ko-fi.com/greatblue" target="_blank" rel="noopener">Ko-fi</a></div>`;
    footer.parentNode.insertBefore(strip, footer);
  }

  function markActiveNav() {
    const path = currentPath();
    document.querySelectorAll(".site-nav > a[href]").forEach((link) => {
      const href = link.getAttribute("href").replace(/\/$/, "") || "/";
      link.classList.toggle("active", href === path);
    });
    NAV_SECTIONS.forEach((sec) => {
      const trigger = document.querySelector(`.nav-dropdown-trigger[href="${sec.href}"]`);
      if (trigger && sec.paths.some((p) => path.startsWith(p))) trigger.classList.add("active");
    });
  }

  function isToolChromeEl(el) {
    if (!el || el.nodeType !== 1) return false;
    const cls = el.classList;
    if (
      cls.contains("page-hero") ||
      cls.contains("tool-subnav") ||
      cls.contains("economy-subnav") ||
      cls.contains("disclaimer") ||
      cls.contains("disclaimer-collapsible") ||
      cls.contains("status-bar") ||
      cls.contains("tool-summary-strip") ||
      cls.contains("tool-tip-bar") ||
      cls.contains("tool-tip-collapsible")
    ) {
      return true;
    }
    return Boolean(el.id && el.id.endsWith("Summary"));
  }

  function convertDisclaimerToDetails(node) {
    if (!node || node.dataset.compacted || node.tagName === "DETAILS") return;
    node.dataset.compacted = "1";
    const details = document.createElement("details");
    details.className = "disclaimer disclaimer-collapsible";
    const summary = document.createElement("summary");
    summary.innerHTML =
      "<strong>Disclaimer</strong> — estimates only; verify in-game · Not affiliated with Jagex";
    const body = document.createElement("div");
    body.className = "disclaimer-body";
    body.innerHTML = node.innerHTML.replace(/^<strong>Disclaimer:<\/strong>\s*/i, "");
    details.appendChild(summary);
    details.appendChild(body);
    node.replaceWith(details);
  }

  function compactToolTip(tip) {
    if (!tip || tip.dataset.compacted) return;
    tip.dataset.compacted = "1";
    const key = "graardor-tip-" + currentPath();
    if (localStorage.getItem(key) === "1") {
      tip.remove();
      return;
    }
    if (tip.tagName === "DETAILS") {
      tip.classList.add("tool-tip-collapsible");
      if (!tip.querySelector(".tool-tip-dismiss")) {
        const body = tip.querySelector(".tool-tip-body") || tip;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tool-tip-dismiss";
        btn.textContent = "Don\u2019t show again";
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          localStorage.setItem(key, "1");
          tip.remove();
        });
        body.appendChild(document.createTextNode(" "));
        body.appendChild(btn);
      }
      return;
    }
    const details = document.createElement("details");
    details.className = "tool-tip-bar tool-tip-collapsible";
    const summary = document.createElement("summary");
    summary.textContent = "Tips for this page";
    const body = document.createElement("div");
    body.className = "tool-tip-body";
    body.innerHTML =
      tip.innerHTML +
      ' <button type="button" class="tool-tip-dismiss">Don\u2019t show again</button>';
    details.appendChild(summary);
    details.appendChild(body);
    tip.replaceWith(details);
    details.querySelector(".tool-tip-dismiss")?.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.setItem(key, "1");
      details.remove();
    });
  }

  function mergeHeroAndStatus(chrome) {
    const hero = chrome.querySelector(".page-hero");
    const status = chrome.querySelector(".status-bar");
    const hideHero = document.body.classList.contains("has-header-subnav");

    if (hero && hideHero) {
      hero.remove();
    } else if (hero) {
      hero.classList.add("page-hero--compact");
      hero.querySelector("p")?.classList.add("page-hero-sub");
    }

    if (!status) return;

    if (hero && chrome.contains(hero)) {
      const head = document.createElement("div");
      head.className = "tool-page-head";
      hero.parentNode.insertBefore(head, hero);
      head.appendChild(hero);
      head.appendChild(status);
    } else {
      status.classList.add("status-bar--solo");
    }
  }

  function compactToolChrome() {
    const path = currentPath();
    if (!path.startsWith("/tools")) return;

    document.querySelectorAll("p.disclaimer, .disclaimer:not(.disclaimer-collapsible)").forEach(convertDisclaimerToDetails);
    document.querySelectorAll(".tool-tip-bar").forEach(compactToolTip);

    const chromeEls = [...document.body.children].filter(isToolChromeEl);
    if (!chromeEls.length) return;

    const chrome = document.createElement("div");
    chrome.className = "tool-page-chrome";
    chromeEls[0].parentNode.insertBefore(chrome, chromeEls[0]);
    chromeEls.forEach((el) => chrome.appendChild(el));

    mergeHeroAndStatus(chrome);
    document.body.classList.add("tool-page-compact");
  }

  function unwrapLegacyLayout() {
    const layout = document.querySelector(".tool-layout");
    if (!layout) return;
    const body = layout.querySelector(".tool-body");
    if (body) {
      while (body.firstChild) layout.parentNode.insertBefore(body.firstChild, layout);
    }
    layout.remove();
  }

  function init() {
    if (window.__graardorChromeInit) return;
    window.__graardorChromeInit = true;

    injectHeadMeta();
    injectSkipLink();
    unwrapLegacyLayout();
    ensureMainId();
    setupMobileNav();
    injectHeaderSearch();
    injectNavDropdowns();
    ensureHeaderActions();
    injectHeaderSubnav();
    injectBreadcrumbs();
    compactToolChrome();
    injectProLink();
    injectThemeToggle();
    injectKofiStrip();
    markActiveNav();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.renderSummaryStrip = function renderSummaryStrip(containerId, cards) {
    const node = document.getElementById(containerId);
    if (!node) return;
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
    if (!cards || !cards.length) {
      node.innerHTML = "";
      node.hidden = true;
      return;
    }
    node.hidden = false;
    node.innerHTML = `<div class="tool-summary-inner">${cards
      .map((c) => {
        const val = c.link
          ? `<a href="${esc(c.link)}" class="tool-summary-value ${c.className || ""}">${esc(c.value)}</a>`
          : `<span class="tool-summary-value ${c.className || ""}">${esc(c.value)}</span>`;
        const hint = c.hint ? `<span class="tool-summary-hint">${esc(c.hint)}</span>` : "";
        return `<div class="tool-summary-card"><span class="tool-summary-label">${esc(c.label)}</span>${val}${hint}</div>`;
      })
      .join("")}</div>`;
  };
})();
