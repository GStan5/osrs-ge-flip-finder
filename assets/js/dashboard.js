(function (G) {
  function loadLog() {
    try {
      return JSON.parse(localStorage.getItem(G.SYNC_KEYS?.flipLog || "graardor_flip_log_v1") || "[]");
    } catch {
      return [];
    }
  }

  function renderLogSummary() {
    const entries = loadLog();
    const profit = entries.reduce((s, e) => s + (e.profit || 0), 0);
    const cls = profit >= 0 ? "positive" : "negative";
    G.el("dashLogSummary").innerHTML = `
      <div class="stat-card"><span class="label">Logged flips</span><span class="value">${entries.length}</span></div>
      <div class="stat-card"><span class="label">Total profit</span><span class="value ${cls}">${G.formatGp(profit)}</span></div>
      <div class="stat-card"><span class="label">Avg / flip</span><span class="value">${entries.length ? G.formatGp(profit / entries.length) : "—"}</span></div>`;
  }

  async function renderCommunity() {
    try {
      const res = await fetch("/api/aggregates?days=7");
      const data = await res.json();
      if (!data.items?.length) {
        G.renderItemList("dashCommunityBody", {
          message: "No community data yet — opt in on the flip log.",
          loading: true,
        });
        return;
      }
      G.renderItemList("dashCommunityBody", {
        rowsHtml: data.items
          .map(
            (row) =>
              G.itemListRow(
                G.itemListCell(G.escapeHtml(row.item_name), "gra-item-list__cell--name", {
                  "data-label": "Item",
                }) +
                  G.itemListNumCell(row.flip_count, "num", "Flips") +
                  G.itemListNumCell(G.formatGp(Number(row.total_profit)), "num highlight-gp", "Profit")
              )
          )
          .join(""),
      });
    } catch {
      G.renderItemList("dashCommunityBody", {
        message: "Could not load community stats.",
        loading: true,
      });
    }
  }

  async function init() {
    const me = await fetch("/api/me", { credentials: "same-origin" }).then((r) => r.json());
    if (!me.pro) {
      G.el("dashGate").hidden = false;
      G.el("dashContent").hidden = true;
      return;
    }
    G.el("dashGate").hidden = true;
    G.el("dashContent").hidden = false;
    await G.initSync?.();
    renderLogSummary();
    renderCommunity();
  }

  init();
})(window.Graardor);
