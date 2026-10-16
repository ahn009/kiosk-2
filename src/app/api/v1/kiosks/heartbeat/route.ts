import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-runtime";
import { emitAlert } from "@/lib/emit-alert";

export const dynamic = "force-dynamic";

// Simulate kiosk heartbeats: update lastSyncAt for all online kiosks + emit
// status events. In a real deployment each kiosk polls /kiosk/config every
// 10s and the heartbeat is inferred. Here we provide a manual trigger for
// the admin dashboard's "Simulate heartbeats" action + an auto-tick.
//
// Also bumps configVersion occasionally to simulate CRL sync pushes.
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["security_officer", "superadmin", "viewer"]);
  if (auth.response) return auth.response;

  const now = new Date();
  const kiosks = await db.kiosk.findMany({
    where: { status: { in: ["online", "maintenance"] } },
  });

  let updated = 0;
  for (const k of kiosks) {
    await db.kiosk.update({
      where: { id: k.id },
      data: { lastSyncAt: now },
    });
    updated += 1;
  }

  // Emit a kiosk_status info event for the live feeds (occasionally)
  if (Math.random() > 0.5) {
    emitAlert({
      type: "kiosk_status",
      severity: "info",
      title: "Heartbeat sync",
      message: `${updated} kiosk${updated > 1 ? "s" : ""} checked in · CRL v${kiosks[0]?.crlVersion ?? 1} synced`,
      kioskId: kiosks[0]?.kioskId,
      timestamp: now.toISOString(),
    });
  }

  return NextResponse.json({
    ok: true,
    updated,
    timestamp: now.toISOString(),
  });
}
