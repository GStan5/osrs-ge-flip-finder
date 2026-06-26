(function (G) {
  const NATURE_COST_KEY = "graardor-alch-nature-cost-v1";
  let natureCost = 0;
  let rows = [];
  let sort = { key: "gpPerHour", dir: "desc" };

  const ALCH_PRESETS = {
    bestGpHour: { minGpHour: 200000, sortKey: "gpPerHour" },
    cheapItems: { maxBuyPrice: 50000, minProfit: 100, sortKey: "gpPerHour" },
    highVolume: { minDailyVol: 5000, sortKey: "gpPerHour" },
    highMargin: { minMargin: 5, sortKey: "roi" },
    f2p: { membersFilter: "f2p", sortKey: "gpPerHour" },
    budget1m: { maxBudget: 1_000_000, sortKey: "gpPerHour" },
    budget10m: { maxBudget: 10_000_000, sortKey: "gpPerHour" },
  };

  function readStoredNatureCost() {
    try {
      const v = localStorage.getItem(NATURE_COST_KEY);
      if (v === null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    } catch {
      return null;
    }
  }

  function writeStoredNatureCost(value) {
    try {
      if (value == null) localStorage.removeItem(NATURE_COST_KEY);
      else localStorage.setItem(NATURE_COST_KEY, String(value));
    } catch {
      /* optional */
    }
  }

  function resolveNatureCost() {
    const override = G.parseFilterNum("alchNatureCost");
    if (override != null) return override;
    const stored = readStoredNatureCost();
    if (stored != null) return stored;
    const nature = G.getItemPrice(G.NATURE_RUNE_ID);
    return nature?.buy ?? 90;
  }

  function buildRows() {
    if (!G.cachedApiData) return [];
    const { mapping, latest, hourly, fiveMin } = G.cachedApiData;
    const nature = resolveNatureCost();

    return mapping
      .map((m) => {
        const highalch = m.highalch ?? 0;
        if (highalch <= 0) return null;
        const l = latest[m.id];
        if (!l || l.low == null || l.low <= 0) return null;

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

        const buyPrice = l.low;
        const profit = highalch - buyPrice - nature;
        const limit = m.limit ?? 0;
        const roi = buyPrice > 0 ? (profit / buyPrice) * 100 : null;
        const buyQty = limit > 0 ? limit : 1;
        const buyTimeHours = G.hoursToFillQty(buyQty, buyRateHour);
        const limitCost = buyPrice * buyQty;
        const limitProfit = profit * buyQty;
        const gpPerHour =
          buyTimeHours != null && buyTimeHours > 0 ? limitProfit / buyTimeHours : null;

        return {
          id: m.id,
          name: m.name,
          icon: m.icon,
          members: m.members,
          limit,
          highalch,
          buyPrice,
          profit,
          roi,
          limitCost,
          limitProfit,
          volume5m,
          dailyVolume,
          buyTimeHours,
          gpPerHour,
          buyRateHour,
        };
      })
      .filter(Boolean);
  }

  function passesFilters(row) {
    if (G.el("alchProfitableOnly")?.checked && row.profit <= 0) return false;

    const minProfit = G.parseFilterNum("alchMinProfit");
    if (minProfit != null && row.profit < minProfit) return false;

    const minMargin = G.parseFilterNum("alchMinMargin");
    if (minMargin != null && (row.roi == null || row.roi < minMargin)) return false;

    const minGpHour = G.parseFilterNum("alchMinGpHour");
    if (minGpHour != null && (row.gpPerHour == null || row.gpPerHour < minGpHour)) return false;

    const minBuyPrice = G.parseFilterNum("alchMinBuyPrice");
    if (minBuyPrice != null && row.buyPrice < minBuyPrice) return false;

    const maxBuyPrice = G.parseFilterNum("alchMaxBuyPrice");
    if (maxBuyPrice != null && row.buyPrice > maxBuyPrice) return false;

    const maxBudget = G.parseFilterNum("alchMaxBudget");
    if (maxBudget != null && row.limitCost > maxBudget) return false;

    const minDailyVol = G.parseFilterNum("alchMinDailyVol");
    if (minDailyVol != null && row.dailyVolume < minDailyVol) return false;

    const members = G.el("alchMembers")?.value || "all";
    if (members === "members" && !row.members) return false;
    if (members === "f2p" && row.members) return false;

    const q = (G.el("alchSearch")?.value || "").trim().toLowerCase();
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
    if (!row.buyRateHour || row.buyRateHour <= 0) return "No recent buy-side volume";
    const perMin = row.buyRateHour / 60;
    return `~${Math.round(row.buyRateHour).toLocaleString()} items/hour at rec. buy (65% 5m + 35% 1h) · ~${perMin >= 1 ? perMin.toFixed(1) : perMin.toFixed(2)}/min`;
  }

  function alchRowHtml(row) {
    const profitCls = row.profit >= 0 ? "positive" : "negative";
    const gpHrCls = row.gpPerHour != null && row.gpPerHour >= 0 ? "highlight-gp" : "";
    return G.itemListRow(
      G.itemListNameCell(row, { showBadge: true }) +
        G.itemListNumCell(G.formatPrice(row.buyPrice), "num price-copyable price-buy", "Buy price", {
          "data-copy-price": Math.round(row.buyPrice),
          title: "Click to copy buy price",
        }) +
        G.itemListNumCell(G.formatPrice(row.highalch), "num col-hide-xs", "High alch") +
        G.itemListNumCell(G.formatPrice(natureCost), "num col-hide-xs", "Nature cost") +
        G.itemListNumCell(G.formatGp(row.profit), `num ${profitCls}`, "Profit") +
        G.itemListNumCell(row.roi != null ? row.roi.toFixed(1) + "%" : "—", `num col-hide-xs ${profitCls}`, "ROI") +
        G.itemListNumCell(G.formatDuration(row.buyTimeHours), "num", "Est. buy", { title: buyTimingTooltip(row) }) +
        G.itemListNumCell(G.formatGp(row.volume5m), "num col-hide-narrow", "5m vol.") +
        G.itemListNumCell(G.formatGp(row.dailyVolume), "num col-hide-narrow", "Daily vol.") +
        G.itemListNumCell(row.gpPerHour == null ? "—" : G.formatGp(row.gpPerHour), `num ${gpHrCls}`, "GP / hr") +
        G.itemListNumCell(row.limit ? G.formatGp(row.limitProfit) : "—", `num col-hide-narrow ${profitCls}`, "Profit (limit)")
    );
  }

  function setActivePreset(presetId) {
    document.querySelectorAll("[data-alch-preset]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.alchPreset === presetId);
    });
  }

  function setAlchFilters(values = {}) {
    if (G.el("alchSearch")) G.el("alchSearch").value = values.search ?? "";
    if (G.el("alchMembers")) G.el("alchMembers").value = values.membersFilter ?? "all";
    if (G.el("alchMinProfit")) G.el("alchMinProfit").value = values.minProfit ?? "";
    if (G.el("alchMinMargin")) G.el("alchMinMargin").value = values.minMargin ?? "";
    if (G.el("alchMinGpHour")) G.el("alchMinGpHour").value = values.minGpHour ?? "";
    if (G.el("alchMinBuyPrice")) G.el("alchMinBuyPrice").value = values.minBuyPrice ?? "";
    if (G.el("alchMaxBuyPrice")) G.el("alchMaxBuyPrice").value = values.maxBuyPrice ?? "";
    if (G.el("alchMaxBudget")) G.el("alchMaxBudget").value = values.maxBudget ?? "";
    if (G.el("alchMinDailyVol")) G.el("alchMinDailyVol").value = values.minDailyVol ?? "";
    if (G.el("alchProfitableOnly")) G.el("alchProfitableOnly").checked = values.profitableOnly ?? true;
    if (values.sortKey) sort = { key: values.sortKey, dir: "desc" };
  }

  function applyPreset(presetId) {
    const preset = ALCH_PRESETS[presetId];
    if (!preset) return;
    setAlchFilters(preset);
    setActivePreset(presetId);
    render();
  }

  function render() {
    natureCost = resolveNatureCost();
    rows = buildRows();
    const filtered = sortRows(rows.filter(passesFilters));

    G.el("alchMeta").textContent = filtered.length
      ? `${filtered.length.toLocaleString()} alchable items · nature ${G.formatPrice(natureCost)} gp · est. buy uses 65% 5m + 35% 1h volume · GP/hr = profit (limit) ÷ est. buy`
      : "No items match your filters.";

    if (!filtered.length) {
      G.renderItemList("alchBody", {
        message: "No matches — try loosening filters or turn off Profitable only.",
        loading: true,
        listId: "alchList",
        sortKey: sort.key,
        sortDir: sort.dir,
      });
      G.el("alchSummary")?.setAttribute("hidden", "");
      return;
    }

    const shown = filtered.slice(0, 500);
    G.renderItemList("alchBody", {
      rowsHtml: shown.map(alchRowHtml).join(""),
      listId: "alchList",
      sortKey: sort.key,
      sortDir: sort.dir,
    });

    if (filtered.length > 500) {
      G.el("alchMeta").textContent += ` (showing top 500)`;
    }

    const best = filtered[0];
    if (typeof renderSummaryStrip === "function") {
      G.el("alchSummary")?.removeAttribute("hidden");
      renderSummaryStrip("alchSummary", [
        {
          label: "Best GP/hr",
          value: best?.gpPerHour != null ? G.formatGp(best.gpPerHour) : "—",
          className: "highlight-gp",
          hint: best?.name,
          link: best ? G.itemPageUrl(best.id) : null,
        },
        { label: "Nature cost", value: G.formatPrice(natureCost) + " gp" },
        { label: "Profitable", value: filtered.filter((r) => r.profit > 0).length.toLocaleString() },
        { label: "Showing", value: shown.length.toLocaleString() },
      ]);
    }
  }

  function bindSort() {
    G.bindItemListSort("alchList", (key) => {
      if (sort.key === key) sort.dir = sort.dir === "desc" ? "asc" : "desc";
      else {
        sort.key = key;
        sort.dir = "desc";
      }
      render();
    });
  }

  function bindFilters() {
    ["alchMembers", "alchProfitableOnly"].forEach((id) => {
      G.el(id)?.addEventListener("change", () => {
        setActivePreset(null);
        render();
      });
    });
    [
      "alchSearch",
      "alchMinProfit",
      "alchMinMargin",
      "alchMinGpHour",
      "alchMinBuyPrice",
      "alchMaxBuyPrice",
      "alchMaxBudget",
      "alchMinDailyVol",
      "alchNatureCost",
    ].forEach((id) => {
      G.el(id)?.addEventListener("input", () => {
        setActivePreset(null);
        if (id === "alchNatureCost") {
          const v = G.parseFilterNum("alchNatureCost");
          writeStoredNatureCost(v);
        }
        clearTimeout(bindFilters._timer);
        bindFilters._timer = setTimeout(render, 150);
      });
    });
    document.querySelectorAll("[data-alch-preset]").forEach((btn) => {
      btn.addEventListener("click", () => applyPreset(btn.dataset.alchPreset));
    });
  }

  async function init() {
    G.bindPriceCopy();
    bindSort();
    bindFilters();
    G.el("refreshAlchBtn")?.addEventListener("click", () => load(true));
    G.el("resetAlchBtn")?.addEventListener("click", () => {
      setAlchFilters({});
      writeStoredNatureCost(null);
      if (G.el("alchNatureCost")) G.el("alchNatureCost").value = "";
      sort = { key: "gpPerHour", dir: "desc" };
      setActivePreset(null);
      render();
    });
    await load();
  }

  async function load(forceRefresh = false) {
    const hasCache = Boolean(G.cachedApiData);
    if (!hasCache || forceRefresh) {
      G.updateStatus("alchStatus", forceRefresh ? "Refreshing price data…" : "Loading price data…", "");
      G.applyItemListSkeleton("alchBody", 11, 10);
    }
    try {
      await G.loadPrices({ useCache: true, force: forceRefresh });
      const liveNature = G.getItemPrice(G.NATURE_RUNE_ID)?.buy ?? 90;
      const stored = readStoredNatureCost();
      natureCost = G.parseFilterNum("alchNatureCost") ?? stored ?? liveNature;
      if (G.el("alchNatureCost") && G.el("alchNatureCost").value === "" && stored == null) {
        G.el("alchNatureCost").placeholder = String(liveNature);
      }
      G.updateStatus(
        "alchStatus",
        `Loaded ${G.cachedApiData.mapping.length.toLocaleString()} items — nature ${G.formatPrice(natureCost)} gp · refresh when you want new prices`,
        "ok"
      );
      render();
    } catch (err) {
      G.updateStatus("alchStatus", `Failed: ${err.message}`, "error");
      G.renderItemList("alchBody", { message: G.escapeHtml(err.message), loading: true });
    }
  }

  init();
})(window.Graardor);
