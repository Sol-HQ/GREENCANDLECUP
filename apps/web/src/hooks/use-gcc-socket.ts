"use client";

import { useEffect, useState } from "react";
import type {
  GccMetrics,
  MarketSnapshot,
  OrderbookSnapshot,
  SystemHealth,
  WsEvent,
} from "@gcc/shared";
import { WS_URL } from "@/lib/utils";

export function useGccSocket() {
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [orderbook, setOrderbook] = useState<OrderbookSnapshot | null>(null);
  const [metrics, setMetrics] = useState<GccMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [logs, setLogs] = useState<
    Array<{ level: string; message: string; at: string }>
  >([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data as string) as WsEvent;
      switch (payload.type) {
        case "market":
          setMarket(payload.data);
          break;
        case "orderbook":
          setOrderbook(payload.data);
          break;
        case "metrics":
          setMetrics(payload.data);
          break;
        case "health":
          setHealth(payload.data);
          break;
        case "log":
          setLogs((prev) => [payload.data, ...prev].slice(0, 50));
          break;
      }
    };

    return () => ws.close();
  }, []);

  return { market, orderbook, metrics, health, logs, connected };
}
