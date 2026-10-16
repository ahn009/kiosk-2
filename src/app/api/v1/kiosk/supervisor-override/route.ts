import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySecret } from "@/lib/crypto";
import { parseBody, ok, fail, logAdminAction } from "@/lib/auth-runtime";
import {
  checkRateLimit,
  rateLimited,
  clientIp,
  STRICT_LIMIT,
} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import type { AdminRole } from "@/lib/types";

export const dynamic = "force-dynamic";

// Named supervisor override. A supervisor authenticates with their own admin
// credentials (security_officer or superadmin role), states a reason, and the
// grant is recorded as an immutable audit event attributable to them.
//
// This replaces the previous client-side fixed-PIN check, which granted
// access on a browser assertion with no authentication or attribution.
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(
    `supervisor-override:${clientIp(req)}`,
    STRICT_LIMIT.max,
    STRICT_LIMIT.windowMs,
  );
  if (!rl.allowed) return rateLimited(rl.retryAfterMs);

  const body = await parseBody<{
    email?: string;
    password?: string;
    employeeCode?: string;
    kioskId?: string;
    reason?: string;
  }>(req);

  const email = (body?.email ?? "").toLowerCase().trim();
  const password = body?.password ?? "";
  const employeeCode = (body?.employeeCode ?? "").trim().toUpperCase();
  const kioskId = (body?.kioskId ?? "").trim();
  const reason = (body?.reason ?? "").trim();

  if (!email || !password || !employeeCode || !kioskId) {
    return fail("email, password, employeeCode and kioskId are required", 400);
  }
  if (reason.length < 3) {
    return fail("A reason (min 3 characters) is required", 400);
  }

  const admin = await db.adminUser.findUnique({ where: { email } });
  if (!admin || !verifySecret(password, admin.passwordHash)) {
    logger.warn("supervisor override failed: bad credentials", { kioskId });
    return fail("Invalid supervisor credentials", 401);
  }
  const role = admin.role as AdminRole;
  if (role !== "superadmin" && role !== "security_officer") {
    logger.warn("supervisor override failed: insufficient role", {
      kioskId,
      adminId: admin.id,
      role,
    });
    return fail("Supervisor role required", 403);
  }

  const emp = await db.employee.findFirst({
    where: { employeeCode },
    include: { department: { select: { name: true } } },
  });
  if (!emp) return fail("Employee not found", 404);

  const scan = await db.scanEvent.create({
    data: {
      kioskId,
      employeeId: emp.id,
      tokenHash: null,
      faceMatchScore: null,
      faceMatchStatus: "no_face",
      spoofFlags: null,
      decision: "supervisor_override",
      snapshotPath: null,
      latencyMs: null,
      offline: false,
    },
  });

  await logAdminAction({
    actorId: admin.id,
    target: `employee:${emp.id}`,
    action: "kiosk.supervisor_override",
    after: {
      scanEventId: scan.id,
      kioskId,
      reason,
      supervisor: admin.email,
    },
  });

  logger.info("supervisor override granted", {
    kioskId,
    employeeId: emp.id,
    supervisorId: admin.id,
    scanEventId: scan.id,
  });

  return ok({
    ok: true,
    scanEventId: scan.id,
    employeeDisplay: {
      code: emp.employeeCode,
      name: emp.fullName,
      department: emp.department?.name ?? null,
      designation: emp.designation,
      accessLevel: emp.accessLevel,
      photoUrl: emp.photoUrl,
      lastEntry: null,
    },
  });
}

// Disallow other methods explicitly.
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
