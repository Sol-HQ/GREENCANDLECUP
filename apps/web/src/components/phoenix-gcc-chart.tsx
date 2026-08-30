"use client";

import dynamic from "next/dynamic";

export const PhoenixGccChart = dynamic(
  () =>
    import("./phoenix-gcc-chart-inner").then((m) => m.PhoenixGccChartInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] items-center justify-center rounded-xl border border-zinc-800 text-sm text-zinc-500">
        Loading Phoenix chart…
      </div>
    ),
  },
);
