"use client";



import { Shell } from "@/components/shell";

import { OrderbookPanel } from "@/components/orderbook-panel";

import { TradePanel } from "@/components/trade-panel";

import { ChartPanel } from "@/components/chart-panel";

import { AlertsPanel } from "@/components/alerts-panel";

import { useGccSocket } from "@/hooks/use-gcc-socket";

import { WorkspaceProvider } from "@/components/workspace/workspace-context";

import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";

import { StickyNotesLayer } from "@/components/workspace/sticky-notes-layer";
import { WorkspaceSurface } from "@/components/workspace/workspace-surface";



export default function TradePage() {

  const { market, orderbook, connected } = useGccSocket();

  return (

    <WorkspaceProvider>

      <Shell connected={connected}>

        <WorkspaceSurface className="space-y-4">

          <WorkspaceToolbar />

          <div className="grid gap-4 xl:grid-cols-2">

            <div className="space-y-4 xl:col-span-2">

              <ChartPanel />

            </div>

            <OrderbookPanel book={orderbook} />

            <div className="space-y-4">

              <TradePanel markPrice={market?.markPriceUsd ?? null} />

              <AlertsPanel />

            </div>

          </div>

          <StickyNotesLayer />

        </WorkspaceSurface>

      </Shell>

    </WorkspaceProvider>

  );

}

