"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Gauge,
  Play,
  Loader2,
  Save,
  CheckCircle2,
  Info,
  SlidersHorizontal,
  Activity,
  TrendingUp,
  ShieldCheck,
  Cpu,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  ReferenceDot,
  ReferenceLine,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { api, apiClient } from "@/lib/api-client";
import type { KioskDTO } from "@/lib/types";
import { ViewContainer, EmptyState } from "../lib/ui-bits";
import { asArray, formatPct } from "../lib/admin-utils";

// ---------- API response shape ----------

interface RocPoint {
  threshold: number;
  far: number;
  frr: number;
}

interface CalibrationResponse {
  kioskId: string;
  genuineScores: number[];
  impostorScores: number[];
  roc: RocPoint[];
  optimalThreshold: number;
  summary: {
    genuineCount: number;
    impostorCount: number;
    meanGenuine: number;
    meanImpostor: number;
    auc: number;
  };
}

// ---------- chart colors (oklch, no indigo/blue) ----------

const COLORS = {
  primary: "oklch(0.58 0.14 162)",
  success: "oklch(0.6 0.16 152)",
  destructive: "oklch(0.62 0.18 25)",
  warning: "oklch(0.72 0.16 70)",
  muted: "oklch(0.5 0.02 160)",
  gridStroke: "oklch(0.5 0.01 160 / 0.15)",
  tooltipBg: "oklch(0.19 0.018 165)",
  tooltipText: "oklch(0.96 0.01 160)",
};

const TOOLTIP_STYLE = {
  background: COLORS.tooltipBg,
  border: "1px solid oklch(1 0 0 / 10%)",
  borderRadius: "0.5rem",
  color: COLORS.tooltipText,
  fontSize: "12px",
} as const;

// ---------- helpers ----------

