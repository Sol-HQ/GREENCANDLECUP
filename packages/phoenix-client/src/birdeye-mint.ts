import {
  BIRDEYE_EQUITY_SYMBOLS,
  BIRDEYE_MINT_OVERRIDES,
  type BirdeyeMintReason,
  type BirdeyeMintResult,
} from "@gcc/shared";

const CACHE_TTL_MS = 60 * 60_000;
const cache = new Map<string, { at: number; mint: string | null; source: BirdeyeMintResult["source"] }>();

type CoinGeckoCoin = {
  platforms?: Record<string, string | null>;
};

async function fetchCoinGeckoSolanaMint(
  coinGeckoId: string,
): Promise<string | null> {
  if (!coinGeckoId) return null;
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinGeckoId)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "application/json", "user-agent": "gcc-birdeye-resolver" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as CoinGeckoCoin;
    const mint = body.platforms?.solana;
    return mint && mint.length > 30 ? mint : null;
  } catch {
    return null;
  }
}

type DexPair = {
  chainId?: string;
  baseToken?: { symbol?: string; address?: string };
  liquidity?: { usd?: number };
};

async function fetchDexScreenerMint(symbol: string): Promise<string | null> {
  const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { pairs?: DexPair[] };
    const upper = symbol.toUpperCase();
    const pairs = (body.pairs ?? [])
      .filter(
        (p) =>
          p.chainId === "solana" &&
          p.baseToken?.symbol?.toUpperCase() === upper &&
          p.baseToken?.address,
      )
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const mint = pairs[0]?.baseToken?.address;
    return mint && mint.length > 30 ? mint : null;
  } catch {
    return null;
  }
}

export async function resolveBirdeyeMint(
  symbol: string,
  coinGeckoId?: string | null,
): Promise<BirdeyeMintResult> {
  const sym = symbol.toUpperCase();
  const cached = cache.get(sym);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return {
      symbol: sym,
      mint: cached.mint,
      source: cached.source,
      reason: cached.mint ? undefined : cached.source === "none" ? reasonFor(sym, coinGeckoId) : undefined,
    };
  }

  if (BIRDEYE_EQUITY_SYMBOLS.has(sym)) {
    const result: BirdeyeMintResult = {
      symbol: sym,
      mint: null,
      source: "none",
      reason: "equity",
    };
    cache.set(sym, { at: Date.now(), mint: null, source: "none" });
    return result;
  }

  const override = BIRDEYE_MINT_OVERRIDES[sym];
  if (override) {
    const result: BirdeyeMintResult = {
      symbol: sym,
      mint: override,
      source: "override",
    };
    cache.set(sym, { at: Date.now(), mint: override, source: "override" });
    return result;
  }

  let mint: string | null = null;
  let source: BirdeyeMintResult["source"] = "none";

  if (coinGeckoId) {
    mint = await fetchCoinGeckoSolanaMint(coinGeckoId);
    if (mint) source = "coingecko";
  }

  if (!mint) {
    mint = await fetchDexScreenerMint(sym);
    if (mint) source = "dexscreener";
  }

  const result: BirdeyeMintResult = {
    symbol: sym,
    mint,
    source,
    reason: mint ? undefined : reasonFor(sym, coinGeckoId),
  };
  cache.set(sym, { at: Date.now(), mint, source });
  return result;
}

function reasonFor(
  symbol: string,
  coinGeckoId?: string | null,
): BirdeyeMintReason {
  if (BIRDEYE_EQUITY_SYMBOLS.has(symbol)) return "equity";
  if (!coinGeckoId) return "unknown_symbol";
  return "no_solana_mint";
}
