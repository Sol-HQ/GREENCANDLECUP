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

/** Backfill symbol for snapshots saved before positionSymbol existed. */
export function inferPositionSymbolFromTrades(
  trades: PaperTradeRecord[],
  positionSide: PaperPositionSide,
): string | null {
  if (positionSide === "flat") return null;
  for (let i = trades.length - 1; i >= 0; i--) {
    const t = trades[i];
    if (t.action === "open_long" || t.action === "open_short") {
      return t.symbol;
    }
  }
  return null;
}

/** Backfill manual vs bot for snapshots saved before positionSource existed. */
export function inferPositionSourceFromTrades(
  trades: PaperTradeRecord[],
  positionSide: PaperPositionSide,
): PaperTradeSource | null {
  if (positionSide === "flat") return null;
  for (let i = trades.length - 1; i >= 0; i--) {
    const t = trades[i];
    if (t.action === "open_long" || t.action === "open_short") {
      if (t.source) return t.source;
      if (/^manual/i.test(t.reason)) return "manual";
      return "bot";
    }
  }
  return null;
}

export type PaperPositionSide = "flat" | "long" | "short";

export type PaperTradeAction =
  | "open_long"
  | "close_long"
  | "open_short"
  | "close_short";

export type PaperTradeSource = "manual" | "bot";

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
  /** Who opened this leg — manual panel vs bot engine. */
  source?: PaperTradeSource;
  leverage?: number;
};

export type PaperPortfolioState = {
  startingBalanceUsdc: number;
  /** Trading wallet cash — bot and manual fills debit/credit this only. */
  balanceUsdc: number;
  tradingBalanceUsdc: number;
  /** Main vault — profits withdrawn here; source for top-ups to trading. */
  fundingBalanceUsdc: number;
  /** Max USDC allowed in the trading wallet (competition cap). */
  tradingCapUsdc: number;
  /** Funding + trading equity (cash + open P&L). */
  totalBalanceUsdc: number;
  equityUsdc: number;
  minBalanceUsdc: number;
  alive: boolean;
  positionSide: PaperPositionSide;
  /** Market symbol for the open position (null when flat). */
  positionSymbol: string | null;
  /** manual vs bot — never mix while a position is open. */
  positionSource: PaperTradeSource | null;
  positionSizeBase: number;
  entryPriceUsd: number | null;
  leverage: number;
  unrealizedPnlUsd: number;
  /** Sum of realized P&L from closed round trips (fees already in cash). */
  realizedPnlUsd: number;
  tradeCount: number;
  updatedAt: string;
} & PaperPerpSizing;

export type PaperPortfolioConfig = {
  startingBalanceUsdc: number;
  /** Max USDC in the trading wallet at once. */
  tradingCapUsdc: number;
  leverage: number;
  marginFraction: number;
  /** Taker fee in bps — deducted on each open/close (round trip ≈ 2×). */
  takerFeeBps: number;
};

export const DEFAULT_TRADING_CAP_USDC = 100;

const DEFAULT_CONFIG: PaperPortfolioConfig = {
  startingBalanceUsdc: 100,
  tradingCapUsdc: DEFAULT_TRADING_CAP_USDC,
  leverage: 2,
  marginFraction: 0.5,
  takerFeeBps: 5,
};

export class PaperPortfolio {
  private trades: PaperTradeRecord[] = [];
  /** Trading wallet — all perp fills run against this balance. */
  private balanceUsdc: number;
  /** Funding vault — not used for margin until deposited to trading. */
  private fundingBalanceUsdc = 0;
  private positionSide: PaperPositionSide = "flat";
  private positionSymbol: string | null = null;
  private positionSource: PaperTradeSource | null = null;
  private positionSizeBase = 0;
  private entryPriceUsd: number | null = null;

  constructor(private readonly config: PaperPortfolioConfig = DEFAULT_CONFIG) {
    this.balanceUsdc = config.startingBalanceUsdc;
  }

  reset(config?: Partial<PaperPortfolioConfig>) {
    if (config) Object.assign(this.config, config);
    this.balanceUsdc = this.config.startingBalanceUsdc;
    this.fundingBalanceUsdc = 0;
    this.positionSide = "flat";
    this.positionSymbol = null;
    this.positionSource = null;
    this.positionSizeBase = 0;
    this.entryPriceUsd = null;
    this.trades = [];
  }

