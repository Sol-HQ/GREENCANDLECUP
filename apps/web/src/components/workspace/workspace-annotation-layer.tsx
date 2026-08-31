"use client";

import { useEffect, useRef } from "react";
import type { Stroke, TextLabel } from "./types";
import { useWorkspace } from "./workspace-context";

type LayerMode = "global" | "local";

type Props = {
  mode: LayerMode;
  panRef?: React.RefObject<HTMLElement | null>;
  strokes: Stroke[];
  labels: TextLabel[];
};

export function WorkspaceAnnotationLayer({
  mode,
  panRef,
  strokes,
  labels,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    tool,
    color,
    penTarget,
    addStroke,
    updateLabel,
    removeLabel,
    focusLabelId,
    clearFocusLabel,
  } = useWorkspace();

  const drawing = useRef<{
    id: string;
    points: Array<{ x: number; y: number }>;
  } | null>(null);

  const isPen = tool === "pen";
  const isFixed = mode === "global";
  const layerActive = penTarget?.layer === mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      let w: number;
      let h: number;
      if (isFixed) {
        w = window.innerWidth;
        h = window.innerHeight;
      } else {
        const pan = panRef?.current;
        if (!pan) return;
        w = pan.clientWidth;
        h = pan.clientHeight;
        if (w === 0 || h === 0) return;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i]!.x, stroke.points[i]!.y);
        }
        ctx.stroke();
      }
    };

    resize();
    if (isFixed) {
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    const pan = panRef?.current;
    if (!pan) return;
    const ro = new ResizeObserver(resize);
    ro.observe(pan);
    return () => ro.disconnect();
  }, [strokes, panRef, isFixed]);

  const pointFromEvent = (e: React.PointerEvent) => {
    if (isFixed) {
      return { x: e.clientX, y: e.clientY };
    }
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isPen || !layerActive) return;
    e.stopPropagation();
    const p = pointFromEvent(e);
    drawing.current = { id: crypto.randomUUID(), points: [p] };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isPen || !layerActive) return;
    const p = pointFromEvent(e);
    if (!drawing.current) return;
    drawing.current.points.push(p);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const pts = drawing.current.points;
    const last = pts.at(-2);
    if (!last) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const onPointerUp = () => {
    if (!drawing.current || !isPen || !layerActive) return;
    addStroke({
      id: drawing.current.id,
      points: drawing.current.points,
      color,
      width: 3,
      scope: mode,
    });
    drawing.current = null;
  };

  const showCanvas = isPen && layerActive;

  return (
    <div
      className={
        isFixed
          ? "pointer-events-none fixed inset-0 z-[45]"
          : "pointer-events-none absolute inset-0 z-20"
      }
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${showCanvas ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"}`}
        style={isFixed ? { position: "fixed" } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      {labels.map((label) => (
        <TextLabelChip
          key={label.id}
          label={label}
          fixed={isFixed}
          autoFocus={label.id === focusLabelId}
          onFocused={clearFocusLabel}
          onChange={(text) => updateLabel(label.id, { text })}
          onMove={(x, y) => updateLabel(label.id, { x, y })}
          onRemove={() => removeLabel(label.id)}
        />
      ))}
    </div>
  );
}

function TextLabelChip({
  label,
  fixed,
  autoFocus,
  onFocused,
  onChange,
  onMove,
  onRemove,
}: {
  label: TextLabel;
  fixed: boolean;
  autoFocus: boolean;
  onFocused: () => void;
  onChange: (text: string) => void;
  onMove: (x: number, y: number) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{
    startX: number;
    startY: number;
    labelX: number;
    labelY: number;
  } | null>(null);

  useEffect(() => {
    if (!autoFocus || !inputRef.current) return;
    inputRef.current.focus();
    inputRef.current.select();
    onFocused();
  }, [autoFocus, onFocused]);

  const onDragPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      labelX: label.x,
      labelY: label.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onDragPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    onMove(drag.current.labelX + dx, drag.current.labelY + dy);
  };

  const onDragPointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div
      data-text-label
      className="pointer-events-auto absolute z-50 flex max-w-[min(320px,calc(100vw-2rem))] items-start gap-0.5"
      style={
        fixed
          ? { position: "fixed", left: label.x, top: label.y }
          : { left: label.x, top: label.y }
      }
    >
      <button
        type="button"
        aria-label="Drag text label"
        title="Drag to move"
        className="mt-0.5 shrink-0 cursor-grab rounded bg-black/70 px-1 py-1 text-[10px] leading-none text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 active:cursor-grabbing"
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
      >
        ⠿
      </button>
      <input
        ref={inputRef}
        className="min-w-[120px] max-w-full rounded border border-zinc-700/80 bg-black/80 px-2 py-0.5 text-sm font-medium outline-none focus:border-sky-500/60"
        style={{ color: label.color }}
        value={label.text}
        placeholder="Type here…"
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        aria-label="Remove text label"
        className="mt-0.5 shrink-0 rounded bg-black/70 px-1.5 py-0.5 text-sm text-zinc-300 hover:bg-rose-900 hover:text-white"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRemove();
        }}
      >
        ×
      </button>
    </div>
  );
}
