"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useAlertsSocket, type AlertEvent } from "@/hooks/use-alerts-socket";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { KioskDTO } from "@/lib/types";
import {
  Cpu,
  MapPin,
  Activity,
  Zap,
  Gauge,
  TrendingUp,
  WifiOff,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  SlidersHorizontal,
  Users,
  ShieldCheck,
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

function fmtDay(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yest";
  return format(d, "d/M");
}

const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
  online: { label: "Online", cls: "text-success", dot: "bg-success" },
  offline: { label: "Offline", cls: "text-muted-foreground", dot: "bg-muted-foreground" },
  maintenance: { label: "Maintenance", cls: "text-warning-foreground", dot: "bg-warning" },
  lockdown: { label: "Lockdown", cls: "text-destructive", dot: "bg-destructive" },
};

export function KioskDetailSheet({
  kiosk,
  open,
  onOpenChange,
}: {
  kiosk: KioskDTO | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["kiosk-stats", kiosk?.id],
    queryFn: () => apiClient.kiosks.stats(kiosk!.id),
    enabled: !!kiosk?.id && open,
  });

  // Local overrides for thresholds; fall back to stats values.
  const [grantOverride, setGrantOverride] = useState<number | null>(null);
  const [modeOverride, setModeOverride] = useState<string | null>(null);
  const grantT = grantOverride ?? stats?.thresholds.granted ?? 0.85;
  const challengeT = stats?.thresholds.challenge ?? 0.6;
  const mode = modeOverride ?? stats?.challengeMode ?? "liveness";

  const dirty =
    grantT !== (stats?.thresholds.granted ?? grantT) ||
    mode !== (stats?.challengeMode ?? mode);

  const reset = () => {
    setGrantOverride(null);
    setModeOverride(null);
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      apiClient.kiosks.update(kiosk!.id, {
        thresholdGranted: grantT,
        thresholdChallenge: challengeT,
        challengeMode: mode,
      }),
    onSuccess: () => {
      toast.success(`Thresholds saved to ${kiosk!.kioskId}`);
      setGrantOverride(null);
      setModeOverride(null);
      qc.invalidateQueries({ queryKey: ["kiosk-stats", kiosk?.id] });
      qc.invalidateQueries({ queryKey: ["kiosks"] });
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Failed to save thresholds"),
  });

  if (!kiosk) return null;
  const sc = statusConfig[kiosk.status] ?? statusConfig.online;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto scrollbar-thin p-0">
        <SheetHeader className="px-6 pt-6 pb-4 bg-gradient-to-b from-primary/8 to-transparent border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Cpu className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg font-semibold block truncate">
                {kiosk.name}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground font-mono block">
                {kiosk.kioskId} · {kiosk.location ?? "No location"}
              </SheetDescription>
            </div>
            <Badge variant="outline" className={cn("text-[11px]", sc.cls)}>
              <span className={cn("size-1.5 rounded-full mr-1", sc.dot)} />
              {sc.label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="px-6 py-5 space-y-6">
          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KioskStat icon={Activity} label="Total scans" value={isLoading ? null : stats?.totalScans ?? 0} />
            <KioskStat icon={TrendingUp} label="Grant rate" value={isLoading ? null : `${((stats?.grantRate ?? 0) * 100).toFixed(0)}%`} accent="success" />
            <KioskStat icon={Zap} label="P95 latency" value={isLoading ? null : `${((stats?.p95LatencyMs ?? 0) / 1000).toFixed(1)}s`} />
            <KioskStat icon={WifiOff} label="Offline" value={isLoading ? null : stats?.offlineCount ?? 0} />
          </div>

          {/* Sync info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-card p-2.5 flex items-center gap-2.5">
              <Radio className="size-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last sync</p>
                <p className="text-xs font-medium truncate">
                  {stats?.lastSyncAt ? formatDistanceToNow(new Date(stats.lastSyncAt), { addSuffix: true }) : "Never"}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5 flex items-center gap-2.5">
              <ShieldCheck className="size-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CRL version</p>
                <p className="text-xs font-medium">v{stats?.crlVersion ?? "—"}</p>
              </div>
            </div>
          </div>

          {/* Daily scan activity */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Activity className="size-4 text-primary" />
                Scan activity
              </h3>
              <span className="text-[11px] text-muted-foreground">Last 30 days</span>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 h-48">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.daily ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="kg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.7 0.17 152)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="oklch(0.7 0.17 152)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="kd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.66 0.2 25)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="oklch(0.66 0.2 25)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 10 }} interval={5} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)" }} labelFormatter={(l) => format(new Date(l as string), "d MMM yyyy")} />
                    <Area type="monotone" dataKey="granted" stackId="1" stroke="oklch(0.6 0.16 152)" fill="url(#kg)" name="Granted" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="denied" stackId="1" stroke="oklch(0.58 0.22 25)" fill="url(#kd)" name="Denied" strokeWidth={1.5} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* Match score distribution */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <Gauge className="size-4 text-primary" />
              Match score distribution
            </h3>
            <div className="rounded-xl border border-border bg-card p-3 h-40">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.scoreDistribution ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="bin" tick={{ fontSize: 9 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)" }} />
                    <Bar dataKey="count" name="Scans" radius={[3, 3, 0, 0]}>
                      {(stats?.scoreDistribution ?? []).map((b, i) => (
                        <Cell key={i} fill="oklch(0.6 0.16 152)" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
              <span>Avg score: {((stats?.avgMatchScore ?? 0) * 100).toFixed(0)}%</span>
              <span>·</span>
              <span>Avg latency: {((stats?.avgLatencyMs ?? 0) / 1000).toFixed(1)}s</span>
            </p>
          </section>

          {/* Top employees */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <Users className="size-4 text-primary" />
              Top employees
            </h3>
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (stats?.topEmployees ?? []).length === 0 ? (
              <Card className="p-4 text-center text-xs text-muted-foreground">
                No scans in this period
              </Card>
            ) : (
              <div className="space-y-1.5">
                {(stats?.topEmployees ?? []).map((e, i) => (
                  <div key={e.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}</span>
                    <Avatar className="size-7">
                      {e.photoUrl && <AvatarImage src={e.photoUrl} alt={e.fullName} />}
                      <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                        {e.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{e.fullName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{e.employeeCode}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{e.scanCount} scans</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Threshold config */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <SlidersHorizontal className="size-4 text-primary" />
              Threshold configuration
            </h3>
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Grant threshold (T_granted)</Label>
                  <span className="text-sm font-mono font-semibold text-success tabular-nums">{grantT.toFixed(2)}</span>
                </div>
                <Slider value={[grantT]} onValueChange={([v]) => setGrantOverride(v)} min={0.5} max={0.99} step={0.01} />
                <p className="text-[10px] text-muted-foreground">Scores ≥ this value → GRANT. Target FAR ≤ 0.001%.</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Challenge threshold (T_challenge)</Label>
                  <span className="text-sm font-mono font-semibold text-warning-foreground tabular-nums">{challengeT.toFixed(2)}</span>
                </div>
                <Slider value={[challengeT]} onValueChange={() => {}} min={0.4} max={0.95} step={0.01} disabled={true} />
                <p className="text-[10px] text-muted-foreground">Between this and T_granted → run challenge-response. Target FRR ≤ 2%.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Challenge mode</Label>
                <Select value={mode} onValueChange={setModeOverride}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="liveness">Liveness (silent)</SelectItem>
                    <SelectItem value="challenge">Challenge-response</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg border border-border">
                <div>
                  <p className="text-xs font-medium">Status</p>
                  <p className="text-[10px] text-muted-foreground">Online · accepting scans</p>
                </div>
                <Switch checked={kiosk.status === "online"} disabled />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1"
                  disabled={!dirty || updateMutation.isPending}
                  onClick={reset}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={updateMutation.isPending || !dirty}
                  onClick={() => updateMutation.mutate()}
                >
                  {updateMutation.isPending ? <Skeleton className="h-4 w-20" /> : "Save configuration"}
                </Button>
              </div>
            </div>
          </section>

          {/* Live scans (real-time WebSocket stream) */}
          <LiveKioskScans kioskId={kiosk.kioskId} />

          {/* Recent scans */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <Clock className="size-4 text-primary" />
              Recent scans (last 30 days)
            </h3>
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (stats?.recent ?? []).length === 0 ? (
              <Card className="p-6 text-center text-xs text-muted-foreground">
                No scans in the last 30 days
              </Card>
            ) : (
              <div className="space-y-1.5">
                {(stats?.recent ?? []).map((s, i) => {
                  const granted = s.decision === "granted";
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5"
                    >
                      {granted ? (
                        <CheckCircle2 className="size-3.5 text-success shrink-0" />
                      ) : (
                        <XCircle className="size-3.5 text-destructive shrink-0" />
                      )}
                      <span className="text-xs font-semibold capitalize">{s.decision.replace("_", " ")}</span>
                      {s.faceMatchScore != null && (
                        <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                          {(s.faceMatchScore * 100).toFixed(0)}%
                        </span>
                      )}
                      {s.latencyMs != null && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {(s.latencyMs / 1000).toFixed(1)}s
                        </span>
                      )}
                      {s.offline && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">offline</Badge>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function KioskStat({
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
  const color = accent === "success" ? "text-success" : accent === "warning" ? "text-warning-foreground" : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <Icon className={cn("size-3.5 mb-1.5", color)} />
      <div className="text-xl font-bold tabular-nums leading-none">
        {value === null ? <Skeleton className="h-5 w-10" /> : value}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// Live scan stream for a specific kiosk via the WebSocket alerts service.
function LiveKioskScans({ kioskId }: { kioskId: string }) {
  const { connected, alerts } = useAlertsSocket();
  // Filter to scan events for THIS kiosk
  const live = alerts.filter(
    (a) => a.type === "scan" && a.kioskId === kioskId
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Activity className="size-4 text-primary" />
          Live scans
        </h3>
        <span className="flex items-center gap-1.5">
          <span className="relative flex size-1.5">
            {connected && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            )}
            <span
              className={cn(
                "relative inline-flex size-1.5 rounded-full",
                connected ? "bg-success" : "bg-muted-foreground"
              )}
            />
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {connected ? "WS live" : "polling"}
          </span>
        </span>
      </div>
      {live.length === 0 ? (
        <Card className="p-4 text-center">
          <Radio className="size-5 text-muted-foreground/60 mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">
            No live scan events yet · scans from {kioskId} will stream here in
            real time
          </p>
        </Card>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
          <AnimatePresence initial={false}>
            {live.slice(0, 12).map((a) => {
              const granted = a.title.toLowerCase().includes("granted");
              return (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, x: -10, backgroundColor: "oklch(0.6 0.2 25 / 0.08)" }}
                  animate={{ opacity: 1, x: 0, backgroundColor: "transparent" }}
                  transition={{ duration: 0.5 }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 border-l-2",
                    granted ? "border-success/50" : "border-destructive/40"
                  )}
                >
                  {granted ? (
                    <CheckCircle2 className="size-3.5 text-success shrink-0" />
                  ) : (
                    <XCircle className="size-3.5 text-destructive shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-tight truncate">
                      {a.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {a.employeeCode ?? "Unknown"} · {a.message.split("·")[2]?.trim() ?? ""}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
