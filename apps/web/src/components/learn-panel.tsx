"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { GLOSSARY } from "@gcc/shared";

const SECTIONS = [
  GLOSSARY.whatIsGcc,
  GLOSSARY.perpsVsSpot,
  GLOSSARY.howToTradeToday,
  GLOSSARY.paperVsLive,
  GLOSSARY.mainnetVsDevnet,
  GLOSSARY.competitionWallet,
  GLOSSARY.candle,
  GLOSSARY.ema,
  GLOSSARY.ema9Pullback,
  GLOSSARY.macd,
  GLOSSARY.trendMacd,
  GLOSSARY.shredStream,
] as const;

export function LearnPanel() {
  const [open, setOpen] = useState<string | null>(GLOSSARY.whatIsGcc.title);

  return (
    <Card title="Learn — trading terms in plain English">
      <p className="mb-3 text-sm text-zinc-400">
        You already know buy low / sell high. These are just the robot&apos;s
        rules for spotting lows and highs on a chart.
      </p>
      <div className="space-y-2">
        {SECTIONS.map((section) => {
          const isOpen = open === section.title;
          return (
            <div
              key={section.title}
              className="rounded-lg border border-zinc-800 bg-zinc-900/40"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-zinc-200"
                onClick={() => setOpen(isOpen ? null : section.title)}
              >
                {section.title}
                <span className="text-zinc-500">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen ? (
                <p className="border-t border-zinc-800 px-3 py-2 text-sm leading-relaxed text-zinc-400">
                  {section.body}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
