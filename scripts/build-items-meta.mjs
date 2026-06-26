#!/usr/bin/env node
/**
 * Build bundled equipable item stats for /tools/item (no runtime API calls).
 * Source: osrsbox-db items-json-slot files on GitHub.
 *
 * Usage: npm run build:items-meta
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "items-meta.json");
const BASE =
  "https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/docs/items-json-slot";
const SLOTS = [
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

function compactEquipment(equipment) {
  if (!equipment?.slot) return null;
  const allZero = (vals) => vals.every((v) => !v);
  const attack = {
    stab: equipment.attack_stab ?? 0,
    slash: equipment.attack_slash ?? 0,
    crush: equipment.attack_crush ?? 0,
    magic: equipment.attack_magic ?? 0,
    ranged: equipment.attack_ranged ?? 0,
  };
  const defence = {
    stab: equipment.defence_stab ?? 0,
    slash: equipment.defence_slash ?? 0,
    crush: equipment.defence_crush ?? 0,
    magic: equipment.defence_magic ?? 0,
    ranged: equipment.defence_ranged ?? 0,
  };
  const strength = equipment.melee_strength ?? 0;
  const rangedStrength = equipment.ranged_strength ?? 0;
  const magicDamage = equipment.magic_damage ?? 0;
  const prayer = equipment.prayer ?? 0;

  if (
    allZero(Object.values(attack)) &&
    allZero(Object.values(defence)) &&
    !strength &&
    !rangedStrength &&
    !magicDamage &&
    !prayer
  ) {
    return { slot: equipment.slot };
  }

  return {
    slot: equipment.slot,
    attack,
    defence,
    strength,
    rangedStrength,
    magicDamage,
    prayer,
  };
}

async function main() {
  const items = {};

  for (const file of SLOTS) {
    const url = `${BASE}/${file}`;
    process.stderr.write(`Fetching ${file}…\n`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const batch = await res.json();
    for (const item of Object.values(batch)) {
      if (!item?.equipable_by_player || !item.equipment) continue;
      const meta = compactEquipment(item.equipment);
      if (meta) items[String(item.id)] = meta;
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "osrsbox-db (GitHub raw, items-json-slot)",
    count: Object.keys(items).length,
    items,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload));
  process.stderr.write(`Wrote ${payload.count} equipable items → ${OUT}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
