(function (G) {
  const ui = G.ui;
  const calc = G.gearCalc;
  const SLOT_KEYS = calc.SLOT_KEYS;
  const SLOT_LABELS = {
    head: "Head",
    cape: "Cape",
    amulet: "Amulet",
    weapon: "Weapon",
    body: "Body",
    legs: "Legs",
    shield: "Shield",
    gloves: "Gloves",
    boots: "Boots",
    ring: "Ring",
    ammo: "Ammo",
  };
  const META_SLOT = {
    head: "head",
    cape: "cape",
    amulet: "neck",
    weapon: ["weapon", "2h"],
    body: "body",
    legs: "legs",
    shield: "shield",
    gloves: "hands",
    boots: "feet",
    ring: "ring",
    ammo: "ammo",
  };
  const STYLES = [
    { id: "melee", label: "Melee" },
    { id: "ranged", label: "Ranged" },
    { id: "magic", label: "Magic" },
  ];
  const DEFAULT_MONSTER = 2215;

  const params = new URLSearchParams(location.search);
  let authed = false;
  let pro = false;
  let itemsMeta = null;
  let monstersMeta = null;
  let prayersMeta = null;
  let pricesReady = false;
  let presets = [];
  let profiles = [];
  let activePresetId = null;
  let shareId = null;
  let upgradeTimer = null;

  const state = {
    monsterId: Number(params.get("monster")) || DEFAULT_MONSTER,
    slots: {},
    prayers: [],
    combatStyle: "melee",
    stats: null,
    ironman: false,
    isPublic: true,
  };

  function toast(msg) {
    const el = G.el("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function itemName(id) {
    return G.findMappingById(Number(id))?.name || `#${id}`;
  }

  function itemMatchesSlot(id, slot) {
    const meta = itemsMeta?.items?.[String(id)];
    if (!meta) return false;
    const want = META_SLOT[slot];
    if (Array.isArray(want)) return want.includes(meta.slot);
    return meta.slot === want;
  }

  function searchItems(q, slot) {
    if (!q || !G.cachedApiData?.mapping) return [];
    const lower = q.toLowerCase();
    return G.cachedApiData.mapping
      .filter((m) => m.name.toLowerCase().includes(lower) && itemMatchesSlot(m.id, slot))
      .slice(0, 12);
  }

  function currentMonster() {
    return monstersMeta?.monsters?.[String(state.monsterId)] || null;
  }

  function primaryStats() {
    if (state.stats) return state.stats;
    const p = profiles.find((x) => x.is_primary) || profiles[0];
    return p?.combat_stats || { attack: 75, strength: 75, defence: 75, ranged: 75, magic: 75, hitpoints: 99 };
  }

  function getPrice(id) {
    if (!pricesReady) return null;
    return G.cachedApiData?.latest?.[id]?.high ?? null;
  }

  function renderResults() {
    const root = G.el("gearResults");
    const monster = currentMonster();
    if (!root || !monster) return;

    const stats = calc.calcStats({
      stats: primaryStats(),
      slots: state.slots,
      prayers: state.prayers,
      combatStyle: state.combatStyle,
      monster,
      itemsMeta,
      prayersMeta,
      getPrice,
    });

    const blur = !pro;
    const cards = [
      { label: "DPS", value: String(stats.dps) },
      { label: "Max hit", value: String(stats.maxHit) },
      { label: "Hit chance", value: `${stats.hitChance}%` },
      { label: "Kills/hr", value: blur ? "—" : stats.killsPerHour.toLocaleString(), valueClassName: blur ? "gear-blur-stat" : "" },
      {
        label: "XP/hr",
        value: blur ? "—" : stats.xpPerHour.toLocaleString(),
        valueClassName: blur ? "gear-blur-stat" : "",
      },
      {
        label: "GP/hr",
        value: blur ? "—" : G.formatGp(stats.gpPerHour),
        valueClassName: blur ? "gear-blur-stat" : "",
      },
      {
        label: "Avg loot/kill",
        value: blur ? "—" : G.formatGp(stats.avgLoot),
        valueClassName: blur ? "gear-blur-stat" : "",
      },
    ];

    root.innerHTML = ui.statGrid(cards) + ui.bonusTable({ offence: stats.equipment.attack, defence: stats.equipment.defence, extras: [
      ["Melee str", stats.equipment.strength],
      ["Ranged str", stats.equipment.rangedStrength],
      ["Magic dmg", stats.equipment.magicDamage],
      ["Prayer", stats.equipment.prayer],
    ].filter(([, v]) => v) });
  }

  function renderMonsterSummary() {
    const el = G.el("gearMonsterSummary");
    const m = currentMonster();
    if (!el) return;
    if (!m) {
      el.textContent = "";
      return;
    }
    G.el("gearMonsterSearch").value = m.name;
    el.innerHTML = `Cb-${m.combatLevel} · ${m.hitpoints} HP · <a href="${G.monsterPageUrl(m.id)}">Monster page</a> · <a href="/tools/prep">Boss prep</a>`;
  }

  function renderStatsRow() {
    const el = G.el("gearStatsRow");
    if (!el) return;
    const s = primaryStats();
    el.innerHTML = `Atk ${s.attack} · Str ${s.strength} · Def ${s.defence} · Rng ${s.ranged} · Mag ${s.magic} · HP ${s.hitpoints}`;
  }

  function renderStyleChips() {
    const el = G.el("gearStyleChips");
    if (!el) return;
    el.innerHTML = ui.presetChips({
      groups: [{ label: "Style", presets: STYLES.map((s) => ({ id: s.id, label: s.label })) }],
      dataAttr: "data-gear-style",
      activeId: state.combatStyle,
    });
    ui.bindPresetChips({
      dataAttr: "data-gear-style",
      onSelect: (id) => {
        state.combatStyle = id;
        ui.setActivePreset("data-gear-style", id);
        renderResults();
        scheduleUpgrades();
      },
    });
  }

  function renderPrayerChips() {
    const el = G.el("gearPrayerChips");
    if (!el) return;
    const list = Object.values(prayersMeta?.prayers || {}).sort((a, b) => a.name.localeCompare(b.name));
    el.innerHTML = list
      .map((p) => {
        const active = state.prayers.includes(p.id) ? " active" : "";
        return `<button type="button" class="gear-prayer-btn${active}" data-prayer-id="${p.id}">${G.escapeHtml(p.name)}</button>`;
      })
      .join("");
    el.querySelectorAll("[data-prayer-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.prayerId);
        const idx = state.prayers.indexOf(id);
        if (idx >= 0) state.prayers.splice(idx, 1);
        else state.prayers.push(id);
        renderPrayerChips();
        renderResults();
        scheduleUpgrades();
      });
    });
  }

  function renderSlot(slot) {
    const id = state.slots[slot];
    const name = id ? itemName(id) : "";
    const icon = id ? G.itemIconUrlById(id, name) : "";
    return `<div class="gear-slot" data-slot="${slot}">
      <label>${SLOT_LABELS[slot]}</label>
      <div class="gear-slot-input-wrap">
        <input type="search" class="gear-slot-search" data-slot="${slot}" placeholder="Search item…" autocomplete="off" value="${id ? G.escapeHtml(name) : ""}" />
        <div class="gear-slot-results" hidden></div>
      </div>
      <div class="gear-slot-picked">${id ? `<img src="${icon}" alt="" width="20" height="20" loading="lazy" /><span>${G.escapeHtml(name)}</span><button type="button" data-clear-slot="${slot}">Clear</button>` : ""}</div>
    </div>`;
  }

  function renderSlots() {
    const root = G.el("gearSlots");
    if (!root) return;
    root.innerHTML = SLOT_KEYS.map(renderSlot).join("");

    root.querySelectorAll(".gear-slot-search").forEach((input) => {
      let timer;
      input.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const slot = input.dataset.slot;
          const box = input.closest(".gear-slot-input-wrap")?.querySelector(".gear-slot-results");
          const q = input.value.trim();
          if (!q || (state.slots[slot] && q === itemName(state.slots[slot]))) {
            box.hidden = true;
            return;
          }
          const hits = searchItems(q, slot);
          if (!hits.length) {
            box.innerHTML = `<span class="results-meta" style="padding:0.5rem;">No items</span>`;
            box.hidden = false;
            return;
          }
          box.innerHTML = hits
            .map(
              (m) =>
                `<a href="#" data-pick-id="${m.id}" data-pick-slot="${slot}"><img src="${G.iconUrl(m.icon)}" alt="" width="20" height="20" loading="lazy" />${G.escapeHtml(m.name)}</a>`
            )
            .join("");
          box.hidden = false;
        }, 120);
      });

      input.addEventListener("blur", () => {
        setTimeout(() => {
          const box = input.closest(".gear-slot-input-wrap")?.querySelector(".gear-slot-results");
          if (box) box.hidden = true;
        }, 150);
      });
    });

    root.addEventListener("click", (e) => {
      const pick = e.target.closest("[data-pick-id]");
      if (pick) {
        e.preventDefault();
        const slot = pick.dataset.pickSlot;
        const id = Number(pick.dataset.pickId);
        state.slots[slot] = id;
        if (slot === "weapon" && itemsMeta?.items?.[String(id)]?.slot === "2h") {
          delete state.slots.shield;
        }
        renderSlots();
        renderResults();
        scheduleUpgrades();
        return;
      }
      const clear = e.target.closest("[data-clear-slot]");
      if (clear) {
        delete state.slots[clear.dataset.clearSlot];
        renderSlots();
        renderResults();
        scheduleUpgrades();
      }
    });
  }

  function renderPresetSelect() {
    const sel = G.el("gearPresetSelect");
    if (!sel) return;
    sel.innerHTML =
      `<option value="">New setup</option>` +
      presets
        .map((p) => `<option value="${p.id}"${p.id === activePresetId ? " selected" : ""}>${G.escapeHtml(p.name)}</option>`)
        .join("");
  }

  function applyPreset(p) {
    if (!p) return;
    activePresetId = p.id;
    shareId = p.share_id;
    G.el("gearName").value = p.name || "";
    G.el("gearGoal").value = p.goal || "";
    G.el("gearPublicToggle").checked = p.is_public !== false;
    G.el("gearIronmanToggle").checked = Boolean(p.ironman);
    state.monsterId = p.monster_id || DEFAULT_MONSTER;
    state.slots = { ...(p.slots || {}) };
    state.prayers = [...(p.prayers || [])];
    state.combatStyle = p.combat_style || "melee";
    state.ironman = Boolean(p.ironman);
    state.isPublic = p.is_public !== false;
    renderMonsterSummary();
    renderStyleChips();
    renderPrayerChips();
    renderSlots();
    renderResults();
  }

  function collectPresetBody() {
    return {
      id: activePresetId,
      name: G.el("gearName").value.trim() || "Untitled",
      goal: G.el("gearGoal").value.trim(),
      monsterId: state.monsterId,
      slots: state.slots,
      prayers: state.prayers,
      combatStyle: state.combatStyle,
      isPublic: G.el("gearPublicToggle").checked,
      ironman: G.el("gearIronmanToggle").checked,
    };
  }

  async function savePreset() {
    if (!authed) {
      toast("Sign in to save");
      return;
    }
    const body = collectPresetBody();
    const method = activePresetId ? "PUT" : "POST";
    const url = activePresetId ? `/api/gear/presets?id=${activePresetId}` : "/api/gear/presets";
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Could not save");
      return;
    }
    activePresetId = data.preset.id;
    shareId = data.preset.share_id;
    await loadPresets();
    toast("Saved");
  }

  async function loadPresets() {
    if (!authed) return;
    const res = await fetch("/api/gear/presets", { credentials: "same-origin" });
    if (!res.ok) return;
    const data = await res.json();
    presets = data.presets || [];
    renderPresetSelect();
  }

  async function loadProfiles() {
    if (!authed) return;
    const res = await fetch("/api/gear/profiles", { credentials: "same-origin" });
    if (!res.ok) return;
    const data = await res.json();
    profiles = data.profiles || [];
    const primary = profiles.find((p) => p.is_primary) || profiles[0];
    if (primary) G.el("gearOsrsName").value = primary.username;
    renderStatsRow();
  }

  async function linkStats() {
    if (!authed) {
      toast("Sign in to link stats");
      return;
    }
    const username = G.el("gearOsrsName").value.trim();
    if (!username) return;
    G.updateStatus("gearStatus", "Fetching stats…", "");
    const res = await fetch("/api/gear/profiles", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, refresh: true, isPrimary: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      G.updateStatus("gearStatus", data.error || "Failed", "error");
      return;
    }
    state.stats = data.profile.combat_stats;
    await loadProfiles();
    renderStatsRow();
    renderResults();
    G.updateStatus("gearStatus", "Stats linked", "ok");
  }

  async function importWom() {
    if (!authed) {
      toast("Sign in to import");
      return;
    }
    const username = G.el("gearOsrsName").value.trim();
    if (!username) return;
    G.updateStatus("gearStatus", "Checking Wise Old Man…", "");
    const res = await fetch("/api/gear/import-wom", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok) {
      G.updateStatus("gearStatus", data.error || "Import failed", "error");
      return;
    }
    if (!data.ok) {
      G.updateStatus("gearStatus", data.error || "No gear data", "error");
      return;
    }
    state.slots = { ...state.slots, ...data.slots };
    renderSlots();
    renderResults();
    scheduleUpgrades();
    G.updateStatus("gearStatus", "Gear imported", "ok");
  }

  function renderUpgrades(data) {
    const root = G.el("gearUpgrades");
    const meta = G.el("gearUpgradeMeta");
    if (!root) return;

    if (!data?.upgrades?.length && !data?.lockedCount) {
      root.innerHTML = ui.emptyState("No upgrades found.");
      if (meta) meta.textContent = "";
      return;
    }

    const rows = (data.upgrades || [])
      .map(
        (u) => `<tr>
        <td>${G.escapeHtml(SLOT_LABELS[u.slot] || u.slot)}</td>
        <td><a href="${G.itemPageUrl(u.itemId)}">${G.escapeHtml(u.name)}</a></td>
        <td>+${u.deltaDps} DPS</td>
        <td>${pro ? G.formatGp(u.deltaGpHr) + "/hr" : "—"}</td>
        <td>${u.price != null ? G.formatGp(u.price) : "—"}</td>
      </tr>`
      )
      .join("");

    const locked = data.lockedCount || 0;
    const lockedRows = Array.from({ length: Math.min(locked, 5) }, () =>
      `<tr class="gear-upgrade-locked"><td>Slot</td><td>Upgrade</td><td>+?.?? DPS</td><td>—</td><td>—</td></tr>`
    ).join("");

    root.innerHTML = `<table class="ui-bonus-table"><thead><tr><th>Slot</th><th>Item</th><th>Gain</th><th>GP/hr</th><th>Price</th></tr></thead><tbody>${rows}${lockedRows}</tbody></table>`;

    if (meta) {
      const parts = [];
      if (!pro && data.usesRemaining != null) parts.push(`${data.usesRemaining} upgrade views left`);
      if (locked) parts.push(`${locked} more with Pro`);
      meta.textContent = parts.join(" · ");
    }
  }

  async function loadUpgrades() {
    const monster = currentMonster();
    if (!monster) return;
    if (!authed) {
      toast("Sign in to load upgrades");
      return;
    }
    G.el("gearLoadUpgradesBtn").disabled = true;
    const res = await fetch("/api/gear/upgrades", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monsterId: state.monsterId,
        slots: state.slots,
        prayers: state.prayers,
        combatStyle: state.combatStyle,
        stats: primaryStats(),
        ironman: G.el("gearIronmanToggle").checked,
      }),
    });
    G.el("gearLoadUpgradesBtn").disabled = false;
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Could not load upgrades");
      return;
    }
    renderUpgrades(data);
  }

  function scheduleUpgrades() {
    if (!pro || !authed) return;
    clearTimeout(upgradeTimer);
    upgradeTimer = setTimeout(loadUpgrades, 600);
  }

  function searchMonsters(q) {
    if (!q) return [];
    const lower = q.toLowerCase();
    return Object.values(monstersMeta?.monsters || {})
      .filter((m) => m.name.toLowerCase().includes(lower))
      .sort((a, b) => a.combatLevel - b.combatLevel || a.name.localeCompare(b.name))
      .slice(0, 15);
  }

  function bindMonsterSearch() {
    const input = G.el("gearMonsterSearch");
    const pick = G.el("gearMonsterPick");
    if (!input || !pick) return;
    let timer;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const hits = searchMonsters(input.value.trim());
        if (!hits.length) {
          pick.innerHTML = "";
          return;
        }
        pick.innerHTML = hits
          .map(
            (m) =>
              `<a href="#" data-monster-id="${m.id}">${G.escapeHtml(m.name)} <span class="results-meta">Cb-${m.combatLevel}</span></a>`
          )
          .join("");
      }, 150);
    });
    pick.addEventListener("click", (e) => {
      const a = e.target.closest("[data-monster-id]");
      if (!a) return;
      e.preventDefault();
      state.monsterId = Number(a.dataset.monsterId);
      pick.innerHTML = "";
      renderMonsterSummary();
      renderResults();
      scheduleUpgrades();
    });
  }

  async function loadShare(share) {
    const res = await fetch(`/api/gear/presets?share=${encodeURIComponent(share)}`);
    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Preset not found");
      return;
    }
    const p = data.preset;
    applyPreset({
      id: null,
      share_id: p.shareId,
      name: p.name,
      goal: p.goal,
      monster_id: p.monsterId,
      slots: p.slots,
      prayers: p.prayers,
      combat_style: p.combatStyle,
      is_public: p.isPublic,
      ironman: p.ironman,
    });
    shareId = p.shareId;
  }

  async function initAuth() {
    const res = await fetch("/api/me", { credentials: "same-origin" });
    const data = await res.json();
    authed = Boolean(data.user);
    pro = Boolean(data.pro);
    G.el("gearGate").hidden = authed;
    if (authed) {
      await Promise.all([loadPresets(), loadProfiles()]);
    } else {
      renderStatsRow();
    }
  }

  async function init() {
    G.updateStatus("gearStatus", "Loading data…", "");
    try {
      const [im, mm, pm] = await Promise.all([
        fetch("/data/items-meta.json").then((r) => r.json()),
        fetch("/data/monsters-meta.json").then((r) => r.json()),
        fetch("/data/prayers-meta.json").then((r) => r.json()),
      ]);
      itemsMeta = im;
      monstersMeta = mm;
      prayersMeta = pm;

      await initAuth();
      await G.loadPrices({ useCache: true }).catch(() => {});
      pricesReady = true;

      renderMonsterSummary();
      renderStyleChips();
      renderPrayerChips();
      renderSlots();
      renderStatsRow();
      renderResults();
      bindMonsterSearch();

      const share = params.get("share");
      if (share) await loadShare(share);

      G.el("gearSaveBtn")?.addEventListener("click", savePreset);
      G.el("gearShareBtn")?.addEventListener("click", () => {
        if (!shareId) {
          toast("Save first to get a link");
          return;
        }
        const url = `${location.origin}/tools/gear?share=${shareId}`;
        navigator.clipboard?.writeText(url).then(() => toast("Link copied"));
      });
      G.el("gearLinkStatsBtn")?.addEventListener("click", linkStats);
      G.el("gearImportWomBtn")?.addEventListener("click", importWom);
      G.el("gearLoadUpgradesBtn")?.addEventListener("click", loadUpgrades);
      G.el("gearPresetSelect")?.addEventListener("change", (e) => {
        const id = Number(e.target.value);
        if (!id) {
          activePresetId = null;
          shareId = null;
          return;
        }
        const p = presets.find((x) => x.id === id);
        applyPreset(p);
      });
      G.el("gearIronmanToggle")?.addEventListener("change", (e) => {
        state.ironman = e.target.checked;
        scheduleUpgrades();
      });

      G.updateStatus("gearStatus", `${mm.count.toLocaleString()} monsters · ${Object.keys(pm.prayers).length} prayers`, "ok");
    } catch (err) {
      G.updateStatus("gearStatus", "Could not load", "error");
      console.error(err);
    }
  }

  init();
})(window.Graardor);
