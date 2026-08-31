import type { TradingCore } from "@gcc/trading-core";
import type {
  BotConfig,
  BotStatus,
  CandleTimeframe,
  GccMetrics,
  MarketBriefing,
  MarketSnapshot,
  PaperTradeRecord,
} from "@gcc/shared";
import {
  DEFAULT_BOT_CONFIG,
  PaperPortfolio,
  type PaperPortfolioState,
} from "@gcc/shared";
import {
  analyzeCandles,
  analyzeWaveScalp,
  type Candle,
  type TaAnalysis,
  type WaveScalpAnalysis,
} from "@gcc/ta";

export type BotLogHandler = (level: "info" | "warn" | "error", message: string) => void;

export type PaperTradeHandler = (trade: PaperTradeRecord) => void;

export type CandleFetcher = (
  symbol: string,
  timeframe: CandleTimeframe,
  limit?: number,
) => Promise<Candle[]>;

export type BriefingFetcher = (symbol: string) => Promise<MarketBriefing | null>;

export class BotEngine {
  private config: BotConfig = { ...DEFAULT_BOT_CONFIG };
  private status: BotStatus = "stopped";
  private timer: NodeJS.Timeout | null = null;
  private metrics: GccMetrics = {
    volumeUsd: 0,
    realizedPnlUsd: 0,
    unrealizedPnlUsd: 0,
    tradeCount: 0,
    updatedAt: new Date().toISOString(),
  };
  private paper = new PaperPortfolio();
  private lastPrice: number | null = null;
  private lastAnalysis: TaAnalysis | WaveScalpAnalysis | null = null;
  private lastBriefing: MarketBriefing | null = null;
  private lastSignalAt = 0;
  private lastScanLogAt = 0;
  private scanCount = 0;
  private warmedUp = false;
  private waitingForPriceLogged = false;

  constructor(
    private trading: TradingCore,
    private onLog: BotLogHandler = () => {},
    private getCandles?: CandleFetcher,
    private onPaperTrade?: PaperTradeHandler,
    private fetchBriefing?: BriefingFetcher,
  ) {}

  getConfig(): BotConfig {
    return this.config;
  }

  getStatus(): BotStatus {
    return this.status;
  }

  getMetrics(): GccMetrics {
    return this.metrics;
  }

  getLastAnalysis(): TaAnalysis | WaveScalpAnalysis | null {
    return this.lastAnalysis;
  }

  getBriefing(): MarketBriefing | null {
    return this.lastBriefing;
  }

  getPaperPortfolio(markPrice?: number | null): PaperPortfolioState {
    return this.paper.getState(markPrice ?? this.lastPrice);
  }

  getPaperTrades(): PaperTradeRecord[] {
    return this.paper.getTrades();
  }

  updateConfig(partial: Partial<BotConfig>) {
    this.config = { ...this.config, ...partial };
    this.syncPaperConfig();
    if (this.status === "running") {
      this.pause();
      this.start();
    }
  }

  private syncPaperConfig() {
    this.paper.reset({
      startingBalanceUsdc: this.config.paperBalanceUsdc,
      leverage: this.config.paperLeverage,
      marginFraction: 0.5,
    });
  }

  async start() {
    if (this.status === "running") return;
    this.status = "running";
    this.config.status = "running";
    this.scanCount = 0;
    this.warmedUp = false;
    this.syncPaperConfig();

    if (this.fetchBriefing) {
      try {
        this.lastBriefing = await this.fetchBriefing(this.config.symbol);
        if (this.lastBriefing) {
          this.onLog("info", `BRIEF · ${this.lastBriefing.summary}`);
        }
      } catch {
        this.onLog("warn", `No market briefing for ${this.config.symbol}`);
      }
    }

    this.onLog(
      "info",
      `Bot started (${this.config.mode}, ${this.config.strategy}, ${this.config.candleTimeframe}, $${this.config.paperBalanceUsdc} USDC paper)`,
    );
    this.onLog(
      "info",
      `Warmup: ${this.config.warmupScanCount} scan cycles before first trade`,
    );
    this.timer = setInterval(() => void this.tick(), this.config.pollIntervalMs);
  }

  pause() {
    this.status = "paused";
    this.config.status = "paused";
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.onLog("info", "Bot paused");
  }

  stop() {
    this.status = "stopped";
    this.config.status = "stopped";
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.onLog("info", "Bot stopped");
  }

  onMarketUpdate(snapshot: MarketSnapshot) {
    const price = Number(snapshot.markPriceUsd ?? snapshot.bestBid ?? 0);
    if (!price) return;
    this.lastPrice = price;
    const state = this.paper.getState(price);
    this.metrics.unrealizedPnlUsd = state.unrealizedPnlUsd;
    this.metrics.updatedAt = new Date().toISOString();
  }

