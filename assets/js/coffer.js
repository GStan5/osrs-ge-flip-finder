(function (G) {
  const COFFER_MIN_VALUE = 10_000;
  const COFFER_RATE = 1.05;
  let rows = [];
  let sort = { key: "profit", dir: "desc" };

  const COFFER_PRESETS = {
    bestProfit: { minProfit: 1000, sortKey: "profit" },
    underBudget: { maxBudget: 5_000_000, sortKey: "profit" },
    fastTurnover: { maxBuyMin: 30, minDailyVol: 500, sortKey: "gpPerHour" },
    highRoi: { minMargin: 3, sortKey: "roi" },
    f2p: { membersFilter: "f2p", sortKey: "profit" },
    members: { membersFilter: "members", sortKey: "profit" },
    budget1m: { maxBudget: 1_000_000, sortKey: "profit" },
    budget10m: { maxBudget: 10_000_000, sortKey: "profit" },
  };

  function cofferCredit(guidePrice) {
    return Math.floor(guidePrice * COFFER_RATE);
  }

  function buildRows(mode) {
    if (!G.cachedApiData) return [];
    const { mapping, latest, hourly, fiveMin } = G.cachedApiData;

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
        const limitCost = buyPrice * limit;
        const limitProfit = profit * limit;

        const h = hourly?.[m.id];
        const f = fiveMin?.[m.id];
        const buyVolHour = h?.lowPriceVolume ?? 0;
        const sellVolHour = h?.highPriceVolume ?? 0;
        const buyVol5m = f?.lowPriceVolume ?? 0;
        const sellVol5m = f?.highPriceVolume ?? 0;
        const volume5m = buyVol5m + sellVol5m;
        const buyRateHour = G.effectiveHourlyRate(buyVol5m, buyVolHour);
        const sellRateHour = G.effectiveHourlyRate(sellVol5m, sellVolHour);
        const dailyVolume = (buyRateHour + sellRateHour) * 24;
        const buyQty = limit > 0 ? limit : 1;
        const buyTimeHours = G.hoursToFillQty(buyQty, buyRateHour);
        const gpPerHour =
          buyTimeHours != null && buyTimeHours > 0 ? limitProfit / buyTimeHours : null;

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
          limitCost,
          limitProfit,
          volume5m,
          dailyVolume,
          buyTimeHours,
          gpPerHour,
        };
      })
      .filter(Boolean);
  }

  function passesFilters(row) {
    if (G.el("cofferProfitableOnly")?.checked && row.profit <= 0) return false;

    const minProfit = G.parseFilterNum("cofferMinProfit");
    if (minProfit != null && row.profit < minProfit) return false;

    const minMargin = G.parseFilterNum("cofferMinMargin");
    if (minMargin != null && (row.roi == null || row.roi < minMargin)) return false;

    const maxBuyPrice = G.parseFilterNum("cofferMaxBuyPrice");
    if (maxBuyPrice != null && row.buyPrice > maxBuyPrice) return false;

    const maxBudget = G.parseFilterNum("cofferMaxBudget");
    if (maxBudget != null && row.limitCost > maxBudget) return false;

    const maxBuyMin = G.parseFilterNum("cofferMaxBuyMin");
    if (!G.withinMinuteRange(row.buyTimeHours, null, maxBuyMin)) return false;

    const minDailyVol = G.parseFilterNum("cofferMinDailyVol");
    if (minDailyVol != null && row.dailyVolume < minDailyVol) return false;

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
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }

  function buyTimingTooltip(row) {
    if (!row.buyTimeHours) return "No recent buy-side volume";
    return `Est. time to buy ${row.limit ? row.limit.toLocaleString() : "1"} at rec. buy (65% 5m + 35% 1h volume)`;
  }

  function cofferRowHtml(row) {
    const profitCls = row.profit >= 0 ? "positive" : "negative";
    const gpHrCls = row.gpPerHour != null && row.gpPerHour >= 0 ? "highlight-gp" : "";
    return G.itemListRow(
      G.itemListNameCell(row, { showBadge: true }) +
        G.itemListNumCell(G.formatPrice(row.buyPrice), "num price-buy price-col-buy price-copyable", "Buy price", {
          "data-copy-price": Math.round(row.buyPrice),
          title: "Click to copy buy price",
        }) +
        G.itemListNumCell(G.formatPrice(row.guide), "num col-hide-xs", "GE guide") +
        G.itemListNumCell(G.formatPrice(row.credit), "num", "Coffer credit") +
        G.itemListNumCell(G.formatGp(row.profit), `num ${profitCls}`, "Profit") +
        G.itemListNumCell(row.roi != null ? row.roi.toFixed(1) + "%" : "—", `num col-hide-xs ${profitCls}`, "ROI") +
        G.itemListNumCell(G.formatDuration(row.buyTimeHours), "num", "Est. buy", { title: buyTimingTooltip(row) }) +
        G.itemListNumCell(G.formatGp(row.volume5m), "num col-hide-narrow", "5m vol.") +
        G.itemListNumCell(G.formatGp(row.dailyVolume), "num col-hide-narrow", "Daily vol.") +
        G.itemListNumCell(row.gpPerHour == null ? "—" : G.formatGp(row.gpPerHour), `num ${gpHrCls}`, "GP / hr") +
        G.itemListNumCell(row.limit ? row.limit.toLocaleString() : "—", "num col-hide-narrow", "Limit") +
        G.itemListNumCell(row.limit ? G.formatGp(row.limitProfit) : "—", `num col-hide-narrow ${profitCls}`, "Profit (limit)")
    );
  }

  function setActivePreset(presetId) {
    document.querySelectorAll("[data-coffer-preset]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cofferPreset === presetId);
    });
  }

  function setCofferFilters(values = {}) {
    if (G.el("cofferSearch")) G.el("cofferSearch").value = values.search ?? "";
    if (G.el("cofferMode")) G.el("cofferMode").value = values.mode ?? G.el("cofferMode")?.value ?? "instant";
    if (G.el("cofferMembers")) G.el("cofferMembers").value = values.membersFilter ?? "all";
    if (G.el("cofferMinProfit")) G.el("cofferMinProfit").value = values.minProfit ?? "";
    if (G.el("cofferMinMargin")) G.el("cofferMinMargin").value = values.minMargin ?? "";
    if (G.el("cofferMaxBuyPrice")) G.el("cofferMaxBuyPrice").value = values.maxBuyPrice ?? "";
    if (G.el("cofferMaxBudget")) G.el("cofferMaxBudget").value = values.maxBudget ?? "";
    if (G.el("cofferMaxBuyMin")) G.el("cofferMaxBuyMin").value = values.maxBuyMin ?? "";
    if (G.el("cofferMinDailyVol")) G.el("cofferMinDailyVol").value = values.minDailyVol ?? "";
    if (G.el("cofferProfitableOnly")) G.el("cofferProfitableOnly").checked = values.profitableOnly ?? true;
    if (values.sortKey) sort = { key: values.sortKey, dir: "desc" };
  }

  function applyPreset(presetId) {
    const preset = COFFER_PRESETS[presetId];
    if (!preset) return;
    setCofferFilters(preset);
    setActivePreset(presetId);
    render();
  }

  function render() {
    const mode = G.el("cofferMode")?.value || "instant";
    rows = buildRows(mode);
    const filtered = sortRows(rows.filter(passesFilters));

    G.el("cofferMeta").textContent = filtered.length
      ? `${filtered.length.toLocaleString()} items · ${mode === "patient" ? "patient buy (sell price)" : "instant buy (buy price)"} · coffer credits 105% of GE guide · est. buy uses 65% 5m + 35% 1h volume`
      : "No items match your filters.";

    if (!filtered.length) {
      G.renderItemList("cofferBody", {
        message: "No matches — try loosening filters or turn off Profitable only.",
        loading: true,
        listId: "cofferList",
        sortKey: sort.key,
        sortDir: sort.dir,
      });
      G.el("cofferSummary")?.setAttribute("hidden", "");
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

    const best = filtered[0];
    if (typeof renderSummaryStrip === "function") {
      G.el("cofferSummary")?.removeAttribute("hidden");
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

  function bindFilters() {
    ["cofferMode", "cofferMembers", "cofferProfitableOnly"].forEach((id) => {
      G.el(id)?.addEventListener("change", () => {
        setActivePreset(null);
        render();
      });
    });
    ["cofferSearch", "cofferMinProfit", "cofferMinMargin", "cofferMaxBuyPrice", "cofferMaxBudget", "cofferMaxBuyMin", "cofferMinDailyVol"].forEach((id) => {
      G.el(id)?.addEventListener("input", () => {
        setActivePreset(null);
        clearTimeout(bindFilters._timer);
        bindFilters._timer = setTimeout(render, 150);
      });
    });
    document.querySelectorAll("[data-coffer-preset]").forEach((btn) => {
      btn.addEventListener("click", () => applyPreset(btn.dataset.cofferPreset));
    });
  }

  async function init() {
    G.bindPriceCopy();
    bindSort();
    bindFilters();
    G.el("refreshCofferBtn")?.addEventListener("click", () => load(true));
    G.el("resetCofferBtn")?.addEventListener("click", () => {
      setCofferFilters({});
      sort = { key: "profit", dir: "desc" };
      setActivePreset(null);
      render();
    });
    await load();
  }

  async function load(forceRefresh = false) {
    const hasCache = Boolean(G.cachedApiData);
    if (!hasCache || forceRefresh) {
      G.updateStatus("cofferStatus", forceRefresh ? "Refreshing price data…" : "Loading price data…", "");
      G.applyItemListSkeleton("cofferBody", 12, 10);
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

  G.onToolListRefresh(() => {
    if (G.cachedApiData) render();
  });

  G.whenToolLayoutReady(() => init());
})(window.Graardor);
