(function (G) {
  let natureCost = 0;
  let rows = [];
  let sort = { key: "profit", dir: "desc" };

  function buildRows() {
    if (!G.cachedApiData) return [];
    const { mapping, latest } = G.cachedApiData;

    return mapping
      .map((m) => {
        const highalch = m.highalch ?? 0;
        if (highalch <= 0) return null;
        const l = latest[m.id];
        if (!l || l.low == null || l.low <= 0) return null;

        const buyPrice = l.low;
        const profit = highalch - buyPrice - natureCost;
        const limit = m.limit ?? 0;
        const roi = buyPrice > 0 ? (profit / buyPrice) * 100 : null;

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
          limitProfit: profit * limit,
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
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });
  }

  function render() {
    rows = buildRows();
    const filtered = sortRows(rows.filter(passesFilters));

    G.el("alchMeta").textContent = filtered.length
      ? `${filtered.length.toLocaleString()} alchable items · nature rune cost ${G.formatPrice(natureCost)} gp (fire staff assumed)`
      : "No items match your filters.";

    if (!filtered.length) {
      G.el("alchBody").innerHTML = '<tr><td colspan="7" class="loading">No matches.</td></tr>';
      return;
    }

    const shown = filtered.slice(0, 500);
    G.el("alchBody").innerHTML = shown
      .map((row) => {
        const profitCls = row.profit >= 0 ? "positive" : "negative";
        return `<tr>
          ${G.itemNameCell(row)}
          <td class="num price-copyable price-buy" data-copy-price="${Math.round(row.buyPrice)}" title="Click to copy">${G.formatPrice(row.buyPrice)}</td>
          <td class="num">${G.formatPrice(row.highalch)}</td>
          <td class="num">${G.formatPrice(natureCost)}</td>
          <td class="num ${profitCls}">${G.formatGp(row.profit)}</td>
          <td class="num ${profitCls}">${row.roi != null ? row.roi.toFixed(1) + "%" : "—"}</td>
          <td class="num">${row.limit ? G.formatGp(row.limitProfit) : "—"}</td>
        </tr>`;
      })
      .join("");

    if (filtered.length > 500) {
      G.el("alchMeta").textContent += ` (showing top 500)`;
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
    G.el("refreshAlchBtn")?.addEventListener("click", load);
    G.el("resetAlchBtn")?.addEventListener("click", () => {
      if (G.el("alchSearch")) G.el("alchSearch").value = "";
      if (G.el("alchMinProfit")) G.el("alchMinProfit").value = "";
      if (G.el("alchMembers")) G.el("alchMembers").value = "all";
      if (G.el("alchProfitableOnly")) G.el("alchProfitableOnly").checked = true;
      render();
    });

    await load();
  }

  async function load() {
    G.updateStatus("alchStatus", "Loading price data…", "");
    G.el("alchBody").innerHTML = '<tr><td colspan="7" class="loading">Loading…</td></tr>';
    try {
      await G.loadPrices();
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
      G.el("alchBody").innerHTML = `<tr><td colspan="7" class="loading">${G.escapeHtml(err.message)}</td></tr>`;
    }
  }

  init();
})(window.Graardor);
