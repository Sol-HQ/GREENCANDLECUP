import {
  createPhoenixClient,
  type PhoenixClient,
  Side,
} from "@ellipsis-labs/rise";
import type {
  MarketDetail,
  MarketSnapshot,
  OrderbookLevel,
  OrderbookSnapshot,
  PhoenixMarketListing,
} from "@gcc/shared";
import { assertReadRpcNotHelius } from "@gcc/shared";
import { fetchCoinGeckoSpotUsd } from "./price-fallback.js";

export { resolveBirdeyeMint } from "./birdeye-mint.js";
export { fetchMarketBriefing } from "./market-briefing.js";
export type { BirdeyeMintResult } from "@gcc/shared";

export type PhoenixClientConfig = {
  apiUrl?: string;
  rpcUrl: string;
};

export type PhoenixClientBundle = {
  client: PhoenixClient;
  ready: () => Promise<void>;
  getMarketSnapshot: (symbol: string) => Promise<MarketSnapshot>;
  getOrderbook: (symbol: string) => Promise<OrderbookSnapshot>;
  getLiveFeed: (symbol: string) => Promise<{
    market: MarketSnapshot;
    orderbook: OrderbookSnapshot;
  }>;
  subscribeOrderbook: (
    symbol: string,
    onUpdate: (book: OrderbookSnapshot) => void,
  ) => () => void;
  buildLimitOrderIx: (params: {
    authority: string;
    symbol: string;
    side: "buy" | "sell";
    priceUsd: string;
    baseUnits: string;
  }) => Promise<unknown>;
  buildMarketOrderIx: (params: {
    authority: string;
    symbol: string;
    side: "buy" | "sell";
    baseUnits: string;
  }) => Promise<unknown>;
  getCandles: (
    symbol: string,
    timeframe?: string,
    limit?: number,
  ) => Promise<
    Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>
  >;
  listMarkets: () => Promise<PhoenixMarketListing[]>;
  getMarketDetail: (symbol: string) => Promise<MarketDetail>;
};

function tupleToLevels(levels: [number, number][]): OrderbookLevel[] {
  return levels.slice(0, 20).map(([price, size]) => ({
    price: String(price),
    size: String(size),
  }));
}

