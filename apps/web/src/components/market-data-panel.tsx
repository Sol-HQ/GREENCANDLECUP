"use client";

import { useSymbol } from "@/components/symbol-provider";
import { Card, Stat } from "@/components/ui";
import {
  formatCompactUsd,
  formatNumber,
  formatPriceUsd,
  priceSourceLabel,
} from "@/lib/market-symbols";

export function MarketDataPanel() {
  const { symbol, listing, detail, loadingDetail } = useSymbol();

  const source = detail?.priceSource ?? "phoenix";
  const updated = detail?.updatedAt
    ? new Date(detail.updatedAt).toLocaleTimeString()
    : detail?.statsUpdatedAt
      ? new Date(detail.statsUpdatedAt).toLocaleTimeString()
      : null;

  return (
    <Card title="Market data">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
          {symbol}
        </span>
        {listing ? (
          <>
            <span>{listing.name}</span>
            <span>·</span>
            <span className="capitalize">{listing.marketStatus}</span>
            {listing.maxLeverage ? (
              <>
                <span>·</span>
                <span>{listing.maxLeverage}x max leverage</span>
              </>
            ) : null}
            {listing.isolatedOnly ? (
              <>
                <span>·</span>
                <span className="text-amber-400">isolated only</span>
              </>
            ) : null}
          </>
        ) : null}
        <span>·</span>
        <span className="text-emerald-400/90">{priceSourceLabel(source)}</span>
        {updated ? <span>· {updated}</span> : null}
        {loadingDetail ? <span>· refreshing…</span> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Mark price" value={formatPriceUsd(detail?.markPriceUsd)} />
        <Stat label="Spot (index)" value={formatPriceUsd(detail?.spotPriceUsd)} />
        <Stat
          label="Best bid / ask"
          value={`${formatPriceUsd(detail?.bestBid)} / ${formatPriceUsd(detail?.bestAsk)}`}
        />
        <Stat
          label="Spread"
          value={
            detail?.spreadUsd
              ? `${formatPriceUsd(detail.spreadUsd)} (${detail.spreadBps ?? "—"} bps)`
              : "—"
          }
        />
        <Stat
          label="Open interest"
          value={
            detail?.openInterest != null
              ? `${formatNumber(detail.openInterest)} ${symbol}`
              : "—"
          }
        />
        <Stat
          label="Open interest (USD)"
          value={formatCompactUsd(detail?.openInterestUsd)}
        />
        <Stat
          label="Taker / maker fee"
          value={
            listing
              ? `${(listing.takerFeeBps / 100).toFixed(2)} / ${(listing.makerFeeBps / 100).toFixed(2)} bps`
              : "—"
          }
        />
        <Stat
          label="Funding interval"
          value={
            listing?.fundingIntervalSeconds
              ? `${Math.round(listing.fundingIntervalSeconds / 60)} min`
              : "—"
          }
        />
        <Stat
          label="Max funding / interval"
          value={
            detail?.fundingRatePct
              ? `${Number(detail.fundingRatePct).toFixed(3)}%`
              : "—"
          }
        />
        <Stat
          label="Total maker fees (all-time)"
          value={formatCompactUsd(detail?.totalMakerFees ?? null)}
        />
        <Stat
          label="Total taker fees (all-time)"
          value={formatCompactUsd(detail?.totalTakerFees ?? null)}
        />
        <Stat
          label="Stats updated"
          value={
            detail?.statsUpdatedAt
              ? new Date(detail.statsUpdatedAt).toLocaleTimeString()
              : "—"
          }
        />
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
        Prices from Phoenix HTTP (3s poll) — not Helius. CoinGecko backup when
        Phoenix mark is missing. Charts: GCC candles + TradingView embed.
        Helius reserved for tx send only.
      </p>
    </Card>
  );
}
