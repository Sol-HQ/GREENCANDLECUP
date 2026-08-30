"use client";

import { Button } from "@/components/ui";
import { DRAW_COLORS } from "./types";
import { useWorkspace } from "./workspace-context";

export function WorkspaceToolbar() {
  const {
    tool,
    setTool,
    resetTools,
    color,
    setColor,
    clearDrawings,
    clearAllNotes,
    pendingStickySize,
    setPendingStickySize,
    isDrawMode,
    notes,
  } = useWorkspace();

  const pickTool = (t: typeof tool) => {
    setTool(t);
    setPendingStickySize(null);
  };

  return (
    <div className="space-y-2">
      {isDrawMode ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
          <span>
            Tool active — toolbar still works. Press{" "}
            <kbd className="rounded bg-black/40 px-1">Esc</kbd> or click Done.
          </span>
          <Button variant="primary" onClick={() => resetTools()}>
            Done / Exit tool
          </Button>
          {pendingStickySize ? (
            <Button variant="secondary" onClick={() => setPendingStickySize(null)}>
              Cancel sticky
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/90 p-2 text-xs">
        <span className="font-medium text-zinc-400">Workspace</span>
        <Button
          variant={tool === "select" && !pendingStickySize ? "primary" : "secondary"}
          onClick={() => resetTools()}
        >
          Select
        </Button>
        <Button
          variant={tool === "pen" ? "primary" : "secondary"}
          onClick={() => pickTool("pen")}
        >
          Pencil
        </Button>
        <Button
          variant={tool === "eraser" ? "primary" : "secondary"}
          onClick={() => pickTool("eraser")}
        >
          Eraser
        </Button>
        <Button
          variant={tool === "text" ? "primary" : "secondary"}
          onClick={() => pickTool("text")}
        >
          Text
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
        <span className="text-zinc-500">Sticky:</span>
        {(["sm", "md", "lg"] as const).map((size) => (
          <Button
            key={size}
            variant={pendingStickySize === size ? "primary" : "secondary"}
            onClick={() => {
              setPendingStickySize(size);
              setTool("select");
            }}
          >
            + {size.toUpperCase()}
          </Button>
        ))}
        <Button variant="danger" onClick={() => clearDrawings()}>
          Clear drawings
        </Button>
        {notes.length > 0 ? (
          <Button variant="danger" onClick={() => clearAllNotes()}>
            Clear all stickies ({notes.length})
          </Button>
        ) : null}
      </div>
    </div>
  );
}
