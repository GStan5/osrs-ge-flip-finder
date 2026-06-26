#!/usr/bin/env node
/**
 * Build bundled monster stats for /tools/monster (no runtime API calls).
 * Source: osrsbox-db monsters-complete.json on GitHub.
 *
 * Usage: npm run build:monsters-meta
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "monsters-meta.json");
const SOURCE =
  "https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/docs/monsters-complete.json";

function compactMonster(m) {
  if (!m?.id || !m?.name || m.duplicate) return null;

  const slayer = m.slayer_monster
    ? {
        level: m.slayer_level ?? 1,
        xp: m.slayer_xp ?? 0,
        masters: m.slayer_masters || [],
        category: m.category || [],
      }
    : null;

  return {
    id: m.id,
    name: m.name,
    members: Boolean(m.members),
    combatLevel: m.combat_level ?? 0,
    hitpoints: m.hitpoints ?? 0,
    maxHit: m.max_hit ?? 0,
    attackTypes: m.attack_type || [],
    attackSpeed: m.attack_speed ?? 0,
    aggressive: Boolean(m.aggressive),
    poisonous: Boolean(m.poisonous),
    venomous: Boolean(m.venomous),
    attributes: m.attributes || [],
    levels: {
      attack: m.attack_level ?? 0,
      strength: m.strength_level ?? 0,
      defence: m.defence_level ?? 0,
      magic: m.magic_level ?? 0,
      ranged: m.ranged_level ?? 0,
    },
    offence: {
      attack: m.attack_bonus ?? 0,
      strength: m.strength_bonus ?? 0,
      magic: m.attack_magic ?? 0,
      magicDmg: m.magic_bonus ?? 0,
      ranged: m.attack_ranged ?? 0,
      rangedStr: m.ranged_bonus ?? 0,
    },
    defence: {
      stab: m.defence_stab ?? 0,
      slash: m.defence_slash ?? 0,
      crush: m.defence_crush ?? 0,
      magic: m.defence_magic ?? 0,
      ranged: m.defence_ranged ?? 0,
    },
    slayer,
    wikiName: m.wiki_name || m.name,
    examine: m.examine || "",
  };
}

async function main() {
  process.stderr.write(`Fetching monsters-complete.json…\n`);
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${SOURCE}`);
  const batch = await res.json();

  const monsters = {};
  const byName = {};

  for (const m of Object.values(batch)) {
    const compact = compactMonster(m);
    if (!compact) continue;
    monsters[String(compact.id)] = compact;
    const key = compact.name.toLowerCase();
    if (!byName[key]) byName[key] = String(compact.id);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "osrsbox-db (GitHub raw, monsters-complete.json)",
    count: Object.keys(monsters).length,
    monsters,
    byName,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload));
  process.stderr.write(`Wrote ${payload.count} monsters → ${OUT}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
