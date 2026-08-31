import type { TradingCore } from "@gcc/trading-core";
import type {
  BotConfig,
  BotStatus,
  CandleTimeframe,
  GccMetrics,
  MarketBriefing,
  MarketSnapshot,
  OrderbookSnapshot,
  PaperTradeRecord,
  PlaceOrderRequest,
} from "@gcc/shared";
import {
  DEFAULT_BOT_CONFIG,
  PaperPortfolio,
  formatPaperTradeReceipt,
  type PaperPortfolioState,
  type PaperPositionSide,
} from "@gcc/shared";
import {
  analyzeAdaptive,
  analyzeCandles,
  analyzeWaveScalp,
  type AdaptiveAnalysis,
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
  private lastAnalysis: TaAnalysis | WaveScalpAnalysis | AdaptiveAnalysis | null = null;
  private lastBriefing: MarketBriefing | null = null;
  private lastSignalAt = 0;
  private lastScanLogAt = 0;
  private scanCount = 0;
  private warmedUp = false;
  private waitingForPriceLogged = false;
  private lastSurvivalLogAt = 0;
  private lastTransientLogAt = 0;
  private lastSpreadBps: number | null = null;
  private maxSpreadBps = 35;

  /** 0 = near death, 1 = full bankroll — sizes positions and tightens risk. */
  private survivalRiskScale(): number {
    const price = this.lastPrice;
    if (!price) return 1;
    const state = this.paper.getState(price, this.config.paperMinBalanceUsdc);
    const start = state.startingBalanceUsdc;
    const floor = this.config.paperMinBalanceUsdc;
    const span = Math.max(start - floor, 1);
    return Math.max(0, Math.min(1, (state.equityUsdc - floor) / span));
  }

  private survivalLifePct(): number {
    const price = this.lastPrice;
    if (!price) return 100;
    const state = this.paper.getState(price, this.config.paperMinBalanceUsdc);
    return (state.equityUsdc / state.startingBalanceUsdc) * 100;
  }

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

  getLastAnalysis(): TaAnalysis | WaveScalpAnalysis | AdaptiveAnalysis | null {
    return this.lastAnalysis;
  }

  getBriefing(): MarketBriefing | null {
    return this.lastBriefing;
  }

  getPaperPortfolio(markPrice?: number | null): PaperPortfolioState {
    return this.paper.getState(
      markPrice ?? this.lastPrice,
      this.config.paperMinBalanceUsdc,
    );
  }

  getPaperTrades(): PaperTradeRecord[] {
    return this.paper.getTrades();
  }

  /** Manual trade panel — same paper wallet as the bot. */
  executeManualPaperOrder(
    request: PlaceOrderRequest,
    fillPriceUsd: number,
  ): { trade: PaperTradeRecord | null; receipt: string; error?: string } {
    const sym = request.symbol.toUpperCase();
    const sizeBase = Number(request.sizeBase);
    const leverage = request.leverage ?? this.paper.getLeverage();
    const barTime = Math.floor(Date.now() / 1000);
    const side = this.paper.getPositionSide();

    if (fillPriceUsd <= 0 || sizeBase <= 0) {
      return { trade: null, receipt: "", error: "Invalid price or size" };
    }

    this.paper.setLeverage(leverage);

    const reduceOnly = request.reduceOnly === true;

    if (reduceOnly) {
      if (request.side === "sell" && side === "long") {
        const trade = this.paper.closeLong({
          symbol: sym,
          priceUsd: fillPriceUsd,
          reason: "Manual close long (reduce only)",
          barTime,
        });
        if (!trade) return { trade: null, receipt: "", error: "No long to close" };
        return this.finalizeManualTrade(trade, leverage);
      }
      if (request.side === "buy" && side === "short") {
        const trade = this.paper.closeShort({
          symbol: sym,
          priceUsd: fillPriceUsd,
          reason: "Manual close short (reduce only)",
          barTime,
        });
        if (!trade) return { trade: null, receipt: "", error: "No short to close" };
        return this.finalizeManualTrade(trade, leverage);
      }
      return {
        trade: null,
        receipt: "",
        error: `Reduce-only ${request.side} does not match open ${side} position`,
      };
    }

    if (side === "long") {
      if (request.side === "sell") {
        const trade = this.paper.closeLong({
          symbol: sym,
          priceUsd: fillPriceUsd,
          reason: "Manual close long",
          barTime,
        });
        if (!trade) return { trade: null, receipt: "", error: "Failed to close long" };
        return this.finalizeManualTrade(trade, leverage);
      }
      return {
        trade: null,
        receipt: "",
        error: "Already long — sell to close or enable reduce only",
      };
    }
    if (side === "short") {
      if (request.side === "buy") {
        const trade = this.paper.closeShort({
          symbol: sym,
          priceUsd: fillPriceUsd,
          reason: "Manual close short",
          barTime,
        });
        if (!trade) return { trade: null, receipt: "", error: "Failed to close short" };
        return this.finalizeManualTrade(trade, leverage);
      }
      return {
        trade: null,
        receipt: "",
        error: "Already short — buy to close or enable reduce only",
      };
    }

    if (request.side === "buy") {
      const trade = this.paper.openLong({
        symbol: sym,
        priceUsd: fillPriceUsd,
        reason: `Manual long · ${sizeBase.toFixed(4)} ${sym} @ ${leverage}x`,
        barTime,
        sizeBase,
      });
      if (!trade) {
        return { trade: null, receipt: "", error: "Could not open long — check balance" };
      }
      return this.finalizeManualTrade(trade, leverage);
    }

    const trade = this.paper.openShort({
      symbol: sym,
      priceUsd: fillPriceUsd,
      reason: `Manual short · ${sizeBase.toFixed(4)} ${sym} @ ${leverage}x`,
      barTime,
      sizeBase,
    });
    if (!trade) {
      return { trade: null, receipt: "", error: "Could not open short — check balance" };
    }
    return this.finalizeManualTrade(trade, leverage);
  }

  closePaperPosition(symbol: string, fillPriceUsd: number): {
    trade: PaperTradeRecord | null;
    receipt: string;
    error?: string;
  } {
    const sym = symbol.toUpperCase();
    const side = this.paper.getPositionSide();
    const barTime = Math.floor(Date.now() / 1000);
    const leverage = this.paper.getLeverage();

    if (side === "flat") {
      return { trade: null, receipt: "", error: "No open position to close" };
    }
    if (fillPriceUsd <= 0) {
      return { trade: null, receipt: "", error: "Invalid mark price" };
    }

    const trade =
      side === "long"
        ? this.paper.closeLong({
            symbol: sym,
            priceUsd: fillPriceUsd,
            reason: "Manual close position",
            barTime,
          })
        : this.paper.closeShort({
            symbol: sym,
            priceUsd: fillPriceUsd,
            reason: "Manual close position",
            barTime,
          });

    if (!trade) {
      return { trade: null, receipt: "", error: "Close failed" };
    }
    return this.finalizeManualTrade(trade, leverage);
  }

  private finalizeManualTrade(
    trade: PaperTradeRecord,
    leverage: number,
  ): { trade: PaperTradeRecord; receipt: string } {
    const price = this.lastPrice ?? trade.priceUsd;
    const state = this.paper.getState(price, this.config.paperMinBalanceUsdc);
    this.metrics.volumeUsd += trade.notionalUsd;
    this.metrics.tradeCount += 1;
    if (trade.pnlUsd != null) {
      this.metrics.realizedPnlUsd += trade.pnlUsd;
    }
    this.metrics.unrealizedPnlUsd = state.unrealizedPnlUsd;
    this.metrics.updatedAt = new Date().toISOString();

    const receipt = formatPaperTradeReceipt(
      trade,
      leverage,
      this.config.paperTakerFeeBps,
    );
    this.onLog("info", `TRADE · ${receipt}`);
    this.onPaperTrade?.(trade);
    return { trade, receipt };
  }

  loadTradeHistory(trades: PaperTradeRecord[]) {
    this.paper.loadTradeHistory(trades);
  }

  restorePaperSession(snapshot: {
    trades: PaperTradeRecord[];
    portfolio: {
      startingBalanceUsdc: number;
      balanceUsdc: number;
      positionSide: "flat" | "long" | "short";
      positionSizeBase: number;
      entryPriceUsd: number | null;
      leverage: number;
    } | null;
  }) {
    if (snapshot.portfolio) {
      this.config.paperBalanceUsdc = snapshot.portfolio.startingBalanceUsdc;
      this.config.paperLeverage = snapshot.portfolio.leverage;
      this.paper.importSnapshot({ ...snapshot.portfolio, trades: snapshot.trades });
      this.onLog(
        "info",
        `Restored paper · $${snapshot.portfolio.balanceUsdc.toFixed(2)} USDC · ${snapshot.portfolio.positionSide} · ${snapshot.trades.length} trades`,
      );
    } else {
      this.paper.loadTradeHistory(snapshot.trades);
    }
  }

  exportPaperSession(): {
    trades: PaperTradeRecord[];
    portfolio: {
      startingBalanceUsdc: number;
      balanceUsdc: number;
      positionSide: PaperPositionSide;
      positionSizeBase: number;
      entryPriceUsd: number | null;
      leverage: number;
    };
  } {
    const snap = this.paper.exportSnapshot();
    return {
      trades: snap.trades,
      portfolio: {
        startingBalanceUsdc: snap.startingBalanceUsdc,
        balanceUsdc: snap.balanceUsdc,
        positionSide: snap.positionSide,
        positionSizeBase: snap.positionSizeBase,
        entryPriceUsd: snap.entryPriceUsd,
        leverage: snap.leverage,
      },
    };
  }

  updateConfig(partial: Partial<BotConfig>) {
    const wasRunning = this.status === "running";
    const prevPoll = this.config.pollIntervalMs;
    this.config = { ...this.config, ...partial };
    if (
      wasRunning &&
      partial.pollIntervalMs != null &&
      partial.pollIntervalMs !== prevPoll
    ) {
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => void this.tick(), this.config.pollIntervalMs);
    }
  }

  private syncPaperConfig() {
    this.paper.reset({
      startingBalanceUsdc: this.config.paperBalanceUsdc,
      leverage: this.config.paperLeverage,
      marginFraction: 0.5,
      takerFeeBps: this.config.paperTakerFeeBps,
    });
  }

  resetPaper(balanceUsdc?: number) {
    if (balanceUsdc != null) {
      this.config.paperBalanceUsdc = balanceUsdc;
    }
    this.syncPaperConfig();
    this.metrics = {
      volumeUsd: 0,
      realizedPnlUsd: 0,
      unrealizedPnlUsd: 0,
      tradeCount: 0,
      updatedAt: new Date().toISOString(),
    };
    this.onLog(
      "info",
      `Paper wallet reset to $${this.config.paperBalanceUsdc} USDC`,
    );
  }

  async start(options?: { freshPaper?: boolean }) {
    if (this.status === "running") return;
    const shouldReset =
      options?.freshPaper === true ||
      (options?.freshPaper !== false && this.status === "stopped");
    if (shouldReset) {
      this.syncPaperConfig();
    }
    this.status = "running";
    this.config.status = "running";
    this.scanCount = 0;
    this.warmedUp = false;

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
    this.onLog(
      "info",
      `Survival: lose the $${this.config.paperBalanceUsdc} bankroll = DEAD (no respawn until reset)`,
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
    if (this.status !== "running") return;
    const state = this.paper.getState(price, this.config.paperMinBalanceUsdc);
    this.metrics.unrealizedPnlUsd = state.unrealizedPnlUsd;
    this.metrics.updatedAt = new Date().toISOString();
    if (!state.alive) {
      this.die("equity hit zero — account dead");
    }
  }

  onOrderbookUpdate(book: OrderbookSnapshot) {
    const bid = Number(book.bids[0]?.price ?? 0);
    const ask = Number(book.asks[0]?.price ?? 0);
    if (!bid || !ask) return;
    const mid = (bid + ask) / 2;
    this.lastSpreadBps = ((ask - bid) / mid) * 10_000;
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
      const candleBundle =
        this.config.strategy === "adaptive"
          ? await this.loadAdaptiveCandles()
          : { primary: await this.loadCandles(), structure: [] as Candle[] };
      const candles = candleBundle.primary;
      if (!candles.length) return;

      const barTime = candles.at(-1)?.time ?? Math.floor(now / 1000);
      const portfolio = this.paper.getState(
        this.lastPrice,
        this.config.paperMinBalanceUsdc,
      );

      if (!portfolio.alive) {
        this.die("equity below survival floor");
        return;
      }

      const lifePct = this.survivalLifePct();
      const riskScale = this.survivalRiskScale();

      if (
        this.config.strategy === "adaptive" ||
        this.config.strategy === "wave_scalp"
      ) {
        const stopLossPct =
          riskScale < 0.35
            ? this.config.stopLossPct * 0.65
            : riskScale < 0.55
              ? this.config.stopLossPct * 0.85
              : this.config.stopLossPct;

        const wave =
          this.config.strategy === "adaptive"
            ? analyzeAdaptive(
                candles,
                portfolio.positionSide,
                portfolio.entryPriceUsd,
                {
                  trendTakeProfitPct: Math.max(
                    1.8,
                    this.config.takeProfitPct * 0.35,
                  ),
                  trendStopLossPct: Math.max(1, stopLossPct * 0.4),
                  scalpTakeProfitPct: Math.min(1.5, this.config.takeProfitPct * 0.2),
                  scalpStopLossPct: Math.min(1.2, stopLossPct * 0.25),
                  takerFeeBps: this.config.paperTakerFeeBps,
                  intelProfile: this.config.intelProfile,
                },
                candleBundle.structure,
              )
            : analyzeWaveScalp(
                candles,
                portfolio.positionSide,
                portfolio.entryPriceUsd,
                {
                  takeProfitPct: this.config.takeProfitPct,
                  stopLossPct,
                  swingLookback: 20,
                  nearExtremePct: 0.35,
                  takerFeeBps: this.config.paperTakerFeeBps,
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
          const bal = portfolio.equityUsdc.toFixed(2);
          const life =
            lifePct <= 25
              ? " · CRITICAL"
              : lifePct <= 50
                ? " · danger"
                : "";
          const adaptive = wave as AdaptiveAnalysis;
          const modeTag =
            this.config.strategy === "adaptive" && adaptive.activeMode
              ? ` · ${adaptive.regime}/${adaptive.activeMode}`
              : "";
          const confTag =
            this.config.strategy === "adaptive" &&
            adaptive.confidence != null
              ? ` · ${adaptive.confidence}% conf`
              : "";
          this.onLog(
            "info",
            `Scan ${this.config.symbol} @ $${mark} · ${pos} · life ${lifePct.toFixed(0)}% ($${bal})${life}${modeTag}${confTag} · ${wave.reason}`,
          );
        }

        if (now - this.lastSurvivalLogAt >= 60_000 && lifePct <= 40) {
          this.lastSurvivalLogAt = now;
          this.onLog(
            "warn",
            `SURVIVAL · $${portfolio.equityUsdc.toFixed(2)} left (${lifePct.toFixed(0)}% of $${portfolio.startingBalanceUsdc}) — bad trades = death, no respawn`,
          );
        }

        if (!this.warmedUp) {
          if (this.scanCount >= this.config.warmupScanCount) {
            this.warmedUp = true;
            this.onLog(
              "info",
              this.config.strategy === "adaptive"
                ? `Warmup complete — market brain online (1m + 5m · ${this.config.intelProfile} conviction)`
                : "Warmup complete — watching for wave entries",
            );
          }
          return;
        }

        if (wave.action === "hold") return;
        if (now - this.lastSignalAt < 15_000) return;

        const isOpen =
          wave.action === "open_long" || wave.action === "open_short";
        if (isOpen && riskScale < 0.2) {
          this.onLog(
            "warn",
            `Skipped entry — life too low (${lifePct.toFixed(0)}%) to risk another trade`,
          );
          return;
        }
        if (
          isOpen &&
          this.lastSpreadBps != null &&
          this.lastSpreadBps > this.maxSpreadBps
        ) {
          this.onLog(
            "warn",
            `Skipped entry — spread ${this.lastSpreadBps.toFixed(1)} bps too wide (max ${this.maxSpreadBps})`,
          );
          return;
        }
        if (this.config.mode !== "paper") {
          this.onLog(
            "warn",
            `Live mode not wired for ${this.config.strategy} — switch to Paper or bot will not trade`,
          );
          return;
        }
        if (
          isOpen &&
          !this.paper.canOpen(this.lastPrice, this.config.paperMinBalanceUsdc)
        ) {
          this.die("cannot afford another trade");
          return;
        }

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
      const message =
        error instanceof Error ? error.message : "Unknown bot error";
      const transient =
        /429|rate.?limit|too many requests|503|502|504|timeout|ECONNRESET/i.test(
          message,
        );
      if (transient) {
        const ts = Date.now();
        if (ts - this.lastTransientLogAt >= 60_000) {
          this.lastTransientLogAt = ts;
          this.onLog(
            "warn",
            `Phoenix rate-limited — using cached candles, will retry shortly`,
          );
        }
        return;
      }
      this.status = "error";
      this.config.status = "error";
      this.onLog("error", message);
      this.pause();
    }
  }

  private executePaperWave(
    wave: WaveScalpAnalysis | AdaptiveAnalysis,
    barTime: number,
  ) {
    const price = this.lastPrice!;
    const riskScale = this.survivalRiskScale();
    const sizeBase = this.paper.computeSizeBase(price, riskScale);
    let trade: PaperTradeRecord | null = null;
    const sym = this.config.symbol;

    switch (wave.action) {
      case "open_long":
        trade = this.paper.openLong({
          symbol: sym,
          priceUsd: price,
          reason: wave.reason,
          barTime,
          sizeBase,
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
          sizeBase,
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

    const state = this.paper.getState(price, this.config.paperMinBalanceUsdc);
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
      `TRADE · perp ${trade.action} ${sym} · ${trade.sizeBase.toFixed(0)} tokens @ $${price.toFixed(4)} · ~$${trade.notionalUsd.toFixed(0)} notional · equity $${state.equityUsdc.toFixed(2)} USDC${pnl} · ${wave.reason}`,
    );
    this.onPaperTrade?.(trade);

    if (!state.alive) {
      this.die("account wiped after trade");
    }
  }

  private die(reason: string) {
    if (this.status !== "running") return;
    const price = this.lastPrice;
    const sym = this.config.symbol;
    const barTime = Math.floor(Date.now() / 1000);
    const side = this.paper.getPositionSide();

    if (side === "long" && price) {
      const trade = this.paper.closeLong({
        symbol: sym,
        priceUsd: price,
        reason: `death: ${reason}`,
        barTime,
      });
      if (trade) this.onPaperTrade?.(trade);
    } else if (side === "short" && price) {
      const trade = this.paper.closeShort({
        symbol: sym,
        priceUsd: price,
        reason: `death: ${reason}`,
        barTime,
      });
      if (trade) this.onPaperTrade?.(trade);
    }

    const final = this.paper.getState(price, this.config.paperMinBalanceUsdc);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.status = "dead";
    this.config.status = "dead";
    this.onLog(
      "error",
      `DEAD · $${final.balanceUsdc.toFixed(2)} USDC left (started $${final.startingBalanceUsdc}) — ${reason}. Game over. Reset paper to respawn.`,
    );
  }

  private async loadCandles(limit = 120): Promise<Candle[]> {
    if (!this.getCandles) return [];
    return this.getCandles(
      this.config.symbol,
      this.config.candleTimeframe,
      limit,
    );
  }

  /** 1m timing + 5m structure for adaptive brain. */
  private async loadAdaptiveCandles(): Promise<{
    primary: Candle[];
    structure: Candle[];
  }> {
    if (!this.getCandles) return { primary: [], structure: [] };
    const sym = this.config.symbol;
    const tf = this.config.candleTimeframe;
    const [primary, structure] = await Promise.all([
      this.getCandles(sym, tf, 120),
      tf === "5m"
        ? this.getCandles(sym, "5m", 72)
        : this.getCandles(sym, "5m", 72),
    ]);
    return { primary, structure };
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
