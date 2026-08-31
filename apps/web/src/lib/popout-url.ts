import type { CandleTimeframe } from "@gcc/shared";

const POPOUT_NAME = "gcc-scanner-chart-popout";

export function buildPopoutUrl(symbol: string, timeframe: CandleTimeframe): string {
  const url = new URL("/chart/popout", window.location.origin);
  url.searchParams.set("symbol", symbol.trim().toUpperCase());
  url.searchParams.set("timeframe", timeframe);
  return url.toString();
}

/** Open a normal browser window (not a tiny popup). Returns false if blocked. */
export function openPopoutWindow(
  symbol: string,
  timeframe: CandleTimeframe,
): boolean {
  const href = buildPopoutUrl(symbol, timeframe);
  const features = [
    "width=1400",
    "height=900",
    "left=80",
    "top=40",
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
  const win = window.open(href, POPOUT_NAME, features);
  if (!win) return false;
  win.focus();
  return true;
}
