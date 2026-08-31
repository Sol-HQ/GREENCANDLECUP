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
  whatIsGcc: {
    title: "What is Green Candle Cup?",
    body: "A one-week Phoenix perpetuals trading competition on Solana mainnet. You trade leveraged long/short positions on Phoenix — not spot tokens, not Jupiter swaps. Rankings use real on-chain volume and PnL from your competition wallet during the event window.",
  },
  perpsVsSpot: {
    title: "Perps vs spot — what am I trading?",
    body: "Everything in this dashboard is built for Phoenix perpetual futures (perps): you go long or short with leverage on a mark price. You are NOT buying/selling spot SOL or tokens on Jupiter. Birdeye and TradingView tabs are reference charts only. Your actual GCC trades are Phoenix perps on mainnet.",
  },
  howToTradeToday: {
    title: "How do I trade right now?",
    body: "1) Pick a market (Symbol picker). 2) Set Paper in the header (safe default). 3) On Trade, use the order panel: Buy/Long or Sell/Short, market or limit, size, leverage. 4) Click Simulate Order — runs real Phoenix prices + risk checks, no on-chain tx. Live mode builds orders but wallet signing is not wired yet — do not expect real fills from the browser today.",
  },
  competitionWallet: {
    title: "Competition wallet",
    body: "Your registered GCC wallet is the Solana address that Phoenix attributes volume and PnL to during the competition. Connect the same wallet in the header when live trading is enabled. Depositing collateral happens on Phoenix — not inside this dashboard yet.",
  },
} as const;

export type PageGuideKey =
  | "overview"
  | "trade"
  | "positions"
  | "orders"
  | "bot"
  | "system";

export const PAGE_GUIDES: Record<
  PageGuideKey,
  {
    title: string;
    tagline: string;
    works: string[];
    limitations: string[];
    actions: { label: string; href: string }[];
  }
> = {
  overview: {
    title: "Overview",
    tagline:
      "Your at-a-glance command center for one engaged Phoenix perp market. Real prices, real orderbook — paper trades only until live signing ships.",
    works: [
      "Live Phoenix mark price, orderbook, funding, and open interest",
      "Symbol picker syncs SOL, BTC, JUP, etc. across tabs",
      "Paper order simulation with real risk checks",
      "GCC volume & PnL counters (paper + bot activity)",
      "Price alerts from the bot and large mark moves",
    ],
    limitations: [
      "Not a spot wallet or Jupiter swap UI",
      "Positions tab empty until on-chain state sync is built",
      "Live orders from the browser do not submit transactions yet",
    ],
    actions: [
      { label: "Open full Trade workspace", href: "/trade" },
      { label: "Configure the bot", href: "/bot" },
    ],
  },
  trade: {
    title: "Trade workspace",
    tagline:
      "Where you analyze and place Phoenix perp orders. Charts are for context; the order panel is where long/short decisions become simulated (or eventually live) trades.",
    works: [
      "GCC chart: Phoenix candles, volume pane, MACD, live mark ticks",
      "TV / Birdeye tabs: CEX or Solana spot reference only",
      "Resizable layout: chart, orderbook, order form, alerts",
      "Market & limit orders with leverage, slippage, reduce-only",
      "Paper mode: Simulate Order runs full logic, zero chain tx",
    ],
    limitations: [
      "All orders are perpetual futures on Phoenix — not spot",
      "Header Paper/Live toggle controls execution; Live does not sign yet",
      "Drawing tools on the chart are personal notes only (not orders)",
    ],
    actions: [
      { label: "Read how Paper vs Live works", href: "/bot" },
      { label: "Check system health", href: "/system" },
    ],
  },
  positions: {
    title: "Positions",
    tagline:
      "Your open Phoenix perp positions will live here. This tab is not wired yet — use Trade to simulate and the Bot page for automated paper activity.",
    works: [
      "Nothing live yet — placeholder while trader-state API is integrated",
    ],
    limitations: [
      "Cannot see entry, size, uPnL, or close from this screen today",
      "Closing a position: use Trade panel (paper simulate) for now",
    ],
    actions: [
      { label: "Trade workspace", href: "/trade" },
      { label: "Overview", href: "/" },
    ],
  },
  orders: {
    title: "Open orders",
    tagline:
      "Resting limit orders on Phoenix will appear here. Not connected yet — cancel/manage from Phoenix directly if you have live orders on-chain.",
    works: ["Placeholder — open order sync coming in a future build"],
    limitations: [
      "No cancel-all or order list in this dashboard today",
      "Paper simulates fills immediately; no resting paper orders",
    ],
    actions: [{ label: "Place a simulated order", href: "/trade" }],
  },
  bot: {
    title: "Bot",
    tagline:
      "Automated Phoenix perp trading from TA signals (MACD, trend, pullbacks). Uses the same Paper/Live header toggle. Trades the engaged symbol you pick in the market selector.",
    works: [
      "Start / pause / stop automated strategy",
      "Strategies: Trend+MACD, Pullback, Momentum, Mean reversion, Manual",
      "Risk limits: max position, order size, daily loss, leverage cap",
      "Live TA readout from Phoenix candles",
      "GCC metrics: volume, realized/unrealized PnL",
    ],
    limitations: [
      "Paper: simulated fills only. Live: server keypair required (Phase 2)",
      "Fixed auto size (0.01 base) — manual trade panel has full sizing",
      "Bot follows engaged symbol when you change the market picker",
    ],
    actions: [
      { label: "Manual trade", href: "/trade" },
      { label: "Glossary below", href: "#learn" },
    ],
  },
  system: {
    title: "System",
    tagline:
      "Health checks for Phoenix data feeds, RPC routing, and bot logs. Use this when charts stall or the Live badge goes offline.",
    works: [
      "Phoenix HTTP + poll latency",
      "Wallet RPC vs Phoenix read RPC vs Helius tx path",
      "Paper/Live mode display",
      "Recent bot/server log lines",
    ],
    limitations: [
      "ShredStream shows Inactive until VPS Phase 2",
      "Devnet toggle only changes wallet RPC — Phoenix perps stay mainnet",
    ],
    actions: [{ label: "Back to Trade", href: "/trade" }],
  },
};

export const TIMEFRAME_HELP: Record<string, string> = {
  "1m": "Fastest Phoenix bar — classic scalping default for active GCC trading.",
  "5m": "Swing scalps — filters noise, slower signals.",
  "15m": "Medium-term context — use with 1m for zoom in / zoom out.",
  "30m": "Intraday structure — good for session swings.",
  "1h": "Big-picture trend — not for fast entries alone.",
  "4h": "Session-level trend filter.",
  "1d": "Daily bias only — macro context for the competition week.",
};

export const STRATEGY_HELP: Record<
  string,
  { label: string; summary: string; when: string }
> = {
  wave_scalp: {
    label: "Wave scalp ($100 paper)",
    summary:
      "Quick in/out on swing lows and highs. One position at a time — buy bounce, take profit ~7%, cover shorts the same way. No stacking.",
    when: "Choppy or moving coins (JUP, SOL). Matches ride-the-wave scalping.",
  },
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
    when: "Fast markets, 1m–5m bars. Higher trade count.",
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
