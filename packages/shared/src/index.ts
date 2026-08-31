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
  "dead",
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

export const PHOENIX_CANDLE_TIMEFRAMES = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
] as const;

export const CandleTimeframeSchema = z.enum(PHOENIX_CANDLE_TIMEFRAMES);
export type CandleTimeframe = z.infer<typeof CandleTimeframeSchema>;

/** Phoenix rejects 15s/30s — map legacy picks to the nearest supported bar. */
export function normalizeCandleTimeframe(
  timeframe: string,
): CandleTimeframe {
  if (timeframe === "15s" || timeframe === "30s") return "1m";
  const parsed = CandleTimeframeSchema.safeParse(timeframe);
  return parsed.success ? parsed.data : "1m";
}

export const SolanaClusterSchema = z.enum(["mainnet-beta", "devnet"]);
export type SolanaCluster = z.infer<typeof SolanaClusterSchema>;

export const NetworkConfigSchema = z.object({
  walletCluster: SolanaClusterSchema.default("mainnet-beta"),
  tradingMode: TradeModeSchema.default("paper"),
  phoenixNetwork: z.literal("mainnet").default("mainnet"),
  shredStreamConfigured: z.boolean().default(false),
  gccUsesMainnet: z.literal(true).default(true),
  phoenixApiHost: z.string().optional(),
  readRpcClass: z.enum(["public", "dedicated", "helius"]).optional(),
  vpsPublicIp: z.string().nullable().optional(),
});
export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;

export const BotStrategySchema = z.enum([
  "adaptive",
  "wave_scalp",
  "trend_macd",
  "pullback",
  "momentum",
  "mean_reversion",
  "manual",
]);
export type BotStrategy = z.infer<typeof BotStrategySchema>;

export const BotIntelProfileSchema = z.enum([
  "conservative",
  "balanced",
  "aggressive",
]);
export type BotIntelProfile = z.infer<typeof BotIntelProfileSchema>;

export const BotConfigSchema = z.object({
  symbol: z.string().default("JUP"),
  mode: TradeModeSchema.default("paper"),
  status: BotStatusSchema.default("stopped"),
  strategy: BotStrategySchema.default("adaptive"),
  /** How much conviction (0–100) the bot needs before opening — adaptive only. */
  intelProfile: BotIntelProfileSchema.default("balanced"),
  candleTimeframe: CandleTimeframeSchema.default("1m"),
  pollIntervalMs: z.number().int().positive().default(5000),
  paperBalanceUsdc: z.number().positive().default(100),
  paperMinBalanceUsdc: z.number().nonnegative().default(5),
  takeProfitPct: z.number().positive().max(50).default(7),
  stopLossPct: z.number().positive().max(50).default(4),
  paperLeverage: z.number().positive().max(20).default(2),
  paperTakerFeeBps: z.number().int().nonnegative().default(5),
  warmupScanCount: z.number().int().nonnegative().default(3),
});
export type BotConfig = z.infer<typeof BotConfigSchema>;

export const PlaceOrderRequestSchema = z.object({
  symbol: z.string(),
  side: OrderSideSchema,
  type: OrderTypeSchema,
  sizeBase: z.string(),
  priceUsd: z.string().optional(),
  mode: TradeModeSchema.default("paper"),
  slippageBps: z.number().int().min(1).max(5000).optional(),
  leverage: z.number().positive().max(100).optional(),
  reduceOnly: z.boolean().optional(),
  postOnly: z.boolean().optional(),
});
export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequestSchema>;

export const PaperTradeRecordSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  action: z.enum(["open_long", "close_long", "open_short", "close_short"]),
  priceUsd: z.number(),
  sizeBase: z.number(),
  notionalUsd: z.number(),
  pnlUsd: z.number().nullable(),
  balanceUsdc: z.number(),
  reason: z.string(),
  at: z.string(),
  barTime: z.number(),
});
export type PaperTradeRecord = z.infer<typeof PaperTradeRecordSchema>;

export const PaperPortfolioStateSchema = z.object({
  startingBalanceUsdc: z.number(),
  balanceUsdc: z.number(),
  equityUsdc: z.number(),
  minBalanceUsdc: z.number(),
  alive: z.boolean(),
  positionSide: z.enum(["flat", "long", "short"]),
  positionSizeBase: z.number(),
  entryPriceUsd: z.number().nullable(),
  leverage: z.number(),
  unrealizedPnlUsd: z.number(),
  tradeCount: z.number().int(),
  updatedAt: z.string(),
  markPriceUsd: z.number().nullable(),
  marginUsd: z.number().nullable(),
  notionalUsd: z.number().nullable(),
  unrealizedPnlPctOnMargin: z.number().nullable(),
  nextTradeMarginUsd: z.number(),
  nextTradeNotionalUsd: z.number(),
  nextTradeSizeBase: z.number().nullable(),
});

export const MarketBriefingSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  coinGeckoId: z.string().nullable(),
  summary: z.string(),
  spotPriceUsd: z.string().nullable(),
  marketCapUsd: z.number().nullable(),
  volume24hUsd: z.number().nullable(),
  change24hPct: z.number().nullable(),
  change7dPct: z.number().nullable(),
  athUsd: z.number().nullable(),
  atlUsd: z.number().nullable(),
  genesisDate: z.string().nullable(),
  phoenixMaxLeverage: z.number().nullable(),
  fetchedAt: z.string(),
});
export type MarketBriefing = z.infer<typeof MarketBriefingSchema>;

