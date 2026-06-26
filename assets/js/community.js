(function (G) {
  async function render() {
    try {
      const res = await fetch("/api/aggregates?days=7");
      const data = await res.json();
      G.el("communityMeta").textContent = data.items?.length
        ? `Top items by reported profit — last ${data.days} days (anonymous, opt-in)`
        : "No community data yet. Enable sharing on the flip log when you log flips.";

      if (!data.items?.length) {
        G.renderItemList("communityBody", {
          message: "Waiting for opt-in flip data…",
          loading: true,
        });
        return;
      }

      G.renderItemList("communityBody", {
        rowsHtml: data.items
          .map(
            (row, i) =>
              G.itemListRow(
                G.itemListNumCell(i + 1, "rank-cell", "#") +
                  G.itemListCell(G.escapeHtml(row.item_name), "gra-item-list__cell--name", {
                    "data-label": "Item",
                  }) +
                  G.itemListNumCell(G.formatGp(Number(row.total_profit)), "num highlight-gp", "Profit (7d)") +
                  G.itemListNumCell(row.flip_count, "num", "Flips")
              )
          )
          .join(""),
      });
    } catch (err) {
      G.renderItemList("communityBody", { message: G.escapeHtml(err.message), loading: true });
    }
  }

  render();
})(window.Graardor);
