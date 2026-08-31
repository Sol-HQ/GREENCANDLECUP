"use client";

import { useEffect, useRef, useState } from "react";
import { birdeyeEmbedUrl, type BirdeyeMintResult } from "@gcc/shared";
import { useElementSize } from "@/hooks/use-element-size";
import { api } from "@/lib/utils";

export function BirdeyeChart({
  symbol = "SOL",
  compact = false,
}: {
  symbol?: string;
  compact?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const minH = compact ? 180 : 320;
  const { height } = useElementSize(wrapRef, minH);
  const [resolved, setResolved] = useState<BirdeyeMintResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setResolved(null);

    void api<BirdeyeMintResult>(`/api/birdeye/mint/${encodeURIComponent(symbol)}`)
      .then((result) => {
        if (!active) return;
        setResolved(result);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to resolve Birdeye mint");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [symbol]);

  if (loading) {
    return (
      <div
        ref={wrapRef}
        className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-center text-xs text-zinc-500"
      >
        Loading Birdeye chart for {symbol}…
      </div>
    );
  }

  if (error) {
    return (
      <div
        ref={wrapRef}
        className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-center text-xs text-amber-200"
      >
        {error}
      </div>
    );
  }

  if (!resolved?.mint) {
    const hint =
      resolved?.reason === "equity"
        ? "Birdeye is Solana DEX spot only — this Phoenix market is an equity/tradfi perp. Use the TV tab for CEX charts, or GCC for Phoenix perps."
        : resolved?.reason === "no_solana_mint"
          ? `No Solana spot mint found for ${symbol}. Use GCC for Phoenix perps or TV for CEX.`
          : `Birdeye spot chart unavailable for ${symbol}. Use GCC or TV.`;
    return (
      <div
        ref={wrapRef}
        className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-center text-[11px] leading-snug text-zinc-500"
      >
        {hint}
      </div>
    );
  }

  const src = birdeyeEmbedUrl(resolved.mint);

  return (
    <div ref={wrapRef} className="h-full w-full" style={{ minHeight: minH }}>
      <iframe
        title={`Birdeye ${symbol} chart`}
        src={src}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950"
        style={{ height: height || minH }}
        allowFullScreen
      />
    </div>
  );
}
