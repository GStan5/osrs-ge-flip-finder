# Slayer Guide — internal spec

## Routes

| Route | Purpose |
|-------|---------|
| `/tools/slayer` | Slayer guide page |
| `/tools/slayer?task={monsterId}` | Pre-selected task |
| `/tools/slayer?master={name}` | Filter by slayer master |
| `/tools/slayer?q={query}` | Search on load |

## Gear Planner integration

Each loadout links to Gear Planner with prefilled slots:

```
/tools/gear?monster={id}&style={melee|ranged|magic}&slots=head:24271,weapon:22324,...&prayers=27
```

Gear Planner reads `slots`, per-slot params (`head`, `weapon`, …), `style`, and `prayers` on load (before share preset).

## Data files

| File | Build |
|------|-------|
| `data/slayer-tasks-meta.json` | `npm run build:slayer-tasks` |

### Task entry shape

```json
{
  "monsterId": 2215,
  "name": "General Graardor",
  "masters": ["Konar"],
  "combatLevel": 626,
  "slayerLevel": null,
  "slayerXp": 338,
  "style": "melee",
  "weakness": "Stab · Bandos altar room",
  "bring": ["Super restore", "Food"],
  "location": "God Wars Dungeon — Bandos encampment",
  "skipBlock": "Skip unless you want Bandos uniques.",
  "notes": "Team or solo Bandos. Protect from Melee when tanking.",
  "gear": {
    "bis": { "head": 24271, "weapon": 22324, "body": 11832, "..." : "..." },
    "mid": { "..." : "..." },
    "budget": { "..." : "..." }
  },
  "prayers": {
    "bis": [27],
    "mid": [26],
    "budget": [16, 15, 14]
  }
}
```

Tasks keyed by `monsterId` string in `tasks` object. Item IDs validated against `data/items-meta.json` at build time.

## UI

- Master filter (optional)
- Task search with monster sprites (reuses `G.ui.monsterPickerResult`, `G.ui.monsterQuickChip`)
- Hero card: sprite, combat/slayer stats, notes
- Three loadout cards via `G.ui.gearLoadoutCard` — BIS / Mid / Budget
- Task info: weakness, location, bring list, skip/block notes
- Prayer icon chips per tier

## Pro gating

None for v1 — full guide available without login.

## Extending tasks

Add entries to `CURATED` in `scripts/build-slayer-tasks-meta.mjs`, reuse `LOADOUTS` templates or add new ones, run `npm run build:slayer-tasks`.

## Testing

1. Open `/tools/slayer` — search, quick picks, master filter work unsigned
2. Select Graardor — three loadouts, prayers, task info render
3. Click **Plan in Gear Planner** on BIS — gear page opens with monster, slots, prayers prefilled
4. Nav Plan section shows Slayer guide; home + tools hub cards present
