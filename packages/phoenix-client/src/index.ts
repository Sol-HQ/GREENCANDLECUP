import {
  createPhoenixClient,
  type PhoenixClient,
  Side,
} from "@ellipsis-labs/rise";
import type {
  MarketSnapshot,
  OrderbookLevel,
  OrderbookSnapshot,
} from "@gcc/shared";

export type PhoenixClientConfig = {
  apiUrl?: string;
  rpcUrl: string;
};

export type PhoenixClientBundle = {
  client: PhoenixClient;
  ready: () => Promise<void>;
  getMarketSnapshot: (symbol: string) => Promise<MarketSnapshot>;
  getOrderbook: (symbol: string) => Promise<OrderbookSnapshot>;
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
  const client = createPhoenixClient({
    apiUrl: config.apiUrl ?? "https://perp-api.phoenix.trade",
    rpcUrl: config.rpcUrl,
    ws: false,
    exchangeMetadata: { stream: false },
  });

  const ready = async () => {
    await client.exchange.ready();
  };

  const getMarketSnapshot = async (symbol: string): Promise<MarketSnapshot> => {
    await ready();
    const book = await client.api.orderbook().getOrderbook(symbol);
    let markPriceUsd: string | null = book.mid != null ? String(book.mid) : null;

    try {
      const stats = await client.api.markets().getLatestMarketStats(symbol);
      const mark = (stats as { mark_price?: unknown; markPrice?: unknown }).mark_price ??
        (stats as { markPrice?: unknown }).markPrice;
      if (mark != null) {
        markPriceUsd = String(mark);
      }
    } catch {
      // fallback to mid from book
    }

    return {
      symbol,
      markPriceUsd,
      fundingRate: null,
      bestBid: book.bids[0] ? String(book.bids[0][0]) : null,
      bestAsk: book.asks[0] ? String(book.asks[0][0]) : null,
      updatedAt: new Date().toISOString(),
    };
  };

  const getOrderbook = async (symbol: string): Promise<OrderbookSnapshot> => {
    const book = await client.api.orderbook().getOrderbook(symbol);
    return {
      symbol,
      bids: tupleToLevels(book.bids),
      asks: tupleToLevels(book.asks),
      updatedAt: new Date().toISOString(),
    };
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
        await new Promise((r) => setTimeout(r, 2000));
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

  return {
    client,
    ready,
    getMarketSnapshot,
    getOrderbook,
    subscribeOrderbook,
    buildLimitOrderIx,
    buildMarketOrderIx,
    getCandles: async (symbol, timeframe = "15m", limit = 100) => {
      await ready();
      const candles = await client.api.candles().getCandles(symbol, {
        timeframe,
        limit,
      });
      return candles.map((c) => ({
        time: c.time,
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
