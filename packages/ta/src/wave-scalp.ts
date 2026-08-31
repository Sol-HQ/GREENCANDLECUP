import type { Candle } from "./index.js";

export type WaveScalpAction =
  | "open_long"
  | "close_long"
  | "open_short"
  | "close_short"
  | "hold";

export type WaveScalpConfig = {
  takeProfitPct?: number;
  stopLossPct?: number;
  swingLookback?: number;
  nearExtremePct?: number;
  /** Skip entries when last bar volume below this fraction of lookback average. */
  minVolumeRatio?: number;
  /** Minimum high-low range as % of price — skip chop too tight to pay fees. */
  minSwingRangePct?: number;
  /** Phoenix taker fee in bps — used for round-trip cost math on entries. */
  takerFeeBps?: number;
};

export const DEFAULT_WAVE_SCALP_CONFIG: Required<WaveScalpConfig> = {
  takeProfitPct: 7,
  stopLossPct: 4,
  swingLookback: 20,
  nearExtremePct: 0.35,
  minVolumeRatio: 0.35,
  minSwingRangePct: 0.8,
  takerFeeBps: 5,
};

export type WaveScalpAnalysis = {
  action: WaveScalpAction;
  reason: string;
  rangeLow: number;
  rangeHigh: number;
  priceInRangePct: number;
  unrealizedPnlPct: number | null;
  markPrice: number;
};

