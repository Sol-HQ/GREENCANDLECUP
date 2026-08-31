"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type {
  DrawTool,
  GlobalPenVariant,
  GlobalStickyVariant,
  LocalStickyColorId,
  PenTarget,
  PendingSticky,
  StickyNote,
  StickySize,
  Stroke,
  TextLabel,
  WorkspaceScope,
} from "./types";
import {
  GLOBAL_STICKY_STYLES,
  LOCAL_STICKY_PALETTE,
  STICKY_DIMENSIONS,
  penColorForTarget,
} from "./types";

const GLOBAL_STROKES_KEY = "gcc-workspace-global-strokes";
const GLOBAL_NOTES_KEY = "gcc-workspace-global-notes";
const GLOBAL_LABELS_KEY = "gcc-workspace-global-labels";
const LOCAL_STROKES_KEY = "gcc-workspace-local-strokes";
const LOCAL_NOTES_KEY = "gcc-workspace-local-notes";
const LOCAL_LABELS_KEY = "gcc-workspace-local-labels";
const LEGACY_STROKES_KEY = "gcc-workspace-strokes";
const LEGACY_NOTES_KEY = "gcc-workspace-notes";
const LEGACY_LABELS_KEY = "gcc-workspace-labels";
const VIEW_PAN_KEY = "gcc-workspace-view-pan";

