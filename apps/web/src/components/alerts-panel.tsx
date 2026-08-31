"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Card, Button } from "@/components/ui";
import type { TradeAlert } from "@gcc/shared";
import { useGccSocket } from "@/hooks/use-gcc-socket";
import { cn } from "@/lib/utils";

type AlertsContextValue = {
  alerts: TradeAlert[];
  notifyEnabled: boolean;
  enableNotifications: () => Promise<void>;
};

const AlertsContext = createContext<AlertsContextValue | null>(null);

function useAlertsContext() {
  const ctx = useContext(AlertsContext);
  if (!ctx) {
    throw new Error("Alerts components must be used within AlertsProvider");
  }
  return ctx;
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { alerts } = useGccSocket();
  const [notifyEnabled, setNotifyEnabled] = useState(false);

  const enableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifyEnabled(perm === "granted");
  };

  useEffect(() => {
    if (!notifyEnabled || alerts.length === 0) return;
    const latest = alerts[0];
    if (!latest) return;
    new Notification(latest.title, { body: latest.message });
  }, [alerts, notifyEnabled]);

  return (
    <AlertsContext.Provider
      value={{ alerts, notifyEnabled, enableNotifications }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

/** Compact control for the symbol picker row. */
export function AlertsControls({ className }: { className?: string }) {
  const { alerts, notifyEnabled, enableNotifications } = useAlertsContext();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="secondary"
        className="!px-2.5 !py-1.5 !text-xs whitespace-nowrap"
        onClick={() => void enableNotifications()}
      >
        {notifyEnabled ? "Pings on" : "Desktop pings"}
      </Button>
      {alerts.length > 0 ? (
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
          {alerts.length} alert{alerts.length === 1 ? "" : "s"}
        </span>
      ) : (
        <span className="hidden text-[10px] text-zinc-600 sm:inline">
          Bot + price signals
        </span>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: TradeAlert }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5">
      <p className="truncate text-xs font-medium text-zinc-100">{alert.title}</p>
      <p className="truncate text-[11px] text-zinc-400">{alert.message}</p>
    </div>
  );
}

/** Slim feed above the orderbook — no bulky enable button. */
export function AlertsFeed() {
  const { alerts } = useAlertsContext();

  return (
    <Card className="flex min-h-0 flex-col" title="Bot pings">
      <div className="max-h-28 space-y-1.5 overflow-y-auto text-sm">
        {alerts.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No pings yet. Enable desktop alerts in the header row →
          </p>
        ) : (
          alerts.slice(0, 8).map((a) => <AlertRow key={a.id} alert={a} />)
        )}
      </div>
    </Card>
  );
}

/** Full panel (bot page etc.) — self-contained when no provider. */
export function AlertsPanelStandalone() {
  const { alerts } = useGccSocket();
  const [notifyEnabled, setNotifyEnabled] = useState(false);

  const enableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifyEnabled(perm === "granted");
  };

  useEffect(() => {
    if (!notifyEnabled || alerts.length === 0) return;
    const latest = alerts[0];
    if (!latest) return;
    new Notification(latest.title, { body: latest.message });
  }, [alerts, notifyEnabled]);

  return (
    <Card className="flex h-full min-h-0 flex-col" title="Bot pings & alerts">
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => void enableNotifications()}>
          {notifyEnabled ? "Desktop alerts on" : "Enable desktop pings"}
        </Button>
        <span className="text-xs text-zinc-500">
          Bot signals + price moves → here + optional OS notification
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto text-sm">
        {alerts.length === 0 ? (
          <p className="text-zinc-500">
            No alerts yet. Start the bot or wait for price signals.
          </p>
        ) : (
          alerts.map((a) => <AlertRow key={a.id} alert={a} />)
        )}
      </div>
    </Card>
  );
}

/** @deprecated use AlertsPanelStandalone on pages without AlertsProvider */
export function AlertsPanel() {
  return <AlertsPanelStandalone />;
}
