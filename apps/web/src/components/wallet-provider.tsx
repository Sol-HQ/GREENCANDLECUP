"use client";

import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { useMemo } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";
import { NetworkProvider, useNetwork } from "@/components/network-provider";

function WalletInner({ children }: { children: React.ReactNode }) {
  const { network } = useNetwork();
  const endpoint =
    network?.walletRpcUrl ??
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    "https://api.mainnet-beta.solana.com";
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider key={endpoint} endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function WalletProviders({ children }: { children: React.ReactNode }) {
  return (
    <NetworkProvider>
      <WalletInner>{children}</WalletInner>
    </NetworkProvider>
  );
}
