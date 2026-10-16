"use client";

import { useAlertsSocket, type AlertEvent } from "@/hooks/use-alerts-socket";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Cpu,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";

// Real-time scan activity ticker for the dashboard. Subscribes to the alerts
// WebSocket, counts live scan events, and shows a scrolling ticker of the
// most recent ones. Gives the dashboard a "live ops" feel between the 30s
// stats refreshes.
export function DashboardScanTicker() {
  const { connected, alerts } = useAlertsSocket();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Only scan + security events (not kiosk_status info heartbeats)
  const live = alerts.filter(
    (a) =>
      (a.type === "scan" || a.type === "spoof" || a.type === "lockdown") &&
      !dismissed.has(a.id)
  );

  const scansToday = live.filter((a) => a.type === "scan").length;
  const granted = live.filter(
    (a) => a.type === "scan" && a.title.toLowerCase().includes("granted")
  ).length;
  const denied = live.filter(
    (a) => a.type === "scan" && !a.title.toLowerCase().includes("granted")
  ).length;
  const criticalEvents = live.filter((a) => a.severity === "critical").length;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            {connected && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            )}
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                connected ? "bg-success" : "bg-muted-foreground"
              )}
            />
          </span>
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Activity className="size-3.5 text-primary" />
            Live Activity
          </h3>
          {connected ? (
            <Badge variant="outline" className="text-[9px] text-success">
              Real-time
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] text-muted-foreground">
              Polling
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3 text-success" />
            <span className="font-semibold tabular-nums">{granted}</span>
            <span className="text-muted-foreground hidden sm:inline">granted</span>
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="size-3 text-destructive" />
            <span className="font-semibold tabular-nums">{denied}</span>
            <span className="text-muted-foreground hidden sm:inline">denied</span>
          </span>
          {criticalEvents > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <ShieldAlert className="size-3" />
              <span className="font-semibold tabular-nums">{criticalEvents}</span>
            </span>
          )}
        </div>
      </div>

      <div className="max-h-32 overflow-y-auto scrollbar-thin">
        {live.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            <TrendingUp className="size-6 text-muted-foreground/40 mb-1.5" />
            <p className="text-xs text-muted-foreground">
              Waiting for live scan events…
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Scans from kiosks will stream here in real time
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            <AnimatePresence initial={false}>
              {live.slice(0, 8).map((a) => {
                const granted = a.type === "scan" && a.title.toLowerCase().includes("granted");
                const critical = a.severity === "critical";
                return (
                  <motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, height: 0, backgroundColor: critical ? "oklch(0.6 0.2 25 / 0.08)" : "oklch(0.6 0.16 152 / 0.06)" }}
                    animate={{ opacity: 1, height: "auto", backgroundColor: "transparent" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4 }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 border-l-2",
                      critical
                        ? "border-destructive"
                        : granted
                          ? "border-success/50"
                          : "border-warning/50"
                    )}
                  >
                    <div
                      className={cn(
                        "size-5 rounded flex items-center justify-center shrink-0",
                        critical
                          ? "bg-destructive/10 text-destructive"
                          : granted
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning-foreground"
                      )}
                    >
                      {granted ? (
                        <CheckCircle2 className="size-3" />
                      ) : critical ? (
                        <ShieldAlert className="size-3" />
                      ) : (
                        <XCircle className="size-3" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium leading-tight truncate">
                        {a.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {a.message.split("·")[0]?.trim() ?? a.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.kioskId && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground font-mono">
                          <Cpu className="size-2" />
                          {a.kioskId}
                        </span>
                      )}
                      <span className="text-[9px] text-muted-foreground tabular-nums">
                        {formatDistanceToNow(new Date(a.timestamp), { addSuffix: false })}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Card>
  );
}
