"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button, Card, Input } from "@/components/ui";
import { useSymbol } from "@/components/symbol-provider";
import { useTradeSettings } from "@/components/trade-settings-provider";
import { useNetwork } from "@/components/network-provider";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import { PaperPositionPanel } from "@/components/paper-position-panel";
import { api } from "@/lib/utils";
import { formatPriceUsd, formatUsdNotional } from "@/lib/market-symbols";
import {
  clampLeverage,
  leverageForSymbol,
  leverageOptionsForMarket,
} from "@/lib/leverage";
import type { PaperPortfolioState, PaperTradeRecord, PlaceOrderRequest } from "@gcc/shared";
import { SLIPPAGE_PRESETS_BPS } from "@gcc/shared";
import { cn } from "@/lib/utils";

type OrderResult = {
  message: string;
  receipt?: string;
  trade?: PaperTradeRecord;
  portfolio?: PaperPortfolioState;
};

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
  const { paperPortfolio } = useGccSocket();
  const { settings, updateSettings } = useTradeSettings();
  const mode = network?.tradingMode ?? "paper";
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [sizeInput, setSizeInput] = useState("10");
  const [price, setPrice] = useState(markPrice ?? "");
  const [customSlippage, setCustomSlippage] = useState("");
  const [status, setStatus] = useState<string>("");
  const [lastReceipt, setLastReceipt] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const paper = paperPortfolio;
  const posSide = paper?.positionSide ?? "flat";
  const inPosition = posSide !== "flat";

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

  const marginUsd = activeLeverage > 0 ? notionalUsd / activeLeverage : notionalUsd;

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
    : notionalUsd * 0.0005;

  const actionLabel = useMemo(() => {
    if (mode !== "paper") return type === "market" ? "Place Order" : "Place Limit";
    if (posSide === "long" && side === "sell") return "Close Long (paper)";
    if (posSide === "short" && side === "buy") return "Close Short (paper)";
    if (side === "buy") return "Open Long (paper)";
    return "Open Short (paper)";
  }, [mode, posSide, side, type]);

  const submit = async () => {
    setStatus("Submitting…");
    setLastReceipt(null);
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
        reduceOnly:
          settings.reduceOnly ||
          (posSide === "long" && side === "sell") ||
          (posSide === "short" && side === "buy") ||
          undefined,
        postOnly: type === "limit" && settings.postOnly ? true : undefined,
      };
      const result = await api<OrderResult>("/api/orders", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setStatus(result.message);
      if (result.receipt) setLastReceipt(result.receipt);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Order failed");
    }
  };

  const closePosition = async () => {
    setClosing(true);
    setStatus("Closing position…");
    try {
      const result = await api<OrderResult>("/api/paper/close", {
        method: "POST",
        body: JSON.stringify({ symbol }),
      });
      setStatus(result.message);
      if (result.receipt) setLastReceipt(result.receipt);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Close failed");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {mode === "paper" && paper ? (
        <PaperPositionPanel
          paper={paper}
          symbol={symbol}
          onClose={() => void closePosition()}
          closing={closing}
        />
      ) : null}

      <Card className="flex min-h-0 flex-1 flex-col" title={`Phoenix perp · ${symbol}`}>
        <p className="mb-2 text-xs leading-relaxed text-zinc-500">
          One paper wallet shared with the bot — ${paper?.balanceUsdc.toFixed(2) ?? "100.00"}{" "}
          cash · {mode === "paper" ? "simulated fills" : "live"} · header toggle switches mode.
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
              <span>Size {settings.sizeUnit === "usd" ? "(notional USD)" : `(${symbol})`}</span>
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
                settings.sizeUnit === "usd"
                  ? "Notional USD (e.g. 10 = $10 exposure)"
                  : `Size (${symbol})`
              }
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
            />
            {settings.sizeUnit === "usd" && mark > 0 ? (
              <p className="mt-1 text-[11px] text-zinc-500">
                ≈ {Number(sizeBase).toFixed(4)} {symbol} tokens @ {formatPriceUsd(markPrice)}
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
              Leverage · max {maxLev}x on Phoenix
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
                Reduce only (close only, no flip)
              </label>
            </div>
          ) : null}

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 text-xs text-zinc-400">
            <p>Mark: {formatPriceUsd(markPrice)}</p>
            <p>Notional (exposure): {formatUsdNotional(notionalUsd)}</p>
            <p>
              Margin @ {activeLeverage}x: {formatUsdNotional(marginUsd)}{" "}
              <span className="text-zinc-600">(notional ÷ leverage)</span>
            </p>
            {worstPrice != null ? (
              <p>Worst fill: {formatPriceUsd(worstPrice)}</p>
            ) : null}
            <p>Est. taker fee: {formatUsdNotional(estTakerFee)}</p>
            {inPosition ? (
              <p className="mt-1 text-amber-400/90">
                Open {posSide} — sell closes long, buy closes short
              </p>
            ) : null}
          </div>

          <Button onClick={() => void submit()}>{actionLabel}</Button>

          {lastReceipt ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2 text-xs text-emerald-100">
              <p className="font-medium text-emerald-300">Fill receipt</p>
              <p className="mt-1 font-mono leading-relaxed">{lastReceipt}</p>
            </div>
          ) : null}
          {status ? (
            <p className="break-words text-sm text-zinc-300">{status}</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
