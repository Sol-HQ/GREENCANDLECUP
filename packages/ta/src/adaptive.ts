import type { Candle } from "./index.js";
import {
  assessConfidence,
  fuseRegimes,
  type ConfidenceFactor,
  type FusedRegime,
  type IntelProfile,
  type TimeframeAlignment,
} from "./market-brain.js";
import {
  detectMarketRegime,
  type MarketRegime,
  type RegimeAnalysis,
} from "./regime.js";
import { analyzeTrendRide } from "./trend-ride.js";
import {
  analyzeWaveScalp,
  type WaveScalpAction,
  type WaveScalpConfig,
} from "./wave-scalp.js";

export type AdaptiveMode =
  | "warming"
  | "trend_ride"
  | "wave_scalp"
  | "momentum_scalp";

export type AdaptiveAnalysis = {
  action: WaveScalpAction;
  reason: string;
  regime: MarketRegime;
  activeMode: AdaptiveMode;
  regimeReason: string;
  markPrice: number;
  rangeLow?: number;
  rangeHigh?: number;
  priceInRangePct?: number;
  unrealizedPnlPct?: number | null;
  trendEfficiency?: number;
  netMovePct?: number;
  /** 0–100 conviction score. */
  confidence?: number;
  entryThreshold?: number;
  intelProfile?: IntelProfile;
  factors?: ConfidenceFactor[];
  narrative?: string;
  macroRegime?: MarketRegime;
  alignment?: TimeframeAlignment;
};

export type AdaptiveConfig = {
  trendTakeProfitPct?: number;
  trendStopLossPct?: number;
  scalpTakeProfitPct?: number;
  scalpStopLossPct?: number;
  spikeTakeProfitPct?: number;
  spikeStopLossPct?: number;
  takerFeeBps?: number;
  intelProfile?: IntelProfile;
};

const DEFAULT_ADAPTIVE: Required<Omit<AdaptiveConfig, "intelProfile">> & {
  intelProfile: IntelProfile;
} = {
  trendTakeProfitPct: 2.5,
  trendStopLossPct: 1.5,
  scalpTakeProfitPct: 1.2,
  scalpStopLossPct: 0.9,
  spikeTakeProfitPct: 1,
  spikeStopLossPct: 0.75,
  takerFeeBps: 5,
  intelProfile: "balanced",
};

function analyzeMomentumScalp(
  candles: Candle[],
  position: "flat" | "long" | "short",
  entryPriceUsd: number | null,
  config: typeof DEFAULT_ADAPTIVE,
): Pick<
  AdaptiveAnalysis,
  "action" | "reason" | "markPrice" | "unrealizedPnlPct"
> {
  const markPrice = candles.at(-1)?.close ?? 0;
  const closes = candles.map((c) => c.close);
  const recent = closes.slice(-3);
  const older = closes.slice(-6, -3);
  const recentAvg =
    recent.reduce((a, b) => a + b, 0) / Math.max(recent.length, 1);
  const olderAvg =
    older.reduce((a, b) => a + b, 0) / Math.max(older.length, 1);
  const impulse = (recentAvg - olderAvg) / (olderAvg || 1);

  let unrealizedPnlPct: number | null = null;
  if (position === "long" && entryPriceUsd) {
    unrealizedPnlPct = ((markPrice - entryPriceUsd) / entryPriceUsd) * 100;
  } else if (position === "short" && entryPriceUsd) {
    unrealizedPnlPct = ((entryPriceUsd - markPrice) / entryPriceUsd) * 100;
  }

  const { spikeTakeProfitPct: tp, spikeStopLossPct: sl } = config;

  if (position === "long") {
    if (unrealizedPnlPct != null && unrealizedPnlPct >= tp) {
      return {
        action: "close_long",
        reason: `Spike scalp profit +${unrealizedPnlPct.toFixed(1)}%`,
        markPrice,
        unrealizedPnlPct,
      };
    }
    if (unrealizedPnlPct != null && unrealizedPnlPct <= -sl) {
      return {
        action: "close_long",
        reason: `Spike scalp stop ${unrealizedPnlPct.toFixed(1)}%`,
        markPrice,
        unrealizedPnlPct,
      };
    }
    if (impulse < -0.0003) {
      return {
        action: "close_long",
        reason: "Spike faded — exit long",
        markPrice,
        unrealizedPnlPct,
      };
    }
    return {
      action: "hold",
      reason: `Spike long ${unrealizedPnlPct?.toFixed(1) ?? "0"}% · quick target +${tp}%`,
      markPrice,
      unrealizedPnlPct,
    };
  }

  if (position === "short") {
    if (unrealizedPnlPct != null && unrealizedPnlPct >= tp) {
      return {
        action: "close_short",
        reason: `Spike scalp cover +${unrealizedPnlPct.toFixed(1)}%`,
        markPrice,
        unrealizedPnlPct,
      };
    }
    if (unrealizedPnlPct != null && unrealizedPnlPct <= -sl) {
      return {
        action: "close_short",
        reason: `Spike scalp stop ${unrealizedPnlPct.toFixed(1)}%`,
        markPrice,
        unrealizedPnlPct,
      };
    }
    if (impulse > 0.0003) {
      return {
        action: "close_short",
        reason: "Spike bounced — cover short",
        markPrice,
        unrealizedPnlPct,
      };
    }
    return {
      action: "hold",
      reason: `Spike short ${unrealizedPnlPct?.toFixed(1) ?? "0"}% · quick target +${tp}%`,
      markPrice,
      unrealizedPnlPct,
    };
  }

  if (impulse > 0.00035) {
    return {
      action: "open_long",
      reason: "Spike long · 3-bar momentum up",
      markPrice,
      unrealizedPnlPct: null,
    };
  }
  if (impulse < -0.00035) {
    return {
      action: "open_short",
      reason: "Spike short · 3-bar momentum down",
      markPrice,
      unrealizedPnlPct: null,
    };
  }

  return {
    action: "hold",
    reason: "Spike mode · waiting for burst direction",
    markPrice,
    unrealizedPnlPct: null,
  };
}

