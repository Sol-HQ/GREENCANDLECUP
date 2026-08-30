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

  const pickTool = (t: typeof tool) => {
    setTool(t);
    setPendingStickySize(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/90 p-2 text-xs">
      <span className="font-medium text-zinc-400">Workspace</span>
      <Button
        variant={tool === "select" ? "primary" : "secondary"}
        onClick={() => pickTool("select")}
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
      <span className="text-zinc-500">Sticky notes:</span>
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
      {pendingStickySize ? (
        <span className="rounded bg-amber-500/20 px-2 py-1 text-amber-200">
          Click anywhere below to place {pendingStickySize.toUpperCase()} note
        </span>
      ) : (
        <span className="text-zinc-600">
          (pick a size, then click the page)
        </span>
      )}
      <Button variant="danger" onClick={() => clearDrawings()}>
        Clear draw + text
      </Button>
      <span className="text-zinc-500">
        Trade page only · saves in this browser
      </span>
    </div>
  );
}
