"use client";

import { Shell } from "@/components/shell";
import { OrderbookPanel } from "@/components/orderbook-panel";
import { TradePanel } from "@/components/trade-panel";
import { ChartPanel } from "@/components/chart-panel";
import { AlertsControls, AlertsFeed, AlertsProvider } from "@/components/alerts-panel";
import { ResizableTradeLayout } from "@/components/resizable-trade-layout";
import { TradeErrorBoundary } from "@/components/trade-error-boundary";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import { useSymbol } from "@/components/symbol-provider";
import { SymbolPicker } from "@/components/symbol-picker";
import { MarketDataPanel } from "@/components/market-data-panel";
import { PageGuide } from "@/components/page-guide";

export default function TradePage() {
  const { symbol } = useSymbol();
  const { market, orderbook, connected } = useGccSocket(symbol);

  return (
    <Shell connected={connected}>
      <TradeErrorBoundary name="Trade">
        <AlertsProvider>
          <div className="space-y-4 pb-8">
          <PageGuide page="trade" />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="w-full max-w-sm shrink-0 lg:max-w-xs">
              <SymbolPicker />
            </div>
            <p className="hidden flex-1 text-xs text-zinc-500 lg:block">
              Engaged market · {symbol} — Phoenix perp, synced across tabs
            </p>
            <AlertsControls className="lg:ml-auto" />
          </div>
          <MarketDataPanel />
          <ResizableTradeLayout
            chart={<ChartPanel symbol={symbol} variant="engaged" />}
            orderbook={<OrderbookPanel book={orderbook} />}
            alertsFeed={<AlertsFeed />}
            trade={
              <div className="h-full min-h-0">
                <TradePanel
                  symbol={symbol}
                  markPrice={market?.markPriceUsd ?? null}
                />
              </div>
            }
          />
          </div>
        </AlertsProvider>
      </TradeErrorBoundary>
    </Shell>
  );
}
