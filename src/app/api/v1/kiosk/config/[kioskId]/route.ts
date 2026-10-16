import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/auth-runtime";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kioskId: string }> }
) {
  const { kioskId } = await params;

  const kiosk = await db.kiosk.findUnique({ where: { kioskId } });
  if (!kiosk) return fail("Not found", 404);

  const state = await db.systemState.findUnique({ where: { id: "singleton" } });

  return ok({
    kioskId: kiosk.kioskId,
    name: kiosk.name,
    location: kiosk.location,
    status: kiosk.status,
    thresholds: {
      granted: kiosk.thresholdGranted,
      challenge: kiosk.thresholdChallenge,
    },
    challengeMode: kiosk.challengeMode,
    crlVersion: state?.crlVersion ?? kiosk.crlVersion,
    configVersion: kiosk.configVersion,
    lockdown: {
      active: !!state?.lockdownActive,
      reason: state?.lockdownReason ?? null,
      startedAt: state?.lockdownStartedAt?.toISOString() ?? null,
    },
    lastSyncAt: kiosk.lastSyncAt?.toISOString() ?? null,
  });
}
