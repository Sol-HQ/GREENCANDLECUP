"use client";

import { Shell } from "@/components/shell";
import { Card, Stat } from "@/components/ui";
import { useGccSocket } from "@/hooks/use-gcc-socket";

export default function SystemPage() {
  const { health, logs, connected } = useGccSocket();

  return (
    <Shell connected={connected}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Stat
            label="Phoenix"
            value={health?.phoenixConnected ? "Connected" : "Down"}
            tone={health?.phoenixConnected ? "good" : "bad"}
          />
          <Stat
            label="RPC latency"
            value={health?.rpcLatencyMs != null ? `${health.rpcLatencyMs} ms` : "—"}
          />
          <Stat
            label="ShredStream"
            value={health?.shredStreamActive ? "Active" : "Inactive"}
          />
        </div>

        <Card title="Logs">
          <div className="max-h-96 space-y-2 overflow-y-auto text-xs">
            {logs.length === 0 ? (
              <p className="text-zinc-500">No logs yet.</p>
            ) : (
              logs.map((log) => (
                <div
                  key={`${log.at}-${log.message}`}
                  className="rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1 text-zinc-300"
                >
                  <span className="text-zinc-500">{log.at}</span> [{log.level}]{" "}
                  {log.message}
                </div>
              ))
            )}
          </div>
        </Card>

        {health?.lastError ? (
          <Card title="Last error">
            <p className="text-sm text-rose-400">{health.lastError}</p>
          </Card>
        ) : null}
      </div>
    </Shell>
  );
}
