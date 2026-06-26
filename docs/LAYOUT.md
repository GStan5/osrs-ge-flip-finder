# Graardor page layout

Internal reference for consistent responsive width across all pages.

## Tokens (`graa-shell.css`)

| Token | Purpose |
|-------|---------|
| `--g-max` | Fluid max content width (1120 → 1280 → 1680 → 1920 → 2200px by viewport) |
| `--g-page-max` | Alias of `--g-max` — use this for page containers |
| `--g-content-pad` | Horizontal page padding (`1.25rem`) |
| `--g-wide-breakpoint` | Wide layout breakpoint (`1440px`) |

## Utility classes

| Class | Use |
|-------|-----|
| `.page-shell` | Standard page wrapper — `max-width: var(--g-page-max)`, centered, horizontal pad |
| `.page-shell-wide` | Tool pages — same cap, full width inside tool layout |
| `.page-main` | Flex-grow main column inside `.content-shell` or tool grid |

## Aliases (same rules as `.page-shell`)

These selectors already apply the layout system — prefer them over duplicating CSS:

- `.home-main`, `.tools-hub-main`
- `.content-shell` (with `body.ads-off` = single column, full `--g-page-max`)
- `.page-hero`, `.site-header-inner`, `.header-tool-subnav`
- `.tool-layout-grid` (via `body.tool-page-wide`)
- `.upgrade-grid`, `.changelog-list`, `.guide-article`
- `body.site > .tool-page-main` (standalone tool pages)

## Rules

1. **Never hardcode `max-width` on page wrappers in HTML** — no inline `style="max-width:…"`.
2. **Never add fixed page widths in CSS** (720px, 900px, etc.) — use `var(--g-page-max)`.
3. **Tool pages** under `/tools/*` get `body.tool-page-wide` + `body.page-wide` from `site-chrome.js` (`layoutToolPage`).
4. **Hub / guide / misc pages** get `body.page-wide` from `applyPageWideClass()` in `site-chrome.js`.
5. **Item lists** (`.gra-item-list-wrap`) fill parent width at ≥1440px — see `item-list.css`.

## Breakpoints (`--g-max`)

| Viewport | `--g-max` |
|----------|-----------|
| &lt;1280px | 1120px |
| ≥1280px | 1280px |
| ≥1440px | 1680px |
| ≥1920px | min(1920px, 90vw) |
| ≥2560px | min(2200px, 90vw) |

Mobile: full width minus `--g-content-pad` (safe-area aware in media queries).

## User-facing copy

Internal rules for all pages and `G.ui` output: [graardor-copy.mdc](../.cursor/rules/graardor-copy.mdc). Keep hero titles, labels, and one-line disclaimers only — no filler subtitles or table footnotes.
