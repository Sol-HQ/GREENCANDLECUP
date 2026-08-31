import type { Candle } from "./index.js";
import { ema } from "./index.js";
import type { WaveScalpAction } from "./wave-scalp.js";

export type TrendRideConfig = {
  takeProfitPct?: number;
  stopLossPct?: number;
  /** Lock gains once up this % and price loses EMA9. */
  trailActivatePct?: number;
};

export const DEFAULT_TREND_RIDE_CONFIG: Required<TrendRideConfig> = {
  takeProfitPct: 2.5,
  stopLossPct: 1.5,
  trailActivatePct: 1,
};

export type TrendRideAnalysis = {
  action: WaveScalpAction;
  reason: string;
  markPrice: number;
  unrealizedPnlPct: number | null;
  regimeSide: "up" | "down";
};

/** Hold perp through a trend — longer runway than wave scalp. */
export function analyzeTrendRide(
  candles: Candle[],
  position: "flat" | "long" | "short",
  entryPriceUsd: number | null,
  regimeSide: "up" | "down",
  config: TrendRideConfig = {},
): TrendRideAnalysis {
  const {
    takeProfitPct = DEFAULT_TREND_RIDE_CONFIG.takeProfitPct,
    stopLossPct = DEFAULT_TREND_RIDE_CONFIG.stopLossPct,
    trailActivatePct = DEFAULT_TREND_RIDE_CONFIG.trailActivatePct,
  } = config;

  const markPrice = candles.at(-1)?.close ?? 0;
  const closes = candles.map((c) => c.close);
  const ema9 = ema(closes, 9).at(-1) ?? markPrice;
  const ema20 = ema(closes, 20).at(-1) ?? markPrice;

  let unrealizedPnlPct: number | null = null;
  if (position === "long" && entryPriceUsd) {
    unrealizedPnlPct = ((markPrice - entryPriceUsd) / entryPriceUsd) * 100;
  } else if (position === "short" && entryPriceUsd) {
    unrealizedPnlPct = ((entryPriceUsd - markPrice) / entryPriceUsd) * 100;
  }

  if (position === "long") {
    if (unrealizedPnlPct != null && unrealizedPnlPct >= takeProfitPct) {
      return {
        action: "close_long",
        reason: `Trend take profit +${unrealizedPnlPct.toFixed(1)}% (target ${takeProfitPct}%)`,
        markPrice,
        unrealizedPnlPct,
        regimeSide,
      };
    }
    if (unrealizedPnlPct != null && unrealizedPnlPct <= -stopLossPct) {
      return {
        action: "close_long",
        reason: `Trend stop ${unrealizedPnlPct.toFixed(1)}%`,
        markPrice,
        unrealizedPnlPct,
        regimeSide,
      };
    }
    if (
      unrealizedPnlPct != null &&
      unrealizedPnlPct >= trailActivatePct &&
      markPrice < ema9
    ) {
      return {
        action: "close_long",
        reason: `Trail stop · +${unrealizedPnlPct.toFixed(1)}% but lost EMA9`,
        markPrice,
        unrealizedPnlPct,
        regimeSide,
      };
    }
    if (regimeSide === "down" && markPrice < ema20) {
      return {
        action: "close_long",
        reason: "Trend flipped down — exit long",
        markPrice,
        unrealizedPnlPct,
        regimeSide,
      };
    }
    return {
      action: "hold",
      reason: `Riding uptrend ${unrealizedPnlPct?.toFixed(1) ?? "0"}% · target +${takeProfitPct}%`,
      markPrice,
      unrealizedPnlPct,
      regimeSide,
    };
  }

  if (position === "short") {
    if (unrealizedPnlPct != null && unrealizedPnlPct >= takeProfitPct) {
      return {
        action: "close_short",
        reason: `Trend cover +${unrealizedPnlPct.toFixed(1)}%`,
        markPrice,
        unrealizedPnlPct,
        regimeSide,
      };
    }
    if (unrealizedPnlPct != null && unrealizedPnlPct <= -stopLossPct) {
      return {
        action: "close_short",
        reason: `Trend stop short ${unrealizedPnlPct.toFixed(1)}%`,
        markPrice,
        unrealizedPnlPct,
        regimeSide,
      };
    }
    if (
      unrealizedPnlPct != null &&
      unrealizedPnlPct >= trailActivatePct &&
      markPrice > ema9
    ) {
      return {
        action: "close_short",
        reason: `Trail stop · +${unrealizedPnlPct.toFixed(1)}% but reclaimed EMA9`,
        markPrice,
        unrealizedPnlPct,
        regimeSide,
      };
    }
    if (regimeSide === "up" && markPrice > ema20) {
      return {
        action: "close_short",
        reason: "Trend flipped up — cover short",
        markPrice,
        unrealizedPnlPct,
        regimeSide,
      };
    }
    return {
      action: "hold",
      reason: `Riding downtrend ${unrealizedPnlPct?.toFixed(1) ?? "0"}% · target +${takeProfitPct}%`,
      markPrice,
      unrealizedPnlPct,
      regimeSide,
    };
  }

  if (regimeSide === "up") {
    const pullback = markPrice <= ema9 * 1.004;
    const breakout =
      markPrice >= Math.max(...closes.slice(-10)) * 0.999;
    const continuation = markPrice > ema20 && markPrice > ema9;
    if (pullback || breakout || continuation) {
      return {
        action: "open_long",
        reason: pullback
          ? "Trend long · pullback to EMA9 in uptrend"
          : breakout
            ? "Trend long · breaking recent highs"
            : "Trend long · riding above EMA20/9",
        markPrice,
        unrealizedPnlPct: null,
        regimeSide,
      };
    }
  }

  if (regimeSide === "down") {
    const rally = markPrice >= ema9 * 0.996;
    const breakdown =
      markPrice <= Math.min(...closes.slice(-10)) * 1.0005;
    const continuation = markPrice < ema20 && markPrice < ema9;
    if (rally || breakdown || continuation) {
      return {
        action: "open_short",
        reason: rally
          ? "Trend short · rally to EMA9 in downtrend"
          : breakdown
            ? "Trend short · breaking recent lows"
            : "Trend short · riding below EMA20/9",
        markPrice,
        unrealizedPnlPct: null,
        regimeSide,
      };
    }
  }

  return {
    action: "hold",
    reason: "Trend mode · waiting for pullback or breakout entry",
    markPrice,
    unrealizedPnlPct: null,
    regimeSide,
  };
}
