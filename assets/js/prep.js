(function (G) {
  let bosses = [];
  const STORAGE = "graardor_prep_checks_v1";

  function loadChecks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE) || "{}");
    } catch {
      return {};
    }
  }

  function saveChecks(data) {
    localStorage.setItem(STORAGE, JSON.stringify(data));
  }

  function render() {
    const id = G.el("prepSelect")?.value;
    const boss = bosses.find((b) => b.id === id);
    const root = G.el("prepResults");
    if (!boss || !root) return;

    const checks = loadChecks();
    const key = boss.id;
    if (!checks[key]) checks[key] = {};
    const state = checks[key];

    const sections = [
      { title: "Gear", items: boss.gear },
      { title: "Inventory", items: boss.inventory },
    ];

    root.innerHTML = `
      <p class="results-meta">${boss.tips.map((t) => G.escapeHtml(t)).join(" · ")}</p>
      ${sections
        .map(
          (sec) => `<section class="prep-section">
        <h2>${sec.title}</h2>
        <ul class="prep-checklist">
          ${sec.items
            .map((item, i) => {
              const ck = `${sec.title}-${i}`;
              const checked = state[ck] ? "checked" : "";
              return `<li><label><input type="checkbox" data-key="${ck}" ${checked} /> ${G.escapeHtml(item)}</label></li>`;
            })
            .join("")}
        </ul>
      </section>`
        )
        .join("")}
      <p><a class="btn-secondary" href="${G.wikiPageUrl(boss.wiki)}" target="_blank" rel="noopener">Open wiki guide ↗</a>
      <button type="button" id="resetPrepBtn" class="btn-secondary" style="margin-left:0.5rem;">Reset checklist</button></p>`;

    root.querySelectorAll("input[type=checkbox]").forEach((box) => {
      box.addEventListener("change", () => {
        state[box.dataset.key] = box.checked;
        saveChecks(checks);
      });
    });

    G.el("resetPrepBtn")?.addEventListener("click", () => {
      checks[key] = {};
      saveChecks(checks);
      render();
    });
  }

  async function init() {
    const res = await fetch("/data/boss-prep.json");
    bosses = (await res.json()).bosses;
    G.el("prepSelect").innerHTML = bosses
      .map((b) => `<option value="${b.id}">${G.escapeHtml(b.name)}</option>`)
      .join("");
    G.el("prepSelect").addEventListener("change", render);
    render();
  }

  init();
})(window.Graardor);
