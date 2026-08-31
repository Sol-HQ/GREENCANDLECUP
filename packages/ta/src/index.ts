export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type TrendDirection = "up" | "down" | "flat";

export type MacdPoint = {
  macd: number;
  signal: number;
  histogram: number;
};

export type TaSignal = "buy" | "sell" | null;

export type TaAnalysis = {
  trend: TrendDirection;
  macd: MacdPoint | null;
  prevMacd: MacdPoint | null;
  emaFast: number | null;
  emaSlow: number | null;
  signal: TaSignal;
  reason: string;
};

export function ema(values: number[], period: number): number[] {
  if (values.length === 0 || period <= 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0]!;
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function computeMacdSeries(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdPoint[] {
  if (closes.length < slow + signalPeriod) return [];
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(emaFast[i]! - emaSlow[i]!);
  }
  const signalLine = ema(macdLine, signalPeriod);
  return macdLine.map((macd, i) => ({
    macd,
    signal: signalLine[i]!,
    histogram: macd - signalLine[i]!,
  }));
}

export function detectTrend(
  closes: number[],
  fastPeriod = 20,
  slowPeriod = 50,
): TrendDirection {
  if (closes.length < slowPeriod) return "flat";
  const fast = ema(closes, fastPeriod);
  const slow = ema(closes, slowPeriod);
  const f = fast.at(-1)!;
  const s = slow.at(-1)!;
  const price = closes.at(-1)!;
  if (f > s && price > f) return "up";
  if (f < s && price < f) return "down";
  return "flat";
}

function crossedAbove(prev: MacdPoint, curr: MacdPoint): boolean {
  return prev.macd <= prev.signal && curr.macd > curr.signal;
}

function crossedBelow(prev: MacdPoint, curr: MacdPoint): boolean {
  return prev.macd >= prev.signal && curr.macd < curr.signal;
}

/** MACD cross aligned with EMA trend — buy low in uptrend dips, sell high in downtrend rallies. */
export function analyzeCandles(
  candles: Candle[],
  strategy: "trend_macd" | "pullback" | "momentum" | "mean_reversion",
): TaAnalysis {
  const closes = candles.map((c) => c.close);
  const macdSeries = computeMacdSeries(closes);
  const trend = detectTrend(closes);
  const macd = macdSeries.at(-1) ?? null;
  const prevMacd = macdSeries.at(-2) ?? null;
  const emaFastArr = ema(closes, 20);
  const emaSlowArr = ema(closes, 50);
  const emaFast = emaFastArr.at(-1) ?? null;
  const emaSlow = emaSlowArr.at(-1) ?? null;
  const price = closes.at(-1) ?? 0;
  const ema9 = ema(closes, 9).at(-1) ?? price;

  let signal: TaSignal = null;
  let reason = "No setup";

  if (strategy === "trend_macd" && macd && prevMacd) {
    if (trend === "up" && crossedAbove(prevMacd, macd)) {
      signal = "buy";
      reason = "Uptrend + MACD bullish cross";
    } else if (trend === "down" && crossedBelow(prevMacd, macd)) {
      signal = "sell";
      reason = "Downtrend + MACD bearish cross";
    } else if (trend === "up" && macd.histogram < 0 && price > ema9) {
      signal = "buy";
      reason = "Uptrend pullback (MACD negative, price above EMA9)";
    } else if (trend === "down" && macd.histogram > 0 && price < ema9) {
      signal = "sell";
      reason = "Downtrend rally fade (MACD positive, price below EMA9)";
    }
  }

  if (strategy === "pullback" && emaFast && emaSlow) {
    if (trend === "up" && price < ema9 && emaFast > emaSlow) {
      signal = "buy";
      reason = "Buy dip in uptrend (below EMA9)";
    } else if (trend === "down" && price > ema9 && emaFast < emaSlow) {
      signal = "sell";
      reason = "Sell rally in downtrend (above EMA9)";
    }
  }

  if (strategy === "momentum" && closes.length >= 10) {
    const recent = closes.slice(-5);
    const older = closes.slice(-10, -5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const delta = (recentAvg - olderAvg) / olderAvg;
    if (delta > 0.0005) {
      signal = "buy";
      reason = "Short-term momentum up";
    } else if (delta < -0.0005) {
      signal = "sell";
      reason = "Short-term momentum down";
    }
  }

  if (strategy === "mean_reversion" && closes.length >= 10) {
    const recent = closes.slice(-5);
    const older = closes.slice(-10, -5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const delta = (recentAvg - olderAvg) / olderAvg;
    if (delta < -0.0005) {
      signal = "buy";
      reason = "Mean reversion buy (overshoot down)";
    } else if (delta > 0.0005) {
      signal = "sell";
      reason = "Mean reversion sell (overshoot up)";
    }
  }

  return { trend, macd, prevMacd, emaFast, emaSlow, signal, reason };
}

export {
  analyzeWaveScalp,
  DEFAULT_WAVE_SCALP_CONFIG,
  type WaveScalpAction,
  type WaveScalpAnalysis,
  type WaveScalpConfig,
} from "./wave-scalp.js";

export {
  analyzeAdaptive,
  detectMarketRegime,
  fuseRegimes,
  assessConfidence,
  entryThresholdFor,
  type AdaptiveAnalysis,
  type AdaptiveConfig,
  type AdaptiveMode,
  type BrainAssessment,
  type ConfidenceFactor,
  type FusedRegime,
  type IntelProfile,
  type MarketRegime,
  type RegimeAnalysis,
} from "./adaptive.js";

export {
  type TimeframeAlignment,
  ENTRY_THRESHOLDS,
} from "./market-brain.js";

export {
  analyzeTrendRide,
  DEFAULT_TREND_RIDE_CONFIG,
  type TrendRideAnalysis,
  type TrendRideConfig,
} from "./trend-ride.js";
