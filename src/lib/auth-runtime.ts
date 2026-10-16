// Admin session management — durable, database-backed.
//
// Design:
// - Session tokens are 256-bit CSPRNG values (hex). Only the SHA-256 hash is
//   stored; the raw token is returned to the client once at login/refresh.
// - Single active session per admin: creating a session revokes older ones.
// - Sessions expire after 30 minutes of issuance (sliding refresh via
//   /auth/refresh). Expired rows are pruned opportunistically.
// - Works across restarts and across multiple server instances sharing the
//   same database (unlike the previous in-memory Map).
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import type { AdminRole } from "@/lib/types";

export const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

export interface SessionData {
  adminId: string;
  email: string;
  role: AdminRole;
  name: string | null;
}

/** 256-bit session token, hex-encoded. */
function newRawToken(): string {
  return randomBytes(32).toString("hex");
}

async function pruneExpired(): Promise<void> {
  try {
    await db.adminSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch (e) {
    logger.warn("admin session prune failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function createSession(admin: {
  id: string;
  email: string;
  role: AdminRole;
  name: string | null;
}): Promise<string> {
  // Single active session per admin: revoke previous ones.
  await db.adminSession.deleteMany({ where: { adminId: admin.id } });
  await pruneExpired();

  const token = newRawToken();
  await db.adminSession.create({
    data: {
      tokenHash: sha256(token),
      adminId: admin.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

export async function getSession(
  token: string | null | undefined,
): Promise<SessionData | null> {
  if (!token) return null;
  const row = await db.adminSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { admin: { select: { id: true, email: true, role: true, name: true } } },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.adminSession.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  return {
    adminId: row.admin.id,
    email: row.admin.email,
    role: row.admin.role as AdminRole,
    name: row.admin.name,
  };
}

export async function destroySession(
  token: string | null | undefined,
): Promise<void> {
  if (!token) return;
  await db.adminSession
    .delete({ where: { tokenHash: sha256(token) } })
    .catch(() => {});
}

/** Revoke every session belonging to an admin (e.g. on password change). */
export async function destroyAllSessions(adminId: string): Promise<void> {
  await db.adminSession.deleteMany({ where: { adminId } });
}

export function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** Require an authenticated admin. Returns session or a 401 NextResponse. */
export async function requireAuth(req: NextRequest) {
  const token = extractBearer(req);
  const session = await getSession(token);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, response: null };
}

/** Require an admin with one of the given roles. */
export async function requireRole(req: NextRequest, roles: AdminRole[]) {
  const auth = await requireAuth(req);
  if (auth.response) return { session: null, response: auth.response };
  if (!roles.includes(auth.session!.role)) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Forbidden — insufficient role" },
        { status: 403 },
      ),
    };
  }
  return { session: auth.session, response: null };
}

/** Convenience: parse JSON body safely. */
export async function parseBody<T = unknown>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Record an admin action for the audit log. Best-effort. */
export async function logAdminAction(opts: {
  actorId?: string;
  target: string;
  action: string;
  before?: unknown;
  after?: unknown;
}) {
  try {
    await db.adminAction.create({
      data: {
        actorId: opts.actorId ?? null,
        target: opts.target,
        action: opts.action,
        beforeData: opts.before ? JSON.stringify(opts.before) : null,
        afterData: opts.after ? JSON.stringify(opts.after) : null,
      },
    });
  } catch (e) {
    logger.warn("admin action log failed", {
      target: opts.target,
      action: opts.action,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
