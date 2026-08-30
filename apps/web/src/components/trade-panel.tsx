"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button, Card, Input, Select } from "@/components/ui";
import { api } from "@/lib/utils";
import type { PlaceOrderRequest } from "@gcc/shared";

export function TradePanel({
  markPrice,
}: {
  markPrice: string | null;
}) {
  const { publicKey } = useWallet();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [size, setSize] = useState("0.01");
  const [price, setPrice] = useState(markPrice ?? "");
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [status, setStatus] = useState<string>("");

  const submit = async () => {
    setStatus("Submitting…");
    try {
      const body: PlaceOrderRequest = {
        symbol: "SOL",
        side,
        type,
        sizeBase: size,
        priceUsd: type === "limit" ? price : undefined,
        mode,
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
    <Card title="Trade">
      <div className="grid gap-3">
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

        <Select value={type} onChange={(e) => setType(e.target.value as "market" | "limit")}>
          <option value="market">Market</option>
          <option value="limit">Limit</option>
        </Select>

        <Select value={mode} onChange={(e) => setMode(e.target.value as "paper" | "live")}>
          <option value="paper">Paper (simulated)</option>
          <option value="live">Live (on-chain)</option>
        </Select>

        <Input
          placeholder="Size (SOL)"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />

        {type === "limit" ? (
          <Input
            placeholder="Limit price (USD)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        ) : null}

        <p className="text-xs text-zinc-500">
          Mark: {markPrice ? `$${Number(markPrice).toFixed(2)}` : "—"} · Wallet:{" "}
          {publicKey ? `${publicKey.toBase58().slice(0, 4)}…` : "not connected"}
        </p>

        <Button onClick={() => void submit()}>Place Order</Button>
        {status ? <p className="text-sm text-zinc-300">{status}</p> : null}
      </div>
    </Card>
  );
}
