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
  let activePickerSlot = null;
  let pickerSearchTimer = null;

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

  function itemStatSnippet(id) {
    const item = itemsMeta?.items?.[String(id)];
    if (!item) return "";
    const parts = [];
    if (item.strength) parts.push(`+${item.strength} str`);
    if (item.rangedStrength) parts.push(`+${item.rangedStrength} rstr`);
    if (item.prayer) parts.push(`+${item.prayer} pray`);
    if (item.magicDamage) parts.push(`+${item.magicDamage}% mage`);
    const atk = item.attack || {};
    const maxAtk = Math.max(atk.stab || 0, atk.slash || 0, atk.crush || 0, atk.magic || 0, atk.ranged || 0);
    if (maxAtk > 0) parts.push(`+${maxAtk} atk`);
    return parts.slice(0, 2).join(" · ");
  }

  function searchItems(q, slot) {
    if (!q || !G.cachedApiData?.mapping) return [];
    const lower = q.toLowerCase();
    return G.cachedApiData.mapping
      .filter((m) => m.name.toLowerCase().includes(lower) && itemMatchesSlot(m.id, slot))
      .slice(0, 14);
  }

  function resolveManualEntry(raw, slot) {
    const text = raw.trim();
    if (!text) return null;
    const asId = Number(text);
    if (Number.isFinite(asId) && asId > 0 && itemMatchesSlot(asId, slot)) return asId;
    const lower = text.toLowerCase();
    const exact = G.cachedApiData?.mapping?.find(
      (m) => m.name.toLowerCase() === lower && itemMatchesSlot(m.id, slot)
    );
    if (exact) return exact.id;
    const hits = searchItems(text, slot);
    return hits.length === 1 ? hits[0].id : null;
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
    el.innerHTML = [
      `<span>Atk ${s.attack}</span>`,
      `<span>Str ${s.strength}</span>`,
      `<span>Def ${s.defence}</span>`,
      `<span>Rng ${s.ranged}</span>`,
      `<span>Mag ${s.magic}</span>`,
      `<span>HP ${s.hitpoints}</span>`,
    ].join("");
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

  function setSlotItem(slot, id) {
    if (id) state.slots[slot] = id;
    else delete state.slots[slot];
    if (slot === "weapon" && id && itemsMeta?.items?.[String(id)]?.slot === "2h") {
      delete state.slots.shield;
    }
    renderSlots();
    renderResults();
    scheduleUpgrades();
  }

  function renderPickerResults(q) {
    const box = G.el("gearPickerResults");
    if (!box || !activePickerSlot) return;
    const hits = q ? searchItems(q, activePickerSlot) : [];
    if (!hits.length) {
      box.innerHTML = q
        ? `<span class="results-meta" style="display:block;padding:0.75rem;text-align:center;">No items found</span>`
        : "";
      return;
    }
    box.innerHTML = hits
      .map((m) =>
        ui.gearPickerResult({
          id: m.id,
          name: m.name,
          icon: G.iconUrl(m.icon) || G.itemIconUrlById(m.id, m.name),
          snippet: itemStatSnippet(m.id),
        })
      )
      .join("");
  }

  function openPicker(slot) {
    activePickerSlot = slot;
    const modal = G.el("gearPickerModal");
    const title = G.el("gearPickerTitle");
    const search = G.el("gearPickerSearch");
    const manual = G.el("gearPickerManual");
    if (!modal || !title || !search) return;

    title.textContent = SLOT_LABELS[slot] || slot;
    const id = state.slots[slot];
    search.value = id ? itemName(id) : "";
    if (manual) manual.value = "";
    renderPickerResults("");

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => search.focus(), 50);
  }

  function closePicker() {
    activePickerSlot = null;
    const modal = G.el("gearPickerModal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function applyPickerSelection(id) {
    if (!activePickerSlot) return;
    setSlotItem(activePickerSlot, id);
    closePicker();
  }

  function renderSlots() {
    const root = G.el("gearSlots");
    if (!root) return;
    root.innerHTML = ui.gearPaperDoll({
      slots: state.slots,
      labels: SLOT_LABELS,
      getIconUrl: (id, name) => G.itemIconUrlById(id, name),
      getItemName: itemName,
    });
  }

  function bindSlotPicker() {
    const root = G.el("gearSlots");
    const modal = G.el("gearPickerModal");
    const search = G.el("gearPickerSearch");
    const manual = G.el("gearPickerManual");
    if (!root || !modal) return;

    root.addEventListener("click", (e) => {
      const slotBtn = e.target.closest(".gear-paper-slot");
      if (!slotBtn?.dataset.slot) return;
      openPicker(slotBtn.dataset.slot);
    });

    modal.querySelectorAll("[data-picker-close]").forEach((el) => {
      el.addEventListener("click", closePicker);
    });

    search?.addEventListener("input", () => {
      clearTimeout(pickerSearchTimer);
      pickerSearchTimer = setTimeout(() => renderPickerResults(search.value.trim()), 120);
    });

    G.el("gearPickerResults")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pick-id]");
      if (!btn) return;
      applyPickerSelection(Number(btn.dataset.pickId));
    });

    G.el("gearPickerApply")?.addEventListener("click", () => {
      if (!activePickerSlot) return;
      const q = search?.value.trim() || "";
      const manualVal = manual?.value.trim() || "";
      const fromSearch = resolveManualEntry(q, activePickerSlot);
      const fromManual = manualVal ? resolveManualEntry(manualVal, activePickerSlot) : null;
      const id = fromManual || fromSearch;
      if (!id) {
        toast("Item not found for this slot");
        return;
      }
      applyPickerSelection(id);
    });

    G.el("gearPickerClear")?.addEventListener("click", () => {
      if (!activePickerSlot) return;
      setSlotItem(activePickerSlot, null);
      closePicker();
    });

    manual?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") G.el("gearPickerApply")?.click();
    });

    search?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePicker();
      if (e.key === "Enter") G.el("gearPickerApply")?.click();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closePicker();
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
      .map((u) => {
        const icon = G.itemIconUrlById(u.itemId, u.name);
        return `<tr>
        <td>${G.escapeHtml(SLOT_LABELS[u.slot] || u.slot)}</td>
        <td><span class="gear-upgrade-item"><img src="${icon}" alt="" width="24" height="24" loading="lazy" onerror="this.style.visibility='hidden'" /><a href="${G.itemPageUrl(u.itemId)}">${G.escapeHtml(u.name)}</a></span></td>
        <td>+${u.deltaDps} DPS</td>
        <td>${pro ? G.formatGp(u.deltaGpHr) + "/hr" : "—"}</td>
        <td>${u.price != null ? G.formatGp(u.price) : "—"}</td>
      </tr>`;
      })
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
      bindSlotPicker();
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
