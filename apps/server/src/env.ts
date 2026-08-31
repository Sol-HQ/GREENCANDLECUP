/**
 * RPC routing — Helius is transaction-send only; everything else uses public
 * Solana RPC or Phoenix HTTP API.
 */
import type { SolanaCluster } from "@gcc/shared";
import {
  assertReadRpcNotHelius,
  isHeliusRpcUrl,
  maskRpcApiKey,
} from "@gcc/shared";

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
  return maskRpcApiKey(url);
}

/** Browser wallet reads (balance, token accounts) — free public RPC only. */
export function getPublicWalletRpcUrl(cluster?: SolanaCluster): string {
  const resolved = resolveCluster(cluster);
  const url =
    resolved === "devnet"
      ? "https://api.devnet.solana.com"
      : "https://api.mainnet-beta.solana.com";
  assertReadRpcNotHelius(url, "Wallet RPC");
  return url;
}

/**
 * Rise SDK fallback + simulateTransaction — standard Solana JSON-RPC.
 * Override with PHOENIX_READ_RPC_URL if public endpoints rate-limit you.
 * Phoenix market data (orderbook, candles, mark) still comes from HTTP API.
 */
export function getPhoenixReadRpcUrl(cluster?: SolanaCluster): string {
  const override = process.env.PHOENIX_READ_RPC_URL?.trim();
  if (override) {
    assertReadRpcNotHelius(override, "PHOENIX_READ_RPC_URL");
    return override;
  }
  return getPublicWalletRpcUrl(cluster);
}

/** @deprecated Use getPhoenixReadRpcUrl */
export function getPhoenixRpcUrl(cluster?: SolanaCluster): string {
  return getPhoenixReadRpcUrl(cluster);
}

/** Helius — sendTransaction / confirm only (Phase 2 live submit). */
export function getTxRpcUrl(cluster?: SolanaCluster): string {
  return getHeliusRpcUrl(cluster);
}

/** Fail fast at boot if env would route reads through Helius. */
export function validateRpcRoutingAtStartup(): void {
  const phoenixRead = getPhoenixReadRpcUrl();
  const wallet = getPublicWalletRpcUrl();
  assertReadRpcNotHelius(phoenixRead, "Phoenix read RPC");
  assertReadRpcNotHelius(wallet, "Wallet RPC");

  for (const [label, value] of [
    ["NEXT_PUBLIC_SOLANA_RPC_URL", process.env.NEXT_PUBLIC_SOLANA_RPC_URL],
    ["SOLANA_RPC_URL", process.env.SOLANA_RPC_URL],
  ] as const) {
    const trimmed = value?.trim();
    if (trimmed && isHeliusRpcUrl(trimmed)) {
      throw new Error(
        `${label} must not point at Helius — wallet and Rise reads would burn credits.`,
      );
    }
  }

  const tx = getTxRpcUrl();
  if (!isHeliusRpcUrl(tx)) {
    console.warn(
      "[GCC] Tx RPC is not Helius — live submit will use public RPC until HELIUS_RPC_URL is set.",
    );
  }
}
