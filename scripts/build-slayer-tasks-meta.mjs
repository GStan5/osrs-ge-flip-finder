#!/usr/bin/env node
/**
 * Build bundled slayer task guides for /tools/slayer.
 * Validates item IDs against data/items-meta.json at build time.
 *
 * Usage: npm run build:slayer-tasks
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "slayer-tasks-meta.json");
const ITEMS = JSON.parse(readFileSync(join(ROOT, "data/items-meta.json"), "utf8")).items;
const MONSTERS = JSON.parse(readFileSync(join(ROOT, "data/monsters-meta.json"), "utf8")).monsters;

const SLOT_KEYS = ["head", "cape", "amulet", "weapon", "body", "legs", "shield", "gloves", "boots", "ring", "ammo"];

/** @type {Record<string, Record<string, number>>} */
const LOADOUTS = {
  meleeBis: {
    head: 24271, cape: 21295, amulet: 19553, weapon: 22324, body: 11832, legs: 11834,
    shield: 22322, gloves: 7462, boots: 13239, ring: 11772,
  },
  meleeMid: {
    head: 24271, cape: 6570, amulet: 6585, weapon: 4151, body: 11832, legs: 11834,
    shield: 12954, gloves: 7462, boots: 11840, ring: 6737,
  },
  meleeBudget: {
    head: 1163, amulet: 1712, weapon: 4587, body: 1127, legs: 1079,
    shield: 12954, gloves: 7462, boots: 3105, ring: 6737,
  },
  meleeDemonBis: {
    head: 24271, cape: 21295, amulet: 19553, weapon: 13271, body: 11832, legs: 11834,
    shield: 22322, gloves: 7462, boots: 13239, ring: 11772,
  },
  meleeDemonMid: {
    head: 24271, cape: 6570, amulet: 6585, weapon: 13271, body: 11832, legs: 11834,
    shield: 12954, gloves: 7462, boots: 11840, ring: 6737,
  },
  meleeDemonBudget: {
    head: 8921, amulet: 1712, weapon: 6526, body: 1127, legs: 1079,
    shield: 12954, gloves: 7462, boots: 3105, ring: 6737,
  },
  meleeCrushBis: {
    head: 24271, cape: 21295, amulet: 19553, weapon: 13263, body: 11832, legs: 11834,
    shield: 22322, gloves: 7462, boots: 13239, ring: 11772,
  },
  meleeCrushMid: {
    head: 24271, cape: 6570, amulet: 6585, weapon: 6526, body: 11832, legs: 11834,
    shield: 12954, gloves: 7462, boots: 11840, ring: 6737,
  },
  meleeCrushBudget: {
    head: 1163, amulet: 1712, weapon: 6526, body: 1127, legs: 1079,
    shield: 12954, gloves: 7462, boots: 3105, ring: 6737,
  },
  meleeLeafBis: {
    head: 11864, cape: 21295, amulet: 19553, weapon: 11905, body: 11832, legs: 11834,
    shield: 22322, gloves: 7462, boots: 13239, ring: 11772,
  },
  meleeLeafMid: {
    head: 11864, cape: 6570, amulet: 6585, weapon: 11905, body: 11832, legs: 11834,
    shield: 12954, gloves: 7462, boots: 11840, ring: 6737,
  },
  meleeLeafBudget: {
    head: 8921, amulet: 1712, weapon: 11905, body: 1127, legs: 1079,
    shield: 12954, gloves: 7462, boots: 3105, ring: 6737,
  },
  meleeBarrage: {
    head: 11804, cape: 6570, amulet: 1712, weapon: 4675, body: 4091, legs: 4093,
    gloves: 7462, boots: 11840, ring: 6737,
  },
  meleeBarrageMid: {
    head: 4712, cape: 6570, amulet: 1712, weapon: 4675, body: 4712, legs: 4714,
    gloves: 7462, boots: 11840, ring: 6737,
  },
  meleeBarrageBudget: {
    head: 4712, cape: 6570, amulet: 1712, weapon: 1409, body: 4091, legs: 4093,
    gloves: 7462, boots: 3105, ring: 6737,
  },
  rangedBis: {
    head: 11826, cape: 21295, amulet: 19547, weapon: 25865, body: 11828, legs: 11830,
    gloves: 7462, boots: 13237, ring: 11772, ammo: 9245,
  },
  rangedMid: {
    head: 11826, cape: 6570, amulet: 6585, weapon: 11838, body: 11828, legs: 11830,
    gloves: 7462, boots: 11836, ring: 6737, ammo: 9243,
  },
  rangedBudget: {
    head: 4732, cape: 6570, amulet: 1712, weapon: 9185, body: 4736, legs: 4730,
    gloves: 7462, boots: 3105, ring: 6737, ammo: 9240,
  },
  rangedDragonBis: {
    head: 11826, cape: 21295, amulet: 19547, weapon: 22978, body: 11828, legs: 11830,
    shield: 1540, gloves: 7462, boots: 13237, ring: 11772, ammo: 9245,
  },
  rangedDragonMid: {
    head: 11826, cape: 6570, amulet: 6585, weapon: 11959, body: 11828, legs: 11830,
    shield: 1540, gloves: 7462, boots: 11836, ring: 6737, ammo: 9243,
  },
  rangedDragonBudget: {
    head: 4732, cape: 6570, amulet: 1712, weapon: 9185, body: 4736, legs: 4730,
    shield: 1540, gloves: 7462, boots: 3105, ring: 6737, ammo: 9240,
  },
  magicBis: {
    head: 11804, cape: 21295, amulet: 19553, weapon: 11791, body: 4712, legs: 4714,
    gloves: 7462, boots: 13239, ring: 11772,
  },
  magicMid: {
    head: 4712, cape: 6570, amulet: 6585, weapon: 11791, body: 4712, legs: 4714,
    gloves: 7462, boots: 11840, ring: 6737,
  },
  magicBudget: {
    head: 4712, cape: 6570, amulet: 1712, weapon: 1409, body: 4091, legs: 4093,
    gloves: 7462, boots: 3105, ring: 6737,
  },
  magicTrident: {
    head: 4712, cape: 6570, amulet: 6585, weapon: 11905, body: 4712, legs: 4714,
    gloves: 7462, boots: 11840, ring: 6737,
  },
  magicTridentMid: {
    head: 4712, cape: 6570, amulet: 6585, weapon: 11905, body: 4091, legs: 4093,
    gloves: 7462, boots: 11840, ring: 6737,
  },
  magicTridentBudget: {
    head: 4712, cape: 6570, amulet: 1712, weapon: 1409, body: 4091, legs: 4093,
    gloves: 7462, boots: 3105, ring: 6737,
  },
  meleeGwd: {
    head: 24271, cape: 21295, amulet: 19553, weapon: 22324, body: 11832, legs: 11834,
    shield: 22322, gloves: 7462, boots: 13239, ring: 11772,
  },
  meleeGwdMid: {
    head: 24271, cape: 6570, amulet: 6585, weapon: 4151, body: 11832, legs: 11834,
    shield: 12954, gloves: 7462, boots: 11840, ring: 6737,
  },
  meleeGwdBudget: {
    head: 1163, amulet: 1712, weapon: 4587, body: 1127, legs: 1079,
    shield: 12954, gloves: 7462, boots: 3105, ring: 6737,
  },
  rangedGwd: {
    head: 11826, cape: 21295, amulet: 19547, weapon: 25865, body: 11828, legs: 11830,
    gloves: 7462, boots: 13237, ring: 11772, ammo: 9245,
  },
  rangedGwdMid: {
    head: 11826, cape: 6570, amulet: 6585, weapon: 11838, body: 11828, legs: 11830,
    gloves: 7462, boots: 11836, ring: 6737, ammo: 9243,
  },
  rangedGwdBudget: {
    head: 4732, cape: 6570, amulet: 1712, weapon: 9185, body: 4736, legs: 4730,
    gloves: 7462, boots: 3105, ring: 6737, ammo: 9240,
  },
  meleeCerb: {
    head: 24271, cape: 21295, amulet: 19553, weapon: 13271, body: 11832, legs: 11834,
    shield: 22322, gloves: 7462, boots: 13239, ring: 11772,
  },
  meleeCerbMid: {
    head: 24271, cape: 6570, amulet: 6585, weapon: 13271, body: 11832, legs: 11834,
    shield: 12954, gloves: 7462, boots: 11840, ring: 6737,
  },
  meleeCerbBudget: {
    head: 8921, amulet: 1712, weapon: 6526, body: 1127, legs: 1079,
    shield: 12954, gloves: 7462, boots: 3105, ring: 6737,
  },
  meleeSmoke: {
    head: 24271, cape: 21295, amulet: 19553, weapon: 13263, body: 11832, legs: 11834,
    shield: 22322, gloves: 7462, boots: 13239, ring: 11772,
  },
  meleeSmokeMid: {
    head: 24271, cape: 6570, amulet: 6585, weapon: 6526, body: 11832, legs: 11834,
    shield: 12954, gloves: 7462, boots: 11840, ring: 6737,
  },
  meleeSmokeBudget: {
    head: 1163, amulet: 1712, weapon: 6526, body: 1127, legs: 1079,
    shield: 12954, gloves: 7462, boots: 3105, ring: 6737,
  },
  meleeHydra: {
    head: 24271, cape: 21295, amulet: 19553, weapon: 22324, body: 11832, legs: 11834,
    shield: 22322, gloves: 7462, boots: 13239, ring: 11772,
  },
  meleeHydraMid: {
    head: 24271, cape: 6570, amulet: 6585, weapon: 4151, body: 11832, legs: 11834,
    shield: 12954, gloves: 7462, boots: 11840, ring: 6737,
  },
  meleeHydraBudget: {
    head: 1163, amulet: 1712, weapon: 4587, body: 1127, legs: 1079,
    shield: 12954, gloves: 7462, boots: 3105, ring: 6737,
  },
  meleeWyvern: {
    head: 24271, cape: 21295, amulet: 19553, weapon: 22978, body: 11832, legs: 11834,
    shield: 22322, gloves: 7462, boots: 13239, ring: 11772,
  },
  meleeWyvernMid: {
    head: 24271, cape: 6570, amulet: 6585, weapon: 11959, body: 11832, legs: 11834,
    shield: 12954, gloves: 7462, boots: 11840, ring: 6737,
  },
  meleeWyvernBudget: {
    head: 1163, amulet: 1712, weapon: 4587, body: 1127, legs: 1079,
    shield: 1540, gloves: 7462, boots: 3105, ring: 6737,
  },
  meleeShaman: {
    head: 24271, cape: 21295, amulet: 19553, weapon: 22324, body: 11832, legs: 11834,
    shield: 22322, gloves: 7462, boots: 13239, ring: 11772,
  },
  meleeShamanMid: {
    head: 24271, cape: 6570, amulet: 6585, weapon: 4151, body: 11832, legs: 11834,
    shield: 12954, gloves: 7462, boots: 11840, ring: 6737,
  },
  meleeShamanBudget: {
    head: 1163, amulet: 1712, weapon: 4587, body: 1127, legs: 1079,
    shield: 12954, gloves: 7462, boots: 3105, ring: 6737,
  },
  meleeObsidian: {
    head: 8921, cape: 6570, amulet: 11128, weapon: 6526, body: 1127, legs: 1079,
    gloves: 7462, boots: 11840, ring: 6737,
  },
  meleeObsidianMid: {
    head: 8921, cape: 6570, amulet: 1712, weapon: 6526, body: 1127, legs: 1079,
    gloves: 7462, boots: 3105, ring: 6737,
  },
  meleeObsidianBudget: {
    head: 8921, amulet: 1712, weapon: 6526, body: 1127, legs: 1079,
    gloves: 7462, boots: 3105, ring: 6737,
  },
};

