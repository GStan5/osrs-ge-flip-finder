(function (G) {
  async function loadHomeStats() {
    const root = document.getElementById("homeLiveStats");
    if (!root) return;

    try {
      await G.loadPrices();
      const { mapping, latest } = G.cachedApiData;
      let best = null;
      let bestProfit = -Infinity;

      for (const m of mapping) {
        const l = latest[m.id];
        if (!l || l.low == null || l.high == null || l.low <= 0) continue;
        const tax = G.calcGeTax(l.high, m.id);
        const profit = l.high - l.low - tax;
        if (profit > bestProfit && profit > 0) {
          bestProfit = profit;
          best = m;
        }
      }

      const refreshed = G.pricesLoadedAt
        ? G.pricesLoadedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : "—";

      root.innerHTML = `
        <div class="home-live-stat">
          <span class="num">${mapping.length.toLocaleString()}</span>
          <span class="lbl">Items tracked</span>
        </div>
        <div class="home-live-stat">
          <span class="num">${refreshed}</span>
          <span class="lbl">Sample refresh</span>
        </div>
        <div class="home-live-stat">
          <span class="num">${best ? G.formatGp(bestProfit) : "—"}</span>
          <span class="lbl">${best ? best.name.slice(0, 18) + (best.name.length > 18 ? "…" : "") : "Top margin"}</span>
        </div>
        <div class="home-live-stat">
          <span class="num">15+</span>
          <span class="lbl">Tools live</span>
        </div>`;
    } catch {
      root.innerHTML = `<div class="home-live-stat"><span class="num">—</span><span class="lbl">Live stats unavailable</span></div>`;
    }
  }

  if (document.getElementById("homeLiveStats")) {
    loadHomeStats();
  }
})(window.Graardor);
