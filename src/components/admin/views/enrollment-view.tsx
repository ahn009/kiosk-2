"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanFace,
  Search,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Camera,
  CameraOff,
  RefreshCw,
  ShieldCheck,
  FileCheck2,
  Eye,
  Loader2,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { apiClient } from "@/lib/api-client";
import type { EmployeeDTO } from "@/lib/types";
import { ViewContainer, EmptyState, ScoreBar } from "../lib/ui-bits";
import { initials, formatDateTime, accessLevelClass } from "../lib/admin-utils";

interface CaptureSlot {
  id: number;
  quality: number;
  metrics: { sharpness: number; brightness: number; faceSize: number };
  capturedAt: number;
}

const MIN_QUALITY = 0.8;
const NUM_SLOTS = 5;

type WizardStep = "consent" | "capture" | "review";

export function EnrollmentView() {
  const enrollmentTargetId = useAppStore((s) => s.enrollmentTargetId);
  const setEnrollmentTargetId = useAppStore((s) => s.setEnrollmentTargetId);
  const setSection = useAppStore((s) => s.setAdminSection);
  const qc = useQueryClient();

  const [step, setStep] = useState<WizardStep>("consent");
  const [consent, setConsent] = useState(false);
  const [slots, setSlots] = useState<CaptureSlot[]>([]);

  const { data: target, isLoading: targetLoading } = useQuery({
    queryKey: ["employee-detail", enrollmentTargetId],
    queryFn: () => apiClient.employees.get(enrollmentTargetId!),
    enabled: !!enrollmentTargetId,
  });

  const { data: status } = useQuery({
    queryKey: ["enrollment-status", enrollmentTargetId],
    queryFn: () => apiClient.enrollment.status(enrollmentTargetId!),
    enabled: !!enrollmentTargetId,
  });

  const captureMutation = useMutation({
    mutationFn: () => {
      const images = slots.map((s, i) => `capture_${i}_${Date.now()}_${s.quality}`);
      return apiClient.enrollment.capture(enrollmentTargetId!, {
        images,
        consentAcknowledged: consent,
      });
    },
    onSuccess: () => {
      toast.success("Face embedding stored · employee can now verify at kiosks");
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["enrollment-status"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setSlots([]);
      setStep("review");
    },
    onError: (e: { error?: string }) =>
      toast.error(e?.error ?? "Enrollment failed"),
  });

  function reset() {
    setEnrollmentTargetId(null);
    setSection("employees");
    setStep("consent");
    setConsent(false);
    setSlots([]);
  }

  // -------- No target: show picker --------
  if (!enrollmentTargetId) {
    return <EmployeePicker onPick={(emp) => setEnrollmentTargetId(emp.id)} />;
  }

  // -------- Loading target --------
  if (targetLoading || !target) {
    return (
      <ViewContainer>
        <Card className="p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-32 w-full" />
        </Card>
      </ViewContainer>
    );
  }

  const avgQuality =
    slots.length > 0
      ? slots.reduce((a, s) => a + s.quality, 0) / slots.length
      : 0;
  const allGood = slots.length >= 3 && slots.every((s) => s.quality >= MIN_QUALITY);

  return (
    <ViewContainer>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to employees
          </button>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ScanFace className="size-5 text-primary" />
            Enroll Face · {target.fullName}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {target.employeeCode} · {target.departmentName ?? "—"}
          </p>
        </div>
        {status?.status === "enrolled" && (
          <Badge variant="outline" className="bg-success/15 text-success border-success/30">
            <CheckCircle2 className="size-3" />
            Already enrolled · {status.qualityScore?.toFixed(2) ?? "—"} score
          </Badge>
        )}
      </div>

      {/* Stepper */}
      <Card className="p-4">
        <Stepper step={step} />
      </Card>

      <AnimatePresence mode="wait">
        {step === "consent" && (
          <motion.div
            key="consent"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            <ConsentStep
              employee={target}
              consent={consent}
              setConsent={setConsent}
              onNext={() => setStep("capture")}
              alreadyEnrolled={status?.status === "enrolled"}
            />
          </motion.div>
        )}
        {step === "capture" && (
          <motion.div
            key="capture"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            <CaptureStep
              slots={slots}
              setSlots={setSlots}
              onBack={() => setStep("consent")}
              onNext={() => setStep("review")}
              canProceed={allGood}
            />
          </motion.div>
        )}
        {step === "review" && (
          <motion.div
            key="review"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            <ReviewStep
              employee={target}
              slots={slots}
              avgQuality={avgQuality}
              onBack={() => setStep("capture")}
              onSubmit={() => captureMutation.mutate()}
              submitting={captureMutation.isPending}
              done={
                captureMutation.isSuccess ||
                (status?.status === "enrolled" && slots.length === 0)
              }
              onReset={reset}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </ViewContainer>
  );
}

// ============ Employee picker ============

function EmployeePicker({ onPick }: { onPick: (emp: EmployeeDTO) => void }) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["employees-for-enrollment", search],
    queryFn: () => apiClient.employees.list({ q: search || undefined, page: 1 }),
  });
  const employees = data?.items ?? [];

  return (
    <ViewContainer>
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ScanFace className="size-5 text-primary" />
          Start Enrollment
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Select an employee to begin the face enrollment wizard.
        </p>
      </div>
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search employees by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>
      <Card className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees found"
            description="Try a different search term."
          />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin p-2">
            {employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => onPick(emp)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors text-left group"
              >
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs">
                    {initials(emp.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{emp.fullName}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {emp.employeeCode} · {emp.departmentName ?? "—"}
                  </p>
                </div>
                {emp.faceEnrolled ? (
                  <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[10px]">
                    Re-enroll
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Not enrolled
                  </Badge>
                )}
                <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </button>
            ))}
          </div>
        )}
      </Card>
    </ViewContainer>
  );
}

