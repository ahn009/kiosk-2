import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileSession } from "@/lib/mobile-session";

export const dynamic = "force-dynamic";

function bearer(req: NextRequest) {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

const PAGE_SIZE = 15;

export async function GET(req: NextRequest) {
  const token = bearer(req);
  const session = await getMobileSession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const [total, rows] = await Promise.all([
    db.scanEvent.count({ where: { employeeId: session.employeeId } }),
    db.scanEvent.findMany({
      where: { employeeId: session.employeeId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        kioskId: true,
        decision: true,
        faceMatchStatus: true,
        faceMatchScore: true,
        latencyMs: true,
        offline: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      kioskId: r.kioskId,
      decision: r.decision,
      faceMatchStatus: r.faceMatchStatus,
      faceMatchScore: r.faceMatchScore,
      latencyMs: r.latencyMs,
      offline: r.offline,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
