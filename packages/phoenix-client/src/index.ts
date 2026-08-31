import {
  createPhoenixClient,
  type PhoenixClient,
  type PhoenixMarketData,
  type PhoenixOrderbookManager,
  type PhoenixOrderbookSnapshot,
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
  /** Subscribe Phoenix WS streams for a symbol (idempotent). */
  ensureSymbolStream: (symbol: string) => Promise<void>;
  getWsStatus: () => { connected: boolean; symbols: string[] };
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
    ws: { connectMode: "eager" },
    exchangeMetadata: {
      stream: true,
      priority: "api",
      api: { liveUpdates: "ws" },
      rpc: { pollIntervalMs: 0 },
    },
  });

  let exchangeReady: Promise<unknown> | null = null;
  let wsReady: Promise<void> | null = null;
  let marketData: PhoenixMarketData | null = null;
  let orderbooks: PhoenixOrderbookManager | null = null;
  const symbolStreams = new Map<
    string,
    { obRelease: () => void; mdRelease: () => void }
  >();

  const ready = async () => {
    if (!exchangeReady) {
      exchangeReady = client.exchange.ready().catch((error) => {
        exchangeReady = null;
        throw error;
      });
    }
    await exchangeReady;
  };

  const ensureWsReady = async () => {
    await ready();
    if (!wsReady) {
      wsReady = (async () => {
        marketData = client.marketData();
        orderbooks = client.orderbooks();
        await marketData.ready();
      })().catch((error) => {
        wsReady = null;
        throw error;
      });
    }
    await wsReady;
  };

  const mapBookSnapshot = (
    symbol: string,
    book: PhoenixOrderbookSnapshot,
  ): OrderbookSnapshot => ({
    symbol,
    bids: book.bids.slice(0, 20).map((level) => ({
      price: String(level.price),
      size: String(level.size),
    })),
    asks: book.asks.slice(0, 20).map((level) => ({
      price: String(level.price),
      size: String(level.size),
    })),
    updatedAt: new Date(book.timestampMs || Date.now()).toISOString(),
  });

  const mapMarketFromCache = (
    symbol: string,
    book: PhoenixOrderbookSnapshot | null,
    markPrice: number | null,
    mid: number | null,
  ): MarketSnapshot => {
    const mark =
      markPrice ?? mid ?? book?.mid ?? null;
    const priceSource: MarketSnapshot["priceSource"] =
      markPrice != null ? "phoenix" : book?.mid != null ? "orderbook_mid" : "phoenix";
    return {
      symbol,
      markPriceUsd: mark != null ? String(mark) : null,
      fundingRate: null,
      bestBid: book?.bestBid ? String(book.bestBid.price) : null,
      bestAsk: book?.bestAsk ? String(book.bestAsk.price) : null,
      updatedAt: new Date().toISOString(),
      priceSource,
    };
  };

  const getCachedLiveFeed = (
    symbol: string,
  ): { market: MarketSnapshot; orderbook: OrderbookSnapshot } | null => {
    const sym = symbol.toUpperCase();
    const book = orderbooks?.peek(sym)?.snapshot() ?? null;
    const row = marketData?.market(sym);
    if (!book && !row) return null;
    const market = mapMarketFromCache(
      sym,
      book,
      row?.markPrice ?? null,
      row?.mid ?? null,
    );
    if (!market.markPriceUsd && !book) return null;
    const orderbook = book
      ? mapBookSnapshot(sym, book)
      : {
          symbol: sym,
          bids: market.bestBid ? [{ price: market.bestBid, size: "0" }] : [],
          asks: market.bestAsk ? [{ price: market.bestAsk, size: "0" }] : [],
          updatedAt: market.updatedAt,
        };
    return { market, orderbook };
  };

  const ensureSymbolStream = async (symbol: string) => {
    const sym = symbol.trim().toUpperCase();
    if (!sym || symbolStreams.has(sym)) return;
    try {
      await ensureWsReady();
      const obRes = await orderbooks!.prefetch(sym);
      const mdRes = marketData!.resource(sym);
      const releases = {
        obRelease: obRes.retain(),
        mdRelease: mdRes.retain(),
      };
      symbolStreams.set(sym, releases);
      await Promise.all([obRes.ready(), mdRes.ready()]);
    } catch {
      symbolStreams.delete(sym);
      throw new Error(`Phoenix WS stream failed for ${sym}`);
    }
  };

  const getWsStatus = () => {
    const status = marketData?.status();
    return {
      connected: status?.isConnected === true,
      symbols: [...symbolStreams.keys()],
    };
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
    const sym = symbol.toUpperCase();
    try {
      await ensureSymbolStream(sym);
      const cached = getCachedLiveFeed(sym);
      if (cached) return cached;
    } catch {
      // fall through to REST bootstrap
    }

    await ready();
    const book = await client.api.orderbook().getOrderbook(sym);
    const orderbook = mapOrderbook(sym, book);
    let markPriceUsd: string | null =
      book.mid != null ? String(book.mid) : null;
    let priceSource: MarketSnapshot["priceSource"] =
      book.mid != null ? "orderbook_mid" : "phoenix";

    try {
      const stats = await client.api.markets().getLatestMarketStats(sym);
      const mark =
        (stats as { mark_price?: unknown; markPrice?: unknown }).mark_price ??
        (stats as { markPrice?: unknown }).markPrice;
      if (mark != null) {
        markPriceUsd = String(mark);
        priceSource = "phoenix";
      }
    } catch {
      // keep mid
    }

    const market: MarketSnapshot = {
      symbol: sym,
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
    const sym = symbol.toUpperCase();
    let active = true;
    let unsubscribe: (() => void) | null = null;

    void (async () => {
      try {
        await ensureSymbolStream(sym);
        const resource = orderbooks!.peek(sym);
        if (!resource || !active) return;
        unsubscribe = resource.subscribe((state) => {
          if (!active || !state.book) return;
          onUpdate(mapBookSnapshot(sym, state.book));
        });
        const snap = resource.snapshot();
        if (snap) onUpdate(mapBookSnapshot(sym, snap));
      } catch {
        const poll = async () => {
          while (active) {
            try {
              onUpdate(await getOrderbook(sym));
            } catch {
              // retry
            }
            await new Promise((r) => setTimeout(r, 5000));
          }
        };
        void poll();
      }
    })();

    return () => {
      active = false;
      unsubscribe?.();
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
    ensureSymbolStream,
    getWsStatus,
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
