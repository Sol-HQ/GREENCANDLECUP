export {
  formatCompactUsd,
  formatNumber,
  formatPricePlain,
  formatPriceUsd,
  formatTokenAmount,
  formatUsd,
  formatUsdNotional,
  decimalsForPrice,
  decimalsForTokenAmount,
} from "@gcc/shared";

const TV_MAP: Record<string, string> = {
  SOL: "BINANCE:SOLUSDT.P",
  BTC: "BINANCE:BTCUSDT.P",
  ETH: "BINANCE:ETHUSDT.P",
  BONK: "BINANCE:BONKUSDT.P",
  WIF: "BINANCE:WIFUSDT.P",
  JUP: "BINANCE:JUPUSDT.P",
  JUPE: "BINANCE:JUPUSDT.P",
};

export function tradingViewSymbol(symbol: string): string {
  return TV_MAP[symbol] ?? `BINANCE:${symbol}USDT.P`;
}

export function priceSourceLabel(
  source: string | null | undefined,
): string {
  switch (source) {
    case "phoenix":
      return "Phoenix (live)";
    case "orderbook_mid":
      return "Phoenix orderbook mid";
    case "coingecko":
      return "CoinGecko backup";
    case "shredstream":
      return "ShredStream";
    default:
      return "Phoenix";
  }
}
