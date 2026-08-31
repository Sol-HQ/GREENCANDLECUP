"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button, Card, Input } from "@/components/ui";
import { useSymbol } from "@/components/symbol-provider";
import { useTradeSettings } from "@/components/trade-settings-provider";
import { useNetwork } from "@/components/network-provider";
import { api } from "@/lib/utils";
import { formatPriceUsd, formatUsdNotional } from "@/lib/market-symbols";
import {
  clampLeverage,
  leverageForSymbol,
  leverageOptionsForMarket,
} from "@/lib/leverage";
import type { PlaceOrderRequest } from "@gcc/shared";
import { SLIPPAGE_PRESETS_BPS } from "@gcc/shared";
import { cn } from "@/lib/utils";

export function TradePanel({
  symbol,
  markPrice,
}: {
  symbol: string;
  markPrice: string | null;
}) {
  const { publicKey } = useWallet();
  const { listing } = useSymbol();
  const { network } = useNetwork();
  const { settings, updateSettings } = useTradeSettings();
  const mode = network?.tradingMode ?? "paper";
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [sizeInput, setSizeInput] = useState("0.01");
  const [price, setPrice] = useState(markPrice ?? "");
  const [customSlippage, setCustomSlippage] = useState("");
  const [status, setStatus] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (markPrice && type === "limit" && !price) setPrice(markPrice);
  }, [markPrice, type, price]);

  const mark = Number(markPrice ?? 0);
  const maxLev = listing?.maxLeverage ?? 1;
  const leverageOptions = leverageOptionsForMarket(maxLev);
  const activeLeverage = leverageForSymbol(
    symbol,
    settings.leverageBySymbol,
    settings.leverage,
    maxLev,
  );

  const setLeverage = (lev: number) => {
    const clamped = clampLeverage(lev, maxLev);
    updateSettings({
      leverage: clamped,
      leverageBySymbol: {
        ...settings.leverageBySymbol,
        [symbol]: clamped,
      },
    });
  };

  const sizeBase = useMemo(() => {
    const raw = Number(sizeInput);
    if (!raw || Number.isNaN(raw)) return "0";
    if (settings.sizeUnit === "usd" && mark > 0) {
      return (raw / mark).toFixed(6);
    }
    return String(raw);
  }, [sizeInput, settings.sizeUnit, mark]);

  const notionalUsd = useMemo(() => {
    const base = Number(sizeBase);
    if (!base || !mark) return 0;
    return base * mark;
  }, [sizeBase, mark]);

  const slippageBps =
    customSlippage.trim() !== ""
      ? Math.min(5000, Math.max(1, Math.round(Number(customSlippage) * 100) || settings.slippageBps))
      : settings.slippageBps;

  const worstPrice = useMemo(() => {
    if (!mark || type !== "market") return null;
    const slip = slippageBps / 10_000;
    return side === "buy" ? mark * (1 + slip) : mark * (1 - slip);
  }, [mark, type, slippageBps, side]);

  const estTakerFee = listing
    ? notionalUsd * (listing.takerFeeBps / 10_000)
    : 0;

  const submit = async () => {
    setStatus("Submitting…");
    try {
      const body: PlaceOrderRequest = {
        symbol,
        side,
        type,
        sizeBase,
        priceUsd: type === "limit" ? price : undefined,
        mode,
        slippageBps: type === "market" ? slippageBps : undefined,
        leverage: activeLeverage > 1 ? activeLeverage : undefined,
        reduceOnly: settings.reduceOnly || undefined,
        postOnly: type === "limit" && settings.postOnly ? true : undefined,
      };
      const result = await api<{ message: string }>("/api/orders", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setStatus(result.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Order failed");
    }
  };

  return (
    <Card className="flex h-full min-h-0 flex-col" title={`Phoenix perp · ${symbol}`}>
      <p className="mb-2 text-xs leading-relaxed text-zinc-500">
        Long/short leveraged perps on Phoenix — not spot. Mode:{" "}
        <strong className={mode === "paper" ? "text-emerald-400" : "text-amber-400"}>
          {mode === "paper" ? "Paper (simulated)" : "Live"}
        </strong>{" "}
        from header toggle.{" "}
        {mode === "live"
          ? "Live builds orders but browser signing is not wired yet."
          : "Simulate Order uses real prices, no on-chain transaction."}
      </p>
      <div className="grid flex-1 gap-3 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={side === "buy" ? "primary" : "secondary"}
            onClick={() => setSide("buy")}
          >
            Buy / Long
          </Button>
          <Button
            variant={side === "sell" ? "danger" : "secondary"}
            onClick={() => setSide("sell")}
          >
            Sell / Short
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={type === "market" ? "primary" : "secondary"}
            className="!text-xs"
            onClick={() => setType("market")}
          >
            Market
          </Button>
          <Button
            variant={type === "limit" ? "primary" : "secondary"}
            className="!text-xs"
            onClick={() => setType("limit")}
          >
            Limit
          </Button>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
            <span>Size</span>
            <button
              type="button"
              className="text-emerald-400 hover:underline"
              onClick={() =>
                updateSettings({
                  sizeUnit: settings.sizeUnit === "base" ? "usd" : "base",
                })
              }
            >
              Switch to {settings.sizeUnit === "base" ? "USD" : symbol}
            </button>
          </div>
          <Input
            placeholder={
              settings.sizeUnit === "usd" ? "Size (USD)" : `Size (${symbol})`
            }
            value={sizeInput}
            onChange={(e) => setSizeInput(e.target.value)}
          />
          {settings.sizeUnit === "usd" && mark > 0 ? (
            <p className="mt-1 text-[11px] text-zinc-500">
              ≈ {sizeBase} {symbol}
            </p>
          ) : null}
        </div>

        {type === "limit" ? (
          <Input
            placeholder="Limit price (USD)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        ) : null}

        <div>
          <p className="mb-1 text-xs text-zinc-500">
            Leverage · Phoenix max {maxLev}x for {symbol}
            {listing?.isolatedOnly ? " · isolated margin only" : ""}
          </p>
          <div className="flex flex-wrap gap-1">
            {leverageOptions.map((lev) => (
              <button
                key={lev}
                type="button"
                onClick={() => setLeverage(lev)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs transition",
                  activeLeverage === lev
                    ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
                )}
              >
                {lev}x
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-zinc-600">
            Capped by Phoenix for this market. Larger positions may hit lower
            tiers on-chain. Saved per symbol.
          </p>
        </div>

        {type === "market" ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">Slippage tolerance</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {SLIPPAGE_PRESETS_BPS.map((bps) => (
                <button
                  key={bps}
                  type="button"
                  onClick={() => {
                    updateSettings({ slippageBps: bps });
                    setCustomSlippage("");
                  }}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs transition",
                    settings.slippageBps === bps && !customSlippage
                      ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
                  )}
                >
                  {(bps / 100).toFixed(2)}%
                </button>
              ))}
            </div>
            <Input
              placeholder="Custom slippage % (e.g. 0.75)"
              value={customSlippage}
              onChange={(e) => setCustomSlippage(e.target.value)}
            />
          </div>
        ) : null}

        <button
          type="button"
          className="text-left text-xs text-zinc-500 hover:text-zinc-300"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "▾" : "▸"} Advanced
        </button>

        {showAdvanced ? (
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-xs">
            <label className="flex items-center gap-2 text-zinc-300">
              <input
                type="checkbox"
                checked={settings.reduceOnly}
                onChange={(e) =>
                  updateSettings({ reduceOnly: e.target.checked })
                }
              />
              Reduce only
            </label>
            {type === "limit" ? (
              <label className="flex items-center gap-2 text-zinc-300">
                <input
                  type="checkbox"
                  checked={settings.postOnly}
                  onChange={(e) =>
                    updateSettings({ postOnly: e.target.checked })
                  }
                />
                Post only (maker)
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 text-xs text-zinc-400">
          <p>Mark: {formatPriceUsd(markPrice)}</p>
          <p>Notional: {formatUsdNotional(notionalUsd)}</p>
          {worstPrice != null ? (
            <p>
              Worst fill (slippage): {formatPriceUsd(worstPrice)}{" "}
              <span className="text-zinc-600">
                ({(slippageBps / 100).toFixed(2)}%)
              </span>
            </p>
          ) : null}
          {listing ? (
            <p>Est. taker fee: {formatUsdNotional(estTakerFee)}</p>
          ) : null}
          <p className="mt-1 text-zinc-600">
            Wallet:{" "}
            {publicKey ? `${publicKey.toBase58().slice(0, 4)}…` : "not connected"}
          </p>
        </div>

        <Button onClick={() => void submit()}>
          {mode === "paper" ? "Simulate Order" : "Place Order"}
        </Button>
        {status ? (
          <p className="break-words text-sm text-zinc-300">{status}</p>
        ) : null}
      </div>
    </Card>
  );
}
