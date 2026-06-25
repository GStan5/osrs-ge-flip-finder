# OSRS GE Flip Finder

Search and rank Old School RuneScape Grand Exchange flips using live buy/sell prices from the [OSRS Wiki Real-time Prices API](https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices) (RuneLite).

## Features

- **Top 10** — ranked by GP/hour with budget/style presets
- **Search** — filter by name, margin, volume, cycle time, tax, and more
- Live rec. buy / rec. sell, 2% GE tax (max 5M/item), bond exempt

## Run locally

```bash
npm start
```

Or double-click `start.bat`, then open http://localhost:3500

> Use a local server — opening `index.html` directly in the browser may block API requests.

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Leave **Framework Preset** as Other / no build command
4. Deploy — `index.html` at the repo root is served as the site

No environment variables required. Price data is fetched in the browser from `prices.runescape.wiki`.

## Disclaimer

Estimates only. Prices and margins change constantly; verify in-game before trading.
