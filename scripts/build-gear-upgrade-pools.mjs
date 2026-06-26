#!/usr/bin/env node
/**
 * Curated upgrade pools from equipable combat items.
 * Usage: npm run build:gear-pools
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ITEMS_META = join(ROOT, "data", "items-meta.json");
const OUT = join(ROOT, "data", "gear-upgrade-pools.json");
const SLOT_FILES = [
  "items-2h.json",
  "items-ammo.json",
  "items-body.json",
  "items-cape.json",
  "items-feet.json",
  "items-hands.json",
  "items-head.json",
  "items-legs.json",
  "items-neck.json",
  "items-ring.json",
  "items-shield.json",
  "items-weapon.json",
];
const ITEMS_BASE =
  "https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/docs/items-json-slot";

const SLOT_MAP = {
  head: "head",
  cape: "cape",
  amulet: "neck",
  weapon: ["weapon", "2h"],
  body: "body",
  legs: "legs",
  shield: "shield",
  gloves: "hands",
  boots: "feet",
  ring: "ring",
  ammo: "ammo",
};

const SKIP_NAME = /^(book|banner|clue|decorative|graceful|max cape|achievement|milestone|ornament kit)/i;

function combatScore(meta) {
  if (!meta) return 0;
  let s = 0;
  if (meta.strength) s += meta.strength * 2;
  if (meta.rangedStrength) s += meta.rangedStrength * 2;
  if (meta.magicDamage) s += meta.magicDamage * 3;
  if (meta.attack) {
    for (const v of Object.values(meta.attack)) s += Math.max(0, v);
  }
  if (meta.defence) {
    for (const v of Object.values(meta.defence)) s += Math.max(0, v) * 0.5;
  }
  return s;
}

function matchesSlot(metaSlot, poolSlot) {
  const want = SLOT_MAP[poolSlot];
  if (Array.isArray(want)) return want.includes(metaSlot);
  return metaSlot === want;
}

async function loadItemNames() {
  const names = {};
  for (const file of SLOT_FILES) {
    const url = `${ITEMS_BASE}/${file}`;
    process.stderr.write(`Fetching ${file}…\n`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const batch = await res.json();
    for (const item of Object.values(batch)) {
      if (item?.id && item?.name) names[String(item.id)] = item;
    }
  }
  return names;
}

async function main() {
  const itemsMeta = JSON.parse(readFileSync(ITEMS_META, "utf8"));
  const names = await loadItemNames();

  const pools = Object.fromEntries(Object.keys(SLOT_MAP).map((k) => [k, []]));

  for (const [id, meta] of Object.entries(itemsMeta.items || {})) {
    const score = combatScore(meta);
    if (score < 5) continue;
    const item = names[id];
    const name = item?.name || item?.wiki_name;
    if (!name || SKIP_NAME.test(name)) continue;
    if (item?.tradeable_on_ge === false && !item?.tradeable) {
      // still include with drop tag
    }

    const obtain = [];
    if (item?.tradeable_on_ge !== false) obtain.push("ge");
    else obtain.push("drop");
    if (/quest|reward/i.test(item?.examine || "") || item?.quest_item) obtain.push("quest");

    const entry = {
      id: Number(id),
      name,
      slot: meta.slot,
      score,
      obtain: obtain.length ? [...new Set(obtain)] : ["ge"],
    };

    for (const poolSlot of Object.keys(SLOT_MAP)) {
      if (matchesSlot(meta.slot, poolSlot)) {
        pools[poolSlot].push(entry);
      }
    }
  }

  for (const slot of Object.keys(pools)) {
    pools[slot].sort((a, b) => b.score - a.score);
    pools[slot] = pools[slot].slice(0, 80);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    slots: Object.keys(SLOT_MAP),
    pools,
  };

  writeFileSync(OUT, JSON.stringify(payload));
  const total = Object.values(pools).reduce((n, arr) => n + arr.length, 0);
  process.stderr.write(`Wrote ${total} pool entries → ${OUT}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
