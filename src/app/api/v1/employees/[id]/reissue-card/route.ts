import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sha256, buildToken } from "@/lib/crypto";
import {
  requireRole,
  ok,
  fail,
  logAdminAction,
} from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["hr_admin", "superadmin"]);
  if (auth.response) return auth.response;
  const session = auth.session!;

  const { id } = await params;
  const emp = await db.employee.findUnique({ where: { id } });
  if (!emp) return fail("Not found", 404);

  const state = await db.systemState.findUnique({ where: { id: "singleton" } });
  const orgCode = state?.orgCode ?? "ACME";
  const expEpoch = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 2; // +2 years
  const { token } = buildToken({ orgCode, expEpoch });
  const newTokenHash = sha256(token);

  // Revoke old token (if any)
  const oldHash = emp.cardTokenHash;
  if (oldHash) {
    await db.revocation.upsert({
      where: { tokenHash: oldHash },
      update: {},
      create: { tokenHash: oldHash, reason: "Card reissued (rotation)" },
    });
  }

  const updated = await db.employee.update({
    where: { id },
    data: {
      cardTokenHash: newTokenHash,
      cardStatus: "active",
      cardExpiresAt: new Date(expEpoch * 1000),
    },
  });

  // Bump global CRL version so kiosks sync.
  await db.systemState.update({
    where: { id: "singleton" },
    data: { crlVersion: { increment: 1 } },
  });

  await logAdminAction({
    actorId: session.adminId,
    target: `employee:${id}`,
    action: "employee.reissue_card",
    before: { cardTokenHash: oldHash },
    after: { cardTokenHash: newTokenHash, cardStatus: updated.cardStatus },
  });

  return ok({
    ok: true,
    employeeId: id,
    cardToken: token,
    cardTokenHash: newTokenHash,
    expiresAt: updated.cardExpiresAt?.toISOString() ?? null,
  });
}
