"use client";

import { useEffect, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type UTCTimestamp,
} from "lightweight-charts";
import type { PaperTradeRecord } from "@gcc/shared";
import { Card } from "@/components/ui";
import { api } from "@/lib/utils";
import { cn } from "@/lib/utils";

type ReplayTick = {
  at: string;
  symbol: string;
  priceUsd: number;
  source: "poll" | "trade";
};

type ReplayResponse = {
  symbol: string;
  minutes: number;
  delaySec: number;
  windowStart: string;
  windowEnd: string;
  ticks: ReplayTick[];
  trades: PaperTradeRecord[];
};

function tradeMarkers(trades: PaperTradeRecord[]): SeriesMarker<UTCTimestamp>[] {
  return trades
    .map((t) => {
      const isOpen = t.action.startsWith("open");
      const isLong = t.action.includes("long");
      const pnl =
        t.pnlUsd != null
          ? ` · ${t.pnlUsd >= 0 ? "+" : ""}$${t.pnlUsd.toFixed(2)}`
          : "";
      const label = isOpen
        ? isLong
          ? `BUY $${t.priceUsd.toFixed(4)}`
          : `SHORT $${t.priceUsd.toFixed(4)}`
        : isLong
          ? `SELL $${t.priceUsd.toFixed(4)}${pnl}`
          : `COVER $${t.priceUsd.toFixed(4)}${pnl}`;

      return {
        time: Math.floor(new Date(t.at).getTime() / 1000) as UTCTimestamp,
        position: isLong
          ? isOpen
            ? ("belowBar" as const)
            : ("aboveBar" as const)
          : isOpen
            ? ("aboveBar" as const)
            : ("belowBar" as const),
        color: isOpen
          ? "#22c55e"
          : t.pnlUsd != null && t.pnlUsd < 0
            ? "#ef4444"
            : "#f59e0b",
        shape: isOpen ? ("arrowUp" as const) : ("arrowDown" as const),
        text: label,
        size: 2,
      };
    })
    .sort((a, b) => (a.time as number) - (b.time as number));
}

function buildLinePoints(
  ticks: ReplayTick[],
  trades: PaperTradeRecord[],
): { time: UTCTimestamp; value: number }[] {
  const byTime = new Map<number, number>();
  for (const t of ticks) {
    byTime.set(Math.floor(new Date(t.at).getTime() / 1000), t.priceUsd);
  }
  for (const t of trades) {
    byTime.set(Math.floor(new Date(t.at).getTime() / 1000), t.priceUsd);
  }
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
}

export function PaperTradeReplayChart({
  symbol,
  trades,
}: {
  symbol: string;
  trades: PaperTradeRecord[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);
  const [minutes, setMinutes] = useState(5);
  const [delaySec, setDelaySec] = useState(60);
  const [replay, setReplay] = useState<ReplayResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await api<ReplayResponse>(
          `/api/paper/replay?symbol=${encodeURIComponent(symbol)}&minutes=${minutes}&delaySec=${delaySec}`,
        );
        if (active) setReplay(data);
      } catch {
        if (active) setReplay(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [symbol, minutes, delaySec]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: "#09090b" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#27272a" },
        horzLines: { color: "#27272a" },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: "#3f3f46" },
      timeScale: { borderColor: "#3f3f46", timeVisible: true, secondsVisible: true },
    });

    const series = chart.addSeries(LineSeries, {
      color: "#38bdf8",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    const markers = createSeriesMarkers(series);

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = markers;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const markers = markersRef.current;
    if (!series || !markers || !replay) return;

    const points = buildLinePoints(replay.ticks, replay.trades);
    if (points.length > 0) {
      series.setData(points);
      markers.setMarkers(tradeMarkers(replay.trades));
      chartRef.current?.timeScale().fitContent();
    } else {
      series.setData([]);
      markers.setMarkers([]);
    }
  }, [replay]);

  const windowTrades = replay?.trades ?? trades.filter((t) => t.symbol === symbol);

  return (
    <Card title="Paper trade tape (our recording)">
      <p className="mb-3 text-xs text-zinc-500">
        GCC records mark price on every server tick and pins each paper fill at
        the exact price. This is <strong className="text-zinc-300">our</strong>{" "}
        tape — not Phoenix&apos;s chart. Delay lets you replay recent action like
        a DVR.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">Window</span>
        {[5, 15, 30].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinutes(m)}
            className={cn(
              "rounded border px-2 py-1",
              minutes === m
                ? "border-emerald-600 bg-emerald-950/40 text-emerald-300"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500",
            )}
          >
            {m}m
          </button>
        ))}
        <span className="ml-2 text-zinc-500">Delay</span>
        {[
          { label: "Live", sec: 0 },
          { label: "30s", sec: 30 },
          { label: "60s", sec: 60 },
        ].map((d) => (
          <button
            key={d.sec}
            type="button"
            onClick={() => setDelaySec(d.sec)}
            className={cn(
              "rounded border px-2 py-1",
              delaySec === d.sec
                ? "border-sky-600 bg-sky-950/40 text-sky-300"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div
        ref={containerRef}
        className="h-[220px] w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
      />
      {loading && !replay ? (
        <p className="mt-2 text-xs text-zinc-500">Recording tape…</p>
      ) : replay && replay.ticks.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">
          Tape is filling — keep the bot running. First ticks appear after a few
          server polls (~5s each).
        </p>
      ) : replay ? (
        <p className="mt-2 text-xs text-zinc-500">
          {replay.ticks.length} ticks · {windowTrades.length} trade
          {windowTrades.length === 1 ? "" : "s"} in window · ends{" "}
          {new Date(replay.windowEnd).toLocaleTimeString()}
        </p>
      ) : null}
      {windowTrades.length > 0 ? (
        <div className="mt-3 max-h-32 space-y-1 overflow-y-auto font-mono text-xs">
          {windowTrades.map((t) => (
            <div
              key={t.id}
              className="rounded border border-zinc-800/80 bg-zinc-900/40 px-2 py-1"
            >
              <span className="text-zinc-600">
                {new Date(t.at).toLocaleTimeString()}
              </span>{" "}
              <span className="text-zinc-200">{t.action}</span>{" "}
              <span className="text-emerald-400">${t.priceUsd.toFixed(4)}</span>
              {t.pnlUsd != null ? (
                <span
                  className={
                    t.pnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"
                  }
                >
                  {" "}
                  · PnL {t.pnlUsd >= 0 ? "+" : ""}${t.pnlUsd.toFixed(2)}
                </span>
              ) : null}
              <span className="text-zinc-600"> · {t.reason}</span>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
