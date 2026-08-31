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
import type { CandleTimeframe } from "@gcc/shared";
import { DEFAULT_SYMBOL } from "@gcc/shared";
import { openPopoutWindow } from "@/lib/popout-url";
import {
  broadcastScannerSync,
  subscribeScannerSync,
} from "@/lib/scanner-sync";

const STORAGE_KEY = "gcc-scanner-chart";

type ScannerChartState = {
  open: boolean;
  symbol: string;
  timeframe: CandleTimeframe;
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_STATE: ScannerChartState = {
  open: false,
  symbol: DEFAULT_SYMBOL,
  timeframe: "5m",
  x: 72,
  y: 88,
  width: 380,
  height: 300,
};

type ScannerChartContextValue = ScannerChartState & {
  setOpen: (open: boolean) => void;
  setSymbol: (symbol: string) => void;
  setTimeframe: (tf: CandleTimeframe) => void;
  setBounds: (patch: Partial<Pick<ScannerChartState, "x" | "y" | "width" | "height">>) => void;
  toggle: () => void;
  popOut: () => void;
  popoutActive: boolean;
};

const ScannerChartContext = createContext<ScannerChartContextValue | null>(null);

function loadState(): ScannerChartState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function ScannerChartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ScannerChartState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [popoutActive, setPopoutActive] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    broadcastScannerSync({
      type: "state",
      symbol: state.symbol,
      timeframe: state.timeframe,
    });
  }, [state.symbol, state.timeframe, hydrated]);

  useEffect(() => {
    return subscribeScannerSync((msg) => {
      if (msg.type === "state") {
        setState((prev) => ({
          ...prev,
          symbol: msg.symbol,
          timeframe: msg.timeframe,
        }));
      }
      if (msg.type === "popout-opened") setPopoutActive(true);
      if (msg.type === "popout-closed") setPopoutActive(false);
    });
  }, []);

  const setOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, open }));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, open: !prev.open }));
  }, []);

  const popOut = useCallback(() => {
    const opened = openPopoutWindow(state.symbol, state.timeframe);
    if (!opened) {
      const href = `${window.location.origin}/chart/popout?symbol=${encodeURIComponent(state.symbol)}&timeframe=${encodeURIComponent(state.timeframe)}`;
      void navigator.clipboard?.writeText(href);
      window.alert(
        "Popup was blocked.\n\nLink copied to clipboard — paste into Chrome or Edge for a second monitor:\n" +
          href,
      );
      return;
    }
    setState((prev) => ({ ...prev, open: false }));
    setPopoutActive(true);
  }, [state.symbol, state.timeframe]);

  const setSymbol = useCallback((symbol: string) => {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;
    setState((prev) => ({ ...prev, symbol: normalized }));
  }, []);

  const setTimeframe = useCallback((timeframe: CandleTimeframe) => {
    setState((prev) => ({ ...prev, timeframe }));
  }, []);

  const setBounds = useCallback(
    (patch: Partial<Pick<ScannerChartState, "x" | "y" | "width" | "height">>) => {
      setState((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const value = useMemo(
    () => ({
      ...state,
      setOpen,
      setSymbol,
      setTimeframe,
      setBounds,
      toggle,
      popOut,
      popoutActive,
    }),
    [state, setOpen, setSymbol, setTimeframe, setBounds, toggle, popOut, popoutActive],
  );

  return (
    <ScannerChartContext.Provider value={value}>
      {children}
    </ScannerChartContext.Provider>
  );
}

export function useScannerChart() {
  const ctx = useContext(ScannerChartContext);
  if (!ctx) {
    throw new Error("useScannerChart must be used within ScannerChartProvider");
  }
  return ctx;
}
