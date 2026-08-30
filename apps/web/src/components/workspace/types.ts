export type DrawTool = "select" | "pen" | "eraser" | "text";

export type StickySize = "sm" | "md" | "lg";

export type Stroke = {
  id: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
};

export type TextLabel = {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
};

export type StickyNote = {
  id: string;
  x: number;
  y: number;
  size: StickySize;
  color: string;
  text: string;
};

export const STICKY_DIMENSIONS: Record<StickySize, { w: number; h: number }> = {
  sm: { w: 140, h: 100 },
  md: { w: 200, h: 140 },
  lg: { w: 280, h: 200 },
};

export const DRAW_COLORS = [
  "#facc15",
  "#22c55e",
  "#38bdf8",
  "#f472b6",
  "#ef4444",
  "#ffffff",
];

export const STICKY_COLORS = [
  "#fef08a",
  "#bbf7d0",
  "#bae6fd",
  "#fbcfe8",
  "#fecaca",
];
