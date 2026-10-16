"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { api, apiClient } from "@/lib/api-client";
import { buildLiveProbe } from "@/lib/face-client";
import type { VerifyTokenResponse } from "@/lib/types";
import {
  initialState,
  kioskReducer,
  type EmployeeRef,
  type KioskAction,
  type KioskState,
} from "./state";
import { useCamera } from "./use-camera";
import { useClock } from "./use-clock";
import { IdleScreen } from "./screens/idle-screen";
import {
  ScanningScreen,
  TokenOkScreen,
} from "./screens/scanning-screen";
import {
  FaceVerifyScreen,
  LivenessChallengeScreen,
  type FacePhase,
} from "./screens/face-verify-screen";
import { SuccessScreen } from "./screens/success-screen";
import { DeniedScreen, TimeoutScreen } from "./screens/denied-screen";
import { LockdownScreen } from "./screens/lockdown-screen";
import { DemoScanPicker, type DemoCard } from "./demo-scan-picker";
import { SupervisorOverride } from "./supervisor-override";
import { HoldToExit } from "./hold-to-exit";

/** Random hex nonce for token verify. */
function randomNonce(bytes = 8): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random()
    .toString(16)
    .slice(2)
    .padEnd(bytes * 2, "0")
    .slice(0, bytes * 2);
}

/**
 * Actual `/kiosk/config/[kioskId]` response shape (the route returns a richer
 * object than `apiClient.kiosks.config`'s type — Task 1's backend nests
 * thresholds and lockdown under objects). We fetch via the raw `api()`
 * helper to avoid the stale apiClient type.
 */
type KioskConfigResponse = {
  kioskId: string;
  name: string;
  location: string | null;
  status: string;
  thresholds: { granted: number; challenge: number };
  challengeMode: string;
  crlVersion: number;
  configVersion: number;
  lockdown: { active: boolean; reason: string | null; startedAt: string | null };
  lastSyncAt: string | null;
};

/** Local fallback for kiosks not registered in the DB. */
const KIOSK_FALLBACK: Record<string, { name: string; location: string }> = {
  "KSK-001": { name: "Main Lobby", location: "HQ Building A · Lobby" },
  "KSK-002": { name: "Server Room", location: "HQ Building B · Sub-level 1" },
  "KSK-003": { name: "R&D Lab", location: "Innovation Center · Floor 3" },
  "KSK-004": { name: "Warehouse Gate", location: "Logistics Yard · Gate 7" },
};

type KioskRuntime = {
  kioskId: string;
  name: string;
  location: string;
  challengeMode: string;
  thresholdGranted: number;
  thresholdChallenge: number;
  lockdown: boolean;
};

