/** Helius is billed per credit — must never be used for reads, polls, or wallet UI. */
const HELIUS_HOST = /helius-rpc\.com/i;

export function isHeliusRpcUrl(url: string): boolean {
  return HELIUS_HOST.test(url.trim());
}

export function assertReadRpcNotHelius(url: string, label: string): void {
  if (isHeliusRpcUrl(url)) {
    throw new Error(
      `${label} must not use Helius (transaction send only). Check .env routing.`,
    );
  }
}

/** Never let the browser wallet adapter point at a billed RPC. */
export function sanitizeWalletRpcUrl(
  url: string | undefined,
  cluster: "mainnet-beta" | "devnet",
): string {
  const fallback =
    cluster === "devnet"
      ? "https://api.devnet.solana.com"
      : "https://api.mainnet-beta.solana.com";
  const candidate = url?.trim() || fallback;
  if (isHeliusRpcUrl(candidate)) return fallback;
  return candidate;
}

export function maskRpcApiKey(url: string): string {
  return url.replace(/api-key=[^&]+/i, "api-key=***");
}

export type ReadRpcClass = "public" | "dedicated" | "helius";

/** Classify read RPC for infra dashboard — Helius must never be used here. */
export function classifyReadRpcUrl(url: string): ReadRpcClass {
  const trimmed = url.trim();
  if (isHeliusRpcUrl(trimmed)) return "helius";
  if (
    /api\.mainnet-beta\.solana\.com/i.test(trimmed) ||
    /api\.devnet\.solana\.com/i.test(trimmed)
  ) {
    return "public";
  }
  return "dedicated";
}
