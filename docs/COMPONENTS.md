# Graardor UI components

Internal reference for shared `G.ui.*` helpers in `assets/js/components.js` and `assets/css/components.css`.

## Load order

```html
<script src="/assets/js/prices-core.js"></script>
<script src="/assets/js/components.js"></script>
<!-- page-specific: item-list.js, sync.js, etc. -->
<script src="/assets/js/item.js"></script>
<script src="/assets/js/site-chrome.js"></script>
```

`components.js` depends on `prices-core.js` (`G.escapeHtml`, `G.formatGp`, etc.). Page scripts may use `G.ui` immediately after both load.

CSS: `components.css` is imported from `theme.css` — no extra `<link>` on HTML pages.

Page layout tokens and `.page-shell` utilities: see [LAYOUT.md](./LAYOUT.md).

## Available components

| Helper | Purpose |
|--------|---------|
| `G.ui.lookupHero(opts)` | Item or monster detail header (`layout: 'item' \| 'monster'`) |
| `G.ui.statCard({ label, value, className, valueHtml })` | Single stat tile |
| `G.ui.statGrid(cards[], className?)` | Grid of stat cards |
| `G.ui.bonusTable({ offence, defence, extras, slot, mode })` | Equipment or monster combat bonuses |
| `G.ui.levelsGrid(levels)` | Monster combat level row |
| `G.ui.presetChips({ groups, dataAttr, activeId })` | Filter preset button rows (HTML string) |
| `G.ui.setActivePreset(dataAttr, activeId)` | Toggle `.active` on preset buttons |
| `G.ui.bindPresetChips({ dataAttr, onSelect, extraSelector? })` | Wire preset click handlers |
| `G.ui.detailsDisclosure({ summary, content, open })` | Collapsible tips/disclaimer |
| `G.ui.dropCategory({ title, drops, renderDropRow, open })` | Wiki-style drop section |
| `G.ui.dropSimulator({ monsterId })` | Drop roll simulator panel markup |
| `G.ui.bindDropSimulator(root, { getMonster, getSellPrice })` | Wire simulator buttons + render results |
| `G.ui.sectionCard({ title, bodyHtml, className, footHtml })` | Generic `lookup-card` wrapper |
| `G.ui.emptyState(message, { loading })` | Empty/error message |
| `G.ui.loadingSkeleton(type)` | Placeholder — `'hero'`, `'grid'`, `'card'`, `'list'` |

## When to use what

### `gra-item-list` vs tables

- **Item lists** (`G.renderItemList`, `gra-item-list` CSS grid): ranked tool results — flips, alch, coffer, transforms. Sortable columns, skeleton rows, mobile column hiding.
- **Tables** (`G.ui.bonusTable`, `G.ui.dropCategory`): fixed-schema data — equipment bonuses, drop rates. Not sortable; used on lookup/detail pages.
- **Stat grids** (`G.ui.statGrid`): key-value summaries (GE prices, slayer info, monster attributes).

### Preset chips

Define preset config in page JS; render chips in HTML or via `G.ui.presetChips`. Use `G.ui.bindPresetChips` + `G.ui.setActivePreset` instead of duplicating toggle logic.

Data attributes by page:

| Page | Attribute |
|------|-----------|
| Coffer | `data-coffer-preset` |
| Alch | `data-alch-preset` |
| Transforms | `data-xf-preset` |
| Flips top-10 | `data-t10-preset` |

## Rules

- **No user-facing dev text** — no npm/build instructions, script names, or “component library” copy on live pages.
- **No npm/build on user pages** — build scripts live in repo only; runtime is static JS/CSS.
- **Theme** — components use `--g-*` / graa-shell tokens (`var(--surface)`, `var(--border)`, etc.) for dark/light compatibility.
- **Extend, don’t fork** — add new helpers to `components.js` rather than copy-pasting markup in page scripts.

## Pages using components

- `tools/item.html` — hero, stat grid, bonus table
- `tools/monster.html` — hero, stats, drops, simulator
- `tools/coffer.html`, `tools/alch.html` — preset chip helpers
- `tools/recipes.html`, `tools/flips.html` (transforms tab) — preset chip helpers via `transforms.js`
