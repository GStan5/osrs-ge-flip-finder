# Graardor

OSRS companion tools — live Grand Exchange prices, flip finder, recipes, Death's Coffer, high alch, and more.

**Live site:** [graardor.com](https://graardor.com)

## Tools

| Tool | Path |
|------|------|
| Homepage | `/` |
| GE Flip Finder | `/tools/flips` |
| Recipe Profit | `/tools/recipes` |
| Death's Coffer | `/tools/coffer` |
| High Alch | `/tools/alch` |
| Changelog | `/changelog` |

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3500

## Regenerate recipe catalog

```bash
npm run build:recipes
```

## Regenerate item equipment stats (bundled on item pages)

```bash
npm run build:items-meta
```

Generates `data/items-meta.json` from [osrsbox-db](https://github.com/osrsbox/osrsbox-db) — no live API at runtime.

## Regenerate monster stats (bundled on monster pages)

```bash
npm run build:monsters-meta
```

Generates `data/monsters-meta.json` from osrsbox-db — combat levels, HP, slayer info, and bonuses.

## Deploy (Vercel)

- Import **GStan5/osrs-ge-flip-finder** — **no build command**, output `/`, production branch **`main`**
- Env vars: `DATABASE_URL`, `SESSION_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` (optional; see [docs/DISCORD_OAUTH.md](docs/DISCORD_OAUTH.md)), `KO_FI_VERIFICATION_TOKEN`, `CRON_SECRET`
- Ko-fi webhook URL: `https://www.graardor.com/api/kofi-webhook`
- **Git auto-deploy:** Project → Settings → Git → connect this repo. Pushes to `main` should appear under Deployments within ~1 min.
- **Price alert cron (Hobby plan):** Vercel free only allows once-daily crons, so use [cron-job.org](https://cron-job.org) (free) every 15 min:
  - URL: `https://www.graardor.com/api/cron/check-alerts`
  - Header: `Authorization: Bearer YOUR_CRON_SECRET`

## Disclaimer

Not affiliated with Jagex Ltd. Verify all prices and offers in-game.
