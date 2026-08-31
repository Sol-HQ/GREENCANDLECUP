"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChartPanel } from "@/components/chart-panel";
import { SymbolPicker } from "@/components/symbol-picker";
import { useScannerChart } from "@/components/scanner-chart-provider";
import { Button } from "@/components/ui";

const MIN_W = 260;
const MIN_H = 180;

type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type DragState = {
  edge: ResizeEdge | "move";
  startX: number;
  startY: number;
  startBounds: { x: number; y: number; width: number; height: number };
};

function clampBounds(
  edge: DragState["edge"],
  start: DragState["startBounds"],
  dx: number,
  dy: number,
) {
  let { x, y, width, height } = start;

  if (edge === "move") {
    return {
      x: Math.max(4, x + dx),
      y: Math.max(4, y + dy),
      width,
      height,
    };
  }

  if (edge.includes("e")) {
    width = Math.max(MIN_W, width + dx);
  }
  if (edge.includes("w")) {
    const nextW = Math.max(MIN_W, width - dx);
    x = x + (width - nextW);
    width = nextW;
  }
  if (edge.includes("s")) {
    height = Math.max(MIN_H, height + dy);
  }
  if (edge.includes("n")) {
    const nextH = Math.max(MIN_H, height - dy);
    y = y + (height - nextH);
    height = nextH;
  }

  return { x: Math.max(4, x), y: Math.max(4, y), width, height };
}

const HANDLE =
  "absolute z-10 touch-none select-none hover:bg-sky-400/20";

export function FloatingChartWindow() {
  const scanner = useScannerChart();
  const [mounted, setMounted] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!scanner.open) return;
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      scanner.setBounds(
        clampBounds(drag.edge, drag.startBounds, dx, dy),
      );
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [scanner]);

  const startDrag = (
    edge: DragState["edge"],
    e: React.PointerEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startBounds: {
        x: scanner.x,
        y: scanner.y,
        width: scanner.width,
        height: scanner.height,
      },
    };
  };

  if (!mounted || !scanner.open) return null;

  return createPortal(
    <div
      className="fixed z-[300] flex flex-col overflow-hidden rounded-lg border border-sky-500/40 bg-zinc-950 shadow-2xl"
      style={{
        left: scanner.x,
        top: scanner.y,
        width: scanner.width,
        height: scanner.height,
      }}
    >
      <div className="relative z-20 flex min-h-0 flex-1 flex-col">
        <div
          className="flex shrink-0 cursor-move items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/95 px-2 py-1"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            startDrag("move", e);
          }}
        >
          <p className="text-[11px] font-semibold text-sky-300">
            Scanner · {scanner.symbol}
            {scanner.popoutActive ? (
              <span className="ml-1 font-normal text-zinc-500">(also in pop-out)</span>
            ) : null}
          </p>
          <div className="flex gap-1">
            <Button
              variant="secondary"
              className="!px-1.5 !py-0.5 !text-[10px]"
              onClick={() => scanner.popOut()}
              title="Opens a real browser window — drag to another monitor"
            >
              Pop out
            </Button>
            <Button
              variant="secondary"
              className="!px-1.5 !py-0.5 !text-[10px]"
              onClick={() => scanner.setOpen(false)}
            >
              ✕
            </Button>
          </div>
        </div>

        <div className="relative z-20 shrink-0 border-b border-zinc-800/80 px-2 py-1">
          <SymbolPicker
            className="max-w-full"
            symbol={scanner.symbol}
            onSymbolChange={scanner.setSymbol}
            compact
          />
        </div>

        <div className="relative z-20 min-h-0 flex-1 overflow-hidden p-1">
          <ChartPanel
            symbol={scanner.symbol}
            variant="scanner"
            timeframe={scanner.timeframe}
            onTimeframeChange={scanner.setTimeframe}
          />
        </div>
      </div>

      {/* Resize handles sit above chrome edges only */}
      <div className={`${HANDLE} left-2 right-2 top-0 z-30 h-2 cursor-n-resize`} onPointerDown={(e) => startDrag("n", e)} />
      <div className={`${HANDLE} bottom-0 left-2 right-2 z-30 h-2 cursor-s-resize`} onPointerDown={(e) => startDrag("s", e)} />
      <div className={`${HANDLE} bottom-2 left-0 top-2 z-30 w-2 cursor-w-resize`} onPointerDown={(e) => startDrag("w", e)} />
      <div className={`${HANDLE} bottom-2 right-0 top-2 z-30 w-2 cursor-e-resize`} onPointerDown={(e) => startDrag("e", e)} />
      <div className={`${HANDLE} left-0 top-0 z-30 h-4 w-4 cursor-nw-resize`} onPointerDown={(e) => startDrag("nw", e)} />
      <div className={`${HANDLE} right-0 top-0 z-30 h-4 w-4 cursor-ne-resize`} onPointerDown={(e) => startDrag("ne", e)} />
      <div className={`${HANDLE} bottom-0 left-0 z-30 h-4 w-4 cursor-sw-resize`} onPointerDown={(e) => startDrag("sw", e)} />
      <div className={`${HANDLE} bottom-0 right-0 z-30 h-4 w-4 cursor-se-resize`} onPointerDown={(e) => startDrag("se", e)} />
    </div>,
    document.body,
  );
}
