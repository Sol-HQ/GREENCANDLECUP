"use client";

import { Stat } from "@/components/ui";
import type { PaperPortfolioState } from "@gcc/shared";

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

export function PaperWalletBar({
  paper,
}: {
  paper: PaperPortfolioState | null;
}) {
  if (!paper) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="text-sm text-zinc-500">Waiting for wallet…</p>
      </div>
    );
  }

  const tradingNet = paper.tradingBalanceUsdc - paper.startingBalanceUsdc;
  const inPosition = paper.positionSide !== "flat";
  const corrupt =
    !Number.isFinite(paper.balanceUsdc) ||
    paper.balanceUsdc > paper.tradingCapUsdc * 10 ||
    paper.balanceUsdc < 0;

  if (corrupt) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-100">
        Wallet data looks corrupted ({fmt(paper.balanceUsdc)}).{" "}
        <a href="/bot" className="underline">
          Bot → Reset paper wallet
        </a>{" "}
        to restore defaults.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="mb-3 text-xs text-zinc-500">
        Two-wallet paper model: <strong className="text-zinc-300">Funding</strong>{" "}
        vault + <strong className="text-zinc-300">Trading</strong> wallet (max{" "}
        {fmt(paper.tradingCapUsdc)}). Perps only use trading cash.
      </p>
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Funding wallet" value={fmt(paper.fundingBalanceUsdc)} />
        <Stat
          label={`Trading wallet (cap ${fmt(paper.tradingCapUsdc)})`}
          value={fmt(paper.tradingBalanceUsdc)}
          tone={
            tradingNet > 0 ? "good" : tradingNet < 0 ? "bad" : undefined
          }
        />
        <Stat
          label="Total (funding + trading equity)"
          value={fmt(paper.totalBalanceUsdc)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Trading started" value={fmt(paper.startingBalanceUsdc)} />
        <Stat
          label="Trading net P&L"
          value={`${tradingNet >= 0 ? "+" : ""}${fmt(tradingNet)}`}
          tone={tradingNet > 0 ? "good" : tradingNet < 0 ? "bad" : undefined}
        />
        <Stat
          label="Realized (closed)"
          value={`${paper.realizedPnlUsd >= 0 ? "+" : ""}${fmt(paper.realizedPnlUsd)}`}
          tone={
            paper.realizedPnlUsd > 0
              ? "good"
              : paper.realizedPnlUsd < 0
                ? "bad"
                : undefined
          }
        />
        <Stat
          label={inPosition ? "Trading equity" : "Trading equity"}
          value={fmt(paper.equityUsdc)}
        />
      </div>
    </div>
  );
}

export function SourceBadge({ source }: { source: "manual" | "bot" }) {
  return (
    <span
      className={
        source === "manual"
          ? "rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300"
          : "rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-300"
      }
    >
      {source}
    </span>
  );
}
