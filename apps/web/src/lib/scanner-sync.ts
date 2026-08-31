import type { CandleTimeframe } from "@gcc/shared";

const CHANNEL_NAME = "gcc-scanner-chart-sync";

export type ScannerSyncMessage =
  | { type: "state"; symbol: string; timeframe: CandleTimeframe }
  | { type: "popout-opened" }
  | { type: "popout-closed" };

export function broadcastScannerSync(message: ScannerSyncMessage) {
  if (typeof window === "undefined") return;
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  } catch {
    // BroadcastChannel unavailable — single-window only
  }
}

export function subscribeScannerSync(
  handler: (message: ScannerSyncMessage) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<ScannerSyncMessage>) => {
      handler(event.data);
    };
    return () => channel.close();
  } catch {
    return () => {};
  }
}
