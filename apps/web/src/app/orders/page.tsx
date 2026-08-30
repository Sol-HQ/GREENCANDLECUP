"use client";

import { Shell } from "@/components/shell";
import { Card } from "@/components/ui";
import { useGccSocket } from "@/hooks/use-gcc-socket";

export default function OrdersPage() {
  const { connected } = useGccSocket();
  return (
    <Shell connected={connected}>
      <Card title="Open Orders">
        <p className="text-sm text-zinc-400">
          Resting limit orders will appear here once trader-state sync is wired to
          your authority. Use cancel one / cancel all controls from this screen in
          the next iteration.
        </p>
      </Card>
    </Shell>
  );
}
