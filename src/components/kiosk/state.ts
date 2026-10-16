"use client";

import type {
  VerifyTokenResponse,
  VerifyFaceResponse,
} from "@/lib/types";

export type ChallengeSeed = "blink" | "turn_left" | "turn_right";

export type EmployeeRef = {
  code: string;
  name: string;
  accessLevel: number;
  photoUrl: string | null;
};

export type EmployeeDisplay = NonNullable<
  VerifyFaceResponse["employeeDisplay"]
>;

/**
 * Kiosk state machine. Discriminated union — never use ad-hoc booleans.
 *
 * Flow:
 *   IDLE → SCANNING → TOKEN_OK → FACE_VERIFY → (LIVENESS_CHALLENGE)
 *          → SUCCESS | DENIED | TIMEOUT → IDLE
 *   Any state → LOCKDOWN (overrides) → IDLE when cleared.
 */
export type KioskState =
  | { kind: "IDLE" }
  | {
      kind: "SCANNING";
      token: string;
      nonce: string;
      ts: number;
      startedAt: number;
    }
  | {
      kind: "TOKEN_OK";
      scanId: string;
      employeeRef: EmployeeRef;
      challengeSeed: ChallengeSeed;
      enteredAt: number;
    }
  | {
      kind: "FACE_VERIFY";
      scanId: string;
      employeeRef: EmployeeRef;
      challengeSeed: ChallengeSeed;
      livenessPassed: boolean;
      attempts: number;
    }
  | {
      kind: "LIVENESS_CHALLENGE";
      scanId: string;
      employeeRef: EmployeeRef;
      challengeSeed: ChallengeSeed;
      instruction: ChallengeSeed;
      attempts: number;
    }
  | {
      kind: "SUCCESS";
      employeeRef: EmployeeRef;
      employeeDisplay?: EmployeeDisplay;
      matchScore: number;
      supervisorOverride: boolean;
      enteredAt: number;
    }
  | { kind: "DENIED"; reason: string; employeeRef?: EmployeeRef; snapshotTaken: boolean }
  | { kind: "TIMEOUT" }
  | { kind: "LOCKDOWN"; reason?: string };

export type KioskAction =
  | { type: "SCAN_START"; token: string; nonce: string; ts: number }
  | { type: "TOKEN_RESULT"; result: VerifyTokenResponse }
  | { type: "PROCEED_TO_FACE_VERIFY" }
  | { type: "ENTER_LIVENESS_CHALLENGE" }
  | { type: "LIVENESS_PASS" }
  | { type: "FACE_RESULT"; result: VerifyFaceResponse; supervisorOverride?: boolean }
  | { type: "FACE_FAIL"; reason: string }
  | { type: "TIMEOUT" }
  | { type: "RESET" }
  | { type: "LOCKDOWN_ON"; reason?: string }
  | { type: "LOCKDOWN_OFF" }
  | {
      type: "SUPERVISOR_OVERRIDE_SUCCESS";
      employeeRef: EmployeeRef;
    };

export const initialState: KioskState = { kind: "IDLE" };

