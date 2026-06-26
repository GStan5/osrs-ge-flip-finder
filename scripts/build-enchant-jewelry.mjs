#!/usr/bin/env node
/**
 * Build bundled enchantable jewelry catalog for /tools/enchant.
 * Canonical pairs from OSRS Lvl 1–7 enchant spells; IDs from GE mapping API,
 * tradeability from osrsbox-db.
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
const OSRSBOX_ITEM_URL =
  "https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/docs/items-json";

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
 * OSRS standard Lvl 1–7 enchant spell conversions (unenchanted → enchanted).
 * Base names; charged outputs resolve to highest-charge GE variant.
 * @type {Array<{ input: string, output: string, spell: number, gem: string, type: string }>}
 */
const ENCHANT_PAIRS = [
  // Lvl-1 — sapphire & opal (opal ring uses Lvl-2 in-game)
  { input: "Sapphire ring", output: "Ring of recoil", spell: 1, gem: "sapphire", type: "ring" },
  { input: "Sapphire necklace", output: "Games necklace", spell: 1, gem: "sapphire", type: "necklace" },
  { input: "Sapphire amulet", output: "Amulet of magic", spell: 1, gem: "sapphire", type: "amulet" },
  { input: "Sapphire bracelet", output: "Bracelet of clay", spell: 1, gem: "sapphire", type: "bracelet" },
  { input: "Opal necklace", output: "Dodgy necklace", spell: 1, gem: "opal", type: "necklace" },
  { input: "Opal amulet", output: "Amulet of bounty", spell: 1, gem: "opal", type: "amulet" },
  { input: "Opal bracelet", output: "Expeditious bracelet", spell: 1, gem: "opal", type: "bracelet" },
  { input: "Opal ring", output: "Ring of pursuit", spell: 2, gem: "opal", type: "ring" },
  // Lvl-2 — emerald & jade
  { input: "Emerald ring", output: "Ring of dueling", spell: 2, gem: "emerald", type: "ring" },
  { input: "Emerald necklace", output: "Binding necklace", spell: 2, gem: "emerald", type: "necklace" },
  { input: "Emerald amulet", output: "Amulet of defence", spell: 2, gem: "emerald", type: "amulet" },
  { input: "Emerald bracelet", output: "Castle wars bracelet", spell: 2, gem: "emerald", type: "bracelet" },
  { input: "Jade ring", output: "Ring of returning", spell: 2, gem: "jade", type: "ring" },
  { input: "Jade necklace", output: "Necklace of passage", spell: 2, gem: "jade", type: "necklace" },
  { input: "Jade bracelet", output: "Flamtaer bracelet", spell: 2, gem: "jade", type: "bracelet" },
  { input: "Jade amulet", output: "Amulet of chemistry", spell: 2, gem: "jade", type: "amulet" },
  // Lvl-3 — ruby & topaz
  { input: "Ruby ring", output: "Ring of forging", spell: 3, gem: "ruby", type: "ring" },
  { input: "Ruby amulet", output: "Amulet of strength", spell: 3, gem: "ruby", type: "amulet" },
  { input: "Ruby bracelet", output: "Inoculation bracelet", spell: 3, gem: "ruby", type: "bracelet" },
  { input: "Topaz ring", output: "Efaritay's aid", spell: 3, gem: "topaz", type: "ring" },
  { input: "Topaz necklace", output: "Necklace of faith", spell: 3, gem: "topaz", type: "necklace" },
  { input: "Topaz bracelet", output: "Bracelet of slaughter", spell: 3, gem: "topaz", type: "bracelet" },
  { input: "Topaz amulet", output: "Burning amulet", spell: 3, gem: "topaz", type: "amulet" },
  // Lvl-4 — diamond
  { input: "Diamond ring", output: "Ring of life", spell: 4, gem: "diamond", type: "ring" },
  { input: "Diamond necklace", output: "Phoenix necklace", spell: 4, gem: "diamond", type: "necklace" },
  { input: "Diamond bracelet", output: "Abyssal bracelet", spell: 4, gem: "diamond", type: "bracelet" },
  { input: "Diamond amulet", output: "Amulet of power", spell: 4, gem: "diamond", type: "amulet" },
  // Lvl-5 — dragonstone
  { input: "Dragonstone ring", output: "Ring of wealth", spell: 5, gem: "dragonstone", type: "ring" },
  { input: "Dragon necklace", output: "Skills necklace", spell: 5, gem: "dragonstone", type: "necklace" },
  { input: "Dragonstone amulet", output: "Amulet of glory", spell: 5, gem: "dragonstone", type: "amulet" },
  { input: "Dragonstone bracelet", output: "Combat bracelet", spell: 5, gem: "dragonstone", type: "bracelet" },
  // Lvl-6 — onyx
  { input: "Onyx ring", output: "Ring of stone", spell: 6, gem: "onyx", type: "ring" },
  { input: "Onyx necklace", output: "Berserker necklace", spell: 6, gem: "onyx", type: "necklace" },
  { input: "Onyx amulet", output: "Amulet of fury", spell: 6, gem: "onyx", type: "amulet" },
  { input: "Onyx bracelet", output: "Regen bracelet", spell: 6, gem: "onyx", type: "bracelet" },
  // Lvl-7 — zenyte
  { input: "Zenyte ring", output: "Ring of suffering", spell: 7, gem: "zenyte", type: "ring" },
  { input: "Zenyte necklace", output: "Necklace of anguish", spell: 7, gem: "zenyte", type: "necklace" },
  { input: "Zenyte amulet", output: "Amulet of torture", spell: 7, gem: "zenyte", type: "amulet" },
  { input: "Zenyte bracelet", output: "Tormented bracelet", spell: 7, gem: "zenyte", type: "bracelet" },
];

