import type { PhoenixClientBundle } from "@gcc/phoenix-client";
import { RiskGate, estimateNotionalUsd } from "@gcc/risk";
import type { PlaceOrderRequest } from "@gcc/shared";
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";

export type TradingCoreConfig = {
  rpcUrl: string;
  keypairPath?: string;
};

export type OrderBuildResult = {
  mode: PlaceOrderRequest["mode"];
  simulationOnly: boolean;
  txBase64?: string;
  message: string;
};

export class TradingCore {
  readonly connection: Connection;
  readonly risk: RiskGate;
  private keypair: Keypair | null = null;

  constructor(
    private phoenix: PhoenixClientBundle,
    config: TradingCoreConfig,
    risk?: RiskGate,
  ) {
    this.connection = new Connection(config.rpcUrl, "confirmed");
    this.risk = risk ?? new RiskGate({
      maxPositionNotionalUsd: 500,
      maxOrderNotionalUsd: 100,
      maxDailyLossUsd: 25,
      maxLeverage: 5,
      minCollateralBufferUsd: 20,
    });

    if (config.keypairPath) {
      try {
        const raw = JSON.parse(readFileSync(config.keypairPath, "utf8")) as number[];
        this.keypair = Keypair.fromSecretKey(Uint8Array.from(raw));
      } catch {
        this.keypair = null;
      }
    }
  }

  getBotPublicKey(): string | null {
    return this.keypair?.publicKey.toBase58() ?? null;
  }

  async buildOrder(
    request: PlaceOrderRequest,
    context: {
      currentPositionNotionalUsd?: number;
      collateralUsd?: number;
      leverage?: number;
      priceUsd?: number;
    } = {},
  ): Promise<OrderBuildResult> {
    const price = Number(request.priceUsd ?? context.priceUsd ?? 0);
    const size = Number(request.sizeBase);
    const notional = estimateNotionalUsd(size, price || 1);

    const riskResult = this.risk.check({
      orderNotionalUsd: notional,
      currentPositionNotionalUsd: context.currentPositionNotionalUsd ?? 0,
      dailyRealizedPnlUsd: 0,
      leverage: context.leverage ?? 1,
      collateralUsd: context.collateralUsd ?? 1000,
    });

    if (!riskResult.allowed) {
      throw new Error(riskResult.reason);
    }

    if (request.mode === "paper") {
      return {
        mode: "paper",
        simulationOnly: true,
        message: `Paper ${request.type} ${request.side} ${request.sizeBase} ${request.symbol} @ ${request.priceUsd ?? "market"}`,
      };
    }

    const authority =
      this.keypair?.publicKey.toBase58() ??
      process.env.COMPETITION_WALLET_PUBKEY ??
      "";

    if (!authority) {
      throw new Error("No authority configured for live order");
    }

    if (request.type === "limit") {
      await this.phoenix.buildLimitOrderIx({
        authority,
        symbol: request.symbol,
        side: request.side,
        priceUsd: request.priceUsd ?? "0",
        baseUnits: request.sizeBase,
      });
    } else {
      await this.phoenix.buildMarketOrderIx({
        authority,
        symbol: request.symbol,
        side: request.side,
        baseUnits: request.sizeBase,
      });
    }

    if (!this.keypair) {
      return {
        mode: "live",
        simulationOnly: true,
        message:
          "Live order instructions built. Connect Phantom/Jupiter wallet in dashboard to sign and submit.",
      };
    }

    return {
      mode: "live",
      simulationOnly: true,
      message:
        "Server keypair detected — use dashboard wallet signing for manual trades; bot live submit wiring is Phase 2 on VPS.",
    };
  }

  async simulateSerializedTx(base64: string) {
    const tx = VersionedTransaction.deserialize(Buffer.from(base64, "base64"));
    return this.connection.simulateTransaction(tx);
  }

  setKeypairFromSecret(secret: Uint8Array) {
    this.keypair = Keypair.fromSecretKey(secret);
  }

  getKeypairPublicKey(): PublicKey | null {
    return this.keypair?.publicKey ?? null;
  }
}
