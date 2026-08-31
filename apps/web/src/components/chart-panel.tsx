"use client";

import { useState } from "react";
import {
  PHOENIX_CANDLE_TIMEFRAMES,
  TIMEFRAME_HELP,
  type CandleTimeframe,
} from "@gcc/shared";
import { Card, Button } from "@/components/ui";
import { TradingViewChart } from "@/components/tradingview-chart";
import { BirdeyeChart } from "@/components/birdeye-chart";
import { PhoenixGccChart } from "@/components/phoenix-gcc-chart";
import { tradingViewSymbol } from "@/lib/market-symbols";
import { useScannerChart } from "@/components/scanner-chart-provider";
import { cn } from "@/lib/utils";

type ChartTab = "gcc" | "tradingview" | "birdeye";

export function ChartPanel({
  symbol,
  timeframe: controlledTf,
  onTimeframeChange,
  variant = "engaged",
}: {
  symbol: string;
  timeframe?: CandleTimeframe;
  onTimeframeChange?: (tf: CandleTimeframe) => void;
  variant?: "engaged" | "scanner";
}) {
  const scanner = useScannerChart();
  const [tab, setTab] = useState<ChartTab>("gcc");
  const [localTf, setLocalTf] = useState<CandleTimeframe>("1m");
  const timeframe = controlledTf ?? localTf;
  const isScanner = variant === "scanner";

  const setTimeframe = (tf: CandleTimeframe) => {
    setLocalTf(tf);
    onTimeframeChange?.(tf);
  };

  const controls = (
    <>
      <div
        className={cn(
          "flex shrink-0 flex-wrap gap-1",
          isScanner ? "mb-1" : "mb-2 gap-2",
        )}
      >
        <Button
          variant={tab === "gcc" ? "primary" : "secondary"}
          className={isScanner ? "!px-1.5 !py-0.5 !text-[10px]" : undefined}
          onClick={() => setTab("gcc")}
        >
          GCC
        </Button>
        <Button
          variant={tab === "tradingview" ? "primary" : "secondary"}
          className={isScanner ? "!px-1.5 !py-0.5 !text-[10px]" : undefined}
          onClick={() => setTab("tradingview")}
        >
          TV
        </Button>
        <Button
          variant={tab === "birdeye" ? "primary" : "secondary"}
          className={isScanner ? "!px-1.5 !py-0.5 !text-[10px]" : undefined}
          onClick={() => setTab("birdeye")}
        >
          Birdeye
        </Button>
        {tab === "gcc"
          ? PHOENIX_CANDLE_TIMEFRAMES.map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "primary" : "secondary"}
                className="!px-1.5 !py-0.5 !text-[10px]"
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </Button>
            ))
          : null}
      </div>
      {!isScanner ? (
        <p className="mb-2 shrink-0 text-xs text-zinc-500">
          {tab === "gcc"
            ? TIMEFRAME_HELP[timeframe]
            : tab === "tradingview"
              ? "TradingView shows centralized exchange perp feeds (Binance, etc.) — not Jupiter DEX routes. Use GCC for Phoenix on-chain perps."
              : "Birdeye Solana spot chart — auto-resolved for Phoenix crypto tokens. Equities use TV; perps use GCC."}{" "}
          Use <strong className="text-sky-300">Pop out scanner</strong> for a
          second chart with its own token.
        </p>
      ) : tab === "tradingview" ? (
        <p className="mb-1 shrink-0 text-[10px] leading-snug text-zinc-500">
          TV = CEX feeds, not Jupiter. GCC tab = Phoenix perps.
        </p>
      ) : tab === "birdeye" ? (
        <p className="mb-1 shrink-0 text-[10px] leading-snug text-zinc-500">
          Birdeye spot (Solana). Equities → TV. Perps → GCC.
        </p>
      ) : null}
    </>
  );

  const chartArea = (
    <div className="relative min-h-0 flex-1">
      <div
        className={cn(
          "absolute inset-0 flex min-h-0 flex-col",
          tab !== "gcc" && "pointer-events-none invisible",
        )}
        aria-hidden={tab !== "gcc"}
      >
        <PhoenixGccChart
          symbol={symbol}
          timeframe={timeframe}
          compact={isScanner}
        />
      </div>
      <div
        className={cn(
          "absolute inset-0",
          tab !== "tradingview" && "pointer-events-none invisible",
        )}
        aria-hidden={tab !== "tradingview"}
      >
        <TradingViewChart symbol={tradingViewSymbol(symbol)} />
      </div>
      <div
        className={cn(
          "absolute inset-0",
          tab !== "birdeye" && "pointer-events-none invisible",
        )}
        aria-hidden={tab !== "birdeye"}
      >
        <BirdeyeChart symbol={symbol} compact={isScanner} />
      </div>
    </div>
  );

  if (isScanner) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {controls}
        {chartArea}
      </div>
    );
  }

  return (
    <Card
      className="flex h-full min-h-0 flex-col"
      title={`Engaged chart · ${symbol}`}
      action={
        <Button
          variant="secondary"
          className="!px-2 !py-1 !text-xs"
          onClick={() => {
            scanner.setSymbol(symbol);
            scanner.setOpen(true);
          }}
        >
          Pop out scanner
        </Button>
      }
    >
      {controls}
      {chartArea}
    </Card>
  );
}
