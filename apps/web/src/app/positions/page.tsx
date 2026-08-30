"use client";

import { Shell } from "@/components/shell";
import { Card } from "@/components/ui";
import { useGccSocket } from "@/hooks/use-gcc-socket";

export default function PositionsPage() {
  const { connected } = useGccSocket();
  return (
    <Shell connected={connected}>
      <Card title="Positions">
        <p className="text-sm text-zinc-400">
          Connect your competition wallet and deposit collateral on Phoenix to see
          open positions here. Trader-state streaming will populate this panel once
          your authority is active on-chain.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-zinc-300">
          <li>• Close market / limit from Trade screen</li>
          <li>• Attach stop-loss / take-profit (via Phoenix conditionals API)</li>
          <li>• View entry, mark, and unrealized PnL per market</li>
        </ul>
      </Card>
    </Shell>
  );
}
