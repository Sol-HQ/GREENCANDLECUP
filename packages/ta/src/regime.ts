import type { Candle } from "./index.js";
import { detectTrend, ema } from "./index.js";

export type MarketRegime =
  | "trend_up"
  | "trend_down"
  | "range_chop"
  | "volatile"
  | "warming";

export type RegimeAnalysis = {
  regime: MarketRegime;
  reason: string;
  /** Directional efficiency: net move / total path (0–1). */
  trendEfficiency: number;
  netMovePct: number;
  rangePct: number;
  volatilityRatio: number;
  trend: "up" | "down" | "flat";
};

function averageTrueRange(candles: Candle[]): number {
  if (candles.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i]!;
    const prev = candles[i - 1]!;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    );
    sum += tr;
  }
  return sum / (candles.length - 1);
}

/** Classify how the chart is behaving so the bot can pick trend vs scalp mode. */
export function detectMarketRegime(candles: Candle[]): RegimeAnalysis {
  const closes = candles.map((c) => c.close);
  const mark = closes.at(-1) ?? 0;

  if (candles.length < 40 || mark <= 0) {
    return {
      regime: "warming",
      reason: "Need more candles to read the chart",
      trendEfficiency: 0,
      netMovePct: 0,
      rangePct: 0,
      volatilityRatio: 1,
      trend: "flat",
    };
  }

  const trend = detectTrend(closes);
  const lookback = closes.slice(-60);
  const start = lookback[0]!;
  const end = lookback.at(-1)!;
  const netMovePct = ((end - start) / start) * 100;

  let path = 0;
  for (let i = 1; i < lookback.length; i++) {
    path += Math.abs(lookback[i]! - lookback[i - 1]!);
  }
  const trendEfficiency =
    path > 0 ? Math.abs(end - start) / path : 0;

  const recent20 = candles.slice(-20);
  const rangeLow = Math.min(...recent20.map((c) => c.low));
  const rangeHigh = Math.max(...recent20.map((c) => c.high));
  const rangePct = ((rangeHigh - rangeLow) / mark) * 100;

  const atr5 = averageTrueRange(candles.slice(-6));
  const atr20 = averageTrueRange(candles.slice(-21));
  const volatilityRatio = atr20 > 0 ? atr5 / atr20 : 1;

  const ema20 = ema(closes, 20).at(-1) ?? mark;
  const ema50 = ema(closes, 50).at(-1) ?? mark;

  if (volatilityRatio >= 1.6 && rangePct >= 1.2) {
    return {
      regime: "volatile",
      reason: `Spike mode · ${rangePct.toFixed(1)}% range · vol ${volatilityRatio.toFixed(1)}× normal`,
      trendEfficiency,
      netMovePct,
      rangePct,
      volatilityRatio,
      trend,
    };
  }

  const trending =
    trendEfficiency >= 0.28 &&
    Math.abs(netMovePct) >= 0.45 &&
    ((trend === "up" && mark > ema20 && ema20 > ema50) ||
      (trend === "down" && mark < ema20 && ema20 < ema50));

  if (trending && netMovePct > 0) {
    return {
      regime: "trend_up",
      reason: `Uptrend · +${netMovePct.toFixed(1)}% over ~60 bars · ${(trendEfficiency * 100).toFixed(0)}% efficient`,
      trendEfficiency,
      netMovePct,
      rangePct,
      volatilityRatio,
      trend,
    };
  }

  if (trending && netMovePct < 0) {
    return {
      regime: "trend_down",
      reason: `Downtrend · ${netMovePct.toFixed(1)}% over ~60 bars · ${(trendEfficiency * 100).toFixed(0)}% efficient`,
      trendEfficiency,
      netMovePct,
      rangePct,
      volatilityRatio,
      trend,
    };
  }

  return {
    regime: "range_chop",
    reason: `Choppy · ${rangePct.toFixed(1)}% box · no clean trend (${(trendEfficiency * 100).toFixed(0)}% efficient)`,
    trendEfficiency,
    netMovePct,
    rangePct,
    volatilityRatio,
    trend,
  };
}
