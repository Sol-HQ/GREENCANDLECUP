"use client";

import { useEffect, useRef } from "react";
import { useElementSize } from "@/hooks/use-element-size";

/** Free TradingView embed — their servers supply all candle data. */
export function TradingViewChart({
  symbol = "BINANCE:SOLUSDT.P",
}: {
  symbol?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(wrapRef, 320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || width < 40 || height < 200) return;

    el.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = `${height}px`;
    widget.style.width = "100%";
    el.appendChild(widget);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "15",
      timezone: "America/New_York",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [symbol, width, height]);

  return (
    <div ref={wrapRef} className="h-full min-h-[320px] w-full">
      <div
        ref={containerRef}
        className="tradingview-widget-container h-full w-full overflow-hidden rounded-xl border border-zinc-800"
        style={{ minHeight: height || 320 }}
      />
    </div>
  );
}
