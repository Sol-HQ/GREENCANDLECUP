import type { MarketBriefing } from "@gcc/shared";

const CACHE_TTL_MS = 120_000;
const cache = new Map<string, { at: number; data: MarketBriefing }>();

export type { MarketBriefing };

type CoinGeckoCoin = {
  id?: string;
  name?: string;
  genesis_date?: string | null;
  description?: { en?: string };
  market_data?: {
    current_price?: { usd?: number };
    market_cap?: { usd?: number };
    total_volume?: { usd?: number };
    price_change_percentage_24h?: number;
    price_change_percentage_7d_in_currency?: { usd?: number };
    ath?: { usd?: number };
    atl?: { usd?: number };
  };
};

function trimDescription(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export async function fetchMarketBriefing(params: {
  symbol: string;
  name: string;
  coinGeckoId: string | null;
  maxLeverage: number | null;
  markPriceUsd?: string | null;
}): Promise<MarketBriefing> {
  const key = params.symbol.toUpperCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  let cg: CoinGeckoCoin | null = null;
  if (params.coinGeckoId) {
    try {
      const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(params.coinGeckoId)}?localization=false&tickers=false&community_data=false&developer_data=false`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: { accept: "application/json" },
      });
      if (res.ok) cg = (await res.json()) as CoinGeckoCoin;
    } catch {
      // fall through with Phoenix-only data
    }
  }

  const md = cg?.market_data;
  const spot =
    md?.current_price?.usd != null
      ? String(md.current_price.usd)
      : params.markPriceUsd ?? null;
  const ch24 = md?.price_change_percentage_24h ?? null;
  const vol = md?.total_volume?.usd ?? null;
  const mcap = md?.market_cap?.usd ?? null;

  const mood =
    ch24 == null
      ? "mixed"
      : ch24 > 3
        ? "heated (24h up)"
        : ch24 < -3
          ? "cooling (24h down)"
          : "choppy/sideways";

  const volNote =
    vol != null && vol > 5_000_000
      ? "solid volume"
      : vol != null
        ? "lighter volume"
        : "volume unknown";

  const summary = [
    `${params.name} (${key}) on Phoenix perps.`,
    spot ? `Mark ~$${Number(spot).toFixed(4)}.` : "",
    mcap ? `Mcap ~$${(mcap / 1_000_000).toFixed(1)}M.` : "",
    `${mood}, ${volNote}.`,
    params.maxLeverage ? `Max leverage ${params.maxLeverage}x.` : "",
    cg?.description?.en
      ? trimDescription(cg.description.en)
      : "Scalp swings — quick in/out, no stacking positions.",
  ]
    .filter(Boolean)
    .join(" ");

  const briefing: MarketBriefing = {
    symbol: key,
    name: cg?.name ?? params.name,
    coinGeckoId: params.coinGeckoId,
    summary,
    spotPriceUsd: spot,
    marketCapUsd: mcap,
    volume24hUsd: vol,
    change24hPct: ch24,
    change7dPct: md?.price_change_percentage_7d_in_currency?.usd ?? null,
    athUsd: md?.ath?.usd ?? null,
    atlUsd: md?.atl?.usd ?? null,
    genesisDate: cg?.genesis_date ?? null,
    phoenixMaxLeverage: params.maxLeverage,
    fetchedAt: new Date().toISOString(),
  };

  cache.set(key, { at: Date.now(), data: briefing });
  return briefing;
}
