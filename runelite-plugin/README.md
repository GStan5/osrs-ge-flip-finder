# Graardor RuneLite Plugin (Phase 4 skeleton)

This folder contains a **starter** RuneLite plugin that opens Graardor item pages from GE offers. It is not yet published to the Plugin Hub — submission requires Jagex/RuneLite review.

## Status

- [x] Plugin scaffold + config panel
- [x] Opens `https://www.graardor.com/tools/item?id=` for hovered GE item
- [ ] Offer sync to Graardor Pro dashboard (needs authenticated API)
- [ ] Plugin Hub submission

## Build (local)

1. Clone [runelite/runelite](https://github.com/runelite/runelite)
2. Copy this module into `runelite-client` or wire as a standalone Gradle subproject per [Creating plugins](https://github.com/runelite/runelite/wiki/Creating-plugins)
3. Run the RuneLite client with the plugin enabled

## Graardor API (future)

Pro users will sync GE slots via `POST /api/runelite/offers` with session cookie or API token.

## Compliance

Follow Plugin Hub rules — no automation, no input simulation. This plugin only reads GE UI and opens links.
