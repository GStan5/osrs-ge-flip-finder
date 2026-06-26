(function (G) {
  const DEFAULT_MONSTER_ID = 2215;
  const params = new URLSearchParams(location.search);
  let monsterId = Number(params.get("id"));
  const queryParam = (params.get("q") || "").trim();
  let searchTimer;
  let monstersMeta = null;
  let itemsMeta = null;
  let currentMonster = null;
  let pricesReady = false;

  const DROP_CATEGORIES = [
    { key: "always", label: "Always" },
    { key: "weapons", label: "Weapons" },
    { key: "armour", label: "Armour" },
    { key: "runes", label: "Runes & ammunition" },
    { key: "materials", label: "Materials" },
    { key: "other", label: "Other" },
    { key: "unique", label: "Unique / rare" },
  ];

  const ARMOUR_SLOTS = new Set(["head", "body", "legs", "feet", "hands", "shield", "cape", "neck", "ring"]);
  const WEAPON_SLOTS = new Set(["weapon", "2h"]);

  // Drop sim uses osrsbox per-entry rarity as independent Bernoulli trials — not full OSRS table RNG.
  async function loadMonstersMeta() {
    if (monstersMeta) return monstersMeta;
    const res = await fetch("/data/monsters-meta.json");
    if (!res.ok) throw new Error("Could not load monster data");
    monstersMeta = await res.json();
    return monstersMeta;
  }

  async function loadItemsMeta() {
    if (itemsMeta) return itemsMeta;
    try {
      const res = await fetch("/data/items-meta.json");
      if (!res.ok) return null;
      itemsMeta = await res.json();
      return itemsMeta;
    } catch {
      return null;
    }
  }

  function allMonsters(bundle) {
    return Object.values(bundle?.monsters || {});
  }

  function findMonsterById(bundle, id) {
    return bundle?.monsters?.[String(id)] || null;
  }

  function searchMonsters(bundle, q) {
    if (!q) return [];
    const lower = q.toLowerCase();
    return allMonsters(bundle)
      .filter((m) => m.name.toLowerCase().includes(lower))
      .sort((a, b) => a.combatLevel - b.combatLevel || a.name.localeCompare(b.name))
      .slice(0, 20);
  }

  function statCell(value) {
    if (value == null || value === 0) return "<td>—</td>";
    const cls = value > 0 ? "positive-stat" : value < 0 ? "negative-stat" : "";
    const prefix = value > 0 ? "+" : "";
    return `<td class="${cls}">${prefix}${value}</td>`;
  }

  function formatList(items) {
    if (!items?.length) return "—";
    return items.map((x) => G.escapeHtml(String(x).replace(/_/g, " "))).join(", ");
  }

  function wikiUrl(monster) {
    const name = (monster.wikiName || monster.name).replace(/ \(.*\)$/, "");
    return G.wikiPageUrl(name);
  }

  function dropIconUrl(drop) {
    return G.itemIconUrlById(drop.id, drop.name);
  }

  function categorizeDrop(drop, metaBundle) {
    if (drop.rarity >= 1) return "always";

    const name = drop.name.toLowerCase();
    const slot = metaBundle?.items?.[String(drop.id)]?.slot;

    if (
      drop.rarity < 0.01 ||
      /\bpet\b/.test(name) ||
      /clue scroll/.test(name) ||
      /\bhilt\b/.test(name) ||
      /godsword shard/.test(name) ||
      /brimstone key/.test(name) ||
      /curved bone/.test(name) ||
      /long bone/.test(name) ||
      /\bjar\b/.test(name) ||
      /scroll \((hard|elite|master|medium|easy)\)/.test(name)
    ) {
      return "unique";
    }

    if (WEAPON_SLOTS.has(slot)) return "weapons";
    if (ARMOUR_SLOTS.has(slot)) return "armour";

    if (
      slot === "ammo" ||
      /\brune\b/.test(name) ||
      /\b(arrow|bolt|dart|javelin|knife|throwing axe| cannonball)\b/.test(name)
    ) {
      return "runes";
    }

    if (
      /grimy | ore| logs| seed| bones| bar| hide| leather| flax| herb| potion| sapling| plank| essence| clay| swamp tar| molten glass| battlestaff| dragonhide| uncut | coal| raw |casket| ashes| wool| thread| rope| vial| flask| eye of newt| limpwurt| snape grass| wine of zamorak| torstol| ranarr| snapdragon| toadflax| irit| kwuarm| cadantine| lantadyme| dwarf weed| torstol| wine| beer| bread| cake| pie| pizza| shark| lobster| swordfish| tuna| salmon| trout| sardine| anchovie| karambwan| monkfish| manta| sea turtle| dark crab| anglerfish| brew| restore| super |ranging |magic |defence |attack |strength |prayer |antifire| antidote| antipoison| stamina| energy| saradomin| zamorak| guthix| noted/
        .test(name)
    ) {
      return "materials";
    }

    if (drop.id === 995 || name === "coins") return "materials";

    return "other";
  }

  function groupDropsByCategory(drops, metaBundle) {
    const groups = Object.fromEntries(DROP_CATEGORIES.map((c) => [c.key, []]));
    for (const drop of drops) {
      const cat = categorizeDrop(drop, metaBundle);
      groups[cat].push(drop);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        if (key === "unique") return (a.rarity || 0) - (b.rarity || 0);
        if (key === "always") return a.name.localeCompare(b.name);
        return (b.rarity || 0) - (a.rarity || 0);
      });
    }
    return groups;
  }

  function renderLookup(bundle, query) {
    const box = G.el("monsterLookupResults");
    if (!box) return;
    const results = searchMonsters(bundle, query);
    if (!query.trim()) {
      box.innerHTML = "";
      return;
    }
    if (!results.length) {
      box.innerHTML = '<p class="loading">No monsters found.</p>';
      return;
    }
    box.innerHTML = results
      .map(
        (m) => `<a href="${G.monsterPageUrl(m.id)}">
          <img src="${G.monsterIconUrl(m)}" alt="" width="28" height="28" loading="lazy" onerror="this.style.visibility='hidden'" />
          <span class="monster-result-text">
            <span class="monster-result-name">${G.escapeHtml(m.name)}</span>
            <span class="monster-result-meta">Cb-${m.combatLevel} · ${m.hitpoints} HP</span>
          </span>
        </a>`
      )
      .join("");
  }

  function formatDropRate(rarity) {
    if (rarity >= 1) return "Always";
    if (rarity <= 0) return "—";
    const pct = rarity * 100;
    if (pct >= 10) return `${pct.toFixed(1)}%`;
    const denom = Math.max(1, Math.round(1 / rarity));
    if (pct >= 0.1) return `1/${denom} (~${pct.toFixed(2)}%)`;
    return `1/${denom}`;
  }

  function formatDropQuantity(quantity, noted) {
    const qty = G.escapeHtml(String(quantity));
    return noted ? `${qty} (noted)` : qty;
  }

  function renderDropRow(drop) {
    const rolls = drop.rolls > 1 ? ` ×${drop.rolls}` : "";
    const icon = dropIconUrl(drop);
    return `<tr>
      <td class="monster-drop-item">
        <img src="${icon}" alt="" width="24" height="24" loading="lazy" class="monster-drop-icon" onerror="this.style.visibility='hidden'" />
        <a href="${G.itemPageUrl(drop.id)}">${G.escapeHtml(drop.name)}</a>
      </td>
      <td>${formatDropQuantity(drop.quantity, drop.noted)}${rolls}</td>
      <td class="monster-drop-rate">${formatDropRate(drop.rarity)}</td>
    </tr>`;
  }

  function renderDropCategory(key, label, drops) {
    if (!drops.length) return "";
    const rows = drops.map(renderDropRow).join("");
    const open = key === "always" || key === "unique";
    return `<details class="monster-drop-category"${open ? " open" : ""}>
      <summary class="monster-drop-category-head">
        <span class="monster-drop-category-title">${G.escapeHtml(label)}</span>
        <span class="monster-drop-category-count">${drops.length} drop${drops.length === 1 ? "" : "s"}</span>
      </summary>
      <div class="monster-drops-scroll">
        <table class="item-stat-table monster-drops-table">
          <thead><tr><th>Item</th><th>Quantity</th><th>Rate</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </details>`;
  }

  function renderDropsSection(monster, metaBundle) {
    const drops = monster.drops || [];
    if (!drops.length) {
      return `<section class="lookup-card monster-drops-card">
          <h2>Drops</h2>
          <p class="results-meta">No drop table available for this monster.</p>
        </section>`;
    }

    const groups = groupDropsByCategory(drops, metaBundle);
    const sections = DROP_CATEGORIES.map((c) => renderDropCategory(c.key, c.label, groups[c.key])).join("");

    return `<section class="lookup-card monster-drops-card">
        <h2>Drops</h2>
        <p class="results-meta">Grouped like the OSRS Wiki. Rates are per kill roll.</p>
        <div class="monster-drop-categories">${sections}</div>
      </section>`;
  }

  function renderSimulatorSection(monster) {
    const drops = monster.drops || [];
    if (!drops.length) return "";

    return `<section class="lookup-card monster-sim-card">
        <h2>Simulate drops</h2>
        <p class="results-meta">Roll the drop table — see what loot you might get.</p>
        <div class="monster-sim-controls">
          <button type="button" class="monster-sim-btn" data-kills="1">Roll 1 kill</button>
          <button type="button" class="monster-sim-btn" data-kills="10">Roll 10 kills</button>
          <button type="button" class="monster-sim-btn" data-kills="100">Roll 100 kills</button>
        </div>
        <div id="monsterSimResults" class="monster-sim-results" hidden>
          <div class="monster-sim-summary" id="monsterSimSummary"></div>
          <div class="monster-sim-loot" id="monsterSimLoot"></div>
        </div>
      </section>`;
  }

  function parseQuantity(quantityStr) {
    const s = String(quantityStr || "1");
    const range = s.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const lo = Number(range[1]);
      const hi = Number(range[2]);
      return lo + Math.floor(Math.random() * (hi - lo + 1));
    }
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function rollDrop(drop) {
    const rolls = Math.max(1, drop.rolls || 1);
    const hits = [];
    for (let r = 0; r < rolls; r++) {
      if (Math.random() < (drop.rarity || 0)) {
        hits.push(parseQuantity(drop.quantity));
      }
    }
    if (!hits.length) return null;
    const qty = hits.reduce((a, b) => a + b, 0);
    return { id: drop.id, name: drop.name, quantity: qty, noted: drop.noted };
  }

  function simulateKills(monster, killCount) {
    const drops = monster.drops || [];
    const totals = new Map();

    for (let k = 0; k < killCount; k++) {
      for (const drop of drops) {
        const rolled = rollDrop(drop);
        if (!rolled) continue;
        const key = `${rolled.id}:${rolled.noted ? "n" : "u"}`;
        const prev = totals.get(key);
        if (prev) {
          prev.quantity += rolled.quantity;
        } else {
          totals.set(key, { ...rolled });
        }
      }
    }

    return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function itemSellPrice(id) {
    if (!pricesReady) return null;
    const latest = G.cachedApiData?.latest?.[id];
    return latest?.high ?? null;
  }

  function renderSimResults(results, killCount) {
    const box = G.el("monsterSimResults");
    const summary = G.el("monsterSimSummary");
    const loot = G.el("monsterSimLoot");
    if (!box || !summary || !loot) return;

    if (!results.length) {
      box.hidden = false;
      summary.textContent = `${killCount} kill${killCount === 1 ? "" : "s"} — nothing dropped. Tough luck!`;
      loot.innerHTML = "";
      return;
    }

    let totalGp = 0;
    let hasPrices = false;
    const chips = results
      .map((item) => {
        const price = itemSellPrice(item.id);
        const lineGp = price != null ? price * item.quantity : null;
        if (lineGp != null) {
          totalGp += lineGp;
          hasPrices = true;
        }
        const gpHint = lineGp != null ? `<span class="monster-sim-chip-gp">${G.formatGp(lineGp)}</span>` : "";
        return `<div class="monster-sim-chip">
          <img src="${G.itemIconUrlById(item.id, item.name)}" alt="" width="28" height="28" loading="lazy" onerror="this.style.visibility='hidden'" />
          <span class="monster-sim-chip-text">
            <span class="monster-sim-chip-name">${G.escapeHtml(item.name)}</span>
            <span class="monster-sim-chip-qty">×${item.quantity.toLocaleString()}${gpHint}</span>
          </span>
        </div>`;
      })
      .join("");

    const gpLine = hasPrices ? ` · ~${G.formatGp(totalGp)} GE value` : "";
    summary.textContent = `${killCount} kill${killCount === 1 ? "" : "s"} — ${results.length} unique drop${results.length === 1 ? "" : "s"}${gpLine}`;
    loot.innerHTML = chips;
    box.hidden = false;
  }

  function renderLevelsGrid(levels) {
    const rows = [
      ["Attack", levels.attack],
      ["Strength", levels.strength],
      ["Defence", levels.defence],
      ["Magic", levels.magic],
      ["Ranged", levels.ranged],
    ];
    return `<div class="monster-levels-grid">${rows
      .map(
        ([label, val]) =>
          `<div class="monster-level-cell"><span class="label">${label}</span><span class="value">${val}</span></div>`
      )
      .join("")}</div>`;
  }

  function renderOffenceDefence(monster) {
    const off = monster.offence || {};
    const def = monster.defence || {};
    const offRows = [
      ["Attack bonus", off.attack],
      ["Strength bonus", off.strength],
      ["Magic attack", off.magic],
      ["Magic damage", off.magicDmg],
      ["Ranged attack", off.ranged],
      ["Ranged strength", off.rangedStr],
    ].filter(([, v]) => v);

    let html = "";
    if (offRows.length) {
      html += `<div class="monster-bonus-section">
        <h3 class="monster-bonus-heading">Offensive</h3>
        <div class="stat-grid monster-bonus-grid">${offRows
          .map(
            ([label, val]) =>
              `<div class="stat-card"><span class="label">${G.escapeHtml(label)}</span><span class="value positive-stat">+${val}</span></div>`
          )
          .join("")}</div>
      </div>`;
    }

    const hasDef = Object.values(def).some((v) => v);
    if (hasDef) {
      html += `<div class="monster-bonus-section">
        <h3 class="monster-bonus-heading">Defensive</h3>
        <table class="item-stat-table monster-bonus-table">
          <tr><th></th><th>Stab</th><th>Slash</th><th>Crush</th><th>Magic</th><th>Ranged</th></tr>
          <tr><td>Defence</td>${statCell(def.stab)}${statCell(def.slash)}${statCell(def.crush)}${statCell(def.magic)}${statCell(def.ranged)}</tr>
        </table>
      </div>`;
    }

    if (!offRows.length && !hasDef) {
      return `<p class="results-meta">No offensive/defensive bonuses listed.</p>`;
    }
    return html;
  }

  function renderSlayerCard(monster) {
    if (!monster.slayer) {
      return `<section class="lookup-card monster-slayer-card">
          <h2>Slayer</h2>
          <p class="results-meta">Not a slayer task monster.</p>
        </section>`;
    }
    const s = monster.slayer;
    return `<section class="lookup-card monster-slayer-card">
        <h2>Slayer</h2>
        <div class="stat-grid">
          <div class="stat-card"><span class="label">Slayer level</span><span class="value">${s.level}</span></div>
          <div class="stat-card"><span class="label">Slayer XP</span><span class="value">${s.xp}</span></div>
          <div class="stat-card"><span class="label">Category</span><span class="value monster-stat-text">${formatList(s.category)}</span></div>
          <div class="stat-card"><span class="label">Masters</span><span class="value monster-stat-text">${formatList(s.masters)}</span></div>
        </div>
      </section>`;
  }

  function renderDetail(monster, metaBundle) {
    const root = G.el("monsterDetailRoot");
    if (!root || !monster) return;

    currentMonster = monster;

    const membersBadge = monster.members
      ? '<span class="badge badge-members">Members</span>'
      : '<span class="badge badge-f2p">Free-to-play</span>';
    const attackTypes = monster.attackTypes?.length
      ? monster.attackTypes.map((t) => G.escapeHtml(t)).join(", ")
      : "—";

    document.title = `${monster.name} — Graardor`;
    G.el("monsterPageTitle").textContent = monster.name;

    root.innerHTML = `
      <article class="monster-detail">
        <header class="monster-detail-hero">
          <div class="monster-hero-portrait">
            <img src="${G.monsterIconUrl(monster)}" alt="" width="160" height="160" loading="lazy" class="monster-hero-sprite" onerror="this.style.visibility='hidden'" />
          </div>
          <div class="monster-hero-info">
            <div class="monster-hero-badges">
              <span class="monster-cb-badge">Combat ${monster.combatLevel}</span>
              ${membersBadge}
            </div>
            <h1>${G.escapeHtml(monster.name)}</h1>
            <p class="monster-examine">${G.escapeHtml(monster.examine || "")}</p>
            <div class="monster-hero-stats">
              <div class="monster-hero-stat"><span class="value">${monster.hitpoints}</span><span class="label">Hitpoints</span></div>
              <div class="monster-hero-stat"><span class="value">${monster.maxHit || "—"}</span><span class="label">Max hit</span></div>
              <div class="monster-hero-stat"><span class="value">${monster.attackSpeed || "—"}</span><span class="label">Attack speed</span></div>
              <div class="monster-hero-stat"><span class="value monster-stat-text">${attackTypes}</span><span class="label">Style</span></div>
            </div>
            <div class="item-detail-actions">
              <a href="${wikiUrl(monster)}" target="_blank" rel="noopener">Wiki ↗</a>
              <a href="/tools/boss">Boss GP/hr</a>
              <a href="/tools/prep">Boss prep</a>
            </div>
          </div>
        </header>

        <div class="item-detail-grid">
          <section class="lookup-card monster-overview-card">
            <h2>Attributes</h2>
            <div class="stat-grid monster-attr-grid">
              <div class="stat-card"><span class="label">Aggressive</span><span class="value">${monster.aggressive ? "Yes" : "No"}</span></div>
              <div class="stat-card"><span class="label">Poisonous</span><span class="value">${monster.poisonous ? "Yes" : "No"}</span></div>
              <div class="stat-card"><span class="label">Venomous</span><span class="value">${monster.venomous ? "Yes" : "No"}</span></div>
              <div class="stat-card"><span class="label">Attributes</span><span class="value monster-stat-text">${formatList(monster.attributes)}</span></div>
            </div>
          </section>
          ${renderSlayerCard(monster)}
        </div>

        <section class="lookup-card monster-stats-card">
          <h2>Combat levels</h2>
          ${renderLevelsGrid(monster.levels || {})}
        </section>

        <section class="lookup-card monster-stats-card">
          <h2>Offence &amp; defence bonuses</h2>
          ${renderOffenceDefence(monster)}
        </section>

        ${renderDropsSection(monster, metaBundle)}
        ${renderSimulatorSection(monster)}
      </article>`;
  }

  function bindSimControls() {
    const root = G.el("monsterDetailRoot");
    if (!root || root._simBound) return;
    root._simBound = true;
    root.addEventListener("click", (e) => {
      const btn = e.target.closest(".monster-sim-btn");
      if (!btn || !currentMonster) return;
      const kills = Number(btn.dataset.kills) || 1;
      const results = simulateKills(currentMonster, kills);
      renderSimResults(results, kills);
    });
  }

  function ensureDefaultMonster(bundle) {
    const hasIdParam = params.has("id");
    if (!hasIdParam && !queryParam) {
      monsterId = DEFAULT_MONSTER_ID;
      const url = new URL(location.href);
      url.searchParams.set("id", String(DEFAULT_MONSTER_ID));
      history.replaceState(null, "", url.pathname + url.search);
      return findMonsterById(bundle, monsterId);
    }
    if (monsterId && findMonsterById(bundle, monsterId)) {
      return findMonsterById(bundle, monsterId);
    }
    return null;
  }

  async function init() {
    G.el("monsterSearch")?.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        try {
          const bundle = await loadMonstersMeta();
          renderLookup(bundle, e.target.value);
        } catch (err) {
          G.updateStatus("monsterStatus", err.message, "error");
        }
      }, 150);
    });

    if (queryParam && G.el("monsterSearch")) {
      G.el("monsterSearch").value = queryParam;
    }

    G.updateStatus("monsterStatus", "Loading monster data…", "");
    try {
      const [bundle, metaBundle] = await Promise.all([loadMonstersMeta(), loadItemsMeta()]);
      G.updateStatus(
        "monsterStatus",
        `${bundle.count.toLocaleString()} monsters loaded`,
        "ok"
      );

      if (queryParam) renderLookup(bundle, queryParam);

      const monster = ensureDefaultMonster(bundle);
      if (!monster) {
        if (params.get("id")) {
          G.el("monsterDetailRoot").innerHTML =
            '<p class="loading">Unknown monster ID. Search below.</p>';
        }
        return;
      }

      renderDetail(monster, metaBundle);
      bindSimControls();

      G.loadPrices({ useCache: true }).then(() => {
        pricesReady = true;
      }).catch(() => {});
    } catch (err) {
      G.updateStatus("monsterStatus", `Failed: ${err.message}`, "error");
      G.el("monsterDetailRoot").innerHTML = `<p class="loading">${G.escapeHtml(err.message)}</p>`;
    }
  }

  init();
})(window.Graardor);
