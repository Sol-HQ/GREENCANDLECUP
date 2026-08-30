"use client";

import type { ReactNode } from "react";
import { STICKY_COLORS } from "./types";
import { useWorkspace } from "./workspace-context";

export function WorkspaceSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pendingStickySize, addNote } = useWorkspace();

  return (
    <div
      className={`relative ${className} ${pendingStickySize ? "cursor-copy" : ""}`}
      onClick={(e) => {
        if (!pendingStickySize) return;
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        addNote(
          pendingStickySize,
          STICKY_COLORS[0]!,
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
      }}
    >
      {children}
    </div>
  );
}
