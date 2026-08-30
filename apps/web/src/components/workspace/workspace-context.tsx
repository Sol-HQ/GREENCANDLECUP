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
import type { DrawTool, StickyNote, StickySize, Stroke, TextLabel } from "./types";
import { STICKY_DIMENSIONS } from "./types";

const STROKES_KEY = "gcc-workspace-strokes";
const NOTES_KEY = "gcc-workspace-notes";
const LABELS_KEY = "gcc-workspace-labels";

type WorkspaceContextValue = {
  tool: DrawTool;
  setTool: (t: DrawTool) => void;
  resetTools: () => void;
  color: string;
  setColor: (c: string) => void;
  strokes: Stroke[];
  addStroke: (s: Stroke) => void;
  eraseAt: (x: number, y: number, radius: number) => void;
  clearDrawings: () => void;
  clearAllNotes: () => void;
  labels: TextLabel[];
  addLabel: (label: Omit<TextLabel, "id">) => void;
  updateLabel: (id: string, patch: Partial<TextLabel>) => void;
  removeLabel: (id: string) => void;
  notes: StickyNote[];
  addNote: (size: StickySize, noteColor: string, x: number, y: number) => void;
  updateNote: (id: string, patch: Partial<StickyNote>) => void;
  removeNote: (id: string) => void;
  pendingStickySize: StickySize | null;
  setPendingStickySize: (s: StickySize | null) => void;
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

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [tool, setTool] = useState<DrawTool>("select");
  const [color, setColor] = useState("#facc15");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [labels, setLabels] = useState<TextLabel[]>([]);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [pendingStickySize, setPendingStickySize] = useState<StickySize | null>(
    null,
  );
  const [hydrated, setHydrated] = useState(false);

  const resetTools = useCallback(() => {
    setTool("select");
    setPendingStickySize(null);
  }, []);

  useEffect(() => {
    setStrokes(loadJson(STROKES_KEY, []));
    setLabels(loadJson(LABELS_KEY, []));
    setNotes(loadJson(NOTES_KEY, []));
    setHydrated(true);
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
    localStorage.setItem(STROKES_KEY, JSON.stringify(strokes));
  }, [strokes, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(LABELS_KEY, JSON.stringify(labels));
  }, [labels, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes, hydrated]);

  const addStroke = useCallback((stroke: Stroke) => {
    setStrokes((prev) => [...prev, stroke]);
  }, []);

  const eraseAt = useCallback((x: number, y: number, radius: number) => {
    setStrokes((prev) =>
      prev.filter((stroke) =>
        stroke.points.every((p) => Math.hypot(p.x - x, p.y - y) > radius),
      ),
    );
    setLabels((prev) =>
      prev.filter((l) => Math.hypot(l.x - x, l.y - y) > radius + 20),
    );
    setNotes((prev) =>
      prev.filter((n) => {
        const dim = STICKY_DIMENSIONS[n.size];
        const cx = n.x + dim.w / 2;
        const cy = n.y + dim.h / 2;
        return Math.hypot(cx - x, cy - y) > radius + Math.max(dim.w, dim.h) / 2;
      }),
    );
  }, []);

  const clearDrawings = useCallback(() => {
    setStrokes([]);
    setLabels([]);
  }, []);

  const clearAllNotes = useCallback(() => {
    setNotes([]);
    setPendingStickySize(null);
  }, []);

  const addLabel = useCallback((label: Omit<TextLabel, "id">) => {
    setLabels((prev) => [...prev, { ...label, id: crypto.randomUUID() }]);
    setTool("select");
  }, []);

  const updateLabel = useCallback((id: string, patch: Partial<TextLabel>) => {
    setLabels((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }, []);

  const removeLabel = useCallback((id: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addNote = useCallback(
    (size: StickySize, noteColor: string, x: number, y: number) => {
      setNotes((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          x,
          y,
          size,
          color: noteColor,
          text: "",
        },
      ]);
      setPendingStickySize(null);
      setTool("select");
    },
    [],
  );

  const updateNote = useCallback((id: string, patch: Partial<StickyNote>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    );
  }, []);

  const removeNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const isDrawMode = tool !== "select" || pendingStickySize !== null;

  const value = useMemo(
    () => ({
      tool,
      setTool,
      resetTools,
      color,
      setColor,
      strokes,
      addStroke,
      eraseAt,
      clearDrawings,
      clearAllNotes,
      labels,
      addLabel,
      updateLabel,
      removeLabel,
      notes,
      addNote,
      updateNote,
      removeNote,
      pendingStickySize,
      setPendingStickySize,
      isDrawMode,
    }),
    [
      tool,
      resetTools,
      color,
      strokes,
      addStroke,
      eraseAt,
      clearDrawings,
      clearAllNotes,
      labels,
      addLabel,
      updateLabel,
      removeLabel,
      notes,
      addNote,
      updateNote,
      removeNote,
      pendingStickySize,
      isDrawMode,
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
