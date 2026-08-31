"use client";

import { useMemo, useState } from "react";
import { Card, Button } from "@/components/ui";
import {
  buildClosedRoundTrips,
  filterTradesBySource,
  type ClosedRoundTrip,
  type PaperPortfolioState,
  type PaperTradeRecord,
  type PaperTradeSource,
} from "@gcc/shared";
import { formatPriceUsd } from "@/lib/market-symbols";
import { PaperWalletBar, SourceBadge } from "@/components/paper-wallet-bar";
import { PaperTransferPanel } from "@/components/paper-transfer-panel";

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtSize(base: number) {
  return base >= 1 ? base.toFixed(2) : base.toFixed(4);
}

function fmtPct(entry: number, exit: number, side: "long" | "short") {
  const raw =
    side === "long" ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100;
  return `${raw >= 0 ? "+" : ""}${raw.toFixed(2)}%`;
}

type Filter = "all" | PaperTradeSource;

export function PaperLedgerPanel({
  paper,
  trades,
  onClose,
  closing,
  onRefresh,
}: {
  paper: PaperPortfolioState | null;
  trades: PaperTradeRecord[];
  onClose?: (symbol: string) => void;
  closing?: boolean;
  onRefresh?: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const closed = useMemo(
    () => buildClosedRoundTrips(trades, paper?.leverage ?? 2),
    [trades, paper?.leverage],
  );
  const filteredClosed = useMemo(
    () => (filter === "all" ? closed : closed.filter((c) => c.source === filter)),
    [closed, filter],
  );
  const manualFills = useMemo(
    () => filterTradesBySource(trades, "manual"),
    [trades],
  );
  const botFills = useMemo(
    () => filterTradesBySource(trades, "bot"),
    [trades],
  );

  const inPosition = paper?.positionSide !== "flat";
  const posSymbol = paper?.positionSymbol;
  const posSource = paper?.positionSource;

  return (
    <div className="space-y-4">
      <PaperWalletBar paper={paper} />
      <PaperTransferPanel paper={paper} onTransferred={onRefresh} />

      <div className="flex flex-wrap gap-2">
        {(["all", "manual", "bot"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/40"
                : "rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700"
            }
          >
            {f === "all" ? "All" : f === "manual" ? "Manual only" : "Bot only"}
          </button>
        ))}
      </div>

      <Card title="Open positions">
        {!inPosition || !posSymbol ? (
          <p className="text-sm text-zinc-500">No open positions — wallet is flat.</p>
        ) : filter !== "all" && posSource !== filter ? (
          <p className="text-sm text-zinc-500">
            No open {filter} positions. Switch filter to All.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Market</th>
                  <th className="py-2 pr-3">Side</th>
                  <th className="py-2 pr-3">Size</th>
                  <th className="py-2 pr-3">Entry</th>
                  <th className="py-2 pr-3">Mark</th>
                  <th className="py-2 pr-3">Notional</th>
                  <th className="py-2 pr-3">Margin</th>
                  <th className="py-2 pr-3">Unrealized</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-800/80 text-zinc-200">
                  <td className="py-3 pr-3">
                    {posSource ? <SourceBadge source={posSource} /> : "—"}
                  </td>
                  <td className="py-3 pr-3 font-medium">{posSymbol}</td>
                  <td className="py-3 pr-3 capitalize text-sky-300">
                    {paper?.positionSide}
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs">
                    {fmtSize(paper?.positionSizeBase ?? 0)} {posSymbol}
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs">
                    {formatPriceUsd(String(paper?.entryPriceUsd ?? 0))}
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs">
                    {paper?.markPriceUsd != null
                      ? formatPriceUsd(String(paper.markPriceUsd))
                      : "—"}
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs">
                    {fmtUsd(paper?.notionalUsd ?? 0)}
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs">
                    {fmtUsd(paper?.marginUsd ?? 0)} @ {paper?.leverage ?? 1}x
                  </td>
                  <td
                    className={`py-3 pr-3 font-mono text-xs ${
                      (paper?.unrealizedPnlUsd ?? 0) >= 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {(paper?.unrealizedPnlUsd ?? 0) >= 0 ? "+" : ""}
                    {fmtUsd(paper?.unrealizedPnlUsd ?? 0)}
                  </td>
                  <td className="py-3">
                    {onClose ? (
                      <Button
                        variant="danger"
                        className="!py-1 !text-xs"
                        disabled={closing}
                        onClick={() => onClose(posSymbol)}
                      >
                        {closing ? "…" : "Close"}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Closed positions">
        {filteredClosed.length === 0 ? (
          <p className="text-sm text-zinc-500">No closed round trips yet.</p>
        ) : (
          <div className="space-y-3">
            {filteredClosed.map((trip) => (
              <ClosedTripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Manual fills (${manualFills.length})`}>
          <FillList trades={manualFills.slice().reverse().slice(0, 15)} />
        </Card>
        <Card title={`Bot fills (${botFills.length})`}>
          <FillList trades={botFills.slice().reverse().slice(0, 15)} />
        </Card>
      </div>
    </div>
  );
}

function ClosedTripCard({ trip }: { trip: ClosedRoundTrip }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <SourceBadge source={trip.source} />
        <span className="font-medium text-zinc-100">
          {trip.side.toUpperCase()} {trip.symbol}
        </span>
        <span
          className={
            trip.realizedPnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"
          }
        >
          {trip.realizedPnlUsd >= 0 ? "+" : ""}
          {fmtUsd(trip.realizedPnlUsd)} realized
        </span>
        <span className="text-xs text-zinc-500">
          ({fmtPct(trip.entryPriceUsd, trip.exitPriceUsd, trip.side)} on price)
        </span>
      </div>
      <div className="grid gap-1 font-mono text-xs text-zinc-400 md:grid-cols-2">
        <p>Opened: {formatPriceUsd(String(trip.entryPriceUsd))}</p>
        <p>Closed: {formatPriceUsd(String(trip.exitPriceUsd))}</p>
        <p>
          Size: {fmtSize(trip.sizeBase)} {trip.symbol}
        </p>
        <p>Notional: {fmtUsd(trip.notionalUsd)}</p>
        <p>
          Margin: {fmtUsd(trip.marginUsd)} @ {trip.leverage}x
        </p>
        <p>Cash after close: {fmtUsd(trip.cashAfterUsd)}</p>
        <p className="md:col-span-2 text-zinc-500">
          {new Date(trip.entryAt).toLocaleString()} →{" "}
          {new Date(trip.exitAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function FillList({ trades }: { trades: PaperTradeRecord[] }) {
  if (trades.length === 0) {
    return <p className="text-sm text-zinc-500">None yet.</p>;
  }
  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto text-xs font-mono text-zinc-300">
      {trades.map((t) => (
        <li
          key={t.id}
          className="rounded border border-zinc-800/80 bg-zinc-900/40 px-2 py-1.5"
        >
          <span className="text-zinc-500">{new Date(t.at).toLocaleTimeString()}</span>{" "}
          {t.action.replace(/_/g, " ")} · {fmtSize(t.sizeBase)} {t.symbol} @{" "}
          {formatPriceUsd(String(t.priceUsd))}
          {t.pnlUsd != null ? (
            <span className={t.pnlUsd >= 0 ? " text-emerald-400" : " text-rose-400"}>
              {" "}
              · {t.pnlUsd >= 0 ? "+" : ""}
              {fmtUsd(t.pnlUsd)}
            </span>
          ) : null}
          <span className=" text-zinc-600"> · cash {fmtUsd(t.balanceUsdc)}</span>
        </li>
      ))}
    </ul>
  );
}
