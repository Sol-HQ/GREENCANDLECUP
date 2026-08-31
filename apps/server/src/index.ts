import { createServer } from "node:http";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
import { getRequestListener } from "@hono/node-server";
import { WebSocket as NodeWebSocket } from "ws";

// Rise SDK expects WebSocket in Node
(globalThis as typeof globalThis & { WebSocket: typeof NodeWebSocket }).WebSocket =
  NodeWebSocket as unknown as typeof WebSocket;
import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebSocketServer, WebSocket } from "ws";
import { createGccPhoenixClient, resolveBirdeyeMint, fetchMarketBriefing } from "@gcc/phoenix-client";
import { TradingCore } from "@gcc/trading-core";
import { BotEngine } from "@gcc/bot-engine";
import { randomUUID } from "node:crypto";
import {
  BotConfigSchema,
  BotStrategySchema,
  CandleTimeframeSchema,
  DEFAULT_RISK_LIMITS,
  DEFAULT_SYMBOL,
  NetworkConfigSchema,
  normalizeCandleTimeframe,
  PlaceOrderRequestSchema,
  formatPriceUsd,
  RiskLimitsSchema,
  SolanaClusterSchema,
  inferPositionSymbolFromTrades,
  type TradeAlert,
  type WsEvent,
  type SolanaCluster,
  type BotConfig,
  classifyReadRpcUrl,
} from "@gcc/shared";
import { analyzeAdaptive, analyzeCandles, analyzeWaveScalp } from "@gcc/ta";
import { RiskGate } from "@gcc/risk";
import {
  getPhoenixReadRpcUrl,
  getPublicWalletRpcUrl,
  getTxRpcUrl,
  maskRpcUrl,
  validateRpcRoutingAtStartup,
} from "./env.js";
import { buildInfraStatus, probeReadRpcLatency } from "./infra.js";
import {
  clearPaperStore,
  loadPaperStore,
  mergeTradeHistory,
  savePaperStore,
  type BotArmSnapshot,
} from "./paper-store.js";
import {
  clearPriceTape,
  getPaperReplay,
  recordPriceTick,
} from "./price-tape.js";
import {
  resolveShredStreamPort,
  ShredStreamListener,
} from "./shredstream.js";

validateRpcRoutingAtStartup();

const PORT = Number(process.env.PORT ?? 8787);
const API_KEY = process.env.API_KEY ?? "dev";
const PHOENIX_READ_RPC_URL = getPhoenixReadRpcUrl();
const TX_RPC_URL = getTxRpcUrl();
const SHRED_PORT = resolveShredStreamPort();
const shredListener = new ShredStreamListener(
  SHRED_PORT,
  process.env.SHREDSTREAM_BIND_HOST?.trim() || "0.0.0.0",
);
let cachedReadRpcLatencyMs: number | null = null;
let watchSymbol = process.env.DEFAULT_SYMBOL ?? DEFAULT_SYMBOL;
const SYMBOL = () => watchSymbol;
const SERVER_POLL_MS = Number(process.env.SERVER_POLL_MS ?? 5000);

let walletCluster: SolanaCluster =
  process.env.SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet-beta";

const networkSnapshot = () =>
  NetworkConfigSchema.parse({
    walletCluster,
    tradingMode: bot.getConfig().mode,
    phoenixNetwork: "mainnet",
    shredStreamConfigured: Boolean(SHRED_PORT),
    gccUsesMainnet: true,
    phoenixApiHost: (
      process.env.PHOENIX_API_URL ?? "https://perp-api.phoenix.trade"
    )
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, ""),
    readRpcClass: classifyReadRpcUrl(PHOENIX_READ_RPC_URL),
    vpsPublicIp: process.env.VPS_PUBLIC_IP?.trim() || null,
  });

function healthPayload(lastError: string | null, phoenixPollLatencyMs: number | null) {
  const shred = shredListener.getStatus();
  const ws = phoenix.getWsStatus();
  return {
    phoenixConnected: lastError == null,
    phoenixWsConnected: ws.connected,
    phoenixWsSymbols: ws.symbols,
    phoenixPollLatencyMs,
    rpcLatencyMs: phoenixPollLatencyMs,
    readRpcLatencyMs: cachedReadRpcLatencyMs,
    shredStreamActive: shred.active,
    shredStreamListening: shred.listening,
    shredStreamPacketsPerMin: shred.packetsLastMinute,
    botStatus: bot.getStatus(),
    lastError,
  };
}

const phoenix = createGccPhoenixClient({
  rpcUrl: PHOENIX_READ_RPC_URL,
  apiUrl: process.env.PHOENIX_API_URL,
});

type CachedCandles = Awaited<ReturnType<typeof phoenix.getCandles>>;
const candleCache = new Map<string, { at: number; candles: CachedCandles }>();
const candleInflight = new Map<string, Promise<CachedCandles>>();

