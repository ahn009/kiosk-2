"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Activity,
  Radio,
  Cpu,
  HeartPulse,
  Loader2,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { KioskDTO } from "@/lib/types";

export function KioskHeartbeatMonitor({ kiosks }: { kiosks: KioskDTO[] }) {
  const qc = useQueryClient();

  const heartbeat = useMutation({
    mutationFn: () => apiClient.kiosks.heartbeat(),
    onSuccess: (data) => {
      toast.success(`Heartbeat sync · ${data.updated} kiosk${data.updated > 1 ? "s" : ""} checked in`);
      qc.invalidateQueries({ queryKey: ["kiosks"] });
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Heartbeat failed"),
  });

  const simulate = useMutation({
    mutationFn: () => apiClient.kiosks.simulate(),
    onSuccess: (data) => {
      if (data.changed) {
        toast[data.severity === "critical" ? "error" : data.severity === "warning" ? "warning" : "success"](
          data.title,
          { description: data.message }
        );
      } else {
        toast.info(data.title, { description: data.message });
      }
      qc.invalidateQueries({ queryKey: ["kiosks"] });
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Simulation failed"),
  });

  const online = kiosks.filter((k) => k.status === "online").length;
  const offline = kiosks.filter((k) => k.status === "offline").length;
  const lockdown = kiosks.filter((k) => k.status === "lockdown").length;
  const maintenance = kiosks.filter((k) => k.status === "maintenance").length;

  // "Stale" = last sync > 2 min ago
  const now = Date.now();
  const staleKiosks = kiosks.filter(
    (k) =>
      k.status === "online" &&
      (!k.lastSyncAt || now - new Date(k.lastSyncAt).getTime() > 2 * 60 * 1000)
  );

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <HeartPulse className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Heartbeat Monitor
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success" />
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {online} online · {maintenance} maintenance · {lockdown} lockdown · {offline} offline
              {staleKiosks.length > 0 && (
                <span className="text-warning-foreground"> · {staleKiosks.length} stale</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => simulate.mutate()}
            disabled={simulate.isPending}
          >
            {simulate.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Activity className="size-3.5" />
            )}
            Simulate event
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => heartbeat.mutate()}
            disabled={heartbeat.isPending}
          >
            {heartbeat.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Zap className="size-3.5" />
            )}
            Sync all
          </Button>
        </div>
      </div>

      {/* Heartbeat bars */}
      <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {kiosks.length === 0 ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          kiosks.map((k) => {
            const synced = k.lastSyncAt
              ? now - new Date(k.lastSyncAt).getTime() < 2 * 60 * 1000
              : false;
            const stale = k.status === "online" && !synced;
            return (
              <motion.div
                key={k.id}
                layout
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5",
                  stale
                    ? "border-warning/40 bg-warning/5"
                    : k.status === "online"
                      ? "border-border bg-card"
                      : "border-border bg-muted/30"
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Cpu className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-[11px] font-mono truncate">{k.kioskId}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {synced ? (
                    <span className="flex items-center gap-1 text-[10px] text-success">
                      <span className="size-1.5 rounded-full bg-success animate-pulse" />
                      synced
                    </span>
                  ) : stale ? (
                    <span className="flex items-center gap-1 text-[10px] text-warning-foreground">
                      <span className="size-1.5 rounded-full bg-warning" />
                      stale
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className={cn("size-1.5 rounded-full", statusDot(k.status))} />
                      {k.status}
                    </span>
                  )}
                  <span className="text-[9px] text-muted-foreground tabular-nums hidden sm:inline">
                    {k.lastSyncAt ? formatDistanceToNow(new Date(k.lastSyncAt), { addSuffix: false }) : "—"}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function statusDot(status: string) {
  switch (status) {
    case "online":
      return "bg-success";
    case "offline":
      return "bg-muted-foreground";
    case "maintenance":
      return "bg-warning";
    case "lockdown":
      return "bg-destructive";
    default:
      return "bg-muted-foreground";
  }
}
