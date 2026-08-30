"use client";

import { useEffect, useRef } from "react";
import { useWorkspace } from "./workspace-context";

type Props = {
  boundsRef: React.RefObject<HTMLElement | null>;
};

export function WorkspaceAnnotationLayer({ boundsRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    tool,
    color,
    strokes,
    labels,
    addStroke,
    eraseAt,
    addLabel,
    updateLabel,
    removeLabel,
  } = useWorkspace();
  const drawing = useRef<{
    id: string;
    points: Array<{ x: number; y: number }>;
  } | null>(null);

  const isActive = tool === "pen" || tool === "eraser" || tool === "text";

  useEffect(() => {
    const canvas = canvasRef.current;
    const bounds = boundsRef.current;
    if (!canvas || !bounds) return;

    const resize = () => {
      const w = bounds.clientWidth;
      const h = bounds.clientHeight;
      if (w === 0 || h === 0) return;
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
    const ro = new ResizeObserver(resize);
    ro.observe(bounds);
    return () => ro.disconnect();
  }, [strokes, boundsRef]);

  const localPoint = (e: React.PointerEvent) => {
    const bounds = boundsRef.current;
    if (!bounds) return { x: 0, y: 0 };
    const rect = bounds.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isActive) return;
    e.stopPropagation();
    const p = localPoint(e);
    if (tool === "text") {
      addLabel({ x: p.x, y: p.y, text: "Label", color });
      return;
    }
    if (tool === "eraser") {
      eraseAt(p.x, p.y, 24);
      return;
    }
    drawing.current = { id: crypto.randomUUID(), points: [p] };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isActive) return;
    const p = localPoint(e);
    if (tool === "eraser" && e.buttons === 1) {
      eraseAt(p.x, p.y, 24);
      return;
    }
    if (!drawing.current || tool !== "pen") return;
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
    if (!drawing.current || tool !== "pen") return;
    addStroke({
      id: drawing.current.id,
      points: drawing.current.points,
      color,
      width: 3,
    });
    drawing.current = null;
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {isActive ? (
        <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded-lg bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200">
          {tool === "pen" && "Drawing — press Esc or Done to exit"}
          {tool === "eraser" && "Eraser — drag over marks or stickies"}
          {tool === "text" && "Click to place text"}
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${isActive ? "pointer-events-auto cursor-crosshair" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      {labels.map((label) => (
        <TextLabelChip
          key={label.id}
          label={label}
          onChange={(text) => updateLabel(label.id, { text })}
          onRemove={() => removeLabel(label.id)}
        />
      ))}
    </div>
  );
}

function TextLabelChip({
  label,
  onChange,
  onRemove,
}: {
  label: { id: string; x: number; y: number; text: string; color: string };
  onChange: (text: string) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="pointer-events-auto absolute z-30 flex items-center gap-1"
      style={{ left: label.x, top: label.y }}
    >
      <input
        className="rounded border border-zinc-700/80 bg-black/70 px-2 py-0.5 text-sm font-medium outline-none"
        style={{ color: label.color }}
        value={label.text}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        className="rounded bg-black/60 px-1.5 py-0.5 text-sm text-zinc-300 hover:bg-rose-900 hover:text-white"
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