const CANDLE_TTL_MS: Record<string, number> = {
  "1m": 30_000,
  "5m": 60_000,
  "15m": 90_000,
  "30m": 120_000,
  "1h": 180_000,
  "4h": 300_000,
  "1d": 600_000,
};

function candleCacheKey(symbol: string, timeframe: string) {
  return `${symbol}:${timeframe}`;
}

function candleTtlMs(timeframe: string) {
  return CANDLE_TTL_MS[timeframe] ?? 60_000;
}

async function getCandlesCached(
  symbol: string,
  timeframe: string,
  limit = 120,
): Promise<CachedCandles> {
  const key = candleCacheKey(symbol, timeframe);
  const ttl = candleTtlMs(timeframe);
  const hit = candleCache.get(key);
  const now = Date.now();

  if (now < phoenixBackoffUntil && hit) {
    return hit.candles.slice(-limit);
  }
  if (hit && now - hit.at < ttl) {
    return hit.candles.slice(-limit);
  }

  const inflight = candleInflight.get(key);
  if (inflight) {
    const candles = await inflight;
    return candles.slice(-limit);
  }

  const promise = (async () => {
    try {
      const candles = await phoenix.getCandles(symbol, timeframe, 1000);
      candleCache.set(key, { at: Date.now(), candles });
      return candles;
    } catch (error) {
      const rateLimited = /429|rate.?limit|too many requests/i.test(
        String(error),
      );
      if (rateLimited) {
        phoenixBackoffUntil = Date.now() + 90_000;
        if (hit) return hit.candles;
        return [];
      }
      throw error;
    } finally {
      candleInflight.delete(key);
    }
  })();

  candleInflight.set(key, promise);
  const candles = await promise;
  return candles.slice(-limit);
}

let moversCache: { at: number; rows: unknown[] } | null = null;
const MOVERS_CACHE_MS = 60_000;
let phoenixBackoffUntil = 0;

const riskGate = new RiskGate(DEFAULT_RISK_LIMITS);
const trading = new TradingCore(
  phoenix,
  {
    readRpcUrl: PHOENIX_READ_RPC_URL,
    txRpcUrl: TX_RPC_URL,
    keypairPath: process.env.BOT_KEYPAIR_PATH,
  },
  riskGate,
);

const logs: Array<{ level: string; message: string; at: string }> = [];
const bootPaper = loadPaperStore();
const alerts: TradeAlert[] = [...(bootPaper.savedAlerts ?? [])];
let tradeHistory = bootPaper.historyTrades ?? [];
let lastAlertAt = 0;
let lastMarkPrice: number | null = null;
const clients = new Set<WebSocket>();

