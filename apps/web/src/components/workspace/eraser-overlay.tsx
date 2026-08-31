"use client";

import { useEffect } from "react";
import { localContentPointFromClient } from "./local-content-point";
import { useWorkspace } from "./workspace-context";

const ERASE_RADIUS = 28;

type Props = {
  panRef: React.RefObject<HTMLElement | null>;
};

function isWorkspaceChromeTarget(target: HTMLElement) {
  return Boolean(
    target.closest("[data-workspace-toolbar]") ||
      target.closest("[data-text-placement-hint]") ||
      target.closest("[data-sticky-placement-hint]") ||
      target.closest("[data-text-label]") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("button"),
  );
}

export function EraserOverlay({ panRef }: Props) {
  const { tool, eraseStrokesAt } = useWorkspace();

  useEffect(() => {
    if (tool !== "eraser") return;

    const eraseAtClient = (clientX: number, clientY: number) => {
      eraseStrokesAt(clientX, clientY, ERASE_RADIUS, "global");
      const pan = panRef.current;
      if (!pan) return;
      const local = localContentPointFromClient(clientX, clientY, pan);
      eraseStrokesAt(local.x, local.y, ERASE_RADIUS, "local");
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (isWorkspaceChromeTarget(target)) return;
      e.preventDefault();
      e.stopPropagation();
      eraseAtClient(e.clientX, e.clientY);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons !== 1) return;
      const target = e.target as HTMLElement;
      if (isWorkspaceChromeTarget(target)) return;
      e.preventDefault();
      eraseAtClient(e.clientX, e.clientY);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
    };
  }, [tool, panRef, eraseStrokesAt]);

  useEffect(() => {
    if (tool !== "eraser") return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = "crosshair";
    return () => {
      document.body.style.cursor = prev;
    };
  }, [tool]);

  return null;
}
