"use client";

import { useEffect, useState } from "react";
import type {
  GccMetrics,
  MarketSnapshot,
  OrderbookSnapshot,
  PaperPortfolioState,
  PaperTradeRecord,
  SystemHealth,
  TradeAlert,
  WsEvent,
} from "@gcc/shared";
import { WS_URL } from "@/lib/utils";

export function useGccSocket(watchSymbol?: string) {
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [orderbook, setOrderbook] = useState<OrderbookSnapshot | null>(null);
  const [metrics, setMetrics] = useState<GccMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [logs, setLogs] = useState<
    Array<{ level: string; message: string; at: string }>
  >([]);
  const [alerts, setAlerts] = useState<TradeAlert[]>([]);
  const [paperTrades, setPaperTrades] = useState<PaperTradeRecord[]>([]);
  const [paperPortfolio, setPaperPortfolio] = useState<PaperPortfolioState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setMarket(null);
    setOrderbook(null);
  }, [watchSymbol]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data as string) as WsEvent;
      switch (payload.type) {
        case "market":
          if (!watchSymbol || payload.data.symbol === watchSymbol) {
            setMarket(payload.data);
          }
          break;
        case "orderbook":
          if (!watchSymbol || payload.data.symbol === watchSymbol) {
            setOrderbook(payload.data);
          }
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
        case "alert":
          setAlerts((prev) => [payload.data, ...prev].slice(0, 30));
          break;
        case "paper_trade":
          setPaperTrades((prev) => {
            if (prev.some((p) => p.id === payload.data.id)) return prev;
            return [payload.data, ...prev].slice(0, 100);
          });
          break;
        case "paper_portfolio":
          setPaperPortfolio(payload.data);
          break;
      }
    };

    return () => ws.close();
  }, [watchSymbol]);

  return { market, orderbook, metrics, health, logs, alerts, paperTrades, paperPortfolio, connected };
}
