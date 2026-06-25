# OSRS Companion — Master Plan

> **Vision:** Build the Garmoth-equivalent for Old School RuneScape — one beautiful, trusted hub where players plan gear, track progress, and make GP with live Grand Exchange data. Free tools that hook you in; Pro tools you pay for because they save time every session.

**Brand / domain:** **Graador** → [graador.com](https://graador.com) *(General Graardor — OSRS-native, memorable)*  
**Repo:** [github.com/GStan5/osrs-ge-flip-finder](https://github.com/GStan5/osrs-ge-flip-finder) *(rename optional later)*  
**Current state:** Phase 0 complete — live flip finder, recipes catalog, favorites, shareable URLs, Vercel-ready static deploy.

**Stack decisions (locked):**

| Choice | Decision |
|--------|----------|
| Database | **Neon Postgres** via Vercel Marketplace (not Supabase) |
| Auth | **No Discord** at launch — defer OAuth; email or anonymous until Phase 2 |
| Payments | **Ko-fi first** (tips + memberships); Stripe only if Ko-fi gating becomes painful |

---

## Table of contents

1. [What Garmoth gets right (our north star)](#1-what-garmoth-gets-right-our-north-star)
2. [What we already have](#2-what-we-already-have)
3. [Target product — site map & tools](#3-target-product--site-map--tools)
4. [Design direction — beautiful OSRS-native UI](#4-design-direction--beautiful-osrs-native-ui)
5. [Technical architecture](#5-technical-architecture)
6. [Phased roadmap](#6-phased-roadmap)
7. [Who does what — setup outside vs built in repo](#7-who-does-what--setup-outside-vs-built-in-repo)
8. [Monetization plan](#8-monetization-plan)
9. [Legal & Jagex compliance](#9-legal--jagex-compliance)
10. [Success metrics](#10-success-metrics)
11. [Decision log](#11-decision-log)

---

## 1. What Garmoth gets right (our north star)

| Garmoth pillar | Why it works | OSRS equivalent |
|----------------|--------------|-----------------|
| **One hub, many tools** | Players bookmark one site, not ten | Economy + Track + Plan under one nav |
| **Live market data everywhere** | Prices flow into every calculator | Wiki Real-time Prices API in all tools |
| **Personal data + community stats** | “How am I doing?” + “What’s meta?” | Flip logs, boss GP/hr aggregates |
| **Shareable builds & presets** | Viral links, clan sharing | URL params → cloud saved presets |
| **Changelog & NEW badges** | Trust that the site is maintained | `/changelog`, tool badges |
| **Free core + Pro depth** | Free hooks; Pro retains power users | Alerts, history, RuneLite sync |
| **Polished, consistent UI** | Feels like a product, not a spreadsheet | Unified design system (Phase 1) |

We do **not** copy BDO mechanics (failstacks, AP/DR). We copy the **product shape**: daily-driver companion with economy tools first, tracking second, planners third.

---

## 2. What we already have

**Phase 0 — shipped**

- [x] Top 10 flips ranked by GP/hour with presets
- [x] Search & filter (margin, volume, members, favorites, flip qty)
- [x] Recipes tab (~1,900 rows: skilling, decants, sets) from wiki build script
- [x] Live prices from `prices.runescape.wiki`
- [x] GE tax-aware profit math
- [x] Favorites (localStorage), shareable URLs, copy prices, wiki links
- [x] Ko-fi link, ad rails (hidden), mobile table scroll
- [x] `vercel.json` security headers + data caching
- [x] `npm run build:recipes` catalog pipeline

**This is our wedge** — the “Exchanges library” slice of Garmoth, already competitive with [osrs.exchange](https://www.osrs.exchange/).

---

## 3. Target product — site map & tools

```
┌─────────────────────────────────────────────────────────────────┐
│  HOME — trending flips, recipe spotlight, latest game updates   │
├─────────────────────────────────────────────────────────────────┤
│  TOOLS ▼                                                         │
│    Economy    Flips │ Recipes │ Death's Coffer │ High Alch │ Item │
│    Track      Flip Log │ Boss GP/hr │ Farm Runs (later)          │
│    Plan       Boss Prep │ Supply Cost (later) │ Gear (later)     │
│  GUIDES     Short, tool-linked how-tos                           │
│  CHANGELOG  Ship notes + NEW/HOT badges on nav                   │
│  ACCOUNT    Discord login → cloud sync (Phase 2+)                │
└─────────────────────────────────────────────────────────────────┘
```

### Tool priority matrix

| Tool | Phase | Free | Pro | Build complexity |
|------|-------|------|-----|------------------|
| GE Flip Finder | 0 ✅ | ✅ | — | Done |
| Recipe / Transform hub | 0 ✅ | ✅ | — | Done |
| Site shell + design system | 1 | ✅ | — | Medium |
| Item detail pages | 1 | ✅ | charts | Medium |
| Death's Coffer optimizer | 1 | ✅ | shopping lists | Low |
| High Alch scanner | 1 | ✅ | queue mode | Low |
| F2P flip preset | 1 | ✅ | — | Trivial |
| Price history charts | 1 | 24h | 30d+ | Medium |
| Flip session log | 2 | 7 days | unlimited | Medium |
| Discord login + cloud favorites | 2 | ✅ | ✅ | Medium (needs backend) |
| Price alerts (Discord webhook) | 2 | — | ✅ | Medium |
| Boss supply / GP/hr calculator | 3 | ✅ | save presets | Medium |
| Herb run planner | 3 | ✅ | — | Medium |
| Community flip aggregates | 3 | delayed | realtime | High |
| RuneLite plugin (GE sync) | 4 | basic | full | High |
| Gear / DPS (embed or partner) | 4+ | link | — | High if built |

---

## 4. Design direction — beautiful OSRS-native UI

### Brand feel

- **Tone:** RuneScape-adjacent without using Jagex assets — medieval fantasy, gold trim, parchment warmth, not generic “dark mode SaaS.”
- **Reference mix:** Garmoth’s clarity + osrs.exchange’s data density + OSRS wiki readability.
- **Avoid:** Neon cyberpunk, generic purple gradients, cluttered tables without mobile escape hatches.

### Design system (Phase 1 deliverable)

| Token | Current | Target |
|-------|---------|--------|
| Background | `#1a1410` brown | Keep — reads as “GE / tavern” |
| Accent | `#c9a227` gold | Gold for CTAs, profit highlights |
| Profit | `#5cb85c` | Green rows for positive margin |
| Loss / risk | `#c75050` | Red for dumps, negative ROI |
| Surface layers | 2 levels | 3 levels + subtle texture optional |
| Typography | Segoe UI | **Cinzel or MedievalSharp for headings** + **Inter or system UI for tables** |
| Icons | Text only | Simple SVG set (coin stack, potion, sword, chart) |

### Layout patterns (Garmoth-style)

1. **Persistent top bar** — logo, Tools mega-menu, Changelog, Support (Ko-fi), Upgrade (Pro), account avatar.
2. **Tool sub-nav tabs** — Economy tools share one chrome; switching Flips ↔ Recipes feels instant.
3. **Summary cards above tables** — “Best flip right now”, “Total profit at qty”, “Last refresh”.
4. **Pinned footer** on short pages; hidden on full-screen tool views.
5. **NEW / HOT pills** on nav items when tools ship.
6. **Responsive** — horizontal scroll tables + “scroll hint” on mobile (already started).

### Homepage (Phase 1)

- Hero: one-line value prop + “Open Flips” / “Browse Recipes”
- Live stats strip: items tracked, last price refresh, top margin item
- Tool cards grid with icons
- “Recently updated” changelog snippet
- Disclaimer footer (Jagex unaffiliated)

---

## 5. Technical architecture

### Today (Phase 0)

```
index.html (single SPA)
    ├── fetch live prices → prices.runescape.wiki
    └── fetch static catalog → data/recipes.json

scripts/build-recipes.mjs → regenerates data/recipes.json from wiki
vercel.json → static hosting, headers, cache
```

### Phase 1 — multi-page static site (still no backend)

```
/
├── index.html              Home
├── tools/
│   ├── flips.html          (extract from current SPA)
│   ├── recipes.html
│   ├── coffer.html
│   ├── alch.html
│   └── item.html?id=4151  Item detail
├── guides/
├── changelog.html
├── assets/
│   ├── css/theme.css       Shared design system
│   ├── js/prices.js        Shared price client
│   └── js/components.js    Tables, toasts, favorites
├── data/
│   ├── recipes.json
│   ├── items-meta.json     Names, limits, members (build script)
│   └── coffer-rules.json   Static rules where needed
└── scripts/
    ├── build-recipes.mjs
    └── build-items.mjs
```

**Build tool:** Vite or Astro (recommended: **Astro** — great for mostly-static, easy partial hydration).  
**Deploy:** Still Vercel, zero env vars for Phase 1.

### Phase 2 — accounts & Pro (needs backend)

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Static site │────▶│  API (serverless)│────▶│  Postgres    │
│  Vercel      │     │  Vercel / Railway│     │  Supabase or │
└──────────────┘     └─────────────────┘     │  Neon        │
         │                    │               └──────────────┘
         │                    ├── Discord OAuth
         │                    ├── Stripe / Ko-fi webhook
         │                    └── Alert cron jobs
         ▼
   RuneLite plugin (Phase 4) ──▶ same API
```

**Recommended stack for Phase 2+**

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Astro + shared components | Fast, SEO, incremental |
| API | Vercel Serverless Functions or Cloudflare Workers | Fits static deploy |
| Database | **Neon Postgres** (Vercel integration) | Same stack as Vercel deploy; `DATABASE_URL` auto-injected |
| Payments | **Ko-fi** memberships + webhooks | Already configured; Stripe deferred |
| Auth | Email magic link or session token | Discord OAuth deferred |
| Alerts | Discord webhooks + cron (Vercel cron) | OSRS players live on Discord |
| Analytics | Plausible or Vercel Analytics | Privacy-friendly |

### Data sources (all free, no keys for core tools)

| Source | Use |
|--------|-----|
| [Wiki Real-time Prices API](https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices) | Live GE buy/sell, volumes |
| [Wiki Bucket API](https://oldschool.runescape.wiki/w/RuneScape:Bucket) | Recipes, item metadata |
| OSRS Wiki parse API | Changelog scraping, guides |
| RuneLite Wiki API | Item mapping (already used in build script) |

---

## 6. Phased roadmap

### Phase 0 — Foundation ✅ COMPLETE

**Goal:** Prove the economy wedge works.  
**Deliverables:** Flip finder, recipes, deploy pipeline, Ko-fi hook.  
**Duration:** Done.

---

### Phase 1 — “Real website” shell + Economy suite

**Goal:** Feel like Garmoth’s hub, not a single HTML file. Match osrs.exchange feature parity and exceed on UX.

| # | Task | Output |
|---|------|--------|
| 1.1 | Rebrand + site shell (header, footer, tools nav, home) | Multi-route site |
| 1.2 | Extract shared CSS/JS design system | `assets/css/theme.css`, components |
| 1.3 | Death's Coffer tool | `/tools/coffer` |
| 1.4 | High Alch profit scanner | `/tools/alch` |
| 1.5 | Item detail page (price, margin, used-in-recipes) | `/tools/item?id=` |
| 1.6 | F2P flip filter preset | Toggle on flips |
| 1.7 | Basic price sparklines (wiki 5m/1h/24h) | On item detail |
| 1.8 | Changelog page + NEW badges | `/changelog` |
| 1.9 | SEO: meta, OG tags, sitemap, `robots.txt` | Discoverability |
| 1.10 | Enable ad rails OR keep hidden until traffic | Config flag |

**Exit criteria:** A new player can land on home, find a flip, check a recipe, run coffer math, and share a link — all without touching the old single-file feel.

**Estimated effort:** 2–4 weeks of focused build sessions.

---

### Phase 2 — Accounts, sync, Pro v1

**Goal:** Retention + first paid tier.

| # | Task | Output |
|---|------|--------|
| 2.1 | Discord OAuth login | Account button in header |
| 2.2 | Cloud sync favorites & presets | Cross-device |
| 2.3 | Flip session log (manual entry first) | `/tools/flip-log` |
| 2.4 | Extended price history for Pro | 30–90 day charts |
| 2.5 | Discord webhook price alerts | Pro feature |
| 2.6 | Stripe or Ko-fi membership gate | `/upgrade` page |
| 2.7 | Admin: feature flags for Pro | Server-side checks |

**Exit criteria:** User logs in on phone + PC, same watchlist; Pro user gets an alert when a watched item spikes.

**Estimated effort:** 3–5 weeks (+ external setup — see §7).

---

### Phase 3 — Track & Plan tools

**Goal:** Garmoth-style “session intelligence” for OSRS.

| # | Task | Output |
|---|------|--------|
| 3.1 | Boss / activity supply calculator | GP/hr after supplies |
| 3.2 | Herb run profit planner | Patch list + seed costs |
| 3.3 | Opt-in anonymous flip aggregates | “Top items this week” |
| 3.4 | Boss prep checklist (shareable) | Per-boss loadout + GE cost |
| 3.5 | Guide pages linked from tools | SEO content |

**Exit criteria:** Player tracks a flip session, plans a herb run, compares to community averages.

**Estimated effort:** 4–6 weeks.

---

### Phase 4 — Moat: RuneLite + community

**Goal:** Hard to copy; worth paying for.

| # | Task | Output |
|---|------|--------|
| 4.1 | RuneLite plugin (Plugin Hub) | GE offer sync to site |
| 4.2 | Live P&L dashboard | Pro terminal view |
| 4.3 | Import loot screenshots / CSV | Boss log helper |
| 4.4 | Gear planner integration | Embed Gearscape or lightweight preset builder |

**Exit criteria:** Install plugin → offers appear on website dashboard.

**Estimated effort:** 6–10 weeks (plugin review adds calendar time).

---

### Phase 5 — Polish & scale

- Custom domain + email
- Mobile PWA (“Add to Home Screen”)
- API rate-limit caching layer (edge)
- More skilling profit routes in recipe builder
- Localization (low priority)

---

## 7. Who does what — setup outside vs built in repo

### ✅ Built entirely in this repo (I can do this with you)

- All Phase 0–1 tools and UI
- Astro/Vite migration and design system
- Build scripts (`build-recipes`, `build-items`, coffer data)
- Static pages, guides, changelog
- Client-side favorites, URL sharing (until Phase 2)
- `vercel.json`, README, sitemap
- RuneLite plugin **source code** (Java/Kotlin in a subfolder)
- Stripe **integration code** (once you create the Stripe account)

### 🔧 You set up externally (I cannot do alone — ~30–60 min each)

These require **your** accounts, billing, or identity verification. I’ll provide exact click-path instructions when we reach each phase.

| Setup | When | Why you | What I need from you |
|-------|------|---------|----------------------|
| **Vercel project** | Phase 0→1 | Links GitHub to deploy | Confirm project connected to repo *(likely done)* |
| **Custom domain** | Phase 1 | DNS on your registrar | Domain name + DNS access |
| **Ko-fi** | Now ✅ | Payouts to you | Username `greatblue` — done |
| **Google AdSense** | Phase 1+ (optional) | Tax/payout identity | AdSense approval (can take weeks) |
| **Neon Postgres (Vercel)** | Phase 2 | Database host | Install from Vercel Marketplace → `DATABASE_URL` |
| **Ko-fi webhooks** | Phase 2 Pro | Membership events | Verification token → Vercel env var |
| **Ko-fi membership tier** | Phase 2 Pro | Define “Graador Pro” price | Tier name must match webhook logic |
| ~~Discord OAuth~~ | Deferred | — | Not needed at launch |
| ~~Stripe~~ | Deferred | — | Add only if Ko-fi gating is insufficient |
| **Discord server + webhook** | Phase 2 alerts (optional) | Price alerts | Webhook URL for testing |
| **Plausible / analytics** | Phase 1 | Optional privacy analytics | Site domain added |
| **RuneLite Plugin Hub PR** | Phase 4 | Jagex/RuneLite review | GitHub account linked to plugin repo |
| **Logo / favicon commission** | Phase 1 | Optional brand asset | PNG/SVG if you want custom art |

### 🔒 Secrets never committed to Git

Store in **Vercel Environment Variables** (or `.env.local` locally, gitignored):

```
DATABASE_URL              # from Vercel + Neon integration
KO_FI_VERIFICATION_TOKEN  # from ko-fi.com/manage/webhooks
SESSION_SECRET            # random string for auth cookies (Phase 2)
```

### Seamless workflow (how we work together)

```
You:  "Let's start Phase 1"
Me:   Build site shell + coffer tool in repo → push to main
You:  Vercel auto-deploys (zero config if already linked)
You:  Optional — point custom domain when ready
Me:   "Phase 2 needs Discord OAuth" → I send 5-step checklist
You:  Create Discord app, paste secrets into Vercel
Me:   Wire auth + deploy
```

**Bottom line:** Phases 0–1 need **nothing outside** except Vercel (already set) and optionally a domain. Phase 2+ needs **~4 external accounts** (Discord, Supabase, Stripe, webhooks) — one afternoon of setup, then I handle all code.

---

## 8. Monetization plan

### Free forever (growth)

- GE flips, search, recipes, decants, sets
- Death's Coffer & High Alch basics
- Favorites (local, then cloud when logged in)
- Shareable links

### Supporter / Pro (~$5–8/month)

| Feature | Rationale |
|---------|-----------|
| No ads | Simple upsell |
| Cloud sync unlimited presets | Cross-device |
| Flip log unlimited history | Power flippers |
| Price alerts (Discord) | Saves active monitoring time |
| Extended price charts | GE Tracker charges for similar |
| Early access tools | Rewards supporters |

### Ko-fi (now)

- Tip jar + optional membership tier matching Pro
- Keep visible in header/footer

### Ads (later)

- Side rails already in HTML (`body.ads-off` → remove class when AdSense approved)
- Never block core tables with interstitials

### What we won't paywall

- Basic flip search and recipe profit — SEO and trust depend on it.

---

## 9. Legal & Jagex compliance

- Footer on every page: **Not affiliated with Jagex Ltd.**
- Use **Wiki API** and player-submitted data; no game client reverse engineering on web tools.
- RuneLite plugin must follow [Plugin Hub rules](https://github.com/runelite/runelite/wiki/Creating-plugins).
- No “bot” or automation claims — planners and calculators only.
- GE tax disclaimer: estimates; verify in-game before placing offers.

---

## 10. Success metrics

| Milestone | Target (6 months post Phase 1) |
|-----------|--------------------------------|
| Vercel monthly visitors | 5,000+ |
| Avg session duration | >3 min |
| Return visitors | >25% |
| Ko-fi / Pro subscribers | 10+ |
| Discord server (optional) | Community feedback channel |
| Recipe + flip tool parity | Match osrs.exchange core; beat on UX |

---

## 11. Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06 | Static-first on Vercel | Zero cost, fast ship, wiki API is client-safe |
| 2026-06 | Recipes via build script | 1MB JSON OK with cache headers; avoids runtime wiki scrape |
| 2026-06 | Ko-fi before Stripe | Already configured; Stripe in Phase 2 |
| TBD | Astro vs stay single HTML | Astro when Phase 1 multi-page ships |
| 2026-06 | Brand: **Graador** / graador.com | Graardor — iconic OSRS boss, short domain |
| 2026-06 | **Neon** via Vercel (not Supabase) | User preference; single vendor |
| 2026-06 | **No Discord** at launch | Simplify Phase 2 auth |
| 2026-06 | **Ko-fi** over Stripe initially | Already set up; webhooks for Pro |
| TBD | Stripe fallback | Only if subscription lifecycle needs cancel/refund API |

---

## Quick start — next session checklist

When you're ready to begin **Phase 1**, say *"Start Phase 1"* and we will:

1. [ ] Choose final brand name (or keep OSRS Companion)
2. [ ] Scaffold Astro project structure alongside current app
3. [ ] Build home page + shared header/footer
4. [ ] Migrate Flips + Recipes into new shell
5. [ ] Ship Death's Coffer as first new tool
6. [ ] Add changelog page and sitemap
7. [ ] Push → Vercel auto-deploy

**No external setup required for steps 1–7.**

---

*Document version: 1.0 — June 2026*  
*Maintained in repo at `docs/PROJECT_PLAN.md`*