/**
 * Pairs excluded from catalog — enchant exists but not GE-tradeable both ways.
 * @type {Array<{ input: string, output: string, reason: string }>}
 */
const EXCLUDED_PAIRS = [
  {
    input: "Ruby necklace",
    output: "Digsite pendant",
    reason: "Output not on Grand Exchange",
  },
  {
    input: "Emerald amulet",
    output: "Amulet of nature",
    reason: "Output not on Grand Exchange (alternate Lvl-2 result)",
  },
];

/** @type {Map<number, Promise<{ tradeable_on_ge?: boolean } | null>>} */
const osrsboxCache = new Map();

async function fetchOsrsboxItem(id) {
  if (!osrsboxCache.has(id)) {
    osrsboxCache.set(
      id,
      fetch(`${OSRSBOX_ITEM_URL}/${id}.json`, { headers: { "User-Agent": USER_AGENT } })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
    );
  }
  return osrsboxCache.get(id);
}

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
  return { exact, normalized, all: mapping };
}

function resolveItem(index, baseName) {
  const direct = index.exact.get(baseName);
  if (direct) return direct;

  const lower = baseName.toLowerCase();
  const hits = index.normalized.get(lower);
  if (hits?.length === 1) return hits[0];

  // Prefer highest-charge charged jewellery on GE (e.g. Games necklace(8))
  const charged = index.all
    .filter((item) => {
      const nameLower = item.name.toLowerCase();
      return nameLower.startsWith(lower) && /\(\d+\)/.test(item.name);
    })
    .sort((a, b) => {
      const chargeA = Number(a.name.match(/\((\d+)\)/)?.[1] ?? 0);
      const chargeB = Number(b.name.match(/\((\d+)\)/)?.[1] ?? 0);
      return chargeB - chargeA;
    });
  if (charged.length) return charged[0];

  // Castle wars bracelet naming variants
  if (baseName.includes("Castle wars brac")) {
    return (
      index.exact.get("Castle wars bracelet(3)") ||
      index.exact.get("Castle wars brace(5)") ||
      index.exact.get("Castle wars bracelet(5)") ||
      index.exact.get("Castle wars bracelet")
    );
  }

  throw new Error(`Could not resolve item: ${baseName}`);
}

function enrichRunes(spell) {
  return spell.runes.map((r) => ({
    id: r.id,
    name: RUNE_NAMES[r.id] || `Rune ${r.id}`,
    qty: r.qty,
  }));
}

async function isGeTradeable(itemId) {
  const meta = await fetchOsrsboxItem(itemId);
  return meta?.tradeable_on_ge === true;
}

async function main() {
  process.stderr.write("Fetching GE mapping…\n");
  const mapping = await fetchMapping();
  const index = buildNameIndex(mapping);

  const items = [];
  const skipped = [];

  for (const pair of ENCHANT_PAIRS) {
    try {
      const inputItem = resolveItem(index, pair.input);
      const outputItem = resolveItem(index, pair.output);
      const spell = SPELLS[pair.spell];
      if (!spell) throw new Error(`Unknown spell level ${pair.spell}`);

      const [inputTradeable, outputTradeable] = await Promise.all([
        isGeTradeable(inputItem.id),
        isGeTradeable(outputItem.id),
      ]);

      if (!inputTradeable || !outputTradeable) {
        skipped.push({
          pair,
          reason: !inputTradeable
            ? `Input not GE-tradeable (${inputItem.name})`
            : `Output not GE-tradeable (${outputItem.name})`,
        });
        continue;
      }

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
      process.stderr.write(`\nFailed ${pair.input} → ${pair.output}: ${err.message}\n`);
      process.exit(1);
    }
  }

  items.sort((a, b) => {
    if (a.spellLevel !== b.spellLevel) return a.spellLevel - b.spellLevel;
    if (a.gem !== b.gem) return a.gem.localeCompare(b.gem);
    return a.type.localeCompare(b.type);
  });

  if (skipped.length) {
    process.stderr.write("\nSkipped (not GE-tradeable both ways):\n");
    for (const s of skipped) {
      process.stderr.write(`  ${s.pair.input} → ${s.pair.output}: ${s.reason}\n`);
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    spellCount: Object.keys(SPELLS).length,
    itemCount: items.length,
    excluded: EXCLUDED_PAIRS,
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
