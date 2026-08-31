# GCC Wiring Manifest

What the overnight JUP paper bot actually uses vs what is display-only or not built yet.

## Overnight path (what you press)

1. **Arm overnight** → `POST /api/bot/arm-overnight`
   - Fresh $100 USDC paper wallet on **JUP**
   - Strategy: `wave_scalp` on **1m** candles
   - Survival floor: $5 equity = **dead** (no respawn until reset)
   - Bot starts scanning and may trade after **3 warmup scans**

2. **Chart** → `/trade` or pop-out chart shows buy/sell pins from `paper_trade` WebSocket events

3. **Persistence** → `data/paper-trades.json` saves full portfolio + trade log after every trade. Server restart restores open position and bankroll.

## Data sources → bot brain

| Source | Used by bot? | How |
|--------|--------------|-----|
| Phoenix HTTP API — candles | **Yes** | `getCandles` → `analyzeWaveScalp` (OHLC + volume) |
| Phoenix HTTP API — mark price | **Yes** | `onMarketUpdate` → execution price, unrealized PnL, death check |
| Phoenix HTTP API — orderbook | **Yes** | `onOrderbookUpdate` → spread guard (skip entry if > 35 bps) |
| CoinGecko briefing | **No** (UI only) | Shown on bot page; not in strategy yet |
| Birdeye chart overlay | **No** (UI only) | Optional chart layer |
| ShredStream / UDP | **Pre-wired** | UDP listener when `SHREDSTREAM_UDP_PORT` set; active after Triton registers VPS IP |
| Helius RPC | **Tx path only** | Reads use public/dedicated RPC; Helius reserved for sends (live not wired) |

## Strategy inputs (wave_scalp)

- Swing high/low over last 20 bars
- Micro-momentum (recent vs older closes)
- **Volume filter** — skip entries when last bar volume < 35% of lookback average
- Position management: TP %, stop %, survival-tightened stops when life is low
- **Spread filter** — skip new entries when bid/ask spread > 35 bps
- **Life scaling** — position size shrinks as equity drops; no new entries below 20% life

## Survival rules

- Starting bankroll: $100 USDC (configurable)
- Death: equity ≤ `paperMinBalanceUsdc` ($5 default)
- While alive: smaller sizes, tighter stops, survival warnings in logs
- Death closes any open position at mark and sets status `dead`

## Paper vs live

| Mode | Status |
|------|--------|
| **Paper** | Fully wired for `wave_scalp` |
| **Live** | **Not wired** — bot logs warning and does not send Phoenix txs |

## UI vs bot

| UI element | Meaning |
|------------|---------|
| Header **Live** | Market data feed connected — **not** “bot is trading” |
| Bot status `running` | Bot is scanning and may paper-trade |
| Bot status `dead` | Game over — reset paper wallet to continue |
| Positions / Orders pages | Placeholder — paper state lives on Bot page + chart |

## RPC routing (important)

**Phoenix trading data does NOT go through `api.mainnet-beta.solana.com`.**

| Path | What | Default |
|------|------|---------|
| `PHOENIX_API_URL` | Candles, orderbook, mark | `perp-api.phoenix.trade` |
| `READ_RPC_URL` / `TRITON_RPC_URL` | Rise bootstrap, simulate | public mainnet-beta (set dedicated before live) |
| `HELIUS_RPC_URL` | `sendTransaction` only | Helius when key set |
| `SHREDSTREAM_UDP_PORT` | Triton shred packets | off until VPS + Triton registration |

Check live routing: `GET /api/infra`

## Vultr + Triton (pre-wired, needs you to flip on)

1. **Start** gcc-bot in Vultr console (`144.202.12.134`)
2. Set in `.env`: `VPS_PUBLIC_IP=144.202.12.134`, `SHREDSTREAM_UDP_PORT=8002`
3. Register IP + port + NYC with Triton GCC project
4. Run bot on VPS (or forward shreds) — System page shows **Listening** then **Active**


- **Public RPC** — Phoenix reads, candles, orderbook, wallet queries
- **Helius** — transaction submission only (when live trading exists)
- Validated at server boot in `validateRpcRoutingAtStartup()`

## Not built (Phase 2)

- ShredStream / sub-second fills
- Live Phoenix order submission
- Risk gate on classic strategy (wave_scalp paper bypasses `TradingCore.buildOrder`)
- Briefing / orderbook depth in strategy logic
- Positions & Orders tabs backed by real or paper state

## Quick health check

```bash
curl http://localhost:8787/api/health
curl http://localhost:8787/api/bot
curl http://localhost:8787/api/paper/portfolio
```

Bot should show `stopped` until you start. After arm-overnight: `running`, symbol `JUP`, mode `paper`.
