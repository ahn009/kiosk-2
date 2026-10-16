import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  requireRole,
  parseBody,
  ok,
  fail,
  logAdminAction,
} from "@/lib/auth-runtime";
import { toEmployeeDetail } from "@/lib/mappers";
import type { AdminRole, CardStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const emp = await db.employee.findUnique({
    where: { id },
    include: { department: { select: { name: true } } },
  });
  if (!emp) return fail("Not found", 404);

  const scans = await db.scanEvent.findFirst({
    where: { employeeId: id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const scanCount = await db.scanEvent.count({ where: { employeeId: id } });

  const detail = toEmployeeDetail(emp, scanCount, scans?.createdAt ?? null);
  // Strip sensitive fields: never expose pinHash, embedding
  // (cardTokenHash retained for admin reference per EmployeeDetail type)
  return ok(detail);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["hr_admin", "superadmin"]);
  if (auth.response) return auth.response;
  const session = auth.session!;

  const { id } = await params;
  const body = await parseBody<{
    fullName?: string;
    designation?: string | null;
    accessLevel?: number;
    departmentId?: string | null;
    cardStatus?: CardStatus;
  }>(req);

  if (!body || Object.keys(body).length === 0) {
    return fail("No update fields provided", 400);
  }

  const existing = await db.employee.findUnique({ where: { id } });
  if (!existing) return fail("Not found", 404);

  const data: Record<string, unknown> = {};
  if (body.fullName !== undefined) data.fullName = body.fullName;
  if (body.designation !== undefined) data.designation = body.designation;
  if (body.accessLevel !== undefined) {
    if (body.accessLevel < 1 || body.accessLevel > 5) {
      return fail("accessLevel must be between 1 and 5", 400);
    }
    data.accessLevel = body.accessLevel;
  }
  if (body.departmentId !== undefined) data.departmentId = body.departmentId;
  if (body.cardStatus !== undefined) data.cardStatus = body.cardStatus;

  const updated = await db.employee.update({
    where: { id },
    data,
    include: { department: { select: { name: true } } },
  });

  const scans = await db.scanEvent.findFirst({
    where: { employeeId: id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const scanCount = await db.scanEvent.count({ where: { employeeId: id } });

  await logAdminAction({
    actorId: session.adminId,
    target: `employee:${id}`,
    action: "employee.update",
    before: {
      fullName: existing.fullName,
      designation: existing.designation,
      accessLevel: existing.accessLevel,
      departmentId: existing.departmentId,
      cardStatus: existing.cardStatus,
    },
    after: data,
  });

  return ok(toEmployeeDetail(updated, scanCount, scans?.createdAt ?? null));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["superadmin", "hr_admin"] as AdminRole[]);
  if (auth.response) return auth.response;
  const session = auth.session!;

  const { id } = await params;
  const existing = await db.employee.findUnique({ where: { id } });
  if (!existing) return fail("Not found", 404);

  // Soft-delete: anonymize, clear biometrics & card, set revoked.
  const updated = await db.employee.update({
    where: { id },
    data: {
      fullName: "Deleted User",
      faceEmbedding: null,
      faceEnrolledAt: null,
      faceConsentAt: null,
      cardTokenHash: null,
      cardExpiresAt: null,
      cardStatus: "revoked",
    },
    include: { department: { select: { name: true } } },
  });

  // Add old token hash to revocation (if any)
  if (existing.cardTokenHash) {
    await db.revocation.upsert({
      where: { tokenHash: existing.cardTokenHash },
      update: {},
      create: {
        tokenHash: existing.cardTokenHash,
        reason: "Employee soft-deleted (GDPR/anonymized)",
      },
    });
  }

  await logAdminAction({
    actorId: session.adminId,
    target: `employee:${id}`,
    action: "employee.delete",
    before: { employeeCode: existing.employeeCode, fullName: existing.fullName },
    after: { anonymized: true, cardStatus: "revoked" },
  });

  return ok({ ok: true, id });
}