export function kioskReducer(
  state: KioskState,
  action: KioskAction,
): KioskState {
  // LOCKDOWN is sticky — only LOCKDOWN_OFF exits it.
  if (state.kind === "LOCKDOWN") {
    if (action.type === "LOCKDOWN_OFF") return { kind: "IDLE" };
    if (action.type === "LOCKDOWN_ON") return state; // already
    return state; // ignore everything else during lockdown
  }

  switch (action.type) {
    case "SCAN_START": {
      if (state.kind !== "IDLE") return state;
      return {
        kind: "SCANNING",
        token: action.token,
        nonce: action.nonce,
        ts: action.ts,
        startedAt: Date.now(),
      };
    }

    case "TOKEN_RESULT": {
      if (state.kind !== "SCANNING") return state;
      const r = action.result;
      if (r.status === "await_face" && r.scanId && r.employeeRef && r.challengeSeed) {
        return {
          kind: "TOKEN_OK",
          scanId: r.scanId,
          employeeRef: r.employeeRef,
          challengeSeed: r.challengeSeed,
          enteredAt: Date.now(),
        };
      }
      if (r.reason === "lockdown") {
        return { kind: "LOCKDOWN", reason: "Token verify reported lockdown" };
      }
      return {
        kind: "DENIED",
        reason: r.reason ?? "invalid_token",
        snapshotTaken: false,
      };
    }

    case "PROCEED_TO_FACE_VERIFY": {
      if (state.kind !== "TOKEN_OK") return state;
      return {
        kind: "FACE_VERIFY",
        scanId: state.scanId,
        employeeRef: state.employeeRef,
        challengeSeed: state.challengeSeed,
        livenessPassed: false,
        attempts: 0,
      };
    }

    case "ENTER_LIVENESS_CHALLENGE": {
      if (state.kind !== "FACE_VERIFY") return state;
      return {
        kind: "LIVENESS_CHALLENGE",
        scanId: state.scanId,
        employeeRef: state.employeeRef,
        challengeSeed: state.challengeSeed,
        instruction: state.challengeSeed,
        attempts: state.attempts,
      };
    }

    case "LIVENESS_PASS": {
      if (state.kind !== "LIVENESS_CHALLENGE") return state;
      return {
        kind: "FACE_VERIFY",
        scanId: state.scanId,
        employeeRef: state.employeeRef,
        challengeSeed: state.challengeSeed,
        livenessPassed: true,
        attempts: state.attempts,
      };
    }

    case "FACE_RESULT": {
      // FACE_RESULT arrives from FACE_VERIFY or LIVENESS_CHALLENGE expiry.
      const r = action.result;
      const employeeRef =
        state.kind === "FACE_VERIFY" || state.kind === "LIVENESS_CHALLENGE"
          ? state.employeeRef
          : undefined;

      if (r.decision === "granted") {
        return {
          kind: "SUCCESS",
          employeeRef: employeeRef ?? {
            code: r.employeeDisplay?.code ?? "—",
            name: r.employeeDisplay?.name ?? "Unknown",
            accessLevel: r.employeeDisplay?.accessLevel ?? 0,
            photoUrl: r.employeeDisplay?.photoUrl ?? null,
          },
          employeeDisplay: r.employeeDisplay,
          matchScore: r.matchScore,
          supervisorOverride: action.supervisorOverride ?? false,
          enteredAt: Date.now(),
        };
      }

      if (r.decision === "challenge_failed") {
        return {
          kind: "DENIED",
          reason: "challenge_failed",
          employeeRef,
          snapshotTaken: true,
        };
      }

      return {
        kind: "DENIED",
        reason: r.decision === "error" ? "error" : "mismatch",
        employeeRef,
        snapshotTaken: true,
      };
    }

    case "FACE_FAIL": {
      const employeeRef =
        state.kind === "FACE_VERIFY" || state.kind === "LIVENESS_CHALLENGE"
          ? state.employeeRef
          : undefined;
      return {
        kind: "DENIED",
        reason: action.reason,
        employeeRef,
        snapshotTaken: true,
      };
    }

    case "TIMEOUT": {
      if (state.kind === "FACE_VERIFY" || state.kind === "LIVENESS_CHALLENGE") {
        return { kind: "TIMEOUT" };
      }
      return state;
    }

    case "SUPERVISOR_OVERRIDE_SUCCESS": {
      return {
        kind: "SUCCESS",
        employeeRef: action.employeeRef,
        matchScore: 0,
        supervisorOverride: true,
        enteredAt: Date.now(),
      };
    }

    case "LOCKDOWN_ON":
      return { kind: "LOCKDOWN", reason: action.reason };

    case "LOCKDOWN_OFF":
      return { kind: "IDLE" };

    case "RESET":
      return { kind: "IDLE" };

    default:
      return state;
  }
}

/** Human-readable labels for challenge seeds. */
export const CHALLENGE_LABEL: Record<ChallengeSeed, string> = {
  blink: "Blink slowly",
  turn_left: "Turn head left",
  turn_right: "Turn head right",
};

/** Map denied reason codes to user-facing text. */
export const DENIED_REASON_TEXT: Record<string, string> = {
  invalid_token: "Invalid or unrecognized ID card",
  revoked: "Access card has been revoked",
  expired: "ID card has expired",
  lockdown: "System lockdown is active",
  no_face_enrolled: "Face not enrolled for this employee",
  mismatch: "Face did not match enrolled profile",
  challenge_failed: "Liveness challenge failed",
  error: "Verification system error",
};

/** A friendly timestamp label like "just now", "3m ago", or "2h ago". */
export function lastEntryLabel(iso: string | null): string {
  if (!iso) return "First entry";
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
