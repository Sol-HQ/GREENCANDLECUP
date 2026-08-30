"use client";

import { Badge, Button } from "@/components/ui";
import { useNetwork } from "@/components/network-provider";

export function NetworkToggle() {
  const { network, setWalletCluster, setTradingMode } = useNetwork();
  if (!network) return null;

  const isMainnet = network.walletCluster === "mainnet-beta";
  const isPaper = network.tradingMode === "paper";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-zinc-700 p-0.5 text-xs">
        <Button
          variant={isMainnet ? "primary" : "secondary"}
          className="!px-2 !py-1 !text-xs"
          onClick={() => void setWalletCluster("mainnet-beta")}
        >
          Mainnet
        </Button>
        <Button
          variant={!isMainnet ? "primary" : "secondary"}
          className="!px-2 !py-1 !text-xs"
          onClick={() => void setWalletCluster("devnet")}
        >
          Devnet
        </Button>
      </div>
      <div className="flex rounded-lg border border-zinc-700 p-0.5 text-xs">
        <Button
          variant={isPaper ? "primary" : "secondary"}
          className="!px-2 !py-1 !text-xs"
          onClick={() => void setTradingMode("paper")}
        >
          Paper
        </Button>
        <Button
          variant={!isPaper ? "primary" : "secondary"}
          className="!px-2 !py-1 !text-xs"
          onClick={() => void setTradingMode("live")}
        >
          Live
        </Button>
      </div>
      <Badge ok={isPaper}>{isPaper ? "Simulated" : "Real $"}</Badge>
    </div>
  );
}
