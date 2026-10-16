"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  ScanLine,
  CreditCard,
  Clock,
  MapPin,
  Cpu,
  Camera,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatClock, formatDate } from "../use-clock";

export function IdleScreen({
  kioskId,
  kioskName,
  kioskLocation,
  kioskStatus,
  orgCode,
  clock,
  cameraReady,
  onOpenDemoPicker,
  onScanLineClick,
  demoMode,
}: {
  kioskId: string;
  kioskName: string;
  kioskLocation: string;
  kioskStatus: string;
  orgCode: string;
  clock: Date;
  cameraReady: boolean;
  onOpenDemoPicker: () => void;
  onScanLineClick: () => void;
  /** When false, demo affordances (simulate button) are hidden. */
  demoMode: boolean;
}) {
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />

      {/* Top-left kiosk badge */}
      <div className="absolute top-6 left-6 z-20">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 border-border/70 bg-card/60 backdrop-blur px-3 py-1.5"
          >
            <Cpu className="size-3.5 text-primary" />
            <span className="font-mono">{kioskId}</span>
          </Badge>
          <Badge
            variant="outline"
            className="gap-1.5 border-border/70 bg-card/60 backdrop-blur px-3 py-1.5"
          >
            <span
              className={`size-1.5 rounded-full ${
                kioskStatus === "online"
                  ? "bg-success animate-pulse"
                  : kioskStatus === "lockdown"
                    ? "bg-destructive"
                    : "bg-muted-foreground"
              }`}
            />
            <span className="capitalize text-muted-foreground">{kioskStatus}</span>
          </Badge>
        </div>
      </div>

      {/* Top-right clock */}
      <div className="absolute top-6 right-6 z-20 flex flex-col items-end">
        <div className="font-mono text-2xl tracking-tight leading-none">
          {formatClock(clock)}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {formatDate(clock)}
        </div>
      </div>

      {/* Center hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center text-center"
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-8"
          >
            <div className="size-16 rounded-2xl bg-gradient-to-br from-primary to-teal-700 flex items-center justify-center shadow-2xl shadow-primary/30">
              <ShieldCheck className="size-9 text-primary-foreground" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl font-bold tracking-tight leading-none">
                Sentinel<span className="text-primary">Kiosk</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {orgCode} · Access Control · v2.0
              </p>
            </div>
          </motion.div>

          {/* Scan prompt */}
          <motion.button
            onClick={onScanLineClick}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="group relative flex flex-col items-center gap-4 cursor-pointer"
          >
            <div className="relative size-44 rounded-3xl border-2 border-primary/40 bg-primary/5 flex items-center justify-center overflow-hidden">
              {/* pulse ring */}
              <span className="absolute inset-0 rounded-3xl border-2 border-primary text-primary animate-pulse-ring" />
              {/* scanline */}
              <span className="absolute inset-x-0 h-12 bg-gradient-to-b from-primary/0 via-primary/30 to-primary/0 animate-scanline" />
              <ScanLine className="size-16 text-primary group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-center">
              <h2 className="text-4xl font-bold tracking-tight">
                Scan your ID card
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Present your QR-enabled employee card to the reader
              </p>
            </div>
          </motion.button>

          {/* Demo scan trigger — hidden unless the server runs DEMO_MODE */}
          {demoMode && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenDemoPicker}
              className="gap-2 border-dashed bg-card/40 backdrop-blur"
            >
              <CreditCard className="size-3.5" />
              Simulate card scan
            </Button>
          </motion.div>
          )}
        </motion.div>
      </div>

      {/* Camera preview (privacy masked) */}
      <div className="absolute bottom-24 right-6 z-10">
        <div className="relative size-28 rounded-2xl overflow-hidden border-2 border-border/60 bg-black/60 backdrop-blur">
          {/* blurred mask + scanlines while idle */}
          <div className="absolute inset-0 bg-gradient-to-br from-muted/20 to-muted/5 backdrop-blur-md" />
          <div className="absolute inset-0 overflow-hidden">
            <span className="absolute inset-x-0 h-6 bg-gradient-to-b from-primary/0 via-primary/30 to-primary/0 animate-scanline" />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground/70">
            {cameraReady ? (
              <>
                <Camera className="size-4" />
                <span className="text-[9px] uppercase tracking-wider">
                  Camera idle
                </span>
              </>
            ) : (
              <>
                <Lock className="size-4" />
                <span className="text-[9px] uppercase tracking-wider">
                  Camera offline
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-border/40 bg-card/30 backdrop-blur">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-6 py-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <span className="flex items-center gap-1.5">
              <Camera className="size-3" />
              Facial recognition in use — consent required
            </span>
            <span className="hidden sm:inline text-border">·</span>
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="size-3" />
              Snapshots captured for denied attempts
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3" />
              {kioskName} · {kioskLocation}
            </span>
            <span className="hidden sm:inline text-border">·</span>
            <span className="flex items-center gap-1.5 font-mono">
              <Clock className="size-3" />
              Ready
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
