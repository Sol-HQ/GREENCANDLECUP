"use client";

import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/ui";
import { PageGuide } from "@/components/page-guide";
import { useGccSocket } from "@/hooks/use-gcc-socket";

export default function OrdersPage() {
  const { connected } = useGccSocket();
  return (
    <Shell connected={connected}>
      <div className="space-y-4">
        <PageGuide page="orders" />
        <Card title="What will appear here">
          <p className="text-sm leading-relaxed text-zinc-400">
            Resting limit orders on Phoenix: price, size, side, filled amount,
            and cancel buttons. Paper mode simulates immediate fills — you will
            not see resting paper orders here.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            Until this is built, place test orders from the{" "}
            <Link href="/trade" className="text-emerald-400 hover:underline">
              Trade
            </Link>{" "}
            panel (Paper → Simulate Order) and watch the status message below
            the button.
          </p>
        </Card>
      </div>
    </Shell>
  );
}
