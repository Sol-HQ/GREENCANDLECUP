import type { TradingCore } from "@gcc/trading-core";
import type {
  BotConfig,
  BotStatus,
  CandleTimeframe,
  GccMetrics,
  MarketSnapshot,
} from "@gcc/shared";
import { DEFAULT_BOT_CONFIG } from "@gcc/shared";
import { analyzeCandles, type Candle, type TaAnalysis } from "@gcc/ta";

export type BotLogHandler = (level: "info" | "warn" | "error", message: string) => void;

export type CandleFetcher = (
  symbol: string,
  timeframe: CandleTimeframe,
  limit?: number,
) => Promise<Candle[]>;

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
  private lastPrice: number | null = null;
  private lastAnalysis: TaAnalysis | null = null;
  private lastSignalAt = 0;

  constructor(
    private trading: TradingCore,
    private onLog: BotLogHandler = () => {},
    private getCandles?: CandleFetcher,
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

  getLastAnalysis(): TaAnalysis | null {
    return this.lastAnalysis;
  }

  updateConfig(partial: Partial<BotConfig>) {
    this.config = { ...this.config, ...partial };
    if (this.status === "running") {
      this.pause();
      this.start();
    }
  }

  start() {
    if (this.status === "running") return;
    this.status = "running";
    this.config.status = "running";
    this.onLog(
      "info",
      `Bot started (${this.config.mode}, ${this.config.strategy}, ${this.config.candleTimeframe}, ${this.config.pollIntervalMs}ms)`,
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
  }

  private async tick() {
    if (this.status !== "running" || !this.lastPrice) return;
    if (this.config.strategy === "manual") return;

    try {
      const signal = await this.computeSignal();
      if (!signal) return;

      const now = Date.now();
      if (now - this.lastSignalAt < 15_000) return;
      this.lastSignalAt = now;

      const sizeBase = "0.01";
      const result = await this.trading.buildOrder(
        {
          symbol: this.config.symbol,
          side: signal,
          type: "market",
          sizeBase,
          mode: this.config.mode,
        },
        { priceUsd: this.lastPrice, collateralUsd: 200, leverage: 2 },
      );

      const notional = this.lastPrice * Number(sizeBase);
      this.metrics.volumeUsd += notional;
      this.metrics.tradeCount += 1;
      this.metrics.updatedAt = new Date().toISOString();
      const reason = this.lastAnalysis?.reason ?? "signal";
      this.onLog("info", `${result.message} · ${reason}`);
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

  private async computeSignal(): Promise<"buy" | "sell" | null> {
    if (!this.getCandles) return null;
    if (this.config.strategy === "manual") return null;
    const candles = await this.getCandles(
      this.config.symbol,
      this.config.candleTimeframe,
      120,
    );
    if (candles.length < 30) return null;

    const analysis = analyzeCandles(
      candles,
      this.config.strategy as "trend_macd" | "pullback" | "momentum" | "mean_reversion",
    );
    this.lastAnalysis = analysis;
    return analysis.signal;
  }
}
