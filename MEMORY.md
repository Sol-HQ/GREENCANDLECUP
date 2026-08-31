# GREENCANDLECUP — Project Memory

**Rules (permanent):**
- This file is **append-only**. Never delete or rewrite past entries.
- Each new session adds a **new entry** below the previous one.
- Every entry must include: **date**, **time (timezone)**, and **model** that wrote it.
- New entries continue from where the last entry ended.

---

## Entry 001

| Field | Value |
|-------|-------|
| **Date** | 2026-08-30 |
| **Time** | 4:53 PM EDT (UTC-4) |
| **Model** | Auto |

### Where we are

Monorepo is scaffolded and running locally at `C:\Users\chris\GREENCANDLECUP` (GitHub: `Sol-HQ/GREENCANDLECUP`).

**Competition:** Green Candle Cup · Phoenix perps · starts **Sep 1, 2026, 10 AM EST**  
**Wallet:** `iamaaZQHyc1FZkaqCFKhDuSt5JyLZYbveHUkAcWyFoA` · Frontier username **Chris24**

### What works today

- Next.js dashboard: Overview, Trade, Positions, Orders, Bot, System
- Hono API + WebSocket on `:8787`, Helius RPC wired
- Phoenix market data, orderbook, **candles API** (no custom candle building)
- **GCC Chart** tab: Phoenix candles + MACD (`lightweight-charts`)
- TradingView + Birdeye embed tabs (visual reference)
- Bot strategies: `trend_macd`, `pullback`, `momentum`, `mean_reversion`, `manual`
- TA package (`@gcc/ta`): EMA, MACD, trend detection from Phoenix candles
- Paper bot with volume/PnL counters; risk limits package
- Header toggles: **Mainnet/Devnet** (wallet RPC) + **Paper/Live** (execution mode)
- Trade workspace: drawing overlay (localStorage) + draggable sticky notes (S/M/L)
- Learn panel + glossary on Bot page
- Phase 1 gate script passed historically; dev servers recovered after `.next` cache corruption

### Paper trading — how it actually works here

Paper is **not** fake prices. The bot uses **real Phoenix mark price, orderbook, and candles**. When mode is `paper`, `TradingCore.buildOrder()` runs the full path (risk checks, size math, signal logic) but **does not sign or submit** a Solana transaction. It returns a simulated fill and increments volume/trade metrics. That is a real sandbox for strategy logic without capital at risk.

### Mainnet vs Devnet vs Paper vs Live (quick ref)

| Toggle | Controls |
|--------|----------|
| **Mainnet / Devnet** | Which Solana RPC the **wallet** uses |
| **Paper / Live** | Whether orders are **simulated** or **submitted to Phoenix** |
| GCC competition | Always **Mainnet + Live** when going for real |

### ShredStream (Phase 2 — not active)

Raw UDP tx shreds to VPS for **speed edge** (see fills before REST). Does not replace candles or strategy. Triton + NYC VPS + `SHREDSTREAM_UDP_PORT` when funded.

### Known gaps / not done yet

- Positions & Orders pages are placeholders (need Rise trader-state streams)
- Live signing: `BOT_KEYPAIR_PATH` not configured for user yet
- Browser wallet manual trade signing incomplete ("connect wallet" path)
- Telegram/Discord mobile pings not built
- Vultr VPS not deployed; ShredStream not wired
- Uncommitted local work: charts, TA, bot strategies, network toggles, workspace UI (this commit)

### Next focus (see `CHECKLIST.md`)

1. User validates all tabs in browser (paper bot + charts + toggles)
2. Commit/sync this batch
3. Flesh Positions/Orders from Phoenix
4. VPS + Triton + ShredStream smoke test
5. Go live Mainnet + Live before Sep 1 10 AM EST

---

*End of Entry 001 — next entry appends below this line.*

---

## Entry 002 — Session handoff (agent continuity)

| Field | Value |
|-------|-------|
| **Date** | 2026-08-30 |
| **Time** | 8:52 PM EDT (UTC-4) |
| **Model** | Auto |

### Why this entry exists

