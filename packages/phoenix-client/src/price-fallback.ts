const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; price: string }>();

/** CoinGecko spot backup — no API key, rate-limit friendly (cached 60s). */
export async function fetchCoinGeckoSpotUsd(
  coinGeckoId: string,
): Promise<string | null> {
  if (!coinGeckoId) return null;
  const hit = cache.get(coinGeckoId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.price;

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinGeckoId)}&vs_currencies=usd`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return hit?.price ?? null;
    const body = (await res.json()) as Record<string, { usd?: number }>;
    const raw = body[coinGeckoId]?.usd;
    if (raw == null || !Number.isFinite(raw)) return hit?.price ?? null;
    const price = String(raw);
    cache.set(coinGeckoId, { at: Date.now(), price });
    return price;
  } catch {
    return hit?.price ?? null;
  }
}
