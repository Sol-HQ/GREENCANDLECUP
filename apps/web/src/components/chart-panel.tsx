"use client";

import { useState } from "react";
import type { CandleTimeframe } from "@gcc/shared";
import { TIMEFRAME_HELP } from "@gcc/shared";
import { Card, Button } from "@/components/ui";
import { TradingViewChart } from "@/components/tradingview-chart";
import { BirdeyeChart } from "@/components/birdeye-chart";
import { PhoenixGccChart } from "@/components/phoenix-gcc-chart";

type ChartTab = "gcc" | "tradingview" | "birdeye";

const TIMEFRAMES: CandleTimeframe[] = [
  "15s",
  "30s",
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
];

export function ChartPanel({
  timeframe: controlledTf,
  onTimeframeChange,
}: {
  timeframe?: CandleTimeframe;
  onTimeframeChange?: (tf: CandleTimeframe) => void;
} = {}) {
  const [tab, setTab] = useState<ChartTab>("gcc");
  const [localTf, setLocalTf] = useState<CandleTimeframe>("1m");
  const timeframe = controlledTf ?? localTf;

  const setTimeframe = (tf: CandleTimeframe) => {
    setLocalTf(tf);
    onTimeframeChange?.(tf);
  };

  return (
    <Card title="Live charts">
      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          variant={tab === "gcc" ? "primary" : "secondary"}
          onClick={() => setTab("gcc")}
        >
          GCC (Phoenix + MACD)
        </Button>
        <Button
          variant={tab === "tradingview" ? "primary" : "secondary"}
          onClick={() => setTab("tradingview")}
        >
          TradingView
        </Button>
        <Button
          variant={tab === "birdeye" ? "primary" : "secondary"}
          onClick={() => setTab("birdeye")}
        >
          Birdeye
        </Button>
      </div>
      {tab === "gcc" ? (
        <div className="mb-3 flex flex-wrap gap-1">
          {TIMEFRAMES.map((tf) => (
            <Button
              key={tf}
              variant={timeframe === tf ? "primary" : "secondary"}
              className="!px-2 !py-1 !text-xs"
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </Button>
          ))}
        </div>
      ) : null}
      <p className="mb-3 text-xs text-zinc-500">
        {tab === "gcc"
          ? TIMEFRAME_HELP[timeframe]
          : "Reference embed — use GCC tab for bot-matched candles + MACD."}{" "}
        Draw, text, and sticky notes use the Workspace toolbar above.
      </p>
      <div className="relative">
        {tab === "gcc" ? (
          <PhoenixGccChart symbol="SOL" timeframe={timeframe} />
        ) : tab === "tradingview" ? (
          <TradingViewChart symbol="BINANCE:SOLUSDT.P" />
        ) : (
          <BirdeyeChart />
        )}
      </div>
    </Card>
  );
}
