(function (G) {
  const ui = G.ui;
  const params = new URLSearchParams(location.search);
  const POPULAR_TASKS = [415, 2215, 5862, 494, 499, 412, 7278, 6766, 8609, 8615];
  const STYLES = ["melee", "ranged", "magic"];
  const TIER_LABELS = { bis: "BIS", mid: "Mid", entry: "Entry" };
  const STYLE_LABELS = { melee: "Melee", ranged: "Ranged", magic: "Magic" };

  let slayerMeta = null;
  let monstersMeta = null;
  let activeTaskId = Number(params.get("task")) || null;
  let masterFilter = params.get("master") || "";
  let searchTimer = null;

  function itemName(id) {
    return G.findMappingById(Number(id))?.name || `#${id}`;
  }

  function findMonster(id) {
    return monstersMeta?.monsters?.[String(id)] || null;
  }

  function allTasks() {
    return Object.values(slayerMeta?.tasks || {});
  }

  function taskMatchesMaster(task) {
    if (!masterFilter) return true;
    return (task.masters || []).some((m) => m.toLowerCase() === masterFilter.toLowerCase());
  }

  function searchTasks(q) {
    if (!q) return [];
    const lower = q.toLowerCase();
    return allTasks()
      .filter((t) => taskMatchesMaster(t) && t.name.toLowerCase().includes(lower))
      .sort((a, b) => a.combatLevel - b.combatLevel || a.name.localeCompare(b.name))
      .slice(0, 20);
  }

  /** Normalize legacy flat gear { bis, mid, budget } → per-style { melee|ranged|magic: { bis, mid, entry } }. */
  function resolveStyleGear(task) {
    const g = task.gear;
    if (!g) return { gear: {}, prayers: {} };

    if (g.melee || g.ranged || g.magic) {
      return { gear: g, prayers: task.prayers || {} };
    }

    const style = task.recommendedStyle || task.style || "melee";
    return {
      gear: {
        [style]: {
          bis: g.bis || {},
          mid: g.mid || {},
          entry: g.budget || g.entry || {},
        },
      },
      prayers: task.prayers
        ? {
            [style]: {
              bis: task.prayers.bis || [],
              mid: task.prayers.mid || [],
              entry: task.prayers.budget || task.prayers.entry || [],
            },
          }
        : {},
    };
  }

  function recommendedStyle(task) {
    return task.recommendedStyle || task.style || "melee";
  }

  function gearPlannerUrl(task, style, tier) {
    const { gear } = resolveStyleGear(task);
    const slots = gear[style]?.[tier];
    if (!slots || !Object.keys(slots).length) return `/tools/gear?monster=${task.monsterId}&style=${style}`;
    const slotPairs = Object.entries(slots)
      .map(([slot, id]) => `${slot}:${id}`)
      .join(",");
    const prayers = (resolveStyleGear(task).prayers[style]?.[tier] || []).join(",");
    const qs = new URLSearchParams();
    qs.set("monster", String(task.monsterId));
    qs.set("style", style);
    if (slotPairs) qs.set("slots", slotPairs);
    if (prayers) qs.set("prayers", prayers);
    return `/tools/gear?${qs.toString()}`;
  }

  function renderTaskPick(results) {
    const el = G.el("slayerTaskPick");
    if (!el) return;
    if (!results.length) {
      el.innerHTML = "";
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = results
      .map((task) => {
        const monster = findMonster(task.monsterId);
        const iconUrl = G.monsterIconUrl(monster || { name: task.name });
        const meta = [`Lv ${task.combatLevel}`, task.masters?.slice(0, 2).join(", ")].filter(Boolean).join(" · ");
        return ui.monsterPickerResult({
          id: task.monsterId,
          name: task.name,
          iconUrl,
          meta,
        });
      })
      .join("");
    el.querySelectorAll("[data-monster-id]").forEach((row) => {
      row.addEventListener("click", (e) => {
        e.preventDefault();
        selectTask(Number(row.dataset.monsterId));
      });
    });
  }

  function renderQuickPicks() {
    const el = G.el("slayerQuickPick");
    if (!el) return;
    el.innerHTML = POPULAR_TASKS.map((id) => {
      const task = slayerMeta?.tasks?.[String(id)];
      if (!task) return "";
      const monster = findMonster(id);
      return ui.monsterQuickChip({
        id,
        name: task.name,
        iconUrl: G.monsterIconUrl(monster || { name: task.name }),
        active: activeTaskId === id,
      });
    }).join("");
    el.querySelectorAll("[data-monster-id]").forEach((btn) => {
      btn.addEventListener("click", () => selectTask(Number(btn.dataset.monsterId)));
    });
  }

  function renderMasterFilter() {
    const sel = G.el("slayerMasterFilter");
    if (!sel || sel.options.length > 1) return;
    (slayerMeta?.masters || []).forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      if (m.toLowerCase() === masterFilter.toLowerCase()) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => {
      masterFilter = sel.value;
      const url = new URL(location.href);
      if (masterFilter) url.searchParams.set("master", masterFilter);
      else url.searchParams.delete("master");
      history.replaceState(null, "", url.pathname + url.search);
      renderQuickPicks();
      if (activeTaskId) renderDetail();
    });
  }

  function bindStyleTabs(root) {
    const tabs = root.querySelectorAll(".slayer-style-tab");
    const panels = root.querySelectorAll(".slayer-style-panel");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const style = tab.dataset.style;
        tabs.forEach((t) => {
          const on = t.dataset.style === style;
          t.classList.toggle("is-open", on);
          t.setAttribute("aria-expanded", on ? "true" : "false");
        });
        panels.forEach((p) => {
          const on = p.dataset.stylePanel === style;
          p.classList.toggle("is-open", on);
          p.hidden = !on;
        });
      });
    });
  }

  function renderDetail() {
    const root = G.el("slayerDetailRoot");
    if (!root) return;
    const task = slayerMeta?.tasks?.[String(activeTaskId)];
    if (!task) {
      root.innerHTML = `<p class="slayer-empty-state">Search or pick a slayer task above.</p>`;
      return;
    }

    const monster = findMonster(task.monsterId);
    const iconUrl = G.monsterIconUrl(monster || { name: task.name });
    const recStyle = recommendedStyle(task);
    const styleBadge = `<span class="slayer-badge slayer-badge--style slayer-badge--${G.escapeHtml(recStyle)}">${G.escapeHtml(STYLE_LABELS[recStyle] || recStyle)} recommended</span>`;
    const masterBadges = (task.masters || [])
      .map((m) => `<span class="slayer-badge slayer-badge--master">${G.escapeHtml(m)}</span>`)
      .join("");
    const weaknessChip = task.weakness
      ? `<span class="slayer-weakness-chip" title="Combat weakness">${G.escapeHtml(task.weakness)}</span>`
      : "";

    const bringHtml = (task.bring || []).length
      ? `<div class="slayer-bring-list">${task.bring.map((b) => `<span class="slayer-bring-chip">${G.escapeHtml(b)}</span>`).join("")}</div>`
      : "—";

    const { gear, prayers } = resolveStyleGear(task);

    root.innerHTML = `
      <article class="slayer-hero gear-monster-target">
        <div class="slayer-hero-portrait gear-monster-target-portrait">
          <img src="${G.escapeHtml(iconUrl)}" alt="" width="96" height="96" loading="lazy" class="gear-monster-target-sprite" onerror="this.style.visibility='hidden'" />
        </div>
        <div class="slayer-hero-info gear-monster-target-info">
          <div class="slayer-hero-badges monster-hero-badges">${styleBadge}${masterBadges}</div>
          <h2 class="slayer-hero-name gear-monster-target-name">${G.escapeHtml(task.name)}</h2>
          ${weaknessChip}
          <div class="slayer-hero-stats monster-hero-stats">
            <div class="monster-hero-stat"><span class="value">${task.combatLevel ?? "—"}</span><span class="label">Combat</span></div>
            <div class="monster-hero-stat"><span class="value">${task.slayerLevel ?? "—"}</span><span class="label">Slayer req</span></div>
            <div class="monster-hero-stat"><span class="value">${task.slayerXp ?? "—"}</span><span class="label">Slayer XP</span></div>
          </div>
          ${task.styleReason ? `<p class="slayer-style-reason">${G.escapeHtml(task.styleReason)}</p>` : ""}
          ${task.notes ? `<p class="slayer-hero-notes">${G.escapeHtml(task.notes)}</p>` : ""}
          <div class="slayer-hero-actions gear-monster-target-actions">
            <a href="/tools/monster?id=${task.monsterId}">Monster stats</a>
            <a href="/tools/gear?monster=${task.monsterId}&style=${recStyle}">Gear planner</a>
          </div>
        </div>
      </article>

      <section class="slayer-section slayer-section--notes">
        <h2>Task info</h2>
        <dl class="slayer-notes-grid">
          ${task.location ? `<div class="slayer-note-row"><dt>Location</dt><dd>${G.escapeHtml(task.location)}</dd></div>` : ""}
          <div class="slayer-note-row"><dt>Bring</dt><dd>${bringHtml}</dd></div>
          ${task.skipBlock ? `<div class="slayer-note-row"><dt>Skip / block</dt><dd>${G.escapeHtml(task.skipBlock)}</dd></div>` : ""}
        </dl>
      </section>

      <section class="slayer-section slayer-section--gear">
        <h2>Gear loadouts</h2>
        <div id="slayerStyleGearRoot"></div>
      </section>`;

    const gearRoot = G.el("slayerStyleGearRoot");
    if (gearRoot) {
      gearRoot.innerHTML = ui.slayerStyleGear({
        styles: STYLES,
        recommendedStyle: recStyle,
        styleGear: gear,
        stylePrayers: prayers,
        tierLabels: TIER_LABELS,
        styleLabels: STYLE_LABELS,
        getIconUrl: (id, name) => G.itemIconUrlById(id, name),
        getItemName: itemName,
        plannerUrlFor: (style, tier) => gearPlannerUrl(task, style, tier),
      });
      bindStyleTabs(gearRoot);
    }

    document.title = `${task.name} — Slayer Guide — Graardor`;
    const titleEl = document.querySelector(".page-hero h1");
    if (titleEl) titleEl.textContent = task.name;
  }

  function selectTask(id) {
    activeTaskId = id;
    const pick = G.el("slayerTaskPick");
    if (pick) {
      pick.innerHTML = "";
      pick.hidden = true;
    }
    const search = G.el("slayerTaskSearch");
    const task = slayerMeta?.tasks?.[String(id)];
    if (search && task) search.value = task.name;

    const url = new URL(location.href);
    url.searchParams.set("task", String(id));
    history.replaceState(null, "", url.pathname + url.search);

    renderQuickPicks();
    renderDetail();
  }

  function bindSearch() {
    const input = G.el("slayerTaskSearch");
    if (!input) return;
    if (params.get("q")) input.value = params.get("q");

    input.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        renderTaskPick(searchTasks(input.value.trim()));
      }, 120);
    });

    input.addEventListener("focus", () => {
      if (input.value.trim()) renderTaskPick(searchTasks(input.value.trim()));
    });

    document.addEventListener("click", (e) => {
      const pick = G.el("slayerTaskPick");
      if (!pick || pick.contains(e.target) || e.target === input) return;
      pick.innerHTML = "";
      pick.hidden = true;
    });
  }

  async function init() {
    G.updateStatus("slayerStatus", "Loading…", "");
    try {
      const [sm, mm, pm] = await Promise.all([
        fetch("/data/slayer-tasks-meta.json").then((r) => {
          if (!r.ok) throw new Error("slayer data");
          return r.json();
        }),
        fetch("/data/monsters-meta.json").then((r) => r.json()),
        fetch("/data/prayers-meta.json").then((r) => r.json()),
      ]);
      slayerMeta = sm;
      monstersMeta = mm;
      G._slayerPrayersCache = pm.prayers;

      await G.loadPrices({ useCache: true }).catch(() => {});

      renderMasterFilter();
      renderQuickPicks();
      bindSearch();

      if (activeTaskId && sm.tasks[String(activeTaskId)]) {
        renderDetail();
      } else if (params.get("q")) {
        const hits = searchTasks(params.get("q").trim());
        if (hits.length === 1) selectTask(hits[0].monsterId);
        else {
          renderTaskPick(hits);
          renderDetail();
        }
      } else {
        renderDetail();
      }

      G.updateStatus("slayerStatus", `${sm.count} tasks`, "ok");
    } catch (err) {
      G.updateStatus("slayerStatus", "Could not load", "error");
      console.error(err);
    }
  }

  init();
})(window.Graardor);
