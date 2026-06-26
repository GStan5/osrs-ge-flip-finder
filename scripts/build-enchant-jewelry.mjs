#!/usr/bin/env node
/**
 * Build bundled enchantable jewelry catalog for /tools/enchant.
 * Resolves item IDs from the OSRS GE mapping API.
 *
 * Usage: npm run build:enchant-jewelry
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "enchant-jewelry.json");
const USER_AGENT = "Graardor - enchant jewelry builder (graardor.com)";
const MAPPING_URL = "https://prices.runescape.wiki/api/v1/osrs/mapping";

/** @type {Record<number, { name: string, magicLevel: number, runes: { id: number, qty: number }[] }>} */
const SPELLS = {
  1: {
    name: "Enchant Level-1 Jewellery",
    magicLevel: 7,
    runes: [
      { id: 564, qty: 1 },
      { id: 555, qty: 1 },
    ],
  },
  2: {
    name: "Enchant Level-2 Jewellery",
    magicLevel: 27,
    runes: [
      { id: 564, qty: 1 },
      { id: 556, qty: 3 },
    ],
  },
  3: {
    name: "Enchant Level-3 Jewellery",
    magicLevel: 49,
    runes: [
      { id: 564, qty: 1 },
      { id: 554, qty: 5 },
    ],
  },
  4: {
    name: "Enchant Level-4 Jewellery",
    magicLevel: 57,
    runes: [
      { id: 564, qty: 1 },
      { id: 557, qty: 10 },
    ],
  },
  5: {
    name: "Enchant Level-5 Jewellery",
    magicLevel: 68,
    runes: [
      { id: 564, qty: 1 },
      { id: 557, qty: 15 },
      { id: 555, qty: 15 },
    ],
  },
  6: {
    name: "Enchant Level-6 Jewellery",
    magicLevel: 87,
    runes: [
      { id: 564, qty: 1 },
      { id: 554, qty: 20 },
      { id: 557, qty: 20 },
    ],
  },
  7: {
    name: "Enchant Level-7 Jewellery",
    magicLevel: 93,
    runes: [
      { id: 564, qty: 20 },
      { id: 565, qty: 20 },
      { id: 566, qty: 20 },
    ],
  },
};

const RUNE_NAMES = {
  554: "Fire rune",
  555: "Water rune",
  556: "Air rune",
  557: "Earth rune",
  564: "Cosmic rune",
  565: "Blood rune",
  566: "Soul rune",
};

/**
 * Curated unenchanted → enchanted pairs from OSRS standard jewellery enchant spells.
 * @type {Array<{ input: string, output: string, spell: number, gem: string, type: string }>}
 */
const PAIRS = [
  // Sapphire
  { input: "Sapphire ring", output: "Ring of recoil", spell: 1, gem: "sapphire", type: "ring" },
  { input: "Sapphire necklace", output: "Games necklace(8)", spell: 1, gem: "sapphire", type: "necklace" },
  { input: "Sapphire amulet", output: "Amulet of magic", spell: 1, gem: "sapphire", type: "amulet" },
  // Opal (Lvl-1 / Lvl-2)
  { input: "Opal necklace", output: "Dodgy necklace", spell: 1, gem: "opal", type: "necklace" },
  { input: "Opal amulet", output: "Amulet of bounty", spell: 1, gem: "opal", type: "amulet" },
  { input: "Opal bracelet", output: "Expeditious bracelet", spell: 1, gem: "opal", type: "bracelet" },
  { input: "Opal ring", output: "Ring of pursuit", spell: 2, gem: "opal", type: "ring" },
  { input: "Jade bracelet", output: "Flamtaer bracelet", spell: 2, gem: "jade", type: "bracelet" },
  // Emerald
  { input: "Emerald ring", output: "Ring of dueling(8)", spell: 2, gem: "emerald", type: "ring" },
  { input: "Emerald necklace", output: "Binding necklace", spell: 2, gem: "emerald", type: "necklace" },
  { input: "Emerald amulet", output: "Amulet of defence", spell: 2, gem: "emerald", type: "amulet" },
  // Topaz
  { input: "Topaz necklace", output: "Necklace of passage(5)", spell: 2, gem: "topaz", type: "necklace" },
  { input: "Topaz amulet", output: "Amulet of bounty", spell: 2, gem: "topaz", type: "amulet" },
  { input: "Topaz ring", output: "Efaritay's aid", spell: 3, gem: "topaz", type: "ring" },
  { input: "Topaz bracelet", output: "Bracelet of slaughter", spell: 3, gem: "topaz", type: "bracelet" },
  // Ruby
  { input: "Ruby ring", output: "Ring of forging", spell: 3, gem: "ruby", type: "ring" },
  { input: "Ruby amulet", output: "Amulet of strength", spell: 3, gem: "ruby", type: "amulet" },
  { input: "Ruby bracelet", output: "Inoculation bracelet", spell: 3, gem: "ruby", type: "bracelet" },
  // Diamond
  { input: "Diamond ring", output: "Ring of life", spell: 4, gem: "diamond", type: "ring" },
  { input: "Diamond necklace", output: "Phoenix necklace", spell: 4, gem: "diamond", type: "necklace" },
  { input: "Diamond amulet", output: "Amulet of power", spell: 4, gem: "diamond", type: "amulet" },
  { input: "Diamond bracelet", output: "Bracelet of ethereum (uncharged)", spell: 4, gem: "diamond", type: "bracelet" },
  // Dragonstone
  { input: "Dragonstone ring", output: "Ring of wealth", spell: 5, gem: "dragonstone", type: "ring" },
  { input: "Dragon necklace", output: "Skills necklace(6)", spell: 5, gem: "dragonstone", type: "necklace" },
  { input: "Dragonstone amulet", output: "Amulet of glory(4)", spell: 5, gem: "dragonstone", type: "amulet" },
  { input: "Dragonstone bracelet", output: "Combat bracelet(6)", spell: 5, gem: "dragonstone", type: "bracelet" },
  // Onyx
  { input: "Onyx ring", output: "Ring of stone", spell: 6, gem: "onyx", type: "ring" },
  { input: "Onyx amulet", output: "Amulet of fury", spell: 6, gem: "onyx", type: "amulet" },
  { input: "Onyx bracelet", output: "Regen bracelet", spell: 6, gem: "onyx", type: "bracelet" },
  // Zenyte
  { input: "Zenyte ring", output: "Ring of suffering", spell: 7, gem: "zenyte", type: "ring" },
  { input: "Zenyte necklace", output: "Necklace of anguish", spell: 7, gem: "zenyte", type: "necklace" },
  { input: "Zenyte amulet", output: "Amulet of torture", spell: 7, gem: "zenyte", type: "amulet" },
  { input: "Zenyte bracelet", output: "Tormented bracelet", spell: 7, gem: "zenyte", type: "bracelet" },
];

