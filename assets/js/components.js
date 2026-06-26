window.Graardor = window.Graardor || {};

(function (G) {
  G.ui = G.ui || {};

  function esc(s) {
    return G.escapeHtml(String(s ?? ""));
  }

  /** @param {{ label: string, value?: string, className?: string, valueClassName?: string, valueHtml?: string }} card */
  G.ui.statCard = function statCard({ label, value, className = "", valueClassName = "", valueHtml }) {
    const val = valueHtml != null ? valueHtml : esc(value ?? "—");
    const valueCls = valueClassName ? ` ${valueClassName}` : "";
    return `<div class="ui-stat-card stat-card${className ? ` ${className}` : ""}">
      <span class="label">${esc(label)}</span>
      <span class="value${valueCls}">${val}</span>
    </div>`;
  };

  /** @param {Array<{label:string,value?:string,className?:string,valueHtml?:string}>} cards */
  G.ui.statGrid = function statGrid(cards, className = "") {
    const inner = (cards || []).map((c) => G.ui.statCard(c)).join("");
    return `<div class="ui-stat-grid stat-grid${className ? ` ${className}` : ""}">${inner}</div>`;
  };

  /**
   * Combat bonus table — equipment (attack+defence rows) or monster offence grid + defence row.
   * @param {{ offence?: object, defence?: object, extras?: Array<[string,number]>, slot?: string, mode?: 'equipment'|'monster' }} opts
   */
  G.ui.bonusTable = function bonusTable(opts = {}) {
    const { offence = {}, defence = {}, extras = [], slot, mode = "equipment" } = opts;

    function statCell(value) {
      if (value == null || value === 0) return "<td>—</td>";
      const cls = value > 0 ? "positive-stat" : value < 0 ? "negative-stat" : "";
      const prefix = value > 0 ? "+" : "";
      return `<td class="${cls}">${prefix}${value}</td>`;
    }

    function defenceRow(def) {
      const hasDef = Object.values(def).some((v) => v);
      if (!hasDef) return "";
      return `<table class="ui-bonus-table item-stat-table monster-bonus-table">
        <tr><th></th><th>Stab</th><th>Slash</th><th>Crush</th><th>Magic</th><th>Ranged</th></tr>
        <tr><td>Defence</td>${statCell(def.stab)}${statCell(def.slash)}${statCell(def.crush)}${statCell(def.magic)}${statCell(def.ranged)}</tr>
      </table>`;
    }

    if (mode === "monster") {
      const offRows = [
        ["Attack bonus", offence.attack],
        ["Strength bonus", offence.strength],
        ["Magic attack", offence.magic],
        ["Magic damage", offence.magicDmg],
        ["Ranged attack", offence.ranged],
        ["Ranged strength", offence.rangedStr],
      ].filter(([, v]) => v);

      let html = "";
      if (offRows.length) {
        html += `<div class="monster-bonus-section">
          <h3 class="monster-bonus-heading">Offensive</h3>
          ${G.ui.statGrid(
            offRows.map(([label, val]) => ({
              label,
              valueHtml: `<span class="positive-stat">+${val}</span>`,
            })),
            "monster-bonus-grid"
          )}
        </div>`;
      }

      const defHtml = defenceRow(defence);
      if (defHtml) {
        html += `<div class="monster-bonus-section">
          <h3 class="monster-bonus-heading">Defensive</h3>
          ${defHtml}
        </div>`;
      }

      if (!html) return `<p class="results-meta">No offensive/defensive bonuses listed.</p>`;
      return html;
    }

    const atk = offence;
    const def = defence;
    const hasAttack = Object.values(atk).some((v) => v);
    const hasDefence = Object.values(def).some((v) => v);

    let tableRows = "";
    if (hasAttack || hasDefence) {
      tableRows += `<tr><th></th><th>Stab</th><th>Slash</th><th>Crush</th><th>Magic</th><th>Ranged</th></tr>`;
      if (hasAttack) {
        tableRows += `<tr><td>Attack</td>${statCell(atk.stab)}${statCell(atk.slash)}${statCell(atk.crush)}${statCell(atk.magic)}${statCell(atk.ranged)}</tr>`;
      }
      if (hasDefence) {
        tableRows += `<tr><td>Defence</td>${statCell(def.stab)}${statCell(def.slash)}${statCell(def.crush)}${statCell(def.magic)}${statCell(def.ranged)}</tr>`;
      }
    }

    const extrasHtml = extras.length
      ? `<div class="item-stat-extras">${extras
          .map(
            ([label, val]) =>
              `<div class="item-stat-extra"><span class="label">${esc(label)}</span><span class="value positive-stat">+${val}</span></div>`
          )
          .join("")}</div>`
      : "";

    const body =
      tableRows || extrasHtml
        ? `${tableRows ? `<table class="ui-bonus-table item-stat-table">${tableRows}</table>` : ""}${extrasHtml}`
        : `<p class="results-meta">Equipable — no combat bonuses listed.</p>`;

    const slotHtml = slot
      ? `<span class="item-equipment-slot">${esc(slot.replace(/_/g, " "))}</span>`
      : "";

    return `${slotHtml}${body}`;
  };

  /**
   * @param {{ groups: Array<{ label: string, presets: Array<{ id: string, label: string, attrs?: Record<string,string> }> }>, dataAttr: string, activeId?: string|null, className?: string }} opts
   */
  G.ui.presetChips = function presetChips({ groups, dataAttr, activeId, className = "" }) {
    const attrKey = dataAttr.replace(/^data-/, "");
    const camelKey = attrKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

    return (groups || [])
      .map((group) => {
        const buttons = (group.presets || [])
          .map((p) => {
            const active = activeId === p.id ? " active" : "";
            const extra = p.attrs
              ? Object.entries(p.attrs)
                  .map(([k, v]) => ` ${esc(k)}="${esc(v)}"`)
                  .join("")
              : "";
            return `<button type="button" class="ui-preset-btn preset-btn${active}" ${dataAttr}="${esc(p.id)}"${extra}>${esc(p.label)}</button>`;
          })
          .join("");
        return `<div class="ui-preset-row preset-filters${className ? ` ${className}` : ""}">
          <span class="ui-preset-label preset-label">${esc(group.label)}</span>
          ${buttons}
        </div>`;
      })
      .join("");
  };

  /** Toggle active state on preset buttons matching data attribute. */
  G.ui.setActivePreset = function setActivePreset(dataAttr, activeId) {
    document.querySelectorAll(`[${dataAttr}]`).forEach((btn) => {
      const key = dataAttr.replace(/^data-/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const val = btn.dataset[key];
      btn.classList.toggle("active", activeId != null && val === activeId);
    });
  };

  /** @param {{ dataAttr: string, onSelect: (id: string) => void, extraSelector?: string }} opts */
  G.ui.bindPresetChips = function bindPresetChips({ dataAttr, onSelect, extraSelector }) {
    const sel = extraSelector ? `[${dataAttr}], ${extraSelector}` : `[${dataAttr}]`;
    document.querySelectorAll(sel).forEach((btn) => {
      if (extraSelector && !btn.matches(`[${dataAttr}]`)) {
        btn.addEventListener("click", () => onSelect(btn.id || ""));
        return;
      }
      btn.addEventListener("click", () => {
        const key = dataAttr.replace(/^data-/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        onSelect(btn.dataset[key]);
      });
    });
  };

  /** @param {{ summary: string, content: string, open?: boolean, className?: string }} opts */
  G.ui.detailsDisclosure = function detailsDisclosure({ summary, content, open = false, className = "" }) {
    return `<details class="ui-disclosure${className ? ` ${className}` : ""}"${open ? " open" : ""}>
      <summary class="ui-disclosure-summary">${summary}</summary>
      <div class="ui-disclosure-body">${content}</div>
    </details>`;
  };

  /**
   * @param {{ title: string, drops: Array, renderDropRow: (drop: object) => string, open?: boolean, countLabel?: string, className?: string }} opts
   */
  G.ui.dropCategory = function dropCategory({ title, drops, renderDropRow, open = false, countLabel, className = "" }) {
    if (!drops?.length) return "";
    const rows = drops.map(renderDropRow).join("");
    const count = countLabel ?? `${drops.length} drop${drops.length === 1 ? "" : "s"}`;
    return `<details class="ui-drop-category monster-drop-category${className ? ` ${className}` : ""}"${open ? " open" : ""}>
      <summary class="ui-drop-category-head monster-drop-category-head">
        <span class="ui-drop-category-title monster-drop-category-title">${esc(title)}</span>
        <span class="ui-drop-category-count monster-drop-category-count">${esc(count)}</span>
      </summary>
      <div class="monster-drops-scroll">
        <table class="ui-bonus-table item-stat-table monster-drops-table">
          <thead><tr><th>Item</th><th>Quantity</th><th>Rate</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </details>`;
  };

  /** Drop simulator panel markup — bind with G.ui.bindDropSimulator. */
  G.ui.dropSimulator = function dropSimulator({ monsterId, resultsId = "monsterSimResults", summaryId = "monsterSimSummary", lootId = "monsterSimLoot" } = {}) {
    return `<section class="ui-section-card lookup-card monster-sim-card"${monsterId ? ` data-monster-id="${monsterId}"` : ""}>
      <h2>Simulate drops</h2>
      <div class="ui-sim-controls monster-sim-controls">
        <button type="button" class="ui-sim-btn monster-sim-btn" data-kills="1">Roll 1 kill</button>
        <button type="button" class="ui-sim-btn monster-sim-btn" data-kills="10">Roll 10 kills</button>
        <button type="button" class="ui-sim-btn monster-sim-btn" data-kills="100">Roll 100 kills</button>
      </div>
      <div id="${esc(resultsId)}" class="ui-sim-results monster-sim-results" hidden>
        <div class="ui-sim-summary monster-sim-summary" id="${esc(summaryId)}"></div>
        <div class="ui-sim-loot monster-sim-loot" id="${esc(lootId)}"></div>
      </div>
    </section>`;
  };

  /** @param {{ title?: string, bodyHtml: string, className?: string, footHtml?: string }} opts */
  G.ui.sectionCard = function sectionCard({ title, bodyHtml, className = "", footHtml }) {
    const titleHtml = title ? `<h2>${esc(title)}</h2>` : "";
    const foot = footHtml ? `<p class="lookup-card-foot ui-section-foot">${footHtml}</p>` : "";
    return `<section class="ui-section-card lookup-card${className ? ` ${className}` : ""}">
      ${titleHtml}
      ${bodyHtml}
      ${foot}
    </section>`;
  };

  /**
   * Lookup hero for item or monster detail pages.
   * @param {{ layout?: 'item'|'monster', iconUrl: string, iconSize?: number, title: string, badges?: string[], subtitle?: string, examine?: string, wikiUrl?: string, actions?: Array<{href:string,label:string}>, heroStats?: Array<{label:string,value:string}> }} opts
   */
  G.ui.lookupHero = function lookupHero(opts) {
    const {
      layout = "item",
      iconUrl,
      iconSize = layout === "monster" ? 128 : 64,
      title,
      badges = [],
      subtitle,
      examine,
      wikiUrl,
      actions = [],
      heroStats = [],
    } = opts;

    const badgeHtml = badges.filter(Boolean).join(" ");
    const actionsHtml = actions
      .map((a) => `<a href="${esc(a.href)}"${a.external !== false && a.href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${esc(a.label)}</a>`)
      .join("");
    const wikiLink = wikiUrl ? `<a href="${esc(wikiUrl)}" target="_blank" rel="noopener">Wiki ↗</a>` : "";
    const allActions = [wikiLink, actionsHtml].filter(Boolean).join("");

    if (layout === "monster") {
      const statsHtml = heroStats.length
        ? `<div class="monster-hero-stats">${heroStats
            .map(
              (s) =>
                `<div class="monster-hero-stat"><span class="value${s.className ? ` ${s.className}` : ""}">${s.valueHtml ?? esc(s.value)}</span><span class="label">${esc(s.label)}</span></div>`
            )
            .join("")}</div>`
        : "";

      return `<header class="ui-lookup-hero monster-detail-hero">
        <div class="monster-hero-portrait">
          <img src="${esc(iconUrl)}" alt="" width="${iconSize}" height="${iconSize}" loading="lazy" class="monster-hero-sprite" onerror="this.style.visibility='hidden'" />
        </div>
        <div class="monster-hero-info">
          <div class="monster-hero-badges">${badgeHtml}</div>
          <h1>${esc(title)}</h1>
          ${examine ? `<p class="monster-examine">${esc(examine)}</p>` : ""}
          ${statsHtml}
          ${allActions ? `<div class="item-detail-actions ui-lookup-actions">${allActions}</div>` : ""}
        </div>
      </header>`;
    }

    return `<header class="ui-lookup-hero item-detail-hero">
      <img src="${esc(iconUrl)}" alt="" width="${iconSize}" height="${iconSize}" loading="lazy" />
      <div class="item-detail-hero-text">
        <h1>${esc(title)} ${badgeHtml}</h1>
        ${subtitle ? `<p class="ui-lookup-subtitle results-meta">${esc(subtitle)}</p>` : ""}
        ${allActions ? `<div class="item-detail-actions ui-lookup-actions">${allActions}</div>` : ""}
      </div>
    </header>`;
  };

  G.ui.emptyState = function emptyState(message, { loading = false, className = "" } = {}) {
    const cls = loading ? "loading" : "";
    return `<p class="ui-empty-state ${cls}${className ? ` ${className}` : ""}">${message}</p>`;
  };

  /** @param {'hero'|'grid'|'card'|'list'} type */
  G.ui.loadingSkeleton = function loadingSkeleton(type = "card") {
    if (type === "hero") {
      return `<div class="ui-skeleton ui-skeleton-hero" aria-hidden="true">
        <span class="ui-skeleton-block ui-skeleton-icon"></span>
        <span class="ui-skeleton-block ui-skeleton-lines"></span>
      </div>`;
    }
    if (type === "grid") {
      return `<div class="ui-skeleton ui-skeleton-grid" aria-hidden="true">${Array(4)
        .fill('<span class="ui-skeleton-block ui-skeleton-stat"></span>')
        .join("")}</div>`;
    }
    if (type === "list") {
      return `<div class="ui-skeleton ui-skeleton-list" aria-hidden="true">${Array(5)
        .fill('<span class="ui-skeleton-block ui-skeleton-row"></span>')
        .join("")}</div>`;
    }
    return `<div class="ui-skeleton ui-skeleton-card" aria-hidden="true">
      <span class="ui-skeleton-block ui-skeleton-title"></span>
      <span class="ui-skeleton-block ui-skeleton-body"></span>
    </div>`;
  };

  /** Levels grid for monster combat levels. */
  G.ui.levelsGrid = function levelsGrid(levels = {}) {
    const rows = [
      ["Attack", levels.attack],
      ["Strength", levels.strength],
      ["Defence", levels.defence],
      ["Magic", levels.magic],
      ["Ranged", levels.ranged],
    ];
    return `<div class="ui-levels-grid monster-levels-grid">${rows
      .map(
        ([label, val]) =>
          `<div class="monster-level-cell"><span class="label">${label}</span><span class="value">${val ?? "—"}</span></div>`
      )
      .join("")}</div>`;
  };

  /**
   * OSRS equipment tab paper doll — slot grid with wiki icons.
   * @param {{ slots: Record<string, number>, labels: Record<string, string>, getIconUrl: (id: number, name: string) => string, getItemName: (id: number) => string }} opts
   */
  G.ui.gearPaperDoll = function gearPaperDoll({ slots, labels, getIconUrl, getItemName }) {
    const order = ["head", "cape", "amulet", "ammo", "weapon", "body", "shield", "gloves", "legs", "boots", "ring"];
    return `<div class="gear-paper-doll">${order
      .map((slot) => {
        const id = slots[slot];
        const label = labels[slot] || slot;
        if (id) {
          const name = getItemName(id);
          const icon = getIconUrl(id, name);
          return `<button type="button" class="gear-paper-slot" data-slot="${esc(slot)}" title="${esc(name)}" aria-label="${esc(label)}: ${esc(name)}">
            <img src="${esc(icon)}" alt="" width="40" height="40" loading="lazy" onerror="this.style.visibility='hidden'" />
            <span class="gear-paper-slot-label">${esc(name)}</span>
          </button>`;
        }
        return `<button type="button" class="gear-paper-slot gear-paper-slot--empty" data-slot="${esc(slot)}" aria-label="${esc(label)} — empty">
          <span class="gear-paper-slot-silhouette gear-paper-slot-silhouette--${esc(slot)}" aria-hidden="true"></span>
          <span class="gear-paper-slot-name">${esc(label)}</span>
        </button>`;
      })
      .join("")}</div>`;
  };

  /** Single row in gear item picker results. */
  G.ui.gearPickerResult = function gearPickerResult({ id, name, icon, snippet, active = false }) {
    return `<button type="button" class="gear-picker-result${active ? " active" : ""}" data-pick-id="${id}">
      <img src="${esc(icon)}" alt="" width="32" height="32" loading="lazy" onerror="this.style.visibility='hidden'" />
      <span class="gear-picker-result-text">
        <span class="gear-picker-result-name">${esc(name)}</span>
        ${snippet ? `<span class="gear-picker-result-stat">${esc(snippet)}</span>` : ""}
      </span>
    </button>`;
  };

  /** Bind drop simulator controls on a container. */
  G.ui.bindDropSimulator = function bindDropSimulator(root, { getMonster, getSellPrice, resultsId = "monsterSimResults", summaryId = "monsterSimSummary", lootId = "monsterSimLoot" }) {
    if (!root || root._simBound) return;
    root._simBound = true;

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
          if (prev) prev.quantity += rolled.quantity;
          else totals.set(key, { ...rolled });
        }
      }
      return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));
    }

    function renderResults(results, killCount) {
      const box = G.el(resultsId);
      const summary = G.el(summaryId);
      const loot = G.el(lootId);
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
          const price = getSellPrice?.(item.id) ?? null;
          const lineGp = price != null ? price * item.quantity : null;
          if (lineGp != null) {
            totalGp += lineGp;
            hasPrices = true;
          }
          const gpHint = lineGp != null ? `<span class="monster-sim-chip-gp">${G.formatGp(lineGp)}</span>` : "";
          return `<div class="monster-sim-chip">
            <img src="${G.itemIconUrlById(item.id, item.name)}" alt="" width="28" height="28" loading="lazy" onerror="this.style.visibility='hidden'" />
            <span class="monster-sim-chip-text">
              <span class="monster-sim-chip-name">${esc(item.name)}</span>
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

    root.addEventListener("click", (e) => {
      const btn = e.target.closest(".monster-sim-btn, .ui-sim-btn");
      if (!btn) return;
      const monster = getMonster?.();
      if (!monster) return;
      const kills = Number(btn.dataset.kills) || 1;
      renderResults(simulateKills(monster, kills), kills);
    });
  };
})(window.Graardor);