function buildDistributionData(genuine: number[], impostor: number[]) {
  const binCount = 20;
  const width = 1 / binCount;
  const buckets = Array.from({ length: binCount }, (_, i) => ({
    center: Number(((i + 0.5) * width).toFixed(4)),
    label: `${(i * width).toFixed(2)}–${((i + 1) * width).toFixed(2)}`,
    genuine: 0,
    impostor: 0,
  }));
  for (const s of genuine) {
    let idx = Math.floor(s / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    buckets[idx].genuine += 1;
  }
  for (const s of impostor) {
    let idx = Math.floor(s / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    buckets[idx].impostor += 1;
  }
  return buckets;
}

function findRocPoint(roc: RocPoint[], threshold: number): RocPoint | null {
  if (roc.length === 0) return null;
  let best = roc[0];
  let bestDiff = Math.abs(roc[0].threshold - threshold);
  for (const p of roc) {
    const d = Math.abs(p.threshold - threshold);
    if (d < bestDiff) {
      bestDiff = d;
      best = p;
    }
  }
  return best;
}

// ---------- main view ----------

export function CalibrationView() {
  const { data: kiosksRaw, isLoading: kiosksLoading } = useQuery({
    queryKey: ["kiosks"],
    queryFn: async () => asArray<KioskDTO>(await apiClient.kiosks.list()),
  });
  const kiosks = kiosksRaw ?? [];

  const [selectedKioskId, setSelectedKioskId] = useState<string>("");

  // derive the effective kiosk id without setState-in-effect (eslint rule):
  // fall back to the first kiosk when nothing selected.
  const effectiveKioskId =
    selectedKioskId ||
    (kiosks.length > 0 ? kiosks[0].kioskId : "");
  const selectedKiosk =
    kiosks.find((k) => k.kioskId === effectiveKioskId) ?? null;

  return (
    <ViewContainer>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Gauge className="size-5 text-primary" />
            Threshold Calibration
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Calibrate per-kiosk FAR/FRR operating points. Capture 50 genuine
            + 50 impostor attempts per environment; the ROC curve sets
            T<sub>granted</sub> at FAR ≤ 0.001% and T<sub>challenge</sub> at
            FRR ≤ 2%.
          </p>
        </div>
        <div className="w-full sm:w-72 shrink-0">
          <Label htmlFor="cal-kiosk" className="text-xs text-muted-foreground">
            Target kiosk
          </Label>
          <Select
            value={effectiveKioskId}
            onValueChange={(v) => setSelectedKioskId(v)}
          >
            <SelectTrigger id="cal-kiosk" className="mt-1">
              <SelectValue placeholder="Select kiosk…" />
            </SelectTrigger>
            <SelectContent>
              {kiosks.map((k) => (
                <SelectItem key={k.id} value={k.kioskId}>
                  <span className="font-mono text-xs">{k.kioskId}</span>
                  &nbsp;·&nbsp;{k.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Info callout */}
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="size-4 text-primary" />
        <AlertTitle className="text-primary">Simulated calibration</AlertTitle>
        <AlertDescription>
          In production this script runs against real captured embeddings.
          Here it uses simulated Gaussian distributions for demonstration.
          Do not hardcode 0.85 — thresholds are calibrated per deployment.
        </AlertDescription>
      </Alert>

      {/* Body */}
      {kiosksLoading ? (
        <Card className="p-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        </Card>
      ) : !selectedKiosk ? (
        <Card>
          <EmptyState
            icon={Cpu}
            title="No kiosks available"
            description="Deploy a kiosk via the API before running calibration."
          />
        </Card>
      ) : (
        <CalibrationWorkspace
          key={selectedKiosk.kioskId}
          kiosk={selectedKiosk}
        />
      )}
    </ViewContainer>
  );
}

// ---------- workspace (per-kiosk state) ----------

function CalibrationWorkspace({ kiosk }: { kiosk: KioskDTO }) {
  const qc = useQueryClient();

  // per-kiosk local state — initialised from the kiosk object on mount.
  // The parent remounts this component (key=kioskId) when the user switches
  // kiosks, so initial state always reflects the freshly-selected kiosk.
  const [genuineCount, setGenuineCount] = useState<number>(50);
  const [impostorCount, setImpostorCount] = useState<number>(50);
  const [result, setResult] = useState<CalibrationResponse | null>(null);

  // manual tuner state — initialised from the kiosk's saved thresholds.
  const [manualGrant, setManualGrant] = useState<number>(kiosk.thresholdGranted);
  const [manualChallenge, setManualChallenge] = useState<number>(
    kiosk.thresholdChallenge,
  );

  // run calibration mutation
  const runMutation = useMutation({
    mutationFn: () =>
      api<CalibrationResponse>("/calibration", {
        method: "POST",
        body: {
          kioskId: kiosk.kioskId,
          genuineCount,
          impostorCount,
        },
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Calibration complete · AUC ${data.summary.auc.toFixed(3)}`);
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Calibration failed"),
  });

  // apply recommended thresholds mutation
  const applyMutation = useMutation({
    mutationFn: (optimal: number) => {
      const challenge = Math.max(0.4, Number((optimal - 0.1).toFixed(2)));
      return apiClient.kiosks.update(kiosk.id, {
        thresholdGranted: optimal,
        thresholdChallenge: challenge,
      });
    },
    onSuccess: (_data, optimal) => {
      const challenge = Math.max(0.4, Number((optimal - 0.1).toFixed(2)));
      setManualGrant(optimal);
      setManualChallenge(challenge);
      qc.invalidateQueries({ queryKey: ["kiosks"] });
      toast.success(`Thresholds applied to ${kiosk.kioskId}`);
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Apply failed"),
  });

  // save manual tuner mutation
  const saveManualMutation = useMutation({
    mutationFn: () =>
      apiClient.kiosks.update(kiosk.id, {
        thresholdGranted: manualGrant,
        thresholdChallenge: manualChallenge,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kiosks"] });
      toast.success(`Thresholds saved to ${kiosk.kioskId}`);
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Save failed"),
  });

  function runCalibration() {
    runMutation.mutate();
  }

  // derived data
  const rocData =
    result?.roc.map((p) => ({
      ...p,
      tpr: 1 - p.frr,
    })) ?? [];
  const distData = result
    ? buildDistributionData(result.genuineScores, result.impostorScores)
    : [];
  const optimalPoint =
    result && result.optimalThreshold
      ? findRocPoint(result.roc, result.optimalThreshold)
      : null;
  const currentPoint = result ? findRocPoint(result.roc, manualGrant) : null;

  return (
    <div className="space-y-6">
      {/* Run calibration card */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Run Calibration ·{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {kiosk.kioskId}
              </span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Simulates{" "}
              <span className="font-mono text-xs">{genuineCount}</span> genuine
              and{" "}
              <span className="font-mono text-xs">{impostorCount}</span>{" "}
              impostor similarity scores, then computes the ROC curve and
              optimal operating point.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="genuine-count"
                className="text-xs text-muted-foreground"
              >
                Genuine count
              </Label>
              <Input
                id="genuine-count"
                type="number"
                min={1}
                max={500}
                value={genuineCount}
                onChange={(e) =>
                  setGenuineCount(
                    Math.max(1, Math.min(500, Number(e.target.value) || 50)),
                  )
                }
                className="w-28"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="impostor-count"
                className="text-xs text-muted-foreground"
              >
                Impostor count
              </Label>
              <Input
                id="impostor-count"
                type="number"
                min={1}
                max={500}
                value={impostorCount}
                onChange={(e) =>
                  setImpostorCount(
                    Math.max(1, Math.min(500, Number(e.target.value) || 50)),
                  )
                }
                className="w-28"
              />
            </div>
            <Button
              onClick={runCalibration}
              disabled={runMutation.isPending}
              className="min-w-[160px]"
            >
              {runMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {runMutation.isPending ? "Running…" : "Run Calibration"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Body: charts or empty state */}
      {!result ? (
        <Card>
          <EmptyState
            icon={Gauge}
            title="No calibration data yet"
            description="Run a calibration to view the ROC curve, score distribution, and recommended thresholds for this kiosk."
            action={
              <Button
                onClick={runCalibration}
                disabled={runMutation.isPending}
              >
                {runMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Run first calibration
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Metrics grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              icon={TrendingUp}
              label="AUC"
              value={result.summary.auc.toFixed(4)}
              accent="success"
              hint="area under ROC"
            />
            <MetricCard
              icon={ShieldCheck}
              label="Genuine μ"
              value={result.summary.meanGenuine.toFixed(3)}
              accent="success"
              hint={`${result.summary.genuineCount} samples`}
            />
            <MetricCard
              icon={AlertCircle}
              label="Impostor μ"
              value={result.summary.meanImpostor.toFixed(3)}
              accent="danger"
              hint={`${result.summary.impostorCount} samples`}
            />
            <MetricCard
              icon={ShieldCheck}
              label="Genuine N"
              value={String(result.summary.genuineCount)}
              hint="captures"
            />
            <MetricCard
              icon={AlertCircle}
              label="Impostor N"
              value={String(result.summary.impostorCount)}
              accent="danger"
              hint="captures"
            />
            <MetricCard
              icon={Gauge}
              label="FAR @ T_grant"
              value={currentPoint ? formatPct(currentPoint.far, 3) : "—"}
              accent={
                currentPoint && currentPoint.far <= 0.001
                  ? "success"
                  : "warning"
              }
              hint={`FRR ${
                currentPoint ? formatPct(currentPoint.frr, 2) : "—"
              }`}
            />
          </div>

          {/* ROC + Recommended panel */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="size-4 text-primary" />
                  ROC Curve
                </CardTitle>
                <CardDescription>
                  FRR and TPR vs FAR — optimal operating point marked where
                  FAR ≤ 0.001 (0.1%).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={rocData}
                    margin={{ left: -8, right: 16, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={COLORS.gridStroke}
                    />
                    <XAxis
                      dataKey="far"
                      type="number"
                      domain={[0, 1]}
                      ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
                      tick={{ fontSize: 10, fill: COLORS.muted }}
                      tickFormatter={(v) =>
                        `${(Number(v) * 100).toFixed(0)}%`
                      }
                    />
                    <YAxis
                      domain={[0, 1]}
                      ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
                      tick={{ fontSize: 10, fill: COLORS.muted }}
                      tickFormatter={(v) =>
                        `${(Number(v) * 100).toFixed(0)}%`
                      }
                    />
                    <RTooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelFormatter={(v) =>
                        `FAR ${(Number(v) * 100).toFixed(2)}%`
                      }
                      labelStyle={{ color: COLORS.tooltipText }}
                      formatter={(value, name) => [
                        `${(Number(value) * 100).toFixed(2)}%`,
                        name === "frr" ? "FRR" : "TPR (1-FRR)",
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px" }}
                      iconType="circle"
                      formatter={(value) =>
                        value === "frr" ? "FRR" : "TPR (1-FRR)"
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="frr"
                      stroke={COLORS.warning}
                      strokeWidth={2}
                      dot={false}
                      name="frr"
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="tpr"
                      stroke={COLORS.success}
                      strokeWidth={2}
                      dot={false}
                      name="tpr"
                      isAnimationActive={false}
                    />
                    {optimalPoint && (
                      <ReferenceDot
                        x={optimalPoint.far}
                        y={1 - optimalPoint.frr}
                        r={6}
                        fill={COLORS.primary}
                        stroke="oklch(0.96 0.01 160)"
                        strokeWidth={2}
                        label={{
                          value: `T=${optimalPoint.threshold.toFixed(2)}`,
                          position: "top",
                          fill: COLORS.tooltipText,
                          fontSize: 10,
                        }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recommended thresholds panel */}
            <Card className="p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  Recommended Thresholds
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Optimal operating point picked from the simulated ROC.
              </p>

              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-border p-3 bg-primary/5">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Optimal T_grant
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-primary">
                    {result.optimalThreshold.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Lowest threshold where FAR ≤ 0.1%.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Current T_grant
                    </p>
                    <p className="text-base font-semibold tabular-nums">
                      {kiosk.thresholdGranted.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Current T_challenge
                    </p>
                    <p className="text-base font-semibold tabular-nums">
                      {kiosk.thresholdChallenge.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="rounded-md bg-success/10 px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-success/80">
                      AUC
                    </p>
                    <p className="text-base font-semibold tabular-nums text-success">
                      {result.summary.auc.toFixed(4)}
                    </p>
                  </div>
                  <CheckCircle2 className="size-5 text-success" />
                </div>
              </div>

              <Button
                className="mt-4 w-full"
                onClick={() =>
                  applyMutation.mutate(result.optimalThreshold)
                }
                disabled={applyMutation.isPending}
              >
                {applyMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Apply recommended thresholds
              </Button>
            </Card>
          </div>

          {/* Score distribution chart */}
          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4 text-primary" />
                Score Distribution
              </CardTitle>
              <CardDescription>
                Genuine vs impostor similarity scores (20 bins). Vertical
                reference lines reflect the live manual tuner values.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={distData}
                  margin={{ left: -16, right: 16, top: 8, bottom: 8 }}
                >
                  <defs>
                    <linearGradient
                      id="genuineGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={COLORS.success}
                        stopOpacity={0.5}
                      />
                      <stop
                        offset="95%"
                        stopColor={COLORS.success}
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                    <linearGradient
                      id="impostorGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={COLORS.destructive}
                        stopOpacity={0.5}
                      />
                      <stop
                        offset="95%"
                        stopColor={COLORS.destructive}
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={COLORS.gridStroke}
                  />
                  <XAxis
                    dataKey="center"
                    type="number"
                    domain={[0, 1]}
                    ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
                    tick={{ fontSize: 10, fill: COLORS.muted }}
                    tickFormatter={(v) => Number(v).toFixed(1)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: COLORS.muted }}
                    allowDecimals={false}
                  />
                  <RTooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(v) =>
                      `score ≈ ${Number(v).toFixed(2)}`
                    }
                    labelStyle={{ color: COLORS.tooltipText }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} iconType="circle" />
                  <Area
                    type="step"
                    dataKey="genuine"
                    name="Genuine"
                    stroke={COLORS.success}
                    strokeWidth={2}
                    fill="url(#genuineGrad)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="step"
                    dataKey="impostor"
                    name="Impostor"
                    stroke={COLORS.destructive}
                    strokeWidth={2}
                    fill="url(#impostorGrad)"
                    isAnimationActive={false}
                  />
                  <ReferenceLine
                    x={manualGrant}
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: `T_grant ${manualGrant.toFixed(2)}`,
                      position: "top",
                      fill: COLORS.primary,
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    x={manualChallenge}
                    stroke={COLORS.warning}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: `T_chal ${manualChallenge.toFixed(2)}`,
                      position: "bottom",
                      fill: COLORS.warning,
                      fontSize: 10,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Manual threshold tuner */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <SlidersHorizontal className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">
                Manual Threshold Tuner
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Drag to preview the operating point. Reference lines on the
              distribution chart update live. Press{" "}
              <em>Save to kiosk</em> to persist (bumps config version).
            </p>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Grant Threshold</Label>
                  <Badge
                    variant="outline"
                    className="tabular-nums text-[10px]"
                  >
                    {manualGrant.toFixed(2)}
                  </Badge>
                </div>
                <Slider
                  value={[manualGrant]}
                  min={0.5}
                  max={0.99}
                  step={0.01}
                  onValueChange={(v) => setManualGrant(v[0] ?? 0.9)}
                />
                <p className="text-[11px] text-muted-foreground mt-2">
                  Score ≥ this → instant grant (no challenge).
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Challenge Threshold</Label>
                  <Badge
                    variant="outline"
                    className="tabular-nums text-[10px]"
                  >
                    {manualChallenge.toFixed(2)}
                  </Badge>
                </div>
                <Slider
                  value={[manualChallenge]}
                  min={0.4}
                  max={0.95}
                  step={0.01}
                  onValueChange={(v) => setManualChallenge(v[0] ?? 0.75)}
                />
                <p className="text-[11px] text-muted-foreground mt-2">
                  Score ≥ this → grant after liveness challenge passes.
                </p>
              </div>
            </div>

            {manualChallenge >= manualGrant && (
              <p className="text-xs text-warning-foreground flex items-center gap-1.5 mt-4">
                <AlertCircle className="size-3.5" />
                Challenge threshold should be lower than grant threshold.
              </p>
            )}

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Current saved:{" "}
                <span className="font-mono">
                  grant {kiosk.thresholdGranted.toFixed(2)} · challenge{" "}
                  {kiosk.thresholdChallenge.toFixed(2)}
                </span>
                <span className="ml-2 text-muted-foreground/70">
                  (config v{kiosk.configVersion})
                </span>
              </div>
              <Button
                onClick={() => saveManualMutation.mutate()}
                disabled={
                  saveManualMutation.isPending ||
                  manualChallenge >= manualGrant
                }
              >
                {saveManualMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save to kiosk
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------- small inline metric card ----------

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "default",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
  accent?: "default" | "success" | "warning" | "danger";
}) {
  const accentClass =
    accent === "success"
      ? "bg-success/10 text-success"
      : accent === "warning"
        ? "bg-warning/10 text-warning-foreground"
        : accent === "danger"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary";
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-4 hover:shadow-md transition-shadow h-full">
        <div className="flex items-start justify-between">
          <div
            className={`size-8 rounded-lg flex items-center justify-center ${accentClass}`}
          >
            <Icon className="size-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-xl font-bold tracking-tight tabular-nums">
            {value}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
          {hint && (
            <p className="text-[10px] text-muted-foreground/80 mt-0.5">
              {hint}
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
