"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Cpu,
  Settings2,
  Activity,
  MapPin,
  Save,
  Loader2,
  Radio,
  Wifi,
  WifiOff,
  ShieldCheck,
  AlertCircle,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import type { KioskDTO, KioskStatus } from "@/lib/types";
import {
  ViewContainer,
  EmptyState,
} from "../lib/ui-bits";
import { kioskStatusClass, formatRelative, asArray } from "../lib/admin-utils";
import { KioskDetailSheet } from "./kiosk-detail-sheet";
import { KioskHeartbeatMonitor } from "../kiosk-heartbeat-monitor";

export function KiosksView() {
  const { data: kiosksRaw, isLoading } = useQuery({
    queryKey: ["kiosks"],
    queryFn: async () => asArray<KioskDTO>(await apiClient.kiosks.list()),
    refetchInterval: 30_000,
  });
  const kiosks = kiosksRaw ?? [];

  const [editing, setEditing] = useState<KioskDTO | null>(null);
  const [detail, setDetail] = useState<KioskDTO | null>(null);

  return (
    <ViewContainer>
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Cpu className="size-5 text-primary" />
          Kiosk Fleet
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {kiosks?.length ?? 0} deployed · monitor status, sync config, and tune thresholds
        </p>
      </div>

      {/* Heartbeat map */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Radio className="size-4 text-primary" />
            Live Heartbeat
          </h3>
          <Badge variant="outline" className="text-[10px]">
            <span className="size-1.5 rounded-full bg-success animate-pulse" />
            updated {kiosks ? "now" : "—"}
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {(kiosks ?? []).map((k, i) => (
            <motion.div
              key={k.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className="relative p-3 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => setEditing(k)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {k.kioskId}
                </span>
                <span className="relative flex">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      kioskStatusClass[k.status],
                      k.status === "online" && "animate-pulse",
                    )}
                  />
                  {k.status === "online" && (
                    <span className="absolute -inset-1 rounded-full bg-success/40 animate-ping" />
                  )}
                </span>
              </div>
              <p className="text-xs font-semibold truncate">{k.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {k.location ?? "—"}
              </p>
            </motion.div>
          ))}
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
        </div>
      </Card>

      {/* Heartbeat monitor */}
      <KioskHeartbeatMonitor kiosks={kiosks} />

      {/* Kiosk cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : !kiosks || kiosks.length === 0 ? (
        <Card>
          <EmptyState
            icon={Cpu}
            title="No kiosks deployed"
            description="Deploy a kiosk via the API to begin monitoring."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kiosks.map((k) => (
            <KioskCard key={k.id} kiosk={k} onEdit={() => setEditing(k)} onView={() => setDetail(k)} />
          ))}
        </div>
      )}

      {editing && (
        <KioskConfigDialog kiosk={editing} onClose={() => setEditing(null)} />
      )}

      <KioskDetailSheet kiosk={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} />
    </ViewContainer>
  );
}

function KioskCard({ kiosk, onEdit, onView }: { kiosk: KioskDTO; onEdit: () => void; onView: () => void }) {
  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "size-11 rounded-xl flex items-center justify-center shrink-0",
              kiosk.status === "online"
                ? "bg-success/10 text-success"
                : kiosk.status === "lockdown"
                  ? "bg-destructive/10 text-destructive"
                  : kiosk.status === "maintenance"
                    ? "bg-warning/10 text-warning-foreground"
                    : "bg-muted text-muted-foreground",
            )}
          >
            <Cpu className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{kiosk.name}</p>
            <p className="text-xs text-muted-foreground font-mono">
              {kiosk.kioskId}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] flex items-center gap-1.5"
        >
          <span
            className={cn("size-1.5 rounded-full", kioskStatusClass[kiosk.status])}
          />
          {kiosk.status}
        </Badge>
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="size-3.5" />
          <span className="truncate">{kiosk.location ?? "—"}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          {kiosk.lastSyncAt ? (
            <>
              <Wifi className="size-3.5 text-success" />
              synced {formatRelative(kiosk.lastSyncAt)}
            </>
          ) : (
            <>
              <WifiOff className="size-3.5 text-muted-foreground" />
              never synced
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Stat label="Config v" value={kiosk.configVersion.toString()} />
        <Stat label="CRL v" value={kiosk.crlVersion.toString()} />
        <Stat label="Grant ≥" value={kiosk.thresholdGranted.toFixed(2)} />
        <Stat label="Challenge ≥" value={kiosk.thresholdChallenge.toFixed(2)} />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          mode: <span className="font-mono">{kiosk.challengeMode}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={onView}>
            <Eye className="size-3.5" />
            Details
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Settings2 className="size-3.5" />
            Configure
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function KioskConfigDialog({
  kiosk,
  onClose,
}: {
  kiosk: KioskDTO;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(kiosk.name);
  const [location, setLocation] = useState(kiosk.location ?? "");
  const [status, setStatus] = useState<KioskStatus>(kiosk.status);
  const [challengeMode, setChallengeMode] = useState(kiosk.challengeMode);
  const [thresholdGranted, setThresholdGranted] = useState(kiosk.thresholdGranted);
  const [thresholdChallenge, setThresholdChallenge] = useState(kiosk.thresholdChallenge);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.kiosks.update(kiosk.id, {
        name,
        location: location || null,
        status,
        challengeMode,
        thresholdGranted,
        thresholdChallenge,
      }),
    onSuccess: () => {
      toast.success(`Kiosk ${kiosk.kioskId} updated`);
      qc.invalidateQueries({ queryKey: ["kiosks"] });
      onClose();
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Update failed"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-primary" />
            Configure {kiosk.kioskId}
          </DialogTitle>
          <DialogDescription>
            Threshold changes apply on next kiosk sync. Bumps config version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="k-name">Name</Label>
              <Input id="k-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-loc">Location</Label>
              <Input id="k-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="k-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as KioskStatus)}
              >
                <SelectTrigger id="k-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">online</SelectItem>
                  <SelectItem value="offline">offline</SelectItem>
                  <SelectItem value="maintenance">maintenance</SelectItem>
                  <SelectItem value="lockdown">lockdown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-mode">Challenge Mode</Label>
              <Select
                value={challengeMode}
                onValueChange={setChallengeMode}
              >
                <SelectTrigger id="k-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="liveness">liveness</SelectItem>
                  <SelectItem value="challenge">challenge</SelectItem>
                  <SelectItem value="both">both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Grant Threshold</Label>
                <Badge variant="outline" className="tabular-nums text-[10px]">
                  {thresholdGranted.toFixed(2)}
                </Badge>
              </div>
              <Slider
                value={[thresholdGranted]}
                min={0.5}
                max={0.99}
                step={0.01}
                onValueChange={(v) => setThresholdGranted(v[0] ?? 0.9)}
              />
              <p className="text-[11px] text-muted-foreground mt-2">
                Score ≥ this → instant grant (no challenge).
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Challenge Threshold</Label>
                <Badge variant="outline" className="tabular-nums text-[10px]">
                  {thresholdChallenge.toFixed(2)}
                </Badge>
              </div>
              <Slider
                value={[thresholdChallenge]}
                min={0.4}
                max={0.95}
                step={0.01}
                onValueChange={(v) => setThresholdChallenge(v[0] ?? 0.75)}
              />
              <p className="text-[11px] text-muted-foreground mt-2">
                Score ≥ this → grant after liveness challenge passes.
              </p>
            </div>
            {thresholdChallenge >= thresholdGranted && (
              <p className="text-xs text-warning-foreground flex items-center gap-1.5">
                <AlertCircle className="size-3.5" />
                Challenge threshold should be lower than grant threshold.
              </p>
            )}
          </div>

          {/* Live preview */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-[11px] uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
              <Activity className="size-3" />
              Decision Logic Preview
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-3 text-success" />
                <span>score ≥ {thresholdGranted.toFixed(2)} → granted (instant)</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-3 text-success" />
                <span>
                  {thresholdChallenge.toFixed(2)} ≤ score &lt; {thresholdGranted.toFixed(2)} →
                  granted (after challenge)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="size-3 text-destructive" />
                <span>score &lt; {thresholdChallenge.toFixed(2)} → denied</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save & bump config
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
