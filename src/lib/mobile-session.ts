// Employee self-service sessions (mobile companion). Database-backed:
// 256-bit CSPRNG tokens, only the SHA-256 hash stored, 1-hour TTL, single
// active session per employee. Survives restarts and works across instances.
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { logger } from "@/lib/logger";

export const MOBILE_SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface MobileSessionData {
  employeeId: string;
}

function newRawToken(): string {
  return "mob_" + randomBytes(32).toString("hex");
}

export async function createMobileSession(employeeId: string): Promise<string> {
  // Single active session per employee.
  await db.mobileSession.deleteMany({ where: { employeeId } });
  await db.mobileSession
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch((e: unknown) =>
      logger.warn("mobile session prune failed", {
        error: e instanceof Error ? e.message : String(e),
      }),
    );

  const token = newRawToken();
  await db.mobileSession.create({
    data: {
      tokenHash: sha256(token),
      employeeId,
      expiresAt: new Date(Date.now() + MOBILE_SESSION_TTL_MS),
    },
  });
  return token;
}

export async function getMobileSession(
  token: string | null | undefined,
): Promise<MobileSessionData | null> {
  if (!token) return null;
  const row = await db.mobileSession.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.mobileSession.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  return { employeeId: row.employeeId };
}

export async function destroyMobileSession(
  token: string | null | undefined,
): Promise<void> {
  if (!token) return;
  await db.mobileSession
    .delete({ where: { tokenHash: sha256(token) } })
    .catch(() => {});
}
