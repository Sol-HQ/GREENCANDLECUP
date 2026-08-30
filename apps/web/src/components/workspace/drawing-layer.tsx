"use client";

import { useEffect, useRef } from "react";
import { useWorkspace } from "./workspace-context";

type Props = {
  /** CSS selector for the region to map pointer coords (chart card). */
  boundsRef: React.RefObject<HTMLElement | null>;
};

export function DrawingLayer({ boundsRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { tool, color, strokes, addStroke, eraseAt } = useWorkspace();
  const drawing = useRef<{ id: string; points: Array<{ x: number; y: number }> } | null>(
    null,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const bounds = boundsRef.current;
    if (!canvas || !bounds) return;

    const resize = () => {
      canvas.width = bounds.clientWidth;
      canvas.height = bounds.clientHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    if (tool === "select") return;
    const p = localPoint(e);
    if (tool === "eraser") {
      eraseAt(p.x, p.y, 14);
      return;
    }
    drawing.current = { id: crypto.randomUUID(), points: [p] };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = localPoint(e);
    if (tool === "eraser" && e.buttons === 1) {
      eraseAt(p.x, p.y, 14);
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

  const interactive = tool === "pen" || tool === "eraser";

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 z-20 ${interactive ? "cursor-crosshair" : "pointer-events-none"}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  );
}
