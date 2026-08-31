"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

const WORKSPACE_HEIGHT_KEY = "gcc-trade-workspace-height";
const MIN_WORKSPACE_HEIGHT = 560;
const MAX_WORKSPACE_HEIGHT = 2800;

function ResizeHandle({
  className,
  barClassName,
}: {
  className?: string;
  barClassName?: string;
}) {
  return (
    <Separator
      className={cn(
        "group relative z-10 flex shrink-0 items-center justify-center bg-zinc-900/90 transition-colors hover:bg-emerald-500/25 data-[separator=active]:bg-emerald-500/35",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-full bg-zinc-600 shadow-[0_0_8px_rgba(52,211,153,0.35)] transition-colors group-hover:bg-emerald-400 group-data-[separator=active]:bg-emerald-300",
          barClassName,
        )}
      />
    </Separator>
  );
}

function useWorkspaceHeight() {
  const [height, setHeight] = useState(860);

  useEffect(() => {
    const saved = localStorage.getItem(WORKSPACE_HEIGHT_KEY);
    if (saved) {
      const parsed = Number(saved);
      if (!Number.isNaN(parsed)) {
        setHeight(
          Math.min(MAX_WORKSPACE_HEIGHT, Math.max(MIN_WORKSPACE_HEIGHT, parsed)),
        );
        return;
      }
    }
    setHeight(Math.round(window.innerHeight * 0.9));
  }, []);

  const persistHeight = useCallback((next: number) => {
    const clamped = Math.min(
      MAX_WORKSPACE_HEIGHT,
      Math.max(MIN_WORKSPACE_HEIGHT, next),
    );
    setHeight(clamped);
    localStorage.setItem(WORKSPACE_HEIGHT_KEY, String(clamped));
  }, []);

  return { height, persistHeight };
}

export function ResizableTradeLayout(props: {
  chart: ReactNode;
  orderbook: ReactNode;
  trade: ReactNode;
  alertsFeed?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className="rounded-xl border border-zinc-800 bg-zinc-950/40"
        style={{ height: 860, minHeight: MIN_WORKSPACE_HEIGHT }}
      />
    );
  }

  return <ResizableTradeLayoutInner {...props} />;
}

function ResizableTradeLayoutInner({
  chart,
  orderbook,
  trade,
  alertsFeed,
}: {
  chart: ReactNode;
  orderbook: ReactNode;
  trade: ReactNode;
  alertsFeed?: ReactNode;
}) {
  const { height, persistHeight } = useWorkspaceHeight();
  const vertical = useDefaultLayout({
    id: "gcc-trade-vertical",
    panelIds: ["chart", "bottom"],
  });
  const horizontal = useDefaultLayout({
    id: "gcc-trade-bottom",
    panelIds: ["orderbook", "sidebar"],
  });

  const startBottomResize = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = height;

      const onMove = (moveEvent: MouseEvent) => {
        persistHeight(startHeight + (moveEvent.clientY - startY));
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [height, persistHeight],
  );

  return (
    <div className="relative pb-3">
      <div
        className="rounded-xl"
        style={{ height: `${height}px`, minHeight: MIN_WORKSPACE_HEIGHT }}
      >
        <Group
          id="gcc-trade-vertical"
          orientation="vertical"
          className="h-full rounded-xl"
          defaultLayout={vertical.defaultLayout}
          onLayoutChanged={vertical.onLayoutChanged}
        >
          <Panel id="chart" defaultSize="56%" minSize="22%" className="min-h-[240px]">
            <div className="h-full min-h-0 overflow-hidden pr-0.5">{chart}</div>
          </Panel>

          <ResizeHandle className="h-2.5 cursor-row-resize" barClassName="h-1 w-20" />

          <Panel id="bottom" defaultSize="44%" minSize="28%" className="min-h-[280px]">
            <Group
              id="gcc-trade-bottom"
              orientation="horizontal"
              className="h-full"
              defaultLayout={horizontal.defaultLayout}
              onLayoutChanged={horizontal.onLayoutChanged}
            >
              <Panel
                id="orderbook"
                defaultSize="38%"
                minSize="18%"
                className="min-w-[180px]"
              >
                <div className="flex h-full min-h-0 flex-col gap-2">
                  {alertsFeed ? (
                    <div className="shrink-0">{alertsFeed}</div>
                  ) : null}
                  <div className="min-h-0 flex-1 overflow-auto pr-0.5">
                    {orderbook}
                  </div>
                </div>
              </Panel>

              <ResizeHandle className="w-2.5 cursor-col-resize" barClassName="h-16 w-1" />

              <Panel
                id="sidebar"
                defaultSize="62%"
                minSize="32%"
                className="min-w-[280px]"
              >
                <div className="h-full min-h-0 overflow-auto pr-0.5">{trade}</div>
              </Panel>
            </Group>
          </Panel>
        </Group>
      </div>

      <button
        type="button"
        aria-label="Drag to resize workspace height"
        onMouseDown={startBottomResize}
        className="group absolute inset-x-0 -bottom-1 z-20 flex h-5 cursor-row-resize items-center justify-center rounded-b-xl border border-t border-zinc-800/80 bg-zinc-950/90 transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
      >
        <div className="h-1 w-24 rounded-full bg-zinc-600 transition group-hover:bg-emerald-400" />
        <span className="pointer-events-none absolute -bottom-5 text-[10px] text-zinc-500 opacity-0 transition group-hover:opacity-100">
          Drag to grow workspace · page scrolls
        </span>
      </button>
    </div>
  );
}
