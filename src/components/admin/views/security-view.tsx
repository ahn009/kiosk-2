"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ShieldAlert,
  Lock,
  Unlock,
  Loader2,
  Ban,
  ListChecks,
  Users,
  Activity,
  Send,
  ChevronLeft,
  ChevronRight,
  Bell,
  Webhook,
  Hash,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Download,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { apiClient } from "@/lib/api-client";
import type { AdminRole, AdminUserDTO } from "@/lib/types";
import {
  ViewContainer,
  EmptyState,
  TableSkeleton,
} from "../lib/ui-bits";
import {
  roleBadgeClass,
  roleLabel,
  formatDateTime,
  formatRelative,
  asArray,
} from "../lib/admin-utils";

export function SecurityView() {
  const admin = useAppStore((s) => s.admin);
  const canLockdown =
    admin?.role === "security_officer" || admin?.role === "superadmin";
  const isSuperadmin = admin?.role === "superadmin";

  return (
    <ViewContainer>
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ShieldAlert className="size-5 text-primary" />
          Security Center
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Lockdown control · CRL · admin users · admin action log
        </p>
      </div>

      <LockdownControl canControl={canLockdown} />

      <Tabs defaultValue="crl">
        <TabsList className="w-full justify-start overflow-x-auto scrollbar-thin">
          <TabsTrigger value="crl" className="gap-1.5">
            <ListChecks className="size-3.5" />
            Revocation List
          </TabsTrigger>
          {isSuperadmin && (
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="size-3.5" />
              Admin Users
            </TabsTrigger>
          )}
          {canLockdown && (
            <TabsTrigger value="actions" className="gap-1.5">
              <Activity className="size-3.5" />
              Admin Actions
            </TabsTrigger>
          )}
          <TabsTrigger value="alerts" className="gap-1.5">
            <Bell className="size-3.5" />
            Alerts &amp; Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="crl" className="mt-4">
          <RevocationList />
        </TabsContent>
        {isSuperadmin && (
          <TabsContent value="users" className="mt-4">
            <AdminUsers />
          </TabsContent>
        )}
        {canLockdown && (
          <TabsContent value="actions" className="mt-4">
            <AdminActions />
          </TabsContent>
        )}
        <TabsContent value="alerts" className="mt-4">
          <WebhookConfig />
        </TabsContent>
      </Tabs>
    </ViewContainer>
  );
}

// ============ Lockdown control ============

