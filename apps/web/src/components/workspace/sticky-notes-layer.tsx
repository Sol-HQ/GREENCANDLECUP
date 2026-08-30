"use client";

import { useRef, useState } from "react";
import { STICKY_COLORS, STICKY_DIMENSIONS } from "./types";
import { useWorkspace } from "./workspace-context";

export function StickyNotesLayer() {
  const { notes, updateNote, removeNote } = useWorkspace();
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {notes.map((note) => {
        const dim = STICKY_DIMENSIONS[note.size];
        return (
          <div
            key={note.id}
            className="pointer-events-auto absolute rounded-lg border border-zinc-700/60 shadow-lg"
            style={{
              left: note.x,
              top: note.y,
              width: dim.w,
              height: dim.h,
              backgroundColor: note.color,
            }}
          >
            <div
              className="flex cursor-move items-center justify-between rounded-t-lg bg-black/10 px-2 py-1 text-[10px] text-zinc-800"
              onPointerDown={(e) => {
                drag.current = {
                  id: note.id,
                  ox: e.clientX - note.x,
                  oy: e.clientY - note.y,
                };
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!drag.current || drag.current.id !== note.id) return;
                updateNote(note.id, {
                  x: e.clientX - drag.current.ox,
                  y: e.clientY - drag.current.oy,
                });
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
            >
              <span>{note.size.toUpperCase()} note</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="rounded px-1 hover:bg-black/10"
                  onClick={() =>
                    setColorPickerFor(colorPickerFor === note.id ? null : note.id)
                  }
                >
                  color
                </button>
                <button
                  type="button"
                  className="rounded px-1 hover:bg-black/10"
                  onClick={() => removeNote(note.id)}
                >
                  ×
                </button>
              </div>
            </div>
            {colorPickerFor === note.id ? (
              <div className="flex gap-1 px-2 py-1">
                {STICKY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="h-4 w-4 rounded-full border border-zinc-600"
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      updateNote(note.id, { color: c });
                      setColorPickerFor(null);
                    }}
                  />
                ))}
              </div>
            ) : null}
            <textarea
              className="h-[calc(100%-28px)] w-full resize-none bg-transparent px-2 py-1 text-sm text-zinc-900 outline-none"
              placeholder="Type your note…"
              value={note.text}
              onChange={(e) => updateNote(note.id, { text: e.target.value })}
            />
          </div>
        );
      })}
    </div>
  );
}
