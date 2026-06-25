(function (G) {
  let bosses = [];

  function findMappingByName(name) {
    if (!G.cachedApiData) return null;
    const lower = name.toLowerCase();
    return (
      G.cachedApiData.mapping.find((m) => m.name.toLowerCase() === lower) ||
      G.cachedApiData.mapping.find((m) => m.name.toLowerCase().includes(lower))
    );
  }

  function priceForName(name) {
    const m = findMappingByName(name);
    if (!m) return { buy: 0, sell: 0, id: null };
    const l = G.cachedApiData.latest[m.id];
    return { buy: l?.low ?? 0, sell: l?.high ?? 0, id: m.id, name: m.name };
  }

  function calcBoss(boss) {
    let supplyCost = 0;
    const rows = boss.supplies.map((s) => {
      const p = priceForName(s.name);
      const cost = (p.buy || 0) * s.qty;
      supplyCost += cost;
      return { ...s, ...p, cost };
    });
    const lootPerHour = boss.lootPerKill * boss.killsPerHour;
    const supplyPerHour = supplyCost * boss.killsPerHour;
    const gpPerHour = lootPerHour - supplyPerHour;
    return { ...boss, rows, supplyCost, lootPerHour, supplyPerHour, gpPerHour };
  }

  function renderList() {
    const sel = G.el("bossSelect");
    if (!sel) return;
    sel.innerHTML = bosses.map((b) => `<option value="${b.id}">${G.escapeHtml(b.name)}</option>`).join("");
    renderBoss();
  }

  function renderBoss() {
    const id = G.el("bossSelect")?.value;
    const boss = bosses.find((b) => b.id === id);
    const root = G.el("bossResults");
    if (!boss || !root) return;

    const calc = calcBoss(boss);
    const gpCls = calc.gpPerHour >= 0 ? "positive" : "negative";

    root.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><span class="label">Kills / hr</span><span class="value">${calc.killsPerHour}</span></div>
        <div class="stat-card"><span class="label">Loot / hr</span><span class="value highlight-gp">${G.formatGp(calc.lootPerHour)}</span></div>
        <div class="stat-card"><span class="label">Supplies / hr</span><span class="value">${G.formatGp(calc.supplyPerHour)}</span></div>
        <div class="stat-card"><span class="label">GP / hr</span><span class="value ${gpCls}">${G.formatGp(calc.gpPerHour)}</span></div>
      </div>
      <p class="results-meta">${G.escapeHtml(calc.notes || "")}</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Supply</th><th class="num">Qty</th><th class="num">Buy ea.</th><th class="num">Cost</th></tr></thead>
          <tbody>
            ${calc.rows
              .map(
                (r) => `<tr>
              <td>${G.escapeHtml(r.name)}</td>
              <td class="num">${r.qty}</td>
              <td class="num price-buy">${G.formatPrice(r.buy)}</td>
              <td class="num">${G.formatGp(r.cost)}</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;

    if (typeof renderSummaryStrip === "function") {
      renderSummaryStrip("bossSummary", [
        {
          label: "GP / hr",
          value: G.formatGp(calc.gpPerHour),
          className: gpCls === "positive" ? "highlight-gp" : "",
        },
        { label: "Loot / hr", value: G.formatGp(calc.lootPerHour), className: "highlight-gp" },
        { label: "Supply / hr", value: G.formatGp(calc.supplyPerHour) },
        { label: "Kills / hr", value: String(calc.killsPerHour) },
      ]);
    }
  }

  async function init() {
    G.bindPriceCopy();
    const res = await fetch("/data/bosses.json");
    bosses = (await res.json()).bosses;
    G.el("bossSelect")?.addEventListener("change", renderBoss);
    G.updateStatus("bossStatus", "Loading prices…", "");
    try {
      await G.loadPrices();
      G.updateStatus("bossStatus", "Live supply costs loaded", "ok");
      renderList();
    } catch (err) {
      G.updateStatus("bossStatus", err.message, "error");
    }
  }

  init();
})(window.Graardor);