function LockdownControl({ canControl }: { canControl: boolean }) {
  const qc = useQueryClient();
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats-security"],
    queryFn: () => apiClient.dashboard.stats(),
    refetchInterval: 15_000,
  });
  const [initiateOpen, setInitiateOpen] = useState(false);
  const [reason, setReason] = useState("");

  const lockdownMutation = useMutation({
    mutationFn: () => apiClient.admin.lockdown(reason || "Manual lockdown by admin"),
    onSuccess: () => {
      toast.success("LOCKDOWN ENGAGED — all kiosks set to lockdown mode");
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats-security"] });
      qc.invalidateQueries({ queryKey: ["kiosks"] });
      qc.invalidateQueries({ queryKey: ["public-status"] });
      setInitiateOpen(false);
      setReason("");
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Failed to engage lockdown"),
  });

  const clearMutation = useMutation({
    mutationFn: () => apiClient.admin.clearLockdown(),
    onSuccess: () => {
      toast.success("Lockdown cleared — kiosks restored to online");
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats-security"] });
      qc.invalidateQueries({ queryKey: ["kiosks"] });
      qc.invalidateQueries({ queryKey: ["public-status"] });
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Failed to clear lockdown"),
  });

  const active = stats?.lockdownActive;

  return (
    <Card
      className={cn(
        "border-2 transition-colors",
        active ? "border-destructive/50 bg-destructive/5" : "border-border",
      )}
    >
      <CardContent className="py-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div
            className={cn(
              "size-14 rounded-2xl flex items-center justify-center shrink-0",
              active
                ? "bg-destructive/15 text-destructive"
                : "bg-success/10 text-success",
            )}
          >
            {active ? (
              <Lock className="size-7" />
            ) : (
              <ShieldCheck className="size-7" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold flex items-center gap-2 flex-wrap">
              {active ? (
                <>
                  <span className="text-destructive">LOCKDOWN ACTIVE</span>
                  <Badge variant="destructive" className="text-[10px] animate-pulse">
                    ENGAGED
                  </Badge>
                </>
              ) : (
                <>
                  <span>System Normal</span>
                  <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[10px]">
                    OPERATIONAL
                  </Badge>
                </>
              )}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {active
                ? "All access verification is suspended. Kiosks reject every scan until cleared."
                : "All kiosks are operating normally. Initiate lockdown to suspend all access immediately."}
            </p>
          </div>
          {canControl &&
            (active ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={clearMutation.isPending}>
                    {clearMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Unlock className="size-4" />
                    )}
                    Clear Lockdown
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear lockdown?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All kiosks will be restored to online status. The CRL version
                      will be bumped and synced. Resumes access verification.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={clearMutation.isPending}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearMutation.mutate()}
                      disabled={clearMutation.isPending}
                    >
                      <Unlock className="size-4" />
                      Yes, clear lockdown
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button variant="destructive" onClick={() => setInitiateOpen(true)}>
                <Lock className="size-4" />
                Initiate Lockdown
              </Button>
            ))}
        </div>

        {active && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 pt-4 border-t border-destructive/20 grid sm:grid-cols-2 gap-3 text-xs"
          >
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Lockdown reason
              </p>
              <p className="text-sm font-medium text-destructive mt-0.5">
                See admin action log
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                CRL version
              </p>
              <p className="text-sm font-mono font-medium mt-0.5">
                bumped (syncs to kiosks)
              </p>
            </div>
          </motion.div>
        )}

        {!canControl && (
          <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            You do not have permission to manage lockdown. Contact a security officer or superadmin.
          </p>
        )}
      </CardContent>

      <Dialog open={initiateOpen} onOpenChange={setInitiateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Lock className="size-5" />
              Initiate Lockdown
            </DialogTitle>
            <DialogDescription>
              All kiosks will immediately switch to lockdown mode and reject every scan.
              An admin action will be logged with your identity and timestamp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ld-reason">Reason (optional)</Label>
            <Textarea
              id="ld-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Security incident at warehouse gate"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInitiateOpen(false)}
              disabled={lockdownMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => lockdownMutation.mutate()}
              disabled={lockdownMutation.isPending}
            >
              {lockdownMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Lock className="size-4" />
              )}
              Engage lockdown
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ Revocation list ============

