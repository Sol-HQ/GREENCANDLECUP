import type { RiskLimits } from "@gcc/shared";

export type RiskCheckInput = {
  orderNotionalUsd: number;
  currentPositionNotionalUsd: number;
  dailyRealizedPnlUsd: number;
  leverage: number;
  collateralUsd: number;
};

export type RiskCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export class RiskGate {
  private dailyRealizedPnlUsd = 0;

  constructor(private limits: RiskLimits) {}

  setLimits(limits: RiskLimits) {
    this.limits = limits;
  }

  getLimits(): RiskLimits {
    return this.limits;
  }

  recordRealizedPnl(deltaUsd: number) {
    this.dailyRealizedPnlUsd += deltaUsd;
  }

  resetDaily() {
    this.dailyRealizedPnlUsd = 0;
  }

  check(input: RiskCheckInput): RiskCheckResult {
    if (input.orderNotionalUsd > this.limits.maxOrderNotionalUsd) {
      return {
        allowed: false,
        reason: `Order notional $${input.orderNotionalUsd.toFixed(2)} exceeds max $${this.limits.maxOrderNotionalUsd}`,
      };
    }

    const projectedPosition =
      input.currentPositionNotionalUsd + input.orderNotionalUsd;
    if (projectedPosition > this.limits.maxPositionNotionalUsd) {
      return {
        allowed: false,
        reason: `Projected position $${projectedPosition.toFixed(2)} exceeds max $${this.limits.maxPositionNotionalUsd}`,
      };
    }

    if (this.dailyRealizedPnlUsd <= -this.limits.maxDailyLossUsd) {
      return {
        allowed: false,
        reason: `Daily loss limit reached ($${Math.abs(this.dailyRealizedPnlUsd).toFixed(2)})`,
      };
    }

    if (input.leverage > this.limits.maxLeverage) {
      return {
        allowed: false,
        reason: `Leverage ${input.leverage.toFixed(2)}x exceeds max ${this.limits.maxLeverage}x`,
      };
    }

    if (input.collateralUsd < this.limits.minCollateralBufferUsd) {
      return {
        allowed: false,
        reason: `Collateral $${input.collateralUsd.toFixed(2)} below buffer $${this.limits.minCollateralBufferUsd}`,
      };
    }

    return { allowed: true };
  }
}

export function estimateNotionalUsd(
  sizeBase: number,
  priceUsd: number,
): number {
  return Math.abs(sizeBase * priceUsd);
}
