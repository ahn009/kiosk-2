"use client";

import { useAlertsSocket, type AlertEvent } from "@/hooks/use-alerts-socket";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Radio,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  AlertTriangle,
  Cpu,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// Live audit feed: shows scan + security events as they arrive via the
// WebSocket alerts service. Filters to scan/denied/spoof/lockdown events
// (excludes test/info-only kiosk_status clear events to reduce noise —
// those still appear in the bell).

const severityConfig = {
  critical: { icon: ShieldAlert, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/40" },
  warning: { icon: AlertTriangle, color: "text-warning-foreground", bg: "bg-warning/10", border: "border-warning/40" },
  info: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10", border: "border-success/40" },
} as const;

export function LiveAuditFeed() {
  const { connected, alerts } = useAlertsSocket();

  // Show scan + security events (exclude pure kiosk_status info events)
  const feed = alerts.filter(
    (a) => a.type === "scan" || a.type === "spoof" || a.type === "lockdown" || a.type === "denied" || a.type === "supervisor_override"
  );

  return (
    <Card className="p-0 overflow-hidden h-full flex flex-col">
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
            Live Audit Stream
          </h3>
        </div>
        <Badge variant="outline" className="text-[9px] font-mono">
          <Radio className="size-2.5 mr-1" />
          {connected ? "WS connected" : "polling"}
        </Badge>
      </div>

      <ScrollArea className="flex-1 max-h-[420px]">
        {feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-2">
              <Activity className="size-5 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium">No live events</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              Scan events from kiosks will stream here in real time as they
              occur.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {feed.map((a) => (
                <FeedRow key={a.id} alert={a} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}

function FeedRow({ alert }: { alert: AlertEvent }) {
  const sev = severityConfig[alert.severity] ?? severityConfig.info;
  const Icon = alert.type === "scan" && alert.title.includes("granted")
    ? CheckCircle2
    : alert.type === "scan"
      ? XCircle
      : sev.icon;
  const granted = alert.type === "scan" && alert.title.toLowerCase().includes("granted");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10, backgroundColor: "oklch(0.6 0.2 25 / 0.08)" }}
      animate={{ opacity: 1, x: 0, backgroundColor: "transparent" }}
      transition={{ duration: 0.5 }}
      className={cn(
        "flex items-start gap-2.5 px-3 py-2 hover:bg-accent/40 transition-colors border-l-2",
        granted ? "border-success/50" : sev.border
      )}
    >
      <div className={cn("size-6 rounded-md flex items-center justify-center shrink-0 mt-0.5", granted ? "bg-success/10 text-success" : sev.bg, granted ? "" : sev.color)}>
        <Icon className="size-3" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold leading-tight truncate">{alert.title}</p>
          <span className="text-[9px] text-muted-foreground whitespace-nowrap shrink-0">
            {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: false })}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{alert.message}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {alert.kioskId && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground font-mono">
              <Cpu className="size-2" />
              {alert.kioskId}
            </span>
          )}
          {alert.employeeCode && (
            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 font-mono">
              {alert.employeeCode}
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}
