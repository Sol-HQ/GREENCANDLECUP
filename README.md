# Green Candle Cup (GREENCANDLECUP)

Professional Phoenix perpetuals dashboard + trading bot for the [Green Candle Cup](https://www.frontiertraders.com/campaigns/gcc) competition.

## Stack

- **apps/web** — Next.js 15 dashboard (Overview, Trade, Positions, Orders, Bot, System)
- **apps/server** — Hono API + WebSocket hub + bot runner
- **packages/** — Rise SDK client, trading core, risk limits, bot engine, shared types

## Quick start (Phase 1 — free, local)

```bash
cp .env.example .env
# Add HELIUS_RPC_URL with your API key

pnpm install
pnpm --filter @gcc/shared build
pnpm --filter @gcc/risk build
pnpm --filter @gcc/phoenix-client build
pnpm --filter @gcc/trading-core build
pnpm --filter @gcc/bot-engine build

# Terminal 1 — API + bot
pnpm --filter @gcc/server dev

# Terminal 2 — dashboard
pnpm --filter web dev
```

Open http://localhost:3000

## Phase 1 pass checklist (before paying for Vultr)

- [ ] Dashboard loads locally with clean UI
- [ ] Live SOL orderbook updates
- [ ] Wallet connects (Phantom)
- [ ] Paper order succeeds from Trade screen
- [ ] Risk limits block oversized orders (Bot page)
- [ ] Bot runs in paper mode with visible volume counter

## Competition wallet

Register and trade with: `iamaaZQHyc1FZkaqCFKhDuSt5JyLZYbveHUkAcWyFoA`

## VPS deploy (Phase 2)

1. Deploy Ubuntu 22.04 NYC on Vultr (`gcc-bot`)
2. Copy public IP → Triton (port `8002`, NYC)
3. SSH in, open UDP 8002, install deshred-example
4. Clone repo, configure `.env`, run server via systemd
5. Point `NEXT_PUBLIC_API_URL` at your VPS or serve web from same host

See `deploy/gcc-bot.service` for systemd unit example.

## Security

- Never commit `keypair.json` or `.env`
- Set `API_KEY` in production
- Manual trades require wallet approval in Phantom/Jupiter

## License

MIT
