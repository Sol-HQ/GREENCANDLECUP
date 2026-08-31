/** Wrapped SOL — Birdeye spot charts use this mint for native SOL. */
export const WRAPPED_SOL = "So11111111111111111111111111111111111111112";

/**
 * Phoenix symbols that are equities / tradfi — no Solana DEX spot on Birdeye.
 * (Synced with Phoenix markets that lack coinGeckoId.)
 */
export const BIRDEYE_EQUITY_SYMBOLS = new Set([
  "AAPL",
  "AMAT",
  "AMD",
  "AMZN",
  "ARM",
  "ASML",
  "AVGO",
  "BABA",
  "CBRS",
  "COIN",
  "COPPER",
  "CRCL",
  "CRWD",
  "CRWV",
  "GOOGL",
  "HOOD",
  "INTC",
  "IREN",
  "LLY",
  "META",
  "MRNA",
  "MRVL",
  "MSFT",
  "MSTR",
  "MU",
  "NBIS",
  "NET",
  "NFLX",
  "NVDA",
  "PLTR",
  "QCOM",
  "SILVER",
  "SNDK",
  "SPCX",
  "TSLA",
  "TSM",
  "WTIOIL",
]);

/**
 * Hard-coded Solana mints for Phoenix symbols where CoinGecko / search
 * returns nothing or the wrong token (wrapped majors, canonical SPL).
 */
export const BIRDEYE_MINT_OVERRIDES: Record<string, string> = {
  SOL: WRAPPED_SOL,
  BTC: "3NZ9JMVBmGAqocybic2cjqCJYf6DsB6chPyQZKXWpXvz",
  ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
  BNB: "9gP2kCy3wA1ctvYWQk75QqZ4Z84fL5S3Xh9jG1GDr1WC",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  JTO: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  LINK: "LinkhB3afbBKb2EQQu7s7umdZceV3wcvAUJhQAfQ23L",
  RENDER: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
  PUMP: "pumpCmXqMfrsAkQ5ynrb5KpEpunhVGYoonjH5PUH8y",
  FARTCOIN: "9BB6NFEcjBCtnNLFko2FqVQBq8HHMoskXiDXXugFz2QQ",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  ONDO: "9FukDYMMqQ5CK2Sqemoa7vc6t5vmbyduthrAmFn3oF76",
  SKR: "2ar83cybCAUs3cR5KyLgECkzDvaqocYzvfftTzicnb6V",
  AAVE: "AavE1kKKnesPw4MuRJmJ9jZs9QzEE8CPxQ3ViczUDfc1",
  ANSEM: "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump",
  CHIP: "chipCAT7vi5CZtbZsn9z7iMPXvFwyAnKz3QFu8XVuHm",
  SKHY: "SKHYhSjuRWHgikq8eRKbtBbpABgJSkd7ytQV14i9EQ3",
  VIRTUAL: "3iQL8BFS2vE7mww4ehAqQHAsbmRNCrPxizWAT2Zfyr9y",
};

export type BirdeyeMintReason =
  | "equity"
  | "no_solana_mint"
  | "unknown_symbol";

export type BirdeyeMintResult = {
  symbol: string;
  mint: string | null;
  source: "override" | "coingecko" | "dexscreener" | "none";
  reason?: BirdeyeMintReason;
};

export function birdeyeEmbedUrl(
  mint: string,
  opts?: { interval?: string; timezone?: string },
): string {
  const interval = opts?.interval ?? "15";
  const tz = encodeURIComponent(opts?.timezone ?? "America/New_York");
  return `https://embed.birdeye.so/tv-widget/${mint}?chain=solana&viewMode=pair&chartInterval=${interval}&chartType=Candle&chartTimezone=${tz}&chartLeftToolbar=show&theme=dark`;
}
