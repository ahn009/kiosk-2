"use client";

import { useAlertsSocket } from "@/hooks/use-alerts-socket";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScanFace, TrendingUp, Cpu, Users, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface DashboardStats {
  scansToday: number;
  grantedToday: number;
  deniedToday: number;
  grantRate: number;
  activeKiosks: number;
  totalKiosks: number;
  enrolledEmployees: number;
  totalEmployees: number;
  lockdownActive: boolean;
  spoofAttemptsToday: number;
}

// Enhanced KPI row where the "Scans Today" card shows a live delta from the
// alerts WebSocket (increments in real-time as scan events stream in).
export function LiveKpiRow({
  stats,
  isLoading,
}: {
  stats: DashboardStats | undefined;
  isLoading: boolean;
}) {
  const { alerts } = useAlertsSocket();
  // Count live scan events (since this mount) — these are on top of the
  // server's "scansToday" baseline from the last stats refresh.
  const liveScans = alerts.filter((a) => a.type === "scan").length;
  const liveGranted = alerts.filter(
    (a) => a.type === "scan" && a.title.toLowerCase().includes("granted")
  ).length;
  const liveDenied = alerts.filter(
    (a) => a.type === "scan" && !a.title.toLowerCase().includes("granted")
  ).length;

  const baseScans = stats?.scansToday ?? 0;
  const baseGranted = stats?.grantedToday ?? 0;
  const baseDenied = stats?.deniedToday ?? 0;
  const totalScans = baseScans + liveScans;
  const totalGranted = baseGranted + liveGranted;
  const totalDenied = baseDenied + liveDenied;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Live Scans Today card with real-time delta */}
      <Card className="p-5 gap-0 hover:shadow-md transition-shadow relative overflow-hidden">
        {liveScans > 0 && (
          <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] text-success font-medium">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-success" />
            </span>
            +{liveScans} live
          </span>
        )}
        <div className="flex items-start justify-between">
          <div className="size-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
            <ScanFace className="size-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-3xl font-bold tracking-tight tabular-nums">
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <AnimatedCounter value={totalScans} />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Scans Today</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {totalGranted} granted · {totalDenied} denied
          </p>
        </div>
      </Card>

      {/* Grant Rate */}
      <StatCard
        icon={ShieldCheck}
        label="Grant Rate"
        value={isLoading ? null : formatPct(stats?.grantRate ?? 0)}
        sub="target > 90%"
        accent="success"
        loading={isLoading}
      />
      {/* Active Kiosks */}
      <StatCard
        icon={Cpu}
        label="Active Kiosks"
        value={isLoading ? null : stats?.activeKiosks ?? 0}
        sub={`of ${stats?.totalKiosks ?? 0} deployed`}
        accent="success"
        loading={isLoading}
      />
      {/* Enrolled Employees */}
      <StatCard
        icon={Users}
        label="Enrolled Employees"
        value={isLoading ? null : stats?.enrolledEmployees ?? 0}
        sub={`of ${stats?.totalEmployees ?? 0} total`}
        accent="default"
        loading={isLoading}
      />
    </div>
  );
}

function formatPct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function AnimatedCounter({ value }: { value: number }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={value}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.25 }}
        className="inline-block"
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "default",
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number | null;
  sub?: string;
  accent?: "default" | "success" | "warning" | "danger";
  loading?: boolean;
}) {
  const accentBg =
    accent === "success"
      ? "bg-success/10 text-success"
      : accent === "warning"
        ? "bg-warning/10 text-warning-foreground"
        : accent === "danger"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary";
  return (
    <Card className="p-5 gap-0 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={cn("size-10 rounded-xl flex items-center justify-center", accentBg)}>
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-4">
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </Card>
  );
}
