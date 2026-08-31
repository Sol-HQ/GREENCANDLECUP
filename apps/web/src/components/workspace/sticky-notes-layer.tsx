"use client";

import { useRef } from "react";
import { STICKY_DIMENSIONS, stickyStyleForNote, type StickyNote } from "./types";
import { useWorkspace } from "./workspace-context";

type Props = {
  mode: "global" | "local";
  notes: StickyNote[];
};

export function StickyNotesLayer({ mode, notes }: Props) {
  const { updateNote, removeNote } = useWorkspace();
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    noteX: number;
    noteY: number;
  } | null>(null);

  if (notes.length === 0) return null;

  const isFixed = mode === "global";

  return (
    <div
      className={
        isFixed
          ? "pointer-events-none fixed inset-0 z-[190]"
          : "pointer-events-none absolute inset-0 z-[190]"
      }
    >
      {notes.map((note) => {
        const dim = STICKY_DIMENSIONS[note.size];
        const style = stickyStyleForNote(note);
        return (
          <StickyCard
            key={note.id}
            note={note}
            dim={dim}
            label={style.label}
            borderColor={style.border}
            glow={style.glow}
            headerBg={style.headerBg}
            badge={style.badge}
            fixed={isFixed}
            drag={drag}
            onUpdate={updateNote}
            onRemove={removeNote}
          />
        );
      })}
    </div>
  );
}

function StickyCard({
  note,
  dim,
  label,
  borderColor,
  glow,
  headerBg,
  badge,
  fixed,
  drag,
  onUpdate,
  onRemove,
}: {
  note: StickyNote;
  dim: { w: number; h: number };
  label: string;
  borderColor: string;
  glow: string;
  headerBg: string;
  badge: string;
  fixed: boolean;
  drag: React.MutableRefObject<{
    id: string;
    startX: number;
    startY: number;
    noteX: number;
    noteY: number;
  } | null>;
  onUpdate: (id: string, patch: Partial<StickyNote>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-auto absolute rounded-lg border-2 shadow-xl"
      style={{
        ...(fixed ? { position: "fixed" } : {}),
        left: note.x,
        top: note.y,
        width: dim.w,
        height: dim.h,
        backgroundColor: note.color,
        borderColor,
        boxShadow: glow,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={`flex cursor-move items-center justify-between rounded-t-md px-2 py-1 text-[10px] font-semibold ${headerBg} ${badge}`}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          e.stopPropagation();
          drag.current = {
            id: note.id,
            startX: e.clientX,
            startY: e.clientY,
            noteX: note.x,
            noteY: note.y,
          };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current || drag.current.id !== note.id) return;
          onUpdate(note.id, {
            x: drag.current.noteX + (e.clientX - drag.current.startX),
            y: drag.current.noteY + (e.clientY - drag.current.startY),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <span>
          {label} · {note.size.toUpperCase()}
        </span>
        <button
          type="button"
          className="rounded bg-black/10 px-1.5 py-0.5 font-bold hover:bg-rose-600 hover:text-white"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(note.id);
          }}
        >
          ×
        </button>
      </div>
      <textarea
        className="h-[calc(100%-28px)] w-full resize-none bg-transparent px-2 py-1 text-sm text-zinc-900 outline-none"
        placeholder={`${label} note…`}
        value={note.text}
        onChange={(e) => onUpdate(note.id, { text: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
