"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { computeMacdSeries, detectTrend, ema, type Candle } from "@gcc/ta";
import {
  candleDefaultVisibleBars,
  candleHistoryLimit,
  candlePeriodStart,
  candlePollIntervalMs,
  chartPriceFormatOptions,
  formatPricePlain,
  formatPriceUsd,
  formatTokenAmount,
  normalizeCandleTimeframe,
  type CandleTimeframe,
  type PaperTradeRecord,
} from "@gcc/shared";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import { api } from "@/lib/utils";
import { paperTradesToMarkers } from "@/lib/chart-trade-markers";
import { cn } from "@/lib/utils";

const CHART_LOCALE =
  typeof navigator !== "undefined" ? navigator.language : "en-US";

function formatTickMark(time: UTCTimestamp, tickMarkType: TickMarkType): string {
  const date = new Date((time as number) * 1000);
  switch (tickMarkType) {
    case TickMarkType.Year:
      return date.toLocaleDateString(CHART_LOCALE, { year: "numeric" });
    case TickMarkType.Month:
      return date.toLocaleDateString(CHART_LOCALE, { month: "short" });
    case TickMarkType.DayOfMonth:
      return date.toLocaleDateString(CHART_LOCALE, { day: "numeric" });
    case TickMarkType.Time:
      return date.toLocaleTimeString(CHART_LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    case TickMarkType.TimeWithSeconds:
      return date.toLocaleTimeString(CHART_LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    default:
      return date.toLocaleString(CHART_LOCALE);
  }
}

function formatCrosshairTime(time: UTCTimestamp): string {
  const date = new Date((time as number) * 1000);
  return date.toLocaleString(CHART_LOCALE, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatBarTime(time: number): string {
  return new Date(time * 1000).toLocaleString(CHART_LOCALE, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatVolume(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return formatTokenAmount(value);
}

type Ohlc = { o: number; h: number; l: number; c: number; v?: number };
type MacdReadout = { macd: number; signal: number; histogram: number };

type Props = {
  symbol?: string;
  timeframe?: string;
  compact?: boolean;
};

export function PhoenixGccChartInner({
  symbol = "SOL",
  timeframe: rawTf = "1m",
  compact = false,
}: Props) {
  const timeframe = normalizeCandleTimeframe(rawTf);
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const macdRef = useRef<ISeriesApi<"Line"> | null>(null);
  const signalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const histRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const rowsRef = useRef<Candle[]>([]);
  const lastBarTimeRef = useRef<number | null>(null);
  const zoomedRef = useRef(false);
  const hasDataRef = useRef(false);

  const [trend, setTrend] = useState<string>("—");
  const [lastClose, setLastClose] = useState<string>("—");
  const [lastBarTime, setLastBarTime] = useState<string>("—");
  const [lastOhlc, setLastOhlc] = useState<Ohlc | null>(null);
  const [hoverOhlc, setHoverOhlc] = useState<Ohlc | null>(null);
  const [lastVolume, setLastVolume] = useState<string>("—");
  const [hoverVolume, setHoverVolume] = useState<string | null>(null);
  const [hoverMacd, setHoverMacd] = useState<MacdReadout | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale">("loading");
  const [warning, setWarning] = useState<string | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [tickAgeSec, setTickAgeSec] = useState<number | null>(null);
  const [markFlash, setMarkFlash] = useState<"up" | "down" | null>(null);
  const lastMarkRef = useRef<number | null>(null);

  const { market, orderbook, connected: wsConnected, paperTrades } =
    useGccSocket(symbol);

  const applyIndicators = (rows: Candle[]) => {
    const closes = rows.map((c) => c.close);
    const ema20 = ema(closes, 20);
    const ema50 = ema(closes, 50);
    if (ema20Ref.current && ema50Ref.current) {
      ema20Ref.current.setData(
        rows.map((c, i) => ({
          time: c.time as UTCTimestamp,
          value: ema20[i]!,
        })),
      );
      ema50Ref.current.setData(
        rows.map((c, i) => ({
          time: c.time as UTCTimestamp,
          value: ema50[i]!,
        })),
      );
    }
    if (macdRef.current && signalRef.current && histRef.current) {
      const macdSeries = computeMacdSeries(closes);
      if (macdSeries.length > 0) {
        const offset = rows.length - macdSeries.length;
        macdRef.current.setData(
          macdSeries.map((m, i) => ({
            time: rows[i + offset]!.time as UTCTimestamp,
            value: m.macd,
          })),
        );
        signalRef.current.setData(
          macdSeries.map((m, i) => ({
            time: rows[i + offset]!.time as UTCTimestamp,
            value: m.signal,
          })),
        );
        histRef.current.setData(
          macdSeries.map((m, i) => ({
            time: rows[i + offset]!.time as UTCTimestamp,
            value: m.histogram,
            color: m.histogram >= 0 ? "#22c55e88" : "#ef444488",
          })),
        );
      }
    }
    setTrend(detectTrend(closes));
  };

  const pushBarToChart = (c: Candle) => {
    const bar = {
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    };
    candleRef.current?.update(bar);
    volumeRef.current?.update({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color:
        c.close >= c.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
    });
  };

  // Init chart once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let chart: IChartApi | null = null;
    let disposed = false;

    const mountChart = () => {
      if (disposed || chart) return;

      const width = el.clientWidth;
      const minH = compact ? 80 : 120;
      const height = compact ? el.clientHeight : Math.max(el.clientHeight, 200);
      if (width < 40 || height < minH) return;

      const instance = createChart(el, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: "#09090b" },
          textColor: "#d4d4d8",
          panes: {
            separatorColor: "#3f3f46",
            separatorHoverColor: "#71717a",
            enableResize: !compact,
          },
        },
        grid: {
          vertLines: { color: "#27272a" },
          horzLines: { color: "#27272a" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: "#71717a",
            width: 1,
            style: 2,
            labelBackgroundColor: "#3f3f46",
          },
          horzLine: {
            color: "#71717a",
            width: 1,
            style: 2,
            labelBackgroundColor: "#3f3f46",
          },
        },
        rightPriceScale: {
          borderColor: "#3f3f46",
          borderVisible: true,
          scaleMargins: { top: 0.08, bottom: 0.08 },
        },
        localization: {
          locale: CHART_LOCALE,
          timeFormatter: formatCrosshairTime,
          priceFormatter: (price: number) => formatPricePlain(price),
        },
        timeScale: {
          borderColor: "#3f3f46",
          borderVisible: true,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 12,
          barSpacing: compact ? 6 : 9,
          minBarSpacing: 2,
          shiftVisibleRangeOnNewBar: false,
          tickMarkFormatter: formatTickMark,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });

      // Pane 0 — price (candles + EMAs)
      const candles = instance.addSeries(
        CandlestickSeries,
        {
          upColor: "#22c55e",
          downColor: "#ef4444",
          borderVisible: false,
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
          priceLineVisible: true,
          priceLineColor: "#38bdf8",
          priceLineWidth: 1,
          lastValueVisible: true,
          priceFormat: chartPriceFormatOptions(1),
        },
        0,
      );

      const ema20 = instance.addSeries(
        LineSeries,
        {
          color: "#facc15",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          title: "EMA20",
        },
        0,
      );
      const ema50 = instance.addSeries(
        LineSeries,
        {
          color: "#a78bfa",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          title: "EMA50",
        },
        0,
      );

      // Pane 1 — dedicated volume histogram (own Y-axis)
      const volume = instance.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: "volume" },
          lastValueVisible: true,
          priceLineVisible: false,
          title: "Vol",
        },
        1,
      );

      // Pane 2 — MACD (full chart only)
      const macdLine = compact
        ? null
        : instance.addSeries(
            LineSeries,
            {
              color: "#38bdf8",
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
              title: "MACD",
            },
            2,
          );
      const signalLine = compact
        ? null
        : instance.addSeries(
            LineSeries,
            {
              color: "#f97316",
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
              title: "Signal",
            },
            2,
          );
      const histogram = compact
        ? null
        : instance.addSeries(
            HistogramSeries,
            {
              title: "Hist",
            },
            2,
          );

      const panes = instance.panes();
      panes[0]?.setStretchFactor(compact ? 6 : 5);
      panes[1]?.setStretchFactor(compact ? 2.5 : 2.2);
      if (!compact) panes[2]?.setStretchFactor(1.8);

      instance.subscribeCrosshairMove((param) => {
        if (!param.time) {
          setHoverOhlc(null);
          setHoverVolume(null);
          setHoverMacd(null);
          return;
        }
        if (candleRef.current) {
          const data = param.seriesData.get(candleRef.current);
          if (data && "open" in data) {
            setHoverOhlc({
              o: data.open,
              h: data.high,
              l: data.low,
              c: data.close,
            });
          } else {
            setHoverOhlc(null);
          }
        }
        if (volumeRef.current) {
          const vol = param.seriesData.get(volumeRef.current);
          if (vol && "value" in vol) {
            setHoverVolume(formatVolume(vol.value));
          } else {
            setHoverVolume(null);
          }
        }
        if (macdRef.current && signalRef.current && histRef.current) {
          const m = param.seriesData.get(macdRef.current);
          const s = param.seriesData.get(signalRef.current);
          const h = param.seriesData.get(histRef.current);
          if (
            m &&
            s &&
            h &&
            "value" in m &&
            "value" in s &&
            "value" in h
          ) {
            setHoverMacd({
              macd: m.value,
              signal: s.value,
              histogram: h.value,
            });
          } else {
            setHoverMacd(null);
          }
        }
      });

      instance.timeScale().subscribeVisibleLogicalRangeChange(() => {
        zoomedRef.current = true;
      });

      chart = instance;
      chartRef.current = instance;
      candleRef.current = candles;
      markersRef.current?.detach();
      markersRef.current = createSeriesMarkers(candles, []);
      volumeRef.current = volume;
      ema20Ref.current = ema20;
      ema50Ref.current = ema50;
      macdRef.current = macdLine;
      signalRef.current = signalLine;
      histRef.current = histogram;
      setChartReady(true);
    };

    const resizeChart = () => {
      mountChart();
      if (!chart) return;
      const width = el.clientWidth;
      const minH = compact ? 80 : 120;
      const height = compact ? el.clientHeight : Math.max(el.clientHeight, 200);
      if (width > 40 && height > minH) {
        chart.applyOptions({ width, height });
      }
    };

    mountChart();
    const ro = new ResizeObserver(resizeChart);
    ro.observe(el);

    return () => {
      disposed = true;
      ro.disconnect();
      chart?.remove();
      chart = null;
      chartRef.current = null;
      markersRef.current?.detach();
      markersRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      ema20Ref.current = null;
      ema50Ref.current = null;
      macdRef.current = null;
      signalRef.current = null;
      histRef.current = null;
      zoomedRef.current = false;
      hasDataRef.current = false;
      rowsRef.current = [];
      lastBarTimeRef.current = null;
      setChartReady(false);
      setHoverOhlc(null);
    };
  }, [compact]);

  // Load / refresh candle history
  useEffect(() => {
    let active = true;
    if (!chartReady) {
      return () => {
        active = false;
      };
    }

    zoomedRef.current = false;
    hasDataRef.current = false;
    rowsRef.current = [];
    lastBarTimeRef.current = null;
    setStatus("loading");
    setWarning(null);
    setLastBarTime("—");
    setLastOhlc(null);
    setHoverOhlc(null);
    setLastVolume("—");
    setHoverVolume(null);
    setHoverMacd(null);

    const tf = timeframe as CandleTimeframe;
    const limit = candleHistoryLimit(tf);
    const pollMs = candlePollIntervalMs(tf);
    const visibleBars = candleDefaultVisibleBars(tf);

    chartRef.current?.timeScale().applyOptions({
      secondsVisible: tf === "1m" || tf === "5m",
      barSpacing: compact ? 6 : 9,
    });

    const applyRows = (rows: Candle[]) => {
      if (!chartRef.current || !candleRef.current || rows.length === 0) return;

      rowsRef.current = rows;
      lastBarTimeRef.current = rows.at(-1)!.time;

      candleRef.current.setData(
        rows.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );

      volumeRef.current?.setData(
        rows.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color:
            c.close >= c.open ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
        })),
      );

      applyIndicators(rows);

      const last = rows.at(-1)!;
      setLastClose(formatPricePlain(last.close));
      setLastBarTime(formatBarTime(last.time));
      setLastOhlc({ o: last.open, h: last.high, l: last.low, c: last.close, v: last.volume });
      setLastVolume(formatVolume(last.volume));

      if (!zoomedRef.current) {
        const to = rows.length + 4;
        const from = Math.max(0, rows.length - visibleBars);
        chartRef.current.timeScale().setVisibleLogicalRange({ from, to });
      }

      hasDataRef.current = true;
      setStatus("live");
      setWarning(null);
    };

    const mergeRows = (rows: Candle[]) => {
      if (!candleRef.current || rows.length === 0) return;

      const prevTime = lastBarTimeRef.current;
      const last = rows.at(-1)!;

      if (prevTime == null) {
        applyRows(rows);
        return;
      }

      const tail = rows.filter((c) => c.time >= prevTime);
      for (const c of tail) {
        pushBarToChart(c);
      }

      const byTime = new Map(rowsRef.current.map((c) => [c.time, c]));
      for (const c of rows) byTime.set(c.time, c);
      rowsRef.current = [...byTime.values()].sort((a, b) => a.time - b.time);
      lastBarTimeRef.current = last.time;

      if (tail.length > 1) {
        applyIndicators(rowsRef.current);
      }

      setLastClose(formatPricePlain(last.close));
      setLastBarTime(formatBarTime(last.time));
      setLastOhlc({ o: last.open, h: last.high, l: last.low, c: last.close, v: last.volume });
      setLastVolume(formatVolume(last.volume));
      setStatus("live");
    };

    const formatLoadError = (err: unknown) => {
      const raw = err instanceof Error ? err.message : "Failed to load candles";
      try {
        const parsed = JSON.parse(raw) as { error?: string };
        if (parsed.error) return parsed.error;
      } catch {
        // not JSON
      }
      return raw.length > 180 ? `${raw.slice(0, 180)}…` : raw;
    };

    const load = async (full: boolean) => {
      try {
        const rows = await api<Candle[]>(
          `/api/candles/${symbol}?timeframe=${tf}&limit=${limit}`,
        );
        if (!active || !chartRef.current) return;
        if (!Array.isArray(rows) || rows.length === 0) {
          if (!hasDataRef.current) setWarning("Waiting for Phoenix candles…");
          else setStatus("stale");
          return;
        }
        if (full || !hasDataRef.current) applyRows(rows);
        else mergeRows(rows);
      } catch (err) {
        if (!active) return;
        const msg = formatLoadError(err);
        if (hasDataRef.current) {
          setStatus("stale");
          setWarning("Refresh failed — showing last good data");
        } else {
          setWarning(msg);
        }
      }
    };

    void load(true);
    const id = setInterval(() => void load(false), pollMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [symbol, timeframe, chartReady, compact]);

  useEffect(() => {
    if (!chartReady || !markersRef.current) return;

    const applyFromTrades = (trades: PaperTradeRecord[]) => {
      const tf = timeframe as CandleTimeframe;
      const markers = paperTradesToMarkers(trades, symbol, tf);
      markersRef.current?.setMarkers(markers);
    };

    if (paperTrades.length > 0) {
      applyFromTrades(paperTrades);
      return;
    }

    let active = true;
    const load = () => {
      void api<{ trades: PaperTradeRecord[] }>("/api/paper/trades").then(
        (res) => {
          if (active) applyFromTrades(res.trades ?? []);
        },
      );
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [symbol, timeframe, chartReady, paperTrades]);

  // Live mark / mid ticks the forming bar between REST candle polls
  useEffect(() => {
    const mark = Number(market?.markPriceUsd ?? 0);
    const bid = Number(orderbook?.bids[0]?.price ?? 0);
    const ask = Number(orderbook?.asks[0]?.price ?? 0);
    const mid = bid && ask ? (bid + ask) / 2 : 0;
    const live = mid || mark;
    if (!live || !candleRef.current || !hasDataRef.current) return;

    const tf = timeframe as CandleTimeframe;
    const periodStart = candlePeriodStart(
      Math.floor(Date.now() / 1000),
      tf,
    );
    const rows = rowsRef.current;
    if (rows.length === 0) return;

    const lastIdx = rows.length - 1;
    const last = rows[lastIdx]!;

    if (periodStart < last.time) return;

    if (periodStart === last.time) {
      const updated: Candle = {
        ...last,
        close: live,
        high: Math.max(last.high, live),
        low: Math.min(last.low, live),
      };
      rows[lastIdx] = updated;
      pushBarToChart(updated);
    } else {
      const newBar: Candle = {
        time: periodStart,
        open: live,
        high: live,
        low: live,
        close: live,
        volume: 0,
      };
      rows.push(newBar);
      lastBarTimeRef.current = periodStart;
      pushBarToChart(newBar);
    }

    const current = rows[rows.length - 1]!;
    setLastClose(formatPricePlain(live));
    setLastBarTime(formatBarTime(current.time));
    setLastOhlc({
      o: current.open,
      h: current.high,
      l: current.low,
      c: current.close,
      v: current.volume,
    });
    if (wsConnected) setStatus("live");
  }, [
    market?.markPriceUsd,
    market?.updatedAt,
    orderbook?.bids,
    orderbook?.asks,
    orderbook?.updatedAt,
    timeframe,
    chartReady,
    wsConnected,
  ]);

  useEffect(() => {
    const mark = Number(market?.markPriceUsd ?? 0);
    if (!mark || !chartReady) return;
    const fmt = chartPriceFormatOptions(mark);
    candleRef.current?.applyOptions({ priceFormat: fmt });
    ema20Ref.current?.applyOptions({ priceFormat: fmt });
    ema50Ref.current?.applyOptions({ priceFormat: fmt });
    chartRef.current?.applyOptions({
      localization: {
        locale: CHART_LOCALE,
        timeFormatter: formatCrosshairTime,
        priceFormatter: (price: number) => formatPricePlain(price),
      },
    });
  }, [market?.markPriceUsd, chartReady, symbol]);

  useEffect(() => {
    const mark = Number(market?.markPriceUsd ?? 0);
    if (!mark) return;
    const prev = lastMarkRef.current;
    if (prev != null && mark !== prev) {
      setMarkFlash(mark > prev ? "up" : "down");
      const id = window.setTimeout(() => setMarkFlash(null), 400);
      return () => window.clearTimeout(id);
    }
    lastMarkRef.current = mark;
  }, [market?.markPriceUsd]);

  useEffect(() => {
    const tick = () => {
      if (!market?.updatedAt) {
        setTickAgeSec(null);
        return;
      }
      const age = Math.max(
        0,
        Math.floor((Date.now() - new Date(market.updatedAt).getTime()) / 1000),
      );
      setTickAgeSec(age);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [market?.updatedAt]);

  const displayOhlc = hoverOhlc ?? lastOhlc;
  const displayVolume = hoverVolume ?? lastVolume;

  const historyHint =
    timeframe === "1m"
      ? "~17h"
      : timeframe === "5m"
        ? "~3.5d"
        : timeframe === "1h"
          ? "~41d"
          : null;

  return (
    <div
      ref={wrapRef}
      className={cn(
        "flex h-full min-h-0 flex-col",
        !compact && "min-h-[480px]",
      )}
    >
      <div
        className={cn(
          "mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400",
          compact && "mb-1 gap-x-1.5 gap-y-0.5 text-[10px]",
        )}
      >
        <span>
          {compact ? symbol : "Phoenix"} ·{" "}
          <strong className="text-zinc-200">{timeframe}</strong>
          {historyHint ? (
            <span className="text-zinc-600"> · {historyHint}</span>
          ) : null}
        </span>
        {!compact ? (
          <span>
            Trend: <strong className="text-zinc-200">{trend}</strong>
          </span>
        ) : null}
        {displayOhlc ? (
          <span className="font-mono text-[11px] text-zinc-300">
            O {formatPricePlain(displayOhlc.o)} · H{" "}
            {formatPricePlain(displayOhlc.h)} · L{" "}
            {formatPricePlain(displayOhlc.l)} · C{" "}
            <strong className="text-zinc-100">
              {formatPricePlain(displayOhlc.c)}
            </strong>
          </span>
        ) : (
          <span>
            <strong className="text-zinc-200">{lastClose}</strong>
          </span>
        )}
        <span className="text-zinc-500">{lastBarTime}</span>
        <span
          className={
            status === "live" && wsConnected
              ? "text-emerald-400"
              : status === "stale"
                ? "text-amber-400"
                : "text-zinc-500"
          }
        >
          {status === "live" && wsConnected
            ? "● live"
            : status === "stale"
              ? "● stale"
              : "○ loading"}
        </span>
        {market?.markPriceUsd ? (
          <span className="text-sky-400">
            mark {formatPriceUsd(market.markPriceUsd)}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-zinc-800/80 bg-zinc-900/40 px-2 py-1.5 font-mono text-[11px] text-zinc-400",
          compact && "mb-1 gap-x-2 px-1.5 py-1 text-[10px]",
        )}
      >
        <span>
          <span className="text-zinc-500">Vol</span>{" "}
          <strong className="text-zinc-200">{displayVolume}</strong>
        </span>
        {!compact && hoverMacd ? (
          <>
            <span>
              <span className="text-sky-400/80">MACD</span>{" "}
              {hoverMacd.macd.toFixed(4)}
            </span>
            <span>
              <span className="text-orange-400/80">Sig</span>{" "}
              {hoverMacd.signal.toFixed(4)}
            </span>
            <span>
              <span className="text-zinc-500">Hist</span>{" "}
              <strong
                className={
                  hoverMacd.histogram >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }
              >
                {hoverMacd.histogram.toFixed(4)}
              </strong>
            </span>
          </>
        ) : !compact ? (
          <span className="text-zinc-600">
            MACD · hover chart for values
          </span>
        ) : null}
        <span className="text-zinc-600">
          {compact
            ? "Price + Vol panes"
            : "Drag to pan · scroll to zoom · pane dividers resize"}
        </span>
      </div>
      {warning ? (
        <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-950/30 px-2 py-1 text-xs text-amber-200">
          {warning}
        </p>
      ) : null}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 touch-none overflow-hidden rounded-lg border border-zinc-800 bg-[#09090b]"
      />
    </div>
  );
}
