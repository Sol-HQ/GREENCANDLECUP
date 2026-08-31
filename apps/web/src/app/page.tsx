"use client";

import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card, Stat } from "@/components/ui";
import { OrderbookPanel } from "@/components/orderbook-panel";
import { TradePanel } from "@/components/trade-panel";
import { AlertsPanel } from "@/components/alerts-panel";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import { GCC_END, GCC_START } from "@gcc/shared";
import { useSymbol } from "@/components/symbol-provider";
import { SymbolPicker } from "@/components/symbol-picker";
import { MarketDataPanel } from "@/components/market-data-panel";
import { GettingStartedCard } from "@/components/getting-started-card";
import { PageGuide } from "@/components/page-guide";
import { formatPriceUsd } from "@/lib/market-symbols";

export default function HomePage() {
  const { symbol } = useSymbol();
  const { market, orderbook, metrics, health, connected } = useGccSocket(symbol);
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
      <div className="space-y-4 pb-8">
        <PageGuide page="overview" />
        <GettingStartedCard />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Overview</h1>
            <p className="text-sm text-zinc-500">
              Live Phoenix data for your engaged market. Use Trade for charts and
              orders; Bot for automation.
            </p>
          </div>
          <Link
            href="/trade"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-emerald-400"
          >
            Open Trade workspace →
          </Link>
        </div>

        <SymbolPicker className="max-w-md" />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={`Mark (${symbol})`}
            value={formatPriceUsd(market?.markPriceUsd)}
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

        <MarketDataPanel />

        <div className="grid gap-4 xl:grid-cols-2">
          <OrderbookPanel book={orderbook} />
          <div className="space-y-4">
            <TradePanel
              symbol={symbol}
              markPrice={market?.markPriceUsd ?? null}
            />
            <AlertsPanel />
          </div>
        </div>

        <Card title="System">
          <div className="grid gap-2 text-sm text-zinc-300 md:grid-cols-3">
            <p>
              Phoenix:{" "}
              {health?.phoenixConnected ? "Connected" : "Disconnected"}
            </p>
            <p>
              Poll latency:{" "}
              {health?.phoenixPollLatencyMs ?? health?.rpcLatencyMs ?? "—"} ms
            </p>
            <p>Bot: {health?.botStatus ?? "unknown"}</p>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
