"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  CameraOff,
  ScanFace,
  Loader2,
  Eye,
  ArrowLeft,
  ArrowRight,
  Activity,
  ShieldCheck,
} from "lucide-react";
import type { CameraStatus } from "../use-camera";
import type { EmployeeRef, ChallengeSeed } from "../state";
import { cn } from "@/lib/utils";

export type FacePhase = "detecting" | "liveness" | "embedding" | "verifying" | "ready";

export const FACE_PHASE_LABEL: Record<FacePhase, string> = {
  detecting: "Detecting face",
  liveness: "Liveness check",
  embedding: "Computing embedding",
  verifying: "Verifying match",
  ready: "Ready",
};

export function FaceVerifyScreen({
  employeeRef,
  videoRef,
  cameraStatus,
  phase,
  livenessScore,
  matchScore,
  challengeMode,
  onChallengeNeeded,
  onTimeout,
  onCameraFallback,
  onCancel,
  superoverrideAvailable,
  onSupervisorOverride,
}: {
  employeeRef: EmployeeRef;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraStatus: CameraStatus;
  phase: FacePhase;
  livenessScore: number;
  matchScore: number;
  challengeMode: string;
  onChallengeNeeded: () => void;
  onTimeout: () => void;
  onCameraFallback: () => void;
  onCancel: () => void;
  superoverrideAvailable: boolean;
  onSupervisorOverride: () => void;
}) {
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  // 30s session timeout
  useEffect(() => {
    const id = window.setInterval(() => {
      const e = Math.floor((Date.now() - startRef.current) / 1000);
      setSessionElapsed(e);
      if (e >= 30) onTimeout();
    }, 500);
    return () => window.clearInterval(id);
  }, [onTimeout]);

  const live = cameraStatus.state === "live";
  const denied = cameraStatus.state === "denied" || cameraStatus.state === "unsupported";

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Top bar */}
      <div className="absolute top-6 left-6 z-30 flex items-center gap-2">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 backdrop-blur px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Cancel
        </button>
      </div>
      <div className="absolute top-6 right-6 z-30">
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 backdrop-blur px-3 py-1.5 text-xs">
          <span className="text-muted-foreground font-mono">{employeeRef.code}</span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">
            {Math.max(0, 30 - sessionElapsed)}s
          </span>
        </div>
      </div>

      {/* Center stage */}
      <div className="flex-1 flex items-center justify-center px-6 gap-12">
        {/* Camera frame */}
        <div className="relative">
          <div className="relative w-[420px] h-[300px] max-w-[60vw] max-h-[50vh] rounded-3xl overflow-hidden border-2 border-primary/40 bg-black/70 shadow-2xl shadow-primary/10">
            {/* video */}
            {live ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : denied ? (
              <FacePlaceholder deniedReason={cameraStatus.state === "denied" ? cameraStatus.message : "Camera unavailable"} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
              </div>
            )}

            {/* overlay grid */}
            <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />

            {/* face bounding box corners */}
            {phase !== "detecting" && phase !== "ready" && (
              <FaceFrame phase={phase} />
            )}

            {/* scanning line */}
            <span className="absolute inset-x-0 h-12 bg-gradient-to-b from-primary/0 via-primary/40 to-primary/0 animate-scanline pointer-events-none" />

            {/* Top label */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur px-2.5 py-1 text-[10px]">
                {live ? (
                  <>
                    <span className="size-1.5 rounded-full bg-success animate-pulse" />
                    <span className="text-success font-mono">LIVE</span>
                  </>
                ) : (
                  <>
                    <CameraOff className="size-3" />
                    <span className="text-muted-foreground">SIM</span>
                  </>
                )}
              </div>
              <div className="rounded-full bg-black/50 backdrop-blur px-2.5 py-1 text-[10px] font-mono text-muted-foreground">
                {challengeMode}
              </div>
            </div>

            {/* Bottom label */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center">
              <div className="rounded-full bg-black/60 backdrop-blur px-3 py-1.5 text-xs flex items-center gap-1.5">
                <ScanFace className="size-3.5 text-primary" />
                <span className="text-foreground">Look at the camera</span>
              </div>
            </div>

            {/* Session indicator corners */}
            <Corner className="top-2 left-2 border-t-2 border-l-2" />
            <Corner className="top-2 right-2 border-t-2 border-r-2" />
            <Corner className="bottom-2 left-2 border-b-2 border-l-2" />
            <Corner className="bottom-2 right-2 border-b-2 border-r-2" />
          </div>

          {/* Pulse ring outside frame */}
          <span className="absolute inset-0 rounded-3xl border-2 border-primary/60 text-primary/60 animate-pulse-ring pointer-events-none" />
        </div>

        {/* Right panel — meters */}
        <div className="flex flex-col gap-3 w-72 max-w-[35vw]">
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
              Live Metrics
            </p>
            <Meter
              label="Liveness"
              value={livenessScore}
              color="bg-emerald-500"
              icon={<ShieldCheck className="size-3.5 text-emerald-400" />}
              threshold={0.87}
            />
            <div className="mt-3">
              <Meter
                label="Face match"
                value={matchScore}
                color="bg-primary"
                icon={<ScanFace className="size-3.5 text-primary" />}
                threshold={0.85}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Pipeline
            </p>
            <div className="flex flex-col gap-1.5">
              <PhaseRow active={phase === "detecting"} label={FACE_PHASE_LABEL.detecting} />
              <PhaseRow active={phase === "liveness"} label={FACE_PHASE_LABEL.liveness} />
              <PhaseRow active={phase === "embedding"} label={FACE_PHASE_LABEL.embedding} />
              <PhaseRow active={phase === "verifying"} label={FACE_PHASE_LABEL.verifying} />
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {denied ? (
                <button
                  onClick={onCameraFallback}
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Camera className="size-3.5" /> Use simulated capture
                </button>
              ) : (
                <>
                  <Activity className="size-3 inline mr-1.5 text-primary" />
                  Liveness ≥ 0.87 · Match ≥ 0.85 required
                </>
              )}
            </p>
          </div>

          {superoverrideAvailable && (
            <button
              onClick={onSupervisorOverride}
              className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/15 flex items-center gap-1.5"
            >
              <ShieldCheck className="size-3.5" />
              Supervisor override
            </button>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative z-10 border-t border-border/40 bg-card/30 backdrop-blur px-6 py-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Loader2
              className={cn(
                "size-3",
                phase === "ready" ? "" : "animate-spin",
              )}
            />
            <span className="font-mono">{FACE_PHASE_LABEL[phase]}…</span>
          </span>
          <span className="font-mono text-[10px]">
            employee: {employeeRef.code}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {phase === "ready" && null}
      </AnimatePresence>
    </div>
  );
}

function FaceFrame({ phase }: { phase: FacePhase }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.2 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div
        className={cn(
          "relative w-44 h-56 border-2 rounded-2xl transition-colors",
          phase === "verifying"
            ? "border-primary/80"
            : phase === "liveness"
              ? "border-emerald-400/80"
              : "border-primary/50",
        )}
      >
        <span className="absolute -top-1 -left-1 size-3 border-t-2 border-l-2 border-current rounded-tl-md" />
        <span className="absolute -top-1 -right-1 size-3 border-t-2 border-r-2 border-current rounded-tr-md" />
        <span className="absolute -bottom-1 -left-1 size-3 border-b-2 border-l-2 border-current rounded-bl-md" />
        <span className="absolute -bottom-1 -right-1 size-3 border-b-2 border-r-2 border-current rounded-br-md" />
      </div>
    </motion.div>
  );
}

function Corner({ className }: { className?: string }) {
  return (
    <div
      className={cn("absolute size-5 border-primary/80 rounded", className)}
    />
  );
}

function Meter({
  label,
  value,
  color,
  icon,
  threshold,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  threshold: number;
}) {
  const pct = Math.max(0, Math.min(100, value * 100));
  const ok = value >= threshold;
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-[11px]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className={cn("font-mono", ok ? "text-success" : "text-muted-foreground")}>
          {(value * 100).toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn("h-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function PhaseRow({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          "size-2 rounded-full",
          active ? "bg-primary animate-pulse" : "bg-muted-foreground/40",
        )}
      />
      <span className={cn(active ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      {active && <Loader2 className="size-3 animate-spin ml-auto text-primary" />}
    </div>
  );
}

function FacePlaceholder({ deniedReason }: { deniedReason: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="relative"
      >
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <ellipse
            cx="40"
            cy="32"
            rx="18"
            ry="22"
            fill="oklch(0.5 0.01 160 / 0.15)"
            stroke="oklch(0.7 0.05 160 / 0.4)"
            strokeWidth="1.5"
          />
          <path
            d="M22 70 Q40 50 58 70"
            stroke="oklch(0.7 0.05 160 / 0.4)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-x-2 h-8 bg-gradient-to-b from-primary/0 via-primary/40 to-primary/0 animate-scanline" />
      </motion.div>
      <p className="text-[10px] uppercase tracking-wider mt-1">{deniedReason}</p>
    </div>
  );
}

export function LivenessChallengeScreen({
  instruction,
  countdown,
  totalMs,
  onPass,
  onFail,
}: {
  instruction: ChallengeSeed;
  countdown: number;
  totalMs: number;
  onPass: () => void;
  onFail: () => void;
}) {
  // Auto-fail at 0
  const failedRef = useRef(false);
  useEffect(() => {
    if (countdown <= 0 && !failedRef.current) {
      failedRef.current = true;
      const id = window.setTimeout(() => onFail(), 300);
      return () => window.clearTimeout(id);
    }
  }, [countdown, onFail]);

  const labelMap: Record<ChallengeSeed, { text: string; icon: React.ReactNode }> = {
    blink: {
      text: "Blink slowly",
      icon: <Eye className="size-20" />,
    },
    turn_left: {
      text: "Turn head left",
      icon: <ArrowLeft className="size-20" />,
    },
    turn_right: {
      text: "Turn head right",
      icon: <ArrowRight className="size-20" />,
    },
  };
  const cfg = labelMap[instruction];
  const progress = Math.max(0, Math.min(1, countdown / (totalMs / 1000)));

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-amber-950/30" />
      <div className="absolute inset-0 bg-grid opacity-20" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 relative z-10"
      >
        <div className="text-amber-300 text-[11px] uppercase tracking-widest">
          Liveness Challenge
        </div>

        {/* Countdown ring */}
        <div className="relative size-44">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="oklch(0.3 0.03 75 / 0.4)"
              strokeWidth="4"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="oklch(0.8 0.16 75)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 46}
              animate={{
                strokeDashoffset: 2 * Math.PI * 46 * (1 - progress),
              }}
              transition={{ duration: 0.5, ease: "linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <motion.div
              key={instruction}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 12 }}
              className="text-amber-300"
            >
              {cfg.icon}
            </motion.div>
            <div className="font-mono text-3xl font-bold text-amber-200">
              {Math.ceil(countdown)}
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-bold tracking-tight text-amber-200">
          {cfg.text}
        </h2>
        <p className="text-muted-foreground text-sm">
          Hold the gesture for one second to confirm liveness
        </p>

        <div className="flex gap-2 mt-2">
          <button
            onClick={onPass}
            className="rounded-full bg-amber-500 hover:bg-amber-600 text-amber-950 px-5 py-2 text-sm font-medium flex items-center gap-1.5"
          >
            <ShieldCheck className="size-4" />
            I&apos;ve done it
          </button>
        </div>
      </motion.div>
    </div>
  );
}