function RevocationList() {
  const { data: raw, isLoading } = useQuery({
    queryKey: ["revocations"],
    queryFn: async () =>
      asArray<{
        tokenHash: string;
        reason: string | null;
        revokedAt: string;
        employeeName: string | null;
        employeeCode: string | null;
      }>(await apiClient.revocations.list()),
  });
  const data = raw ?? [];

  return (
    <Card className="p-0 overflow-hidden">
      <CardHeader className="border-b border-border py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-4 text-primary" />
          Card Revocation List (CRL)
        </CardTitle>
        <CardDescription>
          {data?.length ?? 0} revoked tokens · synced to all kiosks
        </CardDescription>
      </CardHeader>
      {isLoading ? (
        <div className="p-4">
          <TableSkeleton rows={5} cols={4} />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No revoked cards"
          description="The CRL is empty. All issued card tokens remain valid."
        />
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                <th className="text-left font-medium py-2.5 px-4">Token Hash</th>
                <th className="text-left font-medium py-2.5 px-4">Employee</th>
                <th className="text-left font-medium py-2.5 px-4">Reason</th>
                <th className="text-left font-medium py-2.5 px-4">Revoked</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={`${r.tokenHash}-${i}`} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="py-2.5 px-4">
                    <code className="text-[11px] font-mono break-all">
                      {r.tokenHash.slice(0, 24)}…
                    </code>
                  </td>
                  <td className="py-2.5 px-4">
                    {r.employeeName ? (
                      <div>
                        <p className="text-xs font-medium">{r.employeeName}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {r.employeeCode ?? "—"}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unknown</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-xs">
                    {r.reason ?? <span className="text-muted-foreground">No reason given</span>}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(r.revokedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ============ Admin users ============

function AdminUsers() {
  const { data: raw, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () =>
      asArray<AdminUserDTO>(await apiClient.admin.users()),
  });
  const data = raw ?? [];

  return (
    <Card className="p-0 overflow-hidden">
      <CardHeader className="border-b border-border py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary" />
          Admin Users
        </CardTitle>
        <CardDescription>
          {data?.length ?? 0} accounts with admin dashboard access
        </CardDescription>
      </CardHeader>
      {isLoading ? (
        <div className="p-4">
          <TableSkeleton rows={4} cols={3} />
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                <th className="text-left font-medium py-2.5 px-4">Admin</th>
                <th className="text-left font-medium py-2.5 px-4">Email</th>
                <th className="text-left font-medium py-2.5 px-4">Role</th>
                <th className="text-left font-medium py-2.5 px-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.id} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="py-2.5 px-4">
                    <p className="text-xs font-medium">{u.name ?? "Unnamed"}</p>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs">{u.email}</td>
                  <td className="py-2.5 px-4">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", roleBadgeClass[u.role as AdminRole])}
                    >
                      {roleLabel[u.role as AdminRole]}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-muted-foreground">
                    {formatRelative(u.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ============ Admin actions ============

function AdminActions() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-actions", page],
    queryFn: () => apiClient.admin.actions(page),
  });
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / 25)) : 1;

  return (
    <Card className="p-0 overflow-hidden">
      <CardHeader className="border-b border-border py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-primary" />
              Admin Action Log
            </CardTitle>
            <CardDescription>
              {data?.total ?? 0} immutable records · all admin mutations
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {isLoading ? (
        <div className="p-4">
          <TableSkeleton rows={6} cols={4} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No admin actions recorded"
          description="Mutations performed by admins will appear here immutably."
        />
      ) : (
        <div className="divide-y divide-border/40">
          {items.map((a) => (
            <AdminActionRow key={a.id} action={a} />
          ))}
        </div>
      )}
      {data && data.total > 25 && (
        <div className="border-t border-border p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function AdminActionRow({
  action,
}: {
  action: {
    id: string;
    actorName: string | null;
    target: string;
    action: string;
    beforeData: string | null;
    afterData: string | null;
    createdAt: string;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  let before: unknown = null;
  let after: unknown = null;
  try {
    if (action.beforeData) before = JSON.parse(action.beforeData);
    if (action.afterData) after = JSON.parse(action.afterData);
  } catch {
    /* ignore */
  }
  const hasData = Boolean(before || after);

  return (
    <div className="p-4 hover:bg-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] font-mono">
              {action.action}
            </Badge>
            <span className="text-xs text-muted-foreground truncate">
              by <span className="font-medium text-foreground">{action.actorName ?? "unknown"}</span>
            </span>
          </div>
          <p className="text-xs mt-1.5">
            target: <code className="font-mono text-[11px] bg-muted/40 px-1.5 py-0.5 rounded">{action.target}</code>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <Clock className="size-3" />
            {formatDateTime(action.createdAt)}
          </p>
        </div>
        {hasData && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "Hide" : "View"}
          </Button>
        )}
      </div>
      {expanded && hasData && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 grid sm:grid-cols-2 gap-2"
        >
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Before
            </p>
            <pre className="text-[11px] font-mono bg-muted/40 rounded-md p-2 overflow-x-auto scrollbar-thin max-h-48">
              {before ? JSON.stringify(before, null, 2) : "—"}
            </pre>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              After
            </p>
            <pre className="text-[11px] font-mono bg-muted/40 rounded-md p-2 overflow-x-auto scrollbar-thin max-h-48">
              {after ? JSON.stringify(after, null, 2) : "—"}
            </pre>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ============ Webhook config ============

function WebhookConfig() {
  const qc = useQueryClient();
  const { data: state, isLoading } = useQuery({
    queryKey: ["webhook-state"],
    queryFn: () => apiClient.webhooks.get(),
  });

  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<{
    id?: string;
    name: string;
    url: string;
    type: string;
    enabled: boolean;
    secret: string;
    events: string[];
  } | null>(null);

  const saveMutation = useMutation({
    mutationFn: (t: typeof editingTarget) => apiClient.webhooks.save(t!),
    onSuccess: () => {
      toast.success("Webhook target saved");
      setShowForm(false);
      setEditingTarget(null);
      qc.invalidateQueries({ queryKey: ["webhook-state"] });
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Failed to save webhook"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiClient.webhooks.remove(id),
    onSuccess: () => {
      toast.success("Webhook target removed");
      qc.invalidateQueries({ queryKey: ["webhook-state"] });
    },
  });

  const toggleGlobal = useMutation({
    mutationFn: (globalEnabled: boolean) =>
      apiClient.webhooks.setGlobal(globalEnabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhook-state"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => apiClient.webhooks.test(),
    onSuccess: (data: { results: { ok: boolean; name: string; status?: number; error?: string }[] }) => {
      const ok = data.results.filter((r) => r.ok).length;
      const fail = data.results.filter((r) => !r.ok).length;
      if (data.results.length === 0) {
        toast.info("No enabled webhook targets to test");
      } else if (fail === 0) {
        toast.success(`Test alert delivered to ${ok} target${ok > 1 ? "s" : ""}`);
      } else {
        toast.warning(`Delivered to ${ok}, failed ${fail} target(s)`, {
          description: data.results
            .filter((r) => !r.ok)
            .map((r) => `${r.name}: ${r.error ?? "HTTP " + r.status}`)
            .join("\n"),
        });
      }
      qc.invalidateQueries({ queryKey: ["webhook-state"] });
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Test dispatch failed"),
  });

  const EVENT_OPTIONS = [
    { id: "denied", label: "Denied" },
    { id: "challenge_failed", label: "Challenge Failed" },
    { id: "lockdown", label: "Lockdown" },
    { id: "spoof", label: "Spoof Detected" },
    { id: "supervisor_override", label: "Supervisor Override" },
    { id: "granted", label: "Granted" },
  ];

  function startNew() {
    setEditingTarget({
      name: "",
      url: "",
      type: "slack",
      enabled: true,
      secret: "",
      events: ["denied", "lockdown", "spoof"],
    });
    setShowForm(true);
  }

  return (
    <div className="space-y-4">
      {/* Global toggle + stats */}
      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Webhook className="size-4 text-primary" />
                SIEM Webhook Integration
              </CardTitle>
              <CardDescription className="mt-1">
                Forward security alerts to Slack, Microsoft Teams, or generic
                HTTP endpoints. HMAC-SHA256 signed payloads. Alerts auto-fire
                on denied scans, spoof attempts, and lockdown events.
              </CardDescription>
            </div>
            <Switch
              checked={state?.globalEnabled ?? true}
              onCheckedChange={(v) => toggleGlobal.mutate(v)}
              disabled={isLoading}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <Zap className="size-4 text-primary mb-1.5" />
              <p className="text-xl font-bold tabular-nums">
                {state?.dispatchCount ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">Dispatches</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <Clock className="size-4 text-muted-foreground mb-1.5" />
              <p className="text-xs font-medium">
                {state?.lastDispatchAt
                  ? new Date(state.lastDispatchAt).toLocaleString()
                  : "Never"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Last dispatch
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <AlertTriangle className="size-4 text-destructive mb-1.5" />
              <p className="text-xl font-bold tabular-nums">
                {state?.failureCount ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground">Failures</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Send test alert
            </Button>
            <Button size="sm" onClick={startNew}>
              <Plus className="size-3.5" />
              Add webhook
            </Button>
            <a
              href={apiClient.webhooks.exportCsvUrl({ limit: 5000 })}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="ghost" size="sm">
                <Download className="size-3.5" />
                Export audit CSV
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit form */}
      {showForm && editingTarget && (
        <Card className="border-primary/30">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base">
              {editingTarget.id ? "Edit webhook target" : "New webhook target"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={editingTarget.name}
                  onChange={(e) =>
                    setEditingTarget({ ...editingTarget, name: e.target.value })
                  }
                  placeholder="Security alerts channel"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={editingTarget.type}
                  onValueChange={(v) =>
                    setEditingTarget({ ...editingTarget, type: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="teams">Microsoft Teams</SelectItem>
                    <SelectItem value="generic">Generic webhook</SelectItem>
                    <SelectItem value="email">Email (SMTP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Webhook URL</Label>
              <Input
                value={editingTarget.url}
                onChange={(e) =>
                  setEditingTarget({ ...editingTarget, url: e.target.value })
                }
                placeholder={
                  editingTarget.type === "slack"
                    ? "https://hooks.slack.com/services/…"
                    : "https://outlook.office.com/webhook/…"
                }
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Signing secret (optional)</Label>
              <Input
                value={editingTarget.secret}
                onChange={(e) =>
                  setEditingTarget({ ...editingTarget, secret: e.target.value })
                }
                placeholder={
                  editingTarget.id
                    ? "Leave blank to keep the stored secret"
                    : "Used for HMAC-SHA256 signature in X-SentinelKiosk-Signature header"
                }
                className="font-mono text-xs"
                type="password"
                autoComplete="new-password"
              />
              <p className="text-[11px] text-muted-foreground">
                Stored encrypted — it is never displayed again after saving.
              </p>
            </div>
            <div>
              <Label className="mb-2 block">Trigger events</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_OPTIONS.map((ev) => {
                  const active = editingTarget.events.includes(ev.id);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() =>
                        setEditingTarget({
                          ...editingTarget,
                          events: active
                            ? editingTarget.events.filter((x) => x !== ev.id)
                            : [...editingTarget.events, ev.id],
                        })
                      }
                      className={cn(
                        "px-2.5 py-1 rounded-md border text-xs font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {ev.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border">
              <span className="text-sm">Enabled</span>
              <Switch
                checked={editingTarget.enabled}
                onCheckedChange={(v) =>
                  setEditingTarget({ ...editingTarget, enabled: v })
                }
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditingTarget(null);
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  !editingTarget.name || !editingTarget.url || saveMutation.isPending
                }
                onClick={() => saveMutation.mutate(editingTarget)}
              >
                {saveMutation.isPending && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Save target
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Target list */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (state?.targets ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Webhook className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No webhook targets configured</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Add a Slack, Teams, or generic HTTP endpoint to receive real-time
              security alerts for denied scans, spoof attempts, and lockdowns.
            </p>
            <Button size="sm" className="mt-4" onClick={startNew}>
              <Plus className="size-3.5" />
              Add your first webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(state?.targets ?? []).map((t) => (
            <Card key={t.id} className="p-0">
              <div className="flex items-center justify-between gap-3 p-3.5">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={cn(
                      "size-9 rounded-lg flex items-center justify-center shrink-0",
                      t.enabled
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {t.type === "slack" ? (
                      <Hash className="size-4" />
                    ) : t.type === "teams" ? (
                      <Users className="size-4" />
                    ) : (
                      <Webhook className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{t.name}</p>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                      >
                        {t.type}
                      </Badge>
                      {t.enabled ? (
                        <Badge variant="outline" className="text-[10px] text-success">
                          <CheckCircle2 className="size-2.5 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          <XCircle className="size-2.5 mr-1" />
                          Disabled
                        </Badge>
                      )}
                      {t.hasSecret && (
                        <Badge variant="outline" className="text-[10px]">
                          Signed
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                      {t.url}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {t.events.map((ev) => (
                        <Badge
                          key={ev}
                          variant="secondary"
                          className="text-[9px] font-normal capitalize"
                        >
                          {ev.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setEditingTarget({
                        id: t.id,
                        name: t.name,
                        url: t.url,
                        type: t.type,
                        enabled: t.enabled,
                        // Never prefill: secrets are not readable. Blank keeps
                        // the stored secret.
                        secret: "",
                        events: t.events,
                      });
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={removeMutation.isPending}
                    onClick={() => {
                      if (confirm(`Remove webhook target "${t.name}"?`)) {
                        removeMutation.mutate(t.id);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-2">
        <Hash className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Payload schema: <code className="font-mono">{"{ source, event_type, severity, title, message, kiosk_id, employee_code, timestamp }"}</code>.
          Slack/Teams payloads are formatted per their incoming-webhook specs.
          Generic endpoints receive the raw JSON + an <code className="font-mono">X-SentinelKiosk-Signature: sha256=…</code> header (HMAC of the body with the signing secret).
        </p>
      </div>
    </div>
  );
}