  private async tick() {
    if (this.status !== "running") return;
    if (this.config.strategy === "manual") return;

    if (!this.lastPrice) {
      if (!this.waitingForPriceLogged) {
        this.waitingForPriceLogged = true;
        this.onLog(
          "warn",
          `Waiting for Phoenix mark price on ${this.config.symbol}…`,
        );
      }
      return;
    }
    this.waitingForPriceLogged = false;

    try {
      const now = Date.now();
      const candles = await this.loadCandles();
      if (!candles.length) return;

      const barTime = candles.at(-1)?.time ?? Math.floor(now / 1000);
      const portfolio = this.paper.getState(this.lastPrice);

      if (this.config.strategy === "wave_scalp") {
        const wave = analyzeWaveScalp(
          candles,
          portfolio.positionSide,
          portfolio.entryPriceUsd,
          {
            takeProfitPct: this.config.takeProfitPct,
            stopLossPct: this.config.stopLossPct,
            swingLookback: 20,
            nearExtremePct: 0.35,
          },
        );
        this.lastAnalysis = wave;

        if (now - this.lastScanLogAt >= 10_000) {
          this.lastScanLogAt = now;
          this.scanCount += 1;
          const mark = this.lastPrice.toFixed(4);
          const pos =
            portfolio.positionSide === "flat"
              ? "flat"
              : `${portfolio.positionSide} @ $${portfolio.entryPriceUsd?.toFixed(4)}`;
          const bal = portfolio.balanceUsdc.toFixed(2);
          this.onLog(
            "info",
            `Scan ${this.config.symbol} @ $${mark} · ${pos} · $${bal} USDC · ${wave.reason}`,
          );
        }

        if (!this.warmedUp) {
          if (this.scanCount >= this.config.warmupScanCount) {
            this.warmedUp = true;
            this.onLog("info", "Warmup complete — watching for wave entries");
          }
          return;
        }

        if (wave.action === "hold") return;
        if (now - this.lastSignalAt < 15_000) return;
        this.lastSignalAt = now;

        if (this.config.mode === "paper") {
          this.executePaperWave(wave, barTime);
        }
        return;
      }

      const signal = await this.computeClassicSignal(candles);
      const analysis = this.lastAnalysis as TaAnalysis | null;
      if (analysis && now - this.lastScanLogAt >= 10_000) {
        this.lastScanLogAt = now;
        const mark = this.lastPrice.toFixed(2);
        const sig = signal ? signal.toUpperCase() : "none";
        this.onLog(
          "info",
          `Scan ${this.config.symbol} @ $${mark} · trend ${analysis.trend} · signal ${sig} — ${analysis.reason}`,
        );
      }
      if (!signal) return;
      if (now - this.lastSignalAt < 15_000) return;
      this.lastSignalAt = now;

      const sizeBase = this.paper.computeSizeBase(this.lastPrice).toFixed(6);
      const result = await this.trading.buildOrder(
        {
          symbol: this.config.symbol,
          side: signal,
          type: "market",
          sizeBase,
          mode: this.config.mode,
        },
        { priceUsd: this.lastPrice, collateralUsd: this.config.paperBalanceUsdc },
      );

      const notional = this.lastPrice * Number(sizeBase);
      this.metrics.volumeUsd += notional;
      this.metrics.tradeCount += 1;
      this.metrics.updatedAt = new Date().toISOString();
      const reason = analysis?.reason ?? "signal";
      this.onLog("info", `TRADE · ${result.message} · ${reason}`);
    } catch (error) {
      this.status = "error";
      this.config.status = "error";
      this.onLog(
        "error",
        error instanceof Error ? error.message : "Unknown bot error",
      );
      this.pause();
    }
  }

  private executePaperWave(wave: WaveScalpAnalysis, barTime: number) {
    const price = this.lastPrice!;
    let trade: PaperTradeRecord | null = null;
    const sym = this.config.symbol;

    switch (wave.action) {
      case "open_long":
        trade = this.paper.openLong({
          symbol: sym,
          priceUsd: price,
          reason: wave.reason,
          barTime,
        });
        break;
      case "close_long":
        trade = this.paper.closeLong({
          symbol: sym,
          priceUsd: price,
          reason: wave.reason,
          barTime,
        });
        break;
      case "open_short":
        trade = this.paper.openShort({
          symbol: sym,
          priceUsd: price,
          reason: wave.reason,
          barTime,
        });
        break;
      case "close_short":
        trade = this.paper.closeShort({
          symbol: sym,
          priceUsd: price,
          reason: wave.reason,
          barTime,
        });
        break;
      default:
        return;
    }

    if (!trade) {
      this.onLog("warn", `Skipped ${wave.action} — position state blocked`);
      return;
    }

    const state = this.paper.getState(price);
    this.metrics.volumeUsd += trade.notionalUsd;
    this.metrics.tradeCount += 1;
    this.metrics.realizedPnlUsd +=
      trade.pnlUsd != null ? trade.pnlUsd : 0;
    this.metrics.unrealizedPnlUsd = state.unrealizedPnlUsd;
    this.metrics.updatedAt = new Date().toISOString();

    const pnl =
      trade.pnlUsd != null
        ? ` · PnL ${trade.pnlUsd >= 0 ? "+" : ""}$${trade.pnlUsd.toFixed(2)}`
        : "";
    this.onLog(
      "info",
      `TRADE · ${trade.action} ${sym} @ $${price.toFixed(4)} · bal $${state.balanceUsdc.toFixed(2)} USDC${pnl} · ${wave.reason}`,
    );
    this.onPaperTrade?.(trade);
  }

  private async loadCandles(): Promise<Candle[]> {
    if (!this.getCandles) return [];
    return this.getCandles(
      this.config.symbol,
      this.config.candleTimeframe,
      120,
    );
  }

  private async computeClassicSignal(
    candles: Candle[],
  ): Promise<"buy" | "sell" | null> {
    if (candles.length < 30) return null;
    const analysis = analyzeCandles(
      candles,
      this.config.strategy as
        | "trend_macd"
        | "pullback"
        | "momentum"
        | "mean_reversion",
    );
    this.lastAnalysis = analysis;
    return analysis.signal;
  }
}
