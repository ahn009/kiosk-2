"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ---------- KPI card ----------

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  accent = "default",
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "flat";
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
  const trendColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <Card className="p-5 gap-0 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "size-10 rounded-xl flex items-center justify-center",
            accentBg,
          )}
        >
          <Icon className="size-5" />
        </div>
        {trend && (
          <span className={cn("text-[11px] font-medium", trendColor)}>
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "—"} {sub ?? ""}
          </span>
        )}
      </div>
      <div className="mt-4">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-3xl font-bold tracking-tight tabular-nums">
            {value}
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        {sub && !trend && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </Card>
  );
}

// ---------- Empty state ----------

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------- View fade-in wrapper ----------

export function ViewContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("space-y-6", className)}
    >
      {children}
    </motion.div>
  );
}

// ---------- Loading skeleton table ----------

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-5" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-8" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- Simple quality bar ----------

export function ScoreBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color =
    value >= 0.85
      ? "bg-success"
      : value >= 0.7
        ? "bg-warning"
        : "bg-destructive";
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-muted overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
