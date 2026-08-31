import type { PaperTradeRecord } from "@gcc/shared";

export type PriceTick = {
  at: string;
  symbol: string;
  priceUsd: number;
  source: "poll" | "trade";
};

/** ~1 hour of ticks at 5s poll interval per symbol. */
const MAX_TICKS_PER_SYMBOL = 720;
const tapes = new Map<string, PriceTick[]>();

export function recordPriceTick(
  symbol: string,
  priceUsd: number,
  source: "poll" | "trade" = "poll",
) {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return;
  const sym = symbol.trim().toUpperCase();
  const row: PriceTick = {
    at: new Date().toISOString(),
    symbol: sym,
    priceUsd,
    source,
  };
  let buf = tapes.get(sym);
  if (!buf) {
    buf = [];
    tapes.set(sym, buf);
  }
  buf.push(row);
  if (buf.length > MAX_TICKS_PER_SYMBOL) {
    buf.splice(0, buf.length - MAX_TICKS_PER_SYMBOL);
  }
}

export function clearPriceTape(symbol?: string) {
  if (symbol) tapes.delete(symbol.trim().toUpperCase());
  else tapes.clear();
}

export function getPaperReplay(params: {
  symbol: string;
  minutes: number;
  delaySec: number;
  trades: PaperTradeRecord[];
}) {
  const sym = params.symbol.trim().toUpperCase();
  const minutes = Math.min(30, Math.max(1, params.minutes));
  const delaySec = Math.min(120, Math.max(0, params.delaySec));
  const end = Date.now() - delaySec * 1000;
  const start = end - minutes * 60 * 1000;

  const inWindow = (iso: string) => {
    const ts = new Date(iso).getTime();
    return ts >= start && ts <= end;
  };

  const ticks = (tapes.get(sym) ?? []).filter((t) => inWindow(t.at));
  const trades = params.trades.filter(
    (t) => t.symbol === sym && inWindow(t.at),
  );

  return {
    symbol: sym,
    minutes,
    delaySec,
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(end).toISOString(),
    ticks,
    trades,
  };
}
