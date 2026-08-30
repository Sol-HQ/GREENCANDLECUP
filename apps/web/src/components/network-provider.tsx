"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { NetworkConfig, SolanaCluster, TradeMode } from "@gcc/shared";
import { api } from "@/lib/utils";

type NetworkState = NetworkConfig & {
  walletRpcUrl: string;
  walletRpcMasked?: string;
  botRpcMasked?: string;
};

type NetworkContextValue = {
  network: NetworkState | null;
  refresh: () => Promise<void>;
  setWalletCluster: (cluster: SolanaCluster) => Promise<void>;
  setTradingMode: (mode: TradeMode) => Promise<void>;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<NetworkState | null>(null);

  const refresh = useCallback(async () => {
    const data = await api<NetworkState>("/api/network");
    setNetwork(data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patch = async (body: Partial<NetworkConfig>) => {
    const data = await api<NetworkState>("/api/network", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setNetwork(data);
  };

  const setWalletCluster = async (cluster: SolanaCluster) => {
    await patch({ walletCluster: cluster });
  };

  const setTradingMode = async (mode: TradeMode) => {
    await patch({ tradingMode: mode });
  };

  const value = useMemo(
    () => ({ network, refresh, setWalletCluster, setTradingMode }),
    [network, refresh],
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}