function pickMode(fused: FusedRegime, position: "flat" | "long" | "short"): AdaptiveMode {
  if (fused.regime === "warming") return "warming";
  if (position !== "flat") {
    if (position === "long" && fused.regime === "trend_up") return "trend_ride";
    if (position === "short" && fused.regime === "trend_down") return "trend_ride";
    if (fused.regime === "volatile") return "momentum_scalp";
    return "wave_scalp";
  }
  switch (fused.regime) {
    case "trend_up":
    case "trend_down":
      return "trend_ride";
    case "volatile":
      return "momentum_scalp";
    case "range_chop":
    default:
      return "wave_scalp";
  }
}

/** At range extremes, pick long breakout or short fade instead of waiting forever. */
function tryExtremeRangeEntry(
  candles: Candle[],
  position: "flat" | "long" | "short",
  priceInRangePct: number,
  rangePct: number,
): { action: WaveScalpAction; reason: string } | null {
  if (position !== "flat" || rangePct < 0.25) return null;

  const closes = candles.map((c) => c.close);
  const recent = closes.slice(-4);
  const older = closes.slice(-8, -4);
  const recentAvg =
    recent.reduce((a, b) => a + b, 0) / Math.max(recent.length, 1);
  const olderAvg =
    older.reduce((a, b) => a + b, 0) / Math.max(older.length, 1);
  const impulse = (recentAvg - olderAvg) / (olderAvg || 1);

  if (priceInRangePct >= 88) {
    if (impulse > 0.00005) {
      return {
        action: "open_long",
        reason: `Range top ${priceInRangePct.toFixed(0)}% · momentum up → breakout long`,
      };
    }
    return {
      action: "open_short",
      reason: `Range top ${priceInRangePct.toFixed(0)}% · fading → perp short`,
    };
  }

  if (priceInRangePct <= 12) {
    if (impulse < -0.00005) {
      return {
        action: "open_short",
        reason: `Range bottom ${priceInRangePct.toFixed(0)}% · momentum down → breakdown short`,
      };
    }
    return {
      action: "open_long",
      reason: `Range bottom ${priceInRangePct.toFixed(0)}% · bounce → perp long`,
    };
  }

  return null;
}

function waveConfigForAdaptive(
  cfg: typeof DEFAULT_ADAPTIVE,
  profile: IntelProfile,
): WaveScalpConfig {
  const aggressive = profile === "aggressive";
  return {
    takeProfitPct: cfg.scalpTakeProfitPct,
    stopLossPct: cfg.scalpStopLossPct,
    swingLookback: 20,
    nearExtremePct: aggressive ? 0.4 : 0.35,
    minVolumeRatio: aggressive ? 0.08 : profile === "conservative" ? 0.2 : 0.12,
    minSwingRangePct: aggressive ? 0.28 : profile === "conservative" ? 0.45 : 0.35,
    takerFeeBps: cfg.takerFeeBps,
  };
}

