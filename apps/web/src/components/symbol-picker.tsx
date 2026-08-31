"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSymbol } from "@/components/symbol-provider";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** When set, picker does not change the global engaged symbol. */
  symbol?: string;
  onSymbolChange?: (symbol: string) => void;
  compact?: boolean;
};

export function SymbolPicker({
  className,
  symbol: controlledSymbol,
  onSymbolChange,
  compact,
}: Props) {
  const global = useSymbol();
  const isControlled = controlledSymbol != null && onSymbolChange != null;
  const symbol = isControlled ? controlledSymbol : global.symbol;
  const setSymbol = isControlled
    ? async (next: string) => onSymbolChange(next)
    : global.setSymbol;
  const { markets, listing, loadingMarkets } = global;

  const activeListing = useMemo(
    () => markets.find((m) => m.symbol === symbol) ?? listing,
    [markets, symbol, listing],
  );

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 280),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = markets.filter((m) => m.marketStatus === "active");
    if (!q) return active;
    return active.filter(
      (m) =>
        m.symbol.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q),
    );
  }, [markets, query]);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 text-left transition hover:border-emerald-500/40",
          compact ? "py-1.5" : "py-2",
        )}
      >
        {activeListing?.logoUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeListing.logoUri}
            alt=""
            className={cn(
              "rounded-full bg-zinc-800 object-cover",
              compact ? "h-7 w-7" : "h-9 w-9",
            )}
          />
        ) : (
          <div
            className={cn(
              "flex items-center justify-center rounded-full bg-zinc-800 font-bold",
              compact ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs",
            )}
          >
            {symbol.slice(0, 3)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-semibold text-zinc-100",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {activeListing?.name ?? symbol}
          </p>
          {!compact ? (
            <p className="text-xs text-zinc-500">
              {symbol} · Phoenix perp
              {loadingMarkets ? " · loading markets…" : ` · ${markets.length} markets`}
            </p>
          ) : (
            <p className="text-[10px] text-zinc-500">{symbol}</p>
          )}
        </div>
        <span className="text-xs text-zinc-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && mounted
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[9999] rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl"
              style={{
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
              }}
            >
              <Input
                placeholder="Search symbol or name (BTC, Cardano, …)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mb-2"
                autoFocus
              />
              <div className="max-h-72 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-zinc-500">No markets match.</p>
                ) : (
                  filtered.map((m) => (
                    <button
                      key={m.symbol}
                      type="button"
                      onClick={() => {
                        void setSymbol(m.symbol);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-zinc-900",
                        m.symbol === symbol &&
                          "bg-emerald-500/10 ring-1 ring-emerald-500/30",
                      )}
                    >
                      {m.logoUri ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.logoUri}
                          alt=""
                          className="h-8 w-8 rounded-full bg-zinc-800 object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold">
                          {m.symbol.slice(0, 3)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-100">
                          {m.symbol}
                          <span className="ml-2 font-normal text-zinc-500">
                            {m.name}
                          </span>
                        </p>
                        <p className="text-[11px] text-zinc-600">
                          {m.maxLeverage ? `${m.maxLeverage}x max` : "—"} · taker{" "}
                          {(m.takerFeeBps / 100).toFixed(2)} bps
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
