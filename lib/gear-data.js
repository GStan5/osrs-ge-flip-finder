const { readFileSync } = require("fs");
const { join } = require("path");

const ROOT = join(__dirname, "..");
const cache = {};

function loadJson(name) {
  if (!cache[name]) {
    cache[name] = JSON.parse(readFileSync(join(ROOT, "data", name), "utf8"));
  }
  return cache[name];
}

function getItemsMeta() {
  return loadJson("items-meta.json");
}

function getMonstersMeta() {
  return loadJson("monsters-meta.json");
}

function getPrayersMeta() {
  return loadJson("prayers-meta.json");
}

function getUpgradePools() {
  return loadJson("gear-upgrade-pools.json");
}

function getMonster(id) {
  return getMonstersMeta()?.monsters?.[String(id)] ?? null;
}

async function fetchGePrices() {
  const res = await fetch("https://prices.runescape.wiki/api/v1/osrs/latest", {
    headers: { "User-Agent": "Graardor - osrs companion tools (graardor.com)" },
  });
  if (!res.ok) throw new Error("Could not fetch GE prices");
  const json = await res.json();
  return json.data || {};
}

function priceLookup(latest, itemId) {
  const row = latest?.[itemId];
  if (!row) return null;
  return row.high ?? row.low ?? null;
}

module.exports = {
  getItemsMeta,
  getMonstersMeta,
  getPrayersMeta,
  getUpgradePools,
  getMonster,
  fetchGePrices,
  priceLookup,
};
