import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireAuth } from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;

  const { employeeId } = await params;
  const emp = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      faceEmbedding: true,
      faceEnrolledAt: true,
      faceConsentAt: true,
    },
  });
  if (!emp) return fail("Not found", 404);

  const lastEnrollment = await db.enrollment.findFirst({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
    select: { imageQualityScore: true, consentAcknowledged: true, createdAt: true },
  });

  const status: "enrolled" | "pending" | "failed" = emp.faceEmbedding
    ? "enrolled"
    : lastEnrollment
    ? "failed"
    : "pending";

  return ok({
    status,
    qualityScore: lastEnrollment?.imageQualityScore ?? null,
    consentAcknowledged: !!emp.faceConsentAt,
    enrolledAt: emp.faceEnrolledAt?.toISOString() ?? null,
  });
}
