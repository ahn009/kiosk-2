import { NextRequest } from "next/server";
import { randomUUID, randomInt } from "crypto";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/crypto";
import { parseBody, ok } from "@/lib/auth-runtime";
import { createPendingScan } from "@/lib/kiosk-session";
import {
  checkRateLimit,
  rateLimited,
  clientIp,
  KIOSK_LIMIT,
} from "@/lib/rate-limit";
import type { VerifyTokenResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const CHALLENGES: ("blink" | "turn_left" | "turn_right")[] = [
  "blink",
  "turn_left",
  "turn_right",
];

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(
    `verify-token:${clientIp(req)}`,
    KIOSK_LIMIT.max,
    KIOSK_LIMIT.windowMs,
  );
  if (!rl.allowed) return rateLimited(rl.retryAfterMs);

  const body = await parseBody<{
    token?: string;
    kioskId?: string;
    ts?: number;
    nonce?: string;
  }>(req);

  if (!body?.token || !body?.kioskId) {
    return ok({
      status: "denied",
      reason: "invalid_token",
    } as VerifyTokenResponse);
  }

  // Step 1: lockdown check
  const state = await db.systemState.findUnique({ where: { id: "singleton" } });
  if (state?.lockdownActive) {
    return ok({
      status: "denied",
      reason: "lockdown",
    } as VerifyTokenResponse);
  }

  // Step 2: verify token signature & expiry
  const verified = verifyToken(body.token);
  if (!verified.ok) {
    const reason: "invalid_token" | "expired" =
      verified.reason === "expired" ? "expired" : "invalid_token";
    return ok({ status: "denied", reason } as VerifyTokenResponse);
  }

  // Step 3: revocation check (CRL)
  const revoked = await db.revocation.findUnique({
    where: { tokenHash: verified.tokenHash },
  });
  if (revoked) {
    return ok({
      status: "denied",
      reason: "revoked",
    } as VerifyTokenResponse);
  }

  // Step 4: find employee
  const emp = await db.employee.findUnique({
    where: { cardTokenHash: verified.tokenHash },
  });
  if (!emp) {
    return ok({
      status: "denied",
      reason: "invalid_token",
    } as VerifyTokenResponse);
  }

  // Step 5: card status
  if (emp.cardStatus !== "active") {
    return ok({
      status: "denied",
      reason: "revoked",
    } as VerifyTokenResponse);
  }

  // Step 6: face enrollment
  if (!emp.faceEmbedding) {
    return ok({
      status: "denied",
      reason: "no_face_enrolled",
    } as VerifyTokenResponse);
  }

  // Step 7: create pending scan & return await_face
  const scanId = randomUUID();
  const challengeSeed = CHALLENGES[randomInt(CHALLENGES.length)];

  createPendingScan({
    scanId,
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    employeeName: emp.fullName,
    accessLevel: emp.accessLevel,
    photoUrl: emp.photoUrl,
    kioskId: body.kioskId,
    tokenHash: verified.tokenHash,
    startedAt: Date.now(),
    challengeSeed,
  });

  return ok({
    status: "await_face",
    scanId,
    employeeRef: {
      code: emp.employeeCode,
      name: emp.fullName,
      accessLevel: emp.accessLevel,
      photoUrl: emp.photoUrl,
    },
    challengeSeed,
  } as VerifyTokenResponse);
}
