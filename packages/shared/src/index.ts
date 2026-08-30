import { z } from "zod";

export const COMPETITION_WALLET =
  "iamaaZQHyc1FZkaqCFKhDuSt5JyLZYbveHUkAcWyFoA";

export const GCC_START = new Date("2026-09-01T14:00:00.000Z"); // Sep 1 10 AM EST
export const GCC_END = new Date("2026-09-08T14:00:00.000Z");

export const OrderSideSchema = z.enum(["buy", "sell"]);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const OrderTypeSchema = z.enum(["market", "limit"]);
export type OrderType = z.infer<typeof OrderTypeSchema>;

export const TradeModeSchema = z.enum(["paper", "live"]);
export type TradeMode = z.infer<typeof TradeModeSchema>;

export const BotStatusSchema = z.enum([
  "stopped",
  "running",
  "paused",
  "error",
]);
export type BotStatus = z.infer<typeof BotStatusSchema>;

export const RiskLimitsSchema = z.object({
  maxPositionNotionalUsd: z.number().positive().default(500),
  maxOrderNotionalUsd: z.number().positive().default(100),
  maxDailyLossUsd: z.number().positive().default(25),
  maxLeverage: z.number().positive().default(5),
  minCollateralBufferUsd: z.number().nonnegative().default(20),
});
export type RiskLimits = z.infer<typeof RiskLimitsSchema>;

export const BotConfigSchema = z.object({
  symbol: z.string().default("SOL"),
  mode: TradeModeSchema.default("paper"),
  status: BotStatusSchema.default("stopped"),
  strategy: z.enum(["momentum", "mean_reversion", "manual"]).default("momentum"),
  pollIntervalMs: z.number().int().positive().default(5000),
});
export type BotConfig = z.infer<typeof BotConfigSchema>;

export const PlaceOrderRequestSchema = z.object({
  symbol: z.string(),
  side: OrderSideSchema,
  type: OrderTypeSchema,
  sizeBase: z.string(),
  priceUsd: z.string().optional(),
  mode: TradeModeSchema.default("paper"),
});
export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequestSchema>;

export const GccMetricsSchema = z.object({
  volumeUsd: z.number().nonnegative(),
  realizedPnlUsd: z.number(),
  unrealizedPnlUsd: z.number(),
  tradeCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});
export type GccMetrics = z.infer<typeof GccMetricsSchema>;

export const SystemHealthSchema = z.object({
  phoenixConnected: z.boolean(),
  rpcLatencyMs: z.number().nullable(),
  shredStreamActive: z.boolean(),
  botStatus: BotStatusSchema,
  lastError: z.string().nullable(),
});
export type SystemHealth = z.infer<typeof SystemHealthSchema>;

export const MarketSnapshotSchema = z.object({
  symbol: z.string(),
  markPriceUsd: z.string().nullable(),
  fundingRate: z.string().nullable(),
  bestBid: z.string().nullable(),
  bestAsk: z.string().nullable(),
  updatedAt: z.string(),
});
export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>;

export const OrderbookLevelSchema = z.object({
  price: z.string(),
  size: z.string(),
});
export type OrderbookLevel = z.infer<typeof OrderbookLevelSchema>;

export const OrderbookSnapshotSchema = z.object({
  symbol: z.string(),
  bids: z.array(OrderbookLevelSchema),
  asks: z.array(OrderbookLevelSchema),
  updatedAt: z.string(),
});
export type OrderbookSnapshot = z.infer<typeof OrderbookSnapshotSchema>;

export const PositionViewSchema = z.object({
  symbol: z.string(),
  side: z.enum(["long", "short", "flat"]),
  sizeBase: z.string(),
  entryPriceUsd: z.string().nullable(),
  markPriceUsd: z.string().nullable(),
  unrealizedPnlUsd: z.string(),
});
export type PositionView = z.infer<typeof PositionViewSchema>;

export const OpenOrderViewSchema = z.object({
  orderId: z.string(),
  symbol: z.string(),
  side: OrderSideSchema,
  priceUsd: z.string(),
  sizeBase: z.string(),
  filledBase: z.string(),
});
export type OpenOrderView = z.infer<typeof OpenOrderViewSchema>;

export const WsEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("market"), data: MarketSnapshotSchema }),
  z.object({ type: z.literal("orderbook"), data: OrderbookSnapshotSchema }),
  z.object({ type: z.literal("metrics"), data: GccMetricsSchema }),
  z.object({ type: z.literal("health"), data: SystemHealthSchema }),
  z.object({ type: z.literal("positions"), data: z.array(PositionViewSchema) }),
  z.object({ type: z.literal("orders"), data: z.array(OpenOrderViewSchema) }),
  z.object({ type: z.literal("log"), data: z.object({ level: z.string(), message: z.string(), at: z.string() }) }),
]);
export type WsEvent = z.infer<typeof WsEventSchema>;

export const DEFAULT_RISK_LIMITS: RiskLimits = RiskLimitsSchema.parse({});

export const DEFAULT_BOT_CONFIG: BotConfig = BotConfigSchema.parse({});
