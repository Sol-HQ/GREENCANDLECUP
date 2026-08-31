"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Button, Card, Input, Stat } from "@/components/ui";
import { api } from "@/lib/utils";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import type {
  BotConfig,
  BotIntelProfile,
  BotStrategy,
  CandleTimeframe,
  GccMetrics,
  MarketBriefing,
  PaperPortfolioState,
  PaperTradeRecord,
  RiskLimits,
  TradeAlert,
} from "@gcc/shared";
import {
  PHOENIX_CANDLE_TIMEFRAMES,
  STRATEGY_HELP,
  INTEL_PROFILE_HELP,
  TIMEFRAME_HELP,
  formatPaperTradeReceipt,
  filterTradesBySource,
} from "@gcc/shared";
import { PaperWalletBar } from "@/components/paper-wallet-bar";
import { LearnPanel } from "@/components/learn-panel";
import { BotActivityPanel } from "@/components/bot-activity-panel";
import { PaperPositionPanel } from "@/components/paper-position-panel";
import { PaperTradeReplayChart } from "@/components/paper-trade-replay-chart";
import { PageGuide } from "@/components/page-guide";
import { useSymbol } from "@/components/symbol-provider";
import { useScannerChart } from "@/components/scanner-chart-provider";
import { useNetwork } from "@/components/network-provider";

type WaveAnalysis = {
  action: string;
  reason: string;
  regime?: string;
  activeMode?: string;
  regimeReason?: string;
  macroRegime?: string;
  alignment?: string;
  confidence?: number;
  entryThreshold?: number;
  narrative?: string;
  factors?: Array<{ name: string; score: number; max: number; detail: string }>;
  netMovePct?: number;
  trendEfficiency?: number;
  rangeLow?: number;
  rangeHigh?: number;
  priceInRangePct?: number;
  unrealizedPnlPct?: number | null;
  markPrice?: number;
};

const INTEL_PROFILES = (
  Object.entries(INTEL_PROFILE_HELP) as [
    BotIntelProfile,
    (typeof INTEL_PROFILE_HELP)[string],
  ][]
).map(([id, help]) => ({ id, ...help }));

type BotResponse = {
  config: BotConfig;
  status: string;
  armed?: boolean;
  analysis?: WaveAnalysis | null;
  briefing?: MarketBriefing | null;
  paper?: PaperPortfolioState | null;
};

type MoverRow = { symbol: string; rangePct: number; volume: number };

const STRATEGIES = (
  Object.entries(STRATEGY_HELP) as [
    BotStrategy,
    (typeof STRATEGY_HELP)[string],
  ][]
).map(([id, help]) => ({
  id,
  label: help.label,
  hint: help.summary,
  when: help.when,
}));

const TIMEFRAMES = PHOENIX_CANDLE_TIMEFRAMES;

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

function actionLabel(action: string) {
  return action.replace(/_/g, " ").toUpperCase();
}

