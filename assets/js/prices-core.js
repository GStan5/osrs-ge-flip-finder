window.Graardor = window.Graardor || {};

(function (G) {
  G.API_BASE = "https://prices.runescape.wiki/api/v1/osrs";
  G.USER_AGENT = "Graardor - osrs companion tools (graardor.com)";
  G.WIKI_IMG = "https://oldschool.runescape.wiki/images/";
  G.WIKI_PAGE_BASE = "https://oldschool.runescape.wiki/w/";
  G.GE_TAX_RATE = 0.02;
  G.GE_TAX_CAP = 5_000_000;
  G.GE_TAX_EXEMPT_BELOW = 100;
  G.BOND_ID = 13190;
  G.NATURE_RUNE_ID = 561;

  G.cachedApiData = null;
  G.pricesLoadedAt = null;

  G.el = (id) => document.getElementById(id);

  G.fetchJson = async function fetchJson(path) {
    const res = await fetch(`${G.API_BASE}${path}`, {
      headers: { "User-Agent": G.USER_AGENT },
    });
    if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
    return res.json();
  };

  G.loadPrices = async function loadPrices() {
    const [mapping, latestRes, hourlyRes, fiveMinRes] = await Promise.all([
      G.fetchJson("/mapping"),
      G.fetchJson("/latest"),
      G.fetchJson("/1h"),
      G.fetchJson("/5m"),
    ]);

    G.cachedApiData = {
      mapping,
      latest: latestRes.data,
      hourly: hourlyRes.data,
      fiveMin: fiveMinRes.data,
    };
    G.pricesLoadedAt = new Date();
    return G.cachedApiData;
  };

  G.iconUrl = function iconUrl(filename) {
    if (!filename) return "";
    return G.WIKI_IMG + encodeURIComponent(filename.replace(/ /g, "_"));
  };

  G.wikiPageUrl = function wikiPageUrl(name) {
    return G.WIKI_PAGE_BASE + encodeURIComponent(name.replace(/ /g, "_"));
  };

  G.formatGp = function formatGp(n) {
    if (n == null || !Number.isFinite(n)) return "—";
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return Math.round(n).toLocaleString();
  };

  G.formatPrice = function formatPrice(n) {
    if (n == null || !Number.isFinite(n)) return "—";
    return Math.round(n).toLocaleString();
  };

  G.escapeHtml = function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  G.calcGeTax = function calcGeTax(sellPrice, itemId) {
    if (sellPrice == null || !Number.isFinite(sellPrice)) return 0;
    if (itemId === G.BOND_ID) return 0;
    if (sellPrice < G.GE_TAX_EXEMPT_BELOW) return 0;
    return Math.min(Math.floor(sellPrice * G.GE_TAX_RATE), G.GE_TAX_CAP);
  };

  G.getItemPrice = function getItemPrice(itemId) {
    if (!G.cachedApiData) return null;
    const mapping = G.cachedApiData.mapping.find((m) => m.id === itemId);
    const latest = G.cachedApiData.latest[itemId];
    if (!mapping || !latest) return null;
    return {
      id: itemId,
      name: mapping.name,
      icon: mapping.icon,
      members: mapping.members,
      limit: mapping.limit ?? 0,
      value: mapping.value ?? 0,
      highalch: mapping.highalch ?? 0,
      buy: latest.low,
      sell: latest.high,
    };
  };

  G.showToast = function showToast(message) {
    const node = G.el("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(G._toastTimer);
    G._toastTimer = setTimeout(() => node.classList.remove("show"), 1800);
  };

  G.copyText = function copyText(text, successMessage) {
    const value = String(text);
    const onSuccess = () => G.showToast(successMessage);
    const onFail = () => G.showToast("Could not copy — try again");

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(onSuccess, onFail);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      onSuccess();
    } catch {
      onFail();
    }
    document.body.removeChild(textarea);
  };

  G.bindPriceCopy = function bindPriceCopy() {
    document.addEventListener("click", (e) => {
      const copyNode = e.target.closest("[data-copy-price]");
      if (!copyNode) return;
      G.copyText(copyNode.dataset.copyPrice, `Copied ${Number(copyNode.dataset.copyPrice).toLocaleString()} gp`);
    });
  };

  G.itemNameCell = function itemNameCell(item) {
    const badge = item.members
      ? '<span class="badge badge-members">P2P</span>'
      : '<span class="badge badge-f2p">F2P</span>';
    return `<td class="col-item"><div class="item-cell">
      <img src="${G.iconUrl(item.icon)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />
      <a class="item-name" href="${G.wikiPageUrl(item.name)}" target="_blank" rel="noopener">${G.escapeHtml(item.name)}</a>${badge}
    </div></td>`;
  };

  G.updateStatus = function updateStatus(nodeId, message, type) {
    const node = G.el(nodeId);
    if (!node) return;
    node.textContent = message;
    node.className = type || "";
  };
})(window.Graardor);