export function KioskApp() {
  const kioskIdFromStore = useAppStore((s) => s.kioskId);
  const setMode = useAppStore((s) => s.setMode);
  const setKioskId = useAppStore((s) => s.setKioskId);

  const kioskId = kioskIdFromStore ?? "KSK-001";

  const { setTheme } = useTheme();
  const [state, dispatch] = useReducer(kioskReducer, initialState);
  const [kioskMeta, setKioskMeta] = useState<KioskRuntime | null>(null);
  const [demoCards, setDemoCards] = useState<DemoCard[]>([]);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  // Demo affordances (demo card picker, simulators) are only available
  // when the server runs with DEMO_MODE=true. In production the kiosk
  // expects a real reader via the reader adapter (not yet integrated).
  const [demoMode, setDemoMode] = useState(false);
  const [supervisorOpen, setSupervisorOpen] = useState(false);
  const [orgCode, setOrgCode] = useState("ACME");
  const [facePhase, setFacePhase] = useState<FacePhase>("detecting");
  const [livenessScore, setLivenessScore] = useState(0);
  const [matchScore, setMatchScore] = useState(0);
  const [scanningElapsedMs, setScanningElapsedMs] = useState(0);
  const [challengeCountdown, setChallengeCountdown] = useState(5);
  const [faceFailCount, setFaceFailCount] = useState(0);
  const [kioskStatus, setKioskStatus] = useState<string>("online");

  const clock = useClock();

  // Force dark theme while kiosk is mounted; restore previous on unmount.
  const prevThemeRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    prevThemeRef.current = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    setTheme("dark");
    return () => {
      setTheme(prevThemeRef.current ?? "light");
    };
  }, [setTheme]);

  // ---- Demo-mode flag (public status) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api<{ demoMode?: boolean }>("/public/status");
        if (!cancelled) setDemoMode(s.demoMode === true);
      } catch {
        if (!cancelled) setDemoMode(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Config polling (lockdown detection + kiosk thresholds) ----
  // This uses the unauthenticated /kiosk/config endpoint. We avoid
  // apiClient.kiosks.list() here because that route requires admin auth —
  // calling it on a public kiosk device returns 401, which the api-client
  // intercepts with logout() → mode="launcher" (would exit the kiosk).
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const cfg = await api<KioskConfigResponse>(`/kiosk/config/${kioskId}`);
        if (cancelled) return;
        const fallback = KIOSK_FALLBACK[kioskId] ?? {
          name: `Kiosk ${kioskId}`,
          location: "Unregistered location",
        };
        setKioskMeta({
          kioskId,
          name: cfg.name || fallback.name,
          location: cfg.location ?? fallback.location,
          challengeMode: cfg.challengeMode,
          thresholdGranted: cfg.thresholds.granted,
          thresholdChallenge: cfg.thresholds.challenge,
          lockdown: cfg.lockdown.active,
        });
        setKioskStatus(cfg.lockdown.active ? "lockdown" : cfg.status || "online");
        if (cfg.lockdown.active) {
          dispatch({
            type: "LOCKDOWN_ON",
            reason: cfg.lockdown.reason ?? "Lockdown active",
          });
        } else if (state.kind === "LOCKDOWN") {
          dispatch({ type: "LOCKDOWN_OFF" });
        }
      } catch {
        /* network error — keep state; show offline */
        setKioskStatus((prev) => (prev === "lockdown" ? prev : "offline"));
      }
    };

    void poll();
    timer = window.setInterval(poll, state.kind === "LOCKDOWN" ? 5000 : 10000);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [kioskId, state.kind === "LOCKDOWN"]);

  // ---- Camera only while in face-verify pipeline ----
  const cameraEnabled =
    state.kind === "FACE_VERIFY" || state.kind === "LIVENESS_CHALLENGE";
  const { status: cameraStatus, videoRef } = useCamera(cameraEnabled);

  // ---- Load demo cards (lazy when picker opened) ----
  const loadDemoCards = useCallback(async () => {
    setDemoLoading(true);
    try {
      const r = await api<{ cards: DemoCard[]; orgCode: string }>("/kiosk/demo-cards");
      setDemoCards(r.cards ?? []);
      if (r.orgCode) setOrgCode(r.orgCode);
    } catch {
      setDemoCards([]);
    } finally {
      setDemoLoading(false);
    }
  }, []);

  const openDemoPicker = useCallback(() => {
    if (!demoMode) return; // production: no demo picker; reader adapter owns scans
    setDemoOpen(true);
    if (demoCards.length === 0) void loadDemoCards();
  }, [demoMode, demoCards.length, loadDemoCards]);

  // ---- Start a scan ----
  const startScan = useCallback(
    (token: string) => {
      if (state.kind !== "IDLE") return;
      const ts = Math.floor(Date.now() / 1000);
      const nonce = randomNonce(8);
      dispatch({ type: "SCAN_START", token, nonce, ts });
      setScanningElapsedMs(0);
    },
    [state.kind],
  );

  // ---- SCANNING: call verifyToken, track latency, dispatch result ----
  useEffect(() => {
    if (state.kind !== "SCANNING") return;
    let cancelled = false;
    const startedAt = Date.now();
    const elapsedId = window.setInterval(() => {
      setScanningElapsedMs(Date.now() - startedAt);
    }, 50);

    (async () => {
      try {
        const result: VerifyTokenResponse = await apiClient.kiosks.verifyToken({
          token: state.token,
          kioskId,
          ts: state.ts,
          nonce: state.nonce,
        });
        if (cancelled) return;
        dispatch({ type: "TOKEN_RESULT", result });
      } catch (err) {
        if (cancelled) return;
        const e = err as { error?: string };
        dispatch({
          type: "TOKEN_RESULT",
          result: {
            status: "denied",
            reason: "invalid_token",
          } as VerifyTokenResponse,
        });
        void e;
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(elapsedId);
    };
  }, [state, kioskId]);

  // ---- TOKEN_OK → after 600ms display, proceed to FACE_VERIFY ----
  useEffect(() => {
    if (state.kind !== "TOKEN_OK") return;
    const id = window.setTimeout(() => {
      dispatch({ type: "PROCEED_TO_FACE_VERIFY" });
    }, 600);
    return () => window.clearTimeout(id);
  }, [state]);

  // ---- FACE_VERIFY: run the simulated pipeline ----
  useEffect(() => {
    if (state.kind !== "FACE_VERIFY") return;
    let cancelled = false;
    // Entering this state starts a fresh verification pipeline.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFacePhase("detecting");
    setLivenessScore(0);
    setMatchScore(0);

    const timers: number[] = [];

    // 1s: face detected
    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setFacePhase("liveness");
        // animate liveness score from 0 → 0.93 over 1.5s
        const livenessTarget = 0.93;
        const steps = 30;
        for (let i = 1; i <= steps; i++) {
          timers.push(
            window.setTimeout(
              () => {
                if (cancelled) return;
                setLivenessScore((livenessTarget * i) / steps);
              },
              (1500 * i) / steps,
            ),
          );
        }
      }, 1000),
    );

    // 2.5s: liveness done → decide challenge or proceed
    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        const livenessNow = 0.93;
        const challengeMode = kioskMeta?.challengeMode ?? "off";
        const needsChallenge =
          challengeMode === "always" || challengeMode === "adaptive";
        if (needsChallenge && !state.livenessPassed) {
          setFacePhase("verifying");
          dispatch({ type: "ENTER_LIVENESS_CHALLENGE" });
        } else {
          setFacePhase("embedding");
        }
      }, 2500),
    );

    // 3.5s: compute probe & call verifyFace
    timers.push(
      window.setTimeout(async () => {
        if (cancelled) return;
        // If state is still FACE_VERIFY here, no interactive challenge is
        // required (challengeMode is "off" or "liveness", or the challenge
        // already passed and we re-entered). Proceed to verify the face.
        setFacePhase("verifying");
        try {
          const { embedding, expectedSimilarity } = await buildLiveProbe(
            state.employeeRef.code,
          );
          // Animate match score up while we wait for the server
          const steps = 16;
          for (let i = 1; i <= steps; i++) {
            timers.push(
              window.setTimeout(
                () => {
                  if (cancelled) return;
                  setMatchScore((expectedSimilarity * i) / steps);
                },
                (800 * i) / steps,
              ),
            );
          }
          const result = await apiClient.kiosks.verifyFace({
            scanId: state.scanId,
            embedding,
            livenessScore: 0.93,
            spoofFlags: { paper_detected: false, source: "kiosk" },
          });
          if (cancelled) return;
          setMatchScore(result.matchScore);
          setFacePhase("ready");
          // Small delay so the user sees 100%
          timers.push(
            window.setTimeout(() => {
              if (cancelled) return;
              if (result.decision === "granted") {
                setFaceFailCount(0);
              } else {
                setFaceFailCount((c) => c + 1);
              }
              dispatch({ type: "FACE_RESULT", result });
            }, 400),
          );
        } catch {
          if (cancelled) return;
          setFaceFailCount((c) => c + 1);
          dispatch({
            type: "FACE_FAIL",
            reason: "error",
          });
        }
      }, 3500),
    );

    return () => {
      cancelled = true;
      for (const t of timers) window.clearTimeout(t);
    };
  }, [
    state.kind,
    state.kind === "FACE_VERIFY" ? state.scanId : null,
    state.kind === "FACE_VERIFY" ? state.livenessPassed : null,
    kioskMeta?.challengeMode,
  ]);

  // ---- LIVENESS_CHALLENGE: 5s countdown ----
  useEffect(() => {
    if (state.kind !== "LIVENESS_CHALLENGE") return;
    // Entering the challenge state resets its countdown.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChallengeCountdown(5);
    let cancelled = false;
    const id = window.setInterval(() => {
      if (cancelled) return;
      setChallengeCountdown((c) => {
        if (c <= 0.1) {
          window.clearInterval(id);
          return 0;
        }
        return Math.max(0, c - 0.1);
      });
    }, 100);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [state.kind]);

  // ---- SUCCESS: auto-reset after 5s ----
  useEffect(() => {
    if (state.kind !== "SUCCESS") return;
    const id = window.setTimeout(() => {
      dispatch({ type: "RESET" });
    }, 5000);
    return () => window.clearTimeout(id);
  }, [state]);

  // ---- DENIED: auto-reset after 4s ----
  useEffect(() => {
    if (state.kind !== "DENIED") return;
    const id = window.setTimeout(() => {
      dispatch({ type: "RESET" });
    }, 4000);
    return () => window.clearTimeout(id);
  }, [state]);

  // ---- Handlers ----
  const handlePick = useCallback(
    (card: DemoCard) => {
      setDemoOpen(false);
      startScan(card.token);
    },
    [startScan],
  );

  const handleRawToken = useCallback(
    (token: string) => {
      setDemoOpen(false);
      startScan(token);
    },
    [startScan],
  );

  const handleExit = useCallback(() => {
    setMode("launcher");
    // Reset kiosk selection so the launcher default is used next time.
    setKioskId(null);
  }, [setMode, setKioskId]);

  const handleSupervisorConfirm = useCallback(() => {
    setSupervisorOpen(false);
    // Need an employeeRef — pull from current DENIED state.
    if (state.kind === "DENIED" && state.employeeRef) {
      dispatch({
        type: "SUPERVISOR_OVERRIDE_SUCCESS",
        employeeRef: state.employeeRef,
      });
    } else {
      // Fallback: just reset
      dispatch({ type: "RESET" });
    }
  }, [state]);

  const handleSupervisorCancel = useCallback(() => {
    setSupervisorOpen(false);
  }, []);

  const superoverrideAvailable = faceFailCount >= 2 && state.kind === "DENIED";

  return (
    <div className="fixed inset-0 dark bg-background text-foreground overflow-hidden select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={state.kind}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0"
        >
          {renderState({
            state,
            kioskId,
            kioskMeta,
            kioskStatus,
            orgCode,
            clock,
            cameraStatus,
            videoRef,
            facePhase,
            livenessScore,
            matchScore,
            scanningElapsedMs,
            challengeCountdown,
            superoverrideAvailable,
            onOpenDemoPicker: openDemoPicker,
            demoMode,
            onScanLineClick: openDemoPicker,
            onCameraFallback: () => undefined,
            onCancelScan: () => dispatch({ type: "RESET" }),
            onChallengeNeeded: () => undefined,
            onChallengePass: () => dispatch({ type: "LIVENESS_PASS" }),
            onChallengeFail: () =>
              dispatch({
                type: "FACE_RESULT",
                result: {
                  decision: "challenge_failed",
                  matchScore: 0,
                  faceMatchStatus: "liveness_fail",
                },
              }),
            onTimeout: () => dispatch({ type: "TIMEOUT" }),
            onRetry: () => dispatch({ type: "RESET" }),
            onSupervisorOverride: () => setSupervisorOpen(true),
          })}
        </motion.div>
      </AnimatePresence>

      {/* Exit control — always visible (except in lockdown) */}
      {state.kind !== "LOCKDOWN" && (
        <div className="absolute bottom-5 left-6 z-50">
          <HoldToExit onExit={handleExit} />
        </div>
      )}

      {/* Demo picker — demo mode only */}
      {demoMode && (
      <DemoScanPicker
        open={demoOpen}
        onOpenChange={setDemoOpen}
        cards={demoCards}
        loading={demoLoading}
        onPick={handlePick}
        onRawToken={handleRawToken}
      />
      )}

      {/* Supervisor override — server-verified, audited */}
      <SupervisorOverride
        open={supervisorOpen}
        onOpenChange={setSupervisorOpen}
        onConfirm={handleSupervisorConfirm}
        onCancel={handleSupervisorCancel}
        employeeCode={
          state.kind === "DENIED" ? (state.employeeRef?.code ?? null) : null
        }
        kioskId={kioskId}
      />
    </div>
  );
}

