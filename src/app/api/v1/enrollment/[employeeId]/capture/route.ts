import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { generateEmbedding } from "@/lib/crypto";
import {
  requireRole,
  parseBody,
  ok,
  fail,
  logAdminAction,
} from "@/lib/auth-runtime";
import { requireDemoMode } from "@/lib/demo-guard";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  // Demo enrollment: the "embedding" is deterministically derived from the
  // employee code and quality figures are simulated — no real pixels are
  // processed. Not permitted outside DEMO_MODE. A production deployment
  // needs a trusted enrollment pipeline (see PRODUCTION_ROADMAP Phase 5).
  const demoBlocked = requireDemoMode();
  if (demoBlocked) return demoBlocked;
  const auth = await requireRole(req, ["hr_admin", "superadmin"]);
  if (auth.response) return auth.response;
  const session = auth.session!;

  const { employeeId } = await params;
  const body = await parseBody<{
    images?: string[];
    consentAcknowledged?: boolean;
  }>(req);

  if (!body?.images || !Array.isArray(body.images)) {
    return fail("Missing images array", 400);
  }
  if (body.images.length < 3 || body.images.length > 5) {
    return fail("Must provide 3-5 images", 400);
  }
  if (body.consentAcknowledged !== true) {
    return fail("consentAcknowledged must be true", 400);
  }

  const emp = await db.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return fail("Not found", 404);

  const qualityScore = 0.8 + Math.random() * 0.17;
  const embedding = generateEmbedding(emp.employeeCode);

  const updated = await db.employee.update({
    where: { id: employeeId },
    data: {
      faceEmbedding: JSON.stringify(embedding),
      faceEnrolledAt: new Date(),
      faceConsentAt: new Date(),
    },
  });

  const enrollment = await db.enrollment.create({
    data: {
      employeeId,
      enrolledBy: session.adminId,
      imageQualityScore: qualityScore,
      consentAcknowledged: true,
    },
  });

  await logAdminAction({
    actorId: session.adminId,
    target: `employee:${employeeId}`,
    action: "enrollment.capture",
    after: {
      enrollmentId: enrollment.id,
      qualityScore,
      faceEnrolledAt: updated.faceEnrolledAt?.toISOString() ?? null,
    },
  });

  return ok({
    status: "enrolled",
    enrollmentId: enrollment.id,
    qualityScore,
    consentAcknowledged: true,
    enrolledAt: updated.faceEnrolledAt?.toISOString() ?? null,
  });
}
