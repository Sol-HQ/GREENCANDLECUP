# VPS deploy checklist (Phase 2 + 3)

## Phase 2 — after Phase 1 gate passes locally

1. Fund Vultr and deploy **Ubuntu 22.04**, **New York**, hostname `gcc-bot`
2. Copy **public IPv4** from Vultr dashboard
3. Triton GCC project step:
   - IP: your VPS IPv4
   - Port: `8002`
   - Datacenter: **NYC — New York**
4. SSH: `ssh root@YOUR_VPS_IP`
5. Run: `bash <(curl -fsSL)` or copy `deploy/setup-vps.sh` and execute
6. Clone repo to `/opt/greencandlecup`, add `.env` with `HELIUS_RPC_URL`, `BOT_KEYPAIR_PATH`, `API_KEY`
7. `pnpm install && pnpm build:packages && pnpm --filter @gcc/server build && pnpm --filter web build`
8. Enable systemd: `cp deploy/gcc-bot.service /etc/systemd/system/ && systemctl enable --now gcc-bot`
9. Verify shreds: `cd deshred-example && cargo run --release -p deshred-minimal -- 0.0.0.0:8002`

## Phase 3 — go live Sep 1 10 AM EST

1. Confirm Frontier wallet registered: `iamaaZQHyc1FZkaqCFKhDuSt5JyLZYbveHUkAcWyFoA`
2. Deposit USDC collateral on Phoenix for competition wallet
3. Set bot mode to **live** in dashboard (Bot page) after paper validation
4. Start bot from dashboard or `POST /api/bot/start`
5. Monitor leaderboard: https://www.frontiertraders.com/campaigns/gcc
6. Destroy Vultr instance after Sep 8 to stop billing
