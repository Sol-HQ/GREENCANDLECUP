"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { GLOBAL_STICKY_STYLES, LOCAL_STICKY_PALETTE } from "./types";
import { localContentPointFromClient } from "./local-content-point";
import { useWorkspace } from "./workspace-context";

type Props = {
  panRef: React.RefObject<HTMLElement | null>;
};

function placementLabel(
  pending: NonNullable<ReturnType<typeof useWorkspace>["pendingSticky"]>,
) {
  if (pending.scope === "global") {
    const v = pending.variant ?? "gold";
    return `${GLOBAL_STICKY_STYLES[v].label} global · ${pending.size.toUpperCase()}`;
  }
  const color = LOCAL_STICKY_PALETTE.find((p) => p.id === pending.localColorId);
  return `${color?.label ?? "Page"} sticky · ${pending.size.toUpperCase()}`;
}

export function StickyPlacementOverlay({ panRef }: Props) {
  const { pendingSticky, addNote, resetTools } = useWorkspace();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || !pendingSticky) return null;

  const isGlobal = pendingSticky.scope === "global";

  const tryPlace = (clientX: number, clientY: number) => {
    if (isGlobal) {
      addNote(pendingSticky, clientX, clientY);
      return;
    }
    const pan = panRef.current;
    if (!pan) return;
    const { x, y } = localContentPointFromClient(clientX, clientY, pan);
    addNote(pendingSticky, x, y);
  };

  const tint = isGlobal
    ? pendingSticky.variant === "silver"
      ? "bg-slate-400/10"
      : "bg-amber-400/10"
    : "bg-rose-400/8";

  return createPortal(
    <div
      className={`fixed inset-0 z-[195] select-none ${tint}`}
      style={{ pointerEvents: "auto", userSelect: "none" }}
      onPointerDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("[data-workspace-toolbar]")) return;
        if (target.closest("[data-sticky-placement-hint]")) return;
        e.preventDefault();
        e.stopPropagation();
        tryPlace(e.clientX, e.clientY);
      }}
    >
      <div
        data-sticky-placement-hint
        className="pointer-events-auto fixed bottom-6 left-1/2 z-[196] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-emerald-500/50 bg-zinc-950/95 px-4 py-3 shadow-2xl"
      >
        <span className="text-sm text-emerald-100">
          Click to place <strong>{placementLabel(pendingSticky)}</strong>
          {isGlobal ? " (every page)" : " — click on page content below"}
        </span>
        <Button
          variant="primary"
          className="!bg-emerald-600 !text-white"
          onClick={() => resetTools()}
        >
          Cancel
        </Button>
      </div>
    </div>,
    document.body,
  );
}
