"use client";

import Link from "next/link";
import { COMPETITION_WALLET, GLOSSARY } from "@gcc/shared";
import { Card } from "@/components/ui";
import { useNetwork } from "@/components/network-provider";

export function GettingStartedCard() {
  const { network } = useNetwork();
  const isPaper = network?.tradingMode !== "live";

  return (
    <Card title="How this dashboard fits Green Candle Cup">
      <div className="space-y-4 text-sm leading-relaxed text-zinc-300">
        <p>{GLOSSARY.whatIsGcc.body}</p>
        <p>{GLOSSARY.perpsVsSpot.body}</p>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Typical workflow (today)
          </p>
          <ol className="list-decimal space-y-2 pl-4 text-zinc-400">
            <li>
              <strong className="text-zinc-200">Pick a market</strong> — Symbol
              picker (SOL, BTC, etc.). Same symbol everywhere.
            </li>
            <li>
              <strong className="text-zinc-200">Stay on Paper</strong> — Header
              toggle until you understand the bot and risk limits.{" "}
              {isPaper ? (
                <span className="text-emerald-400">You are on Paper now.</span>
              ) : (
                <span className="text-amber-400">
                  You are on Live — orders still do not sign from the browser.
                </span>
              )}
            </li>
            <li>
              <strong className="text-zinc-200">Analyze on Trade</strong> — GCC
              chart = Phoenix perps. TV/Birdeye = reference only.
            </li>
            <li>
              <strong className="text-zinc-200">Simulate orders</strong> — Trade
              panel → Buy/Long or Sell/Short → Simulate Order. Real prices, no
              chain tx.
            </li>
            <li>
              <strong className="text-zinc-200">Optional: run the bot</strong> —
              Bot tab, Paper mode, pick a strategy, Start.
            </li>
            <li>
              <strong className="text-zinc-200">Competition week</strong> —
              Mainnet + Live + funded Phoenix account on your competition wallet.
            </li>
          </ol>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-400">
            <p className="mb-1 font-medium text-zinc-300">Competition wallet</p>
            <p className="break-all font-mono text-[11px] text-sky-300">
              {COMPETITION_WALLET}
            </p>
            <p className="mt-2">{GLOSSARY.competitionWallet.body}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-400">
            <p className="mb-1 font-medium text-zinc-300">Paper vs Live</p>
            <p>{GLOSSARY.paperVsLive.body}</p>
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          Questions? Each tab has a guide at the top. Bot tab has the full
          glossary.{" "}
          <Link href="/trade" className="text-emerald-400 hover:underline">
            Open Trade workspace
          </Link>
        </p>
      </div>
    </Card>
  );
}
