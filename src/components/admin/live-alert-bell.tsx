"use client";

import { useAlertsSocket, type AlertEvent } from "@/hooks/use-alerts-socket";
import { motion, AnimatePresence } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Info,
  X,
  Radio,
  Cpu,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const severityConfig = {
  critical: {
    icon: ShieldAlert,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-warning-foreground",
    bg: "bg-warning/10",
    border: "border-warning/30",
  },
  info: {
    icon: Info,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
  },
} as const;

export function LiveAlertBell() {
  const { connected, alerts, clear } = useAlertsSocket();
  const unread = alerts.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 p-0 rounded-full"
          aria-label={`Live alerts (${unread})`}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center animate-pulse">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
          {connected && (
            <span className="absolute bottom-1 right-1 size-1.5 rounded-full bg-success ring-1 ring-background" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-card">
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
            <span className="text-sm font-semibold">Live Alerts</span>
            {connected ? (
              <Badge variant="outline" className="text-[9px] text-success">
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] text-muted-foreground">
                Polling
              </Badge>
            )}
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clear}>
              Clear
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <CheckCircle2 className="size-8 text-success/50 mb-2" />
              <p className="text-sm font-medium">All clear</p>
              <p className="text-xs text-muted-foreground mt-1">
                No recent security alerts. Denied scans, spoof attempts, and
                lockdowns will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {alerts.map((a) => (
                  <AlertRow key={a.id} alert={a} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
        {alerts.length > 0 && (
          <div className="border-t border-border px-3 py-2 bg-card flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Radio className="size-2.5" />
              WebSocket /?XTransformPort=3003
            </span>
            <span className="text-[10px] text-muted-foreground">
              {alerts.length} event{alerts.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function AlertRow({ alert }: { alert: AlertEvent }) {
  const cfg = severityConfig[alert.severity] ?? severityConfig.info;
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 8, backgroundColor: "oklch(0.6 0.2 25 / 0.08)" }}
      animate={{ opacity: 1, x: 0, backgroundColor: "transparent" }}
      transition={{ duration: 0.4 }}
      className={cn("flex items-start gap-2.5 px-3 py-2.5 hover:bg-accent/50 transition-colors", cfg.border, "border-l-2")}
    >
      <div className={cn("size-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", cfg.bg, cfg.color)}>
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold leading-tight">{alert.title}</p>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
            {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: false })}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
          {alert.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {alert.kioskId && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground font-mono">
              <Cpu className="size-2.5" />
              {alert.kioskId}
            </span>
          )}
          {alert.employeeCode && (
            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 font-mono">
              {alert.employeeCode}
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}
