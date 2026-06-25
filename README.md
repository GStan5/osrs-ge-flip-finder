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

## Deploy (Vercel)

- Import repo — **no build command**, output `/`
- Env vars: `DATABASE_URL`, `SESSION_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `KO_FI_VERIFICATION_TOKEN`
- Ko-fi webhook URL: `https://graardor.com/api/kofi-webhook`

## Disclaimer

Not affiliated with Jagex Ltd. Verify all prices and offers in-game.
