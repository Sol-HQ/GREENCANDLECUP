# GREENCANDLECUP — Master Checklist (in order)

Do these top-to-bottom. Do not skip Phase 1 validation before spending on VPS.

---

## Phase 0 — Environment (today)

- [ ] `.env` at repo root with `HELIUS_API_KEY` or `HELIUS_RPC_URL`
- [ ] `apps/web/.env.local` with `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_WS_URL`
- [ ] `pnpm install` && `pnpm build:packages`
- [ ] API running: `pnpm --filter @gcc/server dev` → http://localhost:8787/api/health
- [ ] Web running: `pnpm --filter web dev` → http://localhost:3000
- [ ] If 500 errors on tab switch: delete `apps/web/.next`, restart both servers

---

## Phase 1 — Local validation (free, before Vultr)

### Dashboard & data
- [ ] All nav tabs load: Overview, Trade, Positions, Orders, Bot, System
- [ ] Header shows **Offline → Live** when WS connects
- [ ] Trade page: GCC chart loads (try 15s, 1m, 5m timeframes)
- [ ] Trade page: TradingView + Birdeye tabs load
- [ ] Orderbook updates on Trade page
- [ ] Alerts panel receives price-move pings

### Wallet & network toggles
- [ ] Phantom connects on **Mainnet**
- [ ] Toggle **Devnet** — wallet reconnects (practice only; no Phoenix perps)
- [ ] Toggle **Paper** — badge shows Simulated
- [ ] Understand: Paper = real prices, simulated orders (see `MEMORY.md`)

### Bot (paper)
- [ ] Bot page: strategy **Trend + MACD**, timeframe **1m**, poll **1000ms**
- [ ] Start bot → logs + alerts appear
- [ ] Live TA readout shows trend / reason
- [ ] Risk limits block oversized order (phase1-gate or manual test)
- [ ] GCC metrics: volume + trade count increment in paper mode

### Workspace
- [ ] Pencil draws on chart area; persists after refresh (localStorage)
- [ ] Sticky notes: place S/M/L, drag, type text

### Gate script
- [ ] `powershell -File scripts\phase1-gate.ps1` passes

**Phase 1 exit criteria:** You trust the dashboard, paper bot, and charts. Ready to pay for VPS.

---

## Phase 2 — VPS + ShredStream (after Phase 1)

- [ ] Fund Vultr (~$5/mo), Ubuntu 22.04, **NYC**, name `gcc-bot`
- [ ] Copy public IP → Triton GCC project (port `8002`, NYC)
- [ ] SSH: open UDP `8002`, run `deploy/setup-vps.sh`
- [ ] Clone repo on VPS, copy `.env`, set `SHREDSTREAM_UDP_PORT=8002`
- [ ] systemd: `deploy/gcc-bot.service` — server runs on boot
- [ ] ShredStream smoke test (deshred receives packets)
- [ ] Point dashboard at VPS or run web on same host

---

## Phase 3 — Go live (before Sep 1, 10 AM EST)

### Registration & wallet
- [ ] Re-verify Frontier wallet + GCC terms
- [ ] Competition wallet funded with Phoenix collateral (USDC)
- [ ] `BOT_KEYPAIR_PATH` on server — **never commit keypair**

### Switch to real trading
- [ ] Header: **Mainnet** + **Live**
- [ ] Bot risk limits set conservatively (max order, daily loss)
- [ ] Manual test: one small live limit order from Trade page
- [ ] Bot live smoke: tiny size, confirm fill on Phoenix

### Competition week
- [ ] Monitor volume + realized PnL tracks (GCC scoring)
- [ ] ShredStream active for speed edge during volatile sessions
- [ ] Telegram/Discord pings (optional, if built)

---

## Phase 4 — Polish (parallel / post-MVP)

- [ ] Positions page: live from Rise trader state
- [ ] Orders page: open orders + cancel
- [ ] Jupiter Wallet adapter (optional; Phantom works)
- [ ] More indicators on GCC chart (RSI, Bollinger)
- [ ] Telegram webhook for mobile alerts

---

## Quick commands

```powershell
cd C:\Users\chris\GREENCANDLECUP
pnpm build:packages
pnpm --filter @gcc/server dev   # :8787
pnpm --filter web dev           # :3000
```

**Reset after crash:**

```powershell
Get-NetTCPConnection -LocalPort 3000,8787 -EA SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue }
Remove-Item -Recurse -Force apps\web\.next -EA SilentlyContinue
pnpm build:packages
```
