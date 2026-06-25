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

  function render() {
    const mode = G.el("cofferMode")?.value || "instant";
    rows = buildRows(mode);
    const filtered = sortRows(rows.filter(passesFilters));

    G.el("cofferMeta").textContent = filtered.length
      ? `${filtered.length.toLocaleString()} items · ${mode === "patient" ? "patient buy (sell price)" : "instant buy (buy price)"} · coffer credits 105% of GE guide price`
      : "No items match your filters.";

    if (!filtered.length) {
      G.el("cofferBody").innerHTML = '<tr><td colspan="8" class="loading">No matches.</td></tr>';
      return;
    }

    const shown = filtered.slice(0, 500);
    G.el("cofferBody").innerHTML = shown
      .map((row) => {
        const profitCls = row.profit >= 0 ? "positive" : "negative";
        return `<tr>
          ${G.itemNameCell(row)}
          <td class="num price-copyable price-buy" data-copy-price="${Math.round(row.buyPrice)}" title="Click to copy">${G.formatPrice(row.buyPrice)}</td>
          <td class="num">${G.formatPrice(row.guide)}</td>
          <td class="num">${G.formatPrice(row.credit)}</td>
          <td class="num ${profitCls}">${G.formatGp(row.profit)}</td>
          <td class="num ${profitCls}">${row.roi != null ? row.roi.toFixed(1) + "%" : "—"}</td>
          <td class="num">${row.limit ? row.limit.toLocaleString() : "—"}</td>
          <td class="num ${profitCls}">${row.limit ? G.formatGp(row.limitProfit) : "—"}</td>
        </tr>`;
      })
      .join("");

    if (filtered.length > 500) {
      G.el("cofferMeta").textContent += ` (showing top 500)`;
    }
  }

  function bindSort() {
    document.querySelectorAll("#cofferTable th.sortable").forEach((th) => {
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
    ["cofferMode", "cofferMembers", "cofferProfitableOnly"].forEach((id) => {
      G.el(id)?.addEventListener("change", render);
    });
    ["cofferSearch", "cofferMinProfit"].forEach((id) => {
      G.el(id)?.addEventListener("input", () => {
        clearTimeout(init._timer);
        init._timer = setTimeout(render, 150);
      });
    });
    G.el("refreshCofferBtn")?.addEventListener("click", load);
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

  async function load() {
    G.updateStatus("cofferStatus", "Loading price data…", "");
    G.el("cofferBody").innerHTML = '<tr><td colspan="8" class="loading">Loading…</td></tr>';
    try {
      await G.loadPrices();
      G.updateStatus(
        "cofferStatus",
        `Loaded ${G.cachedApiData.mapping.length.toLocaleString()} items — refresh when you want new prices`,
        "ok"
      );
      render();
    } catch (err) {
      G.updateStatus("cofferStatus", `Failed: ${err.message}`, "error");
      G.el("cofferBody").innerHTML = `<tr><td colspan="8" class="loading">${G.escapeHtml(err.message)}</td></tr>`;
    }
  }

  init();
})(window.Graardor);
