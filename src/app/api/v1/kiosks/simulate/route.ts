import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-runtime";
import { emitAlert } from "@/lib/emit-alert";
import { requireDemoMode } from "@/lib/demo-guard";

export const dynamic = "force-dynamic";

// Simulate a random kiosk status change (online → offline/maintenance and
// back). Emits a real-time alert. Used by the "Simulate status change" button
// in the kiosks view to demonstrate live monitoring + alert dispatch.
// DEMO ONLY — returns 404 unless DEMO_MODE is enabled.
export async function POST(req: NextRequest) {
  const demoBlocked = requireDemoMode();
  if (demoBlocked) return demoBlocked;
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;

  const kiosks = await db.kiosk.findMany();
  if (kiosks.length === 0) {
    return NextResponse.json({ error: "No kiosks" }, { status: 404 });
  }

  // Pick a random kiosk
  const kiosk = kiosks[Math.floor(Math.random() * kiosks.length)];

  // Decide the new status:
  // - If online → 40% offline, 30% maintenance, 30% back online (sync)
  // - If offline/maintenance → 80% back online, 20% stay
  let newStatus: string;
  let severity: "info" | "warning" | "critical";
  let title: string;
  let message: string;

  if (kiosk.status === "online") {
    const r = Math.random();
    if (r < 0.4) {
      newStatus = "offline";
      severity = "critical";
      title = `Kiosk ${kiosk.kioskId} went offline`;
      message = `${kiosk.name} (${kiosk.location ?? "—"}) stopped responding. Last sync was ${kiosk.lastSyncAt ? "recent" : "never"}.`;
    } else if (r < 0.7) {
      newStatus = "maintenance";
      severity = "warning";
      title = `Kiosk ${kiosk.kioskId} entered maintenance`;
      message = `${kiosk.name} switched to maintenance mode. Scans will be redirected to other kiosks.`;
    } else {
      newStatus = "online";
      severity = "info";
      title = `Kiosk ${kiosk.kioskId} heartbeat`;
      message = `${kiosk.name} checked in. Operating normally.`;
    }
  } else {
    if (Math.random() < 0.8) {
      newStatus = "online";
      severity = "info";
      title = `Kiosk ${kiosk.kioskId} back online`;
      message = `${kiosk.name} recovered from ${kiosk.status} and is now accepting scans.`;
    } else {
      newStatus = kiosk.status;
      severity = "warning";
      title = `Kiosk ${kiosk.kioskId} still ${kiosk.status}`;
      message = `${kiosk.name} remains in ${kiosk.status} state.`;
    }
  }

  // Only update if status actually changes
  if (newStatus !== kiosk.status) {
    await db.kiosk.update({
      where: { id: kiosk.id },
      data: {
        status: newStatus,
        lastSyncAt: newStatus === "online" ? new Date() : kiosk.lastSyncAt,
      },
    });
  } else if (newStatus === "online") {
    // online → online: just update sync
    await db.kiosk.update({
      where: { id: kiosk.id },
      data: { lastSyncAt: new Date() },
    });
  }

  // Emit real-time alert
  emitAlert({
    type: "kiosk_status",
    severity,
    title,
    message,
    kioskId: kiosk.kioskId,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    kioskId: kiosk.kioskId,
    name: kiosk.name,
    previousStatus: kiosk.status,
    newStatus,
    changed: newStatus !== kiosk.status,
    title,
    message,
    severity,
  });
}
