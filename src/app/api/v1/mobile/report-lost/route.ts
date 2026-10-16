import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-session";
import { logAdminAction } from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

function bearer(req: NextRequest) {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// Employee reports their own card lost → immediate revoke: card added to CRL,
// cardStatus set to "lost", cardTokenHash cleared so a reissue is required.
export async function POST(req: NextRequest) {
  const token = bearer(req);
  const session = await getMobileSession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const reason = (body?.reason ?? "Reported lost via mobile companion").toString();

  const emp = await db.employee.findUnique({
    where: { id: session.employeeId },
  });
  if (!emp) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Add current token to revocation list, then clear it.
  if (emp.cardTokenHash) {
    await db.revocation.upsert({
      where: { tokenHash: emp.cardTokenHash },
      update: {},
      create: { tokenHash: emp.cardTokenHash, reason },
    });
  }

  await db.employee.update({
    where: { id: emp.id },
    data: {
      cardStatus: "lost",
      cardTokenHash: null,
      cardExpiresAt: null,
    },
  });

  // Audit (self-service action; actor null = employee)
  await logAdminAction({
    actorId: undefined,
    target: `employee:${emp.id}`,
    action: "card.report_lost.self_service",
    before: { cardStatus: emp.cardStatus, cardTokenHash: emp.cardTokenHash },
    after: { cardStatus: "lost", cardTokenHash: null, reason },
  });

  // Bump CRL version so kiosks re-sync immediately
  await db.systemState.update({
    where: { id: "singleton" },
    data: { crlVersion: { increment: 1 } },
  });

  return NextResponse.json({
    ok: true,
    cardStatus: "lost",
    message:
      "Card revoked. A new card must be issued by HR before you can scan again.",
  });
}
