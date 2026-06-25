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

  function render() {
    const entries = loadEntries();
    const { profit, count } = totals(entries);
    const profitCls = profit >= 0 ? "positive" : "negative";

    G.el("flipLogSummary").innerHTML = `
      <div><strong>${count}</strong> logged flips</div>
      <div>Total profit: <strong class="${profitCls}">${G.formatGp(profit)}</strong> gp</div>`;

    const body = G.el("flipLogBody");
    if (!entries.length) {
      body.innerHTML = '<tr><td colspan="7" class="loading">No flips logged yet — add your first below.</td></tr>';
      return;
    }

    body.innerHTML = [...entries]
      .reverse()
      .map((row, idx) => {
        const realIndex = entries.length - 1 - idx;
        const cls = row.profit >= 0 ? "positive" : "negative";
        return `<tr>
          <td>${G.escapeHtml(row.itemName)}</td>
          <td class="num">${G.formatPrice(row.buyPrice)}</td>
          <td class="num">${G.formatPrice(row.sellPrice)}</td>
          <td class="num">${row.qty.toLocaleString()}</td>
          <td class="num ${cls}">${G.formatGp(row.profit)}</td>
          <td class="num">${new Date(row.at).toLocaleString()}</td>
          <td><button type="button" class="link-btn" data-delete="${realIndex}">Remove</button></td>
        </tr>`;
      })
      .join("");
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
