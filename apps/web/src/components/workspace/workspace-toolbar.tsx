"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  LOCAL_STICKY_PALETTE,
  type GlobalStickyVariant,
  type LocalStickyColorId,
  type PenTarget,
  type StickySize,
  type WorkspaceScope,
} from "./types";
import { useWorkspace } from "./workspace-context";

function toolStatusLabel(
  tool: string,
  penTarget: PenTarget | null,
  pending: {
    scope?: string;
    variant?: string;
    size?: string;
    localColorId?: string;
  } | null,
): string {
  if (pending) {
    if (pending.scope === "global") {
      return `Placing ${pending.variant ?? "gold"} global sticky (${pending.size?.toUpperCase()})`;
    }
    const color = LOCAL_STICKY_PALETTE.find(
      (p) => p.id === pending.localColorId,
    );
    return `Placing ${color?.label ?? "page"} sticky (${pending.size?.toUpperCase()})`;
  }
  if (tool === "pen" && penTarget) {
    if (penTarget.layer === "global") {
      return penTarget.variant === "gold"
        ? "Gold pencil (global)"
        : "Silver pencil (global)";
    }
    const color = LOCAL_STICKY_PALETTE.find((p) => p.id === penTarget.colorId);
    return `${color?.label ?? "Colored"} pencil (this page)`;
  }
  if (tool === "eraser") return "Eraser";
  if (tool === "text") return "Text label (this page)";
  return "";
}

const compactPanBtn = "!min-w-[26px] !px-1 !py-0.5 !text-[10px]";
const compactSizeBtn = "!min-w-[26px] !px-1.5 !py-0.5 !text-[10px]";
const compactClearBtn =
  "!px-2 !py-0.5 !text-[10px] !leading-tight whitespace-nowrap";
const compactActionBtn = "!px-2 !py-0.5 !text-[10px] !leading-tight";

type ClearFlash =
  | "global-drawings"
  | "page-drawings"
  | "global-stickies"
  | "page-stickies"
  | null;

