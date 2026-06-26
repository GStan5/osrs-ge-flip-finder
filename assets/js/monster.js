(function (G) {
  const params = new URLSearchParams(location.search);
  let monsterId = Number(params.get("id"));
  const queryParam = (params.get("q") || "").trim();
  let searchTimer;
  let monstersMeta = null;

  async function loadMonstersMeta() {
    if (monstersMeta) return monstersMeta;
    const res = await fetch("/data/monsters-meta.json");
    if (!res.ok) throw new Error("Could not load monster data");
    monstersMeta = await res.json();
    return monstersMeta;
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
          <span class="monster-result-name">${G.escapeHtml(m.name)}</span>
          <span class="monster-result-meta">Cb-${m.combatLevel} · ${m.hitpoints} HP</span>
        </a>`
      )
      .join("");
  }

  function renderLevelsTable(levels) {
    return `<table class="item-stat-table monster-levels-table">
      <tr><th>Attack</th><th>Strength</th><th>Defence</th><th>Magic</th><th>Ranged</th></tr>
      <tr>
        <td>${levels.attack}</td>
        <td>${levels.strength}</td>
        <td>${levels.defence}</td>
        <td>${levels.magic}</td>
        <td>${levels.ranged}</td>
      </tr>
    </table>`;
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
      html += `<div class="stat-grid monster-bonus-grid">${offRows
        .map(
          ([label, val]) =>
            `<div class="stat-card"><span class="label">${G.escapeHtml(label)}</span><span class="value positive-stat">+${val}</span></div>`
        )
        .join("")}</div>`;
    }

    const hasDef = Object.values(def).some((v) => v);
    if (hasDef) {
      html += `<table class="item-stat-table" style="margin-top:0.75rem"><tr><th></th><th>Stab</th><th>Slash</th><th>Crush</th><th>Magic</th><th>Ranged</th></tr>
        <tr><td>Defence</td>${statCell(def.stab)}${statCell(def.slash)}${statCell(def.crush)}${statCell(def.magic)}${statCell(def.ranged)}</tr></table>`;
    }

    if (!html) return `<p class="results-meta">No offensive/defensive bonuses listed.</p>`;
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

  function renderDetail(monster) {
    const root = G.el("monsterDetailRoot");
    if (!root || !monster) return;

    const badge = monster.members
      ? '<span class="badge badge-members">P2P</span>'
      : '<span class="badge badge-f2p">F2P</span>';
    const attackTypes = monster.attackTypes?.length
      ? monster.attackTypes.map((t) => G.escapeHtml(t)).join(", ")
      : "—";

    document.title = `${monster.name} — Graardor`;
    G.el("monsterPageTitle").textContent = monster.name;

    root.innerHTML = `
      <article class="monster-detail">
        <header class="item-detail-hero monster-detail-hero">
          <div class="monster-icon-placeholder" aria-hidden="true">👹</div>
          <div class="item-detail-hero-text">
            <h1>${G.escapeHtml(monster.name)} ${badge}</h1>
            <p class="results-meta">${G.escapeHtml(monster.examine || "")}</p>
            <div class="item-detail-actions">
              <a href="${wikiUrl(monster)}" target="_blank" rel="noopener">Wiki ↗</a>
              <a href="/tools/boss">Boss GP/hr</a>
              <a href="/tools/prep">Boss prep</a>
            </div>
          </div>
        </header>

        <div class="item-detail-grid">
          <section class="lookup-card monster-overview-card">
            <h2>Overview</h2>
            <div class="stat-grid">
              <div class="stat-card"><span class="label">Combat level</span><span class="value">${monster.combatLevel}</span></div>
              <div class="stat-card"><span class="label">Hitpoints</span><span class="value">${monster.hitpoints}</span></div>
              <div class="stat-card"><span class="label">Max hit</span><span class="value">${monster.maxHit || "—"}</span></div>
              <div class="stat-card"><span class="label">Attack speed</span><span class="value">${monster.attackSpeed || "—"}</span></div>
              <div class="stat-card"><span class="label">Attack style</span><span class="value monster-stat-text">${attackTypes}</span></div>
              <div class="stat-card"><span class="label">Attributes</span><span class="value monster-stat-text">${formatList(monster.attributes)}</span></div>
            </div>
          </section>
          ${renderSlayerCard(monster)}
        </div>

        <section class="lookup-card monster-stats-card">
          <h2>Combat levels</h2>
          ${renderLevelsTable(monster.levels || {})}
        </section>

        <section class="lookup-card monster-stats-card">
          <h2>Offence &amp; defence bonuses</h2>
          ${renderOffenceDefence(monster)}
          <p class="lookup-card-foot">Bundled game data · <code>npm run build:monsters-meta</code></p>
        </section>
      </article>`;
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
      const bundle = await loadMonstersMeta();
      G.updateStatus(
        "monsterStatus",
        `${bundle.count.toLocaleString()} monsters loaded`,
        "ok"
      );

      if (queryParam) renderLookup(bundle, queryParam);

      if (!monsterId || !findMonsterById(bundle, monsterId)) {
        if (params.get("id")) {
          G.el("monsterDetailRoot").innerHTML =
            '<p class="loading">Unknown monster ID. Search below.</p>';
        }
        return;
      }

      renderDetail(findMonsterById(bundle, monsterId));
    } catch (err) {
      G.updateStatus("monsterStatus", `Failed: ${err.message}`, "error");
      G.el("monsterDetailRoot").innerHTML = `<p class="loading">${G.escapeHtml(err.message)}</p>`;
    }
  }

  init();
})(window.Graardor);
