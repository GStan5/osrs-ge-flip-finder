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
  G.pricesMeta = { tsHour: null, ts5m: null, fromCache: false };

  const CACHE_DB = "graardor-prices-v1";
  const CACHE_STORE = "bundles";
  const CACHE_KEY = "latest";
  /** Background revalidation only updates stored cache — not live UI — after this age. */
  G.PRICE_CACHE_STALE_MS = 24 * 60 * 60 * 1000;

  let inflightLoad = null;
  let idbPromise = null;

  G.el = (id) => document.getElementById(id);

  function openPriceDb() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in globalThis)) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(CACHE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return idbPromise;
  }

  async function readPriceCache() {
    try {
      const db = await openPriceDb();
      if (!db) return null;
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, "readonly");
        const req = tx.objectStore(CACHE_STORE).get(CACHE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async function writePriceCache(entry) {
    try {
      const db = await openPriceDb();
      if (!db) return;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, "readwrite");
        tx.objectStore(CACHE_STORE).put(entry, CACHE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      /* cache is optional */
    }
  }

  function asDate(value) {
    if (!value) return null;
    return value instanceof Date ? value : new Date(value);
  }

  function applyBundle(bundle, meta) {
    G.cachedApiData = bundle;
    G.pricesLoadedAt = meta.savedAt ? new Date(meta.savedAt) : new Date();
    G.pricesMeta = {
      tsHour: asDate(meta.tsHour),
      ts5m: asDate(meta.ts5m),
      fromCache: Boolean(meta.fromCache),
    };
  }

  G.fetchJson = async function fetchJson(path) {
    const res = await fetch(`${G.API_BASE}${path}`, {
      headers: { "User-Agent": G.USER_AGENT },
    });
    if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
    return res.json();
  };

  async function fetchPriceBundle() {
    const [mappingRes, latestRes, hourlyRes, fiveMinRes] = await Promise.all([
      G.fetchJson("/mapping"),
      G.fetchJson("/latest"),
      G.fetchJson("/1h"),
      G.fetchJson("/5m"),
    ]);

    const bundle = {
      mapping: mappingRes,
      latest: latestRes.data,
      hourly: hourlyRes.data,
      fiveMin: fiveMinRes.data,
    };

    const savedAt = new Date().toISOString();
    const meta = {
      savedAt,
      tsHour: hourlyRes.timestamp ? new Date(hourlyRes.timestamp * 1000) : null,
      ts5m: fiveMinRes.timestamp ? new Date(fiveMinRes.timestamp * 1000) : null,
      fromCache: false,
    };

    applyBundle(bundle, meta);
    await writePriceCache({ bundle, ...meta });
    return bundle;
  }

  function scheduleBackgroundRevalidate(savedAt) {
    if (!savedAt) return;
    const age = Date.now() - new Date(savedAt).getTime();
    if (age < G.PRICE_CACHE_STALE_MS) return;
    fetchPriceBundle().catch(() => {
      /* keep showing cached prices */
    });
  }

  /**
   * Load OSRS Wiki price bundle.
   * @param {{ useCache?: boolean, force?: boolean }} [options]
   * useCache — read IndexedDB / memory before network (default true)
   * force — ignore cache and fetch fresh (Refresh prices buttons)
   */
  G.loadPrices = async function loadPrices(options) {
    const opts = options || {};
    const useCache = opts.useCache !== false;
    const force = Boolean(opts.force);

    if (!force && useCache && G.cachedApiData) {
      return G.cachedApiData;
    }

    if (inflightLoad && !force) {
      return inflightLoad;
    }

    const run = async () => {
      if (!force && useCache) {
        const cached = await readPriceCache();
        if (cached?.bundle) {
          applyBundle(cached.bundle, { ...cached, fromCache: true });
          scheduleBackgroundRevalidate(cached.savedAt);
          return G.cachedApiData;
        }
      }

      try {
        return await fetchPriceBundle();
      } catch (err) {
        const cached = await readPriceCache();
        if (cached?.bundle) {
          applyBundle(cached.bundle, { ...cached, fromCache: true });
          return G.cachedApiData;
        }
        throw err;
      }
    };

    inflightLoad = run().finally(() => {
      inflightLoad = null;
    });
    return inflightLoad;
  };

  G.iconUrl = function iconUrl(filename) {
    if (!filename) return "";
    return G.WIKI_IMG + encodeURIComponent(filename.replace(/ /g, "_"));
  };

  G.wikiPageUrl = function wikiPageUrl(name) {
    return G.WIKI_PAGE_BASE + encodeURIComponent(name.replace(/ /g, "_"));
  };

  G.itemPageUrl = function itemPageUrl(id) {
    return `/tools/item?id=${id}`;
  };

  G.fetchTimeseries = async function fetchTimeseries(itemId, timestep) {
    const step = timestep || "5m";
    const res = await G.fetchJson(`/timeseries?timestep=${step}&id=${itemId}`);
    return res.data || [];
  };

  G.drawPriceSparkline = function drawPriceSparkline(canvas, series, options) {
    if (!canvas || !series?.length) return;
    const opts = options || {};
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 80;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const tail = series.slice(-Math.min(series.length, opts.maxPoints || 72));
    const highs = tail.map((p) => p.avgHighPrice).filter((v) => v != null);
    const lows = tail.map((p) => p.avgLowPrice).filter((v) => v != null);
    const all = highs.concat(lows);
    if (!all.length) return;

    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.08 || 1;
    const yMin = min - pad;
    const yMax = max + pad;
    const plotW = width - 8;
    const plotH = height - 8;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(201, 162, 39, 0.06)";
    ctx.fillRect(4, 4, plotW, plotH);

    function drawLine(values, color) {
      const pts = [];
      tail.forEach((row, i) => {
        const val = values === "high" ? row.avgHighPrice : row.avgLowPrice;
        if (val == null) return;
        const x = 4 + (i / Math.max(tail.length - 1, 1)) * plotW;
        const y = 4 + plotH - ((val - yMin) / (yMax - yMin)) * plotH;
        pts.push({ x, y });
      });
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }

    drawLine("high", "#5cb85c");
    drawLine("low", "#6ba3c7");
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

  G.formatDuration = function formatDuration(hours) {
    if (hours == null || !Number.isFinite(hours) || hours <= 0) return "—";
    if (hours < 1 / 60) return "< 1m";
    const totalMinutes = Math.round(hours * 60);
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  G.effectiveHourlyRate = function effectiveHourlyRate(vol5m, volHour) {
    const rate5m = vol5m > 0 ? vol5m * 12 : 0;
    if (rate5m > 0 && volHour > 0) return rate5m * 0.65 + volHour * 0.35;
    if (rate5m > 0) return rate5m;
    return volHour;
  };

  G.hoursToFillQty = function hoursToFillQty(qty, ratePerHour) {
    if (!qty || !ratePerHour || ratePerHour <= 0) return null;
    return qty / ratePerHour;
  };

  /** How many recipe cycles fit within GE buy limits (bottleneck input). */
  G.calcTransformBatchCycles = function calcTransformBatchCycles(inputs) {
    if (!inputs?.length) return 1;
    let cycles = Infinity;
    for (const input of inputs) {
      const lim = input.limit ?? 0;
      const qty = input.qty ?? 1;
      if (lim <= 0 || qty <= 0) continue;
      cycles = Math.min(cycles, Math.floor(lim / qty));
    }
    return Number.isFinite(cycles) && cycles > 0 ? cycles : 1;
  };

  /**
   * Scale transform profit/timing to a full GE-limit batch (buy inputs → transform → sell outputs).
   * Uses effectiveHourlyRate (65% 5m + 35% 1h) via per-item buyRateHour / sellRateHour on the row.
   */
  G.enrichTransformRecipeRow = function enrichTransformRecipeRow(row) {
    const batchCycles = G.calcTransformBatchCycles(row.inputs);

    const inputs = row.inputs.map((input) => {
      const batchQty = input.qty * batchCycles;
      return {
        ...input,
        limit: input.limit ?? 0,
        batchQty,
        buyTimeHours: G.hoursToFillQty(batchQty, input.buyRateHour),
      };
    });

    const outputs = row.outputs.map((output) => {
      const batchQty = output.qty * batchCycles;
      return {
        ...output,
        batchQty,
        sellTimeHours: G.hoursToFillQty(batchQty, output.sellRateHour),
      };
    });

    const buyTimes = inputs.map((i) => i.buyTimeHours).filter((t) => t != null && t > 0);
    const sellTimes = outputs.map((o) => o.sellTimeHours).filter((t) => t != null && t > 0);
    const buyTimeHours = buyTimes.length ? Math.max(...buyTimes) : null;
    const sellTimeHours = sellTimes.length ? Math.max(...sellTimes) : null;
    const cycleHours =
      buyTimeHours != null && sellTimeHours != null ? buyTimeHours + sellTimeHours : null;

    const buyCost = row.buyCost * batchCycles;
    const sellValue = row.sellValue * batchCycles;
    const profit = row.profit * batchCycles;
    const gpPerHour = cycleHours && cycleHours > 0 ? profit / cycleHours : null;

    let inputLimit = null;
    let limitingInputName = null;
    if (row.inputs.length) {
      let minCycles = Infinity;
      for (const input of row.inputs) {
        const lim = input.limit ?? 0;
        const qty = input.qty ?? 1;
        if (lim <= 0 || qty <= 0) continue;
        const cycles = Math.floor(lim / qty);
        if (cycles <= minCycles) {
          minCycles = cycles;
          inputLimit = lim;
          limitingInputName = input.name;
        }
      }
      if (inputLimit == null) inputLimit = row.inputs[0].limit ?? null;
    }

    const vols5m = inputs.map((i) => i.volume5m).filter((v) => v != null);
    const dailies = inputs.map((i) => i.dailyVolume).filter((v) => v != null);

    return {
      ...row,
      inputs,
      outputs,
      batchCycles,
      inputLimit,
      limitingInputName,
      buyCost,
      sellValue,
      profit,
      marginPct: buyCost > 0 ? (profit / buyCost) * 100 : null,
      gpNeeded: buyCost,
      buyTimeHours,
      sellTimeHours,
      cycleHours,
      gpPerHour,
      minVolume5m: vols5m.length ? Math.min(...vols5m) : null,
      minDailyVolume: dailies.length ? Math.min(...dailies) : null,
    };
  };

  G.parseFilterNum = function parseFilterNum(id) {
    const input = G.el(id);
    if (!input) return null;
    const v = input.value.trim();
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  G.withinMinuteRange = function withinMinuteRange(hours, minMinutes, maxMinutes) {
    if (minMinutes == null && maxMinutes == null) return true;
    if (hours == null || !Number.isFinite(hours) || hours <= 0) return false;
    const minutes = hours * 60;
    if (minMinutes != null && minutes < minMinutes) return false;
    if (maxMinutes != null && minutes > maxMinutes) return false;
    return true;
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

    const hourly = G.cachedApiData.hourly[itemId];
    const fiveMin = G.cachedApiData.fiveMin[itemId];
    const buyVolHour = hourly?.lowPriceVolume ?? 0;
    const sellVolHour = hourly?.highPriceVolume ?? 0;
    const buyVol5m = fiveMin?.lowPriceVolume ?? 0;
    const sellVol5m = fiveMin?.highPriceVolume ?? 0;
    const volume5m = buyVol5m + sellVol5m;
    const buyRateHour = G.effectiveHourlyRate(buyVol5m, buyVolHour);
    const sellRateHour = G.effectiveHourlyRate(sellVol5m, sellVolHour);
    const dailyVolume = (buyRateHour + sellRateHour) * 24;

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
      volume5m,
      dailyVolume,
      buyRateHour,
      sellRateHour,
    };
  };

  G.itemTitleAttr = function itemTitleAttr(name) {
    return ` title="${G.escapeHtml(name)}"`;
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

  G.updateStatus = function updateStatus(nodeId, message, type) {
    const node = G.el(nodeId);
    if (!node) return;
    node.textContent = message;
    node.className = type || "";
  };

  G.tableSkeletonRows = function tableSkeletonRows(cols, rows) {
    const n = Math.max(1, rows || 8);
    const c = Math.max(1, cols || 6);
    let html = "";
    for (let r = 0; r < n; r++) {
      html += '<tr class="skeleton-row">';
      for (let i = 0; i < c; i++) {
        const w = i === 0 ? "85%" : i === c - 1 ? "45%" : "65%";
        html += `<td><span class="loading-skeleton" style="width:${w}"></span></td>`;
      }
      html += "</tr>";
    }
    return html;
  };

  G.applyTableSkeleton = function applyTableSkeleton(tbodyId, cols, rows) {
    const tb = G.el(tbodyId);
    if (!tb) return;
    if (typeof G.itemListSkeletonRows === "function") {
      tb.innerHTML = G.itemListSkeletonRows(cols, rows);
      return;
    }
    tb.innerHTML = G.tableSkeletonRows(cols, rows);
  };

  G.onCacheReady = function onCacheReady(fn) {
    if (typeof fn !== "function") return;
    if (G.cachedApiData) {
      fn(G.cachedApiData);
      return;
    }
    G._cacheReadyQueue = G._cacheReadyQueue || [];
    G._cacheReadyQueue.push(fn);
  };

  function dispatchCacheReady() {
    const queue = G._cacheReadyQueue || [];
    G._cacheReadyQueue = [];
    queue.forEach((fn) => {
      try {
        fn(G.cachedApiData);
      } catch {
        /* optional hook */
      }
    });
  }

  G.warmPriceCache = function warmPriceCache() {
    if (G.cachedApiData || G._cacheWarmStarted) return;
    G._cacheWarmStarted = true;
    readPriceCache()
      .then((cached) => {
        if (cached?.bundle && !G.cachedApiData) {
          applyBundle(cached.bundle, { ...cached, fromCache: true });
          dispatchCacheReady();
        }
      })
      .catch(() => {});
  };

  G.warmPriceCache();
})(window.Graardor);
