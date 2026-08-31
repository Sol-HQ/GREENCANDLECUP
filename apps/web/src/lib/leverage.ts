/** Standard leverage steps; filtered per Phoenix market max. */
const LEVERAGE_STEPS = [
  1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100,
] as const;

export function leverageOptionsForMarket(maxLeverage: number): number[] {
  const cap = Math.max(1, Math.floor(maxLeverage));
  const opts: number[] = LEVERAGE_STEPS.filter((step) => step <= cap);
  if (cap > 1 && !opts.includes(cap)) opts.push(cap);
  return [...new Set(opts)].sort((a, b) => a - b);
}

export function clampLeverage(requested: number, maxLeverage: number): number {
  const cap = Math.max(1, Math.floor(maxLeverage));
  return Math.min(Math.max(1, requested), cap);
}

export function leverageForSymbol(
  symbol: string,
  leverageBySymbol: Record<string, number>,
  fallback: number,
  maxLeverage: number,
): number {
  const raw = leverageBySymbol[symbol] ?? fallback;
  return clampLeverage(raw, maxLeverage);
}
