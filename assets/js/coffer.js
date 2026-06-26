(function (G) {
  const COFFER_MIN_VALUE = 10_000;
  const COFFER_RATE = 1.05;
  let rows = [];
  let sort = { key: "profit", dir: "desc" };

  function cofferCredit(guidePrice) {
    return Math.floor(guidePrice * COFFER_RATE);
  }

  function buildRows(mode) {
    if (!G.cachedApiData) return [];
    const { mapping, latest } = G.cachedApiData;

    return mapping
      .map((m) => {
        const guide = m.value ?? 0;
        if (guide < COFFER_MIN_VALUE) return null;
        const l = latest[m.id];
        if (!l || l.low == null || l.low <= 0) return null;

        const credit = cofferCredit(guide);
        const buyPrice = mode === "patient" ? l.high : l.low;
        if (buyPrice == null || buyPrice <= 0) return null;

        const profit = credit - buyPrice;
        const limit = m.limit ?? 0;
        const roi = buyPrice > 0 ? (profit / buyPrice) * 100 : null;

        return {
          id: m.id,
          name: m.name,
          icon: m.icon,
          members: m.members,
          limit,
          guide,
          credit,
          buyPrice,
          profit,
          roi,
          limitCost: buyPrice * limit,
          limitProfit: profit * limit,
        };
      })
      .filter(Boolean);
  }

  function passesFilters(row) {
    if (G.el("cofferProfitableOnly")?.checked && row.profit <= 0) return false;
    const minProfit = Number(G.el("cofferMinProfit")?.value);
    if (Number.isFinite(minProfit) && minProfit > 0 && row.profit < minProfit) return false;
    const members = G.el("cofferMembers")?.value || "all";
    if (members === "members" && !row.members) return false;
    if (members === "f2p" && row.members) return false;
    const q = (G.el("cofferSearch")?.value || "").trim().toLowerCase();
    if (q && !row.name.toLowerCase().includes(q)) return false;
    return true;
  }

  function sortRows(list) {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });
  }

  function cofferRowHtml(row) {
    const profitCls = row.profit >= 0 ? "positive" : "negative";
    return G.itemListRow(
      G.itemListNameCell(row) +
        G.itemListNumCell(G.formatPrice(row.buyPrice), "num price-copyable price-buy", "Buy price", {
          "data-copy-price": Math.round(row.buyPrice),
          title: "Click to copy",
        }) +
        G.itemListNumCell(G.formatPrice(row.guide), "num col-hide-xs", "GE guide") +
        G.itemListNumCell(G.formatPrice(row.credit), "num", "Coffer credit") +
        G.itemListNumCell(G.formatGp(row.profit), `num ${profitCls}`, "Profit") +
        G.itemListNumCell(row.roi != null ? row.roi.toFixed(1) + "%" : "—", `num col-hide-xs ${profitCls}`, "ROI") +
        G.itemListNumCell(row.limit ? row.limit.toLocaleString() : "—", "num col-hide-narrow", "Limit") +
        G.itemListNumCell(row.limit ? G.formatGp(row.limitProfit) : "—", `num col-hide-narrow ${profitCls}`, "Profit (limit)")
    );
  }

  function render() {
    const mode = G.el("cofferMode")?.value || "instant";
    rows = buildRows(mode);
    const filtered = sortRows(rows.filter(passesFilters));

    G.el("cofferMeta").textContent = filtered.length
      ? `${filtered.length.toLocaleString()} items · ${mode === "patient" ? "patient buy (sell price)" : "instant buy (buy price)"} · coffer credits 105% of GE guide price`
      : "No items match your filters.";

    if (!filtered.length) {
      G.renderItemList("cofferBody", { message: "No matches.", loading: true, listId: "cofferList", sortKey: sort.key, sortDir: sort.dir });
      if (typeof renderSummaryStrip === "function") renderSummaryStrip("cofferSummary", []);
      return;
    }

    const shown = filtered.slice(0, 500);
    G.renderItemList("cofferBody", {
      rowsHtml: shown.map(cofferRowHtml).join(""),
      listId: "cofferList",
      sortKey: sort.key,
      sortDir: sort.dir,
    });

    if (filtered.length > 500) {
      G.el("cofferMeta").textContent += ` (showing top 500)`;
    }

    if (typeof renderSummaryStrip === "function") {
      const best = filtered[0];
      renderSummaryStrip("cofferSummary", [
        {
          label: "Best profit",
          value: best ? G.formatGp(best.profit) : "—",
          className: best?.profit >= 0 ? "highlight-gp" : "",
          hint: best?.name,
          link: best ? G.itemPageUrl(best.id) : null,
        },
        {
          label: "Best limit profit",
          value: best?.limit ? G.formatGp(best.limitProfit) : "—",
          className: "highlight-gp",
        },
        { label: "Matches", value: filtered.length.toLocaleString() },
        { label: "Mode", value: mode === "patient" ? "Patient buy" : "Instant buy" },
      ]);
    }
  }

  function bindSort() {
    G.bindItemListSort("cofferList", (key) => {
      if (sort.key === key) sort.dir = sort.dir === "desc" ? "asc" : "desc";
      else {
        sort.key = key;
        sort.dir = "desc";
      }
      render();
    });
  }

  async function init() {
    G.bindPriceCopy();
    bindSort();
    ["cofferMode", "cofferMembers", "cofferProfitableOnly"].forEach((id) => {
      G.el(id)?.addEventListener("change", render);
    });
    ["cofferSearch", "cofferMinProfit"].forEach((id) => {
      G.el(id)?.addEventListener("input", () => {
        clearTimeout(init._timer);
        init._timer = setTimeout(render, 150);
      });
    });
    G.el("refreshCofferBtn")?.addEventListener("click", () => load(true));
    G.el("resetCofferBtn")?.addEventListener("click", () => {
      if (G.el("cofferSearch")) G.el("cofferSearch").value = "";
      if (G.el("cofferMinProfit")) G.el("cofferMinProfit").value = "";
      if (G.el("cofferMembers")) G.el("cofferMembers").value = "all";
      if (G.el("cofferProfitableOnly")) G.el("cofferProfitableOnly").checked = true;
      if (G.el("cofferMode")) G.el("cofferMode").value = "instant";
      render();
    });

    await load();
  }

  async function load(forceRefresh = false) {
    const hasCache = Boolean(G.cachedApiData);
    if (!hasCache || forceRefresh) {
      G.updateStatus("cofferStatus", forceRefresh ? "Refreshing price data…" : "Loading price data…", "");
      G.applyItemListSkeleton("cofferBody", 8, 10);
    }
    try {
      await G.loadPrices({ useCache: true, force: forceRefresh });
      G.updateStatus(
        "cofferStatus",
        `Loaded ${G.cachedApiData.mapping.length.toLocaleString()} items — refresh when you want new prices`,
        "ok"
      );
      render();
    } catch (err) {
      G.updateStatus("cofferStatus", `Failed: ${err.message}`, "error");
      G.renderItemList("cofferBody", { message: G.escapeHtml(err.message), loading: true });
    }
  }

  init();
})(window.Graardor);
