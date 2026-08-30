"use client";

import { STICKY_COLORS } from "./types";
import { useWorkspace } from "./workspace-context";

type Props = {
  boundsRef: React.RefObject<HTMLElement | null>;
};

/** Transparent overlay so sticky placement isn't swallowed by chart/buttons. */
export function StickyPlacementOverlay({ boundsRef }: Props) {
  const { pendingStickySize, addNote } = useWorkspace();
  if (!pendingStickySize) return null;

  return (
    <div
      className="absolute inset-0 z-40 cursor-copy bg-black/5"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const bounds = boundsRef.current;
        if (!bounds) return;
        const rect = bounds.getBoundingClientRect();
        addNote(
          pendingStickySize,
          STICKY_COLORS[0]!,
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
      }}
    >
      <p className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-lg bg-amber-500/20 px-3 py-1 text-xs text-amber-200">
        Tap anywhere to place your {pendingStickySize.toUpperCase()} sticky note
      </p>
    </div>
  );
}