  exportSnapshot(): {
    startingBalanceUsdc: number;
    balanceUsdc: number;
    fundingBalanceUsdc: number;
    tradingCapUsdc: number;
    positionSide: PaperPositionSide;
    positionSymbol: string | null;
    positionSource: PaperTradeSource | null;
    positionSizeBase: number;
    entryPriceUsd: number | null;
    leverage: number;
    trades: PaperTradeRecord[];
  } {
    return {
      startingBalanceUsdc: this.config.startingBalanceUsdc,
      balanceUsdc: this.balanceUsdc,
      fundingBalanceUsdc: this.fundingBalanceUsdc,
      tradingCapUsdc: this.config.tradingCapUsdc,
      positionSide: this.positionSide,
      positionSymbol: this.positionSymbol,
      positionSource: this.positionSource,
      positionSizeBase: this.positionSizeBase,
      entryPriceUsd: this.entryPriceUsd,
      leverage: this.config.leverage,
      trades: [...this.trades],
    };
  }

  importSnapshot(snapshot: {
    startingBalanceUsdc?: number;
    balanceUsdc: number;
    fundingBalanceUsdc?: number;
    tradingCapUsdc?: number;
    positionSide: PaperPositionSide;
    positionSymbol?: string | null;
    positionSource?: PaperTradeSource | null;
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
    if (snapshot.tradingCapUsdc != null) {
      this.config.tradingCapUsdc = snapshot.tradingCapUsdc;
    }
    this.balanceUsdc = snapshot.balanceUsdc;
    this.fundingBalanceUsdc = snapshot.fundingBalanceUsdc ?? 0;
    this.positionSide = snapshot.positionSide;
    this.positionSymbol =
      snapshot.positionSymbol ??
      inferPositionSymbolFromTrades(snapshot.trades ?? [], snapshot.positionSide);
    this.positionSource =
      snapshot.positionSource ??
      inferPositionSourceFromTrades(snapshot.trades ?? [], snapshot.positionSide);
    this.positionSizeBase = snapshot.positionSizeBase;
    this.entryPriceUsd = snapshot.entryPriceUsd;
    if (snapshot.trades) this.trades = [...snapshot.trades];
  }

  getPositionSymbol(): string | null {
    return this.positionSymbol;
  }

  getPositionSource(): PaperTradeSource | null {
    return this.positionSource;
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
      tradingBalanceUsdc: this.balanceUsdc,
      fundingBalanceUsdc: this.fundingBalanceUsdc,
      tradingCapUsdc: this.config.tradingCapUsdc,
      totalBalanceUsdc: this.fundingBalanceUsdc + equityUsdc,
      equityUsdc,
      minBalanceUsdc,
      alive: equityUsdc > minBalanceUsdc,
      positionSide: this.positionSide,
      positionSymbol: this.positionSymbol,
      positionSource: this.positionSource,
      positionSizeBase: this.positionSizeBase,
      entryPriceUsd: this.entryPriceUsd,
      leverage: this.config.leverage,
      unrealizedPnlUsd: unrealized,
      realizedPnlUsd: this.trades
        .filter((t) => t.pnlUsd != null)
        .reduce((sum, t) => sum + (t.pnlUsd ?? 0), 0),
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

  canOpen(
    priceUsd: number,
    minBalanceUsdc: number,
    source?: PaperTradeSource,
  ): boolean {
    if (this.positionSide !== "flat") return false;
    if (
      source &&
      this.positionSource &&
      this.positionSource !== source
    ) {
      return false;
    }
    if (this.balanceUsdc <= minBalanceUsdc) return false;
    return this.computeSizeBase(priceUsd) > 0;
  }

  /** Block bot when manual position is open and vice versa. */
  canOpenForSource(source: PaperTradeSource): boolean {
    if (this.positionSide === "flat") return true;
    return this.positionSource === source;
  }

  setLeverage(leverage: number) {
    this.config.leverage = leverage;
  }

  getLeverage(): number {
    return this.config.leverage;
  }

  getFundingBalance(): number {
    return this.fundingBalanceUsdc;
  }

  getTradingCap(): number {
    return this.config.tradingCapUsdc;
  }

  /** Move USDC from funding vault into trading wallet (flat only, respects cap). */
  depositToTrading(amountUsd: number): { ok: true; moved: number } | { ok: false; error: string } {
    if (this.positionSide !== "flat") {
      return { ok: false, error: "Close open position before transferring to trading" };
    }
    const amount = Number(amountUsd);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "Enter a positive amount" };
    }
    if (amount > this.fundingBalanceUsdc + 0.0001) {
      return { ok: false, error: `Funding only has $${this.fundingBalanceUsdc.toFixed(2)}` };
    }
    const headroom = this.config.tradingCapUsdc - this.balanceUsdc;
    if (headroom <= 0) {
      return {
        ok: false,
        error: `Trading wallet at cap ($${this.config.tradingCapUsdc.toFixed(2)})`,
      };
    }
    const moved = Math.min(amount, headroom, this.fundingBalanceUsdc);
    if (moved <= 0) {
      return { ok: false, error: "Nothing to deposit" };
    }
    this.fundingBalanceUsdc -= moved;
    this.balanceUsdc += moved;
    return { ok: true, moved };
  }