function broadcast(event: WsEvent) {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

const pushAlert = (partial: Omit<TradeAlert, "id" | "at">) => {
  const entry: TradeAlert = {
    ...partial,
    id: randomUUID(),
    at: new Date().toISOString(),
  };
  alerts.unshift(entry);
  if (alerts.length > 50) alerts.pop();
  broadcast({ type: "alert", data: entry });
  try {
    const store = loadPaperStore();
    savePaperStore({ ...store, savedAlerts: alerts.slice(0, 50) });
  } catch {
    // disk optional
  }
};

const pushLog = (level: "info" | "warn" | "error", message: string) => {
  const entry = { level, message, at: new Date().toISOString() };
  logs.unshift(entry);
  if (logs.length > 100) logs.pop();
  broadcast({ type: "log", data: entry });
  if (
    level === "info" &&
    (message.startsWith("TRADE") ||
      message.startsWith("Paper") ||
      message.includes("order"))
  ) {
    pushAlert({
      level: "signal",
      title: "Bot trade signal",
      message,
      symbol: SYMBOL(),
    });
  }
};

const bot = new BotEngine(
  trading,
  pushLog,
  async (symbol, timeframe, limit = 120) =>
    getCandlesCached(symbol, timeframe, limit),
  (trade) => {
    recordPriceTick(trade.symbol, trade.priceUsd, "trade");
    persistPaperState();
    broadcast({ type: "paper_trade", data: trade });
    void broadcastPaperPortfolio();
    broadcast({ type: "metrics", data: bot.getMetrics() });
  },
  async (symbol) => {
    const markets = await phoenix.listMarkets();
    const listing = markets.find((m) => m.symbol === symbol);
    if (!listing) return null;
    const detail = await phoenix.getMarketDetail(symbol);
    return fetchMarketBriefing({
      symbol,
      name: listing.name,
      coinGeckoId: listing.coinGeckoId,
      maxLeverage: listing.maxLeverage,
      markPriceUsd: detail.markPriceUsd,
    });
  },
);

function configForArm(): Omit<BotConfig, "status"> {
  const { status: _status, ...rest } = bot.getConfig();
  return rest;
}

function getAllPaperTrades() {
  return mergeTradeHistory(tradeHistory, bot.getPaperTrades());
}

async function getPaperPositionMark(): Promise<number | null> {
  const sym = bot.getPositionSymbol();
  if (!sym) return null;
  try {
    const market = await phoenix.getMarketSnapshot(sym);
    const mark = Number(market.markPriceUsd ?? 0);
    return mark > 0 ? mark : null;
  } catch {
    return null;
  }
}

async function getPaperPortfolioForClient() {
  const mark = await getPaperPositionMark();
  return bot.getPaperPortfolio(mark);
}

async function broadcastPaperPortfolio() {
  broadcast({
    type: "paper_portfolio",
    data: await getPaperPortfolioForClient(),
  });
}

/** Pause bot after manual fills so it does not immediately re-open the position. */
function pauseBotAfterManualTrade(reason: string) {
  if (bot.getStatus() === "running") {
    bot.pause();
    pushLog(
      "info",
      `Bot paused after manual trade (${reason}) — press Start on Bot page to resume automation`,
    );
  }
}

function sanitizeRestoredPaperSession(trades: typeof bootPaper.trades) {
  const snap = bot.exportPaperSession().portfolio;
  const bal = snap.balanceUsdc;
  const insane =
    !Number.isFinite(bal) ||
    bal > 10_000 ||
    bal < -1_000 ||
    (snap.positionSide !== "flat" &&
      snap.entryPriceUsd != null &&
      snap.entryPriceUsd > 0 &&
      snap.positionSizeBase > 0 &&
      snap.entryPriceUsd * snap.positionSizeBase > 50_000);

  if (insane) {
    pushLog(
      "warn",
      `Corrupted paper wallet ($${bal.toFixed(2)}) — auto-reset to $100. Use Bot → Reset if this repeats.`,
    );
    bot.resetPaper(100);
    bot.loadTradeHistory(trades);
    savePaperStore({
      trades: [],
      historyTrades: trades,
      portfolio: bot.exportPaperSession().portfolio,
      savedAt: new Date().toISOString(),
      arm: botArmState,
      savedAlerts: alerts.slice(0, 50),
    });
    return;
  }

  if (snap.positionSide !== "flat" && !snap.positionSymbol) {
    const inferred = inferPositionSymbolFromTrades(trades, snap.positionSide);
    if (inferred) {
      bot.restorePaperSession({
        trades,
        portfolio: { ...snap, positionSymbol: inferred },
      });
      pushLog("info", `Backfilled open position symbol: ${inferred}`);
      persistPaperState();
    }
  }
}

function persistPaperState() {
  const snap = bot.exportPaperSession();
  if (bot.getStatus() === "dead") {
    botArmState = null;
  }
  tradeHistory = mergeTradeHistory(tradeHistory, snap.trades);
  savePaperStore({
    trades: snap.trades,
    historyTrades: tradeHistory,
    portfolio: snap.portfolio,
    savedAt: new Date().toISOString(),
    arm: botArmState,
    savedAlerts: alerts.slice(0, 50),
  });
}

function setBotArmed(armed: boolean) {
  if (!armed) {
    botArmState = null;
  } else {
    botArmState = {
      armed: true,
      watchSymbol: SYMBOL(),
      config: configForArm(),
    };
  }
  persistPaperState();
}

let botArmState: BotArmSnapshot | null = bootPaper.arm ?? null;
bot.restorePaperSession({
  trades: bootPaper.trades,
  portfolio: bootPaper.portfolio,
});
bot.loadTradeHistory(
  mergeTradeHistory(bootPaper.historyTrades ?? [], bootPaper.trades),
);
sanitizeRestoredPaperSession(bootPaper.trades);
if (bootPaper.portfolio) {
  pushLog(
    "info",
    `Paper session restored from disk (${bootPaper.trades.length} trades, ${bootPaper.portfolio.positionSide})`,
  );
}

const app = new Hono();
app.use("/*", cors());

app.use("/api/*", async (c, next) => {
  const key = c.req.header("x-api-key");
  if (key !== API_KEY && process.env.NODE_ENV === "production") {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    bot: bot.getStatus(),
    wallet: trading.getBotPublicKey(),
  }),
);

app.get("/api/logs", (c) => c.json({ logs: logs.slice(0, 50) }));

app.get("/api/markets", async (c) => {
  try {
    return c.json(await phoenix.listMarkets());
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Markets fetch failed",
      },
      503,
    );
  }
});

app.get("/api/birdeye/mint/:symbol", async (c) => {
  try {
    const symbol = c.req.param("symbol").trim().toUpperCase();
    if (!symbol) return c.json({ error: "symbol required" }, 400);
    const markets = await phoenix.listMarkets();
    const listing = markets.find((m) => m.symbol === symbol);
    if (!listing) {
      return c.json(
        {
          symbol,
          mint: null,
          source: "none",
          reason: "unknown_symbol",
        } satisfies Awaited<ReturnType<typeof resolveBirdeyeMint>>,
        404,
      );
    }
    return c.json(
      await resolveBirdeyeMint(symbol, listing.coinGeckoId),
    );
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Birdeye mint resolve failed",
      },
      503,
    );
  }
});

