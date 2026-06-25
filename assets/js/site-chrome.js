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

  function injectShellStyles() {
    if (document.querySelector('link[href*="graa-shell"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/css/graa-shell.css?v=2";
    document.head.appendChild(link);
  }

  function applyShellBodyClass() {
    document.body.classList.add("graardor-v2");
    if (currentPath() === "/") document.body.classList.add("hub-home");
  }

  function injectTopBar() {
    const header = document.querySelector(".site-header");
    if (!header || header.querySelector(".chrome-topbar")) return;

    const bar = document.createElement("div");
    bar.className = "chrome-topbar";
    bar.innerHTML = `<span class="chrome-live"><span class="chrome-live-dot" aria-hidden="true"></span> Live GE prices · OSRS Wiki API</span><span class="chrome-topbar-right">Fan-made · Not affiliated with Jagex</span>`;
    header.prepend(bar);
  }

  function injectSectionBar() {
    const header = document.querySelector(".site-header");
    if (!header || header.querySelector(".chrome-section-bar")) return;

    const path = currentPath();
    let section = "home";
    if (path === "/") section = "home";
    else {
      const sec = NAV_SECTIONS.find((s) => s.paths.some((p) => path === p || path.startsWith(p + "/")));
      if (sec) section = sec.id;
    }

    const bar = document.createElement("div");
    bar.className = `chrome-section-bar ${section}`;
    header.appendChild(bar);
  }

  function enhanceLogo() {
    const logo = document.querySelector(".site-logo");
    if (!logo || logo.querySelector(".site-logo-icon")) return;
    const icon = document.createElement("span");
    icon.className = "site-logo-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "G";
    logo.insertBefore(icon, logo.firstChild);
  }

  function enhancePageHero() {
    const hero = document.querySelector(".page-hero");
    if (!hero || hero.dataset.enhanced) return;
    hero.dataset.enhanced = "1";

    const path = currentPath();
    const sec = NAV_SECTIONS.find((s) => s.paths.some((p) => path === p || path.startsWith(p + "/")));
    const sectionClass = sec ? sec.id : "economy";

    const inner = document.createElement("div");
    inner.className = `tool-hero-inner ${sectionClass}`;
    while (hero.firstChild) inner.appendChild(hero.firstChild);
    hero.appendChild(inner);
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

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-toggle";
    btn.setAttribute("aria-label", "Open menu");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
    header.insertBefore(btn, nav);

    btn.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.body.classList.remove("nav-open");
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
      <input id="headerItemSearch" type="search" placeholder="Item name…" autocomplete="off" />
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

  function injectSubnav() {
    const path = currentPath();
    const section = NAV_SECTIONS.find((s) => s.paths.some((p) => path === p || path.startsWith(p + "/")));
    if (!section || document.querySelector(".tool-subnav")) return;

    const anchor = document.querySelector(".page-hero") || document.querySelector(".status-bar");
    if (!anchor) return;

    const nav = document.createElement("nav");
    nav.className = "tool-subnav";
    nav.setAttribute("aria-label", `${section.label} tools`);
    nav.innerHTML = section.tools
      .map((t) => {
        const active = path === t.href || (t.href === "/tools/item" && path.startsWith("/tools/item"));
        const badge = t.pro ? '<span class="nav-badge">Pro</span>' : "";
        return `<a href="${t.href}" class="${active ? "active" : ""}">${t.label}${badge}</a>`;
      })
      .join("");
    anchor.insertAdjacentElement("afterend", nav);
  }

  function injectBreadcrumbs() {
    const path = currentPath();
    if (path === "/" || document.querySelector(".breadcrumbs")) return;

    const crumbs = [{ href: "/", label: "Home" }];
    if (path.startsWith("/tools")) {
      crumbs.push({ href: "/tools", label: "Tools" });
      const section = NAV_SECTIONS.find((s) => s.paths.some((p) => path === p || path.startsWith(p + "/")));
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
    else document.querySelector(".home-main")?.prepend(bar);
  }

  function injectProLink() {
    const authSlot = document.getElementById("authSlot");
    const nav = document.querySelector(".site-nav");
    if (!nav || !authSlot || nav.querySelector('a[href="/upgrade"]')) return;
    const link = document.createElement("a");
    link.href = "/upgrade";
    link.textContent = "Pro";
    authSlot.insertAdjacentElement("beforebegin", link);
  }

  function injectKofiStrip() {
    if (document.querySelector(".kofi-strip")) return;
    const footer = document.querySelector(".site-footer");
    if (!footer) return;
    const strip = document.createElement("section");
    strip.className = "kofi-strip";
    strip.innerHTML = `<div class="kofi-strip-inner"><div class="kofi-strip-text">Hosting isn't free. Tips on Ko-fi help keep Graardor running.</div><a class="kofi-strip-btn" href="https://ko-fi.com/greatblue" target="_blank" rel="noopener">Ko-fi</a></div>`;
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

    const bar = document.querySelector(".chrome-section-bar");
    if (bar) {
      if (path === "/") bar.className = "chrome-section-bar home";
      else {
        const sec = NAV_SECTIONS.find((s) => s.paths.some((p) => path === p || path.startsWith(p + "/")));
        bar.className = `chrome-section-bar ${sec ? sec.id : "economy"}`;
      }
    }
  }

  function init() {
    injectShellStyles();
    applyShellBodyClass();
    injectHeadMeta();
    injectSkipLink();
    injectTopBar();
    enhanceLogo();
    ensureMainId();
    setupMobileNav();
    injectHeaderSearch();
    injectNavDropdowns();
    injectSectionBar();
    enhancePageHero();
    injectBreadcrumbs();
    injectSubnav();
    injectProLink();
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
