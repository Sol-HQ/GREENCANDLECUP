/** Plain-English trading glossary for the dashboard. */
export const GLOSSARY = {
  candle: {
    title: "What is a candle?",
    body: "Each candle is a snapshot of price over a time window. The body shows where price opened and closed; the wicks show the high and low. A 1-minute candle = one snapshot every 60 seconds. A 15-second candle updates 4× faster — great for quick moves, but noisier.",
  },
  ema: {
    title: "What is an EMA?",
    body: "EMA = Exponential Moving Average. It's a smoothed average price that reacts faster to recent moves than a plain average. Think of it as 'where price has been leaning lately.' EMA9 = very reactive (last ~9 candles). EMA20/50 = slower trend lines.",
  },
  ema9Pullback: {
    title: "Pullback strategy (EMA9)",
    body: "In an uptrend, price usually rides above EMA9. Sometimes it dips below EMA9 briefly — that's a pullback ('buy the dip'). We buy when trend is up but price dipped under EMA9. In a downtrend, price rallies above EMA9 — we sell that bounce.",
  },
  macd: {
    title: "What is MACD?",
    body: "MACD compares fast vs slow momentum. When the blue MACD line crosses above the orange signal line, momentum is turning up. Cross below = turning down. We combine this with trend (EMA20 vs EMA50) so we're not fighting the bigger move.",
  },
  trendMacd: {
    title: "Trend + MACD (recommended start)",
    body: "Only buy when the bigger trend is up (price above EMA20, EMA20 above EMA50). Only sell when trend is down. MACD confirms entries: buy on bullish cross in uptrend, sell on bearish cross in downtrend. Also catches pullbacks in strong trends.",
  },
  paperVsLive: {
    title: "Paper vs Live",
    body: "Paper = simulated trades, zero real money, perfect for learning. Live = real Phoenix orders signed by your server keypair. Always paper first until strategy + risk limits feel right.",
  },
  mainnetVsDevnet: {
    title: "Mainnet vs Devnet",
    body: "Mainnet = real Solana, real USDC, real Phoenix perps (GCC competition). Devnet = fake SOL for wallet/testing only. Phoenix perps and GCC are MAINNET only — Devnet is for practicing wallet connect and RPC, not competition trades.",
  },
  shredStream: {
    title: "What is ShredStream?",
    body: "ShredStream sends raw Solana transaction data over UDP to your VPS milliseconds before normal APIs see it. Edge: you see big fills and order flow earlier — useful for faster entries/exits in volatile moments. It does NOT draw charts. It's a speed layer on top of Phoenix, not a replacement.",
  },
} as const;

export const TIMEFRAME_HELP: Record<string, string> = {
  "15s": "Fastest Phoenix candles — scalp-level, very noisy. Good for quick in/out.",
  "30s": "Very fast — still noisy but slightly smoother than 15s.",
  "1m": "Classic scalping timeframe. Good default for active GCC trading.",
  "5m": "Swing scalps — filters noise, slower signals.",
  "15m": "Medium-term context — use with 1m for 'zoom in / zoom out'.",
  "1h": "Big picture trend — not for fast entries alone.",
  "4h": "Session-level trend filter only.",
};

export const STRATEGY_HELP: Record<
  string,
  { label: string; summary: string; when: string }
> = {
  trend_macd: {
    label: "Trend + MACD",
    summary: "Trade with the trend; MACD times entries. Buy dips in uptrends, sell rallies in downtrends.",
    when: "Best starting strategy when you understand buy low / sell high but want rules.",
  },
  pullback: {
    label: "Pullback (EMA9)",
    summary: "Buy when price dips below EMA9 in an uptrend. Sell when price pops above EMA9 in a downtrend.",
    when: "When you like 'buy the dip' and 'sell the rip' in clear trends.",
  },
  momentum: {
    label: "Momentum",
    summary: "Follow short bursts — buy when recent candles are pushing up, sell when pushing down.",
    when: "Fast markets, shorter timeframes (15s–1m). Higher trade count.",
  },
  mean_reversion: {
    label: "Mean reversion",
    summary: "Fade overstretched moves — buy after a sharp drop, sell after a sharp spike.",
    when: "Ranging/choppy markets, not strong one-way trends.",
  },
  manual: {
    label: "Manual only",
    summary: "Bot watches and alerts but never auto-trades.",
    when: "You want signals without automated orders.",
  },
};
