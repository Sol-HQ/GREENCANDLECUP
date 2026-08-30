"use client";

import { Shell } from "@/components/shell";
import { OrderbookPanel } from "@/components/orderbook-panel";
import { TradePanel } from "@/components/trade-panel";
import { useGccSocket } from "@/hooks/use-gcc-socket";

export default function TradePage() {
  const { market, orderbook, connected } = useGccSocket();
  return (
    <Shell connected={connected}>
      <div className="grid gap-4 xl:grid-cols-2">
        <OrderbookPanel book={orderbook} />
        <TradePanel markPrice={market?.markPriceUsd ?? null} />
      </div>
    </Shell>
  );
}
