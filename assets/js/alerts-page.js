(function (G) {
  async function loadAlerts() {
    const res = await fetch("/api/alerts", { credentials: "same-origin" });
    if (res.status === 403) {
      G.el("alertsGate").hidden = false;
      G.el("alertsContent").hidden = true;
      return;
    }
    if (!res.ok) {
      G.el("alertsGate").hidden = false;
      G.el("alertsGate").textContent = "Sign in with Discord and subscribe to Graardor Pro to use price alerts.";
      return;
    }
    G.el("alertsGate").hidden = true;
    G.el("alertsContent").hidden = false;
    const data = await res.json();
    renderAlerts(data.alerts || []);
  }

  function renderAlerts(alerts) {
    const body = G.el("alertsBody");
    if (!alerts.length) {
      body.innerHTML = '<tr><td colspan="5" class="loading">No alerts yet.</td></tr>';
      return;
    }
    body.innerHTML = alerts
      .map(
        (a) => `<tr>
        <td>${G.escapeHtml(a.item_name)}</td>
        <td class="num">${a.direction} ${G.formatPrice(a.target_price)}</td>
        <td class="num">${a.active ? "Active" : "Off"}</td>
        <td class="num">${a.last_triggered ? new Date(a.last_triggered).toLocaleString() : "—"}</td>
        <td><button type="button" class="link-btn" data-del="${a.id}">Delete</button></td>
      </tr>`
      )
      .join("");
  }

  async function bindForm() {
    G.el("alertForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await G.loadPrices();
      const q = G.el("alertItemSearch").value.trim().toLowerCase();
      const item = G.cachedApiData.mapping.find((m) => m.name.toLowerCase().includes(q));
      if (!item) {
        G.showToast("Item not found");
        return;
      }
      const res = await fetch("/api/alerts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          itemName: item.name,
          direction: G.el("alertDirection").value,
          targetPrice: Number(G.el("alertPrice").value),
          webhookUrl: G.el("alertWebhook").value.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        G.showToast(err.error || "Failed");
        return;
      }
      e.target.reset();
      G.showToast("Alert created");
      loadAlerts();
    });

    G.el("alertsBody")?.addEventListener("click", async (ev) => {
      const btn = ev.target.closest("[data-del]");
      if (!btn) return;
      await fetch(`/api/alerts?id=${btn.dataset.del}`, { method: "DELETE", credentials: "same-origin" });
      loadAlerts();
    });
  }

  async function init() {
    bindForm();
    loadAlerts();
  }

  init();
})(window.Graardor);
