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

export function PhoenixGccChart({
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
  const [trend, setTrend] = useState<string>("—");
  const [lastClose, setLastClose] = useState<string>("—");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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

    chart.priceScale("macd").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
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
  }, [height]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const rows = await api<Candle[]>(
          `/api/candles/${symbol}?timeframe=${timeframe}&limit=200`,
        );
        if (!active || !candleRef.current || !macdRef.current) return;

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
        chartRef.current?.timeScale().fitContent();
      } catch {
        // keep last good frame
      }
    };

    void load();
    const id = setInterval(() => void load(), 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [symbol, timeframe]);

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
        <span className="text-zinc-600">
          MACD (blue) · Signal (orange) · Histogram below
        </span>
      </div>
      <div
        ref={containerRef}
        className="overflow-hidden rounded-xl border border-zinc-800"
      />
    </div>
  );
}
