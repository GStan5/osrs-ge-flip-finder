# Gear Planner — internal spec

## Routes

| Route | Purpose |
|-------|---------|
| `/tools/gear` | Gear planner page |
| `/tools/gear?monster={id}` | Pre-selected monster (from monster lookup) |
| `/tools/gear?share={shareId}` | Load public/shared preset |
| `/api/gear/presets` | GET list (auth), POST/PUT/DELETE (auth), GET `?share=` public |
| `/api/gear/profiles` | OSRS username + hiscores cache (auth) |
| `/api/gear/import-wom` | WOM gear import attempt (auth) |
| `/api/gear/upgrades` | Upgrade ranking (auth; free capped) |

## Database (Neon)

- `gear_presets` — user presets with `share_id`, slots JSON, prayers, monster, public/ironman flags
- `osrs_profiles` — linked usernames + cached `combat_stats` from Jagex hiscores
- `gear_upgrade_uses` — lifetime upgrade view counter per user (free tier)

## Data files

- `data/prayers-meta.json` — combat prayers (`npm run build:prayers-meta`)
- `data/gear-upgrade-pools.json` — curated per-slot pools (`npm run build:gear-pools`)
- `data/items-meta.json`, `data/monsters-meta.json` — existing bundles

## Pro vs free (server-enforced)

| Free | Pro |
|------|-----|
| 1 preset, 1 OSRS username | Unlimited presets + folders |
| Core stats (DPS, max hit, hit chance) | All stats including XP/hr, GP/hr, avg loot |
| Manual upgrade load; 3 lifetime views | Auto refresh on gear change |
| Top 3 upgrades from API | Full ranked list |
| Blurred locked rows + blurred stats | Full data |

`/api/gear/upgrades` never returns full list to free clients; `lockedCount` drives placeholder rows only.

## Calculations (`lib/gear-calc.js`)

v1: sum equipment + prayer bonuses; simplified DPS vs monster defence; kills/hr from HP/DPS; XP/hr from HP×4 + slayer + HP/3; GP/hr from drop EV × kills/hr.

Ironman: ranking uses effort score placeholder (`ge`=1, `drop`=5, `quest`=10) instead of GE price efficiency.

## WOM import

WOM API tracks skills/bosses, not worn gear. Import endpoint checks for equipment fields and returns a clear message when absent.

## Phase 4 hooks

- Monster lookup → `Plan gear` links to `/tools/gear?monster={id}`
- Upgrade rows → item lookup via `/tools/item?id=`
- Boss prep integration: prep page unchanged; gear presets are separate DB entities

## Testing

1. Open `/tools/gear` — manual slots, monster search, prayers, style chips work unsigned
2. Sign in — save preset, copy share link, open in incognito
3. Link OSRS username — stats row updates from hiscores
4. Import gear — expect “No gear data” from WOM (expected)
5. Load upgrades (free) — 3 rows max, blurred extras, counter decrements
6. Pro account — full stats, auto upgrades, unlimited presets
