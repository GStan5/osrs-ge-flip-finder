(function (G) {
  async function loadHomeStats() {
    const root = document.getElementById("homeLiveStats");
    if (!root) return;

    root.classList.add("is-loading");

    try {
      await G.loadPrices();
      const { mapping, latest } = G.cachedApiData;
      let best = null;
      let bestProfit = -Infinity;
      let totalVolume = 0;

      for (const m of mapping) {
        const l = latest[m.id];
        if (!l) continue;
        if (l.low != null && l.high != null && l.low > 0) {
          const tax = G.calcGeTax(l.high, m.id);
          const profit = l.high - l.low - tax;
          if (profit > bestProfit && profit > 0) {
            bestProfit = profit;
            best = m;
          }
        }
        totalVolume += (l.highPriceVolume || 0) + (l.lowPriceVolume || 0);
      }

      const refreshed = G.pricesLoadedAt
        ? G.pricesLoadedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : "—";

      const bestVal = best
        ? `<img src="${G.iconUrl(best.icon)}" alt="" width="22" height="22" onerror="this.style.display='none'" />${G.formatGp(bestProfit)}`
        : "—";
      const bestLbl = best
        ? best.name.length > 20
          ? best.name.slice(0, 20) + "…"
          : best.name
        : "Best margin";

      root.innerHTML = `
        <div class="stat-card">
          <span class="val">${mapping.length.toLocaleString()}</span>
          <span class="lbl">Items tracked</span>
        </div>
        <div class="stat-card">
          <span class="val">${refreshed}</span>
          <span class="lbl">Last sample</span>
        </div>
        <div class="stat-card">
          <span class="val green">${bestVal}</span>
          <span class="lbl">${bestLbl}</span>
        </div>
        <div class="stat-card">
          <span class="val">${totalVolume > 0 ? G.formatGp(totalVolume) : "—"}</span>
          <span class="lbl">5m volume</span>
        </div>`;
      root.classList.remove("is-loading");
    } catch {
      root.classList.remove("is-loading");
      root.innerHTML = `<div class="stat-card"><span class="val">—</span><span class="lbl">Prices unavailable</span></div>`;
    }
  }

  if (document.getElementById("homeLiveStats")) {
    loadHomeStats();
  }
})(window.Graardor);
