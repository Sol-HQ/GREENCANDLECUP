import type { Candle } from "./index.js";
import { detectTrend, ema } from "./index.js";
import {
  detectMarketRegime,
  type MarketRegime,
  type RegimeAnalysis,
} from "./regime.js";

export type IntelProfile = "conservative" | "balanced" | "aggressive";

export type TimeframeAlignment = "aligned" | "mixed" | "conflict";

export type ConfidenceFactor = {
  name: string;
  score: number;
  max: number;
  detail: string;
};

export type FusedRegime = {
  regime: MarketRegime;
  reason: string;
  micro: RegimeAnalysis;
  macro: RegimeAnalysis;
  alignment: TimeframeAlignment;
  trendEfficiency: number;
  netMovePct: number;
  rangePct: number;
  volatilityRatio: number;
  trend: "up" | "down" | "flat";
};

const ENTRY_THRESHOLDS: Record<IntelProfile, number> = {
  conservative: 68,
  balanced: 52,
  aggressive: 38,
};

const REGIME_DIRECTION: Partial<Record<MarketRegime, "bull" | "bear" | "neutral">> =
  {
    trend_up: "bull",
    trend_down: "bear",
    range_chop: "neutral",
    volatile: "neutral",
    warming: "neutral",
  };

function regimeDirection(r: MarketRegime): "bull" | "bear" | "neutral" {
  return REGIME_DIRECTION[r] ?? "neutral";
}

function alignRegimes(
  micro: RegimeAnalysis,
  macro: RegimeAnalysis,
): TimeframeAlignment {
  const m = regimeDirection(micro.regime);
  const M = regimeDirection(macro.regime);
  if (m === "neutral" || M === "neutral") return "mixed";
  if (m === M) return "aligned";
  return "conflict";
}

/** Blend 1m timing with 5m structure — macro wins on trends, micro wins on chop. */
export function fuseRegimes(
  microCandles: Candle[],
  macroCandles: Candle[],
): FusedRegime {
  const micro = detectMarketRegime(microCandles);
  const macro =
    macroCandles.length >= 20
      ? detectMarketRegime(macroCandles)
      : ({ ...micro, reason: "5m warming — using 1m only" } as RegimeAnalysis);

  const alignment = alignRegimes(micro, macro);

  let regime: MarketRegime = micro.regime;
  let reason = micro.reason;

  if (macro.regime === "trend_up" || macro.regime === "trend_down") {
    regime = macro.regime;
    reason =
      alignment === "aligned"
        ? `${macro.reason} · 1m confirms`
        : `${macro.reason} · 1m ${micro.regime.replace(/_/g, " ")} (riding macro)`;
  } else if (macro.regime === "volatile" || micro.regime === "volatile") {
    regime = "volatile";
    reason = `Volatile · 5m ${macro.rangePct.toFixed(1)}% box · 1m vol ${micro.volatilityRatio.toFixed(1)}×`;
  } else if (micro.regime === "trend_up" || micro.regime === "trend_down") {
    regime = micro.regime;
    reason = `${micro.reason} · 5m still ranging`;
  } else {
    regime = "range_chop";
    reason = `Choppy · 5m ${macro.rangePct.toFixed(1)}% · 1m ${micro.rangePct.toFixed(1)}%`;
  }

  return {
    regime,
    reason,
    micro,
    macro,
    alignment,
    trendEfficiency: Math.max(micro.trendEfficiency, macro.trendEfficiency),
    netMovePct: macro.netMovePct,
    rangePct: micro.rangePct,
    volatilityRatio: Math.max(micro.volatilityRatio, macro.volatilityRatio),
    trend: macro.trend !== "flat" ? macro.trend : micro.trend,
  };
}

function structureScore(candles: Candle[]): { score: number; detail: string } {
  const closes = candles.map((c) => c.close);
  const mark = closes.at(-1) ?? 0;
  if (closes.length < 50 || mark <= 0) {
    return { score: 5, detail: "Structure warming" };
  }
  const e20 = ema(closes, 20).at(-1)!;
  const e50 = ema(closes, 50).at(-1)!;
  const stackUp = mark > e20 && e20 > e50;
  const stackDown = mark < e20 && e20 < e50;
  if (stackUp) return { score: 15, detail: "EMA stack bullish (9/20/50)" };
  if (stackDown) return { score: 15, detail: "EMA stack bearish" };
  return { score: 6, detail: "EMAs tangled — no clean stack" };
}

function momentumScore(candles: Candle[]): { score: number; detail: string } {
  const closes = candles.map((c) => c.close);
  if (closes.length < 12) return { score: 5, detail: "Momentum warming" };
  const recent = closes.slice(-4);
  const older = closes.slice(-8, -4);
  const r = recent.reduce((a, b) => a + b, 0) / recent.length;
  const o = older.reduce((a, b) => a + b, 0) / older.length;
  const delta = ((r - o) / (o || 1)) * 100;
  const abs = Math.abs(delta);
  if (abs >= 0.15) {
    return {
      score: 15,
      detail: `Micro momentum ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}% (4 vs 4 bars)`,
    };
  }
  if (abs >= 0.06) {
    return {
      score: 10,
      detail: `Light momentum ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}%`,
    };
  }
  return { score: 4, detail: "Flat micro momentum" };
}

