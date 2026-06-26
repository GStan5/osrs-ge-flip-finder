#!/usr/bin/env node
/**
 * Build combat prayer bonuses for gear planner.
 * Usage: npm run build:prayers-meta
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "prayers-meta.json");
const SOURCE =
  "https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/docs/prayers-complete.json";

const COMBAT_KEYS = new Set(["attack", "strength", "defence", "ranged", "magic", "ranged_strength", "magic_strength"]);

async function main() {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const batch = await res.json();
  const prayers = {};

  for (const p of Object.values(batch)) {
    if (!p?.id || !p.name) continue;
    const bonuses = p.bonuses || {};
    const hasCombat = Object.keys(bonuses).some((k) => COMBAT_KEYS.has(k));
    if (!hasCombat) continue;
    prayers[String(p.id)] = {
      id: p.id,
      name: p.name,
      members: Boolean(p.members),
      drain: p.drain_per_minute ?? 0,
      requirements: p.requirements || {},
      bonuses,
    };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    count: Object.keys(prayers).length,
    prayers,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload));
  process.stderr.write(`Wrote ${payload.count} combat prayers → ${OUT}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
