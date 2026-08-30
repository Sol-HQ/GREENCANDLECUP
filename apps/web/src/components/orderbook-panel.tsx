"use client";

import { Card } from "@/components/ui";
import type { OrderbookSnapshot } from "@gcc/shared";

export function OrderbookPanel({ book }: { book: OrderbookSnapshot | null }) {
  if (!book) {
    return (
      <Card title="Orderbook">
        <p className="text-sm text-zinc-500">Waiting for orderbook stream…</p>
      </Card>
    );
  }

  return (
    <Card title={`${book.symbol} Orderbook`}>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="mb-2 font-medium text-rose-400">Asks</p>
          <div className="space-y-1">
            {[...book.asks].reverse().slice(0, 8).map((level) => (
              <div
                key={`ask-${level.price}`}
                className="flex justify-between text-zinc-300"
              >
                <span>{Number(level.price).toFixed(2)}</span>
                <span>{Number(level.size).toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 font-medium text-emerald-400">Bids</p>
          <div className="space-y-1">
            {book.bids.slice(0, 8).map((level) => (
              <div
                key={`bid-${level.price}`}
                className="flex justify-between text-zinc-300"
              >
                <span>{Number(level.price).toFixed(2)}</span>
                <span>{Number(level.size).toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
