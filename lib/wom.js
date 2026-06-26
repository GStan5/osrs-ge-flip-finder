const WOM_BASE = "https://api.wiseoldman.net/v2";
const UA = "Graardor - osrs companion tools (graardor.com)";

async function fetchPlayer(username) {
  const res = await fetch(`${WOM_BASE}/players/${encodeURIComponent(username.toLowerCase())}`, {
    headers: { "User-Agent": UA },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Could not reach Wise Old Man");
  return res.json();
}

/**
 * WOM tracks skills/bosses, not worn gear. If equipment appears in a future
 * API version, map slot names to our gear slots here.
 */
const WOM_SLOT_MAP = {
  head: "head",
  cape: "cape",
  amulet: "amulet",
  neck: "amulet",
  weapon: "weapon",
  body: "body",
  legs: "legs",
  shield: "shield",
  gloves: "gloves",
  hands: "gloves",
  boots: "boots",
  feet: "boots",
  ring: "ring",
  ammo: "ammo",
};

function extractEquipment(playerData) {
  const raw =
    playerData?.equipment ||
    playerData?.gear ||
    playerData?.latestSnapshot?.equipment ||
    playerData?.latestSnapshot?.data?.equipment;
  if (!raw || typeof raw !== "object") return null;

  const slots = {};
  for (const [key, val] of Object.entries(raw)) {
    const slot = WOM_SLOT_MAP[key.toLowerCase()];
    if (!slot) continue;
    const id = typeof val === "object" ? val.id : val;
    if (id) slots[slot] = Number(id);
  }
  return Object.keys(slots).length ? slots : null;
}

module.exports = { fetchPlayer, extractEquipment };
