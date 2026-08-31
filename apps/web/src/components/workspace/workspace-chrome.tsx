"use client";

import { useRef, type ReactNode } from "react";
import { useWorkspace } from "./workspace-context";
import { WorkspaceToolbar } from "./workspace-toolbar";
import { WorkspaceAnnotationLayer } from "./workspace-annotation-layer";
import { StickyNotesLayer } from "./sticky-notes-layer";
import { StickyPlacementOverlay } from "./sticky-placement-overlay";
import { TextPlacementOverlay } from "./text-placement-overlay";
import { EraserOverlay } from "./eraser-overlay";

export function WorkspaceChrome({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<HTMLDivElement>(null);
  const {
    globalStrokes,
    globalLabels,
    globalNotes,
    localStrokes,
    localLabels,
    localNotes,
    page,
    viewPan,
  } = useWorkspace();

  const pageLocalStrokes = localStrokes.filter((s) => s.page === page);
  const pageLocalLabels = localLabels.filter((l) => l.page === page);
  const pageLocalNotes = localNotes.filter((n) => n.page === page);

  const panStyle = {
    transform: `translate(${viewPan.x}px, ${viewPan.y}px)`,
  };

  return (
    <>
      <div className="relative z-[200] mb-4">
        <WorkspaceToolbar />
      </div>

      <div ref={mainRef} className="relative min-h-[200px] overflow-visible">
        <div
          ref={panRef}
          data-workspace-pan
          className="relative"
          style={panStyle}
        >
          {children}

          <WorkspaceAnnotationLayer
            mode="local"
            panRef={panRef}
            strokes={pageLocalStrokes}
            labels={pageLocalLabels}
          />
          <StickyNotesLayer mode="local" notes={pageLocalNotes} />
        </div>
      </div>

      <div className="pointer-events-none fixed inset-0 z-[45]" style={panStyle}>
        <WorkspaceAnnotationLayer
          mode="global"
          strokes={globalStrokes}
          labels={globalLabels}
        />
        <StickyNotesLayer mode="global" notes={globalNotes} />
      </div>
      <StickyPlacementOverlay panRef={panRef} />
      <TextPlacementOverlay panRef={panRef} />
      <EraserOverlay panRef={panRef} />
    </>
  );
}
