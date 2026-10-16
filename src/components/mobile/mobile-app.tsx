"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { apiClient } from "@/lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone,
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Activity,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  History,
  LogOut,
  Bell,
  Fingerprint,
  Zap,
  Lock,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

type View = "home" | "history" | "alerts";

export function MobileApp() {
  const mobileToken = useAppStore((s) => s.mobileToken);
  const setMobileToken = useAppStore((s) => s.setMobileToken);
  const setMode = useAppStore((s) => s.setMode);

  const exit = () => {
    setMobileToken(null);
    setMode("launcher");
  };

  return (
    <div className="min-h-screen w-full bg-muted/30 flex flex-col items-center justify-center py-6 px-4 bg-grid">
      {/* Phone frame */}
      <div className="relative w-full max-w-[400px] aspect-[9/19.5] max-h-[860px] rounded-[2.5rem] border-[10px] border-zinc-900 dark:border-zinc-800 bg-background shadow-2xl shadow-zinc-900/30 overflow-hidden flex flex-col">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-900 dark:bg-zinc-800 rounded-b-2xl z-50" />

        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-2 pb-1 text-[11px] font-medium text-muted-foreground bg-background/80 backdrop-blur z-40">
          <span className="tabular-nums">9:41</span>
          <div className="flex items-center gap-1">
            <Zap className="size-3" />
            <Smartphone className="size-3" />
            <span>100%</span>
          </div>
        </div>

        {/* App content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {mobileToken ? (
            <MobileSession token={mobileToken} onExit={exit} />
          ) : (
            <MobileLogin onExit={exit} />
          )}
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-zinc-900 dark:bg-zinc-700 rounded-full" />
      </div>

      <p className="mt-4 text-xs text-muted-foreground text-center max-w-sm">
        SentinelKiosk Companion · PWA employee self-service
      </p>
    </div>
  );
}

// ---------- Login ----------

function MobileLogin({ onExit }: { onExit: () => void }) {
  const setMobileToken = useAppStore((s) => s.setMobileToken);
  const [code, setCode] = useState("");

  const login = useMutation({
    mutationFn: () => apiClient.mobile.login(code),
    onSuccess: (data) => {
      setMobileToken(data.token);
      toast.success(`Welcome, ${data.employee.fullName.split(" ")[0]}`);
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Could not sign in"),
  });

  const quickCodes = ["EMP-1001", "EMP-1002", "EMP-1003"];

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-primary/10 via-background to-background">
      <div className="px-5 pt-3 pb-2 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="text-muted-foreground -ml-2"
        >
          <ArrowLeft className="size-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="size-16 rounded-3xl bg-gradient-to-br from-primary to-teal-700 flex items-center justify-center mx-auto shadow-lg shadow-primary/30">
            <ShieldCheck className="size-8 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight">
            SentinelKiosk
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Sign in with your employee code to view your access history and card
            status.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="empcode" className="text-xs font-medium">
              Employee Code
            </Label>
            <Input
              id="empcode"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="EMP-1001"
              className="font-mono text-base text-center tracking-wider"
              onKeyDown={(e) => {
                if (e.key === "Enter" && code) login.mutate();
              }}
            />
          </div>
          <Button
            className="w-full h-11 text-sm font-semibold"
            disabled={!code || login.isPending}
            onClick={() => login.mutate()}
          >
            {login.isPending ? "Signing in…" : "Sign in"}
            {!login.isPending && <ChevronRight className="size-4" />}
          </Button>
        </motion.div>

        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground text-center">
            Try a demo code
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {quickCodes.map((c) => (
              <button
                key={c}
                onClick={() => setCode(c)}
                className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 text-xs font-mono transition-colors"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 text-center">
        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
          <Lock className="size-2.5" />
          Encrypted · TLS 1.3 · Biometric consent required
        </p>
      </div>
    </div>
  );
}

// ---------- Authenticated session ----------

function MobileSession({ token, onExit }: { token: string; onExit: () => void }) {
  const setMobileToken = useAppStore((s) => s.setMobileToken);
  const qc = useQueryClient();
  const [view, setView] = useState<View>("home");

  const { data, isLoading } = useQuery({
    queryKey: ["mobile-me", token],
    queryFn: () => apiClient.mobile.me(token),
    refetchInterval: 30 * 1000,
  });

  const reportLost = useMutation({
    mutationFn: () => apiClient.mobile.reportLost(token),
    onSuccess: (res) => {
      toast.success("Card reported lost and revoked immediately");
      qc.invalidateQueries({ queryKey: ["mobile-me", token] });
      qc.invalidateQueries({ queryKey: ["mobile-scans", token] });
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Failed to report card lost"),
  });

  const logout = () => {
    setMobileToken(null);
    onExit();
  };

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const emp = data.employee;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-4 pt-2 pb-3 bg-gradient-to-b from-primary/10 to-background border-b border-border/60">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-muted-foreground -ml-2 size-8 p-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <span className="text-xs font-semibold text-muted-foreground">
            Companion
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-muted-foreground -mr-2 size-8 p-0"
          >
            <LogOut className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <Avatar className="size-14 rounded-2xl border-2 border-background shadow-md">
            {emp.photoUrl ? (
              <img
                src={emp.photoUrl}
                alt={emp.fullName}
                className="size-full object-cover"
              />
            ) : (
              <div className="size-full bg-primary/10 flex items-center justify-center">
                <Fingerprint className="size-6 text-primary" />
              </div>
            )}
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-base truncate">{emp.fullName}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {emp.designation ?? "—"} · {emp.departmentName ?? "—"}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="font-mono text-[10px] text-muted-foreground">
                {emp.employeeCode}
              </span>
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 h-4 font-medium"
              >
                L{emp.accessLevel}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <nav className="flex border-b border-border/60 bg-background">
        {(
          [
            { id: "home", label: "Home", icon: Activity },
            { id: "history", label: "History", icon: History },
            { id: "alerts", label: "Alerts", icon: Bell },
          ] as { id: View; label: string; icon: typeof Activity }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
              view === t.id
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            <t.icon className="size-4" />
            {t.label}
            {t.id === "alerts" && data.alerts.length > 0 && (
              <span className="absolute -mt-6 ml-5 size-1.5 rounded-full bg-destructive" />
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-4">
        <AnimatePresence mode="wait">
          {view === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {/* Card status */}
              <Card className="p-4 gap-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-grid opacity-20" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-primary" />
                      <span className="text-xs font-semibold">
                        Access Card
                      </span>
                    </div>
                    <CardStatusBadge status={emp.cardStatus} />
                  </div>
                  <div className="space-y-2">
                    <Row label="Status" value={<CardStatusBadge status={emp.cardStatus} small />} />
                    <Row
                      label="Face enrolled"
                      value={
                        emp.faceEnrolled ? (
                          <span className="flex items-center gap-1 text-success text-xs font-medium">
                            <CheckCircle2 className="size-3" /> Yes
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            <XCircle className="size-3" /> No
                          </span>
                        )
                      }
                    />
                    {emp.cardExpiresAt && (
                      <Row
                        label="Expires"
                        value={
                          <span className="text-xs">
                            {format(new Date(emp.cardExpiresAt), "MMM yyyy")}
                          </span>
                        }
                      />
                    )}
                  </div>
                </div>
              </Card>

              {/* Today summary */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4 gap-0">
                  <Activity className="size-4 text-primary mb-2" />
                  <p className="text-2xl font-bold tabular-nums">
                    {data.todayScans}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Scans today
                  </p>
                </Card>
                <Card className="p-4 gap-0">
                  <Clock className="size-4 text-primary mb-2" />
                  <p className="text-sm font-semibold leading-tight">
                    {data.lastEntry
                      ? format(new Date(data.lastEntry.at), "HH:mm")
                      : "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">
                    {data.lastEntry?.kioskId ?? "No entries yet"}
                  </p>
                </Card>
              </div>

              {/* Last entry detail */}
              {data.lastEntry && (
                <Card className="p-4 gap-0">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="size-4 text-primary" />
                    <span className="text-xs font-semibold">Last entry</span>
                  </div>
                  <p className="text-sm font-medium">
                    {data.lastEntry.kioskId}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {format(
                      new Date(data.lastEntry.at),
                      "EEE d MMM, HH:mm:ss"
                    )}{" "}
                    ·{" "}
                    {formatDistanceToNow(new Date(data.lastEntry.at), {
                      addSuffix: true,
                    })}
                  </p>
                </Card>
              )}

              {/* Report lost */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-10 text-sm border-destructive/30 text-destructive hover:bg-destructive/5"
                  >
                    <AlertTriangle className="size-4" />
                    Report card lost
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Report card lost?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your access card will be revoked immediately and added to
                      the revocation list. All kiosks will reject it within 5
                      minutes. You&apos;ll need HR to issue a new card.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => reportLost.mutate()}
                      disabled={reportLost.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {reportLost.isPending ? "Revoking…" : "Yes, revoke now"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </motion.div>
          )}

          {view === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              <ScanHistory token={token} />
            </motion.div>
          )}

          {view === "alerts" && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <p className="text-xs text-muted-foreground">
                Failed access attempts on your card
              </p>
              {data.alerts.length === 0 ? (
                <Card className="p-8 flex flex-col items-center text-center">
                  <CheckCircle2 className="size-8 text-success mb-2" />
                  <p className="text-sm font-medium">No alerts</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No failed access attempts detected.
                  </p>
                </Card>
              ) : (
                data.alerts.map((a) => (
                  <Card key={a.id} className="p-3 gap-0">
                    <div className="flex items-start gap-2">
                      <div className="size-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                        <AlertTriangle className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold capitalize">
                            {a.decision.replace("_", " ")}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(a.at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {a.kioskId} · {a.faceMatchStatus ?? "—"}
                          {a.faceMatchScore != null && (
                            <> · score {(a.faceMatchScore * 100).toFixed(0)}%</>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          If this wasn&apos;t you, report your card lost
                          immediately.
                        </p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------- Scan history ----------

function ScanHistory({ token }: { token: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["mobile-scans", token],
    queryFn: () => apiClient.mobile.scans(token, 1),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-muted animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <Card className="p-8 flex flex-col items-center text-center">
        <History className="size-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium">No scan history</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your access attempts will appear here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative pl-4">
        <div className="absolute left-1.5 top-2 bottom-2 w-px bg-border" />
        {data.items.map((s, i) => {
          const granted = s.decision === "granted";
          return (
            <div key={s.id} className="relative pb-3">
              <span
                className={`absolute -left-[11px] top-3 size-3 rounded-full border-2 border-background ${
                  granted ? "bg-success" : "bg-destructive"
                }`}
              />
              <Card className="p-3 gap-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {granted ? (
                      <CheckCircle2 className="size-3.5 text-success" />
                    ) : (
                      <XCircle className="size-3.5 text-destructive" />
                    )}
                    <span className="text-xs font-semibold capitalize">
                      {s.decision.replace("_", " ")}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {format(new Date(s.createdAt), "d MMM, HH:mm")}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {s.kioskId}
                  {s.faceMatchScore != null && (
                    <> · match {(s.faceMatchScore * 100).toFixed(0)}%</>
                  )}
                  {s.latencyMs != null && <> · {(s.latencyMs / 1000).toFixed(1)}s</>}
                  {s.offline && (
                    <Badge
                      variant="outline"
                      className="ml-1 text-[9px] px-1 py-0 h-3.5"
                    >
                      offline
                    </Badge>
                  )}
                </p>
              </Card>
              {i === 0 && (
                <p className="text-[9px] text-muted-foreground mt-1 ml-1">
                  Most recent
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Bits ----------

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}

function CardStatusBadge({
  status,
  small,
}: {
  status: string;
  small?: boolean;
}) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-success/15 text-success" },
    revoked: { label: "Revoked", cls: "bg-destructive/15 text-destructive" },
    lost: { label: "Lost", cls: "bg-warning/15 text-warning-foreground" },
    expired: { label: "Expired", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted" };
  return (
    <Badge
      variant="outline"
      className={`${m.cls} ${small ? "text-[9px] px-1.5 py-0 h-4" : ""} font-medium border-0`}
    >
      {m.label}
    </Badge>
  );
}
