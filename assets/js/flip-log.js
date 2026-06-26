(function (G) {
  const STORAGE_KEY = "graardor_flip_log_v1";

  function loadEntries() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    G.pushSync?.(STORAGE_KEY, entries);
  }

  function totals(entries) {
    return entries.reduce(
      (acc, row) => {
        acc.profit += row.profit || 0;
        acc.count += 1;
        return acc;
      },
      { profit: 0, count: 0 }
    );
  }

  function flipLogRowHtml(row, realIndex) {
    const cls = row.profit >= 0 ? "positive" : "negative";
    return G.itemListRow(
      G.itemListCell(G.escapeHtml(row.itemName), "gra-item-list__cell--name", { "data-label": "Item" }) +
        G.itemListNumCell(G.formatPrice(row.buyPrice), "num", "Buy") +
        G.itemListNumCell(G.formatPrice(row.sellPrice), "num", "Sell") +
        G.itemListNumCell(row.qty.toLocaleString(), "num", "Qty") +
        G.itemListNumCell(G.formatGp(row.profit), `num ${cls}`, "Profit") +
        G.itemListNumCell(new Date(row.at).toLocaleString(), "num", "When") +
        G.itemListCell(
          `<button type="button" class="link-btn" data-delete="${realIndex}">Remove</button>`,
          null,
          { "data-label": "" }
        )
    );
  }

  function render() {
    const entries = loadEntries();
    const { profit, count } = totals(entries);
    const profitCls = profit >= 0 ? "positive" : "negative";

    G.el("flipLogSummary").innerHTML = `
      <div><strong>${count}</strong> logged flips</div>
      <div>Total profit: <strong class="${profitCls}">${G.formatGp(profit)}</strong> gp</div>`;

    if (!entries.length) {
      G.renderItemList("flipLogBody", {
        message: "No flips logged yet — add your first below.",
        loading: true,
      });
      return;
    }

    G.renderItemList("flipLogBody", {
      rowsHtml: [...entries]
        .reverse()
        .map((row, idx) => flipLogRowHtml(row, entries.length - 1 - idx))
        .join(""),
    });
  }

  function bindDelete() {
    G.el("flipLogBody")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-delete]");
      if (!btn) return;
      const entries = loadEntries();
      entries.splice(Number(btn.dataset.delete), 1);
      saveEntries(entries);
      render();
      G.showToast("Flip removed");
    });
  }

  function bindForm() {
    G.el("flipLogForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const itemName = G.el("logItemName").value.trim();
      const buyPrice = Number(G.el("logBuyPrice").value);
      const sellPrice = Number(G.el("logSellPrice").value);
      const qty = Number(G.el("logQty").value) || 1;

      if (!itemName || !Number.isFinite(buyPrice) || !Number.isFinite(sellPrice)) {
        G.showToast("Enter item name and prices");
        return;
      }

      const tax = G.calcGeTax(sellPrice, null);
      const profit = (sellPrice - buyPrice - tax) * qty;
      const entries = loadEntries();
      entries.push({
        itemName,
        buyPrice,
        sellPrice,
        qty,
        profit,
        at: Date.now(),
      });
      saveEntries(entries);
      G.postAggregate?.(itemName, profit, null);
      e.target.reset();
      G.el("logQty").value = "1";
      render();
      G.showToast("Flip logged");
    });

    G.el("clearFlipLogBtn")?.addEventListener("click", () => {
      if (!confirm("Clear all logged flips?")) return;
      saveEntries([]);
      render();
      G.showToast("Log cleared");
    });

    const optIn = G.el("aggregateOptIn");
    if (optIn) {
      optIn.checked = G.aggregateOptIn?.() ?? false;
      optIn.addEventListener("change", () => G.setAggregateOptIn?.(optIn.checked));
    }
  }

  async function init() {
    await G.initSync?.();
    bindForm();
    bindDelete();
    render();
  }

  init();
})(window.Graardor);