User's Cursor agent chat was in a window **without** `GREENCANDLECUP` as the workspace folder. Running `cursor C:\Users\chris\GREENCANDLECUP` opened a **second** window with the repo but **without this chat**. **Agent chats do not transfer between windows** — read this entry + `.gcc-vault.local` in the GREENCANDLECUP workspace to continue.

**Correct setup:** One Cursor window → **File → Open Folder** → `C:\Users\chris\GREENCANDLECUP` → use Agent in that same window (don't spawn a second window).

### Project path (canonical)

```
C:\Users\chris\GREENCANDLECUP
```

GitHub: `Sol-HQ/GREENCANDLECUP`  
Primary email (all services): `chris247777@gmail.com`  
Frontier username: **Chris24**  
Competition wallet: `iamaaZQHyc1FZkaqCFKhDuSt5JyLZYbveHUkAcWyFoA`

### Secrets vault (local only)

- **File:** `C:\Users\chris\GREENCANDLECUP\.gcc-vault.local` (hidden, git-ignored)
- Contains: Vultr, Frontier, Triton, Helius, Phoenix, VPS IP, checklist
- User must paste **VULTR_ROOT_PASSWORD** there (do not commit)
- Helius key also in repo-root `.env` (git-ignored)

### Vultr VPS — DEPLOYED 2026-08-30

| Field | Value |
|-------|-------|
| Name | gcc-bot |
| IP | **144.202.12.134** |
| Instance ID | 98c9c487-36f6-41b0-acf0-9017a71cfca8 |
| Console | https://console.vultr.com/subs/?id=98c9c487-36f6-41b0-acf0-9017a71cfca8 |
| OS | Ubuntu 22.04 LTS x64 |
| Plan | vc2-1c-1gb ($5/mo, ~$0.007/hr) |
| Location | New York (NJ) |
| Login | `root` + password from Vultr → Show Password |
| Billing | Hourly while instance exists; destroy after Sep 8 |

**Next VPS steps:** Start server if Stopped → SSH in → register IP with Triton (port 8002, NYC) → clone repo → deploy bot per `deploy/VPS-DEPLOY.md`

### What we built this session (uncommitted)

1. **Page guides** on all tabs (`packages/shared/src/glossary.ts`, `apps/web/src/components/page-guide.tsx`)
2. **Getting started card** on Overview
3. **Bot scan logging** — every ~10s: `Scan SYMBOL @ $price · trend · signal — reason` (`packages/bot-engine`)
4. **Bot activity panel** on Bot page (`bot-activity-panel.tsx`) + `/api/logs` + WS snapshot on connect
5. **GCC chart** improvements (1000 candles, volume/MACD panes, live mark) — prior in session
6. **Birdeye mint resolver** for Phoenix tokens
7. **`.gcc-vault.local`** + `.gitignore` updated

### Product clarity (user mental model)

- **Not** a Phoenix UI clone — **bot + competition command center**
- **Paper** works now (real prices, simulated fills)
- **Live** submit NOT wired yet — critical path before GCC
- **Positions/Orders** tabs = placeholders
- GCC = Phoenix perps only; two prize tracks: PnL + Volume
- Level 3 HFT/MM not required

### Local dev commands

```powershell
cd C:\Users\chris\GREENCANDLECUP
pnpm build:packages
pnpm --filter @gcc/server dev   # :8787
pnpm --filter web dev           # :3000
```

Dashboard: http://localhost:3000 · Bot page → Start → watch **Bot activity (live)** Scan lines

### Immediate next tasks (priority order)

1. User pastes Vultr root password into `.gcc-vault.local`
2. **Wire live tx submit** in `packages/trading-core` + bot (`BOT_KEYPAIR_PATH` on VPS)
3. SSH to VPS, run `deploy/setup-vps.sh`, register **144.202.12.134:8002** with Triton
4. Fund Phoenix collateral on competition wallet
5. Paper bot soak test on SOL 1m Trend+MACD overnight
6. Destroy Vultr after Sep 8

### Known gaps (unchanged)

- Live signing not wired
- Positions/Orders empty
- ShredStream inactive until VPS + Triton provisioned
- Large batch of local changes **not committed** (user has not asked to commit)

### Agent transcript (this conversation)

Cursor stores chat at:  
`C:\Users\chris\.cursor\projects\F-Android-temp-cd04fcf0-d6e7-4dc7-ae29-d1968d1789ef/agent-transcripts/`  
That path is tied to the **old** workspace session — new GREENCANDLECUP folder window gets a **new** agent chat. **MEMORY.md Entry 002 is the bridge.**

### First message for new agent in GREENCANDLECUP workspace

> Read `MEMORY.md` Entry 002 and `.gcc-vault.local`. Continue from: Vultr deployed at 144.202.12.134, paper bot works, next is live submit + VPS setup.

---

*End of Entry 002 — next entry appends below this line.*

---

## Entry 003 — Session save (workspace split, round 2)

| Field | Value |
|-------|-------|
| **Date** | 2026-08-30 |
| **Time** | 8:55 PM EDT (UTC-4) |
| **Model** | Auto |

### Why this entry exists

User hit the **same Cursor limitation again**: agent chats are **bound to the window** they started in. Opening `GREENCANDLECUP` via `cursor C:\Users\chris\GREENCANDLECUP` (CLI) spawns a **second window** with the repo but **without the prior chat**. User wanted continuity in one window, not a new workspace.

**Entry 002 already saved the full handoff.** This entry confirms that save, documents the two-window state, and captures the **latest user intent** so the GREENCANDLECUP window agent can continue without re-explaining.

### Cursor windows — which is which

| Window | Workspace folder | Agent chat | Transcript ID |
|--------|------------------|------------|---------------|
| **Old / wrong** | `F-Android-temp-...` (not GREENCANDLECUP) | Wrote Entry 002, then lost | `F-Android-temp-cd04fcf0-d6e7-4dc7-ae29-d1968d1789ef` |
| **GREENCANDLECUP** | `C:\Users\chris\GREENCANDLECUP` | User read MEMORY, asked to open browsers | `a786209d-d07c-4061-9410-15f5f0b70f4f` |
| **This save request** | GREENCANDLECUP (if file tree shows repo) | Appending Entry 003 | `d052b27d-0492-44f4-9bdf-2c97a564d8ea` |

Transcripts live under:  
`C:\Users\chris\.cursor\projects\c-Users-chris-GREENCANDLECUP\agent-transcripts\`

**Chats do not merge across windows.** `MEMORY.md` is the bridge.

### How to avoid a third window

1. Pick **one** Cursor window (the one with `GREENCANDLECUP` in the file tree).
2. Close any duplicate empty window.
3. **Never** run `cursor C:\Users\chris\GREENCANDLECUP` from terminal — that always opens a new instance.
4. To fix folder in an existing window: **File → Open Folder** → `C:\Users\chris\GREENCANDLECUP`.

### Latest user request (from GREENCANDLECUP chat, not yet done)

User asked agent to **open these in browser**:

| Tab | URL (from `.gcc-vault.local`) |
|-----|-------------------------------|
| **Helius dashboard** | https://dashboard.helius.dev/ |
| **Vultr console** | https://console.vultr.com/subs/?id=98c9c487-36f6-41b0-acf0-9017a71cfca8 |
| **GCC control center (local)** | http://localhost:3000 |

Also ensure dev servers are running before localhost works:

```powershell
cd C:\Users\chris\GREENCANDLECUP
pnpm build:packages
pnpm --filter @gcc/server dev   # :8787
pnpm --filter web dev           # :3000
```

Health check: http://localhost:8787/api/health

### Uncommitted work on disk (still not committed)

**41 modified + 14 new files** (~3,862 insertions). Key new files since Entry 002:

- `apps/web/src/components/app-providers.tsx`
- `apps/web/src/components/bot-activity-panel.tsx`
- `apps/web/src/components/getting-started-card.tsx`
- `apps/web/src/components/page-guide.tsx`
- `apps/web/src/components/resizable-trade-layout.tsx`
- `apps/web/src/components/symbol-picker.tsx`, `symbol-provider.tsx`
- `apps/web/src/components/market-data-panel.tsx`, `floating-chart-window.tsx`
- `apps/web/src/components/trade-settings-provider.tsx`
- `apps/web/src/components/scanner-chart-provider.tsx`
- `apps/web/src/components/workspace/eraser-overlay.tsx`, `text-placement-overlay.tsx`, `workspace-chrome.tsx`
- `apps/web/src/hooks/use-element-size.ts`
- `apps/web/src/lib/leverage.ts`, `market-symbols.ts`
- `packages/phoenix-client/src/birdeye-mint.ts`, `price-fallback.ts`
- `packages/shared/src/birdeye-mints.ts`, `candle-chart.ts`, `prices.ts`

All context from Entry 001 + Entry 002 still applies (Vultr IP, vault, paper bot, live submit gap, next steps).

### Secrets — unchanged

- **Vault:** `C:\Users\chris\GREENCANDLECUP\.gcc-vault.local` (exists; `VULTR_ROOT_PASSWORD` still placeholder)
- **Env:** repo-root `.env` (git-ignored)
- Do **not** paste vault contents into chat or commit them

### Immediate next tasks (priority order — unchanged)

1. Open Helius + Vultr + localhost:3000 (user's explicit ask)
2. Start API + web dev servers if not running
3. User pastes Vultr root password into `.gcc-vault.local`
4. Wire **live tx submit** in `packages/trading-core` + bot
5. SSH to VPS `144.202.12.134`, run `deploy/setup-vps.sh`, register IP with Triton (port 8002)
6. Fund Phoenix collateral on competition wallet
7. Paper bot soak test (SOL 1m Trend+MACD)

### First message for agent in GREENCANDLECUP workspace

> Read `MEMORY.md` Entry 003 (and Entry 002 for full context) plus `.gcc-vault.local`. Continue where we left off: open Helius dashboard, Vultr gcc-bot console, and http://localhost:3000 (start dev servers if needed). Vultr at 144.202.12.134, paper bot works, next is live submit + VPS SSH setup.

---

*End of Entry 003 — next entry appends below this line.*

---

## Entry 004 — Vault complete, product clarity, VPS live, what's next

| Field | Value |
|-------|-------|
| **Date** | 2026-08-30 |
| **Time** | 9:08 PM EDT (UTC-4) |
| **Model** | Auto |

### Session arc (chronological)

1. **GCC chart + Birdeye** — Fixed naked chart, 1000 candles, live mark WS, volume/MACD panes, Birdeye mint resolver for Phoenix tokens.
2. **Full-site clarity pass** — Page guides on every tab, glossary, honest Paper vs Live copy, removed duplicate Paper/Live dropdown in trade panel, Devnet banner, Positions/Orders marked Soon.
3. **Product truth session** — User realized dashboard felt like a Phoenix clone. Clarified: **this is a bot + GCC command center**, not a manual trading UI replacement. Phoenix UI wins for hand-trades; we win on automation, paper sandbox, risk gates, 24/7 VPS bot, future ShredStream speed.
4. **GCC meta-game** — Green Candle Cup = 7-day Phoenix perps competition. Two prize tracks: **Realized PnL** and **Volume**. Bots allowed. Sponsors want adoption of **Phoenix** (exchange), **Triton/DoubleZero** (speed infra), **Frontier** (community/registration).
5. **Bot observability** — Scan logging every ~10s (`Scan JUP @ $0.21 · trend flat · signal none — No setup`), Bot Activity panel, `/api/logs`, WS log snapshot on connect. Verified in browser: bot runs, reads real candles, chooses not to trade in chop.
6. **Vultr VPS deployed** — User linked card, deployed **gcc-bot**, NYC, $5/mo plan. IP **144.202.12.134**. Billing starts on deploy (~$0.007/hr).
7. **`.gcc-vault.local` created** — Hidden, git-ignored master secrets file. Helius key copied from `.env`. User added **VULTR_ROOT_PASSWORD** — verified format correct (Vultr auto-generated random symbols; looks weird but normal).
8. **Workspace pain** — `File → Open Folder` failed for user twice. `cursor C:\...` opens **new window** without chat. Created `C:\Users\chris\Desktop\GREENCANDLECUP.code-workspace` and documented `cursor -r -a "C:\Users\chris\GREENCANDLECUP"` to add folder without new window.

### Major problems hit

| Problem | Resolution / status |
|---------|---------------------|
| Chart looked flat / 3h history | 1000 candles, 3s poll, fitContent fix, WS mark ticks |
| User confused every tab | PAGE_GUIDES + glossary + getting-started card |
| Felt like Phoenix clone | Reframed product around **bot**, not Trade UI |
| Live mode doesn't trade | **Still open** — `trading-core` builds ix but never submits tx |
| Agent chat lost on new window | MEMORY.md append-only handoff (this file) |
| Open Folder doesn't work in Cursor | Desktop `.code-workspace`, drag-drop, `cursor -r -a` |
| Vultr NY plan "unavailable" in a11y tree | User deployed successfully anyway; summary showed $5/mo NY |

### Major breakthroughs / wisdom

- **Paper ≠ fake prices.** Paper = real Phoenix data + simulated fills. Safe learning.
- **Level 3 HFT/market-making not required** for GCC. Level 1 rules bot → Level 2 server live bot is the realistic target.
- **Don't over-build Trade tab.** Bot page + VPS automation is the product; Phoenix app is for deposits/emergency manual.
- **The name you keep forgetting is TRITON** (Triton One) — provisions **DoubleZero Edge / ShredStream** (UDP shreds to your VPS for speed). Also: **Frontier** (registration), **Phoenix** (where trades land), **Helius** (tx RPC only), **Vultr** (your VPS).
- **Vault on disk, not in git.** `.gcc-vault.local` + `.env` = local only. Verified `git check-ignore` passes.

### The stack — what connects to what

```
YOU (decisions, Chris24, chris247777@gmail.com)
    │
    ▼
FRONTIER ─── registration, GCC leaderboard, competition wallet tracking
    │
    ▼
THIS DASHBOARD (localhost:3000 + bot on server)
    │  reads candles, runs MACD/trend, paper or live orders
    │
    ├── HELIUS ─── send Solana transactions only (API key in .env / vault)
    ├── PHOENIX ─── perps exchange (real trades count for GCC)
    ├── VULTR VPS (144.202.12.134) ─── 24/7 bot host (gcc-bot)
    └── TRITON ─── ShredStream UDP :8002 to VPS (speed edge, not wired yet)
```

**What "connect" means next:**
1. **SSH** → Vultr VPS (root @ 144.202.12.134, password in vault)
2. **Triton** → register VPS IP + port 8002 + datacenter NYC in Frontier/Triton GCC signup
3. **Phoenix** → deposit USDC collateral on competition wallet
4. **Live bot** → wire tx submit + `BOT_KEYPAIR_PATH` on VPS
5. **Helius** → already in `.env`; VPS copy of `.env` on deploy

### How the bot works (user learning reference)

**Where:** http://localhost:3000/bot (or VPS once deployed)

**Flow:**
1. Header **Paper** (safe) — stay here until Live is wired
2. Pick market in symbol picker (SOL, JUP, etc.)
3. Strategy **Trend + MACD** (best start), timeframe **1m**, poll **1000–5000ms**
4. Click **Start**
5. Every ~10s: **Scan** line in Bot activity — shows trend, signal, reason
6. When MACD + trend align: **TRADE** line — paper simulated order, volume counter increments
7. **System** tab — raw server logs; **Bot** tab — filtered activity

**What it's doing when flat:** `trend flat · signal none — No setup` = correctly waiting, not broken.

**Start servers:**
```powershell
cd C:\Users\chris\GREENCANDLECUP
pnpm --filter @gcc/server dev
pnpm --filter web dev
```

### Vault status (2026-08-30 ~9:02 PM)

- **File:** `C:\Users\chris\GREENCANDLECUP\.gcc-vault.local` (hidden, git-ignored)
- **VULTR_ROOT_PASSWORD:** user filled — verified present, single-line format OK
- **Helius, wallet, Vultr IP, emails:** populated
- **Still blank:** FRONTIER_PASSWORD, TRITON_API_KEY, BOT_KEYPAIR fields

### Vultr gcc-bot (current)

| Field | Value |
|-------|-------|
| IP | 144.202.12.134 |
| Name | gcc-bot |
| User | root |
| Password | in `.gcc-vault.local` only |
| Status | was **Stopped** at one point — **Start Server** in Vultr before SSH |

### Current goals (ordered)

1. **Learn the bot** — run paper on SOL, watch Scan/TRADE lines 30–60 min
2. **SSH into VPS** — confirm login works with vault password
3. **Register IP with Triton** — 144.202.12.134, UDP 8002, NYC (for ShredStream / GCC Edge)
4. **Deploy bot on VPS** — `deploy/VPS-DEPLOY.md`, clone repo, `.env`, systemd
5. **Wire live tx submit** — critical code gap in `packages/trading-core`
6. **Fund Phoenix** — USDC on competition wallet before Sep 1 10 AM EST
7. **Commit local changes** — when user asks (41+ files still uncommitted)

### Still not done (honest)

- Live order signing (browser + server)
- Positions / Orders tabs (placeholders)
- ShredStream listener on VPS
- Triton registration
- Bot running on VPS (only local dev so far)
- Git commit of session work

### Files created this session (for git awareness)

- `.gcc-vault.local` (NEVER commit)
- `apps/web/src/components/bot-activity-panel.tsx`
- `apps/web/src/components/page-guide.tsx`
- `apps/web/src/components/getting-started-card.tsx`
- `packages/shared/src/glossary.ts` (PAGE_GUIDES, expanded GLOSSARY)
- `packages/shared/src/candle-chart.ts`, `birdeye-mints.ts`
- `packages/phoenix-client/src/birdeye-mint.ts`
- `C:\Users\chris\Desktop\GREENCANDLECUP.code-workspace` (desktop launcher)

### First message for next agent session

> Read MEMORY.md Entry 004. Vault password is set. Vultr 144.202.12.134 deployed. Paper bot works locally. Next: SSH VPS, register Triton (ShredStream), wire live submit, deploy bot to VPS. User wants to learn how bot + Triton + Phoenix connect.

---

*End of Entry 004 — next entry appends below this line.*

---

## Entry 005 — Three-layer local docs + working state file

| Field | Value |
|-------|-------|
| **Date** | 2026-08-30 |
| **Time** | 9:15 PM EDT (UTC-4) |
| **Model** | Auto |

### Organizational decision (user request)

Split local knowledge into **three layers** so vault isn't cluttered with changing ops data:

| Layer | File | Rule |
|-------|------|------|
| **Hard keys** | `.gcc-vault.local` | Passwords, API keys, stable account IDs |
| **Working / transitional** | `.gcc-working.local.md` | Current VPS IP, status, charges, bot state, living checklist — **update in place** |
| **Hard memory** | `MEMORY.md` | Chronological history — **append only, never erase** |

All git-ignored. Created `.gcc-working.local.md` with current Vultr snapshot (NJ = NYC region), connection status matrix, next-actions checklist.

### Vultr location clarification

User saw **New Jersey** on overview after selecting **New York** at deploy. **Not a mistake** — Vultr EWR datacenter; same region for GCC/Triton NYC. Do not redeploy.

### Vultr stop/pause (user question)

- **Stop Server** in Vultr = powers off VM. **Billing continues** while instance exists (~$5/mo cap).
- **No true "pause billing"** on Vultr without **Destroy** (which deletes server + IP).
- For ~17¢/day while setting up: leave Running or Stop if not using SSH yet — either way small cost until destroy after Sep 8.

### Current goals unchanged

SSH VPS → Triton registration → deploy bot → wire live submit → fund Phoenix → paper soak → GCC week.

---

*End of Entry 005 — next entry appends below this line.*
