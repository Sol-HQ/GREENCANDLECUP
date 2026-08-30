"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { cn } from "@/lib/utils";
import { Badge } from "./ui";

const links = [
  { href: "/", label: "Overview" },
  { href: "/trade", label: "Trade" },
  { href: "/positions", label: "Positions" },
  { href: "/orders", label: "Orders" },
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#0f3d2e_0%,_#050505_45%)] text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-black/50 backdrop-blur">
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
          <WalletMultiButton className="!bg-zinc-800 !text-sm" />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-row gap-2 overflow-x-auto lg:flex-col">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition",
                pathname === link.href
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
