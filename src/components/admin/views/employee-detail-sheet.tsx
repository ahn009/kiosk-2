"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiClient } from "@/lib/api-client";
import type { EmployeeDTO, EmployeeDetail } from "@/lib/types";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  TrendingUp,
  Zap,
  WifiOff,
  Fingerprint,
  ShieldCheck,
  CreditCard,
  Calendar,
  DoorOpen,
  Hash,
  Gauge,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  Cell,
  Legend,
} from "recharts";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function accessLevelClass(level: number) {
  if (level >= 5) return "bg-primary/15 text-primary";
  if (level >= 4) return "bg-teal-500/15 text-teal-600 dark:text-teal-400";
  if (level >= 3) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (level >= 2) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

const cardStatusClass: Record<string, string> = {
  active: "bg-success/15 text-success",
  revoked: "bg-destructive/15 text-destructive",
  lost: "bg-warning/15 text-warning-foreground",
  expired: "bg-muted text-muted-foreground",
};

function fmtDay(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yest";
  return format(d, "d/M");
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM yyyy, HH:mm");
}

function fmtRelative(iso: string | null | undefined) {
  if (!iso) return "Never";
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function EmployeeDetailSheet({
  employee,
  detail,
  open,
  onOpenChange,
}: {
  employee: EmployeeDTO | null;
  detail: EmployeeDetail | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["employee-stats", employee?.id],
    queryFn: () => apiClient.employees.stats(employee!.id),
    enabled: !!employee?.id && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto scrollbar-thin p-0">
        <SheetHeader className="px-6 pt-6 pb-4 bg-gradient-to-b from-primary/8 to-transparent border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <Avatar className="size-12 border-2 border-background shadow-md shrink-0">
              {employee?.photoUrl && (
                <AvatarImage
                  src={employee.photoUrl}
                  alt={employee.fullName}
                />
              )}
              <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                {employee ? initials(employee.fullName) : "—"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg font-semibold truncate block">
                {employee?.fullName ?? "—"}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground font-mono block">
                {employee?.employeeCode ?? "—"} · Access history & analytics
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {employee && (
          <div className="px-6 py-5 space-y-6">
            {/* Profile badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("text-[11px] font-medium", accessLevelClass(employee.accessLevel))}
              >
                <ShieldCheck className="size-3 mr-1" />
                Access Level {employee.accessLevel}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-[11px] font-medium capitalize", cardStatusClass[employee.cardStatus])}
              >
                <CreditCard className="size-3 mr-1" />
                Card {employee.cardStatus}
              </Badge>
              {employee.faceEnrolled ? (
                <Badge variant="outline" className="text-[11px] font-medium text-success">
                  <Fingerprint className="size-3 mr-1" />
                  Face enrolled
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
                  <Fingerprint className="size-3 mr-1" />
                  Not enrolled
                </Badge>
              )}
              <Badge variant="outline" className="text-[11px] font-medium">
                <DoorOpen className="size-3 mr-1" />
                {employee.departmentName ?? "No dept"}
              </Badge>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={Activity}
                label="Total scans"
                value={isLoading ? null : stats?.totalScans ?? 0}
                accent="default"
              />
              <StatCard
                icon={TrendingUp}
                label="Grant rate"
                value={
                  isLoading
                    ? null
                    : `${((stats?.grantRate ?? 0) * 100).toFixed(0)}%`
                }
                accent="success"
              />
              <StatCard
                icon={Gauge}
                label="Avg score"
                value={
                  isLoading
                    ? null
                    : `${((stats?.avgMatchScore ?? 0) * 100).toFixed(0)}%`
                }
                accent="default"
              />
              <StatCard
                icon={Zap}
                label="Avg latency"
                value={
                  isLoading ? null : `${((stats?.avgLatencyMs ?? 0) / 1000).toFixed(1)}s`
                }
                accent="default"
              />
            </div>

            {/* Daily scans chart */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Activity className="size-4 text-primary" />
                  Scan activity
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  Last 30 days
                </span>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 h-48">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats?.daily ?? []}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="g-granted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.7 0.17 152)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="oklch(0.7 0.17 152)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="g-denied" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.66 0.2 25)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="oklch(0.66 0.2 25)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={fmtDay}
                        tick={{ fontSize: 10 }}
                        interval={5}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10 }}
                        className="text-muted-foreground"
                      />
                      <RTooltip
                        contentStyle={{
                          fontSize: 11,
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "var(--popover)",
                        }}
                        labelFormatter={(l) => format(new Date(l as string), "d MMM yyyy")}
                      />
                      <Area
                        type="monotone"
                        dataKey="granted"
                        stackId="1"
                        stroke="oklch(0.6 0.16 152)"
                        fill="url(#g-granted)"
                        name="Granted"
                        strokeWidth={1.5}
                      />
                      <Area
                        type="monotone"
                        dataKey="denied"
                        stackId="1"
                        stroke="oklch(0.58 0.22 25)"
                        fill="url(#g-denied)"
                        name="Denied"
                        strokeWidth={1.5}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            {/* Per-kiosk breakdown */}
            <section>
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <DoorOpen className="size-4 text-primary" />
                By kiosk
              </h3>
              <div className="rounded-xl border border-border bg-card p-3 h-44">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (stats?.byKiosk ?? []).length === 0 ? (
                  <EmptyMini text="No kiosk scans in this period" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats?.byKiosk ?? []}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="kioskId" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <RTooltip
                        contentStyle={{
                          fontSize: 11,
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "var(--popover)",
                        }}
                      />
                      <Bar dataKey="granted" stackId="a" fill="oklch(0.6 0.16 152)" name="Granted" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="denied" stackId="a" fill="oklch(0.58 0.22 25)" name="Denied" radius={[4, 4, 0, 0]} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            {/* Metadata grid */}
            <section className="grid grid-cols-2 gap-3 text-sm">
              <MetaRow
                icon={Hash}
                label="Designation"
                value={employee.designation ?? "—"}
              />
              <MetaRow
                icon={Calendar}
                label="Card expires"
                value={fmtDateTime(employee.cardExpiresAt)}
              />
              <MetaRow
                icon={Clock}
                label="Last scan"
                value={
                  detail ? fmtRelative(detail.lastScanAt) : "—"
                }
              />
              <MetaRow
                icon={WifiOff}
                label="Offline scans"
                value={isLoading ? "…" : `${stats?.offlineCount ?? 0}`}
              />
            </section>

            <Separator />

            {/* Recent scans timeline */}
            <section>
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                <Clock className="size-4 text-primary" />
                Recent scans
              </h3>
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : (stats?.recent ?? []).length === 0 ? (
                <EmptyMini text="No scans in the last 30 days" />
              ) : (
                <div className="relative pl-5 space-y-2.5">
                  <div className="absolute left-1.5 top-1.5 bottom-1.5 w-px bg-border" />
                  {(stats?.recent ?? []).map((s, i) => {
                    const granted = s.decision === "granted";
                    return (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="relative"
                      >
                        <span
                          className={cn(
                            "absolute -left-[14px] top-3.5 size-2.5 rounded-full border-2 border-background",
                            granted ? "bg-success" : "bg-destructive"
                          )}
                        />
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {granted ? (
                              <CheckCircle2 className="size-4 text-success shrink-0" />
                            ) : (
                              <XCircle className="size-4 text-destructive shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold capitalize">
                                {s.decision.replace("_", " ")}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {s.kioskId}
                                {s.faceMatchScore != null && (
                                  <> · {(s.faceMatchScore * 100).toFixed(0)}% match</>
                                )}
                                {s.latencyMs != null && (
                                  <> · {(s.latencyMs / 1000).toFixed(1)}s</>
                                )}
                                {s.offline && (
                                  <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0 h-3">
                                    offline
                                  </Badge>
                                )}
                              </p>
                            </div>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap cursor-help">
                                  {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-[11px]">
                                {format(new Date(s.createdAt), "d MMM yyyy, HH:mm:ss")}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>

            {detail?.cardTokenHash && (
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                  <Hash className="size-2.5" /> Card token hash (SHA-256)
                </p>
                <code className="text-[10px] font-mono break-all text-muted-foreground">
                  {detail.cardTokenHash}
                </code>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = "default",
}: {
  icon: typeof Activity;
  label: string;
  value: string | number | null;
  accent?: "default" | "success" | "warning";
}) {
  const color =
    accent === "success"
      ? "text-success"
      : accent === "warning"
        ? "text-warning-foreground"
        : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-1">
        <Icon className={cn("size-3.5", color)} />
      </div>
      <div className="text-xl font-bold tabular-nums leading-none">
        {value === null ? (
          <Skeleton className="h-5 w-10" />
        ) : (
          value
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-2.5">
      <Icon className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-xs font-medium mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <Activity className="size-6 text-muted-foreground/40 mb-1.5" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
