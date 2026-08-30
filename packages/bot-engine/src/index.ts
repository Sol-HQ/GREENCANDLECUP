import type { TradingCore } from "@gcc/trading-core";
import type {
  BotConfig,
  BotStatus,
  GccMetrics,
  MarketSnapshot,
} from "@gcc/shared";
import { DEFAULT_BOT_CONFIG } from "@gcc/shared";

export type BotLogHandler = (level: "info" | "warn" | "error", message: string) => void;

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
  private priceHistory: number[] = [];

  constructor(
    private trading: TradingCore,
    private onLog: BotLogHandler = () => {},
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

  updateConfig(partial: Partial<BotConfig>) {
    this.config = { ...this.config, ...partial };
  }

  start() {
    if (this.status === "running") return;
    this.status = "running";
    this.config.status = "running";
    this.onLog("info", `Bot started (${this.config.mode}, ${this.config.strategy})`);
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
    this.priceHistory.push(price);
    if (this.priceHistory.length > 20) this.priceHistory.shift();
  }

  private async tick() {
    if (this.status !== "running" || !this.lastPrice) return;

    try {
      const signal = this.computeSignal();
      if (!signal) return;

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
      this.onLog("info", result.message);
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

  private computeSignal(): "buy" | "sell" | null {
    if (this.priceHistory.length < 10) return null;
    const recent = this.priceHistory.slice(-5);
    const older = this.priceHistory.slice(-10, -5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const delta = (recentAvg - olderAvg) / olderAvg;

    if (this.config.strategy === "momentum") {
      if (delta > 0.0005) return "buy";
      if (delta < -0.0005) return "sell";
      return null;
    }

    if (this.config.strategy === "mean_reversion") {
      if (delta < -0.0005) return "buy";
      if (delta > 0.0005) return "sell";
      return null;
    }

    return null;
  }
}
