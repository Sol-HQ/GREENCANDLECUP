"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/ui";
import { PageGuide } from "@/components/page-guide";
import { PaperPositionPanel } from "@/components/paper-position-panel";
import { COMPETITION_WALLET, formatPaperTradeReceipt } from "@gcc/shared";
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
  const symbol =
    displayPaper?.positionSide !== "flat"
      ? trades.at(-1)?.symbol ?? "JUP"
      : "JUP";
  const allTrades =
    paperTrades.length > 0
      ? [...paperTrades, ...trades.filter((t) => !paperTrades.some((p) => p.id === t.id))]
      : trades;

  const closePosition = async () => {
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
            <PaperPositionPanel
              paper={displayPaper}
              symbol={symbol}
              onClose={() => void closePosition()}
              closing={closing}
            />
            {status ? (
              <p className="text-sm text-emerald-300">{status}</p>
            ) : null}
            <Card title="Recent paper fills">
              {allTrades.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No fills yet. Trade on Overview or Bot — same $100 wallet.
                </p>
              ) : (
                <ul className="space-y-2 text-xs font-mono text-zinc-300">
                  {allTrades
                    .slice()
                    .reverse()
                    .slice(0, 20)
                    .map((t) => (
                      <li
                        key={t.id}
                        className="rounded border border-zinc-800/80 bg-zinc-900/40 px-3 py-2"
                      >
                        {formatPaperTradeReceipt(
                          t,
                          displayPaper?.leverage ?? 2,
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </Card>
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
        <Link
          href="/trade"
          className="inline-block text-sm text-emerald-400 hover:underline"
        >
          Go to Trade workspace →
        </Link>
      </div>
    </Shell>
  );
}
