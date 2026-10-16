"use client";

import { useEffect, useRef, useState } from "react";
import { Power, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hold-to-exit button. Press & hold for `holdMs` (default 1800ms) to trigger
 * the exit; an outer ring fills as the hold progresses. Release early cancels.
 *
 * Used by the kiosk for its discreet "Exit Kiosk" control.
 */
export function HoldToExit({
  onExit,
  holdMs = 1800,
  className,
}: {
  onExit: () => void;
  holdMs?: number;
  className?: string;
}) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const stop = () => {
    setHolding(false);
    setProgress(0);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => {
    if (!holding) return;
    startRef.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const p = Math.min(1, elapsed / holdMs);
      setProgress(p);
      if (p >= 1) {
        onExit();
        stop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [holding, holdMs, onExit]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {confirm ? (
        <div className="flex items-center gap-1.5 rounded-full bg-destructive/15 border border-destructive/40 px-2 py-1">
          <span className="text-[11px] text-destructive font-medium pl-1">
            Exit kiosk?
          </span>
          <button
            onClick={() => {
              onExit();
              setConfirm(false);
            }}
            className="size-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:brightness-110"
            aria-label="Confirm exit"
          >
            <LogOut className="size-3.5" />
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="size-6 rounded-full bg-background/80 text-muted-foreground flex items-center justify-center hover:bg-background"
            aria-label="Cancel exit"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          onMouseDown={() => setHolding(true)}
          onMouseUp={stop}
          onMouseLeave={stop}
          onTouchStart={() => setHolding(true)}
          onTouchEnd={stop}
          onClick={(e) => {
            // fallback: a quick tap opens the confirm popover
            if (!holding && progress === 0) setConfirm(true);
            e.preventDefault();
          }}
          className="relative flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 backdrop-blur px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors select-none overflow-hidden"
          aria-label="Hold to exit kiosk"
        >
          {/* progress ring */}
          <svg className="absolute inset-0 size-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect
              x="0"
              y="0"
              width={progress * 100}
              height="100"
              fill="oklch(0.66 0.2 25 / 0.25)"
            />
          </svg>
          <Power className="size-3 relative" />
          <span className="relative">Hold to exit</span>
        </button>
      )}
    </div>
  );
}
