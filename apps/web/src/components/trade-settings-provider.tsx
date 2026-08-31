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
import {
  DEFAULT_TRADE_SETTINGS,
  type TradeSettings,
} from "@gcc/shared";

const STORAGE_KEY = "gcc-trade-settings";

type TradeSettingsContextValue = {
  settings: TradeSettings;
  updateSettings: (patch: Partial<TradeSettings>) => void;
};

const TradeSettingsContext = createContext<TradeSettingsContextValue | null>(
  null,
);

export function TradeSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<TradeSettings>(DEFAULT_TRADE_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<TradeSettings>;
      setSettings({
        ...DEFAULT_TRADE_SETTINGS,
        ...parsed,
        leverageBySymbol: {
          ...DEFAULT_TRADE_SETTINGS.leverageBySymbol,
          ...(parsed.leverageBySymbol ?? {}),
        },
      });
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const updateSettings = useCallback((patch: Partial<TradeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings }),
    [settings, updateSettings],
  );

  return (
    <TradeSettingsContext.Provider value={value}>
      {children}
    </TradeSettingsContext.Provider>
  );
}

export function useTradeSettings() {
  const ctx = useContext(TradeSettingsContext);
  if (!ctx) {
    throw new Error("useTradeSettings must be used within TradeSettingsProvider");
  }
  return ctx;
}
