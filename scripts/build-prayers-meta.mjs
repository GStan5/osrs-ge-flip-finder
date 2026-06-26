#!/usr/bin/env node
/**
 * Build prayer metadata for gear planner (full OSRS prayer book).
 * Usage: npm run build:prayers-meta
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "prayers-meta.json");
const SOURCE =
  "https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/docs/prayers-complete.json";

/**
 * OSRS prayer tab row order (left → right, top → bottom).
 * Use 0 for empty spacer cells (e.g. centered Preserve).
 */
const BOOK_ROWS = [
  [1, 2, 3],
  [6, 7, 8],
  [14, 15, 16],
  [4, 12, 20],
  [5, 13, 21],
  [9, 10, 11],
  [17, 18, 19],
  [22, 23, 24],
  [0, 25, 0],
  [26, 27, 28, 29],
];

function prayerIconFilename(name) {
  return `${name.replace(/ /g, "_")}.png`;
}

function pickBonuses(raw) {
  const bonuses = raw || {};
  const out = {};
  for (const [k, v] of Object.entries(bonuses)) {
    if (typeof v === "number" && v !== 0) out[k] = v;
  }
  return out;
}

async function main() {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const batch = await res.json();
  const prayers = {};

  for (const p of Object.values(batch)) {
    if (!p?.id || !p.name) continue;
    const bonuses = pickBonuses(p.bonuses);
    prayers[String(p.id)] = {
      id: p.id,
      name: p.name,
      icon: prayerIconFilename(p.name),
      members: Boolean(p.members),
      drain: p.drain_per_minute ?? 0,
      requirements: p.requirements || {},
      ...(Object.keys(bonuses).length ? { bonuses } : {}),
    };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    count: Object.keys(prayers).length,
    bookRows: BOOK_ROWS,
    prayers,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload));
  process.stderr.write(`Wrote ${payload.count} prayers → ${OUT}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