  /** Move USDC from trading wallet to funding vault (flat only). */
  withdrawToFunding(amountUsd: number): { ok: true; moved: number } | { ok: false; error: string } {
    if (this.positionSide !== "flat") {
      return { ok: false, error: "Close open position before withdrawing to funding" };
    }
    const amount = Number(amountUsd);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "Enter a positive amount" };
    }
    if (amount > this.balanceUsdc + 0.0001) {
      return { ok: false, error: `Trading wallet only has $${this.balanceUsdc.toFixed(2)} cash` };
    }
    const moved = Math.min(amount, this.balanceUsdc);
    this.balanceUsdc -= moved;
    this.fundingBalanceUsdc += moved;
    return { ok: true, moved };
  }

  openLong(params: {
    symbol: string;
    priceUsd: number;
    reason: string;
    barTime: number;
    sizeBase?: number;
    source: PaperTradeSource;
  }): PaperTradeRecord | null {
    if (this.positionSide !== "flat") return null;
    if (!this.canOpenForSource(params.source)) return null;
    const sizeBase = params.sizeBase ?? this.computeSizeBase(params.priceUsd);
    if (sizeBase <= 0) return null;
    this.positionSide = "long";
    this.positionSymbol = params.symbol;
    this.positionSource = params.source;
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
      source: params.source,
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
    const source = this.positionSource ?? "manual";
    this.positionSide = "flat";
    this.positionSymbol = null;
    this.positionSource = null;
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
      source,
    });
  }

  openShort(params: {
    symbol: string;
    priceUsd: number;
    reason: string;
    barTime: number;
    sizeBase?: number;
    source: PaperTradeSource;
  }): PaperTradeRecord | null {
    if (this.positionSide !== "flat") return null;
    if (!this.canOpenForSource(params.source)) return null;
    const sizeBase = params.sizeBase ?? this.computeSizeBase(params.priceUsd);
    if (sizeBase <= 0) return null;
    this.positionSide = "short";
    this.positionSymbol = params.symbol;
    this.positionSource = params.source;
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
      source: params.source,
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
    const source = this.positionSource ?? "manual";
    this.positionSide = "flat";
    this.positionSymbol = null;
    this.positionSource = null;
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
      source,
    });
  }

  private record(
    partial: Omit<
      PaperTradeRecord,
      "id" | "at" | "notionalUsd" | "balanceUsdc" | "leverage"
    >,
  ): PaperTradeRecord {
    const notionalUsd = partial.priceUsd * partial.sizeBase;
    const feeUsd = notionalUsd * (this.config.takerFeeBps / 10_000);
    this.balanceUsdc -= feeUsd;
    const trade: PaperTradeRecord = {
      id: newTradeId(),
      at: new Date().toISOString(),
      notionalUsd,
      balanceUsdc: this.balanceUsdc,
      leverage: this.config.leverage,
      ...partial,
    };
    this.trades.push(trade);
    return trade;
  }
}