const PRAYERS = {
  meleeBis: [27],
  meleeMid: [26],
  meleeBudget: [16, 15, 14],
  rangedBis: [28],
  rangedMid: [20],
  rangedBudget: [4],
  magicBis: [29],
  magicMid: [21],
  magicBudget: [5],
};

function gear(bisKey, midKey, entryKey) {
  return { bis: { ...LOADOUTS[bisKey] }, mid: { ...LOADOUTS[midKey] }, entry: { ...LOADOUTS[entryKey] } };
}

function prayers(style) {
  if (style === "ranged") return { bis: PRAYERS.rangedBis, mid: PRAYERS.rangedMid, entry: PRAYERS.rangedBudget };
  if (style === "magic") return { bis: PRAYERS.magicBis, mid: PRAYERS.magicMid, entry: PRAYERS.magicBudget };
  return { bis: PRAYERS.meleeBis, mid: PRAYERS.meleeMid, entry: PRAYERS.meleeBudget };
}

const STYLE_ORDER = ["melee", "ranged", "magic"];

/** Tasks where alternate styles are impractical — short note, empty gear. */
const NOT_RECOMMENDED = {
  410: { ranged: "Leaf-bladed weapons only — melee required.", magic: "Leaf-bladed weapons only — melee required." },
  426: { ranged: "Leaf-bladed weapons only — melee required.", magic: "Leaf-bladed weapons only — melee required." },
  3162: { melee: "Kree'arra is ranged-only.", magic: "Kree'arra is ranged-only." },
};

