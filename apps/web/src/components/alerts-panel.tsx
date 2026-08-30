"use client";

import { useEffect, useState } from "react";
import { Card, Button } from "@/components/ui";
import type { TradeAlert } from "@gcc/shared";
import { useGccSocket } from "@/hooks/use-gcc-socket";

export function AlertsPanel() {
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
    <Card title="Bot pings & alerts">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => void enableNotifications()}>
          {notifyEnabled ? "Desktop alerts on" : "Enable desktop pings"}
        </Button>
        <span className="text-xs text-zinc-500">
          Bot signals + price moves → here + optional OS notification
        </span>
      </div>
      <div className="max-h-48 space-y-2 overflow-y-auto text-sm">
        {alerts.length === 0 ? (
          <p className="text-zinc-500">No alerts yet. Start the bot or wait for price signals.</p>
        ) : (
          alerts.map((a: TradeAlert) => (
            <div
              key={a.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
            >
              <p className="font-medium text-zinc-100">{a.title}</p>
              <p className="text-xs text-zinc-400">{a.message}</p>
              <p className="mt-1 text-[10px] text-zinc-600">{a.at}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
