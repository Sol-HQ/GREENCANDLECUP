#!/usr/bin/env bash
set -euo pipefail

echo "=== GCC Phase 1 Gate Test ==="

curl -sf http://localhost:8787/api/health >/dev/null && echo "[OK] API health" || echo "[FAIL] API health"
curl -sf http://localhost:8787/api/market/SOL >/dev/null && echo "[OK] Phoenix market" || echo "[FAIL] Phoenix market"
curl -sf http://localhost:8787/api/orderbook/SOL >/dev/null && echo "[OK] Orderbook" || echo "[FAIL] Orderbook"

curl -sf -X POST http://localhost:8787/api/orders \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: dev' \
  -d '{"symbol":"SOL","side":"buy","type":"market","sizeBase":"0.01","mode":"paper"}' \
  >/dev/null && echo "[OK] Paper order" || echo "[FAIL] Paper order"

curl -sf -X POST http://localhost:8787/api/orders \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: dev' \
  -d '{"symbol":"SOL","side":"buy","type":"market","sizeBase":"999","mode":"paper"}' \
  >/dev/null && echo "[FAIL] Risk limit should block" || echo "[OK] Risk limit blocks oversized order"

echo "Open http://localhost:3000 for dashboard UI check"
