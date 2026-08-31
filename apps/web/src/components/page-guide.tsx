"use client";

import Link from "next/link";
import { PAGE_GUIDES, type PageGuideKey } from "@gcc/shared";
import { cn } from "@/lib/utils";

export function PageGuide({
  page,
  className,
}: {
  page: PageGuideKey;
  className?: string;
}) {
  const guide = PAGE_GUIDES[page];
  const isPlaceholder = page === "positions" || page === "orders";

  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-950/60 p-4",
        isPlaceholder && "border-amber-500/25 bg-amber-950/10",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">
            {guide.title}
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-300">
            {guide.tagline}
          </p>
        </div>
        {isPlaceholder ? (
          <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
            Coming soon
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
            Phoenix perps
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">
            What works today
          </p>
          <ul className="space-y-1 text-sm text-zinc-400">
            {guide.works.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-emerald-500">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">
            Honest limitations
          </p>
          <ul className="space-y-1 text-sm text-zinc-400">
            {guide.limitations.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-amber-500">!</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {guide.actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800/80 pt-3">
          {guide.actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
            >
              {action.label} →
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
