(function (G) {
  const ui = G.ui;
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
      box.innerHTML = ui.emptyState("No monsters found.", { loading: true });
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

  function renderDropsSection(monster, metaBundle) {
    const drops = monster.drops || [];
    if (!drops.length) {
      return ui.sectionCard({
        title: "Drops",
        className: "monster-drops-card",
        bodyHtml: `<p class="results-meta">No drop table available for this monster.</p>`,
      });
    }

    const groups = groupDropsByCategory(drops, metaBundle);
    const sections = DROP_CATEGORIES.map((c) =>
      ui.dropCategory({
        title: c.label,
        drops: groups[c.key],
        renderDropRow,
        open: c.key === "always" || c.key === "unique",
      })
    ).join("");

    return ui.sectionCard({
      title: "Drops",
      className: "monster-drops-card",
      bodyHtml: `<div class="monster-drop-categories">${sections}</div>`,
    });
  }

  function renderSlayerCard(monster) {
    if (!monster.slayer) {
      return ui.sectionCard({
        title: "Slayer",
        className: "monster-slayer-card",
        bodyHtml: `<p class="results-meta">Not a slayer task monster.</p>`,
      });
    }
    const s = monster.slayer;
    return ui.sectionCard({
      title: "Slayer",
      className: "monster-slayer-card",
      bodyHtml: ui.statGrid([
        { label: "Slayer level", value: String(s.level) },
        { label: "Slayer XP", value: String(s.xp) },
        { label: "Category", valueHtml: formatList(s.category), valueClassName: "monster-stat-text" },
        { label: "Masters", valueHtml: formatList(s.masters), valueClassName: "monster-stat-text" },
      ]),
    });
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
        ${ui.lookupHero({
          layout: "monster",
          iconUrl: G.monsterIconUrl(monster),
          title: monster.name,
          badges: [`<span class="monster-cb-badge">Combat ${monster.combatLevel}</span>`, membersBadge],
          examine: monster.examine || "",
          wikiUrl: wikiUrl(monster),
          actions: [
            { href: G.gearPageUrl(monster.id), label: "Plan gear", external: false },
            { href: "/tools/boss", label: "Boss GP/hr", external: false },
            { href: "/tools/prep", label: "Boss prep", external: false },
          ],
          heroStats: [
            { label: "Hitpoints", value: String(monster.hitpoints) },
            { label: "Max hit", value: String(monster.maxHit || "—") },
            { label: "Attack speed", value: String(monster.attackSpeed || "—") },
            { label: "Style", value: attackTypes, className: "monster-stat-text" },
          ],
        })}

        <div class="item-detail-grid">
          ${ui.sectionCard({
            title: "Attributes",
            className: "monster-overview-card",
            bodyHtml: ui.statGrid(
              [
                { label: "Aggressive", value: monster.aggressive ? "Yes" : "No" },
                { label: "Poisonous", value: monster.poisonous ? "Yes" : "No" },
                { label: "Venomous", value: monster.venomous ? "Yes" : "No" },
                { label: "Attributes", valueHtml: formatList(monster.attributes), valueClassName: "monster-stat-text" },
              ],
              "monster-attr-grid"
            ),
          })}
          ${renderSlayerCard(monster)}
        </div>

        ${ui.sectionCard({
          title: "Combat levels",
          className: "monster-stats-card",
          bodyHtml: ui.levelsGrid(monster.levels || {}),
        })}

        ${ui.sectionCard({
          title: "Offence & defence bonuses",
          className: "monster-stats-card",
          bodyHtml: ui.bonusTable({
            offence: monster.offence || {},
            defence: monster.defence || {},
            mode: "monster",
          }),
        })}

        ${renderDropsSection(monster, metaBundle)}
        ${(monster.drops || []).length ? ui.dropSimulator({ monsterId: monster.id }) : ""}
      </article>`;

    ui.bindDropSimulator(root, {
      getMonster: () => currentMonster,
      getSellPrice: (id) => {
        if (!pricesReady) return null;
        return G.cachedApiData?.latest?.[id]?.high ?? null;
      },
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
          G.el("monsterDetailRoot").innerHTML = ui.emptyState("Unknown monster ID. Search below.", {
            loading: true,
          });
        }
        return;
      }

      renderDetail(monster, metaBundle);

      G.loadPrices({ useCache: true }).then(() => {
        pricesReady = true;
      }).catch(() => {});
    } catch (err) {
      G.updateStatus("monsterStatus", `Failed: ${err.message}`, "error");
      G.el("monsterDetailRoot").innerHTML = ui.emptyState(G.escapeHtml(err.message), { loading: true });
    }
  }

  init();
})(window.Graardor);
