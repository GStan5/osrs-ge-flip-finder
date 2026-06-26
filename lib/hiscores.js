const HISCORE_BASE = "https://secure.runescape.com/m=hiscore_oldschool";

const GAME_MODES = {
  main: "",
  ironman: "_ironman",
  hardcore: "_hardcore_ironman",
  ultimate: "_ultimate",
};

async function fetchHiscores(username, mode = "main") {
  const suffix = GAME_MODES[mode] ?? "";
  const url = `${HISCORE_BASE}${suffix}/index_lite.json?player=${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Graardor - osrs companion tools (graardor.com)" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Could not fetch hiscores");
  const data = await res.json();
  return parseCombatStats(data);
}

function parseCombatStats(data) {
  const byName = {};
  for (const s of data.skills || []) {
    byName[s.name.toLowerCase()] = s;
  }
  const lvl = (name) => {
    const s = byName[name];
    return s && s.level > 0 ? s.level : 1;
  };
  return {
    username: data.name,
    attack: lvl("attack"),
    strength: lvl("strength"),
    defence: lvl("defence"),
    ranged: lvl("ranged"),
    magic: lvl("magic"),
    hitpoints: lvl("hitpoints"),
    prayer: lvl("prayer"),
    combatLevel: estimateCombatLevel({
      attack: lvl("attack"),
      strength: lvl("strength"),
      defence: lvl("defence"),
      ranged: lvl("ranged"),
      magic: lvl("magic"),
      hitpoints: lvl("hitpoints"),
      prayer: lvl("prayer"),
    }),
    fetchedAt: new Date().toISOString(),
  };
}

function estimateCombatLevel(s) {
  const base =
    0.25 * (s.defence + s.hitpoints + Math.floor(s.prayer / 2)) +
    0.325 * (s.ranged + s.magic) +
    0.325 * Math.max(s.attack + s.strength, Math.floor(1.5 * Math.max(s.ranged, s.magic)));
  return Math.floor(base);
}

module.exports = { fetchHiscores, parseCombatStats, estimateCombatLevel };