function gearFromKeys(bisKey, midKey, entryKey) {
  return gear(bisKey, midKey, entryKey);
}

function gearFromLegacy(legacy) {
  return {
    bis: { ...(legacy.bis || {}) },
    mid: { ...(legacy.mid || {}) },
    entry: { ...(legacy.budget || legacy.entry || {}) },
  };
}

function normalizePrayers(raw, style) {
  const p = raw.prayers;
  if (p?.bis && Array.isArray(p.bis)) {
    return {
      bis: [...p.bis],
      mid: [...(p.mid || [])],
      entry: [...(p.budget || p.entry || [])],
    };
  }
  return prayers(style);
}

function getStyleTemplateKeys(raw, style) {
  if (raw.styleOverrides?.[style]) return raw.styleOverrides[style];

  const w = (raw.weakness || "").toLowerCase();
  const n = (raw.name || "").toLowerCase();
  const id = raw.monsterId;

  if (style === "melee") {
    if (w.includes("leaf-bladed")) return ["meleeLeafBis", "meleeLeafMid", "meleeLeafBudget"];
    if (w.includes("crush") || /gargoyle|devil|dust|smoke|night beast|basilisk/.test(n))
      return ["meleeCrushBis", "meleeCrushMid", "meleeCrushBudget"];
    if (w.includes("demon") || /demon|cerberus/.test(n)) return ["meleeDemonBis", "meleeDemonMid", "meleeDemonBudget"];
    if ([2215, 2205, 3129, 2211, 6766].includes(id)) return ["meleeGwd", "meleeGwdMid", "meleeGwdBudget"];
    if (/wyrm|lance/.test(w) || n.includes("wyrm")) return ["meleeWyvern", "meleeWyvernMid", "meleeWyvernBudget"];
    if (/hellhound|bloodveld|fire giant|kalphite|cave horror/.test(n)) return ["meleeMid", "meleeBudget", "meleeBudget"];
    if (id === 7936) return ["meleeObsidian", "meleeObsidianMid", "meleeObsidianBudget"];
    return ["meleeBis", "meleeMid", "meleeBudget"];
  }

  if (style === "ranged") {
    if (/dragon|wyvern|drake|hydra|vorkath|aviansie|kree|adamant dragon|mithril dragon|iron dragon|brutal black/.test(n + w) || w.includes("anti-dragon"))
      return ["rangedDragonBis", "rangedDragonMid", "rangedDragonBudget"];
    if (/gwd|armadyl|dark beast/.test(n + w) || [3162, 3169, 4005].includes(id))
      return ["rangedGwd", "rangedGwdMid", "rangedGwdBudget"];
    return ["rangedBis", "rangedMid", "rangedBudget"];
  }

  if (style === "magic") {
    if (/trident|kraken/.test(n + w)) return ["magicTrident", "magicTridentMid", "magicTridentBudget"];
    if (/burst|barrage|nechryael/.test(n + w)) return ["meleeBarrage", "meleeBarrageMid", "meleeBarrageBudget"];
    return ["magicBis", "magicMid", "magicBudget"];
  }

  return ["meleeBis", "meleeMid", "meleeBudget"];
}

