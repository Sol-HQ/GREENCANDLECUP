export type DrawTool = "select" | "pen" | "eraser" | "text";

export type WorkspaceScope = "global" | "local";

export type GlobalStickyVariant = "gold" | "silver";

export type StickySize = "sm" | "md" | "lg";

export type Stroke = {
  id: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  scope: WorkspaceScope;
  page?: string;
};

export type TextLabel = {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  scope: WorkspaceScope;
  page?: string;
};

export type StickyNote = {
  id: string;
  x: number;
  y: number;
  size: StickySize;
  color: string;
  text: string;
  scope: WorkspaceScope;
  /** Gold or silver — both are global (every page). */
  variant?: GlobalStickyVariant;
  /** Page sticky color id from LOCAL_STICKY_PALETTE. */
  localColorId?: LocalStickyColorId;
  page?: string;
};

export const STICKY_DIMENSIONS: Record<StickySize, { w: number; h: number }> = {
  sm: { w: 140, h: 100 },
  md: { w: 200, h: 140 },
  lg: { w: 280, h: 200 },
};

export type GlobalPenVariant = "gold" | "silver";

/** Legacy scope styles — used for sticky placement hints. */
export const SCOPE_STYLES = {
  global: {
    label: "Gold",
    penColor: "#fbbf24",
    stickyBg: "#fcd34d",
    stickyBorder: "#f59e0b",
    stickyGlow:
      "0 0 22px rgba(251, 191, 36, 0.55), 0 0 4px rgba(251, 191, 36, 0.8)",
    badge: "text-amber-950",
    headerBg: "bg-amber-400/30",
  },
  local: {
    label: "Silver",
    penColor: "#cbd5e1",
    stickyBg: "#e2e8f0",
    stickyBorder: "#94a3b8",
    stickyGlow:
      "0 0 18px rgba(148, 163, 184, 0.45), 0 0 3px rgba(226, 232, 240, 0.9)",
    badge: "text-slate-800",
    headerBg: "bg-slate-300/40",
  },
} as const;

/** Global sticky variants — both persist on every tab. */
export const GLOBAL_STICKY_STYLES = {
  gold: {
    label: "Gold",
    stickyBg: "#fcd34d",
    stickyBorder: "#f59e0b",
    stickyGlow:
      "0 0 22px rgba(251, 191, 36, 0.55), 0 0 4px rgba(251, 191, 36, 0.8)",
    badge: "text-amber-950",
    headerBg: "bg-amber-400/30",
  },
  silver: {
    label: "Silver",
    stickyBg: "#e2e8f0",
    stickyBorder: "#94a3b8",
    stickyGlow:
      "0 0 20px rgba(148, 163, 184, 0.5), 0 0 4px rgba(226, 232, 240, 0.9)",
    badge: "text-slate-800",
    headerBg: "bg-slate-300/50",
  },
} as const;

/** Page-only stickies — pick a color that means something to you. */
export const LOCAL_STICKY_PALETTE = [
  {
    id: "red",
    label: "Red · urgent",
    bg: "#fca5a5",
    border: "#dc2626",
    penColor: "#dc2626",
    glow: "0 0 14px rgba(239, 68, 68, 0.45)",
    headerBg: "bg-red-400/40",
    badge: "text-red-950",
  },
  {
    id: "orange",
    label: "Orange · attention",
    bg: "#fdba74",
    border: "#ea580c",
    penColor: "#ea580c",
    glow: "0 0 14px rgba(249, 115, 22, 0.4)",
    headerBg: "bg-orange-400/40",
    badge: "text-orange-950",
  },
  {
    id: "yellow",
    label: "Yellow · note",
    bg: "#fde047",
    border: "#ca8a04",
    penColor: "#ca8a04",
    glow: "0 0 14px rgba(234, 179, 8, 0.4)",
    headerBg: "bg-yellow-400/40",
    badge: "text-yellow-950",
  },
  {
    id: "green",
    label: "Green · go / good",
    bg: "#86efac",
    border: "#16a34a",
    penColor: "#16a34a",
    glow: "0 0 14px rgba(34, 197, 94, 0.4)",
    headerBg: "bg-green-400/40",
    badge: "text-green-950",
  },
  {
    id: "blue",
    label: "Blue · low priority",
    bg: "#93c5fd",
    border: "#2563eb",
    penColor: "#2563eb",
    glow: "0 0 14px rgba(59, 130, 246, 0.4)",
    headerBg: "bg-blue-400/40",
    badge: "text-blue-950",
  },
  {
    id: "purple",
    label: "Purple · idea",
    bg: "#d8b4fe",
    border: "#9333ea",
    penColor: "#9333ea",
    glow: "0 0 14px rgba(168, 85, 247, 0.4)",
    headerBg: "bg-purple-400/40",
    badge: "text-purple-950",
  },
  {
    id: "pink",
    label: "Pink · personal",
    bg: "#f9a8d4",
    border: "#db2777",
    penColor: "#db2777",
    glow: "0 0 14px rgba(236, 72, 153, 0.4)",
    headerBg: "bg-pink-400/40",
    badge: "text-pink-950",
  },
  {
    id: "white",
    label: "White · neutral",
    bg: "#f4f4f5",
    border: "#a1a1aa",
    penColor: "#71717a",
    glow: "0 0 10px rgba(161, 161, 170, 0.35)",
    headerBg: "bg-zinc-300/50",
    badge: "text-zinc-800",
  },
] as const;

export type LocalStickyColorId = (typeof LOCAL_STICKY_PALETTE)[number]["id"];

/** Active pencil — gold/silver draw globally; colored pencils draw on this page only. */
export type PenTarget =
  | { layer: "global"; variant: GlobalPenVariant }
  | { layer: "local"; colorId: LocalStickyColorId };

export const GLOBAL_PEN_COLORS: Record<GlobalPenVariant, string> = {
  gold: "#fbbf24",
  silver: "#cbd5e1",
};

export function penColorForTarget(target: PenTarget): string {
  if (target.layer === "global") {
    return GLOBAL_PEN_COLORS[target.variant];
  }
  const palette = LOCAL_STICKY_PALETTE.find((p) => p.id === target.colorId);
  return palette ? palette.penColor : "#ffffff";
}

export const DRAW_COLORS = [
  "#fbbf24",
  "#cbd5e1",
  "#22c55e",
  "#38bdf8",
  "#f472b6",
  "#ef4444",
  "#ffffff",
];

export type PendingSticky = {
  size: StickySize;
  scope: WorkspaceScope;
  /** Global: gold or silver. */
  variant?: GlobalStickyVariant;
  /** Page sticky color id from LOCAL_STICKY_PALETTE. */
  localColorId?: LocalStickyColorId;
};

export function stickyStyleForNote(note: StickyNote) {
  if (note.scope === "global") {
    const v = note.variant ?? "gold";
    const s = GLOBAL_STICKY_STYLES[v];
    return {
      label: s.label,
      border: s.stickyBorder,
      glow: s.stickyGlow,
      headerBg: s.headerBg,
      badge: s.badge,
    };
  }
  const palette =
    LOCAL_STICKY_PALETTE.find(
      (p) => p.id === note.localColorId || p.bg === note.color,
    ) ?? LOCAL_STICKY_PALETTE[0];
  return {
    label: palette.label,
    border: palette.border,
    glow: palette.glow,
    headerBg: palette.headerBg,
    badge: palette.badge,
  };
}
