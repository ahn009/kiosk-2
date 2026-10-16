"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  DoorOpen,
  ShieldCheck,
  UserCheck,
  Clock,
  Fingerprint,
  Crown,
} from "lucide-react";
import type { EmployeeDisplay, EmployeeRef } from "../state";
import { lastEntryLabel } from "../state";
import { Badge } from "@/components/ui/badge";

export function SuccessScreen({
  employeeRef,
  employeeDisplay,
  matchScore,
  supervisorOverride,
  kioskName,
}: {
  employeeRef: EmployeeRef;
  employeeDisplay?: EmployeeDisplay;
  matchScore: number;
  supervisorOverride: boolean;
  kioskName: string;
}) {
  const name = employeeDisplay?.name ?? employeeRef.name;
  const code = employeeDisplay?.code ?? employeeRef.code;
  const dept = employeeDisplay?.department ?? "—";
  const designation = employeeDisplay?.designation ?? "—";
  const accessLevel = employeeDisplay?.accessLevel ?? employeeRef.accessLevel;
  const photoUrl = employeeDisplay?.photoUrl ?? employeeRef.photoUrl ?? null;
  const lastEntry = employeeDisplay?.lastEntry ?? null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-950/40 via-background to-background">
      <div className="absolute inset-0 bg-grid opacity-20" />

      {/* Gate triggered badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-10 flex items-center gap-2 rounded-full bg-success/15 text-success border border-success/30 px-4 py-1.5"
      >
        <DoorOpen className="size-4" />
        <span className="text-sm font-medium">Gate triggered</span>
        <span className="text-[10px] font-mono opacity-70 ml-1">
          {kioskName}
        </span>
      </motion.div>

      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
        className="mb-6 relative"
      >
        <div className="size-32 rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 className="size-20 text-success" strokeWidth={2.5} />
        </div>
        <span className="absolute inset-0 rounded-full border-2 border-success text-success animate-pulse-ring" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-5xl font-bold tracking-tight text-success"
      >
        Access Granted
      </motion.h1>

      {supervisorOverride && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-2 flex items-center gap-1.5 text-amber-300 text-xs"
        >
          <Crown className="size-3.5" />
          Supervisor override applied
        </motion.div>
      )}

      {/* Employee card panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="mt-6 w-[460px] max-w-[90vw] rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5"
      >
        <div className="flex items-center gap-4">
          {/* Photo */}
          <div className="size-20 rounded-2xl overflow-hidden bg-primary/10 border border-border/60 flex items-center justify-center shrink-0">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-mono text-primary uppercase">
                {name.slice(0, 2)}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold truncate">{name}</h2>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {code}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{designation}</p>
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              {dept}
            </p>
            <div className="flex items-center gap-3 mt-2 text-[11px]">
              <span className="flex items-center gap-1 text-muted-foreground">
                <UserCheck className="size-3 text-primary" />
                Access L{accessLevel}
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3" />
                Last: {lastEntryLabel(lastEntry)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer metrics */}
        <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Fingerprint className="size-3 text-success" />
            Match
            <span className="font-mono text-success">
              {supervisorOverride ? "—" : `${(matchScore * 100).toFixed(1)}%`}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3 text-success" />
            Verified
          </span>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-8 text-[11px] text-muted-foreground font-mono"
      >
        Returning to ready in 5 seconds…
      </motion.p>
    </div>
  );
}
