"use client";

import Link from "next/link";
import { Card, Stat, Button } from "@/components/ui";
import type { BotConfig, PaperPortfolioState } from "@gcc/shared";
import { PAPER_MARGIN_FRACTION } from "@gcc/shared";
import { formatPriceUsd } from "@/lib/market-symbols";
import { SourceBadge } from "@/components/paper-wallet-bar";

function fmtUsd(n: number, digits = 2) {
  return `$${n.toFixed(digits)}`;
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtSize(base: number) {
  return base >= 1 ? base.toFixed(2) : base.toFixed(4);
}

export function PaperPositionPanel({
  paper,
  viewSymbol,
  cfg,
  isRunning,
  onClose,
  closing,
  compact,
}: {
  paper: PaperPortfolioState | null;
  /** Page/chart symbol — used for mismatch warnings only. */
  viewSymbol?: string;
  cfg?: BotConfig | null;
  isRunning?: boolean;
  onClose?: () => void;
  closing?: boolean;
  compact?: boolean;
}) {
  const leverage = paper?.leverage ?? cfg?.paperLeverage ?? 2;
  const marginPct = Math.round(PAPER_MARGIN_FRACTION * 100);
  const takerBps = cfg?.paperTakerFeeBps ?? 5;

  if (!paper) {
    return (
      <Card title="Paper wallet">
        <p className="text-sm text-zinc-500">Waiting for portfolio data…</p>
      </Card>
    );
  }

  const inPosition = paper.positionSide !== "flat";
  const posSymbol = paper.positionSymbol;
  const mark = paper.markPriceUsd;
  const unrealized = paper.unrealizedPnlUsd;
  const unrealizedPct = paper.unrealizedPnlPctOnMargin;
  const symbolMismatch =
    inPosition &&
    posSymbol != null &&
    viewSymbol != null &&
    posSymbol !== viewSymbol.toUpperCase();

  return (
    <Card title={compact ? "Paper wallet" : "Paper wallet (shared with bot)"}>
      {!compact ? (
        <p className="mb-3 text-xs text-zinc-500">
          One simulated USDC wallet — bot and manual trades share the same cash
          balance. Size in USD = <strong className="text-zinc-300">notional</strong>{" "}
          exposure; margin = notional ÷ leverage.
        </p>
      ) : null}

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Stat label="Cash balance" value={fmtUsd(paper.balanceUsdc)} />
        <Stat
          label="Equity (cash + open P&L)"
          value={fmtUsd(paper.equityUsdc)}
          tone={
            paper.equityUsdc > paper.startingBalanceUsdc
              ? "good"
              : paper.equityUsdc < paper.startingBalanceUsdc
                ? "bad"
                : undefined
          }
        />
        <Stat
          label="Unrealized P&L"
          value={
            inPosition
              ? `${unrealized >= 0 ? "+" : ""}${fmtUsd(unrealized)}${
                  unrealizedPct != null ? ` (${fmtPct(unrealizedPct)} on margin)` : ""
                }`
              : "— (flat)"
          }
          tone={unrealized > 0 ? "good" : unrealized < 0 ? "bad" : undefined}
        />
        <Stat
          label={
            inPosition && posSymbol
              ? `Mark (${posSymbol})`
              : "Position mark"
          }
          value={
            inPosition && mark != null
              ? formatPriceUsd(String(mark))
              : "— (flat)"
          }
        />
      </div>

      {symbolMismatch ? (
        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
          Open position is on <strong>{posSymbol}</strong>, not {viewSymbol}. Prices
          below are for <strong>{posSymbol}</strong>.{" "}
          <Link href="/positions" className="text-amber-300 underline">
            Manage on Positions →
          </Link>
        </div>
      ) : null}

      {inPosition && posSymbol ? (
        <div className="space-y-2 rounded-lg border border-sky-500/30 bg-sky-950/20 p-3 text-sm text-zinc-300">
          <p className="font-medium text-sky-200">
            Open {paper.positionSide.toUpperCase()} · {posSymbol}{" "}
            {paper.positionSource ? (
              <SourceBadge source={paper.positionSource} />
            ) : null}
          </p>
          <div className="grid gap-1 font-mono text-xs text-zinc-400 md:grid-cols-2">
            <p>Entry: {formatPriceUsd(String(paper.entryPriceUsd ?? 0))}</p>
            <p>Mark: {mark != null ? formatPriceUsd(String(mark)) : "—"}</p>
            <p>
              Size: {fmtSize(paper.positionSizeBase)} {posSymbol}
            </p>
            <p>Notional: {fmtUsd(paper.notionalUsd ?? 0, 2)}</p>
            <p>Margin posted: {fmtUsd(paper.marginUsd ?? 0, 2)}</p>
            <p>Leverage: {leverage}x</p>
          </div>
          <p className="text-xs text-zinc-500">
            Unrealized:{" "}
            <strong className="text-zinc-300">
              {unrealized >= 0 ? "+" : ""}
              {fmtUsd(unrealized)}
            </strong>
            {unrealizedPct != null ? ` (${fmtPct(unrealizedPct)} on margin)` : ""}
          </p>
          {onClose ? (
            <Button
              variant="danger"
              className="mt-2 w-full"
              disabled={closing}
              onClick={onClose}
            >
              {closing
                ? "Closing…"
                : `Close ${paper.positionSide.toUpperCase()} ${posSymbol}`}
            </Button>
          ) : null}
        </div>
      ) : inPosition ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-sm text-rose-200">
          Position open but market symbol is missing (corrupted state).{" "}
          <Link href="/bot" className="underline">
            Bot → Reset paper wallet
          </Link>{" "}
          or{" "}
          <Link href="/positions" className="underline">
            Positions
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-400">
          <p className="font-medium text-zinc-300">Flat — no open positions</p>
          <p className="font-mono text-xs">
            Next bot trade: {marginPct}% margin × {leverage}x ={" "}
            <strong className="text-zinc-200">
              {fmtUsd(paper.nextTradeNotionalUsd, 0)} notional
            </strong>
          </p>
          <p className="text-xs text-zinc-600">
            Manual trades: enter USD size on Trade — that is notional exposure
            (fee ~{takerBps / 100}% per fill).
          </p>
        </div>
      )}
    </Card>
  );
}
