(function (G) {
  let natureCost = 0;
  let rows = [];
  let sort = { key: "gpPerHour", dir: "desc" };

  function buildRows() {
    if (!G.cachedApiData) return [];
    const { mapping, latest, hourly, fiveMin } = G.cachedApiData;

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
        const profit = highalch - buyPrice - natureCost;
        const limit = m.limit ?? 0;
        const roi = buyPrice > 0 ? (profit / buyPrice) * 100 : null;
        const buyQty = limit > 0 ? limit : 1;
        const buyTimeHours = G.hoursToFillQty(buyQty, buyRateHour);
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
    if (G.el("alchProfitableOnly")?.checked && row.profit <= 0) return false;
    const minProfit = Number(G.el("alchMinProfit")?.value);
    if (Number.isFinite(minProfit) && minProfit > 0 && row.profit < minProfit) return false;
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
      const av = a[sort.key];
      const bv = b[sort.key];
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }

  function render() {
    rows = buildRows();
    const filtered = sortRows(rows.filter(passesFilters));

    G.el("alchMeta").textContent = filtered.length
      ? `${filtered.length.toLocaleString()} alchable items · nature ${G.formatPrice(natureCost)} gp · est. buy uses 65% 5m + 35% 1h volume`
      : "No items match your filters.";

    if (!filtered.length) {
      G.el("alchBody").innerHTML = '<tr><td colspan="11" class="loading">No matches.</td></tr>';
      if (typeof renderSummaryStrip === "function") renderSummaryStrip("alchSummary", []);
      return;
    }

    const shown = filtered.slice(0, 500);
    G.el("alchBody").innerHTML = shown
      .map((row) => {
        const profitCls = row.profit >= 0 ? "positive" : "negative";
        const gpHrCls = row.gpPerHour != null && row.gpPerHour >= 0 ? "highlight-gp" : "";
        return `<tr>
          ${G.itemNameCell(row)}
          <td class="num price-copyable price-buy" data-copy-price="${Math.round(row.buyPrice)}" title="Click to copy buy price">${G.formatPrice(row.buyPrice)}</td>
          <td class="num col-hide-xs">${G.formatPrice(row.highalch)}</td>
          <td class="num col-hide-xs">${G.formatPrice(natureCost)}</td>
          <td class="num ${profitCls}">${G.formatGp(row.profit)}</td>
          <td class="num col-hide-xs ${profitCls}">${row.roi != null ? row.roi.toFixed(1) + "%" : "—"}</td>
          <td class="num col-hide-narrow">${G.formatDuration(row.buyTimeHours)}</td>
          <td class="num col-hide-narrow">${G.formatGp(row.volume5m)}</td>
          <td class="num col-hide-narrow">${G.formatGp(row.dailyVolume)}</td>
          <td class="num ${gpHrCls}">${row.gpPerHour == null ? "—" : G.formatGp(row.gpPerHour)}</td>
          <td class="num col-hide-narrow ${profitCls}">${row.limit ? G.formatGp(row.limitProfit) : "—"}</td>
        </tr>`;
      })
      .join("");

    if (filtered.length > 500) {
      G.el("alchMeta").textContent += ` (showing top 500)`;
    }

    const best = filtered[0];
    if (typeof renderSummaryStrip === "function") {
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
    document.querySelectorAll("#alchTable th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (sort.key === key) sort.dir = sort.dir === "desc" ? "asc" : "desc";
        else {
          sort.key = key;
          sort.dir = "desc";
        }
        render();
      });
    });
  }

  async function init() {
    G.bindPriceCopy();
    bindSort();
    ["alchMembers", "alchProfitableOnly"].forEach((id) => {
      G.el(id)?.addEventListener("change", render);
    });
    ["alchSearch", "alchMinProfit"].forEach((id) => {
      G.el(id)?.addEventListener("input", () => {
        clearTimeout(init._timer);
        init._timer = setTimeout(render, 150);
      });
    });
    G.el("refreshAlchBtn")?.addEventListener("click", () => load(true));
    G.el("resetAlchBtn")?.addEventListener("click", () => {
      if (G.el("alchSearch")) G.el("alchSearch").value = "";
      if (G.el("alchMinProfit")) G.el("alchMinProfit").value = "";
      if (G.el("alchMembers")) G.el("alchMembers").value = "all";
      if (G.el("alchProfitableOnly")) G.el("alchProfitableOnly").checked = true;
      sort = { key: "gpPerHour", dir: "desc" };
      render();
    });

    await load();
  }

  async function load(forceRefresh = false) {
    const hasCache = Boolean(G.cachedApiData);
    if (!hasCache || forceRefresh) {
      G.updateStatus("alchStatus", forceRefresh ? "Refreshing price data…" : "Loading price data…", "");
      G.applyTableSkeleton("alchBody", 11, 10);
    }
    try {
      await G.loadPrices({ useCache: true, force: forceRefresh });
      const nature = G.getItemPrice(G.NATURE_RUNE_ID);
      natureCost = nature?.buy ?? 90;
      G.updateStatus(
        "alchStatus",
        `Loaded ${G.cachedApiData.mapping.length.toLocaleString()} items — refresh when you want new prices`,
        "ok"
      );
      render();
    } catch (err) {
      G.updateStatus("alchStatus", `Failed: ${err.message}`, "error");
      G.el("alchBody").innerHTML = `<tr><td colspan="11" class="loading">${G.escapeHtml(err.message)}</td></tr>`;
    }
  }

  init();
})(window.Graardor);
