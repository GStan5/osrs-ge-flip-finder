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

### Exclusions

- **Ruby necklace → Digsite pendant** — not on GE (untradeable output).
- **Onyx necklace** — no standard Lvl-6 enchant product on GE.

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

Rows are omitted when input buy or output sell price is missing. Rune costs use live GE buy prices; partial rune data shows `*` on rune cost.

## UI

- **List:** `.gra-item-list--enchant` — dual wiki icons (input → output), spell, magic lvl, rune/buy/sell/profit/margin columns
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
