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
      const body = G.el("dashCommunityBody");
      if (!data.items?.length) {
        body.innerHTML = '<tr><td colspan="3" class="loading">No community data yet — opt in on the flip log.</td></tr>';
        return;
      }
      body.innerHTML = data.items
        .map(
          (row) => `<tr>
          <td>${G.escapeHtml(row.item_name)}</td>
          <td class="num">${row.flip_count}</td>
          <td class="num highlight-gp">${G.formatGp(Number(row.total_profit))}</td>
        </tr>`
        )
        .join("");
    } catch {
      G.el("dashCommunityBody").innerHTML = '<tr><td colspan="3" class="loading">Could not load community stats.</td></tr>';
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
