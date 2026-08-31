import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BotConfig, PaperPositionSide, PaperTradeRecord, TradeAlert } from "@gcc/shared";

const DATA_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../data",
);
const STORE_FILE = resolve(DATA_DIR, "paper-trades.json");

export type PaperPortfolioSnapshot = {
  startingBalanceUsdc: number;
  balanceUsdc: number;
  fundingBalanceUsdc?: number;
  tradingCapUsdc?: number;
  positionSide: PaperPositionSide;
  positionSymbol?: string | null;
  positionSource?: "manual" | "bot" | null;
  positionSizeBase: number;
  entryPriceUsd: number | null;
  leverage: number;
};

/** Persisted so the bot auto-resumes after API server restarts (tsx watch, deploy, crash). */
export type BotArmSnapshot = {
  armed: true;
  watchSymbol: string;
  config: Omit<BotConfig, "status">;
};

export type PaperStoreSnapshot = {
  trades: PaperTradeRecord[];
  /** Older fills kept when arming overnight or resetting bankroll — never lost on re-arm. */
  historyTrades?: PaperTradeRecord[];
  portfolio: PaperPortfolioSnapshot | null;
  savedAt: string;
  arm?: BotArmSnapshot | null;
  savedAlerts?: TradeAlert[];
};

export function mergeTradeHistory(
  existing: PaperTradeRecord[],
  incoming: PaperTradeRecord[],
): PaperTradeRecord[] {
  const byId = new Map<string, PaperTradeRecord>();
  for (const t of existing) byId.set(t.id, t);
  for (const t of incoming) byId.set(t.id, t);
  return [...byId.values()].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

function ensureDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

export function loadPaperStore(): PaperStoreSnapshot {
  try {
    ensureDir();
    const raw = readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<PaperStoreSnapshot>;
    return {
      trades: Array.isArray(parsed.trades) ? parsed.trades : [],
      historyTrades: Array.isArray(parsed.historyTrades)
        ? parsed.historyTrades
        : [],
      portfolio: parsed.portfolio ?? null,
      savedAt: parsed.savedAt ?? new Date().toISOString(),
      arm: parsed.arm?.armed === true ? parsed.arm : null,
      savedAlerts: Array.isArray(parsed.savedAlerts) ? parsed.savedAlerts : [],
    };
  } catch {
    return {
      trades: [],
      historyTrades: [],
      portfolio: null,
      savedAt: new Date().toISOString(),
      savedAlerts: [],
    };
  }
}

export function savePaperStore(snapshot: PaperStoreSnapshot) {
  ensureDir();
  const payload: PaperStoreSnapshot = {
    trades: snapshot.trades.slice(0, 500),
    historyTrades: (snapshot.historyTrades ?? []).slice(-500),
    portfolio: snapshot.portfolio,
    savedAt: new Date().toISOString(),
    arm: snapshot.arm ?? null,
    savedAlerts: (snapshot.savedAlerts ?? []).slice(0, 50),
  };
  writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), "utf8");
}

export function clearPaperStore(options?: { wipeHistory?: boolean }) {
  const prev = loadPaperStore();
  savePaperStore({
    trades: [],
    historyTrades: options?.wipeHistory ? [] : (prev.historyTrades ?? []),
    portfolio: null,
    savedAt: new Date().toISOString(),
    arm: null,
    savedAlerts: options?.wipeHistory ? [] : (prev.savedAlerts ?? []),
  });
}

/** @deprecated use loadPaperStore */
export function loadPaperTrades(): PaperTradeRecord[] {
  return loadPaperStore().trades;
}

/** @deprecated use savePaperStore */
export function savePaperTrades(trades: PaperTradeRecord[]) {
  savePaperStore({ trades, portfolio: null, savedAt: new Date().toISOString() });
}

/** @deprecated use clearPaperStore */
export function clearPaperTrades() {
  clearPaperStore();
}