function applyConfidenceGate(
  base: AdaptiveAnalysis,
  candles: Candle[],
  fused: FusedRegime,
  profile: IntelProfile,
): AdaptiveAnalysis {
  const assessment = assessConfidence(
    fused,
    candles,
    base.action,
    profile,
  );

  const isOpen =
    base.action === "open_long" || base.action === "open_short";
  let action = base.action;
  let reason = base.reason;

  if (isOpen && !assessment.shouldEnter) {
    action = "hold";
    reason = `[Wait ${assessment.confidence}/${assessment.entryThreshold}] ${assessment.narrative}`;
  } else if (isOpen) {
    reason = `[${assessment.confidence}%] ${base.reason}`;
  }

  return {
    ...base,
    action,
    reason,
    confidence: assessment.confidence,
    entryThreshold: assessment.entryThreshold,
    intelProfile: profile,
    factors: assessment.factors,
    narrative: assessment.narrative,
    macroRegime: fused.macro.regime,
    alignment: fused.alignment,
  };
}

/** Multi-TF chart brain — fuse 1m + 5m, score confidence, pick mode, gate entries. */
export function analyzeAdaptive(
  candles: Candle[],
  position: "flat" | "long" | "short",
  entryPriceUsd: number | null,
  config: AdaptiveConfig = {},
  structureCandles: Candle[] = [],
): AdaptiveAnalysis {
  const cfg = {
    ...DEFAULT_ADAPTIVE,
    ...config,
    intelProfile: config.intelProfile ?? DEFAULT_ADAPTIVE.intelProfile,
  };
  const fused = fuseRegimes(candles, structureCandles);
  const activeMode = pickMode(fused, position);
  const markPrice = candles.at(-1)?.close ?? 0;

  const base: AdaptiveAnalysis = {
    action: "hold",
    reason: fused.reason,
    regime: fused.regime,
    activeMode,
    regimeReason: fused.reason,
    markPrice,
    trendEfficiency: fused.trendEfficiency,
    netMovePct: fused.netMovePct,
    macroRegime: fused.macro.regime,
    alignment: fused.alignment,
    intelProfile: cfg.intelProfile,
  };

  if (activeMode === "warming") {
    return applyConfidenceGate(
      { ...base, reason: fused.reason },
      candles,
      fused,
      cfg.intelProfile,
    );
  }

  let raw: AdaptiveAnalysis;

  if (activeMode === "trend_ride") {
    const side = fused.regime === "trend_down" ? "down" : "up";
    const ride = analyzeTrendRide(candles, position, entryPriceUsd, side, {
      takeProfitPct: cfg.trendTakeProfitPct,
      stopLossPct: cfg.trendStopLossPct,
    });
    raw = {
      ...base,
      action: ride.action,
      reason: `[Trend] ${ride.reason}`,
      unrealizedPnlPct: ride.unrealizedPnlPct,
    };
  } else if (activeMode === "momentum_scalp") {
    const spike = analyzeMomentumScalp(candles, position, entryPriceUsd, cfg);
    raw = {
      ...base,
      action: spike.action,
      reason: `[Spike] ${spike.reason}`,
      unrealizedPnlPct: spike.unrealizedPnlPct,
    };
  } else {
  const wave = analyzeWaveScalp(
    candles,
    position,
    entryPriceUsd,
    waveConfigForAdaptive(cfg, cfg.intelProfile),
  );
  let scalpAction = wave.action;
  let scalpReason = wave.reason;
  if (wave.action === "hold" && position === "flat") {
    const span = wave.rangeHigh - wave.rangeLow || wave.markPrice * 0.001;
    const rangePct = (span / wave.markPrice) * 100;
    const extreme = tryExtremeRangeEntry(
      candles,
      position,
      wave.priceInRangePct,
      rangePct,
    );
    if (extreme) {
      scalpAction = extreme.action;
      scalpReason = extreme.reason;
    }
  }
  raw = {
    ...base,
    action: scalpAction,
    reason: `[Scalp] ${scalpReason}`,
    rangeLow: wave.rangeLow,
    rangeHigh: wave.rangeHigh,
    priceInRangePct: wave.priceInRangePct,
    unrealizedPnlPct: wave.unrealizedPnlPct,
  };
  }

  const isClose =
    raw.action === "close_long" || raw.action === "close_short";
  if (isClose) {
    const assessment = assessConfidence(fused, candles, raw.action, cfg.intelProfile);
    return {
      ...raw,
      confidence: assessment.confidence,
      entryThreshold: assessment.entryThreshold,
      factors: assessment.factors,
      narrative: raw.reason,
    };
  }

  return applyConfidenceGate(raw, candles, fused, cfg.intelProfile);
}

export { detectMarketRegime, type RegimeAnalysis, type MarketRegime };
export {
  fuseRegimes,
  assessConfidence,
  type IntelProfile,
  type ConfidenceFactor,
  type FusedRegime,
  type BrainAssessment,
  entryThresholdFor,
} from "./market-brain.js";
