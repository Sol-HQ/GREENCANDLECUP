"use client";

import type { ReactNode } from "react";
import { SymbolProvider } from "@/components/symbol-provider";
import { TradeSettingsProvider } from "@/components/trade-settings-provider";
import { ScannerChartProvider } from "@/components/scanner-chart-provider";

/** App-wide providers: symbol, trade settings, floating scanner chart. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SymbolProvider>
      <TradeSettingsProvider>
        <ScannerChartProvider>{children}</ScannerChartProvider>
      </TradeSettingsProvider>
    </SymbolProvider>
  );
}