app.get("/api/market/:symbol/briefing", async (c) => {
  try {
    const symbol = c.req.param("symbol").toUpperCase();
    const markets = await phoenix.listMarkets();
    const listing = markets.find((m) => m.symbol === symbol);
    if (!listing) return c.json({ error: "unknown symbol" }, 404);
    const detail = await phoenix.getMarketDetail(symbol);
    const briefing = await fetchMarketBriefing({
      symbol,
      name: listing.name,
      coinGeckoId: listing.coinGeckoId,
      maxLeverage: listing.maxLeverage,
      markPriceUsd: detail.markPriceUsd,
    });
    return c.json(briefing);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Briefing failed",
      },
      503,
    );
  }
});

app.get("/api/markets/movers", async (c) => {
  try {
    if (moversCache && Date.now() - moversCache.at < MOVERS_CACHE_MS) {
      return c.json(moversCache.rows);
    }
    const markets = await phoenix.listMarkets();
    const picks = ["JUP", "SOL", "WIF", "POPCAT", "BTC", "ETH"].filter((s) =>
      markets.some((m) => m.symbol === s),
    );
    const rows = await Promise.all(
      picks.map(async (symbol) => {
        const candles = await getCandlesCached(symbol, "5m", 24);
        if (candles.length < 5) return null;
        const highs = candles.map((x) => x.high);
        const lows = candles.map((x) => x.low);
        const max = Math.max(...highs);
        const min = Math.min(...lows);
        const vol = candles.reduce((a, x) => a + x.volume, 0);
        const rangePct = min > 0 ? ((max - min) / min) * 100 : 0;
        return { symbol, rangePct, volume: vol, bars: candles.length };
      }),
    );
    const sorted = rows
      .filter((r): r is NonNullable<typeof r> => r != null)
      .sort((a, b) => b.rangePct - a.rangePct);
    moversCache = { at: Date.now(), rows: sorted };
    return c.json(sorted);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Movers scan failed",
      },
      503,
    );
  }
});

app.get("/api/paper/portfolio", async (c) => {
  return c.json(await getPaperPortfolioForClient());
});

app.get("/api/paper/trades", (c) =>
  c.json({ trades: getAllPaperTrades() }),
);

app.get("/api/paper/replay", (c) => {
  const symbol = (c.req.query("symbol") ?? bot.getConfig().symbol).toUpperCase();
  const minutes = Number(c.req.query("minutes") ?? "5");
  const delaySec = Number(c.req.query("delaySec") ?? "0");
  return c.json(
    getPaperReplay({
      symbol,
      minutes,
      delaySec,
      trades: bot.getPaperTrades(),
    }),
  );
});

app.post("/api/paper/transfer", async (c) => {
  try {
    const body = (await c.req.json()) as {
      direction?: "deposit" | "withdraw";
      amountUsd?: number;
    };
    const direction = body.direction;
    const amount = Number(body.amountUsd);
    if (direction !== "deposit" && direction !== "withdraw") {
      return c.json({ error: "direction must be deposit or withdraw" }, 400);
    }
    const result = bot.transferFunds(direction, amount);
    if (!result.ok) {
      return c.json({ error: result.error }, 400);
    }
    persistPaperState();
    await broadcastPaperPortfolio();
    return c.json({
      message: result.message,
      moved: result.moved,
      portfolio: await getPaperPortfolioForClient(),
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Transfer failed" },
      400,
    );
  }
});

app.post("/api/paper/reset", async (c) => {
  clearPriceTape();
  bot.stop();
  bot.resetPaper(bot.getConfig().paperBalanceUsdc);
  tradeHistory = [];
  bot.loadTradeHistory([]);
  clearPaperStore({ wipeHistory: true });
  botArmState = null;
  persistPaperState();
  pushLog(
    "info",
    "Paper wallet reset to $100 — all open positions and trade history cleared",
  );
  await broadcastPaperPortfolio();
  return c.json(await getPaperPortfolioForClient());
});

app.get("/api/market/:symbol/detail", async (c) => {
  try {
    const symbol = c.req.param("symbol");
    return c.json(await phoenix.getMarketDetail(symbol));
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Market detail failed",
      },
      503,
    );
  }
});

app.get("/api/symbol", (c) => c.json({ symbol: watchSymbol }));

app.patch("/api/symbol", async (c) => {
  const body = (await c.req.json()) as { symbol?: string };
  const next = body.symbol?.trim().toUpperCase();
  if (!next) return c.json({ error: "symbol required" }, 400);
  watchSymbol = next;
  // Chart/scanner symbol only — do not touch bot config (avoids pause/start churn).
  lastMarkPrice = null;
  return c.json({ symbol: watchSymbol });
});

app.get("/api/market/:symbol", async (c) => {
  try {
    const symbol = c.req.param("symbol");
    return c.json(await phoenix.getMarketSnapshot(symbol));
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Market fetch failed",
      },
      503,
    );
  }
});