// ---- Render dispatch ----

function renderState(p: {
  state: KioskState;
  kioskId: string;
  kioskMeta: KioskRuntime | null;
  kioskStatus: string;
  orgCode: string;
  clock: Date;
  cameraStatus: ReturnType<typeof useCamera>["status"];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  facePhase: FacePhase;
  livenessScore: number;
  matchScore: number;
  scanningElapsedMs: number;
  challengeCountdown: number;
  superoverrideAvailable: boolean;
  onOpenDemoPicker: () => void;
  onScanLineClick: () => void;
  demoMode: boolean;
  onCameraFallback: () => void;
  onCancelScan: () => void;
  onChallengeNeeded: () => void;
  onChallengePass: () => void;
  onChallengeFail: () => void;
  onTimeout: () => void;
  onRetry: () => void;
  onSupervisorOverride: () => void;
}) {
  const s = p.state;
  switch (s.kind) {
    case "IDLE":
      return (
        <IdleScreen
          kioskId={p.kioskId}
          kioskName={p.kioskMeta?.name ?? "Kiosk"}
          kioskLocation={p.kioskMeta?.location ?? "Unknown location"}
          kioskStatus={p.kioskStatus}
          orgCode={p.orgCode}
          clock={p.clock}
          cameraReady={false}
          onOpenDemoPicker={p.onOpenDemoPicker}
          onScanLineClick={p.onScanLineClick}
          demoMode={p.demoMode}
        />
      );

    case "SCANNING":
      return <ScanningScreen elapsedMs={p.scanningElapsedMs} />;

    case "TOKEN_OK":
      return (
        <TokenOkScreen
          employeeRef={s.employeeRef}
          onContinue={() => undefined}
        />
      );

    case "FACE_VERIFY":
      return (
        <FaceVerifyScreen
          employeeRef={s.employeeRef}
          videoRef={p.videoRef}
          cameraStatus={p.cameraStatus}
          phase={p.facePhase}
          livenessScore={p.livenessScore}
          matchScore={p.matchScore}
          challengeMode={p.kioskMeta?.challengeMode ?? "off"}
          onChallengeNeeded={p.onChallengeNeeded}
          onTimeout={p.onTimeout}
          onCameraFallback={p.onCameraFallback}
          onCancel={p.onCancelScan}
          superoverrideAvailable={false}
          onSupervisorOverride={p.onSupervisorOverride}
        />
      );

    case "LIVENESS_CHALLENGE":
      return (
        <LivenessChallengeScreen
          instruction={s.instruction}
          countdown={p.challengeCountdown}
          totalMs={5000}
          onPass={p.onChallengePass}
          onFail={p.onChallengeFail}
        />
      );

    case "SUCCESS":
      return (
        <SuccessScreen
          employeeRef={s.employeeRef}
          employeeDisplay={s.employeeDisplay}
          matchScore={s.matchScore}
          supervisorOverride={s.supervisorOverride}
          kioskName={p.kioskMeta?.name ?? p.kioskId}
        />
      );

    case "DENIED":
      return (
        <DeniedScreen
          reason={s.reason}
          snapshotTaken={s.snapshotTaken}
          superoverrideAvailable={p.superoverrideAvailable}
          onRetry={p.onRetry}
          onSupervisorOverride={p.onSupervisorOverride}
        />
      );

    case "TIMEOUT":
      return <TimeoutScreen onRetry={p.onRetry} />;

    case "LOCKDOWN":
      return <LockdownScreen reason={s.reason} />;
  }
}

// Type re-export for consumers (renderState helper signature).
export type { EmployeeRef, KioskAction, KioskState };
