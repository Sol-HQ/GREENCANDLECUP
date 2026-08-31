import type { PaperPerpSizing } from "./paper-perps.js";
import { computePaperPerpSizing } from "./paper-perps.js";

export { PAPER_MARGIN_FRACTION, computePaperPerpSizing, formatPaperTradeReceipt } from "./paper-perps.js";
export type { PaperPerpSizing } from "./paper-perps.js";

function newTradeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `paper-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type PaperPositionSide = "flat" | "long" | "short";

export type PaperTradeAction =
  | "open_long"
  | "close_long"
  | "open_short"
  | "close_short";

export type PaperTradeRecord = {
  id: string;
  symbol: string;
  action: PaperTradeAction;
  priceUsd: number;
  sizeBase: number;
  notionalUsd: number;
  pnlUsd: number | null;
  balanceUsdc: number;
  reason: string;
  at: string;
  barTime: number;
};

export type PaperPortfolioState = {
  startingBalanceUsdc: number;
  balanceUsdc: number;
  equityUsdc: number;
  minBalanceUsdc: number;
  alive: boolean;
  positionSide: PaperPositionSide;
  positionSizeBase: number;
  entryPriceUsd: number | null;
  leverage: number;
  unrealizedPnlUsd: number;
  tradeCount: number;
  updatedAt: string;
} & PaperPerpSizing;

export type PaperPortfolioConfig = {
  startingBalanceUsdc: number;
  leverage: number;
  marginFraction: number;
  /** Taker fee in bps — deducted on each open/close (round trip ≈ 2×). */
  takerFeeBps: number;
};

const DEFAULT_CONFIG: PaperPortfolioConfig = {
  startingBalanceUsdc: 100,
  leverage: 2,
  marginFraction: 0.5,
  takerFeeBps: 5,
};

export class PaperPortfolio {
  private trades: PaperTradeRecord[] = [];
  private balanceUsdc: number;
  private positionSide: PaperPositionSide = "flat";
  private positionSizeBase = 0;
  private entryPriceUsd: number | null = null;

  constructor(private readonly config: PaperPortfolioConfig = DEFAULT_CONFIG) {
    this.balanceUsdc = config.startingBalanceUsdc;
  }

  reset(config?: Partial<PaperPortfolioConfig>) {
    if (config) Object.assign(this.config, config);
    this.balanceUsdc = this.config.startingBalanceUsdc;
    this.positionSide = "flat";
    this.positionSizeBase = 0;
    this.entryPriceUsd = null;
    this.trades = [];
  }

  exportSnapshot(): {
    startingBalanceUsdc: number;
    balanceUsdc: number;
    positionSide: PaperPositionSide;
    positionSizeBase: number;
    entryPriceUsd: number | null;
    leverage: number;
    trades: PaperTradeRecord[];
  } {
    return {
      startingBalanceUsdc: this.config.startingBalanceUsdc,
      balanceUsdc: this.balanceUsdc,
      positionSide: this.positionSide,
      positionSizeBase: this.positionSizeBase,
      entryPriceUsd: this.entryPriceUsd,
      leverage: this.config.leverage,
      trades: [...this.trades],
    };
  }

  importSnapshot(snapshot: {
    startingBalanceUsdc?: number;
    balanceUsdc: number;
    positionSide: PaperPositionSide;
    positionSizeBase: number;
    entryPriceUsd: number | null;
    leverage?: number;
    trades?: PaperTradeRecord[];
  }) {
    if (snapshot.startingBalanceUsdc != null) {
      this.config.startingBalanceUsdc = snapshot.startingBalanceUsdc;
    }
    if (snapshot.leverage != null) {
      this.config.leverage = snapshot.leverage;
    }
    this.balanceUsdc = snapshot.balanceUsdc;
    this.positionSide = snapshot.positionSide;
    this.positionSizeBase = snapshot.positionSizeBase;
    this.entryPriceUsd = snapshot.entryPriceUsd;
    if (snapshot.trades) this.trades = [...snapshot.trades];
  }

  getPositionSide(): PaperPositionSide {
    return this.positionSide;
  }

  getEntryPrice(): number | null {
    return this.entryPriceUsd;
  }

  getTrades(): PaperTradeRecord[] {
    return [...this.trades];
  }

  /** Restore trade log for charts / history (does not replay positions). */
  loadTradeHistory(trades: PaperTradeRecord[]) {
    this.trades = [...trades];
  }

  getState(
    markPriceUsd: number | null,
    minBalanceUsdc = 0,
  ): PaperPortfolioState {
    let unrealized = 0;
    if (
      this.positionSide !== "flat" &&
      this.entryPriceUsd != null &&
      markPriceUsd != null &&
      this.positionSizeBase > 0
    ) {
      const diff =
        this.positionSide === "long"
          ? markPriceUsd - this.entryPriceUsd
          : this.entryPriceUsd - markPriceUsd;
      unrealized = diff * this.positionSizeBase;
    }
    const equityUsdc = this.balanceUsdc + unrealized;
    const core = {
      startingBalanceUsdc: this.config.startingBalanceUsdc,
      balanceUsdc: this.balanceUsdc,
      equityUsdc,
      minBalanceUsdc,
      alive: equityUsdc > minBalanceUsdc,
      positionSide: this.positionSide,
      positionSizeBase: this.positionSizeBase,
      entryPriceUsd: this.entryPriceUsd,
      leverage: this.config.leverage,
      unrealizedPnlUsd: unrealized,
      tradeCount: this.trades.length,
      updatedAt: new Date().toISOString(),
    };
    return {
      ...core,
      ...computePaperPerpSizing({
        balanceUsdc: this.balanceUsdc,
        leverage: this.config.leverage,
        marginFraction: this.config.marginFraction,
        positionSide: this.positionSide,
        positionSizeBase: this.positionSizeBase,
        entryPriceUsd: this.entryPriceUsd,
        markPriceUsd: markPriceUsd,
        unrealizedPnlUsd: unrealized,
      }),
    };
  }

  computeSizeBase(priceUsd: number, riskScale = 1): number {
    if (this.balanceUsdc <= 0) return 0;
    const scale = Math.max(0, Math.min(1, riskScale));
    const margin = this.balanceUsdc * this.config.marginFraction * scale;
    const notional = margin * this.config.leverage;
    if (priceUsd <= 0 || notional <= 0) return 0;
    return notional / priceUsd;
  }

  canOpen(priceUsd: number, minBalanceUsdc: number): boolean {
    if (this.positionSide !== "flat") return false;
    if (this.balanceUsdc <= minBalanceUsdc) return false;
    return this.computeSizeBase(priceUsd) > 0;
  }

  openLong(params: {
    symbol: string;
    priceUsd: number;
    reason: string;
    barTime: number;
    sizeBase?: number;
  }): PaperTradeRecord | null {
    if (this.positionSide !== "flat") return null;
    const sizeBase = params.sizeBase ?? this.computeSizeBase(params.priceUsd);
    if (sizeBase <= 0) return null;
    this.positionSide = "long";
    this.positionSizeBase = sizeBase;
    this.entryPriceUsd = params.priceUsd;
    return this.record({
      symbol: params.symbol,
      action: "open_long",
      priceUsd: params.priceUsd,
      sizeBase,
      pnlUsd: null,
      reason: params.reason,
      barTime: params.barTime,
    });
  }

  closeLong(params: {
    symbol: string;
    priceUsd: number;
    reason: string;
    barTime: number;
  }): PaperTradeRecord | null {
    if (this.positionSide !== "long" || this.entryPriceUsd == null) return null;
    const pnl =
      (params.priceUsd - this.entryPriceUsd) * this.positionSizeBase;
    this.balanceUsdc += pnl;
    const sizeBase = this.positionSizeBase;
    this.positionSide = "flat";
    this.positionSizeBase = 0;
    this.entryPriceUsd = null;
    return this.record({
      symbol: params.symbol,
      action: "close_long",
      priceUsd: params.priceUsd,
      sizeBase,
      pnlUsd: pnl,
      reason: params.reason,
      barTime: params.barTime,
    });
  }

  openShort(params: {
    symbol: string;
    priceUsd: number;
    reason: string;
    barTime: number;
    sizeBase?: number;
  }): PaperTradeRecord | null {
    if (this.positionSide !== "flat") return null;
    const sizeBase = params.sizeBase ?? this.computeSizeBase(params.priceUsd);
    if (sizeBase <= 0) return null;
    this.positionSide = "short";
    this.positionSizeBase = sizeBase;
    this.entryPriceUsd = params.priceUsd;
    return this.record({
      symbol: params.symbol,
      action: "open_short",
      priceUsd: params.priceUsd,
      sizeBase,
      pnlUsd: null,
      reason: params.reason,
      barTime: params.barTime,
    });
  }

  closeShort(params: {
    symbol: string;
    priceUsd: number;
    reason: string;
    barTime: number;
  }): PaperTradeRecord | null {
    if (this.positionSide !== "short" || this.entryPriceUsd == null) return null;
    const pnl =
      (this.entryPriceUsd - params.priceUsd) * this.positionSizeBase;
    this.balanceUsdc += pnl;
    const sizeBase = this.positionSizeBase;
    this.positionSide = "flat";
    this.positionSizeBase = 0;
    this.entryPriceUsd = null;
    return this.record({
      symbol: params.symbol,
      action: "close_short",
      priceUsd: params.priceUsd,
      sizeBase,
      pnlUsd: pnl,
      reason: params.reason,
      barTime: params.barTime,
    });
  }

  private record(
    partial: Omit<PaperTradeRecord, "id" | "at" | "notionalUsd" | "balanceUsdc">,
  ): PaperTradeRecord {
    const notionalUsd = partial.priceUsd * partial.sizeBase;
    const feeUsd = notionalUsd * (this.config.takerFeeBps / 10_000);
    this.balanceUsdc -= feeUsd;
    const trade: PaperTradeRecord = {
      id: newTradeId(),
      at: new Date().toISOString(),
      notionalUsd,
      balanceUsdc: this.balanceUsdc,
      ...partial,
    };
    this.trades.push(trade);
    return trade;
  }
}
