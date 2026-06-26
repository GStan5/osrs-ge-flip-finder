(function (G) {
  let rows = [];

  function parseCsv(text) {
    return text
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split(",").map((c) => c.trim()))
      .filter((cols) => cols.length >= 2 && cols[0]);
  }

  function findPrice(name) {
    const lower = name.toLowerCase();
    const m = G.cachedApiData?.mapping.find((x) => x.name.toLowerCase() === lower);
    if (!m) return null;
    return G.cachedApiData.latest[m.id]?.high ?? null;
  }

  function render() {
    let total = 0;
    const body = G.el("lootBody");
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="4" class="loading">Paste CSV: Item name, Quantity</td></tr>';
      return;
    }
    body.innerHTML = rows
      .map((r) => {
        const price = findPrice(r.name);
        const value = price != null ? price * r.qty : null;
        if (value) total += value;
        return `<tr>
          <td>${G.escapeHtml(r.name)}</td>
          <td class="num">${r.qty.toLocaleString()}</td>
          <td class="num">${price == null ? "—" : G.formatPrice(price)}</td>
          <td class="num">${value == null ? "—" : G.formatGp(value)}</td>
        </tr>`;
      })
      .join("");
    G.el("lootTotal").textContent = G.formatGp(total) + " gp";
  }

  function bind() {
    G.el("lootParseBtn")?.addEventListener("click", async () => {
      const text = G.el("lootCsv").value;
      const parsed = parseCsv(text);
      rows = parsed.slice(1).map((cols) => ({ name: cols[0], qty: Number(cols[1]) || 0 }));
      if (parsed.length && parsed[0][0].toLowerCase().includes("item")) {
        /* header skipped above */
      } else if (parsed.length) {
        rows = parsed.map((cols) => ({ name: cols[0], qty: Number(cols[1]) || 0 }));
      }
      if (!G.cachedApiData) await G.loadPrices();
      render();
    });
  }

  async function init() {
    G.updateStatus("lootStatus", "Refresh prices first.", "");
    bind();
  }

  init();
})(window.Graardor);
