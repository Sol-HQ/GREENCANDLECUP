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