function buildStyleReason(raw, recommendedStyle) {
  if (raw.styleReason) return raw.styleReason;
  const w = (raw.weakness || "").split("·")[0]?.trim();
  const hints = {
    melee: "Strong melee DPS; check crush/slash/stab weakness.",
    ranged: "Safespot or low ranged defence.",
    magic: "Safespot, burst, or low magic defence.",
  };
  return [w, hints[recommendedStyle]].filter(Boolean).join(" · ");
}

function expandTaskGear(raw) {
  const recommendedStyle = raw.recommendedStyle || raw.style || "melee";
  const primaryGear = gearFromLegacy(raw.gear);
  const primaryPrayers = normalizePrayers(raw, recommendedStyle);
  const notRec = { ...(NOT_RECOMMENDED[raw.monsterId] || {}), ...(raw.notRecommended || {}) };

  const gear = {};
  const stylePrayers = {};

  for (const style of STYLE_ORDER) {
    if (style === recommendedStyle) {
      gear[style] = primaryGear;
      stylePrayers[style] = primaryPrayers;
    } else if (notRec[style]) {
      gear[style] = { note: notRec[style], bis: {}, mid: {}, entry: {} };
      stylePrayers[style] = { bis: [], mid: [], entry: [] };
    } else {
      const keys = getStyleTemplateKeys(raw, style);
      gear[style] = gearFromKeys(keys[0], keys[1], keys[2]);
      stylePrayers[style] = prayers(style);
    }
  }

  return { gear, prayers: stylePrayers, recommendedStyle, styleReason: buildStyleReason(raw, recommendedStyle) };
}

