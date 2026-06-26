(function (G) {
  const ui = G.ui;
  const params = new URLSearchParams(location.search);
  let itemId = Number(params.get("id"));
  const queryParam = (params.get("q") || "").trim();
  let searchTimer;
  let itemsMeta = null;
  let recipesCatalog = null;

  function findItemById(id) {
    return G.cachedApiData?.mapping?.find((m) => m.id === id) || null;
  }

  async function loadItemsMeta() {
    if (itemsMeta) return itemsMeta;
    try {
      const res = await fetch("/data/items-meta.json");
      if (!res.ok) return null;
      itemsMeta = await res.json();
      return itemsMeta;
    } catch {
      return null;
    }
  }

  async function loadRecipesCatalog() {
    if (recipesCatalog !== null) return recipesCatalog;
    try {
      const res = await fetch("/data/recipes.json");
      if (!res.ok) return null;
      recipesCatalog = await res.json();
      return recipesCatalog;
    } catch {
      recipesCatalog = null;
      return null;
    }
  }

  function findTransformLinks(catalog, id) {
    if (!catalog) return [];
    const hits = [];
    const seen = new Set();

    function scan(list, type) {
      if (!list?.length) return;
      for (const recipe of list) {
        const inputs = recipe.inputs || [];
        const outputs = recipe.outputs || [];
        const inRecipe = inputs.some((x) => x.id === id) || outputs.some((x) => x.id === id);
        if (!inRecipe) continue;
        const key = `${type}:${recipe.name || recipe.set?.name || ""}:${recipe.variant || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const label = [recipe.name || recipe.set?.name, recipe.variant].filter(Boolean).join(" — ");
        hits.push({ label, href: `/tools/recipes?xfQ=${encodeURIComponent(label.split(" — ")[0])}` });
        if (hits.length >= 5) return;
      }
    }

    scan(catalog.skilling, "skill");
    scan(catalog.decants, "decant");
    scan(catalog.sets, "set");
    scan(catalog.uncharges, "uncharge");
    return hits;
  }

  function renderEquipmentCard(meta) {
    if (!meta?.slot) return "";

    const atk = meta.attack || {};
    const def = meta.defence || {};
    const extras = [];
    if (meta.strength) extras.push(["Melee str", meta.strength]);
    if (meta.rangedStrength) extras.push(["Ranged str", meta.rangedStrength]);
    if (meta.magicDamage) extras.push(["Magic dmg", meta.magicDamage]);
    if (meta.prayer) extras.push(["Prayer", meta.prayer]);

    return ui.sectionCard({
      title: "Equipment stats",
      className: "item-equipment-card",
      bodyHtml: ui.bonusTable({ offence: atk, defence: def, extras, slot: meta.slot, mode: "equipment" }),
    });
  }

  function renderEconomyCard(mapping, stats, price) {
    const profitCls = stats.profitAfterTax != null && stats.profitAfterTax >= 0 ? "positive" : "negative";
    return ui.sectionCard({
      title: "Grand Exchange",
      className: "item-economy-card",
      bodyHtml: ui.statGrid(
        [
          {
            label: "Buy (instant)",
            valueHtml: `<span class="price-buy price-copyable" data-copy-price="${Math.round(stats.buy || 0)}">${G.formatPrice(stats.buy)}</span>`,
          },
          {
            label: "Sell (instant)",
            valueHtml: `<span class="price-sell price-copyable" data-copy-price="${Math.round(stats.sell || 0)}">${G.formatPrice(stats.sell)}</span>`,
          },
          {
            label: "Margin",
            valueHtml: stats.marginGp == null ? "—" : G.formatGp(stats.marginGp),
            valueClassName: profitCls,
          },
          {
            label: "After tax",
            valueHtml: stats.profitAfterTax == null ? "—" : G.formatGp(stats.profitAfterTax),
            valueClassName: profitCls,
          },
          { label: "GE limit", value: mapping.limit ? mapping.limit.toLocaleString() : "—" },
          { label: "High alch", value: mapping.highalch ? G.formatPrice(mapping.highalch) : "—" },
          { label: "5m volume", value: G.formatGp(price?.volume5m ?? 0) },
          { label: "Daily volume", value: G.formatGp(price?.dailyVolume ?? 0) },
        ],
        "item-economy-grid"
      ),
    });
  }

  function renderQuickLinks(transformLinks) {
    const links = [`<a href="/tools/flips">Find flips</a>`, `<a href="/tools/alch">High alch</a>`];
    transformLinks.forEach((t) => {
      links.push(`<a href="${t.href}">${G.escapeHtml(t.label)}</a>`);
    });
    return `<nav class="item-quick-links" aria-label="Related tools">${links.join("")}</nav>`;
  }

  function searchItems(q) {
    if (!G.cachedApiData || !q) return [];
    const lower = q.toLowerCase();
    return G.cachedApiData.mapping
      .filter((m) => m.name.toLowerCase().includes(lower))
      .slice(0, 20);
  }

  function renderLookup(query) {
    const box = G.el("itemLookupResults");
    if (!box) return;
    const results = searchItems(query);
    if (!query.trim()) {
      box.innerHTML = "";
      return;
    }
    if (!results.length) {
      box.innerHTML = ui.emptyState("No items found.", { loading: true });
      return;
    }
    box.innerHTML = results
      .map(
        (m) => `<a href="${G.itemPageUrl(m.id)}"${G.itemTitleAttr(m.name)}>
          <img src="${G.iconUrl(m.icon)}" alt="" width="28" height="28" loading="lazy" />
          <span${G.itemTitleAttr(m.name)}>${G.escapeHtml(m.name)}</span>
        </a>`
      )
      .join("");
  }

  function marginStats(item, latest) {
    const buy = latest.low;
    const sell = latest.high;
    if (buy == null || sell == null || buy <= 0) {
      return { marginGp: null, marginPct: null, profitAfterTax: null, tax: 0 };
    }
    const tax = G.calcGeTax(sell, item.id);
    const profitAfterTax = sell - buy - tax;
    const marginGp = sell - buy;
    const marginPct = buy > 0 ? (marginGp / buy) * 100 : null;
    return { marginGp, marginPct, profitAfterTax, tax, buy, sell };
  }

  function renderDetail(isPro, equipmentMeta, transformLinks) {
    const root = G.el("itemDetailRoot");
    if (!root) return;

    const mapping = findItemById(itemId);
    const latest = G.cachedApiData?.latest?.[itemId];
    if (!mapping || !latest) {
      root.innerHTML = ui.emptyState("Item not found. Try searching above.", { loading: true });
      document.title = "Item lookup — Graardor";
      return;
    }

    const stats = marginStats(mapping, latest);
    const price = G.getItemPrice(itemId);
    const badge = mapping.members
      ? '<span class="badge badge-members">P2P</span>'
      : '<span class="badge badge-f2p">F2P</span>';
    const showEquipment = equipmentMeta?.slot;
    const proBlock = isPro
      ? `<div class="item-chart-block item-chart-pro">
          <h3>Extended trend <span class="chart-badge">Pro · ~7 days</span></h3>
          <canvas id="priceSparklinePro" class="price-sparkline price-sparkline-lg" aria-label="Extended price chart"></canvas>
        </div>`
      : `<p class="results-meta chart-pro-upsell"><a href="/upgrade">Graardor Pro</a> unlocks extended 7-day price charts.</p>`;

    document.title = `${mapping.name} — Graardor`;
    G.el("itemPageTitle").textContent = mapping.name;

    root.innerHTML = `
      <article class="item-detail">
        ${ui.lookupHero({
          layout: "item",
          iconUrl: G.iconUrl(mapping.icon),
          title: mapping.name,
          badges: [badge],
          wikiUrl: G.wikiPageUrl(mapping.name),
        })}

        <div class="item-detail-grid${showEquipment ? "" : " item-detail-grid-single"}">
          ${renderEconomyCard(mapping, stats, price)}
          ${showEquipment ? renderEquipmentCard(equipmentMeta) : ""}
        </div>

        ${ui.sectionCard({
          title: "Price trend",
          className: "item-chart-section",
          bodyHtml: `<p class="results-meta chart-subtitle">Last ~6 hours · 5-minute buckets · shaded area = buy/sell spread</p>
          <div class="item-chart-block">
            <canvas id="priceSparkline" class="price-sparkline price-sparkline-lg" aria-label="Price chart"></canvas>
            <div class="sparkline-legend">
              <span class="sell"><span class="legend-swatch"></span> Sell (high)</span>
              <span class="buy"><span class="legend-swatch"></span> Buy (low)</span>
            </div>
          </div>
          ${proBlock}`,
        })}

        ${renderQuickLinks(transformLinks)}
      </article>`;

    loadSparkline(isPro);
  }

  async function loadSparkline(isPro) {
    try {
      const series = await G.fetchTimeseries(itemId, "5m");
      G.drawPriceSparkline(G.el("priceSparkline"), series, { maxPoints: 72 });
      if (isPro && G.el("priceSparklinePro")) {
        const longSeries = await G.fetchTimeseries(itemId, "1h");
        G.drawPriceSparkline(G.el("priceSparklinePro"), longSeries, { maxPoints: 168 });
      }
    } catch {
      /* chart optional */
    }
  }

  async function init() {
    G.bindPriceCopy();

    G.el("itemSearch")?.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderLookup(e.target.value), 150);
    });

    if (queryParam && G.el("itemSearch")) {
      G.el("itemSearch").value = queryParam;
    }

    G.updateStatus("itemStatus", "Loading prices…", "");
    try {
      await G.loadPrices();
      G.updateStatus(
        "itemStatus",
        `${G.cachedApiData.mapping.length.toLocaleString()} items loaded`,
        "ok"
      );

      if (!itemId || !findItemById(itemId)) {
        if (params.get("id")) {
          G.el("itemDetailRoot").innerHTML = ui.emptyState("Unknown item ID. Search below.", { loading: true });
        }
        if (queryParam) renderLookup(queryParam);
        return;
      }

      let isPro = false;
      try {
        const me = await fetch("/api/me", { credentials: "same-origin" }).then((r) => r.json());
        isPro = Boolean(me.pro);
      } catch { /* ignore */ }
      const [metaBundle, catalog] = await Promise.all([loadItemsMeta(), loadRecipesCatalog()]);
      const equipmentMeta = metaBundle?.items?.[String(itemId)] || null;
      const transformLinks = findTransformLinks(catalog, itemId);
      renderDetail(isPro, equipmentMeta, transformLinks);
    } catch (err) {
      G.updateStatus("itemStatus", `Failed: ${err.message}`, "error");
      G.el("itemDetailRoot").innerHTML = ui.emptyState(G.escapeHtml(err.message), { loading: true });
    }
  }

  init();
})(window.Graardor);
