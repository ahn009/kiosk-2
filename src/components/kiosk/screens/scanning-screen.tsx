"use client";

import { motion } from "framer-motion";
import { Loader2, CreditCard, ShieldCheck } from "lucide-react";

export function ScanningScreen({ elapsedMs }: { elapsedMs: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-6"
      >
        {/* Animated card scan icon */}
        <div className="relative">
          <motion.div
            className="size-32 rounded-3xl border-2 border-primary/60 bg-primary/5 flex items-center justify-center overflow-hidden"
          >
            <span className="absolute inset-x-0 h-10 bg-gradient-to-b from-primary/0 via-primary/40 to-primary/0 animate-scanline" />
            <CreditCard className="size-12 text-primary" />
          </motion.div>
          <div className="absolute -inset-1 rounded-3xl border-2 border-primary text-primary animate-pulse-ring" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h2 className="text-3xl font-bold tracking-tight">
            Verifying ID card…
          </h2>
          <p className="text-muted-foreground text-sm">
            Decrypting QR token · checking revocation list
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-72 max-w-[80vw]">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="h-full bg-gradient-to-r from-primary to-teal-500"
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" />
              HMAC verify
            </span>
            <span className="font-mono">{elapsedMs}ms</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <ShieldCheck className="size-3.5 text-success" />
          Encrypted channel · signed by {`{KEY:k1}`}
        </motion.div>
      </motion.div>
    </div>
  );
}

export function TokenOkScreen({
  employeeRef,
  onContinue,
}: {
  employeeRef: { code: string; name: string };
  onContinue: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-5"
      >
        <motion.div
          initial={{ scale: 0.5, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="size-24 rounded-2xl bg-success/15 text-success flex items-center justify-center"
        >
          <ShieldCheck className="size-12" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center gap-1.5"
        >
          <h2 className="text-3xl font-bold tracking-tight">ID Verified</h2>
          <p className="text-muted-foreground text-sm">
            Welcome,{" "}
            <span className="text-foreground font-medium">
              {employeeRef.name}
            </span>{" "}
            — look at the camera
          </p>
        </motion.div>

        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-mono px-1.5 py-0.5 rounded bg-muted">
            {employeeRef.code}
          </span>
          <button
            onClick={onContinue}
            className="text-primary hover:underline cursor-pointer"
          >
            Continue →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