/** Curated slayer tasks — extensible list. */
const CURATED = [
  {
    monsterId: 415, name: "Abyssal demon", masters: ["Duradel", "Nieve", "Konar"], style: "melee",
    weakness: "Slash · Arclight / Scythe", bring: ["Food", "Teleport"],
    notes: "Slayer Tower or Catacombs. Burst/barrage in Catacombs for fast XP.",
    skipBlock: "Block if you hate Catacombs traffic; otherwise worth doing.",
    location: "Slayer Tower (top) or Catacombs of Kourend",
    gear: gear("meleeDemonBis", "meleeDemonMid", "meleeDemonBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 2215, name: "General Graardor", masters: ["Konar"], style: "melee",
    weakness: "Stab · Bandos altar room", bring: ["Super restore", "Food", "Ranging or super combat"],
    notes: "Team or solo Bandos. Protect from Melee when tanking.",
    skipBlock: "Skip unless you want Bandos uniques.",
    location: "God Wars Dungeon — Bandos encampment",
    gear: gear("meleeGwd", "meleeGwdMid", "meleeGwdBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 3162, name: "Kree'arra", masters: ["Konar"], style: "ranged",
    weakness: "Ranged · Protect from Missiles", bring: ["Ranging potion", "Food", "Antidote++"],
    notes: "Ranged-only boss. Stand under for melee phase if soloing.",
    skipBlock: "Skip unless chasing Armadyl drops.",
    location: "God Wars Dungeon — Armadyl encampment",
    gear: gear("rangedGwd", "rangedGwdMid", "rangedGwdBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 2205, name: "Commander Zilyana", masters: ["Konar"], style: "melee",
    weakness: "Slash · Protect from Magic", bring: ["Super restore", "Food", "Ranging potion"],
    notes: "Melee or ranged. Bree and Growler hit hard — protect accordingly.",
    skipBlock: "Skip unless chasing Saradomin uniques.",
    location: "God Wars Dungeon — Saradomin encampment",
    gear: gear("meleeGwd", "meleeGwdMid", "meleeGwdBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 3129, name: "K'ril Tsutsaroth", masters: ["Konar"], style: "melee",
    weakness: "Slash · Protect from Magic", bring: ["Super restore", "Food", "Antidote++"],
    notes: "Melee or ranged. Protect from Magic for magic hits.",
    skipBlock: "Skip unless chasing Zamorak uniques.",
    location: "God Wars Dungeon — Zamorak encampment",
    gear: gear("meleeGwd", "meleeGwdMid", "meleeGwdBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 5862, name: "Cerberus", masters: ["Konar", "Duradel"], style: "melee",
    weakness: "Crush · Arclight · Protect from Magic", bring: ["Antidote++", "Super restore", "Food"],
    notes: "Key-gated lair. Watch for poison and ghost attacks.",
    skipBlock: "Worth doing for smouldering stone and uniques.",
    location: "Cerberus Lair (flaxen, glacial, or infernal key)",
    gear: gear("meleeCerb", "meleeCerbMid", "meleeCerbBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 494, name: "Kraken", masters: ["Duradel", "Nieve", "Konar"], style: "magic",
    weakness: "Magic · Trident", bring: ["Food (optional)", "Teleport"],
    notes: "AFK with trident. Whirlpool first, then attack tentacles.",
    skipBlock: "Good AFK task — keep.",
    location: "Kraken Cove",
    gear: gear("magicTrident", "magicTridentMid", "magicTridentBudget"),
    prayers: prayers("magic"),
  },
  {
    monsterId: 499, name: "Thermonuclear smoke devil", masters: ["Duradel", "Nieve", "Konar"], style: "melee",
    weakness: "Crush · Slayer helmet", bring: ["Facemask or slayer helm", "Food"],
    notes: "Face mask required without slayer helm. Smoke devils in cave.",
    skipBlock: "Worth doing for pet and occult necklace.",
    location: "Smoke Devil Dungeon",
    gear: gear("meleeSmoke", "meleeSmokeMid", "meleeSmokeBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 492, name: "Cave kraken", masters: ["Duradel", "Nieve", "Konar"], style: "magic",
    weakness: "Magic · Trident", bring: ["Food (optional)"],
    notes: "Same setup as Kraken task but cave krakens in task area.",
    skipBlock: "Good magic AFK — keep.",
    location: "Kraken Cove",
    gear: gear("magicTrident", "magicTridentMid", "magicTridentBudget"),
    prayers: prayers("magic"),
  },
  {
    monsterId: 4005, name: "Dark beast", masters: ["Duradel", "Konar"], style: "ranged",
    weakness: "Ranged · Protect from Missiles", bring: ["Food", "Ranging potion"],
    notes: "Catacombs or Temple of Light. Ranged only in catacombs path.",
    skipBlock: "Slow but decent XP — skip if crowded.",
    location: "Catacombs of Kourend or Temple of Light",
    gear: gear("rangedBis", "rangedMid", "rangedBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 412, name: "Gargoyle", masters: ["Konar", "Nieve", "Duradel"], style: "melee",
    weakness: "Crush · Rock hammer finisher", bring: ["Rock hammer", "Food"],
    notes: "Use rock hammer below 9 HP. Slayer Tower or Catacombs.",
    skipBlock: "Quick task with good XP.",
    location: "Slayer Tower (top) or Catacombs",
    gear: gear("meleeCrushBis", "meleeCrushMid", "meleeCrushBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 7278, name: "Greater nechryael", masters: ["Duradel", "Nieve", "Konar"], style: "magic",
    styleReason: "Burst/barrage in Catacombs — fastest XP.",
    weakness: "Magic burst/barrage in Catacombs", bring: ["Runes for burst/barrage", "Food"],
    notes: "Burst or barrage in Catacombs. Slayer Tower for melee.",
    skipBlock: "Excellent XP in Catacombs — keep.",
    location: "Slayer Tower or Catacombs of Kourend",
    gear: gear("meleeBarrage", "meleeBarrageMid", "meleeBarrageBudget"),
    prayers: { bis: [29], mid: [21], budget: [5] },
  },
  {
    monsterId: 7279, name: "Deviant spectre", masters: ["Konar"], style: "magic",
    weakness: "Magic · Salve (amulet) in Catacombs", bring: ["Runes", "Food"],
    notes: "Catacombs only. Magic or range; protect from Missiles.",
    skipBlock: "Good XP if you have salve — keep.",
    location: "Catacombs of Kourend",
    gear: gear("magicBis", "magicMid", "magicBudget"),
    prayers: prayers("magic"),
  },
  {
    monsterId: 2, name: "Aberrant spectre", masters: ["Chaeldar", "Nieve", "Duradel"], style: "magic",
    weakness: "Magic · Nose peg or slayer helm", bring: ["Facemask not needed — nose peg"],
    notes: "Magic recommended. Stronghold Slayer Cave or Catacombs.",
    skipBlock: "Decent mid-level task.",
    location: "Stronghold Slayer Cave or Catacombs",
    gear: gear("magicBis", "magicMid", "magicBudget"),
    prayers: prayers("magic"),
  },
  {
    monsterId: 423, name: "Dust devil", masters: ["Chaeldar", "Nieve", "Duradel"], style: "melee",
    weakness: "Crush · Facemask or slayer helm", bring: ["Facemask if no helm"],
    notes: "Smoke Dungeon. Chinchompas for crowd control optional.",
    skipBlock: "Fast task — keep.",
    location: "Smoke Dungeon",
    gear: gear("meleeCrushBis", "meleeCrushMid", "meleeCrushBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 484, name: "Bloodveld", masters: ["Vannaka", "Chaeldar", "Nieve", "Duradel"], style: "melee",
    weakness: "Slash · Slayer Tower", bring: ["Food (low level)"],
    notes: "Easy task. Catacombs for AFK.",
    skipBlock: "Skip on high-level block list.",
    location: "Slayer Tower or Catacombs",
    gear: gear("meleeMid", "meleeBudget", "meleeBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 410, name: "Kurask", masters: ["Nieve", "Duradel", "Konar"], style: "melee",
    weakness: "Leaf-bladed weapons only", bring: ["Leaf-bladed weapon"],
    notes: "Leaf-bladed sword, axe, or battleaxe required.",
    skipBlock: "Skip unless you have leaf-bladed gear.",
    location: "Fremennik Slayer Dungeon",
    gear: gear("meleeLeafBis", "meleeLeafMid", "meleeLeafBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 426, name: "Turoth", masters: ["Chaeldar", "Nieve", "Duradel"], style: "melee",
    weakness: "Leaf-bladed weapons only", bring: ["Leaf-bladed weapon"],
    notes: "Same as Kurask but lower level.",
    skipBlock: "Skip without leaf-bladed gear.",
    location: "Fremennik Slayer Dungeon",
    gear: gear("meleeLeafBis", "meleeLeafMid", "meleeLeafBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 417, name: "Basilisk", masters: ["Vannaka", "Chaeldar", "Nieve"], style: "melee",
    weakness: "Crush · Mirror shield", bring: ["Mirror shield"],
    notes: "Mirror shield required unless using visage setup.",
    skipBlock: "Skip without mirror shield.",
    location: "Fremennik Slayer Dungeon",
    gear: gear("meleeCrushBis", "meleeCrushMid", "meleeCrushBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 1047, name: "Cave horror", masters: ["Nieve", "Duradel", "Konar"], style: "melee",
    weakness: "Slash · Witchwood icon", bring: ["Witchwood icon"],
    notes: "Icon prevents stat drain. Mos Le'Harmless cave.",
    skipBlock: "Black mask drop — worth doing once.",
    location: "Mos Le'Harmless — Cave Horror cave",
    gear: gear("meleeMid", "meleeBudget", "meleeBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 787, name: "Suqah", masters: ["Nieve", "Duradel", "Konar"], style: "melee",
    weakness: "Crush preferred", bring: ["Food", "Teleport"],
    notes: "Lunar Isle. High defence — crush helps.",
    skipBlock: "Skip — awkward location.",
    location: "Lunar Isle",
    gear: gear("meleeCrushBis", "meleeCrushMid", "meleeCrushBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 465, name: "Skeletal wyvern", masters: ["Duradel", "Konar"], style: "ranged",
    weakness: "Ranged · Elemental shield", bring: ["Mind shield or elemental shield", "Antifire if needed"],
    notes: "Asgarnian Ice Dungeon. Protect from Missiles.",
    skipBlock: "Worth doing for visage drop.",
    location: "Asgarnian Ice Dungeon",
    gear: gear("rangedDragonBis", "rangedDragonMid", "rangedDragonBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 6766, name: "Lizardman shaman", masters: ["Konar"], style: "melee",
    weakness: "Ranged safespot or melee", bring: ["Food", "Ranging potion if ranging"],
    notes: "Cannon-friendly in canyon. Jump attack — move off red.",
    skipBlock: "Good for blowpipe/shield drop — keep.",
    location: "Lizardman Canyon or Settlement",
    gear: gear("meleeShaman", "meleeShamanMid", "meleeShamanBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 8610, name: "Wyrm", masters: ["Konar"], style: "melee",
    weakness: "Crush · Dragon hunter lance", bring: ["Food", "Antifire"],
    notes: "Karuulm Slayer Dungeon. Protect from Magic.",
    skipBlock: "Wyrm spike drop — decent task.",
    location: "Karuulm Slayer Dungeon",
    gear: gear("meleeWyvern", "meleeWyvernMid", "meleeWyvernBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 8612, name: "Drake", masters: ["Konar"], style: "ranged",
    weakness: "Ranged · Protect from Missiles", bring: ["Ranging potion", "Food"],
    notes: "Karuulm. Ranged safespot available.",
    skipBlock: "Decent mid-level Konar task.",
    location: "Karuulm Slayer Dungeon",
    gear: gear("rangedDragonBis", "rangedDragonMid", "rangedDragonBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 8609, name: "Hydra", masters: ["Konar"], style: "ranged",
    weakness: "Ranged · Protect from Magic", bring: ["Ranging potion", "Super restore", "Food"],
    notes: "Karuulm. Learn lightning patterns.",
    skipBlock: "High effort — skip unless chasing pet.",
    location: "Karuulm Slayer Dungeon — Hydra lair",
    gear: gear("rangedBis", "rangedMid", "rangedBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 8615, name: "Alchemical Hydra", masters: ["Konar"], style: "ranged",
    weakness: "Ranged · Protect from Magic and Missiles", bring: ["Ranging potion", "Super restore", "Food"],
    notes: "High-level boss. Learn phase transitions.",
    skipBlock: "Boss task — skip unless farming uniques.",
    location: "Karuulm Slayer Dungeon — Alchemical Hydra",
    gear: gear("rangedBis", "rangedMid", "rangedBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 2212, name: "Spiritual mage", masters: ["Duradel", "Konar"], style: "magic",
    weakness: "Magic · Protect from Missiles", bring: ["Food"],
    notes: "God Wars Dungeon. Protect from Missiles.",
    skipBlock: "Skip — crowded and slow.",
    location: "God Wars Dungeon — Zamorak / Saradomin camps",
    gear: gear("magicBis", "magicMid", "magicBudget"),
    prayers: prayers("magic"),
  },
  {
    monsterId: 2211, name: "Spiritual ranger", masters: ["Duradel", "Konar"], style: "melee",
    weakness: "Melee · Protect from Missiles", bring: ["Food", "Super restore"],
    notes: "God Wars Dungeon. Protect from Missiles while closing.",
    skipBlock: "Skip unless farming ecumenical keys.",
    location: "God Wars Dungeon",
    gear: gear("meleeGwd", "meleeGwdMid", "meleeGwdBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 2210, name: "Spiritual warrior", masters: ["Duradel", "Konar"], style: "magic",
    weakness: "Magic · Protect from Melee", bring: ["Food"],
    notes: "God Wars Dungeon. Safespot with magic.",
    skipBlock: "Skip — usually crowded.",
    location: "God Wars Dungeon",
    gear: gear("magicBis", "magicMid", "magicBudget"),
    prayers: prayers("magic"),
  },
  {
    monsterId: 2025, name: "Greater demon", masters: ["Chaeldar", "Nieve", "Duradel", "Konar"], style: "melee",
    weakness: "Slash · Arclight / demonbane", bring: ["Food"],
    notes: "Catacombs for AFK. Chaeldar block candidate.",
    skipBlock: "Block on lower masters.",
    location: "Catacombs, Chasm of Fire, or Demonic Ruins",
    gear: gear("meleeDemonBis", "meleeDemonMid", "meleeDemonBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 240, name: "Black demon", masters: ["Chaeldar", "Nieve", "Duradel", "Konar"], style: "melee",
    weakness: "Slash · Arclight", bring: ["Food"],
    notes: "Catacombs popular. Cannon at Chasm of Fire.",
    skipBlock: "Common block candidate.",
    location: "Catacombs or Chasm of Fire",
    gear: gear("meleeDemonBis", "meleeDemonMid", "meleeDemonBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 7275, name: "Brutal black dragon", masters: ["Duradel", "Konar"], style: "ranged",
    weakness: "Ranged · Anti-dragon shield", bring: ["Antifire potion", "Anti-dragon shield", "Food"],
    notes: "Catacombs. Protect from Magic.",
    skipBlock: "Skip unless farming visage.",
    location: "Catacombs of Kourend",
    gear: gear("rangedDragonBis", "rangedDragonMid", "rangedDragonBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 272, name: "Iron dragon", masters: ["Duradel", "Konar"], style: "ranged",
    weakness: "Ranged · Anti-dragon shield", bring: ["Antifire potion", "Anti-dragon shield"],
    notes: "Catacombs or Brimhaven. Protect from Magic.",
    skipBlock: "Slow — skip if blocked.",
    location: "Catacombs or Brimhaven Dungeon",
    gear: gear("rangedDragonBis", "rangedDragonMid", "rangedDragonBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 2919, name: "Mithril dragon", masters: ["Duradel", "Konar"], style: "ranged",
    weakness: "Ranged · Anti-dragon shield", bring: ["Antifire potion", "Anti-dragon shield", "Food"],
    notes: "Ancient Cavern. Protect from Magic.",
    skipBlock: "Skip — high effort.",
    location: "Ancient Cavern",
    gear: gear("rangedDragonBis", "rangedDragonMid", "rangedDragonBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 8030, name: "Adamant dragon", masters: ["Konar"], style: "ranged",
    weakness: "Ranged · Anti-dragon shield", bring: ["Antifire potion", "Anti-dragon shield", "Super restore"],
    notes: "Lithkren Vault or Catacombs. Protect from Magic.",
    skipBlock: "High effort Konar task.",
    location: "Lithkren Vault",
    gear: gear("rangedDragonBis", "rangedDragonMid", "rangedDragonBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 265, name: "Blue dragon", masters: ["Vannaka", "Chaeldar", "Nieve"], style: "ranged",
    weakness: "Ranged · Anti-dragon shield", bring: ["Antifire potion", "Anti-dragon shield"],
    notes: "Taverley or Catacombs. Protect from Magic.",
    skipBlock: "Block on low-level lists.",
    location: "Taverley Dungeon or Catacombs",
    gear: gear("rangedDragonMid", "rangedDragonBudget", "rangedDragonBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 247, name: "Red dragon", masters: ["Chaeldar", "Nieve", "Duradel"], style: "ranged",
    weakness: "Ranged · Anti-dragon shield", bring: ["Antifire potion", "Anti-dragon shield"],
    notes: "Brimhaven or Catacombs.",
    skipBlock: "Skip unless farming.",
    location: "Brimhaven Dungeon or Catacombs",
    gear: gear("rangedDragonMid", "rangedDragonBudget", "rangedDragonBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 7795, name: "Ancient wyvern", masters: ["Konar"], style: "ranged",
    weakness: "Ranged · Elemental shield", bring: ["Mind shield", "Food", "Super restore"],
    notes: "Wyvern Cave on Fossil Island. Protect from Missiles.",
    skipBlock: "Worth doing for uniques.",
    location: "Wyvern Cave — Fossil Island",
    gear: gear("rangedDragonBis", "rangedDragonMid", "rangedDragonBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 8060, name: "Vorkath", masters: ["Konar"], style: "ranged",
    weakness: "Ranged · Protect from Magic/Prayer", bring: ["Ranging potion", "Super restore", "Anti-venom"],
    notes: "Boss task. Learn acid/spawn mechanics.",
    skipBlock: "Skip unless farming Vorkath.",
    location: "Ungael",
    gear: gear("rangedDragonBis", "rangedMid", "rangedBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 2916, name: "Waterfiend", masters: ["Duradel", "Konar"], style: "ranged",
    weakness: "Ranged or magic", bring: ["Food"],
    notes: "Ancient Cavern or Spirit Realm.",
    skipBlock: "Skip — slow task.",
    location: "Ancient Cavern",
    gear: gear("rangedMid", "rangedBudget", "rangedBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 104, name: "Hellhound", masters: ["Konar", "Duradel"], style: "melee",
    weakness: "Crush · Slayer helmet", bring: ["Food"],
    notes: "Catacombs for AFK. Cannon optional.",
    skipBlock: "Good AFK XP.",
    location: "Catacombs of Kourend",
    gear: gear("meleeMid", "meleeBudget", "meleeBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 2075, name: "Fire giant", masters: ["Chaeldar", "Nieve", "Duradel"], style: "melee",
    weakness: "Slash", bring: ["Food"],
    notes: "Catacombs or Waterfall Dungeon.",
    skipBlock: "Common block candidate.",
    location: "Catacombs or Waterfall Dungeon",
    gear: gear("meleeMid", "meleeBudget", "meleeBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 3169, name: "Aviansie", masters: ["Duradel", "Konar"], style: "ranged",
    weakness: "Ranged · Armadyl camp", bring: ["Ranging potion", "Food"],
    notes: "God Wars — Armadyl area. Protect from Missiles.",
    skipBlock: "Skip unless farming GWD.",
    location: "God Wars Dungeon — Armadyl encampment",
    gear: gear("rangedGwd", "rangedGwdMid", "rangedGwdBudget"),
    prayers: prayers("ranged"),
  },
  {
    monsterId: 498, name: "Smoke devil", masters: ["Duradel", "Nieve"], style: "melee",
    weakness: "Crush · Facemask", bring: ["Facemask or slayer helm"],
    notes: "Smoke Devil Dungeon. Thermonuclear is separate boss.",
    skipBlock: "Fast task — keep.",
    location: "Smoke Devil Dungeon",
    gear: gear("meleeSmoke", "meleeSmokeMid", "meleeSmokeBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 7936, name: "Revenant demon", masters: ["Krystilia"], style: "melee",
    weakness: "Slash · Wilderness", bring: ["Teleblock escape plan", "Food", "Ranging potion"],
    notes: "Wilderness only. Beware PKers.",
    skipBlock: "Skip unless farming revs.",
    location: "Revenant Caves — Wilderness",
    gear: gear("meleeObsidian", "meleeObsidianMid", "meleeObsidianBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 7409, name: "Night beast", masters: ["Konar"], style: "melee",
    weakness: "Crush · Nightmare Zone stats", bring: ["Super restore", "Food"],
    notes: "Superior slayer encounter. High damage — protect accordingly.",
    skipBlock: "Always worth killing — good drops.",
    location: "Where spawned (task area)",
    gear: gear("meleeCrushBis", "meleeCrushMid", "meleeCrushBudget"),
    prayers: prayers("melee"),
  },
  {
    monsterId: 955, name: "Kalphite Worker", masters: ["Nieve", "Duradel"], style: "melee",
    weakness: "Slash", bring: ["Food"],
    notes: "Kalphite Lair. Kalphite Queen is separate.",
    skipBlock: "Skip — slow and boring.",
    location: "Kalphite Lair",
    gear: gear("meleeMid", "meleeBudget", "meleeBudget"),
    prayers: prayers("melee"),
  },
];

function validateItemId(id, ctx) {
  if (!ITEMS[String(id)]) {
    throw new Error(`Invalid item ID ${id} in ${ctx}`);
  }
}

function validateGear(loadout, ctx) {
  if (!loadout || typeof loadout !== "object") return;
  for (const slot of SLOT_KEYS) {
    const id = loadout[slot];
    if (id != null) validateItemId(id, `${ctx}.${slot}`);
  }
}

function validateStyleGear(styleGear, ctx) {
  if (styleGear.note) return;
  for (const tier of ["bis", "mid", "entry"]) {
    validateGear(styleGear[tier], `${ctx}.${tier}`);
  }
}

function enrichTask(raw) {
  const monster = MONSTERS[String(raw.monsterId)];
  if (!monster) throw new Error(`Unknown monster ID ${raw.monsterId} (${raw.name})`);

  validateGear(raw.gear.bis, `${raw.name}.bis`);
  validateGear(raw.gear.mid, `${raw.name}.mid`);
  validateGear(raw.gear.budget, `${raw.name}.budget`);

  const expanded = expandTaskGear(raw);
  for (const style of STYLE_ORDER) {
    validateStyleGear(expanded.gear[style], `${raw.name}.${style}`);
  }

  const slayer = monster.slayer || {};
  return {
    monsterId: raw.monsterId,
    name: raw.name || monster.name,
    masters: raw.masters || (slayer.masters || []).map((m) => m.charAt(0).toUpperCase() + m.slice(1)),
    combatLevel: monster.combatLevel,
    slayerLevel: slayer.level ?? null,
    slayerXp: slayer.xp ?? null,
    recommendedStyle: expanded.recommendedStyle,
    style: expanded.recommendedStyle,
    styleReason: expanded.styleReason,
    weakness: raw.weakness || "",
    bring: raw.bring || [],
    location: raw.location || "",
    skipBlock: raw.skipBlock || "",
    notes: raw.notes || "",
    gear: expanded.gear,
    prayers: expanded.prayers,
  };
}

function main() {
  const tasks = {};
  for (const raw of CURATED) {
    tasks[String(raw.monsterId)] = enrichTask(raw);
  }

  const masters = [...new Set(CURATED.flatMap((t) => t.masters))].sort();

  const payload = {
    generatedAt: new Date().toISOString(),
    count: Object.keys(tasks).length,
    masters,
    tasks,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload));
  process.stderr.write(`Wrote ${payload.count} slayer tasks → ${OUT}\n`);
}

main();
