(function (G) {
  async function loadHomeStats() {
    const root = document.getElementById("homeLiveStats");
    if (!root) return;

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

      const bestHtml = best
        ? `<span class="val highlight"><img src="${G.iconUrl(best.icon)}" alt="" width="24" height="24" onerror="this.style.display='none'" />${G.formatGp(bestProfit)}</span><span class="lbl">${best.name.length > 22 ? best.name.slice(0, 22) + "…" : best.name}</span>`
        : `<span class="val">—</span><span class="lbl">Best margin</span>`;

      root.innerHTML = `
        <div class="hub-ticker-card">
          <span class="val">${mapping.length.toLocaleString()}</span>
          <span class="lbl">Items on GE</span>
        </div>
        <div class="hub-ticker-card">
          <span class="val">${refreshed}</span>
          <span class="lbl">Wiki sample time</span>
        </div>
        <div class="hub-ticker-card highlight">${bestHtml}</div>
        <div class="hub-ticker-card">
          <span class="val">${totalVolume > 0 ? G.formatGp(totalVolume) : "—"}</span>
          <span class="lbl">5m volume (sample)</span>
        </div>`;
    } catch {
      root.innerHTML = `<div class="hub-ticker-card"><span class="val">—</span><span class="lbl">GE data unavailable</span></div>`;
    }
  }

  if (document.getElementById("homeLiveStats")) {
    loadHomeStats();
  }
})(window.Graardor);
