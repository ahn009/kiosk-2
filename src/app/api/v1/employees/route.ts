import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sha256, buildToken } from "@/lib/crypto";
import {
  requireAuth,
  requireRole,
  parseBody,
  ok,
  fail,
  logAdminAction,
} from "@/lib/auth-runtime";
import { toEmployeeDetail } from "@/lib/mappers";
import type { AdminRole, CardStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const ALLOWED_ROLES: AdminRole[] = ["hr_admin", "security_officer", "superadmin"];

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const departmentId = url.searchParams.get("department_id") || undefined;
  const status = url.searchParams.get("status") || undefined;

  // Hide soft-deleted (anonymized) employees from all listings.
  const where: Record<string, unknown> = { fullName: { not: "Deleted User" } };
  if (q) {
    where.OR = [
      { fullName: { contains: q } },
      { employeeCode: { contains: q } },
      { designation: { contains: q } },
    ];
  }
  if (departmentId) where.departmentId = departmentId;
  if (status) where.cardStatus = status;

  const [total, rows] = await Promise.all([
    db.employee.count({ where }),
    db.employee.findMany({
      where,
      include: { department: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const items = rows.map((r) => ({
    id: r.id,
    employeeCode: r.employeeCode,
    fullName: r.fullName,
    departmentId: r.departmentId,
    departmentName: r.department?.name ?? null,
    designation: r.designation,
    accessLevel: r.accessLevel,
    photoUrl: r.photoUrl,
    cardStatus: r.cardStatus as CardStatus,
    cardExpiresAt: r.cardExpiresAt ? r.cardExpiresAt.toISOString() : null,
    faceEnrolled: !!r.faceEmbedding,
    faceConsent: !!r.faceConsentAt,
    createdAt: r.createdAt.toISOString(),
  }));

  return ok({
    items,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ALLOWED_ROLES);
  if (auth.response) return auth.response;
  const session = auth.session!;

  const body = await parseBody<{
    employeeCode?: string;
    fullName?: string;
    departmentId?: string | null;
    designation?: string | null;
    accessLevel?: number;
    photoUrl?: string | null;
  }>(req);

  if (!body?.employeeCode || !body?.fullName) {
    return fail("Missing required fields: employeeCode, fullName", 400);
  }
  if (body.accessLevel === undefined || body.accessLevel < 1 || body.accessLevel > 5) {
    return fail("accessLevel must be between 1 and 5", 400);
  }

  const existing = await db.employee.findFirst({
    where: { employeeCode: body.employeeCode, fullName: { not: "Deleted User" } },
  });
  if (existing) {
    return fail("Employee code already exists", 409);
  }

  const state = await db.systemState.findUnique({ where: { id: "singleton" } });
  const orgCode = state?.orgCode ?? "ACME";
  const expEpoch = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 2; // +2 years
  const { token } = buildToken({ orgCode, expEpoch });
  const cardTokenHash = sha256(token);

  const emp = await db.employee.create({
    data: {
      employeeCode: body.employeeCode,
      fullName: body.fullName,
      departmentId: body.departmentId ?? null,
      designation: body.designation ?? null,
      accessLevel: body.accessLevel,
      photoUrl: body.photoUrl ?? null,
      cardTokenHash,
      cardStatus: "active",
      cardExpiresAt: new Date(expEpoch * 1000),
    },
    include: { department: { select: { name: true } } },
  });

  // Compute detail fields
  const detail = toEmployeeDetail(emp, 0, null);

  await logAdminAction({
    actorId: session.adminId,
    target: `employee:${emp.id}`,
    action: "employee.create",
    after: { employeeCode: emp.employeeCode, fullName: emp.fullName },
  });

  return ok({ ...detail, cardToken: token }, 201);
}