type WorkspaceContextValue = {
  page: string;
  tool: DrawTool;
  penTarget: PenTarget | null;
  pickGlobalPen: (variant: GlobalPenVariant) => void;
  pickPagePen: (colorId: LocalStickyColorId) => void;
  setTool: (t: DrawTool) => void;
  pickTool: (t: DrawTool) => void;
  resetTools: () => void;
  color: string;
  setColor: (c: string) => void;
  strokes: Stroke[];
  labels: TextLabel[];
  notes: StickyNote[];
  globalStrokes: Stroke[];
  globalLabels: TextLabel[];
  globalNotes: StickyNote[];
  localStrokes: Stroke[];
  localLabels: TextLabel[];
  localNotes: StickyNote[];
  addStroke: (s: Stroke) => void;
  eraseAt: (
    x: number,
    y: number,
    radius: number,
    coord: "viewport" | "local",
  ) => void;
  eraseStrokesAt: (
    x: number,
    y: number,
    radius: number,
    scope: "global" | "local",
  ) => void;
  clearDrawings: (scope: WorkspaceScope) => void;
  clearAllNotes: (scope: WorkspaceScope, variant?: import("./types").GlobalStickyVariant) => void;
  viewPan: { x: number; y: number };
  nudgePan: (dx: number, dy: number) => void;
  resetPan: () => void;
  addLabel: (
    label: Omit<TextLabel, "id">,
    options?: { keepTool?: boolean },
  ) => string;
  updateLabel: (id: string, patch: Partial<TextLabel>) => void;
  removeLabel: (id: string) => void;
  focusLabelId: string | null;
  clearFocusLabel: () => void;
  addNote: (pending: PendingSticky, x: number, y: number) => void;
  updateNote: (id: string, patch: Partial<StickyNote>) => void;
  removeNote: (id: string) => void;
  pendingSticky: PendingSticky | null;
  setPendingSticky: (pending: PendingSticky | null) => void;
  beginStickyPlacement: (pending: PendingSticky) => void;
  isDrawMode: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function migrateLegacy<T extends { scope?: WorkspaceScope; page?: string }>(
  legacy: T[],
  page: string,
): { global: T[]; local: T[] } {
  const global: T[] = [];
  const local: T[] = [];
  for (const item of legacy) {
    if (item.scope === "global") global.push(item);
    else local.push({ ...item, scope: "local", page: item.page ?? page });
  }
  return { global, local };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const page = pathname || "/";

  const [tool, setTool] = useState<DrawTool>("select");
  const [penTarget, setPenTarget] = useState<PenTarget | null>(null);
  const [color, setColor] = useState<string>("#fbbf24");
  const [globalStrokes, setGlobalStrokes] = useState<Stroke[]>([]);
  const [globalLabels, setGlobalLabels] = useState<TextLabel[]>([]);
  const [globalNotes, setGlobalNotes] = useState<StickyNote[]>([]);
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);
  const [localLabels, setLocalLabels] = useState<TextLabel[]>([]);
  const [localNotes, setLocalNotes] = useState<StickyNote[]>([]);
  const [pendingSticky, setPendingSticky] = useState<PendingSticky | null>(
    null,
  );
  const [focusLabelId, setFocusLabelId] = useState<string | null>(null);
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 });
  const [hydrated, setHydrated] = useState(false);

  const resetTools = useCallback(() => {
    setTool("select");
    setPendingSticky(null);
    setFocusLabelId(null);
  }, []);

  const clearFocusLabel = useCallback(() => {
    setFocusLabelId(null);
  }, []);

  useEffect(() => {
    const legacyStrokes = loadJson<Stroke[]>(LEGACY_STROKES_KEY, []);
    const legacyNotes = loadJson<StickyNote[]>(LEGACY_NOTES_KEY, []);
    const legacyLabels = loadJson<TextLabel[]>(LEGACY_LABELS_KEY, []);

    if (legacyStrokes.length || legacyNotes.length || legacyLabels.length) {
      const initialPage = pathname || "/";
      const ms = migrateLegacy(legacyStrokes, initialPage);
      const mn = migrateLegacy(legacyNotes, initialPage);
      const ml = migrateLegacy(legacyLabels, initialPage);
      setGlobalStrokes(ms.global);
      setLocalStrokes(ms.local);
      setGlobalNotes(mn.global);
      setLocalNotes(mn.local);
      setGlobalLabels(ml.global);
      setLocalLabels(ml.local);
      localStorage.removeItem(LEGACY_STROKES_KEY);
      localStorage.removeItem(LEGACY_NOTES_KEY);
      localStorage.removeItem(LEGACY_LABELS_KEY);
    } else {
      setGlobalStrokes(loadJson(GLOBAL_STROKES_KEY, []));
      setGlobalNotes(loadJson(GLOBAL_NOTES_KEY, []));
      setGlobalLabels(loadJson(GLOBAL_LABELS_KEY, []));
      setLocalStrokes(loadJson(LOCAL_STROKES_KEY, []));
      setLocalNotes(loadJson(LOCAL_NOTES_KEY, []));
      setLocalLabels(loadJson(LOCAL_LABELS_KEY, []));
    }
    try {
      const rawPan = localStorage.getItem(VIEW_PAN_KEY);
      if (rawPan) setViewPan(JSON.parse(rawPan) as { x: number; y: number });
    } catch {
      // ignore
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from localStorage
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resetTools();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetTools]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(GLOBAL_STROKES_KEY, JSON.stringify(globalStrokes));
    localStorage.setItem(GLOBAL_NOTES_KEY, JSON.stringify(globalNotes));
    localStorage.setItem(GLOBAL_LABELS_KEY, JSON.stringify(globalLabels));
    localStorage.setItem(LOCAL_STROKES_KEY, JSON.stringify(localStrokes));
    localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(localNotes));
    localStorage.setItem(LOCAL_LABELS_KEY, JSON.stringify(localLabels));
    localStorage.setItem(VIEW_PAN_KEY, JSON.stringify(viewPan));
  }, [
    hydrated,
    globalStrokes,
    globalNotes,
    globalLabels,
    localStrokes,
    localNotes,
    localLabels,
    viewPan,
  ]);

  const nudgePan = useCallback((dx: number, dy: number) => {
    setViewPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const resetPan = useCallback(() => {
    setViewPan({ x: 0, y: 0 });
  }, []);

  const pickGlobalPen = useCallback(
    (variant: GlobalPenVariant) => {
      const same =
        tool === "pen" &&
        penTarget?.layer === "global" &&
        penTarget.variant === variant;
      if (same) {
        setTool("select");
        setPendingSticky(null);
        return;
      }
      const target: PenTarget = { layer: "global", variant };
      setPenTarget(target);
      setColor(penColorForTarget(target));
      setTool("pen");
      setPendingSticky(null);
    },
    [tool, penTarget],
  );

  const pickPagePen = useCallback(
    (colorId: LocalStickyColorId) => {
      const same =
        tool === "pen" &&
        penTarget?.layer === "local" &&
        penTarget.colorId === colorId;
      if (same) {
        setTool("select");
        setPendingSticky(null);
        return;
      }
      const target: PenTarget = { layer: "local", colorId };
      setPenTarget(target);
      setColor(penColorForTarget(target));
      setTool("pen");
      setPendingSticky(null);
    },
    [tool, penTarget],
  );

  const pickTool = useCallback(
    (next: DrawTool) => {
      if (tool === next) {
        if (next === "select" || next === "eraser" || next === "text") {
          return;
        }
        setTool("select");
        setPendingSticky(null);
        return;
      }
      if (next === "text") {
        setPendingSticky(null);
        setTool(next);
        return;
      }
      setTool(next);
      setPendingSticky(null);
    },
    [tool],
  );

  const beginStickyPlacement = useCallback((pending: PendingSticky) => {
    setPendingSticky(pending);
    setTool("select");
  }, []);

  const addStroke = useCallback(
    (stroke: Stroke) => {
      if (stroke.scope === "global") {
        setGlobalStrokes((prev) => [...prev, stroke]);
      } else {
        setLocalStrokes((prev) => [...prev, { ...stroke, page }]);
      }
    },
    [page],
  );

  const noteHit = useCallback(
    (n: StickyNote, x: number, y: number, radius: number) => {
      const dim = STICKY_DIMENSIONS[n.size];
      const cx = n.x + dim.w / 2;
      const cy = n.y + dim.h / 2;
      return Math.hypot(cx - x, cy - y) <= radius + Math.max(dim.w, dim.h) / 2;
    },
    [],
  );

  const strokeNearPoint = useCallback(
    (stroke: Stroke, x: number, y: number, radius: number) =>
      stroke.points.some((p) => Math.hypot(p.x - x, p.y - y) <= radius),
    [],
  );

  const eraseStrokesAt = useCallback(
    (x: number, y: number, radius: number, scope: "global" | "local") => {
      if (scope === "global") {
        setGlobalStrokes((prev) =>
          prev.filter((stroke) => !strokeNearPoint(stroke, x, y, radius)),
        );
        return;
      }
      setLocalStrokes((prev) =>
        prev.filter(
          (stroke) =>
            stroke.page !== page || !strokeNearPoint(stroke, x, y, radius),
        ),
      );
    },
    [page, strokeNearPoint],
  );

  const eraseAt = useCallback(
    (x: number, y: number, radius: number, coord: "viewport" | "local") => {
      const filterStrokes = (prev: Stroke[]) =>
        prev.filter((stroke) =>
          stroke.points.every((p) => Math.hypot(p.x - x, p.y - y) > radius),
        );

      setGlobalStrokes((prev) => filterStrokes(prev));
      setLocalStrokes((prev) => filterStrokes(prev));

      setGlobalLabels((prev) =>
        prev.filter((l) => Math.hypot(l.x - x, l.y - y) > radius + 20),
      );
      setLocalLabels((prev) =>
        prev.filter((l) => Math.hypot(l.x - x, l.y - y) > radius + 20),
      );

      setGlobalNotes((prev) => prev.filter((n) => !noteHit(n, x, y, radius)));
      if (coord === "local") {
        setLocalNotes((prev) =>
          prev.filter((n) => n.page !== page || !noteHit(n, x, y, radius)),
        );
      } else {
        setLocalNotes((prev) => prev.filter((n) => !noteHit(n, x, y, radius)));
      }
    },
    [noteHit, page],
  );

  const clearDrawings = useCallback(
    (scope: WorkspaceScope) => {
      if (scope === "global") {
        setGlobalStrokes([]);
        setLocalStrokes((prev) => prev.filter((s) => s.page !== page));
      } else {
        setLocalStrokes((prev) => prev.filter((s) => s.page !== page));
      }
    },
    [page],
  );

  const clearAllNotes = useCallback(
    (scope: WorkspaceScope, variant?: GlobalStickyVariant) => {
      if (scope === "global") {
        if (variant) {
          setGlobalNotes((prev) =>
            prev.filter((n) => (n.variant ?? "gold") !== variant),
          );
        } else {
          setGlobalNotes([]);
        }
      }
      if (scope === "local") {
        setLocalNotes((prev) => prev.filter((n) => n.page !== page));
      }
      setPendingSticky(null);
    },
    [page],
  );

  const addLabel = useCallback(
    (
      label: Omit<TextLabel, "id">,
      options?: { keepTool?: boolean },
    ): string => {
      const id = crypto.randomUUID();
      const entry = {
        ...label,
        id,
        scope: "local" as const,
        page,
      };
      setLocalLabels((prev) => [...prev, entry]);
      setFocusLabelId(id);
      if (!options?.keepTool) {
        setTool("select");
      }
      return id;
    },
    [page],
  );

  const updateLabel = useCallback((id: string, patch: Partial<TextLabel>) => {
    const apply = (prev: TextLabel[]) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l));
    setGlobalLabels(apply);
    setLocalLabels(apply);
  }, []);

  const removeLabel = useCallback((id: string) => {
    setGlobalLabels((prev) => prev.filter((l) => l.id !== id));
    setLocalLabels((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addNote = useCallback(
    (pending: PendingSticky, x: number, y: number) => {
      const { size, scope, variant, localColorId } = pending;
      let note: StickyNote;

      if (scope === "global") {
        const v = variant ?? "gold";
        const style = GLOBAL_STICKY_STYLES[v];
        note = {
          id: crypto.randomUUID(),
          x,
          y,
          size,
          color: style.stickyBg,
          text: "",
          scope: "global",
          variant: v,
        };
        setGlobalNotes((prev) => [...prev, note]);
      } else {
        const palette =
          LOCAL_STICKY_PALETTE.find((p) => p.id === localColorId) ??
          LOCAL_STICKY_PALETTE[0];
        note = {
          id: crypto.randomUUID(),
          x,
          y,
          size,
          color: palette.bg,
          text: "",
          scope: "local",
          page,
          localColorId: localColorId ?? palette.id,
        };
        setLocalNotes((prev) => [...prev, note]);
      }
      setPendingSticky(null);
      setTool("select");
    },
    [page],
  );

  const updateNote = useCallback((id: string, patch: Partial<StickyNote>) => {
    const apply = (prev: StickyNote[]) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch } : n));
    setGlobalNotes(apply);
    setLocalNotes(apply);
  }, []);

  const removeNote = useCallback((id: string) => {
    setGlobalNotes((prev) => prev.filter((n) => n.id !== id));
    setLocalNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const strokes = useMemo(
    () => [
      ...globalStrokes,
      ...localStrokes.filter((s) => s.page === page),
    ],
    [globalStrokes, localStrokes, page],
  );

  const labels = useMemo(
    () => [
      ...globalLabels,
      ...localLabels.filter((l) => l.page === page),
    ],
    [globalLabels, localLabels, page],
  );

  const notes = useMemo(
    () => [
      ...globalNotes,
      ...localNotes.filter((n) => n.page === page),
    ],
    [globalNotes, localNotes, page],
  );

  const isDrawMode = tool !== "select" || pendingSticky !== null;

  const value = useMemo(
    () => ({
      page,
      tool,
      penTarget,
      pickGlobalPen,
      pickPagePen,
      setTool,
      pickTool,
      resetTools,
      color,
      setColor,
      strokes,
      labels,
      notes,
      globalStrokes,
      globalLabels,
      globalNotes,
      localStrokes,
      localLabels,
      localNotes,
      addStroke,
      eraseAt,
      eraseStrokesAt,
      clearDrawings,
      clearAllNotes,
      addLabel,
      updateLabel,
      removeLabel,
      focusLabelId,
      clearFocusLabel,
      addNote,
      updateNote,
      removeNote,
      pendingSticky,
      setPendingSticky,
      beginStickyPlacement,
      isDrawMode,
      viewPan,
      nudgePan,
      resetPan,
    }),
    [
      page,
      tool,
      penTarget,
      pickGlobalPen,
      pickPagePen,
      pickTool,
      resetTools,
      color,
      strokes,
      labels,
      notes,
      globalStrokes,
      globalLabels,
      globalNotes,
      localStrokes,
      localLabels,
      localNotes,
      addStroke,
      eraseAt,
      eraseStrokesAt,
      clearDrawings,
      clearAllNotes,
      addLabel,
      updateLabel,
      removeLabel,
      focusLabelId,
      clearFocusLabel,
      addNote,
      updateNote,
      removeNote,
      pendingSticky,
      beginStickyPlacement,
      isDrawMode,
      viewPan,
      nudgePan,
      resetPan,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