app.get("/api/orderbook/:symbol", async (c) => {
  try {
    const symbol = c.req.param("symbol");
    return c.json(await phoenix.getOrderbook(symbol));
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Orderbook fetch failed",
      },
      503,
    );
  }
});

app.get("/api/metrics", (c) => c.json(bot.getMetrics()));

app.get("/api/alerts", (c) => c.json(alerts));

app.get("/api/candles/:symbol", async (c) => {
  try {
    const symbol = c.req.param("symbol");
    const rawTf = c.req.query("timeframe") ?? "1m";
    const timeframe = normalizeCandleTimeframe(rawTf);
    if (rawTf !== timeframe) {
      return c.json(
        {
          error: `Phoenix does not support "${rawTf}" candles. Use ${timeframe} instead (supported: 1m, 5m, 15m, 30m, 1h, 4h, 1d).`,
          timeframe,
        },
        400,
      );
    }
    const limit = Number(c.req.query("limit") ?? "100");
    return c.json(await getCandlesCached(symbol, timeframe, limit));
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Candles failed" },
      503,
    );
  }
});

app.get("/api/ta/:symbol", async (c) => {
  try {
    const symbol = c.req.param("symbol");
    const timeframe = CandleTimeframeSchema.parse(
      c.req.query("timeframe") ?? "1m",
    );
    const strategy = BotStrategySchema.parse(
      c.req.query("strategy") ?? "trend_macd",
    );
    if (strategy === "manual") {
      return c.json({ trend: "flat", signal: null, reason: "Manual mode" });
    }
    const candles = await getCandlesCached(symbol, timeframe, 120);
    if (strategy === "wave_scalp" || strategy === "adaptive") {
      const paper = bot.getPaperPortfolio();
      if (strategy === "adaptive") {
        const structure = await getCandlesCached(symbol, "5m", 72);
        const cfg = bot.getConfig();
        return c.json(
          analyzeAdaptive(
            candles,
            paper.positionSide,
            paper.entryPriceUsd,
            {
              takerFeeBps: cfg.paperTakerFeeBps,
              intelProfile: cfg.intelProfile,
              trendTakeProfitPct: Math.max(1.8, cfg.takeProfitPct * 0.35),
              trendStopLossPct: Math.max(1, cfg.stopLossPct * 0.4),
              scalpTakeProfitPct: Math.min(1.5, cfg.takeProfitPct * 0.2),
              scalpStopLossPct: Math.min(1.2, cfg.stopLossPct * 0.25),
            },
            structure,
          ),
        );
      }
      return c.json(
        analyzeWaveScalp(candles, paper.positionSide, paper.entryPriceUsd, {
          takeProfitPct: bot.getConfig().takeProfitPct,
          stopLossPct: bot.getConfig().stopLossPct,
          swingLookback: 20,
          nearExtremePct: 0.35,
        }),
      );
    }
    return c.json(analyzeCandles(candles, strategy));
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "TA failed" },
      503,
    );
  }
});

app.get("/api/risk", (c) => c.json(riskGate.getLimits()));

app.get("/api/network", (c) =>
  c.json({
    ...networkSnapshot(),
    walletRpcUrl: getPublicWalletRpcUrl(walletCluster),
    walletRpcMasked: getPublicWalletRpcUrl(walletCluster),
    phoenixRpcMasked: maskRpcUrl(PHOENIX_READ_RPC_URL),
    txRpcMasked: maskRpcUrl(TX_RPC_URL),
    phoenixDataPath:
      "HTTP API (candles, orderbook, mark) — not Solana RPC",
  }),
);

app.get("/api/infra", async (c) =>
  c.json(await buildInfraStatus(shredListener.getStatus())),
);

app.patch("/api/network", async (c) => {
  const body = NetworkConfigSchema.partial()
    .extend({ walletCluster: SolanaClusterSchema.optional() })
    .parse(await c.req.json());
  if (body.walletCluster) walletCluster = body.walletCluster;
  if (body.tradingMode) bot.updateConfig({ mode: body.tradingMode });
  broadcast({
    type: "network",
    data: {
      ...networkSnapshot(),
      walletRpcUrl: getPublicWalletRpcUrl(walletCluster),
    },
  });
  return c.json({
    ...networkSnapshot(),
    walletRpcUrl: getPublicWalletRpcUrl(walletCluster),
    walletRpcMasked: getPublicWalletRpcUrl(walletCluster),
    phoenixRpcMasked: maskRpcUrl(PHOENIX_READ_RPC_URL),
    txRpcMasked: maskRpcUrl(TX_RPC_URL),
  });
});

app.patch("/api/risk", async (c) => {
  const body = RiskLimitsSchema.parse(await c.req.json());
  riskGate.setLimits(body);
  return c.json(riskGate.getLimits());
});