export function createGccPhoenixClient(
  config: PhoenixClientConfig,
): PhoenixClientBundle {
  assertReadRpcNotHelius(config.rpcUrl, "Phoenix client rpcUrl");

  const apiBase = (config.apiUrl ?? "https://perp-api.phoenix.trade").replace(
    /\/$/,
    "",
  );
  const client = createPhoenixClient({
    apiUrl: config.apiUrl ?? "https://perp-api.phoenix.trade",
    rpcUrl: config.rpcUrl,
    ws: false,
    exchangeMetadata: {
      stream: false,
      priority: "api",
      api: { liveUpdates: "none" },
      // RPC is fallback for live ix building only — no background poll loop.
      rpc: { pollIntervalMs: 0 },
    },
  });

  let exchangeReady: Promise<unknown> | null = null;
  let statsTick = 0;
  let cachedMarkPrice: string | null = null;

  const ready = async () => {
    if (!exchangeReady) {
      exchangeReady = client.exchange.ready().catch((error) => {
        exchangeReady = null;
        throw error;
      });
    }
    await exchangeReady;
  };

  type RawOrderbook = {
    bids: [number, number][];
    asks: [number, number][];
    mid?: number | null;
  };

  const mapOrderbook = (
    symbol: string,
    book: RawOrderbook,
  ): OrderbookSnapshot => ({
    symbol,
    bids: tupleToLevels(book.bids),
    asks: tupleToLevels(book.asks),
    updatedAt: new Date().toISOString(),
  });

  const getOrderbook = async (symbol: string): Promise<OrderbookSnapshot> => {
    await ready();
    const book = await client.api.orderbook().getOrderbook(symbol);
    return mapOrderbook(symbol, book);
  };

  const getMarketSnapshot = async (symbol: string): Promise<MarketSnapshot> => {
    const feed = await getLiveFeed(symbol);
    return feed.market;
  };

  const getLiveFeed = async (
    symbol: string,
  ): Promise<{ market: MarketSnapshot; orderbook: OrderbookSnapshot }> => {
    await ready();
    const book = await client.api.orderbook().getOrderbook(symbol);
    const orderbook = mapOrderbook(symbol, book);

    let markPriceUsd: string | null =
      book.mid != null ? String(book.mid) : cachedMarkPrice;
    let priceSource: MarketSnapshot["priceSource"] =
      book.mid != null ? "orderbook_mid" : "phoenix";

    // Phoenix stats are a second HTTP call — fetch occasionally, not every tick.
    if (statsTick++ % 5 === 0) {
      try {
        const stats = await client.api.markets().getLatestMarketStats(symbol);
        const mark =
          (stats as { mark_price?: unknown; markPrice?: unknown }).mark_price ??
          (stats as { markPrice?: unknown }).markPrice;
        if (mark != null) {
          markPriceUsd = String(mark);
          cachedMarkPrice = markPriceUsd;
          priceSource = "phoenix";
        }
      } catch {
        // keep last good mark or mid
      }
    }

    const market: MarketSnapshot = {
      symbol,
      markPriceUsd,
      fundingRate: null,
      bestBid: book.bids[0] ? String(book.bids[0][0]) : null,
      bestAsk: book.asks[0] ? String(book.asks[0][0]) : null,
      updatedAt: new Date().toISOString(),
      priceSource,
    };

    return { market, orderbook };
  };

  const subscribeOrderbook = (
    symbol: string,
    onUpdate: (book: OrderbookSnapshot) => void,
  ) => {
    let active = true;
    const poll = async () => {
      while (active) {
        try {
          onUpdate(await getOrderbook(symbol));
        } catch {
          // retry on transient errors
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    };
    void poll();
    return () => {
      active = false;
    };
  };

  const buildLimitOrderIx = async (params: {
    authority: string;
    symbol: string;
    side: "buy" | "sell";
    priceUsd: string;
    baseUnits: string;
  }) => {
    await ready();
    const orderPacket = await client.orderPackets.buildLimitOrderPacket({
      symbol: params.symbol,
      side: params.side === "buy" ? Side.Bid : Side.Ask,
      priceUsd: params.priceUsd,
      baseUnits: params.baseUnits,
    });
    return client.ixs.buildPlaceLimitOrder({
      authority: params.authority as never,
      symbol: params.symbol as never,
      orderPacket,
      traderPdaIndex: 0,
      traderSubaccountIndex: 0,
    });
  };

  const buildMarketOrderIx = async (params: {
    authority: string;
    symbol: string;
    side: "buy" | "sell";
    baseUnits: string;
  }) => {
    await ready();
    const orderPacket = await client.orderPackets.buildMarketOrderPacket({
      symbol: params.symbol,
      side: params.side === "buy" ? Side.Bid : Side.Ask,
      baseUnits: params.baseUnits,
    });
    return client.ixs.buildPlaceMarketOrder({
      authority: params.authority as never,
      symbol: params.symbol as never,
      orderPacket,
      traderPdaIndex: 0,
      traderSubaccountIndex: 0,
    });
  };

  let marketsCache: { at: number; data: PhoenixMarketListing[] } | null = null;
  const MARKETS_TTL_MS = 60_000;

  type RawExchangeMarket = {
    symbol: string;
    assetId: number;
    marketStatus: string;
    metadata?: {
      name?: string;
      logoUri?: string | null;
      displayColor?: string | null;
      coinGeckoId?: string | null;
    };
    takerFee?: number;
    makerFee?: number;
    leverageTiers?: Array<{ maxLeverage?: number }>;
    fundingIntervalSeconds?: number;
    maxFundingRatePerIntervalPercentage?: number;
    isolatedOnly?: boolean;
  };

  const mapListing = (raw: RawExchangeMarket): PhoenixMarketListing => ({
    symbol: raw.symbol,
    assetId: raw.assetId,
    marketStatus: raw.marketStatus,
    name: raw.metadata?.name ?? raw.symbol,
    logoUri: raw.metadata?.logoUri ?? null,
    displayColor: raw.metadata?.displayColor ?? null,
    coinGeckoId: raw.metadata?.coinGeckoId ?? null,
    takerFeeBps: Math.round((raw.takerFee ?? 0) * 10_000),
    makerFeeBps: Math.round((raw.makerFee ?? 0) * 10_000),
    maxLeverage: raw.leverageTiers?.[0]?.maxLeverage ?? null,
    fundingIntervalSeconds: raw.fundingIntervalSeconds ?? null,
    maxFundingRatePct: raw.maxFundingRatePerIntervalPercentage ?? null,
    isolatedOnly: Boolean(raw.isolatedOnly),
  });

  const listMarkets = async (): Promise<PhoenixMarketListing[]> => {
    if (marketsCache && Date.now() - marketsCache.at < MARKETS_TTL_MS) {
      return marketsCache.data;
    }
    const res = await fetch(`${apiBase}/exchange/markets`);
    if (!res.ok) {
      throw new Error(`Phoenix markets list failed (${res.status})`);
    }
    const rows = (await res.json()) as RawExchangeMarket[];
    const data = rows
      .map(mapListing)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    marketsCache = { at: Date.now(), data };
    return data;
  };

  const getMarketDetail = async (symbol: string): Promise<MarketDetail> => {
    const listings = await listMarkets();
    const listing =
      listings.find((m) => m.symbol === symbol) ??
      mapListing({
        symbol,
        assetId: -1,
        marketStatus: "unknown",
        metadata: { name: symbol },
      });

    const { market, orderbook } = await getLiveFeed(symbol);
    void orderbook;

    let markPriceUsd: string | null = market.markPriceUsd;
    let spotPriceUsd: string | null = null;
    let spotPriceSource: MarketDetail["spotPriceSource"] = "phoenix";
    let priceSource: MarketDetail["priceSource"] = market.priceSource ?? "phoenix";
    let openInterest: number | null = null;
    let openInterestUsd: number | null = null;
    let totalMakerFees: number | null = null;
    let totalTakerFees: number | null = null;
    let statsUpdatedAt: string | null = null;

    try {
      const statsRes = await fetch(`${apiBase}/v1/market/${symbol}/stats`);
      if (statsRes.ok) {
        const body = (await statsRes.json()) as {
          stats?: Array<{
            mark_price?: number;
            spot_price?: number;
            open_interest?: number;
            total_maker_fees?: number;
            total_taker_fees?: number;
            timestamp?: string;
          }>;
        };
        const latest = body.stats?.at(-1);
        if (latest) {
          spotPriceUsd =
            latest.spot_price != null ? String(latest.spot_price) : null;
          openInterest = latest.open_interest ?? null;
          const mark = Number(market.markPriceUsd ?? latest.mark_price ?? 0);
          if (openInterest != null && mark) {
            openInterestUsd = openInterest * mark;
          }
          totalMakerFees = latest.total_maker_fees ?? null;
          totalTakerFees = latest.total_taker_fees ?? null;
          statsUpdatedAt = latest.timestamp ?? null;
        }
      }
    } catch {
      // stats are optional
    }

    if (!markPriceUsd && listing.coinGeckoId) {
      const cg = await fetchCoinGeckoSpotUsd(listing.coinGeckoId);
      if (cg) {
        markPriceUsd = cg;
        priceSource = "coingecko";
      }
    }

    if (!spotPriceUsd && listing.coinGeckoId) {
      const cg =
        markPriceUsd && priceSource === "coingecko"
          ? markPriceUsd
          : await fetchCoinGeckoSpotUsd(listing.coinGeckoId);
      if (cg) {
        spotPriceUsd = cg;
        spotPriceSource = "coingecko";
      }
    }

    const bid = Number(market.bestBid ?? 0);
    const ask = Number(market.bestAsk ?? 0);
    const spreadUsd = bid && ask ? String(Math.max(0, ask - bid)) : null;
    const mid = bid && ask ? (bid + ask) / 2 : Number(market.markPriceUsd ?? 0);
    const spreadBps =
      spreadUsd && mid
        ? ((Number(spreadUsd) / mid) * 10_000).toFixed(2)
        : null;

    return {
      listing,
      markPriceUsd,
      spotPriceUsd,
      bestBid: market.bestBid,
      bestAsk: market.bestAsk,
      spreadUsd,
      spreadBps,
      openInterest,
      openInterestUsd,
      fundingRatePct:
        listing.maxFundingRatePct != null
          ? String(listing.maxFundingRatePct)
          : null,
      totalMakerFees,
      totalTakerFees,
      statsUpdatedAt,
      updatedAt: new Date().toISOString(),
      priceSource,
      spotPriceSource,
    };
  };

  return {
    client,
    ready,
    getMarketSnapshot,
    getOrderbook,
    getLiveFeed,
    subscribeOrderbook,
    buildLimitOrderIx,
    buildMarketOrderIx,
    listMarkets,
    getMarketDetail,
    getCandles: async (symbol, timeframe = "15m", limit = 100) => {
      await ready();
      const candles = await client.api.candles().getCandles(symbol, {
        timeframe,
        limit,
      });
      return candles.map((c) => ({
        time: c.time > 1e12 ? Math.floor(c.time / 1000) : c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));
    },
  };
}

export { Side };
