/**
 * GE transform / recipe profit calculator — decants, sets, uncharges, skilling.
 * Used by /tools/flips (Transforms tab) and /tools/recipes.
 */
(function (G) {
  let transformCatalog = null;
  let transformRows = [];
  let transformsSort = { key: "gpPerHour", dir: "desc" };
  let includeSkillRecipes = true;
  let hooks = {};

  const XF_PRESETS = {
    highGpHour: { minGpHour: 100000, profitableOnly: true, sortKey: "gpPerHour" },
    fastCycle: { maxCycleMin: 30, profitableOnly: true, sortKey: "gpPerHour" },
    highMargin: { minMargin: 5, profitableOnly: true, sortKey: "marginPct" },
    budget1m: { maxBudget: 1_000_000, profitableOnly: true, sortKey: "gpPerHour" },
    budget10m: { maxBudget: 10_000_000, profitableOnly: true, sortKey: "gpPerHour" },
    budget50m: { maxBudget: 50_000_000, profitableOnly: true, sortKey: "gpPerHour" },
    budget100m: { maxBudget: 100_000_000, profitableOnly: true, sortKey: "gpPerHour" },
    budget250m: { maxBudget: 250_000_000, profitableOnly: true, sortKey: "gpPerHour" },
    budget500m: { maxBudget: 500_000_000, profitableOnly: true, sortKey: "gpPerHour" },
    decantsOnly: { type: "decant", profitableOnly: true, sortKey: "gpPerHour" },
    setsOnly: { type: "sets", profitableOnly: true, sortKey: "profit" },
    f2p: { membersFilter: "f2p", profitableOnly: true, sortKey: "gpPerHour" },
    members: { membersFilter: "members", profitableOnly: true, sortKey: "gpPerHour" },
  };

  function el(id) {
    return G.el(id);
  }

  function parseNum(id) {
    return G.parseFilterNum(id);
  }

  function getInputValue(id) {
    const input = el(id);
    return input ? input.value : "";
  }

  function isChecked(id) {
    const input = el(id);
    return input ? input.checked : false;
  }

  function mappingById() {
    if (!G.cachedApiData) return new Map();
    return new Map(G.cachedApiData.mapping.map((m) => [m.id, m]));
  }

  function getTransformPrices(itemId) {
    if (!G.cachedApiData) return null;
    const mapping = mappingById().get(itemId);
    const latest = G.cachedApiData.latest[itemId];
    if (!mapping || !latest) return null;

    const hourly = G.cachedApiData.hourly[itemId];
    const fiveMin = G.cachedApiData.fiveMin[itemId];
    const buyVolHour = hourly?.lowPriceVolume ?? 0;
    const sellVolHour = hourly?.highPriceVolume ?? 0;
    const buyVol5m = fiveMin?.lowPriceVolume ?? 0;
    const sellVol5m = fiveMin?.highPriceVolume ?? 0;
    const volume5m = buyVol5m + sellVol5m;
    const buyRateHour = G.effectiveHourlyRate(buyVol5m, buyVolHour);
    const sellRateHour = G.effectiveHourlyRate(sellVol5m, sellVolHour);
    const dailyVolume = (buyRateHour + sellRateHour) * 24;

    return {
      id: itemId,
      name: mapping.name,
      icon: mapping.icon,
      members: mapping.members,
      buy: latest.low,
      sell: latest.high,
      limit: mapping.limit ?? 0,
      volume5m,
      dailyVolume,
      buyRateHour,
      sellRateHour,
    };
  }

  function sellAfterTax(sellPrice, itemId, includeTax) {
    if (sellPrice == null || !Number.isFinite(sellPrice)) return null;
    if (!includeTax) return sellPrice;
    return sellPrice - G.calcGeTax(sellPrice, itemId);
  }

  function availableDoseInts(decant) {
    return Object.keys(decant.doses)
      .map(Number)
      .filter((d) => d >= 1 && d <= 4)
      .sort((a, b) => a - b);
  }

  function enumerateDoseParts(targetSum, doseSizes) {
    const results = [];
    function rec(remaining, idx, current) {
      if (remaining === 0) {
        if (current.length) results.push([...current]);
        return;
      }
      if (idx >= doseSizes.length) return;
      const dose = doseSizes[idx];
      for (let qty = 0; dose * qty <= remaining; qty++) {
        if (qty > 0) current.push({ dose, qty });
        rec(remaining - dose * qty, idx + 1, current);
        if (qty > 0) current.pop();
      }
    }
    rec(targetSum, 0, []);
    return results;
  }

  function isIdentityParts(parts, singleDose) {
    return parts.length === 1 && parts[0].dose === singleDose && parts[0].qty === 1;
  }

  function decantCombineRoutes(decant) {
    const doseSizes = availableDoseInts(decant);
    const routes = [];
    for (const outDose of doseSizes) {
      for (const parts of enumerateDoseParts(outDose, doseSizes)) {
        if (isIdentityParts(parts, outDose)) continue;
        routes.push({ parts, outDose, outQty: 1 });
      }
    }
    return routes;
  }

  function decantSplitRoutes(decant) {
    const doseSizes = availableDoseInts(decant);
    const routes = [];
    for (const inDose of doseSizes) {
      for (const parts of enumerateDoseParts(inDose, doseSizes)) {
        if (isIdentityParts(parts, inDose)) continue;
        routes.push({ inDose, inQty: 1, parts });
      }
    }
    return routes;
  }

  function describeDecantPartsFromInts(parts, doses) {
    return parts.map(({ dose, qty }) => `${qty}× ${doses[String(dose)].name}`).join(" + ");
  }

  function recipeItemRef(itemId, qty) {
    const p = getTransformPrices(itemId);
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      icon: p.icon,
      qty,
      members: p.members,
      limit: p.limit ?? 0,
      buy: p.buy,
      sell: p.sell,
      buyTimeHours: G.hoursToFillQty(qty, p.buyRateHour),
      sellTimeHours: G.hoursToFillQty(qty, p.sellRateHour),
      volume5m: p.volume5m,
      dailyVolume: p.dailyVolume,
      buyRateHour: p.buyRateHour,
      sellRateHour: p.sellRateHour,
    };
  }

  function recipeMembers(inputs, outputs) {
    return [...inputs, ...outputs].some((item) => item.members);
  }

  function buildRecipeRow({
    type,
    subtype,
    name,
    label,
    category,
    inputs,
    outputs,
    buyCost,
    sellValue,
    profit,
    searchText,
    members: membersOverride,
  }) {
    return {
      type,
      subtype,
      name,
      label,
      category,
      inputs,
      outputs,
      buyCost,
      sellValue,
      profit,
      marginPct: buyCost > 0 ? (profit / buyCost) * 100 : null,
      members: membersOverride ?? recipeMembers(inputs, outputs),
      searchText: searchText ?? name.toLowerCase(),
    };
  }

  function evalSkillRecipe(recipe, includeTax) {
    const inputs = [];
    let buyCost = 0;
    for (const c of recipe.inputs) {
      const ref = recipeItemRef(c.id, c.qty);
      const p = getTransformPrices(c.id);
      if (!ref || !p?.buy) return null;
      buyCost += p.buy * c.qty;
      inputs.push(ref);
    }

    const outputs = [];
    let sellValue = 0;
    for (const c of recipe.outputs) {
      const ref = recipeItemRef(c.id, c.qty);
      const p = getTransformPrices(c.id);
      const afterTax = p ? sellAfterTax(p.sell, c.id, includeTax) : null;
      if (!ref || afterTax == null || p?.sell == null) return null;
      sellValue += afterTax * c.qty;
      outputs.push(ref);
    }

    return buildRecipeRow({
      type: "skill",
      subtype: "craft",
      name: recipe.name,
      label: recipe.variant,
      category: recipe.skill,
      inputs,
      outputs,
      buyCost,
      sellValue,
      profit: sellValue - buyCost,
      members: recipe.members,
      searchText: `${recipe.name} ${recipe.variant ?? ""} ${recipe.skill} ${recipe.inputs.map((i) => i.name).join(" ")}`.toLowerCase(),
    });
  }

  function evalDecantCombine(decant, includeTax) {
    const { doses } = decant;
    let best = null;

    for (const route of decantCombineRoutes(decant)) {
      const out = getTransformPrices(doses[String(route.outDose)].id);
      const sellValue = out ? sellAfterTax(out.sell, out.id, includeTax) : null;
      if (sellValue == null || out?.sell == null) continue;

      const inputs = [];
      let buyCost = 0;
      let ok = true;
      for (const part of route.parts) {
        const ref = recipeItemRef(doses[String(part.dose)].id, part.qty);
        const p = getTransformPrices(doses[String(part.dose)].id);
        if (!ref || !p?.buy) {
          ok = false;
          break;
        }
        buyCost += p.buy * part.qty;
        inputs.push(ref);
      }
      if (!ok) continue;

      const outputs = [recipeItemRef(out.id, route.outQty)];
      const profit = sellValue - buyCost;
      const row = buildRecipeRow({
        type: "decant",
        subtype: "combine",
        name: decant.name,
        category: "Decant",
        inputs,
        outputs,
        buyCost,
        sellValue,
        profit,
        searchText: `${decant.name} ${describeDecantPartsFromInts(route.parts, doses)}`.toLowerCase(),
      });
      if (!best || profit > best.profit) best = row;
    }
    return best;
  }

  function evalDecantSplit(decant, includeTax) {
    const { doses } = decant;
    let best = null;

    for (const route of decantSplitRoutes(decant)) {
      const input = getTransformPrices(doses[String(route.inDose)].id);
      if (!input?.buy) continue;

      const outputs = [];
      let sellValue = 0;
      let ok = true;
      for (const part of route.parts) {
        const ref = recipeItemRef(doses[String(part.dose)].id, part.qty);
        const p = getTransformPrices(doses[String(part.dose)].id);
        const afterTax = p ? sellAfterTax(p.sell, p.id, includeTax) : null;
        if (!ref || afterTax == null || p?.sell == null) {
          ok = false;
          break;
        }
        sellValue += afterTax * part.qty;
        outputs.push(ref);
      }
      if (!ok) continue;

      const inputs = [recipeItemRef(input.id, route.inQty)];
      const profit = sellValue - input.buy;
      const row = buildRecipeRow({
        type: "decant",
        subtype: "split",
        name: decant.name,
        category: "Decant",
        inputs,
        outputs,
        buyCost: input.buy,
        sellValue,
        profit,
        searchText: `${decant.name} ${describeDecantPartsFromInts(route.parts, doses)}`.toLowerCase(),
      });
      if (!best || profit > best.profit) best = row;
    }
    return best;
  }

  function evalSetCombine(set, includeTax) {
    const inputs = [];
    let buyCost = 0;
    for (const c of set.components) {
      const ref = recipeItemRef(c.id, c.qty);
      const p = getTransformPrices(c.id);
      if (!ref || !p?.buy) return null;
      buyCost += p.buy * c.qty;
      inputs.push(ref);
    }
    const setP = getTransformPrices(set.set.id);
    const sellValue = setP ? sellAfterTax(setP.sell, setP.id, includeTax) : null;
    if (sellValue == null || setP?.sell == null) return null;
    const outputs = [recipeItemRef(set.set.id, 1)];
    return buildRecipeRow({
      type: "set_combine",
      subtype: "combine",
      name: set.name,
      category: "Item set",
      inputs,
      outputs,
      buyCost,
      sellValue,
      profit: sellValue - buyCost,
      searchText: `${set.name} ${set.components.map((c) => c.name).join(" ")}`.toLowerCase(),
    });
  }

  function evalSetSplit(set, includeTax) {
    const setP = getTransformPrices(set.set.id);
    if (!setP?.buy) return null;
    const outputs = [];
    let sellValue = 0;
    for (const c of set.components) {
      const ref = recipeItemRef(c.id, c.qty);
      const p = getTransformPrices(c.id);
      const afterTax = p ? sellAfterTax(p.sell, c.id, includeTax) : null;
      if (!ref || afterTax == null || p?.sell == null) return null;
      sellValue += afterTax * c.qty;
      outputs.push(ref);
    }
    const inputs = [recipeItemRef(set.set.id, 1)];
    return buildRecipeRow({
      type: "set_split",
      subtype: "split",
      name: set.name,
      category: "Item set",
      inputs,
      outputs,
      buyCost: setP.buy,
      sellValue,
      profit: sellValue - setP.buy,
      searchText: `${set.name} ${set.components.map((c) => c.name).join(" ")}`.toLowerCase(),
    });
  }

  function buildTransformRows() {
    if (!transformCatalog || !G.cachedApiData) return [];
    const rows = [];
    const includeTax = isChecked("xfIncludeTax");

    for (const decant of transformCatalog.decants ?? []) {
      const combine = evalDecantCombine(decant, includeTax);
      const split = evalDecantSplit(decant, includeTax);
      if (combine) rows.push(combine);
      if (split) rows.push(split);
    }

    for (const set of transformCatalog.sets ?? []) {
      const combine = evalSetCombine(set, includeTax);
      const split = evalSetSplit(set, includeTax);
      if (combine) rows.push(combine);
      if (split) rows.push(split);
    }

    for (const uncharge of transformCatalog.uncharges ?? []) {
      const charged = getTransformPrices(uncharge.charged.id);
      const unch = getTransformPrices(uncharge.uncharged.id);
      if (!charged?.buy || !unch?.sell) continue;
      const sellValue = sellAfterTax(unch.sell, unch.id, includeTax);
      if (sellValue == null) continue;
      const profit = sellValue - charged.buy;
      rows.push(
        buildRecipeRow({
          type: "uncharge",
          subtype: "uncharge",
          name: uncharge.name,
          category: "Uncharge",
          inputs: [recipeItemRef(uncharge.charged.id, 1)],
          outputs: [recipeItemRef(uncharge.uncharged.id, 1)],
          buyCost: charged.buy,
          sellValue,
          profit,
          searchText: uncharge.name.toLowerCase(),
        })
      );
    }

    if (includeSkillRecipes) {
      for (const recipe of transformCatalog.skills ?? []) {
        const row = evalSkillRecipe(recipe, includeTax);
        if (row) rows.push(row);
      }
    }

    return rows.map((row) => G.enrichTransformRecipeRow(row));
  }

  function recipeKindLabel(row) {
    if (row.type === "skill") return row.label || "Skilling";
    if (row.type === "decant") return row.subtype === "combine" ? "Decant up" : "Decant down";
    if (row.type === "set_combine") return "Combine set";
    if (row.type === "set_split") return "Split set";
    if (row.type === "uncharge") return "Uncharge";
    return row.type;
  }

  function itemTitleAttr(name) {
    return ` title="${G.escapeHtml(name)}"`;
  }

  function recipeItemChip(item, side) {
    const isBuy = side !== "sell";
    const price = isBuy ? item.buy : item.sell;
    const priceLabel = isBuy ? "Buy" : "Sell";
    const priceClass = isBuy ? "price-buy" : "price-sell";
    const time = isBuy ? item.buyTimeHours : item.sellTimeHours;
    const timeLabel = isBuy ? "buy" : "sell";
    const batchQty = item.batchQty ?? item.qty;
    const limitLine =
      isBuy && item.limit ? `<span class="recipe-limit">Limit: ${G.formatGp(item.limit)}</span>` : "";
    return `<div class="recipe-item recipe-item-detailed">
        <div class="recipe-item-head">
          <img src="${G.iconUrl(item.icon)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />
          <span class="recipe-qty">${item.qty}×</span>
          <a class="recipe-name" href="${G.wikiPageUrl(item.name)}" target="_blank" rel="noopener"${itemTitleAttr(item.name)}>${G.escapeHtml(item.name)}</a>
        </div>
        <div class="recipe-item-meta">
          <span class="${priceClass} price-copyable" data-copy-price="${Math.round(price)}" title="Click to copy ${priceLabel.toLowerCase()} price">${priceLabel}: ${G.formatPrice(price)}</span>
          ${limitLine}
          <span class="recipe-vol">5m ${G.formatGp(item.volume5m ?? 0)} · day ${G.formatGp(item.dailyVolume ?? 0)}</span>
          <span class="recipe-time">Est. ${timeLabel} (${G.formatGp(batchQty)}): ${G.formatDuration(time)}</span>
        </div>
      </div>`;
  }

  function recipeIoCell(items, side, label) {
    const sideLabel = label || (side === "buy" ? "Inputs" : "Outputs");
    return G.itemListCell(
      items.map((item) => recipeItemChip(item, side)).join(""),
      "recipe-io col-io col-hide-narrow",
      { "data-label": sideLabel }
    );
  }

  function recipeDisplayName(row) {
    if (row.type === "skill" && row.label) return `${row.name} (${row.label})`;
    return row.name;
  }

  function filterTransformRows(rows) {
    const search = getInputValue("xfSearch").trim().toLowerCase();
    const type = getInputValue("xfType");
    const skill = getInputValue("xfSkill");
    const membersFilter = getInputValue("xfMembersFilter");
    const minProfit = parseNum("xfMinProfit") ?? 0;
    const maxBudget = parseNum("xfMaxBudget");
    const minMargin = parseNum("xfMinMargin");
    const minGpHour = parseNum("xfMinGpHour");
    const maxCycleMin = parseNum("xfMaxCycleMin");
    const profitableOnly = isChecked("xfProfitableOnly");

    return rows.filter((row) => {
      if (type === "sets") {
        if (row.type !== "set_combine" && row.type !== "set_split") return false;
      } else if (type !== "all" && row.type !== type) return false;
      if (skill !== "all" && row.category !== skill) return false;
      if (membersFilter === "members" && !row.members) return false;
      if (membersFilter === "f2p" && row.members) return false;
      if (search) {
        const itemNames = [...row.inputs, ...row.outputs].map((i) => i.name.toLowerCase()).join(" ");
        if (!row.searchText.includes(search) && !row.name.toLowerCase().includes(search) && !itemNames.includes(search)) {
          return false;
        }
      }
      if (profitableOnly && row.profit <= 0) return false;
      if (row.profit < minProfit) return false;
      if (maxBudget != null && row.gpNeeded > maxBudget) return false;
      if (minMargin != null && (row.marginPct == null || row.marginPct < minMargin)) return false;
      if (minGpHour != null && (row.gpPerHour == null || row.gpPerHour < minGpHour)) return false;
      if (!G.withinMinuteRange(row.cycleHours, null, maxCycleMin)) return false;
      if (isChecked("favoritesOnly") && hooks.isRecipeFavorite && !hooks.isRecipeFavorite(row)) return false;
      return true;
    });
  }

  function sortItemList(list, key, dir) {
    const multiplier = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (key === "name") return multiplier * a.name.localeCompare(b.name);
      const av = key === "buy" ? a.buy : key === "sell" ? a.sell : a[key];
      const bv = key === "buy" ? b.buy : key === "sell" ? b.sell : b[key];
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * multiplier;
      if (av > bv) return 1 * multiplier;
      return a.name.localeCompare(b.name);
    });
  }

  function recipeItemTimingTooltip(item, side) {
    const rate = side === "buy" ? item.buyRateHour : item.sellRateHour;
    const batchQty = item.batchQty ?? item.qty;
    if (!rate || rate <= 0) return `No recent volume at rec. ${side} side`;
    const perMin = rate / 60;
    return `~${Math.round(rate).toLocaleString()} items/hour at rec. ${side} (65% 5m + 35% 1h) · ~${perMin >= 1 ? perMin.toFixed(1) : perMin.toFixed(2)}/min · ${G.formatGp(batchQty)} for limit batch`;
  }

  function recipeCycleTooltip(row) {
    if (row.cycleHours == null) return "Need buy and sell volume to estimate full limit cycle";
    const batchNote = row.batchCycles > 1 ? `${row.batchCycles.toLocaleString()}× recipe · ` : "";
    return `${batchNote}Est. buy + est. sell (${G.formatDuration(row.buyTimeHours)} + ${G.formatDuration(row.sellTimeHours)}) — slowest input buy + slowest output sell for full limit batch`;
  }

  function durationCell(hours, title, label) {
    const text = G.formatDuration(hours);
    return G.itemListNumCell(text, "num", label, title ? { title } : undefined);
  }

  function catalogMetaLine() {
    if (!transformCatalog) return "";
    if (includeSkillRecipes) {
      return `${transformCatalog.stats.decants ?? 0} decants · ${transformCatalog.stats.sets ?? 0} sets · ${transformCatalog.stats.skills ?? 0} skill recipes`;
    }
    return `${transformCatalog.stats.decants ?? 0} decants · ${transformCatalog.stats.sets ?? 0} sets · instant GE transforms only`;
  }

  function renderTransforms() {
    if (!el("transformsBody")) return;

    if (!transformCatalog) {
      G.renderItemList("transformsBody", { message: "Recipe catalog not loaded.", loading: true });
      return;
    }

    if (!G.cachedApiData) {
      G.renderItemList("transformsBody", { message: "Load prices with Refresh prices.", loading: true });
      const meta = el("transformsMeta");
      if (meta) meta.textContent = catalogMetaLine();
      return;
    }

    transformRows = buildTransformRows();
    const filtered = filterTransformRows(transformRows);
    const sorted = sortItemList(filtered, transformsSort.key, transformsSort.dir);
    G.updateItemListSort("transformsList", transformsSort.key, transformsSort.dir, "data-xf-sort");

    const label = includeSkillRecipes ? "recipes" : "transforms";
    el("transformsMeta").textContent = `Showing ${sorted.length.toLocaleString()} of ${transformRows.length.toLocaleString()} ${label} · catalog updated ${transformCatalog.generatedAt.slice(0, 10)} · click column headers to sort`;

    if (!sorted.length) {
      G.renderItemList("transformsBody", { message: "No recipes match your filters.", loading: true });
      if (el("recipeBestBanner")) el("recipeBestBanner").hidden = true;
      hooks.onRendered?.();
      return;
    }

    const best = sorted.find((row) => row.profit > 0);
    const banner = el("recipeBestBanner");
    if (banner) {
      if (best) {
        banner.hidden = false;
        const gpHr = best.gpPerHour != null ? ` · ${G.formatGp(best.gpPerHour)}/hr` : "";
        banner.innerHTML = `Best match: <strong>${G.escapeHtml(recipeDisplayName(best))}</strong> — ${G.formatGp(best.profit)} profit${best.marginPct != null ? ` (${best.marginPct.toFixed(1)}% ROI)` : ""}${gpHr}. Verify in-game before buying.`;
      } else {
        banner.hidden = true;
      }
    }

    const favBtn = hooks.favoriteStarButton;
    G.renderItemList("transformsBody", {
      rowsHtml: sorted
        .map((row) => {
          const marginClass = row.profit >= 0 ? "positive" : "negative";
          const gpHrClass = row.gpPerHour != null && row.gpPerHour >= 0 ? "positive" : "";
          const memberBadge = row.members
            ? '<span class="badge badge-members">P2P</span>'
            : '<span class="badge badge-f2p">F2P</span>';
          const favKey = hooks.recipeFavoriteKey ? hooks.recipeFavoriteKey(row) : "";
          const favHtml =
            favBtn && hooks.isRecipeFavorite
              ? favBtn(favKey, "recipe", hooks.isRecipeFavorite(row))
              : "";
          const recipeCell = G.itemListCell(
            `<div class="item-cell">
              ${favHtml}
              <span>
                <span class="recipe-title"${itemTitleAttr(recipeDisplayName(row))}>${G.escapeHtml(recipeDisplayName(row))}</span>
                <span class="recipe-kind">${G.escapeHtml(recipeKindLabel(row))}</span>
              </span>
            </div>`,
            "gra-item-list__cell--recipe"
          );
          return G.itemListRow(
            `${recipeCell}${recipeIoCell(row.inputs, "buy", "Inputs")}${recipeIoCell(row.outputs, "sell", "Outputs")}` +
              `${G.itemListNumCell(row.inputLimit == null ? "—" : G.formatGp(row.inputLimit), "num col-hide-xs", "Buy limit", row.limitingInputName ? { title: `Limiting input: ${row.limitingInputName}` } : undefined)}` +
              `${G.itemListNumCell(G.formatGp(row.gpNeeded), "num", "GP needed")}` +
              `${G.itemListNumCell(G.formatGp(row.sellValue), "num", "Revenue")}` +
              `${G.itemListNumCell(G.formatGp(row.profit), `num ${marginClass}`, "Profit (limit)")}` +
              `${G.itemListNumCell(row.marginPct == null ? "—" : `${row.marginPct.toFixed(2)}%`, `num col-hide-xs ${marginClass}`, "ROI")}` +
              `${G.itemListNumCell(row.gpPerHour == null ? "—" : G.formatGp(row.gpPerHour), `num ${gpHrClass} highlight-gp`, "GP / hr")}` +
              `${durationCell(row.buyTimeHours, row.inputs.length ? recipeItemTimingTooltip(row.inputs.reduce((a, b) => (a.buyTimeHours ?? 0) >= (b.buyTimeHours ?? 0) ? a : b), "buy") : null, "Est. buy")}` +
              `${durationCell(row.sellTimeHours, row.outputs.length ? recipeItemTimingTooltip(row.outputs.reduce((a, b) => (a.sellTimeHours ?? 0) >= (b.sellTimeHours ?? 0) ? a : b), "sell") : null, "Est. sell")}` +
              `${durationCell(row.cycleHours, recipeCycleTooltip(row), "Cycle")}` +
              `${G.itemListNumCell(row.minVolume5m == null ? "—" : G.formatGp(row.minVolume5m), "num col-hide-narrow", "5m vol.")}` +
              `${G.itemListNumCell(row.minDailyVolume == null ? "—" : G.formatGp(row.minDailyVolume), "num col-hide-narrow", "Daily vol.")}` +
              `${G.itemListCell(G.escapeHtml(row.category), "col-hide-narrow", { "data-label": "Category" })}` +
              `${G.itemListCell(memberBadge, "col-hide-narrow", { "data-label": "Members" })}`
          );
        })
        .join(""),
      listId: "transformsList",
      sortKey: transformsSort.key,
      sortDir: transformsSort.dir,
      sortAttr: "data-xf-sort",
    });
    hooks.onRendered?.();
  }

  async function loadTransformCatalog() {
    try {
      const res = await fetch("/data/recipes.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      transformCatalog = await res.json();
      populateSkillFilter();
    } catch (err) {
      transformCatalog = null;
      const body = el("transformsBody");
      if (body) {
        body.innerHTML = G.itemListEmpty(`Could not load recipe catalog: ${G.escapeHtml(err.message)}`, true);
      }
      const meta = el("transformsMeta");
      if (meta) meta.textContent = "Recipe catalog unavailable. Please try again later.";
    }
  }

  function populateSkillFilter() {
    const select = el("xfSkill");
    if (!select || !transformCatalog?.stats?.skills) return;
    const current = select.value;
    select.innerHTML =
      '<option value="all">All skills</option>' +
      transformCatalog.stats.skills
        .map((skill) => `<option value="${G.escapeHtml(skill)}">${G.escapeHtml(skill)}</option>`)
        .join("");
    if (current && [...select.options].some((o) => o.value === current)) {
      select.value = current;
    }
    const urlSkill = new URLSearchParams(location.search).get("xfSkill");
    if (urlSkill && [...select.options].some((o) => o.value === urlSkill)) {
      select.value = urlSkill;
    }
  }

  function setXfFilters(values = {}) {
    el("xfSearch").value = values.search ?? "";
    el("xfType").value = values.type ?? "all";
    el("xfSkill").value = values.skill ?? "all";
    el("xfMembersFilter").value = values.membersFilter ?? "all";
    el("xfMinProfit").value = values.minProfit ?? "";
    el("xfMaxBudget").value = values.maxBudget ?? "";
    el("xfMinMargin").value = values.minMargin ?? "";
    el("xfMinGpHour").value = values.minGpHour ?? "";
    el("xfMaxCycleMin").value = values.maxCycleMin ?? "";
    el("xfIncludeTax").checked = values.includeTax ?? true;
    el("xfProfitableOnly").checked = values.profitableOnly ?? true;
    if (values.sortKey) transformsSort = { key: values.sortKey, dir: "desc" };
  }

  function setActiveXfPreset(presetId) {
    G.ui.setActivePreset("data-xf-preset", presetId);
  }

  function applyXfPreset(presetId) {
    const preset = XF_PRESETS[presetId];
    if (!preset) return;
    hooks.switchTab?.("transforms");
    setXfFilters(preset);
    setActiveXfPreset(presetId);
    renderTransforms();
    hooks.syncUrl?.();
  }

  function applyDecantsPreset() {
    applyXfPreset("decantsOnly");
  }

  function resetTransformFilters() {
    setXfFilters({});
    transformsSort = { key: "gpPerHour", dir: "desc" };
    setActiveXfPreset(null);
    renderTransforms();
    hooks.syncUrl?.();
  }

  function handleTransformsHeaderSort(key) {
    const dir = key === transformsSort.key ? (transformsSort.dir === "desc" ? "asc" : "desc") : "desc";
    transformsSort = { key, dir };
    renderTransforms();
  }

  function applyUrlParams(params) {
    if (params.get("xfType")) el("xfType").value = params.get("xfType");
    if (params.get("xfSkill")) el("xfSkill").value = params.get("xfSkill");
    if (params.get("xfQ")) el("xfSearch").value = params.get("xfQ");
    if (params.get("xf") && XF_PRESETS[params.get("xf")]) {
      applyXfPreset(params.get("xf"));
    }
  }

  function getUrlParams(params) {
    const xfPreset = document.querySelector("[data-xf-preset].active")?.dataset.xfPreset;
    if (xfPreset) params.set("xf", xfPreset);
    if (getInputValue("xfType") !== "all") params.set("xfType", getInputValue("xfType"));
    if (getInputValue("xfSkill") !== "all") params.set("xfSkill", getInputValue("xfSkill"));
    const xfQ = getInputValue("xfSearch").trim();
    if (xfQ) params.set("xfQ", xfQ);
  }

  function bindFilters(panel) {
    if (!panel) return;
    panel.addEventListener("input", (e) => {
      if (e.target.closest(".filters")) {
        setActiveXfPreset(null);
        renderTransforms();
        hooks.syncUrl?.();
      }
    });
    panel.addEventListener("change", (e) => {
      if (e.target.closest(".filters")) {
        setActiveXfPreset(null);
        renderTransforms();
        hooks.syncUrl?.();
      }
    });
  }

  function bindPresets() {
    G.ui.bindPresetChips({ dataAttr: "data-xf-preset", onSelect: applyXfPreset });
    el("bestDecantsBtn")?.addEventListener("click", applyDecantsPreset);
    el("resetTransformsBtn")?.addEventListener("click", resetTransformFilters);
    el("refreshTransformsBtn")?.addEventListener("click", () => hooks.refreshPrices?.());
    G.bindItemListSort("transformsList", handleTransformsHeaderSort, "data-xf-sort");
  }

  G.Transforms = {
    init(options = {}) {
      includeSkillRecipes = options.includeSkillRecipes !== false;
      hooks = options;
      bindPresets();
      bindFilters(el("transformsPanel"));
    },
    loadCatalog: loadTransformCatalog,
    render: renderTransforms,
    buildRows: buildTransformRows,
    getRows: () => transformRows,
    getCatalog: () => transformCatalog,
    applyUrlParams,
    getUrlParams,
    applyPreset: applyXfPreset,
    resetFilters: resetTransformFilters,
    recipeDisplayName,
    recipeKindLabel,
    filterRows: filterTransformRows,
    sortRows: sortItemList,
    XF_PRESETS,
  };
})(window.Graardor);