app.get("/api/bot", async (c) =>
  c.json({
    config: bot.getConfig(),
    status: bot.getStatus(),
    armed: botArmState?.armed === true,
    analysis: bot.getLastAnalysis(),
    briefing: bot.getBriefing(),
    paper: await getPaperPortfolioForClient(),
  }),
);

app.patch("/api/bot", async (c) => {
  const body = BotConfigSchema.partial().parse(await c.req.json());
  if (body.candleTimeframe) {
    body.candleTimeframe = normalizeCandleTimeframe(body.candleTimeframe);
  }
  bot.updateConfig(body);
  return c.json({ config: bot.getConfig(), status: bot.getStatus() });
});

app.post("/api/bot/start", async (c) => {
  const status = bot.getStatus();
  const stored = loadPaperStore();
  const hasOpenSession =
    stored.portfolio != null &&
    (stored.portfolio.positionSide !== "flat" || stored.trades.length > 0);

  if (status === "stopped" && hasOpenSession) {
    bot.restorePaperSession({
      trades: stored.trades,
      portfolio: stored.portfolio,
    });
  }

  const freshPaper = status === "paused" ? false : !hasOpenSession;
  setBotArmed(true);
  void bot.start({ freshPaper });
  return c.json({
    status: bot.getStatus(),
    armed: true,
    paper: await getPaperPortfolioForClient(),
  });
});

/** Fresh $100 JUP paper run — adaptive strategy, survival rules, then go. */
app.post("/api/bot/arm-overnight", async (c) => {
  bot.stop();
  watchSymbol = "JUP";
  bot.updateConfig({
    symbol: "JUP",
    mode: "paper",
    strategy: "adaptive",
    intelProfile: "aggressive",
    candleTimeframe: "1m",
    paperBalanceUsdc: 100,
    paperMinBalanceUsdc: 5,
    takeProfitPct: 7,
    stopLossPct: 4,
    paperLeverage: 2,
    pollIntervalMs: 12_000,
    warmupScanCount: 3,
  });
  tradeHistory = mergeTradeHistory(tradeHistory, bot.getPaperTrades());
  bot.resetPaper(100);
  bot.loadTradeHistory(tradeHistory);
  clearPriceTape("JUP");
  persistPaperState();
  await bot.start({ freshPaper: false });
  setBotArmed(true);
  pushLog(
    "info",
    "Overnight arm: JUP adaptive · aggressive conviction · $100 paper · dead below $5 equity",
  );
  broadcast({
    type: "paper_portfolio",
    data: bot.getPaperPortfolio(),
  });
  return c.json({
    status: bot.getStatus(),
    armed: true,
    config: bot.getConfig(),
    symbol: watchSymbol,
    paper: bot.getPaperPortfolio(),
  });
});

app.post("/api/bot/pause", (c) => {
  bot.pause();
  return c.json({ status: bot.getStatus(), armed: botArmState?.armed === true });
});

app.post("/api/bot/stop", (c) => {
  bot.stop();
  setBotArmed(false);
  return c.json({ status: bot.getStatus(), armed: false });
});

/** Toggle overnight auto-resume without stopping an active run. */
app.post("/api/bot/auto-resume", async (c) => {
  const body = (await c.req.json()) as { enabled?: boolean };
  if (typeof body.enabled !== "boolean") {
    return c.json({ error: "enabled (boolean) required" }, 400);
  }
  if (body.enabled) {
    setBotArmed(true);
    pushLog(
      "info",
      "Auto-resume ON — server restarts will restore this session (position, trades, settings)",
    );
  } else {
    setBotArmed(false);
    pushLog(
      "info",
      "Auto-resume OFF — server restarts will leave bot idle until you press Start",
    );
  }
  return c.json({
    armed: botArmState?.armed === true,
    status: bot.getStatus(),
    paper: bot.getPaperPortfolio(),
    config: bot.getConfig(),
  });
});

app.post("/api/orders", async (c) => {
  try {
    const body = PlaceOrderRequestSchema.parse(await c.req.json());
    const detail = await phoenix.getMarketDetail(body.symbol);
    const maxLev = detail.listing.maxLeverage ?? 1;
    const requested = body.leverage ?? 1;
    if (requested > maxLev) {
      return c.json(
        {
          error: `Leverage ${requested}x exceeds Phoenix max ${maxLev}x for ${body.symbol}`,
        },
        400,
      );
    }
    const market = await phoenix.getMarketSnapshot(body.symbol);
    const price = Number(
      body.priceUsd ?? market.markPriceUsd ?? market.bestAsk ?? 0,
    );
    const portfolio = bot.getPaperPortfolio(price);
    await trading.buildOrder(body, {
      priceUsd: price,
      leverage: requested,
      collateralUsd: portfolio.balanceUsdc,
      currentPositionNotionalUsd: portfolio.notionalUsd ?? 0,
    });

    if (body.mode === "paper") {
      const exec = bot.executeManualPaperOrder(body, price);
      if (exec.error || !exec.trade) {
        return c.json({ error: exec.error ?? "Paper fill failed" }, 400);
      }
      pauseBotAfterManualTrade(exec.trade.action.startsWith("close") ? "close" : "open");
      persistPaperState();
      broadcast({ type: "paper_trade", data: exec.trade });
      await broadcastPaperPortfolio();
      broadcast({ type: "metrics", data: bot.getMetrics() });
      return c.json({
        mode: "paper",
        simulationOnly: false,
        message: exec.receipt,
        receipt: exec.receipt,
        trade: exec.trade,
        portfolio: bot.getPaperPortfolio(price),
      });
    }

    const result = await trading.buildOrder(body, {
      priceUsd: price,
      leverage: requested,
    });
    return c.json(result);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Order failed" },
      400,
    );
  }
});

