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
