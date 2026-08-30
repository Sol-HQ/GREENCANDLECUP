/**
 * Resolve Helius RPC URL from HELIUS_RPC_URL or HELIUS_API_KEY.
 */
export function getHeliusRpcUrl(): string {
  if (process.env.HELIUS_RPC_URL?.trim()) {
    return process.env.HELIUS_RPC_URL.trim();
  }
  const key = process.env.HELIUS_API_KEY?.trim();
  if (key) {
    return `https://mainnet.helius-rpc.com/?api-key=${key}`;
  }
  return "https://api.mainnet-beta.solana.com";
}