app.post("/api/paper/close", async (c) => {
  try {
    const body = (await c.req.json()) as { symbol?: string };
    const posSym = bot.getPositionSymbol();
    const symbol = (body.symbol ?? posSym ?? bot.getConfig().symbol).toUpperCase();
    const markSym = posSym ?? symbol;
    const market = await phoenix.getMarketSnapshot(markSym);
    const price = Number(market.markPriceUsd ?? market.bestAsk ?? 0);
    const exec = bot.closePaperPosition(symbol, price);
    if (exec.error || !exec.trade) {
      return c.json({ error: exec.error ?? "Close failed" }, 400);
    }
    pauseBotAfterManualTrade("close");
    persistPaperState();
    broadcast({ type: "paper_trade", data: exec.trade });
    await broadcastPaperPortfolio();
    broadcast({ type: "metrics", data: bot.getMetrics() });
    return c.json({
      message: exec.receipt,
      receipt: exec.receipt,
      trade: exec.trade,
      portfolio: bot.getPaperPortfolio(price),
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Close failed" },
      400,
    );
  }
});

app.post("/api/orders/simulate", async (c) => {
  const { txBase64 } = (await c.req.json()) as { txBase64: string };
  const sim = await trading.simulateSerializedTx(txBase64);
  return c.json(sim.value);
});

const server = createServer(getRequestListener(app.fetch));
const wss = new WebSocketServer({ server, path: "/ws" });
server.listen(PORT);

pushLog(
  "info",
  botArmState?.armed
    ? "Armed bot will auto-resume after this boot"
    : "Bot idle on startup — no scans or trades until you press Start on the Bot page",
);

/** Resume overnight / armed runs after tsx watch or deploy restarts the API process. */
async function resumeArmedBotIfNeeded() {
  if (!botArmState?.armed) return;

  watchSymbol = botArmState.watchSymbol;
  bot.updateConfig(botArmState.config);
  bot.restorePaperSession({
    trades: bootPaper.trades,
    portfolio: bootPaper.portfolio,
  });

  try {
    await bot.start({ freshPaper: false });
    pushLog(
      "info",
      `Bot auto-resumed (${botArmState.config.strategy} · ${botArmState.config.symbol} · ${botArmState.config.pollIntervalMs}ms poll)`,
    );
    broadcast({ type: "metrics", data: bot.getMetrics() });
    broadcast({
      type: "paper_portfolio",
      data: bot.getPaperPortfolio(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    pushLog("error", `Armed auto-resume failed: ${msg}`);
  }
}

void resumeArmedBotIfNeeded();

wss.on("connection", (ws) => {
  clients.add(ws);
  const snapshot: WsEvent[] = [
    { type: "metrics", data: bot.getMetrics() },
    {
      type: "paper_portfolio",
      data: bot.getPaperPortfolio(),
    },
    {
      type: "health",
      data: healthPayload(null, null),
    },
    { type: "network", data: { ...networkSnapshot(), walletRpcUrl: getPublicWalletRpcUrl(walletCluster) } },
  ];
  for (const event of snapshot) {
    ws.send(JSON.stringify(event));
  }
  for (const entry of logs.slice(0, 20)) {
    ws.send(JSON.stringify({ type: "log", data: entry }));
  }
  for (const trade of getAllPaperTrades()) {
    ws.send(JSON.stringify({ type: "paper_trade", data: trade }));
  }
  for (const alert of alerts.slice(0, 20)) {
    ws.send(JSON.stringify({ type: "alert", data: alert }));
  }
  ws.on("close", () => clients.delete(ws));
});

async function pollLoop() {
  await phoenix.ready();
  pushLog("info", "Phoenix client ready");

  const warmSymbols = new Set<string>();
  const warmStreams = async () => {
    const symbols = [SYMBOL(), bot.getConfig().symbol];
    for (const sym of symbols) {
      if (!sym || warmSymbols.has(sym)) continue;
      warmSymbols.add(sym);
      try {
        await phoenix.ensureSymbolStream(sym);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        pushLog("warn", `Phoenix WS warm-up failed for ${sym}: ${msg}`);
      }
    }
    const ws = phoenix.getWsStatus();
    pushLog(
      "info",
      `Phoenix WebSocket ${ws.connected ? "live" : "connecting"} · ${ws.symbols.join(", ") || "no streams"}`,
    );
  };
  await warmStreams();

  setInterval(async () => {
    const start = Date.now();
    try {
      const uiSymbol = SYMBOL();
      const botSymbol = bot.getConfig().symbol;
      if (!warmSymbols.has(uiSymbol)) warmSymbols.add(uiSymbol);
      if (!warmSymbols.has(botSymbol)) warmSymbols.add(botSymbol);
      await Promise.all([
        phoenix.ensureSymbolStream(uiSymbol).catch(() => {}),
        uiSymbol !== botSymbol
          ? phoenix.ensureSymbolStream(botSymbol).catch(() => {})
          : Promise.resolve(),
      ]);

      let market;
      let orderbook;
      let botMark = 0;
      if (uiSymbol === botSymbol) {
        const feed = await phoenix.getLiveFeed(uiSymbol);
        bot.onMarketUpdate(feed.market);
        bot.onOrderbookUpdate(feed.orderbook);
        market = feed.market;
        orderbook = feed.orderbook;
        botMark = Number(feed.market.markPriceUsd ?? 0);
      } else {
        const [botFeed, uiFeed] = await Promise.all([
          phoenix.getLiveFeed(botSymbol),
          phoenix.getLiveFeed(uiSymbol),
        ]);
        bot.onMarketUpdate(botFeed.market);
        bot.onOrderbookUpdate(botFeed.orderbook);
        market = uiFeed.market;
        orderbook = uiFeed.orderbook;
        botMark = Number(botFeed.market.markPriceUsd ?? 0);
      }

      broadcast({ type: "orderbook", data: orderbook });
      const mark = Number(market.markPriceUsd ?? 0);
      const now = Date.now();
      if (lastMarkPrice && mark && now - lastAlertAt > 60_000) {
        const pct = ((mark - lastMarkPrice) / lastMarkPrice) * 100;
        if (Math.abs(pct) >= 0.35) {
          pushAlert({
            level: "info",
            title: `${uiSymbol} ${pct > 0 ? "rally" : "dip"} ${Math.abs(pct).toFixed(2)}%`,
            message: `${formatPriceUsd(lastMarkPrice)} → ${formatPriceUsd(mark)} (${SERVER_POLL_MS}ms tick)`,
            symbol: uiSymbol,
          });
          lastAlertAt = now;
        }
      }
      if (mark) lastMarkPrice = mark;
      if (botMark) recordPriceTick(botSymbol, botMark, "poll");
      if (uiSymbol !== botSymbol && mark) {
        recordPriceTick(uiSymbol, mark, "poll");
      }
      const latency = Date.now() - start;
      broadcast({ type: "market", data: market });
      broadcast({ type: "metrics", data: bot.getMetrics() });
      await broadcastPaperPortfolio();
      broadcast({
        type: "health",
        data: healthPayload(null, latency),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Phoenix poll failed";
      broadcast({
        type: "health",
        data: healthPayload(message, null),
      });
    }
  }, SERVER_POLL_MS);
}

async function bootInfra() {
  shredListener.start();
  const shred = shredListener.getStatus();
  if (shred.configured) {
    pushLog(
      "info",
      `ShredStream listener on UDP :${shred.port} — waiting for Triton packets (register VPS IP with Triton)`,
    );
  }

  cachedReadRpcLatencyMs = await probeReadRpcLatency(PHOENIX_READ_RPC_URL);
  const infra = await buildInfraStatus(shredListener.getStatus());
  pushLog(
    "info",
    `Data path: Phoenix WebSocket (mark + L2) with REST fallback · candles via HTTP (${infra.phoenixApiHost})`,
  );
  pushLog(
    "info",
    `Read RPC: ${infra.readRpcMasked} (${infra.readRpcClass})${
      cachedReadRpcLatencyMs != null ? ` · ${cachedReadRpcLatencyMs}ms` : ""
    }`,
  );
  pushLog(
    "info",
    `Tx RPC: ${infra.txRpcMasked} (${infra.txRpcIsHelius ? "Helius" : "public"}) — send only`,
  );
  for (const warning of infra.warnings) {
    pushLog("warn", warning);
  }
}

void pollLoop();
void bootInfra();

console.log(`GCC server listening on http://localhost:${PORT}`);
console.log(
  `Phoenix market data: WebSocket (mark + orderbook) · REST candles (${process.env.PHOENIX_API_URL ?? "https://perp-api.phoenix.trade"})`,
);
console.log(`Read RPC (Rise bootstrap only): ${maskRpcUrl(PHOENIX_READ_RPC_URL)}`);
console.log(
  `Tx RPC (send only): ${TX_RPC_URL.includes("api-key") ? "Helius configured" : TX_RPC_URL}`,
);
if (SHRED_PORT) {
  console.log(`ShredStream UDP listener: :${SHRED_PORT}`);
}
