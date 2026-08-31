import type { PaperTradeRecord, CandleTimeframe } from "@gcc/shared";
import { candlePeriodStart } from "@gcc/shared";
import type { SeriesMarker, UTCTimestamp } from "lightweight-charts";

function formatQty(sizeBase: number): string {
  if (sizeBase >= 1000) return `${(sizeBase / 1000).toFixed(1)}k`;
  if (sizeBase >= 10) return sizeBase.toFixed(1);
  if (sizeBase >= 1) return sizeBase.toFixed(2);
  return sizeBase.toFixed(4);
}

/** Map paper trades to chart pins on the active candle timeframe. */
export function paperTradesToMarkers(
  trades: PaperTradeRecord[],
  symbol: string,
  timeframe: CandleTimeframe,
): SeriesMarker<UTCTimestamp>[] {
  return trades
    .filter((t) => t.symbol === symbol)
    .map((t) => {
      const isOpen = t.action.startsWith("open");
      const isLong = t.action.includes("long");
      const qty = formatQty(t.sizeBase);
      const notional = `$${t.notionalUsd.toFixed(0)}`;

      let text: string;
      if (isOpen) {
        text = isLong ? `BUY ${qty} · ${notional}` : `SHORT ${qty} · ${notional}`;
      } else {
        const pnl =
          t.pnlUsd != null
            ? ` · ${t.pnlUsd >= 0 ? "+" : ""}$${t.pnlUsd.toFixed(2)}`
            : "";
        text = isLong ? `SELL ${qty}${pnl}` : `COVER ${qty}${pnl}`;
      }

      const barTime = candlePeriodStart(t.barTime, timeframe) as UTCTimestamp;

      return {
        time: barTime,
        position: isLong
          ? isOpen
            ? ("belowBar" as const)
            : ("aboveBar" as const)
          : isOpen
            ? ("aboveBar" as const)
            : ("belowBar" as const),
        color: isOpen ? "#22c55e" : t.pnlUsd != null && t.pnlUsd < 0 ? "#ef4444" : "#f59e0b",
        shape: isOpen ? ("arrowUp" as const) : ("arrowDown" as const),
        text,
        size: 2,
      };
    })
    .sort((a, b) => (a.time as number) - (b.time as number));
}
