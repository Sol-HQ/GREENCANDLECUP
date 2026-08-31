import {
  classifyReadRpcUrl,
  maskRpcApiKey,
  type ReadRpcClass,
} from "@gcc/shared";
import {
  getPhoenixReadRpcUrl,
  getPublicWalletRpcUrl,
  getTxRpcUrl,
} from "./env.js";
import type { ShredStreamStatus } from "./shredstream.js";

const PHOENIX_API_HOST = (
  process.env.PHOENIX_API_URL ?? "https://perp-api.phoenix.trade"
)
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

export type InfraStatus = {
  phoenixApiHost: string;
  phoenixDataPath: string;
  readRpcUrl: string;
  readRpcMasked: string;
  readRpcClass: ReadRpcClass;
  readRpcLatencyMs: number | null;
  walletRpcMasked: string;
  txRpcMasked: string;
  txRpcIsHelius: boolean;
  vpsPublicIp: string | null;
  shredStream: ShredStreamStatus;
  warnings: string[];
};

export async function probeReadRpcLatency(
  rpcUrl: string,
): Promise<number | null> {
  try {
    const start = Date.now();
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSlot",
        params: [{ commitment: "confirmed" }],
      }),
    });
    if (!res.ok) return null;
    await res.json();
    return Date.now() - start;
  } catch {
    return null;
  }
}

export async function buildInfraStatus(
  shredStream: ShredStreamStatus,
): Promise<InfraStatus> {
  const readRpcUrl = getPhoenixReadRpcUrl();
  const readRpcClass = classifyReadRpcUrl(readRpcUrl);
  const readRpcLatencyMs = await probeReadRpcLatency(readRpcUrl);
  const txRpc = getTxRpcUrl();
  const warnings: string[] = [];

  if (readRpcClass === "public") {
    warnings.push(
      "Read RPC is public api.mainnet-beta.solana.com — fine for wallet/Rise bootstrap, but set READ_RPC_URL or TRITON_RPC_URL for dedicated reads before live trading.",
    );
  }
  if (!txRpc.includes("helius")) {
    warnings.push(
      "Tx RPC is not Helius — live order submit may be unreliable until HELIUS_RPC_URL is set.",
    );
  }
  if (shredStream.configured && !shredStream.active) {
    warnings.push(
      "ShredStream port is open but no UDP packets yet — register VPS IP + port with Triton (NYC) and ensure Vultr server is running.",
    );
  }

  return {
    phoenixApiHost: PHOENIX_API_HOST,
    phoenixDataPath:
      "Phoenix WebSocket (mark + L2 orderbook) · REST for candles — not Solana RPC",
    readRpcUrl,
    readRpcMasked: maskRpcApiKey(readRpcUrl),
    readRpcClass,
    readRpcLatencyMs,
    walletRpcMasked: getPublicWalletRpcUrl(),
    txRpcMasked: maskRpcApiKey(txRpc),
    txRpcIsHelius: txRpc.includes("helius"),
    vpsPublicIp: process.env.VPS_PUBLIC_IP?.trim() || null,
    shredStream,
    warnings,
  };
}
