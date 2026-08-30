"use client";

import { useRef } from "react";
import { Shell } from "@/components/shell";
import { OrderbookPanel } from "@/components/orderbook-panel";
import { TradePanel } from "@/components/trade-panel";
import { ChartPanel } from "@/components/chart-panel";
import { AlertsPanel } from "@/components/alerts-panel";
import { TradeErrorBoundary } from "@/components/trade-error-boundary";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { StickyNotesLayer } from "@/components/workspace/sticky-notes-layer";
import { WorkspaceAnnotationLayer } from "@/components/workspace/workspace-annotation-layer";
import { StickyPlacementOverlay } from "@/components/workspace/sticky-placement-overlay";

export default function TradePage() {
  const { market, orderbook, connected } = useGccSocket();
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <WorkspaceProvider>
      <Shell connected={connected}>
        <TradeErrorBoundary name="Trade">
          <div className="space-y-4">
            {/* Toolbar always on top — never covered by draw canvas */}
            <div className="relative z-[100]">
              <WorkspaceToolbar />
            </div>

            {/* Draw/sticky layers only cover this content region */}
            <div ref={contentRef} className="relative min-h-[60vh]">
              <div className="relative z-10 grid gap-4 xl:grid-cols-2">
                <div className="space-y-4 xl:col-span-2">
                  <ChartPanel />
                </div>
                <OrderbookPanel book={orderbook} />
                <div className="space-y-4">
                  <TradePanel markPrice={market?.markPriceUsd ?? null} />
                  <AlertsPanel />
                </div>
              </div>
              <WorkspaceAnnotationLayer boundsRef={contentRef} />
              <StickyPlacementOverlay boundsRef={contentRef} />
              <StickyNotesLayer />
            </div>
          </div>
        </TradeErrorBoundary>
      </Shell>
    </WorkspaceProvider>
  );
}
