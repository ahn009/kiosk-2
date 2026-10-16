import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  requireRole,
  parseBody,
  ok,
  fail,
  logAdminAction,
} from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;
  const session = auth.session!;

  const { id } = await params;
  const body = await parseBody<{ reason?: string; suspendFace?: boolean }>(req);

  const emp = await db.employee.findUnique({ where: { id } });
  if (!emp) return fail("Not found", 404);

  const updates: Record<string, unknown> = { cardStatus: "revoked" };
  if (body?.suspendFace) {
    updates.faceEmbedding = null;
    updates.faceEnrolledAt = null;
  }

  const updated = await db.employee.update({
    where: { id },
    data: updates,
  });

  if (emp.cardTokenHash) {
    await db.revocation.upsert({
      where: { tokenHash: emp.cardTokenHash },
      update: {},
      create: {
        tokenHash: emp.cardTokenHash,
        reason: body?.reason ?? "Card revoked by admin",
      },
    });
  }

  // Bump global CRL version so kiosks pick up the revocation.
  await db.systemState.update({
    where: { id: "singleton" },
    data: { crlVersion: { increment: 1 } },
  });

  await logAdminAction({
    actorId: session.adminId,
    target: `employee:${id}`,
    action: "employee.revoke",
    before: { cardStatus: emp.cardStatus, cardTokenHash: emp.cardTokenHash },
    after: {
      cardStatus: updated.cardStatus,
      reason: body?.reason ?? null,
      suspendFace: !!body?.suspendFace,
    },
  });

  return ok({ ok: true, employeeId: id, cardStatus: updated.cardStatus });
}
