# Enchant Jewellery tool

Internal spec for `/tools/enchant`.

## Route

- **URL:** `/tools/enchant`
- **Nav:** Economy section in `site-chrome.js` (after High Alch)
- **Access:** Free — no Pro gate (same as `/tools/alch`)

## Data

| File | Purpose |
|------|---------|
| `data/enchant-jewelry.json` | Bundled catalog of enchantable jewellery pairs |
| `scripts/build-enchant-jewelry.mjs` | Resolves GE item IDs from mapping API |

Rebuild after changing curated pairs:

```bash
npm run build:enchant-jewelry
```

### Catalog fields (per item)

- `inputId` / `outputId` — unenchanted → enchanted GE items
- `gem` — filter tier (`sapphire`, `opal`, `jade`, `emerald`, `topaz`, `ruby`, `diamond`, `dragonstone`, `onyx`, `zenyte`)
- `type` — `ring`, `necklace`, `amulet`, `bracelet`
- `spellName`, `magicLevel`, `runes[]` — spell cost (cosmic + elemental or zenyte runes)

### Exclusions (not standard Lvl 1–7 enchant spells or not GE-tradeable)

- **Diamond bracelet** — no enchant spell; Bracelet of ethereum is from Revenants + ether attachment.
- **Ruby necklace → Digsite pendant** — enchant exists but output is untradeable (not on GE).
- **Onyx necklace → Berserker necklace** — enchant exists but output is untradeable (not on GE).

## Profit calculation

Per cast, using live prices from `loadPrices()` / `getItemPrice()`:

```
buyCost      = input.buy (GE low / instant buy)
sellAfterTax = output.sell − calcGeTax(output.sell, outputId)
runeCost     = Σ (rune.buy × qty) for each rune in spell
totalCost    = buyCost + runeCost
profit       = sellAfterTax − totalCost
margin       = (profit / totalCost) × 100
```

### GE limit batch (per row)

Limit and volume come from `getItemPrice(inputId)` — mapping `limit` plus `/5m` and `/1h` buy-side volume:

```
buyRateHour  = effectiveHourlyRate(buyVol5m, buyVolHour)  // 65% 5m + 35% 1h
dailyVolume  = (buyRateHour + sellRateHour) × 24
buyTimeHours = buyLimit ÷ buyRateHour
limitGpCost  = totalCost × buyLimit
limitProfit  = profit × buyLimit
```

Show `—` when limit, volume, or rate data is unavailable.

Rows are omitted when input buy or output sell price is missing. Rune costs use live GE buy prices; partial rune data shows `*` on rune cost.

## UI

- **List:** `.gra-item-list--enchant` — dual wiki icons (input → output), spell, magic lvl, rune/buy/sell/profit/margin, GE limit, daily vol., est. buy time, GP (limit), profit (limit)
- **Default sort:** profit descending
- **Filters:** gem tier, item type, search, min profit, min margin, max buy, profitable-only
- **Refresh:** `Refresh prices` → `loadPrices({ force: true })`

## Assets

| File | Role |
|------|------|
| `tools/enchant.html` | Page shell |
| `assets/js/enchant.js` | Catalog load, profit rows, filters |
| `assets/css/item-list.css` | `.gra-item-list--enchant` grid + `.enchant-pair` styles |

## Service worker

Bump `sw.js` cache version when shipping static asset changes.
