"use client";

import { Button } from "@/components/ui";
import { STICKY_COLORS } from "./types";
import { useWorkspace } from "./workspace-context";

type Props = {
  boundsRef: React.RefObject<HTMLElement | null>;
};

export function StickyPlacementOverlay({ boundsRef }: Props) {
  const { pendingStickySize, addNote, setPendingStickySize } = useWorkspace();
  if (!pendingStickySize) return null;

  return (
    <div className="absolute inset-0 z-50">
      <div className="pointer-events-none absolute left-1/2 top-2 z-[51] flex -translate-x-1/2 items-center gap-2">
        <span className="rounded-lg bg-amber-500/30 px-3 py-1 text-xs text-amber-100">
          Click below to place {pendingStickySize.toUpperCase()} sticky · Esc to cancel
        </span>
        <Button
          variant="secondary"
          className="pointer-events-auto !py-1 !text-xs"
          onClick={() => setPendingStickySize(null)}
        >
          Cancel
        </Button>
      </div>
      <div
        className="absolute inset-0 cursor-copy bg-amber-500/5"
        onPointerDown={(e) => {
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
      />
    </div>
  );
}
