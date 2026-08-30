"use client";

/** Birdeye-hosted TradingView widget — no candle building on our side. */
const WRAPPED_SOL = "So11111111111111111111111111111111111111112";

export function BirdeyeChart({ height = 520 }: { height?: number }) {
  const src = `https://embed.birdeye.so/tv-widget/${WRAPPED_SOL}?chain=solana&viewMode=pair&chartInterval=15&chartType=Candle&chartTimezone=America%2FNew_York&chartLeftToolbar=show&theme=dark`;

  return (
    <iframe
      title="Birdeye SOL chart"
      src={src}
      className="w-full rounded-xl border border-zinc-800 bg-zinc-950"
      style={{ height }}
      allowFullScreen
    />
  );
}
