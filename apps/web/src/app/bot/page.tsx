"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Button, Card, Input, Stat } from "@/components/ui";
import { api } from "@/lib/utils";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import type {
  BotConfig,
  BotStrategy,
  CandleTimeframe,
  GccMetrics,
  RiskLimits,
} from "@gcc/shared";
import { STRATEGY_HELP, TIMEFRAME_HELP } from "@gcc/shared";
import { LearnPanel } from "@/components/learn-panel";

type BotResponse = {
  config: BotConfig;
  status: string;
  analysis?: {
    trend: string;
    signal: string | null;
    reason: string;
    emaFast: number | null;
    emaSlow: number | null;
  } | null;
};

const STRATEGIES = (
  Object.entries(STRATEGY_HELP) as [
    BotStrategy,
    (typeof STRATEGY_HELP)[string],
  ][]
).map(([id, help]) => ({
  id,
  label: help.label,
  hint: help.summary,
}));

const TIMEFRAMES: CandleTimeframe[] = [
  "15s",
  "30s",
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
];

export default function BotPage() {
  const { metrics, connected } = useGccSocket();
  const [bot, setBot] = useState<BotResponse | null>(null);
  const [risk, setRisk] = useState<RiskLimits | null>(null);
  const [gccMetrics, setGccMetrics] = useState<GccMetrics | null>(null);

  const refresh = async () => {
    const [botRes, riskRes, metricsRes] = await Promise.all([
      api<BotResponse>("/api/bot"),
      api<RiskLimits>("/api/risk"),
      api<GccMetrics>("/api/metrics"),
    ]);
    setBot(botRes);
    setRisk(riskRes);
    setGccMetrics(metricsRes);
    if (botRes.config.strategy !== "manual") {
      const ta = await api<NonNullable<BotResponse["analysis"]>>(
        `/api/ta/${botRes.config.symbol}?timeframe=${botRes.config.candleTimeframe}&strategy=${botRes.config.strategy}`,
      );
      setBot((prev) => (prev ? { ...prev, analysis: ta } : prev));
    }
  };

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 2000);
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

  const saveRisk = async () => {
    if (!risk) return;
    await api("/api/risk", { method: "PATCH", body: JSON.stringify(risk) });
    await refresh();
  };

  const cfg = bot?.config;
  const analysis = bot?.analysis;

  return (
    <Shell connected={connected}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Bot status" value={bot?.status ?? "—"} />
          <Stat label="Mode" value={cfg?.mode ?? "—"} />
          <Stat
            label="Trades"
            value={String(gccMetrics?.tradeCount ?? metrics?.tradeCount ?? 0)}
          />
        </div>

        <Card title="Bot controls">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void action("/api/bot/start")}>Start</Button>
            <Button variant="secondary" onClick={() => void action("/api/bot/pause")}>
              Pause
            </Button>
            <Button variant="danger" onClick={() => void action("/api/bot/stop")}>
              Stop
            </Button>
          </div>
        </Card>

        <Card title="Strategy (reads Phoenix candles — you do not build them)">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Strategy
              <select
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                value={cfg?.strategy ?? "trend_macd"}
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
            <label className="text-sm md:col-span-2">
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
                min={500}
                step={500}
                value={cfg?.pollIntervalMs ?? 1000}
                onChange={(e) =>
                  void saveConfig({ pollIntervalMs: Number(e.target.value) })
                }
              />
              <span className="mt-1 block text-xs text-zinc-500">
                1000 = once per second. Lower = faster, more API calls.
              </span>
            </label>
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            {STRATEGIES.find((s) => s.id === cfg?.strategy)?.hint}
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Paper / Live and Mainnet / Devnet toggles are in the header. GCC
            competition uses Mainnet Phoenix + Live when you&apos;re ready.
          </p>
          {analysis ? (
            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-300">
              <p>
                Live read: trend <strong>{analysis.trend}</strong>
                {analysis.signal ? (
                  <>
                    {" "}
                    · signal <strong>{analysis.signal}</strong>
                  </>
                ) : null}
              </p>
              <p className="text-zinc-500">{analysis.reason}</p>
              {analysis.emaFast && analysis.emaSlow ? (
                <p className="text-xs text-zinc-600">
                  EMA20 {analysis.emaFast.toFixed(2)} · EMA50{" "}
                  {analysis.emaSlow.toFixed(2)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              Start the bot to see live MACD/trend analysis from Phoenix candles.
            </p>
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
            <p>Unrealized PnL: ${(gccMetrics?.unrealizedPnlUsd ?? 0).toFixed(2)}</p>
            <p>Updated: {gccMetrics?.updatedAt ?? "—"}</p>
          </div>
        </Card>

        <LearnPanel />
      </div>
    </Shell>
  );
}
