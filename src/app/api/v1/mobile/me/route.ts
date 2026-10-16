import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-session";

export const dynamic = "force-dynamic";

function bearer(req: NextRequest) {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// Current employee's dashboard data: profile, card status, today's scan count,
// last entry, recent alerts (failed scans on their card).
export async function GET(req: NextRequest) {
  const token = bearer(req);
  const session = await getMobileSession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emp = await db.employee.findUnique({
    where: { id: session.employeeId },
    include: { department: { select: { name: true } } },
  });
  if (!emp) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [todayScans, lastGrant, alerts] = await Promise.all([
    db.scanEvent.count({
      where: {
        employeeId: emp.id,
        createdAt: { gte: startOfToday },
      },
    }),
    db.scanEvent.findFirst({
      where: { employeeId: emp.id, decision: "granted" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, kioskId: true },
    }),
    db.scanEvent.findMany({
      where: {
        employeeId: emp.id,
        decision: { in: ["denied", "challenge_failed"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        kioskId: true,
        decision: true,
        faceMatchStatus: true,
        faceMatchScore: true,
      },
    }),
  ]);

  return NextResponse.json({
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
    todayScans,
    lastEntry: lastGrant
      ? {
          at: lastGrant.createdAt.toISOString(),
          kioskId: lastGrant.kioskId,
        }
      : null,
    alerts: alerts.map((a) => ({
      id: a.id,
      at: a.createdAt.toISOString(),
      kioskId: a.kioskId,
      decision: a.decision,
      faceMatchStatus: a.faceMatchStatus,
      faceMatchScore: a.faceMatchScore,
    })),
  });
}
