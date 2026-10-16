"use client";

import { motion } from "framer-motion";
import { ShieldX, Lock, Activity } from "lucide-react";

export function LockdownScreen({ reason }: { reason?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
      {/* Diagonal red stripes */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            oklch(0.4 0.2 25 / 0.4),
            oklch(0.4 0.2 25 / 0.4) 20px,
            transparent 20px,
            transparent 60px
          )`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-red-950/40 via-background/80 to-red-950/40" />

      {/* Slow scanning red light */}
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-red-500/15 to-transparent pointer-events-none"
      />

      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="size-32 rounded-3xl bg-destructive/15 border-2 border-destructive flex items-center justify-center"
          >
            <ShieldX className="size-20 text-destructive" strokeWidth={2.5} />
          </motion.div>
          <span className="absolute -inset-2 rounded-3xl border-2 border-destructive text-destructive animate-pulse-ring" />
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-destructive">
            SYSTEM LOCKDOWN
          </h1>
          <p className="text-muted-foreground text-base">
            All access has been denied
          </p>
          {reason && (
            <p className="text-[11px] text-destructive/80 font-mono mt-1">
              {reason}
            </p>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2">
          <Lock className="size-4 text-destructive" />
          <span className="text-xs text-destructive uppercase tracking-wider">
            Scanner disabled
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-2">
          <Activity className="size-3 animate-pulse" />
          Polling system state every 5 seconds…
        </div>
      </motion.div>
    </div>
  );
}
