(function (G) {
  G.SYNC_KEYS = {
    favorites: "osrs-ge-flip-favorites-v1",
    recipeFavorites: "osrs-ge-flip-recipe-favorites-v1",
    flipLog: "graardor_flip_log_v1",
    presets: "graardor_presets_v1",
  };

  G.aggregateOptIn = function aggregateOptIn() {
    return localStorage.getItem("graardor_aggregate_opt_in") === "1";
  };

  G.setAggregateOptIn = function setAggregateOptIn(on) {
    localStorage.setItem("graardor_aggregate_opt_in", on ? "1" : "0");
  };

  G.postAggregate = async function postAggregate(itemName, profit, itemId) {
    if (!G.aggregateOptIn()) return;
    try {
      await fetch("/api/aggregates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName, profit, itemId, optIn: true }),
      });
    } catch {
      /* optional */
    }
  };

  let syncReady = false;
  let loggedIn = false;

  function mergeArrayKey(localKey, remoteData) {
    if (!Array.isArray(remoteData)) return;
    try {
      const local = JSON.parse(localStorage.getItem(localKey) || "[]");
      const merged = [...new Set([...local.map(String), ...remoteData.map(String)])];
      localStorage.setItem(localKey, JSON.stringify(merged));
    } catch {
      localStorage.setItem(localKey, JSON.stringify(remoteData));
    }
  }

  function mergeLogKey(localKey, remoteData) {
    if (!Array.isArray(remoteData)) return;
    try {
      const local = JSON.parse(localStorage.getItem(localKey) || "[]");
      const byKey = new Map();
      for (const row of local) byKey.set(`${row.at}-${row.itemName}`, row);
      for (const row of remoteData) byKey.set(`${row.at}-${row.itemName}`, row);
      const merged = [...byKey.values()].sort((a, b) => a.at - b.at).slice(-500);
      localStorage.setItem(localKey, JSON.stringify(merged));
    } catch {
      localStorage.setItem(localKey, JSON.stringify(remoteData));
    }
  }

  G.pushSync = async function pushSync(key, data) {
    if (!loggedIn) return;
    try {
      await fetch("/api/sync", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, data }),
      });
    } catch {
      /* silent */
    }
  };

  G.saveLocalAndSync = function saveLocalAndSync(key, data) {
    localStorage.setItem(key, typeof data === "string" ? data : JSON.stringify(data));
    G.pushSync(key, typeof data === "string" ? JSON.parse(data) : data);
  };

  async function pullRemote() {
    const res = await fetch("/api/sync", { credentials: "same-origin" });
    if (!res.ok) return;
    const json = await res.json();
    const sync = json.sync || {};

    if (sync[G.SYNC_KEYS.favorites]?.data) {
      mergeArrayKey(G.SYNC_KEYS.favorites, sync[G.SYNC_KEYS.favorites].data);
    }
    if (sync[G.SYNC_KEYS.recipeFavorites]?.data) {
      mergeArrayKey(G.SYNC_KEYS.recipeFavorites, sync[G.SYNC_KEYS.recipeFavorites].data);
    }
    if (sync[G.SYNC_KEYS.flipLog]?.data) {
      mergeLogKey(G.SYNC_KEYS.flipLog, sync[G.SYNC_KEYS.flipLog].data);
    }
  }

  G.initSync = async function initSync() {
    if (syncReady) return loggedIn;
    syncReady = true;
    try {
      const me = await fetch("/api/me", { credentials: "same-origin" });
      const data = await me.json();
      loggedIn = Boolean(data.user);
      if (loggedIn) await pullRemote();
    } catch {
      loggedIn = false;
    }
    return loggedIn;
  };

  document.addEventListener("DOMContentLoaded", () => {
    G.initSync();
  });
})(window.Graardor = window.Graardor || {});
