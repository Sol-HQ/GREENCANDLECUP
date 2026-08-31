"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { localContentPointFromClient } from "./local-content-point";
import { useWorkspace } from "./workspace-context";

const DEFAULT_TEXT_COLOR = "#e4e4e7";

type Props = {
  panRef: React.RefObject<HTMLElement | null>;
};

export function TextPlacementOverlay({ panRef }: Props) {
  const { tool, addLabel, resetTools } = useWorkspace();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || tool !== "text") return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-workspace-toolbar]")) return;
      if (target.closest("[data-text-placement-hint]")) return;
      if (target.closest("[data-text-label]")) return;

      const pan = panRef.current;
      if (!pan) return;

      e.preventDefault();
      e.stopPropagation();

      const { x, y } = localContentPointFromClient(e.clientX, e.clientY, pan);
      addLabel(
        {
          x,
          y,
          text: "",
          color: DEFAULT_TEXT_COLOR,
          scope: "local",
        },
        { keepTool: true },
      );
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [mounted, tool, panRef, addLabel]);

  useEffect(() => {
    if (tool !== "text") return;
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = prev;
    };
  }, [tool]);

  if (!mounted || tool !== "text") return null;

  return createPortal(
    <div
      data-text-placement-hint
      className="pointer-events-auto fixed bottom-6 left-1/2 z-[196] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-sky-500/50 bg-zinc-950/95 px-4 py-3 shadow-2xl"
    >
      <span className="text-sm text-sky-100">
        Click anywhere to place a <strong>page text box</strong>. Use{" "}
        <strong>⠿</strong> to drag, or click Done when finished.
      </span>
      <Button
        variant="primary"
        className="!bg-sky-600 !text-white"
        onClick={() => resetTools()}
      >
        Done
      </Button>
    </div>,
    document.body,
  );
}
