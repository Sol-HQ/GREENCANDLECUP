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
  type TradeAlert,
  type WsEvent,
  type SolanaCluster,
} from "@gcc/shared";
import { analyzeCandles, analyzeWaveScalp } from "@gcc/ta";
import { RiskGate } from "@gcc/risk";
import {
  getPhoenixReadRpcUrl,
  getPublicWalletRpcUrl,
  getTxRpcUrl,
  maskRpcUrl,
  validateRpcRoutingAtStartup,
} from "./env.js";

validateRpcRoutingAtStartup();

const PORT = Number(process.env.PORT ?? 8787);
const API_KEY = process.env.API_KEY ?? "dev";
const PHOENIX_READ_RPC_URL = getPhoenixReadRpcUrl();
const TX_RPC_URL = getTxRpcUrl();
let watchSymbol = process.env.DEFAULT_SYMBOL ?? DEFAULT_SYMBOL;
const SYMBOL = () => watchSymbol;
const SERVER_POLL_MS = Number(process.env.SERVER_POLL_MS ?? 3000);

let walletCluster: SolanaCluster =
  process.env.SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet-beta";

const networkSnapshot = () =>
  NetworkConfigSchema.parse({
    walletCluster,
    tradingMode: bot.getConfig().mode,
    phoenixNetwork: "mainnet",
    shredStreamConfigured: Boolean(process.env.SHREDSTREAM_UDP_PORT),
    gccUsesMainnet: true,
  });

const phoenix = createGccPhoenixClient({
  rpcUrl: PHOENIX_READ_RPC_URL,
  apiUrl: process.env.PHOENIX_API_URL,
});

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
const alerts: TradeAlert[] = [];
let lastAlertAt = 0;
let lastMarkPrice: number | null = null;

const pushAlert = (partial: Omit<TradeAlert, "id" | "at">) => {
  const entry: TradeAlert = {
    ...partial,
    id: randomUUID(),
    at: new Date().toISOString(),
  };
  alerts.unshift(entry);
  if (alerts.length > 50) alerts.pop();
  broadcast({ type: "alert", data: entry });
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
    phoenix.getCandles(symbol, timeframe, limit),
  (trade) => {
    broadcast({ type: "paper_trade", data: trade });
    broadcast({
      type: "paper_portfolio",
      data: bot.getPaperPortfolio(),
    });
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
    const markets = await phoenix.listMarkets();
    const picks = ["JUP", "SOL", "WIF", "POPCAT", "BTC", "ETH"].filter((s) =>
      markets.some((m) => m.symbol === s),
    );
    const rows = await Promise.all(
      picks.map(async (symbol) => {
        const candles = await phoenix.getCandles(symbol, "5m", 24);
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
    return c.json(
      rows
        .filter((r): r is NonNullable<typeof r> => r != null)
        .sort((a, b) => b.rangePct - a.rangePct),
    );
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Movers scan failed",
      },
      503,
    );
  }
});

app.get("/api/paper/portfolio", (c) =>
  c.json(bot.getPaperPortfolio()),
);

app.get("/api/paper/trades", (c) => c.json({ trades: bot.getPaperTrades() }));

app.post("/api/paper/reset", (c) => {
  bot.updateConfig({
    paperBalanceUsdc: bot.getConfig().paperBalanceUsdc,
  });
  return c.json(bot.getPaperPortfolio());
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
  bot.updateConfig({ symbol: next });
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
    return c.json(await phoenix.getCandles(symbol, timeframe, limit));
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
    const candles = await phoenix.getCandles(symbol, timeframe, 120);
    if (strategy === "wave_scalp") {
      const paper = bot.getPaperPortfolio();
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
  }),
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

app.get("/api/bot", (c) =>
  c.json({
    config: bot.getConfig(),
    status: bot.getStatus(),
    analysis: bot.getLastAnalysis(),
    briefing: bot.getBriefing(),
    paper: bot.getPaperPortfolio(),
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

app.post("/api/bot/start", (c) => {
  void bot.start();
  return c.json({ status: bot.getStatus() });
});

app.post("/api/bot/pause", (c) => {
  bot.pause();
  return c.json({ status: bot.getStatus() });
});

app.post("/api/bot/stop", (c) => {
  bot.stop();
  return c.json({ status: bot.getStatus() });
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

app.post("/api/orders/simulate", async (c) => {
  const { txBase64 } = (await c.req.json()) as { txBase64: string };
  const sim = await trading.simulateSerializedTx(txBase64);
  return c.json(sim.value);
});

const server = createServer(getRequestListener(app.fetch));
const wss = new WebSocketServer({ server, path: "/ws" });
server.listen(PORT);

const clients = new Set<WebSocket>();

function broadcast(event: WsEvent) {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

wss.on("connection", (ws) => {
  clients.add(ws);
  const snapshot: WsEvent[] = [
    { type: "metrics", data: bot.getMetrics() },
    {
      type: "health",
      data: {
        phoenixConnected: true,
        phoenixPollLatencyMs: null,
        rpcLatencyMs: null,
        shredStreamActive: false,
        botStatus: bot.getStatus(),
        lastError: null,
      },
    },
    { type: "network", data: { ...networkSnapshot(), walletRpcUrl: getPublicWalletRpcUrl(walletCluster) } },
  ];
  for (const event of snapshot) {
    ws.send(JSON.stringify(event));
  }
  for (const entry of logs.slice(0, 20)) {
    ws.send(JSON.stringify({ type: "log", data: entry }));
  }
  ws.on("close", () => clients.delete(ws));
});

async function pollLoop() {
  await phoenix.ready();
  pushLog("info", "Phoenix client ready");

  setInterval(async () => {
    const start = Date.now();
    try {
      const uiSymbol = SYMBOL();
      const botSymbol = bot.getConfig().symbol;

      let market;
      let orderbook;
      if (uiSymbol === botSymbol) {
        const feed = await phoenix.getLiveFeed(uiSymbol);
        bot.onMarketUpdate(feed.market);
        market = feed.market;
        orderbook = feed.orderbook;
      } else {
        const [botFeed, uiFeed] = await Promise.all([
          phoenix.getLiveFeed(botSymbol),
          phoenix.getLiveFeed(uiSymbol),
        ]);
        bot.onMarketUpdate(botFeed.market);
        market = uiFeed.market;
        orderbook = uiFeed.orderbook;
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
      const latency = Date.now() - start;
      broadcast({ type: "market", data: market });
      broadcast({ type: "metrics", data: bot.getMetrics() });
      broadcast({
        type: "health",
        data: {
          phoenixConnected: true,
          phoenixPollLatencyMs: latency,
          rpcLatencyMs: latency,
          shredStreamActive: false,
          botStatus: bot.getStatus(),
          lastError: null,
        },
      });
    } catch (error) {
      broadcast({
        type: "health",
        data: {
          phoenixConnected: false,
          phoenixPollLatencyMs: null,
          rpcLatencyMs: null,
          shredStreamActive: false,
          botStatus: bot.getStatus(),
          lastError:
            error instanceof Error ? error.message : "Phoenix poll failed",
        },
      });
    }
  }, SERVER_POLL_MS);
}

void pollLoop();

console.log(`GCC server listening on http://localhost:${PORT}`);
console.log(`Phoenix data: HTTP API + read RPC (${PHOENIX_READ_RPC_URL})`);
console.log(`Tx RPC (send only): ${TX_RPC_URL.includes("api-key") ? "Helius configured" : TX_RPC_URL}`);
