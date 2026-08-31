import type { PaperTradeRecord } from "./index.js";

/** Fraction of cash balance posted as margin per new position (paper model). */
export const PAPER_MARGIN_FRACTION = 0.5;

export type PaperPerpSizing = {
  markPriceUsd: number | null;
  marginUsd: number | null;
  notionalUsd: number | null;
  unrealizedPnlPctOnMargin: number | null;
  nextTradeMarginUsd: number;
  nextTradeNotionalUsd: number;
  nextTradeSizeBase: number | null;
};

export function computePaperPerpSizing(params: {
  balanceUsdc: number;
  leverage: number;
  marginFraction?: number;
  positionSide: "flat" | "long" | "short";
  positionSizeBase: number;
  entryPriceUsd: number | null;
  markPriceUsd: number | null;
  unrealizedPnlUsd: number;
}): PaperPerpSizing {
  const marginFraction = params.marginFraction ?? PAPER_MARGIN_FRACTION;
  const leverage = params.leverage;
  const mark = params.markPriceUsd;

  const nextTradeMarginUsd = params.balanceUsdc * marginFraction;
  const nextTradeNotionalUsd = nextTradeMarginUsd * leverage;
  const nextTradeSizeBase =
    mark != null && mark > 0 ? nextTradeNotionalUsd / mark : null;

  let notionalUsd: number | null = null;
  let marginUsd: number | null = null;
  if (params.positionSide !== "flat" && params.entryPriceUsd != null) {
    notionalUsd = params.entryPriceUsd * params.positionSizeBase;
    marginUsd = notionalUsd / leverage;
  }

  const unrealizedPnlPctOnMargin =
    marginUsd != null && marginUsd > 0
      ? (params.unrealizedPnlUsd / marginUsd) * 100
      : null;

  return {
    markPriceUsd: mark,
    marginUsd,
    notionalUsd,
    unrealizedPnlPctOnMargin,
    nextTradeMarginUsd,
    nextTradeNotionalUsd,
    nextTradeSizeBase,
  };
}

/** Human-readable receipt for a paper perp fill. */
export function formatPaperTradeReceipt(
  trade: PaperTradeRecord,
  leverage: number,
  takerFeeBps = 5,
): string {
  const feeUsd = trade.notionalUsd * (takerFeeBps / 10_000);
  const marginUsd = trade.notionalUsd / leverage;
  const action = trade.action.replace(/_/g, " ");
  const pnl =
    trade.pnlUsd != null
      ? ` · realized ${trade.pnlUsd >= 0 ? "+" : ""}$${trade.pnlUsd.toFixed(2)}`
      : "";
  return (
    `${action} · ${trade.sizeBase.toFixed(0)} tokens @ $${trade.priceUsd.toFixed(4)}` +
    ` · ~$${trade.notionalUsd.toFixed(0)} notional · ~$${marginUsd.toFixed(0)} margin @ ${leverage}x` +
    ` · fee ~$${feeUsd.toFixed(2)}${pnl} · cash $${trade.balanceUsdc.toFixed(2)}`
  );
}
