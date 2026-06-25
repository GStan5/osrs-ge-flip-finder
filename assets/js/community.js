(function (G) {
  async function render() {
    try {
      const res = await fetch("/api/aggregates?days=7");
      const data = await res.json();
      G.el("communityMeta").textContent = data.items?.length
        ? `Top items by reported profit — last ${data.days} days (anonymous, opt-in)`
        : "No community data yet. Enable sharing on the flip log when you log flips.";

      const body = G.el("communityBody");
      if (!data.items?.length) {
        body.innerHTML = '<tr><td colspan="3" class="loading">Waiting for opt-in flip data…</td></tr>';
        return;
      }
      body.innerHTML = data.items
        .map(
          (row, i) => `<tr>
          <td class="rank-cell">${i + 1}</td>
          <td>${G.escapeHtml(row.item_name)}</td>
          <td class="num highlight-gp">${G.formatGp(Number(row.total_profit))}</td>
          <td class="num">${row.flip_count}</td>
        </tr>`
        )
        .join("");
    } catch (err) {
      G.el("communityBody").innerHTML = `<tr><td colspan="4" class="loading">${G.escapeHtml(err.message)}</td></tr>`;
    }
  }

  render();
})(window.Graardor);
