/** Decimal places for per-token USD prices (mark, bid, ask, orderbook). */
export function decimalsForPrice(value: number): number {
  const abs = Math.abs(value);
  if (!Number.isFinite(abs) || abs === 0) return 2;
  if (abs >= 10_000) return 2;
  if (abs >= 1_000) return 2;
  if (abs >= 100) return 3;
  if (abs >= 1) return 4;
  if (abs >= 0.1) return 6;
  if (abs >= 0.01) return 7;
  if (abs >= 0.001) return 8;
  if (abs >= 0.0001) return 9;
  if (abs >= 0.00001) return 10;
  return 11;
}

export function decimalsForTokenAmount(value: number): number {
  const abs = Math.abs(value);
  if (!Number.isFinite(abs) || abs === 0) return 4;
  if (abs >= 10_000) return 2;
  if (abs >= 100) return 2;
  if (abs >= 1) return 4;
  if (abs >= 0.01) return 6;
  return 8;
}

function formatWithDigits(value: number, digits: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Full-precision USD price for a token (mark, bid, ask). */
export function formatPriceUsd(
  value: string | number | null | undefined,
): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${formatWithDigits(n, decimalsForPrice(n))}`;
}

/** Same as formatPriceUsd without the $ prefix (orderbook columns). */
export function formatPricePlain(
  value: string | number | null | undefined,
): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatWithDigits(n, decimalsForPrice(n));
}

/** Base-token size (orderbook qty, position size). */
export function formatTokenAmount(
  value: string | number | null | undefined,
): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatWithDigits(n, decimalsForTokenAmount(n));
}

/** Dollar notional, fees, PnL — 2 decimals unless very small. */
export function formatUsdNotional(
  value: string | number | null | undefined,
): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const digits = Math.abs(n) < 1 && Math.abs(n) > 0 ? decimalsForPrice(n) : 2;
  return `$${formatWithDigits(n, digits)}`;
}

export function formatCompactUsd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return formatUsdNotional(value);
}

export function formatNumber(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** @deprecated Use formatPriceUsd for marks/bids/asks or formatUsdNotional for PnL/fees. */
export function formatUsd(
  value: string | number | null | undefined,
  digits?: number,
) {
  if (digits != null) {
    if (value == null || value === "") return "—";
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return `$${formatWithDigits(n, digits)}`;
  }
  return formatPriceUsd(value);
}

/** lightweight-charts axis + crosshair — full tick precision for low-priced perps (JUP, etc.). */
export function chartPriceFormatOptions(referencePrice: number) {
  const precision = decimalsForPrice(referencePrice);
  return {
    type: "price" as const,
    precision,
    minMove: 10 ** -precision,
  };
}
