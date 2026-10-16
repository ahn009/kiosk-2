"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Activity,
  ShieldCheck,
  Cpu,
  Users,
  Lock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ScanFace,
  ShieldAlert,
  ArrowRight,
  Clock,
  Radio,
  FileSearch,
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
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/lib/store";
import { apiClient } from "@/lib/api-client";
import { DashboardScanTicker } from "@/components/admin/dashboard-scan-ticker";
import { LiveKpiRow } from "@/components/admin/live-kpi-row";
import {
  ViewContainer,
  EmptyState,
  ScoreBar,
} from "../lib/ui-bits";
import {
  decisionClass,
  formatPct,
  formatTime,
  formatNumber,
} from "../lib/admin-utils";

export function DashboardView() {
  const admin = useAppStore((s) => s.admin);
  const role = admin?.role ?? "viewer";
  const { data: stats, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiClient.dashboard.stats(),
    refetchInterval: 30_000,
  });

  const setSection = useAppStore((s) => s.setAdminSection);

  // Role config: each role sees a different dashboard emphasis
  const roleConfig: Record<string, { label: string; focus: string; accent: string; cta?: { label: string; section: "employees" | "enrollment" | "security" | "kiosks" | "audit" | "calibration" } }> = {
    superadmin: { label: "Super Admin", focus: "Full system control · manage employees, kiosks, security, and calibration.", accent: "from-primary/15 to-transparent" },
    security_officer: { label: "Security Officer", focus: "Monitor threats, manage lockdowns, review the audit trail and SIEM webhooks.", accent: "from-destructive/10 to-transparent", cta: { label: "Open Security Center", section: "security" } },
    hr_admin: { label: "HR Administrator", focus: "Manage employees, enroll faces, issue and revoke access cards.", accent: "from-emerald-500/10 to-transparent", cta: { label: "Manage Employees", section: "employees" } },
    viewer: { label: "Viewer", focus: "Read-only overview · scan metrics, kiosk health, and recent denials.", accent: "from-muted to-transparent" },
  };
  const rc = roleConfig[role] ?? roleConfig.viewer;

  // Live clock
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hourData =
    stats?.scansByHour.map((h) => ({
      hour: `${String(h.hour).padStart(2, "0")}:00`,
      scans: h.count,
    })) ?? [];

  const kioskData =
    stats?.scansByKiosk.map((k) => ({
      name: k.name,
      granted: Math.max(0, k.count - k.denied),
      denied: k.denied,
      total: k.count,
    })) ?? [];

  return (
    <ViewContainer>
      {/* Live status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-gradient-to-r from-primary/5 via-card to-card px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <span className="text-sm font-medium">Live</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Auto-refreshing every 30s
          </span>
        </div>
        <div className="flex items-center gap-4">
          {dataUpdatedAt && (
            <span className="text-[11px] text-muted-foreground hidden md:flex items-center gap-1.5">
              <Radio className="size-3" />
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <span className="text-sm font-mono tabular-nums flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground" />
            {now.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Role banner */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-gradient-to-r ${rc.accent} px-4 py-3`}
      >
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-background/80 flex items-center justify-center shrink-0">
            <ShieldCheck className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {admin?.name ?? "User"} <span className="text-muted-foreground font-normal">· {rc.label}</span>
            </p>
            <p className="text-xs text-muted-foreground">{rc.focus}</p>
          </div>
        </div>
        {rc.cta && (
          <Button size="sm" variant="outline" onClick={() => setSection(rc.cta!.section)}>
            {rc.cta.label}
            <ArrowRight className="size-3.5" />
          </Button>
        )}
      </motion.div>

      {/* Lockdown banner */}
      {stats?.lockdownActive && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
        >
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                <Lock className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-destructive">
                  LOCKDOWN ACTIVE — all access verification is suspended
                </p>
                <p className="text-xs text-muted-foreground">
                  All kiosks are operating in lockdown mode. Initiate clear from the Security Center.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setSection("security")}
              >
                Open Security Center
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Live KPI row (real-time scan counter via alerts socket) */}
      <LiveKpiRow stats={stats} isLoading={isLoading} />

      {/* Live activity ticker */}
      <DashboardScanTicker />

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-primary" />
              Scans by Hour
            </CardTitle>
            <CardDescription>Last 24 hours · all kiosks aggregated</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : hourData.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No scans in the last 24h"
                description="Scan activity will appear here once kiosks start processing access attempts."
              />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={hourData} margin={{ left: -16, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="scansGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.58 0.14 162)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="oklch(0.58 0.14 162)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0.01 160 / 0.15)" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: "oklch(0.5 0.02 160)" }}
                    interval={3}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "oklch(0.5 0.02 160)" }}
                    allowDecimals={false}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "oklch(0.19 0.018 165)",
                      border: "1px solid oklch(1 0 0 / 10%)",
                      borderRadius: "0.5rem",
                      color: "oklch(0.96 0.01 160)",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="scans"
                    stroke="oklch(0.58 0.14 162)"
                    fill="url(#scansGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="size-4 text-primary" />
              Scans by Kiosk
            </CardTitle>
            <CardDescription>Granted vs denied — last 24h</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : kioskData.length === 0 ? (
              <EmptyState icon={Cpu} title="No kiosk activity" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={kioskData} margin={{ left: -16, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0.01 160 / 0.15)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "oklch(0.5 0.02 160)" }}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "oklch(0.5 0.02 160)" }}
                    allowDecimals={false}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "oklch(0.19 0.018 165)",
                      border: "1px solid oklch(1 0 0 / 10%)",
                      borderRadius: "0.5rem",
                      color: "oklch(0.96 0.01 160)",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px" }}
                    iconType="circle"
                  />
                  <Bar dataKey="granted" stackId="a" name="Granted" fill="oklch(0.6 0.16 152)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="denied" stackId="a" name="Denied" fill="oklch(0.62 0.18 25)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FAR / FRR / Spoof row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                False Accept Rate
              </p>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : stats?.far == null ? (
                  <span className="text-muted-foreground text-lg">not measured</span>
                ) : (
                  formatPct(stats.far)
                )}
              </div>
            </div>
            <div className="size-9 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Spoofed tokens admitted · target &lt; 0.01%
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                False Reject Rate
              </p>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {isLoading ? <Skeleton className="h-8 w-16" /> : formatPct(stats?.frr ?? 0)}
              </div>
            </div>
            <div
              className={`size-9 rounded-lg flex items-center justify-center ${
                (stats?.frr ?? 0) > 0.05
                  ? "bg-warning/10 text-warning-foreground"
                  : "bg-success/10 text-success"
              }`}
            >
              <TrendingDown className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Legitimate users denied · target &lt; 5%
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Spoof Attempts Today
              </p>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {isLoading ? <Skeleton className="h-8 w-16" /> : formatNumber(stats?.spoofAttemptsToday ?? 0)}
              </div>
            </div>
            <div className="size-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
              <ShieldAlert className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Paper / screen / mask attacks blocked by liveness
          </p>
        </Card>
      </div>

      {/* Recent denials */}
      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-warning" />
                Recent Denials
              </CardTitle>
              <CardDescription className="mt-1">
                Last 5 denied access attempts today
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSection("audit")}>
              View full audit
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full mt-2" />
              <Skeleton className="h-8 w-full mt-2" />
            </div>
          ) : !stats?.recentDenials || stats.recentDenials.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No denials today"
              description="Access verification is operating normally — no recent denials to review."
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="text-left font-medium py-2 px-4">Time</th>
                    <th className="text-left font-medium py-2 px-4">Kiosk</th>
                    <th className="text-left font-medium py-2 px-4">Employee</th>
                    <th className="text-left font-medium py-2 px-4">Decision</th>
                    <th className="text-left font-medium py-2 px-4">Face</th>
                    <th className="text-left font-medium py-2 px-4">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentDenials.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-border/50 hover:bg-accent/40 cursor-pointer transition-colors"
                      onClick={() => setSection("audit")}
                    >
                      <td className="py-2.5 px-4 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatTime(e.createdAt)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs whitespace-nowrap">{e.kioskId}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {e.employeeName ? (
                          <div>
                            <div className="text-xs font-medium">{e.employeeName}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{e.employeeCode}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unknown</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${decisionClass[e.decision]}`}
                        >
                          {e.decision.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        {e.faceMatchStatus ? (
                          <span className="text-muted-foreground">{e.faceMatchStatus.replace("_", " ")}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <ScoreBar value={e.faceMatchScore ?? 0} className="w-16" />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {e.faceMatchScore != null ? e.faceMatchScore.toFixed(2) : "—"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role-based quick actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {roleQuickActions(role).map((a) => (
          <button key={a.section} onClick={() => setSection(a.section)} className="group text-left">
            <Card className="p-4 h-full hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <a.icon className="size-4" />
                </div>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm font-semibold">{a.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{a.desc}</p>
            </Card>
          </button>
        ))}
      </div>
    </ViewContainer>
  );
}

function roleQuickActions(role: string) {
  const all = {
    employees: { section: "employees" as const, label: "Employees", desc: "Add, edit, issue cards", icon: Users },
    enrollment: { section: "enrollment" as const, label: "Enrollment", desc: "Enroll face biometrics", icon: ScanFace },
    audit: { section: "audit" as const, label: "Audit Trail", desc: "Immutable scan log", icon: FileSearch },
    kiosks: { section: "kiosks" as const, label: "Kiosks", desc: "Status & thresholds", icon: Cpu },
    security: { section: "security" as const, label: "Security", desc: "Lockdown & CRL", icon: ShieldAlert },
    calibration: { section: "calibration" as const, label: "Calibration", desc: "Tune FAR/FRR", icon: Activity },
  };
  switch (role) {
    case "superadmin":
      return [all.employees, all.enrollment, all.calibration, all.security];
    case "security_officer":
      return [all.audit, all.security, all.kiosks, all.calibration];
    case "hr_admin":
      return [all.employees, all.enrollment, all.audit, all.kiosks];
    default:
      return [all.audit, all.kiosks, all.security, all.enrollment];
  }
}
