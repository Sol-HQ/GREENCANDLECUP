"use client";

import { Shell } from "@/components/shell";
import { Card, Stat } from "@/components/ui";
import { GLOSSARY } from "@gcc/shared";
import { PageGuide } from "@/components/page-guide";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import { useNetwork } from "@/components/network-provider";

export default function SystemPage() {
  const { health, logs, connected } = useGccSocket();
  const { network } = useNetwork();

  return (
    <Shell connected={connected}>
      <div className="space-y-4">
        <PageGuide page="system" />
        <div className="grid gap-4 md:grid-cols-3">
          <Stat
            label="Phoenix"
            value={health?.phoenixConnected ? "Connected" : "Down"}
            tone={health?.phoenixConnected ? "good" : "bad"}
          />
          <Stat
            label="Phoenix poll"
            value={
              health?.phoenixPollLatencyMs ?? health?.rpcLatencyMs != null
                ? `${health.phoenixPollLatencyMs ?? health.rpcLatencyMs} ms`
                : "—"
            }
          />
          <Stat
            label="ShredStream"
            value={health?.shredStreamActive ? "Active" : "Inactive"}
          />
        </div>

        <Card title="Network">
          <div className="space-y-2 text-sm text-zinc-300">
            <p>
              Wallet RPC:{" "}
              <span className="text-zinc-100">
                {network?.walletCluster ?? "—"} · public Solana
              </span>
            </p>
            <p>
              Phoenix / reads:{" "}
              <span className="text-zinc-100">
                {network?.phoenixRpcMasked ?? "public RPC"} + HTTP API
              </span>
            </p>
            <p>
              Tx send (Helius):{" "}
              <span className="text-zinc-100">
                {network?.txRpcMasked ?? network?.botRpcMasked ?? "—"}
              </span>
            </p>
            <p className="text-xs text-zinc-500">
              Data path: Phoenix HTTP for orderbook/candles/mark. Public Solana
              RPC for wallet reads and Rise SDK fallback only. Helius fires on
              sendTransaction — not on dashboard idle.
            </p>
            <p>
              Trading:{" "}
              <span className="text-zinc-100">
                {network?.tradingMode ?? "—"}
              </span>{" "}
              · Phoenix: mainnet (GCC)
            </p>
            <p className="text-xs text-zinc-500">{GLOSSARY.mainnetVsDevnet.body}</p>
          </div>
        </Card>

        <Card title="ShredStream — your speed edge (Phase 2)">
          <div className="space-y-3 text-sm leading-relaxed text-zinc-300">
            <p>{GLOSSARY.shredStream.body}</p>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400">
              <p className="mb-2 font-medium text-zinc-200">Analogy</p>
              <p>
                Normal API = watching the game on TV with a delay. ShredStream =
                someone texting you each play from the stadium seats in real
                time. You still need a trading plan (MACD, trend) — ShredStream
                just lets you act sooner when a big move starts.
              </p>
            </div>
            <ul className="list-inside list-disc space-y-1 text-zinc-400">
              <li>
                <strong className="text-zinc-200">What it gives:</strong> see
                large fills / flow before the orderbook API updates
              </li>
              <li>
                <strong className="text-zinc-200">What it does NOT do:</strong>{" "}
                draw candles, MACD, or pick entries by itself
              </li>
              <li>
                <strong className="text-zinc-200">When we turn it on:</strong>{" "}
                NYC VPS + Triton IP + UDP port (deploy script ready)
              </li>
              <li>
                <strong className="text-zinc-200">Status:</strong>{" "}
                {network?.shredStreamConfigured
                  ? "Env configured — smoke test on VPS"
                  : "Not configured yet (expected before Sep 1)"}
              </li>
            </ul>
          </div>
        </Card>

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
