"use client";

import { Shell } from "@/components/shell";
import { Card, Stat } from "@/components/ui";
import { OrderbookPanel } from "@/components/orderbook-panel";
import { TradePanel } from "@/components/trade-panel";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import { GCC_END, GCC_START } from "@gcc/shared";

export default function HomePage() {
  const { market, orderbook, metrics, health, connected } = useGccSocket();
  const now = Date.now();
  const started = now >= GCC_START.getTime();
  const ended = now >= GCC_END.getTime();
  const countdown = started
    ? ended
      ? "Competition ended"
      : `Ends ${GCC_END.toLocaleString()}`
    : `Starts ${GCC_START.toLocaleString()}`;

  return (
    <Shell connected={connected}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Mark Price (SOL)"
            value={
              market?.markPriceUsd
                ? `$${Number(market.markPriceUsd).toFixed(2)}`
                : "—"
            }
          />
          <Stat
            label="GCC Volume"
            value={`$${(metrics?.volumeUsd ?? 0).toFixed(2)}`}
          />
          <Stat
            label="Realized PnL"
            value={`$${(metrics?.realizedPnlUsd ?? 0).toFixed(2)}`}
            tone={(metrics?.realizedPnlUsd ?? 0) >= 0 ? "good" : "bad"}
          />
          <Stat label="Competition" value={countdown} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <OrderbookPanel book={orderbook} />
          <TradePanel markPrice={market?.markPriceUsd ?? null} />
        </div>

        <Card title="System">
          <div className="grid gap-2 text-sm text-zinc-300 md:grid-cols-3">
            <p>Phoenix: {health?.phoenixConnected ? "Connected" : "Disconnected"}</p>
            <p>RPC latency: {health?.rpcLatencyMs ?? "—"} ms</p>
            <p>Bot: {health?.botStatus ?? "unknown"}</p>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
