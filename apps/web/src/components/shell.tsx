"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { cn } from "@/lib/utils";
import { Badge } from "./ui";
import { NetworkToggle } from "./network-toggle";
import { useNetwork } from "./network-provider";
import { WorkspaceProvider } from "./workspace/workspace-context";
import { WorkspaceChrome } from "./workspace/workspace-chrome";
import { FloatingChartWindow } from "./floating-chart-window";
import { useScannerChart } from "./scanner-chart-provider";
import { Button } from "./ui";

const links: { href: string; label: string; badge?: string }[] = [
  { href: "/", label: "Overview" },
  { href: "/trade", label: "Trade" },
  { href: "/positions", label: "Positions" },
  { href: "/orders", label: "Orders", badge: "Soon" },
  { href: "/bot", label: "Bot" },
  { href: "/system", label: "System" },
];

export function Shell({
  children,
  connected,
}: {
  children: React.ReactNode;
  connected?: boolean;
}) {
  const pathname = usePathname();
  const scanner = useScannerChart();
  const { network } = useNetwork();
  const onDevnet = network?.walletCluster === "devnet";

  return (
    <WorkspaceProvider>
    <div className="relative min-h-screen text-zinc-100">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[#050505]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#0f3d2e_0%,_#050505_45%)]"
        aria-hidden
      />

      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/20 text-center text-lg leading-9">
              🕯️
            </div>
            <div>
              <p className="text-sm font-semibold">Green Candle Cup</p>
              <p className="text-xs text-zinc-500">Phoenix Perps Command Center</p>
            </div>
            <Badge ok={connected}>{connected ? "Live" : "Offline"}</Badge>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="secondary"
              className="!text-xs"
              onClick={() => scanner.toggle()}
            >
              {scanner.open ? "Hide scanner" : "Scanner chart"}
            </Button>
            <NetworkToggle />
            <WalletMultiButton className="!bg-zinc-800 !text-sm" />
          </div>
        </div>
      </header>

      {onDevnet ? (
        <div className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-center text-xs text-amber-200">
          Devnet only affects your wallet RPC. Phoenix perps and GCC competition
          are <strong>mainnet only</strong> — market data here is always mainnet
          Phoenix.
        </div>
      ) : null}

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 pb-16 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-row gap-2 overflow-x-auto pb-1 lg:sticky lg:top-[4.25rem] lg:h-fit lg:flex-col lg:overflow-visible lg:pb-0">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-sm transition",
                pathname === link.href
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
              )}
            >
              {link.label}
              {link.badge ? (
                <span className="ml-1.5 rounded bg-zinc-800 px-1 py-0.5 text-[9px] uppercase text-zinc-500">
                  {link.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 overflow-x-hidden">
          <WorkspaceChrome>{children}</WorkspaceChrome>
        </main>
      </div>
    </div>
    <FloatingChartWindow />
    </WorkspaceProvider>
  );
}
