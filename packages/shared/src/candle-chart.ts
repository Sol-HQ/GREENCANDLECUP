export type CandleTimeframe =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "1d";

const TF_SECONDS: Record<CandleTimeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14_400,
  "1d": 86_400,
};

/** Phoenix returns up to 1000 bars per request — use the max for depth. */
export function candleHistoryLimit(_timeframe: CandleTimeframe): number {
  return 1000;
}

/** How often to re-fetch OHLCV from Phoenix (mark price ticks faster via WS). */
export function candlePollIntervalMs(timeframe: CandleTimeframe): number {
  switch (timeframe) {
    case "1m":
      return 15_000;
    case "5m":
      return 30_000;
    case "15m":
    case "30m":
      return 60_000;
    default:
      return 120_000;
  }
}

/** Default visible bars on first load — avoids squashing full history into flat lines. */
export function candleDefaultVisibleBars(timeframe: CandleTimeframe): number {
  switch (timeframe) {
    case "1m":
      return 120;
    case "5m":
      return 96;
    case "15m":
      return 80;
    case "30m":
      return 64;
    case "1h":
      return 72;
    case "4h":
      return 60;
    case "1d":
      return 90;
    default:
      return 96;
  }
}

export function candlePeriodStart(
  unixSec: number,
  timeframe: CandleTimeframe,
): number {
  const period = TF_SECONDS[timeframe] ?? 60;
  return Math.floor(unixSec / period) * period;
}

export function candlePeriodSeconds(timeframe: CandleTimeframe): number {
  return TF_SECONDS[timeframe] ?? 60;
}
