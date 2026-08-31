"use client";

import { Card } from "@/components/ui";
import type { TradeAlert } from "@gcc/shared";

type LogEntry = { level: string; message: string; at: string };

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

function levelTone(level: string) {
  if (level === "error") return "text-rose-400";
  if (level === "warn") return "text-amber-400";
  if (level === "signal") return "text-emerald-400";
  return "text-zinc-300";
}

export function BotActivityPanel({
  logs,
  alerts,
  connected,
  botStatus = "stopped",
}: {
  logs: LogEntry[];
  alerts: TradeAlert[];
  connected: boolean;
  botStatus?: string;
}) {
  const botLogs = logs.filter(
    (l) =>
      l.message.startsWith("Scan ") ||
      l.message.startsWith("TRADE") ||
      l.message.startsWith("Bot ") ||
      l.message.startsWith("Waiting") ||
      l.message.startsWith("Paper"),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Bot activity (live)">
        <p className="mb-2 text-xs text-zinc-500">
          {botStatus !== "running" ? (
            <>
              Bot is <strong className="text-zinc-300">{botStatus}</strong> — no
              scans or trades. Press Start trading when you&apos;re ready.
            </>
          ) : connected ? (
            "Bot running · scans every ~10s · trades prefixed TRADE"
          ) : (
            "Reconnecting to server…"
          )}
        </p>
        <div className="max-h-72 space-y-1.5 overflow-y-auto font-mono text-xs">
          {botLogs.length === 0 ? (
            <p className="text-zinc-500">
              Press Start — you&apos;ll see Scan lines (how the bot reads the
              market) and TRADE lines when it acts.
            </p>
          ) : (
            botLogs.map((log) => (
              <div
                key={`${log.at}-${log.message}`}
                className="rounded border border-zinc-800/80 bg-zinc-900/40 px-2 py-1.5"
              >
                <span className="text-zinc-600">{formatTime(log.at)}</span>{" "}
                <span className={levelTone(log.level)}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card title="Trade signals & alerts">
        <div className="max-h-72 space-y-1.5 overflow-y-auto text-xs">
          {alerts.length === 0 ? (
            <p className="text-zinc-500">
              Bot trades and large price moves show up here.
            </p>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded border border-zinc-800/80 bg-zinc-900/40 px-2 py-1.5"
              >
                <p className="font-medium text-zinc-200">{alert.title}</p>
                <p className="text-zinc-500">{alert.message}</p>
                <p className="text-zinc-600">{formatTime(alert.at)}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
