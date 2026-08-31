"use client";

import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/ui";
import { PageGuide } from "@/components/page-guide";
import { COMPETITION_WALLET } from "@gcc/shared";
import { useGccSocket } from "@/hooks/use-gcc-socket";

export default function PositionsPage() {
  const { connected } = useGccSocket();
  return (
    <Shell connected={connected}>
      <div className="space-y-4">
        <PageGuide page="positions" />
        <Card title="What will appear here">
          <p className="text-sm leading-relaxed text-zinc-400">
            Open Phoenix perpetual positions for your authority: side (long/short),
            size, entry price, mark, unrealized PnL, and liquidation distance.
            You will close or reduce from this screen once trader-state sync is
            wired.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-300">
            <li>• Today: use Trade → Simulate Order to practice entries (Paper)</li>
            <li>• On-chain positions: manage on Phoenix until this tab is live</li>
            <li>• Competition wallet (for GCC week):</li>
          </ul>
          <p className="mt-2 break-all font-mono text-xs text-sky-300">
            {COMPETITION_WALLET}
          </p>
          <Link
            href="/trade"
            className="mt-4 inline-block text-sm text-emerald-400 hover:underline"
          >
            Go to Trade workspace →
          </Link>
        </Card>
      </div>
    </Shell>
  );
}