export default function BotPage() {
  const { metrics, connected, logs, alerts, paperTrades, paperPortfolio } =
    useGccSocket();
  const { symbol: engagedSymbol, setSymbol } = useSymbol();
  const scanner = useScannerChart();
  const { network } = useNetwork();
  const [bot, setBot] = useState<BotResponse | null>(null);
  const [risk, setRisk] = useState<RiskLimits | null>(null);
  const [gccMetrics, setGccMetrics] = useState<GccMetrics | null>(null);
  const [trades, setTrades] = useState<PaperTradeRecord[]>([]);
  const [movers, setMovers] = useState<MoverRow[]>([]);
  const [serverLogs, setServerLogs] = useState<
    Array<{ level: string; message: string; at: string }>
  >([]);
  const [restAlerts, setRestAlerts] = useState<TradeAlert[]>([]);
  const [closing, setClosing] = useState(false);

  const refresh = async () => {
    const [botRes, riskRes, metricsRes, logsRes, tradesRes, moversRes, alertsRes] =
      await Promise.all([
        api<BotResponse>("/api/bot"),
        api<RiskLimits>("/api/risk"),
        api<GccMetrics>("/api/metrics"),
        api<{ logs: Array<{ level: string; message: string; at: string }> }>(
          "/api/logs",
        ).catch(() => ({ logs: [] })),
        api<{ trades: PaperTradeRecord[] }>("/api/paper/trades").catch(() => ({
          trades: [],
        })),
        api<MoverRow[]>("/api/markets/movers").catch(() => []),
        api<TradeAlert[]>("/api/alerts").catch(() => []),
      ]);
    setBot(botRes);
    setRisk(riskRes);
    setGccMetrics(metricsRes);
    setTrades(tradesRes.trades);
    setMovers(moversRes);
    setRestAlerts(alertsRes);
    if (logsRes.logs.length > 0) setServerLogs(logsRes.logs);
  };

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, []);

  const action = async (path: string) => {
    await api(path, { method: "POST" });
    await refresh();
  };

  const saveConfig = async (patch: Partial<BotConfig>) => {
    await api("/api/bot", { method: "PATCH", body: JSON.stringify(patch) });
    await refresh();
  };

  const setAutoResume = async (enabled: boolean) => {
    await api("/api/bot/auto-resume", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    });
    await refresh();
  };

  const pickSymbol = async (sym: string) => {
    await setSymbol(sym);
    await saveConfig({ symbol: sym });
  };

  const saveRisk = async () => {
    if (!risk) return;
    await api("/api/risk", { method: "PATCH", body: JSON.stringify(risk) });
    await refresh();
  };

  const cfg = bot?.config;
  const botStatus = bot?.status ?? "stopped";
  const isArmed = bot?.armed === true;
  const isRunning = botStatus === "running";
  const isPaused = botStatus === "paused";
  const isDead = botStatus === "dead";
  const tradingMode = network?.tradingMode ?? cfg?.mode ?? "paper";
  const isPaper = tradingMode === "paper";
  const analysis = bot?.analysis;
  const paper = paperPortfolio ?? bot?.paper ?? null;
  const briefing = bot?.briefing;

  const closePosition = async () => {
    const sym = paper?.positionSymbol;
    if (!sym) return;
    setClosing(true);
    try {
      await api("/api/paper/close", {
        method: "POST",
        body: JSON.stringify({ symbol: sym }),
      });
      await refresh();
    } finally {
      setClosing(false);
    }
  };

  const displayTrades =
    paperTrades.length > 0
      ? filterTradesBySource(
          mergeTradeHistory(trades, paperTrades),
          "bot",
        )
      : filterTradesBySource(trades, "bot");

  function mergeTradeHistory(
    apiTrades: PaperTradeRecord[],
    liveTrades: PaperTradeRecord[],
  ) {
    const byId = new Map<string, PaperTradeRecord>();
    for (const t of apiTrades) byId.set(t.id, t);
    for (const t of liveTrades) byId.set(t.id, t);
    return [...byId.values()].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }

  const displayAlerts =
    alerts.length > 0
      ? [...alerts, ...restAlerts.filter((a) => !alerts.some((x) => x.id === a.id))]
      : restAlerts;

  const activityLogs =
    logs.length > 0
      ? [
          ...logs,
          ...serverLogs.filter(
            (s) => !logs.some((l) => l.at === s.at && l.message === s.message),
          ),
        ]
      : serverLogs;

  const totalPnl =
    (paper?.equityUsdc ??
      (paper?.balanceUsdc ?? cfg?.paperBalanceUsdc ?? 100) +
        (paper?.unrealizedPnlUsd ?? 0)) -
    (paper?.startingBalanceUsdc ?? 100);

  return (
    <Shell connected={connected}>
      <div className="space-y-4">
        <PageGuide page="bot" />

        <div
          className={`rounded-xl border px-4 py-3 ${
            isDead
              ? "border-rose-600/60 bg-rose-950/50"
              : isRunning
              ? isPaper
                ? "border-sky-500/40 bg-sky-950/30"
                : "border-rose-500/50 bg-rose-950/40"
              : "border-zinc-700 bg-zinc-900/60"
          }`}
        >
          <p className="text-sm font-semibold text-zinc-100">
            {isDead
              ? "DEAD — paper account wiped, game over"
              : isRunning
              ? isPaper
                ? "Bot running — paper simulation only (no real money)"
                : "Bot running — LIVE mode (real Phoenix orders when signals fire)"
              : isPaused
                ? "Bot paused — no new trades"
                : "Bot stopped — not trading"}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {isDead ? (
              <>
                Equity fell below $
                {cfg?.paperMinBalanceUsdc ?? 5}. Press{" "}
                <strong className="text-zinc-300">Reset $100 paper</strong> then
                arm again. No real money was used.
              </>
            ) : isRunning ? (
              <>
                Warmup runs after you press Start, then scans every ~
                {(cfg?.pollIntervalMs ?? 5000) / 1000}s. Header{" "}
                <strong className="text-zinc-300">Live</strong> only means market
                data is connected — not that the bot is trading.
              </>
            ) : (
              <>
                Charts and prices update for scouting. Nothing buys or sells until
                you press <strong className="text-zinc-300">Start</strong>. Paper
                wallet below is idle (
                {isPaper ? "simulated $100" : "live mode armed — be careful"}).
              </>
            )}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Stat
            label="Bot status"
            value={botStatus}
            tone={isRunning ? "good" : undefined}
          />
          <Stat
            label={isRunning ? "Paper equity" : "Paper equity (idle)"}
            value={
              paper
                ? fmtUsd(paper.equityUsdc ?? paper.balanceUsdc)
                : "—"
            }
            tone={
              paper && !paper.alive
                ? "bad"
                : totalPnl > 0
                  ? "good"
                  : totalPnl < 0
                    ? "bad"
                    : undefined
            }
          />
          <Stat
            label="Position"
            value={
              paper?.positionSide === "flat"
                ? "Flat"
                : `${paper?.positionSide} · ${paper?.positionSizeBase.toFixed(4)}`
            }
          />
          <Stat
            label="P&L (paper)"
            value={paper ? `${totalPnl >= 0 ? "+" : ""}${fmtUsd(totalPnl)}` : "—"}
          />
        </div>

        <Card title="Pick a moving market (scout)">
          <p className="mb-2 text-xs text-zinc-500">
            Ranked by recent 5m range % — for picking a symbol only. Clicking a
            coin updates bot settings; it does <strong>not</strong> start trading.
          </p>
          <div className="flex flex-wrap gap-2">
            {movers.map((m) => (
              <button
                key={m.symbol}
                type="button"
                onClick={() => void pickSymbol(m.symbol)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                  (cfg?.symbol ?? engagedSymbol) === m.symbol
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-zinc-600"
                }`}
              >
                <span className="font-semibold">{m.symbol}</span>
                <span className="ml-2 text-zinc-500">
                  {m.rangePct.toFixed(2)}% range
                </span>
              </button>
            ))}
          </div>
        </Card>

        {briefing ? (
          <Card title={`Market briefing · ${briefing.symbol}`}>
            <p className="text-sm text-zinc-300">{briefing.summary}</p>
            <div className="mt-2 grid gap-1 text-xs text-zinc-500 md:grid-cols-3">
              {briefing.marketCapUsd != null ? (
                <p>Mcap ${(briefing.marketCapUsd / 1_000_000).toFixed(1)}M</p>
              ) : null}
              {briefing.volume24hUsd != null ? (
                <p>24h vol ${(briefing.volume24hUsd / 1_000_000).toFixed(1)}M</p>
              ) : null}
              {briefing.change24hPct != null ? (
                <p>24h {briefing.change24hPct.toFixed(1)}%</p>
              ) : null}
              {briefing.genesisDate ? <p>Since {briefing.genesisDate}</p> : null}
            </div>
          </Card>
        ) : null}

        <Card title="Bot controls">
          <div
            className={`mb-4 rounded-lg border p-4 ${
              isArmed
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-zinc-800 bg-zinc-900/40"
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                checked={isArmed}
                onChange={(e) => void setAutoResume(e.target.checked)}
              />
              <span className="text-sm">
                <strong className="text-zinc-100">
                  Overnight auto-resume
                </strong>
                <span className="mt-1 block text-xs text-zinc-500">
                  When checked, server restarts (tsx watch, crash, reboot) restore
                  your exact session — open position, trade history, and bot
                  settings — and keep scanning. Uncheck if you want a clean stop
                  after you hit Stop.
                </span>
                {isArmed ? (
                  <span className="mt-2 inline-block rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                    ARMED — will resume intelligently if tripped
                  </span>
                ) : (
                  <span className="mt-2 inline-block rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                    Not armed — restart leaves bot idle
                  </span>
                )}
              </span>
            </label>
          </div>
          <p className="mb-3 text-xs text-zinc-500">
            <strong className="text-zinc-300">Perps, not spot.</strong> A long
            bets JUP price goes up — you don&apos;t own tokens forever. Entry
            price (e.g. $0.20) is per token; the bot sizes ~$
            {cfg?.paperBalanceUsdc ?? 100} notional (hundreds of tokens). Open +
            close pay taker fees (~{(cfg?.paperTakerFeeBps ?? 5) / 100}% each
            side) — strategy skips trades when the swing is too small to cover
            that.
          </p>
          <p className="mb-3 text-xs text-zinc-500">
            <strong className="text-zinc-300">Overnight run</strong> = fresh $100
            on JUP, adaptive brain, survival rules (bust below $
            {cfg?.paperMinBalanceUsdc ?? 5}). Enable auto-resume above, then arm.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              onClick={() => void action("/api/bot/arm-overnight")}
              disabled={isRunning}
            >
              Arm overnight ($100 JUP)
            </Button>
          </div>
          <p className="mb-3 text-xs text-zinc-500">
            <strong className="text-zinc-300">Start trading</strong> begins warmup
            + scans with current settings.
            <strong className="text-zinc-300"> Stop</strong> halts all bot activity.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void action("/api/bot/start")}
              disabled={isRunning || isDead}
            >
              Start trading
            </Button>
            <Button variant="secondary" onClick={() => void action("/api/bot/pause")}>
              Pause
            </Button>
            <Button variant="danger" onClick={() => void action("/api/bot/stop")}>
              Stop
            </Button>
            <Button
              variant="secondary"
              onClick={() => void action("/api/paper/reset")}
            >
              Reset $100 paper
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                scanner.setSymbol(cfg?.symbol ?? engagedSymbol);
                scanner.setOpen(true);
              }}
            >
              Float chart
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                scanner.setSymbol(cfg?.symbol ?? engagedSymbol);
                scanner.popOut();
              }}
              title="Opens a full browser window — use Chrome/Edge for second monitor"
            >
              Pop out chart
            </Button>
          </div>
        </Card>

        <Card title="Strategy · $100 USDC paper wallet">
          <p className="mb-3 text-xs text-zinc-500">
            Bot market:{" "}
            <strong className="text-zinc-200">{cfg?.symbol ?? engagedSymbol}</strong>
            . One position at a time — open → close → next. No stacking. ~50%
            margin × {cfg?.paperLeverage ?? 2}x per trade.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Strategy
              <select
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                value={cfg?.strategy ?? "adaptive"}
                onChange={(e) =>
                  void saveConfig({ strategy: e.target.value as BotStrategy })
                }
              >
                {STRATEGIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            {cfg?.strategy === "adaptive" ? (
              <label className="text-sm md:col-span-2">
                Conviction (adaptive only)
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                  value={cfg?.intelProfile ?? "balanced"}
                  onChange={(e) =>
                    void saveConfig({
                      intelProfile: e.target.value as BotIntelProfile,
                    })
                  }
                >
                  {INTEL_PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-zinc-500">
                  {
                    INTEL_PROFILES.find(
                      (p) => p.id === (cfg?.intelProfile ?? "balanced"),
                    )?.summary
                  }
                </span>
              </label>
            ) : null}
            <label className="text-sm">
              Paper bankroll (USDC)
              <Input
                type="number"
                min={10}
                step={10}
                value={cfg?.paperBalanceUsdc ?? 100}
                onChange={(e) =>
                  void saveConfig({ paperBalanceUsdc: Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm">
              Take profit %
              <Input
                type="number"
                min={1}
                max={50}
                value={cfg?.takeProfitPct ?? 7}
                onChange={(e) =>
                  void saveConfig({ takeProfitPct: Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm">
              Stop loss %
              <Input
                type="number"
                min={1}
                max={50}
                value={cfg?.stopLossPct ?? 4}
                onChange={(e) =>
                  void saveConfig({ stopLossPct: Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm">
              Candle timeframe
              <select
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                value={cfg?.candleTimeframe ?? "1m"}
                onChange={(e) =>
                  void saveConfig({
                    candleTimeframe: e.target.value as CandleTimeframe,
                  })
                }
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-zinc-500">
                {TIMEFRAME_HELP[cfg?.candleTimeframe ?? "1m"]}
              </span>
            </label>
            <label className="text-sm">
              Poll interval (ms)
              <Input
                type="number"
                min={2000}
                step={1000}
                value={cfg?.pollIntervalMs ?? 5000}
                onChange={(e) =>
                  void saveConfig({ pollIntervalMs: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            {STRATEGIES.find((s) => s.id === cfg?.strategy)?.hint}
          </p>
          {analysis ? (
            <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-300">
              {analysis.regime ? (
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">
                  Market brain · {analysis.regime.replace(/_/g, " ")}
                  {analysis.macroRegime
                    ? ` (5m: ${analysis.macroRegime.replace(/_/g, " ")})`
                    : ""}
                  {analysis.activeMode
                    ? ` → ${analysis.activeMode.replace(/_/g, " ")}`
                    : ""}
                  {analysis.alignment
                    ? ` · ${analysis.alignment}`
                    : ""}
                </p>
              ) : null}
              {analysis.confidence != null ? (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-zinc-500">
                    <span>Conviction</span>
                    <span>
                      {analysis.confidence}%
                      {analysis.entryThreshold != null
                        ? ` / ${analysis.entryThreshold}% to trade`
                        : ""}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        analysis.confidence >= (analysis.entryThreshold ?? 52)
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                      }`}
                      style={{
                        width: `${Math.min(100, analysis.confidence)}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
              <p>
                Live: <strong>{analysis.action ?? "hold"}</strong> ·{" "}
                {analysis.reason}
              </p>
              {analysis.narrative &&
              analysis.narrative !== analysis.reason ? (
                <p className="text-xs text-zinc-500">{analysis.narrative}</p>
              ) : null}
              {analysis.factors && analysis.factors.length > 0 ? (
                <ul className="space-y-0.5 border-t border-zinc-800/80 pt-2 text-xs text-zinc-500">
                  {analysis.factors.map((f) => (
                    <li key={f.name}>
                      {f.name}: {Math.round(f.score)}/{f.max} — {f.detail}
                    </li>
                  ))}
                </ul>
              ) : null}
              {analysis.netMovePct != null ? (
                <p className="text-xs text-zinc-500">
                  5m move {analysis.netMovePct >= 0 ? "+" : ""}
                  {analysis.netMovePct.toFixed(1)}%
                  {analysis.trendEfficiency != null
                    ? ` · ${(analysis.trendEfficiency * 100).toFixed(0)}% efficient`
                    : ""}
                </p>
              ) : null}
              {analysis.priceInRangePct != null ? (
                <p className="text-xs text-zinc-500">
                  Price {analysis.priceInRangePct.toFixed(0)}% of swing range ·
                  mark ${analysis.markPrice?.toFixed(4) ?? "—"}
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>

        <PaperWalletBar paper={paper} />

        <PaperPositionPanel
          paper={paper}
          viewSymbol={cfg?.symbol ?? engagedSymbol}
          cfg={cfg}
          isRunning={isRunning}
          onClose={
            paper?.positionSide !== "flat" &&
            paper?.positionSymbol &&
            paper?.positionSource === "bot"
              ? () => void closePosition()
              : undefined
          }
          closing={closing}
        />

        <BotActivityPanel
          logs={activityLogs}
          alerts={displayAlerts}
          connected={connected}
          botStatus={botStatus}
        />

        <PaperTradeReplayChart
          symbol={cfg?.symbol ?? engagedSymbol}
          trades={displayTrades}
        />

        <Card title="Bot fills only (manual trades on Positions)">
          {displayTrades.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No paper trades yet. Start the bot on a moving symbol (JUP, WIF…).
              Buys/sells appear here and on the chart markers.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {displayTrades.slice(0, 30).map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-mono text-xs text-zinc-300">
                      {new Date(t.at).toLocaleTimeString()} ·{" "}
                      <span className="text-zinc-100">{actionLabel(t.action)}</span>
                    </p>
                    {t.pnlUsd != null ? (
                      <p
                        className={`font-mono text-xs ${
                          t.pnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {t.pnlUsd >= 0 ? "+" : ""}${t.pnlUsd.toFixed(2)} realized
                      </p>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    {formatPaperTradeReceipt(
                      t,
                      paper?.leverage ?? cfg?.paperLeverage ?? 2,
                      cfg?.paperTakerFeeBps ?? 5,
                    )}
                  </p>
                  {t.reason ? (
                    <p className="mt-1 text-xs text-zinc-600">{t.reason}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Risk limits">
          {risk ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Max position (USD)
                <Input
                  type="number"
                  value={risk.maxPositionNotionalUsd}
                  onChange={(e) =>
                    setRisk({
                      ...risk,
                      maxPositionNotionalUsd: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="text-sm">
                Max order (USD)
                <Input
                  type="number"
                  value={risk.maxOrderNotionalUsd}
                  onChange={(e) =>
                    setRisk({
                      ...risk,
                      maxOrderNotionalUsd: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="text-sm">
                Max daily loss (USD)
                <Input
                  type="number"
                  value={risk.maxDailyLossUsd}
                  onChange={(e) =>
                    setRisk({
                      ...risk,
                      maxDailyLossUsd: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="text-sm">
                Max leverage
                <Input
                  type="number"
                  value={risk.maxLeverage}
                  onChange={(e) =>
                    setRisk({ ...risk, maxLeverage: Number(e.target.value) })
                  }
                />
              </label>
              <div className="md:col-span-2">
                <Button onClick={() => void saveRisk()}>Save risk limits</Button>
              </div>
            </div>
          ) : null}
        </Card>

        <Card title="GCC metrics">
          <div className="grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
            <p>Volume: ${(gccMetrics?.volumeUsd ?? 0).toFixed(2)}</p>
            <p>Realized PnL: ${(gccMetrics?.realizedPnlUsd ?? 0).toFixed(2)}</p>
            <p>
              Unrealized PnL: $
              {(paper?.unrealizedPnlUsd ?? gccMetrics?.unrealizedPnlUsd ?? 0).toFixed(2)}
            </p>
            <p>Trades: {gccMetrics?.tradeCount ?? metrics?.tradeCount ?? 0}</p>
          </div>
        </Card>

        <div id="learn">
          <LearnPanel />
        </div>
      </div>
    </Shell>
  );
}