function macroTrendScore(fused: FusedRegime): { score: number; detail: string } {
  const eff = fused.macro.trendEfficiency;
  const move = Math.abs(fused.macro.netMovePct);
  if (fused.macro.regime === "trend_up" || fused.macro.regime === "trend_down") {
    const pts = Math.min(25, eff * 40 + move * 2);
    return {
      score: pts,
      detail: `5m ${fused.macro.regime.replace(/_/g, " ")} · ${move.toFixed(1)}% move · ${(eff * 100).toFixed(0)}% efficient`,
    };
  }
  if (fused.macro.regime === "volatile") {
    return { score: 14, detail: `5m volatile · ${fused.macro.rangePct.toFixed(1)}% range` };
  }
  return {
    score: Math.min(12, fused.macro.rangePct * 4),
    detail: `5m ranging · ${fused.macro.rangePct.toFixed(1)}% box`,
  };
}

function alignmentScore(alignment: TimeframeAlignment): {
  score: number;
  detail: string;
} {
  switch (alignment) {
    case "aligned":
      return { score: 25, detail: "1m + 5m aligned — high conviction" };
    case "mixed":
      return { score: 12, detail: "Mixed timeframes — moderate conviction" };
    case "conflict":
      return { score: 0, detail: "1m vs 5m conflict — stand aside" };
  }
}

function setupScore(
  action: string,
  fused: FusedRegime,
  candles: Candle[],
): { score: number; detail: string } {
  if (!action.startsWith("open_")) {
    return { score: 15, detail: "Managing open position" };
  }
  const closes = candles.map((c) => c.close);
  const mark = closes.at(-1) ?? 0;
  const e9 = ema(closes, 9).at(-1) ?? mark;

  if (action === "open_long") {
    const pullback = mark <= e9 * 1.003;
    const breakout = mark >= Math.max(...closes.slice(-10)) * 0.999;
    if (pullback) return { score: 15, detail: "Long setup · pullback to EMA9" };
    if (breakout) return { score: 13, detail: "Long setup · breaking highs" };
    if (fused.regime === "trend_up")
      return { score: 10, detail: "Long setup · trend continuation" };
    return { score: 6, detail: "Long setup · marginal entry zone" };
  }
  if (action === "open_short") {
    const rally = mark >= e9 * 0.997;
    const breakdown = mark <= Math.min(...closes.slice(-10)) * 1.001;
    if (rally) return { score: 15, detail: "Short setup · rally to EMA9" };
    if (breakdown) return { score: 13, detail: "Short setup · breaking lows" };
    if (fused.regime === "trend_down")
      return { score: 10, detail: "Short setup · trend continuation" };
    return { score: 6, detail: "Short setup · marginal entry zone" };
  }
  return { score: 8, detail: "Setup unclassified" };
}

export type BrainAssessment = {
  confidence: number;
  entryThreshold: number;
  factors: ConfidenceFactor[];
  narrative: string;
  fused: FusedRegime;
  shouldEnter: boolean;
};

/** Score conviction 0–100 and decide if an entry clears the bar. */
export function assessConfidence(
  fused: FusedRegime,
  candles: Candle[],
  proposedAction: string,
  intelProfile: IntelProfile = "balanced",
): BrainAssessment {
  const entryThreshold = ENTRY_THRESHOLDS[intelProfile];

  const macro = macroTrendScore(fused);
  const align = alignmentScore(fused.alignment);
  const structure = structureScore(candles);
  const momentum = momentumScore(candles);
  const setup = setupScore(proposedAction, fused, candles);

  const factors: ConfidenceFactor[] = [
    { name: "5m trend", ...macro, max: 25 },
    { name: "TF alignment", ...align, max: 25 },
    { name: "EMA structure", ...structure, max: 15 },
    { name: "1m momentum", ...momentum, max: 15 },
    { name: "Entry setup", ...setup, max: 15 },
  ];

  const raw = factors.reduce((s, f) => s + f.score, 0);
  const confidence = Math.round(Math.min(100, raw));

  const isOpen =
    proposedAction === "open_long" || proposedAction === "open_short";
  const shouldEnter = !isOpen || confidence >= entryThreshold;

  let narrative: string;
  if (!isOpen) {
    narrative = fused.reason;
  } else if (shouldEnter) {
    narrative = `Conviction ${confidence}/${entryThreshold} (${intelProfile}) — ${fused.regime.replace(/_/g, " ")} · ${setup.detail}`;
  } else {
    narrative = `Waiting — conviction ${confidence}/${entryThreshold} (${intelProfile}). ${align.detail}. ${setup.detail}`;
  }

  return {
    confidence,
    entryThreshold,
    factors,
    narrative,
    fused,
    shouldEnter,
  };
}

export function entryThresholdFor(profile: IntelProfile): number {
  return ENTRY_THRESHOLDS[profile];
}

export { ENTRY_THRESHOLDS };
