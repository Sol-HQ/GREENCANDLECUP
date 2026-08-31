"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/ui";
import { PageGuide } from "@/components/page-guide";
import { PaperLedgerPanel } from "@/components/paper-ledger-panel";
import { COMPETITION_WALLET } from "@gcc/shared";
import type { PaperPortfolioState, PaperTradeRecord } from "@gcc/shared";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import { useNetwork } from "@/components/network-provider";
import { api } from "@/lib/utils";

export default function PositionsPage() {
  const { connected, paperPortfolio, paperTrades } = useGccSocket();
  const { network } = useNetwork();
  const mode = network?.tradingMode ?? "paper";
  const [paper, setPaper] = useState<PaperPortfolioState | null>(null);
  const [trades, setTrades] = useState<PaperTradeRecord[]>([]);
  const [closing, setClosing] = useState(false);
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    const [p, t] = await Promise.all([
      api<PaperPortfolioState>("/api/paper/portfolio"),
      api<{ trades: PaperTradeRecord[] }>("/api/paper/trades"),
    ]);
    setPaper(p);
    setTrades(t.trades);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, paperPortfolio, paperTrades]);

  const displayPaper = paperPortfolio ?? paper;
  const allTrades = useMemo(() => {
    if (paperTrades.length === 0) return trades;
    const byId = new Map<string, PaperTradeRecord>();
    for (const t of trades) byId.set(t.id, t);
    for (const t of paperTrades) byId.set(t.id, t);
    return [...byId.values()].sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );
  }, [trades, paperTrades]);

  const closePosition = async (symbol: string) => {
    setClosing(true);
    setStatus("");
    try {
      const result = await api<{ receipt: string }>("/api/paper/close", {
        method: "POST",
        body: JSON.stringify({ symbol }),
      });
      setStatus(result.receipt);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Close failed");
    } finally {
      setClosing(false);
    }
  };

  return (
    <Shell connected={connected}>
      <div className="space-y-4">
        <PageGuide page="positions" />

        {mode === "paper" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-zinc-400">
                All open and closed paper positions — manual and bot — one $100
                wallet.
              </p>
              <div className="flex gap-2 text-sm">
                <Link href="/" className="text-emerald-400 hover:underline">
                  Manual trade →
                </Link>
                <Link href="/bot" className="text-cyan-400 hover:underline">
                  Bot →
                </Link>
              </div>
            </div>

            <PaperLedgerPanel
              paper={displayPaper}
              trades={allTrades}
              onClose={(sym) => void closePosition(sym)}
              closing={closing}
              onRefresh={() => void refresh()}
            />

            {status ? (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 font-mono text-xs text-emerald-300">
                {status}
              </p>
            ) : null}
          </>
        ) : (
          <Card title="Live positions">
            <p className="text-sm text-zinc-400">
              On-chain Phoenix positions for your wallet appear here once live
              trader sync is wired. Competition wallet:
            </p>
            <p className="mt-2 break-all font-mono text-xs text-sky-300">
              {COMPETITION_WALLET}
            </p>
          </Card>
        )}
      </div>
    </Shell>
  );
}
