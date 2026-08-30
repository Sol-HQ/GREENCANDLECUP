"use client";

import { Button } from "@/components/ui";
import { DRAW_COLORS } from "./types";
import { useWorkspace } from "./workspace-context";

export function WorkspaceToolbar() {
  const {
    tool,
    setTool,
    color,
    setColor,
    clearDrawings,
    pendingStickySize,
    setPendingStickySize,
  } = useWorkspace();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/90 p-2 text-xs">
      <span className="text-zinc-500">Workspace</span>
      <Button
        variant={tool === "select" ? "primary" : "secondary"}
        onClick={() => {
          setTool("select");
          setPendingStickySize(null);
        }}
      >
        Select
      </Button>
      <Button
        variant={tool === "pen" ? "primary" : "secondary"}
        onClick={() => {
          setTool("pen");
          setPendingStickySize(null);
        }}
      >
        Pencil
      </Button>
      <Button
        variant={tool === "eraser" ? "primary" : "secondary"}
        onClick={() => {
          setTool("eraser");
          setPendingStickySize(null);
        }}
      >
        Eraser
      </Button>
      <div className="flex gap-1">
        {DRAW_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-white" : "border-zinc-700"}`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <span className="text-zinc-600">|</span>
      {(["sm", "md", "lg"] as const).map((size) => (
        <Button
          key={size}
          variant={pendingStickySize === size ? "primary" : "secondary"}
          onClick={() => {
            setPendingStickySize(size);
            setTool("select");
          }}
        >
          Place {size.toUpperCase()} note
        </Button>
      ))}
      {pendingStickySize ? (
        <span className="text-amber-400">
          Click anywhere on the page to drop a {pendingStickySize} sticky
        </span>
      ) : null}
      <Button variant="danger" onClick={() => clearDrawings()}>
        Clear drawings
      </Button>
      <span className="text-zinc-500">
        Drawings &amp; notes save in this browser (localStorage)
      </span>
    </div>
  );
}
