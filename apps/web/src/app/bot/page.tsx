"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Button, Card, Input, Stat } from "@/components/ui";
import { api } from "@/lib/utils";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import type { BotConfig, GccMetrics, RiskLimits } from "@gcc/shared";

export default function BotPage() {
  const { metrics, connected } = useGccSocket();
  const [bot, setBot] = useState<{ config: BotConfig; status: string } | null>(
    null,
  );
  const [risk, setRisk] = useState<RiskLimits | null>(null);
  const [gccMetrics, setGccMetrics] = useState<GccMetrics | null>(null);

  const refresh = async () => {
    const [botRes, riskRes, metricsRes] = await Promise.all([
      api<{ config: BotConfig; status: string }>("/api/bot"),
      api<RiskLimits>("/api/risk"),
      api<GccMetrics>("/api/metrics"),
    ]);
    setBot(botRes);
    setRisk(riskRes);
    setGccMetrics(metricsRes);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const action = async (path: string) => {
    await api(path, { method: "POST" });
    await refresh();
  };

  const saveRisk = async () => {
    if (!risk) return;
    await api("/api/risk", { method: "PATCH", body: JSON.stringify(risk) });
    await refresh();
  };

  return (
    <Shell connected={connected}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Bot status" value={bot?.status ?? "—"} />
          <Stat
            label="Mode"
            value={bot?.config.mode ?? "—"}
          />
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
          <p className="mt-3 text-sm text-zinc-400">
            Strategy: momentum on SOL · paper mode by default until you switch to live
            and configure a server keypair.
          </p>
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
      </div>
    </Shell>
  );
}