// ============ Stepper ============

function Stepper({ step }: { step: WizardStep }) {
  const steps: { id: WizardStep; label: string; n: number }[] = [
    { id: "consent", label: "Consent", n: 1 },
    { id: "capture", label: "Capture", n: 2 },
    { id: "review", label: "Review & Submit", n: 3 },
  ];
  const activeIdx = steps.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2 flex-1">
          <div
            className={cn(
              "size-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors",
              i < activeIdx
                ? "bg-success text-success-foreground"
                : i === activeIdx
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {i < activeIdx ? <CheckCircle2 className="size-4" /> : s.n}
          </div>
          <span
            className={cn(
              "text-xs font-medium hidden sm:inline",
              i === activeIdx ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "h-0.5 flex-1 rounded-full transition-colors",
                i < activeIdx ? "bg-success" : "bg-border",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============ Consent step ============

function ConsentStep({
  employee,
  consent,
  setConsent,
  onNext,
  alreadyEnrolled,
}: {
  employee: EmployeeDTO;
  consent: boolean;
  setConsent: (v: boolean) => void;
  onNext: () => void;
  alreadyEnrolled: boolean;
}) {
  return (
    <Card className="p-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileCheck2 className="size-5 text-primary" />
            <h3 className="font-semibold">Biometric Consent</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Before capturing biometric data, the employee must explicitly consent
            to facial recognition processing. This consent is recorded with a
            timestamp and stored alongside the embedding.
          </p>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Employee</span>
              <span className="font-medium">{employee.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Code</span>
              <span className="font-mono">{employee.employeeCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Department</span>
              <span className="font-medium">{employee.departmentName ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Access Level</span>
              <Badge
                variant="outline"
                className={cn("text-[10px]", accessLevelClass(employee.accessLevel))}
              >
                L{employee.accessLevel}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Timestamp</span>
              <span className="font-mono">{formatDateTime(new Date().toISOString())}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="rounded-lg border border-border p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              GDPR Compliance Notice
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
                Biometric data is stored as a 512-dimension numeric embedding, not as a raw image.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
                The embedding cannot be reversed to reconstruct the face.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
                The employee may request deletion at any time (right to erasure).
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
                Verification events are logged immutably with the audit trail.
              </li>
            </ul>
            <label
              className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors"
            >
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(!!v)}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="font-medium">Employee has given explicit consent</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  I confirm that the employee has read and agreed to biometric processing under GDPR Article 9.
                </span>
              </span>
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between">
            {alreadyEnrolled && (
              <p className="text-xs text-warning-foreground flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" />
                Re-enrolling will overwrite the existing embedding.
              </p>
            )}
            <Button onClick={onNext} disabled={!consent} className="ml-auto">
              Proceed to capture
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============ Capture step ============

function CaptureStep({
  slots,
  setSlots,
  onBack,
  onNext,
  canProceed,
}: {
  slots: CaptureSlot[];
  setSlots: React.Dispatch<React.SetStateAction<CaptureSlot[]>>;
  onBack: () => void;
  onNext: () => void;
  canProceed: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraOn(true);
    } catch (e) {
      const err = e as Error;
      setCameraError(err.message ?? "Camera unavailable");
      setCameraOn(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  async function simulateCapture() {
    if (capturing) return;
    if (slots.length >= NUM_SLOTS) {
      toast.info("All capture slots filled");
      return;
    }
    setCapturing(true);
    // simulate async quality checks
    await new Promise((r) => setTimeout(r, 800));
    const quality = 0.7 + Math.random() * 0.28; // 0.7 - 0.98
    const metrics = {
      sharpness: 0.65 + Math.random() * 0.35,
      brightness: 0.6 + Math.random() * 0.4,
      faceSize: 0.55 + Math.random() * 0.45,
    };
    const slot: CaptureSlot = {
      id: Date.now(),
      quality,
      metrics,
      capturedAt: Date.now(),
    };
    setSlots((prev) => [...prev, slot]);
    if (quality < MIN_QUALITY) {
      toast.warning(`Low quality capture (${quality.toFixed(2)}) — consider retrying`);
    } else {
      toast.success(`Capture ${slots.length + 1} accepted (quality ${quality.toFixed(2)})`);
    }
    setCapturing(false);
  }

  function retrySlot(id: number) {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  function clearAll() {
    setSlots([]);
  }

  return (
    <Card className="p-6">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Camera viewport */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Camera className="size-4 text-primary" />
              Capture Viewport
            </h3>
            <div className="flex gap-1.5">
              {!cameraOn ? (
                <Button size="sm" variant="outline" onClick={startCamera}>
                  <Camera className="size-3.5" />
                  Start camera
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={stopCamera}>
                  <CameraOff className="size-3.5" />
                  Stop
                </Button>
              )}
            </div>
          </div>
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden border-2 border-border bg-card bg-grid">
            {cameraOn ? (
              <>
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  playsInline
                  muted
                />
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-x-12 inset-y-8 border-2 border-primary/60 rounded-2xl" />
                  <div className="absolute top-3 left-3 right-3 flex justify-between items-center text-[10px] text-primary-foreground/80">
                    <Badge variant="outline" className="bg-background/70 backdrop-blur text-[10px] gap-1.5">
                      <span className="size-1.5 rounded-full bg-success animate-pulse" /> LIVE
                    </Badge>
                    <span className="text-[10px] font-mono text-foreground/70 bg-background/70 backdrop-blur px-2 py-0.5 rounded">
                      640×480
                    </span>
                  </div>
                  {capturing && (
                    <div className="absolute inset-x-12 inset-y-8 rounded-2xl overflow-hidden">
                      <motion.div
                        className="absolute inset-x-0 h-0.5 bg-primary/80 shadow-[0_0_10px] shadow-primary"
                        initial={{ top: "0%" }}
                        animate={{ top: ["0%", "100%", "0%"] }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <CameraOff className="size-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Camera unavailable</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {cameraError}. You can still simulate captures below —
                  quality scores will be randomized for demo purposes.
                </p>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <Camera className="size-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Camera preview off</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Click &ldquo;Start camera&rdquo; to enable live preview, or simulate captures for the demo.
                </p>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              onClick={simulateCapture}
              disabled={capturing || slots.length >= NUM_SLOTS}
              className="flex-1"
            >
              {capturing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Capture frame {slots.length + 1}/{NUM_SLOTS}
                </>
              )}
            </Button>
            <Button variant="outline" size="icon" onClick={clearAll} title="Clear all">
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        {/* Captures list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Eye className="size-4 text-primary" />
              Captured Frames ({slots.length}/{NUM_SLOTS})
            </h3>
            {slots.length >= 3 && (
              <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-[10px]">
                Min 3 reached
              </Badge>
            )}
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
            {Array.from({ length: NUM_SLOTS }).map((_, i) => {
              const slot = slots[i];
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    slot
                      ? slot.quality >= MIN_QUALITY
                        ? "border-success/30 bg-success/5"
                        : "border-warning/40 bg-warning/5"
                      : "border-dashed border-border bg-muted/30",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "size-12 rounded-md flex items-center justify-center shrink-0",
                        slot
                          ? "bg-gradient-to-br from-primary/20 to-teal-700/20"
                          : "bg-muted",
                      )}
                    >
                      {slot ? (
                        <ScanFace className="size-5 text-primary" />
                      ) : (
                        <Camera className="size-5 text-muted-foreground opacity-40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">
                          Frame {i + 1}
                        </span>
                        {slot && (
                          <span
                            className={cn(
                              "text-xs tabular-nums font-semibold",
                              slot.quality >= MIN_QUALITY
                                ? "text-success"
                                : "text-warning-foreground",
                            )}
                          >
                            {(slot.quality * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {slot ? (
                        <>
                          <ScoreBar value={slot.quality} className="mt-1.5" />
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                            <span>sharpness {(slot.metrics.sharpness * 100).toFixed(0)}%</span>
                            <span>bright {(slot.metrics.brightness * 100).toFixed(0)}%</span>
                            <span>face {(slot.metrics.faceSize * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex justify-end mt-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => retrySlot(slot.id)}
                            >
                              <RefreshCw className="size-3" />
                              Retry
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Awaiting capture…
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button onClick={onNext} disabled={!canProceed}>
              Review captures
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============ Review step ============

function ReviewStep({
  employee,
  slots,
  avgQuality,
  onBack,
  onSubmit,
  submitting,
  done,
  onReset,
}: {
  employee: EmployeeDTO;
  slots: CaptureSlot[];
  avgQuality: number;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  done: boolean;
  onReset: () => void;
}) {
  if (done) {
    return (
      <Card className="p-8 text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="size-16 rounded-full bg-success/15 text-success mx-auto flex items-center justify-center mb-4"
        >
          <CheckCircle2 className="size-9" />
        </motion.div>
        <h3 className="text-lg font-semibold">Enrollment complete</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Face embedding stored. {employee.fullName} can now verify at any kiosk.
        </p>
        <Button onClick={onReset} className="mt-6">
          Back to employees
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Review Captures
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {slots.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "rounded-lg border p-3 text-center",
                  s.quality >= MIN_QUALITY
                    ? "border-success/30 bg-success/5"
                    : "border-warning/40 bg-warning/5",
                )}
              >
                <div className="size-12 mx-auto rounded-md bg-gradient-to-br from-primary/20 to-teal-700/20 flex items-center justify-center mb-2">
                  <ScanFace className="size-5 text-primary" />
                </div>
                <p className="text-[11px] text-muted-foreground">Frame {i + 1}</p>
                <p
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    s.quality >= MIN_QUALITY ? "text-success" : "text-warning-foreground",
                  )}
                >
                  {(s.quality * 100).toFixed(0)}%
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Employee</span>
              <span className="font-medium">{employee.fullName} · {employee.employeeCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frames captured</span>
              <span className="font-medium">{slots.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Average quality</span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  avgQuality >= MIN_QUALITY ? "text-success" : "text-warning-foreground",
                )}
              >
                {(avgQuality * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Embedding dimensions</span>
              <span className="font-mono">512-d float vector</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Consent recorded</span>
              <span className="text-success">✓ Yes</span>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Average Quality Score
            </p>
            <p
              className={cn(
                "text-3xl font-bold mt-1 tabular-nums",
                avgQuality >= MIN_QUALITY ? "text-success" : "text-warning-foreground",
              )}
            >
              {(avgQuality * 100).toFixed(1)}%
            </p>
            <Progress
              value={avgQuality * 100}
              className="mt-2 h-1.5"
            />
            <p className="text-[11px] text-muted-foreground mt-2">
              Threshold: {(MIN_QUALITY * 100).toFixed(0)}%
            </p>
          </div>
          <Button onClick={onSubmit} className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Storing embedding…
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Submit enrollment
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onBack} className="w-full" disabled={submitting}>
            <ArrowLeft className="size-4" />
            Back to capture
          </Button>
        </div>
      </div>
    </Card>
  );
}
