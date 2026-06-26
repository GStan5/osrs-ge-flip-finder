(function (G) {
  let catalog = null;
  let rows = [];
  let sort = { key: "profit", dir: "desc" };

  const ENCHANT_PRESETS = {
    bestProfit: { sortKey: "profit" },
    highMargin: { minMargin: 5, sortKey: "margin" },
    dragonstone: { gem: "dragonstone", sortKey: "profit" },
    zenyte: { gem: "zenyte", sortKey: "profit" },
  };

  function calcRuneCost(runes) {
    let total = 0;
    let missing = false;
    for (const rune of runes) {
      const price = G.getItemPrice(rune.id);
      if (price?.buy == null || price.buy <= 0) {
        missing = true;
        continue;
      }
      total += price.buy * rune.qty;
    }
    return { total, missing };
  }

  function buildRows() {
    if (!catalog?.items) return [];

    return catalog.items.map((entry) => {
      const input = G.cachedApiData ? G.getItemPrice(entry.inputId) : null;
      const output = G.cachedApiData ? G.getItemPrice(entry.outputId) : null;
      const buyCost = input?.buy != null && input.buy > 0 ? input.buy : null;
      const sellRaw = output?.sell != null && output.sell > 0 ? output.sell : null;
      const tax = sellRaw != null ? G.calcGeTax(sellRaw, entry.outputId) : null;
      const sellAfterTax = sellRaw != null ? sellRaw - tax : null;
      const { total: runeCost, missing: runeMissing } = calcRuneCost(entry.runes);
      const totalCost = buyCost != null ? buyCost + runeCost : null;
      const profit = sellAfterTax != null && totalCost != null ? sellAfterTax - totalCost : null;
      const margin = profit != null && totalCost != null && totalCost > 0 ? (profit / totalCost) * 100 : null;
      const priceMissing = buyCost == null || sellRaw == null;

      return {
        id: entry.id,
        inputId: entry.inputId,
        outputId: entry.outputId,
        inputName: entry.inputName,
        outputName: entry.outputName,
        inputIcon: entry.inputIcon,
        outputIcon: entry.outputIcon,
        name: entry.inputName,
        gem: entry.gem,
        type: entry.type,
        spellName: entry.spellName,
        magicLevel: entry.magicLevel,
        runes: entry.runes,
        runeCost,
        runeMissing,
        buyCost,
        sellRaw,
        sellAfterTax,
        tax,
        profit,
        margin,
        priceMissing,
        members: entry.members,
        limit: input?.limit ?? 0,
        limitProfit: profit != null ? profit * (input?.limit > 0 ? input.limit : 1) : null,
        searchText: `${entry.inputName} ${entry.outputName} ${entry.spellName} ${entry.gem} ${entry.type}`.toLowerCase(),
      };
    });
  }

  function passesFilters(row) {
    if (G.el("enchantProfitableOnly")?.checked && row.profit != null && row.profit <= 0) return false;

    const minProfit = G.parseFilterNum("enchantMinProfit");
    if (minProfit != null && (row.profit == null || row.profit < minProfit)) return false;

    const minMargin = G.parseFilterNum("enchantMinMargin");
    if (minMargin != null && (row.margin == null || row.margin < minMargin)) return false;

    const maxBuy = G.parseFilterNum("enchantMaxBuy");
    if (maxBuy != null && row.buyCost > maxBuy) return false;

    const gem = G.el("enchantGem")?.value || "all";
    if (gem !== "all" && row.gem !== gem) return false;

    const type = G.el("enchantType")?.value || "all";
    if (type !== "all" && row.type !== type) return false;

    const q = (G.el("enchantSearch")?.value || "").trim().toLowerCase();
    if (q && !row.searchText.includes(q)) return false;
    return true;
  }

  function sortRows(list) {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === "name") return a.inputName.localeCompare(b.inputName) * dir;
      if (sort.key === "spellName") return a.spellName.localeCompare(b.spellName) * dir;
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      if (av == null && bv == null) return a.inputName.localeCompare(b.inputName);
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }

  function enchantPairCell(row) {
    const tip = G.itemTitleAttr(`${row.inputName} → ${row.outputName}`);
    const badge = row.members
      ? '<span class="badge badge-members">P2P</span>'
      : '<span class="badge badge-f2p">F2P</span>';
    return G.itemListCell(
      `<div class="item-cell enchant-pair"${tip}>
        <span class="enchant-pair-icons">
          <img src="${G.iconUrl(row.inputIcon)}" alt="" width="28" height="28" loading="lazy" onerror="this.style.visibility='hidden'" />
          <span class="enchant-arrow" aria-hidden="true">→</span>
          <img src="${G.iconUrl(row.outputIcon)}" alt="" width="28" height="28" loading="lazy" onerror="this.style.visibility='hidden'" />
        </span>
        <span class="enchant-pair-text">
          <a class="item-name" href="${G.itemPageUrl(row.inputId)}"${tip}>${G.escapeHtml(row.inputName)}</a>
          <span class="enchant-pair-out">→ <a href="${G.itemPageUrl(row.outputId)}"${G.itemTitleAttr(row.outputName)}>${G.escapeHtml(row.outputName)}</a></span>
          ${badge}
        </span>
      </div>`,
      "gra-item-list__cell--name"
    );
  }

  function runeCostLabel(row) {
    if (row.runeMissing) return `${G.formatPrice(row.runeCost)}*`;
    return G.formatPrice(row.runeCost);
  }

  function enchantRowHtml(row) {
    const profitCls =
      row.profit == null ? "" : row.profit >= 0 ? "positive" : "negative";
    const runeTitle = row.runes.map((r) => `${r.qty}× ${r.name}`).join(", ");
    return G.itemListRow(
      enchantPairCell(row) +
        G.itemListCell(G.escapeHtml(row.spellName), "col-hide-xs spell-col", { "data-label": "Spell", title: row.spellName }) +
        G.itemListNumCell(String(row.magicLevel), "num col-hide-narrow", "Magic") +
        G.itemListNumCell(runeCostLabel(row), "num", "Rune cost", { title: runeTitle + (row.runeMissing ? " · some rune prices missing" : "") }) +
        G.itemListNumCell(row.buyCost != null ? G.formatPrice(row.buyCost) : "—", "num price-buy price-col-buy price-copyable", "Buy cost", {
          ...(row.buyCost != null ? { "data-copy-price": Math.round(row.buyCost), title: "Click to copy buy price" } : { title: "Buy price unavailable" }),
        }) +
        G.itemListNumCell(row.sellAfterTax != null ? G.formatPrice(row.sellAfterTax) : "—", "num col-hide-xs", "Sell (after tax)", {
          title:
            row.sellRaw != null
              ? `Inst. sell ${G.formatPrice(row.sellRaw)} − ${G.formatPrice(row.tax)} tax`
              : "Sell price unavailable",
        }) +
        G.itemListNumCell(row.profit != null ? G.formatGp(row.profit) : "—", `num ${profitCls}`, "Profit") +
        G.itemListNumCell(row.margin != null ? row.margin.toFixed(1) + "%" : "—", `num col-hide-xs ${profitCls}`, "Margin")
    );
  }

  function setActivePreset(presetId) {
    G.ui.setActivePreset("data-enchant-preset", presetId);
  }

  function setEnchantFilters(values = {}) {
    if (G.el("enchantSearch")) G.el("enchantSearch").value = values.search ?? "";
    if (G.el("enchantGem")) G.el("enchantGem").value = values.gem ?? "all";
    if (G.el("enchantType")) G.el("enchantType").value = values.type ?? "all";
    if (G.el("enchantMinProfit")) G.el("enchantMinProfit").value = values.minProfit ?? "";
    if (G.el("enchantMinMargin")) G.el("enchantMinMargin").value = values.minMargin ?? "";
    if (G.el("enchantMaxBuy")) G.el("enchantMaxBuy").value = values.maxBuy ?? "";
    if (G.el("enchantProfitableOnly")) G.el("enchantProfitableOnly").checked = values.profitableOnly ?? true;
    if (values.sortKey) sort = { key: values.sortKey, dir: "desc" };
  }

  function applyPreset(presetId) {
    const preset = ENCHANT_PRESETS[presetId];
    if (!preset) return;
    setEnchantFilters(preset);
    setActivePreset(presetId);
    render();
  }

  function render() {
    rows = buildRows();
    const filtered = sortRows(rows.filter(passesFilters));
    const pricedCount = rows.filter((r) => !r.priceMissing).length;
    const missingPrices = rows.length > 0 && pricedCount === 0;

    G.el("enchantMeta").textContent = filtered.length
      ? `${filtered.length.toLocaleString()} of ${catalog?.itemCount ?? rows.length} enchantable items · profit = sell after GE tax − buy − runes${missingPrices ? " · some prices missing — refresh or turn off Profitable only" : ""}`
      : rows.length
        ? "No items match your filters."
        : catalog?.items?.length
          ? "Catalog loaded — waiting for GE prices."
          : "No enchant data available.";

    if (!filtered.length) {
      G.renderItemList("enchantBody", {
        message: rows.length
          ? "No matches — try loosening filters or turn off Profitable only."
          : catalog?.items?.length
            ? "Prices not loaded yet — click Refresh prices or wait a moment."
            : "Couldn't load enchant catalog — try refreshing the page.",
        loading: !rows.length,
        listId: "enchantList",
        sortKey: sort.key,
        sortDir: sort.dir,
      });
      G.el("enchantSummary")?.setAttribute("hidden", "");
      return;
    }

    G.renderItemList("enchantBody", {
      rowsHtml: filtered.map(enchantRowHtml).join(""),
      listId: "enchantList",
      sortKey: sort.key,
      sortDir: sort.dir,
    });

    const best = filtered.find((r) => r.profit != null) ?? filtered[0];
    if (typeof renderSummaryStrip === "function" && best) {
      G.el("enchantSummary")?.removeAttribute("hidden");
      renderSummaryStrip("enchantSummary", [
        {
          label: "Best profit",
          value: best.profit != null ? G.formatGp(best.profit) : "—",
          className: best.profit != null && best.profit >= 0 ? "highlight-gp" : "",
          hint: best.outputName,
          link: G.itemPageUrl(best.outputId),
        },
        { label: "Profitable", value: filtered.filter((r) => r.profit != null && r.profit > 0).length.toLocaleString() },
        { label: "Rune cost", value: runeCostLabel(best) + " gp", hint: best.spellName },
        { label: "Showing", value: filtered.length.toLocaleString() },
      ]);
    }
  }

  function bindSort() {
    G.bindItemListSort("enchantList", (key) => {
      if (sort.key === key) sort.dir = sort.dir === "desc" ? "asc" : "desc";
      else {
        sort.key = key;
        sort.dir = "desc";
      }
      render();
    });
  }

  function bindFilters() {
    ["enchantGem", "enchantType", "enchantProfitableOnly"].forEach((id) => {
      G.el(id)?.addEventListener("change", () => {
        setActivePreset(null);
        render();
      });
    });
    ["enchantSearch", "enchantMinProfit", "enchantMinMargin", "enchantMaxBuy"].forEach((id) => {
      G.el(id)?.addEventListener("input", () => {
        setActivePreset(null);
        clearTimeout(bindFilters._timer);
        bindFilters._timer = setTimeout(render, 150);
      });
    });
    G.ui.bindPresetChips({ dataAttr: "data-enchant-preset", onSelect: applyPreset });
  }

  async function loadCatalog() {
    const res = await fetch("/data/enchant-jewelry.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    catalog = await res.json();
  }

  async function init() {
    G.bindPriceCopy();
    bindSort();
    bindFilters();
    G.el("refreshEnchantBtn")?.addEventListener("click", () => load(true));
    G.el("resetEnchantBtn")?.addEventListener("click", () => {
      setEnchantFilters({});
      sort = { key: "profit", dir: "desc" };
      setActivePreset(null);
      render();
    });
    await load();
  }

  async function load(forceRefresh = false) {
    const hasCache = Boolean(G.cachedApiData);
    if (!hasCache || forceRefresh) {
      G.updateStatus("enchantStatus", forceRefresh ? "Refreshing price data…" : "Loading price data…", "");
      G.applyItemListSkeleton("enchantBody", 8, 8);
    }
    try {
      if (!catalog) await loadCatalog();
      await G.loadPrices({ useCache: true, force: forceRefresh });
      G.updateStatus(
        "enchantStatus",
        `Loaded ${catalog.itemCount} enchantable items · refresh when you want new prices`,
        "ok"
      );
      render();
    } catch (err) {
      G.updateStatus("enchantStatus", `Failed: ${err.message}`, "error");
      G.renderItemList("enchantBody", { message: G.escapeHtml(err.message), loading: true });
    }
  }

  G.onToolListRefresh(() => {
    if (G.cachedApiData && catalog) render();
  });

  G.whenToolLayoutReady(() => init());
})(window.Graardor);
