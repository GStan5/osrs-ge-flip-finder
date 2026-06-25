(function (G) {
  const params = new URLSearchParams(location.search);
  let itemId = Number(params.get("id"));
  const queryParam = (params.get("q") || "").trim();
  let searchTimer;

  function findItemById(id) {
    return G.cachedApiData?.mapping?.find((m) => m.id === id) || null;
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
      box.innerHTML = '<p class="loading">No items found.</p>';
      return;
    }
    box.innerHTML = results
      .map(
        (m) => `<a href="${G.itemPageUrl(m.id)}">
          <img src="${G.iconUrl(m.icon)}" alt="" width="28" height="28" loading="lazy" />
          <span>${G.escapeHtml(m.name)}</span>
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

  function renderDetail(isPro) {
    const root = G.el("itemDetailRoot");
    if (!root) return;

    const mapping = findItemById(itemId);
    const latest = G.cachedApiData?.latest?.[itemId];
    if (!mapping || !latest) {
      root.innerHTML = '<p class="loading">Item not found. Try searching above.</p>';
      document.title = "Item lookup — Graardor";
      return;
    }

    const stats = marginStats(mapping, latest);
    const price = G.getItemPrice(itemId);
    const badge = mapping.members
      ? '<span class="badge badge-members">P2P</span>'
      : '<span class="badge badge-f2p">F2P</span>';
    const profitCls = stats.profitAfterTax != null && stats.profitAfterTax >= 0 ? "positive" : "negative";
    const proBlock = isPro
      ? `<div class="sparkline-wrap">
          <h2>Extended trend (Pro — ~7 days, 1h buckets)</h2>
          <canvas id="priceSparklinePro" class="price-sparkline" style="height:100px" aria-label="Extended price chart"></canvas>
        </div>`
      : `<p class="results-meta"><a href="/upgrade">Graardor Pro</a> unlocks extended 7-day price charts.</p>`;

    document.title = `${mapping.name} — Graardor`;
    G.el("itemPageTitle").textContent = mapping.name;

    root.innerHTML = `
      <div class="item-detail-card">
        <div class="item-detail-header">
          <img src="${G.iconUrl(mapping.icon)}" alt="" />
          <h1>${G.escapeHtml(mapping.name)} ${badge}</h1>
          <div class="item-detail-actions">
            <a href="${G.wikiPageUrl(mapping.name)}" target="_blank" rel="noopener">Wiki ↗</a>
            <a href="/tools/flips">Find flips</a>
            <a href="/tools/alch">High alch</a>
          </div>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><span class="label">Buy (instant)</span><span class="value price-buy price-copyable" data-copy-price="${Math.round(stats.buy || 0)}">${G.formatPrice(stats.buy)}</span></div>
          <div class="stat-card"><span class="label">Sell (instant)</span><span class="value price-sell price-copyable" data-copy-price="${Math.round(stats.sell || 0)}">${G.formatPrice(stats.sell)}</span></div>
          <div class="stat-card"><span class="label">Margin</span><span class="value ${profitCls}">${stats.marginGp == null ? "—" : G.formatGp(stats.marginGp)}</span></div>
          <div class="stat-card"><span class="label">After tax</span><span class="value ${profitCls}">${stats.profitAfterTax == null ? "—" : G.formatGp(stats.profitAfterTax)}</span></div>
          <div class="stat-card"><span class="label">GE limit</span><span class="value">${mapping.limit ? mapping.limit.toLocaleString() : "—"}</span></div>
          <div class="stat-card"><span class="label">High alch</span><span class="value">${mapping.highalch ? G.formatPrice(mapping.highalch) : "—"}</span></div>
          <div class="stat-card"><span class="label">5m volume</span><span class="value">${G.formatGp(price?.volume5m ?? 0)}</span></div>
          <div class="stat-card"><span class="label">Daily volume</span><span class="value">${G.formatGp(price?.dailyVolume ?? 0)}</span></div>
        </div>
        <div class="sparkline-wrap">
          <h2>Price trend (last ~6 hours, 5m buckets)</h2>
          <canvas id="priceSparkline" class="price-sparkline" aria-label="Price chart"></canvas>
          <div class="sparkline-legend">
            <span class="sell">● Sell (high)</span>
            <span class="buy">● Buy (low)</span>
          </div>
        </div>
        ${proBlock}
      </div>`;

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
          G.el("itemDetailRoot").innerHTML = '<p class="loading">Unknown item ID. Search below.</p>';
        }
        if (queryParam) renderLookup(queryParam);
        return;
      }

      let isPro = false;
      try {
        const me = await fetch("/api/me", { credentials: "same-origin" }).then((r) => r.json());
        isPro = Boolean(me.pro);
      } catch { /* ignore */ }
      renderDetail(isPro);
    } catch (err) {
      G.updateStatus("itemStatus", `Failed: ${err.message}`, "error");
      G.el("itemDetailRoot").innerHTML = `<p class="loading">${G.escapeHtml(err.message)}</p>`;
    }
  }

  init();
})(window.Graardor);
