"use client";

import { Card, Stat, Button } from "@/components/ui";
import type { BotConfig, PaperPortfolioState } from "@gcc/shared";
import { PAPER_MARGIN_FRACTION } from "@gcc/shared";

function fmtUsd(n: number, digits = 2) {
  return `$${n.toFixed(digits)}`;
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function PaperPositionPanel({
  paper,
  symbol,
  cfg,
  isRunning,
  onClose,
  closing,
}: {
  paper: PaperPortfolioState | null;
  symbol: string;
  cfg?: BotConfig | null;
  isRunning?: boolean;
  onClose?: () => void;
  closing?: boolean;
}) {
  const leverage = paper?.leverage ?? cfg?.paperLeverage ?? 2;
  const marginPct = Math.round(PAPER_MARGIN_FRACTION * 100);
  const takerBps = cfg?.paperTakerFeeBps ?? 5;

  if (!paper) {
    return (
      <Card title="Paper perp position (live)">
        <p className="text-sm text-zinc-500">Waiting for portfolio data…</p>
      </Card>
    );
  }

  const inPosition = paper.positionSide !== "flat";
  const mark = paper.markPriceUsd;
  const unrealized = paper.unrealizedPnlUsd;
  const unrealizedPct = paper.unrealizedPnlPctOnMargin;

  return (
    <Card title="Paper perp position (live)">
      <p className="mb-3 text-xs text-zinc-500">
        Phoenix <strong className="text-zinc-300">perps</strong> — you trade
        exposure to {symbol} price, not tokens in a wallet. Prices like{" "}
        <strong className="text-zinc-300">$0.2024</strong> are per{" "}
        <em>one token</em>. The bot sizes ~{fmtUsd(paper.nextTradeNotionalUsd, 0)}{" "}
        notional ({leverage}x on {marginPct}% margin).
      </p>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Stat
          label="Cash balance"
          value={fmtUsd(paper.balanceUsdc)}
          tone={undefined}
        />
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
          label="Mark price"
          value={mark != null ? `$${mark.toFixed(4)}` : isRunning ? "…" : "—"}
        />
      </div>

      {inPosition ? (
        <div className="space-y-2 rounded-lg border border-sky-500/30 bg-sky-950/20 p-3 text-sm text-zinc-300">
          <p className="font-medium text-sky-200">
            Open {paper.positionSide.toUpperCase()} on {symbol}
          </p>
          <div className="grid gap-1 font-mono text-xs text-zinc-400 md:grid-cols-2">
            <p>Entry: ${paper.entryPriceUsd?.toFixed(4) ?? "—"}</p>
            <p>Mark: {mark != null ? `$${mark.toFixed(4)}` : "—"}</p>
            <p>Size: {paper.positionSizeBase.toFixed(4)} {symbol}</p>
            <p>Notional: ~{fmtUsd(paper.notionalUsd ?? 0, 2)}</p>
            <p>Margin posted: ~{fmtUsd(paper.marginUsd ?? 0, 2)}</p>
            <p>Leverage: {leverage}x</p>
          </div>
          <p className="text-xs text-zinc-500">
            P&L:{" "}
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
              {closing ? "Closing…" : `Close ${paper.positionSide.toUpperCase()} position`}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-400">
          <p className="font-medium text-zinc-300">Flat — next trade sizing</p>
          <p className="font-mono text-xs">
            Margin {marginPct}% of ${paper.balanceUsdc.toFixed(0)} ={" "}
            {fmtUsd(paper.nextTradeMarginUsd, 0)} → × {leverage}x ={" "}
            <strong className="text-zinc-200">
              {fmtUsd(paper.nextTradeNotionalUsd, 0)} notional
            </strong>
            {paper.nextTradeSizeBase != null && mark != null ? (
              <>
                {" "}
                → ~{paper.nextTradeSizeBase.toFixed(0)} {symbol} @ $
                {mark.toFixed(4)}
              </>
            ) : null}
          </p>
          <p className="text-xs text-zinc-600">
            Example: $100 bankroll, 50% margin, 2x → ~$100 notional ≈ 494 JUP @
            $0.2024. Open + close each pay ~{takerBps / 100}% taker fee on
            notional.
          </p>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-600">
        Why $101.40 after a win? You started $100, opened long ~$100 notional,
        JUP moved up slightly, closed for ~+$1.40 after fees — cash balance, not
        token holdings.
      </p>
    </Card>
  );
}
