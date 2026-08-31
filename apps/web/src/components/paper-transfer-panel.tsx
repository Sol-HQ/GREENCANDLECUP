"use client";

import { useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import type { PaperPortfolioState } from "@gcc/shared";
import { api } from "@/lib/utils";

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

export function PaperTransferPanel({
  paper,
  onTransferred,
}: {
  paper: PaperPortfolioState | null;
  onTransferred?: () => void;
}) {
  const [amount, setAmount] = useState("10");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  if (!paper) return null;

  const flat = paper.positionSide === "flat";
  const tradingHeadroom = Math.max(0, paper.tradingCapUsdc - paper.tradingBalanceUsdc);
  const canDeposit = flat && paper.fundingBalanceUsdc > 0 && tradingHeadroom > 0;
  const canWithdraw = flat && paper.tradingBalanceUsdc > 0;

  const transfer = async (direction: "deposit" | "withdraw") => {
    setBusy(true);
    setStatus("");
    try {
      const result = await api<{ message: string }>("/api/paper/transfer", {
        method: "POST",
        body: JSON.stringify({ direction, amountUsd: Number(amount) }),
      });
      setStatus(result.message);
      onTransferred?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Funding ↔ Trading">
      <p className="mb-3 text-xs text-zinc-500">
        <strong className="text-zinc-300">Funding</strong> = vault for profits and
        reserves. <strong className="text-zinc-300">Trading</strong> = capped at{" "}
        {fmt(paper.tradingCapUsdc)} for bot and manual perps. Transfers only when
        flat.
      </p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Funding wallet</p>
          <p className="mt-1 text-xl font-semibold text-zinc-100">
            {fmt(paper.fundingBalanceUsdc)}
          </p>
          <p className="mt-1 text-xs text-zinc-600">Not used for margin until deposited</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3">
          <p className="text-xs uppercase tracking-wide text-emerald-400/80">
            Trading wallet
          </p>
          <p className="mt-1 text-xl font-semibold text-emerald-100">
            {fmt(paper.tradingBalanceUsdc)}
            <span className="ml-2 text-sm font-normal text-zinc-500">
              / {fmt(paper.tradingCapUsdc)} cap
            </span>
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            {tradingHeadroom > 0
              ? `${fmt(tradingHeadroom)} room to deposit`
              : "At cap — withdraw profits to fund more later"}
          </p>
        </div>
      </div>

      {!flat ? (
        <p className="mb-3 text-xs text-amber-400">
          Close your open position before moving funds between wallets.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[120px] flex-1">
          <p className="mb-1 text-xs text-zinc-500">Amount (USDC)</p>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Button
          variant="secondary"
          disabled={busy || !canDeposit}
          onClick={() => void transfer("deposit")}
        >
          Deposit to trading
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !canWithdraw}
          onClick={() => void transfer("withdraw")}
        >
          Withdraw to funding
        </Button>
      </div>

      {status ? (
        <p className="mt-2 text-xs text-zinc-400">{status}</p>
      ) : null}
    </Card>
  );
}
