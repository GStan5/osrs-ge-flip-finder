# OSRS GE Flip Finder

Search and rank Old School RuneScape Grand Exchange flips using live buy/sell prices from the [OSRS Wiki Real-time Prices API](https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices) (RuneLite).

## Features

- **Top 10** — ranked by GP/hour with budget/style presets
- **Search** — filter by name, margin, volume, cycle time, tax, favorites, and custom flip quantity
- **Recipes** — ~1,900 skilling recipes plus potion decants and GE item set combine/split (wiki catalog)
- Click buy/sell prices to copy; item names link to the OSRS Wiki
- Shareable URLs (tab + filters); favorites saved in your browser
- Manual **Refresh prices** — prices stay fixed while your GE offers fill

## Run locally

```bash
npm start
```

Or double-click `start.bat`, then open http://localhost:3500

> Use a local server — opening `index.html` directly in the browser may block API requests.

## Regenerate recipe catalog

When the wiki adds new recipes or sets:

```bash
npm run build:recipes
```

Writes `data/recipes.json` from the OSRS Wiki Bucket API and GE mapping. Commit the updated file when you want production to pick it up.

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. **Framework Preset:** Other — no build command, output directory `/` (repo root)
4. Deploy — `index.html` and `data/recipes.json` are served as static files

No environment variables required. Price data is fetched in the browser from `prices.runescape.wiki`.

## Disclaimer

Estimates only. Not affiliated with Jagex. Verify every offer in-game before buying or selling.
