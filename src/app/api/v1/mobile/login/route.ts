import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createMobileSession } from "@/lib/mobile-session";
import {
  checkRateLimit,
  rateLimited,
  clientIp,
  LOGIN_LIMIT,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Employee self-service login (mobile companion). Demo: employee code only.
// Real impl: magic link / registered device / card+PIN. Returns a short-lived
// session token.
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(
    `mobile-login:${clientIp(req)}`,
    LOGIN_LIMIT.max,
    LOGIN_LIMIT.windowMs,
  );
  if (!rl.allowed) return rateLimited(rl.retryAfterMs);

  const body = await req.json().catch(() => ({}));
  const code = (body?.employeeCode ?? "").toString().trim().toUpperCase();

  if (!code) {
    return NextResponse.json(
      { error: "Employee code is required" },
      { status: 400 }
    );
  }

  const emp = await db.employee.findFirst({
    where: { employeeCode: code, fullName: { not: "Deleted User" } },
    include: { department: { select: { name: true } } },
  });

  if (!emp) {
    return NextResponse.json(
      { error: "No active employee with that code" },
      { status: 404 }
    );
  }

  const token = await createMobileSession(emp.id);
  return NextResponse.json({
    token,
    employee: {
      id: emp.id,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      designation: emp.designation,
      departmentName: emp.department?.name ?? null,
      accessLevel: emp.accessLevel,
      photoUrl: emp.photoUrl,
      cardStatus: emp.cardStatus,
      cardExpiresAt: emp.cardExpiresAt?.toISOString() ?? null,
      faceEnrolled: !!emp.faceEmbedding,
    },
  });
}
