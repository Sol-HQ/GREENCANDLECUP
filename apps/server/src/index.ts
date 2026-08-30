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
import {
  BotConfigSchema,
  DEFAULT_RISK_LIMITS,
  PlaceOrderRequestSchema,
  RiskLimitsSchema,
  type WsEvent,
} from "@gcc/shared";
import { RiskGate } from "@gcc/risk";
import { getHeliusRpcUrl } from "./env.js";

const PORT = Number(process.env.PORT ?? 8787);
const API_KEY = process.env.API_KEY ?? "dev";
const RPC_URL = getHeliusRpcUrl();
const SYMBOL = "SOL";

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
const pushLog = (level: "info" | "warn" | "error", message: string) => {
  const entry = { level, message, at: new Date().toISOString() };
  logs.unshift(entry);
  if (logs.length > 100) logs.pop();
  broadcast({ type: "log", data: entry });
};

const bot = new BotEngine(trading, pushLog);

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

app.get("/api/risk", (c) => c.json(riskGate.getLimits()));

app.patch("/api/risk", async (c) => {
  const body = RiskLimitsSchema.parse(await c.req.json());
  riskGate.setLimits(body);
  return c.json(riskGate.getLimits());
});

app.get("/api/bot", (c) =>
  c.json({ config: bot.getConfig(), status: bot.getStatus() }),
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
  }, 5000);
}

void pollLoop();

console.log(`GCC server listening on http://localhost:${PORT}`);
console.log(`Helius RPC: ${RPC_URL.includes("api-key") ? "configured" : RPC_URL}`);
