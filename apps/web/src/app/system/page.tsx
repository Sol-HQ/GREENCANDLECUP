"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Card, Stat } from "@/components/ui";
import { GLOSSARY } from "@gcc/shared";
import { PageGuide } from "@/components/page-guide";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import { useNetwork } from "@/components/network-provider";

type InfraStatus = {
  phoenixApiHost: string;
  phoenixDataPath: string;
  readRpcMasked: string;
  readRpcClass: string;
  readRpcLatencyMs: number | null;
  txRpcMasked: string;
  txRpcIsHelius: boolean;
  vpsPublicIp: string | null;
  shredStream: {
    configured: boolean;
    listening: boolean;
    active: boolean;
    port: number | null;
    packetsLastMinute: number;
  };
  warnings: string[];
};

export default function SystemPage() {
  const { health, logs, connected } = useGccSocket();
  const { network } = useNetwork();
  const [infra, setInfra] = useState<InfraStatus | null>(null);

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
    fetch(`${api}/api/infra`)
      .then((r) => r.json())
      .then(setInfra)
      .catch(() => setInfra(null));
  }, []);

  const shredActive =
    health?.shredStreamActive ?? infra?.shredStream.active ?? false;
  const shredListening =
    health?.shredStreamListening ?? infra?.shredStream.listening ?? false;

  return (
    <Shell connected={connected}>
      <div className="space-y-4">
        <PageGuide page="system" />
        <div className="grid gap-4 md:grid-cols-3">
          <Stat
            label="Phoenix HTTP"
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
            value={
              shredActive
                ? "Active"
                : shredListening
                  ? "Listening"
                  : "Inactive"
            }
            tone={shredActive ? "good" : undefined}
          />
        </div>

        <Card title="Network">
          <div className="space-y-2 text-sm text-zinc-300">
            <p>
              Phoenix data:{" "}
              <span className="text-zinc-100">
                {infra?.phoenixApiHost ?? network?.phoenixApiHost ?? "perp-api.phoenix.trade"}{" "}
                · HTTP API
              </span>
            </p>
            <p className="text-xs text-zinc-500">
              {infra?.phoenixDataPath ??
                "Candles, orderbook, and mark price come from Phoenix HTTP — not api.mainnet-beta.solana.com."}
            </p>
            <p>
              Read RPC (Rise bootstrap):{" "}
              <span className="text-zinc-100">
                {infra?.readRpcMasked ?? network?.phoenixRpcMasked ?? "public RPC"}{" "}
                · {infra?.readRpcClass ?? network?.readRpcClass ?? "public"}
                {infra?.readRpcLatencyMs != null
                  ? ` · ${infra.readRpcLatencyMs}ms`
                  : health?.readRpcLatencyMs != null
                    ? ` · ${health.readRpcLatencyMs}ms`
                    : ""}
              </span>
            </p>
            <p>
              Wallet RPC:{" "}
              <span className="text-zinc-100">
                {network?.walletCluster ?? "—"} · public Solana
              </span>
            </p>
            <p>
              Tx send (Helius):{" "}
              <span className="text-zinc-100">
                {infra?.txRpcMasked ?? network?.txRpcMasked ?? "—"}
                {infra?.txRpcIsHelius === false ? " · not Helius" : ""}
              </span>
            </p>
            <p>
              Vultr VPS:{" "}
              <span className="text-zinc-100">
                {infra?.vpsPublicIp ?? network?.vpsPublicIp ?? "not configured"}
              </span>
            </p>
            <p>
              Trading:{" "}
              <span className="text-zinc-100">
                {network?.tradingMode ?? "—"}
              </span>{" "}
              · Phoenix: mainnet (GCC)
            </p>
            <p className="text-xs text-zinc-500">{GLOSSARY.mainnetVsDevnet.body}</p>
            {(infra?.warnings ?? []).map((w) => (
              <p key={w} className="text-xs text-amber-400/90">
                {w}
              </p>
            ))}
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
                {shredActive
                  ? `Receiving packets (${health?.shredStreamPacketsPerMin ?? infra?.shredStream.packetsLastMinute ?? 0}/min)`
                  : shredListening
                    ? `Listening on UDP :${infra?.shredStream.port ?? "8002"} — waiting for Triton`
                    : network?.shredStreamConfigured
                      ? "Env configured — restart server after setting SHREDSTREAM_UDP_PORT"
                      : "Set SHREDSTREAM_UDP_PORT + register VPS IP with Triton"}
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
