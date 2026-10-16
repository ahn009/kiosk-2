"use client";

import { motion } from "framer-motion";
import {
  XCircle,
  ShieldAlert,
  Camera as CameraIcon,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DENIED_REASON_TEXT } from "../state";

export function DeniedScreen({
  reason,
  snapshotTaken,
  superoverrideAvailable,
  onRetry,
  onSupervisorOverride,
}: {
  reason: string;
  snapshotTaken: boolean;
  superoverrideAvailable: boolean;
  onRetry: () => void;
  onSupervisorOverride: () => void;
}) {
  const text = DENIED_REASON_TEXT[reason] ?? "Verification failed";

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-red-950/40 via-background to-background">
      <div className="absolute inset-0 bg-grid opacity-20" />

      {/* Snapshot captured badge */}
      {snapshotTaken && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-10 flex items-center gap-2 rounded-full bg-destructive/15 text-destructive border border-destructive/30 px-4 py-1.5"
        >
          <CameraIcon className="size-4" />
          <span className="text-sm font-medium">Snapshot captured</span>
        </motion.div>
      )}

      <motion.div
        initial={{ scale: 0, rotate: 10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="mb-6 relative"
      >
        <div className="size-32 rounded-full bg-destructive/15 flex items-center justify-center">
          <XCircle className="size-20 text-destructive" strokeWidth={2.5} />
        </div>
        <span className="absolute inset-0 rounded-full border-2 border-destructive text-destructive animate-pulse-ring" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl font-bold tracking-tight text-destructive"
      >
        Access Denied
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-3 flex flex-col items-center gap-1"
      >
        <p className="text-muted-foreground text-sm">
          Security has been notified
        </p>
        <p className="text-[11px] text-muted-foreground/70 font-mono">
          reason: {reason}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-6 w-[440px] max-w-[90vw] rounded-2xl border border-destructive/30 bg-card/60 backdrop-blur-xl p-4"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="size-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">{text}</p>
            <p className="text-xs text-muted-foreground mt-1">
              This incident has been logged to the immutable audit trail.
              Please contact your security office if you believe this is an
              error.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-6 flex items-center gap-2"
      >
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw className="size-4" />
          Try again
        </Button>
        {superoverrideAvailable && (
          <Button
            onClick={onSupervisorOverride}
            variant="outline"
            className="gap-2 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
          >
            <KeyRound className="size-4" />
            Supervisor override
          </Button>
        )}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-8 text-[11px] text-muted-foreground font-mono"
      >
        Auto-returning to ready in 4 seconds…
      </motion.p>
    </div>
  );
}

export function TimeoutScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-amber-950/30 via-background to-background">
      <div className="absolute inset-0 bg-grid opacity-20" />

      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="mb-6 relative"
      >
        <div className="size-32 rounded-full bg-amber-500/15 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw className="size-16 text-amber-400" />
          </motion.div>
        </div>
        <span className="absolute inset-0 rounded-full border-2 border-amber-400 text-amber-400 animate-pulse-ring" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl font-bold tracking-tight text-amber-300"
      >
        Session Timed Out
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-muted-foreground text-sm mt-2"
      >
        No activity for too long. Tap to start a new session.
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onClick={onRetry}
        className="mt-6 rounded-full bg-amber-500 hover:bg-amber-600 text-amber-950 px-6 py-2.5 text-sm font-medium flex items-center gap-2"
      >
        <RefreshCw className="size-4" />
        Tap to retry
      </motion.button>
    </div>
  );
}