async function fetchMapping() {
  const res = await fetch(MAPPING_URL, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Mapping API ${res.status}`);
  return res.json();
}

function buildNameIndex(mapping) {
  /** @type {Map<string, typeof mapping[0]>} */
  const exact = new Map();
  /** @type {Map<string, typeof mapping[0][]>} */
  const normalized = new Map();

  for (const item of mapping) {
    exact.set(item.name, item);
    const key = item.name.toLowerCase();
    if (!normalized.has(key)) normalized.set(key, []);
    normalized.get(key).push(item);
  }
  return { exact, normalized };
}

function resolveItem(index, name) {
  const direct = index.exact.get(name);
  if (direct) return direct;

  const lower = name.toLowerCase();
  const hits = index.normalized.get(lower);
  if (hits?.length === 1) return hits[0];

  // Digsite pendant naming variants
  if (name.includes("Digsite pendant")) {
    const alt = index.exact.get("Digsite pendant(5)") || index.exact.get("Digsite pendant (5)");
    if (alt) return alt;
  }

  // Amulet of glory variants
  if (name === "Amulet of glory(4)") {
    return index.exact.get("Amulet of glory(4)") || index.exact.get("Amulet of glory (4)");
  }

  throw new Error(`Could not resolve item: ${name}`);
}

function enrichRunes(spell) {
  return spell.runes.map((r) => ({
    id: r.id,
    name: RUNE_NAMES[r.id] || `Rune ${r.id}`,
    qty: r.qty,
  }));
}

async function main() {
  process.stderr.write("Fetching GE mapping…\n");
  const mapping = await fetchMapping();
  const index = buildNameIndex(mapping);

  const items = [];
  const missing = [];

  for (const pair of PAIRS) {
    try {
      const inputItem = resolveItem(index, pair.input);
      const outputItem = resolveItem(index, pair.output);
      const spell = SPELLS[pair.spell];
      if (!spell) throw new Error(`Unknown spell level ${pair.spell}`);

      items.push({
        id: `${inputItem.id}-${outputItem.id}`,
        inputId: inputItem.id,
        outputId: outputItem.id,
        inputName: inputItem.name,
        outputName: outputItem.name,
        inputIcon: inputItem.icon,
        outputIcon: outputItem.icon,
        gem: pair.gem,
        type: pair.type,
        spellLevel: pair.spell,
        spellName: spell.name,
        magicLevel: spell.magicLevel,
        runes: enrichRunes(spell),
        members: Boolean(inputItem.members || outputItem.members),
      });
    } catch (err) {
      missing.push({ pair, error: err.message });
    }
  }

  if (missing.length) {
    process.stderr.write("\nUnresolved pairs:\n");
    for (const m of missing) {
      process.stderr.write(`  ${m.pair.input} → ${m.pair.output}: ${m.error}\n`);
    }
    process.exit(1);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    spellCount: Object.keys(SPELLS).length,
    itemCount: items.length,
    spells: Object.fromEntries(
      Object.entries(SPELLS).map(([lvl, s]) => [lvl, { ...s, runes: enrichRunes(s) }])
    ),
    items,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
  process.stderr.write(`Wrote ${items.length} items to ${OUT}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
