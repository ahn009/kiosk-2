import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  requireRole,
  parseBody,
  ok,
  fail,
  logAdminAction,
} from "@/lib/auth-runtime";
import { toKioskDTO } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ["security_officer", "superadmin"]);
  if (auth.response) return auth.response;
  const session = auth.session!;

  const { id } = await params;
  const body = await parseBody<{
    thresholdGranted?: number;
    thresholdChallenge?: number;
    challengeMode?: string;
    status?: string;
    name?: string;
    location?: string | null;
  }>(req);

  if (!body || Object.keys(body).length === 0) {
    return fail("No update fields provided", 400);
  }

  // Find by kioskId (id param may be kioskId or row id; try both)
  let kiosk = await db.kiosk.findUnique({ where: { kioskId: id } });
  if (!kiosk) {
    kiosk = await db.kiosk.findUnique({ where: { id } });
  }
  if (!kiosk) return fail("Not found", 404);

  const data: Record<string, unknown> = {};
  if (body.thresholdGranted !== undefined) {
    if (body.thresholdGranted < 0 || body.thresholdGranted > 1) {
      return fail("thresholdGranted must be in [0, 1]", 400);
    }
    data.thresholdGranted = body.thresholdGranted;
  }
  if (body.thresholdChallenge !== undefined) {
    if (body.thresholdChallenge < 0 || body.thresholdChallenge > 1) {
      return fail("thresholdChallenge must be in [0, 1]", 400);
    }
    data.thresholdChallenge = body.thresholdChallenge;
  }
  if (body.challengeMode !== undefined) data.challengeMode = body.challengeMode;
  if (body.status !== undefined) data.status = body.status;
  if (body.name !== undefined) data.name = body.name;
  if (body.location !== undefined) data.location = body.location;

  data.configVersion = { increment: 1 };

  const before = kiosk;
  const updated = await db.kiosk.update({
    where: { id: kiosk.id },
    data,
  });

  await logAdminAction({
    actorId: session.adminId,
    target: `kiosk:${updated.kioskId}`,
    action: "kiosk.update",
    before: {
      thresholdGranted: before.thresholdGranted,
      thresholdChallenge: before.thresholdChallenge,
      challengeMode: before.challengeMode,
      status: before.status,
    },
    after: {
      thresholdGranted: updated.thresholdGranted,
      thresholdChallenge: updated.thresholdChallenge,
      challengeMode: updated.challengeMode,
      status: updated.status,
    },
  });

  return ok(toKioskDTO(updated));
}
