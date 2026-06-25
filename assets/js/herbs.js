(function (G) {
  let config = { herbs: [], runs: [] };

  function findMappingByName(name) {
    const lower = name.toLowerCase();
    return G.cachedApiData?.mapping.find((m) => m.name.toLowerCase() === lower);
  }

  function calcRun(herbId, runId) {
    const herb = config.herbs.find((h) => h.id === herbId);
    const run = config.runs.find((r) => r.id === runId);
    if (!herb || !run) return null;

    const seed = findMappingByName(herb.seed);
    const crop = findMappingByName(herb.name);
    const compost = findMappingByName("Ultracompost");
    const seedPrice = seed ? G.cachedApiData.latest[seed.id]?.low ?? 0 : 0;
    const cropPrice = crop ? G.cachedApiData.latest[crop.id]?.high ?? 0 : 0;
    const compostPrice = compost ? G.cachedApiData.latest[compost.id]?.low ?? 0 : 0;

    const yieldHerbs = herb.avgYield * run.patches * 1.1;
    const seedCost = seedPrice * run.patches;
    const compostCost = compostPrice * run.patches;
    const gross = yieldHerbs * cropPrice;
    const profit = gross - seedCost - compostCost;
    const runsPerHour = 60 / 12;
    const gpPerHour = profit * runsPerHour;

    return { herb, run, seedCost, compostCost, gross, profit, gpPerHour, yieldHerbs, cropPrice, seedPrice };
  }

  function render() {
    const herbId = G.el("herbSelect")?.value;
    const runId = G.el("runSelect")?.value;
    const calc = calcRun(herbId, runId);
    const root = G.el("herbResults");
    if (!calc || !root) return;

    const cls = calc.profit >= 0 ? "positive" : "negative";
    root.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><span class="label">Patches</span><span class="value">${calc.run.patches}</span></div>
        <div class="stat-card"><span class="label">Est. yield</span><span class="value">${Math.round(calc.yieldHerbs)} herbs</span></div>
        <div class="stat-card"><span class="label">Profit / run</span><span class="value ${cls}">${G.formatGp(calc.profit)}</span></div>
        <div class="stat-card"><span class="label">GP / hr</span><span class="value ${cls}">${G.formatGp(calc.gpPerHour)}</span></div>
      </div>
      <p class="results-meta">${G.escapeHtml(calc.run.notes || "")} Magic secateurs (+10%) included.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th class="num">Cost</th></tr></thead>
          <tbody>
            <tr><td>${G.escapeHtml(calc.herb.seed)} × ${calc.run.patches}</td><td class="num">${G.formatGp(calc.seedCost)}</td></tr>
            <tr><td>Ultracompost × ${calc.run.patches}</td><td class="num">${G.formatGp(calc.compostCost)}</td></tr>
            <tr><td><strong>Gross herb sales</strong></td><td class="num highlight-gp">${G.formatGp(calc.gross)}</td></tr>
          </tbody>
        </table>
      </div>`;

    if (typeof renderSummaryStrip === "function") {
      renderSummaryStrip("herbSummary", [
        {
          label: "Profit / run",
          value: G.formatGp(calc.profit),
          className: cls,
        },
        { label: "GP / hr", value: G.formatGp(calc.gpPerHour), className: cls },
        { label: "Est. yield", value: Math.round(calc.yieldHerbs) + " herbs" },
        { label: "Patches", value: String(calc.run.patches) },
      ]);
    }
  }

  async function init() {
    const res = await fetch("/data/herb-runs.json");
    config = await res.json();
    G.el("herbSelect").innerHTML = config.herbs
      .map((h) => `<option value="${h.id}">${G.escapeHtml(h.name)}</option>`)
      .join("");
    G.el("runSelect").innerHTML = config.runs
      .map((r) => `<option value="${r.id}">${G.escapeHtml(r.name)}</option>`)
      .join("");
    G.el("herbSelect").addEventListener("change", render);
    G.el("runSelect").addEventListener("change", render);
    G.updateStatus("herbStatus", "Loading prices…", "");
    try {
      await G.loadPrices();
      G.updateStatus("herbStatus", "Live seed and herb prices loaded", "ok");
      render();
    } catch (err) {
      G.updateStatus("herbStatus", err.message, "error");
    }
  }

  init();
})(window.Graardor);