/** Ride local swings — one position at a time, take profit %, no stacking. */
export function analyzeWaveScalp(
  candles: Candle[],
  position: "flat" | "long" | "short",
  entryPriceUsd: number | null,
  config: WaveScalpConfig = {},
): WaveScalpAnalysis {
  const {
    takeProfitPct = DEFAULT_WAVE_SCALP_CONFIG.takeProfitPct,
    stopLossPct = DEFAULT_WAVE_SCALP_CONFIG.stopLossPct,
    swingLookback = DEFAULT_WAVE_SCALP_CONFIG.swingLookback,
    nearExtremePct = DEFAULT_WAVE_SCALP_CONFIG.nearExtremePct,
    minVolumeRatio = DEFAULT_WAVE_SCALP_CONFIG.minVolumeRatio,
    minSwingRangePct = DEFAULT_WAVE_SCALP_CONFIG.minSwingRangePct,
    takerFeeBps = DEFAULT_WAVE_SCALP_CONFIG.takerFeeBps,
  } = config;

  const markPrice = candles.at(-1)?.close ?? 0;
  const slice = candles.slice(-swingLookback);
  const lastBar = candles.at(-1);
  const avgVolume =
    slice.reduce((sum, c) => sum + (c.volume ?? 0), 0) / Math.max(slice.length, 1);
  const volumeRatio =
    avgVolume > 0 && lastBar ? (lastBar.volume ?? 0) / avgVolume : 1;
  const volumeOk = volumeRatio >= minVolumeRatio;

  if (slice.length < 8 || markPrice <= 0) {
    return {
      action: "hold",
      reason: "Warming up — need more candles",
      rangeLow: markPrice,
      rangeHigh: markPrice,
      priceInRangePct: 50,
      unrealizedPnlPct: null,
      markPrice,
    };
  }

  const rangeLow = Math.min(...slice.map((c) => c.low));
  const rangeHigh = Math.max(...slice.map((c) => c.high));
  const span = rangeHigh - rangeLow || markPrice * 0.001;
  const priceInRangePct = ((markPrice - rangeLow) / span) * 100;

  const closes = slice.map((c) => c.close);
  const recent = closes.slice(-4);
  const older = closes.slice(-8, -4);
  const recentAvg =
    recent.reduce((a, b) => a + b, 0) / Math.max(recent.length, 1);
  const olderAvg =
    older.reduce((a, b) => a + b, 0) / Math.max(older.length, 1);
  const microMomentum = (recentAvg - olderAvg) / (olderAvg || 1);

  const lowThreshold = nearExtremePct * 100;
  const highThreshold = (1 - nearExtremePct) * 100;
  const rangePct = (span / markPrice) * 100;
  const roundTripFeePct = (2 * takerFeeBps) / 100;
  const minMovePct = roundTripFeePct + takeProfitPct * 0.4;

  const entryRangeOk = () => {
    if (rangePct < minSwingRangePct) {
      return {
        action: "hold" as const,
        reason: `Range too tight (${rangePct.toFixed(2)}% < ${minSwingRangePct}% min) — fees would eat edge`,
        rangeLow,
        rangeHigh,
        priceInRangePct,
        unrealizedPnlPct: null,
        markPrice,
      };
    }
    return null;
  };

  const longRoomOk = () => {
    const roomUpPct = ((rangeHigh - markPrice) / markPrice) * 100;
    if (roomUpPct < minMovePct) {
      return {
        action: "hold" as const,
        reason: `Near low but only ${roomUpPct.toFixed(2)}% room to swing high — need ~${minMovePct.toFixed(1)}% after fees`,
        rangeLow,
        rangeHigh,
        priceInRangePct,
        unrealizedPnlPct: null,
        markPrice,
      };
    }
    return null;
  };

  const shortRoomOk = () => {
    const roomDownPct = ((markPrice - rangeLow) / markPrice) * 100;
    if (roomDownPct < minMovePct) {
      return {
        action: "hold" as const,
        reason: `Near high but only ${roomDownPct.toFixed(2)}% room to swing low — need ~${minMovePct.toFixed(1)}% after fees`,
        rangeLow,
        rangeHigh,
        priceInRangePct,
        unrealizedPnlPct: null,
        markPrice,
      };
    }
    return null;
  };

  let unrealizedPnlPct: number | null = null;
  if (position === "long" && entryPriceUsd) {
    unrealizedPnlPct = ((markPrice - entryPriceUsd) / entryPriceUsd) * 100;
  } else if (position === "short" && entryPriceUsd) {
    unrealizedPnlPct = ((entryPriceUsd - markPrice) / entryPriceUsd) * 100;
  }

  if (position === "long" && entryPriceUsd) {
    if (unrealizedPnlPct != null && unrealizedPnlPct >= takeProfitPct) {
      return {
        action: "close_long",
        reason: `Take profit +${unrealizedPnlPct.toFixed(1)}% (target ${takeProfitPct}%)`,
        rangeLow,
        rangeHigh,
        priceInRangePct,
        unrealizedPnlPct,
        markPrice,
      };
    }
    if (unrealizedPnlPct != null && unrealizedPnlPct <= -stopLossPct) {
      return {
        action: "close_long",
        reason: `Stop loss ${unrealizedPnlPct.toFixed(1)}%`,
        rangeLow,
        rangeHigh,
        priceInRangePct,
        unrealizedPnlPct,
        markPrice,
      };
    }
    if (priceInRangePct >= highThreshold && microMomentum < 0) {
      return {
        action: "close_long",
        reason: "Near swing high + momentum fading — bank the wave",
        rangeLow,
        rangeHigh,
        priceInRangePct,
        unrealizedPnlPct,
        markPrice,
      };
    }
    return {
      action: "hold",
      reason: `In long ${unrealizedPnlPct?.toFixed(1) ?? "0"}% · target +${takeProfitPct}%`,
      rangeLow,
      rangeHigh,
      priceInRangePct,
      unrealizedPnlPct,
      markPrice,
    };
  }

  if (position === "short" && entryPriceUsd) {
    if (unrealizedPnlPct != null && unrealizedPnlPct >= takeProfitPct) {
      return {
        action: "close_short",
        reason: `Cover short +${unrealizedPnlPct.toFixed(1)}%`,
        rangeLow,
        rangeHigh,
        priceInRangePct,
        unrealizedPnlPct,
        markPrice,
      };
    }
    if (unrealizedPnlPct != null && unrealizedPnlPct <= -stopLossPct) {
      return {
        action: "close_short",
        reason: `Stop short ${unrealizedPnlPct.toFixed(1)}%`,
        rangeLow,
        rangeHigh,
        priceInRangePct,
        unrealizedPnlPct,
        markPrice,
      };
    }
    if (priceInRangePct <= lowThreshold && microMomentum > 0) {
      return {
        action: "close_short",
        reason: "Near swing low + bounce — cover short",
        rangeLow,
        rangeHigh,
        priceInRangePct,
        unrealizedPnlPct,
        markPrice,
      };
    }
    return {
      action: "hold",
      reason: `In short ${unrealizedPnlPct?.toFixed(1) ?? "0"}% · waiting to cover`,
      rangeLow,
      rangeHigh,
      priceInRangePct,
      unrealizedPnlPct,
      markPrice,
    };
  }

  if (priceInRangePct <= lowThreshold && microMomentum > 0) {
    if (!volumeOk) {
      return {
        action: "hold",
        reason: `Near low but volume dead (${(volumeRatio * 100).toFixed(0)}% of avg)`,
        rangeLow,
        rangeHigh,
        priceInRangePct,
        unrealizedPnlPct: null,
        markPrice,
      };
    }
    const blocked = entryRangeOk() ?? longRoomOk();
    if (blocked) return blocked;
    return {
      action: "open_long",
      reason: `Perp long near swing low · ${rangePct.toFixed(1)}% range · target +${takeProfitPct}% · vol ${(volumeRatio * 100).toFixed(0)}% avg`,
      rangeLow,
      rangeHigh,
      priceInRangePct,
      unrealizedPnlPct: null,
      markPrice,
    };
  }

  if (priceInRangePct >= highThreshold && microMomentum < -0.0002) {
    if (!volumeOk) {
      return {
        action: "hold",
        reason: `Near high but volume dead (${(volumeRatio * 100).toFixed(0)}% of avg)`,
        rangeLow,
        rangeHigh,
        priceInRangePct,
        unrealizedPnlPct: null,
        markPrice,
      };
    }
    const blocked = entryRangeOk() ?? shortRoomOk();
    if (blocked) return blocked;
    return {
      action: "open_short",
      reason: `Perp short near swing high · ${rangePct.toFixed(1)}% range · target +${takeProfitPct}% · vol ${(volumeRatio * 100).toFixed(0)}% avg`,
      rangeLow,
      rangeHigh,
      priceInRangePct,
      unrealizedPnlPct: null,
      markPrice,
    };
  }

  return {
    action: "hold",
    reason: `Flat · ${priceInRangePct.toFixed(0)}% of ${swingLookback}-bar range · waiting for swing`,
    rangeLow,
    rangeHigh,
    priceInRangePct,
    unrealizedPnlPct: null,
    markPrice,
  };
}
