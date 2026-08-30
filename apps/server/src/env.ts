/**
 * Resolve Helius RPC URL from env, optionally per cluster.
 */
import type { SolanaCluster } from "@gcc/shared";

export function resolveCluster(
  override?: SolanaCluster,
): SolanaCluster {
  if (override) return override;
  return process.env.SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet-beta";
}

export function getHeliusRpcUrl(cluster?: SolanaCluster): string {
  const resolved = resolveCluster(cluster);
  const explicit = process.env.HELIUS_RPC_URL?.trim();
  if (explicit) {
    if (resolved === "devnet" && explicit.includes("mainnet")) {
      const key = process.env.HELIUS_API_KEY?.trim();
      if (key) return `https://devnet.helius-rpc.com/?api-key=${key}`;
    }
    return explicit;
  }
  const key = process.env.HELIUS_API_KEY?.trim();
  if (key) {
    return resolved === "devnet"
      ? `https://devnet.helius-rpc.com/?api-key=${key}`
      : `https://mainnet.helius-rpc.com/?api-key=${key}`;
  }
  return resolved === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com";
}

export function maskRpcUrl(url: string): string {
  return url.replace(/api-key=[^&]+/i, "api-key=***");
}
