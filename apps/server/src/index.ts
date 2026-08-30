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
import { createGccPhoenixClient } from "@gcc/phoenix-client";
import { TradingCore } from "@gcc/trading-core";
import { BotEngine } from "@gcc/bot-engine";
import { randomUUID } from "node:crypto";
import {
  BotConfigSchema,
  BotStrategySchema,
  CandleTimeframeSchema,
  DEFAULT_RISK_LIMITS,
  NetworkConfigSchema,
  PlaceOrderRequestSchema,
  RiskLimitsSchema,
  SolanaClusterSchema,
  type TradeAlert,
  type WsEvent,
  type SolanaCluster,
} from "@gcc/shared";
import { analyzeCandles } from "@gcc/ta";
import { RiskGate } from "@gcc/risk";
import { getHeliusRpcUrl, maskRpcUrl } from "./env.js";

const PORT = Number(process.env.PORT ?? 8787);
const API_KEY = process.env.API_KEY ?? "dev";
const RPC_URL = getHeliusRpcUrl();
const SYMBOL = "SOL";
const SERVER_POLL_MS = Number(process.env.SERVER_POLL_MS ?? 1000);

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
  rpcUrl: RPC_URL,
  apiUrl: process.env.PHOENIX_API_URL,
});

const riskGate = new RiskGate(DEFAULT_RISK_LIMITS);
const trading = new TradingCore(
  phoenix,
  {
    rpcUrl: RPC_URL,
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
    (message.startsWith("Paper") || message.includes("order"))
  ) {
    pushAlert({
      level: "signal",
      title: "Bot trade signal",
      message,
      symbol: SYMBOL,
    });
  }
};

const bot = new BotEngine(
  trading,
  pushLog,
  async (symbol, timeframe, limit = 120) =>
    phoenix.getCandles(symbol, timeframe, limit),
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
    const timeframe = c.req.query("timeframe") ?? "15m";
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
    walletRpcUrl: getHeliusRpcUrl(walletCluster),
    walletRpcMasked: maskRpcUrl(getHeliusRpcUrl(walletCluster)),
    botRpcMasked: maskRpcUrl(RPC_URL),
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
      walletRpcUrl: getHeliusRpcUrl(walletCluster),
    },
  });
  return c.json({
    ...networkSnapshot(),
    walletRpcUrl: getHeliusRpcUrl(walletCluster),
    walletRpcMasked: maskRpcUrl(getHeliusRpcUrl(walletCluster)),
    botRpcMasked: maskRpcUrl(RPC_URL),
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
  }),
);

app.patch("/api/bot", async (c) => {
  const body = BotConfigSchema.partial().parse(await c.req.json());
  bot.updateConfig(body);
  return c.json({ config: bot.getConfig(), status: bot.getStatus() });
});

app.post("/api/bot/start", (c) => {
  bot.start();
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
    const market = await phoenix.getMarketSnapshot(body.symbol);
    const price = Number(
      body.priceUsd ?? market.markPriceUsd ?? market.bestAsk ?? 0,
    );
    const result = await trading.buildOrder(body, { priceUsd: price });
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
  ws.on("close", () => clients.delete(ws));
});

async function pollLoop() {
  await phoenix.ready();
  pushLog("info", "Phoenix client ready");

  phoenix.subscribeOrderbook(SYMBOL, (book) => {
    broadcast({ type: "orderbook", data: book });
  });

  setInterval(async () => {
    const start = Date.now();
    try {
      const market = await phoenix.getMarketSnapshot(SYMBOL);
      bot.onMarketUpdate(market);
      const mark = Number(market.markPriceUsd ?? 0);
      const now = Date.now();
      if (lastMarkPrice && mark && now - lastAlertAt > 60_000) {
        const pct = ((mark - lastMarkPrice) / lastMarkPrice) * 100;
        if (Math.abs(pct) >= 0.35) {
          pushAlert({
            level: "info",
            title: `SOL ${pct > 0 ? "rally" : "dip"} ${Math.abs(pct).toFixed(2)}%`,
            message: `$${lastMarkPrice.toFixed(2)} → $${mark.toFixed(2)} (${SERVER_POLL_MS}ms tick)`,
            symbol: SYMBOL,
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
console.log(`Helius RPC: ${RPC_URL.includes("api-key") ? "configured" : RPC_URL}`);
