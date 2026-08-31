"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MarketDetail, PhoenixMarketListing } from "@gcc/shared";
import { DEFAULT_SYMBOL } from "@gcc/shared";
import { api } from "@/lib/utils";

const STORAGE_KEY = "gcc-selected-symbol";

function readStoredSymbol(): string {
  if (typeof window === "undefined") return DEFAULT_SYMBOL;
  try {
    return localStorage.getItem(STORAGE_KEY)?.toUpperCase() || DEFAULT_SYMBOL;
  } catch {
    return DEFAULT_SYMBOL;
  }
}

type SymbolContextValue = {
  symbol: string;
  setSymbol: (symbol: string) => Promise<void>;
  markets: PhoenixMarketListing[];
  listing: PhoenixMarketListing | null;
  detail: MarketDetail | null;
  loadingMarkets: boolean;
  loadingDetail: boolean;
  hydrated: boolean;
};

const SymbolContext = createContext<SymbolContextValue | null>(null);

export function SymbolProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbolState] = useState(DEFAULT_SYMBOL);
  const [hydrated, setHydrated] = useState(false);
  const [markets, setMarkets] = useState<PhoenixMarketListing[]>([]);
  const [detail, setDetail] = useState<MarketDetail | null>(null);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(true);

  useEffect(() => {
    let active = true;
    const stored = readStoredSymbol();
    setSymbolState(stored);

  void (async () => {
      try {
        const server = await api<{ symbol: string }>("/api/symbol");
        if (!active) return;
        const resolved = stored || server.symbol?.toUpperCase() || DEFAULT_SYMBOL;
        setSymbolState(resolved);
        localStorage.setItem(STORAGE_KEY, resolved);
        await api("/api/symbol", {
          method: "PATCH",
          body: JSON.stringify({ symbol: resolved }),
        });
      } catch {
        if (active) {
          await api("/api/symbol", {
            method: "PATCH",
            body: JSON.stringify({ symbol: stored }),
          }).catch(() => undefined);
        }
      } finally {
        if (active) setHydrated(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingMarkets(true);
    void api<PhoenixMarketListing[]>("/api/markets")
      .then((rows) => {
        if (active) setMarkets(rows);
      })
      .catch(() => {
        if (active) setMarkets([]);
      })
      .finally(() => {
        if (active) setLoadingMarkets(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const refreshDetail = useCallback(async (nextSymbol: string) => {
    setLoadingDetail(true);
    try {
      const data = await api<MarketDetail>(
        `/api/market/${nextSymbol}/detail`,
      );
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void refreshDetail(symbol);
    const id = setInterval(() => void refreshDetail(symbol), 15_000);
    return () => clearInterval(id);
  }, [symbol, refreshDetail, hydrated]);

  const setSymbol = useCallback(async (next: string) => {
    const normalized = next.trim().toUpperCase();
    if (!normalized) return;
    setSymbolState(normalized);
    localStorage.setItem(STORAGE_KEY, normalized);
    await api("/api/symbol", {
      method: "PATCH",
      body: JSON.stringify({ symbol: normalized }),
    });
    void refreshDetail(normalized);
  }, [refreshDetail]);

  const listing = useMemo(
    () => markets.find((m) => m.symbol === symbol) ?? detail?.listing ?? null,
    [markets, symbol, detail],
  );

  const value = useMemo(
    () => ({
      symbol,
      setSymbol,
      markets,
      listing,
      detail,
      loadingMarkets,
      loadingDetail,
      hydrated,
    }),
    [symbol, setSymbol, markets, listing, detail, loadingMarkets, loadingDetail, hydrated],
  );

  return (
    <SymbolContext.Provider value={value}>{children}</SymbolContext.Provider>
  );
}

export function useSymbol() {
  const ctx = useContext(SymbolContext);
  if (!ctx) throw new Error("useSymbol must be used within SymbolProvider");
  return ctx;
}
