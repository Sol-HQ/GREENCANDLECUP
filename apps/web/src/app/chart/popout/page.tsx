"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PhoenixGccChart } from "@/components/phoenix-gcc-chart";
import { SymbolPicker } from "@/components/symbol-picker";
import { Button } from "@/components/ui";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import { buildPopoutUrl } from "@/lib/popout-url";
import {
  broadcastScannerSync,
  subscribeScannerSync,
} from "@/lib/scanner-sync";
import {
  formatPriceUsd,
  normalizeCandleTimeframe,
  PHOENIX_CANDLE_TIMEFRAMES,
  type CandleTimeframe,
} from "@gcc/shared";

const QUICK_SYMBOLS = ["SOL", "JUP", "BTC", "ETH", "WIF", "BONK"] as const;

export default function ScannerPopoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-500">
          Loading chart…
        </div>
      }
    >
      <ScannerPopoutInner />
    </Suspense>
  );
}

function ScannerPopoutInner() {
  const searchParams = useSearchParams();
  const [symbol, setSymbol] = useState(
    () => searchParams.get("symbol")?.toUpperCase() || "SOL",
  );
  const [timeframe, setTimeframe] = useState<CandleTimeframe>(() =>
    normalizeCandleTimeframe(searchParams.get("timeframe") ?? "1m"),
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { market, connected } = useGccSocket(symbol);
  const popoutUrl = useMemo(
    () => (typeof window === "undefined" ? "" : buildPopoutUrl(symbol, timeframe)),
    [symbol, timeframe],
  );

  useEffect(() => {
    broadcastScannerSync({ type: "popout-opened" });
    return () => {
      broadcastScannerSync({ type: "popout-closed" });
    };
  }, []);

  useEffect(() => {
    return subscribeScannerSync((msg) => {
      if (msg.type === "state") {
        setSymbol(msg.symbol);
        setTimeframe(msg.timeframe);
      }
    });
  }, []);

  useEffect(() => {
    broadcastScannerSync({ type: "state", symbol, timeframe });
  }, [symbol, timeframe]);

  const pickSymbol = useCallback((next: string) => {
    const normalized = next.trim().toUpperCase();
    if (!normalized) return;
    setSymbol(normalized);
  }, []);

  const pickTimeframe = useCallback((next: CandleTimeframe) => {
    setTimeframe(next);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Browser policy
    }
  }, []);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(popoutUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this URL and open in Chrome/Edge:", popoutUrl);
    }
  }, [popoutUrl]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="relative z-50 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-sky-300">
            GCC Scanner · separate window
          </p>
          <p className="text-[10px] text-zinc-500">
            Drag this window to another monitor · use Chrome/Edge if Cursor preview
            blocks clicks
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              connected
                ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
                : "rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-400"
            }
          >
            {connected ? "Live" : "Offline"}
          </span>
          {market?.markPriceUsd ? (
            <span className="text-xs font-semibold tabular-nums text-zinc-100">
              {formatPriceUsd(market.markPriceUsd)}
            </span>
          ) : null}
          <Button
            variant="secondary"
            className="!px-2 !py-1 !text-[10px]"
            onClick={() => void toggleFullscreen()}
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </Button>
          <Button
            variant="secondary"
            className="!px-2 !py-1 !text-[10px]"
            onClick={() => void copyLink()}
          >
            {copied ? "Copied!" : "Copy link"}
          </Button>
          <Button
            variant="secondary"
            className="!px-2 !py-1 !text-[10px]"
            onClick={() => window.close()}
          >
            Close
          </Button>
        </div>
      </header>

      <div className="relative z-50 shrink-0 space-y-2 border-b border-zinc-800 px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {QUICK_SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => pickSymbol(s)}
              className={
                s === symbol
                  ? "rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-black"
                  : "rounded-md bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700"
              }
            >
              {s}
            </button>
          ))}
        </div>
        <SymbolPicker
          symbol={symbol}
          onSymbolChange={pickSymbol}
          compact
        />
        <div className="flex flex-wrap gap-1">
          {PHOENIX_CANDLE_TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => pickTimeframe(tf)}
              className={
                tf === timeframe
                  ? "rounded-md bg-sky-500 px-2 py-1 text-[11px] font-semibold text-black"
                  : "rounded-md bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700"
              }
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 min-h-0 flex-1 p-2">
        <PhoenixGccChart symbol={symbol} timeframe={timeframe} compact />
      </div>
    </div>
  );
}