export function WorkspaceToolbar() {
  const {
    tool,
    penTarget,
    pickGlobalPen,
    pickPagePen,
    pickTool,
    resetTools,
    beginStickyPlacement,
    clearDrawings,
    clearAllNotes,
    pendingSticky,
    isDrawMode,
    page,
    nudgePan,
    resetPan,
  } = useWorkspace();

  const [pageColor, setPageColor] = useState<LocalStickyColorId>("red");
  const [globalStickyVariant, setGlobalStickyVariant] =
    useState<GlobalStickyVariant>("gold");
  const [globalStickySize, setGlobalStickySize] = useState<StickySize>("sm");
  const [pageStickySize, setPageStickySize] = useState<StickySize>("sm");
  const [clearedFlash, setClearedFlash] = useState<ClearFlash>(null);
  const clearFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startGlobalSticky = (size: StickySize) => {
    setGlobalStickySize(size);
    const variant = globalStickyVariant;
    const same =
      pendingSticky?.scope === "global" &&
      pendingSticky.variant === variant &&
      pendingSticky.size === size;
    if (same) {
      resetTools();
      return;
    }
    beginStickyPlacement({ scope: "global", variant, size });
  };

  const selectGlobalStickyVariant = (variant: GlobalStickyVariant) => {
    setGlobalStickyVariant(variant);
    const same =
      pendingSticky?.scope === "global" &&
      pendingSticky.variant === variant &&
      pendingSticky.size === globalStickySize;
    if (same) {
      resetTools();
      return;
    }
    beginStickyPlacement({
      scope: "global",
      variant,
      size: globalStickySize,
    });
  };

  const selectPageStickyColor = (colorId: LocalStickyColorId) => {
    setPageColor(colorId);
    const same =
      pendingSticky?.scope === "local" &&
      pendingSticky.localColorId === colorId &&
      pendingSticky.size === pageStickySize;
    if (same) {
      resetTools();
      return;
    }
    beginStickyPlacement({
      scope: "local",
      size: pageStickySize,
      localColorId: colorId,
    });
  };

  const startPageSticky = (size: StickySize) => {
    setPageStickySize(size);
    const same =
      pendingSticky?.scope === "local" &&
      pendingSticky.localColorId === pageColor &&
      pendingSticky.size === size;
    if (same) {
      resetTools();
      return;
    }
    beginStickyPlacement({
      scope: "local",
      size,
      localColorId: pageColor,
    });
  };

  const status = toolStatusLabel(tool, penTarget, pendingSticky);

  const globalGoldPenActive =
    tool === "pen" &&
    penTarget?.layer === "global" &&
    penTarget.variant === "gold";
  const globalSilverPenActive =
    tool === "pen" &&
    penTarget?.layer === "global" &&
    penTarget.variant === "silver";

  const isGlobalSizeActive = (size: StickySize) =>
    pendingSticky?.scope === "global"
      ? pendingSticky.size === size
      : globalStickySize === size;

  const isPageSizeActive = (size: StickySize) =>
    pendingSticky?.scope === "local"
      ? pendingSticky.size === size
      : pageStickySize === size;

  useEffect(() => {
    return () => {
      if (clearFlashTimer.current) clearTimeout(clearFlashTimer.current);
    };
  }, []);

  const handleClearDrawings = (scope: WorkspaceScope) => {
    clearDrawings(scope);
    setClearedFlash(scope === "global" ? "global-drawings" : "page-drawings");
    if (clearFlashTimer.current) clearTimeout(clearFlashTimer.current);
    clearFlashTimer.current = setTimeout(() => setClearedFlash(null), 1400);
  };

  const handleClearStickies = (scope: WorkspaceScope) => {
    clearAllNotes(scope);
    setClearedFlash(scope === "global" ? "global-stickies" : "page-stickies");
    if (clearFlashTimer.current) clearTimeout(clearFlashTimer.current);
    clearFlashTimer.current = setTimeout(() => setClearedFlash(null), 1400);
  };

  const clearBtnClass = (flash: ClearFlash) =>
    cn(
      compactClearBtn,
      "shrink-0 transition-all active:scale-95",
      clearedFlash === flash &&
        "!bg-emerald-600 !text-white ring-2 ring-emerald-400/70",
    );

  return (
    <div data-workspace-toolbar>
      <div className="space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-950/90 p-2 text-xs">
        {/* ── Global row (every tab) ── */}
        <div className="flex w-full flex-wrap items-center gap-2 border-b border-zinc-800/80 pb-2">
          <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-amber-300/80 sm:w-auto">
            Global · every tab
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant={
                tool === "select" && !pendingSticky ? "primary" : "secondary"
              }
              onClick={() => resetTools()}
            >
              Cursor
            </Button>
            <Button
              variant={tool === "eraser" ? "primary" : "secondary"}
              className={cn(tool === "eraser" && "ring-1 ring-rose-400/50")}
              onClick={() => pickTool("eraser")}
            >
              Eraser
            </Button>
          </div>

          <Button
            variant={tool === "text" ? "primary" : "secondary"}
            onClick={() => pickTool("text")}
          >
            Text
          </Button>

          <div className="flex items-center gap-0.5">
            <Button
              variant="secondary"
              className={compactPanBtn}
              onClick={() => nudgePan(-48, 0)}
              title="Pan left"
            >
              ←
            </Button>
            <Button
              variant="secondary"
              className={compactPanBtn}
              onClick={() => resetPan()}
              title="Center view"
            >
              ⊙
            </Button>
            <Button
              variant="secondary"
              className={compactPanBtn}
              onClick={() => nudgePan(48, 0)}
              title="Pan right"
            >
              →
            </Button>
          </div>

          <span className="hidden text-zinc-600 sm:inline">|</span>

          <span className="text-amber-300/90">Pencils</span>
          <Button
            variant={globalGoldPenActive ? "primary" : "secondary"}
            className={cn(globalGoldPenActive && "ring-1 ring-amber-400/60")}
            onClick={() => pickGlobalPen("gold")}
          >
            ✦ Gold
          </Button>
          <Button
            variant={globalSilverPenActive ? "primary" : "secondary"}
            className={cn(globalSilverPenActive && "ring-1 ring-slate-300/60")}
            onClick={() => pickGlobalPen("silver")}
          >
            ○ Silver
          </Button>

          <span className="hidden text-zinc-600 sm:inline">|</span>

          <div className="flex items-center gap-1.5">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => selectGlobalStickyVariant("gold")}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[10px] font-semibold transition",
                  globalStickyVariant === "gold"
                    ? "border-amber-400 bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/50"
                    : "border-amber-500/30 bg-amber-950/40 text-amber-300/80 hover:border-amber-400/50",
                )}
              >
                Gold sticky
              </button>
              <button
                type="button"
                onClick={() => selectGlobalStickyVariant("silver")}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[10px] font-semibold transition",
                  globalStickyVariant === "silver"
                    ? "border-slate-300 bg-slate-300/15 text-slate-100 ring-1 ring-slate-300/50"
                    : "border-slate-500/30 bg-slate-900/40 text-slate-300/80 hover:border-slate-400/50",
                )}
              >
                Silver sticky
              </button>
            </div>
            {(["sm", "md", "lg"] as const).map((size) => (
              <Button
                key={`global-${globalStickyVariant}-${size}`}
                variant={isGlobalSizeActive(size) ? "primary" : "secondary"}
                className={cn(
                  compactSizeBtn,
                  globalStickyVariant === "gold"
                    ? "!border-amber-500/40"
                    : "!border-slate-400/40",
                )}
                onClick={() => startGlobalSticky(size)}
              >
                {size.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {/* ── Clear row ── */}
        <div className="flex w-full flex-wrap items-center gap-1 border-b border-zinc-800/80 py-1.5">
          <Button
            variant={
              clearedFlash === "global-drawings" ? "primary" : "danger"
            }
            className={clearBtnClass("global-drawings")}
            onClick={() => handleClearDrawings("global")}
          >
            {clearedFlash === "global-drawings"
              ? "✓ Cleared"
              : "Clear global drawings"}
          </Button>
          <Button
            variant={clearedFlash === "page-drawings" ? "primary" : "danger"}
            className={clearBtnClass("page-drawings")}
            onClick={() => handleClearDrawings("local")}
          >
            {clearedFlash === "page-drawings"
              ? "✓ Cleared"
              : "Clear page drawings"}
          </Button>
          <Button
            variant={
              clearedFlash === "global-stickies" ? "primary" : "danger"
            }
            className={clearBtnClass("global-stickies")}
            onClick={() => handleClearStickies("global")}
          >
            {clearedFlash === "global-stickies"
              ? "✓ Cleared"
              : "Clear global stickies"}
          </Button>
          <Button
            variant={clearedFlash === "page-stickies" ? "primary" : "danger"}
            className={clearBtnClass("page-stickies")}
            onClick={() => handleClearStickies("local")}
          >
            {clearedFlash === "page-stickies"
              ? "✓ Cleared"
              : "Clear page stickies"}
          </Button>

          {isDrawMode ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-950/70 px-2 py-1">
              <Button
                variant="primary"
                className={cn(compactActionBtn, "!bg-emerald-600 !text-white")}
                onClick={() => resetTools()}
              >
                ← Cursor
              </Button>
              {status ? (
                <span className="text-[10px] font-medium text-emerald-100">
                  {status}
                </span>
              ) : null}
              <span className="text-[10px] text-emerald-300/70">
                Esc to exit
              </span>
            </div>
          ) : null}
        </div>

        {/* ── Page row (this tab only) ── */}
        <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1.5 pt-0.5">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            This page · {page}
          </span>

          <span className="shrink-0 text-zinc-600">|</span>

          <span className="shrink-0 text-zinc-400">Pencils</span>
          {LOCAL_STICKY_PALETTE.map((c) => {
            const active =
              tool === "pen" &&
              penTarget?.layer === "local" &&
              penTarget.colorId === c.id;
            return (
              <button
                key={`pen-${c.id}`}
                type="button"
                title={`${c.label} pencil (this page)`}
                aria-label={`${c.label} pencil`}
                onClick={() => pickPagePen(c.id)}
                className={cn(
                  "h-6 min-w-[24px] shrink-0 rounded border-2 px-0.5 text-[8px] font-bold transition",
                  active
                    ? "scale-105 border-white ring-1 ring-white/40"
                    : "border-zinc-600 hover:scale-105",
                )}
                style={{ backgroundColor: c.bg, color: c.penColor }}
              >
                {c.id === "red" ? "R" : c.id.slice(0, 1).toUpperCase()}
              </button>
            );
          })}

          <span className="shrink-0 text-zinc-600">|</span>

          <span className="shrink-0 text-zinc-400">Stickies</span>
          {LOCAL_STICKY_PALETTE.map((c) => (
            <button
              key={`sticky-${c.id}`}
              type="button"
              title={c.label}
              aria-label={c.label}
              onClick={() => selectPageStickyColor(c.id)}
              className={cn(
                "h-6 min-w-[24px] shrink-0 rounded border-2 px-0.5 text-[8px] font-bold transition",
                pageColor === c.id
                  ? "scale-105 border-white ring-1 ring-white/40"
                  : "border-zinc-600 hover:scale-105",
              )}
              style={{ backgroundColor: c.bg, color: "#1a1a1a" }}
            >
              {c.id === "red" ? "R" : c.id.slice(0, 1).toUpperCase()}
            </button>
          ))}
          {(["sm", "md", "lg"] as const).map((size) => (
            <Button
              key={`page-${size}`}
              variant={isPageSizeActive(size) ? "primary" : "secondary"}
              className={cn(compactSizeBtn, "shrink-0")}
              onClick={() => startPageSticky(size)}
            >
              {size.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
