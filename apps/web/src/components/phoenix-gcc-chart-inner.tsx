"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { computeMacdSeries, detectTrend, type Candle } from "@gcc/ta";
import { api } from "@/lib/utils";

type Props = {
  symbol?: string;
  timeframe?: string;
  height?: number;
};

export function PhoenixGccChartInner({
  symbol = "SOL",
  timeframe = "1m",
  height = 520,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const macdRef = useRef<ISeriesApi<"Line"> | null>(null);
  const signalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const histRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const fittedRef = useRef(false);
  const [trend, setTrend] = useState<string>("—");
  const [lastClose, setLastClose] = useState<string>("—");
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    try {
      const chart = createChart(el, {
        height,
        layout: {
          background: { type: ColorType.Solid, color: "#09090b" },
          textColor: "#a1a1aa",
        },
        grid: {
          vertLines: { color: "#27272a" },
          horzLines: { color: "#27272a" },
        },
        rightPriceScale: { borderColor: "#3f3f46" },
        timeScale: { borderColor: "#3f3f46", timeVisible: true },
      });

      const candles = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      const macdLine = chart.addSeries(LineSeries, {
        color: "#38bdf8",
        lineWidth: 2,
        priceScaleId: "macd",
      });
      const signalLine = chart.addSeries(LineSeries, {
        color: "#f97316",
        lineWidth: 2,
        priceScaleId: "macd",
      });
      const histogram = chart.addSeries(HistogramSeries, {
        priceScaleId: "macd",
      });

      chart.priceScale("macd").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      chartRef.current = chart;
      candleRef.current = candles;
      macdRef.current = macdLine;
      signalRef.current = signalLine;
      histRef.current = histogram;

      const ro = new ResizeObserver(() => {
        chart.applyOptions({ width: el.clientWidth });
      });
      ro.observe(el);
      chart.applyOptions({ width: el.clientWidth });

      return () => {
        ro.disconnect();
        chart.remove();
        chartRef.current = null;
      };
    } catch (err) {
      setChartError(
        err instanceof Error ? err.message : "Chart failed to initialize",
      );
      return undefined;
    }
  }, [height]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const rows = await api<Candle[]>(
          `/api/candles/${symbol}?timeframe=${timeframe}&limit=200`,
        );
        if (!active || !candleRef.current || !macdRef.current) return;
        if (!Array.isArray(rows) || rows.length === 0) return;

        const candleData = rows.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candleRef.current.setData(candleData);

        const closes = rows.map((c) => c.close);
        const macdSeries = computeMacdSeries(closes);
        if (macdSeries.length === 0) return;
        const offset = rows.length - macdSeries.length;

        macdRef.current.setData(
          macdSeries.map((m, i) => ({
            time: rows[i + offset]!.time as UTCTimestamp,
            value: m.macd,
          })),
        );
        signalRef.current?.setData(
          macdSeries.map((m, i) => ({
            time: rows[i + offset]!.time as UTCTimestamp,
            value: m.signal,
          })),
        );
        histRef.current?.setData(
          macdSeries.map((m, i) => ({
            time: rows[i + offset]!.time as UTCTimestamp,
            value: m.histogram,
            color: m.histogram >= 0 ? "#22c55e88" : "#ef444488",
          })),
        );

        setTrend(detectTrend(closes));
        setLastClose(rows.at(-1)?.close.toFixed(2) ?? "—");
        if (!fittedRef.current) {
          chartRef.current?.timeScale().fitContent();
          fittedRef.current = true;
        }
        setChartError(null);
      } catch (err) {
        if (active) {
          setChartError(
            err instanceof Error ? err.message : "Failed to load candles",
          );
        }
      }
    };

    void load();
    const id = setInterval(() => void load(), 5000);
    return () => {
      active = false;
      clearInterval(id);
      fittedRef.current = false;
    };
  }, [symbol, timeframe]);

  if (chartError) {
    return (
      <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-4 text-sm text-rose-300">
        Chart error: {chartError}. API may be rate-limited — try again in a few
        seconds or switch to TradingView tab.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-zinc-400">
        <span>
          Phoenix candles · <strong className="text-zinc-200">{timeframe}</strong>
        </span>
        <span>
          Trend: <strong className="text-zinc-200">{trend}</strong>
        </span>
        <span>
          Last: <strong className="text-zinc-200">${lastClose}</strong>
        </span>
      </div>
      <div
        ref={containerRef}
        className="overflow-hidden rounded-xl border border-zinc-800"
        style={{ height }}
      />
    </div>
  );
}