export const TradeSettingsSchema = z.object({
  slippageBps: z.number().int().min(1).max(5000).default(50),
  leverage: z.number().positive().max(100).default(1),
  /** Per-symbol leverage preference (clamped to Phoenix max per market). */
  leverageBySymbol: z.record(z.string(), z.number().positive().max(100)).default({}),
  sizeUnit: z.enum(["base", "usd"]).default("base"),
  reduceOnly: z.boolean().default(false),
  postOnly: z.boolean().default(false),
});
export type TradeSettings = z.infer<typeof TradeSettingsSchema>;

export const DEFAULT_TRADE_SETTINGS: TradeSettings = TradeSettingsSchema.parse(
  {},
);

export const SLIPPAGE_PRESETS_BPS = [10, 50, 100, 300] as const;

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
  /** Phoenix HTTP poll round-trip (not Solana RPC). */
  phoenixPollLatencyMs: z.number().nullable(),
  rpcLatencyMs: z.number().nullable(),
  readRpcLatencyMs: z.number().nullable().optional(),
  shredStreamActive: z.boolean(),
  shredStreamListening: z.boolean().optional(),
  shredStreamPacketsPerMin: z.number().int().nonnegative().optional(),
  botStatus: BotStatusSchema,
  lastError: z.string().nullable(),
});
export type SystemHealth = z.infer<typeof SystemHealthSchema>;

export const TradeAlertSchema = z.object({
  id: z.string(),
  level: z.enum(["info", "signal", "warn", "error"]),
  title: z.string(),
  message: z.string(),
  symbol: z.string().optional(),
  at: z.string(),
});
export type TradeAlert = z.infer<typeof TradeAlertSchema>;

export const MarketSnapshotSchema = z.object({
  symbol: z.string(),
  markPriceUsd: z.string().nullable(),
  fundingRate: z.string().nullable(),
  bestBid: z.string().nullable(),
  bestAsk: z.string().nullable(),
  updatedAt: z.string(),
  /** Where the mark came from — Phoenix HTTP, orderbook mid, or backup feed. */
  priceSource: z
    .enum(["phoenix", "orderbook_mid", "coingecko", "shredstream"])
    .optional(),
});
export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>;

export const PhoenixMarketListingSchema = z.object({
  symbol: z.string(),
  assetId: z.number(),
  marketStatus: z.string(),
  name: z.string(),
  logoUri: z.string().nullable(),
  displayColor: z.string().nullable(),
  coinGeckoId: z.string().nullable(),
  takerFeeBps: z.number(),
  makerFeeBps: z.number(),
  maxLeverage: z.number().nullable(),
  fundingIntervalSeconds: z.number().nullable(),
  maxFundingRatePct: z.number().nullable(),
  isolatedOnly: z.boolean(),
});
export type PhoenixMarketListing = z.infer<typeof PhoenixMarketListingSchema>;

export const MarketDetailSchema = z.object({
  listing: PhoenixMarketListingSchema,
  markPriceUsd: z.string().nullable(),
  spotPriceUsd: z.string().nullable(),
  bestBid: z.string().nullable(),
  bestAsk: z.string().nullable(),
  spreadUsd: z.string().nullable(),
  spreadBps: z.string().nullable(),
  openInterest: z.number().nullable(),
  openInterestUsd: z.number().nullable(),
  fundingRatePct: z.string().nullable(),
  totalMakerFees: z.number().nullable(),
  totalTakerFees: z.number().nullable(),
  statsUpdatedAt: z.string().nullable(),
  updatedAt: z.string(),
  priceSource: z
    .enum(["phoenix", "orderbook_mid", "coingecko", "shredstream"])
    .optional(),
  spotPriceSource: z
    .enum(["phoenix", "coingecko", "tradingview"])
    .optional(),
});
export type MarketDetail = z.infer<typeof MarketDetailSchema>;

export const DEFAULT_SYMBOL = "SOL";

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
  z.object({
    type: z.literal("paper_trade"),
    data: PaperTradeRecordSchema,
  }),
  z.object({
    type: z.literal("paper_portfolio"),
    data: PaperPortfolioStateSchema,
  }),
  z.object({ type: z.literal("log"), data: z.object({ level: z.string(), message: z.string(), at: z.string() }) }),
  z.object({ type: z.literal("alert"), data: TradeAlertSchema }),
  z.object({
    type: z.literal("network"),
    data: NetworkConfigSchema.extend({
      walletRpcUrl: z.string(),
    }),
  }),
]);
export type WsEvent = z.infer<typeof WsEventSchema>;

export const DEFAULT_RISK_LIMITS: RiskLimits = RiskLimitsSchema.parse({});

export const DEFAULT_BOT_CONFIG: BotConfig = BotConfigSchema.parse({});

export { PaperPortfolio } from "./paper-portfolio.js";
export type { PaperPortfolioConfig, PaperPortfolioState, PaperPositionSide, PaperTradeAction } from "./paper-portfolio.js";
export {
  PAPER_MARGIN_FRACTION,
  computePaperPerpSizing,
  formatPaperTradeReceipt,
} from "./paper-perps.js";
export type { PaperPerpSizing } from "./paper-perps.js";
export {
  GLOSSARY,
  STRATEGY_HELP,
  INTEL_PROFILE_HELP,
  TIMEFRAME_HELP,
  PAGE_GUIDES,
  type PageGuideKey,
} from "./glossary.js";
export * from "./prices.js";
export * from "./birdeye-mints.js";
export * from "./candle-chart.js";
export type { ReadRpcClass } from "./rpc-routing.js";
export * from "./rpc-routing.js";
