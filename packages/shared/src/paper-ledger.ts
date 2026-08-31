import type { PaperTradeAction, PaperTradeRecord } from "./paper-portfolio.js";

export type PaperTradeSource = "manual" | "bot";

export function inferTradeSource(trade: PaperTradeRecord): PaperTradeSource {
  if (trade.source) return trade.source;
  if (/^manual/i.test(trade.reason)) return "manual";
  return "bot";
}

export function isOpenAction(action: PaperTradeAction): boolean {
  return action === "open_long" || action === "open_short";
}

export function sideFromAction(action: PaperTradeAction): "long" | "short" {
  return action === "open_long" || action === "close_long" ? "long" : "short";
}

/** One complete open → close round trip with full receipt fields. */
export type ClosedRoundTrip = {
  id: string;
  source: PaperTradeSource;
  symbol: string;
  side: "long" | "short";
  sizeBase: number;
  entryPriceUsd: number;
  exitPriceUsd: number;
  entryAt: string;
  exitAt: string;
  notionalUsd: number;
  marginUsd: number;
  leverage: number;
  realizedPnlUsd: number;
  openReason: string;
  closeReason: string;
  cashAfterUsd: number;
};

export function buildClosedRoundTrips(
  trades: PaperTradeRecord[],
  leverage = 2,
): ClosedRoundTrip[] {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  const openStack: PaperTradeRecord[] = [];
  const closed: ClosedRoundTrip[] = [];

  for (const t of sorted) {
    if (isOpenAction(t.action)) {
      openStack.push(t);
      continue;
    }
    const side = sideFromAction(t.action);
    let openIdx = -1;
    for (let i = openStack.length - 1; i >= 0; i--) {
      const o = openStack[i];
      if (
        o.symbol === t.symbol &&
        sideFromAction(o.action) === side &&
        inferTradeSource(o) === inferTradeSource(t)
      ) {
        openIdx = i;
        break;
      }
    }
    if (openIdx < 0) continue;
    const open = openStack.splice(openIdx, 1)[0];
    const lev = open.leverage ?? leverage;
    const notional = open.notionalUsd;
    closed.push({
      id: `${open.id}-${t.id}`,
      source: inferTradeSource(open),
      symbol: t.symbol,
      side,
      sizeBase: t.sizeBase,
      entryPriceUsd: open.priceUsd,
      exitPriceUsd: t.priceUsd,
      entryAt: open.at,
      exitAt: t.at,
      notionalUsd: notional,
      marginUsd: notional / lev,
      leverage: lev,
      realizedPnlUsd: t.pnlUsd ?? 0,
      openReason: open.reason,
      closeReason: t.reason,
      cashAfterUsd: t.balanceUsdc,
    });
  }

  return closed.reverse();
}

export function filterTradesBySource(
  trades: PaperTradeRecord[],
  source: PaperTradeSource | "all",
): PaperTradeRecord[] {
  if (source === "all") return trades;
  return trades.filter((t) => inferTradeSource(t) === source);
}

export function walletSummaryFromPortfolio(params: {
  startingBalanceUsdc: number;
  balanceUsdc: number;
  equityUsdc: number;
  positionSide: "flat" | "long" | "short";
  unrealizedPnlUsd: number;
  trades: PaperTradeRecord[];
}) {
  const realizedFromTrades = params.trades
    .filter((t) => t.pnlUsd != null)
    .reduce((sum, t) => sum + (t.pnlUsd ?? 0), 0);
  const netPnl = params.balanceUsdc - params.startingBalanceUsdc;
  return {
    startingUsd: params.startingBalanceUsdc,
    cashUsd: params.balanceUsdc,
    equityUsd: params.equityUsdc,
    realizedPnlUsd: realizedFromTrades,
    netPnlUsd: netPnl,
    unrealizedPnlUsd: params.unrealizedPnlUsd,
    isFlat: params.positionSide === "flat",
  };
}
